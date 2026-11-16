import { rejectCrossSite } from "@/lib/access-code"
import { verifyOperationsRequest } from "@/lib/operations-api-auth"
import { operationsDocumentRequest } from "@/lib/operations-documents"

export async function POST(request: Request) {
    const crossSite = rejectCrossSite(request)
    if (crossSite) return crossSite
    const denied = await verifyOperationsRequest(request)
    if (denied) return denied
    try {
        const raw = await request.text()
        if (raw.length > 18 * 1024 * 1024)
            return Response.json(
                { error: "Drawing request is too large" },
                { status: 413 },
            )
        const result = await operationsDocumentRequest(request, JSON.parse(raw))
        return Response.json(result, {
            headers: { "Cache-Control": "no-store" },
        })
    } catch (error) {
        return Response.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Drawing operation failed. Keep this drawing open and retry.",
            },
            { status: 409, headers: { "Cache-Control": "no-store" } },
        )
    }
}
