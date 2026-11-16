import { createOpenAI } from "@ai-sdk/openai"
import {
    EMC_MODEL_ID,
    EMC_SUPABASE_PUBLIC_KEY,
    EMC_SUPABASE_URL,
} from "./emc-deployment"

export { EMC_MODEL_ID } from "./emc-deployment"
export const EMC_SERVER_MODEL = {
    id: EMC_MODEL_ID,
    modelId: "EMC OpenAI",
    provider: "openai" as const,
    providerLabel: "EMC OpenAI",
    isDefault: true,
}

/** The Operations JWT authorises a gateway; it is never an OpenAI credential. */
export function emcGatewayHeaders(request: Request) {
    const token = request.headers.get("x-emc-access-token")
    if (!token) throw new Error("Open EMC OpenAI from Operations.")
    return {
        Authorization: `Bearer ${token}`,
        apikey: EMC_SUPABASE_PUBLIC_KEY,
        "Content-Type": "application/json",
        "x-emc-context-type": request.headers.get("x-emc-context-type") || "",
        "x-emc-context-id": request.headers.get("x-emc-context-id") || "",
    }
}
export function emcModel(request: Request) {
    const headers = emcGatewayHeaders(request)
    return {
        model: createOpenAI({
            baseURL: `${EMC_SUPABASE_URL}/functions/v1/brainstorm-ai`,
            apiKey: "gateway-authorised-by-operations",
            headers,
            fetch: (url, init) =>
                fetch(url, {
                    ...init,
                    signal: AbortSignal.any([
                        request.signal,
                        ...(init?.signal ? [init.signal] : []),
                    ]),
                }),
        }).responses("emc-default"),
        providerOptions: { openai: { store: false } },
        modelId: "EMC OpenAI",
        provider: "openai" as const,
    }
}

export async function callEmcGateway(
    request: Request,
    action: string,
    body: unknown,
) {
    return fetch(`${EMC_SUPABASE_URL}/functions/v1/brainstorm-ai/${action}`, {
        method: "POST",
        headers: emcGatewayHeaders(request),
        body: JSON.stringify(body),
        signal:
            action === "research"
                ? AbortSignal.any([request.signal, AbortSignal.timeout(125000)])
                : request.signal,
        cache: "no-store",
    })
}
