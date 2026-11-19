// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import { emcClientChat } from "@/lib/emc-client-chat"
import { EMC_SUPABASE_URL } from "@/lib/emc-deployment"

afterEach(() => vi.unstubAllGlobals())

function streamResponse() {
    const item = {
        type: "message",
        id: "msg_fixture",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text: "Gotowe", annotations: [] }],
    }
    const response = {
        id: "resp_fixture",
        created_at: 1,
        model: "fixture-model",
        status: "completed",
        output: [item],
        usage: {
            input_tokens: 12,
            output_tokens: 3,
            total_tokens: 15,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 0 },
        },
    }
    const events = [
        {
            type: "response.created",
            response: { ...response, status: "in_progress", output: [] },
        },
        {
            type: "response.output_item.added",
            output_index: 0,
            item: { ...item, status: "in_progress", content: [] },
        },
        {
            type: "response.output_text.delta",
            item_id: item.id,
            output_index: 0,
            content_index: 0,
            delta: "Gotowe",
        },
        { type: "response.completed", response },
    ]
    return new Response(
        events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
        { headers: { "Content-Type": "text/event-stream" } },
    )
}
function request(webEnabled = false, signal?: AbortSignal) {
    return new Request("https://editor.example/api/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-emc-access-token": "fixture-user",
            "x-emc-context-type": "project",
            "x-emc-context-id": "00000000-0000-4000-8000-000000000001",
        },
        signal,
        body: JSON.stringify({
            webEnabled,
            conceptBrief: "Selected brief",
            messages: [
                {
                    id: "user",
                    role: "user",
                    parts: [{ type: "text", text: "Użyj symbolu diody" }],
                },
            ],
        }),
    })
}
describe("EMC browser drawing transport", () => {
    it("streams two consecutive requests through the fixed gateway, preserves context and usage", async () => {
        const calls: any[] = []
        vi.stubGlobal(
            "fetch",
            vi.fn(async (url, init) => {
                calls.push({ url: String(url), init })
                return streamResponse()
            }),
        )
        for (let turn = 0; turn < 2; turn++) {
            const response = await emcClientChat(request())
            const text = await response.text()
            expect(text).toContain("Gotowe")
            expect(text).toContain('"type":"finish"')
            expect(text).toContain('"inputTokens":12')
            expect(text).not.toContain('"type":"error"')
        }
        expect(calls).toHaveLength(2)
        for (const call of calls) {
            expect(call.url).toBe(
                `${EMC_SUPABASE_URL}/functions/v1/brainstorm-ai/responses`,
            )
            expect(new Headers(call.init.headers).get("authorization")).toBe(
                "Bearer fixture-user",
            )
            const body = JSON.parse(call.init.body)
            expect(body.store).toBe(false)
            expect(
                body.input.some((item: any) =>
                    JSON.stringify(item).includes("Selected brief"),
                ),
            ).toBe(true)
            expect(
                body.tools.some((tool: any) => tool.name === "edit_diagram"),
            ).toBe(true)
            expect(
                body.tools.some((tool: any) => tool.name === "search_device"),
            ).toBe(false)
            expect(
                body.tools.every((tool: any) => tool.type === "function"),
            ).toBe(true)
        }
    })
    it("forces a fresh Web lookup on three successive user turns", async () => {
        const payloads: any[] = []
        vi.stubGlobal(
            "fetch",
            vi.fn(async (_url, init) => {
                payloads.push(JSON.parse(init.body))
                return streamResponse()
            }),
        )
        for (let turn = 0; turn < 3; turn++) {
            const response = await emcClientChat(request(true))
            await response.text()
        }
        expect(payloads).toHaveLength(3)
        for (const payload of payloads)
            expect(payload.tool_choice).toMatchObject({
                type: "function",
                name: "search_device",
            })
    })
    it("retains Web consent isolation and Stop cancellation", async () => {
        let modelSignal: AbortSignal | undefined
        let payload: any
        vi.stubGlobal(
            "fetch",
            vi.fn(async (_url, init) => {
                modelSignal = init.signal
                payload = JSON.parse(init.body)
                return streamResponse()
            }),
        )
        const controller = new AbortController()
        const response = await emcClientChat(request(true, controller.signal))
        await response.text()
        expect(
            payload.tools.some((tool: any) => tool.name === "search_device"),
        ).toBe(true)
        expect(
            payload.tools.some((tool: any) => tool.name === "display_diagram"),
        ).toBe(false)
        controller.abort()
        expect(modelSignal?.aborted).toBe(true)
    })
})
