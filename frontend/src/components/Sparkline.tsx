"use client";

import { useEffect, useRef, useState } from "react";
import type { MetricHistory } from "@/types/blue";
import { SERIES_COLORS, formatNumber } from "@/lib/metrics";

interface Props {
  history: MetricHistory;
  height?: number;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function edgeLabel(t: string, day: number, resolution: MetricHistory["resolution"]) {
  return resolution === "15min" ? t.slice(11, 16) : `D${day}`;
}

/**
 * Bare trend line for the dashboard (first series only). Alert thresholds that fall inside
 * the plotted range are drawn as thin dashed lines; gaps stay open where samples are
 * missing; the latest value carries a dot. Start/end labels anchor the time span.
 * Exact numbers, axes and events live on the metric's detail page.
 */
export default function Sparkline({ history, height = 40 }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { metric, points, resolution } = history;
  const first = points[0];
  const lastPoint = points[points.length - 1];
  const series = metric.series[0];
  const values = points.map((p) => p.values[series.field] ?? null);
  const present = values.filter((v): v is number => v != null);

  const lo = present.length ? Math.min(...present) : 0;
  const hi = present.length ? Math.max(...present) : 1;
  const label = present.length
    ? `${series.label}, ${edgeLabel(first.t, first.mission_day, resolution)} to ${edgeLabel(lastPoint.t, lastPoint.mission_day, resolution)}: lowest ${formatNumber(
        lo,
        metric.decimals,
      )}, highest ${formatNumber(hi, metric.decimals)} ${metric.unit}`
    : "No trend data";

  let body: React.ReactNode = null;
  if (width > 8 && present.length > 0) {
    // Sampled-once-a-day metrics are connected; missing continuous samples break the line.
    const connect = metric.cadence !== "continuous" && resolution !== "daily";
    const pad = (hi - lo || Math.abs(hi) * 0.1 || 1) * 0.18;
    const y0 = lo - pad;
    const y1 = hi + pad;
    const x = (i: number) => 4 + (i / Math.max(1, values.length - 1)) * (width - 8);
    const y = (v: number) => height - 2 - ((v - y0) / (y1 - y0)) * (height - 4);

    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v == null) {
        if (!connect) pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });

    const t = series.thresholds;
    const limits = [t?.advisory_low, t?.advisory_high].filter((v): v is number => v != null && v > y0 && v < y1);

    let last = values.length - 1;
    while (last > 0 && values[last] == null) last--;

    body = (
      <svg width={width} height={height} aria-hidden className="block overflow-visible">
        {limits.map((v) => (
          <line key={v} x1={0} x2={width} y1={y(v)} y2={y(v)} stroke="#C47F0A" strokeOpacity={0.6} strokeDasharray="3 3" />
        ))}
        <path d={d} fill="none" stroke={SERIES_COLORS[0]} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {values[last] != null && (
          <circle cx={x(last)} cy={y(values[last] as number)} r={3.5} fill="#FFFFFF" stroke={SERIES_COLORS[0]} strokeWidth={2} />
        )}
      </svg>
    );
  }


  return (
    <div role="img" aria-label={label} title={label}>
      <div ref={ref} style={{ height }} className="w-full">
        {body ??
          (width > 0 && (
            <svg width={width} height={height} aria-hidden>
              <line x1="0" x2={width} y1={height / 2} y2={height / 2} stroke="#C9D6E1" strokeDasharray="2 3" />
            </svg>
          ))}
      </div>
      {first && lastPoint && (
        <div className="num mt-0.5 flex justify-between text-[10px] text-ink-faint" aria-hidden>
          <span>{edgeLabel(first.t, first.mission_day, resolution)}</span>
          <span>{edgeLabel(lastPoint.t, lastPoint.mission_day, resolution)}</span>
        </div>
      )}
    </div>
  );
}
