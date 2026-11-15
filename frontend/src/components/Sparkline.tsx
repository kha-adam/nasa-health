"use client";

import { useEffect, useRef, useState } from "react";
import type { MetricHistory } from "@/types/blue";
import { formatNumber } from "@/lib/metrics";
import { SERIES_COLORS } from "./MetricChart";

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
  const series = metric.series[0];
  const values = points.map((p) => p.values[series.field] ?? null);
  const present = values.filter((v): v is number => v != null);

  const lo = present.length ? Math.min(...present) : 0;
  const hi = present.length ? Math.max(...present) : 1;
  const label = present.length
    ? `${series.label}, ${points.length ? edgeLabel(points[0].t, points[0].mission_day, resolution) : ""} to now: lowest ${formatNumber(
        lo,
        metric.decimals,
      )}, highest ${formatNumber(hi, metric.decimals)} ${metric.unit}`
    : "No trend data";

  let body: React.ReactNode = null;
  if (width > 0 && present.length >= 2) {
    // Sampled-once-a-day metrics are connected; missing continuous samples break the line.
    const connect = metric.cadence !== "continuous" && resolution !== "daily";
    const pad = (hi - lo || Math.abs(hi) * 0.1 || 1) * 0.18;
    const y0 = lo - pad;
    const y1 = hi + pad;
    const x = (i: number) => 1 + (i / (values.length - 1)) * (width - 6);
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
          <line key={v} x1={0} x2={width} y1={y(v)} y2={y(v)} stroke="#EDB04F" strokeOpacity={0.55} strokeDasharray="3 3" />
        ))}
        <path d={d} fill="none" stroke={SERIES_COLORS[0]} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {values[last] != null && (
          <circle cx={x(last)} cy={y(values[last] as number)} r={3} fill="#E6EEF8" stroke="#0F1F36" strokeWidth={1.5} />
        )}
      </svg>
    );
  }

  const first = points[0];
  return (
    <div role="img" aria-label={label} title={label}>
      <div ref={ref} style={{ height }} className="w-full">
        {body ??
          (width > 0 && (
            <svg width={width} height={height} aria-hidden>
              <line x1="0" x2={width} y1={height / 2} y2={height / 2} stroke="#2C4A73" strokeDasharray="2 3" />
            </svg>
          ))}
      </div>
      {first && (
        <div className="num mt-0.5 flex justify-between text-[10px] text-ink-faint" aria-hidden>
          <span>{edgeLabel(first.t, first.mission_day, resolution)}</span>
          <span>now</span>
        </div>
      )}
    </div>
  );
}
