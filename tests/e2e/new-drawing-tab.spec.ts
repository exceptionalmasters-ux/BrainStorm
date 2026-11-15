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
    test(`new drawing from ${entry} opens a bottom document tab and preserves the original`, async ({
        page,
    }) => {
        if (entry === "phone")
            await page.setViewportSize({ width: 390, height: 844 })
        const errors: string[] = []
        page.on("pageerror", (error) => errors.push(error.message))
        await openApp(page, { singleDocument: false })
        await openDrawioFile(page, "original.drawio", SINGLE_BOX_DRAWIO_FILE)
        if (entry === "phone") await page.getByTestId("hide-assistant").click()
        const original = getIframeContent(page)
        await expect(
            original.getByText("Test Box", { exact: true }),
        ).toBeVisible()
        if (entry === "phone") await page.getByTestId("show-panel").click()
        await getChatInput(page).fill("Unsent draft in the original document")
        if (entry === "file") {
            await page.getByTestId("editor-menu-file").click()
            await page
                .getByRole("menuitem", { name: "New diagram", exact: true })
                .click()
        } else if (entry === "history") {
            await page.getByTestId("editor-file-title").click()
            await page
                .getByRole("dialog")
                .getByRole("button", { name: "New diagram", exact: true })
                .click()
        } else await page.getByTestId("new-chat-button").click()
        await expect(page.getByRole("tab")).toHaveCount(2)
        const child = page.frameLocator(
            '[data-testid="document-frame"][data-active="true"]',
        )
        await expect(child.getByTestId("editor-file-title")).toContainText(
            "Untitled diagram",
        )
        await expect(child.getByTestId("canvas-loading")).toHaveCount(0, {
            timeout: 30000,
        })
        await expect(
            child.frameLocator("iframe").getByText("Test Box", { exact: true }),
        ).toHaveCount(0)
        await child.getByTestId("show-panel").click()
        await expect(child.getByTestId("chat-input")).toHaveValue("")
        await child
            .getByTestId("chat-input")
            .fill("Draft in the second document")
        expect(page.context().pages()).toHaveLength(1)
        await page.getByRole("tab", { name: "original", exact: true }).click()
        await expect(getChatInput(page)).toHaveValue(
            "Unsent draft in the original document",
        )
        if (entry !== "phone")
            await expect(
                original.getByText("Test Box", { exact: true }),
            ).toBeVisible()
        await page
            .getByRole("tab", { name: "Untitled diagram", exact: true })
            .click()
        await expect(child.getByTestId("chat-input")).toHaveValue(
            "Draft in the second document",
        )
        await page
            .getByRole("button", {
                name: "Close Untitled diagram",
                exact: true,
            })
            .click()
        await expect(page.getByRole("tab")).toHaveCount(1)
        expect(errors).toEqual([])
    })
}

test("switching document tabs preserves the native undo stack", async ({
    page,
}) => {
    await openApp(page, { startScreen: true, singleDocument: false })
    await page.getByTestId("draw-manually").click()
    await openDrawioFile(page, "undo.drawio", SINGLE_BOX_DRAWIO_FILE)
    const original = page.frameLocator(
        'iframe:not([data-testid="document-frame"])',
    )
    await original.getByText("Test Box", { exact: true }).click()
    await page.getByTestId("editor-menu-edit").click()
    await page.getByTestId("editor-action-duplicate").click()
    await expect(original.getByText("Test Box", { exact: true })).toHaveCount(2)
    await page.getByRole("button", { name: "New drawing", exact: true }).click()
    const child = page.frameLocator(
        '[data-testid="document-frame"][data-active="true"]',
    )
    await expect(child.getByTestId("editor-file-title")).toBeVisible()
    await page.getByRole("tab", { name: "undo", exact: true }).click()
    await page.getByTestId("editor-undo").click()
    await expect(original.getByText("Test Box", { exact: true })).toHaveCount(1)
    await page.getByTestId("editor-redo").click()
    await expect(original.getByText("Test Box", { exact: true })).toHaveCount(2)
})
