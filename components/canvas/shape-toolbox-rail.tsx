import {
    ArrowUpRight,
    Blocks,
    CircuitBoard,
    Clock3,
    Library,
    LibraryBig,
    Network,
    Pin,
    Search,
    Shapes,
    Workflow,
    X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { EmcLibraryPanel } from "@/components/canvas/emc-library-panel"
import { useDictionary } from "@/hooks/use-dictionary"
import { connectShapeToolbox } from "@/lib/drawio/editor-bridge"
import type { ShapeGroup, ShapeToolbox } from "@/lib/drawio/shape-toolbox"
import { isOperationsMode } from "@/lib/operations-bridge"
import { useDeviceResearch } from "@/stores/device-research-store"

export function ShapeToolboxRail() {
    const t = useDictionary().toolbox
    const libraryOpen = useDeviceResearch((s) => s.libraryOpen)
    const controller = useRef<ShapeToolbox | null>(null)
    const rail = useRef<HTMLElement>(null)
    const [active, setActive] = useState<ShapeGroup | null>(null)
    const [pinned, setPinned] = useState(false)
    const pinnedRef = useRef(false)
    const [available, setAvailable] = useState(false)
    useEffect(() => {
        controller.current = connectShapeToolbox(t, (group, isPinned) => {
            setActive(group)
            setPinned(isPinned)
            pinnedRef.current = isPinned
        })
        setAvailable(!!controller.current)
        const outside = (event: PointerEvent) => {
            if (
                !rail.current?.contains(event.target as Node) &&
                !pinnedRef.current
            )
                controller.current?.close()
        }
        const onEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") controller.current?.close()
        }
        const reset = () => controller.current?.close()
        window.addEventListener("emc-close-toolbox", reset)
        document.addEventListener("pointerdown", outside)
        document.addEventListener("keydown", onEscape)
        return () => {
            window.removeEventListener("emc-close-toolbox", reset)
            document.removeEventListener("pointerdown", outside)
            document.removeEventListener("keydown", onEscape)
            controller.current?.dispose()
            controller.current = null
        }
    }, [t])
    const groups = [
        ["basic", Shapes],
        ["arrows", ArrowUpRight],
        ["diagrams", Workflow],
        ["technical", CircuitBoard],
        ["network", Network],
        ["search", Search],
        ["recent", Clock3],
    ] as const
    return (
        <>
            <aside
                ref={rail}
                aria-label={t.title}
                data-testid="shape-toolbox"
                className="absolute inset-y-0 left-0 z-20 flex w-[52px] flex-col items-center gap-1 overflow-y-auto border-r border-primary/25 bg-card py-2 text-foreground"
            >
                <Blocks
                    aria-hidden="true"
                    className="mb-2 size-6 shrink-0 text-primary"
                />
                {groups.map(([group, Icon]) => (
                    <button
                        key={group}
                        type="button"
                        title={t[group]}
                        aria-label={t[group]}
                        aria-expanded={active === group}
                        disabled={!available}
                        data-testid={`toolbox-${group}`}
                        onClick={() => {
                            useDeviceResearch.setState({ libraryOpen: false })
                            if (active === group) controller.current?.close()
                            else controller.current?.open(group, t[group])
                        }}
                        className={`relative flex size-10 shrink-0 items-center justify-center rounded-lg border transition-colors hover:border-primary hover:text-primary disabled:opacity-40 ${active === group ? "border-primary bg-primary/10 text-primary" : "border-transparent"}`}
                    >
                        <Icon aria-hidden="true" className="size-5" />
                        <span
                            aria-hidden="true"
                            className="absolute right-0.5 bottom-0.5 text-[9px]"
                        >
                            ▸
                        </span>
                    </button>
                ))}
                {isOperationsMode() && (
                    <button
                        type="button"
                        title="EMC library"
                        aria-label="EMC library"
                        aria-expanded={libraryOpen}
                        aria-controls="emc-library-panel"
                        data-testid="toolbox-emc-library"
                        onClick={() => {
                            controller.current?.close()
                            useDeviceResearch.setState({
                                libraryOpen: !libraryOpen,
                            })
                        }}
                        className={`flex size-10 shrink-0 items-center justify-center rounded-lg border hover:border-primary hover:text-primary ${libraryOpen ? "border-primary bg-primary/10 text-primary" : "border-transparent"}`}
                    >
                        <Library aria-hidden="true" className="size-5" />
                    </button>
                )}
                <div className="my-1 h-px w-7 shrink-0 bg-border" />
                <button
                    type="button"
                    title={t.allLibraries}
                    aria-label={t.allLibraries}
                    disabled={!available}
                    data-testid="toolbox-all-libraries"
                    onClick={() => {
                        useDeviceResearch.setState({ libraryOpen: false })
                        if (!active)
                            controller.current?.open("search", t.search)
                        controller.current?.catalog()
                    }}
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                >
                    <LibraryBig aria-hidden="true" className="size-5" />
                </button>
                {active && (
                    <>
                        <span
                            title={pinned ? t.pin : t.close}
                            className="text-primary"
                        >
                            {pinned ? (
                                <Pin className="size-3" />
                            ) : (
                                <X className="size-3" />
                            )}
                        </span>
                        <span className="sr-only" aria-live="polite">
                            {t[active]}
                        </span>
                    </>
                )}
            </aside>
            <EmcLibraryPanel />
        </>
    )
}
