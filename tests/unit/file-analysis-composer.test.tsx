import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { FileAnalysisComposer } from "@/components/chat/symbol-instructions"
import {
    analyseSource,
    useDeviceResearch,
} from "@/stores/device-research-store"

vi.mock("@/lib/operations-bridge", () => ({
    getOperationsContext: () => ({ readOnly: false }),
}))
vi.mock("@/stores/device-research-store", async (original) => ({
    ...(await original<typeof import("@/stores/device-research-store")>()),
    analyseSource: vi.fn().mockResolvedValue(undefined),
}))
beforeEach(() => {
    vi.clearAllMocks()
    useDeviceResearch.setState({
        fileMode: true,
        selectedSource: null,
        instructions: "",
        sourceBusy: false,
        busy: false,
        draft: null,
    })
})
afterEach(cleanup)
it("places analysis next to the instructions and sends the chosen file with the current comments", () => {
    useDeviceResearch.setState({
        selectedSource: { id: "datasheet", name: "Device.pdf" },
    })
    render(<FileAnalysisComposer />)
    const input = screen.getByLabelText("Symbol instructions")
    const send = screen.getByRole("button", { name: "Analyse file" })
    expect(input.closest("label")?.parentElement?.lastElementChild).toBe(send)
    fireEvent.change(input, { target: { value: "Use page 3 pinout" } })
    fireEvent.click(send)
    expect(analyseSource).toHaveBeenCalledWith("datasheet", "Use page 3 pinout")
    expect(screen.getByText("Selected file: Device.pdf")).toBeTruthy()
})
it("disables analysis until an active file is selected and during file operations", () => {
    const { rerender } = render(<FileAnalysisComposer />)
    const disabled = () =>
        (
            screen.getByRole("button", {
                name: "Analyse file",
            }) as HTMLButtonElement
        ).disabled
    expect(screen.queryByLabelText("Symbol instructions")).toBeNull()
    expect(screen.queryByRole("button", { name: "Analyse file" })).toBeNull()
    useDeviceResearch.setState({
        selectedSource: { id: "source", name: "A.pdf" },
        sourceBusy: true,
    })
    rerender(<FileAnalysisComposer />)
    expect(disabled()).toBe(true)
    useDeviceResearch.setState({ sourceBusy: false })
    rerender(<FileAnalysisComposer />)
    expect(disabled()).toBe(false)
})

it("hides file instructions again after Cancel", () => {
    useDeviceResearch.setState({
        fileMode: false,
        selectedSource: { id: "old", name: "Old.pdf" },
    })
    render(<FileAnalysisComposer />)
    expect(screen.queryByLabelText("Symbol instructions")).toBeNull()
})
