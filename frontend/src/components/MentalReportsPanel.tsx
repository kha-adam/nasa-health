"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, ClipboardList, Clock, Globe2, Loader2, Sparkles } from "lucide-react";
import type { MentalHealthReport } from "@/types/blue";

interface Props {
  reports: MentalHealthReport[];
  onSimulateEarthReply: (reportId: string) => Promise<void>;
  freshReportId?: string | null;
}

/** Right column: one line per report; the full report opens on its own page. */
export default function MentalReportsPanel({ reports, onSimulateEarthReply, freshReportId }: Props) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-sm font-semibold text-ink">Mental Health Reports</h2>
        <span className="text-[11px] text-ink-soft">Private · {reports.length} on file</span>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-urgent">{error}</p>}

      <div className="thin-scroll card flex min-h-0 flex-col divide-y divide-line overflow-y-auto">
        {reports.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-ink-soft">
            <ClipboardList className="h-6 w-6 text-sky" />
            No reports yet. Talk to BLUE to file your first check-in.
          </div>
        )}

        {reports.map((r) => {
          const reviewed = r.earth_status === "REVIEWED_BY_EARTH";
          const fresh = r.id === freshReportId;
          return (
            <article key={r.id} className={`shrink-0 ${fresh ? "bg-tint/50" : ""}`}>
              <Link
                href={`/dashboard/reports/${r.id}`}
                className="group flex items-start gap-3 px-4 py-3 transition hover:bg-canvas focus:outline-none focus-visible:bg-tint"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[11px] text-ink-soft">
                    {r.created_at}
                    {fresh && (
                      <span className="inline-flex items-center gap-0.5 font-semibold text-sky">
                        <Sparkles className="h-3 w-3" /> NEW
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-sm font-semibold leading-snug text-ink">{r.headline}</span>
                  <span
                    className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold ${
                      reviewed ? "text-nominal" : "text-advisory"
                    }`}
                  >
                    {reviewed ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    {reviewed ? "Earth replied — see what to do" : "Queued for Earth"}
                  </span>
                </span>
                <ChevronRight className="mt-4 h-4 w-4 shrink-0 text-tint-strong transition group-hover:translate-x-0.5 group-hover:text-sky" />
              </Link>
              {!reviewed && (
                <div className="px-4 pb-3">
                  <button
                    onClick={() => simulate(r.id)}
                    disabled={pending === r.id}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-sky px-3 py-1.5 text-xs font-semibold text-sky transition hover:bg-tint disabled:opacity-60"
                  >
                    {pending === r.id ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Receiving Earth uplink…
                      </>
                    ) : (
                      <>
                        <Globe2 className="h-3.5 w-3.5" /> Simulate Earth Psychologist Reply
                      </>
                    )}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
