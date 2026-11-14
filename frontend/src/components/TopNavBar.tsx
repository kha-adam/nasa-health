"use client";

import { ArrowLeftRight, Brain, HeartPulse, Radio } from "lucide-react";
import type { AstronautProfile } from "@/types/blue";
import { EARTH_DELAY } from "@/lib/vitals";
import StatusBadge from "./StatusBadge";

export type PanelMode = "physical" | "mental";

interface Props {
  profile: AstronautProfile;
  panel: PanelMode;
  onPanelChange: (mode: PanelMode) => void;
  onSwitchAstronaut: () => void;
}

export default function TopNavBar({ profile, panel, onPanelChange, onSwitchAstronaut }: Props) {
  return (
    <header className="card grid grid-cols-1 xl:grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-3">
      {/* Left: astronaut identity */}
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tint font-bold text-sky">
          {profile.avatar_initials}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold text-ink">{profile.name}</h1>
            <StatusBadge status={profile.status_tag} />
          </div>
          <p className="text-xs text-ink-soft">
            {profile.role} · Mission Day {profile.mission_day}
          </p>
        </div>
        <button
          onClick={onSwitchAstronaut}
          className="ml-2 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-tint-strong hover:bg-tint hover:text-sky"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" /> Switch Astronaut
        </button>
      </div>

      {/* Center: Physical | Mental segmented switcher */}
      <div role="tablist" aria-label="Dashboard panel" className="flex w-fit max-w-full rounded-full bg-tint p-1">
        {(
          [
            { key: "physical", label: "Physical Panel", icon: HeartPulse },
            { key: "mental", label: "Mental Panel", icon: Brain },
          ] as const
        ).map(({ key, label, icon: Icon }) => {
          const active = panel === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => onPanelChange(key)}
              className={`inline-flex items-center gap-2 rounded-full px-3 sm:px-5 py-2 text-sm font-semibold transition ${
                active ? "bg-sky text-white shadow" : "text-sky hover:bg-tint-strong/60"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          );
        })}
      </div>

      {/* Right: Earth comms latency */}
      <div className="flex justify-start xl:justify-end">
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas px-3 py-1.5 text-xs text-ink-soft">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-light opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-sky" />
          </span>
          <Radio className="h-3.5 w-3.5 text-sky" />
          <span>
            Earth Link: <strong className="font-semibold text-ink">{EARTH_DELAY} Delay</strong>
          </span>
        </div>
      </div>
    </header>
  );
}
