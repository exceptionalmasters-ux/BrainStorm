import { LIBRARIES } from "./shape-library-catalog.ts"
import { SHAPE_LIBRARY_DOCS } from "./shape-library-docs.ts"

/** Browser/Worker lookup without filesystem or Node imports. */
export function getBundledShapeLibrary(
    name: string,
): { ok: true; text: string } | { ok: false; error: string } {
    const library = name.trim().toLowerCase()
    if (LIBRARIES.has(library) && SHAPE_LIBRARY_DOCS[library]) {
        return { ok: true, text: SHAPE_LIBRARY_DOCS[library] }
    }
    return {
        ok: false,
        error: `Library "${name}" not found. Available: ${Array.from(LIBRARIES).join(", ")}`,
    }
}
