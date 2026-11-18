import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { SymbolPreview } from "@/components/workspace/symbol-preview"
import {
    type EmcSymbol,
    symbolLayout,
    validateEmcSymbol,
} from "@/lib/emc-symbols"
import {
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
        const l = symbolLayout(s70)
        expect(l.outline).toEqual(s70.body?.outline)
        expect(l.width / l.height).toBe(1)
        expect(l.labels).toHaveLength(128)
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
