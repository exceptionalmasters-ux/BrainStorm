import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DocumentWorkbench } from "@/components/workspace/document-workbench"
import {
    WORKBENCH_PROTOCOL,
    type WorkbenchEvent,
} from "@/lib/document-workbench"

vi.mock("@/components/workspace/workspace", () => ({
    Workspace: () => <textarea data-testid="root-draft" />,
}))
vi.mock("@/lib/operations-bridge", () => ({
    isOperationsMode: () => false,
    getOperationsContext: () => null,
    connectOperations: vi.fn(),
    OPERATIONS_PROTOCOL: "emc-brainstorm/v1",
    operationsParentOrigin: () => "https://operations.example",
}))
vi.mock("sonner", () => ({ toast: { info: vi.fn() } }))
const notify = (event: WorkbenchEvent) =>
    act(() => {
        window.dispatchEvent(
            new CustomEvent("brainstorm-workbench", { detail: event }),
        )
    })
afterEach(() => {
    cleanup()
    window.history.replaceState(null, "", "/")
    sessionStorage.clear()
})

describe("document workbench", () => {
    it("keeps the root mounted and gives new documents stable independent frame URLs", async () => {
        render(<DocumentWorkbench />)
        const draft = await screen.findByTestId("root-draft")
        fireEvent.change(draft, { target: { value: "Original draft" } })
        notify({
            type: "state",
            sessionId: "original",
            title: "Original",
            busy: false,
        })
        fireEvent.click(screen.getByRole("button", { name: "New drawing" }))
        const frame = screen.getByTestId("document-frame") as HTMLIFrameElement
        const src = frame.src
        expect(new URL(src).searchParams.get("workbenchId")).toBeTruthy()
        expect(new URL(src).searchParams.has("session")).toBe(false)
        expect(screen.getAllByRole("tab")).toHaveLength(2)
        act(() => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    origin: window.location.origin,
                    source: frame.contentWindow,
                    data: {
                        protocol: WORKBENCH_PROTOCOL,
                        type: "state",
                        sessionId: "second",
                        title: "Second",
                        busy: false,
                    },
                }),
            )
        })
        expect(frame.src).toBe(src)
        fireEvent.click(screen.getByRole("tab", { name: "Original" }))
        expect(screen.getByTestId("root-draft")).toBe(draft)
        expect((draft as HTMLTextAreaElement).value).toBe("Original draft")
        expect(
            JSON.parse(
                sessionStorage.getItem("brainstorm-open-documents") || "[]",
            ),
        ).toEqual(["original", "second"])
        notify({ type: "open", sessionId: "second" })
        expect(screen.getAllByRole("tab")).toHaveLength(2)
        expect(
            screen
                .getByRole("tab", { name: "Second" })
                .getAttribute("aria-selected"),
        ).toBe("true")
    })
    it("ignores child events from foreign origins or unknown windows", async () => {
        render(<DocumentWorkbench />)
        await screen.findByTestId("root-draft")
        fireEvent.click(screen.getByRole("button", { name: "New drawing" }))
        const frame = screen.getByTestId("document-frame") as HTMLIFrameElement
        for (const event of [
            { origin: "https://evil.example", source: frame.contentWindow },
            { origin: window.location.origin, source: window },
        ])
            act(() => {
                window.dispatchEvent(
                    new MessageEvent("message", {
                        ...event,
                        data: { protocol: WORKBENCH_PROTOCOL, type: "close" },
                    }),
                )
            })
        expect(screen.getAllByRole("tab")).toHaveLength(2)
        act(() => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    origin: window.location.origin,
                    source: frame.contentWindow,
                    data: { protocol: WORKBENCH_PROTOCOL, type: "close" },
                }),
            )
        })
        expect(screen.getAllByRole("tab")).toHaveLength(1)
    })
})
