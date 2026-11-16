/**
 * Tests for the shape library docs (docs/shape-libraries/*.md) that the
 * get_shape_library tool returns.
 */

import { describe, expect, it } from "vitest"
import {
    getBundledShapeLibrary,
    getShapeLibrary,
    SHAPE_LIBRARY_LIST,
} from "../src/shape-library.ts"

const libraries = SHAPE_LIBRARY_LIST.split("\n").flatMap((line) =>
    line.replace(/^- [^:]+: /, "").split(", "),
)

describe("shape library docs", () => {
    it.each(libraries)("%s lists shape names only", async (name) => {
        const library = await getShapeLibrary(name)
        expect(library.ok).toBe(true)
        if (!library.ok) return
        // A model puts each entry after the prefix: the prefix itself among
        // them gave resIcon=mxgraph.aws4.mxgraph.aws4
        const entries = Array.from(
            library.text.matchAll(/^- `([^`]+)`$/gm),
            (m) => m[1],
        )
        expect(entries.filter((e) => e.startsWith("mxgraph."))).toEqual([])
    })
})

describe("Worker-bundled shape library docs", () => {
    it.each(libraries)("%s works without a deployed filesystem", async (name) => {
        const bundled = getBundledShapeLibrary(name)
        const source = await getShapeLibrary(name)
        expect(bundled).toEqual(source)
    })
    it("rejects unknown names instead of interpreting them as paths", () => {
        expect(getBundledShapeLibrary("../secret").ok).toBe(false)
    })
})
