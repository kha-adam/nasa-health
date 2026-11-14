"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
import type { AstronautProfile, MentalHealthReport, MetricDefinition } from "@/types/blue";
import { api } from "@/lib/api";
import { STATUS_STYLES, type PanelMode } from "@/lib/metrics";
import { useRequireUser, useTargetAstronaut } from "@/lib/session";
import TopNavBar from "@/components/TopNavBar";
import VitalsPanel from "@/components/VitalsPanel";
import HumanBodyModel from "@/components/HumanBodyModel";
import MentalReportsPanel from "@/components/MentalReportsPanel";
import EventsPanel from "@/components/EventsPanel";
import VoicePsychologistFab from "@/components/VoicePsychologistFab";
import { ErrorScreen, FullScreenLoader } from "@/components/ScreenStates";

export default function DashboardPage() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const router = useRouter();
  const { user, error: sessionError, retry, logout } = useRequireUser();
  const astronautId = useTargetAstronaut(user);
  const asSurgeon = user?.role === "flight_surgeon";

  const [profile, setProfile] = useState<AstronautProfile | null>(null);
  const [catalog, setCatalog] = useState<MetricDefinition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelMode>("physical");
  const [freshReportId, setFreshReportId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!astronautId) return;
    setError(null);
    Promise.all([api.getAstronaut(astronautId), api.metrics()])
      .then(([p, c]) => {
        setProfile(p);
        setCatalog(c);
        // Open on the panel where this astronaut's alerts live.
        const physicalAlert = p.body_highlights.physical.some((h) => h.severity !== "NOMINAL");
        const mentalAlert = p.body_highlights.mental.some((h) => h.severity !== "NOMINAL");
        setPanel(mentalAlert && !physicalAlert ? "mental" : "physical");
      })
      .catch(() => setError("Cannot load this astronaut from the BLUE server."));
  }, [astronautId]);

  useEffect(() => {
    if (user && !astronautId) router.replace("/crew");
    else load();
  }, [user, astronautId, load, router]);

  const handleReportGenerated = useCallback((report: MentalHealthReport) => {
    setProfile((p) => (p ? { ...p, mental_reports: [report, ...p.mental_reports.filter((r) => r.id !== report.id)] } : p));
    setFreshReportId(report.id);
  }, []);

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

  const failure = sessionError ?? error;
  if (failure) return <ErrorScreen message={failure} onRetry={sessionError ? retry : load} />;
  if (!user || !profile || !catalog || profile.id !== astronautId) return <FullScreenLoader />;

  const summaryStyle = STATUS_STYLES[profile.status_tag];

  return (
    <div className="flex min-h-screen flex-col gap-4 p-4 lg:h-screen lg:min-h-[720px]">
      <TopNavBar profile={profile} user={user} panel={panel} onPanelChange={setPanel} onLogout={logout} />

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,30fr)_minmax(0,38fr)_minmax(0,32fr)] lg:grid-rows-1">
        <VitalsPanel profile={profile} panel={panel} catalog={catalog} asSurgeon={asSurgeon} />

        <div className="flex min-h-0 flex-col gap-3">
          <p
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium ring-1 ${summaryStyle.bg} ${summaryStyle.ring} text-ink`}
          >
            <Info className={`h-4 w-4 shrink-0 ${summaryStyle.text}`} />
            {profile.status_summary}
          </p>
          <HumanBodyModel profile={profile} panel={panel} asSurgeon={asSurgeon} />
        </div>

        <div className="flex min-h-0 flex-col pb-24 md:col-span-2 lg:col-span-1">
          {asSurgeon ? (
            <EventsPanel profile={profile} asSurgeon />
          ) : (
            <MentalReportsPanel
              reports={profile.mental_reports}
              onSimulateEarthReply={handleEarthReply}
              freshReportId={freshReportId}
            />
          )}
        </div>
      </main>

      {!asSurgeon && (
        <VoicePsychologistFab
          key={profile.id}
          astronautId={profile.id}
          astronautName={profile.name}
          onReportGenerated={handleReportGenerated}
        />
      )}
    </div>
  );
}
