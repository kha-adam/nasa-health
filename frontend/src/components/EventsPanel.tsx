"use client";

import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import type { AstronautProfile } from "@/types/blue";
import { metricHref } from "@/lib/metrics";
import { StatusGlyph } from "./StatusBadge";

interface Props {
  profile: AstronautProfile;
  asSurgeon: boolean;
  limit?: number;
  grow?: boolean;
}

/** Mission events (episodes, drifts, habitat changes), newest first, one line each. */
export default function EventsPanel({ profile, asSurgeon, limit = 4, grow }: Props) {
  const events = profile.events.slice(0, limit);
  return (
    <section aria-labelledby="events-title" className={`card flex min-h-0 flex-col ${grow ? "flex-1" : ""}`}>
      <header className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
        <h2 id="events-title" className="text-[17px] font-medium text-ink">
          Recent events
        </h2>
        <span className="pill">{profile.events.length} logged</span>
      </header>

      {events.length === 0 ? (
        <p className="px-5 pb-5 pt-2 text-sm text-ink-soft">No event logged.</p>
      ) : (
        <ul className="thin-scroll flex min-h-0 flex-col gap-1 overflow-y-auto px-2.5 pb-2.5">
          {events.map((e) => {
            const metric = e.metrics[0];
            const body = (
              <>
                <span className="num pt-0.5 text-[12px] font-medium text-ink-faint">D{e.mission_day}</span>
                <span className="min-w-0">
                  <span className="flex items-start gap-2">
                    <span className="mt-1.5">
                      <StatusGlyph status={e.severity} />
                    </span>
                    <span className="text-[13.5px] font-medium leading-snug text-ink">{e.label}</span>
                  </span>
                  <span className="mt-0.5 block pl-4 text-[11px] text-ink-faint">
                    {e.scope === "cabin" ? "Whole cabin" : "Personal"}
                  </span>
                </span>
                {metric ? (
                  <ChevronRight className="mt-0.5 h-4 w-4 text-ink-faint group-hover:text-sky" aria-hidden />
                ) : (
                  <span />
                )}
              </>
            );
            const cls = "group grid grid-cols-[3rem_minmax(0,1fr)_auto] items-start gap-2 rounded-[16px] px-3 py-2.5";
            return (
              <li key={e.id}>
                {metric ? (
                  <Link href={metricHref(metric, profile.id, asSurgeon)} className={`${cls} transition hover:bg-raised`}>
                    {body}
                  </Link>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {asSurgeon && (
        <p className="mt-auto flex items-start gap-1.5 border-t border-line px-5 py-3 text-[12px] leading-snug text-ink-faint">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          Mental-health reports and BLUE conversations stay private to the astronaut.
        </p>
      )}
    </section>
  );
}
