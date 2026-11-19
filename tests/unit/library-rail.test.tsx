import { cleanup, fireEvent, render, screen } from "@testing-library/react"
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
it("keeps normal defaults, persists a named set and restores the remembered custom rail", () => {
    const view = render(<LibraryRail />)
    expect(screen.getByTestId("default-rail")).toBeTruthy()
    fireEvent.click(
        screen.getByRole("button", { name: "Libraries and presets" }),
    )
    fireEvent.change(screen.getByLabelText("Preset name"), {
        target: { value: "Electronics" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save new preset" }))
    fireEvent.click(screen.getByLabelText("Remember as my editor default"))
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(screen.queryByTestId("default-rail")).toBe(null)
    view.unmount()
    render(<LibraryRail />)
    expect(screen.getByRole("button", { name: "Electrical" })).toBeTruthy()
    fireEvent.click(
        screen.getByRole("button", { name: "Libraries and presets" }),
    )
    expect(screen.getByRole("option", { name: "Electronics" })).toBeTruthy()
})
it("starts shared boards empty, fences observer application and applies editor selection", () => {
    const apply = vi.fn(),
        view = render(
            <LibraryRail
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
