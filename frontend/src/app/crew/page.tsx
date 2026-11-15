"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Lock } from "lucide-react";
import type { AstronautProfile } from "@/types/blue";
import { api } from "@/lib/api";
import { STATUS_RANK } from "@/lib/metrics";
import { useRequireUser } from "@/lib/session";
import AppShell from "@/components/AppShell";
import PageHero from "@/components/PageHero";
import StatusBadge from "@/components/StatusBadge";
import { ErrorScreen, FullScreenLoader } from "@/components/ScreenStates";

/** Flight-surgeon home: the crew roster at a glance (physical data only). */
export default function CrewPage() {
  const router = useRouter();
  const { user, error: sessionError, retry, logout } = useRequireUser();
  const [crew, setCrew] = useState<AstronautProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "flight_surgeon") {
      router.replace("/dashboard");
      return;
    }
    api.listAstronauts()
      .then(setCrew)
      .catch(() => setError("Cannot load the crew from the BLUE server."));
  }, [user, router]);

  if (sessionError ?? error) return <ErrorScreen message={(sessionError ?? error)!} onRetry={retry} />;
  if (!user || !crew) return <FullScreenLoader />;

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
      <main className="mx-auto w-full max-w-6xl pb-6">
        <PageHero eyebrow="Flight surgeon" title="Crew overview">
          {crew.length} crew members · status overview. Open a profile for detailed measurements.
        </PageHero>

        <section aria-label="Crew" className="card mt-4">
          <ul className="flex flex-col gap-1 p-2">
            {ordered.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/dashboard?id=${a.id}`}
                  className="group grid grid-cols-1 gap-3 rounded-[20px] px-4 py-4 transition hover:bg-raised sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:items-center"
                >
                  <span className="flex items-center gap-3">
                    <span className="orb-disc num h-11 w-11 text-[13px] font-semibold">
                      {a.avatar_initials}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-display text-[15px] font-semibold text-ink">{a.name}</span>
                      <span className="block truncate text-xs text-ink-faint">{a.role}</span>
                    </span>
                  </span>
                  <span className="min-w-0">
                    <StatusBadge status={a.status_tag} />
                    <span className="mt-1 block text-[13px] leading-snug text-ink-soft">{a.status_summary}</span>
                  </span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-sky">
                    View profile <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-4 flex items-center gap-1.5 px-2 text-xs text-ink-faint">
          <Lock className="h-3.5 w-3.5" aria-hidden /> Medical view. Mental-health reports and BLUE conversations are not
          shared with the flight surgeon.
        </p>
      </main>
    </AppShell>
  );
}
