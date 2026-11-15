"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Brain, Download, HeartPulse, Users } from "lucide-react";
import type { AstronautProfile, BodyZone, MentalHealthReport, MetricDefinition } from "@/types/blue";
import { api } from "@/lib/api";
import { dashboardHref, openLog, type PanelMode } from "@/lib/metrics";
import { useRequireUser, useTargetAstronaut } from "@/lib/session";
import AppShell from "@/components/AppShell";
import VitalsPanel, { TREND_RANGES, type TrendRange } from "@/components/VitalsPanel";
import HumanBodyModel from "@/components/HumanBodyModel";
import MindPanel from "@/components/MindPanel";
import ObservationsPanel from "@/components/ObservationsPanel";
import MentalReportsPanel from "@/components/MentalReportsPanel";
import EventsPanel from "@/components/EventsPanel";
import ExportDialog from "@/components/ExportDialog";
import VoicePsychologistFab from "@/components/VoicePsychologistFab";
import StatusBadge, { StatusGlyph } from "@/components/StatusBadge";
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
    <div role="radiogroup" aria-label={label} className="flex rounded-[4px] border border-line bg-rail/40 p-0.5">
      {options.map(({ key, label: text, icon: Icon }) => {
        const active = value === key;
        return (
          <button
            key={key}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(key)}
            className={`inline-flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-[13px] font-medium transition ${
              active ? "bg-nasa text-white ring-1 ring-sky/40" : "text-ink-soft hover:bg-raised hover:text-ink"
            }`}
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
  const [range, setRange] = useState<TrendRange>("7d");
  const [selected, setSelected] = useState<BodyZone | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [freshReportId, setFreshReportId] = useState<string | null>(null);

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

  return (
    <AppShell
      user={user}
      profile={profile}
      active="overview"
      onLogout={logout}
      onOpenLog={asSurgeon ? undefined : openLog}
      fit
    >
      {/* Who is followed, which view, which period */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line px-4 py-3 md:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="num flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-nasa text-sm font-semibold text-white ring-1 ring-sky/30">
            {profile.avatar_initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-lg font-semibold leading-tight text-ink">{profile.name}</h1>
              <StatusBadge status={profile.status_tag} />
            </div>
            <p className="mt-0.5 truncate text-[13px] text-ink-soft">
              {profile.role} <span className="num text-ink-faint">· {profile.id}</span>
            </p>
          </div>
          {asSurgeon && (
            <Link
              href="/crew"
              className="ml-1 inline-flex shrink-0 items-center gap-1.5 rounded-[4px] border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-raised hover:text-ink"
            >
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
          <span className="eyebrow hidden sm:inline">Period</span>
          <Segmented
            label="Trend period"
            value={range}
            onChange={setRange}
            options={TREND_RANGES.map((r) => ({ key: r.key, label: r.label }))}
          />
          <button
            onClick={() => setExportOpen(true)}
            className="inline-flex items-center gap-2 rounded-[4px] border border-line-strong px-3 py-1.5 text-[13px] font-medium text-ink transition hover:bg-raised"
          >
            <Download className="h-3.5 w-3.5 text-sky" aria-hidden /> Export report
          </button>
        </div>
      </div>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-x-4 gap-y-3 p-4 pb-24 md:grid-cols-2 md:px-5 lg:grid-cols-[minmax(0,30fr)_minmax(0,38fr)_minmax(0,32fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:pb-4">
        {/* One-line status: first on small screens, above the body on desktop */}
        <p className="flex items-start gap-2 px-1 text-[13px] leading-snug text-ink-soft md:col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
          <span className="mt-1">
            <StatusGlyph status={profile.status_tag} />
          </span>
          {profile.status_summary}
        </p>

        {/* Left: trends */}
        <div className="order-1 flex min-h-0 flex-col lg:col-start-1 lg:row-span-2 lg:row-start-1 [&>section]:flex-1">
          <VitalsPanel profile={profile} panel={panel} catalog={catalog} asSurgeon={asSurgeon} range={range} />
        </div>

        {/* Right: context & observations (before the model on phones) */}
        <div className="order-2 flex min-h-0 flex-col gap-4 md:order-3 md:col-span-2 lg:col-span-1 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:pb-14">
          <ObservationsPanel
            profile={profile}
            asSurgeon={asSurgeon}
            selected={selected}
            onSelect={setSelected}
            onShowPanel={showPanel}
          />
          {asSurgeon ? (
            <EventsPanel profile={profile} asSurgeon grow />
          ) : (
            <MentalReportsPanel
              reports={profile.mental_reports}
              onSimulateEarthReply={handleEarthReply}
              freshReportId={freshReportId}
              limit={2}
            />
          )}
        </div>

        {/* Centre: body (physical) or mind (mental) */}
        <div className="order-3 flex min-h-[560px] flex-col md:order-2 lg:col-start-2 lg:row-start-2 lg:min-h-0">
          {panel === "physical" ? (
            <HumanBodyModel profile={profile} selected={selected} onSelect={setSelected} />
          ) : (
            <MindPanel profile={profile} asSurgeon={asSurgeon} onOpenLog={asSurgeon ? undefined : openLog} />
          )}
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
