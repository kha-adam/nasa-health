import { useId } from "react";
import type { PatchCode } from "@/types/blue";
import { PRESTIGE_TIERS, prestigeTier } from "@/lib/crewLife";

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
  common: { hue: 15, face: "#eff8ff", rim: "#b8d6ee", marker: "#6b9fca" },
  rare: { hue: -48, face: "#e5faf0", rim: "#8edec6", marker: "#32977c" },
  epic: { hue: 76, face: "#f2edff", rim: "#c3b1ee", marker: "#8b66c5" },
  legendary: { hue: 145, face: "#fff0f3", rim: "#f2a8be", marker: "#c95a7c" },
  mythic: { hue: 218, face: "#fff5d6", rim: "#ffd978", marker: "#dbaa38" },
};

export default function PrestigeBadge({ code, count, size = 36 }: { code: PatchCode; count: number; size?: number }) {
  const filterId = useId();
  const tier = prestigeTier(count);
  const art = PALETTES[tier.key];
  const pip = size >= 60 ? 6 : size >= 40 ? 4 : 3;

  return (
    <span aria-hidden className="inline-flex flex-col items-center gap-[3px]">
      <span className="grid place-items-center rounded-full border" style={{ width: size, height: size, backgroundColor: art.face, borderColor: art.rim }}>
        <svg viewBox={POSES[code]} className="block size-4/5 overflow-hidden">
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
      <span className="flex" style={{ gap: pip - 1 }}>
        {PRESTIGE_TIERS.map(({ rank }) => (
          <span key={rank} className="rounded-full" style={{ width: pip, height: pip, backgroundColor: rank <= tier.rank ? art.marker : "#b8c7d5" }} />
        ))}
      </span>
    </span>
  );
}
