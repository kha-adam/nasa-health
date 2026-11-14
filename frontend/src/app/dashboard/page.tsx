"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import type { AstronautProfile, MentalHealthReport } from "@/types/blue";
import { api, isAstronautId } from "@/lib/api";
import TopNavBar, { type PanelMode } from "@/components/TopNavBar";
import PhysicalChartsPanel from "@/components/PhysicalChartsPanel";
import HumanBodyModel from "@/components/HumanBodyModel";
import MentalReportsPanel from "@/components/MentalReportsPanel";
import VoicePsychologistFab from "@/components/VoicePsychologistFab";

export default function DashboardPage() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const rawId = params.get("id");
  const astronautId = isAstronautId(rawId) ? rawId : null;

  const [profile, setProfile] = useState<AstronautProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelMode>("physical");
  const [freshReportId, setFreshReportId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!astronautId) return;
    setError(null);
    api
      .getAstronaut(astronautId)
      .then((p) => {
        setProfile(p);
        // Open on the panel where this astronaut's alerts live.
        const physicalAlert = p.body_highlights.physical.some((h) => h.severity !== "NOMINAL");
        const mentalAlert = p.body_highlights.mental.some((h) => h.severity !== "NOMINAL");
        setPanel(mentalAlert && !physicalAlert ? "mental" : "physical");
      })
      .catch(() => setError("Cannot load this astronaut from the BLUE backend (localhost:8000)."));
  }, [astronautId]);

  useEffect(() => {
    if (!astronautId) router.replace("/");
    else load();
  }, [astronautId, load, router]);

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

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="card flex max-w-md flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-urgent">{error}</p>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-full bg-sky px-4 py-2 text-sm font-medium text-white hover:bg-sky-hover"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!profile || profile.id !== astronautId) return <FullScreenLoader />;

  return (
    <div className="flex h-screen min-h-[720px] flex-col gap-4 p-4">
      <TopNavBar
        profile={profile}
        panel={panel}
        onPanelChange={setPanel}
        onSwitchAstronaut={() => router.push("/")}
      />

      <main className="grid min-h-0 flex-1 grid-cols-[30fr_38fr_32fr] grid-rows-1 gap-4">
        <PhysicalChartsPanel profile={profile} panel={panel} />
        <HumanBodyModel profile={profile} panel={panel} />
        <div className="flex min-h-0 flex-col pb-24">
          <MentalReportsPanel
            reports={profile.mental_reports}
            onSimulateEarthReply={handleEarthReply}
            freshReportId={freshReportId}
          />
        </div>
      </main>

      <VoicePsychologistFab
        key={profile.id}
        astronautId={profile.id}
        astronautName={profile.name}
        onReportGenerated={handleReportGenerated}
      />
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sky">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}
