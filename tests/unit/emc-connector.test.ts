import { describe, expect, it } from "vitest"
import {
    connectorStyle,
    installEmcConnector,
    snapConnectorRoute,
} from "@/lib/drawio/emc-connector"

describe("EMC wires", () => {
    it("routes in document units at any zoom and preserves fixed endpoints", () => {
        for (const scale of [0.5, 1, 2]) {
            const translate = { x: 13, y: 7 },
                points = [
                    { x: 17, y: 23 },
                    { x: 53, y: 23 },
                    { x: 53, y: 88 },
                    { x: 119, y: 88 },
                ].map((p) => ({ x: (p.x + 13) * scale, y: (p.y + 7) * scale }))
            const route = snapConnectorRoute(points, scale, translate)
            expect(route[0]).toEqual(points[0])
            expect(route.at(-1)).toEqual(points.at(-1))
            route.slice(1).forEach((p, i) => {
                expect(p.x === route[i].x || p.y === route[i].y).toBe(true)
            })
            expect((route[1].x / scale - 13) % 10).toBe(0)
        }
    })
    it("stores native orthogonal edges with arc jumps and four arrow modes", () => {
        for (const ends of ["none", "start", "end", "both"] as const) {
            const style = connectorStyle(ends)
            expect(style).toContain("edgeStyle=orthogonalEdgeStyle;")
            expect(style).toContain("jumpStyle=arc;")
            expect(style).toContain(
                `startArrow=${ends === "start" || ends === "both" ? "classic" : "none"};`,
            )
            expect(style).toContain(
                `endArrow=${ends === "end" || ends === "both" ? "classic" : "none"};`,
            )
        }
    })
    it("requires real fixed constraints, blocks dangling reconnects, and restores native behaviour", () => {
        const fixed = { point: { x: 0.5, y: 0.5 }, perimeter: false },
            cell = { style: "port" },
            edge = { style: "emcWire=1;" },
            listeners = new Set<() => void>()
        let connections = 0,
            enabled = true
        const handler: any = {
            reset() {},
            waypointsEnabled: true,
            isStartEvent: () => true,
            createEdgeState: () => null,
            isCreateTarget: () => true,
            isOutlineConnectEvent: () => true,
            connect() {
                connections++
            },
            constraintHandler: {
                currentFocus: { cell },
                currentConstraint: fixed,
            },
            sourceConstraint: fixed,
        }
        const graph: any = {
            connectionHandler: handler,
            container: { style: { cursor: "" }, focus() {} },
            gridEnabled: false,
            gridSize: 5,
            isConnectable: () => enabled,
            setConnectable: (v: boolean) => (enabled = v),
            setGridEnabled(v: boolean) {
                this.gridEnabled = v
            },
            model: { isEdge: () => false },
            view: {
                getState: () => ({}),
                updatePoints() {},
                scale: 1,
                translate: { x: 0, y: 0 },
            },
            isCellConnectable: () => true,
            getAllConnectionConstraints: () => [fixed],
            getEdgeValidationError: () => null,
            connectCell: () => {
                connections++
            },
            addListener: (_: string, f: () => void) => listeners.add(f),
            removeListener: (f: () => void) => listeners.delete(f),
        }
        const original = handler.connect,
            tool = installEmcConnector(
                { editor: { graph } },
                {
                    mxCellState: class {},
                    mxPoint: class {},
                    mxEvent: { ESCAPE: "escape" },
                },
                () => true,
                () => {},
            )!
        const unfinished = {
            style: { emcWire: 1 },
            absolutePoints: [null, { x: 10, y: 20 }, null],
        }
        expect(() => graph.view.updatePoints(unfinished)).not.toThrow()
        expect(unfinished.absolutePoints[0]).toBeNull()
        expect(unfinished.absolutePoints[2]).toBeNull()
        tool.setActive(true)
        expect(graph.gridSize).toBe(10)
        handler.connect(cell, cell)
        expect(connections).toBe(1)
        handler.constraintHandler.currentConstraint = {
            point: { x: 0.2, y: 0.5 },
            perimeter: false,
        }
        handler.connect(cell, cell)
        expect(connections).toBe(1)
        graph.connectCell(edge, null, false, null)
        expect(connections).toBe(1)
        expect(graph.getEdgeValidationError(edge, cell, null)).toMatch(
            /both ends/,
        )
        tool.dispose()
        expect(handler.connect).toBe(original)
        expect(graph.gridSize).toBe(5)
        expect(graph.gridEnabled).toBe(false)
        expect(listeners.size).toBe(0)
    })
})

it("connects by two touch taps or dragging, cancels on blank space, and preserves exact anchors", () => {
    const listeners = new Map<string, any>(),
        edges: any[] = [],
        constraints: any[] = []
    const cells = [{ id: "a" }, { id: "b" }],
        pin = { point: { x: 0.5, y: 0.5 }, perimeter: false }
    const container: any = {
        style: {},
        scrollLeft: 0,
        scrollTop: 0,
        focus() {},
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
        addEventListener: (n: string, f: any) => listeners.set(n, f),
        removeEventListener: (n: string) => listeners.delete(n),
        setPointerCapture() {},
        releasePointerCapture() {},
    }
    const graph: any = {
        container,
        connectionHandler: {
            reset() {},
            isStartEvent() {},
            createEdgeState() {},
            isCreateTarget() {},
            isOutlineConnectEvent() {},
            connect() {},
            constraintHandler: {},
        },
        model: { cells, isEdge: () => false, beginUpdate() {}, endUpdate() {} },
        view: {
            getState: (cell: any) => ({ cell }),
            updatePoints() {},
            scale: 1,
            translate: { x: 0, y: 0 },
        },
        isCellConnectable: () => true,
        getAllConnectionConstraints: () => [pin],
        getConnectionPoint: (s: any) => ({
            x: s.cell === cells[0] ? 100 : 200,
            y: 100,
        }),
        isConnectable: () => true,
        setConnectable() {},
        setGridEnabled() {},
        connectCell() {},
        getEdgeValidationError() {},
        addListener() {},
        removeListener() {},
        getDefaultParent: () => null,
        insertEdge: (...args: any[]) => {
            const edge = { args }
            edges.push(edge)
            return edge
        },
        setConnectionConstraint: (...args: any[]) => constraints.push(args),
        setSelectionCell() {},
    }
    const marker = { style: {}, setAttribute() {}, remove() {} }
    const tool = installEmcConnector(
        { editor: { graph } },
        {
            mxCellState: class {},
            mxPoint: class {},
            mxEvent: { ESCAPE: "escape" },
            document: {
                createElement: () => marker,
                body: { appendChild() {} },
            },
        },
        () => true,
        () => {},
    )!
    tool.setActive(true)
    const event = (x: number, y: number) => ({
        clientX: x,
        clientY: y,
        pointerId: 1,
        pointerType: "touch",
        button: 0,
        preventDefault() {},
        stopImmediatePropagation() {},
    })
    const tap = (x: number, y: number) => {
        listeners.get("pointerdown")(event(x, y))
        listeners.get("pointerup")(event(x, y))
    }
    tap(118, 100)
    expect(edges).toHaveLength(0)
    tap(218, 100)
    expect(edges).toHaveLength(1)
    expect(constraints[0][3]).toBe(pin)
    expect(constraints[1][3]).toBe(pin)
    tap(100, 100)
    tap(400, 400)
    tap(200, 100)
    expect(edges).toHaveLength(1)
    tap(100, 100)
    expect(edges).toHaveLength(2)
    listeners.get("pointerdown")(event(100, 100))
    listeners.get("pointermove")(event(190, 100))
    listeners.get("pointerup")(event(200, 100))
    expect(edges).toHaveLength(3)
    tool.dispose()
    expect(listeners.size).toBe(0)
    expect(container.style.touchAction).toBeUndefined()
})
