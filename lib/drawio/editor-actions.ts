/** Native action names are pinned to draw.io v32.0.2; the UI only enables commands the editor exposes. */
export function readEditorAction(ui: any, name: string) {
    const action = ui?.actions?.get?.(name)
    const label = action?.getTitle?.() || action?.label
    return {
        enabled:
            !!action &&
            typeof action.funct === "function" &&
            action.isEnabled?.() !== false &&
            action.isVisible?.() !== false,
        selected:
            typeof action?.selectedCallback === "function"
                ? action.isSelected() === true
                : undefined,
        label: typeof label === "string" ? label : null,
    }
}
export function invokeEditorAction(ui: any, name: string) {
    if (!readEditorAction(ui, name).enabled) return false
    ui.actions.get(name).funct()
    return true
}
