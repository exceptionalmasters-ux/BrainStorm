"use client"
import { useEffect, useRef, useState } from "react"
import {
    DrawioFrame,
    type DrawioFrameHandle,
} from "@/components/canvas/drawio-frame"
import { DrawingToolbar } from "@/components/workspace/drawing-toolbar"
import {
    DRAWIO_CSS,
    EMPTY_DRAWIO_DOCUMENT,
    getDrawioSrc,
    webDrawioSource,
} from "@/lib/drawio/drawio-config"
import { attachNativeTool } from "@/lib/drawio/editor-bridge"
import { createWhiteboardTools } from "@/lib/drawio/whiteboard-tools"
import { validLibraryIds } from "@/lib/library-presets"
import {
    type BoardLaser,
    type BoardPoint,
    type BoardStroke,
    type BoardTool,
    type BoardView,
    SHARED_BOARD_PROTOCOL,
    validBoardPoint,
    validBoardStroke,
    validBoardView,
} from "@/lib/shared-board"
import { validateAndFixXml } from "@/packages/mcp-server/src/xml-validation"
import { LibraryRail } from "./library-rail"

type State = {
    emLibrary?: boolean
    libraryIds?: string[]
    editable: boolean
    epoch: number
    revision: number
    xml?: string
    follow: boolean
    viewport?: BoardView
    annotations: BoardStroke[]
    lasers: BoardLaser[]
    actorId: string
    tool: BoardTool
    canAnnotate: boolean
}
export function SharedBoardCanvas() {
    const frame = useRef<DrawioFrameHandle>(null),
        tools = useRef<ReturnType<typeof createWhiteboardTools> | null>(null)
    const [src, setSrc] = useState(""),
        [state, setState] = useState<State | null>(null),
        [view, setView] = useState<any>(null),
        [pending, setPending] = useState<BoardStroke | null>(null)
    const current = useRef<State | null>(null),
        applied = useRef(false),
        suppress = useRef(false),
        lastXml = useRef(""),
        localStroke = useRef<BoardStroke | null>(null),
        lastView = useRef(""),
        lastLaser = useRef(0),
        pendingView = useRef<BoardView | undefined>(undefined),
        requests = useRef(
            new Map<
                string,
                {
                    resolve: (data: any) => void
                    reject: (error: Error) => void
                    timer: ReturnType<typeof setTimeout>
                }
            >(),
        )
    const parentOrigin =
        process.env.NEXT_PUBLIC_EMC_OPERATIONS_ORIGIN ||
        "https://exceptionalmasters.co.uk"
    const send = (type: string, data: object = {}) => {
        if (window.parent !== window)
            window.parent.postMessage(
                { protocol: SHARED_BOARD_PROTOCOL, type, ...data },
                new URL(parentOrigin).origin,
            )
    }
    useEffect(() => {
        const url = new URL(
            getDrawioSrc(webDrawioSource("en"), false),
            window.location.href,
        )
        url.searchParams.set("libs", "none")
        setSrc(url.href)
    }, [])
    const apply = (next: State) => {
        const before = current.current
        current.current = next
        setState(next)
        tools.current?.setEditable(next.editable)
        const shouldLoad =
            typeof next.xml === "string" &&
            (!applied.current ||
                !before?.editable ||
                !next.editable ||
                before.epoch !== next.epoch)
        if (shouldLoad && next.xml !== lastXml.current) {
            const xml = next.xml || EMPTY_DRAWIO_DOCUMENT
            if (xml.length > 2097152 || /<!DOCTYPE|<!ENTITY/i.test(xml)) {
                send("error", { message: "Invalid shared drawing" })
                return
            }
            const check = validateAndFixXml(xml)
            if (!check.valid) {
                send("error", {
                    message: "The shared drawing could not be loaded",
                })
                return
            }
            pendingView.current = !next.editable
                ? next.follow
                    ? next.viewport
                    : tools.current?.readView()
                : undefined
            suppress.current = true
            lastXml.current = xml
            applied.current = true
            frame.current?.load({ xml: check.fixed || xml })
        } else if (next.follow && next.viewport && !next.editable)
            tools.current?.applyView(next.viewport)
    }
    useEffect(() => {
        const receive = (event: MessageEvent) => {
            if (
                event.source !== window.parent ||
                event.origin !== new URL(parentOrigin).origin ||
                event.data?.protocol !== SHARED_BOARD_PROTOCOL
            )
                return
            const data = event.data
            if (
                data.type === "library-result" &&
                typeof data.requestId === "string"
            ) {
                const pending = requests.current.get(data.requestId)
                if (pending) {
                    clearTimeout(pending.timer)
                    requests.current.delete(data.requestId)
                    if (data.error) pending.reject(Error(String(data.error)))
                    else pending.resolve(data.result)
                }
                return
            }
            if (
                data.type === "state" &&
                data.state &&
                Number.isSafeInteger(data.state.epoch) &&
                Number.isSafeInteger(data.state.revision)
            ) {
                const s = data.state
                if (
                    s.libraryIds !== undefined &&
                    !validLibraryIds(s.libraryIds)
                )
                    return
                if (
                    !Array.isArray(s.annotations) ||
                    !s.annotations.every(validBoardStroke) ||
                    !Array.isArray(s.lasers) ||
                    s.lasers.some((l: any) => !validBoardPoint(l.point))
                )
                    return
                if (s.viewport && !validBoardView(s.viewport)) return
                if (current.current && s.epoch < current.current.epoch) return
                apply(s)
            } else if (
                data.type === "import" &&
                current.current?.editable &&
                data.epoch === current.current.epoch &&
                typeof data.xml === "string"
            ) {
                if (
                    data.xml.length > 2097152 ||
                    /<!DOCTYPE|<!ENTITY/i.test(data.xml)
                ) {
                    send("error", { message: "Invalid drawing" })
                    return
                }
                const checked = validateAndFixXml(data.xml)
                if (
                    !checked.valid ||
                    !/<(?:mxfile|mxGraphModel)\b/.test(data.xml)
                ) {
                    send("error", {
                        message: "The drawing could not be imported",
                    })
                    return
                }
                const xml = checked.fixed || data.xml
                suppress.current = true
                lastXml.current = xml
                applied.current = true
                frame.current?.load({ xml })
                send("document", { xml, epoch: current.current.epoch })
            } else if (data.type === "export-annotations" && tools.current) {
                send("annotated-export", {
                    svg: tools.current.exportAnnotated(
                        current.current?.annotations || [],
                    ),
                })
            }
        }
        window.addEventListener("message", receive)
        return () => window.removeEventListener("message", receive)
    }, [])
    useEffect(() => {
        const timer = setInterval(() => {
            if (!tools.current) return
            setView(tools.current.viewport())
            const v = tools.current.readView(),
                key = JSON.stringify(v)
            if (key !== lastView.current) {
                lastView.current = key
                send("viewport", { viewport: v, epoch: current.current?.epoch })
            }
        }, 150)
        return () => clearInterval(timer)
    }, [])
    const ready = () => {
        attachNativeTool((ui, win) => {
            tools.current = createWhiteboardTools(ui, win)
            tools.current.setEditable(current.current?.editable === true)
            setView(tools.current.viewport())
            return () => {}
        })
        suppress.current = false
        const state = current.current
        const target = state?.follow ? state.viewport : pendingView.current
        if (state && !state.editable && target) tools.current?.applyView(target)
        pendingView.current = undefined
        send("ready")
    }
    const loadEM = (action: string, body: unknown) =>
        new Promise<any>((resolve, reject) => {
            const requestId = crypto.randomUUID()
            const timer = setTimeout(() => {
                requests.current.delete(requestId)
                reject(Error("EM library request timed out"))
            }, 20000)
            requests.current.set(requestId, { resolve, reject, timer })
            send("library-request", { requestId, action, body })
        })
    useEffect(
        () => () => {
            for (const request of requests.current.values()) {
                clearTimeout(request.timer)
                request.reject(Error("Board closed"))
            }
            requests.current.clear()
        },
        [],
    )
    const pointer = (event: React.PointerEvent): BoardPoint | null => {
        if (!tools.current) return null
        const point = tools.current.toDocument({
            x: event.clientX,
            y: event.clientY,
        })
        return validBoardPoint(point) ? point : null
    }
    const overlay =
        state &&
        view &&
        (state.tool === "laser" ||
            ((state.tool === "pen" || state.tool === "highlight") &&
                state.canAnnotate))
    const visibleStrokes = [
        ...(state?.annotations || []),
        ...(pending ? [pending] : []),
    ].filter((s) => s.pageId === view?.pageId)
    return (
        <main
            className="fixed inset-0 flex flex-col bg-background"
            data-testid="shared-board-canvas"
        >
            {state?.editable && <DrawingToolbar section="all" />}
            {!state && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-background">
                    Open this shared board from EMC.
                </div>
            )}
            <div className="relative min-h-0 flex-1">
                {state && (
                    <LibraryRail
                        shared
                        userId={state.actorId}
                        libraries={state.libraryIds}
                        editable={state.editable}
                        onChange={(ids) => {
                            if (current.current?.editable)
                                send("libraries", {
                                    libraryIds: ids,
                                    epoch: current.current.epoch,
                                })
                        }}
                        loadEM={state.emLibrary ? loadEM : undefined}
                    />
                )}
                <div
                    className="absolute inset-y-0 right-0"
                    style={{ left: state ? 52 : 0 }}
                >
                    {src && (
                        <DrawioFrame
                            ref={frame}
                            src={src}
                            css={DRAWIO_CSS}
                            dark={false}
                            unifiedToolbar
                            libraryDefaults="none"
                            onLoad={ready}
                            onAutoSave={(data) => {
                                const s = current.current
                                if (
                                    !s?.editable ||
                                    suppress.current ||
                                    typeof data.xml !== "string" ||
                                    data.xml.length > 2097152
                                )
                                    return
                                lastXml.current = data.xml
                                send("document", {
                                    xml: data.xml,
                                    viewport: tools.current?.readView(),
                                    epoch: s.epoch,
                                })
                            }}
                        />
                    )}
                </div>
            </div>
            {view && (
                <svg
                    aria-label="Shared board annotations"
                    role="img"
                    data-testid="whiteboard-annotation-layer"
                    className="absolute overflow-hidden"
                    style={{
                        left: view.x,
                        top: view.y,
                        width: view.width,
                        height: view.height,
                        pointerEvents: overlay ? "auto" : "none",
                        touchAction: "none",
                        cursor:
                            state?.tool === "laser" ? "crosshair" : "default",
                    }}
                    onPointerDown={(event) => {
                        const p = pointer(event),
                            s = current.current
                        if (!p || !s || !view) return
                        event.currentTarget.setPointerCapture(event.pointerId)
                        if (
                            (s.tool === "pen" || s.tool === "highlight") &&
                            s.canAnnotate
                        ) {
                            localStroke.current = {
                                id: crypto.randomUUID(),
                                actorId: s.actorId,
                                pageId: view.pageId,
                                kind: s.tool,
                                points: [p],
                            }
                            setPending(localStroke.current)
                        }
                        if (s.tool === "laser")
                            send("laser", { point: p, pageId: view.pageId })
                    }}
                    onPointerMove={(event) => {
                        const p = pointer(event),
                            s = current.current
                        if (!p || !s) return
                        if (
                            s.tool === "laser" &&
                            Date.now() - lastLaser.current > 120
                        ) {
                            lastLaser.current = Date.now()
                            send("laser", { point: p, pageId: view.pageId })
                        }
                        const stroke = localStroke.current
                        if (
                            stroke &&
                            stroke.points.length < 1000 &&
                            Math.hypot(
                                p.x - stroke.points[stroke.points.length - 1].x,
                                p.y - stroke.points[stroke.points.length - 1].y,
                            ) > 1
                        ) {
                            stroke.points.push(p)
                            setPending({ ...stroke })
                        }
                    }}
                    onPointerUp={() => {
                        const stroke = localStroke.current
                        localStroke.current = null
                        setPending(null)
                        if (stroke && validBoardStroke(stroke))
                            send("annotation", { stroke })
                    }}
                    onPointerCancel={() => {
                        localStroke.current = null
                        setPending(null)
                    }}
                >
                    <g
                        transform={`translate(${view.translate.x * view.scale - view.scroll.x} ${view.translate.y * view.scale - view.scroll.y}) scale(${view.scale})`}
                    >
                        {visibleStrokes.map((s) => (
                            <polyline
                                key={s.id}
                                points={s.points
                                    .map((p) => `${p.x},${p.y}`)
                                    .join(" ")}
                                fill="none"
                                stroke={
                                    s.kind === "highlight"
                                        ? "#fbbf24"
                                        : "#e11d48"
                                }
                                opacity={s.kind === "highlight" ? 0.35 : 1}
                                strokeWidth={s.kind === "highlight" ? 14 : 2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        ))}
                        {(state?.lasers || [])
                            .filter((l) => l.pageId === view.pageId)
                            .map((l) => (
                                <circle
                                    key={l.actorId}
                                    cx={l.point.x}
                                    cy={l.point.y}
                                    r={5 / view.scale}
                                    fill="#ef4444"
                                    opacity="0.85"
                                />
                            ))}
                    </g>
                </svg>
            )}
        </main>
    )
}
