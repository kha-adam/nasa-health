"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardList, Clock, Globe2, Loader2, Activity, Sparkles } from "lucide-react";
import type { MentalHealthReport } from "@/types/blue";

interface Props {
  reports: MentalHealthReport[];
  onSimulateEarthReply: (reportId: string) => Promise<void>;
  freshReportId?: string | null;
}

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
        <span className="text-[11px] text-ink-soft">{reports.length} on file</span>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-urgent">{error}</p>}

      <div className="thin-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {reports.length === 0 && (
          <div className="card flex flex-col items-center gap-2 p-6 text-center text-sm text-ink-soft">
            <ClipboardList className="h-6 w-6 text-sky" />
            No reports yet. Talk to BLUE to file your first check-in.
          </div>
        )}

        {reports.map((r) => {
          const reviewed = r.earth_status === "REVIEWED_BY_EARTH";
          const fresh = r.id === freshReportId;
          return (
            <article key={r.id} className={`card shrink-0 p-4 ${fresh ? "ring-2 ring-sky-light" : ""}`}>
              <header className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-ink-soft">{r.created_at}</span>
                <span className="rounded-full bg-tint px-2 py-0.5 text-[10px] font-semibold tracking-wide text-sky">
                  {r.session_mode === "DEEP_SUPPORT" ? "DEEP SUPPORT" : "BRIEF CHECK-IN"}
                </span>
                {fresh && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky">
                    <Sparkles className="h-3 w-3" /> NEW
                  </span>
                )}
                <span
                  className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                    reviewed ? "bg-teal-50 text-nominal ring-teal-200" : "bg-amber-50 text-advisory ring-amber-200"
                  }`}
                >
                  {reviewed ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {r.earth_status}
                </span>
              </header>

              <h3 className="mt-2 text-sm font-semibold leading-snug text-ink">{r.headline}</h3>

              <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                <span className="font-semibold text-ink">BLUE summary · </span>
                {r.summary}
              </p>

              <p className="mt-2 flex gap-1.5 rounded-lg bg-canvas px-2.5 py-2 text-[11px] leading-snug text-ink-soft">
                <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky" />
                <span>{r.biometric_correlation}</span>
              </p>

              {reviewed && r.earth_psychologist_directive ? (
                <div className="mt-2 rounded-lg border border-teal-200 bg-teal-50/60 px-3 py-2">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-nominal">
                    <Globe2 className="h-3 w-3" /> What to Do — Earth Psychologist
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-ink">{r.earth_psychologist_directive}</p>
                </div>
              ) : (
                <button
                  onClick={() => simulate(r.id)}
                  disabled={pending === r.id}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-sky px-3 py-1.5 text-xs font-semibold text-sky transition hover:bg-tint disabled:opacity-60"
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
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
