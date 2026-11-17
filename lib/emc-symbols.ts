export interface EmcSymbol {
    name: string
    device: string
    package: string
    incomplete?: boolean
    warnings?: string[]
    sourceUrl?: string
    body?: { width: number; height: number; antennaHeight?: number }
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
        (!d.body ||
            (Number.isFinite(d.body.width) &&
                d.body.width >= 160 &&
                d.body.width <= 800 &&
                Number.isFinite(d.body.height) &&
                d.body.height >= 160 &&
                d.body.height <= 1000 &&
                (d.body.antennaHeight === undefined ||
                    (Number.isFinite(d.body.antennaHeight) &&
                        d.body.antennaHeight >= 0 &&
                        d.body.antennaHeight <= 0.5)))) &&
        Array.isArray(d.pins) &&
        (d.pins.length > 0 || (d.incomplete === true && source(d.sourceUrl))) &&
        d.pins.length <= 128 &&
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
}
export interface DeviceResearch {
    sourceId?: string
    researchId: string
    questions: string[]
    candidates: DeviceCandidate[]
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
    const count = (side: string) =>
        symbol.pins.filter((p) => p.side === side).length
    const width =
        symbol.body?.width ??
        Math.max(280, (Math.max(count("top"), count("bottom")) + 1) * 65)
    const height =
        symbol.body?.height ??
        Math.max(160, (Math.max(count("left"), count("right")) + 1) * 28)
    const indexes: Record<string, number> = {}
    return {
        width,
        height,
        pins: symbol.pins.map((pin) => {
            const index = (indexes[pin.side] = (indexes[pin.side] || 0) + 1)
            const ratio = pin.position ?? index / (count(pin.side) + 1)
            const x = pin.side === "left" ? 0 : pin.side === "right" ? 1 : ratio
            const y = pin.side === "top" ? 0 : pin.side === "bottom" ? 1 : ratio
            return { ...pin, x, y }
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
            "rounded=0;html=0;whiteSpace=wrap;align=center;verticalAlign=middle;collapsible=0;",
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
                emcPinLabel(pin),
                pin.x,
                pin.y,
                10,
                10,
                `shape=ellipse;html=0;fillColor=#edcb6d;strokeColor=#777777;movable=0;resizable=0;rotatable=0;labelPosition=${labelPosition};verticalLabelPosition=${horizontal ? "middle" : pin.side === "top" ? "bottom" : "top"};align=${pin.side === "left" ? "left" : pin.side === "right" ? "right" : "center"};verticalAlign=middle;`,
                true,
            )
            const geometry = port.geometry.clone()
            geometry.offset = new win.mxPoint(-5, -5)
            graph.model.setGeometry(port, geometry)
        }
    } finally {
        graph.model.endUpdate()
    }
    graph.setSelectionCell(root)
    graph.scrollCellToVisible(root)
    return true
}
