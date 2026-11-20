import { FileUp, History } from "lucide-react"
import { useEffect } from "react"
import { BrandMark } from "@/components/workspace/brand-mark"
import { useDictionary } from "@/hooks/use-dictionary"
import { useUiStore } from "@/stores/ui-store"
import { useChatEngine } from "./chat-engine"
import { DrawingStarters } from "./drawing-starters"
import { SessionMenu } from "./session-menu"

export function LobbyHero({
    onDrawYourself,
    onDrawManually,
    onOpenFile,
    compact = false,
}: {
    onDrawYourself: () => void
    onDrawManually: () => void
    onOpenFile: () => void
    compact?: boolean
}) {
    useEffect(() => {
        document
            .querySelector<HTMLButtonElement>('[data-testid="draw-manually"]')
            ?.focus({ preventScroll: true })
    }, [])
    const dict = useDictionary()
    const engine = useChatEngine()
    const assistant = () => {
        onDrawYourself()
        useUiStore.getState().focusComposer()
    }
    return (
        <div
            className={`mx-auto w-full max-w-[880px] px-6 ${compact ? "py-8" : "py-14"}`}
            data-testid="lobby-hero"
        >
            <div className="mb-5 flex justify-center">
                <BrandMark className="size-16 rounded-2xl border border-primary/40" />
            </div>
            <p className="mb-3 text-center text-xs tracking-[0.2em] text-primary">
                EXCEPTIONAL MASTERS COLLECTIVE
            </p>
            <h1 className="text-center text-3xl font-semibold tracking-tight">
                BrainStorm
            </h1>
            <p className="mb-8 mt-3 text-center text-sm text-muted-foreground">
                {dict.editor.startDescription}
            </p>
            <DrawingStarters
                onManual={onDrawManually}
                onAssistant={assistant}
                onBrief={(text) => {
                    engine.setInput(`${dict.lobby.briefPrompt}\n\n${text}`)
                    assistant()
                }}
            />
            <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                    type="button"
                    onClick={onOpenFile}
                    data-testid="open-file"
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm hover:border-primary"
                >
                    <FileUp className="size-4" />
                    {dict.workspace.openFile}
                </button>
                {engine.sessions.length > 0 && (
                    <SessionMenu
                        align="center"
                        onOpenFile={onOpenFile}
                        hideActions
                    >
                        <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm hover:border-primary"
                        >
                            <History className="size-4" />
                            {dict.lobby.recent}
                        </button>
                    </SessionMenu>
                )}
            </div>
        </div>
    )
}
