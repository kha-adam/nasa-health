"use client";

import Link from "next/link";
import { Award, FileText, LayoutGrid, LineChart, Users, type LucideIcon } from "lucide-react";
import type { AstronautProfile, SessionUser } from "@/types/blue";
import { dashboardHref, metricHref } from "@/lib/metrics";
import TopNavBar, { type MissionClock } from "./TopNavBar";

export type NavKey = "overview" | "crew" | "metrics" | "reports" | "crew-life";

interface NavItem {
  key: NavKey;
  label: string;
  icon: LucideIcon;
  href: string;
}

interface Props {
  user: SessionUser;
  profile?: AstronautProfile | null;
  /** Mission clock for pages without a single astronaut (crew overview). */
  mission?: MissionClock | null;
  active: NavKey;
  onLogout: () => void;
  /** Keep the overview shell within the viewport. */
  fit?: boolean;
  /** Keep the overview header focused on the brand and sign-out action. */
  minimalHeader?: boolean;
  /** Extra content in the mission bar, after the product name. */
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}

function navItems(user: SessionUser, profile: AstronautProfile | null | undefined): NavItem[] {
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
    items.push({ key: "crew-life", label: "Crew life", icon: Award, href: "/dashboard/crew-life" });
  }
  return items;
}

function NavEntry({ item, active, compact }: { item: NavItem; active: boolean; compact?: boolean }) {
  const Icon = item.icon;
  const cls = compact
    ? `flex min-h-10 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1.5 text-center text-[11px] font-medium transition ${
        active
          ? "glass-blue text-white"
          : "border border-line bg-white text-ink-soft hover:bg-raised hover:text-ink"
      }`
    : `group relative flex w-full flex-col items-center gap-1 rounded-[18px] py-2.5 text-[11px] font-medium transition ${
        active
          ? "glass-blue text-white"
          : "text-ink-soft hover:bg-raised hover:text-ink"
      }`;
  const body = (
    <>
      <Icon className={compact ? "h-4 w-4" : "h-[18px] w-[18px]"} aria-hidden />
      {item.label}
    </>
  );
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={cls}>
      {body}
    </Link>
  );
}

/** Navigation rail + mission bar around every signed-in page. */
export default function AppShell({ user, profile, mission, active, onLogout, fit, minimalHeader, headerExtra, children }: Props) {
  const items = navItems(user, profile);
  const clock: MissionClock | null = profile
    ? {
        missionDay: profile.mission_day,
        lastReadingAt: profile.last_reading_at,
        earthDelayMin: profile.current_vitals.earth_delay_min,
      }
    : (mission ?? null);

  return (
    <div className={`flex gap-3 p-3 ${fit ? "h-dvh overflow-hidden" : "min-h-dvh"}`}>
      <nav
        aria-label="Main"
        className="hidden w-[84px] shrink-0 flex-col items-center gap-1.5 rounded-[24px] border border-line bg-rail px-2 pb-3 pt-3 shadow-[var(--shadow-card)] md:sticky md:top-3 md:flex md:h-[calc(100dvh-24px)]"
      >
        {items.map((item) => (
          <NavEntry key={item.key} item={item} active={item.key === active} />
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <TopNavBar user={user} mission={clock} onLogout={onLogout} minimal={minimalHeader} extra={headerExtra} />
        <nav aria-label="Main" className="grid shrink-0 grid-flow-col auto-cols-fr gap-1.5 md:hidden">
          {items.map((item) => (
            <NavEntry key={item.key} item={item} active={item.key === active} compact />
          ))}
        </nav>
        <div className={`flex min-h-0 flex-1 flex-col ${fit ? "overflow-hidden" : ""}`}>{children}</div>
      </div>
    </div>
  );
}
