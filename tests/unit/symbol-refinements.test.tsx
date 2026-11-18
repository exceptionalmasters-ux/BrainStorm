import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { SymbolPreview } from "@/components/workspace/symbol-preview"
import { standardSymbolLayout } from "@/lib/emc-standard-layout"
import {
    type EmcSymbol,
    symbolLayout,
    validateEmcSymbol,
} from "@/lib/emc-symbols"
import {
    captureManualSymbol,
    insertManualSymbolNative,
    type ManualSymbol,
    safeManualStyle,
    validateManualSymbol,
} from "@/lib/manual-symbol"

const sourceUrl = "https://example.com/s70.pdf"
const s70: EmcSymbol = {
    name: "SAM S70",
    device: "SAM S70",
    package: "LQFP-64",
    body: {
        width: 400,
        height: 400,
        labelsInside: true,
        view: "top",
        outline: [
            [0.06, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0.06],
        ],
        pin1: { x: 0.08, y: 0.08 },
    },
    pins: Array.from({ length: 64 }, (_, i) => ({
        number: String(i + 1),
        name: i === 38 ? "PB7 (SWCLK)" : "PD" + i,
        side: (["left", "bottom", "right", "top"] as const)[Math.floor(i / 16)],
        position: 0.09 + (i % 16) * 0.054,
        sourceUrl,
        evidence: "Source figure top view",
    })),
}
describe("source geometry", () => {
    it("retains a chamfer and pin-1 marker, separates numbers/names and reserves label corridors", () => {
        expect(validateEmcSymbol(s70)).toBe(true)
        const l = standardSymbolLayout(s70)
        expect(l.outline).toEqual(s70.body?.outline)
        expect(l.bodyFrame.width / l.bodyFrame.height).toBe(1)
        expect(l.labels).toHaveLength(128)
        expect(l.pitch).toBe(20)
        for (const pin of l.pins) {
            expect((pin.x * l.width) % 10).toBeCloseTo(0)
            expect((pin.y * l.height) % 10).toBeCloseTo(0)
        }
        // Each rotated text has a conservative bounding rectangle. No two labels may collide.
        const bounds = l.labels.map((v) => {
            const vert = v.rotation !== 0,
                x = vert
                    ? v.x - 7
                    : v.x -
                      (v.anchor === "middle"
                          ? v.width / 2
                          : v.anchor === "end"
                            ? v.width
                            : 0),
                y = vert ? v.y - (v.rotation === 270 ? v.width : 0) : v.y - 7
            return { x, y, w: vert ? 14 : v.width, h: vert ? v.width : 14 }
        })
        const dot = {
            x: l.bodyFrame.x + 0.08 * l.bodyFrame.width,
            y: l.bodyFrame.y + 0.08 * l.bodyFrame.height,
        }
        for (const b of bounds)
            expect(
                dot.x + 4 <= b.x ||
                    dot.x - 4 >= b.x + b.w ||
                    dot.y + 4 <= b.y ||
                    dot.y - 4 >= b.y + b.h,
            ).toBe(true)
        for (let i = 0; i < bounds.length; i++) {
            const a = bounds[i]
            for (const b of bounds.slice(i + 1)) {
                expect(
                    a.x + a.w <= b.x ||
                        b.x + b.w <= a.x ||
                        a.y + a.h <= b.y ||
                        b.y + b.h <= a.y,
                ).toBe(true)
            }
        }
        const svg = renderToStaticMarkup(<SymbolPreview symbol={s70} compact />)
        expect(svg).toContain('preserveAspectRatio="xMidYMid meet"')
        expect(svg).toContain("polygon")
        expect(svg).toContain("PB7 (SWCLK)")
    })
    it("does not explode near a corner and preserves HC-05 aspect ratio across density presets", () => {
        const module: EmcSymbol = {
            ...s70,
            name: "HC-05",
            device: "HC-05",
            package: "Bare module",
            body: { width: 160, height: (160 * 27) / 12.7, labelsInside: true },
            pins: Array.from({ length: 34 }, (_, i) => ({
                number: String(i + 1),
                name: i === 0 ? "UART_TX" : "PIO" + i,
                side: i < 13 ? "left" : i < 21 ? "bottom" : "right",
                position:
                    i < 13
                        ? 0.02 + i * 0.07
                        : i < 21
                          ? 0.06 + (i - 13) * 0.12
                          : 0.02 + (i - 21) * 0.07,
                sourceUrl,
                evidence: "PDF page 2 drawing, pages 3–4 pin table",
            })),
        }
        const standard = standardSymbolLayout(module)
        expect(
            standard.bodyFrame.width / standard.bodyFrame.height,
        ).toBeCloseTo(12.7 / 27)
        expect(standard.width).toBeLessThan(500)
        expect(standard.height).toBeLessThan(1000)
        expect(standard.pins).toHaveLength(34)
        expect(standard.pins[0].sourceY).toBeCloseTo(
            standard.bodyFrame.y + 0.02 * standard.bodyFrame.height,
        )
        const compact = standardSymbolLayout({
            ...module,
            body: { ...module.body!, density: "compact" },
        })
        const spacious = standardSymbolLayout({
            ...module,
            body: { ...module.body!, density: "spacious" },
        })
        expect(compact.fontSize).toBe(10)
        expect(spacious.pitch).toBe(30)
        expect(compact.height).toBeLessThanOrEqual(standard.height)
        expect(spacious.height).toBeGreaterThan(standard.height)
    })
    it("rejects invalid source polygons before rendering", () => {
        expect(
            validateEmcSymbol({
                ...s70,
                body: {
                    ...s70.body,
                    outline: [
                        [0, 0],
                        [1, 1],
                        [2, 0],
                    ],
                },
            }),
        ).toBe(false)
    })
})
const manual: ManualSymbol = {
    kind: "manual",
    name: "Circuit",
    device: "Circuit",
    package: "Manual drawing",
    width: 100,
    height: 80,
    cells: [
        {
            parent: null,
            vertex: true,
            edge: false,
            value: "A",
            style: "shape=ellipse;html=0;fillColor=#ffffff;points=[[0.5,0.5,0]];",
            connectable: true,
            geometry: { x: 0, y: 0, width: 20, height: 20, relative: false },
        },
        {
            parent: null,
            vertex: false,
            edge: true,
            value: "",
            style: "endArrow=classic;html=0;",
            connectable: true,
            source: 0,
            geometry: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                relative: true,
                targetPoint: { x: 100, y: 80 },
            },
        },
    ],
}
describe("manual symbols", () => {
    it("accepts editable cells, center port constraints, wire terminals and pencil vectors", () => {
        expect(validateManualSymbol(manual)).toBe(true)
        expect(
            validateManualSymbol({
                ...manual,
                cells: [
                    {
                        ...manual.cells[0],
                        freehand: [
                            [
                                { x: 0, y: 0 },
                                { x: 100, y: 100 },
                            ],
                        ],
                    },
                ],
            }),
        ).toBe(true)
    })
    it("rejects parent cycles, external terminals, excessive geometry and unsafe styles", () => {
        for (const change of [
            { parent: 0 },
            { source: 99 },
            { style: "shape=image;image=https://evil.example;" },
            { style: "html=1;" },
            { geometry: { ...manual.cells[0].geometry, x: Infinity } },
        ])
            expect(
                validateManualSymbol({
                    ...manual,
                    cells: [{ ...manual.cells[0], ...change }],
                }),
            ).toBe(false)
        expect(safeManualStyle("fillColor=url(javascript:alert(1));")).toBe(
            false,
        )
    })
})

it("captures resolved native function styles and reinserts the original internal terminals", () => {
    const a: any = {
            vertex: true,
            value: "A",
            style: "",
            isConnectable: () => true,
        },
        b: any = {
            vertex: true,
            value: "B",
            style: "",
            isConnectable: () => true,
        },
        edge: any = {
            edge: true,
            value: "Wire",
            style: "",
            source: a,
            target: b,
            isConnectable: () => true,
        }
    const cells = [a, b, edge],
        perimeter = () => null
    for (const [i, c] of cells.entries())
        c.geometry = {
            x: 100 + i * 100,
            y: 80,
            width: c.edge ? 0 : 40,
            height: c.edge ? 0 : 20,
            relative: !!c.edge,
            clone() {
                return { ...this }
            },
        }
    const model: any = {
        getTopmostCells: (c: any) => c,
        getChildCount: () => 0,
        getParent: () => null,
        getTerminal: (c: any, start: boolean) => (start ? c.source : c.target),
    }
    const graph: any = {
        model,
        getSelectionCells: () => cells,
        getBoundingBoxFromGeometry: () => ({
            x: 100,
            y: 80,
            width: 240,
            height: 20,
        }),
        getCellStyle: (c: any) =>
            c.edge
                ? { edgeStyle: perimeter, endArrow: "classic" }
                : { shape: "label", perimeter, fillColor: "#ffffff" },
    }
    const win: any = {
        mxStyleRegistry: { getName: () => "rectanglePerimeter" },
        mxUtils: { getTextContent: () => "" },
    }
    const result = captureManualSymbol({ editor: { graph } }, win)
    expect(result.cells[0].style).toContain("perimeter=rectanglePerimeter")
    expect(result.cells[0].geometry.x).toBe(0)
    expect(result.cells[1].geometry.x).toBe(100)
    expect(result.cells[2].source).toBe(0)
    expect(result.cells[2].target).toBe(1)
    const inserted: any[] = [],
        bindings: any[] = []
    win.mxGeometry = class {
        constructor(
            public x: number,
            public y: number,
            public width: number,
            public height: number,
        ) {}
    }
    win.mxCell = class {
        constructor(
            public value: string,
            public geometry: any,
            public style: string,
        ) {}
        setVertex(v: boolean) {}
        setEdge(v: boolean) {}
        setConnectable(v: boolean) {}
    }
    Object.assign(model, {
        beginUpdate: () => {},
        endUpdate: () => {},
        setTerminal: (c: any, t: any, source: boolean) =>
            bindings.push([c, t, source]),
    })
    Object.assign(graph, {
        isEnabled: () => true,
        getFreeInsertPoint: () => ({ x: 0, y: 0 }),
        getDefaultParent: () => null,
        stopEditing: () => {},
        insertVertex: () => ({ setConnectable: () => {} }),
        addCell: (c: any) => inserted.push(c),
        setSelectionCell: () => {},
        scrollCellToVisible: () => {},
    })
    expect(insertManualSymbolNative({ editor: { graph } }, win, result)).toBe(
        true,
    )
    expect(bindings).toEqual([
        [inserted[2], inserted[0], true],
        [inserted[2], inserted[1], false],
    ])
})
