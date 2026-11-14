"use client";

import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import type { AstronautProfile, MetricDefinition } from "@/types/blue";
import { METRIC_ICONS, PRIMARY_METRICS, STATUS_STYLES, metricHref, metricValue, missionTime, type PanelMode } from "@/lib/metrics";

interface Props {
  profile: AstronautProfile;
  panel: PanelMode;
  catalog: MetricDefinition[];
  asSurgeon: boolean;
}

/** Left column: only the key readings for the active panel. Details live one click away. */
export default function VitalsPanel({ profile, panel, catalog, asSurgeon }: Props) {
  const byKey = new Map(catalog.map((m) => [m.key, m]));
  const keys = PRIMARY_METRICS[panel];
  const shown = keys.map((k) => byKey.get(k)).filter((m): m is MetricDefinition => !!m);
  const hidden = keys.length - shown.length;
  const others = catalog.length - shown.length;

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-sm font-semibold text-ink">{panel === "physical" ? "Key vitals" : "Stress & recovery"}</h2>
        <span className="text-[11px] text-ink-soft">
          {missionTime(profile.last_reading_at, profile.mission_day)} · {profile.last_activity}
        </span>
      </div>

      <div className="card divide-y divide-line overflow-hidden">
        {shown.map((m) => {
          const status = profile.metric_status[m.key] ?? "NOMINAL";
          const style = STATUS_STYLES[status];
          const Icon = METRIC_ICONS[m.key];
          return (
            <Link
              key={m.key}
              href={metricHref(m.key, profile.id, asSurgeon)}
              className="group flex items-center gap-3 px-4 py-3.5 transition hover:bg-canvas focus:outline-none focus-visible:bg-tint"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-tint text-sky">
                {Icon && <Icon className="h-4.5 w-4.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-ink-soft">{m.label}</span>
                <span className="text-xl font-bold leading-tight text-ink">
                  {metricValue(m, profile.current_vitals)}
                  <span className="ml-1 text-xs font-medium text-ink-soft">{m.unit}</span>
                </span>
              </span>
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${style.text}`}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: style.hex }} />
                {style.label}
              </span>
              <ChevronRight className="h-4 w-4 text-tint-strong transition group-hover:translate-x-0.5 group-hover:text-sky" />
            </Link>
          );
        })}
      </div>

      {hidden > 0 && (
        <p className="flex items-center gap-1.5 px-1 text-[11px] text-ink-soft">
          <Lock className="h-3 w-3" /> Voice and behaviour signals are private to the astronaut.
        </p>
      )}

      {shown[0] && (
        <Link
          href={metricHref(shown[0].key, profile.id, asSurgeon)}
          className="inline-flex items-center gap-1 self-start px-1 text-xs font-semibold text-sky hover:text-sky-hover"
        >
          Detailed charts & {others} more metrics <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </section>
  );
}
