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
    labels: {
        title: "Shape libraries",
        basic: "Basic shapes",
        arrows: "Lines and arrows",
        diagrams: "Diagrams",
        technical: "Technical libraries",
        network: "Networks",
        search: "Search",
        recent: "Recent",
        allLibraries: "All libraries",
    },
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
vi.mock("@/lib/drawio/editor-bridge", () => ({
    insertEmcSymbol: vi.fn(),
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
it("keeps original normal defaults while loading account presets in another browser", async () => {
    let saved: any[] = []
    const request = vi.fn(async (action: string, body: any) => {
        if (action === "presets-save")
            saved = [...saved.filter((p) => p.id !== body.id), body]
        return [...saved]
    })
    const view = render(<LibraryRail presetRequest={request} />)
    expect(screen.getByRole("button", { name: "Basic shapes" })).toBeTruthy()
    fireEvent.click(
        screen.getByRole("button", { name: "Libraries and presets" }),
    )
    await waitFor(() => expect(screen.queryByRole("status")).toBe(null))
    expect(screen.getByRole("button", { name: "Clear selection" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }))
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
    expect(screen.getByRole("button", { name: "Basic shapes" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(screen.queryByRole("button", { name: "Basic shapes" })).toBe(null)
    expect(
        screen.getByRole("button", { name: "Technical libraries" }),
    ).toBeTruthy()
    view.unmount()
    localStorage.clear()
    render(<LibraryRail presetRequest={request} />)
    expect(screen.getByRole("button", { name: "Basic shapes" })).toBeTruthy()
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
    fireEvent.click(screen.getByRole("button", { name: "Technical libraries" }))
    expect(fixture.open).toHaveBeenCalledWith(
        "technical",
        "Technical libraries",
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

it("shares the exact original group icons and colors between normal and selected shared rails", () => {
    const request = async () => []
    const view = render(<LibraryRail presetRequest={request} />)
    const ids = [
        "basic",
        "arrows",
        "diagrams",
        "technical",
        "network",
        "search",
        "recent",
    ]
    const original = ids.map((id) => {
        const button = screen.getByTestId(`toolbox-${id}`)
        return {
            svg: button.querySelector("svg")?.outerHTML,
            classes: button.className,
        }
    })
    expect(new Set(original.map((icon) => icon.svg)).size).toBe(7)
    view.unmount()
    const shared = render(
        <LibraryRail shared presetRequest={request} libraries={[]} />,
    )
    expect(
        screen.getByTestId("shape-toolbox").querySelectorAll("button").length,
    ).toBe(1)
    shared.rerender(
        <LibraryRail
            shared
            presetRequest={request}
            libraries={[
                "general",
                "arrows2",
                "flowchart",
                "electrical",
                "network",
            ]}
        />,
    )
    ids.forEach((id, index) => {
        const button = screen.getByTestId(`toolbox-${id}`)
        expect(button.querySelector("svg")?.outerHTML).toBe(original[index].svg)
        expect(button.className).toBe(original[index].classes)
    })
})

it("shows real EM thumbnails and filters them using the same tile as the normal tool", async () => {
    const symbol = {
        name: "Device A",
        device: "A",
        package: "DIP",
        pins: [
            {
                number: "1",
                name: "VCC",
                side: "left",
                sourceUrl: "https://example.com/a.pdf",
                evidence: "Pin table",
            },
        ],
    }
    const loadEM = vi.fn(async (action: string) =>
        action === "library"
            ? {
                  symbols: [
                      {
                          id: "a",
                          name: "Device A",
                          device: "A",
                          package: "DIP",
                      },
                  ],
              }
            : { symbol },
    )
    render(<LibraryRail shared libraries={["emc"]} loadEM={loadEM} />)
    fireEvent.click(await screen.findByRole("button", { name: "EMC library" }))
    expect(
        await screen.findByRole("img", { name: "Symbol thumbnail" }),
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: "Insert Device A" })).toBeTruthy()
    fireEvent.change(screen.getByLabelText("Filter EMC symbols"), {
        target: { value: "missing" },
    })
    expect(screen.queryByRole("button", { name: "Insert Device A" })).toBeNull()
})
