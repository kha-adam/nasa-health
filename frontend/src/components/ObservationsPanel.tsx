"use client";

import Link from "next/link";
import { CheckCircle2, ChevronRight, Flag, X } from "lucide-react";
import type { AstronautProfile, BodyHighlight, BodyZone } from "@/types/blue";
import {
  STATUS_RANK,
  STATUS_STYLES,
  metricHref,
  metricSource,
  observationTime,
  relatedEvent,
  type PanelMode,
} from "@/lib/metrics";
import { StatusGlyph } from "./StatusBadge";
import SourceTag from "./SourceTag";
import { ZONES, groupByZone } from "./HumanBodyModel";

interface Props {
  profile: AstronautProfile;
  asSurgeon: boolean;
  selected: BodyZone | null;
  onSelect: (zone: BodyZone | null) => void;
  onShowPanel: (panel: PanelMode) => void;
}

/** One observation: what, when, from where, and a way to the chart. */
export function Observation({
  profile,
  h,
  asSurgeon,
  showDetail = true,
}: {
  profile: AstronautProfile;
  h: BodyHighlight;
  asSurgeon: boolean;
  showDetail?: boolean;
}) {
  const src = metricSource(h.metric);
  const event = h.severity !== "NOMINAL" ? relatedEvent(profile.events, h.metric) : null;
  return (
    <div className="flex gap-3">
      <span className="mt-1.5">
        <StatusGlyph status={h.severity} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-ink">{h.label}</p>
        {showDetail && <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">{h.detail}</p>}
        <p className="num mt-1.5 text-[11px] text-ink-faint">{observationTime(profile, h)}</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <SourceTag kind={src.kind} origin={src.origin} />
          {h.metric && (
            <Link
              href={metricHref(h.metric, profile.id, asSurgeon)}
              className="inline-flex items-center gap-0.5 text-xs font-semibold text-sky hover:text-sky-hover"
            >
              View chart <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </div>
        {showDetail && event && (
          <p className="mt-2 flex items-start gap-1.5 text-[12px] text-ink-soft">
            <Flag className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span>
              Linked event: {event.label} <span className="num text-ink-faint">· D{event.mission_day}</span>
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Right column, top: the selected body zone's observations, or — with nothing selected —
 * the short list of points to review across both panels.
 */
export default function ObservationsPanel({ profile, asSurgeon, selected, onSelect, onShowPanel }: Props) {
  if (selected) {
    const list = groupByZone(profile.body_highlights.physical).get(selected) ?? [];
    return (
      <section aria-labelledby="obs-title" className="card flex min-h-0 flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <p className="eyebrow">Selected zone</p>
            <h2 id="obs-title" className="mt-0.5 text-base font-semibold text-ink">
              {ZONES[selected].name} <span className="font-normal text-ink-faint">· {ZONES[selected].system}</span>
            </h2>
          </div>
          <button
            onClick={() => onSelect(null)}
            aria-label="Clear selection"
            className="rounded-[4px] p-1.5 text-ink-faint transition hover:bg-raised hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="thin-scroll min-h-0 space-y-4 overflow-y-auto px-4 py-4">
          {list.length ? (
            list.map((h, i) => <Observation key={i} profile={profile} h={h} asSurgeon={asSurgeon} />)
          ) : (
            <p className="text-sm text-ink-soft">No observation recorded for this zone.</p>
          )}
        </div>
      </section>
    );
  }

  const items = [
    ...profile.body_highlights.physical.map((h) => ({ h, panel: "physical" as const })),
    ...profile.body_highlights.mental.map((h) => ({ h, panel: "mental" as const })),
  ]
    .filter(({ h }) => h.severity !== "NOMINAL")
    .sort((a, b) => STATUS_RANK[b.h.severity] - STATUS_RANK[a.h.severity]);

  return (
    <section aria-labelledby="obs-title" className="card flex min-h-0 flex-col">
      <header className="flex items-baseline justify-between border-b border-line px-4 py-3">
        <h2 id="obs-title" className="text-sm font-semibold text-ink">
          To review
        </h2>
        <span className="eyebrow">{items.length ? `${items.length} open` : "Clear"}</span>
      </header>
      {items.length === 0 ? (
        <p className="flex items-start gap-2 px-4 py-4 text-sm text-ink-soft">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-nominal" aria-hidden />
          Nothing to review. Every personal reading is inside its normal range.
        </p>
      ) : (
        <ul className="thin-scroll min-h-0 divide-y divide-line overflow-y-auto">
          {items.map(({ h, panel }, i) => (
            <li key={i}>
              <button
                onClick={() => {
                  onShowPanel(panel);
                  if (panel === "physical") onSelect(h.zone);
                }}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-raised"
              >
                <span className="mt-1.5">
                  <StatusGlyph status={h.severity} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-snug text-ink">{h.label}</span>
                  <span className="num mt-1 block text-[11px] text-ink-faint">
                    {observationTime(profile, h)} · {panel === "physical" ? ZONES[h.zone].name : "Mind"}
                  </span>
                </span>
                <span className={`mt-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_STYLES[h.severity].text}`}>
                  {STATUS_STYLES[h.severity].label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
