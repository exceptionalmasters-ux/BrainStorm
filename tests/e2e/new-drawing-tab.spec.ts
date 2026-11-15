import { SINGLE_BOX_DRAWIO_FILE } from "./fixtures/diagrams"
import {
    expect,
    getChatInput,
    getIframeContent,
    openApp,
    openDrawioFile,
    test,
} from "./lib/fixtures"

for (const entry of ["file", "history", "assistant", "phone"] as const) {
    test(`new drawing from ${entry} opens an isolated tab and preserves the current drawing`, async ({
        page,
    }) => {
        if (entry === "phone")
            await page.setViewportSize({ width: 390, height: 844 })
        const errors: string[] = []
        page.on("pageerror", (error) => errors.push(error.message))
        await openApp(page)
        await openDrawioFile(page, "original.drawio", SINGLE_BOX_DRAWIO_FILE)
        if (entry === "phone")
            await page
                .getByRole("button", { name: "Canvas", exact: true })
                .click()
        await expect(
            getIframeContent(page).getByText("Test Box", { exact: true }),
        ).toBeVisible()
        await expect(page).toHaveURL(/session=/)
        if (entry === "phone")
            await page
                .getByRole("button", { name: "Chat", exact: true })
                .click()
        await getChatInput(page).fill("Unsent draft in the original tab")
        const originalUrl = page.url()
        if (entry === "file") await page.getByTestId("editor-menu-file").click()
        if (entry === "history")
            await page.getByTestId("editor-file-title").click()
        const popupPromise = page.waitForEvent("popup")
        if (entry === "file")
            await page
                .getByTestId("editor-menu-popup")
                .getByRole("menuitem", { name: "New diagram", exact: true })
                .click()
        else if (entry === "history")
            await page
                .getByRole("dialog")
                .getByRole("button", { name: "New diagram", exact: true })
                .click()
        else await page.getByTestId("new-chat-button").click()
        const popup = await popupPromise
        await expect(popup.getByTestId("lobby-hero")).toBeVisible({
            timeout: 30000,
        })
        await expect(popup).toHaveURL(/\/en$/)
        expect(await popup.evaluate(() => window.opener === null)).toBe(true)
        await popup.getByTestId("draw-manually").click()
        await expect(popup.getByTestId("canvas-loading")).toHaveCount(0, {
            timeout: 30000,
        })
        await expect(popup.getByTestId("editor-file-title")).toContainText(
            "Untitled diagram",
        )
        await expect(
            popup.frameLocator("iframe").getByText("Test Box", { exact: true }),
        ).toHaveCount(0)
        await expect(page).toHaveURL(originalUrl)
        await expect(getChatInput(page)).toHaveValue(
            "Unsent draft in the original tab",
        )
        if (entry !== "phone")
            await expect(
                getIframeContent(page).getByText("Test Box", { exact: true }),
            ).toBeVisible()
        expect(errors).toEqual([])
        await popup.close()
    })
}
