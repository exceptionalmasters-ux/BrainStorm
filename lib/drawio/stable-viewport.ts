/** Keep the same diagram coordinates under the same screen pixels during panel layout changes. */
export function withStableViewport(ui: any, change: () => void) {
    const graph = ui?.editor?.graph,
        container = ui?.diagramContainer
    const view = graph?.view
    if (
        !view?.translate ||
        !view.scaleAndTranslate ||
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
        // Native page layout may renormalise translate when the viewport changes.
        // Keep that translation and compensate with scroll, as draw.io's own
        // restoreScrollState does, instead of forcing the previous page origin.
        if (view.scale !== before.scale) {
            view.scaleAndTranslate(
                before.scale,
                view.translate.x,
                view.translate.y,
            )
        }
        const x =
            before.scrollLeft +
            after.left -
            before.left +
            (view.translate.x - before.x) * before.scale
        const y =
            before.scrollTop +
            after.top -
            before.top +
            (view.translate.y - before.y) * before.scale
        if (x < 0 || y < 0) {
            view.scaleAndTranslate(
                before.scale,
                view.translate.x - Math.min(0, x) / before.scale,
                view.translate.y - Math.min(0, y) / before.scale,
            )
        }
        container.scrollLeft = Math.max(0, x)
        container.scrollTop = Math.max(0, y)
    }
}
