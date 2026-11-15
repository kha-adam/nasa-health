"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Lock } from "lucide-react";
import type { AstronautProfile, MetricDefinition } from "@/types/blue";
import { api } from "@/lib/api";
import { PRIMARY_METRICS, STATUS_RANK, STATUS_STYLES, metricValue } from "@/lib/metrics";
import { useRequireUser } from "@/lib/session";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import { ErrorScreen, FullScreenLoader } from "@/components/ScreenStates";

/** Flight-surgeon home: the crew roster at a glance (physical data only). */
export default function CrewPage() {
  const router = useRouter();
  const { user, error: sessionError, retry, logout } = useRequireUser();
  const [crew, setCrew] = useState<AstronautProfile[] | null>(null);
  const [catalog, setCatalog] = useState<MetricDefinition[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "flight_surgeon") {
      router.replace("/dashboard");
      return;
    }
    Promise.all([api.listAstronauts(), api.metrics()])
      .then(([c, m]) => {
        setCrew(c);
        setCatalog(m);
      })
      .catch(() => setError("Cannot load the crew from the BLUE server."));
  }, [user, router]);

  if (sessionError ?? error) return <ErrorScreen message={(sessionError ?? error)!} onRetry={retry} />;
  if (!user || !crew || !catalog) return <FullScreenLoader />;

  const byKey = new Map(catalog.map((m) => [m.key, m]));
  const metrics = PRIMARY_METRICS.physical
    .slice(0, 4)
    .map((k) => byKey.get(k))
    .filter((m): m is MetricDefinition => !!m);
  const ordered = [...crew].sort((a, b) => STATUS_RANK[b.status_tag] - STATUS_RANK[a.status_tag]);
  const lead = crew[0];

  return (
    <AppShell
      user={user}
      active="crew"
      onLogout={logout}
      mission={
        lead
          ? {
              missionDay: lead.mission_day,
              lastReadingAt: lead.last_reading_at,
              earthDelayMin: lead.current_vitals.earth_delay_min,
            }
          : null
      }
    >
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
        <p className="eyebrow">Flight surgeon</p>
        <h1 className="mt-1 text-xl font-semibold text-ink">Crew overview</h1>
        <p className="mt-1 text-[13.5px] text-ink-soft">
          {crew.length} crew members · physical and cabin data. Crew needing attention are listed first.
        </p>

        <section aria-label="Crew" className="card mt-5 overflow-hidden">
          <div
            className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_repeat(4,minmax(0,0.6fr))_1.5rem] gap-4 border-b border-line px-5 py-2.5 lg:grid"
            aria-hidden
          >
            <span className="eyebrow">Astronaut</span>
            <span className="eyebrow">Status</span>
            {metrics.map((m) => (
              <span key={m.key} className="eyebrow truncate text-right">
                {m.label.replace(" (SpO₂)", "")}
              </span>
            ))}
            <span />
          </div>
          <ul className="divide-y divide-line">
            {ordered.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/dashboard?id=${a.id}`}
                  className="group grid grid-cols-1 gap-3 px-5 py-4 transition hover:bg-raised lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_repeat(4,minmax(0,0.6fr))_1.5rem] lg:items-center lg:gap-4"
                >
                  <span className="flex items-center gap-3">
                    <span className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] bg-nasa text-[13px] font-semibold text-white ring-1 ring-sky/30">
                      {a.avatar_initials}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{a.name}</span>
                      <span className="block truncate text-xs text-ink-faint">{a.role}</span>
                    </span>
                  </span>
                  <span className="min-w-0">
                    <StatusBadge status={a.status_tag} />
                    <span className="mt-1 block text-[13px] leading-snug text-ink-soft">{a.status_summary}</span>
                  </span>
                  {metrics.map((m) => {
                    const s = a.metric_status[m.key] ?? "NOMINAL";
                    return (
                      <span key={m.key} className="flex items-baseline justify-between gap-2 lg:block lg:text-right">
                        <span className="text-xs text-ink-faint lg:hidden">{m.label}</span>
                        <span className={`num text-[15px] ${s === "NOMINAL" ? "text-ink" : STATUS_STYLES[s].text}`}>
                          {metricValue(m, a.current_vitals)}
                          <span className="ml-1 font-sans text-[10px] text-ink-faint">{m.unit}</span>
                        </span>
                      </span>
                    );
                  })}
                  <ChevronRight
                    className="hidden h-4 w-4 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-sky lg:block"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-5 flex items-center gap-1.5 text-xs text-ink-faint">
          <Lock className="h-3.5 w-3.5" aria-hidden /> Medical view. Mental-health reports and BLUE conversations are not
          shared with the flight surgeon.
        </p>
      </main>
    </AppShell>
  );
}
