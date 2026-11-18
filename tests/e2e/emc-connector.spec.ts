import {
    expect,
    getIframeContent,
    openApp,
    openDrawioFile,
    test,
} from "./lib/fixtures"

const diagram =
    '<mxfile><diagram name="Page-1"><mxGraphModel grid="1" gridSize="10"><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
    ["a", "b", "c", "d"]
        .map(
            (id, i) =>
                `<mxCell id="${id}" value="${id}" vertex="1" parent="1" style="shape=ellipse;fillColor=#000000;perimeter=none;points=[[0.5,0.5,0]];outlineConnect=0;snapToPoint=1;"><mxGeometry x="${120 + (i % 2) * 240}" y="${120 + Math.floor(i / 2) * 200}" width="6" height="6" as="geometry"/></mxCell>`,
        )
        .join("") +
    "</root></mxGraphModel></diagram></mxfile>"
test("native EMC connector uses fixed terminals, retains style and supports undo", async ({
    page,
}) => {
    await openApp(page)
    await openDrawioFile(page, "ports.drawio", diagram)
    const frame = getIframeContent(page),
        button = page.getByTestId("drawing-tool-emc-connector")
    await expect(button).toBeEnabled()
    await button.click()
    await expect(button).toHaveAttribute("aria-pressed", "true")
    await page.getByLabel("Connector arrowheads").selectOption("both")
    const result = await frame.locator("body").evaluate((body) => {
        const w = body.ownerDocument.defaultView as any
        let result: any
        w.Draw.loadPlugin((ui: any) => {
            const g = ui.editor.graph,
                h = g.connectionHandler,
                a = g.model.getCell("a"),
                b = g.model.getCell("b"),
                stateA = g.view.getState(a),
                stateB = g.view.getState(b)
            const source = g.getAllConnectionConstraints(stateA, true)[0],
                target = g.getAllConnectionConstraints(stateB, false)[0]
            h.edgeState = h.createEdgeState({})
            h.sourceConstraint = source
            h.constraintHandler.currentConstraint = target
            h.connect(a, b, new w.mxEventObject("fixture"), null)
            const edges = g.getChildEdges(g.getDefaultParent())
            result = {
                count: edges.length,
                style: edges[0]?.style,
                source: edges[0]?.source?.id,
                target: edges[0]?.target?.id,
                grid: g.gridSize,
            }
        })
        return result
    })
    expect(result).toMatchObject({
        count: 1,
        source: "a",
        target: "b",
        grid: 10,
    })
    expect(result.style).toContain("jumpStyle=arc;")
    expect(result.style).toContain("startArrow=classic;")
    expect(result.style).toContain("endArrow=classic;")
    await page.getByTestId("editor-undo").click()
    await expect
        .poll(() =>
            frame.locator("body").evaluate((body) => {
                let count = -1
                ;(body.ownerDocument.defaultView as any).Draw.loadPlugin(
                    (ui: any) =>
                        (count = ui.editor.graph.getChildEdges(
                            ui.editor.graph.getDefaultParent(),
                        ).length),
                )
                return count
            }),
        )
        .toBe(0)
    await page.getByTestId("drawing-tool-insertFreehand").click()
    await expect(button).toHaveAttribute("aria-pressed", "false")
})
