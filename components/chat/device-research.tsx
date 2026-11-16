"use client"

import { Globe, Library, Loader2 } from "lucide-react"
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
    type EmcSymbol,
    symbolLayout,
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

function SymbolPreview({ symbol }: { symbol: EmcSymbol }) {
    const layout = symbolLayout(symbol)
    return (
        <svg
            role="img"
            aria-label="Symbol approval preview"
            viewBox={`-90 -60 ${layout.width + 180} ${layout.height + 120}`}
            className="max-h-80 w-full rounded border bg-white text-black"
        >
            <title>{symbol.name} — connection points</title>
            <rect
                width={layout.width}
                height={layout.height}
                fill="white"
                stroke="black"
            />
            <text
                x={layout.width / 2}
                y={layout.height / 2 - 12}
                textAnchor="middle"
                fontSize="16"
            >
                {symbol.name}
            </text>
            <text
                x={layout.width / 2}
                y={layout.height / 2 + 10}
                textAnchor="middle"
                fontSize="12"
            >
                {symbol.device}
            </text>
            <text
                x={layout.width / 2}
                y={layout.height / 2 + 28}
                textAnchor="middle"
                fontSize="10"
            >
                {symbol.package}
            </text>
            {layout.pins.map((pin) => (
                <g key={pin.number}>
                    <circle
                        cx={pin.x * layout.width}
                        cy={pin.y * layout.height}
                        r="5"
                        fill="#edcb6d"
                        stroke="black"
                    />
                    <text
                        x={
                            pin.x * layout.width +
                            (pin.side === "left"
                                ? 12
                                : pin.side === "right"
                                  ? -12
                                  : 0)
                        }
                        y={
                            pin.y * layout.height +
                            (pin.side === "top"
                                ? 18
                                : pin.side === "bottom"
                                  ? -12
                                  : 4)
                        }
                        textAnchor={
                            pin.side === "left"
                                ? "start"
                                : pin.side === "right"
                                  ? "end"
                                  : "middle"
                        }
                        fontSize="11"
                    >
                        {pin.number} {pin.name}
                    </text>
                </g>
            ))}
        </svg>
    )
}

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
    const [warning, setWarning] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const [query, setQuery] = useState("")
    const [libraryBusy, setLibraryBusy] = useState(false)
    const [libraryError, setLibraryError] = useState("")
    const [filter, setFilter] = useState("")
    const canInsert = useCanvasStore((s) => s.hasEditor && !s.isBusy)
    const readonly = getOperationsContext()?.readOnly
    if (!isOperationsMode()) return null
    return (
        <div
            className="shrink-0 border-b px-3 py-2 text-xs"
            data-testid="device-research"
        >
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
                <button
                    type="button"
                    className="ml-auto inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-accent"
                    onClick={async () => {
                        state.set({ libraryOpen: !state.libraryOpen })
                        if (state.libraryOpen) return
                        setLibraryBusy(true)
                        setLibraryError("")
                        try {
                            const data = await emcAction<{
                                symbols: typeof state.library
                            }>("library", {})
                            state.set({ library: data.symbols })
                        } catch (e) {
                            setLibraryError(
                                e instanceof Error
                                    ? e.message
                                    : "Could not load library",
                            )
                        } finally {
                            setLibraryBusy(false)
                        }
                    }}
                >
                    <Library className="size-3" />
                    EMC library
                </button>
            </div>
            {(expanded || state.busy || state.result || state.error) && (
                <div className="mt-2 max-h-[35vh] space-y-2 overflow-y-auto">
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
                    {state.busy && (
                        <p role="status" className="flex items-center gap-2">
                            <Loader2 className="size-3 animate-spin" />
                            Researching device…
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
                                    state.busy || !state.webEnabled || readonly
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
                            {candidate.imageUrl && (
                                <a
                                    href={candidate.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {/* biome-ignore lint/performance/noImgElement: external research thumbnails are not passed through an image proxy */}
                                    <img
                                        src={candidate.imageUrl}
                                        alt={candidate.title}
                                        referrerPolicy="no-referrer"
                                        loading="lazy"
                                        className="max-h-36 max-w-full rounded bg-white object-contain"
                                    />
                                </a>
                            )}
                            <a
                                href={candidate.sourceUrl}
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
                                    !state.webEnabled || state.busy || readonly
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
            {state.libraryOpen && (
                <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                    <Input
                        aria-label="Filter EMC symbols"
                        placeholder="Find a saved symbol…"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                    {libraryBusy && <p>Loading EMC library…</p>}
                    {libraryError && (
                        <p role="alert" className="text-red-500">
                            {libraryError}
                        </p>
                    )}
                    {!libraryBusy && !state.library.length && (
                        <p>No approved symbols yet.</p>
                    )}
                    {state.library
                        .filter((s) =>
                            `${s.name} ${s.device} ${s.package}`
                                .toLowerCase()
                                .includes(filter.toLowerCase()),
                        )
                        .map((symbol) => (
                            <div
                                key={symbol.id}
                                className="flex items-center gap-2 rounded border p-2"
                            >
                                <span className="min-w-0 flex-1">
                                    {symbol.name}
                                    <br />
                                    {symbol.device} · {symbol.package}
                                </span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                        !canInsert || readonly || libraryBusy
                                    }
                                    onClick={async () => {
                                        setLibraryBusy(true)
                                        setLibraryError("")
                                        try {
                                            const data = await emcAction<{
                                                symbol: EmcSymbol
                                            }>("symbol", { id: symbol.id })
                                            if (!insertEmcSymbol(data.symbol))
                                                throw new Error(
                                                    "The canvas is not ready. Please retry.",
                                                )
                                        } catch (e) {
                                            setLibraryError(
                                                e instanceof Error
                                                    ? e.message
                                                    : "Could not insert symbol",
                                            )
                                        } finally {
                                            setLibraryBusy(false)
                                        }
                                    }}
                                >
                                    Insert
                                </Button>
                            </div>
                        ))}
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
