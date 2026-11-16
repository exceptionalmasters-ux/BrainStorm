import { afterEach, describe, expect, it, vi } from "vitest"
import {
    OPERATIONS_PROTOCOL,
    operationsHost,
    operationsRequest,
} from "@/lib/operations-bridge"

afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(window, "opener", { configurable: true, value: null })
    window.history.replaceState(null, "", "/")
})

describe("Operations separate window bridge", () => {
    it("uses the opener and ignores responses from another window or origin", async () => {
        window.history.replaceState(null, "", "/?operations=1")
        vi.stubEnv(
            "NEXT_PUBLIC_EMC_OPERATIONS_ORIGIN",
            "https://operations.example",
        )
        const host = { closed: false, postMessage: vi.fn() }
        Object.defineProperty(window, "opener", {
            configurable: true,
            value: host,
        })
        expect(operationsHost()).toBe(host)
        const pending = operationsRequest("context")
        const [message, origin] = host.postMessage.mock.calls[0]
        expect(origin).toBe("https://operations.example")
        const response = {
            protocol: OPERATIONS_PROTOCOL,
            kind: "response",
            requestId: message.requestId,
            result: { brief: "Selected concept" },
        }
        window.dispatchEvent(
            new MessageEvent("message", {
                source: host as unknown as Window,
                origin: "https://untrusted.example",
                data: { ...response, error: "Wrong origin" },
            }),
        )
        window.dispatchEvent(
            new MessageEvent("message", {
                source: window,
                origin,
                data: { ...response, error: "Wrong window" },
            }),
        )
        window.dispatchEvent(
            new MessageEvent("message", {
                source: host as unknown as Window,
                origin,
                data: response,
            }),
        )
        await expect(pending).resolves.toEqual({ brief: "Selected concept" })
    })
    it("fails immediately when Operations is missing or closed", async () => {
        window.history.replaceState(null, "", "/?operations=1")
        await expect(operationsRequest("save")).rejects.toThrow(
            "Open this drawing from Operations",
        )
        Object.defineProperty(window, "opener", {
            configurable: true,
            value: { closed: true },
        })
        await expect(operationsRequest("save")).rejects.toThrow(
            "Open this drawing from Operations",
        )
    })
})
