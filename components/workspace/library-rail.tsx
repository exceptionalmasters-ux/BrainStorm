"use client"
import { Check, RotateCcw, Search, Settings2, Shapes, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import {
    type ShapeToolboxExtension,
    ShapeToolboxRail,
    type ShapeToolboxSelection,
    TOOLBOX_GROUPS,
} from "@/components/canvas/shape-toolbox-rail"
import {
    accountPresetRequest,
    type PresetRequest,
} from "@/lib/account-library-presets"
import { attachNativeTool } from "@/lib/drawio/editor-bridge"
import { SHAPE_GROUPS, type ShapeGroup } from "@/lib/drawio/shape-toolbox"
import { insertEmcSymbolNative, validateEmcSymbol } from "@/lib/emc-symbols"
import {
    type LibraryPreset,
    readLibraryPreferences,
    validLibraryIds,
} from "@/lib/library-presets"
import {
    insertManualSymbolNative,
    validateManualSymbol,
} from "@/lib/manual-symbol"
import { getOperationsContext } from "@/lib/operations-bridge"
import { useCanvasStore } from "@/stores/canvas-store"

type CatalogItem = { id: string; title: string; group: string }
type Props = {
    presetRequest?: PresetRequest
    shared?: boolean
    userId?: string
    libraries?: string[]
    editable?: boolean
    onChange?: (ids: string[]) => void
    extension?: ShapeToolboxExtension
    loadEM?: (action: string, body: unknown) => Promise<any>
}
export function LibraryRail({
    presetRequest = accountPresetRequest,
    shared = false,
    userId,
    libraries,
    editable = true,
    onChange,
    extension,
    loadEM,
}: Props) {
    const ready = useCanvasStore((s) => s.hasEditor),
        user = userId || getOperationsContext()?.userId || "local"
    const [ids, setIds] = useState<string[] | null>(shared ? [] : null),
        [catalog, setCatalog] = useState<CatalogItem[]>([]),
        [open, setOpen] = useState(false),
        [draft, setDraft] = useState<string[]>([]),
        [search, setSearch] = useState(""),
        [presets, setPresets] = useState<LibraryPreset[]>([]),
        [preset, setPreset] = useState(""),
        [name, setName] = useState(""),
        [presetBusy, setPresetBusy] = useState(false),
        [localPresets, setLocalPresets] = useState<LibraryPreset[]>([]),
        [error, setError] = useState(""),
        [emOpen, setEmOpen] = useState(false),
        [emItems, setEmItems] = useState<any[]>([]),
        [emBusy, setEmBusy] = useState(false)
    const account = useRef(user)
    account.current = user
    const canInsert = useRef(editable)
    canInsert.current = editable
    useEffect(() => {
        setPresets([])
        setPreset("")
        setName("")
        setOpen(false)
        setLocalPresets(readLibraryPreferences(user).presets)
    }, [user])
    useEffect(() => {
        if (shared) {
            const next = validLibraryIds(libraries) ? libraries : []
            setIds((current) =>
                JSON.stringify(current) === JSON.stringify(next)
                    ? current
                    : [...next],
            )
        }
    }, [shared, libraries])
    useEffect(() => {
        if (!ready) return
        return attachNativeTool((ui, win) => {
            const rows: CatalogItem[] = [],
                seen = new Set<string>()
            const collect = (entries: any[], group = "Libraries") => {
                for (const entry of entries || []) {
                    if (entry.entries)
                        collect(entry.entries, entry.title || group)
                    else if (
                        typeof entry.id === "string" &&
                        entry.id !== "search" &&
                        !seen.has(entry.id)
                    ) {
                        seen.add(entry.id)
                        rows.push({
                            id: entry.id,
                            title: entry.title || entry.id,
                            group,
                        })
                    }
                }
            }
            collect(ui.sidebar?.entries || [])
            for (const item of ui.sidebar?.configuration || [])
                if (item.id !== "search" && !seen.has(item.id))
                    rows.push({
                        id: item.id,
                        title: win.mxResources?.get(item.id) || item.id,
                        group: "Other libraries",
                    })
            if (extension || loadEM)
                rows.push({
                    id: "emc",
                    title: "EM · EMC library",
                    group: "EMC",
                })
            setCatalog(rows)
            return () => {}
        })
    }, [ready])
    useEffect(() => {
        window.dispatchEvent(new Event("emc-close-toolbox"))
        setEmOpen(false)
        extension?.close()
    }, [ids])
    const loadPresets = async () => {
        const requestedUser = user
        setPresetBusy(true)
        try {
            const rows = await presetRequest("presets-list", {})
            if (account.current === requestedUser) setPresets(rows)
        } catch {
            setError(
                "Could not load account presets. Reconnect to EMC and reopen this panel.",
            )
        } finally {
            setPresetBusy(false)
        }
    }
    const settings = () => {
        setDraft(ids ?? catalog.map((item) => item.id))
        setSearch("")
        setError("")
        setOpen(true)
        void loadPresets()
        window.dispatchEvent(new Event("emc-close-toolbox"))
        extension?.close()
        setEmOpen(false)
    }
    const apply = () => {
        if (shared && !editable) return
        if (!validLibraryIds(draft)) return
        setIds([...draft])
        onChange?.([...draft])
        setOpen(false)
    }
    const savePreset = async (update: boolean) => {
        const title = name.trim()
        if (!title || title.length > 80) {
            setError("Enter a preset name (up to 80 characters).")
            return
        }
        if (
            presets.some(
                (p) =>
                    p.name.toLocaleLowerCase() === title.toLocaleLowerCase() &&
                    (!update || p.id !== preset),
            )
        ) {
            setError("A preset with this name already exists.")
            return
        }
        const id = update ? preset : crypto.randomUUID()
        if (!id) return
        setPresetBusy(true)
        try {
            const rows = await presetRequest("presets-save", {
                id,
                name: title,
                libraries: [...draft],
            })
            if (account.current !== user) return
            setPresets(rows)
            setPreset(id)
            setError("")
        } catch (reason) {
            setError(
                (reason as Error).message || "Could not save account preset.",
            )
        } finally {
            setPresetBusy(false)
        }
    }
    const importLocal = async () => {
        setPresetBusy(true)
        try {
            let rows = presets
            for (const item of localPresets) {
                if (account.current !== user) return
                if (
                    rows.some(
                        (p) => p.name.toLowerCase() === item.name.toLowerCase(),
                    )
                )
                    continue
                rows = await presetRequest("presets-save", {
                    ...item,
                    id: crypto.randomUUID(),
                })
                setPresets(rows)
            }
            setLocalPresets([])
            setError("")
        } catch (reason) {
            setError((reason as Error).message)
        } finally {
            setPresetBusy(false)
        }
    }
    const gear = (
        <button
            type="button"
            onClick={settings}
            title="Libraries and presets"
            aria-label="Libraries and presets"
            data-testid="library-settings"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-transparent hover:border-primary hover:text-primary disabled:opacity-40"
            disabled={!ready}
        >
            <Settings2 className="size-5" />
        </button>
    )
    const openEM = async () => {
        setError("")
        setEmOpen((value) => !value)
        if (emOpen || !loadEM) return
        setEmBusy(true)
        try {
            const data = await loadEM("library", {})
            setEmItems(data.symbols || [])
        } catch (reason) {
            setError((reason as Error).message)
        } finally {
            setEmBusy(false)
        }
    }
    const railExtension =
        extension ||
        (loadEM
            ? {
                  button: (closeNative: () => void) => (
                      <button
                          type="button"
                          title="EMC library"
                          aria-label="EMC library"
                          aria-expanded={emOpen}
                          aria-controls="shared-emc-library-panel"
                          data-testid="toolbox-emc-library"
                          onClick={() => {
                              closeNative()
                              void openEM()
                          }}
                          className={`flex size-10 shrink-0 items-center justify-center rounded-lg border hover:border-primary hover:text-primary ${emOpen ? "border-primary bg-primary/10 text-primary" : "border-transparent"}`}
                      >
                          <span
                              aria-hidden="true"
                              className="text-sm font-bold"
                          >
                              EM
                          </span>
                      </button>
                  ),
                  panel: null,
                  close: () => setEmOpen(false),
              }
            : undefined)
    const entries: Partial<Record<ShapeGroup, string>> = {}
    const nativeIds = (ids || []).filter((id) => id !== "emc")
    for (const [group, palettes] of Object.entries(SHAPE_GROUPS)) {
        if (group === "recent") continue
        entries[group as ShapeGroup] =
            palettes === null
                ? nativeIds.join(";")
                : palettes
                      .split(";")
                      .filter((id) => nativeIds.includes(id))
                      .join(";")
    }
    const selection: ShapeToolboxSelection | undefined =
        ids === null
            ? undefined
            : {
                  groups: TOOLBOX_GROUPS.filter(([group]) =>
                      group === "recent" || group === "search"
                          ? nativeIds.length > 0
                          : !!entries[group],
                  ),
                  entries,
              }
    return (
        <>
            {ids?.length === 0 ? (
                <aside
                    aria-label="Shape libraries"
                    data-testid="shape-toolbox"
                    className="absolute inset-y-0 left-0 z-20 flex w-[52px] flex-col items-center gap-1 overflow-y-auto border-r border-primary/25 bg-card py-2 text-foreground"
                >
                    {gear}
                </aside>
            ) : (
                <ShapeToolboxRail
                    key={ready ? "ready" : "waiting"}
                    extension={
                        ids === null || ids.includes("emc")
                            ? railExtension
                            : undefined
                    }
                    settings={gear}
                    selection={selection}
                />
            )}
            {emOpen && loadEM && (
                <section
                    id="shared-emc-library-panel"
                    className="absolute inset-y-0 left-[52px] z-40 w-[min(360px,calc(100%_-_52px))] overflow-auto rounded-r-xl border border-primary/30 bg-card p-3 text-foreground shadow-xl"
                >
                    <header className="flex justify-between">
                        <strong>EM library</strong>
                        <button
                            onClick={() => setEmOpen(false)}
                            aria-label="Close EM library"
                        >
                            <X />
                        </button>
                    </header>
                    {emBusy && <p>Loading…</p>}
                    {error && <p role="alert">{error}</p>}
                    <div className="grid grid-cols-3 gap-2">
                        {emItems.map((item) => (
                            <button
                                disabled={!editable || emBusy}
                                title={item.name}
                                key={item.id}
                                className="overflow-hidden rounded border border-amber-500/25 p-2 text-xs disabled:opacity-50"
                                onClick={() => {
                                    setEmBusy(true)
                                    void loadEM("symbol", { id: item.id })
                                        .then((data) => {
                                            if (
                                                !validateEmcSymbol(
                                                    data.symbol,
                                                ) &&
                                                !validateManualSymbol(
                                                    data.symbol,
                                                )
                                            )
                                                throw Error("Invalid symbol")
                                            if (!canInsert.current)
                                                throw Error(
                                                    "Editing control changed",
                                                )
                                            attachNativeTool((ui, win) => {
                                                if (
                                                    validateManualSymbol(
                                                        data.symbol,
                                                    )
                                                )
                                                    insertManualSymbolNative(
                                                        ui,
                                                        win,
                                                        data.symbol,
                                                    )
                                                else
                                                    insertEmcSymbolNative(
                                                        ui,
                                                        win,
                                                        data.symbol,
                                                    )
                                                return () => {}
                                            })
                                        })
                                        .catch((reason) =>
                                            setError(reason.message),
                                        )
                                        .finally(() => setEmBusy(false))
                                }}
                            >
                                <Shapes className="mx-auto size-6 text-amber-300" />
                                <span className="block truncate">
                                    {item.name}
                                </span>
                            </button>
                        ))}
                    </div>
                </section>
            )}
            {open && (
                <div
                    className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/70 p-3"
                    onKeyDown={(event) => {
                        if (event.key === "Escape") setOpen(false)
                        if (event.key === "Tab") {
                            const targets =
                                event.currentTarget.querySelectorAll<HTMLElement>(
                                    "button:not(:disabled), input:not(:disabled), select:not(:disabled)",
                                )
                            const first = targets[0],
                                last = targets[targets.length - 1]
                            if (
                                event.shiftKey &&
                                document.activeElement === first
                            ) {
                                event.preventDefault()
                                last?.focus()
                            } else if (
                                !event.shiftKey &&
                                document.activeElement === last
                            ) {
                                event.preventDefault()
                                first?.focus()
                            }
                        }
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="library-settings-title"
                        className="emc-library-settings flex max-h-[90dvh] w-full max-w-xl flex-col rounded-xl border border-amber-500/50 bg-[#101310] text-white shadow-2xl"
                    >
                        <header className="flex shrink-0 items-center gap-3 border-b border-amber-500/25 p-4">
                            <Settings2 className="text-amber-300" />
                            <div className="flex-1">
                                <h2
                                    id="library-settings-title"
                                    className="font-semibold"
                                >
                                    Libraries and left toolbar
                                </h2>
                                <p className="text-xs text-white/60">
                                    {shared
                                        ? "The current editor applies this set to everyone on this board."
                                        : "All original tool groups are enabled initially. Choose libraries for this session; saved presets belong to your EMC account."}
                                </p>
                            </div>
                            <button
                                aria-label="Close library settings"
                                onClick={() => setOpen(false)}
                            >
                                <X />
                            </button>
                        </header>
                        <div className="flex min-h-0 flex-col gap-3 overflow-auto p-4 [&>*]:shrink-0">
                            <label className="grid gap-1 text-sm">
                                Preset
                                <select
                                    className="rounded border border-amber-500/35 bg-[#171b17] p-2"
                                    value={preset}
                                    onChange={(event) => {
                                        setPreset(event.target.value)
                                        const p = presets.find(
                                            (p) => p.id === event.target.value,
                                        )
                                        if (p) {
                                            setDraft([...p.libraries])
                                            setName(p.name)
                                        }
                                    }}
                                >
                                    <option value="">Custom selection</option>
                                    {presets.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <div className="flex items-center gap-2 rounded border border-amber-500/35 px-3">
                                <Search className="size-4" />
                                <input
                                    autoFocus
                                    aria-label="Find library"
                                    placeholder="Find a library…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full bg-transparent py-2 outline-none"
                                />
                            </div>
                            <div className="max-h-[32dvh] overflow-auto rounded border border-amber-500/20">
                                {catalog
                                    .filter((c) =>
                                        `${c.title} ${c.group} ${c.id}`
                                            .toLowerCase()
                                            .includes(search.toLowerCase()),
                                    )
                                    .map((c) => (
                                        <label
                                            key={c.id}
                                            className="flex cursor-pointer items-center gap-3 border-b border-white/5 p-3 hover:bg-amber-500/5"
                                        >
                                            <input
                                                type="checkbox"
                                                data-testid={`library-choice-${c.id}`}
                                                checked={draft.includes(c.id)}
                                                onChange={() =>
                                                    setDraft((current) =>
                                                        current.includes(c.id)
                                                            ? current.filter(
                                                                  (id) =>
                                                                      id !==
                                                                      c.id,
                                                              )
                                                            : [
                                                                  ...current,
                                                                  c.id,
                                                              ],
                                                    )
                                                }
                                                className="size-4 accent-amber-400"
                                            />
                                            <Shapes className="size-4 text-amber-200" />
                                            <span className="flex-1 text-sm">
                                                {c.title}
                                                <small className="block text-xs text-white/40">
                                                    {c.group}
                                                </small>
                                            </span>
                                        </label>
                                    ))}
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-white/70">
                                {draft.map((id) => (
                                    <span
                                        key={id}
                                        className="rounded border border-amber-500/30 px-2 py-1"
                                    >
                                        {catalog.find((c) => c.id === id)
                                            ?.title || id}
                                    </span>
                                ))}
                                {!draft.length && (
                                    <span>Only the settings icon</span>
                                )}
                            </div>
                            <label className="grid gap-1 text-sm">
                                Preset name
                                <input
                                    maxLength={80}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Electronics / Mechanics"
                                    className="rounded border border-amber-500/35 bg-[#171b17] p-2"
                                />
                            </label>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    className="rounded border border-amber-500/40 px-3 py-2 text-sm"
                                    disabled={presetBusy}
                                    onClick={() => void savePreset(false)}
                                >
                                    Save new preset
                                </button>
                                <button
                                    disabled={!preset || presetBusy}
                                    className="rounded border border-amber-500/40 px-3 py-2 text-sm disabled:opacity-40"
                                    onClick={() => void savePreset(true)}
                                >
                                    Update preset
                                </button>
                            </div>
                            {presetBusy && (
                                <p role="status">
                                    Synchronizing account presets…
                                </p>
                            )}
                            {localPresets.length > 0 && (
                                <button
                                    disabled={presetBusy}
                                    onClick={() => void importLocal()}
                                >
                                    Import presets from this browser
                                </button>
                            )}
                            <p className="text-sm text-white/70">
                                Presets belong to your account. Choose a preset
                                again when opening a new board. Saving a preset
                                does not apply it to this board.
                            </p>
                            {shared && (
                                <p className="text-xs text-white/60">
                                    Apply affects only this session. Save a
                                    named preset to reuse it later.
                                </p>
                            )}
                            {error && (
                                <p
                                    role="alert"
                                    className="text-sm text-red-300"
                                >
                                    {error}
                                </p>
                            )}
                        </div>
                        <footer className="flex shrink-0 flex-wrap justify-between gap-2 border-t border-amber-500/25 p-4">
                            <button
                                className="flex items-center gap-1 rounded border border-amber-500/40 px-3 py-2 text-sm"
                                onClick={() => setDraft([])}
                            >
                                <RotateCcw className="size-4" />
                                Clear selection
                            </button>
                            <button
                                onClick={() =>
                                    setDraft(catalog.map((item) => item.id))
                                }
                            >
                                Enable all libraries
                            </button>
                            <div className="flex gap-2">
                                <button
                                    className="rounded border border-amber-500/40 px-3 py-2 text-sm"
                                    onClick={() => setOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    disabled={shared && !editable}
                                    data-emc-primary="true"
                                    className="flex items-center gap-1 rounded bg-amber-400 px-4 py-2 font-semibold text-black disabled:opacity-40"
                                    onClick={apply}
                                >
                                    <Check className="size-4" />
                                    Apply
                                </button>
                            </div>
                        </footer>
                    </section>
                </div>
            )}
        </>
    )
}
