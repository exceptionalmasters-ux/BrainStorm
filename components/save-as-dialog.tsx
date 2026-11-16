"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { useDocumentSaveStore } from "@/stores/document-save-store"

export function SaveAsDialog({
    open,
    onOpenChange,
    defaultName,
    onSave,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    defaultName: string
    onSave: (name: string) => Promise<boolean>
}) {
    useEffect(() => {
        useDocumentSaveStore.setState({ naming: open })
        return () => useDocumentSaveStore.setState({ naming: false })
    }, [open])
    const [name, setName] = useState(defaultName)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    useEffect(() => {
        if (open) {
            setName(defaultName)
            setError("")
        }
    }, [open, defaultName])
    const save = async (event: React.FormEvent) => {
        event.preventDefault()
        if (saving) return
        const title = name
            .trim()
            .replace(/\.drawio$/i, "")
            .trim()
        if (!title || title.length > 100) {
            setError("Enter a drawing name (up to 100 characters).")
            return
        }
        setSaving(true)
        setError("")
        try {
            if (await onSave(title)) onOpenChange(false)
            else
                setError(
                    "Could not save the drawing. Your current drawing is retained; please retry.",
                )
        } catch {
            setError(
                "Could not save the drawing. Your current drawing is retained; please retry.",
            )
        } finally {
            setSaving(false)
        }
    }
    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!saving) onOpenChange(value)
            }}
        >
            <DialogContent className="sm:max-w-md">
                <form onSubmit={save}>
                    <DialogHeader>
                        <DialogTitle>Save As</DialogTitle>
                        <DialogDescription>
                            Save a separate drawing with a new name.
                        </DialogDescription>
                    </DialogHeader>
                    <label
                        className="mt-5 block text-sm"
                        htmlFor="drawing-copy-name"
                    >
                        Drawing name
                    </label>
                    <div className="mt-2 flex items-center gap-2">
                        <input
                            id="drawing-copy-name"
                            className="min-w-0 flex-1 rounded border border-primary/50 bg-background px-3 py-2 text-sm focus-visible:outline-primary"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            disabled={saving}
                            autoFocus
                            maxLength={107}
                        />
                        <span className="text-xs text-muted-foreground">
                            .drawio
                        </span>
                    </div>
                    {error && (
                        <p
                            role="alert"
                            className="mt-3 text-sm text-destructive"
                        >
                            {error}
                        </p>
                    )}
                    <DialogFooter className="mt-5">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={saving}
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? "Saving…" : "Save"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
