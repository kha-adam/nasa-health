"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import type { AstronautProfile } from "@/types/blue";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/session";
import AppShell from "@/components/AppShell";
import MentalReportsPanel from "@/components/MentalReportsPanel";
import { ErrorScreen, FullScreenLoader } from "@/components/ScreenStates";

/** Every mental-health report of the signed-in astronaut (private). */
export default function ReportsPage() {
  const { user, error: sessionError, retry, logout } = useRequireUser();
  const [profile, setProfile] = useState<AstronautProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const astronautId = user?.role === "astronaut" ? user.astronaut_id : null;

  useEffect(() => {
    if (!astronautId) return;
    api
      .getAstronaut(astronautId)
      .then(setProfile)
      .catch(() => setError("Cannot load your reports from the BLUE server."));
  }, [astronautId]);

  const handleEarthReply = useCallback(
    async (reportId: string) => {
      if (!astronautId) return;
      const updated = await api.simulateEarthReply(astronautId, reportId);
      setProfile((p) =>
        p ? { ...p, mental_reports: p.mental_reports.map((r) => (r.id === updated.id ? updated : r)) } : p,
      );
    },
    [astronautId],
  );

  if (sessionError ?? error) return <ErrorScreen message={(sessionError ?? error)!} onRetry={retry} />;
  if (!user) return <FullScreenLoader />;

  if (user.role !== "astronaut") {
    return (
      <AppShell user={user} active="reports" onLogout={logout}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <Lock className="h-6 w-6 text-ink-faint" aria-hidden />
          <p className="text-sm text-ink-soft">Mental-health reports are private to the astronaut and the Earth psychologist.</p>
          <Link href="/crew" className="text-sm font-semibold text-sky">
            Back to crew
          </Link>
        </div>
      </AppShell>
    );
  }
  if (!profile) return <FullScreenLoader />;

  return (
    <AppShell user={user} profile={profile} active="reports" onLogout={logout}>
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <p className="eyebrow">Reports</p>
        <h1 className="mt-1 text-xl font-semibold text-ink">Summaries for the Earth psychologist</h1>
        <p className="mt-1 text-[13.5px] text-ink-soft">
          Each check-in with BLUE becomes a short report. Earth replies with what to do next.
        </p>
        <div className="mt-5">
          <MentalReportsPanel
            reports={profile.mental_reports}
            onSimulateEarthReply={handleEarthReply}
            limit={profile.mental_reports.length || 1}
          />
        </div>
      </main>
    </AppShell>
  );
}
