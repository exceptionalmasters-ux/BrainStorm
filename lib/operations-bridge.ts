import { EMC_OPERATIONS_ORIGIN } from "@/lib/emc-deployment"
import { getApiEndpoint } from "./base-path"
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

export interface OperationsAuthorization {
    accessToken: string
    contextType: string
    contextId: string
    expiresAt?: number
}
let authorization: OperationsAuthorization | null = null
let authorizationUntil = 0
let authorizationGeneration = 0
let authorizationPending: Promise<OperationsAuthorization> | null = null
function rememberAuthorization(value: OperationsAuthorization | undefined) {
    if (
        !value?.accessToken ||
        !["request", "project"].includes(value.contextType) ||
        !value.contextId
    )
        return
    let expires = value.expiresAt || 0
    try {
        const payload = value.accessToken
            .split(".")[1]
            .replace(/-/g, "+")
            .replace(/_/g, "/")
        const jwtExpires = Number(JSON.parse(atob(payload)).exp) * 1000
        if (Number.isFinite(jwtExpires) && jwtExpires > 0)
            expires = expires ? Math.min(expires, jwtExpires) : jwtExpires
    } catch {
        /* Legacy parents may not supply an expiry; never cache such tokens. */
    }
    authorization = value
    authorizationUntil = Math.min(expires - 30000, Date.now() + 3600000)
}
export async function operationsAuthorization(): Promise<OperationsAuthorization> {
    if (authorization && Date.now() < authorizationUntil) return authorization
    if (!authorizationPending) {
        const generation = authorizationGeneration
        authorizationPending = operationsRequest<OperationsAuthorization>(
            "authorize",
        )
            .then((value) => {
                if (generation !== authorizationGeneration)
                    throw new Error(
                        "Operations workspace changed. Retry from the current drawing.",
                    )
                rememberAuthorization(value)
                return value
            })
            .finally(() => {
                if (generation === authorizationGeneration)
                    authorizationPending = null
            })
    }
    return authorizationPending
}

/** Bootstrap the short-lived access token once, in memory only. The API still checks
 * permissions on every call; a suspended Operations tab need not answer each fetch. */
export async function connectOperations(
    isCancelled: () => boolean = () => false,
) {
    const generation = ++authorizationGeneration
    authorizationPending = null
    authorization = null
    authorizationUntil = 0
    const bootstrap = await operationsRequest<
        OperationsContext & { authorization?: OperationsAuthorization }
    >("context")
    if (isCancelled() || generation !== authorizationGeneration) return () => {}
    const { authorization: initialAuthorization, ...context } = bootstrap
    rememberAuthorization(initialAuthorization)
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
        const auth = await operationsAuthorization()
        const headers = new Headers(
            input instanceof Request ? input.headers : undefined,
        )
        new Headers(init?.headers).forEach((value, key) => {
            headers.set(key, value)
        })
        headers.set("x-emc-access-token", auth.accessToken)
        headers.set("x-emc-context-type", auth.contextType)
        headers.set("x-emc-context-id", auth.contextId)
        const response = await original(input, { ...init, headers })
        if (
            response.status === 401 &&
            authorization?.accessToken === auth.accessToken
        ) {
            authorization = null
            authorizationUntil = 0
        }
        return response
    }
    return () => {
        if (generation !== authorizationGeneration) return
        authorizationGeneration++
        window.fetch = original
        currentContext = null
        authorization = null
        authorizationUntil = 0
        authorizationPending = null
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
    if (
        ["list", "get", "save", "delete"].includes(method) &&
        authorization &&
        Date.now() < authorizationUntil
    ) {
        return window
            .fetch(getApiEndpoint("/api/operations-documents"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    method,
                    payload,
                    brief: currentContext?.brief || "",
                }),
            })
            .then(async (response) => {
                const result = await response.json()
                if (!response.ok)
                    throw new Error(
                        result.error ||
                            "Operations document request failed. Retry without closing this drawing.",
                    )
                return result as T
            })
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
                    "Operations did not respond. Keep this drawing open, switch to the Operations tab to renew access, then return and retry.",
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
