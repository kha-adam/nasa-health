"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Brain, Download, HeartPulse, Users } from "lucide-react";
import type { AstronautProfile, BodyZone, CrewLifeBoard, MentalHealthReport, MetricDefinition } from "@/types/blue";
import { api } from "@/lib/api";
import { dashboardHref, openLog, type PanelMode } from "@/lib/metrics";
import { useRequireUser, useTargetAstronaut } from "@/lib/session";
import AppShell from "@/components/AppShell";
import VitalsPanel from "@/components/VitalsPanel";
import HumanBodyModel from "@/components/HumanBodyModel";
import MindPanel from "@/components/MindPanel";
import ObservationsPanel from "@/components/ObservationsPanel";
import EventsPanel from "@/components/EventsPanel";
import ExportDialog from "@/components/ExportDialog";
import VoicePsychologistFab from "@/components/VoicePsychologistFab";
import StatusBadge from "@/components/StatusBadge";
import CheckInStreak from "@/components/CheckInStreak";
import DashboardReminders from "@/components/DashboardReminders";
import PrestigeStrip from "@/components/PrestigeStrip";
import { ErrorScreen, FullScreenLoader } from "@/components/ScreenStates";

export default function DashboardPage() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Dashboard />
    </Suspense>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { key: T; label: string; icon?: typeof Brain }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="seg">
      {options.map(({ key, label: text, icon: Icon }) => {
        const active = value === key;
        return (
          <button
            key={key}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(key)}
            className="seg-option"
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
            {text}
          </button>
        );
      })}
    </div>
  );
}

function Dashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, error: sessionError, retry, logout } = useRequireUser();
  const astronautId = useTargetAstronaut(user);
  const asSurgeon = user?.role === "flight_surgeon";

  const [profile, setProfile] = useState<AstronautProfile | null>(null);
  const [catalog, setCatalog] = useState<MetricDefinition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelMode>("physical");
  const [selected, setSelected] = useState<BodyZone | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [crewProgress, setCrewProgress] = useState<CrewLifeBoard | null>(null);
  // Crew Life owns the week and the signed-in astronaut's check-in days.
  const loadCrewProgress = useCallback(() => {
    if (user?.role !== "astronaut") return;
    api
      .crewLife()
      .then(setCrewProgress)
      .catch(() => {});
  }, [user]);
  useEffect(loadCrewProgress, [loadCrewProgress]);

  const load = useCallback(() => {
    if (!astronautId) return;
    setError(null);
    Promise.all([api.getAstronaut(astronautId), api.metrics()])
      .then(([p, c]) => {
        setProfile(p);
        setCatalog(c);
        setSelected(null);
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

  // Arriving from the "Log" entry on another page: open BLUE once the dashboard is ready.
  const wantsLog = params.get("log") === "1";
  useEffect(() => {
    if (!profile || asSurgeon || !wantsLog) return;
    openLog();
    router.replace(dashboardHref(profile.id, false));
  }, [profile, asSurgeon, wantsLog, router]);

  const showPanel = useCallback((p: PanelMode) => {
    setPanel(p);
    if (p === "mental") setSelected(null);
  }, []);

  const handleReportGenerated = useCallback((report: MentalHealthReport) => {
    setProfile((p) => (p ? { ...p, mental_reports: [report, ...p.mental_reports.filter((r) => r.id !== report.id)] } : p));
    loadCrewProgress();
  }, [loadCrewProgress]);

  const failure = sessionError ?? error;
  if (failure) return <ErrorScreen message={failure} onRetry={sessionError ? retry : load} />;
  if (!user || !profile || !catalog || profile.id !== astronautId) return <FullScreenLoader />;
  const progress = !asSurgeon && crewProgress?.astronaut_id === profile.id ? crewProgress : null;
  const checkInDue = progress ? !progress.challenge.your_days.includes(progress.mission_day) : false;

  return (
    <AppShell
      user={user}
      profile={profile}
      active="overview"
      onLogout={logout}
      fit
      minimalHeader
      headerExtra={progress ? (
        <div className="order-1 flex min-w-0 items-center gap-1.5 sm:gap-3">
          <Link href="/dashboard/crew-life#challenge-title" className="rounded-full hover:brightness-95">
            <CheckInStreak days={progress.streak_days} />
          </Link>
          <PrestigeStrip patches={progress.patches} />
          <DashboardReminders checkInDue={checkInDue} astronautId={progress.astronaut_id} />
        </div>
      ) : undefined}
    >
      {/* Who is followed and which view */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-1 pb-3 pt-0.5 md:px-2">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="orb-disc num h-11 w-11 text-sm font-semibold">{profile.avatar_initials}</div>
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <h1 className="truncate text-[22px] font-medium leading-tight tracking-[-0.02em] text-ink">{profile.name}</h1>
            <StatusBadge status={profile.status_tag} />
          </div>
          {asSurgeon && (
            <Link href="/crew" className="btn-ghost ml-1 shrink-0 px-3 py-1.5 text-xs">
              <Users className="h-3.5 w-3.5" aria-hidden /> Switch astronaut
            </Link>
          )}
        </div>

        <Segmented
          label="Dashboard panel"
          value={panel}
          onChange={showPanel}
          options={[
            { key: "physical", label: "Physical", icon: HeartPulse },
            { key: "mental", label: "Mental", icon: Brain },
          ]}
        />

        <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
          <button onClick={() => setExportOpen(true)} className="btn-ghost h-9 px-3.5 text-[13px] shadow-[0_1px_1px_rgb(30_45_58/0.06)]">
            <Download className="h-3.5 w-3.5 text-sky" aria-hidden /> Export report
          </button>
        </div>
      </div>

      <main className="thin-scroll grid min-h-0 w-full flex-1 grid-cols-1 items-start gap-3 overflow-y-auto pb-24 md:grid-cols-2 min-[55rem]:grid-cols-[minmax(0,30fr)_minmax(0,38fr)_minmax(0,32fr)] min-[55rem]:grid-rows-[minmax(0,1fr)] min-[55rem]:overflow-hidden min-[55rem]:pb-0">
        {/* Left: short status overview. */}
        <div className="min-w-0 min-[55rem]:max-h-full min-[55rem]:overflow-y-auto">
          <VitalsPanel profile={profile} catalog={catalog} asSurgeon={asSurgeon} />
        </div>

        {/* Centre: body (physical) or mind (mental). */}
        <div className="flex min-h-[420px] min-w-0 flex-col md:col-start-2 md:row-start-1 min-[55rem]:min-h-0 min-[55rem]:self-stretch">
          {panel === "physical" ? (
            <HumanBodyModel profile={profile} selected={selected} onSelect={setSelected} />
          ) : (
            <MindPanel profile={profile} catalog={catalog} asSurgeon={asSurgeon} onOpenLog={asSurgeon ? undefined : openLog} />
          )}
        </div>

        {/* Right: only findings needing attention; reports stay in the Reports section. */}
        <div className="flex min-w-0 flex-col gap-3 md:col-span-2 min-[55rem]:col-span-1 min-[55rem]:col-start-3 min-[55rem]:row-start-1 min-[55rem]:max-h-full min-[55rem]:overflow-y-auto min-[55rem]:pb-20">
          <ObservationsPanel
            profile={profile}
            catalog={catalog}
            asSurgeon={asSurgeon}
            selected={selected}
            onSelect={setSelected}
          />
          {asSurgeon && <EventsPanel profile={profile} asSurgeon />}
        </div>
      </main>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        profile={profile}
        catalog={catalog}
        asSurgeon={asSurgeon}
      />

      {!asSurgeon && (
        <VoicePsychologistFab
          key={profile.id}
          astronautId={profile.id}
          astronautName={profile.name}
          onReportGenerated={handleReportGenerated}
        />
      )}
    </AppShell>
  );
}
