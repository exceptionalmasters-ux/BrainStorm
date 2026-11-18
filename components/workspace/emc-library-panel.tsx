import { Library, Trash2, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { SymbolPreview } from "@/components/chat/device-research"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { insertEmcSymbol } from "@/lib/drawio/editor-bridge"
import type { EmcSymbol, LibrarySymbol } from "@/lib/emc-symbols"
import { validateEmcSymbol } from "@/lib/emc-symbols"
import { type ManualSymbol, validateManualSymbol } from "@/lib/manual-symbol"
import { getOperationsContext, isOperationsMode } from "@/lib/operations-bridge"
import { useCanvasStore } from "@/stores/canvas-store"
import { emcAction, useDeviceResearch } from "@/stores/device-research-store"
import { ManualPreview } from "./manual-preview"

/** Saved EMC symbols are canvas tools, independent of the assistant panel. */
export function EmcLibraryPanel() {
    const state = useDeviceResearch()
    const [libraryBusy, setLibraryBusy] = useState(false)
    const [libraryError, setLibraryError] = useState("")
    const [filter, setFilter] = useState("")
    const [canDelete, setCanDelete] = useState(false)
    const [removing, setRemoving] = useState<LibrarySymbol | null>(null)
    const [deleting, setDeleting] = useState(false)
    const canInsert = useCanvasStore((s) => s.hasEditor && !s.isBusy)
    const readonly = getOperationsContext()?.readOnly
    useEffect(() => {
        if (!state.libraryOpen || !isOperationsMode()) return
        const controller = new AbortController()
        setLibraryBusy(true)
        setLibraryError("")
        setFilter("")
        void emcAction<{ symbols: typeof state.library; canDelete?: boolean }>(
            "library",
            {},
            controller.signal,
        )
            .then((data) => {
                if (!controller.signal.aborted) {
                    useDeviceResearch.setState({ library: data.symbols })
                    setCanDelete(data.canDelete === true)
                }
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
            if (
                event.key === "Escape" &&
                !document.querySelector('[role="alertdialog"]')
            )
                close()
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
                            canDelete={canDelete}
                            onDelete={() => setRemoving(symbol)}
                        />
                    ))}
            </div>
            <AlertDialog
                open={!!removing}
                onOpenChange={(open) => {
                    if (!open && !deleting) setRemoving(null)
                }}
            >
                <AlertDialogContent
                    onEscapeKeyDown={(event) => {
                        if (deleting) event.preventDefault()
                    }}
                >
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Remove symbol from library?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Remove “{removing?.name}”? Symbols already inserted
                            in drawings will remain unchanged.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={deleting}
                            className="bg-red-600 text-white hover:bg-red-700"
                            onClick={async (event) => {
                                event.preventDefault()
                                if (!removing) return
                                setDeleting(true)
                                setLibraryError("")
                                try {
                                    await emcAction("symbol-delete", {
                                        id: removing.id,
                                        version: removing.version,
                                        confirm: true,
                                    })
                                    useDeviceResearch.setState({
                                        library: useDeviceResearch
                                            .getState()
                                            .library.filter(
                                                (s) => s.id !== removing.id,
                                            ),
                                    })
                                    setRemoving(null)
                                } catch (error) {
                                    setLibraryError(
                                        error instanceof Error
                                            ? error.message
                                            : "Could not remove symbol",
                                    )
                                } finally {
                                    setDeleting(false)
                                }
                            }}
                        >
                            {deleting ? "Removing…" : "Remove symbol"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
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
    canDelete,
    onDelete,
}: {
    canDelete: boolean
    onDelete: () => void
    symbol: LibrarySymbol
    disabled: boolean
    onError: (message: string) => void
}) {
    const [definition, setDefinition] = useState<
        EmcSymbol | ManualSymbol | null
    >(null)
    const [loading, setLoading] = useState(false)
    const [dragging, setDragging] = useState(false)
    const [peek, setPeek] = useState<{ left: number; top: number } | null>(null)
    const longPress = useRef<ReturnType<typeof setTimeout> | null>(null)
    const showPreview = (element: HTMLElement) => {
        const r = element.getBoundingClientRect()
        setPeek({
            left: Math.max(8, Math.min(window.innerWidth - 288, r.right + 8)),
            top: Math.max(8, Math.min(window.innerHeight - 340, r.top)),
        })
    }
    const stopLongPress = () => {
        if (longPress.current) clearTimeout(longPress.current)
        longPress.current = null
    }
    useEffect(() => () => stopLongPress(), [])
    const dragged = useRef(false)
    const start = useRef<{ x: number; y: number } | null>(null)
    useEffect(() => {
        const controller = new AbortController()
        void emcAction<{ symbol: EmcSymbol | ManualSymbol }>(
            "symbol",
            { id: symbol.id },
            controller.signal,
        )
            .then((data) => {
                if (!controller.signal.aborted) {
                    if (
                        !validateManualSymbol(data.symbol) &&
                        !validateEmcSymbol(data.symbol)
                    )
                        throw Error("Invalid symbol definition")
                    setDefinition(data.symbol)
                }
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
        <div className="relative inline-flex w-[calc(25%-6px)] align-top">
            <button
                type="button"
                disabled={disabled || !definition || loading}
                className="inline-flex w-full touch-none flex-col items-center gap-1 rounded border p-1 hover:border-primary disabled:opacity-40"
                title={`${symbol.name} · ${symbol.package}`}
                aria-label={`Insert ${symbol.name}`}
                onClick={insert}
                onPointerEnter={(event) => {
                    if (event.pointerType !== "touch")
                        showPreview(event.currentTarget)
                }}
                onPointerLeave={(event) => {
                    if (event.pointerType !== "touch") setPeek(null)
                }}
                onFocus={(event) => showPreview(event.currentTarget)}
                onBlur={() => setPeek(null)}
                onContextMenu={(event) => {
                    event.preventDefault()
                    showPreview(event.currentTarget)
                }}
                onPointerDown={(e) => {
                    if (definition && !disabled) {
                        start.current = { x: e.clientX, y: e.clientY }
                        stopLongPress()
                        if (e.pointerType === "touch") {
                            const element = e.currentTarget
                            longPress.current = setTimeout(() => {
                                showPreview(element)
                                dragged.current = true
                                start.current = null
                            }, 500)
                        }
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
                    ) {
                        stopLongPress()
                        setPeek(null)
                        setDragging(true)
                    }
                }}
                onPointerCancel={() => {
                    stopLongPress()
                    start.current = null
                    setDragging(false)
                }}
                onPointerUp={(e) => {
                    stopLongPress()
                    if (dragged.current && !start.current) {
                        setTimeout(() => setPeek(null), 2500)
                        return
                    }
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
                <span className="pointer-events-none flex h-8 w-full items-center justify-center">
                    {definition ? (
                        "kind" in definition ? (
                            <ManualPreview symbol={definition} />
                        ) : (
                            <SymbolPreview symbol={definition} compact />
                        )
                    ) : (
                        "Loading…"
                    )}
                </span>
                <span className="w-full truncate text-center text-xs">
                    {symbol.name}
                </span>
            </button>
            {canDelete && (
                <button
                    type="button"
                    aria-label={`Remove ${symbol.name} from library`}
                    title="Remove symbol from library"
                    onClick={onDelete}
                    className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full border bg-card text-muted-foreground hover:text-red-500"
                >
                    <Trash2 aria-hidden="true" size={12} />
                </button>
            )}
            {peek && definition && (
                <div
                    role="tooltip"
                    className="pointer-events-none fixed z-[120] w-[280px] rounded-xl border border-primary/30 bg-white p-3 text-black shadow-xl"
                    style={peek}
                >
                    <div className="h-[280px] w-full">
                        {"kind" in definition ? (
                            <ManualPreview symbol={definition} />
                        ) : (
                            <SymbolPreview symbol={definition} compact />
                        )}
                    </div>
                    <p className="mt-1 truncate text-center text-xs font-semibold">
                        {symbol.name}
                    </p>
                </div>
            )}
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
        </div>
    )
}
