// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest"
import { emcStreamError, readEmcJson } from "@/lib/emc-errors"
import {
    researchDevice,
    useDeviceResearch,
} from "@/stores/device-research-store"

afterEach(() => vi.unstubAllGlobals())
it("shows fresh results for three consecutive Web searches and recovers after a proxy error", async () => {
    useDeviceResearch.setState({ webEnabled: true, draft: null, result: null })
    let turn = 0
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
            turn++
            if (turn === 4)
                return new Response("<html>Bad gateway</html>", { status: 502 })
            return Response.json({
                researchId: `research-${turn}`,
                questions: [],
                candidates: [
                    {
                        id: `candidate-${turn}`,
                        title: `Device ${turn}`,
                        sourceUrl: "https://manufacturer.example",
                    },
                ],
            })
        }),
    )
    for (let index = 1; index <= 3; index++) {
        const promise = researchDevice(`Model ${index}`)
        expect(useDeviceResearch.getState().result).toBeNull()
        await promise
        expect(useDeviceResearch.getState().result?.researchId).toBe(
            `research-${index}`,
        )
        expect(useDeviceResearch.getState().busy).toBe(false)
    }
    await expect(researchDevice("Model 4")).rejects.toThrow(
        "unreadable response (HTTP 502)",
    )
    expect(useDeviceResearch.getState().busy).toBe(false)
    await researchDevice("Model 5")
    expect(useDeviceResearch.getState().result?.researchId).toBe("research-5")
    expect(useDeviceResearch.getState().error).toBe("")
})
it("distinguishes provider key failure from sign-in and rejects invalid successful responses", async () => {
    expect(
        emcStreamError(
            {
                responseBody: JSON.stringify({
                    code: "provider_credentials",
                    error: "EMC OpenAI credentials need updating.",
                }),
            },
            503,
        ),
    ).toMatchObject({ code: "invalid_api_key" })
    await expect(readEmcJson(Response.json(null))).rejects.toThrow(
        "invalid response",
    )
    await expect(
        readEmcJson(
            Response.json({ error: "Session expired" }, { status: 401 }),
        ),
    ).rejects.toThrow("Session expired")
})
