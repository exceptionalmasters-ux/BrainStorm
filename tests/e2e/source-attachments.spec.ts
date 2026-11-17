import { expect, getIframeContent, test } from "./lib/fixtures"
import { mockOperationsStorage } from "./lib/mock-operations-storage"

test("private PDF upload, no-Web symbol, trash/restore/purge and reconnect without the original tab", async ({
    page,
    context,
    baseURL,
}) => {
    const contextId = "00000000-0000-4000-8000-000000000001",
        sourceId = "00000000-0000-4000-8000-000000000002"
    const path = `project/${contextId}/${sourceId}.pdf`,
        parentOrigin = "https://exceptionalmasters.co.uk",
        editor = new URL("/en?operations=1", baseURL).href
    let sources: any[] = [],
        webCalls = 0,
        uploads = 0,
        purges = 0,
        approvals = 0
    const records = new Map<string, any>(),
        actions: string[] = []
    const sourceUrl = `${parentOrigin}/operations?attachment=${sourceId}`
    const symbol = {
        name: "Fixture module",
        device: "Fixture",
        package: "Module",
        sourceKind: "pdf",
        body: { width: 240, height: 360, antennaHeight: 0.25 },
        pins: [
            {
                number: "RST",
                identifierKind: "label",
                name: "RST",
                side: "left",
                position: 0.35,
                sourceUrl,
                evidence: "PDF page 1, left RST pad",
            },
        ],
    }
    const auth = {
        accessToken: "fixture-token",
        contextType: "project",
        contextId,
        expiresAt: Date.now() + 600000,
    }
    await context.addInitScript(() => {
        window.prompt = () => "Source drawing"
    })
    await context.route("**/api/**", async (route) => {
        const url = new URL(route.request().url()),
            body = route.request().postDataJSON(),
            action = url.pathname.split("/").pop()
        let data: any = { accessCodeRequired: false, models: [], providers: [] }
        if (url.pathname === "/api/operations-documents")
            throw Error("Drawing save must bypass the Worker")
        if (url.pathname.startsWith("/api/emc/")) {
            actions.push(action!)
            if (action === "research") webCalls++
            if (action === "source-list") data = { sources }
            if (action === "source-create") {
                sources = [
                    {
                        id: sourceId,
                        name: body.name,
                        state: "pending",
                        version: 1,
                        size: body.size,
                    },
                ]
                data = { id: sourceId, path, mime: "application/pdf" }
            }
            if (action === "source-complete") {
                sources[0].state = "active"
                sources[0].version = 2
                data = { ok: true }
            }
            if (action === "source-research")
                data = {
                    researchId: "local-research",
                    sourceId,
                    questions: [],
                    candidates: [
                        {
                            id: "candidate",
                            title: "Device.pdf",
                            device: "Fixture",
                            package: "Module",
                            description: "RST on left, page 1",
                            sourceUrl,
                            imageUrl: null,
                        },
                    ],
                }
            if (action === "draft") {
                expect(body.webEnabled).toBe(false)
                data = { questions: [], symbol }
            }
            if (action === "approve") {
                approvals++
                data = { id: "symbol", symbol }
            }
            if (action === "source-trash") {
                sources[0].state = "trashed"
                sources[0].version++
                data = { ok: true }
            }
            if (action === "source-restore") {
                sources[0].state = "active"
                sources[0].version++
                data = { ok: true }
            }
            if (action === "source-purge") {
                expect(body.confirm).toBe(true)
                purges++
                sources = []
                data = { ok: true }
            }
        }
        if (url.pathname === "/api/chat")
            throw Error("No chat API call expected for file analysis")
        await route.fulfill({ json: data })
    })
    await mockOperationsStorage(context, { token: auth.accessToken, records })
    await context.route(
        "https://fzwiphplhspsoktugoqo.supabase.co/storage/v1/object/brainstorm-sources/**",
        async (route) => {
            expect(route.request().headers().authorization).toBe(
                "Bearer fixture-token",
            )
            expect(route.request().method()).toBe("POST")
            expect(route.request().postDataBuffer()?.toString()).toContain(
                "%PDF",
            )
            uploads++
            await route.fulfill({ json: { Key: path } })
        },
    )
    await context.route(`${parentOrigin}/__source-parent`, (route) =>
        route.fulfill({
            contentType: "text/html",
            headers: {
                "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
            },
            body: `<button id="open">Open</button><script>let child;document.getElementById('open').onclick=()=>child=window.open(${JSON.stringify(editor)},'_blank');addEventListener('message',e=>{if(e.source!==child||e.origin!==${JSON.stringify(new URL(editor).origin)}||e.data?.method!=='context')return;child.postMessage({protocol:'emc-brainstorm/v1',kind:'response',requestId:e.data.requestId,result:{label:'Project',userId:'actor',readOnly:false,brief:'',authorization:${JSON.stringify(auth)}}},e.origin)})</script>`,
        }),
    )
    await context.route(
        `${parentOrigin}/operations/brainstorm-session**`,
        (route) =>
            route.fulfill({
                contentType: "text/html",
                headers: { "Cross-Origin-Opener-Policy": "unsafe-none" },
                body: `<script>opener.postMessage({protocol:'emc-brainstorm-session/v1',requestId:new URLSearchParams(location.search).get('requestId'),result:{label:'Project',userId:'actor',readOnly:false,brief:'',authorization:${JSON.stringify(auth)}}},${JSON.stringify(new URL(editor).origin)})</script>`,
            }),
    )
    await page.goto(`${parentOrigin}/__source-parent`)
    const opening = page.waitForEvent("popup")
    await page.locator("#open").click()
    const popup = await opening
    await expect(popup.getByTestId("drawing-toolbar")).toBeVisible()
    await expect(popup.getByTestId("chat-panel")).toBeVisible()
    await popup
        .getByRole("button", { name: "Create symbol from file", exact: true })
        .click()
    await popup.getByLabel("Upload source documentation").setInputFiles({
        name: "Device.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 fixture"),
    })
    const files = popup.getByRole("region", { name: "Source attachments" })
    await expect(
        files.getByRole("button", { name: "Analyse file", exact: true }),
    ).toBeEnabled()
    await files
        .getByRole("button", { name: "Analyse file", exact: true })
        .click()
    await expect(
        popup.getByRole("button", { name: "Create symbol", exact: true }),
    ).toBeEnabled()
    await popup
        .getByRole("button", { name: "Create symbol", exact: true })
        .click()
    const approval = popup.getByRole("dialog", { name: "Approve EMC symbol" })
    await expect(approval).toBeVisible()
    await expect(
        approval.getByText("Source analysed: PDF text and page images"),
    ).toBeVisible()
    await approval
        .getByRole("button", { name: "Approve, save & insert", exact: true })
        .click()
    await expect(approval).not.toBeVisible()
    expect(approvals).toBe(1)
    expect(uploads).toBe(1)
    expect(webCalls).toBe(0)
    await expect(
        getIframeContent(popup).getByText("RST", { exact: true }),
    ).toBeVisible()
    await files
        .getByRole("button", { name: "Move to trash", exact: true })
        .click()
    await files.getByRole("button", { name: "Trash", exact: true }).click()
    await files.getByRole("button", { name: "Restore", exact: true }).click()
    await files
        .getByRole("button", { name: "Active files", exact: true })
        .click()
    await expect(
        files.getByRole("button", { name: "Device.pdf", exact: true }),
    ).toBeVisible()
    await files
        .getByRole("button", { name: "Move to trash", exact: true })
        .click()
    await files.getByRole("button", { name: "Trash", exact: true }).click()
    await files
        .getByRole("button", { name: "Delete permanently", exact: true })
        .click()
    const confirm = files.getByRole("alertdialog", {
        name: "Delete attachment permanently",
    })
    await confirm.getByRole("button", { name: "Cancel", exact: true }).click()
    expect(purges).toBe(0)
    await files
        .getByRole("button", { name: "Delete permanently", exact: true })
        .click()
    await confirm
        .getByRole("button", { name: "Delete forever", exact: true })
        .click()
    await expect(
        files.getByRole("button", { name: "Device.pdf", exact: true }),
    ).toHaveCount(0)
    expect(purges).toBe(1)
    expect(actions).not.toContain("research")
    await page.close()
    await expect(popup.getByTestId("drawing-toolbar")).toBeVisible()
    await popup.getByTestId("emc-reconnect").click()
    await expect(popup.getByTestId("emc-reconnect")).toHaveText("Connected")
})
