import { describe, expect, it, vi } from "vitest"
import { insertQuickCell } from "@/lib/drawio/quick-insert"

describe("quick native insertion", () => {
    const setup = () => {
        const geometry = { setTerminalPoint: vi.fn() }
        const cell = { geometry: { clone: () => geometry } }
        const graph = {
            isEnabled: () => true,
            getFreeInsertPoint: () => ({ x: 50, y: 60 }),
            getDefaultParent: () => "layer",
            stopEditing: vi.fn(),
            model: {
                beginUpdate: vi.fn(),
                endUpdate: vi.fn(),
                setGeometry: vi.fn(),
            },
            insertVertex: vi.fn(() => cell),
            insertEdge: vi.fn(() => cell),
            setSelectionCell: vi.fn(),
            scrollCellToVisible: vi.fn(),
            container: { focus: vi.fn() },
        }
        const win = {
            mxPoint: class {
                constructor(
                    public x: number,
                    public y: number,
                ) {}
            },
        }
        return { graph, cell, geometry, win, ui: { editor: { graph } } }
    }
    it("creates a double arrow with free terminal points in one undo transaction", () => {
        const { ui, win, graph, geometry } = setup()
        expect(insertQuickCell(ui, win, "lines", 2)).toBe(true)
        expect(graph.insertEdge.mock.calls[0]).toEqual([
            "layer",
            null,
            "",
            null,
            null,
            expect.stringContaining("endArrow=classic;startArrow=classic;"),
        ])
        expect(geometry.setTerminalPoint.mock.calls).toEqual([
            [{ x: 50, y: 60 }, true],
            [{ x: 210, y: 60 }, false],
        ])
        expect(graph.model.beginUpdate).toHaveBeenCalledOnce()
        expect(graph.model.endUpdate).toHaveBeenCalledOnce()
    })
    it("inserts an editable circle and respects a disabled graph", () => {
        const { ui, win, graph, cell } = setup()
        insertQuickCell(ui, win, "shapes", 3)
        expect(graph.insertVertex.mock.calls[0]).toEqual([
            "layer",
            null,
            "",
            50,
            60,
            100,
            100,
            "ellipse;whiteSpace=wrap;html=1;",
        ])
        expect(graph.setSelectionCell).toHaveBeenCalledWith(cell)
        graph.isEnabled = () => false
        expect(insertQuickCell(ui, win, "shapes", 0)).toBe(false)
        expect(graph.insertVertex).toHaveBeenCalledOnce()
    })
})
