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
                "",
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
    return true
}
