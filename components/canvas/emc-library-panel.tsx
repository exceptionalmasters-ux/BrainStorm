import { Library, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { insertEmcSymbol } from "@/lib/drawio/editor-bridge"
import type { EmcSymbol } from "@/lib/emc-symbols"
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
                        <div
                            key={symbol.id}
                            className="flex items-center gap-2 rounded border p-2"
                        >
                            <span className="min-w-0 flex-1 break-words">
                                {symbol.name}
                                <br />
                                {symbol.device} · {symbol.package}
                            </span>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={!canInsert || readonly || libraryBusy}
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
        </section>
    )
}
