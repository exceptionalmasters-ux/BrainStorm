import { type BrowserContext, expect } from "@playwright/test"

export async function mockOperationsStorage(
    context: BrowserContext,
    options: {
        token: string
        records?: Map<string, any>
        methods?: string[]
        onSave?: (value: any) => Promise<void>
    },
) {
    const records = options.records || new Map<string, any>()
    const objects = new Map<string, string>()
    const contextId = "00000000-0000-4000-8000-000000000001"
    await context.route(
        "https://fzwiphplhspsoktugoqo.supabase.co/**",
        async (route) => {
            const req = route.request(),
                url = new URL(req.url())
            const rpc = url.pathname.split("/rest/v1/rpc/")[1]
            const path = url.pathname.split(
                "/storage/v1/object/brainstorm-files/",
            )[1]
            if (!rpc && !path) return route.fallback()
            if (req.method() === "OPTIONS")
                return route.fulfill({
                    status: 204,
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Headers": "*",
                        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
                    },
                })
            expect(req.headers().authorization).toBe(
                `Bearer ${options.token}`,
            )
            if (path) {
                if (req.method() === "POST") {
                    expect(req.headers()["x-upsert"]).toBe("false")
                    if (objects.has(path))
                        return route.fulfill({
                            status: 409,
                            json: { error: "Duplicate", statusCode: "409" },
                        })
                    objects.set(path, req.postData() || "")
                    return route.fulfill({ json: { Key: path } })
                }
                return route.fulfill({
                    contentType: "application/json",
                    body: objects.get(path) || "",
                })
            }
            const args = req.postDataJSON()
            if (rpc === "brainstorm_context")
                return route.fulfill({
                    json: {
                        contextType: "project",
                        contextId,
                        readOnly: false,
                    },
                })
            expect(args.p_context_type).toBe("project")
            expect(args.p_context_id).toBe(contextId)
            const row = records.get(args.p_document_id)
            if (rpc === "brainstorm_list") {
                options.methods?.push("list")
                return route.fulfill({
                    json: [...records.values()].map((value) => value.row),
                })
            }
            if (rpc === "brainstorm_get") {
                options.methods?.push("get")
                return route.fulfill({ json: row?.row || null })
            }
            if (rpc === "brainstorm_commit") {
                options.methods?.push("save")
                expect(args.p_expected_revision).toBe(row?.revision || 0)
                const stem = `project/${contextId}/${args.p_document_id}/${args.p_revision_id}`
                expect(objects.has(`${stem}.drawio`)).toBe(true)
                expect(objects.has(`${stem}.json`)).toBe(true)
                const session = JSON.parse(objects.get(`${stem}.json`) || "")
                const revision = args.p_expected_revision + 1
                const value = {
                    session,
                    revision,
                    row: {
                        id: session.id,
                        title: args.p_title,
                        revision,
                        state_path: `${stem}.json`,
                        xml_path: `${stem}.drawio`,
                        created_at: new Date(session.createdAt).toISOString(),
                        updated_at: new Date(session.updatedAt).toISOString(),
                        message_count: args.p_message_count,
                        has_diagram: args.p_has_diagram,
                    },
                }
                records.set(session.id, value)
                await options.onSave?.(value)
                return route.fulfill({ json: { revision } })
            }
            throw Error(`Unexpected drawing RPC: ${rpc}`)
        },
    )
    return records
}
