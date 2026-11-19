import {
    expect,
    getIframe,
    getIframeContent,
    openApp,
    selectLibraries,
    test,
} from "./lib/fixtures"

test("Selected EMC libraries keep native shape dragging, pinning and catalog selection", async ({
    page,
}, testInfo) => {
    await openApp(page, { startScreen: true })
    await page.getByTestId("draw-manually").click()
    await selectLibraries(page, ["basic", "general", "electrical", "arrows2"])
    const frame = getIframeContent(page)
    await page.getByTestId("library-basic").click()
    await expect(frame.getByTestId("shape-flyout-header")).toContainText(
        "Basic",
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
    await page.getByTestId("library-general").click()
    await expect(
        frame.locator(".geSidebar .geItem:visible").first(),
    ).toBeVisible()
    const pin = frame.getByTestId("pin-shape-flyout")
    await pin.click()
    await expect(pin).toHaveAttribute("aria-pressed", "true")
    await frame
        .locator(".geDiagramContainer")
        .click({ position: { x: 300, y: 80 } })
    await expect(pin).toBeVisible()
    await testInfo.attach("emc-toolbox-desktop", {
        body: await page.screenshot(),
        contentType: "image/png",
    })
    await page.getByTestId("library-electrical").click()
    await expect(frame.getByTestId("shape-flyout-header")).toContainText(
        "Electrical",
    )
    await page.getByTestId("library-settings").click()
    await page.getByRole("textbox", { name: "Find library" }).fill("flowchart")
    await expect(page.getByTestId("library-choice-flowchart")).toBeVisible()
})

test("phone toolbox opens and closes an unpinned flyout without reloading draw.io", async ({
    page,
}, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/en", { waitUntil: "networkidle" })
    await page.getByTestId("draw-manually").click()
    await selectLibraries(page, ["basic", "general", "electrical", "arrows2"])
    const frame = getIframeContent(page)
    await expect(page.getByTestId("library-rail")).toBeVisible()
    await getIframe(page).evaluate((el) => {
        ;((el as HTMLIFrameElement).contentWindow as any).__toolboxMark = "kept"
    })
    await page.getByTestId("library-arrows2").click()
    await expect(frame.getByTestId("shape-flyout-header")).toContainText(
        "Arrows",
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

test("expanded technical libraries scroll inside a short viewport", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1100, height: 540 })
    await openApp(page, { startScreen: true })
    await page.getByTestId("draw-manually").click()
    await selectLibraries(page, ["electrical"])
    await page.getByTestId("library-electrical").click()
    const scroll = getIframeContent(page).locator(".emc-shape-scroll")
    await expect(scroll).toBeVisible()
    await expect
        .poll(() => scroll.evaluate((el) => el.scrollHeight > el.clientHeight))
        .toBe(true)
    await scroll.evaluate((el) => {
        el.scrollTop = el.scrollHeight
    })
    await expect
        .poll(() => scroll.evaluate((el) => el.scrollTop))
        .toBeGreaterThan(0)
    const bounds = await scroll.boundingBox()
    expect(bounds && bounds.y + bounds.height).toBeLessThanOrEqual(540)
})
