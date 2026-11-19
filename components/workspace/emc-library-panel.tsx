import { Library, X } from "lucide-react"
import { useEffect, useState } from "react"
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
import type { LibrarySymbol } from "@/lib/emc-symbols"
import { getOperationsContext, isOperationsMode } from "@/lib/operations-bridge"
import { useCanvasStore } from "@/stores/canvas-store"
import { emcAction, useDeviceResearch } from "@/stores/device-research-store"
import { SymbolTile } from "./emc-symbol-tile"

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
