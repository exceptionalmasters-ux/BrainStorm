import {
    ArrowRight,
    GitBranch,
    LayoutPanelTop,
    MousePointer2,
    MoveRight,
    PaintBucket,
    Pencil,
    PenTool,
    Plus,
    Route,
    Scan,
    Shapes,
    SlidersHorizontal,
    Type,
    ZoomIn,
    ZoomOut,
} from "lucide-react"
import {
    activateSelectionPointer,
    editorActionState,
    editorLabel,
    editorMenuAvailable,
    openEditorFormatTab,
    openNativeEditorMenu,
    openQuickInsertMenu,
    runEditorAction,
} from "@/lib/drawio/editor-bridge"
import { getOperationsContext } from "@/lib/operations-bridge"
import { useCanvasStore } from "@/stores/canvas-store"

/** Thin controls over native draw.io commands. Formatting stays in its contextual panel. */
export function DrawingToolbar() {
    const ready = useCanvasStore((s) => s.hasEditor)
    const busy = useCanvasStore((s) => s.isBusy)
    const selection = useCanvasStore((s) => s.selection)
    const freehand = useCanvasStore((s) => s.isFreehand)
    useCanvasStore((s) => s.isFormatOpen)
    const readOnly = !!getOperationsContext()?.readOnly
    const base =
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded px-2 text-xs hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"
    const action = (
        name: string,
        key: string,
        fallback: string,
        Icon: typeof ZoomIn,
        changes = false,
    ) => (
        <button
            key={name}
            type="button"
            className={base}
            data-testid={`drawing-tool-${name}`}
            title={editorLabel(key, fallback)}
            aria-label={editorLabel(key, fallback)}
            disabled={
                !ready ||
                busy ||
                (changes && readOnly) ||
                !editorActionState(name).enabled
            }
            onClick={() => runEditorAction(name)}
        >
            <Icon size={16} />
            <span className="sr-only">{editorLabel(key, fallback)}</span>
        </button>
    )
    const menu = (
        name: string,
        key: string,
        fallback: string,
        Icon: typeof ZoomIn,
        needsSelection = false,
    ) => (
        <button
            key={name}
            type="button"
            className={base}
            data-testid={`drawing-tool-${name}`}
            title={editorLabel(key, fallback)}
            aria-haspopup="menu"
            disabled={
                !ready ||
                busy ||
                readOnly ||
                (needsSelection && !selection.length) ||
                !editorMenuAvailable(name)
            }
            onClick={(event) =>
                openNativeEditorMenu(
                    name,
                    event.currentTarget.getBoundingClientRect(),
                )
            }
        >
            <Icon size={16} />
            {editorLabel(key, fallback)}
            <span aria-hidden>▾</span>
        </button>
    )
    return (
        <div
            className="shrink-0 border-b border-border bg-card text-foreground"
            data-testid="drawing-toolbar"
        >
            <div
                role="toolbar"
                aria-label="Drawing tools"
                className="flex h-10 items-center gap-0.5 overflow-x-auto px-2 py-1"
            >
                <button
                    type="button"
                    className={base}
                    data-testid="drawing-tool-select"
                    title={editorLabel("select", "Select objects")}
                    aria-label={editorLabel("select", "Select objects")}
                    aria-pressed={!freehand}
                    disabled={!ready || busy}
                    onClick={activateSelectionPointer}
                >
                    <MousePointer2 size={16} />
                </button>
                <button
                    type="button"
                    className={base}
                    data-testid="drawing-tool-editPolygon"
                    title={`${editorLabel("editPolygon", "Edit polygon points")} · Select a polygon shape`}
                    aria-label={editorLabel(
                        "editPolygon",
                        "Edit polygon points",
                    )}
                    aria-haspopup="dialog"
                    disabled={
                        !ready ||
                        busy ||
                        readOnly ||
                        !editorActionState("editPolygon").enabled
                    }
                    onClick={() => runEditorAction("editPolygon")}
                >
                    <PenTool size={16} />
                </button>
                <span
                    aria-hidden
                    className="mx-1 h-5 shrink-0 border-l border-border"
                />
                {action("zoomOut", "zoomOut", "Zoom out", ZoomOut)}
                {action("zoomIn", "zoomIn", "Zoom in", ZoomIn)}
                {action("fitWindow", "fitWindow", "Fit drawing", Scan)}
                <span
                    aria-hidden
                    className="mx-1 h-5 shrink-0 border-l border-border"
                />
                {(
                    [
                        ["lines", "Lines", MoveRight],
                        ["shapes", "Shapes", Shapes],
                        ["arrows", "Arrows", ArrowRight],
                    ] as const
                ).map(([group, label, Icon]) => (
                    <button
                        key={group}
                        type="button"
                        className={base}
                        data-testid={`drawing-insert-${group}`}
                        title={label}
                        aria-label={label}
                        aria-haspopup="menu"
                        disabled={!ready || busy || readOnly}
                        onClick={(event) =>
                            openQuickInsertMenu(
                                group,
                                event.currentTarget.getBoundingClientRect(),
                            )
                        }
                    >
                        <Icon size={16} />
                        <span aria-hidden>▾</span>
                    </button>
                ))}
                {menu("insert", "insert", "Insert", Plus)}
                {menu("edgeShape", "connection", "Connection", GitBranch, true)}
                {menu("edgeStyle", "waypoints", "Waypoints", Route, true)}
                <span
                    aria-hidden
                    className="mx-1 h-5 shrink-0 border-l border-border"
                />
                {action(
                    "fillColor",
                    "fillColor",
                    "Fill color",
                    PaintBucket,
                    true,
                )}
                {action(
                    "strokeColor",
                    "strokeColor",
                    "Line color",
                    Pencil,
                    true,
                )}
                <span
                    aria-hidden
                    className="mx-1 h-5 shrink-0 border-l border-border"
                />
                {(
                    [
                        ["style", SlidersHorizontal],
                        ["text", Type],
                        ["arrange", LayoutPanelTop],
                    ] as const
                ).map(([tab, Icon]) => (
                    <button
                        key={tab}
                        type="button"
                        className={base}
                        data-testid={`drawing-format-${tab}`}
                        title={editorLabel(tab, tab)}
                        disabled={
                            !ready ||
                            busy ||
                            (tab !== "style" && (!selection.length || readOnly))
                        }
                        onClick={() => openEditorFormatTab(tab)}
                    >
                        <Icon size={16} />
                        {editorLabel(tab, tab)}
                    </button>
                ))}
                {!selection.length && ready && (
                    <span className="shrink-0 px-2 text-[11px] text-muted-foreground">
                        Select a shape or connector to edit its text, style and
                        arrangement.
                    </span>
                )}
            </div>
        </div>
    )
}
