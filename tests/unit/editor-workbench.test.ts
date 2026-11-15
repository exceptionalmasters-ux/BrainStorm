import { describe, expect, it, vi } from "vitest"
import {
    invokeEditorAction,
    readEditorAction,
} from "../../lib/drawio/editor-actions"
import { withStableViewport } from "../../lib/drawio/stable-viewport"

describe("stable drawing viewport", () => {
    it("preserves screen coordinates across repeated palette cycles, including zero scroll and zoom changes", () => {
        let width = 0,
            left = 0,
            top = 0
        const view = {
            scale: 1.75,
            translate: { x: 18, y: 35 },
            scaleAndTranslate(scale: number, x: number, y: number) {
                this.scale = scale
                this.translate = { x, y }
            },
        }
        const container = {
            get scrollLeft() {
                return left
            },
            set scrollLeft(value) {
                left = Math.max(0, value)
            },
            get scrollTop() {
                return top
            },
            set scrollTop(value) {
                top = Math.max(0, value)
            },
            getBoundingClientRect: () => ({ left: 52 + width, top: 120 }),
        }
        const ui = { editor: { graph: { view } }, diagramContainer: container }
        const point = () => ({
            x: 52 + width + (200 + view.translate.x) * view.scale - left,
            y: 120 + (150 + view.translate.y) * view.scale - top,
        })
        const initial = point()
        for (let n = 0; n < 8; n++) {
            withStableViewport(ui, () => {
                width = 230
                view.translate.x += 10
                left += width
            })
            expect(point().x).toBeCloseTo(initial.x, 8)
            withStableViewport(ui, () => {
                width = 0
                view.translate.x += 10
                left = 0
            })
            expect(point()).toEqual(initial)
        }
        withStableViewport(ui, () => {
            width = 230
        })
        view.scale = 2.5
        view.translate.x -= 70
        left = 160
        top = 85
        const afterUserZoomAndPan = point()
        withStableViewport(ui, () => {
            width = 0
        })
        expect(point().x).toBeCloseTo(afterUserZoomAndPan.x, 8)
        expect(point().y).toBeCloseTo(afterUserZoomAndPan.y, 8)
        expect(view.scale).toBe(2.5)
    })
    it("still restores the view if a layout command throws", () => {
        const view = {
            scale: 2,
            translate: { x: 5, y: 8 },
            scaleAndTranslate: vi.fn(),
        }
        const ui = {
            editor: { graph: { view } },
            diagramContainer: {
                scrollLeft: 0,
                scrollTop: 0,
                getBoundingClientRect: () => ({ left: 0, top: 0 }),
            },
        }
        expect(() =>
            withStableViewport(ui, () => {
                view.scale = 3
                throw new Error("layout failed")
            }),
        ).toThrow("layout failed")
        expect(view.scaleAndTranslate).toHaveBeenCalledWith(2, 5, 8)
    })
})

describe("native editor command adapter", () => {
    it("does not call the selected callback for a normal action and uses translated labels", () => {
        const normal = {
            label: "undo",
            getTitle: () => "Undo",
            isEnabled: () => true,
            isSelected: () => {
                throw new Error("no selected callback")
            },
            funct: vi.fn(),
        }
        const ui = { actions: { get: () => normal } }
        expect(readEditorAction(ui, "undo")).toEqual({
            enabled: true,
            selected: undefined,
            label: "Undo",
        })
        expect(invokeEditorAction(ui, "undo")).toBe(true)
        expect(normal.funct).toHaveBeenCalledTimes(1)
    })
    it("honours unavailable/disabled actions and reads native checkbox state", () => {
        expect(invokeEditorAction(null, "undo")).toBe(false)
        const action = {
            label: "Grid",
            funct: vi.fn(),
            isEnabled: () => false,
            selectedCallback: () => true,
            isSelected: () => true,
        }
        const ui = { actions: { get: () => action } }
        expect(readEditorAction(ui, "grid").selected).toBe(true)
        expect(invokeEditorAction(ui, "grid")).toBe(false)
        expect(action.funct).not.toHaveBeenCalled()
    })
})
