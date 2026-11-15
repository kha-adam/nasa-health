import type { MissionWeek } from "@/types/blue";

const PER_ROW = 7;
const COL = 96;
const ROW = 92;
const PAD_X = 54;
const PAD_Y = 44;

/** Five-point star centred on (cx, cy). */
function starPath(cx: number, cy: number, outer: number, inner = outer * 0.45): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  });
  return `M${pts.join("L")}Z`;
}

/**
 * The mission map: the mission's weeks as a route, one star for every crew
 * challenge completed. A functional chart, not decoration: each mark is a week,
 * and its shape says what happened (star = completed, hollow ring = missed,
 * outlined star = in progress) so it never relies on colour alone.
 */
export default function MissionStarMap({ weeks, highlightWeek }: { weeks: MissionWeek[]; highlightWeek?: number | null }) {
  const rows = Math.max(1, Math.ceil(weeks.length / PER_ROW));
  const width = PAD_X * 2 + COL * (PER_ROW - 1);
  const height = PAD_Y * 2 + ROW * (rows - 1) + 18;

  // Route snakes left→right, then right→left, like a mission timeline folded on the page.
  const nodes = weeks.map((w, i) => {
    const row = Math.floor(i / PER_ROW);
    const col = row % 2 === 0 ? i % PER_ROW : PER_ROW - 1 - (i % PER_ROW);
    return { w, x: PAD_X + col * COL, y: PAD_Y + row * ROW };
  });

  let route = "";
  nodes.forEach((n, i) => {
    if (i === 0) {
      route = `M${n.x},${n.y}`;
      return;
    }
    const prev = nodes[i - 1];
    if (prev.y === n.y) route += ` L${n.x},${n.y}`;
    else {
      // U-turn at the end of a row.
      const side = prev.x > width / 2 ? 1 : -1;
      const r = (n.y - prev.y) / 2;
      route += ` A${r},${r} 0 0 ${side > 0 ? 1 : 0} ${n.x},${n.y}`;
    }
  });

  const stars = weeks.filter((w) => w.completed).length;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Mission map: ${stars} stars over ${weeks.length} weeks. Each completed crew challenge adds a star.`}
    >
      <path d={route} fill="none" stroke="#c9d9ea" strokeWidth={2} strokeDasharray="1 7" strokeLinecap="round" />
      {nodes.map(({ w, x, y }) => {
        const label = `Week ${w.week} (days ${w.start_day}–${w.end_day}): ${
          w.completed ? "crew challenge completed" : w.current ? "in progress" : "challenge missed"
        }`;
        const isNew = highlightWeek === w.week && w.completed;
        return (
          <g key={w.week}>
            <title>{label}</title>
            {w.current && <circle cx={x} cy={y} r={21} fill="none" stroke="#245bcb" strokeWidth={1.5} strokeDasharray="3 3" />}
            {w.completed ? (
              <path
                d={starPath(x, y, 15)}
                fill={w.current ? "#245bcb" : "#0b3d91"}
                stroke="#ffffff"
                strokeWidth={1.5}
                strokeLinejoin="round"
                className={isNew ? "star-new" : undefined}
              />
            ) : w.current ? (
              <path d={starPath(x, y, 15)} fill="#ffffff" stroke="#245bcb" strokeWidth={1.8} strokeLinejoin="round" />
            ) : (
              <circle cx={x} cy={y} r={6} fill="#ffffff" stroke="#9fb3c5" strokeWidth={1.8} />
            )}
            <text
              x={x}
              y={y + 33}
              textAnchor="middle"
              fontSize={12}
              fontWeight={w.current ? 700 : 500}
              fill={w.current ? "#245bcb" : "#5e686e"}
              className="num"
            >
              {w.current ? `W${w.week} · now` : `W${w.week}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
