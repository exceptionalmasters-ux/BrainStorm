import { Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { insertEmcSymbol } from "@/lib/drawio/editor-bridge"
import {
    type EmcSymbol,
    type LibrarySymbol,
    validateEmcSymbol,
} from "@/lib/emc-symbols"
import { type ManualSymbol, validateManualSymbol } from "@/lib/manual-symbol"
import { emcAction } from "@/stores/device-research-store"
import { ManualPreview } from "./manual-preview"
import { SymbolPreview } from "./symbol-preview"

export function SymbolTile({
    symbol,
    disabled,
    onError,
    canDelete = false,
    onDelete,
    request = emcAction,
    insertSymbol = insertEmcSymbol,
}: {
    canDelete?: boolean
    onDelete?: () => void
    request?: (
        action: string,
        body: unknown,
        signal?: AbortSignal,
    ) => Promise<any>
    insertSymbol?: typeof insertEmcSymbol
    symbol: LibrarySymbol
    disabled: boolean
    onError: (message: string) => void
}) {
    const requestRef = useRef(request)
    requestRef.current = request
    const [definition, setDefinition] = useState<
        EmcSymbol | ManualSymbol | null
    >(null)
    const [loading, setLoading] = useState(false)
    const [dragging, setDragging] = useState(false)
    const [peek, setPeek] = useState<{ left: number; top: number } | null>(null)
    const longPress = useRef<ReturnType<typeof setTimeout> | null>(null)
    const showPreview = (element: HTMLElement) => {
        const r = element.getBoundingClientRect()
        setPeek({
            left: Math.max(8, Math.min(window.innerWidth - 288, r.right + 8)),
            top: Math.max(8, Math.min(window.innerHeight - 340, r.top)),
        })
    }
    const stopLongPress = () => {
        if (longPress.current) clearTimeout(longPress.current)
        longPress.current = null
    }
    useEffect(() => () => stopLongPress(), [])
    const dragged = useRef(false)
    const start = useRef<{ x: number; y: number } | null>(null)
    useEffect(() => {
        const controller = new AbortController()
        void requestRef
            .current("symbol", { id: symbol.id }, controller.signal)
            .then((data) => {
                if (!controller.signal.aborted) {
                    if (
                        !validateManualSymbol(data.symbol) &&
                        !validateEmcSymbol(data.symbol)
                    )
                        throw Error("Invalid symbol definition")
                    setDefinition(data.symbol)
                }
            })
            .catch((e) => {
                if (!controller.signal.aborted) onError(e.message)
            })
        return () => controller.abort()
    }, [symbol.id, symbol.version, onError])
    const insert = () => {
        if (dragged.current) {
            dragged.current = false
            return
        }
        if (!definition || disabled) return
        setLoading(true)
        if (!insertSymbol(definition))
            onError("The canvas is not ready. Please retry.")
        setLoading(false)
    }
    return (
        <div className="relative inline-flex w-[calc(25%-6px)] align-top">
            <button
                type="button"
                disabled={disabled || !definition || loading}
                className="inline-flex w-full touch-none flex-col items-center gap-1 rounded border p-1 hover:border-primary disabled:opacity-40"
                title={`${symbol.name} · ${symbol.package}`}
                aria-label={`Insert ${symbol.name}`}
                onClick={insert}
                onPointerEnter={(event) => {
                    if (event.pointerType !== "touch")
                        showPreview(event.currentTarget)
                }}
                onPointerLeave={(event) => {
                    if (event.pointerType !== "touch") setPeek(null)
                }}
                onFocus={(event) => showPreview(event.currentTarget)}
                onBlur={() => setPeek(null)}
                onContextMenu={(event) => {
                    event.preventDefault()
                    showPreview(event.currentTarget)
                }}
                onPointerDown={(e) => {
                    if (definition && !disabled) {
                        start.current = { x: e.clientX, y: e.clientY }
                        stopLongPress()
                        if (e.pointerType === "touch") {
                            const element = e.currentTarget
                            longPress.current = setTimeout(() => {
                                showPreview(element)
                                dragged.current = true
                                start.current = null
                            }, 500)
                        }
                        e.currentTarget.setPointerCapture(e.pointerId)
                    }
                }}
                onPointerMove={(e) => {
                    if (
                        start.current &&
                        Math.hypot(
                            e.clientX - start.current.x,
                            e.clientY - start.current.y,
                        ) > 8
                    ) {
                        stopLongPress()
                        setPeek(null)
                        setDragging(true)
                    }
                }}
                onPointerCancel={() => {
                    stopLongPress()
                    start.current = null
                    setDragging(false)
                }}
                onPointerUp={(e) => {
                    stopLongPress()
                    if (dragged.current && !start.current) {
                        setTimeout(() => setPeek(null), 2500)
                        return
                    }
                    const moved =
                        start.current &&
                        Math.hypot(
                            e.clientX - start.current.x,
                            e.clientY - start.current.y,
                        ) > 8
                    start.current = null
                    dragged.current = !!moved
                    if (moved && definition && !disabled) {
                        e.preventDefault()
                        insertSymbol(definition, {
                            x: e.clientX,
                            y: e.clientY,
                        })
                    }
                    setDragging(false)
                }}
            >
                <span className="pointer-events-none flex h-8 w-full items-center justify-center">
                    {definition ? (
                        "kind" in definition ? (
                            <ManualPreview symbol={definition} />
                        ) : (
                            <SymbolPreview symbol={definition} compact />
                        )
                    ) : (
                        "Loading…"
                    )}
                </span>
                <span className="w-full truncate text-center text-xs">
                    {symbol.name}
                </span>
            </button>
            {canDelete && (
                <button
                    type="button"
                    aria-label={`Remove ${symbol.name} from library`}
                    title="Remove symbol from library"
                    onClick={onDelete}
                    className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full border bg-card text-muted-foreground hover:text-red-500"
                >
                    <Trash2 aria-hidden="true" size={12} />
                </button>
            )}
            {peek && definition && (
                <div
                    role="tooltip"
                    className="pointer-events-none fixed z-[120] w-[280px] rounded-xl border border-primary/30 bg-white p-3 text-black shadow-xl"
                    style={peek}
                >
                    <div className="h-[280px] w-full">
                        {"kind" in definition ? (
                            <ManualPreview symbol={definition} />
                        ) : (
                            <SymbolPreview symbol={definition} compact />
                        )}
                    </div>
                    <p className="mt-1 truncate text-center text-xs font-semibold">
                        {symbol.name}
                    </p>
                </div>
            )}
            {dragging && (
                <div
                    className="fixed inset-0 z-[100] cursor-copy"
                    style={{ pointerEvents: "none" }}
                    aria-hidden="true"
                >
                    <div className="absolute right-3 top-3 rounded border bg-card p-2 text-xs">
                        Drop on drawing: {symbol.device}
                    </div>
                </div>
            )}
        </div>
    )
}
