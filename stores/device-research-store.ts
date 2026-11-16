import { create } from "zustand"
import { getApiEndpoint } from "@/lib/base-path"
import type {
    DeviceResearch,
    EmcSymbol,
    LibrarySymbol,
} from "@/lib/emc-symbols"

let controller: AbortController | null = null
let generation = 0
export const useDeviceResearch = create<{
    webEnabled: boolean
    busy: boolean
    error: string
    result: DeviceResearch | null
    incompleteCandidateId: string | null
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
        webEnabled: false,
        busy: false,
        error: "",
        result: null as DeviceResearch | null,
        incompleteCandidateId: null as string | null,
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
    if (!useDeviceResearch.getState().webEnabled)
        throw new Error("Enable Web before searching.")
    controller?.abort()
    controller = new AbortController()
    const ticket = ++generation
    useDeviceResearch.setState({ busy: true, error: "" })
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
    edits = "",
    allowIncomplete = false,
) {
    const { webEnabled, result } = useDeviceResearch.getState()
    if (!webEnabled || !result)
        throw new Error("Enable Web and select a source-backed result.")
    controller?.abort()
    controller = new AbortController()
    const ticket = ++generation
    useDeviceResearch.setState({ busy: true, error: "" })
    try {
        const response = await emcAction<{
            symbol: EmcSymbol | null
            questions: string[]
        }>(
            "draft",
            {
                researchId: result.researchId,
                candidateId,
                edits,
                allowIncomplete,
                webEnabled: true,
            },
            controller.signal,
        )
        if (generation !== ticket) return
        useDeviceResearch.setState({
            draft: response.symbol,
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
