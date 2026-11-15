"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { AstronautProfile, MetricDefinition } from "@/types/blue";
import { PRIMARY_METRICS, STATUS_STYLES, alertMetrics, metricHref, type PanelMode } from "@/lib/metrics";
import StatusBadge from "./StatusBadge";

interface Props {
  profile: AstronautProfile;
  panel: PanelMode;
  catalog: MetricDefinition[];
  asSurgeon: boolean;
}

/** A short status overview; values and trends belong to the metric detail pages. */
export default function VitalsPanel({ profile, panel, catalog, asSurgeon }: Props) {
  const byKey = new Map(catalog.map((m) => [m.key, m]));
  const alerts = alertMetrics(catalog, profile.metric_status);
  const alertKeys = new Set(alerts.map((m) => m.key));
  const keys = PRIMARY_METRICS[panel];
  const available = keys.map((key) => byKey.get(key)).filter((m): m is MetricDefinition => !!m);
  const rows = [...alerts, ...available.filter((m) => !alertKeys.has(m.key))].slice(0, 3);

  return (
    <section aria-labelledby="readings-title" className="card flex min-h-0 flex-col">
      <header className="px-5 pb-2 pt-4">
        <h2 id="readings-title" className="text-[17px] font-medium text-ink">
          {panel === "physical" ? "Health at a glance" : "Stress & recovery"}
        </h2>
      </header>

      <ul className="flex flex-col gap-1.5 px-2.5 pb-2">
        {rows.map((m) => {
          const status = profile.metric_status[m.key] ?? "NOMINAL";
          return (
            <li key={m.key}>
              <Link
                href={metricHref(m.key, profile.id, asSurgeon)}
                className={`group flex min-h-16 items-center justify-between gap-3 rounded-[18px] px-3.5 py-3 transition ${
                  status === "NOMINAL"
                    ? "hover:bg-raised"
                    : `${STATUS_STYLES[status].bg} ring-1 ring-inset ${STATUS_STYLES[status].ring} hover:brightness-[0.98]`
                }`}
              >
                <span className="min-w-0 truncate text-[14px] font-medium text-ink">{m.label}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={status} quiet />
                  <ChevronRight className="h-4 w-4 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-sky" aria-hidden />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <footer className="flex justify-end border-t border-line px-5 py-3">
        <Link href={metricHref(rows[0]?.key ?? "heart_rate", profile.id, asSurgeon)} className="btn-soft px-3 py-1.5 text-xs">
          Detailed measurements <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </footer>
    </section>
  );
}
