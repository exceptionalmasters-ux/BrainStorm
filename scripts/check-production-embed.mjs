// Read-only deployment probe: no account, session, or stored drawing.
import assert from "node:assert/strict"
import { chromium } from "@playwright/test"

const origin = "https://brainstorm-worker.exceptionalmasters.workers.dev"
const browser = await chromium.launch({ headless: true })
try {
    const context = await browser.newContext()
    const page = await context.newPage()
    let downloads = 0
    const frameErrors = []
    page.on("console", (m) => {
        if (
            m.type() === "error" &&
            /fram(?:e|ing)|frame-src|frame-ancestors/i.test(m.text())
        )
            frameErrors.push(m.text())
    })
    page.on("response", async (r) => {
        if (r.request().isNavigationRequest()) {
            const h = await r.allHeaders()
            console.log(
                "DOCUMENT",
                r.url(),
                r.status(),
                JSON.stringify({
                    csp: h["content-security-policy"],
                    xfo: h["x-frame-options"],
                    type: h["content-type"],
                }),
            )
        }
    })
    page.on("download", () => {
        downloads++
    })
    const response = await page.goto(
        "https://exceptionalmasters.co.uk/communications/brainstorm/",
        { waitUntil: "domcontentloaded" },
    )
    assert.equal(response.status(), 200)
    const headers = await response.allHeaders()
    const policy = headers["content-security-policy"]
    assert(
        policy
            ?.match(/frame-src ([^;]+);/)?.[1]
            .split(/\s+/)
            .includes(origin),
        "Production EMC policy must permit the shared editor",
    )
    await page.route(
        "https://exceptionalmasters.co.uk/__embed_probe",
        (route) =>
            route.fulfill({
                status: 200,
                headers: {
                    "content-type": "text/html",
                    "content-security-policy": policy,
                },
                body: `<!doctype html><div id="ready" hidden>Editor ready</div><iframe src="${origin}/en/whiteboard" style="width:100vw;height:100vh"></iframe><script>
          const frame=document.querySelector('iframe');
          window.addEventListener('message',event=>{
            if(event.origin!==${JSON.stringify(origin)}||event.source!==frame.contentWindow||event.data?.protocol!=='emc-whiteboard/v1'||event.data.type!=='ready')return;
            document.getElementById('ready').hidden=false;
            frame.contentWindow.postMessage({protocol:'emc-whiteboard/v1',type:'state',state:{editable:false,epoch:1,revision:0,xml:'<mxfile><diagram id="probe" name="Deployment probe"><mxGraphModel grid="1" gridSize="10"><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>',follow:false,actorId:'probe',tool:'select',canAnnotate:false,annotations:[],lasers:[]}},${JSON.stringify(origin)});
          });
        </script>`,
            }),
    )
    await page.goto("https://exceptionalmasters.co.uk/__embed_probe", {
        waitUntil: "domcontentloaded",
    })
    await page.locator("#ready").waitFor({ state: "visible", timeout: 30000 })
    const native = page
        .frames()
        .find((f) => f.url().startsWith(`${origin}/drawio/`))
    assert(
        native,
        "Native draw.io frame must load inside the EMC-embedded Worker",
    )
    await native
        .locator(".geDiagramContainer")
        .waitFor({ state: "visible", timeout: 15000 })
    assert.equal(downloads, 0, "Opening a shared board must not download XML")
    assert.deepEqual(frameErrors, [], "No browser frame policy errors")
    console.log(
        "PASS: live EMC CSP unchanged; Worker and native editor loaded, ready handshake completed, no downloads.",
    )
} finally {
    await browser.close()
}
