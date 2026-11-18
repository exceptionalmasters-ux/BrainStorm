import type { EmcSymbol } from "./emc-symbols"
export const EMC_STANDARD = {
    grid: 10,
    pinPitch: 20,
    fontSize: 12,
    strokeWidth: 1,
    pinDiameter: 6,
    pinStem: 20,
} as const
const round = (v: number) => Math.ceil(v / 10) * 10
/** Conservative Helvetica widths, shared by the preview and native graph. */
const textWidth = (text: string, size: number) =>
    Array.from(text).reduce(
        (n, c) =>
            n +
            (/[0-9]/.test(c)
                ? 0.56
                : /[ilI.,' ]/.test(c)
                  ? 0.35
                  : /[MW@%]/.test(c)
                    ? 1
                    : 0.7) *
                size,
        0,
    ) + (/^[0-9]+$/.test(text) ? 4 : 8)
export function standardSymbolLayout(symbol: EmcSymbol) {
    const density = symbol.body?.density || "standard",
        fontSize = density === "compact" ? 10 : 12
    const pitch = Math.max(
        density === "spacious" ? 30 : 20,
        round(
            Math.max(
                0,
                ...symbol.pins
                    .filter((p) => p.identifierKind !== "label")
                    .map((p) => textWidth(p.number, fontSize)),
            ),
        ),
    )
    const sidePins = (side: string) =>
        symbol.pins.filter((p) => p.side === side)
    const span = (side: string) =>
        Math.max(0, ...sidePins(side).map((p) => textWidth(p.name, fontSize)))
    const topBand = sidePins("top").length ? span("top") + 28 : 20
    const bottomBand = sidePins("bottom").length ? span("bottom") + 28 : 20
    const antenna = symbol.body?.antennaHeight || 0
    const marker = symbol.body?.pin1
    const cornerX =
        marker && (marker.y <= 0.25 || marker.y >= 0.75)
            ? marker.x <= 0.25
                ? marker.x
                : marker.x >= 0.75
                  ? 1 - marker.x
                  : 0
            : 0
    const cornerY =
        marker && (marker.x <= 0.25 || marker.x >= 0.75)
            ? marker.y <= 0.25
                ? marker.y
                : marker.y >= 0.75
                  ? 1 - marker.y
                  : 0
            : 0
    const horizontalCount = Math.max(
        sidePins("top").length,
        sidePins("bottom").length,
    )
    const verticalCount = Math.max(
        sidePins("left").length,
        sidePins("right").length,
    )
    const minW = Math.max(
        120,
        ((horizontalCount - 1) * pitch + 60) / (1 - cornerX),
        span("left") + span("right") + 60,
        (Math.max(sidePins("top").length, sidePins("bottom").length) - 1) *
            pitch +
            40,
    )
    const minH = Math.max(
        100,
        ((verticalCount - 1) * pitch + 40 + Math.max(topBand, bottomBand)) /
            (1 - cornerY),
        topBand + bottomBand + 40,
        ((Math.max(sidePins("left").length, sidePins("right").length) - 1) *
            pitch +
            topBand +
            bottomBand) /
            (1 - antenna),
    )
    const ratio = (symbol.body?.width || 200) / (symbol.body?.height || 240)
    // No division by the first/last pad position: the previous layout could grow without bound near corners.
    const bodyH = round(Math.max(minH, minW / ratio)),
        bodyW = bodyH * ratio
    const width = round(bodyW + 40),
        height = round(bodyH + 80)
    const frame = { x: (width - bodyW) / 2, y: 60, width: bodyW, height: bodyH }
    const pins: any[] = [],
        labels: any[] = [],
        leaders: { id: string; points: { x: number; y: number }[] }[] = []
    for (const side of ["left", "right", "top", "bottom"]) {
        const horizontal = side === "top" || side === "bottom"
        const sorted = sidePins(side)
            .map((p, i, ps) => ({
                ...p,
                ratio: p.position ?? (i + 1) / (ps.length + 1),
            }))
            .sort((a, b) => a.ratio - b.ratio)
        let low = horizontal
            ? round(frame.x + 20)
            : round(frame.y + topBand + bodyH * antenna)
        let high = horizontal
            ? Math.floor((frame.x + bodyW - 20) / 10) * 10
            : Math.floor((frame.y + bodyH - bottomBand) / 10) * 10
        // Reserve the source pin-1 dot's corner instead of covering it with a pin label.
        if (
            marker &&
            horizontal &&
            ((side === "top" && marker.y <= 0.25) ||
                (side === "bottom" && marker.y >= 0.75))
        ) {
            if (marker.x <= 0.25)
                low = Math.max(low, round(frame.x + marker.x * bodyW + 20))
            if (marker.x >= 0.75)
                high = Math.min(
                    high,
                    Math.floor((frame.x + marker.x * bodyW - 20) / 10) * 10,
                )
        }
        if (
            marker &&
            !horizontal &&
            ((side === "left" && marker.x <= 0.25) ||
                (side === "right" && marker.x >= 0.75))
        ) {
            if (marker.y <= 0.25)
                low = Math.max(low, round(frame.y + marker.y * bodyH + 20))
            if (marker.y >= 0.75)
                high = Math.min(
                    high,
                    Math.floor((frame.y + marker.y * bodyH - 20) / 10) * 10,
                )
        }
        // Source position establishes order; regular schematic rows use one pitch.
        // Matching left/right rows (and top/bottom columns) share their first axis.
        const count = horizontal ? horizontalCount : verticalCount
        const first = Math.round((low + high - (count - 1) * pitch) / 20) * 10
        const start = Math.max(low, Math.min(high - (count - 1) * pitch, first))
        const slots = sorted.map((_pin, i) => start + i * pitch)
        sorted.forEach((pin, i) => {
            const row = slots[i],
                sx = horizontal
                    ? row
                    : side === "left"
                      ? frame.x
                      : frame.x + bodyW,
                sy = horizontal
                    ? side === "top"
                        ? frame.y
                        : frame.y + bodyH
                    : row
            const x = horizontal ? row : side === "left" ? 0 : width,
                y = horizontal ? (side === "top" ? 40 : height) : row
            pins.push({
                ...pin,
                x: x / width,
                y: y / height,
                sourceX: sx,
                sourceY: sy,
            })
            leaders.push({
                id: pin.number,
                points: [
                    { x, y },
                    {
                        x: horizontal
                            ? row
                            : side === "left"
                              ? frame.x - 10
                              : frame.x + bodyW + 10,
                        y: horizontal
                            ? side === "top"
                                ? frame.y - 10
                                : frame.y + bodyH + 10
                            : row,
                    },
                    { x: sx, y: sy },
                ],
            })
            const named =
                pin.identifierKind === "label" || pin.name === pin.number
            if (!named)
                labels.push({
                    id: pin.number + ":number",
                    text: pin.number,
                    x: horizontal
                        ? row + 8
                        : side === "left"
                          ? frame.x / 2
                          : (width + frame.x + bodyW) / 2,
                    y: horizontal
                        ? side === "top"
                            ? frame.y - 10
                            : frame.y + bodyH + 10
                        : row - 9,
                    width: textWidth(pin.number, fontSize),
                    rotation: 0,
                    anchor: horizontal ? "start" : "middle",
                    fontSize,
                })
            labels.push({
                id: pin.number + ":name",
                text: pin.name,
                x: horizontal
                    ? row
                    : side === "left"
                      ? frame.x + 12
                      : frame.x + bodyW - 12,
                y: horizontal
                    ? side === "top"
                        ? frame.y + 20
                        : frame.y + bodyH - 20
                    : row,
                width: textWidth(pin.name, fontSize),
                rotation: horizontal ? (side === "top" ? 90 : 270) : 0,
                anchor: horizontal
                    ? "start"
                    : side === "left"
                      ? "start"
                      : "end",
                fontSize,
            })
        })
    }
    return {
        width,
        height,
        pins,
        rich: true,
        outline:
            symbol.body?.outline ||
            ([
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
            ] as [number, number][]),
        labels,
        fontSize,
        bodyFrame: frame,
        leaders,
        header: true,
        pitch,
    }
}
export function insertStandardSymbolNative(
    ui: any,
    win: any,
    symbol: EmcSymbol,
    position?: { x: number; y: number },
) {
    const graph = ui.editor.graph,
        l = standardSymbolLayout(symbol),
        p = position || graph.getFreeInsertPoint(),
        m = graph.model
    let root: any
    graph.stopEditing(false)
    m.beginUpdate()
    const vertex = (
        parent: any,
        value: string,
        x: number,
        y: number,
        w: number,
        h: number,
        style: string,
    ) => {
        const c = graph.insertVertex(
            parent,
            null,
            value,
            x,
            y,
            w,
            h,
            style + ";html=0;fontFamily=Helvetica;strokeWidth=1;",
        )
        c.setConnectable(false)
        return c
    }
    try {
        root = vertex(
            graph.getDefaultParent(),
            "",
            Math.round(p.x / 10) * 10,
            Math.round(p.y / 10) * 10,
            l.width,
            l.height,
            "group;",
        )
        const f = l.bodyFrame
        vertex(
            root,
            "",
            f.x,
            f.y,
            f.width,
            f.height,
            `shape=mxgraph.basic.polygon;polyCoords=${JSON.stringify(l.outline)};fillColor=#ffffff;strokeColor=#000000;`,
        )
        if (symbol.body?.antennaHeight)
            vertex(
                root,
                "ANTENNA",
                f.x,
                f.y,
                f.width,
                f.height * symbol.body.antennaHeight,
                "fillColor=none;strokeColor=#777777;fontSize=12;align=center;verticalAlign=middle;",
            )
        if (symbol.body?.pin1)
            vertex(
                root,
                "",
                f.x + symbol.body.pin1.x * f.width - 4,
                f.y + symbol.body.pin1.y * f.height - 4,
                8,
                8,
                "shape=ellipse;fillColor=#000000;strokeColor=#000000;",
            )
        // Straight schematic stems share the pin row/column and terminate on the grid.
        for (const line of l.leaders) {
            const edge = graph.insertEdge(
                root,
                null,
                "",
                null,
                null,
                "html=0;strokeColor=#000000;strokeWidth=1;endArrow=none;startArrow=none;connectable=0;",
            )
            edge.setConnectable(false)
            const g = edge.geometry.clone()
            g.sourcePoint = new win.mxPoint(line.points[0].x, line.points[0].y)
            g.targetPoint = new win.mxPoint(line.points[2].x, line.points[2].y)
            g.points = [new win.mxPoint(line.points[1].x, line.points[1].y)]
            m.setGeometry(edge, g)
        }
        for (const pin of l.pins) {
            const c = graph.insertVertex(
                root,
                null,
                "",
                pin.x,
                pin.y,
                6,
                6,
                `shape=ellipse;html=0;fillColor=#000000;strokeColor=#000000;perimeter=none;points=[[0.5,0.5,0]];outlineConnect=0;snapToPoint=1;movable=0;resizable=0;rotatable=0;emcPinSide=${pin.side};`,
                true,
            )
            const g = c.geometry.clone()
            g.offset = new win.mxPoint(-3, -3)
            m.setGeometry(c, g)
        }
        for (const label of l.labels) {
            const vertical = label.rotation !== 0,
                cx =
                    label.x +
                    (vertical
                        ? 0
                        : label.anchor === "start"
                          ? label.width / 2
                          : label.anchor === "end"
                            ? -label.width / 2
                            : 0),
                cy =
                    label.y +
                    (vertical
                        ? label.rotation === 90
                            ? label.width / 2
                            : -label.width / 2
                        : 0)
            vertex(
                root,
                label.text,
                cx - label.width / 2,
                cy - 7,
                label.width,
                14,
                `shape=text;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=${label.fontSize};whiteSpace=nowrap;overflow=visible;rotation=${label.rotation};`,
            )
        }
        const used = new Set(
            Object.values(graph.model.cells || {}).flatMap((c: any) =>
                typeof c.value === "string" && /^U\d+$/.test(c.value)
                    ? [c.value]
                    : [],
            ),
        )
        let n = 1
        while (used.has("U" + n)) n++
        vertex(
            root,
            "U" + n,
            0,
            0,
            l.width,
            16,
            "shape=text;strokeColor=none;fillColor=none;fontSize=12;fontStyle=1;align=center;",
        )
        vertex(
            root,
            symbol.name,
            0,
            18,
            l.width,
            18,
            "shape=text;strokeColor=none;fillColor=none;fontSize=14;align=center;",
        )
    } finally {
        m.endUpdate()
    }
    graph.setSelectionCell(root)
    graph.scrollCellToVisible(root)
    return true
}
