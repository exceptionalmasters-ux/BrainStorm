"use client"
import { useEffect, useRef, useState } from "react"
import { attachNativeTool } from "@/lib/drawio/editor-bridge"
import {
    type ConnectorEnds,
    installEmcConnector,
} from "@/lib/drawio/emc-connector"
import { getOperationsContext } from "@/lib/operations-bridge"
import { useCanvasStore } from "@/stores/canvas-store"

export function EmcConnectorTool() {
    const ready = useCanvasStore((s) => s.hasEditor)
    const busy = useCanvasStore((s) => s.isBusy)
    const active = useCanvasStore((s) => s.isConnector)
    const [ends, setEnds] = useState<ConnectorEnds>("none")
    const tool = useRef<ReturnType<typeof installEmcConnector>>(null)
    useEffect(() => {
        if (!ready) return
        return attachNativeTool((ui, win) => {
            tool.current = installEmcConnector(
                ui,
                win,
                () =>
                    ui.editor.graph.isEnabled() &&
                    !getOperationsContext()?.readOnly &&
                    !useCanvasStore.getState().isBusy,
                (enabled, value) => {
                    useCanvasStore.setState({ isConnector: enabled })
                    setEnds(value)
                },
            )
            return () => {
                tool.current?.dispose()
                tool.current = null
                useCanvasStore.setState({ isConnector: false })
            }
        })
    }, [ready])
    return (
        <>
            <button
                type="button"
                data-testid="drawing-tool-emc-connector"
                aria-label="EMC connector"
                title="EMC connector · fixed points · 90° · grid 10 · arc jumps"
                aria-pressed={active}
                disabled={!ready || busy || !!getOperationsContext()?.readOnly}
                onClick={() => tool.current?.setActive(!active)}
                className={`inline-flex h-8 shrink-0 items-center rounded px-2 hover:bg-accent disabled:opacity-40 ${active ? "bg-amber-500/15 text-amber-400" : ""}`}
            >
                <svg
                    aria-hidden="true"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                >
                    <path d="M4 18h7V6h9" />
                    <circle cx="3" cy="18" r="2" />
                    <circle cx="21" cy="6" r="2" />
                </svg>
            </button>
            {active && (
                <select
                    aria-label="Connector arrowheads"
                    data-testid="emc-connector-ends"
                    value={ends}
                    onChange={(event) =>
                        tool.current?.setEnds(
                            event.target.value as ConnectorEnds,
                        )
                    }
                    className="h-8 shrink-0 rounded border bg-background px-1 text-xs"
                >
                    <option value="none">No arrows</option>
                    <option value="start">Start arrow</option>
                    <option value="end">End arrow</option>
                    <option value="both">Both arrows</option>
                </select>
            )}
        </>
    )
}
