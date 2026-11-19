import { create } from "zustand"
import { getApiEndpoint } from "@/lib/base-path"
import {
    type DeviceResearch,
    type EmcSymbol,
    type LibrarySymbol,
    validateEmcSymbol,
} from "@/lib/emc-symbols"

let controller: AbortController | null = null
let generation = 0
export const useDeviceResearch = create<{
    selectedSource: { id: string; name: string } | null
    sourceBusy: boolean
    fileMode: boolean
    instructions: string
    webEnabled: boolean
    busy: boolean
    startedAt: number | null
    phase: string
    error: string
    result: DeviceResearch | null
    incompleteCandidateId: string | null
    draftCandidateId: string | null
    previousDraft: EmcSymbol | null
    draft: EmcSymbol | null
    library: LibrarySymbol[]
    libraryOpen: boolean
    set: (value: Partial<Omit<ReturnType<typeof researchState>, "set">>) => void
}>(() => ({
    ...researchState(),
    set: (value) => useDeviceResearch.setState(value),
}))
function researchState() {
    return {
        selectedSource: null as { id: string; name: string } | null,
        sourceBusy: false,
        fileMode: false,
        instructions: "",
        webEnabled: false,
        busy: false,
        startedAt: null as number | null,
        phase: "",
        error: "",
        result: null as DeviceResearch | null,
        incompleteCandidateId: null as string | null,
        draftCandidateId: null as string | null,
        previousDraft: null as EmcSymbol | null,
        draft: null as EmcSymbol | null,
        library: [] as LibrarySymbol[],
        libraryOpen: false,
    }
}
export async function emcAction<T>(
    action: string,
    body: unknown,
    signal?: AbortSignal,
): Promise<T> {
    const response = await fetch(getApiEndpoint(`/api/emc/${action}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "EMC request failed")
    return data
}
export function cancelDeviceResearch() {
    generation++
    controller?.abort()
    controller = null
    useDeviceResearch.setState({ busy: false, error: "" })
}
export function disableDeviceWeb() {
    cancelDeviceResearch()
    useDeviceResearch.setState({ webEnabled: false })
}
export async function researchDevice(query: string): Promise<DeviceResearch> {
    if (useDeviceResearch.getState().draft)
        throw Error(
            "Save or discard the current symbol preview before starting new research.",
        )
    if (!useDeviceResearch.getState().webEnabled)
        throw new Error("Enable Web before searching.")
    controller?.abort()
    controller = new AbortController()
    const ticket = ++generation
    useDeviceResearch.setState({
        busy: true,
        error: "",
        startedAt: Date.now(),
        phase: "Searching cited pinouts and device views",
    })
    try {
        const result = await emcAction<DeviceResearch>(
            "research",
            { query, webEnabled: true },
            controller.signal,
        )
        if (generation !== ticket) throw new Error("Search cancelled")
        useDeviceResearch.setState({
            result,
            draft: null,
            incompleteCandidateId: null,
        })
        return result
    } catch (error) {
        if (generation === ticket)
            useDeviceResearch.setState({
                error: error instanceof Error ? error.message : "Search failed",
            })
        throw error
    } finally {
        if (generation === ticket) useDeviceResearch.setState({ busy: false })
    }
}
export async function draftDevice(
    candidateId: string,
    edits?: string,
    allowIncomplete = false,
    revision?: { symbol: EmcSymbol; allowPinRemoval: boolean },
) {
    const { webEnabled, result } = useDeviceResearch.getState()
    if (!result || (!webEnabled && !result.sourceId))
        throw new Error("Enable Web and select a source-backed result.")
    controller?.abort()
    controller = new AbortController()
    const ticket = ++generation
    useDeviceResearch.setState({
        busy: true,
        error: "",
        startedAt: Date.now(),
        phase: "Reading source geometry and documented pins",
    })
    try {
        const response = await emcAction<{
            symbol: EmcSymbol | null
            questions: string[]
        }>(
            "draft",
            {
                researchId: result.researchId,
                candidateId,
                edits: edits ?? useDeviceResearch.getState().instructions,
                allowIncomplete,
                webEnabled,
                ...(revision
                    ? {
                          previousSymbol: revision.symbol,
                          sourceInstructions:
                              useDeviceResearch.getState().instructions,
                          allowPinRemoval: revision.allowPinRemoval,
                      }
                    : {}),
            },
            controller.signal,
        )
        if (generation !== ticket) return
        if (revision) {
            if (!response.symbol)
                throw Error(
                    response.questions.join("\n") ||
                        "No corrected proposal returned. Your current symbol is retained.",
                )
            if (!validateEmcSymbol(response.symbol))
                throw Error(
                    "Invalid corrected proposal. Your current symbol is retained.",
                )
            const identifiers = new Set(
                response.symbol.pins.map((pin) => pin.number),
            )
            const missing = revision.symbol.pins.filter(
                (pin) => !identifiers.has(pin.number),
            )
            if (missing.length && !revision.allowPinRemoval)
                throw Error(
                    `Correction omitted pins ${missing.map((pin) => pin.number).join(", ")}. Your current symbol is retained. Allow pin removal only if intentional.`,
                )
            if (revision.symbol.body?.density && response.symbol.body)
                response.symbol.body.density = revision.symbol.body.density
        }
        useDeviceResearch.setState({
            draft: response.symbol,
            draftCandidateId: response.symbol ? candidateId : null,
            previousDraft: revision?.symbol || null,
            incompleteCandidateId: response.symbol ? null : candidateId,
            error: response.questions.join("\n"),
        })
    } catch (error) {
        if (generation === ticket)
            useDeviceResearch.setState({
                error: error instanceof Error ? error.message : "Draft failed",
            })
    } finally {
        if (generation === ticket) useDeviceResearch.setState({ busy: false })
    }
}

export async function analyseSource(sourceId: string, query: string) {
    if (useDeviceResearch.getState().draft)
        throw Error(
            "Save or discard the current symbol preview before analysing another file.",
        )
    useDeviceResearch.setState({
        instructions: query || useDeviceResearch.getState().instructions,
    })
    disableDeviceWeb()
    controller = new AbortController()
    const ticket = ++generation
    useDeviceResearch.setState({
        busy: true,
        startedAt: Date.now(),
        phase: "Reading the attached documentation",
        error: "",
        result: null,
        draft: null,
        incompleteCandidateId: null,
    })
    try {
        const result = await emcAction<DeviceResearch>(
            "source-research",
            { sourceId, query },
            controller.signal,
        )
        if (generation !== ticket) return
        useDeviceResearch.setState({ result })
    } catch (error) {
        if (generation === ticket)
            useDeviceResearch.setState({
                error:
                    error instanceof Error
                        ? error.message
                        : "File analysis failed",
            })
    } finally {
        if (generation === ticket) useDeviceResearch.setState({ busy: false })
    }
}

/** Refine the open proposal in place; failed/cancelled retries never erase it. */
export async function regenerateDraft(
    correction: string,
    allowPinRemoval = false,
) {
    const state = useDeviceResearch.getState()
    const text = correction.trim()
    if (!state.draft || state.busy || !text || text.length > 1500) return
    if (!validateEmcSymbol(state.draft)) {
        state.set({
            error: "Check the current pin names, sides and positions before requesting a correction.",
        })
        return
    }
    const candidateId =
        state.draftCandidateId ||
        state.result?.candidates.find(
            (candidate) =>
                candidate.device === state.draft?.device &&
                candidate.package === state.draft?.package,
        )?.id
    if (!candidateId) {
        state.set({
            error: "The source for this proposal is unavailable. Your current symbol is retained.",
        })
        return
    }
    await draftDevice(candidateId, text, !!state.draft.incomplete, {
        symbol: structuredClone(state.draft),
        allowPinRemoval,
    })
}
