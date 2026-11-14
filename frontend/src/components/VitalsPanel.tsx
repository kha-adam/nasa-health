"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight, Lock } from "lucide-react";
import type { AstronautProfile, MetricDefinition } from "@/types/blue";
import {
  METRIC_ICONS,
  PRIMARY_METRICS,
  STATUS_STYLES,
  alertMetrics,
  metricHref,
  metricValue,
  outOfRange,
  type PanelMode,
} from "@/lib/metrics";

interface Props {
  profile: AstronautProfile;
  panel: PanelMode;
  catalog: MetricDefinition[];
  asSurgeon: boolean;
}

/**
 * Left column. Readings currently above or below normal come first (whatever the panel),
 * then the remaining key readings of the active panel in a compact list.
 */
export default function VitalsPanel({ profile, panel, catalog, asSurgeon }: Props) {
  const byKey = new Map(catalog.map((m) => [m.key, m]));
  const alerts = alertMetrics(catalog, profile.metric_status);
  const alertKeys = new Set(alerts.map((m) => m.key));
  const keys = PRIMARY_METRICS[panel];
  const available = keys.map((k) => byKey.get(k)).filter((m): m is MetricDefinition => !!m);
  const normal = available.filter((m) => !alertKeys.has(m.key));
  const hidden = keys.length - available.length;

  return (
    <section className="thin-scroll flex min-h-0 flex-col gap-3 overflow-y-auto">
      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold text-ink">Needs attention</h2>
          {alerts.map((m) => {
            const status = profile.metric_status[m.key];
            const style = STATUS_STYLES[status];
            const Icon = METRIC_ICONS[m.key];
            const range = outOfRange(m, profile.current_vitals);
            const Arrow = range?.direction === "low" ? ArrowDown : ArrowUp;
            return (
              <Link
                key={m.key}
                href={metricHref(m.key, profile.id, asSurgeon)}
                className={`group flex items-center gap-3 rounded-xl px-4 py-3 ring-1 transition hover:brightness-[0.98] ${style.bg} ${style.ring}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white ${style.text}`}>
                  {Icon && <Icon className="h-4.5 w-4.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-ink-soft">{m.label}</span>
                  <span className="text-xl font-bold leading-tight text-ink">
                    {metricValue(m, profile.current_vitals)}
                    <span className="ml-1 text-xs font-medium text-ink-soft">{m.unit}</span>
                  </span>
                  {range && (
                    <span className={`flex items-center gap-1 text-[11px] font-semibold ${style.text}`}>
                      <Arrow className="h-3 w-3" />
                      {range.direction === "high" ? "Above" : "Below"} normal
                      {range.normal && <span className="font-normal text-ink-soft">· normal {range.normal}</span>}
                    </span>
                  )}
                </span>
                <ChevronRight className="h-4 w-4 text-ink-soft transition group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      )}

      {normal.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-semibold text-ink-soft">
            {panel === "physical" ? "Key vitals" : "Stress & recovery"}
          </h2>
          <div className="card divide-y divide-line overflow-hidden">
            {normal.map((m) => (
              <Link
                key={m.key}
                href={metricHref(m.key, profile.id, asSurgeon)}
                className="group flex items-center gap-3 px-4 py-2.5 transition hover:bg-canvas focus:outline-none focus-visible:bg-tint"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{m.label}</span>
                <span className="text-sm font-semibold text-ink">
                  {metricValue(m, profile.current_vitals)}
                  <span className="ml-1 text-[11px] font-medium text-ink-soft">{m.unit}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-tint-strong transition group-hover:translate-x-0.5 group-hover:text-sky" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {hidden > 0 && (
        <p className="flex items-center gap-1.5 px-1 text-[11px] text-ink-soft">
          <Lock className="h-3 w-3" /> Voice and behaviour signals are private to the astronaut.
        </p>
      )}

      {available[0] && (
        <Link
          href={metricHref(alerts[0]?.key ?? available[0].key, profile.id, asSurgeon)}
          className="inline-flex items-center gap-1 self-start px-1 text-xs font-semibold text-sky hover:text-sky-hover"
        >
          All metrics & charts <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </section>
  );
}
