/** Expand only the selected library's first palette, retaining native deferred loading. */
export function expandLibraryPalette(sidebar: any, library: string) {
    const config = sidebar.configuration?.find(
        (entry: any) => entry.id === library,
    )
    const paletteId = (config?.prefix || "") + (config?.libs?.[0] || library)
    const palette = sidebar.palettes?.[paletteId]
    const contents = palette?.[1]?.querySelector?.(".geSidebar")
    if (contents?.style.display === "none") palette?.[0]?.click?.()
}
