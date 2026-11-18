"use client"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { EMC_SUPABASE_PUBLIC_KEY, EMC_SUPABASE_URL } from "@/lib/emc-deployment"
import { operationsAuthorization } from "@/lib/operations-bridge"
import {
    analyseSource,
    cancelDeviceResearch,
    disableDeviceWeb,
    emcAction,
    useDeviceResearch,
} from "@/stores/device-research-store"
import { SymbolInstructions } from "./symbol-instructions"

type Source = {
    id: string
    name: string
    state: string
    version: number
    size: number
}
export async function openSourceAttachment(id: string) {
    const child = window.open("about:blank", "_blank")
    try {
        const data = await emcAction<{ url: string }>("source-download", { id })
        const url = new URL(data.url)
        if (url.origin !== EMC_SUPABASE_URL)
            throw Error("Invalid download destination")
        if (child) {
            child.opener = null
            child.location.href = url.href
        }
    } catch (error) {
        child?.close()
        throw error
    }
}
export function SourceFiles({ readonly }: { readonly: boolean }) {
    const [files, setFiles] = useState<Source[]>([]),
        [trash, setTrash] = useState(false),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false)
    const input = useRef<HTMLInputElement>(null),
        [purge, setPurge] = useState<Source | null>(null)
    const research = useDeviceResearch()
    const load = async () => {
        const data = await emcAction<{ sources: Source[] }>("source-list", {})
        setFiles(data.sources)
    }
    useEffect(() => {
        void load().catch((e) => setError(e.message))
    }, [])
    const change = async (action: string, row: Source) => {
        setBusy(true)
        setError("")
        try {
            await emcAction(action, {
                id: row.id,
                version: row.version,
                confirm: action === "source-purge",
            })
            if (research.result?.sourceId === row.id) {
                cancelDeviceResearch()
                research.set({
                    result: null,
                    draft: null,
                    incompleteCandidateId: null,
                })
            }
            setPurge(null)
            await load()
        } catch (e) {
            setError(
                e instanceof Error ? e.message : "Attachment operation failed",
            )
            await load().catch(() => {})
        } finally {
            setBusy(false)
        }
    }
    const upload = async (file: File) => {
        setBusy(true)
        setError("")
        try {
            if (file.size > 10485760 || file.size === 0)
                throw Error("Choose a non-empty file up to 10 MB")
            const prepared = await emcAction<{
                id: string
                path: string
                mime: string
            }>("source-create", { name: file.name, size: file.size })
            if (
                !/^(request|project)\/[0-9a-f-]+\/[0-9a-f-]+\.(pdf|png|jpe?g|webp|txt|md|docx)$/i.test(
                    prepared.path,
                )
            )
                throw Error("Invalid upload path")
            const auth = await operationsAuthorization()
            const url = `${EMC_SUPABASE_URL}/storage/v1/object/brainstorm-sources/${prepared.path}`
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": prepared.mime,
                    "x-upsert": "false",
                    apikey: EMC_SUPABASE_PUBLIC_KEY,
                    Authorization: `Bearer ${auth.accessToken}`,
                },
                body: await file.arrayBuffer(),
                credentials: "omit",
            })
            if (!response.ok)
                throw Error(
                    "File upload failed. You can remove the pending attachment or retry.",
                )
            await emcAction("source-complete", { id: prepared.id })
            await load()
        } catch (e) {
            setError(e instanceof Error ? e.message : "Upload failed")
            await load().catch(() => {})
        } finally {
            setBusy(false)
            if (input.current) input.current.value = ""
        }
    }
    const open = async (row: Source) => {
        try {
            await openSourceAttachment(row.id)
        } catch (e) {
            setError(e instanceof Error ? e.message : "Download failed")
        }
    }

    return (
        <section
            className="my-2 space-y-2 rounded border p-2"
            aria-label="Source attachments"
        >
            <p>
                From file · no Web search. PDF and images include drawings;
                DOCX/TXT/MD provide text. Up to 10 MB.
            </p>
            <div className="flex flex-wrap gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    disabled={readonly || busy || research.busy}
                    onClick={() => input.current?.click()}
                >
                    Add attachment
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                        setTrash(!trash)
                        setPurge(null)
                    }}
                >
                    {trash ? "Active files" : "Trash"}
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                        void load().catch((e) => setError(e.message))
                    }
                >
                    Refresh
                </Button>
            </div>
            <input
                ref={input}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.docx"
                className="hidden"
                aria-label="Upload source documentation"
                onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void upload(file)
                }}
            />
            <SymbolInstructions disabled={busy || research.busy || readonly} />
            {error && (
                <p role="alert" className="text-red-500">
                    {error}
                </p>
            )}
            <ul className="max-h-64 space-y-2 overflow-auto">
                {files
                    .filter((f) =>
                        trash
                            ? ["trashed", "purging"].includes(f.state)
                            : ["active", "pending"].includes(f.state),
                    )
                    .map((row) => (
                        <li key={row.id} className="rounded border p-2">
                            <button
                                className="text-amber-400 underline"
                                disabled={row.state !== "active"}
                                onClick={() => void open(row)}
                            >
                                {row.name}
                            </button>
                            <span className="ml-2">{row.state}</span>
                            <div className="mt-1 flex flex-wrap gap-2">
                                {row.state === "pending" && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={readonly || busy}
                                        onClick={() =>
                                            void change("source-complete", row)
                                        }
                                    >
                                        Finish upload
                                    </Button>
                                )}
                                {row.state === "active" && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={
                                            readonly || busy || research.busy
                                        }
                                        onClick={() => {
                                            disableDeviceWeb()
                                            void analyseSource(
                                                row.id,
                                                research.instructions,
                                            )
                                        }}
                                    >
                                        Analyse file
                                    </Button>
                                )}
                                {["active", "pending"].includes(row.state) && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={readonly || busy}
                                        onClick={() =>
                                            void change("source-trash", row)
                                        }
                                    >
                                        Move to trash
                                    </Button>
                                )}
                                {row.state === "trashed" && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={readonly || busy}
                                        onClick={() =>
                                            void change("source-restore", row)
                                        }
                                    >
                                        Restore
                                    </Button>
                                )}
                                {["trashed", "purging"].includes(row.state) && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={readonly || busy}
                                        onClick={() => setPurge(row)}
                                    >
                                        Delete permanently
                                    </Button>
                                )}
                            </div>
                        </li>
                    ))}
            </ul>
            {purge && (
                <div
                    role="alertdialog"
                    aria-label="Delete attachment permanently"
                    className="rounded border border-red-500 p-2"
                >
                    <p>
                        Permanently delete {purge.name} from Storage? This
                        cannot be undone.
                    </p>
                    <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => void change("source-purge", purge)}
                    >
                        Delete forever
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setPurge(null)}
                    >
                        Cancel
                    </Button>
                </div>
            )}
        </section>
    )
}
