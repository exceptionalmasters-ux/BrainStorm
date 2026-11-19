/** Public BrainStorm document names; the contents remain editable diagram XML. */
export const STORM_EXTENSION = ".storm"
export const STORM_SVG_EXTENSION = ".storm.svg"

/** Accept existing draw.io documents as well as the BrainStorm extension. */
export function stripDiagramExtension(name: string): string {
    return name.replace(/\.(?:storm|drawio)(?:\.svg)?$/i, "")
}

/** Use a document's stem as its workspace title, including legacy XML/SVG imports. */
export function diagramFileTitle(name: string): string {
    const title = stripDiagramExtension(name)
    return title === name ? name.replace(/\.(?:xml|svg)$/i, "") : title
}
