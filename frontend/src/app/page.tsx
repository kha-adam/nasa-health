"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ChevronRight, Droplet, HeartPulse, Loader2, RefreshCw, Satellite, Brain } from "lucide-react";
import type { AstronautProfile } from "@/types/blue";
import { api } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";

const PERSONA_TAGLINES: Record<string, string> = {
  "astro-vance": "Nominal baseline",
  "astro-chen": "Physical strain · hypoglycemic trend",
  "astro-lin": "Isolation fatigue · high cortisol",
};

export default function CrewSelectorPage() {
  const router = useRouter();
  const [crew, setCrew] = useState<AstronautProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api
      .listAstronauts()
      .then(setCrew)
      .catch(() => setError("Cannot reach the BLUE backend at localhost:8000. Is uvicorn running?"));
  };

  useEffect(load, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-12">
      <header className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky to-sky-light text-white shadow-card">
          <Satellite className="h-7 w-7" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky">Project BLUE</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Who is checking in today?</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-ink-soft">
          Select your crew profile to open your physical & psychological health dashboard and talk with BLUE, your
          onboard aerospace psychologist.
        </p>
      </header>

      {error && (
        <div className="card mx-auto flex max-w-lg flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-urgent">{error}</p>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-full bg-sky px-4 py-2 text-sm font-medium text-white hover:bg-sky-hover"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      )}

      {!crew && !error && (
        <div className="flex justify-center py-20 text-sky">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}

      {crew && (
        <div className="grid gap-6 md:grid-cols-3">
          {crew.map((a) => (
            <button
              key={a.id}
              onClick={() => router.push(`/dashboard?id=${a.id}`)}
              className="card group flex flex-col p-6 text-left transition hover:-translate-y-1 hover:border-tint-strong hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-sky"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-tint text-lg font-bold text-sky ring-4 ring-white">
                  {a.avatar_initials}
                </div>
                <StatusBadge status={a.status_tag} />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-ink">{a.name}</h2>
              <p className="text-sm text-ink-soft">
                {a.role} · Mission Day {a.mission_day}
              </p>
              <p className="mt-1 text-xs font-medium text-sky">{PERSONA_TAGLINES[a.id]}</p>

              <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-canvas p-3 text-xs">
                <Vital icon={<HeartPulse className="h-3.5 w-3.5" />} label="Heart" value={`${a.current_vitals.heart_rate_bpm} BPM`} />
                <Vital icon={<Droplet className="h-3.5 w-3.5" />} label="Glucose" value={`${a.current_vitals.blood_sugar_mg_dl} mg/dL`} />
                <Vital icon={<Activity className="h-3.5 w-3.5" />} label="BP" value={`${a.current_vitals.systolic_bp}/${a.current_vitals.diastolic_bp}`} />
                <Vital icon={<Brain className="h-3.5 w-3.5" />} label="Cortisol" value={`${a.current_vitals.cortisol_ug_dl} µg/dL`} />
              </dl>

              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-sky group-hover:text-sky-hover">
                Open dashboard <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}

function Vital({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-ink-soft">
        <span className="text-sky">{icon}</span>
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold text-ink">{value}</dd>
    </div>
  );
}
