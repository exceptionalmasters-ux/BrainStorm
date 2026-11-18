import { type EmcSymbol, emcPinLabel, symbolLayout } from "@/lib/emc-symbols"
/** Uses the exact layout used by native cells. All graphics are local bounded vectors. */
export function SymbolPreview({
    symbol,
    compact = false,
}: {
    symbol: EmcSymbol
    compact?: boolean
}) {
    const layout = symbolLayout(symbol)
    const padding = Math.max(
        16,
        layout.rich
            ? 16
            : Math.max(
                  ...symbol.pins.map((p) => emcPinLabel(p).length * 7),
                  40,
              ),
    )
    return (
        <svg
            role="img"
            aria-label={
                compact ? "Symbol thumbnail" : "Symbol approval preview"
            }
            preserveAspectRatio="xMidYMid meet"
            viewBox={`${-padding} ${-padding} ${layout.width + padding * 2} ${layout.height + padding * 2}`}
            className={
                compact
                    ? "h-full w-full text-black"
                    : "max-h-80 w-full rounded border bg-white text-black"
            }
        >
            <title>{symbol.name} — connection points</title>
            <polygon
                points={layout.outline
                    .map(
                        (p) => `${p[0] * layout.width},${p[1] * layout.height}`,
                    )
                    .join(" ")}
                fill="white"
                stroke="black"
                strokeWidth={Math.max(1, layout.width / 600)}
            />
            {!!symbol.body?.antennaHeight && (
                <>
                    <line
                        x1={0}
                        x2={layout.width}
                        y1={layout.height * symbol.body.antennaHeight}
                        y2={layout.height * symbol.body.antennaHeight}
                        stroke="black"
                    />
                    <text
                        x={layout.width / 2}
                        y={(layout.height * symbol.body.antennaHeight) / 2}
                        textAnchor="middle"
                        fontSize={12}
                    >
                        ANTENNA
                    </text>
                </>
            )}
            {symbol.body?.pin1 && (
                <circle
                    cx={symbol.body.pin1.x * layout.width}
                    cy={symbol.body.pin1.y * layout.height}
                    r={4}
                    fill="black"
                />
            )}
            {[symbol.name, symbol.device, symbol.package].map((text, i) => (
                <text
                    key={i}
                    x={layout.width / 2}
                    y={layout.height / 2 - 18 + i * 20}
                    textAnchor="middle"
                    fontSize={i === 0 ? 16 : 12}
                >
                    {text}
                </text>
            ))}
            {layout.pins.map((p) => (
                <circle
                    key={p.number}
                    cx={p.x * layout.width}
                    cy={p.y * layout.height}
                    r={3}
                    fill="black"
                />
            ))}
            {layout.labels.map((l) => (
                <text
                    key={l.id}
                    x={l.x}
                    y={l.y}
                    dominantBaseline="central"
                    textAnchor={l.anchor as "start" | "middle" | "end"}
                    fontSize={11}
                    transform={
                        l.rotation
                            ? `rotate(${l.rotation} ${l.x} ${l.y})`
                            : undefined
                    }
                >
                    {l.text}
                </text>
            ))}
        </svg>
    )
}
