/** Raw Responses API frames: exercise the real browser provider, not a UI-stream mock. */
export function emcToolResponse(name: string, input: object, index: number) {
    const args = JSON.stringify(input)
    const item = { type: "function_call", id: `fc_${index}`, call_id: `call_${index}`, name, arguments: args, status: "completed" }
    const response = {
        id: `resp_${index}`, created_at: 1, model: "fixture-model", status: "completed", output: [item],
        usage: { input_tokens: 12, output_tokens: 3, total_tokens: 15, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
    }
    const events = [
        { type: "response.created", response: { ...response, status: "in_progress", output: [] } },
        { type: "response.output_item.added", output_index: 0, item: { ...item, arguments: "", status: "in_progress" } },
        { type: "response.function_call_arguments.delta", item_id: item.id, output_index: 0, delta: args },
        { type: "response.function_call_arguments.done", item_id: item.id, output_index: 0, arguments: args },
        { type: "response.output_item.done", output_index: 0, item },
        { type: "response.completed", response },
    ]
    return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")
}
