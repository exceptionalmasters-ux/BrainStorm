/** Native cells keep draw.io selection, editing, serialization and undo behavior. */
export const quickInsertGroups = {
    lines: [
        ["Line", "endArrow=none;startArrow=none;"],
        ["Arrow", "endArrow=classic;startArrow=none;"],
        ["Double arrow", "endArrow=classic;startArrow=classic;"],
        ["Open arrow", "endArrow=open;startArrow=none;"],
    ],
    shapes: [
        ["Square", "whiteSpace=wrap;html=1;"],
        ["Rectangle", "whiteSpace=wrap;html=1;", 140, 80],
        ["Rounded rectangle", "rounded=1;whiteSpace=wrap;html=1;", 140, 80],
        ["Circle", "ellipse;whiteSpace=wrap;html=1;"],
        ["Ellipse", "ellipse;whiteSpace=wrap;html=1;", 140, 80],
        ["Diamond", "rhombus;whiteSpace=wrap;html=1;"],
        ["Triangle", "triangle;whiteSpace=wrap;html=1;"],
        ["Text", "text;html=1;whiteSpace=wrap;", 100, 30],
    ],
    arrows: [
        ["Right arrow", "shape=singleArrow;whiteSpace=wrap;html=1;", 140, 60],
        [
            "Left arrow",
            "shape=singleArrow;direction=west;whiteSpace=wrap;html=1;",
            140,
            60,
        ],
        [
            "Up arrow",
            "shape=singleArrow;direction=north;whiteSpace=wrap;html=1;",
            60,
            140,
        ],
        [
            "Down arrow",
            "shape=singleArrow;direction=south;whiteSpace=wrap;html=1;",
            60,
            140,
        ],
        ["Double arrow", "shape=doubleArrow;whiteSpace=wrap;html=1;", 140, 60],
    ],
} as const
export type QuickInsertGroup = keyof typeof quickInsertGroups

export function insertQuickCell(
    ui: any,
    win: any,
    group: QuickInsertGroup,
    index: number,
) {
    const graph = ui?.editor?.graph
    const preset = quickInsertGroups[group]?.[index]
    if (!graph?.isEnabled?.() || !preset) return false
    const [, style, width = 100, height = 100] = preset as readonly [
        string,
        string,
        number?,
        number?,
    ]
    const point = graph.getFreeInsertPoint()
    let cell: any
    graph.stopEditing(false)
    graph.model.beginUpdate()
    try {
        if (group === "lines") {
            cell = graph.insertEdge(
                graph.getDefaultParent(),
                null,
                "",
                null,
                null,
                `edgeStyle=none;rounded=0;html=1;${style}`,
            )
            const geometry = cell.geometry.clone()
            geometry.setTerminalPoint(new win.mxPoint(point.x, point.y), true)
            geometry.setTerminalPoint(
                new win.mxPoint(point.x + 160, point.y),
                false,
            )
            graph.model.setGeometry(cell, geometry)
        } else {
            cell = graph.insertVertex(
                graph.getDefaultParent(),
                null,
                style.startsWith("text;") ? "Text" : "",
                point.x,
                point.y,
                width,
                height,
                style,
            )
        }
    } finally {
        graph.model.endUpdate()
    }
    graph.setSelectionCell(cell)
    graph.scrollCellToVisible(cell)
    graph.container?.focus?.()
    if (style.startsWith("text;")) graph.startEditingAtCell?.(cell)
    return true
}

/** Small, code-owned previews; the inserted cells still use the native styles above. */
export function quickInsertIcon(group: QuickInsertGroup, index: number) {
    const shapes = [
        '<rect x="9" y="5" width="22" height="22"/>',
        '<rect x="4" y="7" width="32" height="18"/>',
        '<rect x="4" y="7" width="32" height="18" rx="5"/>',
        '<circle cx="20" cy="16" r="11"/>',
        '<ellipse cx="20" cy="16" rx="16" ry="10"/>',
        '<path d="M20 3 37 16 20 29 3 16Z"/>',
        '<path d="M20 3 37 28H3Z"/>',
        '<path d="M8 6h24M20 6v22M14 28h12"/>',
    ]
    let drawing: string
    if (group === "shapes") drawing = shapes[index] || shapes[0]
    else if (group === "lines") {
        drawing = '<path d="M4 16H36"/>'
        if (index > 0)
            drawing +=
                index === 3
                    ? '<path d="m28 9 8 7-8 7"/>'
                    : '<path d="m28 11 8 5-8 5Z" fill="currentColor"/>'
        if (index === 2)
            drawing += '<path d="m12 11-8 5 8 5Z" fill="currentColor"/>'
    } else if (index === 4) {
        drawing = '<path d="m2 16 10-10v6h16V6l10 10-10 10v-6H12v6Z"/>'
    } else {
        const angle = [0, 180, -90, 90][index] || 0
        drawing = `<path transform="rotate(${angle} 20 16)" d="M5 11h18V5l12 11-12 11v-6H5Z"/>`
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="32" viewBox="0 0 40 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${drawing}</svg>`
}

export function populateQuickInsertMenu(
    popup: any,
    parent: any,
    group: QuickInsertGroup,
    insert: (index: number) => void,
) {
    popup.div.classList.add("emc-quick-insert-menu")
    popup.div.setAttribute("role", "menu")
    popup.div.setAttribute("aria-label", group)
    quickInsertGroups[group].forEach(([label], index) => {
        const row: HTMLTableRowElement = popup.addItem(
            label,
            null,
            () => insert(index),
            parent,
        )
        row.dataset.quickInsert = String(index)
        row.setAttribute("role", "menuitem")
        row.setAttribute("aria-label", label)
        row.title = label
        row.tabIndex = 0
        row.cells[0].innerHTML = quickInsertIcon(group, index)
        row.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                event.stopPropagation()
                popup.hideMenu()
                insert(index)
            } else if (
                ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                    event.key,
                )
            ) {
                event.preventDefault()
                event.stopPropagation()
                const rows = Array.from(
                    popup.div.querySelectorAll("[data-quick-insert]"),
                ) as HTMLElement[]
                const step =
                    { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4 }[
                        event.key
                    ] || 0
                rows[(index + step + rows.length) % rows.length]?.focus()
            }
        })
    })
}
