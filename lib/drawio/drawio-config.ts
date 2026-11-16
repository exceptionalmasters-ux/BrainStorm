import { getAssetUrl } from "@/lib/base-path"
import type { Locale } from "@/lib/i18n/config"
import { BLANK_MXFILE } from "@/packages/mcp-server/src/pages.ts"

/** External draw.io configured at build time (cross-origin, limited features) */
const EXTERNAL_DRAWIO_URL = process.env.NEXT_PUBLIC_DRAWIO_BASE_URL || ""

/**
 * Where the editor comes from and how it starts. The web app fills it from
 * its build settings (webDrawioSource); the MCP's canvas shell from the
 * config its server writes into the page.
 */
export interface DrawioSource {
    /** The editor page: the bundled copy's index.html on this origin, or an
     * external draw.io (cross-origin, limited features) */
    editorUrl: string
    /** draw.io theme (its ui parameter); none: draw.io's default and the
     * user's own pick */
    ui?: string
    /** Language in draw.io's naming ("zh-tw"); none: draw.io's own pick */
    lang?: string
    /** No calls to external services (the desktop app) */
    offline?: boolean
    /** draw.io's custom libraries (File > New Library, Open Library from,
     * and the buttons under the shapes); the web app leaves them out */
    libraries?: boolean
}

/**
 * The web app's editor: the copy in public/drawio, served from our own
 * origin (index.html, as Next.js serves no directory indexes), or
 * NEXT_PUBLIC_DRAWIO_BASE_URL; the simple theme in the page's language.
 */
export function webDrawioSource(lang: Locale): DrawioSource {
    const isElectron = !!(window as { electronAPI?: unknown }).electronAPI
    return {
        editorUrl: EXTERNAL_DRAWIO_URL || getAssetUrl("/drawio/index.html"),
        ui: "simple",
        // draw.io names Traditional Chinese "zh-tw"
        lang: lang === "zh-Hant" ? "zh-tw" : lang,
        offline: isElectron && !EXTERNAL_DRAWIO_URL,
    }
}

/** URL of the draw.io editor iframe */
export function getDrawioSrc(source: DrawioSource, dark: boolean): string {
    const url = new URL(source.editorUrl, window.location.href)
    const params: Record<string, string> = {
        embed: "1",
        proto: "json",
        configure: "1",
    }
    // Without a fixed theme, embedded draw.io shows Extras > Theme only
    // with themes=1 (its isThemeMenuVisible)
    if (source.ui) params.ui = source.ui
    else params.themes = "1"
    Object.assign(params, {
        spin: "0",
        libraries: source.libraries ? "1" : "0",
        noSaveBtn: "1",
        noExitBtn: "1",
        saveAndExit: "0",
        // draw.io's own dark mode (switched in place later when the editor
        // can be driven directly)
        dark: dark ? "1" : "0",
    })
    if (source.lang) params.lang = source.lang
    if (source.offline) params.offline = "1"
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value)
    }
    return url.toString()
}

/**
 * Show the page (a white sheet with a grid) unless the diagram says
 * otherwise. AI output usually has a bare <mxGraphModel>, and draw.io's
 * simple UI would then show neither page nor grid.
 */
export function withPageDefaults(xml: string): string {
    return xml.replace(
        /<mxGraphModel\b([^>]*?)(\/?)>/g,
        (_match, attrs, slash) => {
            let next = attrs as string
            if (!/\spage\s*=/.test(next)) next += ' page="1"'
            if (!/\sgrid\s*=/.test(next)) next += ' grid="1"'
            if (!/\sgridSize\s*=/.test(next)) next += ' gridSize="10"'
            return `<mxGraphModel${next}${slash}>`
        },
    )
}

/** Empty document loaded when draw.io starts */
export const EMPTY_DRAWIO_DOCUMENT = withPageDefaults(BLANK_MXFILE)

/**
 * Editor defaults sent with draw.io's configure message. The simple UI turns
 * page view off for new diagrams; keep the white page on the canvas, as in
 * the classic UI.
 */
export const DRAWIO_CONFIG = {
    defaultPageVisible: true,
    defaultGridEnabled: true,
    // A trimmed shape palette on the left: the basics, arrows, flowchart and
    // electrical symbols. Other libraries stay reachable through draw.io's
    // "More shapes" where the editor offers it. Library ids still to be
    // checked against the bundled draw.io (see docs/project/05-plan.md)
    defaultLibraries: "general;basic;arrows2;flowchart;electrical",
    // A loaded diagram leaves the focus where it is (draw.io focuses its
    // window otherwise, and keys typed for the chat would go to the canvas)
    noAutoFocus: true,
}

/**
 * CSS injected into draw.io: the table around the sheet and its toolbar in
 * light mode. Dark mode keeps draw.io's own colors, except a black table around the sheet: the light rules only match
 * while draw.io is light (it puts geDarkMode on the body), so they need no
 * change when the theme switches. draw.io's link to its GitHub page (by
 * the page tabs) is hidden: on a phone it sits right above the tab bar.
 * The editor's document never scrolls: draw.io scrolls a page's tab into
 * view when the page changes, and where the document is wider than the
 * window (the menubar of the classic themes, by 32 px) the whole editor
 * moved left with it and stayed there. The sketch theme's box at the top
 * right holds the status text and the save and exit buttons, which the
 * embed parameters leave out: hidden while it is empty.
 */
export const DRAWIO_CSS = `
html, body { overflow: clip !important; }
.geSketch > .geToolbarContainer:has(> .geStatus:empty):has(> .geButtonContainer:empty) { display: none !important; }
body:not(.geDarkMode) {
    --workspace-color: #f4f5f7;
    --focus-color: #14181d;
}
body:not(.geDarkMode) .geDiagramContainer { background-color: #f4f5f7; }
body:not(.geDarkMode) .geBackgroundPage { box-shadow: 0 1px 2px rgba(20,24,29,.08), 0 12px 32px -12px rgba(20,24,29,.18) !important; }
body:not(.geDarkMode) .geSimpleMainMenu { border-bottom: 1px solid #e4e7eb !important; box-shadow: none !important; }
.geSidebarContainer[style*="width: 0px"] { border: none !important; }
body.geDarkMode { --workspace-color: #050505; }
body.geDarkMode .geDiagramContainer { background-color: #050505; }
/* Native palettes float above the page: opening a tool must not resize the graph. */
body.emc-shape-tools .emc-shape-overlay { position: absolute !important; left: 0 !important; top: var(--emc-tools-top, 48px) !important; bottom: 0 !important; width: 0 !important; z-index: 20; background: #101310; }
body.emc-shape-flyout .emc-shape-overlay { width: 232px !important; max-width: calc(100% - 32px); }
/* The flyout is viewport-bounded; native inline heights must not clip long palettes. */
body.emc-shape-tools .emc-shape-overlay { height: auto !important; min-height: 0 !important; overflow: hidden !important; }
body.emc-shape-flyout .emc-shape-scroll:not(.emc-shape-overlay) { position: absolute !important; inset: 0 !important; width: 100% !important; }
body.emc-shape-flyout .emc-shape-scroll { height: auto !important; max-height: none !important; overflow-x: hidden !important; overflow-y: scroll !important; scrollbar-gutter: stable; overscroll-behavior: contain; scrollbar-width: auto; scrollbar-color: #a48532 #101310; }
body.emc-shape-flyout .emc-shape-scroll::-webkit-scrollbar { width: 12px; }
body.emc-shape-flyout .emc-shape-scroll::-webkit-scrollbar-thumb { background: #a48532; border-radius: 6px; border: 2px solid #101310; }
body.emc-shape-flyout .emc-shape-scroll:has(.geSidebarFooter) > div:first-child { max-height: none !important; overflow: visible !important; }
body.emc-shape-tools .geDiagramContainer { left: 0 !important; }
body.emc-shape-tools .geHsplit { display: none !important; }
body.emc-shape-tools .geDiagramContainer, body.emc-shape-tools .geBackgroundPage { color-scheme: light; }
a[href*="github.com/jgraph/drawio"] { display: none !important; }
body.emc-shape-flyout .geSidebarContainer:not(.geFormatContainer) { border-right: 1px solid #a48532 !important; }
.emc-shape-header { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 3px; min-height: 40px; padding: 0 6px; box-sizing: border-box; background: #101310; color: #edcb6d; border-bottom: 1px solid #3d472c; font: 12px Arial, sans-serif; }
.emc-shape-header strong { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.emc-shape-header button { width: 28px; height: 30px; border: 1px solid transparent; border-radius: 5px; background: transparent; color: #edcb6d; cursor: pointer; font-size: 18px; }
.emc-shape-header button:hover, .emc-shape-header button:focus-visible, .emc-shape-header button[aria-pressed="true"] { border-color: #cfad46; background: #263b2a; }
/* Compact visual galleries use the native popup lifecycle and insertion actions. */
div.emc-quick-insert-menu { max-width: calc(100vw - 12px); max-height: min(320px, calc(100vh - 12px)); overflow: auto; padding: 6px !important; }
.emc-quick-insert-menu > table { width: auto !important; }
.emc-quick-insert-menu > table > tbody { display: grid; grid-template-columns: repeat(4, 48px); gap: 3px; }
.emc-quick-insert-menu [data-quick-insert] { display: flex; align-items: center; justify-content: center; width: 48px; height: 44px; border: 1px solid transparent; border-radius: 5px; cursor: pointer; }
.emc-quick-insert-menu [data-quick-insert]:hover, .emc-quick-insert-menu [data-quick-insert]:focus-visible { border-color: #a48532; outline: none; background: #a4853226; }
.emc-quick-insert-menu [data-quick-insert] > td:first-child { display: flex; align-items: center; justify-content: center; padding: 0 !important; width: 40px !important; background: transparent !important; }
.emc-quick-insert-menu [data-quick-insert] > td:not(:first-child) { position: absolute; width: 1px; height: 1px; padding: 0 !important; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.emc-shape-empty { padding: 12px; font: 12px Arial, sans-serif; }
`
