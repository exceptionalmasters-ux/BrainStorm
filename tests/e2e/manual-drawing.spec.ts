import { SINGLE_BOX_DRAWIO_FILE } from "./fixtures/diagrams"
import {
    expect,
    getIframeContent,
    openApp,
    openDrawioFile,
    test,
} from "./lib/fixtures"

test("start cards prepare a brief without a home chat or sending it", async ({
    page,
}) => {
    const requests: string[] = []
    await page.route("**/api/chat", (route) => {
        requests.push(route.request().url())
        return route.abort()
    })
    await openApp(page, { startScreen: true })
    await expect(page.getByTestId("draw-manually")).toBeVisible()
    await expect(page.getByTestId("draw-on-the-fly")).toBeVisible()
    await expect(page.getByTestId("example-flowchart")).toHaveCount(0)
    await expect(page.getByTestId("chat-input")).toHaveCount(0)
    await page.getByTestId("draw-from-brief").click()
    await page
        .getByLabel("Technical Brief", { exact: true })
        .fill(
            "Objective: Replace an ASU controller. Preserve the existing interfaces.",
        )
    await page.getByTestId("prepare-brief-drawing").click()
    await expect(page.getByTestId("chat-panel")).toBeVisible()
    await expect(page.getByTestId("chat-input")).toHaveValue(
        /Replace an ASU controller/,
    )
    expect(requests).toEqual([])
})

for (const mobile of [false, true]) {
    test(`manual drawing needs no model on ${mobile ? "phone" : "desktop"}`, async ({
        page,
    }) => {
        if (mobile) await page.setViewportSize({ width: 390, height: 844 })
        const modelRequests: string[] = []
        await page.route(
            /\/api\/(chat|validate-diagram|validate-model|admin\/test-model)(\?|$)/,
            (route) => {
                modelRequests.push(route.request().url())
                return route.abort()
            },
        )
        if (mobile) {
            await page.goto("/en", { waitUntil: "networkidle" })
            await page.locator("iframe").waitFor({ state: "attached" })
        } else {
            await openApp(page, { startScreen: true })
        }
        await page.getByTestId("draw-manually").click()
        await expect(page.getByTestId("lobby-hero")).toHaveCount(0)
        await expect(page.getByTestId("chat-panel")).toHaveCount(0)
        await expect(page.getByTestId("canvas-loading")).toHaveCount(0)
        await expect(
            getIframeContent(page).locator(".geDiagramContainer"),
        ).toBeVisible()
        await page.getByTestId("manual-settings-button").click()
        await expect(
            page.getByRole("dialog", { name: "Settings" }),
        ).toBeVisible()
        await page.keyboard.press("Escape")
        await openDrawioFile(
            page,
            "manual-concept.storm",
            SINGLE_BOX_DRAWIO_FILE,
        )
        await expect(page.getByTestId("lobby-hero")).toHaveCount(0)
        // A local file is editable, and can be exported without configuring AI.
        if (mobile && (await page.getByTestId("hide-assistant").isVisible()))
            await page.getByTestId("hide-assistant").click()
        await expect(
            getIframeContent(page).getByText("Test Box", { exact: true }),
        ).toBeVisible()
        await page.getByTestId("manual-export-button").click()
        const dialog = page.getByRole("dialog", { name: "Export diagram" })
        await expect(dialog).toBeVisible()
        await dialog
            .getByRole("button", { name: "Cancel", exact: true })
            .click()
        await expect(dialog).toHaveCount(0)
        await page.getByTestId("show-panel").click()
        await expect(page.getByTestId("chat-panel")).toBeVisible()
        expect(modelRequests).toEqual([])
    })
}
