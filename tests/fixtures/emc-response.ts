/** Raw Responses API frames: exercise the real browser provider, not a UI-stream mock. */
export function emcToolResponse(name: string, input: object, index: number) {
    const args = JSON.stringify(input)
    const item = {
        type: "function_call",
        id: `fc_${index}`,
        call_id: `call_${index}`,
        name,
        arguments: args,
        status: "completed",
    }
    const response = {
        id: `resp_${index}`,
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
            item: { ...item, arguments: "", status: "in_progress" },
        },
        {
            type: "response.function_call_arguments.delta",
            item_id: item.id,
            output_index: 0,
            delta: args,
        },
        {
            type: "response.function_call_arguments.done",
            item_id: item.id,
            output_index: 0,
            arguments: args,
        },
        { type: "response.output_item.done", output_index: 0, item },
        { type: "response.completed", response },
    ]
    return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")
}

/** A complete assistant turn after a browser-executed research tool. */
export function emcTextResponse(text: string, index: number) {
    const part = { type: "output_text", text, annotations: [] }
    const item = {
        type: "message",
        id: `msg_${index}`,
        role: "assistant",
        status: "completed",
        content: [part],
    }
    const response = {
        id: `resp_${index}`,
        created_at: 1,
        model: "fixture-model",
        status: "completed",
        output: [item],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
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
            type: "response.content_part.added",
            item_id: item.id,
            output_index: 0,
            content_index: 0,
            part: { ...part, text: "" },
        },
        {
            type: "response.output_text.delta",
            item_id: item.id,
            output_index: 0,
            content_index: 0,
            delta: text,
        },
        {
            type: "response.output_text.done",
            item_id: item.id,
            output_index: 0,
            content_index: 0,
            text,
        },
        {
            type: "response.content_part.done",
            item_id: item.id,
            output_index: 0,
            content_index: 0,
            part,
        },
        { type: "response.output_item.done", output_index: 0, item },
        { type: "response.completed", response },
    ]
    return events
        .map(
            (event) =>
                `data: ${JSON.stringify(event)}${String.fromCharCode(10, 10)}`,
        )
        .join("")
}
