"use client";

import Link from "next/link";
import { ChevronRight, Flag, Lock } from "lucide-react";
import type { AstronautProfile } from "@/types/blue";
import { STATUS_STYLES, metricHref } from "@/lib/metrics";

interface Props {
  profile: AstronautProfile;
  asSurgeon: boolean;
  limit?: number;
}

/** Mission events (episodes, drifts, habitat changes), newest first. */
export default function EventsPanel({ profile, asSurgeon, limit = 4 }: Props) {
  const events = profile.events.slice(0, limit);
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-sm font-semibold text-ink">Mission events</h2>
        <span className="text-[11px] text-ink-soft">{profile.events.length} logged</span>
      </div>

      <div className="thin-scroll card flex min-h-0 flex-col divide-y divide-line overflow-y-auto">
        {events.length === 0 && <p className="p-6 text-center text-sm text-ink-soft">No events logged.</p>}
        {events.map((e) => {
          const style = STATUS_STYLES[e.severity];
          const metric = e.metrics[0];
          const body = (
            <>
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: style.hex }} />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] text-ink-soft">
                  Day {e.mission_day} · {e.scope === "cabin" ? "Whole cabin" : "Personal"}
                </span>
                <span className="block text-sm font-semibold leading-snug text-ink">{e.label}</span>
              </span>
              {metric && <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-tint-strong group-hover:text-sky" />}
            </>
          );
          return metric ? (
            <Link
              key={e.id}
              href={metricHref(metric, profile.id, asSurgeon)}
              className="group flex items-start gap-3 px-4 py-3 transition hover:bg-canvas"
            >
              {body}
            </Link>
          ) : (
            <div key={e.id} className="flex items-start gap-3 px-4 py-3">
              {body}
            </div>
          );
        })}
      </div>

      {asSurgeon && (
        <p className="flex items-start gap-1.5 px-1 text-[11px] leading-snug text-ink-soft">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" />
          Mental-health reports and BLUE conversations stay private between the astronaut and the Earth psychologist.
        </p>
      )}
      {!asSurgeon && (
        <p className="flex items-center gap-1.5 px-1 text-[11px] text-ink-soft">
          <Flag className="h-3 w-3" /> Events are marked on the detailed charts.
        </p>
      )}
    </section>
  );
}
