import {
    expect,
    getIframeContent,
    openApp,
    openDrawioFile,
    test,
} from "./lib/fixtures"
import { mockOperationsStorage } from "./lib/mock-operations-storage"

const diagram =
    '<mxfile><diagram name="Page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" value="Palette shape" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="120" y="120" width="160" height="80" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>'
test("quick colours keep independent last-used swatches and native panels toggle", async ({
    page,
}) => {
    await openApp(page)
    await openDrawioFile(page, "palette.drawio", diagram)
    const frame = getIframeContent(page)
    await frame.getByText("Palette shape", { exact: true }).click()
    const style = page.getByTestId("drawing-format-style")
    // The native panel may already be visible after file import. Force a known closed state.
    if ((await style.getAttribute("aria-pressed")) === "true")
        await style.click()
    await expect(style).toHaveAttribute("aria-pressed", "false")
    await style.click()
    await expect(style).toHaveAttribute("aria-pressed", "true")
    await style.click()
    await expect(style).toHaveAttribute("aria-pressed", "false")
    await expect
        .poll(() =>
            frame.locator("body").evaluate((body) => {
                const w = body.ownerDocument.defaultView as any
                let visible = true
                w.Draw.loadPlugin((ui: any) => {
                    visible = ui.isFormatPanelVisible()
                })
                return visible
            }),
        )
        .toBe(false)
    await page.getByTestId("drawing-format-text").click()
    await expect(page.getByTestId("drawing-format-text")).toHaveAttribute(
        "aria-pressed",
        "true",
    )
    await page.getByTestId("drawing-format-arrange").click()
    await expect(page.getByTestId("drawing-format-text")).toHaveAttribute(
        "aria-pressed",
        "false",
    )
    await expect(page.getByTestId("drawing-format-arrange")).toHaveAttribute(
        "aria-pressed",
        "true",
    )
    await page.getByTestId("drawing-tool-fillColor").click()
    const fill = page.getByRole("dialog", { name: "Fill colour", exact: true })
    await expect(
        fill.getByRole("button").filter({ hasText: /^$/ }),
    ).toHaveCount(16)
    await fill.getByLabel("fill HEX colour").fill("#123abc")
    await fill
        .getByRole("button", { name: "Apply colour", exact: true })
        .click()
    await expect(page.getByTestId("last-fill-colour")).toHaveAccessibleName(
        "Apply last fill colour #123ABC",
    )
    await page.getByTestId("drawing-tool-strokeColor").click()
    const line = page.getByRole("dialog", {
        name: "Line colour and style",
        exact: true,
    })
    await line
        .getByRole("button", { name: "line #FF0000", exact: true })
        .click()
    await expect(page.getByTestId("last-line-colour")).toHaveAccessibleName(
        "Apply last line colour #FF0000",
    )
    await expect(page.getByTestId("last-fill-colour")).toHaveAccessibleName(
        "Apply last fill colour #123ABC",
    )
    await page.getByTestId("last-fill-colour").click()
    const native = await frame.locator("body").evaluate((body) => {
        const w = body.ownerDocument.defaultView as any
        let styles: any
        w.Draw.loadPlugin((ui: any) => {
            styles = ui.editor.graph.getCellStyle(
                ui.editor.graph.getSelectionCell(),
            )
        })
        return styles
    })
    expect(native.fillColor).toBe("#123ABC")
    expect(native.strokeColor).toBe("#FF0000")
})

test("right-click saves an editable group with internal wires and compact library reinsertion", async ({
    page,
    context,
    baseURL,
}) => {
    const parent = "https://exceptionalmasters.co.uk",
        editor = new URL("/en?operations=1", baseURL).href
    let saved: any = null
    let saves = 0
    const records = new Map<string, any>()
    await context.addInitScript(() => {
        window.prompt = () => "Manual drawing"
    })
    await mockOperationsStorage(context, { token: "fixture-token", records })
    await context.route("**/api/**", async (route) => {
        const action = new URL(route.request().url()).pathname.split("/").pop(),
            body = route.request().postDataJSON()
        let data: any = { accessCodeRequired: false, models: [], providers: [] }
        if (action === "source-list") data = { sources: [] }
        if (action === "manual-create") {
            saved = body.symbol
            saves++
            expect(body.approved).toBe(true)
            data = { id: "manual-id", symbol: saved }
        }
        if (action === "library")
            data = {
                symbols: saved
                    ? [
                          {
                              id: "manual-id",
                              name: saved.name,
                              device: saved.name,
                              package: "Manual drawing",
                              version: 1,
                              sources: [],
                          },
                      ]
                    : [],
            }
        if (action === "symbol") data = { symbol: saved }
        if (new URL(route.request().url()).pathname.endsWith("/name-available"))
            data = { available: true }
        await route.fulfill({ json: data })
    })
    await context.route(`${parent}/__manual-parent`, (route) =>
        route.fulfill({
            contentType: "text/html",
            headers: {
                "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
            },
            body: `<button id="open">Open</button><script>let child;document.getElementById('open').onclick=()=>child=window.open(${JSON.stringify(editor)},'_blank');addEventListener('message',e=>{if(e.source!==child||e.data?.method!=='context')return;child.postMessage({protocol:'emc-brainstorm/v1',kind:'response',requestId:e.data.requestId,result:{label:'Project',userId:'actor',readOnly:false,brief:'',authorization:{accessToken:'fixture-token',contextType:'project',contextId:'00000000-0000-4000-8000-000000000001',expiresAt:Date.now()+600000}}},e.origin)})</script>`,
        }),
    )
    await page.goto(`${parent}/__manual-parent`)
    const opening = page.waitForEvent("popup")
    await page.locator("#open").click()
    const popup = await opening
    await expect(popup.getByTestId("drawing-toolbar")).toBeVisible()
    const frame = getIframeContent(popup)
    await expect(frame.locator(".geDiagramContainer")).toBeVisible()
    await frame.locator("body").evaluate((body) => {
        const w = body.ownerDocument.defaultView as any
        w.Draw.loadPlugin((ui: any) => {
            const g = ui.editor.graph
            g.model.beginUpdate()
            try {
                const a = g.insertVertex(
                        g.getDefaultParent(),
                        null,
                        "Manual A",
                        100,
                        100,
                        80,
                        40,
                        "rounded=1;html=0;",
                    ),
                    b = g.insertVertex(
                        g.getDefaultParent(),
                        null,
                        "Manual B",
                        260,
                        100,
                        80,
                        40,
                        "shape=ellipse;html=0;",
                    )
                const e = g.insertEdge(g.getDefaultParent(), null, "wire", a, b)
                g.setSelectionCells([a, b, e])
            } finally {
                g.model.endUpdate()
            }
        })
    })
    await frame
        .getByText("Manual A", { exact: true })
        .click({ button: "right" })
    await frame.getByText("Add to EMC library", { exact: true }).click()
    const dialog = popup.getByRole("dialog", { name: "Add to EMC library" })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole("alert")).toHaveCount(0)
    await dialog.getByLabel("Symbol name").fill("My circuit")
    await dialog
        .getByRole("button", { name: "Add to library", exact: true })
        .click()
    await expect(dialog).toBeHidden()
    expect(saves).toBe(1)
    expect(saved.cells.filter((c: any) => c.edge)).toHaveLength(1)
    await popup.getByTestId("toolbox-emc-library").click()
    const tile = popup
        .getByTestId("emc-library-panel")
        .getByRole("button", { name: "Insert My circuit" })
    await expect(tile).toBeEnabled()
    await tile.click()
    const inserted = await frame.locator("body").evaluate((body) => {
        const w = body.ownerDocument.defaultView as any
        let result: any
        w.Draw.loadPlugin((ui: any) => {
            const g = ui.editor.graph,
                root = g.getSelectionCell(),
                children = g.model.getChildren(root),
                edge = children.find((c: any) => c.edge)
            result = {
                children: children.length,
                wire: !!edge?.source && !!edge?.target,
            }
        })
        return result
    })
    expect(inserted).toEqual({ children: 3, wire: true })
})
