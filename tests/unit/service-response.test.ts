// @vitest-environment node
import { describe, expect, it } from "vitest"
import { readServiceJson } from "@/lib/service-response"

describe("Operations service responses", () => {
    it.each([200, 502])(
        "keeps HTML out of saved state at HTTP %s",
        async (status) => {
            await expect(
                readServiceJson(
                    new Response(
                        "<!DOCTYPE html><h1>Worker exceeded resource limits</h1>",
                        { status },
                    ),
                    "Operations",
                ),
            ).rejects.toThrow("Your drawing is kept")
        },
    )
    it("keeps actionable access errors and accepts a JSON acknowledgement", async () => {
        await expect(
            readServiceJson(
                Response.json({ message: "Session revoked" }, { status: 403 }),
                "Operations",
            ),
        ).rejects.toThrow("Session revoked")
        expect(
            await readServiceJson(Response.json({ revision: 4 }), "Operations"),
        ).toEqual({ revision: 4 })
    })
})
