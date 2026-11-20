import { describe, expect, it, vi } from "vitest"
import { createWhiteboardTools } from "@/lib/drawio/whiteboard-tools"

describe("shared presenter camera", () => {
    it("uses the translation draw.io produces during scale validation", () => {
        const container = {
            clientWidth: 600,
            clientHeight: 400,
            scrollLeft: 80,
            scrollTop: 90,
            getBoundingClientRect: () => ({ x: 0, y: 0 }),
        }
        const view = {
            scale: 1,
            translate: { x: 20, y: 30 },
            setScale(scale: number) {
                this.scale = scale
                this.translate = { x: 900, y: 700 }
            },
            scaleAndTranslate: vi.fn(),
        }
        const graph = { container, view, scrollbars: true }
        const ui = {
            editor: { graph },
            currentPage: { getId: () => "page" },
            getPageById: () => undefined,
        }
        const tools = createWhiteboardTools(ui, {
            frameElement: { getBoundingClientRect: () => ({ x: 0, y: 0 }) },
        })
        const target = {
            pageId: "page",
            scale: 1.5,
            center: { x: 240, y: 180 },
        }
        tools.applyView(target)
        expect(tools.readView()).toEqual(target)
        expect(view.scaleAndTranslate).not.toHaveBeenCalled()
        // Repeated state broadcasts do not drift or return to scroll origin.
        tools.applyView(target)
        expect(tools.readView()).toEqual(target)
        container.clientWidth = 320
        container.clientHeight = 500
        tools.applyView(target)
        expect(tools.readView()).toEqual(target)
    })
    it("positions a canvas without scrollbars directly", () => {
        const container = {
            clientWidth: 400,
            clientHeight: 300,
            scrollLeft: 0,
            scrollTop: 0,
            getBoundingClientRect: () => ({ x: 0, y: 0 }),
        }
        const view = {
            scale: 1,
            translate: { x: 0, y: 0 },
            scaleAndTranslate(scale: number, x: number, y: number) {
                this.scale = scale
                this.translate = { x, y }
            },
        }
        const tools = createWhiteboardTools(
            {
                editor: { graph: { container, view, scrollbars: false } },
                currentPage: { getId: () => "page" },
            },
            { frameElement: { getBoundingClientRect: () => ({ x: 0, y: 0 }) } },
        )
        const target = { pageId: "page", scale: 2, center: { x: 300, y: 400 } }
        tools.applyView(target)
        expect(tools.readView()).toEqual(target)
    })
})

it("centres the white page within the available viewport without changing zoom", () => {
    const container = {
        clientWidth: 600,
        clientHeight: 400,
        scrollLeft: 0,
        scrollTop: 0,
    }
    const view = {
        scale: 0.75,
        translate: { x: 0, y: 0 },
        backgroundPageShape: {
            bounds: { x: 400, y: 200, width: 800, height: 1000 },
        },
    }
    const tools = createWhiteboardTools(
        {
            editor: { graph: { container, view, scrollbars: true } },
            resetScrollbars: vi.fn(),
        },
        {},
    )
    expect(tools.centerPage()).toBe(true)
    expect(container.scrollLeft).toBe(500)
    expect(container.scrollTop).toBe(500)
    expect(view.scale).toBe(0.75)
})
