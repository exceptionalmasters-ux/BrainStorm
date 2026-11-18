import { expect, test } from "@playwright/test"

const protocol = "emc-whiteboard/v1"
const xml =
    '<mxfile><diagram id="shared" name="Page-1"><mxGraphModel grid="1" gridSize="10"><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="v" value="Shared module" vertex="1" parent="1"><mxGeometry x="120" y="120" width="100" height="60" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>'
test("shared canvas fences edits, imports only for its current editor and separates annotations", async ({
    page,
    context,
    baseURL,
}) => {
    // The HTTPS EMC fixture embeds the local CI server. Chromium requires loopback consent.
    await context.grantPermissions(["local-network-access"], {
        origin: "https://exceptionalmasters.co.uk",
    })
    const src = new URL("/en/whiteboard", baseURL).href
    await context.route(
        "https://exceptionalmasters.co.uk/__shared-fixture",
        (r) =>
            r.fulfill({
                contentType: "text/html",
                body: `<iframe id="board" style="position:fixed;inset:0;width:100%;height:100%" src="${src}"></iframe><script>window.events=[];addEventListener('message',e=>{if(e.source===document.getElementById('board').contentWindow)events.push(e.data)})</script>`,
            }),
    )
    await page.goto("https://exceptionalmasters.co.uk/__shared-fixture")
    const canvas = page.frameLocator("#board"),
        native = canvas.frameLocator("iframe")
    await expect
        .poll(
            () =>
                page.evaluate(() =>
                    ((window as any).events || []).some(
                        (e: any) => e.type === "ready",
                    ),
                ),
            { timeout: 60000 },
        )
        .toBe(true)
    const send = async (type: string, data: any) =>
        page.evaluate(
            ({ protocol, type, data, origin }) => {
                ;(
                    document.querySelector("#board") as HTMLIFrameElement
                ).contentWindow!.postMessage(
                    { protocol, type, ...data },
                    origin,
                )
            },
            { protocol, type, data, origin: new URL(src).origin },
        )
    const state = {
        editable: false,
        epoch: 1,
        revision: 1,
        xml,
        follow: false,
        annotations: [],
        lasers: [],
        actorId: "fixture",
        tool: "select",
        canAnnotate: false,
    }
    await send("state", { state })
    await expect(
        native.getByText("Shared module", { exact: true }),
    ).toBeVisible()
    await send("import", {
        xml: xml.replace("Shared module", "Unauthorized import"),
        epoch: 1,
    })
    await expect(
        native.getByText("Unauthorized import", { exact: true }),
    ).toHaveCount(0)
    await send("state", { state: { ...state, editable: true, epoch: 2 } })
    await expect(canvas.getByTestId("drawing-tool-emc-connector")).toBeEnabled()
    await send("import", {
        xml: xml.replace("Shared module", "Accepted import"),
        epoch: 1,
    })
    await expect(
        native.getByText("Accepted import", { exact: true }),
    ).toHaveCount(0)
    await send("import", {
        xml: xml.replace("Shared module", "Accepted import"),
        epoch: 2,
    })
    await expect(
        native.getByText("Accepted import", { exact: true }),
    ).toBeVisible()
    await send("state", {
        state: {
            ...state,
            epoch: 3,
            annotations: [
                {
                    id: "note",
                    actorId: "fixture",
                    pageId: "shared",
                    kind: "highlight",
                    points: [
                        { x: 100, y: 100 },
                        { x: 200, y: 120 },
                    ],
                },
            ],
        },
    })
    await expect(canvas.getByTestId("drawing-tool-emc-connector")).toHaveCount(
        0,
    )
    await send("export-annotations", {})
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    ((window as any).events || [])
                        .filter((e: any) => e.type === "annotated-export")
                        .at(-1)?.svg || "",
            ),
        )
        .toContain("#fbbf24")
    const events = await page.evaluate(() => (window as any).events || [])
    expect(
        events
            .filter((e: any) => e.type === "document")
            .some((e: any) => e.xml.includes("Unauthorized import")),
    ).toBe(false)
    expect(
        events
            .filter((e: any) => e.type === "document")
            .some(
                (e: any) => e.epoch === 2 && e.xml.includes("Accepted import"),
            ),
    ).toBe(true)
})
