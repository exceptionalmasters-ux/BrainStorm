import { rejectCrossSite } from "@/lib/access-code"
import { callEmcGateway } from "@/lib/emc-ai"
import { verifyOperationsRequest } from "@/lib/operations-api-auth"

const actions = new Set(["research", "draft", "approve", "library", "symbol"])
export async function POST(
    request: Request,
    { params }: { params: Promise<{ action: string }> },
) {
    const crossSite = rejectCrossSite(request)
    if (crossSite) return crossSite
    const denied = await verifyOperationsRequest(request)
    if (denied) return denied
    const { action } = await params
    if (!actions.has(action))
        return Response.json({ error: "Unknown action" }, { status: 404 })
    try {
        const raw = await request.text()
        if (raw.length > 262144)
            return Response.json(
                { error: "Request too large" },
                { status: 413 },
            )
        const result = await callEmcGateway(request, action, JSON.parse(raw))
        return new Response(result.body, {
            status: result.status,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
            },
        })
    } catch {
        return Response.json(
            { error: "EMC service is unavailable. Please retry." },
            { status: 502 },
        )
    }
}
