import { expect, openApp, test } from "./lib/fixtures"

for (const width of [390, 1024]) {
    test(`toolbar placement and removed controls at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 })
        await openApp(page)
        if (width < 600) await page.getByTestId("hide-assistant").click()
        const primary = page.getByTestId("drawing-toolbar-primary")
        await expect(primary).toBeVisible()
        const ids = await primary
            .locator("button")
            .evaluateAll((nodes) =>
                nodes.map((n) => n.getAttribute("data-testid")),
            )
        expect(ids).toEqual([
            "drawing-tool-insertPage",
            "editor-undo",
            "editor-redo",
            "drawing-tool-delete",
            "drawing-tool-viewZoom",
            "drawing-tool-zoomOut",
            "drawing-tool-zoomIn",
            "drawing-tool-fitWindow",
        ])
        const header = await page.getByTestId("editor-header").boundingBox()
        const bar = await primary.boundingBox()
        expect(!!header && !!bar && bar.y < header.y + header.height).toBe(
            width >= 600,
        )
        await expect(page.getByTestId("drawing-create-rectangle")).toHaveCount(
            0,
        )
        await expect(page.getByTestId("drawing-create-ellipse")).toHaveCount(0)
        await expect(page.getByTestId("drawing-tool-view")).toHaveCount(0)
        await expect(
            page.getByTestId("chat-panel").getByTestId("session-title"),
        ).toHaveCount(0)
        await expect(
            page.getByTestId("drawing-toolbar").locator("button").last(),
        ).toHaveAttribute("data-testid", "drawing-tool-diagram")
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width)
    })
}

test("File Exit discards unsaved documents without a Save", async ({
    page,
}) => {
    await openApp(page, { singleDocument: false })
    await page.getByRole("switch", { name: "AutoSave", exact: true }).click()
    await page.getByTestId("drawing-create-text").click()
    await expect(page.getByTestId("document-save-status")).toHaveText(
        "Unsaved · Local",
    )
    page.once("dialog", (dialog) => dialog.accept())
    await page.getByTestId("editor-menu-file").click()
    await page.getByTestId("editor-exit").click()
    // Normal tabs cannot be script-closed, so the closed-editor fallback must remain.
    await expect(
        page.getByText("Editor closed. You can close this tab."),
    ).toBeVisible()
    const count = await page.evaluate(async () => {
        const db: IDBDatabase = await new Promise((resolve) => {
            const r = indexedDB.open("next-ai-drawio")
            r.onsuccess = () => resolve(r.result)
        })
        const records = await new Promise<number>((resolve) => {
            const r = db.transaction("sessions").objectStore("sessions").count()
            r.onsuccess = () => resolve(r.result)
        })
        db.close()
        return records
    })
    expect(count).toBe(0)
})
