import { Minus, PaintBucket } from "lucide-react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import {
    openEditorLineSection,
    runEditorAction,
    setSelectedColour,
    setSelectedLineStyle,
} from "@/lib/drawio/editor-bridge"

export const BASIC_COLOURS = [
    "#FFFFFF",
    "#C0C0C0",
    "#808080",
    "#000000",
    "#FF0000",
    "#800000",
    "#FFFF00",
    "#808000",
    "#00FF00",
    "#008000",
    "#00FFFF",
    "#008080",
    "#0000FF",
    "#000080",
    "#FF00FF",
    "#800080",
]
export const normalizeHex = (value: string) => {
    const raw = value.trim().replace(/^#/, "")
    if (/^[\da-f]{3}$/i.test(raw))
        return `#${raw
            .split("")
            .map((c) => c + c)
            .join("")}`.toUpperCase()
    return /^[\da-f]{6}$/i.test(raw) ? `#${raw.toUpperCase()}` : null
}
export function QuickColour({
    kind,
    disabled,
}: {
    kind: "fill" | "line"
    disabled: boolean
}) {
    const label = kind === "fill" ? "Fill colour" : "Line colour and style"
    const [last, setLast] = useState(kind === "fill" ? "#FFFFFF" : "#000000")
    const [hex, setHex] = useState(last)
    const [error, setError] = useState("")
    const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(
        null,
    )
    const storageKey = `emc-last-${kind}-colour`
    useEffect(() => {
        try {
            const colour = normalizeHex(localStorage.getItem(storageKey) || "")
            if (colour) {
                setLast(colour)
                setHex(colour)
            }
        } catch {}
    }, [storageKey])
    useEffect(() => {
        if (disabled) setAnchor(null)
    }, [disabled])
    const apply = (value: string, close = true) => {
        const colour = normalizeHex(value)
        if (!colour) {
            setError("Enter a HEX colour, for example #336699")
            return
        }
        if (!setSelectedColour(kind, colour)) {
            setError("Select an editable object first.")
            return
        }
        setLast(colour)
        setHex(colour)
        setError("")
        try {
            localStorage.setItem(storageKey, colour)
        } catch {}
        if (close) setAnchor(null)
    }
    const Icon = kind === "fill" ? PaintBucket : Minus
    return (
        <div className="inline-flex shrink-0 items-center">
            <button
                type="button"
                disabled={disabled}
                className="inline-flex h-8 items-center gap-1 rounded px-2 hover:bg-accent disabled:opacity-40"
                title={label}
                aria-label={label}
                aria-haspopup="dialog"
                aria-expanded={!!anchor}
                data-testid={`drawing-tool-${kind === "fill" ? "fillColor" : "strokeColor"}`}
                onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect()
                    setError("")
                    setHex(last)
                    setAnchor(
                        anchor
                            ? null
                            : {
                                  left: Math.max(
                                      4,
                                      Math.min(r.left, innerWidth - 248),
                                  ),
                                  top: r.bottom,
                              },
                    )
                }}
            >
                <Icon size={16} />
                <span aria-hidden>▾</span>
            </button>
            <button
                type="button"
                disabled={disabled}
                className="size-5 shrink-0 rounded border border-foreground/40 disabled:opacity-40"
                style={{ backgroundColor: last }}
                aria-label={`Apply last ${kind} colour ${last}`}
                title={`Apply last ${kind} colour ${last}`}
                data-testid={`last-${kind}-colour`}
                onClick={() => apply(last)}
            />
            {anchor &&
                createPortal(
                    <>
                        <button
                            type="button"
                            className="fixed inset-0 z-40 cursor-default"
                            aria-label={`Close ${label}`}
                            onClick={() => setAnchor(null)}
                        />
                        <section
                            role="dialog"
                            aria-label={label}
                            className="fixed z-50 max-h-[70vh] w-60 overflow-y-auto rounded-lg border border-primary/30 bg-card p-3 shadow-xl"
                            style={anchor}
                            onKeyDown={(e) => {
                                if (e.key === "Escape") setAnchor(null)
                            }}
                        >
                            <fieldset
                                className="grid grid-cols-4 gap-2"
                                aria-label="16 basic colours"
                            >
                                {BASIC_COLOURS.map((colour) => (
                                    <button
                                        key={colour}
                                        type="button"
                                        className="h-7 rounded border border-foreground/30 focus-visible:outline-2 focus-visible:outline-primary"
                                        style={{ backgroundColor: colour }}
                                        aria-label={`${kind} ${colour}`}
                                        title={colour}
                                        onClick={() => apply(colour)}
                                    />
                                ))}
                            </fieldset>
                            <label className="mt-3 flex items-center justify-between text-xs">
                                Colour picker
                                <input
                                    type="color"
                                    aria-label={`${kind} colour picker`}
                                    value={last}
                                    onChange={(e) =>
                                        apply(e.target.value, false)
                                    }
                                />
                            </label>
                            <label className="mt-2 block text-xs">
                                HEX #
                                <input
                                    className="mt-1 w-full rounded border bg-background px-2 py-1"
                                    aria-label={`${kind} HEX colour`}
                                    value={hex}
                                    maxLength={7}
                                    onChange={(e) => setHex(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault()
                                            apply(hex)
                                        }
                                    }}
                                />
                            </label>
                            <button
                                type="button"
                                className="mt-2 rounded border px-2 py-1 text-xs"
                                onClick={() => apply(hex)}
                            >
                                Apply colour
                            </button>
                            {error && (
                                <p
                                    role="alert"
                                    className="mt-1 text-xs text-red-500"
                                >
                                    {error}
                                </p>
                            )}
                            {kind === "line" && (
                                <div className="mt-2 grid grid-cols-3 gap-1">
                                    {[
                                        ["Solid", "0", "3 3"],
                                        ["Dashed", "1", "6 4"],
                                        ["Dotted", "1", "1 3"],
                                    ].map(([name, dashed, pattern]) => (
                                        <button
                                            type="button"
                                            key={name}
                                            className="rounded border p-1 text-xs"
                                            onClick={() => {
                                                setSelectedLineStyle(
                                                    "dashed",
                                                    dashed,
                                                    pattern,
                                                )
                                                setAnchor(null)
                                            }}
                                        >
                                            {name}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <button
                                type="button"
                                className="mt-3 block w-full rounded border border-primary/40 px-2 py-1 text-xs"
                                onClick={() => {
                                    setAnchor(null)
                                    if (kind === "fill")
                                        runEditorAction("fillColor")
                                    else openEditorLineSection()
                                }}
                            >
                                {kind === "fill" ? "More colors" : "More"}
                            </button>
                        </section>
                    </>,
                    document.body,
                )}
        </div>
    )
}
