// @vitest-environment node
import { Socket } from "node:net"
import { expect, it } from "vitest"

it("blocks unmocked fetch and TCP transports before fixture data can leave the process", async () => {
    await expect(fetch("https://provider.invalid")).rejects.toThrow(
        "disabled in unit tests",
    )
    expect(() =>
        new Socket().connect({ host: "provider.invalid", port: 443 }),
    ).toThrow("disabled in unit tests")
})
