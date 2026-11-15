"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, Globe2, Loader2, Lock } from "lucide-react";
import type { AstronautProfile, MentalHealthReport } from "@/types/blue";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/session";
import AppShell from "@/components/AppShell";
import SourceTag from "@/components/SourceTag";
import { ErrorScreen, FullScreenLoader } from "@/components/ScreenStates";

export default function ReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const { user, error: sessionError, retry, logout } = useRequireUser();
  const [profile, setProfile] = useState<AstronautProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uplinkError, setUplinkError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const astronautId = user?.role === "astronaut" ? user.astronaut_id : null;

  useEffect(() => {
    if (!astronautId) return;
    api
      .getAstronaut(astronautId)
      .then(setProfile)
      .catch(() => setError("Cannot load your reports from the BLUE server."));
  }, [astronautId]);

  if (sessionError) return <ErrorScreen message={sessionError} onRetry={retry} />;
  if (error) return <ErrorScreen message={error} onRetry={() => location.reload()} />;
  if (!user) return <FullScreenLoader />;

  if (user.role !== "astronaut") {
    return (
      <AppShell user={user} active="reports" onLogout={logout}>
        <Centered>
          <Lock className="h-6 w-6 text-ink-faint" aria-hidden />
          <p className="text-sm text-ink-soft">Mental-health reports are private to the astronaut and the Earth psychologist.</p>
          <Link href="/crew" className="text-sm font-semibold text-sky">
            Back to crew
          </Link>
        </Centered>
      </AppShell>
    );
  }
  if (!profile) return <FullScreenLoader />;

  const report = profile.mental_reports.find((r) => r.id === reportId);
  if (!report) {
    return (
      <AppShell user={user} profile={profile} active="reports" onLogout={logout}>
        <Centered>
          <p className="text-sm text-ink-soft">This report could not be found. Reports from a past server session are reset.</p>
          <Link href="/dashboard/reports" className="text-sm font-semibold text-sky">
            All reports
          </Link>
        </Centered>
      </AppShell>
    );
  }

  const reviewed = report.earth_status === "REVIEWED_BY_EARTH";

  const simulate = async () => {
    setPending(true);
    setUplinkError(null);
    try {
      const updated: MentalHealthReport = await api.simulateEarthReply(profile.id, report.id);
      setProfile({ ...profile, mental_reports: profile.mental_reports.map((r) => (r.id === updated.id ? updated : r)) });
    } catch {
      setUplinkError("Earth uplink unavailable — retry in a moment.");
    } finally {
      setPending(false);
    }
  };

  return (
    <AppShell user={user} profile={profile} active="reports" onLogout={logout}>
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <Link
          href="/dashboard/reports"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All reports
        </Link>

        <article className="card mt-3">
          <header className="border-b border-line px-6 py-5">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="num text-ink-faint">{report.created_at}</span>
              <span className="num rounded-[3px] border border-line-strong px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-soft">
                {report.session_mode === "DEEP_SUPPORT" ? "Deep support" : "Brief check-in"}
              </span>
              <span
                className={`ml-auto inline-flex items-center gap-1.5 font-medium ${reviewed ? "text-nominal" : "text-advisory"}`}
              >
                {reviewed ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <Clock className="h-3.5 w-3.5" aria-hidden />}
                {reviewed ? "Reviewed by Earth" : "Queued for Earth"}
              </span>
            </div>
            <h1 className="mt-3 text-xl font-semibold leading-snug text-ink">{report.headline}</h1>
          </header>

          <div className="space-y-6 px-6 py-5">
            <Section title="What you told BLUE" tag={<SourceTag kind="declared" origin="Conversation summary" />}>
              {report.summary}
            </Section>
            <Section title="What the sensors showed" tag={<SourceTag kind="computed" origin="From sensor data" />}>
              {report.biometric_correlation}
            </Section>

            {reviewed && report.earth_psychologist_directive ? (
              <div className="rounded-[4px] border border-nominal/40 bg-nominal/10 p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-nominal">
                  <Globe2 className="h-4 w-4" aria-hidden /> What to do — Earth psychologist
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink">{report.earth_psychologist_directive}</p>
              </div>
            ) : (
              <div>
                <button
                  onClick={simulate}
                  disabled={pending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[4px] border border-line-strong px-3 py-2 text-sm font-semibold text-sky transition hover:bg-raised disabled:opacity-60"
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Globe2 className="h-4 w-4" aria-hidden />}
                  {pending ? "Receiving Earth uplink…" : "Simulate Earth Psychologist Reply"}
                </button>
                {uplinkError && (
                  <p role="alert" className="mt-2 text-xs text-urgent">
                    {uplinkError}
                  </p>
                )}
              </div>
            )}
          </div>

          <footer className="flex items-center gap-1.5 border-t border-line px-6 py-3 text-[11px] text-ink-faint">
            <Lock className="h-3 w-3" aria-hidden /> Visible only to you and the Earth psychologist.
          </footer>
        </article>
      </main>
    </AppShell>
  );
}

function Section({ title, tag, children }: { title: string; tag: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="eyebrow">{title}</h2>
        {tag}
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-ink">{children}</p>
    </section>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">{children}</div>;
}
