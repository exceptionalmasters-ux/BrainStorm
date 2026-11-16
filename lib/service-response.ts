/** A proxy may return HTML even for a JSON API. Never parse it as a saved document. */
export class ServiceResponseError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message)
        this.name = "ServiceResponseError"
    }
}

export async function readServiceJson(response: Response, service: string) {
    const text = await response.text()
    let result: any
    try {
        result = JSON.parse(text)
    } catch {
        throw new ServiceResponseError(
            `${service} returned an unreadable response (HTTP ${response.status}). Your drawing is kept. Retry without closing the editor.`,
            response.status,
        )
    }
    if (!response.ok) {
        const detail = result?.error || result?.message
        throw new ServiceResponseError(
            typeof detail === "string" && !detail.trimStart().startsWith("<")
                ? detail.slice(0, 500)
                : `${service} could not complete the request (HTTP ${response.status}). Keep this drawing open and retry.`,
            response.status,
        )
    }
    return result
}
