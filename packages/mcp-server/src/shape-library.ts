/**
 * Shape and icon library docs (docs/shape-libraries/*.md), the same files
 * the web app's get_shape_library tool reads (app/api/chat/route.ts).
 */

import { readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { LIBRARIES } from "./shape-library-catalog.ts"

export { getBundledShapeLibrary } from "./bundled-shape-library.ts"
export { SHAPE_LIBRARY_LIST } from "./shape-library-catalog.ts"

/**
 * The build copies the docs to dist/shape-libraries; running from src (tsx)
 * reads them from the repository instead. The web app passes its own folder.
 */
function libraryDirs(dir?: string): string[] {
    if (dir) return [dir]
    const here = dirname(fileURLToPath(import.meta.url))
    return [
        join(here, "shape-libraries"),
        resolve(here, "../../../docs/shape-libraries"),
    ]
}

export async function getShapeLibrary(
    name: string,
    dir?: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
    const library = name.trim().toLowerCase()
    if (!LIBRARIES.has(library)) {
        return {
            ok: false,
            error: `Library "${name}" not found. Available: ${Array.from(LIBRARIES).join(", ")}`,
        }
    }
    for (const folder of libraryDirs(dir)) {
        try {
            return {
                ok: true,
                text: await readFile(join(folder, `${library}.md`), "utf-8"),
            }
        } catch {
            // Try the next location
        }
    }
    return {
        ok: false,
        error: `Library "${library}" is missing from this installation.`,
    }
}

