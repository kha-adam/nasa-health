import Link from "next/link";
import type { Patch } from "@/types/blue";
import { prestigeBadges, prestigeLabel } from "@/lib/crewLife";
import PrestigeBadge from "./PrestigeBadge";

/**
 * The astronaut's prestige emblems in the mission bar (overview only): badges
 * alone, no captions. Name, rarity and count appear on hover or keyboard focus
 * (from 640 px; the tooltip stays out of the layout so it never widens the
 * page), and each emblem opens Crew life. Phones have no room in the bar: one
 * badge up to 640 px, none under 420 px (they stay on the Crew life page).
 */
export default function PrestigeStrip({ patches }: { patches: Patch[] }) {
  const badges = prestigeBadges(patches);
  if (!badges.length) return null;
  return (
    <ul
      aria-label="Your prestige badges"
      className="order-1 flex min-w-0 items-center gap-1.5 border-l border-white/20 pl-3 sm:gap-2.5 sm:pl-4 max-sm:[&>li:nth-child(n+2)]:hidden max-[420px]:hidden"
    >
      {badges.map((b) => {
        const label = prestigeLabel(b);
        return (
          <li key={b.code} className="group relative">
            <Link
              href="/dashboard/crew-life"
              aria-label={label}
              className="flex rounded-[10px] p-0.5 transition-transform duration-150 hover:-translate-y-0.5 focus-visible:-translate-y-0.5"
            >
              <PrestigeBadge code={b.code} count={b.count} size={54} />
            </Link>
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-[10px] bg-night px-2.5 py-1.5 text-[11.5px] font-medium text-white shadow-pop sm:group-hover:block sm:group-focus-within:block"
            >
              {label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
