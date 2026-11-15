"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricHistory, MissionEvent } from "@/types/blue";
import { SERIES_COLORS, STATUS_STYLES, formatNumber } from "@/lib/metrics";

const NOMINAL_FILL = "#0E9F86";
const BASELINE = "#5F6B71";
const GRID = "#E6EDF3";
const AXIS = "#D2DEE8";
const TICK = "#5E686E";

interface Row {
  label: string;
  t: string;
  day: number;
  activity: string | null;
  [key: string]: unknown;
}

export function pointLabel(t: string, day: number, resolution: MetricHistory["resolution"]): string {
  if (resolution === "15min") return t.slice(11, 16);
  if (resolution === "hourly") return `D${day} ${t.slice(11, 13)}h`;
  return `Day ${day}`;
}

/** Round axis bounds to a 1/2/2.5/5 x 10^n step so ticks read cleanly. */
function niceScale(lo: number, hi: number, cap: number | null) {
  const span = hi - lo || Math.max(1, Math.abs(hi) * 0.1);
  const raw = (span * 1.2) / 5;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw) ?? 10 * mag;
  let min = Math.floor((lo - span * 0.08) / step) * step;
  let max = Math.ceil((hi + span * 0.08) / step) * step;
  if (cap != null && hi <= cap) max = Math.min(max, cap);
  if (lo >= 0) min = Math.max(min, 0);
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 1000; v += step) ticks.push(Number(v.toFixed(6)));
  const tickDecimals = (String(Number(step.toFixed(6))).split(".")[1] ?? "").length;
  return { domain: [min, max] as [number, number], ticks, tickDecimals };
}

/** Index of the chart point an event belongs to (first point at/after its start). */
function eventIndex(e: MissionEvent, rows: Row[], resolution: MetricHistory["resolution"]): number {
  if (resolution === "daily") return rows.findIndex((r) => r.day === e.mission_day);
  const i = rows.findIndex((r) => r.t >= e.start.slice(0, resolution === "hourly" ? 13 : 16));
  return i;
}

export default function MetricChart({
  history,
  height = 340,
  baseline = null,
}: {
  history: MetricHistory;
  height?: number;
  /** Personal reference: this astronaut's whole-mission average of the first series. */
  baseline?: number | null;
}) {
  const { metric, points, resolution } = history;
  const series = metric.series;
  const banded = points.some((p) => p.low);

  const rows: Row[] = points.map((p) => {
    const row: Row = { label: pointLabel(p.t, p.mission_day, resolution), t: p.t, day: p.mission_day, activity: p.activity };
    series.forEach((s, i) => {
      row[`s${i}`] = p.values[s.field];
      const lo = p.low?.[s.field];
      const hi = p.high?.[s.field];
      if (lo != null && hi != null) row[`b${i}`] = [lo, hi];
    });
    return row;
  });

  // Y domain from the data itself, padded; the normal band is clipped to it.
  const all: number[] = [];
  for (const p of points)
    for (const s of series) {
      for (const v of [p.values[s.field], p.low?.[s.field], p.high?.[s.field]]) if (v != null) all.push(v);
    }
  if (baseline != null) all.push(baseline);
  const dmin = all.length ? Math.min(...all) : 0;
  const dmax = all.length ? Math.max(...all) : 1;
  const { domain, ticks, tickDecimals } = niceScale(dmin, dmax, metric.unit === "%" ? 100 : null);
  const t = series[0].thresholds;
  const bandLo = Math.max(t?.advisory_low ?? domain[0], domain[0]);
  const bandHi = Math.min(t?.advisory_high ?? domain[1], domain[1]);
  const showBand = t && (t.advisory_low != null || t.advisory_high != null) && bandHi > bandLo;

  const sparse = metric.cadence !== "continuous" && resolution !== "daily";

  const markers = history.events
    .map((e, n) => ({ e, n: n + 1, i: eventIndex(e, rows, resolution) }))
    .filter((m) => m.i >= 0);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 18, right: 28, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: TICK, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={{ stroke: AXIS }}
            minTickGap={28}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={domain}
            tick={{ fontSize: 11, fill: TICK, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            width={48}
            ticks={ticks}
            tickFormatter={(v: number) => formatNumber(v, tickDecimals)}
          />
          {showBand && (
            <ReferenceArea y1={bandLo} y2={bandHi} fill={NOMINAL_FILL} fillOpacity={0.09} stroke="none" ifOverflow="hidden" />
          )}
          {markers.map(({ e, n, i }) => (
            <ReferenceLine
              key={e.id}
              x={rows[i].label}
              stroke={STATUS_STYLES[e.severity].hex}
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{ value: `${n}`, position: "top", fontSize: 11, fontWeight: 600, fill: "#151515" }}
            />
          ))}
          {baseline != null && (
            <ReferenceLine
              y={baseline}
              stroke={BASELINE}
              strokeDasharray="2 4"
              strokeWidth={1}
              ifOverflow="extendDomain"
            />
          )}
          {banded &&
            series.map((s, i) => (
              <Area
                key={`band-${s.field}`}
                dataKey={`b${i}`}
                stroke="none"
                fill={SERIES_COLORS[i]}
                fillOpacity={0.14}
                isAnimationActive={false}
                connectNulls
                activeDot={false}
              />
            ))}
          {series.map((s, i) => (
            <Line
              key={s.field}
              dataKey={`s${i}`}
              name={s.label}
              stroke={SERIES_COLORS[i]}
              strokeWidth={2}
              strokeDasharray={i === 1 ? "6 4" : undefined}
              dot={sparse || points.length <= 40 ? { r: 3, strokeWidth: 0, fill: SERIES_COLORS[i] } : false}
              activeDot={{ r: 5, stroke: "#FFFFFF", strokeWidth: 2 }}
              connectNulls={sparse}
              isAnimationActive={false}
            />
          ))}
          <Tooltip
            cursor={{ stroke: "#9DB0C0", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as Row;
              return (
                <div className="rounded-[14px] border border-line bg-white px-3.5 py-2.5 text-xs shadow-[var(--shadow-pop)]">
                  <p className="num font-medium text-ink">
                    {resolution === "daily" ? `Mission day ${row.day}` : `Day ${row.day} · ${row.t.slice(11, 16)} UTC`}
                  </p>
                  {row.activity && <p className="text-ink-soft">{row.activity}</p>}
                  {series.map((s, i) => {
                    const v = row[`s${i}`] as number | null | undefined;
                    const band = row[`b${i}`] as [number, number] | undefined;
                    return (
                      <p key={s.field} className="mt-1 flex items-center gap-1.5 text-ink">
                        <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: SERIES_COLORS[i] }} />
                        {s.label}: <strong className="num font-medium">{v == null ? "no sample" : formatNumber(v, metric.decimals)}</strong>{" "}
                        {v != null && metric.unit}
                        {band && (
                          <span className="text-ink-soft">
                            ({formatNumber(band[0], metric.decimals)}–{formatNumber(band[1], metric.decimals)})
                          </span>
                        )}
                      </p>
                    );
                  })}
                </div>
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
