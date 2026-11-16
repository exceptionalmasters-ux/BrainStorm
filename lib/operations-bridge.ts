import { EMC_OPERATIONS_ORIGIN } from "@/lib/emc-deployment"
/** Operations owns authentication and Storage. Tokens never appear in URLs or persistent editor storage. */
export const OPERATIONS_PROTOCOL = "emc-brainstorm/v1"
export type OperationsMethod =
    | "context"
    | "list"
    | "get"
    | "save"
    | "delete"
    | "authorize"
export interface OperationsContext {
    label: string
    userId: string
    readOnly: boolean
    brief: string
}
let currentContext: OperationsContext | null = null
export const getOperationsContext = () => currentContext

/** Additional document frames use their parent; the workspace window uses its opener. */
export const operationsHost = (): Window | null =>
    window.parent !== window ? window.parent : window.opener

/** The parent supplies only a current access token; refresh tokens stay in Operations. */
export async function connectOperations(
    isCancelled: () => boolean = () => false,
) {
    const context = await operationsRequest<OperationsContext>("context")
    if (isCancelled()) return () => {}
    currentContext = context
    const original = window.fetch.bind(window)
    window.fetch = async (input, init) => {
        const url = new URL(
            input instanceof Request ? input.url : String(input),
            window.location.href,
        )
        if (
            url.origin !== window.location.origin ||
            !url.pathname.includes("/api/")
        )
            return original(input, init)
        const auth = await operationsRequest<{
            accessToken: string
            contextType: string
            contextId: string
        }>("authorize")
        const headers = new Headers(
            input instanceof Request ? input.headers : undefined,
        )
        new Headers(init?.headers).forEach((value, key) => {
            headers.set(key, value)
        })
        headers.set("x-emc-access-token", auth.accessToken)
        headers.set("x-emc-context-type", auth.contextType)
        headers.set("x-emc-context-id", auth.contextId)
        return original(input, { ...init, headers })
    }
    return () => {
        window.fetch = original
        currentContext = null
    }
}

export function isOperationsMode() {
    return (
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("operations") === "1"
    )
}

export function operationsParentOrigin() {
    if (
        new URLSearchParams(window.location.search).get("documentFrame") === "1"
    )
        return window.location.origin
    const configured =
        process.env.NEXT_PUBLIC_EMC_OPERATIONS_ORIGIN || EMC_OPERATIONS_ORIGIN
    if (!configured)
        throw new Error("Operations origin is not configured for BrainStorm.")
    const url = new URL(configured)
    if (
        url.protocol !== "https:" &&
        url.hostname !== "localhost" &&
        url.hostname !== "127.0.0.1"
    )
        throw new Error("Operations requires HTTPS.")
    return url.origin
}

export function operationsRequest<T>(
    method: OperationsMethod,
    payload?: unknown,
): Promise<T> {
    const host = operationsHost()
    if (!isOperationsMode() || !host || host.closed)
        return Promise.reject(new Error("Open this drawing from Operations."))
    let origin: string
    try {
        origin = operationsParentOrigin()
    } catch (error) {
        return Promise.reject(error)
    }
    const requestId = crypto.randomUUID()
    return new Promise((resolve, reject) => {
        const cleanup = () => {
            clearTimeout(timer)
            window.removeEventListener("message", receive)
        }
        const receive = (event: MessageEvent) => {
            if (event.source !== host || event.origin !== origin) return
            const data = event.data
            if (
                data?.protocol !== OPERATIONS_PROTOCOL ||
                data.kind !== "response" ||
                data.requestId !== requestId
            )
                return
            cleanup()
            if (data.error) reject(new Error(String(data.error)))
            else resolve(data.result as T)
        }
        const timer = setTimeout(() => {
            cleanup()
            reject(
                new Error(
                    "Operations did not confirm the request. Keep this tab open and retry.",
                ),
            )
        }, 45000)
        window.addEventListener("message", receive)
        host.postMessage(
            {
                protocol: OPERATIONS_PROTOCOL,
                kind: "request",
                requestId,
                method,
                payload,
            },
            origin,
        )
    })
}
