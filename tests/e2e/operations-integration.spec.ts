import { expect, getIframeContent, test } from "./lib/fixtures"

/** Real cross-origin popup and native editor; the authenticated parent's transport is mocked.
 * The real Operations RPC/Storage adapter and SQL policies are verified in the EMC suites.
 */
for (const withBrief of [true, false]) {
    test(`Operations ${withBrief ? "brief" : "skip"} opens directly into the drawing and reopens cloud files`, async ({
        page,
        context,
        baseURL,
    }) => {
        let modelRequests = 0
        const editor = new URL("/en?operations=1", baseURL).href
        await context.addInitScript(() => {
            const original = window.prompt.bind(window)
            window.prompt = (message, suggested) =>
                message === "Name this drawing before saving:"
                    ? "Integration drawing"
                    : original(message, suggested)
        })
        // Do not send fixture credentials or document contents to any real service.
        await context.route("**/api/**", (route) => {
            if (new URL(route.request().url()).pathname === "/api/chat")
                modelRequests++
            return route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    accessCodeRequired: false,
                    models: [],
                    providers: [],
                }),
            })
        })
        await context.route(
            "https://exceptionalmasters.co.uk/__brainstorm-integration",
            (route) =>
                route.fulfill({
                    contentType: "text/html",
                    headers: {
                        "Cross-Origin-Opener-Policy":
                            "same-origin-allow-popups",
                    },
                    body: `<button id="open">Open with brief</button><button id="skip">Skip brief</button><script>
            const editor = ${JSON.stringify(editor)};
            const editorOrigin = new URL(editor).origin;
            window.records = new Map(); window.requests = []; let child = null; let brief = "";
            function launchEditor(selected) {
                brief = selected ? "OBJECTIVE: Integration concept" : "";
                const url = new URL(editor); const first = [...records.values()][0];
                if (first) url.searchParams.set("session", first.session.id);
                child = window.open(url, "_blank", "popup,width=1440,height=960");
            }
            document.getElementById("open").onclick = () => launchEditor(true);
            document.getElementById("skip").onclick = () => launchEditor(false);
            window.addEventListener("message", event => {
                const d = event.data;
                if (event.origin !== editorOrigin || event.source !== child || d?.protocol !== "emc-brainstorm/v1" || d.kind !== "request") return;
                requests.push(d.method); let result; let error;
                if (d.method === "context") result = { userId: "test-operations-user", label: "Project integration", readOnly: false, brief };
                else if (d.method === "authorize") result = { accessToken: "mock-token-not-real", contextType: "project", contextId: "00000000-0000-4000-8000-000000000001" };
                else if (d.method === "list") result = [...records.values()].map(({session, revision}) => ({ ...session, revision, messageCount: session.messages.length, hasDiagram: true }));
                else if (d.method === "get") result = records.get(d.payload.id) || null;
                else if (d.method === "save") {
                    const prior = records.get(d.payload.session.id);
                    if ((prior?.revision || 0) !== d.payload.expectedRevision) error = "Revision conflict";
                    else { result = { revision: (prior?.revision || 0) + 1 }; records.set(d.payload.session.id, { session: { ...d.payload.session, conceptBrief: brief }, ...result }); }
                } else error = "Unexpected method";
                child.postMessage({ protocol: d.protocol, kind: "response", requestId: d.requestId, result, error }, editorOrigin);
            });
        </script>`,
                }),
        )
        await page.goto(
            "https://exceptionalmasters.co.uk/__brainstorm-integration",
        )
        const opening = page.waitForEvent("popup")
        await page.locator(withBrief ? "#open" : "#skip").click()
        const popup = await opening
        await popup.waitForLoadState("networkidle")
        await expect(popup.getByTestId("canvas-loading")).toHaveCount(0)
        await expect(popup.getByTestId("draw-manually")).toHaveCount(0)
        await expect(popup.getByTestId("lobby-hero")).toHaveCount(0)
        await expect(popup.getByTestId("drawing-toolbar")).toBeVisible()
        const prompt = popup.getByTestId("chat-input")
        if (withBrief) {
            await expect(prompt).toHaveValue(/OBJECTIVE: Integration concept/)
            await expect(popup.getByTestId("editor-file-title")).toHaveText(
                "Drawing from brief.drawio",
            )
        } else {
            await expect(popup.getByTestId("chat-panel")).toHaveCount(0)
            await popup.getByTestId("show-panel").click()
            await expect(prompt).toHaveValue("")
        }
        await expect(
            popup.getByText("Technical Brief · concept context"),
        ).toHaveCount(0)

        expect(modelRequests).toBe(0)
        await popup.getByTestId("drawing-create-rectangle").click()
        await expect
            .poll(() => page.evaluate(() => (window as any).records.size))
            .toBe(1)
        await expect(popup.getByTestId("document-save-status")).toHaveText(
            "Saved",
        )
        const databases = await popup.evaluate(async () =>
            (await indexedDB.databases()).map((db) => db.name),
        )
        expect(databases).not.toContain("next-ai-drawio")
        await popup.getByTestId("editor-save-as-button").click()
        const saveAs = popup.getByRole("dialog", {
            name: "Save As",
            exact: true,
        })
        await saveAs
            .getByLabel("Drawing name", { exact: true })
            .fill("Integration copy")
        await saveAs.getByRole("button", { name: "Save", exact: true }).click()
        await expect(saveAs).toHaveCount(0)
        await expect(popup.getByTestId("editor-file-title")).toHaveText(
            "Integration copy.drawio",
        )
        await expect
            .poll(() => page.evaluate(() => (window as any).records.size))
            .toBe(2)
        await popup.getByTestId("editor-save").click()
        expect(await page.evaluate(() => (window as any).records.size)).toBe(2)
        await popup.getByTestId("manual-export-button").click()
        await expect(
            popup.getByRole("dialog", { name: "Export diagram", exact: true }),
        ).toBeVisible()
        await popup.keyboard.press("Escape")
        await popup.close()
        const reopening = page.waitForEvent("popup")
        await page.locator("#skip").click()
        const reopened = await reopening
        await expect(reopened.getByTestId("editor-file-title")).toHaveText(
            withBrief
                ? "Drawing from brief.drawio"
                : "Integration drawing.drawio",
        )
        await expect(
            reopened.getByText("Technical Brief · concept context"),
        ).toHaveCount(0)
        await expect(
            getIframeContent(reopened).locator(".geDiagramContainer"),
        ).toBeVisible()
        expect(await page.evaluate(() => (window as any).requests)).toContain(
            "get",
        )
    })
}
