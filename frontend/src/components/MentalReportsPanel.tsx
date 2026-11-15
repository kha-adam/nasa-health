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
      <header className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
        <h2 id="reports-title" className="text-[17px] font-medium text-ink">
          Reports for Earth
        </h2>
        {reports.length > limit ? (
          <Link href="/dashboard/reports" className="btn-soft px-3 py-1 text-xs">
            All {reports.length}
          </Link>
        ) : (
          <span className="pill">Private · {reports.length}</span>
        )}
      </header>

      {error && (
        <p role="alert" className="mx-3 mb-1 rounded-[14px] bg-urgent-soft px-3.5 py-2 text-xs text-urgent ring-1 ring-inset ring-urgent-line">
          {error}
        </p>
      )}

      {reports.length === 0 ? (
        <p className="px-5 pb-5 pt-2 text-sm text-ink-soft">No report yet. Talk to BLUE to file your first check-in.</p>
      ) : (
        <ul className="thin-scroll flex min-h-0 flex-col gap-1 overflow-y-auto px-2.5 pb-2.5">
          {visible.map((r) => {
            const reviewed = r.earth_status === "REVIEWED_BY_EARTH";
            const fresh = r.id === freshReportId;
            return (
              <li key={r.id} className={`rounded-[16px] ${fresh ? "bg-tint ring-1 ring-inset ring-sky/25" : ""}`}>
                <Link
                  href={`/dashboard/reports/${r.id}`}
                  className="group grid grid-cols-[3rem_minmax(0,1fr)_auto] items-start gap-2 rounded-[16px] px-3 py-2.5 transition hover:bg-raised"
                >
                  <span className="num pt-0.5 text-[12px] font-medium text-ink-faint">{shortDay(r.created_at)}</span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-[13.5px] font-medium leading-snug text-ink">
                      {fresh && (
                        <span className="num mr-1.5 rounded-full bg-sky px-1.5 py-px align-[1px] text-[10px] font-semibold text-white">NEW</span>
                      )}
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
                  <div className="-mt-1 pb-3 pl-[4.25rem] pr-3">
                    <button
                      onClick={() => simulate(r.id)}
                      disabled={pending === r.id}
                      className="btn-soft px-3 py-1 text-[11px]"
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
