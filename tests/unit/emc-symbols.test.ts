import { generateText } from "ai"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
    callEmcGateway,
    EMC_MODEL_ID,
    emcGatewayHeaders,
    emcModel,
} from "@/lib/emc-ai"
import {
    type EmcSymbol,
    emcPinLabel,
    insertEmcSymbolNative,
    symbolLayout,
    validateEmcSymbol,
} from "@/lib/emc-symbols"
import { loadFlattenedServerModels } from "@/lib/server-model-config"
import {
    analyseSource,
    cancelDeviceResearch,
    disableDeviceWeb,
    draftDevice,
    researchDevice,
    useDeviceResearch,
} from "@/stores/device-research-store"

const symbol: EmcSymbol = {
    name: "Test module",
    device: "Fixture 1",
    package: "DIP-4",
    pins: [
        {
            number: "1",
            name: "VCC",
            side: "left",
            sourceUrl: "https://example.com/data",
            evidence: "1: VCC",
        },
        {
            number: "2",
            name: "GND",
            side: "left",
            sourceUrl: "https://example.com/data",
            evidence: "2: GND",
        },
        {
            number: "3",
            name: "IO",
            side: "right",
            sourceUrl: "https://example.com/data",
            evidence: "3: IO",
        },
        {
            number: "4",
            name: "CLK",
            side: "top",
            sourceUrl: "https://example.com/data",
            evidence: "4: CLK",
        },
    ],
}
afterEach(() => {
    disableDeviceWeb()
    useDeviceResearch.setState({ result: null, draft: null })
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
})

describe("EMC native symbols", () => {
    it("uses the same, separated port coordinates in the preview and the native graph", () => {
        const layout = symbolLayout(symbol)
        expect(layout.pins.map((p) => [p.x, p.y])).toEqual([
            [0, 1 / 3],
            [0, 2 / 3],
            [1, 1 / 2],
            [1 / 2, 0],
        ])
        const cells: any[] = []
        const graph = {
            isEnabled: () => true,
            getFreeInsertPoint: () => ({ x: 40, y: 50 }),
            getDefaultParent: () => "layer",
            stopEditing: vi.fn(),
            model: {
                beginUpdate: vi.fn(),
                endUpdate: vi.fn(),
                setGeometry: vi.fn(),
            },
            insertVertex: vi.fn((...args: any[]) => {
                const cell = {
                    args,
                    setConnectable: vi.fn(),
                    geometry: { clone: () => ({}) },
                }
                cells.push(cell)
                return cell
            }),
            setSelectionCell: vi.fn(),
            scrollCellToVisible: vi.fn(),
        }
        expect(
            insertEmcSymbolNative(
                { editor: { graph } },
                {
                    mxPoint: class {
                        constructor(
                            public x: number,
                            public y: number,
                        ) {}
                    },
                },
                symbol,
            ),
        ).toBe(true)
        expect(cells).toHaveLength(5)
        expect(cells[0].setConnectable).toHaveBeenCalledWith(false)
        expect(
            cells
                .slice(1)
                .every((c) => c.args[0] === cells[0] && c.args[8] === true),
        ).toBe(true)
        expect(graph.model.beginUpdate).toHaveBeenCalledOnce()
        expect(graph.model.endUpdate).toHaveBeenCalledOnce()
        expect(graph.setSelectionCell).toHaveBeenCalledWith(cells[0])
    })
    it("rejects duplicate pins and non-HTTPS source URLs before graph mutation", () => {
        expect(
            validateEmcSymbol({
                ...symbol,
                pins: [symbol.pins[0], symbol.pins[0]],
            }),
        ).toBe(false)
        expect(
            validateEmcSymbol({
                ...symbol,
                pins: [{ ...symbol.pins[0], sourceUrl: "javascript:alert(1)" }],
            }),
        ).toBe(false)
        expect(insertEmcSymbolNative({}, {}, symbol)).toBe(false)
    })
})
describe("EMC shared model", () => {
    it("is the default in production without hiding other configured models", async () => {
        vi.stubEnv("EMC_OPERATIONS_ONLY", "1")
        vi.stubEnv(
            "AI_MODELS_CONFIG",
            JSON.stringify({
                providers: [
                    {
                        name: "Other",
                        provider: "openai",
                        models: ["other"],
                        default: true,
                    },
                ],
            }),
        )
        vi.stubEnv("SETTINGS_FILE", "/nonexistent/emc-settings.json")
        const models = await loadFlattenedServerModels()
        expect(models[0]).toMatchObject({
            id: EMC_MODEL_ID,
            modelId: "EMC OpenAI",
            isDefault: true,
        })
        expect(models.find((m) => m.modelId === "other")).toMatchObject({
            isDefault: false,
        })
    })
    it("sends the Operations JWT to the fixed gateway and does not require the OpenAI secret", async () => {
        const requests: any[] = []
        vi.stubGlobal(
            "fetch",
            vi.fn(async (url, init) => {
                requests.push({ url: String(url), init })
                return Response.json({
                    id: "resp_fixture",
                    object: "response",
                    created_at: 1,
                    model: "fixture",
                    output: [
                        {
                            type: "message",
                            id: "msg1",
                            status: "completed",
                            role: "assistant",
                            content: [
                                {
                                    type: "output_text",
                                    text: "Ready",
                                    annotations: [],
                                },
                            ],
                        },
                    ],
                    usage: {
                        input_tokens: 1,
                        output_tokens: 1,
                        total_tokens: 2,
                    },
                })
            }),
        )
        const request = new Request("https://editor.example/api/chat", {
            headers: {
                "x-emc-access-token": "fixture-jwt",
                "x-emc-context-type": "project",
                "x-emc-context-id": "fixture-context",
            },
        })
        expect(emcGatewayHeaders(request).Authorization).toBe(
            "Bearer fixture-jwt",
        )
        const result = await generateText({
            model: emcModel(request).model,
            prompt: "Hello",
        })
        expect(result.text).toBe("Ready")
        expect(requests[0].url).toBe(
            "https://fzwiphplhspsoktugoqo.supabase.co/functions/v1/brainstorm-ai/responses",
        )
        expect(new Headers(requests[0].init.headers).get("authorization")).toBe(
            "Bearer fixture-jwt",
        )
        expect(() =>
            emcGatewayHeaders(new Request("https://editor.example/api/chat")),
        ).toThrow(/Operations/)
    })
})
describe("managed upstream cancellation", () => {
    it("preserves the SDK cancellation signal when relaying to Supabase", async () => {
        const controller = new AbortController()
        vi.stubGlobal(
            "fetch",
            vi.fn(
                (_url, init) =>
                    new Promise((_resolve, reject) => {
                        init.signal.addEventListener(
                            "abort",
                            () =>
                                reject(
                                    new DOMException("Aborted", "AbortError"),
                                ),
                            { once: true },
                        )
                    }),
            ),
        )
        const request = new Request("https://editor.example/api/chat", {
            headers: {
                "x-emc-access-token": "fixture-jwt",
                "x-emc-context-type": "project",
                "x-emc-context-id": "fixture-context",
            },
        })
        const pending = generateText({
            model: emcModel(request).model,
            prompt: "Hello",
            abortSignal: controller.signal,
            maxRetries: 0,
        })
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
        controller.abort()
        await expect(pending).rejects.toThrow(/Aborted/)
    })
})
describe("Web consent and cancellation", () => {
    it("does not issue any request while Web is off", async () => {
        const fetchMock = vi.fn()
        vi.stubGlobal("fetch", fetchMock)
        await expect(researchDevice("Fixture")).rejects.toThrow(/Enable Web/)
        expect(fetchMock).not.toHaveBeenCalled()
    })
    it("Stop cancels research without switching Web off", async () => {
        let resolve!: (value: Response) => void
        let signal: AbortSignal | undefined
        vi.stubGlobal(
            "fetch",
            vi.fn((_url, init) => {
                signal = init.signal
                return new Promise<Response>((r) => {
                    resolve = r
                })
            }),
        )
        useDeviceResearch.setState({ webEnabled: true })
        const pending = researchDevice("Fixture")
        cancelDeviceResearch()
        expect(signal?.aborted).toBe(true)
        expect(useDeviceResearch.getState().webEnabled).toBe(true)
        resolve(
            Response.json({
                researchId: "late",
                questions: [],
                candidates: [],
            }),
        )
        await expect(pending).rejects.toThrow(/cancelled/)
    })
    it("aborts in-flight research and ignores a late result on disable", async () => {
        let resolve!: (value: Response) => void
        let signal: AbortSignal | undefined
        vi.stubGlobal(
            "fetch",
            vi.fn((_url, init) => {
                signal = init.signal
                return new Promise<Response>((r) => {
                    resolve = r
                })
            }),
        )
        useDeviceResearch.setState({ webEnabled: true })
        const pending = researchDevice("Fixture")
        disableDeviceWeb()
        expect(signal?.aborted).toBe(true)
        resolve(
            Response.json({
                researchId: "late",
                questions: [],
                candidates: [],
            }),
        )
        await expect(pending).rejects.toThrow(/cancelled/)
        expect(useDeviceResearch.getState().result).toBeNull()
        expect(useDeviceResearch.getState().busy).toBe(false)
    })
})

it("offers an explicit incomplete retry without automatically saving or inventing ports", async () => {
    useDeviceResearch.setState({
        webEnabled: true,
        result: { researchId: "research", questions: [], candidates: [] },
    })
    const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
            Response.json({ symbol: null, questions: ["Missing pinout"] }),
        )
        .mockResolvedValueOnce(
            Response.json({
                symbol: {
                    ...symbol,
                    pins: [],
                    incomplete: true,
                    sourceUrl: "https://example.com/data",
                    warnings: ["Unknown pins omitted"],
                },
                questions: [],
            }),
        )
    vi.stubGlobal("fetch", fetchMock)
    await draftDevice("candidate")
    expect(useDeviceResearch.getState().incompleteCandidateId).toBe("candidate")
    expect(useDeviceResearch.getState().draft).toBeNull()
    await draftDevice("candidate", "", true)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).allowIncomplete).toBe(
        true,
    )
    expect(validateEmcSymbol(useDeviceResearch.getState().draft)).toBe(true)
    expect(useDeviceResearch.getState().draft?.pins).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
})

it("keeps labelled unnumbered pads at documented positions and preserves the module outline", () => {
    const module: EmcSymbol = {
        name: "ESP-12E",
        device: "ESP-12E",
        package: "SMD",
        body: { width: 240, height: 360, antennaHeight: 0.25 },
        pins: [
            {
                number: "RST",
                identifierKind: "label",
                name: "RST",
                side: "left",
                position: 0.35,
                sourceUrl: "https://example.com/module.pdf",
                evidence: "page 1 left RST pad",
            },
            {
                number: "TXD",
                identifierKind: "label",
                name: "TXD",
                side: "right",
                position: 0.35,
                sourceUrl: "https://example.com/module.pdf",
                evidence: "page 1 right TXD pad",
            },
        ],
    }
    expect(validateEmcSymbol(module)).toBe(true)
    expect(symbolLayout(module)).toMatchObject({
        width: 240,
        height: 360,
        pins: [
            { x: 0, y: 0.35 },
            { x: 1, y: 0.35 },
        ],
    })
    expect(emcPinLabel(module.pins[0])).toBe("RST")
    expect(
        validateEmcSymbol({
            ...module,
            pins: [{ ...module.pins[0], position: 1.5 }],
        }),
    ).toBe(false)
    expect(
        validateEmcSymbol({ ...module, body: { width: 240, height: 99999 } }),
    ).toBe(false)
})

it("analyses and drafts a private attachment with Web off", async () => {
    useDeviceResearch.setState({ webEnabled: true, result: null, draft: null })
    const result = {
        researchId: "local-research",
        sourceId: "private-file",
        questions: [],
        candidates: [{ id: "candidate" }],
    }
    const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(Response.json(result))
        .mockResolvedValueOnce(Response.json({ symbol, questions: [] }))
    vi.stubGlobal("fetch", fetchMock)
    await analyseSource("private-file", "Use the module on page 1")
    expect(useDeviceResearch.getState().webEnabled).toBe(false)
    await draftDevice("candidate")
    expect(fetchMock.mock.calls[0][0]).toContain("/source-research")
    expect(fetchMock.mock.calls[1][0]).toContain("/draft")
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).webEnabled).toBe(false)
    expect(useDeviceResearch.getState().draft).toEqual(symbol)
})

it("limits Web lookup only, preserving unbounded drafting and user cancellation", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout")
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json({})),
    )
    const request = new Request("https://editor.example/api/chat", {
        headers: { "x-emc-access-token": "fixture" },
    })
    for (const action of ["draft", "source-research", "approve", "library"]) {
        await callEmcGateway(request, action, {})
    }
    expect(timeout).not.toHaveBeenCalled()
    expect(vi.mocked(fetch).mock.calls[0][1]?.signal).toBe(request.signal)
    await callEmcGateway(request, "research", {})
    expect(timeout).toHaveBeenCalledWith(125000)
    timeout.mockRestore()
})
