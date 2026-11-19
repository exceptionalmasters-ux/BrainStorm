import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { LibraryRail } from "../../components/workspace/library-rail"

const fixture = vi.hoisted(() => ({
    labels: {},
    close: vi.fn(),
    open: vi.fn(),
    dispose: vi.fn(),
}))
vi.mock("@/hooks/use-dictionary", () => ({
    useDictionary: () => ({ toolbox: fixture.labels }),
}))
vi.mock("@/stores/canvas-store", () => ({
    useCanvasStore: (fn: any) => fn({ hasEditor: true }),
}))
vi.mock("@/lib/operations-bridge", () => ({
    getOperationsContext: () => ({ userId: "alice" }),
}))
vi.mock("@/components/canvas/shape-toolbox-rail", () => ({
    ShapeToolboxRail: ({ settings }: any) => (
        <aside data-testid="default-rail">{settings}</aside>
    ),
}))
vi.mock("@/lib/drawio/editor-bridge", () => ({
    attachNativeTool: (fn: any) =>
        fn(
            {
                sidebar: {
                    entries: [
                        {
                            title: "Standard",
                            entries: [
                                { id: "general", title: "General" },
                                { id: "electrical", title: "Electrical" },
                            ],
                        },
                    ],
                    configuration: [],
                },
            },
            {},
        ),
    connectShapeToolbox: () => ({ ...fixture }),
}))
beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
})
afterEach(cleanup)
it("loads account presets in another browser without restoring session libraries", async () => {
    let saved: any[] = []
    const request = vi.fn(async (action: string, body: any) => {
        if (action === "presets-save")
            saved = [...saved.filter((p) => p.id !== body.id), body]
        return [...saved]
    })
    const view = render(<LibraryRail presetRequest={request} />)
    expect(screen.queryByRole("button", { name: "Electrical" })).toBe(null)
    fireEvent.click(
        screen.getByRole("button", { name: "Libraries and presets" }),
    )
    await waitFor(() => expect(screen.queryByRole("status")).toBe(null))
    fireEvent.click(screen.getByLabelText(/Electrical/))
    fireEvent.change(screen.getByLabelText("Preset name"), {
        target: { value: "Electronics" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save new preset" }))
    await waitFor(() =>
        expect(
            screen.getByRole("option", { name: "Electronics" }),
        ).toBeTruthy(),
    )
    expect(screen.queryByRole("button", { name: "Electrical" })).toBe(null)
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(screen.getByRole("button", { name: "Electrical" })).toBeTruthy()
    view.unmount()
    localStorage.clear()
    render(<LibraryRail presetRequest={request} />)
    expect(screen.queryByRole("button", { name: "Electrical" })).toBe(null)
    fireEvent.click(
        screen.getByRole("button", { name: "Libraries and presets" }),
    )
    await waitFor(() =>
        expect(
            screen.getByRole("option", { name: "Electronics" }),
        ).toBeTruthy(),
    )
    expect(screen.queryByLabelText("Remember as my editor default")).toBe(null)
})
it("lets observers save a personal preset without applying it to the board", async () => {
    const request = vi.fn(async (action, body) =>
        action === "presets-list" ? [] : [body],
    )
    const apply = vi.fn()
    render(
        <LibraryRail
            shared
            editable={false}
            libraries={["electrical"]}
            presetRequest={request}
            onChange={apply}
        />,
    )
    fireEvent.click(
        screen.getByRole("button", { name: "Libraries and presets" }),
    )
    await waitFor(() => expect(screen.queryByRole("status")).toBe(null))
    fireEvent.change(screen.getByLabelText("Preset name"), {
        target: { value: "My board set" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save new preset" }))
    await waitFor(() =>
        expect(request).toHaveBeenCalledWith(
            "presets-save",
            expect.objectContaining({
                name: "My board set",
                libraries: ["electrical"],
            }),
        ),
    )
    expect(apply).not.toHaveBeenCalled()
    expect(
        (screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement)
            .disabled,
    ).toBe(true)
})
it("reports account failures without pretending to save locally", async () => {
    render(
        <LibraryRail
            presetRequest={async () => {
                throw Error("Offline")
            }}
        />,
    )
    fireEvent.click(
        screen.getByRole("button", { name: "Libraries and presets" }),
    )
    await waitFor(() =>
        expect(screen.getByRole("alert").textContent).toContain(
            "Could not load account presets",
        ),
    )
    expect(localStorage.length).toBe(0)
})
it("starts shared boards empty, fences observer application and applies editor selection", () => {
    const apply = vi.fn(),
        view = render(
            <LibraryRail
                presetRequest={async () => []}
                shared
                userId="alice"
                editable={false}
                onChange={apply}
            />,
        )
    expect(screen.queryByRole("button", { name: "Electrical" })).toBe(null)
    fireEvent.click(
        screen.getByRole("button", { name: "Libraries and presets" }),
    )
    fireEvent.click(screen.getByLabelText(/Electrical/))
    expect(
        (
            screen.getByRole("button", {
                name: "Apply",
            }) as HTMLButtonElement
        ).disabled,
    ).toBe(true)
    expect(apply).not.toHaveBeenCalled()
    view.rerender(
        <LibraryRail shared userId="alice" editable onChange={apply} />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(apply).toHaveBeenCalledWith(["electrical"])
    view.rerender(
        <LibraryRail
            shared
            userId="alice"
            editable
            libraries={["electrical"]}
            onChange={apply}
        />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Electrical" }))
    expect(fixture.open).toHaveBeenCalledWith(
        "search",
        "Electrical",
        "electrical",
    )
    const closes = fixture.close.mock.calls.length
    view.rerender(
        <LibraryRail
            shared
            userId="alice"
            editable
            libraries={["electrical"]}
            onChange={apply}
        />,
    )
    expect(fixture.close.mock.calls.length).toBe(closes)
})
