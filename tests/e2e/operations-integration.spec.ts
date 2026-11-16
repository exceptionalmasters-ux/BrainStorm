import { emcToolResponse } from "../fixtures/emc-response"
import { expect, getIframeContent, sendMessage, test } from "./lib/fixtures"
import { mockOperationsStorage } from "./lib/mock-operations-storage"

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
        let approvals = 0
        const documentRequests: string[] = []
        const fixtureSymbol = {
            name: "Fixture module",
            device: "Fixture",
            package: "DIP-2",
            pins: [
                {
                    number: "1",
                    name: "VCC",
                    side: "left",
                    sourceUrl: "https://manufacturer.example/fixture",
                    evidence: "Datasheet pin 1: VCC",
                },
                {
                    number: "2",
                    name: "GND",
                    side: "right",
                    sourceUrl: "https://manufacturer.example/fixture",
                    evidence: "Datasheet pin 2: GND",
                },
            ],
        }
        const libraryItem = {
            id: "fixture-symbol",
            name: fixtureSymbol.name,
            device: fixtureSymbol.device,
            package: fixtureSymbol.package,
            version: 1,
            sources: [fixtureSymbol.pins[0].sourceUrl],
        }
        const editor = new URL("/en?operations=1", baseURL).href
        await context.addInitScript(() => {
            const original = window.prompt.bind(window)
            window.prompt = (message, suggested) =>
                message === "Name this drawing before saving:"
                    ? "Integration drawing"
                    : original(message, suggested)
        })
        // Do not send fixture credentials or document contents to any real service.
        await context.route("**/api/**", async (route) => {
            const path = new URL(route.request().url()).pathname
            if (path === "/api/chat") modelRequests++
            let data: unknown = {
                accessCodeRequired: false,
                models: [
                    {
                        id: "server:emc-openai:default",
                        modelId: "EMC OpenAI",
                        provider: "openai",
                        providerLabel: "EMC OpenAI",
                        isDefault: true,
                    },
                ],
                providers: [],
            }
            if (path === "/api/operations-documents")
                throw Error("Document bytes must bypass the Worker")
            if (path.startsWith("/api/emc/")) {
                const body = route.request().postDataJSON()
                const action = path.split("/").pop()
                if (action === "research")
                    data =
                        body.query === "ARM"
                            ? {
                                  researchId: "fixture-research",
                                  questions: ["Which exact model and package?"],
                                  candidates: [],
                              }
                            : {
                                  researchId: "fixture-research",
                                  questions: [],
                                  candidates: Array.from(
                                      { length: 5 },
                                      (_, i) => ({
                                          id: `candidate-${i}`,
                                          title: `Fixture reference ${i + 1}`,
                                          device: "Fixture",
                                          package: "DIP-2",
                                          description: "Pin 1 VCC; pin 2 GND",
                                          sourceUrl:
                                              "https://manufacturer.example/fixture",
                                          imageUrl: null,
                                      }),
                                  ),
                              }
                if (action === "draft")
                    data = { questions: [], symbol: fixtureSymbol }
                if (action === "approve") {
                    expect(body.approved).toBe(true)
                    approvals++
                    data = { id: libraryItem.id, symbol: body.symbol }
                }
                if (action === "library")
                    data = { symbols: approvals ? [libraryItem] : [] }
                if (action === "symbol") data = { symbol: fixtureSymbol }
            }
            return route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(data),
            })
        })
        await mockOperationsStorage(context, {
            token: "mock-token-not-real",
            methods: documentRequests,
            onSave: async (value) => {
                await page.evaluate((record) => {
                    ;(window as any).records.set(record.session.id, record)
                }, value)
            },
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
                if ((window.suspendBridge && d.method !== "context")) return;
                if (d.method === "context") result = { userId: "test-operations-user", label: "Project integration", readOnly: false, brief, ...(${withBrief} ? {authorization:{accessToken:"mock-token-not-real",contextType:"project",contextId:"00000000-0000-4000-8000-000000000001",expiresAt:Date.now()+600000}} : {}) };
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
        if (withBrief) {
            let gatewayCalls = 0
            await context.route(
                "https://fzwiphplhspsoktugoqo.supabase.co/functions/v1/brainstorm-ai/responses",
                async (route) => {
                    expect(route.request().headers().authorization).toBe(
                        "Bearer mock-token-not-real",
                    )
                    const body = route.request().postDataJSON()
                    expect(body.store).toBe(false)
                    expect(
                        body.tools.every(
                            (tool: any) => tool.type === "function",
                        ),
                    ).toBe(true)
                    const turn = gatewayCalls++
                    const response =
                        turn === 0
                            ? emcToolResponse(
                                  "get_shape_library",
                                  { library: "electrical" },
                                  turn,
                              )
                            : turn === 1
                              ? emcToolResponse(
                                    "display_diagram",
                                    {
                                        xml: '<mxCell id="fixture-battery" value="Battery fixture" x="80" y="80" w="140" h="60"/>',
                                    },
                                    turn,
                                )
                              : emcToolResponse(
                                    "edit_diagram",
                                    {
                                        operations: [
                                            {
                                                operation: "update",
                                                cell_id: "fixture-battery",
                                                new_xml:
                                                    '<mxCell id="fixture-battery" value="Battery revised" x="80" y="80" w="140" h="60"/>',
                                            },
                                        ],
                                    },
                                    turn,
                                )
                    await route.fulfill({
                        contentType: "text/event-stream",
                        body: response,
                    })
                },
            )
            await sendMessage(
                popup,
                "Draw the fixture battery using the electrical library",
            )
            await expect(
                getIframeContent(popup).locator(".geDiagramContainer"),
            ).toContainText("Battery fixture")
            await sendMessage(popup, "Update the battery label")
            await expect(
                getIframeContent(popup).locator(".geDiagramContainer"),
            ).toContainText("Battery revised")
            expect(gatewayCalls).toBe(3)
            expect(modelRequests).toBe(0)
            await expect(
                popup.getByText("The model returned an empty answer", {
                    exact: false,
                }),
            ).toHaveCount(0)
        }
        if (withBrief)
            await page.evaluate(() => {
                ;(window as any).suspendBridge = true
            })
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
        if (withBrief) {
            await expect(popup.getByTestId("device-research")).toBeVisible()
            await popup
                .getByRole("switch", { name: "Web", exact: true })
                .click()
            const consent = popup.getByRole("dialog", {
                name: "Enable Web research?",
            })
            await expect(consent).toBeVisible()
            await consent
                .getByRole("button", { name: "Cancel", exact: true })
                .click()
            await expect(
                popup.getByRole("switch", { name: "Web", exact: true }),
            ).not.toBeChecked()
            await popup
                .getByRole("switch", { name: "Web", exact: true })
                .click()
            await consent
                .getByRole("button", { name: "Enable Web", exact: true })
                .click()
            await expect(
                popup.getByRole("switch", { name: "WEB ACTIVE", exact: true }),
            ).toBeChecked()
            await expect(popup.getByTestId("chat-panel")).toHaveClass(
                /ring-red-500/,
            )
            const search = popup.getByRole("textbox", { name: "Device search" })
            await search.fill("ARM")
            await popup
                .getByRole("button", { name: "Search", exact: true })
                .click()
            await expect(
                popup.getByText("Which exact model and package?", {
                    exact: true,
                }),
            ).toBeVisible()
            await search.fill("Fixture DIP-2")
            await popup
                .getByRole("button", { name: "Search", exact: true })
                .click()
            await expect(
                popup.getByRole("button", {
                    name: "Create symbol",
                    exact: true,
                }),
            ).toHaveCount(5)
            await popup
                .getByRole("button", { name: "Create symbol", exact: true })
                .first()
                .click()
            const approval = popup.getByRole("dialog", {
                name: "Approve EMC symbol",
            })
            await expect(
                approval.getByRole("img", { name: "Symbol approval preview" }),
            ).toBeVisible()
            expect(approvals).toBe(0)
            await approval
                .getByRole("button", { name: "Cancel", exact: true })
                .click()
            expect(approvals).toBe(0)
            await popup
                .getByRole("button", { name: "Create symbol", exact: true })
                .first()
                .click()
            await approval
                .getByRole("button", {
                    name: "Approve, save & insert",
                    exact: true,
                })
                .click()
            await expect(approval).toHaveCount(0)
            expect(approvals).toBe(1)
            await expect(
                getIframeContent(popup).locator(".geDiagramContainer"),
            ).toContainText("Fixture module")
            await popup
                .getByRole("switch", { name: "WEB ACTIVE", exact: true })
                .click()
            await expect(popup.getByTestId("chat-panel")).not.toHaveClass(
                /ring-red-500/,
            )
            await popup
                .getByRole("button", { name: "EMC library", exact: true })
                .click()
            await popup
                .getByRole("button", { name: "Insert", exact: true })
                .click()
            await expect
                .poll(() =>
                    getIframeContent(popup)
                        .locator(".geDiagramContainer")
                        .innerText(),
                )
                .toMatch(/Fixture module/)
        }
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
        const bridgeRequests = await page.evaluate(
            () => (window as any).requests,
        )
        expect(withBrief ? documentRequests : bridgeRequests).toContain("get")
        if (withBrief) {
            expect(bridgeRequests).not.toContain("authorize")
            expect(bridgeRequests).not.toContain("save")
            expect(documentRequests).toContain("save")
        }
    })
}
