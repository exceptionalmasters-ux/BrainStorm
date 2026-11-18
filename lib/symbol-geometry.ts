/** Normalised source geometry: only bounded numeric vectors, never remote XML/SVG. */
export type SymbolBody = {
    width: number
    height: number
    antennaHeight?: number
    outline?: [number, number][]
    pin1?: { x: number; y: number }
    labelsInside?: boolean
    view?: "top" | "bottom" | "unspecified"
}
export function validSymbolBody(b: unknown): boolean {
    if (b === undefined) return true
    if (!b || typeof b !== "object") return false
    const d = b as SymbolBody
    const unit = (n: unknown) =>
        typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1
    return (
        Number.isFinite(d.width) &&
        d.width >= 160 &&
        d.width <= 800 &&
        Number.isFinite(d.height) &&
        d.height >= 160 &&
        d.height <= 1000 &&
        (d.antennaHeight === undefined ||
            (unit(d.antennaHeight) && d.antennaHeight <= 0.5)) &&
        (d.labelsInside === undefined || typeof d.labelsInside === "boolean") &&
        (d.view === undefined ||
            ["top", "bottom", "unspecified"].includes(d.view)) &&
        (d.pin1 === undefined ||
            (!!d.pin1 && unit(d.pin1.x) && unit(d.pin1.y))) &&
        (d.outline === undefined ||
            (Array.isArray(d.outline) &&
                d.outline.length >= 3 &&
                d.outline.length <= 24 &&
                d.outline.every(
                    (p) => Array.isArray(p) && p.length === 2 && p.every(unit),
                ) &&
                Math.abs(
                    d.outline.reduce(
                        (sum, p, i, ps) =>
                            sum +
                            p[0] * ps[(i + 1) % ps.length][1] -
                            p[1] * ps[(i + 1) % ps.length][0],
                        0,
                    ),
                ) > 0.01))
    )
}

/** Reject coincident ports instead of drawing false shared electrical anchors. */
export function distinctPinPositions(
    pins: { side: string; position?: number }[],
): boolean {
    for (const side of ["left", "right", "top", "bottom"]) {
        const group = pins.filter((p) => p?.side === side)
        const values = group
            .map((p, i) => p.position ?? (i + 1) / (group.length + 1))
            .sort((a, b) => a - b)
        if (values.some((v, i) => i > 0 && v - values[i - 1] < 0.003))
            return false
    }
    return true
}
