import Link from "next/link";
import type { Patch, PatchCode } from "@/types/blue";
import { PRESTIGE_TIERS, prestigeBadges, prestigeTier } from "@/lib/crewLife";

// These viewBoxes frame the provided expressions above the printed captions.
const POSES: Record<PatchCode, string> = {
  crew_challenge: "455 322 214 204", // happy
  calm_keeper: "10 53 214 202", // listening
  checkin_star: "455 322 214 204", // happy
  station_voice: "234 322 214 204", // surprised
  sleep_captain: "234 53 214 202", // laughing
  crew_compass: "234 322 214 204", // surprised
};

const PALETTES = {
  common: { hue: 15, face: "#eff8ff", rim: "#b8d6ee" },
  rare: { hue: -48, face: "#e5faf0", rim: "#8edec6" },
  epic: { hue: 76, face: "#f2edff", rim: "#c3b1ee" },
  legendary: { hue: 145, face: "#fff0f3", rim: "#f2a8be" },
  mythic: { hue: 218, face: "#fff5d6", rim: "#ffd978" },
};

export default function PrestigeStrip({ patches }: { patches: Patch[] }) {
  const badges = prestigeBadges(patches)
    .map((badge) => ({ badge, tier: prestigeTier(badge.count) }))
    .sort((a, b) => b.tier.rank - a.tier.rank);
  if (!badges.length) return null;

  return (
    <ul aria-label="Earned trophies" className="flex shrink-0 items-center gap-0.5 min-[440px]:gap-1.5">
      {badges.map(({ badge, tier }, index) => {
        const art = PALETTES[tier.key];
        const filterId = "trophy-art-" + badge.code;
        return (
          <li key={badge.code} className={index === 0 ? "" : index < 3 ? "hidden min-[480px]:block" : "hidden min-[660px]:block"}>
            <Link
              href="/dashboard/crew-life#patches-title"
              aria-label={badge.name + ", rank " + tier.rank + " of " + PRESTIGE_TIERS.length}
              className="flex flex-col items-center gap-[3px] rounded-lg px-0.5 py-0.5 transition-transform hover:-translate-y-0.5 motion-reduce:transition-none"
            >
              <span aria-hidden className="grid size-8 place-items-center rounded-full border min-[660px]:size-9" style={{ backgroundColor: art.face, borderColor: art.rim }}>
                <svg viewBox={POSES[badge.code]} className="block size-[26px] overflow-hidden min-[660px]:size-[29px]">
                  <defs>
                    <filter id={filterId} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
                      {/* Fade the white sheet out before tinting the octopus. */}
                      <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -3 -3 -3 0 8.4" />
                      <feColorMatrix type="hueRotate" values={String(art.hue)} />
                    </filter>
                  </defs>
                  <image href="/brand/bleu-expressions.png" width="906" height="594" filter={"url(#" + filterId + ")"} />
                </svg>
              </span>
              <span aria-hidden className="flex gap-[2px]">
                {PRESTIGE_TIERS.map(({ rank }) => (
                  <span key={rank} className="size-[3px] rounded-full" style={{ backgroundColor: rank <= tier.rank ? art.rim : "#769ab8" }} />
                ))}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
