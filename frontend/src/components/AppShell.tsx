"use client";

import Link from "next/link";
import { FileText, LayoutGrid, LineChart, MessageSquareText, Users, type LucideIcon } from "lucide-react";
import type { AstronautProfile, SessionUser } from "@/types/blue";
import { dashboardHref, metricHref } from "@/lib/metrics";
import TopNavBar, { type MissionClock } from "./TopNavBar";

export type NavKey = "overview" | "crew" | "metrics" | "reports" | "log";

interface NavItem {
  key: NavKey;
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
}

interface Props {
  user: SessionUser;
  profile?: AstronautProfile | null;
  /** Mission clock for pages without a single astronaut (crew overview). */
  mission?: MissionClock | null;
  active: NavKey;
  onLogout: () => void;
  /** Opens the BLUE log in place (dashboard); other pages link to it. */
  onOpenLog?: () => void;
  /** Lock the page to the viewport on large screens (dashboard). */
  fit?: boolean;
  children: React.ReactNode;
}

function navItems(user: SessionUser, profile: AstronautProfile | null | undefined, onOpenLog?: () => void): NavItem[] {
  const surgeon = user.role === "flight_surgeon";
  const id = profile?.id ?? user.astronaut_id;
  // The flight surgeon's overview is a crew member's dashboard; from the roster, "Crew" is home.
  const items: NavItem[] = id
    ? [{ key: "overview", label: "Overview", icon: LayoutGrid, href: dashboardHref(id, surgeon) }]
    : [];
  if (surgeon) items.push({ key: "crew", label: "Crew", icon: Users, href: "/crew" });
  if (id) items.push({ key: "metrics", label: "Metrics", icon: LineChart, href: metricHref("heart_rate", id, surgeon) });
  if (!surgeon) {
    items.push({ key: "reports", label: "Reports", icon: FileText, href: "/dashboard/reports" });
    items.push(
      onOpenLog
        ? { key: "log", label: "Log", icon: MessageSquareText, onClick: onOpenLog }
        : { key: "log", label: "Log", icon: MessageSquareText, href: "/dashboard?log=1" },
    );
  }
  return items;
}

function NavEntry({ item, active, compact }: { item: NavItem; active: boolean; compact?: boolean }) {
  const Icon = item.icon;
  const cls = compact
    ? `flex h-10 items-center gap-2 rounded-[4px] px-3 text-xs font-medium transition ${
        active ? "bg-tint text-ink" : "text-ink-soft hover:bg-raised hover:text-ink"
      }`
    : `group relative flex w-full flex-col items-center gap-1 rounded-[4px] py-2.5 text-[10px] font-medium tracking-wide transition ${
        active ? "bg-tint text-ink" : "text-ink-faint hover:bg-raised hover:text-ink"
      }`;
  const body = (
    <>
      {!compact && active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-sky" aria-hidden />}
      <Icon className={compact ? "h-4 w-4" : `h-[18px] w-[18px] ${active ? "text-sky" : ""}`} aria-hidden />
      {item.label}
    </>
  );
  return item.href ? (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={item.onClick} className={cls}>
      {body}
    </button>
  );
}

/** Narrow navigation rail + mission bar around every signed-in page. */
export default function AppShell({ user, profile, mission, active, onLogout, onOpenLog, fit, children }: Props) {
  const items = navItems(user, profile, onOpenLog);
  const clock: MissionClock | null = profile
    ? {
        missionDay: profile.mission_day,
        lastReadingAt: profile.last_reading_at,
        earthDelayMin: profile.current_vitals.earth_delay_min,
      }
    : (mission ?? null);

  return (
    <div className={`flex min-h-screen ${fit ? "lg:h-screen lg:overflow-hidden" : ""}`}>
      <nav
        aria-label="Main"
        className="hidden w-[72px] shrink-0 flex-col items-center gap-1 border-r border-line bg-rail px-2 pb-3 md:flex md:sticky md:top-0 md:h-screen"
      >
        <div
          className="mb-3 mt-2.5 flex h-8 w-8 items-center justify-center rounded-[4px] bg-nasa text-[13px] font-bold text-white ring-1 ring-sky/40"
          aria-hidden
        >
          <span className="num">B</span>
        </div>
        {items.map((item) => (
          <NavEntry key={item.key} item={item} active={item.key === active} />
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavBar user={user} mission={clock} onLogout={onLogout} />
        <nav aria-label="Main" className="thin-scroll flex gap-1 overflow-x-auto border-b border-line bg-rail px-3 py-1.5 md:hidden">
          {items.map((item) => (
            <NavEntry key={item.key} item={item} active={item.key === active} compact />
          ))}
        </nav>
        <div className={`flex min-h-0 flex-1 flex-col ${fit ? "lg:overflow-hidden" : ""}`}>{children}</div>
      </div>
    </div>
  );
}
