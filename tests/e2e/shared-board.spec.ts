import { expect, test } from "@playwright/test";

const protocol = "emc-whiteboard/v1";
const xml =
	'<mxfile><diagram id="shared" name="Page-1"><mxGraphModel grid="1" gridSize="10"><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="v" value="Shared module" vertex="1" parent="1"><mxGeometry x="120" y="120" width="100" height="60" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>';
test("shared canvas fences edits, imports only for its current editor and separates annotations", async ({
	page,
	context,
	baseURL,
}) => {
	// The HTTPS EMC fixture embeds the local CI server. Chromium requires loopback consent.
	await context.grantPermissions(["local-network-access"], {
		origin: "https://exceptionalmasters.co.uk",
	});
	const src = new URL("/en/whiteboard", baseURL).href;
	await context.route(
		"https://exceptionalmasters.co.uk/__shared-fixture",
		(r) =>
			r.fulfill({
				contentType: "text/html",
				body: `<iframe id="board" style="position:fixed;inset:0;width:100%;height:100%" src="${src}"></iframe><script>window.events=[];window.presets=[];addEventListener('message',e=>{if(e.source!==document.getElementById('board').contentWindow)return;events.push(e.data);const d=e.data;if(d.type==='library-request'&&d.action.startsWith('presets-')){if(d.action==='presets-save')window.presets=[d.body];e.source.postMessage({protocol:'emc-whiteboard/v1',type:'library-result',requestId:d.requestId,result:window.presets},e.origin)}})</script>`,
			}),
	);
	await page.goto("https://exceptionalmasters.co.uk/__shared-fixture");
	const canvas = page.frameLocator("#board"),
		native = canvas.frameLocator("iframe");
	await expect
		.poll(
			() =>
				page.evaluate(() =>
					((window as any).events || []).some((e: any) => e.type === "ready"),
				),
			{ timeout: 60000 },
		)
		.toBe(true);
	const send = async (type: string, data: any) =>
		page.evaluate(
			({ protocol, type, data, origin }) => {
				(
					document.querySelector("#board") as HTMLIFrameElement
				).contentWindow!.postMessage({ protocol, type, ...data }, origin);
			},
			{ protocol, type, data, origin: new URL(src).origin },
		);
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
	};
	await send("state", { state });
	await expect(
		canvas.getByTestId("shape-toolbox").getByRole("button"),
	).toHaveCount(1);
	// An empty library selection must not turn the paper black in dark mode.
	await expect(native.locator(".geDiagramContainer").first()).toHaveCSS(
		"color-scheme",
		"light",
	);
	await canvas.getByTestId("library-settings").click();
	await expect(
		canvas.getByRole("button", { name: "Apply", exact: true }),
	).toBeDisabled();
	await expect(canvas.getByRole("status")).toHaveCount(0);
	await canvas
		.getByRole("textbox", { name: "Preset name" })
		.fill("Observer personal set");
	await canvas.getByRole("button", { name: "Save new preset" }).click();
	await expect(
		canvas.getByRole("option", { name: "Observer personal set" }),
	).toHaveCount(1);
	expect(
		await page.evaluate(
			() =>
				(window as any).events.filter((e: any) => e.type === "libraries")
					.length,
		),
	).toBe(0);
	await canvas.getByRole("button", { name: "Close library settings" }).click();
	await expect(
		native.getByText("Shared module", { exact: true }),
	).toBeVisible();
	await send("import", {
		xml: xml.replace("Shared module", "Unauthorized import"),
		epoch: 1,
	});
	await expect(
		native.getByText("Unauthorized import", { exact: true }),
	).toHaveCount(0);
	await send("state", { state: { ...state, editable: true, epoch: 2 } });
	await expect(canvas.getByTestId("drawing-tool-emc-connector")).toBeEnabled();
	await canvas.getByTestId("library-settings").click();
	await canvas.getByRole("textbox", { name: "Find library" }).fill("flowchart");
	await canvas.getByRole("checkbox").first().check();
	await canvas.getByRole("button", { name: "Apply", exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(() =>
				((window as any).events || []).some(
					(e: any) =>
						e.type === "libraries" &&
						e.libraryIds.includes("flowchart") &&
						e.epoch === 2,
				),
			),
		)
		.toBe(true);
	await send("state", {
		state: {
			...state,
			editable: true,
			epoch: 2,
			libraryIds: ["flowchart"],
		},
	});
	await expect(
		canvas.getByTestId("shape-toolbox").getByRole("button"),
	).toHaveCount(5);
	await canvas
		.getByTestId("shape-toolbox")
		.getByTestId("toolbox-diagrams")
		.click();
	await expect(
		native.locator('[data-testid="shape-flyout-header"]'),
	).toBeVisible();
	// The dark gallery must use the native dark palette, like the main tool.
	// Merely painting its background dark leaves black-on-dark thumbnails.
	await expect
		.poll(() =>
			native
				.locator("body")
				.evaluate((body) =>
					(body.ownerDocument.defaultView as any).Editor.isDarkMode(),
				),
		)
		.toBe(true);
	await native
		.locator(".geTitle")
		.filter({ hasText: /^Flowchart$/ })
		.click();
	await native.locator(".geSidebar .geItem:visible").first().hover();
	await expect
		.poll(() =>
			native
				.locator(".geSidebar .geItem:visible svg [stroke]")
				.evaluateAll((nodes) =>
					Array.from(
						new Set(nodes.map((node) => getComputedStyle(node).stroke)),
					),
				),
		)
		.toContain("rgb(255, 255, 255)");
	await expect(
		native.getByText("Shared module", { exact: true }),
	).toBeVisible();
	await canvas.getByTestId("library-settings").click();
	await canvas.getByRole("textbox", { name: "Find library" }).fill("flowchart");
	await canvas.getByRole("checkbox").first().uncheck();
	await canvas.getByRole("button", { name: "Apply", exact: true }).click();
	await expect(
		native.getByText("Shared module", { exact: true }),
	).toBeVisible();

	await send("import", {
		xml: xml.replace("Shared module", "Accepted import"),
		epoch: 1,
	});
	await expect(
		native.getByText("Accepted import", { exact: true }),
	).toHaveCount(0);
	await send("import", {
		xml: xml.replace("Shared module", "Accepted import"),
		epoch: 2,
	});
	await expect(
		native.getByText("Accepted import", { exact: true }),
	).toBeVisible();
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
	});
	await expect(canvas.getByTestId("drawing-tool-emc-connector")).toHaveCount(0);
	await send("export-annotations", {});
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					((window as any).events || [])
						.filter((e: any) => e.type === "annotated-export")
						.at(-1)?.svg || "",
			),
		)
		.toContain("#fbbf24");
	const events = await page.evaluate(() => (window as any).events || []);
	expect(
		events
			.filter((e: any) => e.type === "document")
			.some((e: any) => e.xml.includes("Unauthorized import")),
	).toBe(false);
	expect(
		events
			.filter((e: any) => e.type === "document")
			.some((e: any) => e.epoch === 2 && e.xml.includes("Accepted import")),
	).toBe(true);
});

test("following and leaving the presenter never hide the shared drawing", async ({
	page,
	context,
	baseURL,
}) => {
	await context.grantPermissions(["local-network-access"], {
		origin: "https://exceptionalmasters.co.uk",
	});
	const src = new URL("/en/whiteboard", baseURL).href;
	await context.route(
		"https://exceptionalmasters.co.uk/__follow-fixture",
		(r) =>
			r.fulfill({
				contentType: "text/html",
				body: `<iframe id="board" style="position:fixed;inset:0;width:100%;height:100%" src="${src}"></iframe><script>window.ready=false;addEventListener('message',e=>{if(e.source===document.getElementById('board').contentWindow&&e.data.type==='ready')window.ready=true})</script>`,
			}),
	);
	await page.goto("https://exceptionalmasters.co.uk/__follow-fixture");
	await expect
		.poll(() => page.evaluate(() => (window as any).ready), {
			timeout: 60000,
		})
		.toBe(true);
	const native = page.frameLocator("#board").frameLocator("iframe");
	const state = {
		editable: false,
		epoch: 1,
		revision: 1,
		xml,
		follow: true,
		viewport: { pageId: "shared", scale: 1.25, center: { x: 170, y: 150 } },
		annotations: [],
		lasers: [],
		actorId: "observer",
		tool: "select",
		canAnnotate: false,
	};
	const send = async (value: typeof state) =>
		page.evaluate(
			({ state, origin, protocol }) => {
				(
					document.querySelector("#board") as HTMLIFrameElement
				).contentWindow!.postMessage(
					{ protocol, type: "state", state },
					origin,
				);
			},
			{ state: value, origin: new URL(src).origin, protocol },
		);
	const visible = async (label = "Shared module") => {
		await expect
			.poll(
				async () => {
					const object = await native
						.getByText(label, { exact: true })
						.boundingBox();
					const area = await native
						.locator(".geDiagramContainer")
						.boundingBox();
					return (
						!!object &&
						!!area &&
						object.x >= area.x &&
						object.y >= area.y &&
						object.x + object.width <= area.x + area.width &&
						object.y + object.height <= area.y + area.height
					);
				},
				{ timeout: 15000 },
			)
			.toBe(true);
	};
	await send(state);
	await visible();
	// No new document change from the presenter is needed after a toggle.
	for (let i = 0; i < 3; i++) {
		await send({ ...state, follow: false });
		await visible();
		await send(state);
		await visible();
	}
	await page.setViewportSize({ width: 520, height: 740 });
	await send({ ...state, viewport: { ...state.viewport, scale: 2 } });
	await visible();
	// Document loads must reapply the latest presenter view after native load.
	const updated = {
		...state,
		revision: 2,
		xml: xml
			.replace('x="120" y="120"', 'x="520" y="500"')
			.replace("Shared module", "Updated module"),
		viewport: { ...state.viewport, center: { x: 570, y: 530 } },
	};
	await send(updated);
	await visible("Updated module");
	// Independent viewing keeps its local camera on later document updates.
	await send({ ...updated, follow: false });
	await send({
		...updated,
		follow: false,
		revision: 3,
		xml: updated.xml.replace("Updated module", "Independent module"),
		viewport: { ...state.viewport, center: { x: 5000, y: 5000 } },
	});
	await visible("Independent module");
});
