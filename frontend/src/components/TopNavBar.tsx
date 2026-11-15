"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { LogOut } from "lucide-react";
import type { SessionUser } from "@/types/blue";
import { formatDelay } from "@/lib/metrics";

export interface MissionClock {
  missionDay: number;
  /** ISO time of the last telemetry sample received. */
  lastReadingAt: string;
  earthDelayMin: number | null;
}

interface Props {
  user: SessionUser;
  mission: MissionClock | null;
  onLogout: () => void;
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** Browser connectivity; assumes online during server rendering. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

function useUtcClock(): string {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now ? now.toISOString().slice(11, 19) : "--:--:--";
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-baseline gap-2 border-l border-line pl-4 ${className}`}>
      <span className="eyebrow">{label}</span>
      <span className="num text-[13px] text-ink">{children}</span>
    </div>
  );
}

/** Compact mission bar: product, mission day, UTC clock, data sync, Earth link, account. */
export default function TopNavBar({ user, mission, onLogout }: Props) {
  const online = useOnline();
  const utc = useUtcClock();

  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-line bg-rail px-4 md:px-5">
      <p className="flex items-baseline gap-1.5 whitespace-nowrap text-sm">
        <span className="num font-semibold tracking-wide text-ink">BLUE</span>
        <span className="text-ink-faint">/</span>
        <span className="font-medium text-ink-soft">Crew Health</span>
      </p>

      {mission && (
        <Field label="Mission" className="hidden sm:flex">
          ASTRA · D{mission.missionDay}
        </Field>
      )}
      <Field label="UTC" className="hidden md:flex">
        <span aria-live="off">{utc}</span>
      </Field>

      {mission && (
        <div className="hidden items-center gap-2 border-l border-line pl-4 lg:flex" role="status">
          <span
            className={`h-1.5 w-1.5 rounded-full ${online ? "bg-nominal" : "bg-advisory"}`}
            aria-hidden
          />
          <span className={`text-[13px] font-medium ${online ? "text-ink" : "text-advisory"}`}>
            {online ? "Synced" : "Offline — showing last data"}
          </span>
          <span className="num text-[12px] text-ink-faint">
            last data D{mission.missionDay} {mission.lastReadingAt.slice(11, 16)}
          </span>
        </div>
      )}

      {mission && (
        <Field label="Earth link" className="hidden xl:flex">
          {formatDelay(mission.earthDelayMin)} <span className="font-sans text-ink-soft">delay</span>
        </Field>
      )}

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden text-[13px] text-ink-soft sm:inline">{user.display_name}</span>
        <button
          onClick={onLogout}
          className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-line px-2.5 text-xs font-medium text-ink-soft transition hover:border-line-strong hover:bg-raised hover:text-ink"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden /> Log out
        </button>
      </div>
    </header>
  );
}
