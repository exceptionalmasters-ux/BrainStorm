"use client"
import { ArrowUp } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { getOperationsContext } from "@/lib/operations-bridge"
import {
    analyseSource,
    useDeviceResearch,
} from "@/stores/device-research-store"
export function SymbolInstructions({
    disabled = false,
    action,
}: {
    disabled?: boolean
    action?: ReactNode
}) {
    const instructions = useDeviceResearch((s) => s.instructions)
    return (
        <div className="flex items-end gap-2">
            <label className="mt-2 block min-w-0 flex-1 text-xs">
                Symbol instructions / PDF pages
                <textarea
                    aria-label="Symbol instructions"
                    className="mt-1 min-h-16 w-full rounded border bg-background p-2"
                    maxLength={1500}
                    disabled={disabled}
                    value={instructions}
                    placeholder="Use the drawing on page 2 and pin assignments on pages 3–4. Preserve the top view."
                    onChange={(e) =>
                        useDeviceResearch.setState({
                            instructions: e.target.value,
                        })
                    }
                />
            </label>
            {action}
        </div>
    )
}

export function FileAnalysisComposer() {
    const state = useDeviceResearch()
    const readonly = getOperationsContext()?.readOnly
    const disabled = !!readonly || state.busy || state.sourceBusy
    if (!state.fileMode || !state.selectedSource) return null
    return (
        <div className="space-y-1">
            <p
                className="truncate text-xs text-muted-foreground"
                title={state.selectedSource?.name}
            >
                {state.selectedSource
                    ? `Selected file: ${state.selectedSource.name}`
                    : "Choose an attachment to analyse"}
            </p>
            <SymbolInstructions
                disabled={disabled}
                action={
                    <Button
                        type="button"
                        size="icon"
                        title="Analyse file"
                        aria-label="Analyse file"
                        className="mb-1 shrink-0 rounded-full"
                        disabled={
                            disabled || !state.selectedSource || !!state.draft
                        }
                        onClick={() => {
                            if (!state.selectedSource) return
                            void analyseSource(
                                state.selectedSource.id,
                                state.instructions,
                            ).catch((error) =>
                                state.set({
                                    error:
                                        error instanceof Error
                                            ? error.message
                                            : "File analysis failed",
                                }),
                            )
                        }}
                    >
                        <ArrowUp aria-hidden="true" className="size-4" />
                    </Button>
                }
            />
        </div>
    )
}
