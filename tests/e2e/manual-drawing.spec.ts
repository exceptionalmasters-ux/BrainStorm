import { SINGLE_BOX_XML } from "./fixtures/diagrams"
import {
    expect,
    getIframeContent,
    openApp,
    openDrawioFile,
    test,
} from "./lib/fixtures"

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
        await openApp(page)
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
        await openDrawioFile(page, "manual-concept.drawio", SINGLE_BOX_XML)
        await expect(page.getByTestId("lobby-hero")).toHaveCount(0)
        // A local file is editable, and can be exported without configuring AI.
        await page.getByTestId("manual-export-button").click()
        const dialog = page.getByRole("dialog", { name: "Export diagram" })
        await expect(dialog).toBeVisible()
        await page.keyboard.press("Escape")
        await page.getByTestId("show-panel").click()
        await expect(page.getByTestId("chat-panel")).toBeVisible()
        expect(modelRequests).toEqual([])
    })
}
