import {
  AudioLines,
  BookOpen,
  Compass,
  Feather,
  Film,
  Headphones,
  Moon,
  Music,
  PenLine,
  PersonStanding,
  Star,
  Sun,
  Telescope,
  Users,
  Utensils,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { CrewMember, Patch, PatchCode, PerkCode, RitualKind } from "@/types/blue";

/** Icons for the weekly titles (title cards). Prestige emblems are drawn in PrestigeBadge. */
export const PATCH_ICONS: Record<PatchCode, LucideIcon> = {
  calm_keeper: Feather,
  checkin_star: Star,
  station_voice: AudioLines,
  sleep_captain: Moon,
  crew_compass: Compass,
  crew_challenge: Users,
};

export const PERK_ICONS: Record<PerkCode, LucideIcon> = {
  station_playlist: Headphones,
  menu_meal: Utensils,
  wakeup_song: Sun,
  quiet_hour: BookOpen,
  sunday_activity: Users,
};

export const RITUAL_ICONS: Record<RitualKind, LucideIcon> = {
  breathing: Wind,
  stretch: PersonStanding,
  window: Telescope,
  music: Music,
  wind_down: Moon,
  gratitude: PenLine,
};

export const REWARD_KIND_ICONS = { film: Film, meal: Utensils } as const;

/** Ready-made encouragements (the astronaut can also write their own). */
export const ENCOURAGEMENT_PRESETS = [
  "Great work today!",
  "Thanks for the help.",
  "Proud to fly with you.",
  "You've got this.",
  "Take care of yourself tonight.",
];

/** "Spec. Maya Lin" -> "Maya". */
export function firstName(name: string): string {
  const parts = name.split(" ");
  return parts.length > 1 ? parts[1] : parts[0];
}

export function crewName(crew: CrewMember[], id: string | null | undefined): string {
  return crew.find((c) => c.id === id)?.name ?? "A crewmate";
}

export function crewInitials(crew: CrewMember[], id: string): string {
  return crew.find((c) => c.id === id)?.avatar_initials ?? "··";
}

// --------------------------------------------------------------------------
// Prestige: each badge kind keeps its emblem; its rarity climbs with how many times it was earned.
// Rarity is coded by the colour of the emblem's inlaid lines, from most common to rarest.
// --------------------------------------------------------------------------

export type PrestigeTierKey = "common" | "rare" | "epic" | "legendary" | "mythic";

export interface PrestigeTier {
  key: PrestigeTierKey;
  label: string;
  /** Completions needed to reach this tier. */
  min: number;
  /** 1 (common) … 5 (mythic): drawn as pips under the emblem. */
  rank: number;
  /** Inlay colour (white, blue, purple, red, yellow). */
  color: string;
}

export const PRESTIGE_TIERS: PrestigeTier[] = [
  { key: "common", label: "Common", min: 1, rank: 1, color: "#ffffff" },
  { key: "rare", label: "Rare", min: 2, rank: 2, color: "#3fb6ff" },
  { key: "epic", label: "Epic", min: 3, rank: 3, color: "#b46cff" },
  { key: "legendary", label: "Legendary", min: 5, rank: 4, color: "#ff3b30" },
  { key: "mythic", label: "Mythic", min: 10, rank: 5, color: "#ffcc1f" },
];

export function prestigeTier(count: number): PrestigeTier {
  return [...PRESTIGE_TIERS].reverse().find((t) => count >= t.min) ?? PRESTIGE_TIERS[0];
}

export function nextPrestigeTier(count: number): PrestigeTier | null {
  return PRESTIGE_TIERS.find((t) => t.min > count) ?? null;
}

/** Display order: the crew's shared emblem first, then the five weekly titles. */
export const PRESTIGE_ORDER: PatchCode[] = [
  "crew_challenge",
  "calm_keeper",
  "checkin_star",
  "station_voice",
  "sleep_captain",
  "crew_compass",
];

export interface PrestigeBadgeInfo {
  code: PatchCode;
  name: string;
  count: number;
  /** Held this week (awarded when the week closes). */
  current: boolean;
  lastWeek: number;
}

/** One entry per badge kind the astronaut has earned, with how many times. */
export function prestigeBadges(patches: Patch[]): PrestigeBadgeInfo[] {
  const byCode = new Map<PatchCode, PrestigeBadgeInfo>();
  for (const p of patches) {
    const b = byCode.get(p.code);
    if (!b) byCode.set(p.code, { code: p.code, name: p.name, count: 1, current: p.current, lastWeek: p.week });
    else {
      b.count += 1;
      b.current ||= p.current;
      b.lastWeek = Math.max(b.lastWeek, p.week);
    }
  }
  return PRESTIGE_ORDER.flatMap((code) => byCode.get(code) ?? []);
}

export function prestigeLabel(b: PrestigeBadgeInfo): string {
  const tier = prestigeTier(b.count);
  const next = nextPrestigeTier(b.count);
  const times = b.count === 1 ? "earned once" : `earned ${b.count} times`;
  return `${b.name} · ${tier.label} · ${times}${next ? ` · ${next.min - b.count} more for ${next.label}` : ""}`;
}
