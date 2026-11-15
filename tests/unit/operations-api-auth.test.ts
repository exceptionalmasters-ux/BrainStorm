// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import { GET as editorConfig } from "@/app/api/config/route"

vi.mock("@/lib/langfuse", () => ({ getLangfuseClient: () => null }))

import { verifyOperationsRequest } from "@/lib/operations-api-auth"

afterEach(() => vi.unstubAllGlobals())
const request = (path = "chat", token = "test-access-token") =>
    new Request(`https://editor.example/api/${path}`, {
        headers: {
            "x-emc-access-token": token,
            "x-emc-context-type": "project",
            "x-emc-context-id": "00000000-0000-4000-8000-000000000001",
        },
    })
const configure = () => {
    vi.stubEnv("EMC_OPERATIONS_ONLY", "1")
    vi.stubEnv("EMC_SUPABASE_URL", "https://test.supabase.co")
    vi.stubEnv("EMC_SUPABASE_PUBLISHABLE_KEY", "public-test-key")
}

describe("Operations API authorization (all requests mocked)", () => {
    it("refuses missing sessions and missing server configuration", async () => {
        configure()
        expect(
            (
                await verifyOperationsRequest(
                    new Request("https://editor.example/api/chat"),
                )
            )?.status,
        ).toBe(401)
        vi.stubEnv("EMC_SUPABASE_PUBLISHABLE_KEY", "")
        expect((await verifyOperationsRequest(request()))?.status).toBe(401)
    })
    it("checks the caller and workspace through the existing database/MFA guard", async () => {
        configure()
        const fetch = vi
            .fn()
            .mockResolvedValue(Response.json({ readOnly: false }))
        vi.stubGlobal("fetch", fetch)
        expect(await verifyOperationsRequest(request())).toBeNull()
        expect(fetch).toHaveBeenCalledWith(
            "https://test.supabase.co/rest/v1/rpc/brainstorm_context",
            expect.objectContaining({
                cache: "no-store",
                headers: expect.objectContaining({
                    Authorization: "Bearer test-access-token",
                    apikey: "public-test-key",
                }),
            }),
        )
        fetch.mockResolvedValue(Response.json({}, { status: 403 }))
        expect((await verifyOperationsRequest(request()))?.status).toBe(403)
    })
    it("blocks AI changes in a terminal workspace and fails closed on connection errors", async () => {
        configure()
        const fetch = vi
            .fn()
            .mockImplementation(async () => Response.json({ readOnly: true }))
        vi.stubGlobal("fetch", fetch)
        expect((await verifyOperationsRequest(request()))?.status).toBe(403)
        expect(
            await verifyOperationsRequest(request("server-models")),
        ).toBeNull()
        fetch.mockRejectedValue(new Error("offline"))
        expect((await verifyOperationsRequest(request()))?.status).toBe(503)
    })
    it("does not ask Operations users for an additional editor access code", async () => {
        vi.stubEnv("ACCESS_CODE_LIST", "standalone-test-code")
        const integrated = await editorConfig(request())
        expect((await integrated.json()).accessCodeRequired).toBe(false)
        const standalone = await editorConfig(
            new Request("https://editor.example/api/config"),
        )
        expect((await standalone.json()).accessCodeRequired).toBe(true)
    })
    it("retains standalone mode only when Operations-only mode is explicitly off", async () => {
        vi.stubEnv("EMC_OPERATIONS_ONLY", "")
        expect(
            await verifyOperationsRequest(
                new Request("https://editor.example/api/chat"),
            ),
        ).toBeNull()
        vi.stubEnv("EMC_SUPABASE_URL", "")
        expect((await verifyOperationsRequest(request()))?.status).toBe(401)
    })
})
