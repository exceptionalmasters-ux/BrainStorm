import { afterEach, expect, it, vi } from "vitest"
import { accountPresetRequest } from "../../lib/account-library-presets"

vi.mock("../../lib/operations-bridge", () => ({
    operationsAuthorization: async () => ({ accessToken: "fixture-token" }),
}))
afterEach(() => vi.unstubAllGlobals())
it("loads the current account using its existing authorization without a caller-selected owner", async () => {
    const fetcher = vi.fn(async () =>
        Response.json([
            { id: "one", name: "Electrical", libraries: ["electrical"] },
        ]),
    )
    vi.stubGlobal("fetch", fetcher)
    const rows = await accountPresetRequest("presets-list", {})
    expect(rows[0].name).toBe("Electrical")
    const [, request] = fetcher.mock.calls[0] as unknown as [
        string,
        RequestInit,
    ]
    expect(request.headers).toMatchObject({
        Authorization: "Bearer fixture-token",
    })
    expect(JSON.parse(request.body as string)).toEqual({
        p_action: "presets-list",
        p_payload: {},
    })
    expect(request.cache).toBe("no-store")
})
it("surfaces server failures instead of accepting a local save", async () => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
            Response.json({ message: "Sign in again" }, { status: 401 }),
        ),
    )
    await expect(accountPresetRequest("presets-save", {})).rejects.toThrow(
        "Sign in again",
    )
})
