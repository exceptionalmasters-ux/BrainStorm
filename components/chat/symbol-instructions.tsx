"use client"
import { useDeviceResearch } from "@/stores/device-research-store"
export function SymbolInstructions({
    disabled = false,
}: {
    disabled?: boolean
}) {
    const instructions = useDeviceResearch((s) => s.instructions)
    return (
        <label className="mt-2 block text-xs">
            Symbol instructions / PDF pages
            <textarea
                aria-label="Symbol instructions"
                className="mt-1 min-h-16 w-full rounded border bg-background p-2"
                maxLength={1500}
                disabled={disabled}
                value={instructions}
                placeholder="Use the drawing on page 2 and pin assignments on pages 3–4. Preserve the top view."
                onChange={(e) =>
                    useDeviceResearch.setState({ instructions: e.target.value })
                }
            />
        </label>
    )
}
