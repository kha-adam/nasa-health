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
  minimal?: boolean;
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
    <div className={`flex shrink-0 items-baseline gap-2 xl:border-l xl:border-white/20 xl:pl-4 ${className}`}>
      <span className="text-[12px] font-medium text-white/85">{label}</span>
      <span className="num text-[13px] font-medium text-white">{children}</span>
    </div>
  );
}

/** Mission bar: product, mission day, UTC clock, data sync, Earth link, account. */
export default function TopNavBar({ user, mission, onLogout, minimal = false }: Props) {
  const online = useOnline();
  const utc = useUtcClock();

  return (
    <header className={`topbar flex shrink-0 items-center gap-x-4 rounded-[22px] px-4 text-white md:px-5 ${minimal ? "h-14 justify-between" : "flex-wrap gap-y-2 py-2.5 xl:h-14 xl:flex-nowrap xl:py-0"}`}>
      <p className="order-1 flex items-center gap-2 whitespace-nowrap text-sm">
        {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized decorative asset */}
        <img src="/brand/chrome-sphere.webp" alt="" width={26} height={26} className="h-[26px] w-[26px] md:hidden" />
        <span className="flex items-baseline gap-1.5">
          <span className="font-display text-[15px] font-bold tracking-[0.02em]">BLUE</span>
          <span className="text-white/60">/</span>
          <span className="font-display font-medium text-white/90">Crew Health</span>
        </span>
      </p>

      {!minimal && <div className="order-3 flex w-full min-w-0 flex-wrap items-center gap-x-5 gap-y-1.5 xl:order-2 xl:w-auto xl:flex-1 xl:flex-nowrap xl:gap-x-4">
        {mission && (
          <Field label="Mission">
            ASTRA · D{mission.missionDay}
          </Field>
        )}
        <Field label="UTC">
          <span aria-live="off">{utc}</span>
        </Field>

        {mission && (
          <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 xl:border-l xl:border-white/20 xl:pl-4" role="status">
            <span
              className={`h-2 w-2 rounded-full ${online ? "bg-[#7ef0d6] shadow-[0_0_0_3px_rgb(126_240_214/0.25)]" : "bg-[#ffc56b]"}`}
              aria-hidden
            />
            <span
              className={`text-[13px] font-medium ${
                online ? "text-white" : "rounded-full bg-white px-2 py-0.5 text-advisory"
              }`}
            >
              {online ? "Synced" : "Offline — showing last data"}
            </span>
            <span className="num text-[12px] text-white/85">
              last data D{mission.missionDay} {mission.lastReadingAt.slice(11, 16)}
            </span>
          </div>
        )}

        {mission && (
          <Field label="Earth link">
            {formatDelay(mission.earthDelayMin)} <span className="font-sans text-white/85">delay</span>
          </Field>
        )}
      </div>}

      <div className="order-2 ml-auto flex items-center gap-3 xl:order-3">
        {!minimal && <span className="hidden text-[13px] text-white/90 sm:inline">{user.display_name}</span>}
        <button onClick={onLogout} className="btn-cta h-9 py-0 pl-4 pr-1 text-xs">
          Log out
          <span className="cta-disc h-7 w-7">
            <LogOut className="h-3.5 w-3.5" aria-hidden />
          </span>
        </button>
      </div>
    </header>
  );
}
