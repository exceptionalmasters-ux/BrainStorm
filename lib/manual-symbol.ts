/** Bounded native cell data. No HTML, external images, executable styles or imported XML. */
export type ManualCell = {
    parent: number | null
    vertex: boolean
    edge: boolean
    value: string
    style: string
    connectable: boolean
    geometry: {
        x: number
        y: number
        width: number
        height: number
        relative: boolean
        offset?: Point
        points?: Point[]
        sourcePoint?: Point
        targetPoint?: Point
    }
    source?: number
    target?: number
    freehand?: Point[][]
    freehandFill?: boolean
}
type Point = { x: number; y: number }
export type ManualSymbol = {
    previewPng?: string
    kind: "manual"
    name: string
    device: string
    package: "Manual drawing"
    width: number
    height: number
    cells: ManualCell[]
}
const keys = new Set(
    "entryX entryY entryDx entryDy exitX exitY exitDx exitDy entryPerimeter exitPerimeter shape rounded arcSize whiteSpace align verticalAlign fillColor strokeColor fontColor fontSize fontFamily fontStyle strokeWidth dashed dashPattern opacity fillOpacity strokeOpacity rotation direction flipH flipV startArrow endArrow startFill endFill startSize endSize edgeStyle elbow curved orthogonalLoop jettySize perimeter points outlineConnect snapToPoint movable resizable rotatable labelPosition verticalLabelPosition spacing spacingLeft spacingRight spacingTop spacingBottom horizontal connectable collapsible portConstraint polyCoords overflow".split(
        " ",
    ),
)
export function safeManualStyle(style: unknown): boolean {
    if (typeof style !== "string" || style.length > 8000) return false
    return style
        .split(";")
        .filter(Boolean)
        .every((part) => {
            const eq = part.indexOf("=")
            if (eq < 1) return false
            const k = part.slice(0, eq),
                v = part.slice(eq + 1)
            if (k === "html") return v === "0"
            if (!keys.has(k) || !/^[\w\s#.,+\-[\]()]*$/.test(v)) return false
            if (k === "shape")
                return (
                    /^(?:[a-zA-Z][\w.]*|none)$/.test(v) &&
                    !/image|stencil/i.test(v)
                )
            return true
        })
}
/** Raster thumbnails have a bounded PNG header; editable cells remain the source of truth. */
export function validManualPreview(value: unknown) {
    if (value === undefined) return true
    if (
        typeof value !== "string" ||
        value.length > 120000 ||
        !/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(value)
    )
        return false
    const alphabet =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
        raw = value.slice(22)
    const bytes: number[] = []
    for (let i = 0; i < 32; i += 4) {
        const n =
            (alphabet.indexOf(raw[i]) << 18) |
            (alphabet.indexOf(raw[i + 1]) << 12) |
            (alphabet.indexOf(raw[i + 2]) << 6) |
            alphabet.indexOf(raw[i + 3])
        bytes.push((n >>> 16) & 255, (n >>> 8) & 255, n & 255)
    }
    const u32 = (i: number) =>
        bytes[i] * 16777216 +
        bytes[i + 1] * 65536 +
        bytes[i + 2] * 256 +
        bytes[i + 3]
    return (
        String.fromCharCode(...bytes.slice(12, 16)) === "IHDR" &&
        u32(16) > 0 &&
        u32(16) <= 512 &&
        u32(20) > 0 &&
        u32(20) <= 512
    )
}
export function validateManualSymbol(value: unknown): value is ManualSymbol {
    if (!value || typeof value !== "object") return false
    const s = value as ManualSymbol,
        num = (v: unknown) =>
            typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 100000
    const point = (p: any) => p && num(p.x) && num(p.y)
    if (
        !validManualPreview(s.previewPng) ||
        s.kind !== "manual" ||
        typeof s.name !== "string" ||
        !s.name.trim() ||
        s.name.length > 120 ||
        s.device !== s.name ||
        s.package !== "Manual drawing" ||
        !num(s.width) ||
        !num(s.height) ||
        s.width <= 0 ||
        s.height <= 0 ||
        !Array.isArray(s.cells) ||
        !s.cells.length ||
        s.cells.length > 500
    )
        return false
    return (
        s.cells.every((c, i) => {
            const g = c?.geometry
            return (
                c &&
                (c.parent === null ||
                    (Number.isInteger(c.parent) &&
                        c.parent >= 0 &&
                        c.parent < i)) &&
                typeof c.vertex === "boolean" &&
                typeof c.edge === "boolean" &&
                c.vertex !== c.edge &&
                typeof c.connectable === "boolean" &&
                typeof c.value === "string" &&
                c.value.length <= 4000 &&
                safeManualStyle(c.style) &&
                g &&
                [g.x, g.y, g.width, g.height].every(num) &&
                g.width >= 0 &&
                g.height >= 0 &&
                typeof g.relative === "boolean" &&
                [g.offset, g.sourcePoint, g.targetPoint].every(
                    (p) => p === undefined || point(p),
                ) &&
                (g.points === undefined ||
                    (Array.isArray(g.points) &&
                        g.points.length <= 2000 &&
                        g.points.every(point))) &&
                [c.source, c.target].every(
                    (t) =>
                        t === undefined ||
                        (Number.isInteger(t) &&
                            t >= 0 &&
                            t < s.cells.length &&
                            s.cells[t].vertex),
                ) &&
                (c.freehandFill === undefined ||
                    typeof c.freehandFill === "boolean") &&
                (c.freehand === undefined ||
                    (Array.isArray(c.freehand) &&
                        c.freehand.length <= 100 &&
                        c.freehand.every(
                            (path) =>
                                Array.isArray(path) &&
                                path.length >= 2 &&
                                path.length <= 2000 &&
                                path.every(point),
                        )))
            )
        }) && JSON.stringify(s).length <= 240000
    )
}
export function captureManualSymbol(ui: any, win: any): ManualSymbol {
    const graph = ui.editor.graph,
        model = graph.model
    const roots = model.getTopmostCells(graph.getSelectionCells())
    if (!roots.length) throw Error("Select one or more objects first.")
    const all: any[] = []
    const walk = (c: any) => {
        all.push(c)
        for (let i = 0; i < model.getChildCount(c); i++)
            walk(model.getChildAt(c, i))
    }
    roots.forEach(walk)
    const box = graph.getBoundingBoxFromGeometry(roots, true)
    if (!box) throw Error("The selected drawing has no geometry.")
    const cells: ManualCell[] = all.map((cell) => {
        const raw = cell.geometry
        if (!raw) throw Error("An object has no geometry.")
        const g = raw.clone(),
            parent = all.indexOf(model.getParent(cell))
        if (parent < 0 && !g.relative) {
            g.x -= box.x
            g.y -= box.y
        }
        if (parent < 0 && g.points)
            g.points = g.points.map(
                (p: any) => new win.mxPoint(p.x - box.x, p.y - box.y),
            )
        const source = all.indexOf(model.getTerminal(cell, true)),
            target = all.indexOf(model.getTerminal(cell, false))
        if (
            cell.edge &&
            ((model.getTerminal(cell, true) && source < 0) ||
                (model.getTerminal(cell, false) && target < 0))
        )
            throw Error("Select both connected objects together with the line.")
        let freehand: Point[][] | undefined
        const style = graph.getCellStyle(cell)
        if (style.image)
            throw Error(
                "Images cannot be stored as editable vector symbols. Select vector shapes instead.",
            )
        if (String(style.shape).startsWith("stencil(")) {
            const xml = win.Graph.decompress(style.shape.slice(8, -1)),
                doc = new win.DOMParser().parseFromString(xml, "text/xml")
            if (
                doc.querySelector("parsererror") ||
                Array.from(doc.querySelectorAll("*")).some(
                    (n: any) =>
                        ![
                            "shape",
                            "foreground",
                            "path",
                            "move",
                            "line",
                            "stroke",
                            "fillstroke",
                        ].includes(n.tagName),
                )
            )
                throw Error(
                    "This custom stencil cannot be saved safely. Use native shapes or the pencil tool.",
                )
            freehand = Array.from(doc.querySelectorAll("path")).map((p: any) =>
                Array.from(p.children).map((n: any) => ({
                    x: Number(n.getAttribute("x")),
                    y: Number(n.getAttribute("y")),
                })),
            )
            delete style.shape
        }
        // Resolved styles eliminate implicit named defaults and HTML labels.
        const serialized =
            Object.entries(style)
                .filter(([k]) => keys.has(k))
                .map(
                    ([k, v]) =>
                        `${k}=${typeof v === "function" ? win.mxStyleRegistry?.getName(v) : v}`,
                )
                .join(";") + ";html=0;"
        if (!safeManualStyle(serialized))
            throw Error(
                "This drawing contains an unsupported image or style. Use native vector shapes and plain text.",
            )
        const value =
            typeof cell.value === "string"
                ? cell.value
                : win.mxUtils.getTextContent?.(cell.value)
        return {
            parent: parent < 0 ? null : parent,
            vertex: !!cell.vertex,
            edge: !!cell.edge,
            value:
                typeof value === "string" ? value.replace(/<[^>]*>/g, "") : "",
            style: serialized,
            connectable: cell.isConnectable(),
            geometry: {
                x: g.x,
                y: g.y,
                width: g.width,
                height: g.height,
                relative: !!g.relative,
                ...(g.offset
                    ? { offset: { x: g.offset.x, y: g.offset.y } }
                    : {}),
                ...(g.points
                    ? { points: g.points.map((p: any) => ({ x: p.x, y: p.y })) }
                    : {}),
                ...(g.sourcePoint
                    ? {
                          sourcePoint: {
                              x: g.sourcePoint.x - (parent < 0 ? box.x : 0),
                              y: g.sourcePoint.y - (parent < 0 ? box.y : 0),
                          },
                      }
                    : {}),
                ...(g.targetPoint
                    ? {
                          targetPoint: {
                              x: g.targetPoint.x - (parent < 0 ? box.x : 0),
                              y: g.targetPoint.y - (parent < 0 ? box.y : 0),
                          },
                      }
                    : {}),
            },
            ...(source >= 0 ? { source } : {}),
            ...(target >= 0 ? { target } : {}),
            ...(freehand
                ? {
                      freehand,
                      freehandFill: !!win.Graph.decompress(
                          String(graph.getCellStyle(cell).shape).slice(8, -1),
                      ).includes("<fillstroke"),
                  }
                : {}),
        }
    })
    const result: ManualSymbol = {
        kind: "manual",
        name: "My symbol",
        device: "My symbol",
        package: "Manual drawing",
        width: Math.max(1, box.width),
        height: Math.max(1, box.height),
        cells,
    }
    if (!validateManualSymbol(result))
        throw Error(
            "The selection is too large or contains unsupported geometry (maximum 500 objects).",
        )
    return result
}
export function insertManualSymbolNative(
    ui: any,
    win: any,
    s: ManualSymbol,
    position?: Point,
) {
    const graph = ui?.editor?.graph
    if (!validateManualSymbol(s) || !graph?.isEnabled?.()) return false
    const point = position || graph.getFreeInsertPoint(),
        model = graph.model,
        cells: any[] = []
    graph.stopEditing(false)
    model.beginUpdate()
    let root: any
    try {
        root = graph.insertVertex(
            graph.getDefaultParent(),
            null,
            "",
            point.x,
            point.y,
            s.width,
            s.height,
            "group;html=0;",
        )
        root.setConnectable(false)
        for (const c of s.cells) {
            let style = c.style
            if (c.freehand) {
                const xml =
                    '<shape strokewidth="inherit"><foreground>' +
                    c.freehand
                        .map(
                            (path) =>
                                "<path>" +
                                path
                                    .map(
                                        (p, i) =>
                                            `<${i ? "line" : "move"} x="${p.x}" y="${p.y}"/>`,
                                    )
                                    .join("") +
                                "</path>" +
                                (c.freehandFill
                                    ? "<fillstroke/>"
                                    : "<stroke/>"),
                        )
                        .join("") +
                    "</foreground></shape>"
                style += `shape=stencil(${win.Graph.compress(xml)});`
            }
            const g = c.geometry,
                cell = new win.mxCell(
                    c.value,
                    new win.mxGeometry(g.x, g.y, g.width, g.height),
                    style,
                )
            cell.setVertex(c.vertex)
            cell.setEdge(c.edge)
            cell.setConnectable(c.connectable)
            cell.geometry.relative = g.relative
            for (const k of ["offset", "sourcePoint", "targetPoint"] as const)
                if (g[k]) cell.geometry[k] = new win.mxPoint(g[k].x, g[k].y)
            if (g.points)
                cell.geometry.points = g.points.map(
                    (p) => new win.mxPoint(p.x, p.y),
                )
            graph.addCell(cell, c.parent === null ? root : cells[c.parent])
            cells.push(cell)
        }
        s.cells.forEach((c, i) => {
            if (c.source !== undefined)
                model.setTerminal(cells[i], cells[c.source], true)
            if (c.target !== undefined)
                model.setTerminal(cells[i], cells[c.target], false)
        })
    } finally {
        model.endUpdate()
    }
    graph.setSelectionCell(root)
    graph.scrollCellToVisible(root)
    return true
}

export async function captureManualLibrarySymbol(
    ui: any,
    win: any,
): Promise<ManualSymbol> {
    const symbol = captureManualSymbol(ui, win),
        graph = ui.editor.graph
    try {
        const svg = graph.getSvg("#ffffff", 1, 8, false, true, false, true)
        // Native labels may contain foreignObject. Use their plain SVG text alternatives.
        svg.querySelectorAll("foreignObject,script,style,image").forEach(
            (n: Element) => {
                n.remove()
            },
        )
        svg.querySelectorAll("a").forEach((n: Element) => {
            n.removeAttribute("href")
            n.removeAttribute("xlink:href")
        })
        const w = Number(svg.getAttribute("width")),
            h = Number(svg.getAttribute("height"))
        const scale = Math.min(1, 512 / Math.max(w, h)),
            width = Math.max(1, Math.ceil(w * scale)),
            height = Math.max(1, Math.ceil(h * scale))
        const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
            type: "image/svg+xml",
        })
        const url = URL.createObjectURL(blob)
        try {
            const image = new Image()
            await new Promise<void>((resolve, reject) => {
                image.onload = () => resolve()
                image.onerror = () => reject(Error("Thumbnail unavailable"))
                image.src = url
            })
            const canvas = document.createElement("canvas")
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext("2d")
            if (ctx) {
                ctx.drawImage(image, 0, 0, width, height)
                const png = canvas.toDataURL("image/png")
                if (validManualPreview(png)) symbol.previewPng = png
            }
        } finally {
            URL.revokeObjectURL(url)
        }
    } catch {
        /* Bounded vector preview remains available if native raster export is unavailable. */
    }
    return symbol
}
