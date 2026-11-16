import { expect, getIframeContent, openApp, test } from "./lib/fixtures"

async function stored(page: import("@playwright/test").Page) {
    return page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve) => {
            const request = indexedDB.open("next-ai-drawio")
            request.onsuccess = () => resolve(request.result)
        })
        const records = await new Promise<any[]>((resolve) => {
            const request = db
                .transaction("sessions")
                .objectStore("sessions")
                .getAll()
            request.onsuccess = () => resolve(request.result)
        })
        db.close()
        return records
    })
}
async function insertSquare(page: import("@playwright/test").Page) {
    await page.getByTestId("drawing-insert-shapes").click()
    await getIframeContent(page)
        .getByRole("menuitem", { name: "Square", exact: true })
        .click()
}

test("first autosave requests a name and stores the named drawing", async ({
    page,
}) => {
    await openApp(page, {
        acceptDrawingNames: false,
        acceptUnsavedChanges: false,
    })
    const prompt = page.waitForEvent("dialog")
    await insertSquare(page)
    const dialog = await prompt
    expect(dialog.type()).toBe("prompt")
    await dialog.accept("Daily plan")
    await expect
        .poll(async () => (await stored(page))[0]?.title)
        .toBe("Daily plan")
    await expect(page.getByTestId("document-save-status")).toHaveText(
        "Saved · Local",
    )
    await expect(page.getByTestId("editor-file-title")).toContainText(
        "Daily plan.drawio",
    )
})

test("autosave off retains changes and close offers cancel, save or discard", async ({
    page,
}) => {
    await openApp(page, {
        acceptDrawingNames: false,
        acceptUnsavedChanges: false,
    })
    await page.getByTestId("document-autosave").click()
    await insertSquare(page)
    await expect(page.getByTestId("document-save-status")).toHaveText(
        "Unsaved · Local",
    )
    // More than the normal save debounce: OFF must never write in the background.
    await page.waitForTimeout(1500)
    expect(await stored(page)).toHaveLength(0)
    const close = async () => {
        await page.getByTestId("editor-menu-file").click()
        await page.getByTestId("editor-close-drawing").click()
    }
    await close()
    const warning = page.getByRole("dialog", {
        name: "Unsaved changes",
        exact: true,
    })
    await expect(warning).toBeVisible()
    await warning.getByRole("button", { name: "Cancel", exact: true }).click()
    await expect(page.getByTestId("document-save-status")).toHaveText(
        "Unsaved · Local",
    )
    const prevented = await page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true })
        window.dispatchEvent(event)
        return event.defaultPrevented
    })
    expect(prevented).toBe(true)
    await close()
    await warning.getByRole("button", { name: "Discard", exact: true }).click()
    await expect(page.getByTestId("draw-manually")).toBeVisible()
    expect(await stored(page)).toHaveLength(0)
})

test("Save in the close dialog keeps the drawing and its chosen filename", async ({
    page,
}) => {
    await openApp(page, {
        acceptDrawingNames: false,
        acceptUnsavedChanges: false,
    })
    await page.getByTestId("document-autosave").click()
    await insertSquare(page)
    await page.getByTestId("editor-menu-file").click()
    await page.getByTestId("editor-close-drawing").click()
    const prompt = page.waitForEvent("dialog")
    const click = page
        .getByRole("dialog", { name: "Unsaved changes", exact: true })
        .getByRole("button", { name: "Save", exact: true })
        .click()
    await (await prompt).accept("Retained drawing")
    await click
    await expect(page.getByTestId("draw-manually")).toBeVisible()
    await expect
        .poll(async () => (await stored(page))[0]?.title)
        .toBe("Retained drawing")
})
