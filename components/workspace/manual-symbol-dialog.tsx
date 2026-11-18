import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { registerManualLibrary } from "@/lib/drawio/editor-bridge"
import {
    captureManualLibrarySymbol,
    insertManualSymbolNative,
    type ManualSymbol,
} from "@/lib/manual-symbol"
import { getOperationsContext } from "@/lib/operations-bridge"
import { emcAction, useDeviceResearch } from "@/stores/device-research-store"
export function ManualSymbolDialog() {
    const [open, setOpen] = useState(false),
        [symbol, setSymbol] = useState<ManualSymbol | null>(null),
        [name, setName] = useState(""),
        [error, setError] = useState(""),
        [saving, setSaving] = useState(false)
    useEffect(
        () =>
            registerManualLibrary({
                capture: captureManualLibrarySymbol,
                insert: insertManualSymbolNative,
            }),
        [],
    )
    useEffect(() => {
        const listener = (event: Event) => {
            const d = (event as CustomEvent).detail
            setSymbol(d.symbol || null)
            setName("")
            setError(d.error || "")
            setOpen(true)
        }
        window.addEventListener("emc-manual-symbol", listener)
        return () => window.removeEventListener("emc-manual-symbol", listener)
    }, [])
    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                if (!saving) setOpen(v)
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add to EMC library</DialogTitle>
                </DialogHeader>
                {symbol && (
                    <>
                        <p className="text-sm text-muted-foreground">
                            Save the selected drawing as an editable symbol,
                            including its internal connections.
                        </p>
                        <Input
                            autoFocus
                            aria-label="Symbol name"
                            maxLength={120}
                            placeholder="Symbol name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={saving}
                        />
                    </>
                )}
                {error && (
                    <p role="alert" className="text-sm text-red-500">
                        {error}
                    </p>
                )}
                <div className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        disabled={saving}
                        onClick={() => setOpen(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        disabled={
                            !symbol ||
                            !name.trim() ||
                            saving ||
                            !!getOperationsContext()?.readOnly
                        }
                        onClick={async () => {
                            if (!symbol) return
                            setSaving(true)
                            setError("")
                            try {
                                const saved = await emcAction<{ id: string }>(
                                    "manual-create",
                                    {
                                        approved: true,
                                        symbol: {
                                            ...symbol,
                                            name: name.trim(),
                                            device: name.trim(),
                                        },
                                    },
                                )
                                useDeviceResearch.setState({
                                    library: [
                                        {
                                            id: saved.id,
                                            name: name.trim(),
                                            device: name.trim(),
                                            package: "Manual drawing",
                                            version: 1,
                                            sources: [],
                                        },
                                        ...useDeviceResearch.getState().library,
                                    ],
                                })
                                toast.success("Symbol saved to EMC library")
                                setOpen(false)
                            } catch (e) {
                                setError(
                                    e instanceof Error
                                        ? e.message
                                        : "Could not save symbol",
                                )
                            } finally {
                                setSaving(false)
                            }
                        }}
                    >
                        {saving ? "Saving…" : "Add to library"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
