import {
    FileUp,
    PanelRightClose,
    PanelRightOpen,
    Redo2,
    Save,
    Settings,
    Undo2,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { SessionMenu, useSessionTitle } from "@/components/chat/session-menu"
import { BrandMark } from "@/components/workspace/brand-mark"
import { IconButton } from "@/components/workspace/icon-button"
import { useDictionary } from "@/hooks/use-dictionary"
import { usePathLocale } from "@/hooks/use-path-locale"
import { editorActionState, runEditorAction } from "@/lib/drawio/editor-bridge"
import { useCanvasStore } from "@/stores/canvas-store"

type Item = {
    label: string
    testId?: string
    action?: string
    run?: () => void
    selected?: boolean
    shortcut?: string
    disabled?: boolean
}
export function EditorHeader({
    onOpen,
    onSave,
    saveLabel,
    onExport,
    onNew,
    onClose,
    onSettings,
    onAssistant,
    assistantOpen,
    onReset,
}: {
    onOpen: () => void
    onSave: () => void
    saveLabel?: string
    onExport: () => void
    onNew: () => void
    onClose: () => void
    onSettings: () => void
    onAssistant: () => void
    assistantOpen: boolean
    onReset: () => void
}) {
    const dict = useDictionary(),
        t = dict.editor,
        lang = usePathLocale()
    const title = useSessionTitle()
    const ready = useCanvasStore((s) => s.hasEditor),
        busy = useCanvasStore((s) => s.isBusy)
    useCanvasStore((s) => s.selection)
    useCanvasStore((s) => s.isFormatOpen)
    const [active, setActive] = useState<number | null>(null)
    const root = useRef<HTMLElement>(null),
        history = useRef<HTMLButtonElement>(null)
    const menuButtons = useRef<(HTMLButtonElement | null)[]>([])
    useEffect(() => {
        const outside = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) setActive(null)
        }
        const blur = () => setActive(null)
        document.addEventListener("pointerdown", outside)
        window.addEventListener("blur", blur)
        return () => {
            document.removeEventListener("pointerdown", outside)
            window.removeEventListener("blur", blur)
        }
    }, [])
    const native = (
        action: string,
        label: string,
        shortcut?: string,
    ): Item => ({ action, label, shortcut })
    const menus: { name: string; key: string; items: Item[] }[] = [
        {
            name: t.file,
            key: "file",
            items: [
                { label: dict.nav.newChat, run: onNew },
                {
                    label: dict.workspace.openFile,
                    run: onOpen,
                    shortcut: "Ctrl/⌘ O",
                },
                {
                    label: dict.lobby.recent,
                    run: () => setTimeout(() => history.current?.click(), 0),
                },
                {
                    label: saveLabel || t.saveFile,
                    run: onSave,
                    disabled: !ready || busy,
                    shortcut: "Ctrl/⌘ S",
                },
                { label: t.saveAs, run: onExport, disabled: !ready || busy },
                {
                    label: dict.workspace.export,
                    run: onExport,
                    disabled: !ready || busy,
                },
                {
                    label: t.closeDrawing,
                    run: onClose,
                    disabled: busy,
                    testId: "editor-close-drawing",
                },
                native("pageSetup", "Page setup…"),
                native("print", "Print…"),
            ],
        },
        {
            name: t.edit,
            key: "edit",
            items: [
                native("undo", "Undo", "Ctrl/⌘ Z"),
                native("redo", "Redo"),
                native("cut", "Cut"),
                native("copy", "Copy"),
                native("paste", "Paste"),
                native("duplicate", "Duplicate"),
                native("delete", "Delete"),
                native("selectAll", "Select all"),
                native("editPolygon", "Edit polygon points…"),
                native("editConnectionPoints", "Edit connection points…"),
                native("findReplace", "Find and replace…"),
            ],
        },
        {
            name: t.view,
            key: "view",
            items: [
                native("zoomIn", "Zoom in"),
                native("zoomOut", "Zoom out"),
                native("resetView", "100%"),
                native("fitPage", "Fit page"),
                native("fitWindow", "Fit drawing"),
                native("grid", "Grid"),
                native("guides", "Guides"),
                native("ruler", "Rulers"),
                native("pageView", "Page view"),
                native("pageTabs", "Page tabs"),
            ],
        },
        {
            name: t.insert,
            key: "insert",
            items: [
                native("image", "Image…"),
                native("link", "Link…"),
                native("editData", "Data…"),
                native("shapes", "Shape libraries…"),
            ],
        },
        {
            name: t.arrange,
            key: "arrange",
            items: [
                native("toFront", "Bring to front"),
                native("toBack", "Send to back"),
                native("group", "Group"),
                native("ungroup", "Ungroup"),
                native("alignCellsLeft", "Align left"),
                native("alignCellsCenter", "Align center"),
                native("alignCellsRight", "Align right"),
                native("alignCellsTop", "Align top"),
                native("alignCellsMiddle", "Align middle"),
                native("alignCellsBottom", "Align bottom"),
                native("distributeHorizontal", "Distribute horizontally"),
                native("distributeVertical", "Distribute vertically"),
                native("rotation", "Rotate…"),
                native("lockUnlock", "Lock / unlock"),
            ],
        },
        {
            name: t.tools,
            key: "tools",
            items: [
                native("shapes", "Shape libraries…"),
                native("editDiagram", "Diagram XML…"),
                { label: dict.nav.settings, run: onSettings },
                {
                    label: dict.nav.aiChat,
                    run: onAssistant,
                    selected: assistantOpen,
                },
            ],
        },
        {
            name: t.window,
            key: "window",
            items: [
                {
                    label: dict.nav.aiChat,
                    run: onAssistant,
                    selected: assistantOpen,
                },
                native("format", "Properties"),
                native("layers", "Layers"),
                native("outline", "Overview"),
                {
                    label: t.fullscreen,
                    disabled:
                        typeof document !== "undefined" &&
                        !document.documentElement.requestFullscreen,
                    run: () => {
                        const change = document.fullscreenElement
                            ? document.exitFullscreen()
                            : document.documentElement.requestFullscreen()
                        void change.catch(() =>
                            toast.info(t.commandUnavailable),
                        )
                    },
                },
                { label: t.resetLayout, run: onReset },
            ],
        },
        {
            name: t.help,
            key: "help",
            items: [
                {
                    label: dict.nav.docs,
                    run: () =>
                        window.open(
                            `/${lang}/docs`,
                            "_blank",
                            "noopener,noreferrer",
                        ),
                },
                native("keyboardShortcuts", "Keyboard shortcuts…"),
            ],
        },
    ]
    const perform = (item: Item) => {
        setActive(null)
        try {
            if (item.run) item.run()
            else if (item.action && !runEditorAction(item.action))
                toast.info(t.commandUnavailable)
        } catch {
            toast.error(t.commandUnavailable)
        }
    }
    const focusItem = (index: number) => {
        const items = root.current
            ?.querySelector('[data-testid="editor-menu-popup"]')
            ?.querySelectorAll<HTMLButtonElement>(
                '[role="menuitem"]:not(:disabled),[role="menuitemcheckbox"]:not(:disabled)',
            )
        if (items?.length) items[(index + items.length) % items.length].focus()
    }
    return (
        <header
            ref={root}
            className="relative z-30 shrink-0 border-b border-primary/25 bg-card text-foreground"
            data-testid="editor-header"
        >
            <div className="flex h-10 items-center gap-2 px-3">
                <BrandMark className="size-6 shrink-0 text-primary" />
                <SessionMenu onOpenFile={onOpen}>
                    <button
                        ref={history}
                        type="button"
                        className="min-w-0 max-w-[50vw] truncate text-sm font-semibold"
                        onClick={() => setActive(null)}
                        data-testid="editor-file-title"
                    >
                        {title}.drawio
                    </button>
                </SessionMenu>
                <span className="hidden text-xs text-muted-foreground lg:block">
                    {t.localWorkspace}
                </span>
                <div className="ml-auto flex items-center gap-1">
                    <IconButton
                        label={dict.workspace.openFile}
                        onClick={() => perform({ label: "", run: onOpen })}
                        data-testid="manual-open-file"
                    >
                        <FileUp />
                    </IconButton>
                    <IconButton
                        label={saveLabel || t.saveFile}
                        onClick={() => perform({ label: "", run: onSave })}
                        disabled={!ready || busy}
                        data-testid="editor-save"
                    >
                        <Save />
                    </IconButton>
                    <IconButton
                        label={dict.save.title}
                        onClick={() => perform({ label: "", run: onExport })}
                        disabled={!ready || busy}
                        data-testid="manual-export-button"
                    >
                        <FileUp />
                    </IconButton>
                    <IconButton
                        label={t.workspaceSettings}
                        onClick={() => perform({ label: "", run: onSettings })}
                        data-testid="manual-settings-button"
                    >
                        <Settings />
                    </IconButton>
                    <IconButton
                        label={
                            assistantOpen ? t.hideAssistant : dict.nav.showPanel
                        }
                        onClick={() => perform({ label: "", run: onAssistant })}
                        data-testid={
                            assistantOpen ? "hide-assistant" : "show-panel"
                        }
                    >
                        {assistantOpen ? (
                            <PanelRightClose />
                        ) : (
                            <PanelRightOpen />
                        )}
                    </IconButton>
                </div>
            </div>
            <div className="flex h-8 items-center gap-1 border-t border-border px-2">
                <div
                    aria-label={t.menuBar}
                    className="flex min-w-0 flex-1 overflow-x-auto"
                    role="menubar"
                >
                    {menus.map((menu, index) => (
                        <button
                            key={menu.key}
                            type="button"
                            ref={(el) => {
                                menuButtons.current[index] = el
                            }}
                            role="menuitem"
                            aria-haspopup="menu"
                            aria-expanded={active === index}
                            data-testid={`editor-menu-${menu.key}`}
                            onClick={() =>
                                setActive(active === index ? null : index)
                            }
                            onKeyDown={(event) => {
                                if (
                                    event.key === "ArrowRight" ||
                                    event.key === "ArrowLeft"
                                ) {
                                    event.preventDefault()
                                    const next =
                                        (index +
                                            (event.key === "ArrowRight"
                                                ? 1
                                                : -1) +
                                            menus.length) %
                                        menus.length
                                    setActive(null)
                                    menuButtons.current[next]?.focus()
                                }
                                if (event.key === "ArrowDown") {
                                    event.preventDefault()
                                    setActive(index)
                                    setTimeout(() => focusItem(0), 0)
                                }
                                if (event.key === "Escape") setActive(null)
                            }}
                            className={`shrink-0 rounded px-2 py-1 text-xs hover:bg-accent ${active === index ? "bg-primary/10 text-primary" : ""}`}
                        >
                            {menu.name}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    aria-label={editorActionState("undo").label || "Undo"}
                    onClick={() => perform(native("undo", "Undo"))}
                    disabled={!ready || busy}
                    className="px-1 text-muted-foreground disabled:opacity-30"
                    data-testid="editor-undo"
                >
                    <Undo2 className="size-4" />
                </button>
                <button
                    type="button"
                    aria-label={editorActionState("redo").label || "Redo"}
                    onClick={() => perform(native("redo", "Redo"))}
                    disabled={!ready || busy}
                    className="px-1 text-muted-foreground disabled:opacity-30"
                    data-testid="editor-redo"
                >
                    <Redo2 className="size-4" />
                </button>
            </div>
            {active !== null && (
                <div
                    role="menu"
                    aria-label={menus[active].name}
                    className="absolute left-2 top-full z-50 max-h-[65vh] w-64 overflow-y-auto rounded-b-lg border border-primary/30 bg-card p-1 shadow-xl"
                    style={{
                        left: `clamp(8px, ${Math.min(active * 56 + 8, 420)}px, calc(100% - 264px))`,
                    }}
                    data-testid="editor-menu-popup"
                    onKeyDown={(event) => {
                        const items = Array.from(
                                event.currentTarget.querySelectorAll<HTMLButtonElement>(
                                    "button:not(:disabled)",
                                ),
                            ),
                            at = items.indexOf(
                                document.activeElement as HTMLButtonElement,
                            )
                        if (
                            ["ArrowDown", "ArrowUp", "Home", "End"].includes(
                                event.key,
                            )
                        ) {
                            event.preventDefault()
                            focusItem(
                                event.key === "Home"
                                    ? 0
                                    : event.key === "End"
                                      ? items.length - 1
                                      : at +
                                        (event.key === "ArrowDown" ? 1 : -1),
                            )
                        }
                        if (event.key === "Escape") {
                            event.preventDefault()
                            menuButtons.current[active]?.focus()
                            setActive(null)
                        }
                    }}
                >
                    {menus[active].items.map((item, index) => {
                        const state = item.action
                            ? editorActionState(item.action)
                            : null
                        const selected = item.selected ?? state?.selected
                        return (
                            <button
                                key={`${item.action || item.label}-${index}`}
                                aria-label={state?.label || item.label}
                                type="button"
                                {...(selected === undefined
                                    ? { role: "menuitem" as const }
                                    : {
                                          role: "menuitemcheckbox" as const,
                                          "aria-checked": selected,
                                      })}
                                disabled={
                                    item.disabled ||
                                    (!!item.action && (!state?.enabled || busy))
                                }
                                data-testid={
                                    item.testId ||
                                    (item.action
                                        ? `editor-action-${item.action}`
                                        : undefined)
                                }
                                onClick={() => perform(item)}
                                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs hover:bg-primary/10 focus:bg-primary/10 focus:outline-none disabled:opacity-35"
                            >
                                <span className="w-3 text-primary">
                                    {selected ? "✓" : ""}
                                </span>
                                <span className="flex-1">
                                    {state?.label || item.label}
                                </span>
                                {item.shortcut && (
                                    <span className="text-[10px] text-muted-foreground">
                                        {item.shortcut}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            )}
        </header>
    )
}
