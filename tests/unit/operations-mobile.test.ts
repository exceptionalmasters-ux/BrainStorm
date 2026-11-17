import { afterEach, describe, expect, it, vi } from "vitest"
import { emcClientChat } from "@/lib/emc-client-chat"
import {
    connectOperations,
    getEmcConnectionState,
    getOperationsContext,
    OPERATIONS_PROTOCOL,
    operationsAuthorization,
    operationsRequest,
    reconnectOperations,
} from "@/lib/operations-bridge"
import { operationsDocumentRequest } from "@/lib/operations-documents"

vi.mock("@/lib/operations-documents", () => ({
    operationsDocumentRequest: vi.fn(async () => ({ revision: 1 })),
}))
vi.mock("@/lib/emc-client-chat", () => ({
    emcClientChat: vi.fn(async () => Response.json({ localStream: true })),
}))

let disconnect: (() => void) | undefined
afterEach(() => {
    disconnect?.()
    disconnect = undefined
    vi.clearAllMocks()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    Object.defineProperty(window, "opener", { configurable: true, value: null })
    window.history.replaceState(null, "", "/")
})
const contextId = "00000000-0000-4000-8000-000000000001"
function bootstrap(expiresAt = Date.now() + 600000) {
    window.history.replaceState(null, "", "/?operations=1")
    vi.stubEnv(
        "NEXT_PUBLIC_EMC_OPERATIONS_ORIGIN",
        "https://operations.example",
    )
    const auth = {
        accessToken: "memory-only-fixture-token",
        contextType: "project",
        contextId,
        expiresAt,
    }
    const host = {
        closed: false,
        postMessage: vi.fn((message: any) => {
            if (message.method !== "context") return // A suspended parent never answers authorize/save.
            window.dispatchEvent(
                new MessageEvent("message", {
                    source: host as unknown as Window,
                    origin: "https://operations.example",
                    data: {
                        protocol: OPERATIONS_PROTOCOL,
                        kind: "response",
                        requestId: message.requestId,
                        result: {
                            label: "Project",
                            userId: "actor",
                            readOnly: false,
                            brief: "Approved concept",
                            authorization: auth,
                        },
                    },
                }),
            )
        }),
    }
    Object.defineProperty(window, "opener", { configurable: true, value: host })
    return { host, auth }
}
describe("mobile Operations authorisation", () => {
    it("uses a still-valid lease in its last 30 seconds without waking a suspended parent", async () => {
        const { host, auth } = bootstrap(Date.now() + 20000)
        disconnect = await connectOperations()
        expect(await operationsAuthorization()).toEqual(auth)
        expect(getEmcConnectionState()).toBe("connected")
        expect(host.postMessage).toHaveBeenCalledTimes(1)
    })
    it("shows reconnect when the lease expires without discarding the drawing context", async () => {
        const { auth } = bootstrap(Date.now() + 600000)
        disconnect = await connectOperations()
        vi.spyOn(Date, "now").mockReturnValue(auth.expiresAt + 1)
        expect(getEmcConnectionState()).toBe("reconnect")
        expect(getOperationsContext()?.label).toBe("Project")
    })

    it("saves after the original Operations tab is closed", async () => {
        const fetchMock = vi.fn(async () => Response.json({ revision: 1 }))
        vi.stubGlobal("fetch", fetchMock)
        const { host } = bootstrap()
        disconnect = await connectOperations()
        host.closed = true
        Object.defineProperty(window, "opener", {
            configurable: true,
            value: null,
        })
        expect(
            await operationsRequest("save", {
                session: { id: "drawing" },
                expectedRevision: 0,
            }),
        ).toEqual({ revision: 1 })
        expect(fetchMock).not.toHaveBeenCalled()
        expect(operationsDocumentRequest).toHaveBeenCalledOnce()
    })
    it("reconnects only through the exact EMC popup, nonce, account and context", async () => {
        vi.stubGlobal("fetch", vi.fn())
        const { auth } = bootstrap()
        disconnect = await connectOperations()
        const popup = { close: vi.fn() }
        const open = vi
            .spyOn(window, "open")
            .mockReturnValue(popup as unknown as Window)
        const pending = reconnectOperations()
        const url = new URL(open.mock.calls[0][0] as string)
        const requestId = url.searchParams.get("requestId")
        const data = {
            protocol: "emc-brainstorm-session/v1",
            requestId,
            result: {
                label: "Project",
                userId: "actor",
                readOnly: false,
                brief: "DO NOT REPLACE",
                authorization: { ...auth, accessToken: "renewed" },
            },
        }
        window.dispatchEvent(
            new MessageEvent("message", {
                source: window,
                origin: url.origin,
                data,
            }),
        )
        window.dispatchEvent(
            new MessageEvent("message", {
                source: popup as unknown as Window,
                origin: "https://evil.example",
                data,
            }),
        )
        expect(popup.close).not.toHaveBeenCalled()
        window.dispatchEvent(
            new MessageEvent("message", {
                source: popup as unknown as Window,
                origin: url.origin,
                data,
            }),
        )
        await pending
        expect((await operationsAuthorization()).accessToken).toBe("renewed")
        expect(getOperationsContext()?.brief).toBe("Approved concept")
        expect(getOperationsContext()).not.toHaveProperty("authorization")
    })
    it("can query APIs and save when the parent stops processing messages", async () => {
        const fetchMock = vi.fn(async (_input: any, _init: any) =>
            Response.json({ revision: 1 }),
        )
        vi.stubGlobal("fetch", fetchMock)
        const { host, auth } = bootstrap()
        const persist = vi.spyOn(Storage.prototype, "setItem")
        disconnect = await connectOperations()
        expect(getOperationsContext()).not.toHaveProperty("authorization")
        expect(await operationsAuthorization()).toEqual(auth)
        await window.fetch("/api/chat", { method: "POST", body: "{}" })
        await operationsRequest("save", {
            session: { id: "drawing" },
            expectedRevision: 0,
        })
        expect(host.postMessage.mock.calls.map((c) => c[0].method)).toEqual([
            "context",
        ])
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(
            new Headers(fetchMock.mock.calls[0][1].headers).get(
                "x-emc-access-token",
            ),
        ).toBe(auth.accessToken)
        const [request, body] = vi.mocked(operationsDocumentRequest).mock
            .calls[0]
        expect(request.headers.get("x-emc-access-token")).toBe(auth.accessToken)
        expect(body).toMatchObject({
            method: "save",
            brief: "Approved concept",
        })
        expect(persist).not.toHaveBeenCalled()
    })
    it("discards a rejected lease and asks Operations again instead of reusing it", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                Response.json({ error: "expired" }, { status: 401 }),
            ),
        )
        const { host } = bootstrap()
        disconnect = await connectOperations()
        await window.fetch("/api/config")
        const pending = operationsAuthorization()
        const call = host.postMessage.mock.calls.at(-1)![0]
        expect(call.method).toBe("authorize")
        window.dispatchEvent(
            new MessageEvent("message", {
                source: host as unknown as Window,
                origin: "https://operations.example",
                data: {
                    protocol: OPERATIONS_PROTOCOL,
                    kind: "response",
                    requestId: call.requestId,
                    error: "Session expired",
                },
            }),
        )
        await expect(pending).rejects.toThrow("Session expired")
    })
})

it("streams EMC through the gateway transport and keeps other models on their chosen route", async () => {
    const original = vi.fn(async () => Response.json({ alternate: true }))
    vi.stubGlobal("fetch", original)
    const { auth } = bootstrap()
    disconnect = await connectOperations()
    await window.fetch("/api/chat", {
        method: "POST",
        headers: { "x-selected-model-id": "server:emc-openai:default" },
        body: "{}",
    })
    expect(emcClientChat).toHaveBeenCalledOnce()
    expect(original).not.toHaveBeenCalled()
    const request = vi.mocked(emcClientChat).mock.calls[0][0]
    expect(request.headers.get("x-emc-access-token")).toBe(auth.accessToken)
    await window.fetch("/api/chat", {
        method: "POST",
        headers: { "x-selected-model-id": "user:other-model" },
        body: "{}",
    })
    expect(original).toHaveBeenCalledOnce()
})
