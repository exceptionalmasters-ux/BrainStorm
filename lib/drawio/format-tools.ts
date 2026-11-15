/** The pinned draw.io owns its panels, actions, undo history and translated labels. */
export type FormatTab = "style" | "text" | "arrange"

export function showFormatTab(ui: any, resources: any, tab: FormatTab) {
    const graph = ui?.editor?.graph
    if (!graph || (tab !== "style" && graph.isSelectionEmpty())) return false
    const visible =
        typeof ui.isFormatPanelVisible === "function"
            ? ui.isFormatPanelVisible()
            : ui.formatWidth > 0
    if (!visible) {
        const action = ui.actions?.get?.("format")
        if (!action?.funct || action.isEnabled?.() === false) return false
        action.funct()
    }
    ui.format?.immediateRefresh?.()
    const title = resources?.get?.(tab) || tab
    const labels =
        ui.format?.container?.querySelectorAll?.(".geFormatTitle") || []
    const label = Array.from(labels).find(
        (node: any) => node.getAttribute("title") === title,
    ) as HTMLElement | undefined
    if (!label) return false
    label.click()
    return true
}

export function showEditorMenu(
    ui: any,
    name: string,
    point: { x: number; y: number },
) {
    const menu = ui?.menus?.get?.(name)
    if (!menu?.funct || menu.isEnabled?.() === false || !ui.showPopupMenu)
        return false
    ui.hideCurrentMenu?.()
    ui.showPopupMenu(
        (popup: any, parent: any) => menu.funct(popup, parent),
        point.x,
        point.y,
    )
    return true
}
