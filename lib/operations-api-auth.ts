import {
    EMC_SUPABASE_PUBLIC_KEY,
    EMC_SUPABASE_URL,
    operationsOnly,
} from "@/lib/emc-deployment"
/** Verify Operations authorization against the same database/MFA guards as EMC. */
export async function verifyOperationsRequest(
    request: Request,
): Promise<Response | null> {
    const token = request.headers.get("x-emc-access-token")
    if (!token && !operationsOnly()) return null
    const url = process.env.EMC_SUPABASE_URL ?? EMC_SUPABASE_URL
    const key =
        process.env.EMC_SUPABASE_PUBLISHABLE_KEY ?? EMC_SUPABASE_PUBLIC_KEY
    const type = request.headers.get("x-emc-context-type")
    const id = request.headers.get("x-emc-context-id")
    if (
        !token ||
        !url ||
        !key ||
        !["request", "project", "personal"].includes(type || "") ||
        !/^[0-9a-f-]{36}$/i.test(id || "")
    ) {
        return Response.json(
            { error: "Open BrainStorm from an authorised Operations session." },
            { status: 401 },
        )
    }
    try {
        const response = await fetch(
            `${url.replace(/\/$/, "")}/rest/v1/rpc/brainstorm_context`,
            {
                method: "POST",
                headers: {
                    apikey: key,
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    p_context_type: type,
                    p_context_id: id,
                }),
                cache: "no-store",
                signal: AbortSignal.timeout(10000),
            },
        )
        if (!response.ok)
            return Response.json(
                { error: "Operations access expired or was revoked." },
                { status: 403 },
            )
        const context = await response.json()
        if (
            context.readOnly &&
            new URL(request.url).pathname.endsWith("/api/chat")
        )
            return Response.json(
                { error: "This workspace is read-only." },
                { status: 403 },
            )
        return null
    } catch {
        return Response.json(
            { error: "Could not verify Operations access. Please retry." },
            { status: 503 },
        )
    }
}
