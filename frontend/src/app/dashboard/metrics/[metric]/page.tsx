"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Lock, LogOut } from "lucide-react";
import type { AstronautProfile, HistoryRange, MetricDefinition, MetricHistory } from "@/types/blue";
import { api } from "@/lib/api";
import {
  CATEGORY_LABELS,
  METRIC_ICONS,
  STATUS_STYLES,
  dashboardHref,
  defaultRange,
  formatNumber,
  metricHref,
  metricValue,
  missionTime,
  normalRange,
} from "@/lib/metrics";
import { useRequireUser, useTargetAstronaut } from "@/lib/session";
import MetricChart, { SERIES_COLORS, pointLabel } from "@/components/MetricChart";
import StatusBadge from "@/components/StatusBadge";
import { ErrorScreen, FullScreenLoader } from "@/components/ScreenStates";

const RANGES: { key: HistoryRange; label: string }[] = [
  { key: "24h", label: "24 hours" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "Whole mission" },
];

export default function MetricDetailPage() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <MetricDetail />
    </Suspense>
  );
}

function MetricDetail() {
  const { metric: metricKey } = useParams<{ metric: string }>();
  const { user, error: sessionError, retry, logout } = useRequireUser();
  const astronautId = useTargetAstronaut(user);
  const asSurgeon = user?.role === "flight_surgeon";

  const [profile, setProfile] = useState<AstronautProfile | null>(null);
  const [catalog, setCatalog] = useState<MetricDefinition[] | null>(null);
  const [range, setRange] = useState<HistoryRange | null>(null);
  const [history, setHistory] = useState<MetricHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!astronautId) return;
    Promise.all([api.getAstronaut(astronautId), api.metrics()])
      .then(([p, c]) => {
        setProfile(p);
        setCatalog(c);
      })
      .catch(() => setError("Cannot load this astronaut from the BLUE server."));
  }, [astronautId]);

  const metric = catalog?.find((m) => m.key === metricKey) ?? null;

  // Reset to the metric's natural range when switching metrics.
  useEffect(() => {
    if (metric) setRange(defaultRange(metric));
  }, [metric]);

  useEffect(() => {
    if (!astronautId || !metric || !range) return;
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <Lock className="h-6 w-6 text-sky" />
        <p className="text-sm text-ink-soft">This metric doesn&apos;t exist or isn&apos;t available to your account.</p>
        <Link href={dashboardHref(profile.id, asSurgeon)} className="text-sm font-semibold text-sky">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const status = profile.metric_status[metric.key] ?? "NOMINAL";
  const Icon = METRIC_ICONS[metric.key];
  const current = history?.metric.key === metric.key && history.range === range ? history : null;

  return (
    <div className="flex min-h-screen flex-col gap-4 p-4">
      <header className="card flex items-center gap-4 px-5 py-3">
        <Link
          href={dashboardHref(profile.id, asSurgeon)}
          className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-tint-strong hover:bg-tint hover:text-sky"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-tint text-sm font-bold text-sky">
          {profile.avatar_initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{profile.name}</p>
          <p className="text-xs text-ink-soft">
            {profile.role} · Mission Day {profile.mission_day}
          </p>
        </div>
        <button
          onClick={logout}
          className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-tint-strong hover:bg-tint hover:text-sky"
        >
          <LogOut className="h-3.5 w-3.5" /> Log out
        </button>
      </header>

      <div className="grid flex-1 grid-cols-[240px_1fr] gap-4">
        {/* Metric picker */}
        <nav aria-label="Metrics" className="card thin-scroll h-fit max-h-[calc(100vh-7rem)] overflow-y-auto p-2">
          {[...grouped].map(([cat, list]) => (
            <div key={cat} className="mb-2">
              <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
                {CATEGORY_LABELS[cat]}
              </p>
              {list.map((m) => {
                const s = profile.metric_status[m.key] ?? "NOMINAL";
                const active = m.key === metric.key;
                return (
                  <Link
                    key={m.key}
                    href={metricHref(m.key, profile.id, asSurgeon)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition ${
                      active ? "bg-sky font-semibold text-white" : "text-ink hover:bg-tint"
                    }`}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full ring-2 ring-white"
                      style={{ backgroundColor: STATUS_STYLES[s].hex }}
                      title={STATUS_STYLES[s].label}
                    />
                    <span className="truncate">{m.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
          {asSurgeon && (
            <p className="flex items-start gap-1.5 px-2 pb-2 text-[11px] leading-snug text-ink-soft">
              <Lock className="mt-0.5 h-3 w-3 shrink-0" /> Voice and behaviour signals are private to the astronaut.
            </p>
          )}
        </nav>

        <main className="flex min-w-0 flex-col gap-4">
          {/* Headline */}
          <section className="card p-5">
            <div className="flex flex-wrap items-start gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-tint text-sky">
                {Icon && <Icon className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-bold text-ink">{metric.label}</h1>
                <p className="mt-0.5 max-w-2xl text-sm text-ink-soft">{metric.description}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold leading-none text-ink">
                  {metricValue(metric, profile.current_vitals)}
                  <span className="ml-1 text-sm font-medium text-ink-soft">{metric.unit}</span>
                </p>
                <div className="mt-1.5 flex items-center justify-end gap-2 text-[11px] text-ink-soft">
                  Latest · {missionTime(profile.last_reading_at, profile.mission_day)}
                  <StatusBadge status={status} />
                </div>
              </div>
            </div>
          </section>

          {/* Chart */}
          <section className="card p-5">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div role="tablist" aria-label="Time range" className="flex rounded-full bg-tint p-1">
                {RANGES.map((r) => (
                  <button
                    key={r.key}
                    role="tab"
                    aria-selected={range === r.key}
                    onClick={() => setRange(r.key)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                      range === r.key ? "bg-sky text-white shadow" : "text-sky hover:bg-tint-strong/60"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {loadingHistory && <Loader2 className="h-4 w-4 animate-spin text-sky" />}
              <Legend metric={metric} banded={current?.resolution !== "15min"} />
            </div>

            {current ? (
              current.points.length ? (
                <MetricChart history={current} />
              ) : (
                <p className="py-20 text-center text-sm text-ink-soft">No samples in this range.</p>
              )
            ) : (
              <div className="flex h-[340px] items-center justify-center text-sky">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            {current && (
              <p className="mt-2 text-[11px] text-ink-soft">
                {current.resolution === "15min"
                  ? "Every 15-minute sample."
                  : `${current.resolution === "hourly" ? "Hourly" : "Daily"} average; the shaded band shows that period's lowest to highest reading.`}{" "}
                Numbered lines mark mission events.
              </p>
            )}
          </section>

          {current && (
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <StatsCard history={current} />
              <EventsCard history={current} />
            </div>
          )}

          {current && current.points.length > 0 && <DataTable history={current} />}
        </main>
      </div>
    </div>
  );
}

function Legend({ metric, banded }: { metric: MetricDefinition; banded: boolean }) {
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
          <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: SERIES_COLORS[0], opacity: 0.18 }} />
          Low–high
        </span>
      )}
      {t && (t.advisory_low != null || t.advisory_high != null) && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-teal-100 ring-1 ring-teal-200" />
          Normal range
        </span>
      )}
    </div>
  );
}

function StatsCard({ history }: { history: MetricHistory }) {
  const { metric } = history;
  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-ink">Summary for this range</h2>
      <div className="mt-3 space-y-4">
        {history.stats.map((s, i) => {
          const series = metric.series.find((x) => x.field === s.field);
          const normal = normalRange(series?.thresholds ?? null);
          return (
            <div key={s.field}>
              {metric.series.length > 1 && (
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <span className="h-0.5 w-3" style={{ backgroundColor: SERIES_COLORS[i] }} />
                  {series?.label}
                </p>
              )}
              <dl className="grid grid-cols-4 gap-2 text-center">
                {(
                  [
                    ["Average", s.avg],
                    ["Lowest", s.min],
                    ["Highest", s.max],
                  ] as const
                ).map(([label, v]) => (
                  <div key={label} className="rounded-xl bg-canvas px-2 py-2.5">
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-ink-soft">{label}</dt>
                    <dd className="mt-0.5 text-base font-bold text-ink">{formatNumber(v, metric.decimals)}</dd>
                  </div>
                ))}
                <div className="rounded-xl bg-canvas px-2 py-2.5">
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-ink-soft">In range</dt>
                  <dd className="mt-0.5 text-base font-bold text-ink">
                    {s.pct_nominal == null ? "—" : `${formatNumber(s.pct_nominal, 0)}%`}
                  </dd>
                </div>
              </dl>
              {normal && (
                <p className="mt-1.5 text-[11px] text-ink-soft">
                  Normal range: {normal} {metric.unit}
                </p>
              )}
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
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: STATUS_STYLES[e.severity].hex }}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug text-ink">
                  {e.label}{" "}
                  <span className="font-normal text-ink-soft">
                    · Day {e.mission_day}
                    {e.scope === "cabin" ? " · whole cabin" : ""}
                  </span>
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{e.detail}</p>
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
          <thead className="sticky top-0 bg-white text-ink-soft">
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
          <tbody className="divide-y divide-line text-ink">
            {[...points].reverse().map((p) => (
              <tr key={p.t}>
                <td className="py-1 pr-4">{pointLabel(p.t, p.mission_day, resolution)}</td>
                {resolution === "15min" && <td className="py-1 pr-4 text-ink-soft">{p.activity}</td>}
                {metric.series.map((s) => (
                  <td key={s.field} className="py-1 pr-4">
                    {formatNumber(p.values[s.field], metric.decimals)}
                    {p.low && p.high && p.low[s.field] != null && (
                      <span className="text-ink-soft">
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
