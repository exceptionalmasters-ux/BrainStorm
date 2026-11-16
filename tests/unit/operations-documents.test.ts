// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import { operationsDocumentRequest } from "@/lib/operations-documents"

const contextId = "00000000-0000-4000-8000-000000000001"
const request = () =>
    new Request("https://editor.example/api/operations-documents", {
        headers: {
            "x-emc-access-token": "fixture-user-token",
            "x-emc-context-type": "request",
            "x-emc-context-id": contextId,
        },
    })
const session = {
    id: "drawing",
    title: "Saved",
    createdAt: 1,
    updatedAt: 2,
    messages: [],
    xmlSnapshots: [],
    diagramXml: "<mxfile/>",
}
afterEach(() => vi.unstubAllGlobals())
describe("mobile direct Operations document transport", () => {
    it("uses user credentials, canonical context, immutable uploads and a CAS commit", async () => {
        const calls: any[] = []
        vi.stubGlobal(
            "fetch",
            vi.fn(async (url, init) => {
                calls.push({ url: String(url), init })
                if (String(url).endsWith("brainstorm_context"))
                    return Response.json({
                        contextType: "project",
                        contextId,
                        readOnly: false,
                    })
                if (String(url).endsWith("brainstorm_commit"))
                    return Response.json({ revision: 1 })
                return Response.json({})
            }),
        )
        expect(
            await operationsDocumentRequest(request(), {
                method: "save",
                payload: {
                    session,
                    expectedRevision: 0,
                    context: { id: "forged" },
                },
                brief: "Only selected concept",
            }),
        ).toEqual({ revision: 1 })
        const uploads = calls.filter((c) => c.url.includes("/storage/"))
        expect(uploads).toHaveLength(2)
        expect(
            uploads.every(
                (c) =>
                    c.url.includes(`/project/${contextId}/drawing/`) &&
                    c.init.headers["x-upsert"] === "false",
            ),
        ).toBe(true)
        for (const call of calls)
            expect(call.init.headers.Authorization).toBe(
                "Bearer fixture-user-token",
            )
        const state = JSON.parse(await uploads[1].init.body.text())
        expect(state.conceptBrief).toBe("Only selected concept")
        const commit = JSON.parse(calls.at(-1).init.body)
        expect(commit).toMatchObject({
            p_context_type: "project",
            p_context_id: contextId,
            p_expected_revision: 0,
            p_document_id: "drawing",
        })
    })
    it("downloads through the same authenticated object endpoint as the Supabase SDK", async () => {
        const path = `project/${contextId}/drawing/revision.json`
        const fetchMock = vi.fn(async (url, init) => {
            if (String(url).endsWith("brainstorm_context"))
                return Response.json({
                    contextType: "project",
                    contextId,
                    readOnly: false,
                })
            if (String(url).endsWith("brainstorm_get"))
                return Response.json({
                    state_path: path,
                    title: "Canonical title",
                    revision: 3,
                    created_at: "2026-11-16T12:00:00Z",
                    updated_at: "2026-11-16T12:01:00Z",
                })
            expect(String(url)).toBe(
                `https://fzwiphplhspsoktugoqo.supabase.co/storage/v1/object/brainstorm-files/${path}`,
            )
            expect(new Headers(init?.headers).get("Authorization")).toBe(
                "Bearer fixture-user-token",
            )
            return Response.json(session)
        })
        vi.stubGlobal("fetch", fetchMock)
        expect(
            await operationsDocumentRequest(request(), {
                method: "get",
                payload: { id: session.id },
            }),
        ).toMatchObject({
            revision: 3,
            session: {
                title: "Canonical title",
                diagramXml: session.diagramXml,
            },
        })
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })
    it("rejects closed workspaces and failed uploads without committing", async () => {
        let readonly = true
        const fetchMock = vi.fn(async (url) =>
            String(url).endsWith("brainstorm_context")
                ? Response.json({
                      contextType: "project",
                      contextId,
                      readOnly: readonly,
                  })
                : Response.json({ error: "Denied" }, { status: 403 }),
        )
        vi.stubGlobal("fetch", fetchMock)
        await expect(
            operationsDocumentRequest(request(), {
                method: "save",
                payload: { session, expectedRevision: 0 },
            }),
        ).rejects.toThrow("read-only")
        expect(fetchMock).toHaveBeenCalledTimes(1)
        readonly = false
        await expect(
            operationsDocumentRequest(request(), {
                method: "save",
                payload: { session, expectedRevision: 0 },
            }),
        ).rejects.toThrow("upload failed")
        expect(
            fetchMock.mock.calls.some((c) =>
                String(c[0]).endsWith("brainstorm_commit"),
            ),
        ).toBe(false)
    })
    it("reconciles only the exact uploaded revision after a lost commit response", async () => {
        let path = ""
        vi.stubGlobal(
            "fetch",
            vi.fn(async (url, init) => {
                if (String(url).endsWith("brainstorm_context"))
                    return Response.json({
                        contextType: "project",
                        contextId,
                        readOnly: false,
                    })
                if (String(url).includes("/storage/")) {
                    path = String(url)
                        .split("/brainstorm-files/")[1]
                        .replace(/\.(drawio|json)$/, "")
                    return Response.json({})
                }
                if (String(url).endsWith("brainstorm_commit"))
                    throw Error("Connection lost")
                if (String(url).endsWith("brainstorm_get"))
                    return Response.json({
                        revision: 2,
                        state_path: `${path}.json`,
                        xml_path: `${path}.drawio`,
                    })
                throw Error("Unexpected request")
            }),
        )
        expect(
            await operationsDocumentRequest(request(), {
                method: "save",
                payload: { session, expectedRevision: 1 },
            }),
        ).toEqual({ revision: 2 })
    })
})

it("acknowledges an identical logical retry without uploading and rejects a peer revision", async () => {
    const revisionId = "00000000-0000-4000-8000-000000000009"
    const path = `project/${contextId}/drawing/${revisionId}`
    let peer = false
    const fetchMock = vi.fn(async (url) =>
        String(url).endsWith("brainstorm_context")
            ? Response.json({
                  contextType: "project",
                  contextId,
                  readOnly: false,
              })
            : Response.json({
                  revision: peer ? 3 : 2,
                  state_path: `${path}.json`,
                  xml_path: `${path}.drawio`,
              }),
    )
    vi.stubGlobal("fetch", fetchMock)
    const body = {
        method: "save",
        payload: { session, expectedRevision: 1, revisionId },
    }
    expect(await operationsDocumentRequest(request(), body)).toEqual({
        revision: 2,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    peer = true
    await expect(operationsDocumentRequest(request(), body)).rejects.toThrow(
        "another window",
    )
    expect(fetchMock).toHaveBeenCalledTimes(4)
})
