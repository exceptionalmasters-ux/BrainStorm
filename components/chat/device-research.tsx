"use client"
import { SymbolPreview } from "@/components/workspace/symbol-preview"

export { SymbolPreview } from "@/components/workspace/symbol-preview"

import { Globe, Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { insertEmcSymbol } from "@/lib/drawio/editor-bridge"
import {
    type DeviceCandidate,
    type EmcSymbol,
    validateEmcSymbol,
} from "@/lib/emc-symbols"
import { getOperationsContext, isOperationsMode } from "@/lib/operations-bridge"
import { useCanvasStore } from "@/stores/canvas-store"
import {
    disableDeviceWeb,
    draftDevice,
    emcAction,
    researchDevice,
    useDeviceResearch,
} from "@/stores/device-research-store"
import { useChatEngine } from "./chat-engine"
import { openSourceAttachment, SourceFiles } from "./source-files"

function ApprovalDialog() {
    const { draft, result, set } = useDeviceResearch()
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const canvasBusy = useCanvasStore((s) => s.isBusy)
    const alive = useRef(true)
    useEffect(() => {
        alive.current = true
        return () => {
            alive.current = false
        }
    }, [])
    const editable = !getOperationsContext()?.readOnly
    const updatePin = (
        index: number,
        patch: Partial<EmcSymbol["pins"][number]>,
    ) => {
        if (draft)
            set({
                draft: {
                    ...draft,
                    pins: draft.pins.map((p, i) =>
                        i === index ? { ...p, ...patch } : p,
                    ),
                },
            })
    }
    return (
        <Dialog
            open={!!draft}
            onOpenChange={(open) => {
                if (!open && !saving) {
                    set({ draft: null })
                    setError("")
                }
            }}
        >
            <DialogContent
                className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
                onEscapeKeyDown={(e) => {
                    if (saving) e.preventDefault()
                }}
                onInteractOutside={(e) => {
                    if (saving) e.preventDefault()
                }}
            >
                <DialogHeader>
                    <DialogTitle>Approve EMC symbol</DialogTitle>
                    <DialogDescription>
                        Check the exact device, package and every pin against
                        the linked datasheet. Nothing is saved or inserted until
                        you approve.
                    </DialogDescription>
                </DialogHeader>
                {draft && (
                    <>
                        {draft.incomplete && (
                            <p
                                role="alert"
                                className="rounded border border-amber-500 p-2 text-amber-400"
                            >
                                Incomplete proposal — not a verified pinout.
                                Unknown pins are omitted.{" "}
                                {(draft.warnings || []).join(" ")}
                            </p>
                        )}
                        <label className="text-sm">
                            Symbol name
                            <Input
                                value={draft.name}
                                maxLength={120}
                                disabled={saving}
                                onChange={(e) =>
                                    set({
                                        draft: {
                                            ...draft,
                                            name: e.target.value,
                                        },
                                    })
                                }
                            />
                        </label>
                        <p className="text-sm">
                            {draft.device} · {draft.package}
                            {draft.sourceKind && (
                                <span className="block">
                                    Source analysed:{" "}
                                    {draft.sourceKind === "pdf"
                                        ? "PDF text and page images"
                                        : draft.sourceKind === "image"
                                          ? "source image"
                                          : draft.sourceKind === "document"
                                            ? "attached document text"
                                            : "research summary only"}
                                </span>
                            )}
                        </p>
                        <SymbolPreview symbol={draft} />
                        <div className="max-h-64 space-y-2 overflow-auto">
                            {draft.pins.map((pin, index) => (
                                <div
                                    key={`${index}-${pin.number}`}
                                    className="grid grid-cols-[50px_1fr_90px] gap-2 rounded border p-2 text-xs"
                                >
                                    <span className="self-center">
                                        Pin {pin.number}
                                    </span>
                                    <Input
                                        aria-label={`Pin ${pin.number} name`}
                                        value={pin.name}
                                        disabled={saving}
                                        maxLength={60}
                                        onChange={(e) =>
                                            updatePin(index, {
                                                name: e.target.value,
                                            })
                                        }
                                    />
                                    <select
                                        aria-label={`Pin ${pin.number} side`}
                                        className="rounded border bg-background"
                                        value={pin.side}
                                        disabled={saving}
                                        onChange={(e) =>
                                            updatePin(index, {
                                                side: e.target
                                                    .value as typeof pin.side,
                                            })
                                        }
                                    >
                                        {["left", "right", "top", "bottom"].map(
                                            (side) => (
                                                <option key={side}>
                                                    {side}
                                                </option>
                                            ),
                                        )}
                                    </select>
                                    <a
                                        href={pin.sourceUrl}
                                        onClick={(e) => {
                                            if (result?.sourceId) {
                                                e.preventDefault()
                                                void openSourceAttachment(
                                                    result.sourceId,
                                                ).catch((e) =>
                                                    setError(e.message),
                                                )
                                            }
                                        }}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="col-span-3 text-amber-400 underline"
                                    >
                                        {pin.evidence}
                                    </a>
                                </div>
                            ))}
                        </div>
                        {error && (
                            <p role="alert" className="text-sm text-red-500">
                                {error}
                            </p>
                        )}
                        <div className="flex flex-wrap justify-end gap-2">
                            <Button
                                variant="outline"
                                disabled={saving}
                                onClick={() => {
                                    set({ draft: null })
                                    setError("")
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                disabled={
                                    saving || canvasBusy || !editable || !result
                                }
                                onClick={async () => {
                                    const valid = validateEmcSymbol(draft)
                                    if (!valid) {
                                        setError(
                                            "Check names, unique pin numbers, and source URLs.",
                                        )
                                        return
                                    }
                                    setSaving(true)
                                    setError("")
                                    try {
                                        await emcAction("approve", {
                                            approved: true,
                                            researchId: result?.researchId,
                                            symbol: draft,
                                        })
                                        const inserted = insertEmcSymbol(draft)
                                        toast.success(
                                            inserted
                                                ? "Symbol saved to EMC library and inserted"
                                                : "Symbol saved. Insert it from the EMC library when the canvas is ready.",
                                        )
                                        if (alive.current) set({ draft: null })
                                    } catch (e) {
                                        if (alive.current)
                                            setError(
                                                e instanceof Error
                                                    ? e.message
                                                    : "Save failed",
                                            )
                                    } finally {
                                        if (alive.current) setSaving(false)
                                    }
                                }}
                            >
                                {saving ? "Saving…" : "Approve, save & insert"}
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}

export function DeviceResearchPanel() {
    const state = useDeviceResearch()
    const engine = useChatEngine()
    const [fileMode, setFileMode] = useState(false)
    const [warning, setWarning] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const [query, setQuery] = useState("")
    const [preview, setPreview] = useState<DeviceCandidate | null>(null)
    const [elapsed, setElapsed] = useState(0)
    useEffect(() => {
        if (!state.busy || !state.startedAt) return
        const tick = () =>
            setElapsed(
                Math.floor(
                    (Date.now() - (state.startedAt || Date.now())) / 1000,
                ),
            )
        tick()
        const timer = setInterval(tick, 1000)
        return () => clearInterval(timer)
    }, [state.busy, state.startedAt])
    const readonly = getOperationsContext()?.readOnly
    if (!isOperationsMode()) return null
    return (
        <div
            className="max-h-[45vh] shrink-0 overflow-y-auto border-b px-3 py-2 text-xs"
            data-testid="device-research"
        >
            <Dialog
                open={!!preview}
                onOpenChange={(open) => {
                    if (!open) setPreview(null)
                }}
            >
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>
                            {preview?.title || "Source preview"}
                        </DialogTitle>
                        <DialogDescription>
                            Source evidence; verify the device variant and
                            pinout before wiring.
                        </DialogDescription>
                    </DialogHeader>
                    {preview?.imageUrl && (
                        <img
                            src={preview.sourceImageUrl || preview.imageUrl}
                            alt={preview.title}
                            referrerPolicy="no-referrer"
                            className="max-h-[65vh] w-full bg-white object-contain"
                        />
                    )}
                    {preview &&
                        !preview.imageUrl &&
                        preview.sourceUrl
                            .split(/[?#]/)[0]
                            .toLowerCase()
                            .endsWith(".pdf") && (
                            <iframe
                                title={`${preview.title} PDF preview`}
                                src={`${preview.sourceUrl}#page=1&view=FitH`}
                                className="h-[60vh] w-full bg-white"
                                referrerPolicy="no-referrer"
                            />
                        )}
                    <p className="text-sm">{preview?.description}</p>
                    <div className="flex gap-2">
                        <a
                            className="underline"
                            href={preview?.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Open original source
                        </a>
                        <Button
                            disabled={state.busy || readonly}
                            onClick={() => {
                                if (preview) {
                                    void draftDevice(preview.id)
                                    setPreview(null)
                                }
                            }}
                        >
                            Create symbol
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            <div className="flex items-center gap-2">
                <Globe className="size-4" />
                <label
                    htmlFor="device-web-switch"
                    className={
                        state.webEnabled ? "font-semibold text-red-500" : ""
                    }
                >
                    {state.webEnabled ? "WEB ACTIVE" : "Web"}
                </label>
                <Switch
                    id="device-web-switch"
                    checked={state.webEnabled}
                    disabled={readonly || (engine.isBusy && !state.webEnabled)}
                    onCheckedChange={(enabled) => {
                        if (enabled) setWarning(true)
                        else {
                            disableDeviceWeb()
                            engine.stop()
                        }
                    }}
                />
                <button
                    type="button"
                    className="rounded border px-2 py-1 hover:bg-accent"
                    onClick={() => setExpanded(!expanded)}
                    aria-expanded={expanded}
                >
                    Research
                </button>
            </div>
            <button
                type="button"
                className="mt-2 rounded border px-2 py-1"
                onClick={() => {
                    setFileMode(!fileMode)
                    if (!fileMode) {
                        disableDeviceWeb()
                        setExpanded(false)
                    }
                }}
            >
                Create symbol from file
            </button>
            {fileMode && <SourceFiles readonly={!!readonly} />}
            {(expanded || state.busy || state.result || state.error) && (
                <div className="mt-2 max-h-[35vh] space-y-2 overflow-y-auto">
                    {!fileMode && (
                        <form
                            className="flex gap-1"
                            onSubmit={(e) => {
                                e.preventDefault()
                                if (query.trim())
                                    void researchDevice(query.trim()).catch(
                                        () => {},
                                    )
                            }}
                        >
                            <Input
                                aria-label="Device search"
                                placeholder="Exact model, type, package…"
                                maxLength={1000}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                disabled={
                                    !state.webEnabled || state.busy || readonly
                                }
                            />
                            <Button
                                type="submit"
                                variant="outline"
                                size="sm"
                                disabled={
                                    !state.webEnabled ||
                                    state.busy ||
                                    !query.trim() ||
                                    readonly
                                }
                            >
                                Search
                            </Button>
                        </form>
                    )}
                    {state.busy && (
                        <p role="status" className="flex items-center gap-2">
                            <Loader2 className="size-3 animate-spin" />
                            {state.phase || "Researching device"}… {elapsed}s
                        </p>
                    )}
                    {state.error && (
                        <p
                            role="alert"
                            className="whitespace-pre-wrap text-red-500"
                        >
                            {state.error}
                        </p>
                    )}
                    {state.incompleteCandidateId && (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                disabled={
                                    state.busy ||
                                    (!state.webEnabled &&
                                        !state.result?.sourceId) ||
                                    readonly
                                }
                                onClick={() =>
                                    void draftDevice(
                                        state.incompleteCandidateId!,
                                        "",
                                        true,
                                    )
                                }
                            >
                                Create anyway
                            </Button>
                            <Button
                                variant="outline"
                                disabled={state.busy}
                                onClick={() =>
                                    state.set({
                                        incompleteCandidateId: null,
                                        error: "",
                                    })
                                }
                            >
                                Dismiss
                            </Button>
                        </div>
                    )}
                    {state.result?.status === "no_sources" && (
                        <p role="status">
                            No verified source found. Try another query or
                            attach a datasheet.
                        </p>
                    )}
                    {state.result?.warnings?.map((w) => (
                        <p key={w} className="text-amber-500">
                            {w}
                        </p>
                    ))}
                    {state.result?.elapsedMs !== undefined && !state.busy && (
                        <p className="text-muted-foreground">
                            {state.result.candidates.length} source-backed
                            proposals ·{" "}
                            {(state.result.elapsedMs / 1000).toFixed(1)}s
                        </p>
                    )}
                    {state.result?.questions.map((q) => (
                        <p
                            key={q}
                            className="rounded border border-amber-500/40 p-2"
                        >
                            {q}
                        </p>
                    ))}
                    {state.result?.candidates.map((candidate) => (
                        <article
                            key={candidate.id}
                            className="space-y-1 rounded border p-2"
                        >
                            {(candidate.representationKind === "device_view" ||
                                candidate.variantUnconfirmed) && (
                                <p className="text-amber-500">
                                    {candidate.variantUnconfirmed
                                        ? "Variant unconfirmed · "
                                        : ""}
                                    {candidate.representationKind ===
                                    "device_view"
                                        ? "Device view · pinout unconfirmed"
                                        : "Choose the documented variant before wiring"}
                                </p>
                            )}
                            {!candidate.imageUrl && (
                                <button
                                    type="button"
                                    className="rounded border p-2"
                                    onClick={() => setPreview(candidate)}
                                >
                                    Preview source{" "}
                                    {candidate.sourceUrl
                                        .toLowerCase()
                                        .includes(".pdf")
                                        ? "PDF"
                                        : "document"}
                                </button>
                            )}
                            {candidate.imageUrl && (
                                <button
                                    type="button"
                                    className="block w-full"
                                    aria-label={`Enlarge ${candidate.title}`}
                                    onClick={() => setPreview(candidate)}
                                >
                                    {/* biome-ignore lint/performance/noImgElement: external research thumbnails are not passed through an image proxy */}
                                    <img
                                        src={candidate.imageUrl}
                                        alt={candidate.title}
                                        referrerPolicy="no-referrer"
                                        loading="lazy"
                                        className="max-h-36 max-w-full rounded bg-white object-contain"
                                    />
                                </button>
                            )}
                            <a
                                href={candidate.sourceUrl}
                                onClick={(e) => {
                                    if (state.result?.sourceId) {
                                        e.preventDefault()
                                        void openSourceAttachment(
                                            state.result.sourceId,
                                        ).catch((e) =>
                                            state.set({ error: e.message }),
                                        )
                                    }
                                }}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-amber-400 underline"
                            >
                                {candidate.title}
                            </a>
                            <p>
                                {candidate.device} · {candidate.package}
                            </p>
                            <p className="whitespace-pre-wrap">
                                {candidate.description}
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={
                                    (!state.webEnabled &&
                                        !state.result?.sourceId) ||
                                    state.busy ||
                                    readonly
                                }
                                onClick={() => void draftDevice(candidate.id)}
                            >
                                Create symbol
                            </Button>
                        </article>
                    ))}
                    {state.result && (
                        <button
                            type="button"
                            className="underline"
                            onClick={() => {
                                state.set({
                                    result: null,
                                    error: "",
                                    incompleteCandidateId: null,
                                })
                                setExpanded(false)
                            }}
                        >
                            Dismiss results
                        </button>
                    )}
                </div>
            )}
            <Dialog open={warning} onOpenChange={setWarning}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Enable Web research?</DialogTitle>
                        <DialogDescription>
                            The device search query will be sent to external
                            search services. Your Technical Brief, drawing and
                            full conversation are not sent as web search
                            queries. While Web is on, the assistant researches
                            and you can still draw manually. Switch Web off to
                            resume AI drawing. The assistant will show sources;
                            creating and saving a symbol requires your approval.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setWarning(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                engine.stop()
                                state.set({ webEnabled: true })
                                setWarning(false)
                                setExpanded(true)
                            }}
                        >
                            Enable Web
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            <ApprovalDialog />
        </div>
    )
}
