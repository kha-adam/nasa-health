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
  /** Keep the overview header focused on the brand and sign-out action. */
  minimalHeader?: boolean;
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
    ? `flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium transition ${
        active
          ? "bg-[linear-gradient(180deg,#2f6bc4,#2356c2)] text-white shadow-[0_3px_5px_rgb(29_90_164/0.18)]"
          : "border border-line bg-white text-ink-soft hover:bg-raised hover:text-ink"
      }`
    : `group relative flex w-full flex-col items-center gap-1 rounded-[18px] py-2.5 text-[11px] font-medium transition ${
        active
          ? "bg-[linear-gradient(180deg,#2f6bc4,#2356c2)] text-white shadow-[0_6px_14px_-6px_rgb(29_90_164/0.6),inset_0_1px_1px_rgb(255_255_255/0.22)]"
          : "text-ink-soft hover:bg-raised hover:text-ink"
      }`;
  const body = (
    <>
      <Icon className={compact ? "h-4 w-4" : "h-[18px] w-[18px]"} aria-hidden />
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

/** Navigation rail + mission bar around every signed-in page. */
export default function AppShell({ user, profile, mission, active, onLogout, onOpenLog, fit, minimalHeader, children }: Props) {
  const items = navItems(user, profile, onOpenLog);
  const clock: MissionClock | null = profile
    ? {
        missionDay: profile.mission_day,
        lastReadingAt: profile.last_reading_at,
        earthDelayMin: profile.current_vitals.earth_delay_min,
      }
    : (mission ?? null);

  return (
    <div className={`flex min-h-screen gap-3 p-3 ${fit ? "lg:h-screen lg:overflow-hidden" : ""}`}>
      <nav
        aria-label="Main"
        className="hidden w-[84px] shrink-0 flex-col items-center gap-1.5 rounded-[24px] border border-line bg-rail/90 px-2 pb-3 pt-3 shadow-[var(--shadow-card)] md:sticky md:top-3 md:flex md:h-[calc(100vh-24px)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized decorative asset */}
        <img
          src="/brand/chrome-sphere.webp"
          alt=""
          width={40}
          height={40}
          className="mb-3 h-10 w-10 drop-shadow-[0_6px_10px_rgba(12,71,109,0.3)]"
        />
        {items.map((item) => (
          <NavEntry key={item.key} item={item} active={item.key === active} />
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <TopNavBar user={user} mission={clock} onLogout={onLogout} minimal={minimalHeader} />
        <nav aria-label="Main" className="thin-scroll -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 md:hidden">
          {items.map((item) => (
            <NavEntry key={item.key} item={item} active={item.key === active} compact />
          ))}
        </nav>
        <div className={`flex min-h-0 flex-1 flex-col ${fit ? "lg:overflow-hidden" : ""}`}>{children}</div>
      </div>
    </div>
  );
}
