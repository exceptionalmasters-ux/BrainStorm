import {
    expect,
    getIframeContent,
    openApp,
    openDrawioFile,
    test,
} from "./lib/fixtures"

const BOX =
    '<mxfile><diagram name="Page-1"><mxGraphModel page="1" grid="1"><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="box" value="Menu box" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="160" y="160" width="120" height="60" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>'

test("home contains only drawing starters, file opening and recent diagrams", async ({
    page,
}) => {
    const requests: string[] = []
    page.on("request", (request) => requests.push(request.url()))
    await openApp(page, { startScreen: true })
    await expect(page.getByTestId("draw-manually")).toBeVisible()
    await expect(page.getByTestId("draw-from-brief")).toBeVisible()
    await expect(page.getByTestId("draw-on-the-fly")).toBeVisible()
    await expect(page.getByTestId("chat-input")).toHaveCount(0)
    await expect(page.getByTestId("mcp-notice")).toHaveCount(0)
    await expect(page.locator('[data-testid^="example-"]')).toHaveCount(0)
    expect(requests.some((url) => url.endsWith("/mcp-promo.mp4"))).toBe(false)
})

test("repeated tool flyouts preserve both the drawing and paper position", async ({
    page,
}) => {
    await openApp(page, { startScreen: true })
    await page.getByTestId("draw-manually").click()
    await openDrawioFile(page, "stable-view.storm", BOX)
    const frame = getIframeContent(page)
    const box = frame.getByText("Menu box", { exact: true })
    await expect(box).toBeVisible()
    await expect(page).toHaveURL(/session=/)
    // Let the file-open fit settle before measuring a user-controlled view.
    await page.waitForTimeout(1800)
    const before = await box.boundingBox()
    const paper = frame.locator(".geBackgroundPage").first(),
        original = await paper.boundingBox()
    if (!before || !original) throw new Error("Drawing is not laid out")
    for (let n = 0; n < 5; n++) {
        await page
            .getByTestId(n % 2 ? "toolbox-arrows" : "toolbox-basic")
            .click()
        const close = frame.getByTestId("close-shape-flyout")
        await close.hover()
        const opened = await box.boundingBox()
        expect(Math.abs((opened?.x ?? -10000) - before.x)).toBeLessThan(2)
        await close.click()
        await expect(close).toHaveCount(0)
        const after = await box.boundingBox(),
            pageAfter = await paper.boundingBox()
        expect(Math.abs((after?.x ?? -10000) - before.x)).toBeLessThan(2)
        expect(Math.abs((after?.y ?? -10000) - before.y)).toBeLessThan(2)
        expect(Math.abs((pageAfter?.x ?? -10000) - original.x)).toBeLessThan(2)
        expect(Math.abs((pageAfter?.width ?? 0) - original.width)).toBeLessThan(
            2,
        )
    }
})

test("editor menus dispatch real duplicate, undo, redo and local save commands", async ({
    page,
}, testInfo) => {
    await openApp(page, { startScreen: true })
    await page.getByTestId("draw-manually").click()
    await openDrawioFile(page, "menu-test.storm", BOX)
    const frame = getIframeContent(page)
    await expect(page.getByTestId("editor-file-title")).toContainText(
        "menu-test.storm",
    )
    for (const name of [
        "file",
        "edit",
        "view",
        "insert",
        "arrange",
        "tools",
        "window",
        "help",
    ])
        await expect(page.getByTestId(`editor-menu-${name}`)).toBeVisible()
    await frame.getByText("Menu box", { exact: true }).click()
    await page.getByTestId("editor-menu-edit").click()
    await page.getByTestId("editor-action-duplicate").click()
    await expect(frame.getByText("Menu box", { exact: true })).toHaveCount(2)
    await page.getByTestId("editor-undo").click()
    await expect(frame.getByText("Menu box", { exact: true })).toHaveCount(1)
    await page.getByTestId("editor-redo").click()
    await expect(frame.getByText("Menu box", { exact: true })).toHaveCount(2)
    await page.getByTestId("editor-menu-view").click()
    const grid = page.getByTestId("editor-action-grid"),
        checked = await grid.getAttribute("aria-checked")
    await grid.click()
    await page.getByTestId("editor-menu-view").click()
    await expect(page.getByTestId("editor-action-grid")).toHaveAttribute(
        "aria-checked",
        checked === "true" ? "false" : "true",
    )
    await page.keyboard.press("Escape")
    await page.getByTestId("editor-menu-file").click()
    const download = page.waitForEvent("download")
    await page
        .getByTestId("editor-menu-popup")
        .getByRole("menuitem", { name: "Save file", exact: true })
        .click()
    expect((await download).suggestedFilename()).toBe("menu-test.storm")
    await testInfo.attach("editor-workbench", {
        body: await page.screenshot(),
        contentType: "image/png",
    })
})
