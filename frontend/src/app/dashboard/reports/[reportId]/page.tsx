"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Activity, ArrowLeft, CheckCircle2, Clock, Globe2, Loader2, Lock, MessageCircle } from "lucide-react";
import type { AstronautProfile, MentalHealthReport } from "@/types/blue";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/session";
import { ErrorScreen, FullScreenLoader } from "@/components/ScreenStates";

export default function ReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const { user, error: sessionError, retry } = useRequireUser();
  const [profile, setProfile] = useState<AstronautProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      <Centered>
        <Lock className="h-6 w-6 text-sky" />
        <p className="text-sm text-ink-soft">Mental-health reports are private to the astronaut and the Earth psychologist.</p>
        <Link href="/crew" className="text-sm font-semibold text-sky">
          Back to crew
        </Link>
      </Centered>
    );
  }
  if (!profile) return <FullScreenLoader />;

  const report = profile.mental_reports.find((r) => r.id === reportId);
  if (!report) {
    return (
      <Centered>
        <p className="text-sm text-ink-soft">This report could not be found. Reports from a past server session are reset.</p>
        <Link href="/dashboard" className="text-sm font-semibold text-sky">
          Back to dashboard
        </Link>
      </Centered>
    );
  }

  const reviewed = report.earth_status === "REVIEWED_BY_EARTH";

  const simulate = async () => {
    setPending(true);
    try {
      const updated: MentalHealthReport = await api.simulateEarthReply(profile.id, report.id);
      setProfile({ ...profile, mental_reports: profile.mental_reports.map((r) => (r.id === updated.id ? updated : r)) });
    } catch {
      setError("Earth uplink unavailable — retry in a moment.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-tint-strong hover:bg-tint hover:text-sky"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
      </Link>

      <article className="card mt-4 p-6">
        <header className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
          <span>{report.created_at}</span>
          <span className="rounded-full bg-tint px-2 py-0.5 text-[10px] font-semibold tracking-wide text-sky">
            {report.session_mode === "DEEP_SUPPORT" ? "DEEP SUPPORT" : "BRIEF CHECK-IN"}
          </span>
          <span
            className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
              reviewed ? "bg-teal-50 text-nominal ring-teal-200" : "bg-amber-50 text-advisory ring-amber-200"
            }`}
          >
            {reviewed ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {report.earth_status}
          </span>
        </header>

        <h1 className="mt-3 text-xl font-bold leading-snug text-ink">{report.headline}</h1>

        <Section icon={<MessageCircle className="h-4 w-4" />} title="What BLUE heard">
          {report.summary}
        </Section>
        <Section icon={<Activity className="h-4 w-4" />} title="What the sensors showed">
          {report.biometric_correlation}
        </Section>

        {reviewed && report.earth_psychologist_directive ? (
          <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50/60 p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-nominal">
              <Globe2 className="h-4 w-4" /> What to do — Earth psychologist
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">{report.earth_psychologist_directive}</p>
          </div>
        ) : (
          <button
            onClick={simulate}
            disabled={pending}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full border border-sky px-3 py-2 text-sm font-semibold text-sky transition hover:bg-tint disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe2 className="h-4 w-4" />}
            {pending ? "Receiving Earth uplink…" : "Simulate Earth Psychologist Reply"}
          </button>
        )}

        <p className="mt-6 flex items-center gap-1.5 text-[11px] text-ink-soft">
          <Lock className="h-3 w-3" /> Visible only to you and the Earth psychologist.
        </p>
      </article>
    </main>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky">
        {icon} {title}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-ink">{children}</p>
    </section>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">{children}</div>;
}
