"use client"

import { Plus, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Workspace } from "@/components/workspace/workspace"
import {
    WORKBENCH_PROTOCOL,
    type WorkbenchEvent,
} from "@/lib/document-workbench"
import {
    connectOperations,
    getOperationsContext,
    isOperationsMode,
    OPERATIONS_PROTOCOL,
    operationsAuthorization,
    operationsHost,
    operationsParentOrigin,
    reconnectOperations,
} from "@/lib/operations-bridge"

type Tab = {
    id: string
    title: string
    sessionId: string | null
    busy: boolean
    dirty?: boolean
    file?: File
}
const MAX_OPEN_DOCUMENTS = 8

/** Each document retains its own editor, undo stack, conversation and unsent prompt. */
export function DocumentWorkbench({
    requireOperations = false,
}: {
    requireOperations?: boolean
}) {
    const [child, setChild] = useState<boolean | null>(null)
    const [error, setError] = useState("")
    const [connectionAttempt, setConnectionAttempt] = useState(0)
    useEffect(() => {
        let cancelled = false
        let cleanup: (() => void) | undefined
        const start = async () => {
            try {
                if (requireOperations && !isOperationsMode())
                    throw new Error(
                        "Open the drawing workspace from Client Requests or Projects in Operations.",
                    )
                if (isOperationsMode())
                    cleanup = await connectOperations(() => cancelled)
                if (cancelled) {
                    cleanup?.()
                    return
                }
                setChild(
                    new URLSearchParams(window.location.search).get(
                        "documentFrame",
                    ) === "1",
                )
            } catch (cause) {
                if (!cancelled)
                    setError(
                        cause instanceof Error
                            ? cause.message
                            : "Operations is unavailable.",
                    )
            }
        }
        void start()
        return () => {
            cancelled = true
            cleanup?.()
        }
    }, [requireOperations, connectionAttempt])
    if (error)
        return (
            <div
                className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-canvas p-6 text-foreground"
                role="alert"
            >
                <h1>BrainStorm · Operations</h1>
                <p>{error}</p>
                <button
                    type="button"
                    onClick={() =>
                        void reconnectOperations()
                            .then(() => {
                                setError("")
                                setConnectionAttempt((x) => x + 1)
                            })
                            .catch((e) => setError(e.message))
                    }
                >
                    Connect to EMC
                </button>
            </div>
        )
    if (child === null) return <div className="fixed inset-0 bg-canvas" />
    return child ? <Workspace /> : <Workbench />
}

function Workbench() {
    const [tabs, setTabs] = useState<Tab[]>([
        { id: "root", title: "Untitled diagram", sessionId: null, busy: false },
    ])
    const [active, setActive] = useState("root")
    const tabsRef = useRef(tabs)
    tabsRef.current = tabs
    const activeRef = useRef(active)
    activeRef.current = active
    useEffect(() => {
        const warn = (event: BeforeUnloadEvent) => {
            if (tabsRef.current.some((tab) => tab.dirty)) {
                event.preventDefault()
                event.returnValue = ""
            }
        }
        window.addEventListener("beforeunload", warn)
        return () => window.removeEventListener("beforeunload", warn)
    }, [])
    const frames = useRef(new Map<string, HTMLIFrameElement>())
    const relay = useRef(
        new Map<string, { source: Window; originalId: string }>(),
    )
    const flushes = useRef(
        new Map<string, { id: string; resolve: (ok: boolean) => void }>(),
    )
    const [contextLabel, setContextLabel] = useState(
        getOperationsContext()?.label || "",
    )

    useEffect(() => {
        sessionStorage.setItem(
            "brainstorm-open-documents",
            JSON.stringify(tabs.map((tab) => tab.sessionId).filter(Boolean)),
        )
    }, [tabs])

    const add = (sessionId: string | null = null, file?: File) => {
        if (getOperationsContext()?.readOnly && (!sessionId || file)) {
            toast.info(
                "This workspace is read-only. Open an existing drawing from Recent diagrams.",
            )
            return
        }
        const existing =
            sessionId &&
            tabsRef.current.find((tab) => tab.sessionId === sessionId)
        if (existing) {
            setActive(existing.id)
            return
        }
        if (tabsRef.current.length >= MAX_OPEN_DOCUMENTS) {
            toast.info(
                "Close a drawing tab before opening another (maximum 8). Your saved drawings remain available in Recent diagrams.",
            )
            return
        }
        const tab: Tab = {
            id: crypto.randomUUID(),
            title: file?.name || "Untitled diagram",
            sessionId,
            busy: false,
            file,
        }
        setTabs((previous) => [...previous, tab])
        setActive(tab.id)
    }
    const remove = (id: string) => {
        setTabs((previous) => {
            const remaining = previous.filter((tab) => tab.id !== id)
            if (!remaining.length)
                remaining.push({
                    id: "root",
                    title: "Untitled diagram",
                    sessionId: null,
                    busy: false,
                })
            setActive((current) =>
                current === id ? remaining[remaining.length - 1].id : current,
            )
            return remaining
        })
    }
    const handle = (id: string, event: WorkbenchEvent) => {
        if (event.type === "new") add()
        else if (event.type === "open") add(event.sessionId)
        else if (event.type === "import") add(null, event.file)
        else if (event.type === "close") remove(id)
        else if (event.type === "state")
            setTabs((previous) =>
                previous.map((tab) =>
                    tab.id === id ? { ...tab, ...event } : tab,
                ),
            )
    }
    const handler = useRef(handle)
    handler.current = handle

    useEffect(() => {
        const local = (event: Event) =>
            handler.current(
                "root",
                (event as CustomEvent<WorkbenchEvent>).detail,
            )
        const shortcut = (event: KeyboardEvent) => {
            if (
                activeRef.current === "root" ||
                !(event.ctrlKey || event.metaKey) ||
                !["s", "o", "z", "y", "b", "/"].includes(
                    event.key.toLowerCase(),
                )
            )
                return
            event.preventDefault()
            frames.current.get(activeRef.current)?.contentWindow?.postMessage(
                {
                    protocol: WORKBENCH_PROTOCOL,
                    type: "shortcut",
                    keys: {
                        key: event.key,
                        ctrlKey: event.ctrlKey,
                        metaKey: event.metaKey,
                        shiftKey: event.shiftKey,
                    },
                },
                window.location.origin,
            )
        }
        window.addEventListener("keydown", shortcut)
        const receive = (event: MessageEvent) => {
            const data = event.data
            if (
                data?.protocol === OPERATIONS_PROTOCOL &&
                data.kind === "flush" &&
                event.source === operationsHost() &&
                isOperationsMode()
            ) {
                let origin: string
                try {
                    origin = operationsParentOrigin()
                } catch {
                    return
                }
                if (event.origin !== origin) return
                const saves = tabsRef.current.map(
                    (tab) =>
                        new Promise<boolean>((resolve) => {
                            if (tab.id === "root")
                                window.dispatchEvent(
                                    new CustomEvent(
                                        "brainstorm-flush-document",
                                        { detail: { resolve } },
                                    ),
                                )
                            else {
                                const requestId = crypto.randomUUID()
                                flushes.current.set(requestId, {
                                    id: tab.id,
                                    resolve,
                                })
                                frames.current
                                    .get(tab.id)
                                    ?.contentWindow?.postMessage(
                                        {
                                            protocol: WORKBENCH_PROTOCOL,
                                            type: "flush-request",
                                            requestId,
                                        },
                                        window.location.origin,
                                    )
                                setTimeout(() => {
                                    if (flushes.current.delete(requestId))
                                        resolve(false)
                                }, 45000)
                            }
                        }),
                )
                void Promise.all(saves).then((results) =>
                    operationsHost()?.postMessage(
                        {
                            protocol: OPERATIONS_PROTOCOL,
                            kind: "flush-result",
                            requestId: data.requestId,
                            ok: results.every(Boolean),
                        },
                        origin,
                    ),
                )
                return
            }
            if (
                data?.protocol === OPERATIONS_PROTOCOL &&
                data.kind === "response" &&
                event.source === operationsHost() &&
                isOperationsMode()
            ) {
                let origin: string
                try {
                    origin = operationsParentOrigin()
                } catch {
                    return
                }
                if (event.origin !== origin) return
                const pending = relay.current.get(data.requestId)
                if (pending) {
                    relay.current.delete(data.requestId)
                    pending.source.postMessage(
                        { ...data, requestId: pending.originalId },
                        window.location.origin,
                    )
                }
                if (data.result?.label) setContextLabel(data.result.label)
                return
            }
            if (event.origin !== window.location.origin) return
            const pair = [...frames.current.entries()].find(
                ([, frame]) => frame.contentWindow === event.source,
            )
            if (!pair || !event.source) return
            const [id] = pair
            if (data?.protocol === WORKBENCH_PROTOCOL) {
                if (data.type === "flushed") {
                    const pending = flushes.current.get(data.requestId)
                    if (pending?.id === id) {
                        flushes.current.delete(data.requestId)
                        pending.resolve(data.ok === true)
                    }
                } else if (data.type === "ready") {
                    const file = tabsRef.current.find(
                        (tab) => tab.id === id,
                    )?.file
                    if (file) {
                        pair[1].contentWindow?.postMessage(
                            {
                                protocol: WORKBENCH_PROTOCOL,
                                type: "load-file",
                                file,
                            },
                            window.location.origin,
                        )
                        setTabs((previous) =>
                            previous.map((tab) =>
                                tab.id === id
                                    ? { ...tab, file: undefined }
                                    : tab,
                            ),
                        )
                    }
                } else handler.current(id, data as WorkbenchEvent)
            }
            if (
                data?.protocol === OPERATIONS_PROTOCOL &&
                data.kind === "request" &&
                isOperationsMode()
            ) {
                let origin: string
                try {
                    origin = operationsParentOrigin()
                } catch {
                    return
                }
                const context = getOperationsContext()
                if (context && ["context", "authorize"].includes(data.method)) {
                    const target = event.source as Window
                    void operationsAuthorization()
                        .then((authorization) => {
                            target.postMessage(
                                {
                                    protocol: OPERATIONS_PROTOCOL,
                                    kind: "response",
                                    requestId: data.requestId,
                                    result:
                                        data.method === "context"
                                            ? { ...context, authorization }
                                            : authorization,
                                },
                                window.location.origin,
                            )
                        })
                        .catch((error) => {
                            target.postMessage(
                                {
                                    protocol: OPERATIONS_PROTOCOL,
                                    kind: "response",
                                    requestId: data.requestId,
                                    error:
                                        error instanceof Error
                                            ? error.message
                                            : "Operations access unavailable",
                                },
                                window.location.origin,
                            )
                        })
                    return
                }
                if (relay.current.size >= 100) return
                const requestId = crypto.randomUUID()
                relay.current.set(requestId, {
                    source: event.source as Window,
                    originalId: data.requestId,
                })
                operationsHost()?.postMessage({ ...data, requestId }, origin)
                setTimeout(() => relay.current.delete(requestId), 46000)
            }
        }
        window.addEventListener("brainstorm-workbench", local)
        window.addEventListener("message", receive)
        return () => {
            window.removeEventListener("brainstorm-workbench", local)
            window.removeEventListener("keydown", shortcut)
            window.removeEventListener("message", receive)
        }
    }, [])

    const close = (tab: Tab) => {
        setActive(tab.id)
        if (tab.busy) {
            toast.info(
                "Finish or stop the current operation before closing this drawing.",
            )
            return
        }
        if (tab.id === "root")
            window.dispatchEvent(new Event("brainstorm-close-document"))
        else
            frames.current
                .get(tab.id)
                ?.contentWindow?.postMessage(
                    { protocol: WORKBENCH_PROTOCOL, type: "close-request" },
                    window.location.origin,
                )
    }
    const frameUrl = (tab: Tab) => {
        const url = new URL(window.location.href)
        url.searchParams.delete("session")
        url.searchParams.delete("prompt")
        url.searchParams.set("documentFrame", "1")
        url.searchParams.set("workbenchId", tab.id)
        if (tab.sessionId) url.searchParams.set("session", tab.sessionId)
        else url.searchParams.set("blank", "1")
        url.hash = ""
        return url.href
    }
    // Keep initial iframe URLs stable when a new document acquires a saved ID.
    const urls = useRef(new Map<string, string>())
    for (const tab of tabs)
        if (tab.id !== "root" && !urls.current.has(tab.id))
            urls.current.set(tab.id, frameUrl(tab))

    return (
        <div
            className="fixed inset-0 flex flex-col bg-canvas"
            data-testid="document-workbench"
        >
            {contextLabel && (
                <div className="shrink-0 border-b border-border px-3 py-1 text-xs text-muted-foreground">
                    Operations · {contextLabel}
                    <button
                        className="ml-3 rounded border px-2 py-1"
                        type="button"
                        onClick={() =>
                            void reconnectOperations()
                                .then(() =>
                                    toast.success("EMC session connected"),
                                )
                                .catch((e) => toast.error(e.message))
                        }
                    >
                        Reconnect EMC
                    </button>
                </div>
            )}
            <div className="relative min-h-0 flex-1">
                <div
                    className="absolute inset-0"
                    style={{
                        visibility: active === "root" ? "visible" : "hidden",
                        pointerEvents: active === "root" ? "auto" : "none",
                    }}
                    inert={active !== "root"}
                    aria-hidden={active !== "root"}
                >
                    <Workspace />
                </div>
                {tabs
                    .filter((tab) => tab.id !== "root")
                    .map((tab) => (
                        <iframe
                            key={tab.id}
                            ref={(frame) => {
                                if (frame) frames.current.set(tab.id, frame)
                                else frames.current.delete(tab.id)
                            }}
                            src={urls.current.get(tab.id)}
                            title={tab.title}
                            data-testid="document-frame"
                            data-active={active === tab.id}
                            className="absolute inset-0 h-full w-full border-0"
                            style={{
                                visibility:
                                    active === tab.id ? "visible" : "hidden",
                                pointerEvents:
                                    active === tab.id ? "auto" : "none",
                            }}
                            inert={active !== tab.id}
                            aria-hidden={active !== tab.id}
                            allow="clipboard-read; clipboard-write"
                        />
                    ))}
            </div>
            <div
                className="flex shrink-0 items-center gap-1 overflow-x-auto border-t border-border bg-card px-2 py-1 pb-[max(4px,env(safe-area-inset-bottom))]"
                data-testid="document-tabs"
            >
                <div
                    className="flex min-w-0 items-center gap-1"
                    role="tablist"
                    aria-label="Open drawings"
                >
                    {tabs.map((tab) => (
                        <div
                            key={tab.id}
                            className="flex shrink-0 items-center rounded-md border border-border"
                        >
                            <button
                                type="button"
                                role="tab"
                                aria-selected={active === tab.id}
                                onClick={() => setActive(tab.id)}
                                onKeyDown={(event) => {
                                    const index = tabs.findIndex(
                                        (item) => item.id === tab.id,
                                    )
                                    const next =
                                        event.key === "ArrowRight"
                                            ? tabs[(index + 1) % tabs.length]
                                            : event.key === "ArrowLeft"
                                              ? tabs[
                                                    (index - 1 + tabs.length) %
                                                        tabs.length
                                                ]
                                              : null
                                    if (next) {
                                        event.preventDefault()
                                        setActive(next.id)
                                        ;(
                                            event.currentTarget.parentElement?.parentElement?.querySelectorAll(
                                                '[role="tab"]',
                                            )[tabs.indexOf(next)] as HTMLElement
                                        )?.focus()
                                    }
                                }}
                                className={`max-w-52 truncate px-3 py-2 text-xs ${active === tab.id ? "bg-accent font-medium text-foreground" : "text-muted-foreground"}`}
                            >
                                {tab.title}
                                {tab.dirty ? " •" : ""}
                                {tab.busy ? " · …" : ""}
                            </button>
                            <button
                                type="button"
                                aria-label={`Close ${tab.title}`}
                                disabled={tab.busy}
                                onClick={() => close(tab)}
                                className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-40"
                            >
                                <X className="size-3" />
                            </button>
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    aria-label="New drawing"
                    onClick={() => add()}
                    className="shrink-0 rounded-md p-2 text-primary hover:bg-accent"
                >
                    <Plus className="size-4" />
                </button>
            </div>
        </div>
    )
}
