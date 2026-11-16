import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ request: vi.fn(), openDB: vi.fn() }))
vi.mock("@/lib/operations-bridge", () => ({
    isOperationsMode: () => true,
    operationsRequest: mocks.request,
}))
vi.mock("idb", () => ({ openDB: mocks.openDB }))

import {
    createEmptySession,
    deleteSession,
    enforceSessionLimit,
    getAllSessionMetadata,
    getSession,
    lastSaveError,
    saveSession,
} from "@/lib/session-storage"

beforeEach(() => {
    mocks.request.mockReset()
    mocks.openDB.mockReset()
})
describe("Operations session storage", () => {
    it("does not use browser storage or the local 50-session deletion policy", async () => {
        const rows = [{ id: "saved", revision: 4, title: "Saved" }]
        mocks.request.mockResolvedValue(rows)
        expect(await getAllSessionMetadata()).toEqual(rows)
        expect(await enforceSessionLimit()).toEqual([])
        await deleteSession("saved")
        expect(mocks.request).toHaveBeenLastCalledWith("delete", {
            id: "saved",
            expectedRevision: 4,
        })
        expect(mocks.openDB).not.toHaveBeenCalled()
    })
    it("keeps the revision of the loaded content when a newer list arrives", async () => {
        const session = { ...createEmptySession(), id: "revision-test" }
        mocks.request.mockResolvedValueOnce({ session, revision: 2 })
        expect(await getSession(session.id)).toEqual(session)
        mocks.request.mockResolvedValueOnce([{ id: session.id, revision: 99 }])
        await getAllSessionMetadata()
        mocks.request.mockResolvedValueOnce({ revision: 3 })
        expect(await saveSession(session)).toBe(true)
        expect(mocks.request).toHaveBeenLastCalledWith("save", {
            session,
            expectedRevision: 2,
        })
        mocks.request.mockRejectedValueOnce(
            new Error("Drawing changed in another window"),
        )
        expect(await saveSession(session)).toBe(false)
        expect(mocks.request).toHaveBeenLastCalledWith("save", {
            session,
            expectedRevision: 3,
        })
        expect(String(lastSaveError())).toContain("changed in another window")
        expect(mocks.openDB).not.toHaveBeenCalled()
    })
    it("propagates read/access failures without silently falling back to local diagrams", async () => {
        mocks.request.mockRejectedValue(new Error("Not authorised"))
        await expect(getAllSessionMetadata()).rejects.toThrow("Not authorised")
        await expect(getSession("unavailable")).rejects.toThrow(
            "Not authorised",
        )
        expect(mocks.openDB).not.toHaveBeenCalled()
    })
})
