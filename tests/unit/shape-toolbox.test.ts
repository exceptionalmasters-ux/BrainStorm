import { afterEach, describe, expect, it, vi } from "vitest"
import { createShapeToolbox } from "../../lib/drawio/shape-toolbox"

const labels = {
    pin: "Pin",
    close: "Close",
    allLibraries: "All libraries",
    recent: "Recent",
    emptyRecent: "No shapes yet",
}
const controllers: { dispose: () => void }[] = []
afterEach(() => {
    controllers.splice(0).forEach((c) => {
        c.dispose()
    })
    document.body.innerHTML = ""
})
function setup() {
    const container = document.createElement("div")
    document.body.append(container)
    const canvas = document.createElement("div")
    canvas.className = "geDiagramContainer"
    document.body.append(canvas)
    const search = document.createElement("input")
    search.id = "geOmniSearch"
    container.append(search)
    const events: Record<string, (...args: any[]) => void> = {}
    const graph = {
        addListener: vi.fn((name, fn) => {
            events[name] = fn
        }),
        removeListener: vi.fn(),
        cloneCells: vi.fn((cells) => structuredClone(cells)),
        model: { isVertex: (cell: any) => cell.vertex },
    }
    const sidebar = {
        container,
        configuration: [
            "general",
            "arrows2",
            "electrical",
            "flowchart",
            "network",
        ].map((id) => ({ id })),
        showEntries: vi.fn(),
        showPalette: vi.fn(),
        removePalette: vi.fn(),
        addPalette: vi.fn((_id, _title, _expand, fn) => fn(container)),
        addPaletteFunctions: vi.fn(),
        createVertexTemplateFromCells: vi.fn(),
    }
    const shapes = vi.fn(),
        changed = vi.fn()
    const ui = {
        sidebar,
        sidebarContainer: container,
        editor: { graph },
        hsplitPosition: 0,
        diagramContainer: { scrollLeft: 300 },
        showSidebar: vi.fn(() => {
            ui.hsplitPosition = 220
        }),
        isShapesPanelVisible: () => ui.hsplitPosition > 0,
        refresh: vi.fn(),
        actions: { get: () => ({ funct: shapes }) },
    }
    const controller = createShapeToolbox(ui, labels, changed)!
    controllers.push(controller)
    return {
        controller,
        ui,
        sidebar,
        canvas,
        search,
        shapes,
        graph,
        changed,
        events,
    }
}
describe("EMC shape toolbox", () => {
    it("switches groups without persisting a restricted library list and restores native preferences", () => {
        const { controller, sidebar, ui } = setup()
        expect(controller.open("technical", "Technical")).toBe(true)
        expect(sidebar.showEntries).toHaveBeenCalledWith(
            "electrical;pid;pid2;fluid_power;cabinets",
            false,
            true,
        )
        expect(
            document.querySelector(".emc-shape-header strong")?.textContent,
        ).toBe("Technical")
        controller.open("basic", "Basic")
        expect(document.querySelectorAll(".emc-shape-header")).toHaveLength(1)
        controller.close()
        expect(sidebar.showEntries).toHaveBeenLastCalledWith()
        expect(ui.hsplitPosition).toBe(0)
        expect(ui.diagramContainer.scrollLeft).toBe(80)
        expect(document.querySelector(".emc-shape-header")).toBeNull()
    })
    it("closes on canvas input unless pinned; Escape also closes a pinned panel", async () => {
        const { controller, canvas, changed } = setup()
        controller.open("basic", "Basic")
        document
            .querySelector<HTMLButtonElement>(
                '[data-testid="pin-shape-flyout"]',
            )!
            .click()
        canvas.dispatchEvent(new Event("pointerup", { bubbles: true }))
        await Promise.resolve()
        expect(document.querySelector(".emc-shape-header")).not.toBeNull()
        expect(changed).toHaveBeenLastCalledWith("basic", true)
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
        expect(changed).toHaveBeenLastCalledWith(null, true)
        controller.open("basic", "Basic")
        document
            .querySelector<HTMLButtonElement>(
                '[data-testid="pin-shape-flyout"]',
            )!
            .click()
        canvas.dispatchEvent(new Event("pointerup", { bubbles: true }))
        await Promise.resolve()
        expect(document.querySelector(".emc-shape-header")).toBeNull()
    })
    it("uses native search and the complete library chooser", () => {
        const { controller, search, shapes } = setup()
        controller.open("search", "Search")
        expect(document.activeElement).toBe(search)
        expect(controller.catalog()).toBe(true)
        expect(shapes).toHaveBeenCalledTimes(1)
    })
    it("builds recent templates from copies without moving the original cells", () => {
        const { controller, events, sidebar, graph } = setup()
        const cells = [
            { vertex: true, geometry: { x: 120, y: 80 } },
            { vertex: true, geometry: { x: 200, y: 90 } },
        ]
        events.cellsInserted(null, { getProperty: () => cells })
        controller.open("recent", "Recent")
        expect(graph.cloneCells).toHaveBeenCalledWith(cells)
        expect(cells[0].geometry.x).toBe(120)
        const entry = sidebar.addPaletteFunctions.mock.calls[0][3][0]
        entry()
        expect(
            sidebar.createVertexTemplateFromCells.mock.calls[0][0][1].geometry
                .x,
        ).toBe(80)
        controller.dispose()
        controller.dispose()
        expect(graph.removeListener).toHaveBeenCalledTimes(1)
    })
    it("falls back safely when direct editor access is unavailable", () => {
        expect(createShapeToolbox(null, labels, vi.fn())).toBeNull()
        const { controller, sidebar } = setup()
        sidebar.configuration = []
        expect(controller.open("technical", "Technical")).toBe(false)
        expect(sidebar.showEntries).not.toHaveBeenCalled()
    })
})
