"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Clock, Globe2, Loader2 } from "lucide-react";
import type { MentalHealthReport } from "@/types/blue";

interface Props {
  reports: MentalHealthReport[];
  onSimulateEarthReply: (reportId: string) => Promise<void>;
  freshReportId?: string | null;
  /** How many headlines to show; the full list lives at /dashboard/reports. */
  limit?: number;
  /** Fill the remaining height of the column. */
  grow?: boolean;
}

function shortDay(createdAt: string) {
  return createdAt.replace("Mission Day ", "D");
}

/** Mental-health reports as one-line headlines with their Earth status. */
export default function MentalReportsPanel({ reports, onSimulateEarthReply, freshReportId, limit = 3, grow }: Props) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visible = reports.slice(0, limit);

  const simulate = async (id: string) => {
    setPending(id);
    setError(null);
    try {
      await onSimulateEarthReply(id);
    } catch {
      setError("Earth uplink unavailable — retry in a moment.");
    } finally {
      setPending(null);
    }
  };

  return (
    <section aria-labelledby="reports-title" className={`card flex min-h-0 flex-col ${grow ? "flex-1" : ""}`}>
      <header className="flex items-baseline justify-between border-b border-line px-4 py-3">
        <h2 id="reports-title" className="text-sm font-semibold text-ink">
          Reports for Earth
        </h2>
        {reports.length > limit ? (
          <Link href="/dashboard/reports" className="text-xs font-semibold text-sky hover:text-sky-hover">
            All {reports.length}
          </Link>
        ) : (
          <span className="eyebrow">Private · {reports.length}</span>
        )}
      </header>

      {error && (
        <p role="alert" className="border-b border-line bg-urgent/10 px-4 py-2 text-xs text-urgent">
          {error}
        </p>
      )}

      {reports.length === 0 ? (
        <p className="px-4 py-4 text-sm text-ink-soft">No report yet. Talk to BLUE to file your first check-in.</p>
      ) : (
        <ul className="thin-scroll min-h-0 divide-y divide-line overflow-y-auto">
          {visible.map((r) => {
            const reviewed = r.earth_status === "REVIEWED_BY_EARTH";
            const fresh = r.id === freshReportId;
            return (
              <li key={r.id} className={fresh ? "bg-tint/60" : ""}>
                <Link
                  href={`/dashboard/reports/${r.id}`}
                  className="group grid grid-cols-[3rem_minmax(0,1fr)_auto] items-start gap-2 px-4 py-3 transition hover:bg-raised"
                >
                  <span className="num pt-0.5 text-[12px] text-ink-faint">{shortDay(r.created_at)}</span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-[13.5px] font-medium leading-snug text-ink">
                      {fresh && <span className="num mr-1.5 text-[10px] font-semibold text-sky">NEW</span>}
                      {r.headline}
                    </span>
                    <span
                      className={`mt-1 inline-flex items-center gap-1 text-[11px] font-medium ${
                        reviewed ? "text-nominal" : "text-advisory"
                      }`}
                    >
                      {reviewed ? (
                        <CheckCircle2 className="h-3 w-3" aria-hidden />
                      ) : (
                        <Clock className="h-3 w-3" aria-hidden />
                      )}
                      {reviewed ? "Earth replied" : "Queued for Earth"}
                    </span>
                  </span>
                  <ChevronRight
                    className="mt-0.5 h-4 w-4 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-sky"
                    aria-hidden
                  />
                </Link>
                {!reviewed && (
                  <div className="-mt-1 pb-3 pl-[4.5rem] pr-4">
                    <button
                      onClick={() => simulate(r.id)}
                      disabled={pending === r.id}
                      className="inline-flex items-center gap-1.5 rounded-[4px] border border-line-strong px-2.5 py-1 text-[11px] font-semibold text-sky transition hover:bg-raised disabled:opacity-60"
                    >
                      {pending === r.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      ) : (
                        <Globe2 className="h-3 w-3" aria-hidden />
                      )}
                      {pending === r.id ? "Receiving Earth uplink…" : "Simulate Earth Psychologist Reply"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
