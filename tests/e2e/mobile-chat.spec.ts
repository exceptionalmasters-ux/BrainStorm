import {
    expect,
    openApp,
    sendMessage,
    test,
    waitForCompleteCount,
} from "./lib/fixtures"
import { createMockSSEResponse } from "./lib/helpers"

test("phone chat stays open after successive drawing replies and hides only on request", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 })
    let release: () => void = () => {}
    await page.route("**/api/chat", async (route) => {
        await new Promise<void>((resolve) => {
            release = resolve
        })
        await route.fulfill({
            status: 200,
            contentType: "text/event-stream",
            body: createMockSSEResponse(
                '<mxCell id="box" value="Box" vertex="1" parent="1"><mxGeometry x="20" y="20" width="80" height="40" as="geometry"/></mxCell>',
                "Done",
            ),
        })
    })
    await openApp(page)
    for (let i = 1; i <= 2; i++) {
        const pending = page.waitForRequest("**/api/chat")
        await sendMessage(page, `Draw box ${i}`)
        await pending
        await expect(page.getByTestId("chat-panel")).toBeVisible()
        release()
        await waitForCompleteCount(page, i)
        await expect(page.getByTestId("chat-panel")).toBeVisible()
    }
    await page.getByTestId("hide-chat-panel").click()
    await expect(page.getByTestId("chat-panel")).not.toBeVisible()
    await page.getByTestId("show-panel").click()
    await expect(page.getByTestId("chat-panel")).toBeVisible()
})
