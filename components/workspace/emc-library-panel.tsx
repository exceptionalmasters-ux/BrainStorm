import { Library, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { SymbolPreview } from "@/components/chat/device-research"
import { Input } from "@/components/ui/input"
import { insertEmcSymbol } from "@/lib/drawio/editor-bridge"
import type { EmcSymbol, LibrarySymbol } from "@/lib/emc-symbols"
import { getOperationsContext, isOperationsMode } from "@/lib/operations-bridge"
import { useCanvasStore } from "@/stores/canvas-store"
import { emcAction, useDeviceResearch } from "@/stores/device-research-store"

/** Saved EMC symbols are canvas tools, independent of the assistant panel. */
export function EmcLibraryPanel() {
    const state = useDeviceResearch()
    const [libraryBusy, setLibraryBusy] = useState(false)
    const [libraryError, setLibraryError] = useState("")
    const [filter, setFilter] = useState("")
    const canInsert = useCanvasStore((s) => s.hasEditor && !s.isBusy)
    const readonly = getOperationsContext()?.readOnly
    useEffect(() => {
        if (!state.libraryOpen || !isOperationsMode()) return
        const controller = new AbortController()
        setLibraryBusy(true)
        setLibraryError("")
        setFilter("")
        void emcAction<{ symbols: typeof state.library }>(
            "library",
            {},
            controller.signal,
        )
            .then((data) => {
                if (!controller.signal.aborted)
                    useDeviceResearch.setState({ library: data.symbols })
            })
            .catch((error) => {
                if (!controller.signal.aborted)
                    setLibraryError(
                        error instanceof Error
                            ? error.message
                            : "Could not load library",
                    )
            })
            .finally(() => {
                if (!controller.signal.aborted) setLibraryBusy(false)
            })
        return () => controller.abort()
    }, [state.libraryOpen])
    useEffect(() => {
        const close = () => useDeviceResearch.setState({ libraryOpen: false })
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") close()
        }
        window.addEventListener("emc-close-toolbox", close)
        document.addEventListener("keydown", handleEscape)
        return () => {
            window.removeEventListener("emc-close-toolbox", close)
            document.removeEventListener("keydown", handleEscape)
        }
    }, [])
    if (!state.libraryOpen || !isOperationsMode()) return null
    return (
        <section
            id="emc-library-panel"
            aria-label="EMC library"
            data-testid="emc-library-panel"
            className="absolute inset-y-0 left-[52px] z-30 flex flex-col rounded-r-xl border border-primary/30 bg-card shadow-xl"
            style={{ width: "min(360px, calc(100% - 52px))" }}
        >
            <header className="flex shrink-0 items-center gap-2 border-b p-3">
                <Library aria-hidden="true" className="size-4 text-primary" />
                <h2 className="flex-1 text-sm font-semibold">EMC library</h2>
                <button
                    type="button"
                    aria-label="Close EMC library"
                    title="Close EMC library"
                    onClick={() => state.set({ libraryOpen: false })}
                    className="flex size-8 items-center justify-center rounded-lg hover:bg-accent"
                >
                    <X aria-hidden="true" className="size-4" />
                </button>
            </header>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-xs">
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
                        <SymbolTile
                            key={symbol.id}
                            symbol={symbol}
                            disabled={!canInsert || !!readonly}
                            onError={setLibraryError}
                        />
                    ))}
            </div>
        </section>
    )
}

/** The icon lives in the shared rail; its EMC dependencies stay in the web app. */
export function EmcLibraryButton({ onOpen }: { onOpen: () => void }) {
    const libraryOpen = useDeviceResearch((s) => s.libraryOpen)
    if (!isOperationsMode()) return null
    return (
        <button
            type="button"
            title="EMC library"
            aria-label="EMC library"
            aria-expanded={libraryOpen}
            aria-controls="emc-library-panel"
            data-testid="toolbox-emc-library"
            onClick={() => {
                onOpen()
                useDeviceResearch.setState({ libraryOpen: !libraryOpen })
            }}
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg border hover:border-primary hover:text-primary ${libraryOpen ? "border-primary bg-primary/10 text-primary" : "border-transparent"}`}
        >
            <span aria-hidden="true" className="text-sm font-bold">
                EM
            </span>
        </button>
    )
}

function SymbolTile({
    symbol,
    disabled,
    onError,
}: {
    symbol: LibrarySymbol
    disabled: boolean
    onError: (message: string) => void
}) {
    const [definition, setDefinition] = useState<EmcSymbol | null>(null)
    const [loading, setLoading] = useState(false)
    const [dragging, setDragging] = useState(false)
    const dragged = useRef(false)
    const start = useRef<{ x: number; y: number } | null>(null)
    useEffect(() => {
        const controller = new AbortController()
        void emcAction<{ symbol: EmcSymbol }>(
            "symbol",
            { id: symbol.id },
            controller.signal,
        )
            .then((data) => {
                if (!controller.signal.aborted) setDefinition(data.symbol)
            })
            .catch((e) => {
                if (!controller.signal.aborted) onError(e.message)
            })
        return () => controller.abort()
    }, [symbol.id, onError])
    const insert = () => {
        if (dragged.current) {
            dragged.current = false
            return
        }
        if (!definition || disabled) return
        setLoading(true)
        if (!insertEmcSymbol(definition))
            onError("The canvas is not ready. Please retry.")
        setLoading(false)
    }
    return (
        <>
            <button
                type="button"
                disabled={disabled || !definition || loading}
                className="inline-flex w-[calc(50%-4px)] touch-none flex-col items-center gap-1 rounded border p-2 align-top hover:border-primary disabled:opacity-40"
                title={`${symbol.name} · ${symbol.package}`}
                aria-label={`Insert ${symbol.device || symbol.name}`}
                onClick={insert}
                onPointerDown={(e) => {
                    if (definition && !disabled) {
                        start.current = { x: e.clientX, y: e.clientY }
                        e.currentTarget.setPointerCapture(e.pointerId)
                    }
                }}
                onPointerMove={(e) => {
                    if (
                        start.current &&
                        Math.hypot(
                            e.clientX - start.current.x,
                            e.clientY - start.current.y,
                        ) > 8
                    )
                        setDragging(true)
                }}
                onPointerCancel={() => {
                    start.current = null
                    setDragging(false)
                }}
                onPointerUp={(e) => {
                    const moved =
                        start.current &&
                        Math.hypot(
                            e.clientX - start.current.x,
                            e.clientY - start.current.y,
                        ) > 8
                    start.current = null
                    dragged.current = !!moved
                    if (moved && definition && !disabled) {
                        e.preventDefault()
                        insertEmcSymbol(definition, {
                            x: e.clientX,
                            y: e.clientY,
                        })
                    }
                    setDragging(false)
                }}
            >
                <span className="flex h-24 w-full items-center justify-center pointer-events-none">
                    {definition ? (
                        <SymbolPreview symbol={definition} />
                    ) : (
                        "Loading…"
                    )}
                </span>
                <span className="w-full truncate text-center text-xs">
                    {symbol.device || symbol.name}
                </span>
            </button>
            {dragging && (
                <div
                    className="fixed inset-0 z-[100] cursor-copy"
                    style={{ pointerEvents: "none" }}
                    aria-hidden="true"
                >
                    <div className="absolute right-3 top-3 rounded border bg-card p-2 text-xs">
                        Drop on drawing: {symbol.device}
                    </div>
                </div>
            )}
        </>
    )
}
