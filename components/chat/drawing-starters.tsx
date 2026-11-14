import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { useDictionary } from "@/hooks/use-dictionary"

/** Start choices share draw.io's editable canvas; only an explicit chat send invokes AI. */
export function DrawingStarters({
    onManual,
    onAssistant,
    onBrief,
}: {
    onManual: () => void
    onAssistant: () => void
    onBrief: (text: string) => void
}) {
    const t = useDictionary().lobby
    const [briefOpen, setBriefOpen] = useState(false)
    const [brief, setBrief] = useState("")
    const cards = [
        {
            key: "manual",
            title: t.drawManually,
            description: t.manualDescription,
            action: onManual,
            testId: "draw-manually",
        },
        {
            key: "brief",
            title: t.briefDrawing,
            description: t.briefDrawingDescription,
            action: () => setBriefOpen(true),
            testId: "draw-from-brief",
        },
        {
            key: "chat",
            title: t.drawOnTheFly,
            description: t.drawOnTheFlyDescription,
            action: onAssistant,
            testId: "draw-on-the-fly",
        },
    ] as const
    return (
        <>
            <div
                className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3"
                data-testid="drawing-starters"
            >
                {cards.map((card) => (
                    <button
                        key={card.key}
                        type="button"
                        onClick={card.action}
                        data-testid={card.testId}
                        className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
                    >
                        <span
                            className="flex h-28 w-full items-center justify-center overflow-hidden rounded-lg bg-white"
                            aria-hidden="true"
                        >
                            <svg
                                aria-hidden="true"
                                viewBox="0 0 180 100"
                                className="h-24 w-full"
                            >
                                <rect
                                    x="43"
                                    y="7"
                                    width="78"
                                    height="86"
                                    rx="2"
                                    fill="white"
                                    stroke="#b8bec5"
                                />
                                {card.key === "manual" ? (
                                    <>
                                        <path
                                            d="M52 23h60M52 35h60M52 47h60M52 59h60M52 71h60M64 16v68M76 16v68M88 16v68M100 16v68"
                                            stroke="#edf0f2"
                                        />
                                        <path
                                            d="m106 72 26-26 7 7-26 26-10 3z"
                                            fill="#d6ad3c"
                                            stroke="#8e711e"
                                        />
                                    </>
                                ) : (
                                    <>
                                        {card.key === "brief" && (
                                            <>
                                                <rect
                                                    x="16"
                                                    y="24"
                                                    width="44"
                                                    height="53"
                                                    rx="3"
                                                    fill="#f4f5f6"
                                                    stroke="#aab1b8"
                                                />
                                                <path
                                                    d="M24 36h28M24 44h28M24 52h20M24 60h24"
                                                    stroke="#7d8792"
                                                />
                                            </>
                                        )}
                                        <rect
                                            x="72"
                                            y="23"
                                            width="39"
                                            height="18"
                                            rx="3"
                                            fill="#fbefc7"
                                            stroke="#b58d26"
                                        />
                                        <path
                                            d="M91 41v12M65 53h55M65 53v9M120 53v9"
                                            fill="none"
                                            stroke="#718277"
                                        />
                                        <rect
                                            x="54"
                                            y="62"
                                            width="29"
                                            height="17"
                                            rx="3"
                                            fill="#e3f2e8"
                                            stroke="#40865b"
                                        />
                                        <rect
                                            x="106"
                                            y="62"
                                            width="29"
                                            height="17"
                                            rx="3"
                                            fill="#e3f2e8"
                                            stroke="#40865b"
                                        />
                                        {card.key === "chat" && (
                                            <>
                                                <path
                                                    d="M128 16h38v29h-20l-9 8v-8h-9z"
                                                    fill="#f4f5f6"
                                                    stroke="#8e9b94"
                                                />
                                                <path
                                                    d="M135 26h23M135 33h16"
                                                    stroke="#40865b"
                                                />
                                            </>
                                        )}
                                    </>
                                )}
                            </svg>
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                            {card.title}
                        </span>
                        <span className="text-xs leading-relaxed text-muted-foreground">
                            {card.description}
                        </span>
                    </button>
                ))}
            </div>
            <Dialog open={briefOpen} onOpenChange={setBriefOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{t.briefDrawing}</DialogTitle>
                        <DialogDescription>
                            {t.briefImportDescription}
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault()
                            if (!brief.trim()) return
                            onBrief(brief.trim())
                            setBriefOpen(false)
                        }}
                    >
                        <label
                            className="block text-sm font-medium"
                            htmlFor="concept-brief"
                        >
                            {t.briefText}
                        </label>
                        <textarea
                            id="concept-brief"
                            value={brief}
                            onChange={(event) => setBrief(event.target.value)}
                            maxLength={20000}
                            rows={8}
                            required
                            className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm"
                        />
                        <DialogFooter className="mt-4">
                            <button
                                type="button"
                                onClick={() => setBriefOpen(false)}
                                className="rounded-lg border border-border px-4 py-2 text-sm"
                            >
                                {t.briefCancel}
                            </button>
                            <button
                                type="submit"
                                disabled={!brief.trim()}
                                data-testid="prepare-brief-drawing"
                                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                            >
                                {t.prepareBriefDrawing}
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    )
}
