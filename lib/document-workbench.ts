export const WORKBENCH_PROTOCOL = "brainstorm-documents/v1"
export type WorkbenchEvent =
    | { type: "reconnect" }
    | { type: "exit" }
    | { type: "new" }
    | { type: "open"; sessionId: string }
    | { type: "import"; file: File }
    | { type: "close" }
    | {
          type: "state"
          sessionId: string | null
          title: string
          busy: boolean
          dirty?: boolean
      }

export interface FlushDocumentEvent extends Event {
    detail: { resolve: (ok: boolean) => void }
}

export function notifyWorkbench(event: WorkbenchEvent) {
    if (
        new URLSearchParams(window.location.search).get("documentFrame") === "1"
    ) {
        if (window.parent === window) return false
        window.parent.postMessage(
            { protocol: WORKBENCH_PROTOCOL, ...event },
            window.location.origin,
        )
    } else {
        if (!document.querySelector('[data-testid="document-workbench"]'))
            return false
        window.dispatchEvent(
            new CustomEvent("brainstorm-workbench", { detail: event }),
        )
    }
    return true
}

export function composerStorageKey() {
    if (typeof window === "undefined") return "next-ai-draw-io-input"
    const id = new URLSearchParams(window.location.search).get("workbenchId")
    return id ? `brainstorm-input:${id}` : "next-ai-draw-io-input"
}

/** Shell keyboard shortcuts belong to the visible document, never a hidden root. */
export function isCurrentDocumentActive() {
    return !document.querySelector(
        '[data-testid="document-frame"][data-active="true"]',
    )
}
