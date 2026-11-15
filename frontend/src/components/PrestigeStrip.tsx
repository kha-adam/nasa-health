import Link from "next/link";
import type { Patch } from "@/types/blue";
import { PRESTIGE_TIERS, prestigeBadges, prestigeTier } from "@/lib/crewLife";

import PrestigeBadge from "./PrestigeBadge";

export default function PrestigeStrip({ patches }: { patches: Patch[] }) {
  const badges = prestigeBadges(patches)
    .map((badge) => ({ badge, tier: prestigeTier(badge.count) }))
    .sort((a, b) => b.tier.rank - a.tier.rank);
  if (!badges.length) return null;

  return (
    <ul aria-label="Earned trophies" className="flex shrink-0 items-center gap-0.5 min-[440px]:gap-1.5">
      {badges.map(({ badge, tier }, index) => {
        return (
          <li key={badge.code} className={index === 0 ? "" : index < 3 ? "hidden min-[480px]:block" : "hidden min-[660px]:block"}>
            <Link
              href="/dashboard/crew-life#patches-title"
              aria-label={badge.name + ", rank " + tier.rank + " of " + PRESTIGE_TIERS.length}
              className="flex flex-col items-center gap-[3px] rounded-lg px-0.5 py-0.5 transition-transform hover:-translate-y-0.5 motion-reduce:transition-none"
            >
              <PrestigeBadge code={badge.code} count={badge.count} size={34} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
