export const DEFAULT_LIBRARY_IDS = [
    "general",
    "basic",
    "arrows2",
    "flowchart",
    "electrical",
    "emc",
]
export type LibraryPreset = { id: string; name: string; libraries: string[] }
export const validLibraryIds = (value: unknown): value is string[] =>
    Array.isArray(value) &&
    value.length <= 200 &&
    value.every(
        (id) => typeof id === "string" && /^[\w. -]{1,128}$/.test(id),
    ) &&
    new Set(value).size === value.length
export function readLibraryPreferences(user: string) {
    try {
        const data = JSON.parse(
            localStorage.getItem("emc-library-presets:" + user) || "{}",
        )
        return {
            normal: validLibraryIds(data.normal) ? data.normal : null,
            presets: Array.isArray(data.presets)
                ? data.presets
                      .filter(
                          (p: LibraryPreset) =>
                              p &&
                              typeof p.id === "string" &&
                              p.id.length <= 128 &&
                              typeof p.name === "string" &&
                              p.name.trim().length > 0 &&
                              p.name.length <= 80 &&
                              validLibraryIds(p.libraries),
                      )
                      .slice(0, 30)
                : ([] as LibraryPreset[]),
        }
    } catch {
        return { normal: null, presets: [] as LibraryPreset[] }
    }
}
export function writeLibraryPreferences(
    user: string,
    normal: string[] | null,
    presets: LibraryPreset[],
) {
    localStorage.setItem(
        "emc-library-presets:" + user,
        JSON.stringify({ normal, presets }),
    )
}
