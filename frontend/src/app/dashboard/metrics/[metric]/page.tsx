"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import type {
  AstronautProfile,
  HistoryPoint,
  HistoryRange,
  MetricDefinition,
  MetricHistory,
  MetricSeries,
  SeriesStats,
} from "@/types/blue";
import { api } from "@/lib/api";
import {
  CATEGORY_LABELS,
  dashboardHref,
  defaultRange,
  formatNumber,
  metricHref,
  metricSource,
  metricValue,
  missionTime,
  normalRange,
} from "@/lib/metrics";
import { useRequireUser, useTargetAstronaut } from "@/lib/session";
import AppShell from "@/components/AppShell";
import MetricChart, { SERIES_COLORS, pointLabel } from "@/components/MetricChart";
import StatusBadge, { StatusGlyph } from "@/components/StatusBadge";
import SourceTag from "@/components/SourceTag";
import { ErrorScreen, FullScreenLoader } from "@/components/ScreenStates";

type RangeKey = HistoryRange | "custom";

const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "24h", label: "24 h", days: 1 },
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "all", label: "Whole mission", days: null },
  { key: "custom", label: "Custom", days: null },
];

const CADENCE_LABEL: Record<MetricDefinition["cadence"], string> = {
  continuous: "Continuous · 15-min samples",
  daily: "Once a day",
  weekly: "Once a week",
};

export default function MetricDetailPage() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <MetricDetail />
    </Suspense>
  );
}

/** Client-side stats for a custom slice of the daily mission history. */
function sliceStats(points: HistoryPoint[], s: MetricSeries): SeriesStats {
  const v = points.map((p) => p.values[s.field]).filter((x): x is number => x != null);
  const t = s.thresholds;
  const inBand = v.filter(
    (x) => (t?.advisory_low == null || x >= t.advisory_low) && (t?.advisory_high == null || x <= t.advisory_high),
  );
  return {
    field: s.field,
    min: v.length ? Math.min(...v) : null,
    max: v.length ? Math.max(...v) : null,
    avg: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null,
    last: v.length ? v[v.length - 1] : null,
    pct_nominal: v.length && t ? (inBand.length / v.length) * 100 : null,
  };
}

function sliceHistory(all: MetricHistory, from: number, to: number): MetricHistory {
  const points = all.points.filter((p) => p.mission_day >= from && p.mission_day <= to);
  return {
    ...all,
    points,
    stats: all.metric.series.map((s) => sliceStats(points, s)),
    events: all.events.filter((e) => e.mission_day >= from && e.mission_day <= to),
  };
}

/** Average of each series over the same number of days just before the current window. */
function previousAverages(all: MetricHistory | null, windowEnd: number, days: number | null) {
  if (!all || !days) return null;
  const start = windowEnd - days + 1;
  const prev = all.points.filter((p) => p.mission_day >= start - days && p.mission_day <= start - 1);
  if (!prev.length) return null;
  return { days, from: start - days, to: start - 1, stats: all.metric.series.map((s) => sliceStats(prev, s)) };
}

function MetricDetail() {
  const { metric: metricKey } = useParams<{ metric: string }>();
  const { user, error: sessionError, retry, logout } = useRequireUser();
  const astronautId = useTargetAstronaut(user);
  const asSurgeon = user?.role === "flight_surgeon";

  const [profile, setProfile] = useState<AstronautProfile | null>(null);
  const [catalog, setCatalog] = useState<MetricDefinition[] | null>(null);
  const [range, setRange] = useState<RangeKey | null>(null);
  const [custom, setCustom] = useState<{ from: number; to: number } | null>(null);
  const [history, setHistory] = useState<MetricHistory | null>(null);
  const [mission, setMission] = useState<MetricHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!astronautId) return;
    Promise.all([api.getAstronaut(astronautId), api.metrics()])
      .then(([p, c]) => {
        setProfile(p);
        setCatalog(c);
        setCustom({ from: Math.max(1, p.mission_day - 13), to: p.mission_day });
      })
      .catch(() => setError("Cannot load this astronaut from the BLUE server."));
  }, [astronautId]);

  const metric = catalog?.find((m) => m.key === metricKey) ?? null;

  // Reset to the metric's natural range when switching metrics; fetch the whole mission
  // once for the personal baseline, the previous-period comparison and custom ranges.
  useEffect(() => {
    if (!metric || !astronautId) return;
    setRange(defaultRange(metric));
    setMission(null);
    let cancelled = false;
    api
      .metricHistory(astronautId, metric.key, "all")
      .then((h) => !cancelled && setMission(h))
      .catch(() => !cancelled && setMission(null));
    return () => {
      cancelled = true;
    };
  }, [metric, astronautId]);

  useEffect(() => {
    if (!astronautId || !metric || !range || range === "custom") return;
    let cancelled = false;
    setLoadingHistory(true);
    api
      .metricHistory(astronautId, metric.key, range)
      .then((h) => !cancelled && setHistory(h))
      .catch(() => !cancelled && setError("Cannot load this metric's history."))
      .finally(() => !cancelled && setLoadingHistory(false));
    return () => {
      cancelled = true;
    };
  }, [astronautId, metric, range]);

  const grouped = useMemo(() => {
    const out = new Map<MetricDefinition["category"], MetricDefinition[]>();
    for (const m of catalog ?? []) out.set(m.category, [...(out.get(m.category) ?? []), m]);
    return out;
  }, [catalog]);

  const failure = sessionError ?? error;
  if (failure) return <ErrorScreen message={failure} onRetry={sessionError ? retry : () => location.reload()} />;
  if (!user || !profile || !catalog) return <FullScreenLoader />;

  if (!metric) {
    return (
      <AppShell user={user} profile={profile} active="metrics" onLogout={logout}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <Lock className="h-6 w-6 text-ink-faint" aria-hidden />
          <p className="text-sm text-ink-soft">This metric doesn&apos;t exist or isn&apos;t available to your account.</p>
          <Link href={dashboardHref(profile.id, asSurgeon)} className="text-sm font-semibold text-sky">
            Back to overview
          </Link>
        </div>
      </AppShell>
    );
  }

  const status = profile.metric_status[metric.key] ?? "NOMINAL";
  const source = metricSource(metric.key);
  const customValid = custom && custom.from >= 1 && custom.to <= profile.mission_day && custom.from <= custom.to;
  const current: MetricHistory | null =
    range === "custom"
      ? mission && customValid
        ? sliceHistory(mission, custom.from, custom.to)
        : null
      : history?.metric.key === metric.key && history.range === range
        ? history
        : null;
  const windowDays =
    range === "custom" && customValid ? custom.to - custom.from + 1 : (RANGES.find((r) => r.key === range)?.days ?? null);
  const windowEnd = range === "custom" && customValid ? custom.to : profile.mission_day;
  const previous = previousAverages(mission, windowEnd, windowDays);
  const baseline = mission?.stats[0]?.avg ?? null;

  return (
    <AppShell user={user} profile={profile} active="metrics" onLogout={logout}>
      <div className="grid flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-[232px_minmax(0,1fr)] md:px-5">
        {/* Metric picker */}
        <nav
          aria-label="Metrics"
          className="card thin-scroll h-fit max-h-[calc(100vh-6rem)] overflow-y-auto p-2 md:sticky md:top-4"
        >
          <Link
            href={dashboardHref(profile.id, asSurgeon)}
            className="mb-1 flex items-center gap-1.5 rounded-[4px] px-2 py-1.5 text-xs font-medium text-ink-soft hover:bg-raised hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Overview · {profile.name}
          </Link>
          {[...grouped].map(([cat, list]) => (
            <div key={cat} className="mt-2">
              <p className="eyebrow px-2 pb-1 pt-1">{CATEGORY_LABELS[cat]}</p>
              {list.map((m) => {
                const s = profile.metric_status[m.key] ?? "NOMINAL";
                const active = m.key === metric.key;
                return (
                  <Link
                    key={m.key}
                    href={metricHref(m.key, profile.id, asSurgeon)}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex items-center gap-2 rounded-[4px] px-2 py-1.5 text-[13px] transition ${
                      active ? "bg-tint font-medium text-ink" : "text-ink-soft hover:bg-raised hover:text-ink"
                    }`}
                  >
                    {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-r bg-sky" aria-hidden />}
                    <StatusGlyph status={s} />
                    <span className="truncate">{m.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
          {asSurgeon && (
            <p className="flex items-start gap-1.5 px-2 pb-2 pt-3 text-[11px] leading-snug text-ink-faint">
              <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> Voice and behaviour signals are private to the
              astronaut.
            </p>
          )}
        </nav>

        <main className="flex min-w-0 flex-col gap-4">
          {/* Headline */}
          <section className="card p-5">
            <div className="flex flex-wrap items-start gap-6">
              <div className="min-w-0 flex-1">
                <p className="eyebrow">{CATEGORY_LABELS[metric.category]}</p>
                <h1 className="mt-1 text-xl font-semibold text-ink">{metric.label}</h1>
                <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-ink-soft">{metric.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <SourceTag kind={source.kind} origin={source.origin} />
                  <span className="text-[11px] text-ink-faint">{CADENCE_LABEL[metric.cadence]}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="num text-4xl font-medium leading-none text-ink">
                  {metricValue(metric, profile.current_vitals)}
                  <span className="ml-1.5 font-sans text-sm text-ink-faint">{metric.unit}</span>
                </p>
                <div className="mt-2.5 flex items-center justify-end gap-3">
                  <span className="num text-[11px] text-ink-faint">
                    Latest · {missionTime(profile.last_reading_at, profile.mission_day)}
                  </span>
                  <StatusBadge status={status} />
                </div>
              </div>
            </div>
          </section>

          {/* Chart */}
          <section className="card p-5">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div role="tablist" aria-label="Time range" className="flex flex-wrap rounded-[4px] border border-line p-0.5">
                {RANGES.map((r) => (
                  <button
                    key={r.key}
                    role="tab"
                    aria-selected={range === r.key}
                    onClick={() => setRange(r.key)}
                    className={`rounded-[3px] px-3 py-1.5 text-xs font-medium transition ${
                      range === r.key ? "bg-nasa text-white ring-1 ring-sky/40" : "text-ink-soft hover:bg-raised hover:text-ink"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {range === "custom" && custom && (
                <div className="flex items-center gap-2 text-xs text-ink-soft">
                  <label className="flex items-center gap-1.5">
                    Day
                    <input
                      type="number"
                      min={1}
                      max={profile.mission_day}
                      value={custom.from}
                      onChange={(e) => setCustom({ ...custom, from: Number(e.target.value) })}
                      className="num w-16 rounded-[3px] border border-line bg-raised px-2 py-1 text-ink"
                      aria-label="First mission day"
                    />
                  </label>
                  <span aria-hidden>→</span>
                  <input
                    type="number"
                    min={1}
                    max={profile.mission_day}
                    value={custom.to}
                    onChange={(e) => setCustom({ ...custom, to: Number(e.target.value) })}
                    className="num w-16 rounded-[3px] border border-line bg-raised px-2 py-1 text-ink"
                    aria-label="Last mission day"
                  />
                  {!customValid && <span className="text-advisory">Days 1–{profile.mission_day}, first ≤ last</span>}
                </div>
              )}
              {(loadingHistory || (range === "custom" && !mission)) && (
                <Loader2 className="h-4 w-4 animate-spin text-sky" aria-label="Loading" />
              )}
              <Legend metric={metric} banded={current?.resolution !== "15min"} baseline={baseline != null} />
            </div>

            {current ? (
              current.points.length ? (
                <MetricChart history={current} baseline={baseline} />
              ) : (
                <p className="py-20 text-center text-sm text-ink-soft">No samples in this range.</p>
              )
            ) : (
              <div className="flex h-[340px] items-center justify-center text-sky">
                {range === "custom" && !customValid ? (
                  <span className="text-sm text-ink-soft">Choose a valid day range.</span>
                ) : (
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                )}
              </div>
            )}
            {current && (
              <p className="mt-2 text-[11px] text-ink-faint">
                {current.resolution === "15min"
                  ? "Every 15-minute sample."
                  : `${current.resolution === "hourly" ? "Hourly" : "Daily"} average; the shaded band shows that period's lowest to highest reading.`}{" "}
                Gaps are missing samples. Numbered lines mark mission events.
              </p>
            )}
          </section>

          {current && (
            <div className="grid gap-4 lg:grid-cols-2">
              <StatsCard history={current} previous={previous} />
              <EventsCard history={current} />
            </div>
          )}

          {current && current.points.length > 0 && <DataTable history={current} />}
        </main>
      </div>
    </AppShell>
  );
}

function Legend({ metric, banded, baseline }: { metric: MetricDefinition; banded: boolean; baseline: boolean }) {
  const t = metric.series[0].thresholds;
  return (
    <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-soft">
      {metric.series.map((s, i) => (
        <span key={s.field} className="inline-flex items-center gap-1.5">
          <svg width="18" height="6" aria-hidden>
            <line
              x1="0"
              y1="3"
              x2="18"
              y2="3"
              stroke={SERIES_COLORS[i]}
              strokeWidth="2"
              strokeDasharray={i === 1 ? "6 4" : undefined}
            />
          </svg>
          {s.label}
        </span>
      ))}
      {banded && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-[2px]" style={{ backgroundColor: SERIES_COLORS[0], opacity: 0.3 }} />
          Low–high
        </span>
      )}
      {t && (t.advisory_low != null || t.advisory_high != null) && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-[2px] bg-nominal/20 ring-1 ring-nominal/40" />
          Normal range
        </span>
      )}
      {baseline && (
        <span className="inline-flex items-center gap-1.5">
          <svg width="18" height="6" aria-hidden>
            <line x1="0" y1="3" x2="18" y2="3" stroke="#9AB0CB" strokeWidth="1" strokeDasharray="2 3" />
          </svg>
          Your mission average
        </span>
      )}
    </div>
  );
}

function StatsCard({
  history,
  previous,
}: {
  history: MetricHistory;
  previous: ReturnType<typeof previousAverages>;
}) {
  const { metric } = history;
  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-ink">Summary for this range</h2>
      <div className="mt-3 space-y-4">
        {history.stats.map((s, i) => {
          const series = metric.series.find((x) => x.field === s.field);
          const normal = normalRange(series?.thresholds ?? null);
          const prev = previous?.stats.find((p) => p.field === s.field)?.avg ?? null;
          const delta = prev != null && s.avg != null ? s.avg - prev : null;
          return (
            <div key={s.field}>
              {metric.series.length > 1 && (
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink">
                  <span className="h-0.5 w-3" style={{ backgroundColor: SERIES_COLORS[i] }} />
                  {series?.label}
                </p>
              )}
              <dl className="grid grid-cols-4 gap-px overflow-hidden rounded-[4px] border border-line bg-line">
                {(
                  [
                    ["Average", formatNumber(s.avg, metric.decimals)],
                    ["Lowest", formatNumber(s.min, metric.decimals)],
                    ["Highest", formatNumber(s.max, metric.decimals)],
                    ["In range", s.pct_nominal == null ? "—" : `${formatNumber(s.pct_nominal, 0)}%`],
                  ] as const
                ).map(([label, v]) => (
                  <div key={label} className="bg-card px-3 py-2.5">
                    <dt className="eyebrow">{label}</dt>
                    <dd className="num mt-1 text-lg text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[11px] text-ink-faint">
                {normal && (
                  <span>
                    Normal range: <span className="num text-ink-soft">{normal}</span> {metric.unit}
                  </span>
                )}
                {previous && (
                  <span>
                    Previous {previous.days === 1 ? "day" : `${previous.days} days`} (D{previous.from}–D{previous.to}) avg{" "}
                    <span className="num text-ink-soft">{formatNumber(prev, metric.decimals)}</span>
                    {delta != null && (
                      <span className="num text-ink-soft">
                        {" "}
                        · {delta >= 0 ? "+" : "−"}
                        {formatNumber(Math.abs(delta), metric.decimals || 1)}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EventsCard({ history }: { history: MetricHistory }) {
  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-ink">Events in this range</h2>
      {history.events.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">Nothing notable logged for this metric.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {history.events.map((e, i) => (
            <li key={e.id} className="flex gap-3">
              <span className="num flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border border-line-strong text-[10px] font-medium text-ink">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium leading-snug text-ink">
                  <StatusGlyph status={e.severity} />
                  {e.label}
                </p>
                <p className="num mt-0.5 text-[11px] text-ink-faint">
                  {missionTime(e.start, e.mission_day)}
                  {e.scope === "cabin" ? " · whole cabin" : ""}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{e.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function DataTable({ history }: { history: MetricHistory }) {
  const { metric, points, resolution } = history;
  return (
    <details className="card p-5">
      <summary className="cursor-pointer text-sm font-semibold text-sky">Show the data as a table</summary>
      <div className="thin-scroll mt-3 max-h-80 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-card text-ink-faint">
            <tr>
              <th className="py-1.5 pr-4 font-medium">Time</th>
              {resolution === "15min" && <th className="py-1.5 pr-4 font-medium">Activity</th>}
              {metric.series.map((s) => (
                <th key={s.field} className="py-1.5 pr-4 font-medium">
                  {s.label} ({metric.unit})
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="num divide-y divide-line text-ink">
            {[...points].reverse().map((p) => (
              <tr key={p.t}>
                <td className="py-1 pr-4">{pointLabel(p.t, p.mission_day, resolution)}</td>
                {resolution === "15min" && <td className="py-1 pr-4 font-sans text-ink-soft">{p.activity}</td>}
                {metric.series.map((s) => (
                  <td key={s.field} className="py-1 pr-4">
                    {formatNumber(p.values[s.field], metric.decimals)}
                    {p.low && p.high && p.low[s.field] != null && (
                      <span className="text-ink-faint">
                        {" "}
                        ({formatNumber(p.low[s.field], metric.decimals)}–{formatNumber(p.high[s.field], metric.decimals)})
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
