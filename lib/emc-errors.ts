/** Gateway responses can be JSON errors, a proxy HTML error, or a broken response. */
export async function readEmcJson<T = any>(response: Response): Promise<T> {
    let data: any
    try {
        data = JSON.parse(await response.text())
    } catch {
        throw new Error(
            `EMC AI returned an unreadable response (HTTP ${response.status}). Please retry.`,
        )
    }
    if (!response.ok) {
        const message =
            typeof data?.error === "string" ? data.error : data?.error?.message
        throw new Error(
            typeof message === "string" && message.trim()
                ? message
                : `EMC request failed (HTTP ${response.status}). Please retry.`,
        )
    }
    if (!data || typeof data !== "object" || Array.isArray(data))
        throw new Error("EMC AI returned an invalid response. Please retry.")
    return data as T
}

export function emcStreamError(error: unknown, status: number) {
    let body: any = (error as any)?.data
    if (!body)
        try {
            body = JSON.parse((error as any)?.responseBody || "null")
        } catch {
            /* Not JSON. */
        }
    const reason = body?.code || body?.error?.code
    const message =
        typeof body?.error === "string" ? body.error : body?.error?.message
    const code =
        reason === "provider_credentials"
            ? "invalid_api_key"
            : reason === "quota_exhausted"
              ? "insufficient_quota"
              : status === 429
                ? "rate_limited"
                : reason === "timeout" || status === 504
                  ? "timeout"
                  : reason === "invalid_response"
                    ? "bad_response"
                    : "provider_unavailable"
    return {
        type: "provider",
        code,
        message:
            typeof message === "string" && message.length < 1000
                ? message
                : "EMC OpenAI could not finish the answer. Your drawing is kept. Please retry.",
    }
}
