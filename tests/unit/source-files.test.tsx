import { File as NodeFile } from "node:buffer"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SourceFiles } from "@/components/chat/source-files"
import { useDeviceResearch } from "@/stores/device-research-store"

const { action } = vi.hoisted(() => ({ action: vi.fn() }))
vi.mock("@/stores/device-research-store", async (original) => ({
    ...(await original<object>()),
    emcAction: action,
}))
vi.mock("@/lib/operations-bridge", () => ({
    operationsAuthorization: async () => ({ accessToken: "fixture-token" }),
}))
const sourceId = "00000000-0000-4000-8000-000000000002"
const contextId = "00000000-0000-4000-8000-000000000001"
let path: string
beforeEach(() => {
    path = `personal/${contextId}/${sourceId}.pdf`
    useDeviceResearch.setState({ busy: false, selectedSource: null })
    action.mockReset().mockImplementation(async (name) => {
        if (name === "source-list") return { sources: [] }
        if (name === "name-available") return { available: true }
        if (name === "source-create")
            return {
                id: sourceId,
                path,
                mime: path.endsWith("jpg") ? "image/jpeg" : "application/pdf",
            }
        return { ok: true }
    })
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(null, { status: 200 })),
    )
    vi.stubGlobal("File", NodeFile)
})
afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})
describe("personal source uploads", () => {
    it.each(["Drawing.JPG", "Drawing.PDF"])(
        "uploads %s with a canonical extension",
        async (name) => {
            path = `personal/${contextId}/${sourceId}.${name.split(".")[1].toLowerCase()}`
            const view = render(<SourceFiles readonly={false} />)
            fireEvent.change(
                view.getByLabelText("Upload source documentation"),
                {
                    target: { files: [new File(["abc"], name)] },
                },
            )
            await waitFor(() =>
                expect(action).toHaveBeenCalledWith("source-complete", {
                    id: sourceId,
                }),
            )
            expect(action).toHaveBeenCalledWith("source-create", {
                name: name.replace(/\.[^.]+$/, (ext) => ext.toLowerCase()),
                size: 3,
            })
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining(`/brainstorm-sources/${path}`),
                expect.objectContaining({
                    method: "POST",
                    credentials: "omit",
                }),
            )
        },
    )
    it("rejects a path outside the permitted source scope before uploading", async () => {
        path = `personal/${contextId}/../../other.pdf`
        const view = render(<SourceFiles readonly={false} />)
        fireEvent.change(view.getByLabelText("Upload source documentation"), {
            target: { files: [new File(["abc"], "Drawing.pdf")] },
        })
        await waitFor(() =>
            expect(view.getByRole("alert").textContent).toBe(
                "Invalid upload path",
            ),
        )
        expect(fetch).not.toHaveBeenCalled()
        expect(action).not.toHaveBeenCalledWith(
            "source-complete",
            expect.anything(),
        )
    })
    it.each([200, 409])(
        "reuploads a pending file without creating another record (storage %s)",
        async (status) => {
            const row = {
                id: sourceId,
                name: "Drawing.pdf",
                size: 3,
                state: "pending",
                version: 1,
            }
            action.mockImplementation(async (name) => {
                if (name === "source-list") return { sources: [row] }
                if (name === "source-upload")
                    return { ...row, path, mime: "application/pdf" }
                return { ok: true }
            })
            vi.stubGlobal(
                "fetch",
                vi.fn(async () => new Response(null, { status })),
            )
            const view = render(<SourceFiles readonly={false} />)
            const retry = await view.findByRole("button", {
                name: "Retry upload",
            })
            fireEvent.click(retry)
            fireEvent.change(
                view.getByLabelText("Upload source documentation"),
                { target: { files: [new File(["abc"], "Drawing.PDF")] } },
            )
            await waitFor(() =>
                expect(action).toHaveBeenCalledWith("source-complete", {
                    id: sourceId,
                }),
            )
            expect(action).toHaveBeenCalledWith("source-upload", {
                id: sourceId,
            })
            expect(action).not.toHaveBeenCalledWith(
                "source-create",
                expect.anything(),
            )
            expect(fetch).toHaveBeenCalledTimes(1)
        },
    )
    it("rejects a different file when retrying a pending upload", async () => {
        const row = {
            id: sourceId,
            name: "Drawing.pdf",
            size: 3,
            state: "pending",
            version: 1,
        }
        action.mockImplementation(async (name) =>
            name === "source-list"
                ? { sources: [row] }
                : { ...row, path, mime: "application/pdf" },
        )
        const view = render(<SourceFiles readonly={false} />)
        fireEvent.click(
            await view.findByRole("button", { name: "Retry upload" }),
        )
        fireEvent.change(view.getByLabelText("Upload source documentation"), {
            target: { files: [new File(["abc"], "Different.pdf")] },
        })
        await waitFor(() =>
            expect(view.getByRole("alert").textContent).toContain(
                "Select the original file",
            ),
        )
        expect(fetch).not.toHaveBeenCalled()
    })
})
