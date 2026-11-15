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
    await colors.locator('img[title="Close"]').click()
    await page.getByTestId("editor-undo").click()
    await expect.poll(savedXml).not.toContain("fillcolor=#ff0000")
    await page.getByTestId("editor-redo").click()
    await expect.poll(savedXml).toContain("fillcolor=#ff0000")
    await page.getByTestId("drawing-tool-strokeColor").click()
    const lines = canvas
        .locator("div.mxWindow")
        .filter({ hasText: "Line Color" })
        .first()
    await expect(lines).toBeVisible()
    await lines.locator('img[title="Close"]').click()
    await page.getByTestId("drawing-tool-insert").click()
    await expect(canvas.locator(".mxPopupMenu:visible").first()).toBeVisible()
})

test("drawing tools stay reachable on a phone without stretching the workspace", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openApp(page)
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
