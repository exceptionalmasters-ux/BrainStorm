/** Keep the same diagram coordinates under the same screen pixels during panel layout changes. */
export function withStableViewport(ui: any, change: () => void) {
    const graph = ui?.editor?.graph,
        container = ui?.diagramContainer
    const view = graph?.view
    if (
        !view?.translate ||
        !view.setScaleAndTranslate ||
        !container?.getBoundingClientRect
    ) {
        change()
        return
    }
    const bounds = container.getBoundingClientRect()
    const before = {
        scale: view.scale,
        x: view.translate.x,
        y: view.translate.y,
        left: bounds.left,
        top: bounds.top,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
    }
    try {
        change()
    } finally {
        const after = container.getBoundingClientRect()
        view.setScaleAndTranslate(
            before.scale,
            before.x + (before.left - after.left) / before.scale,
            before.y + (before.top - after.top) / before.scale,
        )
        container.scrollLeft = before.scrollLeft
        container.scrollTop = before.scrollTop
    }
}
