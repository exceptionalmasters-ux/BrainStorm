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
                        (p) =>
                            `${layout.bodyFrame.x + p[0] * layout.bodyFrame.width},${layout.bodyFrame.y + p[1] * layout.bodyFrame.height}`,
                    )
                    .join(" ")}
                fill="white"
                stroke="black"
                strokeWidth={1}
            />
            {!!symbol.body?.antennaHeight && (
                <>
                    <line
                        x1={layout.bodyFrame.x}
                        x2={layout.bodyFrame.x + layout.bodyFrame.width}
                        y1={
                            layout.bodyFrame.y +
                            layout.bodyFrame.height * symbol.body.antennaHeight
                        }
                        y2={
                            layout.bodyFrame.y +
                            layout.bodyFrame.height * symbol.body.antennaHeight
                        }
                        stroke="black"
                    />
                    <text
                        x={layout.width / 2}
                        y={
                            layout.bodyFrame.y +
                            (layout.bodyFrame.height *
                                symbol.body.antennaHeight) /
                                2
                        }
                        textAnchor="middle"
                        fontSize={12}
                    >
                        ANTENNA
                    </text>
                </>
            )}
            {symbol.body?.pin1 && (
                <circle
                    cx={
                        layout.bodyFrame.x +
                        symbol.body.pin1.x * layout.bodyFrame.width
                    }
                    cy={
                        layout.bodyFrame.y +
                        symbol.body.pin1.y * layout.bodyFrame.height
                    }
                    r={4}
                    fill="black"
                />
            )}
            {layout.header ? (
                <>
                    <text
                        x={layout.width / 2}
                        y={12}
                        textAnchor="middle"
                        fontSize={12}
                        fontWeight="bold"
                    >
                        U?
                    </text>
                    <text
                        x={layout.width / 2}
                        y={30}
                        textAnchor="middle"
                        fontSize={14}
                    >
                        {symbol.name}
                    </text>
                </>
            ) : (
                [symbol.name, symbol.device, symbol.package].map((text, i) => (
                    <text
                        key={i}
                        x={layout.width / 2}
                        y={layout.height / 2 - 18 + i * 20}
                        textAnchor="middle"
                        fontSize={i === 0 ? 16 : 12}
                    >
                        {text}
                    </text>
                ))
            )}
            {layout.leaders.map((line) => (
                <polyline
                    key={line.id}
                    points={line.points.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke="black"
                    strokeWidth={1}
                />
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
                    fontSize={layout.fontSize}
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
