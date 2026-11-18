// Read-only deployment probe: no account, session, or stored drawing.
import { chromium } from '@playwright/test'
const browser = await chromium.launch({headless:true})
try {
 const context=await browser.newContext()
 const page=await context.newPage()
 page.on('console',m=>{if(m.type()==='error')console.log('BROWSER',m.text())})
 page.on('response',async r=>{if(r.request().isNavigationRequest())console.log('DOCUMENT',r.url(),r.status(),JSON.stringify(await r.allHeaders()))})
 page.on('download',d=>console.log('UNEXPECTED DOWNLOAD',d.suggestedFilename()))
 const response=await page.goto('https://exceptionalmasters.co.uk/communications/brainstorm/',{waitUntil:'domcontentloaded'})
 const headers=await response.allHeaders()
 console.log('EMC_HEADERS',JSON.stringify(headers))
 await page.route('https://exceptionalmasters.co.uk/__embed_probe',route=>route.fulfill({status:200,headers:{'content-type':'text/html',...(headers['content-security-policy']?{'content-security-policy':headers['content-security-policy']}:{})},body:'<!doctype html><iframe src="https://brainstorm-worker.exceptionalmasters.workers.dev/en/whiteboard" style="width:100vw;height:100vh"></iframe>'}))
 await page.goto('https://exceptionalmasters.co.uk/__embed_probe',{waitUntil:'domcontentloaded'})
 await page.waitForTimeout(12000)
 console.log('FRAMES',page.frames().map(f=>f.url()))
 for(const f of page.frames())console.log('FRAME_TEXT',f.url(),(await f.locator('body').innerText().catch(()=>'' )).slice(0,400))
} finally { await browser.close() }
