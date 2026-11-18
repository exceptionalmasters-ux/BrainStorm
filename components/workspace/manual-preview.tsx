import type { ManualSymbol } from "@/lib/manual-symbol"
/** Only local bounded vectors. Stored labels are rendered as text, never HTML. */
export function ManualPreview({ symbol: s }: { symbol: ManualSymbol }) {
    const abs = (i: number): { x: number; y: number } => {
        const c = s.cells[i],
            g = c.geometry,
            p = c.parent === null ? null : s.cells[c.parent],
            o = c.parent === null ? { x: 0, y: 0 } : abs(c.parent)
        return {
            x:
                o.x +
                (g.relative && p ? g.x * p.geometry.width : g.x) +
                (g.offset?.x || 0),
            y:
                o.y +
                (g.relative && p ? g.y * p.geometry.height : g.y) +
                (g.offset?.y || 0),
        }
    }
    if (s.previewPng)
        return (
            <img
                src={s.previewPng}
                alt={`${s.name} preview`}
                className="h-full w-full object-contain bg-white"
            />
        )
    return (
        <svg
            role="img"
            aria-label={`${s.name} preview`}
            viewBox={`-8 -8 ${s.width + 16} ${s.height + 16}`}
            preserveAspectRatio="xMidYMid meet"
            className="h-full w-full bg-white"
        >
            <title>{s.name}</title>
            {s.cells.map((c, i) => {
                const style = Object.fromEntries(
                        c.style
                            .split(";")
                            .filter(Boolean)
                            .map((p) => p.split("=")),
                    ),
                    g = c.geometry,
                    p = abs(i),
                    stroke = style.strokeColor || "#000000",
                    fill = style.fillColor || "none"
                const props = {
                    stroke,
                    fill,
                    strokeWidth: Number(style.strokeWidth) || 1,
                }
                if (c.edge) {
                    const a =
                            c.source === undefined
                                ? g.sourcePoint
                                : abs(c.source),
                        b =
                            c.target === undefined
                                ? g.targetPoint
                                : abs(c.target)
                    if (!a || !b) return null
                    return (
                        <polyline
                            key={i}
                            points={[a, ...(g.points || []), b]
                                .map((v) => `${v.x},${v.y}`)
                                .join(" ")}
                            {...props}
                            fill="none"
                        />
                    )
                }
                return (
                    <g
                        key={i}
                        transform={`translate(${p.x} ${p.y}) rotate(${Number(style.rotation) || 0} ${g.width / 2} ${g.height / 2})`}
                    >
                        {c.freehand ? (
                            c.freehand.map((path, n) => (
                                <polyline
                                    key={n}
                                    points={path
                                        .map(
                                            (v) =>
                                                `${(v.x * g.width) / 100},${(v.y * g.height) / 100}`,
                                        )
                                        .join(" ")}
                                    {...props}
                                    fill="none"
                                />
                            ))
                        ) : style.shape === "ellipse" ? (
                            <ellipse
                                cx={g.width / 2}
                                cy={g.height / 2}
                                rx={g.width / 2}
                                ry={g.height / 2}
                                {...props}
                            />
                        ) : style.shape === "text" ||
                          style.shape === "group" ? null : (
                            <rect
                                width={g.width}
                                height={g.height}
                                rx={style.rounded === "1" ? 8 : 0}
                                {...props}
                            />
                        )}
                        {c.value && (
                            <text
                                x={g.width / 2}
                                y={g.height / 2}
                                dominantBaseline="middle"
                                textAnchor="middle"
                                fontSize={Number(style.fontSize) || 12}
                                fill={style.fontColor || "#000000"}
                            >
                                {c.value}
                            </text>
                        )}
                    </g>
                )
            })}
        </svg>
    )
}
