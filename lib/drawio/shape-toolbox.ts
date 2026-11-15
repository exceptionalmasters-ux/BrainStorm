/** Adapter for the pinned draw.io editor. Shape DOM and drag handlers stay in its own document. */
export const SHAPE_GROUPS = {
    basic: "general;basic",
    arrows: "arrows2",
    diagrams: "flowchart;uml;uml25;bpmn2;er",
    technical: "electrical;pid;pid2;fluid_power;cabinets",
    network: "network;network2;cisco19;aws4;azure2;kubernetes",
    search: null,
    recent: "",
} as const
export type ShapeGroup = keyof typeof SHAPE_GROUPS

export interface ToolboxLabels {
    pin: string
    close: string
    allLibraries: string
    recent: string
    emptyRecent: string
}

export function createShapeToolbox(
    ui: any,
    labels: ToolboxLabels,
    onChange: (group: ShapeGroup | null, pinned: boolean) => void,
) {
    if (
        !ui?.sidebar?.showEntries ||
        !ui.sidebar?.container?.ownerDocument ||
        !ui.showSidebar ||
        !ui.isShapesPanelVisible
    )
        return null
    const sidebar = ui.sidebar,
        doc: Document = ui.sidebar.container.ownerDocument
    let active: ShapeGroup | null = null,
        pinned = false,
        disposed = false
    const recent: any[] = []
    let header: HTMLElement | null = null
    const changed = () => onChange(active, pinned)
    const close = () => {
        if (!active) return
        active = null
        header?.remove()
        header = null
        doc.body.classList.remove("emc-shape-flyout")
        sidebar.showEntries()
        if (ui.sidebarWindow?.window) ui.sidebarWindow.window.setVisible(false)
        else {
            ui.hsplitPosition = 0
            ui.refresh()
        }
        changed()
    }
    const catalog = () => {
        const action = ui.actions?.get?.("shapes")
        if (typeof action?.funct !== "function") return false
        action.funct()
        return true
    }
    const buildHeader = (title: string) => {
        header?.remove()
        header = doc.createElement("div")
        header.className = "emc-shape-header"
        header.dataset.testid = "shape-flyout-header"
        const heading = doc.createElement("strong")
        heading.textContent = title
        header.append(heading)
        const button = (
            text: string,
            title: string,
            run: () => void,
            testId: string,
        ) => {
            const el = doc.createElement("button")
            el.type = "button"
            el.textContent = text
            el.title = title
            el.setAttribute("aria-label", title)
            el.dataset.testid = testId
            el.addEventListener("click", run)
            header?.append(el)
            return el
        }
        const pin = button(
            "◇",
            labels.pin,
            () => {
                pinned = !pinned
                pin.setAttribute("aria-pressed", String(pinned))
                changed()
            },
            "pin-shape-flyout",
        )
        pin.setAttribute("aria-pressed", String(pinned))
        button("⋯", labels.allLibraries, catalog, "all-shape-libraries")
        button("×", labels.close, close, "close-shape-flyout")
        sidebar.container.prepend(header)
    }
    const showRecent = () => {
        sidebar.removePalette?.("emcRecent")
        if (
            recent.length &&
            typeof sidebar.addPaletteFunctions === "function"
        ) {
            sidebar.addPaletteFunctions(
                "emcRecent",
                labels.recent,
                true,
                recent.map(
                    (cells) => () =>
                        sidebar.createVertexTemplateFromCells(
                            cells,
                            100,
                            60,
                            labels.recent,
                        ),
                ),
            )
        } else {
            sidebar.addPalette?.(
                "emcRecent",
                labels.recent,
                true,
                (container: HTMLElement) => {
                    const p = doc.createElement("p")
                    p.className = "emc-shape-empty"
                    p.textContent = labels.emptyRecent
                    container.append(p)
                },
            )
        }
        sidebar.showPalette?.("emcRecent", true)
    }
    const open = (group: ShapeGroup, title: string) => {
        if (disposed) return false
        const entries = SHAPE_GROUPS[group]
        // Unsupported API changes leave draw.io's original tools available.
        if (
            entries &&
            !entries
                .split(";")
                .some((id) =>
                    sidebar.configuration?.some(
                        (entry: any) => entry.id === id,
                    ),
                )
        )
            return false
        active = group
        sidebar.showEntries(entries ?? undefined, false, true)
        sidebar.showPalette?.("emcRecent", false)
        sidebar.showPalette?.("search", true)
        if (group === "recent") showRecent()
        ui.showSidebar()
        doc.body.classList.add("emc-shape-flyout")
        buildHeader(title)
        sidebar.container.scrollTop = 0
        changed()
        if (group === "search") doc.getElementById("geOmniSearch")?.focus()
        return true
    }
    const pointer = (event: Event) => {
        const target = event.target as Element | null
        if (active && !pinned && target?.closest?.(".geDiagramContainer"))
            queueMicrotask(() => {
                if (active && !pinned && !disposed) close()
            })
    }
    const key = (event: KeyboardEvent) => {
        if (
            active &&
            event.key === "Escape" &&
            !Array.from(
                doc.querySelectorAll<HTMLElement>(".geDialog,.mxPopupMenu"),
            ).some(
                (element) =>
                    element.offsetWidth > 0 && element.offsetHeight > 0,
            )
        ) {
            close()
            event.preventDefault()
        }
    }
    const inserted = (_: unknown, event: any) => {
        const cells = event.getProperty?.("cells")
        const graph = ui.editor?.graph
        if (
            !cells?.length ||
            !graph?.cloneCells ||
            !cells.some((cell: any) => graph.model?.isVertex?.(cell))
        )
            return
        // Kept only in this open editor; never written to storage or sent to a server.
        const copy = graph.cloneCells(cells)
        const positioned = copy.filter(
            (cell: any) => cell.geometry && !cell.geometry.relative,
        )
        const minX = Math.min(
                ...positioned.map((cell: any) => cell.geometry.x),
            ),
            minY = Math.min(...positioned.map((cell: any) => cell.geometry.y))
        for (const cell of positioned) {
            cell.geometry.x -= minX
            cell.geometry.y -= minY
        }
        recent.unshift(copy)
        recent.splice(12)
        if (active === "recent")
            queueMicrotask(() => {
                if (active === "recent" && !disposed) showRecent()
            })
    }
    doc.addEventListener("pointerup", pointer)
    doc.addEventListener("keydown", key)
    ui.editor?.graph?.addListener?.("cellsInserted", inserted)
    return {
        open,
        close,
        catalog,
        dispose() {
            if (disposed) return
            close()
            disposed = true
            doc.removeEventListener("pointerup", pointer)
            doc.removeEventListener("keydown", key)
            ui.editor?.graph?.removeListener?.(inserted)
            sidebar.removePalette?.("emcRecent")
        },
    }
}
export type ShapeToolbox = NonNullable<ReturnType<typeof createShapeToolbox>>
