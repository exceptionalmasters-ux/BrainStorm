import {
    expect,
    getIframe,
    getIframeContent,
    openApp,
    test,
} from "./lib/fixtures"

test("EMC groups keep native shape dragging, recent shapes, pinning and the full catalogue", async ({
    page,
}, testInfo) => {
    await openApp(page, { startScreen: true })
    await page.getByTestId("draw-manually").click()
    const frame = getIframeContent(page)
    await page.getByTestId("toolbox-basic").click()
    await expect(frame.getByTestId("shape-flyout-header")).toContainText(
        "Basic shapes",
    )
    // Capture the editor when the real drag updates its action states.
    await getIframe(page).evaluate((el) => {
        const w = (el as HTMLIFrameElement).contentWindow as any
        const original = w.EditorUi.prototype.updateActionStates
        w.EditorUi.prototype.updateActionStates = function (
            ...args: unknown[]
        ) {
            w.__toolboxUi = this
            return original.apply(this, args)
        }
    })
    await frame.locator(".geSidebar .geItem:visible").first().hover()
    const shape = await frame
        .locator(".geSidebar .geItem:visible")
        .first()
        .boundingBox()
    const canvas = await frame.locator(".geDiagramContainer").boundingBox()
    if (!shape || !canvas)
        throw new Error("Shape library or canvas is not laid out")
    await page.mouse.move(shape.x + shape.width / 2, shape.y + shape.height / 2)
    await page.mouse.down()
    await page.mouse.move(
        canvas.x + canvas.width * 0.6,
        canvas.y + canvas.height * 0.45,
        { steps: 15 },
    )
    await page.mouse.up()
    await expect
        .poll(() =>
            getIframe(page).evaluate((el) => {
                const g = ((el as HTMLIFrameElement).contentWindow as any)
                    .__toolboxUi?.editor.graph
                return g ? g.model.getChildCount(g.getDefaultParent()) : 0
            }),
        )
        .toBeGreaterThan(0)
    await expect(frame.getByTestId("shape-flyout-header")).toHaveCount(0)
    await page.getByTestId("toolbox-recent").click()
    await expect(
        frame.locator(".geSidebar .geItem:visible").first(),
    ).toBeVisible()
    const pin = frame.getByTestId("pin-shape-flyout")
    await pin.click()
    await expect(pin).toHaveAttribute("aria-pressed", "true")
    await frame
        .locator(".geDiagramContainer")
        .click({ position: { x: 20, y: 20 } })
    await expect(pin).toBeVisible()
    await testInfo.attach("emc-toolbox-desktop", {
        body: await page.screenshot(),
        contentType: "image/png",
    })
    await page.getByTestId("toolbox-technical").click()
    await expect(frame.getByTestId("shape-flyout-header")).toContainText(
        "Technical libraries",
    )
    await page.getByTestId("toolbox-search").click()
    await expect(frame.locator("#geOmniSearch")).toBeFocused()
    await page.getByTestId("toolbox-all-libraries").click()
    await expect(frame.locator(".geDialog").last()).toBeVisible()
})

test("phone toolbox opens and closes an unpinned flyout without reloading draw.io", async ({
    page,
}, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/en", { waitUntil: "networkidle" })
    await page.getByTestId("draw-manually").click()
    const frame = getIframeContent(page)
    await expect(page.getByTestId("shape-toolbox")).toBeVisible()
    await getIframe(page).evaluate((el) => {
        ;((el as HTMLIFrameElement).contentWindow as any).__toolboxMark = "kept"
    })
    await page.getByTestId("toolbox-arrows").click()
    await expect(frame.getByTestId("shape-flyout-header")).toContainText(
        "Lines and arrows",
    )
    await testInfo.attach("emc-toolbox-phone", {
        body: await page.screenshot(),
        contentType: "image/png",
    })
    await frame.getByTestId("close-shape-flyout").click()
    await expect(frame.getByTestId("shape-flyout-header")).toHaveCount(0)
    await expect
        .poll(() =>
            getIframe(page).evaluate(
                (el) =>
                    ((el as HTMLIFrameElement).contentWindow as any)
                        .__toolboxMark,
            ),
        )
        .toBe("kept")
})
