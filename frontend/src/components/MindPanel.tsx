"use client";

import { CheckCircle2, Lock, MessageSquareText } from "lucide-react";
import type { AstronautProfile } from "@/types/blue";
import { STATUS_RANK } from "@/lib/metrics";
import { Observation } from "./ObservationsPanel";
import SourceTag from "./SourceTag";

interface Props {
  profile: AstronautProfile;
  asSurgeon: boolean;
  onOpenLog?: () => void;
}

/**
 * Centre column (mental panel). Mental health is shown as observations over time and
 * check-ins — never placed on the body, so no anatomical location is implied.
 */
export default function MindPanel({ profile, asSurgeon, onOpenLog }: Props) {
  const observations = [...profile.body_highlights.mental].sort(
    (a, b) => STATUS_RANK[b.severity] - STATUS_RANK[a.severity],
  );
  const reports = profile.mental_reports;
  const queued = reports.filter((r) => r.earth_status === "QUEUED_FOR_EARTH").length;

  return (
    <section aria-labelledby="mind-title" className="card flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <h2 id="mind-title" className="text-sm font-semibold text-ink">
          Mind & recovery <span className="font-normal text-ink-faint">· over time</span>
        </h2>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-faint">
          <Lock className="h-3 w-3" aria-hidden /> {asSurgeon ? "Private to the astronaut" : "You & the Earth psychologist"}
        </span>
      </header>

      {asSurgeon || profile.mental_redacted ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <Lock className="h-6 w-6 text-ink-faint" aria-hidden />
          <p className="max-w-sm text-sm text-ink-soft">
            Mental-health observations and BLUE check-ins stay between the astronaut and the Earth psychologist.
            Sleep, heart-rate variability and cortisol remain visible on the left.
          </p>
        </div>
      ) : (
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="px-4 pb-4 pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow">Observations</p>
              <SourceTag kind="computed" origin="from sensor & voice data" />
            </div>
            {observations.length ? (
              <div className="mt-3 space-y-4">
                {observations.map((h, i) => (
                  <Observation key={i} profile={profile} h={h} asSurgeon={asSurgeon} />
                ))}
              </div>
            ) : (
              <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
                <CheckCircle2 className="h-4 w-4 text-nominal" aria-hidden /> No observation over the recent period.
              </p>
            )}
          </div>

          <div className="border-t border-line px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow">Check-ins with BLUE</p>
              <SourceTag kind="declared" />
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-[4px] border border-line bg-line">
              {(
                [
                  ["Reports", String(reports.length)],
                  ["Last", reports[0]?.created_at.replace("Mission Day ", "D") ?? "—"],
                  ["Awaiting Earth", String(queued)],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="bg-card px-3 py-2.5">
                  <dt className="eyebrow">{label}</dt>
                  <dd className="num mt-1 text-lg text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2.5 text-[12px] leading-snug text-ink-faint">
              What you say to BLUE is summarised for the Earth psychologist. How often you check in is context, not a
              diagnosis.
            </p>
            {onOpenLog && (
              <button
                onClick={onOpenLog}
                className="mt-3 inline-flex items-center gap-2 rounded-[4px] border border-line-strong px-3 py-1.5 text-xs font-semibold text-sky transition hover:bg-raised"
              >
                <MessageSquareText className="h-3.5 w-3.5" aria-hidden /> Open the log
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
