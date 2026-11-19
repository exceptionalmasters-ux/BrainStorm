import {
    insertStandardSymbolNative,
    standardSymbolLayout,
} from "./emc-standard-layout"
import {
    distinctPinPositions,
    type SymbolBody,
    validSymbolBody,
} from "./symbol-geometry"
export interface EmcSymbol {
    name: string
    device: string
    package: string
    incomplete?: boolean
    warnings?: string[]
    sourceUrl?: string
    body?: SymbolBody
    sourceKind?: "pdf" | "image" | "document" | "summary"
    pins: {
        number: string
        identifierKind?: "number" | "label"
        position?: number
        name: string
        side: "left" | "right" | "top" | "bottom"
        sourceUrl: string
        evidence: string
    }[]
}
export function validateEmcSymbol(value: unknown): value is EmcSymbol {
    if (!value || typeof value !== "object") return false
    const d = value as EmcSymbol
    const text = (s: unknown, max: number) =>
        typeof s === "string" && s.trim().length > 0 && s.length <= max
    const source = (url: unknown) => {
        try {
            return typeof url === "string" && new URL(url).protocol === "https:"
        } catch {
            return false
        }
    }
    return (
        text(d.name, 120) &&
        text(d.device, 160) &&
        text(d.package, 120) &&
        validSymbolBody(d.body) &&
        Array.isArray(d.pins) &&
        (d.pins.length > 0 || (d.incomplete === true && source(d.sourceUrl))) &&
        d.pins.length <= 128 &&
        distinctPinPositions(d.pins) &&
        new Set(d.pins.map((p) => p?.number)).size === d.pins.length &&
        d.pins.every(
            (p) =>
                p &&
                text(p.number, 30) &&
                text(p.name, 60) &&
                ["left", "right", "top", "bottom"].includes(p.side) &&
                (p.identifierKind === undefined ||
                    ["number", "label"].includes(p.identifierKind)) &&
                (p.position === undefined ||
                    (Number.isFinite(p.position) &&
                        p.position >= 0.02 &&
                        p.position <= 0.98)) &&
                source(p.sourceUrl) &&
                text(p.evidence, 600),
        )
    )
}
export interface DeviceCandidate {
    id: string
    title: string
    device: string
    package: string
    description: string
    sourceUrl: string
    imageUrl: string | null
    sourceImageUrl?: string | null
    representationKind?: "pinout" | "device_view" | "document"
    variantUnconfirmed?: boolean
}
export interface DeviceResearch {
    sourceId?: string
    researchId: string
    questions: string[]
    candidates: DeviceCandidate[]
    status?: "results" | "needs_clarification" | "no_sources"
    warnings?: string[]
    elapsedMs?: number
    filteredCount?: number
}
export interface LibrarySymbol {
    id: string
    name: string
    device: string
    package: string
    version: number
    sources: string[]
}
/** Shared coordinates for native ports and the approval preview. */
export function symbolLayout(symbol: EmcSymbol) {
    if (symbol.body?.labelsInside) return standardSymbolLayout(symbol)
    return legacySymbolLayout(symbol)
}
function legacySymbolLayout(symbol: EmcSymbol) {
    const count = (side: string) =>
        symbol.pins.filter((p) => p.side === side).length
    const indexes: Record<string, number> = {}
    const pins = symbol.pins.map((pin) => {
        const index = (indexes[pin.side] = (indexes[pin.side] || 0) + 1)
        const ratio = pin.position ?? index / (count(pin.side) + 1)
        return {
            ...pin,
            x: pin.side === "left" ? 0 : pin.side === "right" ? 1 : ratio,
            y: pin.side === "top" ? 0 : pin.side === "bottom" ? 1 : ratio,
        }
    })
    const baseW =
        symbol.body?.width ??
        Math.max(280, (Math.max(count("top"), count("bottom")) + 1) * 65)
    const baseH =
        symbol.body?.height ??
        Math.max(160, (Math.max(count("left"), count("right")) + 1) * 28)
    let scale = 1
    const rich = !!symbol.body?.labelsInside
    const span = (side: string) =>
        Math.max(
            0,
            ...pins
                .filter((p) => p.side === side)
                .map((p) => p.name.length * 7 + 52),
        )
    if (rich) {
        // Reserve corner label corridors and a centre title area, preserving source aspect ratio.
        scale = Math.max(
            scale,
            (span("left") +
                span("right") +
                Math.max(
                    180,
                    symbol.name.length * 8,
                    symbol.device.length * 7,
                    symbol.package.length * 7,
                )) /
                baseW,
            (span("top") + span("bottom") + 120) / baseH,
        )
        for (const side of ["left", "right", "top", "bottom"]) {
            const horizontal = side === "top" || side === "bottom"
            const values = pins
                .filter((p) => p.side === side)
                .map((p) => (horizontal ? p.x : p.y))
                .sort((a, b) => a - b)
            for (let i = 1; i < values.length; i++)
                scale = Math.max(
                    scale,
                    28 /
                        Math.max(
                            0.001,
                            (values[i] - values[i - 1]) *
                                (horizontal ? baseW : baseH),
                        ),
                )
            for (const v of values)
                scale = Math.max(
                    scale,
                    (horizontal ? span("left") : span("top")) /
                        Math.max(1, v * (horizontal ? baseW : baseH)),
                    (horizontal ? span("right") : span("bottom")) /
                        Math.max(1, (1 - v) * (horizontal ? baseW : baseH)),
                )
        }
    }
    const width = baseW * scale,
        height = baseH * scale
    return {
        width,
        height,
        bodyFrame: { x: 0, y: 0, width, height },
        leaders: [] as { id: string; points: { x: number; y: number }[] }[],
        fontSize: 11,
        header: false,
        pins,
        rich,
        outline:
            symbol.body?.outline ||
            ([
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
            ] as [number, number][]),
        labels: pins.flatMap((pin) => {
            const x = pin.x * width,
                y = pin.y * height,
                named =
                    pin.identifierKind === "label" || pin.name === pin.number
            if (!rich)
                return [
                    {
                        id: `${pin.number}:label`,
                        text: emcPinLabel(pin),
                        x:
                            x +
                            (pin.side === "left"
                                ? 12
                                : pin.side === "right"
                                  ? -12
                                  : 0),
                        y:
                            y +
                            (pin.side === "top"
                                ? 18
                                : pin.side === "bottom"
                                  ? -12
                                  : 0),
                        width: emcPinLabel(pin).length * 7 + 8,
                        rotation: 0,
                        anchor:
                            pin.side === "left"
                                ? "start"
                                : pin.side === "right"
                                  ? "end"
                                  : "middle",
                    },
                ]
            const side = pin.side,
                horizontal = side === "left" || side === "right",
                sign = side === "left" || side === "top" ? 1 : -1
            const number = {
                id: `${pin.number}:number`,
                text: pin.number,
                x: horizontal
                    ? x + sign * 18
                    : x + 12 + Math.max(20, pin.number.length * 7) / 2,
                y: horizontal ? y : y + sign * 16,
                width: Math.max(20, pin.number.length * 7),
                rotation: 0,
                anchor: "middle",
            }
            const name = {
                id: `${pin.number}:name`,
                text: pin.name,
                x: horizontal ? x + sign * (named ? 16 : 46) : x,
                y: horizontal
                    ? y
                    : y +
                      sign * (named ? 16 : 44) +
                      (side === "top" ? pin.name.length * 7 + 8 : 0),
                width: pin.name.length * 7 + 8,
                rotation: horizontal ? 0 : 270,
                anchor: horizontal
                    ? side === "left"
                        ? "start"
                        : "end"
                    : "start",
            }
            return named ? [name] : [number, name]
        }),
    }
}
export function emcPinLabel(pin: EmcSymbol["pins"][number]) {
    return pin.identifierKind === "label" || pin.number === pin.name
        ? pin.name
        : `${pin.number} ${pin.name}`
}
/** Native cells, not remotely supplied XML, scripts or raster graphics. */
export function insertEmcSymbolNative(
    ui: any,
    win: any,
    symbol: EmcSymbol,
    position?: { x: number; y: number },
) {
    const valid = validateEmcSymbol(symbol)
    const graph = ui?.editor?.graph
    if (!valid || !graph?.isEnabled?.() || !win?.mxPoint) return false
    if (symbol.body?.labelsInside)
        return insertStandardSymbolNative(ui, win, symbol, position)
    const layout = symbolLayout(symbol)
    const point = position || graph.getFreeInsertPoint()
    let root: any
    graph.stopEditing(false)
    graph.model.beginUpdate()
    try {
        root = graph.insertVertex(
            graph.getDefaultParent(),
            null,
            `${symbol.name}\n${symbol.device}\n${symbol.package}${symbol.incomplete ? "\nUNVERIFIED / INCOMPLETE PINOUT" : ""}`,
            point.x,
            point.y,
            layout.width,
            layout.height,
            `rounded=0;html=0;whiteSpace=wrap;align=center;verticalAlign=middle;collapsible=0;fontSize=14;fillColor=#ffffff;strokeColor=#000000;${symbol.body?.outline ? `shape=mxgraph.basic.polygon;polyCoords=${JSON.stringify(layout.outline)};` : ""}`,
        )
        root.setConnectable(false)
        if (symbol.body?.antennaHeight) {
            const antenna = graph.insertVertex(
                root,
                null,
                "ANTENNA",
                0,
                0,
                layout.width,
                layout.height * symbol.body.antennaHeight,
                "rounded=0;html=0;fillColor=none;strokeColor=#777777;movable=0;resizable=0;connectable=0;",
            )
            antenna.setConnectable(false)
        }
        for (const pin of layout.pins) {
            const horizontal = pin.side === "left" || pin.side === "right"
            const labelPosition =
                pin.side === "left"
                    ? "right"
                    : pin.side === "right"
                      ? "left"
                      : "center"
            const port = graph.insertVertex(
                root,
                null,
                layout.rich ? "" : emcPinLabel(pin),
                pin.x,
                pin.y,
                6,
                6,
                `shape=ellipse;html=0;fillColor=#000000;strokeColor=#000000;perimeter=none;points=[[0.5,0.5,0]];outlineConnect=0;snapToPoint=1;movable=0;resizable=0;rotatable=0;labelPosition=${labelPosition};verticalLabelPosition=${horizontal ? "middle" : pin.side === "top" ? "bottom" : "top"};align=${pin.side === "left" ? "left" : pin.side === "right" ? "right" : "center"};verticalAlign=middle;`,
                true,
            )
            const geometry = port.geometry.clone()
            geometry.offset = new win.mxPoint(-3, -3)
            graph.model.setGeometry(port, geometry)
        }
        if (symbol.body?.pin1) {
            const mark = graph.insertVertex(
                root,
                null,
                "",
                symbol.body.pin1.x * layout.width - 4,
                symbol.body.pin1.y * layout.height - 4,
                8,
                8,
                "shape=ellipse;fillColor=#000000;strokeColor=#000000;connectable=0;",
            )
            mark.setConnectable(false)
        }
        if (layout.rich)
            for (const label of layout.labels) {
                const vertical = label.rotation !== 0
                const centreX =
                    label.x +
                    (vertical
                        ? 0
                        : label.anchor === "start"
                          ? label.width / 2
                          : label.anchor === "end"
                            ? -label.width / 2
                            : 0)
                const centreY =
                    label.y +
                    (vertical
                        ? label.rotation === 90
                            ? label.width / 2
                            : -label.width / 2
                        : 0)
                const cell = graph.insertVertex(
                    root,
                    null,
                    label.text,
                    centreX - label.width / 2,
                    centreY - 7,
                    label.width,
                    14,
                    `shape=text;html=0;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=11;whiteSpace=nowrap;overflow=visible;rotation=${label.rotation};connectable=0;`,
                )
                cell.setConnectable(false)
            }
    } finally {
        graph.model.endUpdate()
    }
    graph.setSelectionCell(root)
    graph.scrollCellToVisible(root)
    return true
}
