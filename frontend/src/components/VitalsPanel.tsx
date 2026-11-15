"use client";

import { useEffect, useReducer, useRef } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight, Lock } from "lucide-react";
import type { AstronautProfile, HistoryRange, MetricDefinition, MetricHistory } from "@/types/blue";
import { api } from "@/lib/api";
import {
  PRIMARY_METRICS,
  STATUS_STYLES,
  alertMetrics,
  metricHref,
  metricValue,
  outOfRange,
  type PanelMode,
} from "@/lib/metrics";
import StatusBadge from "./StatusBadge";
import Sparkline from "./Sparkline";

export type TrendRange = Extract<HistoryRange, "24h" | "7d" | "30d">;

export const TREND_RANGES: { key: TrendRange; label: string; long: string }[] = [
  { key: "24h", label: "24 h", long: "last 24 hours" },
  { key: "7d", label: "7 d", long: "last 7 days" },
  { key: "30d", label: "30 d", long: "last 30 days" },
];

interface Props {
  profile: AstronautProfile;
  panel: PanelMode;
  catalog: MetricDefinition[];
  asSurgeon: boolean;
  range: TrendRange;
}

/** Daily samples need at least a week to draw a line. */
function effectiveRange(metric: MetricDefinition, range: TrendRange): TrendRange {
  return metric.cadence !== "continuous" && range === "24h" ? "7d" : range;
}

/**
 * Left column: the panel's key readings, out-of-range ones first. Each row is the latest
 * value plus a bare trend line; ranges, statistics and events are one click away.
 */
export default function VitalsPanel({ profile, panel, catalog, asSurgeon, range }: Props) {
  const byKey = new Map(catalog.map((m) => [m.key, m]));
  const alerts = alertMetrics(catalog, profile.metric_status);
  const alertKeys = new Set(alerts.map((m) => m.key));
  const keys = PRIMARY_METRICS[panel];
  const available = keys.map((k) => byKey.get(k)).filter((m): m is MetricDefinition => !!m);
  const rows = [...alerts, ...available.filter((m) => !alertKeys.has(m.key))];
  const hidden = keys.length - available.length;

  // Trend histories, cached per astronaut / metric / range.
  const cache = useRef(new Map<string, MetricHistory | null>());
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const cacheKey = (m: MetricDefinition) => `${profile.id}:${m.key}:${effectiveRange(m, range)}`;
  const wanted = rows.map((m) => [m, cacheKey(m)] as const);
  const wantedSignature = wanted.map(([, k]) => k).join("|");

  useEffect(() => {
    let cancelled = false;
    const todo = wanted.filter(([, k]) => !cache.current.has(k));
    if (!todo.length) return;
    Promise.allSettled(todo.map(([m]) => api.metricHistory(profile.id, m.key, effectiveRange(m, range)))).then(
      (results) => {
        results.forEach((r, i) => cache.current.set(todo[i][1], r.status === "fulfilled" ? r.value : null));
        if (!cancelled) refresh();
      },
    );
    return () => {
      cancelled = true;
    };
  }, [wantedSignature]);

  const rangeLong = TREND_RANGES.find((r) => r.key === range)?.long ?? "";

  return (
    <section aria-labelledby="readings-title" className="card flex min-h-0 flex-col">
      <header className="flex items-baseline justify-between border-b border-line px-4 py-3">
        <h2 id="readings-title" className="text-sm font-semibold text-ink">
          {panel === "physical" ? "Key readings" : "Stress & recovery"}
        </h2>
        <span className="eyebrow">Trend · {rangeLong}</span>
      </header>

      <ul className="thin-scroll flex min-h-0 flex-1 flex-col divide-y divide-line overflow-y-auto [&>li]:min-h-[96px] [&>li]:flex-1 lg:[&>li]:max-h-[150px]">
        {rows.map((m) => {
          const status = profile.metric_status[m.key] ?? "NOMINAL";
          const alert = status !== "NOMINAL";
          const out = alert ? outOfRange(m, profile.current_vitals) : null;
          const Arrow = out?.direction === "low" ? ArrowDown : ArrowUp;
          const history = cache.current.get(cacheKey(m));
          const widened = effectiveRange(m, range) !== range;
          return (
            <li key={m.key} className="flex">
              <Link
                href={metricHref(m.key, profile.id, asSurgeon)}
                className={`group flex w-full flex-col justify-center gap-2 border-l-2 py-3 pl-3.5 pr-4 transition hover:bg-raised ${
                  alert ? STATUS_STYLES[status].border : "border-transparent"
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-ink-soft">{m.label}</span>
                    {alert && <StatusBadge status={status} quiet className="mt-0.5" />}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-1.5">
                    {out && (
                      <span className={`inline-flex items-center text-[11px] font-medium ${STATUS_STYLES[status].text}`}>
                        <Arrow className="h-3 w-3" aria-hidden />
                        {out.direction === "high" ? "high" : "low"}
                      </span>
                    )}
                    <span className="num text-[22px] font-medium leading-none text-ink">
                      {metricValue(m, profile.current_vitals)}
                    </span>
                    <span className="min-w-12 whitespace-nowrap text-[11px] text-ink-faint">{m.unit}</span>
                    <ChevronRight
                      className="h-4 w-4 self-center text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-sky"
                      aria-hidden
                    />
                  </span>
                </span>
                <span className="block pr-6">
                  {history ? (
                    <Sparkline history={history} />
                  ) : history === null ? (
                    <span className="block py-3 text-[11px] text-ink-faint">Trend unavailable</span>
                  ) : (
                    <span className="block h-[54px] animate-pulse rounded-[3px] bg-raised" aria-hidden />
                  )}
                  {widened && history && <span className="sr-only">Daily samples, last 7 days</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <footer className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5">
        {hidden > 0 ? (
          <p className="flex items-center gap-1.5 text-[11px] text-ink-faint">
            <Lock className="h-3 w-3" aria-hidden /> Voice signals are private
          </p>
        ) : (
          <span />
        )}
        <Link
          href={metricHref(rows[0]?.key ?? "heart_rate", profile.id, asSurgeon)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-sky hover:text-sky-hover"
        >
          All metrics & charts <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </footer>
    </section>
  );
}
