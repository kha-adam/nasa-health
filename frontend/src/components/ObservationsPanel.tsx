"use client";

import Link from "next/link";
import { CheckCircle2, ChevronRight, X } from "lucide-react";
import type { AstronautProfile, BodyHighlight, BodyZone, MetricDefinition } from "@/types/blue";
import {
  STATUS_RANK,
  metricHref,
  metricValue,
} from "@/lib/metrics";
import StatusBadge from "./StatusBadge";
import { ZONES, groupByZone } from "./HumanBodyModel";

interface Props {
  profile: AstronautProfile;
  catalog: MetricDefinition[];
  asSurgeon: boolean;
  selected: BodyZone | null;
  onSelect: (zone: BodyZone | null) => void;
}

function observationLabel(h: BodyHighlight, catalog: MetricDefinition[]): string {
  return catalog.find((m) => m.key === h.metric)?.label ?? `${ZONES[h.zone].name} observation`;
}

const ZONE_METRICS: Record<BodyZone, string[]> = {
  heart: ["heart_rate", "blood_pressure"],
  lungs: ["spo2", "respiration"],
  metabolic: ["glucose", "body_mass"],
  brain: [],
};

/** A brief finding with its status; the linked metric page holds the details. */
export function Observation({
  profile,
  h,
  catalog,
  asSurgeon,
}: {
  profile: AstronautProfile;
  h: BodyHighlight;
  catalog: MetricDefinition[];
  asSurgeon: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm font-medium text-ink">{observationLabel(h, catalog)}</span>
      <StatusBadge status={h.severity} quiet />
      {h.metric && (
        <Link href={metricHref(h.metric, profile.id, asSurgeon)} className="inline-flex w-full items-center gap-0.5 text-xs font-semibold text-sky hover:text-sky-hover">
          View detailed measurement <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}

/**
 * Right column, top: the selected body zone's observations, or — with nothing selected —
 * the short list of points to review across both panels.
 */
export default function ObservationsPanel({ profile, catalog, asSurgeon, selected, onSelect }: Props) {
  if (selected) {
    const list = groupByZone(profile.body_highlights.physical).get(selected) ?? [];
    const readings = ZONE_METRICS[selected].flatMap(key => catalog.filter(metric => metric.key === key));
    return (
      <section aria-labelledby="obs-title" className="card flex min-h-0 flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 pb-3 pt-4">
          <div>
            <p className="eyebrow">Selected zone</p>
            <h2 id="obs-title" className="mt-0.5 text-[17px] font-medium text-ink">
              {ZONES[selected].name} <span className="font-normal text-ink-faint">· {ZONES[selected].system}</span>
            </h2>
          </div>
          <button
            onClick={() => onSelect(null)}
            aria-label="Clear selection"
            className="btn-ghost h-8 w-8 justify-center p-0 text-ink-soft"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="thin-scroll min-h-0 space-y-4 overflow-y-auto px-5 py-4">
          {readings.length > 0 && (
            <ul aria-label="Latest measurements for this zone" className="space-y-1">
              {readings.map(metric => (
                <li key={metric.key}>
                  <Link href={metricHref(metric.key, profile.id, asSurgeon)} className="flex flex-wrap items-center justify-between gap-x-2 rounded-xl bg-raised px-3 py-2 hover:bg-tint">
                    <span className="text-xs text-ink-soft">{metric.label}</span>
                    <strong className="num text-sm">{metricValue(metric, profile.current_vitals)} {metric.unit}</strong>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {list.length ? (
            list.map((h, i) => <Observation key={i} profile={profile} h={h} catalog={catalog} asSurgeon={asSurgeon} />)
          ) : (
            <p className="text-sm text-ink-soft">No observation recorded for this zone.</p>
          )}
        </div>
      </section>
    );
  }

  const items = [...profile.body_highlights.physical, ...profile.body_highlights.mental]
    .filter((h) => h.severity !== "NOMINAL" && (!asSurgeon || catalog.some((m) => m.key === h.metric)))
    .sort((a, b) => STATUS_RANK[b.severity] - STATUS_RANK[a.severity]);

  return (
    <section aria-labelledby="obs-title" className="card flex min-h-0 flex-col">
      <header className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
        <h2 id="obs-title" className="text-[17px] font-medium text-ink">
          To review
        </h2>
        <span className="pill">{items.length ? `${items.length} open` : "Clear"}</span>
      </header>
      {items.length === 0 ? (
        <p className="flex items-start gap-2 px-5 pb-5 pt-2 text-sm text-ink-soft">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-nominal" aria-hidden />
          Nothing to review. Every personal reading is inside its normal range.
        </p>
      ) : (
        <ul className="thin-scroll flex min-h-0 flex-col gap-1 overflow-y-auto px-2.5 pb-2.5">
          {items.slice(0, 4).map((h, i) => (
            <li key={i}>
              {h.metric ? (
                <Link href={metricHref(h.metric, profile.id, asSurgeon)} className="group flex w-full items-center justify-between gap-3 rounded-[16px] px-3 py-2.5 transition hover:bg-raised">
                  <span className="min-w-0 truncate text-sm font-medium text-ink">{observationLabel(h, catalog)}</span>
                  <StatusBadge status={h.severity} quiet />
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint group-hover:text-sky" aria-hidden />
                </Link>
              ) : (
                <span className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-ink">
                  {observationLabel(h, catalog)} <StatusBadge status={h.severity} quiet />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
