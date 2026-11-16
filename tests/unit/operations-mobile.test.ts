import { afterEach, describe, expect, it, vi } from "vitest"
import {
    connectOperations,
    getOperationsContext,
    OPERATIONS_PROTOCOL,
    operationsAuthorization,
    operationsRequest,
} from "@/lib/operations-bridge"

let disconnect: (() => void) | undefined
afterEach(() => {
    disconnect?.()
    disconnect = undefined
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
        expect(fetchMock).toHaveBeenCalledTimes(2)
        for (const call of fetchMock.mock.calls)
            expect(new Headers(call[1].headers).get("x-emc-access-token")).toBe(
                auth.accessToken,
            )
        expect(String(fetchMock.mock.calls[1][0])).toContain(
            "/api/operations-documents",
        )
        expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
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
