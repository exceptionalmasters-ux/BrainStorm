export type ConnectorEnds = "none" | "start" | "end" | "both"

export function connectorStyle(ends: ConnectorEnds) {
    return `emcWire=1;edgeStyle=orthogonalEdgeStyle;rounded=0;curved=0;orthogonalLoop=1;jettySize=20;segment=10;html=0;strokeWidth=1;strokeColor=#000000;jumpStyle=arc;jumpSize=6;startArrow=${ends === "start" || ends === "both" ? "classic" : "none"};endArrow=${ends === "end" || ends === "both" ? "classic" : "none"};`
}

/** Preserve fixed endpoints and orthogonality while snapping the native route to the document grid. */
export function snapConnectorRoute(
    points: { x: number; y: number }[],
    scale: number,
    translate: { x: number; y: number },
) {
    if (points.length < 3 || points.some((p) => !p)) return points
    const snap = (v: number, offset: number) =>
        (Math.round((v / scale - offset) / 10) * 10 + offset) * scale
    const result = points.map((p, i) =>
        i === 0 || i === points.length - 1
            ? { ...p }
            : { x: snap(p.x, translate.x), y: snap(p.y, translate.y) },
    )
    // A legacy off-grid terminal keeps its exact attachment; only its entry stub is exempt.
    if (Math.abs(points[0].y - points[1].y) < 0.01) result[1].y = result[0].y
    else result[1].x = result[0].x
    const n = result.length - 1
    if (Math.abs(points[n].y - points[n - 1].y) < 0.01)
        result[n - 1].y = result[n].y
    else result[n - 1].x = result[n].x
    // Endpoint exemptions can require an additional elbow rather than a diagonal.
    const out = [result[0]]
    for (const p of result.slice(1)) {
        const prev = out[out.length - 1]
        if (prev.x !== p.x && prev.y !== p.y) out.push({ x: p.x, y: prev.y })
        if (prev.x !== p.x || prev.y !== p.y) out.push(p)
    }
    return out
}

/** Uses native connection gestures, edge cells, undo and arc-jump rendering. */
export function installEmcConnector(
    ui: any,
    win: any,
    allowed: () => boolean,
    changed: (active: boolean, ends: ConnectorEnds) => void,
) {
    const graph = ui?.editor?.graph,
        handler = graph?.connectionHandler
    if (!handler || !win?.mxCellState) return null
    let active = false,
        ends: ConnectorEnds = "none",
        saved: any = null
    const cleanup: (() => void)[] = []
    const wrap = (object: any, key: string, create: (original: any) => any) => {
        const own = Object.hasOwn(object, key),
            original = object[key]
        object[key] = create(original)
        cleanup.push(() => {
            if (own) object[key] = original
            else delete object[key]
        })
    }
    const fixed = (cell: any, constraint: any, source: boolean) => {
        if (
            !cell ||
            !constraint?.point ||
            !graph.isCellConnectable(cell) ||
            graph.model.isEdge(cell)
        )
            return false
        const state = graph.view.getState(cell)
        const points = state && graph.getAllConnectionConstraints(state, source)
        return (
            Array.isArray(points) &&
            points.some(
                (c: any) =>
                    c.point &&
                    Math.abs(c.point.x - constraint.point.x) < 0.00001 &&
                    Math.abs(c.point.y - constraint.point.y) < 0.00001 &&
                    (c.dx || 0) === (constraint.dx || 0) &&
                    (c.dy || 0) === (constraint.dy || 0),
            )
        )
    }
    const owned = (edge: any) =>
        /(?:^|;)emcWire=1(?:;|$)/.test(edge?.style || "")
    wrap(
        handler,
        "isStartEvent",
        (original) =>
            function (this: any, event: any) {
                if (!active) return original.call(this, event)
                return (
                    allowed() &&
                    fixed(
                        this.constraintHandler.currentFocus?.cell,
                        this.constraintHandler.currentConstraint,
                        true,
                    )
                )
            },
    )
    wrap(
        handler,
        "createEdgeState",
        (original) =>
            function (this: any, event: any) {
                if (!active) return original.call(this, event)
                const edge = graph.createEdge(
                    null,
                    null,
                    "",
                    null,
                    null,
                    connectorStyle(ends),
                )
                return new win.mxCellState(
                    graph.view,
                    edge,
                    graph.getCellStyle(edge),
                )
            },
    )
    wrap(
        handler,
        "isCreateTarget",
        (original) =>
            function (this: any, event: any) {
                return active ? false : original.call(this, event)
            },
    )
    wrap(
        handler,
        "isOutlineConnectEvent",
        (original) =>
            function (this: any, event: any) {
                return active ? false : original.call(this, event)
            },
    )
    wrap(
        handler,
        "connect",
        (original) =>
            function (this: any, source: any, target: any, ...args: any[]) {
                if (
                    active &&
                    (!allowed() ||
                        !fixed(source, this.sourceConstraint, true) ||
                        !fixed(
                            target,
                            this.constraintHandler.currentConstraint,
                            false,
                        ))
                )
                    return
                return original.call(this, source, target, ...args)
            },
    )
    // Reconnecting an existing EMC wire remains restricted even after leaving the tool.
    wrap(
        graph,
        "connectCell",
        (original) =>
            function (
                this: any,
                edge: any,
                terminal: any,
                source: boolean,
                constraint: any,
            ) {
                if (
                    owned(edge) &&
                    (!allowed() || !fixed(terminal, constraint, source))
                )
                    return edge
                return original.call(this, edge, terminal, source, constraint)
            },
    )
    wrap(
        graph,
        "getEdgeValidationError",
        (original) =>
            function (this: any, edge: any, source: any, target: any) {
                if (owned(edge) && (!source || !target))
                    return "Connect both ends to fixed connection points."
                return original.call(this, edge, source, target)
            },
    )
    wrap(
        graph.view,
        "updatePoints",
        (original) =>
            function (this: any, edge: any, ...args: any[]) {
                const result = original.call(this, edge, ...args)
                if (
                    edge?.style?.emcWire === "1" ||
                    edge?.style?.emcWire === 1
                ) {
                    edge.absolutePoints = snapConnectorRoute(
                        edge.absolutePoints || [],
                        this.scale,
                        this.translate,
                    ).map((p: any) =>
                        p == null ? null : new win.mxPoint(p.x, p.y),
                    )
                }
                return result
            },
    )
    // Capture both mouse and touch before native selection/connection gestures.
    // Hit testing uses screen pixels; the actual constraint remains exact.
    type Anchor = { cell: any; constraint: any; x: number; y: number }
    let selected: Anchor | null = null
    let pressed: {
        anchor: Anchor | null
        x: number
        y: number
        id: number
    } | null = null
    let marker: any = null
    const clearAnchor = () => {
        selected = null
        marker?.remove()
        marker = null
    }
    const anchorAt = (event: PointerEvent, source: boolean): Anchor | null => {
        const rect = graph.container.getBoundingClientRect()
        const radius = event.pointerType === "touch" ? 26 : 16
        let best: Anchor | null = null,
            distance = radius * radius
        for (const cell of Object.values(graph.model.cells || {}) as any[]) {
            if (graph.model.isEdge(cell) || !graph.isCellConnectable(cell))
                continue
            const state = graph.view.getState(cell)
            if (!state) continue
            for (const constraint of graph.getAllConnectionConstraints(
                state,
                source,
            ) || []) {
                if (!constraint?.point) continue
                const point = graph.getConnectionPoint(state, constraint)
                if (!point) continue
                const x = rect.left + point.x - graph.container.scrollLeft
                const y = rect.top + point.y - graph.container.scrollTop
                const d = (x - event.clientX) ** 2 + (y - event.clientY) ** 2
                if (d < distance) {
                    distance = d
                    best = { cell, constraint, x, y }
                }
            }
        }
        return best
    }
    const markAnchor = (anchor: Anchor) => {
        clearAnchor()
        selected = anchor
        marker = win.document.createElement("div")
        marker.setAttribute("aria-hidden", "true")
        marker.style.cssText = `position:fixed;left:${anchor.x - 7}px;top:${anchor.y - 7}px;width:14px;height:14px;border:2px solid #efbf54;border-radius:50%;background:#efbf5455;pointer-events:none;z-index:100000;box-sizing:border-box`
        win.document.body.appendChild(marker)
    }
    const connectAnchors = (source: Anchor, target: Anchor) => {
        if (
            !allowed() ||
            !fixed(source.cell, source.constraint, true) ||
            !fixed(target.cell, target.constraint, false)
        )
            return
        graph.model.beginUpdate()
        try {
            const edge = graph.insertEdge(
                graph.getDefaultParent(),
                null,
                "",
                source.cell,
                target.cell,
                connectorStyle(ends),
            )
            graph.setConnectionConstraint(
                edge,
                source.cell,
                true,
                source.constraint,
            )
            graph.setConnectionConstraint(
                edge,
                target.cell,
                false,
                target.constraint,
            )
            graph.setSelectionCell(edge)
        } finally {
            graph.model.endUpdate()
            clearAnchor()
        }
    }
    const down = (event: PointerEvent) => {
        if (
            !active ||
            !allowed() ||
            event.isPrimary === false ||
            event.button > 0
        )
            return
        event.preventDefault()
        event.stopImmediatePropagation()
        handler.reset()
        pressed = {
            anchor: anchorAt(event, !selected),
            x: event.clientX,
            y: event.clientY,
            id: event.pointerId,
        }
        graph.container.setPointerCapture?.(event.pointerId)
    }
    const move = (event: PointerEvent) => {
        if (!active || !pressed) return
        event.preventDefault()
        event.stopImmediatePropagation()
    }
    const up = (event: PointerEvent) => {
        if (!active || !pressed || event.pointerId !== pressed.id) return
        event.preventDefault()
        event.stopImmediatePropagation()
        const start = pressed
        pressed = null
        graph.container.releasePointerCapture?.(event.pointerId)
        if (!allowed()) {
            clearAnchor()
            return
        }
        const target = anchorAt(event, false)
        const dragged =
            Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6
        if (dragged) {
            if (
                start.anchor &&
                target &&
                (start.anchor.cell !== target.cell ||
                    start.anchor.constraint !== target.constraint)
            )
                connectAnchors(start.anchor, target)
            else clearAnchor()
        } else if (!target) clearAnchor()
        else if (selected) {
            if (
                selected.cell === target.cell &&
                selected.constraint.point.x === target.constraint.point.x &&
                selected.constraint.point.y === target.constraint.point.y
            )
                clearAnchor()
            else connectAnchors(selected, target)
        } else markAnchor(anchorAt(event, true) || target)
    }
    const cancel = () => {
        pressed = null
        clearAnchor()
    }
    if (graph.container.addEventListener) {
        for (const [name, listener] of [
            ["pointerdown", down],
            ["pointermove", move],
            ["pointerup", up],
            ["pointercancel", cancel],
        ] as const) {
            graph.container.addEventListener(name, listener, true)
            cleanup.push(() =>
                graph.container.removeEventListener(name, listener, true),
            )
        }
        cleanup.push(cancel)
    }
    const setActive = (value: boolean) => {
        if (value === active || (value && !allowed())) return false
        handler.reset()
        cancel()
        if (value) {
            graph.freehand?.stopDrawing?.()
            saved = {
                grid: graph.gridEnabled,
                size: graph.gridSize,
                connectable: graph.isConnectable(),
                waypoints: handler.waypointsEnabled,
                cursor: graph.container.style.cursor,
                touchAction: graph.container.style.touchAction,
            }
            graph.setGridEnabled(true)
            graph.gridSize = 10
            graph.setConnectable(true)
            handler.waypointsEnabled = false
            graph.container.style.cursor = "crosshair"
            graph.container.style.touchAction = "none"
        } else if (saved) {
            graph.setGridEnabled(saved.grid)
            graph.gridSize = saved.size
            graph.setConnectable(saved.connectable)
            handler.waypointsEnabled = saved.waypoints
            graph.container.style.cursor = saved.cursor
            graph.container.style.touchAction = saved.touchAction
        }
        active = value
        graph.container.focus?.()
        changed(active, ends)
        return true
    }
    const selectedWires = () =>
        (graph.getSelectionCells?.() || []).filter(owned)
    const selectionChanged = () => {
        const edge = selectedWires()[0]
        if (edge) {
            const style = graph.getCellStyle(edge)
            const start = style.startArrow && style.startArrow !== "none"
            const end = style.endArrow && style.endArrow !== "none"
            ends = start ? (end ? "both" : "start") : end ? "end" : "none"
        }
        changed(active, ends)
    }
    const selection = graph.getSelectionModel?.()
    selection?.addListener(win.mxEvent.CHANGE, selectionChanged)
    cleanup.push(() => selection?.removeListener(selectionChanged))
    const onEscape = () => setActive(false)
    graph.addListener(win.mxEvent.ESCAPE, onEscape)
    cleanup.push(() => graph.removeListener(onEscape))
    return {
        setActive,
        isActive: () => active,
        setEnds: (value: ConnectorEnds) => {
            if (!allowed()) return
            ends = value
            const edges = selectedWires()
            if (edges.length) {
                graph.model.beginUpdate()
                try {
                    graph.setCellStyles(
                        "startArrow",
                        value === "start" || value === "both"
                            ? "classic"
                            : "none",
                        edges,
                    )
                    graph.setCellStyles(
                        "endArrow",
                        value === "end" || value === "both"
                            ? "classic"
                            : "none",
                        edges,
                    )
                } finally {
                    graph.model.endUpdate()
                }
            }
            changed(active, ends)
        },
        dispose: () => {
            setActive(false)
            for (const fn of cleanup.reverse()) fn()
        },
    }
}
