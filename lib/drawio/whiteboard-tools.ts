import {
    type BoardPoint,
    type BoardStroke,
    type BoardView,
    validBoardView,
} from "@/lib/shared-board"

export function createWhiteboardTools(ui: any, win: any) {
    const graph = ui.editor.graph
    const viewport = () => {
        const frame = win.frameElement.getBoundingClientRect(),
            rect = graph.container.getBoundingClientRect(),
            g = graph.container
        return {
            x: frame.x + rect.x,
            y: frame.y + rect.y,
            width: g.clientWidth,
            height: g.clientHeight,
            scale: graph.view.scale,
            translate: { x: graph.view.translate.x, y: graph.view.translate.y },
            scroll: { x: g.scrollLeft, y: g.scrollTop },
            pageId: String(ui.currentPage?.getId?.() || ""),
        }
    }
    const readView = (): BoardView => {
        const v = viewport()
        return {
            pageId: v.pageId,
            scale: v.scale,
            center: {
                x: (v.scroll.x + v.width / 2) / v.scale - v.translate.x,
                y: (v.scroll.y + v.height / 2) / v.scale - v.translate.y,
            },
        }
    }
    const toDocument = (p: BoardPoint) => {
        const v = viewport()
        return {
            x: (p.x - v.x + v.scroll.x) / v.scale - v.translate.x,
            y: (p.y - v.y + v.scroll.y) / v.scale - v.translate.y,
        }
    }
    const setEditable = (editable: boolean) => {
        if (graph.isEnabled() !== editable) graph.escape()
        graph.setEnabled(editable)
        if (graph.panningHandler) {
            graph.panningHandler.useLeftButtonForPanning = !editable
            graph.panningHandler.ignoreCell = !editable
        }
    }
    return {
        viewport,
        readView,
        toDocument,
        setEditable,
        applyView: (view: BoardView) => {
            if (!validBoardView(view)) return
            const page = ui.getPageById?.(view.pageId)
            if (page && page !== ui.currentPage) ui.selectPage(page, true)
            const container = graph.container
            if (graph.scrollbars === false) {
                graph.view.scaleAndTranslate(
                    view.scale,
                    container.clientWidth / (2 * view.scale) - view.center.x,
                    container.clientHeight / (2 * view.scale) - view.center.y,
                )
            } else {
                // draw.io owns the page translation and can change it while
                // validating scale. Position the scrollbars using that final
                // translation instead of resetting them to the page origin.
                graph.view.setScale(view.scale)
                const translate = graph.view.translate
                container.scrollLeft =
                    (view.center.x + translate.x) * view.scale -
                    container.clientWidth / 2
                container.scrollTop =
                    (view.center.y + translate.y) * view.scale -
                    container.clientHeight / 2
            }
        },
        exportAnnotated: (strokes: BoardStroke[]) => {
            const bounds = graph.getGraphBounds(),
                scale = graph.view.scale,
                tr = graph.view.translate,
                border = 10
            const svg = graph.getSvg(
                "#ffffff",
                1,
                border,
                false,
                true,
                true,
                true,
            )
            const ns = "http://www.w3.org/2000/svg",
                g = svg.ownerDocument.createElementNS(ns, "g")
            let minX = 0,
                minY = 0,
                maxX = Number(svg.getAttribute("width")) || 1,
                maxY = Number(svg.getAttribute("height")) || 1
            for (const stroke of strokes.filter(
                (s) => s.pageId === readView().pageId,
            )) {
                const points = stroke.points.map((p) => ({
                    x: p.x + tr.x - bounds.x / scale + border,
                    y: p.y + tr.y - bounds.y / scale + border,
                }))
                const path = svg.ownerDocument.createElementNS(ns, "path")
                path.setAttribute(
                    "d",
                    points
                        .map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`)
                        .join(" "),
                )
                path.setAttribute("fill", "none")
                path.setAttribute(
                    "stroke",
                    stroke.kind === "highlight" ? "#fbbf24" : "#e11d48",
                )
                path.setAttribute(
                    "stroke-width",
                    stroke.kind === "highlight" ? "14" : "2",
                )
                path.setAttribute(
                    "stroke-opacity",
                    stroke.kind === "highlight" ? "0.35" : "1",
                )
                path.setAttribute("stroke-linecap", "round")
                path.setAttribute("stroke-linejoin", "round")
                g.appendChild(path)
                for (const p of points) {
                    minX = Math.min(minX, p.x - 8)
                    minY = Math.min(minY, p.y - 8)
                    maxX = Math.max(maxX, p.x + 8)
                    maxY = Math.max(maxY, p.y + 8)
                }
            }
            svg.appendChild(g)
            svg.setAttribute(
                "viewBox",
                `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
            )
            svg.setAttribute("width", String(maxX - minX))
            svg.setAttribute("height", String(maxY - minY))
            const background = svg.querySelector(":scope > rect")
            if (background) {
                background.setAttribute("x", String(minX))
                background.setAttribute("y", String(minY))
                background.setAttribute("width", String(maxX - minX))
                background.setAttribute("height", String(maxY - minY))
            }
            return new win.XMLSerializer().serializeToString(svg)
        },
    }
}
