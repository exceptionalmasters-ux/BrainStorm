import { beforeEach, expect, it } from "vitest"
import {
    readLibraryPreferences,
    validLibraryIds,
    writeLibraryPreferences,
} from "../../lib/library-presets"

beforeEach(() => localStorage.clear())
it("keeps browser presets separate per account and preserves gear-only selections", () => {
    writeLibraryPreferences(
        "alice",
        [],
        [{ id: "e", name: "Electronics", libraries: ["electrical", "emc"] }],
    )
    expect(readLibraryPreferences("alice")).toEqual({
        normal: [],
        presets: [
            { id: "e", name: "Electronics", libraries: ["electrical", "emc"] },
        ],
    })
    expect(readLibraryPreferences("bob")).toEqual({ normal: null, presets: [] })
})
it("rejects malformed or unbounded palette IDs and storage", () => {
    for (const v of [
        null,
        ["a", "a"],
        ["https://example.com/a"],
        ["x".repeat(129)],
        Array(201).fill("a"),
    ])
        expect(validLibraryIds(v)).toBe(false)
    expect(validLibraryIds(["general", ".scratchpad", "fluid_power"])).toBe(
        true,
    )
    localStorage.setItem("emc-library-presets:a", "broken")
    expect(readLibraryPreferences("a").normal).toBe(null)
    localStorage.setItem(
        "emc-library-presets:a",
        JSON.stringify({
            presets: [null, { id: "x", name: "", libraries: [] }],
        }),
    )
    expect(readLibraryPreferences("a").presets).toEqual([])
})
