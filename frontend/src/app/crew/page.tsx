"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Lock, LogOut, Stethoscope } from "lucide-react";
import type { AstronautProfile, MetricDefinition } from "@/types/blue";
import { api } from "@/lib/api";
import { PRIMARY_METRICS, STATUS_STYLES, metricValue } from "@/lib/metrics";
import { useRequireUser } from "@/lib/session";
import StatusBadge from "@/components/StatusBadge";
import { ErrorScreen, FullScreenLoader } from "@/components/ScreenStates";

/** Flight-surgeon home: the crew at a glance (physical data only). */
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
  const keys = PRIMARY_METRICS.physical.slice(0, 4);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky to-sky-light text-white shadow-card">
          <Stethoscope className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky">Project BLUE</p>
          <h1 className="text-2xl font-bold text-ink">Crew overview</h1>
        </div>
        <span className="text-sm text-ink-soft">{user.display_name}</span>
        <button
          onClick={logout}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-tint-strong hover:bg-tint hover:text-sky"
        >
          <LogOut className="h-3.5 w-3.5" /> Log out
        </button>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        {crew.map((a) => (
          <Link
            key={a.id}
            href={`/dashboard?id=${a.id}`}
            className="card group flex flex-col p-6 transition hover:-translate-y-1 hover:border-tint-strong hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-sky"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-tint text-base font-bold text-sky">
                {a.avatar_initials}
              </div>
              <StatusBadge status={a.status_tag} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-ink">{a.name}</h2>
            <p className="text-sm text-ink-soft">{a.role}</p>
            <p className="mt-3 min-h-[2.5rem] text-sm text-ink">{a.status_summary}</p>

            <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-canvas p-3 text-xs">
              {keys.map((k) => {
                const m = byKey.get(k);
                if (!m) return null;
                const s = STATUS_STYLES[a.metric_status[k] ?? "NOMINAL"];
                return (
                  <div key={k}>
                    <dt className="flex items-center gap-1 text-ink-soft">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.hex }} />
                      {m.label}
                    </dt>
                    <dd className="mt-0.5 font-semibold text-ink">
                      {metricValue(m, a.current_vitals)} {m.unit}
                    </dd>
                  </div>
                );
              })}
            </dl>

            <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-sky group-hover:text-sky-hover">
              Open dashboard <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-ink-soft">
        <Lock className="h-3.5 w-3.5" /> Medical view. Mental-health reports and BLUE conversations are not shared with
        the flight surgeon.
      </p>
    </main>
  );
}
