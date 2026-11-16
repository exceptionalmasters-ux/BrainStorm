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
    sessionSaveFailureText,
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
        expect(mocks.request).toHaveBeenLastCalledWith(
            "save",
            expect.objectContaining({
                session,
                expectedRevision: 2,
                revisionId: expect.any(String),
            }),
        )
        mocks.request.mockRejectedValueOnce(
            new Error("Drawing changed in another window"),
        )
        expect(await saveSession(session)).toBe(false)
        expect(mocks.request).toHaveBeenLastCalledWith(
            "save",
            expect.objectContaining({
                session,
                expectedRevision: 3,
                revisionId: expect.any(String),
            }),
        )
        expect(String(lastSaveError())).toContain("changed in another window")
        expect(mocks.openDB).not.toHaveBeenCalled()
    })
    it("serialises overlapping saves and advances the acknowledged revision", async () => {
        const session = { ...createEmptySession(), id: "serial-writes" }
        let release!: (value: { revision: number }) => void
        mocks.request
            .mockImplementationOnce(
                () =>
                    new Promise((r) => {
                        release = r
                    }),
            )
            .mockResolvedValueOnce({ revision: 2 })
        const first = saveSession(session)
        const second = saveSession({ ...session, title: "Second change" })
        await vi.waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(1))
        release({ revision: 1 })
        expect(await first).toBe(true)
        expect(await second).toBe(true)
        expect(
            mocks.request.mock.calls
                .filter((c) => c[0] === "save")
                .map((c) => c[1].expectedRevision),
        ).toEqual([0, 1])
    })
    it("retries the exact logical write after a lost acknowledgement, then saves newer edits", async () => {
        const session = { ...createEmptySession(), id: "lost-ack" }
        mocks.request.mockRejectedValueOnce(
            new Error("Connection lost after commit"),
        )
        expect(await saveSession(session)).toBe(false)
        const original = mocks.request.mock.calls[0][1]
        mocks.request
            .mockResolvedValueOnce({ revision: 1 })
            .mockResolvedValueOnce({ revision: 2 })
        expect(await saveSession({ ...session, title: "New edit" })).toBe(true)
        expect(mocks.request.mock.calls[1][1]).toEqual(original)
        expect(mocks.request.mock.calls[2][1]).toMatchObject({
            expectedRevision: 1,
            session: { title: "New edit" },
        })
        expect(mocks.request.mock.calls[2][1].revisionId).not.toBe(
            original.revisionId,
        )
    })
    it("reports a real revision conflict without rebasing or suggesting browser cleanup", async () => {
        const session = { ...createEmptySession(), id: "peer-conflict" }
        mocks.request.mockRejectedValue(
            new Error("Drawing changed in another window"),
        )
        expect(await saveSession(session)).toBe(false)
        expect(sessionSaveFailureText("Browser storage may be full")).toContain(
            "Save As",
        )
        expect(
            sessionSaveFailureText("Browser storage may be full"),
        ).not.toContain("Browser storage")
        expect(await saveSession({ ...session, title: "Retained edit" })).toBe(
            false,
        )
        expect(
            mocks.request.mock.calls.every((c) => c[1].expectedRevision === 0),
        ).toBe(true)
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
