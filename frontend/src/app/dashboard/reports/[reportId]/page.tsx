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
          <span className="orb-disc h-12 w-12">
            <Lock className="h-5 w-5" aria-hidden />
          </span>
          <p className="max-w-sm text-sm text-ink-soft">Mental-health reports are private to the astronaut and the Earth psychologist.</p>
          <Link href="/crew" className="btn-soft px-4 py-1.5 text-sm">
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
          <Link href="/dashboard/reports" className="btn-soft px-4 py-1.5 text-sm">
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
      <main className="mx-auto w-full max-w-3xl pb-24">
        <Link href="/dashboard/reports" className="btn-ghost px-3.5 py-1.5 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All reports
        </Link>

        <article className="card mt-3">
          <header className="border-b border-line bg-[radial-gradient(100%_140%_at_100%_0%,#dcedff_0%,#f5faff_42%,#ffffff_78%)] px-6 pb-6 pt-5 sm:px-8">
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <span className="pill num">{report.created_at}</span>
              <span className="pill">
                {report.session_mode === "DEEP_SUPPORT" ? "Deep support" : "Brief check-in"}
              </span>
              <span
                className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ring-1 ring-inset ${
                  reviewed ? "bg-nominal-soft text-nominal ring-nominal-line" : "bg-advisory-soft text-advisory ring-advisory-line"
                }`}
              >
                {reviewed ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <Clock className="h-3.5 w-3.5" aria-hidden />}
                {reviewed ? "Reviewed by Earth" : "Queued for Earth"}
              </span>
            </div>
            <h1 className="mt-4 text-[26px] font-normal leading-snug tracking-[-0.02em] text-ink">{report.headline}</h1>
          </header>

          <div className="space-y-7 px-6 py-6 sm:px-8">
            <Section title="What you told BLUE" tag={<SourceTag kind="declared" origin="Conversation summary" />}>
              {report.summary}
            </Section>
            <Section title="What the sensors showed" tag={<SourceTag kind="computed" origin="From sensor data" />}>
              {report.biometric_correlation}
            </Section>

            {reviewed && report.earth_psychologist_directive ? (
              <div className="rounded-[20px] border border-nominal-line bg-nominal-soft p-5">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-nominal">
                  <Globe2 className="h-4 w-4" aria-hidden /> What to do — Earth psychologist
                </p>
                <p className="mt-2 text-[15px] leading-relaxed text-ink">{report.earth_psychologist_directive}</p>
              </div>
            ) : (
              <div>
                <button
                  onClick={simulate}
                  disabled={pending}
                  className="btn-cta h-12 w-full pl-6 pr-1.5 text-sm"
                >
                  {pending ? "Receiving Earth uplink…" : "Simulate Earth Psychologist Reply"}
                  <span className="cta-disc h-9 w-9">
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Globe2 className="h-4 w-4" aria-hidden />}
                  </span>
                </button>
                {uplinkError && (
                  <p role="alert" className="mt-2 text-xs text-urgent">
                    {uplinkError}
                  </p>
                )}
              </div>
            )}
          </div>

          <footer className="flex items-center gap-1.5 border-t border-line bg-[#f7fbfe] px-6 py-3.5 text-[12px] text-ink-faint sm:px-8">
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
        <h2 className="text-[13px] font-semibold text-ink-soft">{title}</h2>
        {tag}
      </div>
      <p className="mt-2.5 text-[15.5px] leading-relaxed text-ink">{children}</p>
    </section>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">{children}</div>;
}
