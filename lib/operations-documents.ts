import { EMC_SUPABASE_PUBLIC_KEY, EMC_SUPABASE_URL } from "./emc-deployment"
import { readServiceJson } from "./service-response"

const documentId = /^[A-Za-z0-9_-]{1,128}$/
const sessionLimit = 16 * 1024 * 1024
const xmlLimit = 8 * 1024 * 1024
const metadata = (row: any) => ({
    id: row.id,
    title: row.title,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
    messageCount: row.message_count,
    hasDiagram: row.has_diagram,
    revision: row.revision,
})

/** User-scoped REST/Storage only. No service key, refresh token or local fallback. */
export async function operationsDocumentRequest(request: Request, body: any) {
    const token = request.headers.get("x-emc-access-token")
    const type = request.headers.get("x-emc-context-type")
    const id = request.headers.get("x-emc-context-id")
    if (
        !token ||
        !["request", "project", "personal"].includes(type || "") ||
        !/^[0-9a-f-]{36}$/i.test(id || "")
    )
        throw new Error("Open this drawing from Operations.")
    const base = (process.env.EMC_SUPABASE_URL || EMC_SUPABASE_URL).replace(
        /\/$/,
        "",
    )
    const headers = {
        apikey:
            process.env.EMC_SUPABASE_PUBLISHABLE_KEY || EMC_SUPABASE_PUBLIC_KEY,
        Authorization: `Bearer ${token}`,
    }
    const rpc = async (name: string, args: object): Promise<any> => {
        const response = await fetch(`${base}/rest/v1/rpc/${name}`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify(args),
            signal: request.signal,
            cache: "no-store",
        })
        return readServiceJson(response, "Operations")
    }
    const context = await rpc("brainstorm_context", {
        p_context_type: type,
        p_context_id: id,
    })
    const args = {
        p_context_type: context.contextType,
        p_context_id: context.contextId,
    }
    const method = body.method
    if (method === "list")
        return (await rpc("brainstorm_list", args)).map(metadata)
    if (!["get", "save", "delete"].includes(method))
        throw new Error("Unsupported drawing operation.")
    const payload = body.payload
    const docId = method === "save" ? payload?.session?.id : payload?.id
    if (typeof docId !== "string" || !documentId.test(docId))
        throw new Error("Invalid drawing ID.")
    const get = () => rpc("brainstorm_get", { ...args, p_document_id: docId })
    if (method === "get") {
        const row = await get()
        if (!row) return null
        const response = await fetch(
            `${base}/storage/v1/object/brainstorm-files/${row.state_path}`,
            { headers, signal: request.signal, cache: "no-store" },
        )
        if (!response.ok)
            throw new Error(
                "Could not download the drawing. Retry without closing the editor.",
            )
        const blob = await response.blob()
        if (blob.size > sessionLimit)
            throw new Error("Drawing exceeds the supported size.")
        const session = JSON.parse(await blob.text())
        if (
            session.id !== docId ||
            typeof session.diagramXml !== "string" ||
            !Array.isArray(session.messages) ||
            !Array.isArray(session.xmlSnapshots)
        )
            throw new Error("The saved drawing is invalid.")
        return {
            session: {
                ...session,
                title: row.title,
                createdAt: Date.parse(row.created_at),
                updatedAt: Date.parse(row.updated_at),
            },
            revision: row.revision,
        }
    }
    if (context.readOnly) throw new Error("This workspace is read-only.")
    if (
        !Number.isSafeInteger(payload?.expectedRevision) ||
        payload.expectedRevision < 0
    )
        throw new Error("Reload the drawing before changing it.")
    if (method === "delete") {
        await rpc("brainstorm_archive", {
            ...args,
            p_document_id: docId,
            p_expected_revision: payload.expectedRevision,
        })
        return { archived: true }
    }
    const session = {
        ...payload.session,
        conceptBrief: typeof body.brief === "string" ? body.brief : "",
    }
    if (
        session.conceptBrief.length > 30000 ||
        typeof session.title !== "string" ||
        !session.title.trim() ||
        session.title.length > 200 ||
        typeof session.diagramXml !== "string" ||
        !Array.isArray(session.messages) ||
        !Array.isArray(session.xmlSnapshots)
    )
        throw new Error("Invalid drawing contents.")
    const state = new Blob([JSON.stringify(session)], {
        type: "application/json",
    })
    const xml = new Blob([session.diagramXml], { type: "application/xml" })
    if (state.size > sessionLimit || xml.size > xmlLimit)
        throw new Error(
            "Drawing is too large to save (16 MB session / 8 MB XML).",
        )
    if (
        payload.revisionId !== undefined &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            payload.revisionId,
        )
    )
        throw new Error("Invalid save request ID.")
    const revisionId = payload.revisionId || crypto.randomUUID()
    const path = `${context.contextType}/${context.contextId}/${docId}/${revisionId}`
    if (payload.revisionId) {
        const existing = await get()
        if (
            existing?.state_path === `${path}.json` &&
            existing?.xml_path === `${path}.drawio` &&
            existing.revision === payload.expectedRevision + 1
        )
            return { revision: existing.revision }
        if (existing && existing.revision !== payload.expectedRevision)
            throw new Error(
                "Drawing changed in another window. Use Save As to keep your current changes.",
            )
    }
    const available = await rpc("brainstorm_name_available", {
        ...args,
        p_kind: "drawing",
        p_name: session.title,
        p_exclude_id: docId,
    })
    if (!available)
        throw new Error("This name already exists. Choose another name.")
    for (const [name, blob] of [
        [`${path}.drawio`, xml],
        [`${path}.json`, state],
    ] as const) {
        const response = await fetch(
            `${base}/storage/v1/object/brainstorm-files/${name}`,
            {
                method: "POST",
                headers: {
                    ...headers,
                    "Content-Type": blob.type,
                    "x-upsert": "false",
                    "Cache-Control": "max-age=0",
                },
                body: blob,
                signal: request.signal,
            },
        )
        if (!response.ok) {
            let detail: { statusCode?: string; error?: string } = {}
            try {
                detail = await response.json()
            } catch {
                /* Keep the transport error. */
            }
            // Only a logical retry may reuse its own immutable staged objects.
            if (
                payload.revisionId &&
                (response.status === 409 ||
                    String(detail.statusCode) === "409") &&
                detail.error === "Duplicate"
            )
                continue
            throw new Error(
                "Drawing upload failed. Keep the editor open and retry.",
            )
        }
    }
    try {
        return await rpc("brainstorm_commit", {
            ...args,
            p_document_id: docId,
            p_revision_id: revisionId,
            p_expected_revision: payload.expectedRevision,
            p_title: session.title.trim(),
            p_message_count: session.messages.length,
            p_has_diagram: Boolean(session.diagramXml.trim()),
        })
    } catch (error) {
        // Exactly the same immutable-revision reconciliation as the Operations adapter.
        try {
            const row = await get()
            if (
                row?.state_path === `${path}.json` &&
                row?.xml_path === `${path}.drawio` &&
                row.revision === payload.expectedRevision + 1
            )
                return { revision: row.revision }
        } catch {
            /* Preserve the original conflict or write error. */
        }
        throw error
    }
}
