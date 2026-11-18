import {
    ArrowRight,
    FilePlus2,
    GitBranch,
    LayoutPanelTop,
    Maximize,
    MoreHorizontal,
    MousePointer2,
    MoveRight,
    PanelRight,
    Pencil,
    PenTool,
    Plus,
    Redo2,
    Route,
    Scan,
    Shapes,
    SlidersHorizontal,
    Trash2,
    Type,
    Undo2,
    ZoomIn,
    ZoomOut,
} from "lucide-react"
import { EmcConnectorTool } from "@/components/workspace/emc-connector-tool"
import { QuickColour } from "@/components/workspace/quick-colour"
import {
    activateSelectionPointer,
    closeEditorFormatPanel,
    editorActionState,
    editorLabel,
    editorMenuAvailable,
    insertQuickDrawing,
    openEditorFormatTab,
    openNativeEditorMenu,
    openQuickInsertMenu,
    runEditorAction,
} from "@/lib/drawio/editor-bridge"
import { getOperationsContext } from "@/lib/operations-bridge"
import { useCanvasStore } from "@/stores/canvas-store"

/** Thin controls over native draw.io commands. Formatting stays in its contextual panel. */
export function DrawingToolbar({
    section = "tools",
}: {
    section?: "primary" | "tools" | "all"
}) {
    const ready = useCanvasStore((s) => s.hasEditor)
    const busy = useCanvasStore((s) => s.isBusy)
    const selection = useCanvasStore((s) => s.selection)
    const activeFormatTab = useCanvasStore((s) => s.activeFormatTab)
    const freehand = useCanvasStore((s) => s.isFreehand)
    const connector = useCanvasStore((s) => s.isConnector)
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
            data-testid={
                name === "undo" || name === "redo"
                    ? `editor-${name}`
                    : `drawing-tool-${name}`
            }
            title={editorLabel(key, fallback)}
            aria-label={editorLabel(key, fallback)}
            disabled={
                !ready ||
                busy ||
                (changes && readOnly) ||
                !editorActionState(name).enabled
            }
            onClick={() => {
                if (connector && name === "insertFreehand")
                    activateSelectionPointer()
                runEditorAction(name)
            }}
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
        changes = true,
    ) => (
        <button
            key={name}
            type="button"
            className={base}
            data-testid={`drawing-tool-${name}`}
            title={editorLabel(key, fallback)}
            aria-label={editorLabel(key, fallback)}
            aria-haspopup="menu"
            disabled={
                !ready ||
                busy ||
                (changes && readOnly) ||
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
            <span aria-hidden>▾</span>
        </button>
    )
    return (
        <div
            className="shrink-0 border-b border-border bg-card text-foreground"
            data-testid={
                section === "primary"
                    ? "drawing-primary-container"
                    : "drawing-toolbar"
            }
        >
            <div
                role="toolbar"
                aria-label="Drawing tools"
                className="flex h-8 items-center gap-0.5 overflow-x-auto px-1"
            >
                {section !== "tools" && (
                    <div
                        data-testid="drawing-toolbar-primary"
                        className="flex shrink-0 items-center gap-0.5"
                    >
                        {action(
                            "insertPage",
                            "insertPage",
                            "New page",
                            FilePlus2,
                            true,
                        )}
                        {action("undo", "undo", "Undo", Undo2, true)}
                        {action("redo", "redo", "Redo", Redo2, true)}
                        {action(
                            "delete",
                            "delete",
                            "Delete selection",
                            Trash2,
                            true,
                        )}
                        {menu("viewZoom", "zoom", "Zoom", Scan, false, false)}
                        {action("zoomOut", "zoomOut", "Zoom out", ZoomOut)}
                        {action("zoomIn", "zoomIn", "Zoom in", ZoomIn)}
                        {action(
                            "fitWindow",
                            "fitWindow",
                            "Fit window",
                            Maximize,
                        )}
                    </div>
                )}
                {section !== "primary" && (
                    <>
                        <button
                            type="button"
                            className={base}
                            data-testid="drawing-tool-select"
                            title={editorLabel("select", "Select objects")}
                            aria-label={editorLabel("select", "Select objects")}
                            aria-pressed={!freehand && !connector}
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
                        <EmcConnectorTool />
                        {([[7, "Text", Type]] as const).map(
                            ([index, label, Icon]) => (
                                <button
                                    key={label}
                                    type="button"
                                    className={base}
                                    data-testid={`drawing-create-${label.toLowerCase()}`}
                                    title={label}
                                    aria-label={label}
                                    disabled={!ready || busy || readOnly}
                                    onClick={() =>
                                        insertQuickDrawing("shapes", index)
                                    }
                                >
                                    <Icon size={16} />
                                </button>
                            ),
                        )}
                        {action(
                            "insertFreehand",
                            "freehand",
                            "Freehand",
                            Pencil,
                            true,
                        )}
                        {menu("insert", "insert", "Insert", Plus)}
                        {action(
                            "format",
                            "format",
                            "Toggle format panel",
                            PanelRight,
                        )}
                        {menu(
                            "edgeShape",
                            "connection",
                            "Connection",
                            GitBranch,
                            true,
                        )}
                        {menu(
                            "edgeStyle",
                            "waypoints",
                            "Waypoints",
                            Route,
                            true,
                        )}
                        <span
                            aria-hidden
                            className="mx-1 h-5 shrink-0 border-l border-border"
                        />
                        <QuickColour
                            kind="fill"
                            disabled={
                                !ready || busy || readOnly || !selection.length
                            }
                        />
                        <QuickColour
                            kind="line"
                            disabled={
                                !ready || busy || readOnly || !selection.length
                            }
                        />
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
                                className={`${base} ${activeFormatTab === tab ? "bg-primary/10 text-primary" : "text-foreground"}`}
                                data-testid={`drawing-format-${tab}`}
                                aria-pressed={activeFormatTab === tab}
                                title={editorLabel(tab, tab)}
                                aria-label={editorLabel(tab, tab)}
                                disabled={
                                    !ready ||
                                    busy ||
                                    (tab !== "style" &&
                                        (!selection.length || readOnly))
                                }
                                onClick={() =>
                                    activeFormatTab === tab
                                        ? closeEditorFormatPanel()
                                        : openEditorFormatTab(tab)
                                }
                            >
                                <Icon size={16} />
                            </button>
                        ))}
                        {menu(
                            "diagram",
                            "diagram",
                            "Diagram",
                            MoreHorizontal,
                            false,
                            false,
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
