import { describe, expect, it, vi } from "vitest"
import { showEditorMenu, showFormatTab } from "@/lib/drawio/format-tools"

describe("native format tools", () => {
    it("opens the panel and selects translated native tabs without changing the diagram", () => {
        const container = document.createElement("div")
        const clicked: string[] = []
        for (const title of ["Styl", "Tekst", "Rozmieszczenie"]) {
            const label = document.createElement("div")
            label.className = "geFormatTitle"
            label.title = title
            label.onclick = () => {
                clicked.push(title)
            }
            container.append(label)
        }
        let visible = false
        const action = {
            funct: vi.fn(() => {
                visible = true
            }),
            isEnabled: () => true,
        }
        const ui = {
            editor: { graph: { isSelectionEmpty: () => false } },
            isFormatPanelVisible: () => visible,
            actions: { get: () => action },
            format: { container, immediateRefresh: vi.fn() },
        }
        const resources = {
            get: (key: string) =>
                ({ style: "Styl", text: "Tekst", arrange: "Rozmieszczenie" })[
                    key
                ],
        }
        for (const tab of ["style", "text", "arrange"] as const)
            expect(showFormatTab(ui, resources, tab)).toBe(true)
        expect(clicked).toEqual(["Styl", "Tekst", "Rozmieszczenie"])
        expect(action.funct).toHaveBeenCalledTimes(1)
    })
    it("requires a selection for text/arrangement and honours disabled native panel actions", () => {
        const action = { funct: vi.fn(), isEnabled: () => false }
        const ui = {
            editor: { graph: { isSelectionEmpty: () => true } },
            actions: { get: () => action },
        }
        expect(showFormatTab(ui, null, "text")).toBe(false)
        expect(showFormatTab(ui, null, "arrange")).toBe(false)
        expect(showFormatTab(ui, null, "style")).toBe(false)
        expect(action.funct).not.toHaveBeenCalled()
        expect(showFormatTab(null, null, "style")).toBe(false)
    })
    it("delegates insertion and connector menus to draw.io with native popup coordinates", () => {
        const native = { funct: vi.fn(), isEnabled: () => true }
        const ui = {
            menus: { get: () => native },
            hideCurrentMenu: vi.fn(),
            showPopupMenu: vi.fn(),
        }
        expect(showEditorMenu(ui, "edgeStyle", { x: 30, y: 0 })).toBe(true)
        const [populate, x, y] = ui.showPopupMenu.mock.calls[0]
        populate("popup", "parent")
        expect(native.funct).toHaveBeenCalledWith("popup", "parent")
        expect([x, y]).toEqual([30, 0])
        native.isEnabled = () => false
        expect(showEditorMenu(ui, "edgeStyle", { x: 0, y: 0 })).toBe(false)
        expect(showEditorMenu(null, "insert", { x: 0, y: 0 })).toBe(false)
    })
})
