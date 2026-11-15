"use client";

import { CheckCircle2, Lock, MessageSquareText } from "lucide-react";
import type { AstronautProfile, MetricDefinition } from "@/types/blue";
import { STATUS_RANK } from "@/lib/metrics";
import { Observation } from "./ObservationsPanel";
import SourceTag from "./SourceTag";

interface Props {
  profile: AstronautProfile;
  catalog: MetricDefinition[];
  asSurgeon: boolean;
  onOpenLog?: () => void;
}

/**
 * Centre column (mental panel). Mental health is shown as observations over time and
 * check-ins — never placed on the body, so no anatomical location is implied.
 */
export default function MindPanel({ profile, catalog, asSurgeon, onOpenLog }: Props) {
  const observations = [...profile.body_highlights.mental].sort(
    (a, b) => STATUS_RANK[b.severity] - STATUS_RANK[a.severity],
  );
  const reports = profile.mental_reports;
  const queued = reports.filter((r) => r.earth_status === "QUEUED_FOR_EARTH").length;

  return (
    <section aria-labelledby="mind-title" className="card flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 pb-3 pt-4">
        <h2 id="mind-title" className="text-[17px] font-medium text-ink">
          Mind & recovery <span className="text-[15px] font-normal text-ink-faint">· over time</span>
        </h2>
        <span className="pill">
          <Lock className="h-3 w-3" aria-hidden /> {asSurgeon ? "Private to the astronaut" : "You & the Earth psychologist"}
        </span>
      </header>

      {asSurgeon || profile.mental_redacted ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-10 text-center">
          <span className="orb-disc h-12 w-12">
            <Lock className="h-5 w-5" aria-hidden />
          </span>
          <p className="max-w-sm text-sm text-ink-soft">
            Mental-health observations and BLUE check-ins stay between the astronaut and the Earth psychologist.
            Non-private health statuses remain available in the overview and detailed measurements.
          </p>
        </div>
      ) : (
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="px-5 pb-5 pt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow">Observations</p>
              <SourceTag kind="computed" origin="from sensor & voice data" />
            </div>
            {observations.length ? (
              <div className="mt-3 space-y-4">
                {observations.map((h, i) => (
                  <Observation key={i} profile={profile} h={h} catalog={catalog} asSurgeon={asSurgeon} />
                ))}
              </div>
            ) : (
              <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
                <CheckCircle2 className="h-4 w-4 text-nominal" aria-hidden /> No observation over the recent period.
              </p>
            )}
          </div>

          <div className="border-t border-line px-5 py-5">
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow">Check-ins with BLUE</p>
              <SourceTag kind="declared" />
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2">
              {(
                [
                  ["Reports", String(reports.length)],
                  ["Last", reports[0]?.created_at.replace("Mission Day ", "D") ?? "—"],
                  ["Awaiting Earth", String(queued)],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-[16px] border border-line bg-raised/70 px-3.5 py-3">
                  <dt className="eyebrow">{label}</dt>
                  <dd className="num mt-1 text-[22px] font-semibold tracking-[-0.02em] text-ink">{value}</dd>
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
                className="btn-soft mt-3.5 px-3.5 py-1.5 text-xs"
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
