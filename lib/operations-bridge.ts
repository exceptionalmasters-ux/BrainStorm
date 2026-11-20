import { EMC_MODEL_ID, EMC_OPERATIONS_ORIGIN } from "@/lib/emc-deployment"
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
let reconnecting: Promise<
    OperationsContext & { authorization: OperationsAuthorization }
> | null = null
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
export type EmcConnectionState = "connected" | "reconnect" | "connecting"
let connectionState: EmcConnectionState = "reconnect"
export const getEmcConnectionState = () =>
    connectionState === "connected" &&
    (!authorization || Date.now() >= authorizationUntil)
        ? "reconnect"
        : connectionState
function connection(value: EmcConnectionState) {
    connectionState = value
    if (typeof window !== "undefined")
        window.dispatchEvent(new Event("emc-connection-state"))
}
let authorizationGeneration = 0
let credentialGeneration = 0
let authorizationPending: Promise<OperationsAuthorization> | null = null
function rememberAuthorization(value: OperationsAuthorization | undefined) {
    if (
        !value?.accessToken ||
        !["request", "project", "personal"].includes(value.contextType) ||
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
    connection("connected")
    authorizationUntil = expires
}
export async function operationsAuthorization(): Promise<OperationsAuthorization> {
    if (authorization && Date.now() < authorizationUntil) return authorization
    if (!authorizationPending) {
        const generation = authorizationGeneration
        const credentialVersion = credentialGeneration
        authorizationPending = operationsRequest<OperationsAuthorization>(
            "authorize",
        )
            .then((value) => {
                if (
                    generation !== authorizationGeneration ||
                    credentialVersion !== credentialGeneration
                )
                    throw new Error(
                        "Operations workspace changed. Retry from the current drawing.",
                    )
                rememberAuthorization(value)
                return value
            })
            .catch((error) => {
                connection("reconnect")
                throw error
            })
            .finally(() => {
                if (
                    generation === authorizationGeneration &&
                    credentialVersion === credentialGeneration
                )
                    authorizationPending = null
            })
    }
    return authorizationPending
}

/** Explicit user gesture: renew with the existing EMC login, never copy refresh credentials. */
export function reconnectOperations(): Promise<
    OperationsContext & { authorization: OperationsAuthorization }
> {
    if (window.parent !== window)
        return Promise.reject(
            new Error("Use Reconnect EMC in the main editor window."),
        )
    if (reconnecting) return reconnecting
    const params = new URLSearchParams(location.search)
    const type = authorization?.contextType || params.get("contextType")
    const id = authorization?.contextId || params.get("contextId")
    if (!["request", "project", "personal"].includes(type || "") || !id)
        return Promise.reject(
            new Error("Open a workspace from Operations first."),
        )
    const requestId = crypto.randomUUID()
    const url = new URL(
        "/operations/brainstorm-session",
        operationsParentOrigin(),
    )
    url.search = new URLSearchParams({
        contextType: type!,
        contextId: id,
        requestId,
    }).toString()
    const popup = window.open(url.href, "_blank", "popup,width=620,height=600")
    if (!popup)
        return Promise.reject(new Error("Allow popups to reconnect to EMC."))
    connection("connecting")
    reconnecting = new Promise((resolve, reject) => {
        const clean = () => {
            clearTimeout(timer)
            clearInterval(closedCheck)
            window.removeEventListener("message", receive)
            reconnecting = null
            connection(
                authorization && Date.now() < authorizationUntil
                    ? "connected"
                    : "reconnect",
            )
        }
        const receive = (event: MessageEvent) => {
            if (
                event.source !== popup ||
                event.origin !== url.origin ||
                event.data?.protocol !== "emc-brainstorm-session/v1" ||
                event.data.requestId !== requestId
            )
                return
            const value = event.data.result
            if (
                !value?.authorization?.accessToken ||
                (currentContext && value.userId !== currentContext.userId)
            ) {
                clean()
                popup.close()
                reject(
                    new Error(
                        "EMC account changed. Open a new editor from Operations; your current changes remain here.",
                    ),
                )
                return
            }
            if (
                value.authorization.contextType !== type ||
                value.authorization.contextId !== id
            ) {
                clean()
                popup.close()
                reject(new Error("Workspace mismatch."))
                return
            }
            credentialGeneration++
            authorizationPending = null
            rememberAuthorization(value.authorization)
            const { authorization: _authorization, ...safeContext } = value
            currentContext = {
                ...safeContext,
                brief: currentContext?.brief || "",
            }
            clean()
            popup.close()
            window.dispatchEvent(new Event("emc-reconnected"))
            resolve(value)
        }
        const closedCheck = setInterval(() => {
            if (popup.closed) {
                clean()
                reject(
                    new Error(
                        "EMC connection window closed. Retry connection.",
                    ),
                )
            }
        }, 500)
        const timer = setTimeout(() => {
            clean()
            reject(
                new Error(
                    "EMC connection timed out. Keep this drawing open and retry.",
                ),
            )
        }, 120000)
        window.addEventListener("message", receive)
    })
    return reconnecting
}

/** Bootstrap the short-lived access token once, in memory only. The API still checks
 * permissions on every call; a suspended Operations tab need not answer each fetch. */
export async function connectOperations(
    isCancelled: () => boolean = () => false,
) {
    const cached =
        currentContext && authorization && Date.now() < authorizationUntil
            ? { ...currentContext, authorization }
            : null
    const generation = ++authorizationGeneration
    authorizationPending = null
    authorization = null
    authorizationUntil = 0
    const bootstrap =
        cached ||
        (await operationsRequest<
            OperationsContext & { authorization?: OperationsAuthorization }
        >("context"))
    if (isCancelled() || generation !== authorizationGeneration) return () => {}
    const { authorization: initialAuthorization, ...context } = bootstrap
    rememberAuthorization(initialAuthorization)
    currentContext = context
    if (window.parent === window && initialAuthorization) {
        const u = new URL(location.href)
        u.searchParams.set("contextType", initialAuthorization.contextType)
        u.searchParams.set("contextId", initialAuthorization.contextId)
        history.replaceState(history.state, "", u)
    }
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
        let response: Response
        if (
            url.pathname.endsWith("/api/chat") &&
            headers.get("x-selected-model-id") === EMC_MODEL_ID &&
            (
                init?.method ||
                (input instanceof Request ? input.method : "GET")
            ).toUpperCase() === "POST"
        ) {
            if (currentContext?.readOnly)
                return Response.json(
                    { error: "This workspace is read-only." },
                    { status: 403 },
                )
            const { emcClientChat } = await import("./emc-client-chat")
            response = await emcClientChat(
                new Request(input instanceof Request ? input : url.href, {
                    ...init,
                    headers,
                }),
            )
        } else {
            response = await original(input, { ...init, headers })
        }
        if (
            response.status === 401 &&
            authorization?.accessToken === auth.accessToken
        ) {
            authorization = null
            authorizationUntil = 0
            connection("reconnect")
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
    if (!isOperationsMode())
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
        authorizationUntil > 0 &&
        Date.now() >= authorizationUntil
    ) {
        return operationsAuthorization().then(() =>
            operationsRequest<T>(method, payload),
        )
    }
    if (
        ["list", "get", "save", "delete"].includes(method) &&
        authorization &&
        Date.now() < authorizationUntil
    ) {
        const auth = authorization
        return import("./operations-documents").then(
            async ({ operationsDocumentRequest }) => {
                try {
                    return (await operationsDocumentRequest(
                        new Request(
                            new URL(
                                getApiEndpoint("/api/operations-documents"),
                                location.href,
                            ),
                            {
                                headers: {
                                    "x-emc-access-token": auth.accessToken,
                                    "x-emc-context-type": auth.contextType,
                                    "x-emc-context-id": auth.contextId,
                                },
                            },
                        ),
                        { method, payload, brief: currentContext?.brief || "" },
                    )) as T
                } catch (error) {
                    if (
                        (error as { status?: number }).status === 401 &&
                        authorization === auth
                    ) {
                        authorization = null
                        authorizationUntil = 0
                        connection("reconnect")
                    }
                    throw error
                }
            },
        )
    }
    if (!host || host.closed)
        return Promise.reject(
            new Error(
                "Use Reconnect EMC in the main editor window to renew access.",
            ),
        )
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
            connection("reconnect")
            reject(
                new Error(
                    "Operations did not respond. Keep this drawing open and use Reconnect EMC in the main editor window, then retry.",
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
