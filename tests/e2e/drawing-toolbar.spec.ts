import {
    expect,
    getIframeContent,
    openApp,
    openDrawioFile,
    test,
} from "./lib/fixtures"

const diagram =
    '<mxfile><diagram name="Page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" value="Toolbar shape" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="120" y="120" width="160" height="80" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>'

test("format shortcuts reveal native Style, Text and Arrange tabs for the selected shape", async ({
    page,
}) => {
    await openApp(page)
    await expect(page.getByTestId("drawing-format-text")).toBeDisabled()
    await expect(page.getByTestId("drawing-format-arrange")).toBeDisabled()
    await openDrawioFile(page, "format.drawio", diagram)
    const canvas = getIframeContent(page)
    await canvas.getByText("Toolbar shape", { exact: true }).click()
    for (const [tab, title] of [
        ["style", "Style"],
        ["text", "Text"],
        ["arrange", "Arrange"],
    ]) {
        await page.getByTestId(`drawing-format-${tab}`).click()
        await expect(
            canvas.locator(`.geFormatTitle[title="${title}"]`),
        ).toHaveClass(/geActiveFormatTitle/)
    }
    await expect(canvas.locator('.geFormatTitle[title="Text"]')).toBeVisible()
    await expect(
        canvas.locator('.geFormatTitle[title="Arrange"]'),
    ).toBeVisible()
    await page.getByTestId("drawing-tool-fillColor").click()
    await page.getByRole("button", { name: "More colors", exact: true }).click()
    const colors = canvas
        .locator("div.mxWindow")
        .filter({ hasText: "Fill Color" })
        .first()
    await expect(colors).toBeVisible()
    const hex = colors.locator("input").first()
    await hex.fill("FF0000")
    await hex.press("Enter")
    const savedXml = () =>
        page.evaluate(async () => {
            const db: IDBDatabase = await new Promise((resolve) => {
                const request = indexedDB.open("next-ai-drawio")
                request.onsuccess = () => resolve(request.result)
            })
            const sessions: any[] = await new Promise((resolve) => {
                const request = db
                    .transaction("sessions")
                    .objectStore("sessions")
                    .getAll()
                request.onsuccess = () => resolve(request.result)
            })
            db.close()
            return String(sessions[0]?.diagramXml || "").toLowerCase()
        })
    await expect.poll(savedXml).toContain("fillcolor=#ff0000")
    await expect(colors).toBeHidden()
    await expect(page.getByTestId("last-fill-colour")).toHaveAccessibleName(
        "Apply last fill colour #FF0000",
    )
    await page.getByTestId("editor-undo").click()
    await expect.poll(savedXml).not.toContain("fillcolor=#ff0000")
    await page.getByTestId("editor-redo").click()
    await expect.poll(savedXml).toContain("fillcolor=#ff0000")
    await page.getByTestId("drawing-tool-strokeColor").click()
    await page.getByRole("button", { name: "More", exact: true }).click()
    await expect(canvas.locator('.geFormatTitle[title="Style"]')).toHaveClass(
        /geActiveFormatTitle/,
    )
    await page.getByTestId("drawing-tool-insert").click()
    await expect(canvas.locator(".mxPopupMenu:visible").first()).toBeVisible()
})

test("drawing tools stay reachable on a phone without stretching the workspace", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openApp(page)
    if (await page.getByTestId("hide-assistant").isVisible())
        await page.getByTestId("hide-assistant").click()
    const toolbar = page.getByTestId("drawing-toolbar")
    const controls = toolbar.getByRole("toolbar")
    await page.getByTestId("drawing-format-style").scrollIntoViewIfNeeded()
    await expect(page.getByTestId("drawing-format-style")).toBeVisible()
    expect(
        await controls.evaluate((el) => el.scrollWidth > el.clientWidth),
    ).toBe(true)
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390)
})

test("selection pointer exits freehand and polygon points use the native editor", async ({
    page,
}) => {
    await openApp(page)
    await expect(page.getByTestId("drawing-tool-editPolygon")).toBeDisabled()
    await openDrawioFile(page, "pointer.drawio", diagram)
    const canvas = getIframeContent(page)
    await canvas.getByText("Toolbar shape", { exact: true }).click()
    await expect(page.getByTestId("drawing-tool-editPolygon")).toBeDisabled()
    // Start through the visible native menu: imported files do not force keyboard focus.
    await page.getByTestId("drawing-tool-insert").click()
    await canvas
        .locator(".mxPopupMenu:visible")
        .getByText("Freehand", { exact: true })
        .click()
    await expect(page.getByTestId("drawing-tool-select")).toHaveAttribute(
        "aria-pressed",
        "false",
    )
    await page.getByTestId("drawing-tool-select").click()
    await expect(page.getByTestId("drawing-tool-select")).toHaveAttribute(
        "aria-pressed",
        "true",
    )
    await expect(
        canvas.getByText("Toolbar shape", { exact: true }),
    ).toBeVisible()
    const polygon = diagram
        .replace('value="Toolbar shape"', 'value="Editable polygon"')
        .replace(
            "rounded=1;",
            "shape=mxgraph.basic.polygon;polyCoords=[[0,0],[1,0],[0.5,1]];",
        )
    await openDrawioFile(page, "polygon.drawio", polygon)
    await canvas.getByText("Editable polygon", { exact: true }).click()
    await expect(page.getByTestId("drawing-tool-editPolygon")).toBeEnabled()
    await page.getByTestId("drawing-tool-editPolygon").click()
    const editor = canvas.locator(".geDialog")
    await expect(editor).toBeVisible()
    await expect(editor.locator("svg circle")).toHaveCount(3)
    await editor.getByRole("button", { name: "Cancel", exact: true }).click()
    await page.getByTestId("editor-menu-edit").click()
    await page.getByTestId("editor-action-editConnectionPoints").click()
    await expect(canvas.locator(".geDialog")).toBeVisible()
    await canvas.getByRole("button", { name: "Cancel", exact: true }).click()
})

test("quick insert creates native shapes and arrow lines with undo", async ({
    page,
}) => {
    await openApp(page)
    const frame = getIframeContent(page)
    await expect(
        page.getByTestId("drawing-insert-shapes"),
    ).toHaveAccessibleName("Shapes")
    await page.getByTestId("drawing-insert-shapes").click()
    await expect(frame.locator(".emc-quick-insert-menu svg")).toHaveCount(8)
    await frame
        .locator(".mxPopupMenu:visible")
        .getByRole("menuitem", { name: "Circle", exact: true })
        .click()
    await expect(page.getByTestId("drawing-format-text")).toBeEnabled()
    await page.getByTestId("drawing-insert-lines").click()
    await frame
        .locator(".mxPopupMenu:visible")
        .getByRole("menuitem", { name: "Double arrow", exact: true })
        .click()
    await expect(page.getByTestId("editor-undo")).toBeEnabled()
    await page.getByTestId("editor-undo").click()
    await expect(page.getByTestId("editor-redo")).toBeEnabled()
    await page.getByTestId("drawing-insert-arrows").click()
    await frame
        .locator(".mxPopupMenu:visible")
        .getByRole("menuitem", { name: "Right arrow", exact: true })
        .click()
})

test("desktop header controls replace duplicate history controls and retain native tools", async ({
    page,
}) => {
    await openApp(page)
    await expect(
        getIframeContent(page).locator(".geSimpleMainMenu"),
    ).toBeHidden()
    await expect(page.getByTestId("editor-undo")).toHaveCount(1)
    await expect(page.getByTestId("editor-redo")).toHaveCount(1)
    await expect(
        page.getByTestId("drawing-toolbar-primary").getByTestId("editor-undo"),
    ).toBeVisible()
    await page.getByTestId("drawing-insert-shapes").click()
    await getIframeContent(page)
        .getByRole("menuitem", { name: "Rectangle", exact: true })
        .click()
    await expect(page.getByTestId("editor-undo")).toBeEnabled()
    await page.getByTestId("editor-undo").click()
    await expect(page.getByTestId("editor-redo")).toBeEnabled()
    await page.getByTestId("drawing-create-text").click()
    await expect(getIframeContent(page).locator(".mxCellEditor")).toBeVisible()
})

test("persisted rulers stay against the canvas top after replacing the native toolbar", async ({
    page,
}) => {
    await openApp(page)
    await page.getByTestId("editor-menu-view").click()
    await page.getByTestId("editor-action-ruler").click()
    const checkRulers = async () => {
        const rulers = getIframeContent(page).locator(".geRuler")
        await expect(rulers).toHaveCount(2)
        await expect
            .poll(() =>
                rulers.evaluateAll((elements) =>
                    elements.every(
                        (element) =>
                            Math.abs(element.getBoundingClientRect().top) <= 1,
                    ),
                ),
            )
            .toBe(true)
    }
    await checkRulers()
    await page.reload({ waitUntil: "networkidle" })
    await expect(page.getByTestId("canvas-loading")).toHaveCount(0)
    await checkRulers()
})
