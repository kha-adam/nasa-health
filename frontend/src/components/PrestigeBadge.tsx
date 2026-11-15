import { useId, type ReactElement, type SVGProps } from "react";
import { AudioLines, Feather, Moon } from "lucide-react";
import type { PatchCode } from "@/types/blue";
import { prestigeTier, type PrestigeTierKey } from "@/lib/crewLife";

/**
 * Prestige emblem, styled after shooter-game prestige badges.
 *
 * Every badge shares one premium body: a gunmetal face inside a polished
 * chrome rim. What changes is the rarity, coded by the colour of the glowing
 * lines inlaid in the metal (white → blue → purple → red → yellow, from most
 * common to rarest) and repeated in the medallion ring, the glyph, the halo and
 * the pips under the emblem. Rarer tiers get more flourish: sparkles from Epic,
 * light rays and a moving reflection from Legendary. The silhouette (wings,
 * star, blades, crown, compass rose, crew shield) identifies the badge kind and
 * never changes. Pips repeat the rank so rarity never relies on colour alone.
 */

interface Rarity {
  line: string; // inlay colour
  light: string; // glyph and sparkles
  glow: string; // halo
}

const RARITY: Record<PrestigeTierKey, Rarity> = {
  common: { line: "#ffffff", light: "#ffffff", glow: "#dce8ff" },
  rare: { line: "#3fb6ff", light: "#b7e6ff", glow: "#1e8cff" },
  epic: { line: "#b46cff", light: "#e7d1ff", glow: "#8f3dff" },
  legendary: { line: "#ff3b30", light: "#ffc2b8", glow: "#ff1a0d" },
  mythic: { line: "#ffcc1f", light: "#fff3b0", glow: "#ffae00" },
};

type Part = ReactElement<SVGProps<SVGElement>>;

function polygon(points: [number, number][]): string {
  return `M${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join("L")}Z`;
}

function radial(cx: number, cy: number, radii: number[], startDeg = -90): string {
  const step = 360 / radii.length;
  return polygon(
    radii.map((r, i) => {
      const a = ((startDeg + i * step) * Math.PI) / 180;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    }),
  );
}

/** Straight grooves from radius r0 to r1 at the given angles (degrees). */
function spokes(cx: number, cy: number, r0: number, r1: number, angles: number[]): string {
  return angles
    .map((deg) => {
      const a = (deg * Math.PI) / 180;
      const p = (r: number) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
      return `M${p(r0)}L${p(r1)}`;
    })
    .join("");
}

/** Four-point twinkle. */
function sparkle(x: number, y: number, r: number): string {
  return `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z`;
}

const WING =
  "M26 24 C19 18 10 14 2 12.5 C4 18 7 21 11 23 C7 23.5 4.5 25 3 27.5 C7.5 29.5 11.5 30 15 30 C12 31.5 10 33.5 9 36.5 C14 37.5 19.5 37 25 35 Z";
const WING_GROOVES = "M23.5 25.5 C17 21 10.5 17.5 5 15.5 M22 29.5 C16.5 27.5 11 26.5 6 27 M21.5 33.5 C17.5 33.5 14 34 11 35.5";
const SHIELD = "M8 6 H24 L32 11 L40 6 H56 V28 C56 42 45.5 50.5 32 57 C18.5 50.5 8 42 8 28 Z";
const SHIELD_INLAY = "M11.5 9.5 H24.6 L32 14 L39.4 9.5 H52.5 V28 C52.5 40.2 43.6 47.8 32 53.3 C20.4 47.8 11.5 40.2 11.5 28 Z";
const INNER_SHIELD = "M15 13 H25.5 L32 17 L38.5 13 H49 V28 C49 38.5 41.5 45 32 49.5 C22.5 45 15 38.5 15 28 Z";

interface Emblem {
  /** Silhouette, back to front. */
  body: Part[];
  /** Grooves inlaid in the metal (stroked with the rarity colour, clipped to the body). */
  inlay: Part[];
  /** Medallion holding the glyph. */
  field: Part[];
  glyph: (color: string) => Part;
}

const EMBLEMS: Record<PatchCode, Emblem> = {
  // Keeper of Calm: spread wings around a calm medallion.
  calm_keeper: {
    body: [<path key="l" d={WING} />, <path key="r" d={WING} transform="matrix(-1 0 0 1 64 0)" />, <circle key="c" cx={32} cy={30} r={14.5} />],
    inlay: [
      <path key="gl" d={WING_GROOVES} />,
      <path key="gr" d={WING_GROOVES} transform="matrix(-1 0 0 1 64 0)" />,
      <circle key="ring" cx={32} cy={30} r={12.6} />,
    ],
    field: [<circle key="f" cx={32} cy={30} r={10.5} />],
    glyph: (c) => <Feather x={25} y={23} size={14} color={c} strokeWidth={2.2} aria-hidden />,
  },
  // Check-in Star: a five-point star with a check mark at its heart.
  checkin_star: {
    body: [<path key="s" d={radial(32, 31, [27, 11.5, 27, 11.5, 27, 11.5, 27, 11.5, 27, 11.5])} />],
    inlay: [
      <path key="inner" d={radial(32, 31, [19.5, 8.3, 19.5, 8.3, 19.5, 8.3, 19.5, 8.3, 19.5, 8.3])} />,
      <path key="ridges" d={spokes(32, 31, 10.5, 23.5, [-90, -18, 54, 126, 198])} />,
    ],
    field: [<circle key="f" cx={32} cy={31.5} r={8.5} />],
    glyph: (c) => <path d="M27.8 31.8 L30.9 34.8 L36.4 28.6" fill="none" stroke={c} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />,
  },
  // Voice of the Station: a diamond flanked by two blades.
  station_voice: {
    body: [
      <path key="l" d="M15 21 L0.5 30 L15 39 Z" />,
      <path key="r" d="M49 21 L63.5 30 L49 39 Z" />,
      <path key="d" d="M32 2.5 L55 30 L32 57.5 L9 30 Z" />,
    ],
    inlay: [
      <path key="inner" d="M32 9 L49.5 30 L32 51 L14.5 30 Z" />,
      <path key="blades" d="M12.5 30 L3.5 30 M51.5 30 L60.5 30" />,
      <path key="ticks" d="M32 13.5 L32 18 M32 42 L32 46.5" />,
    ],
    field: [<circle key="f" cx={32} cy={30} r={11} />],
    glyph: (c) => <AudioLines x={25} y={23} size={14} color={c} strokeWidth={2.4} aria-hidden />,
  },
  // Sleep Captain: a crowned seal with a crescent moon.
  sleep_captain: {
    body: [
      <path key="crown" d="M14.5 24 L17 6.5 L24.5 15 L32 3 L39.5 15 L47 6.5 L49.5 24 Z" />,
      <circle key="j1" cx={17} cy={6.5} r={2.6} />,
      <circle key="j2" cx={32} cy={3} r={2.6} />,
      <circle key="j3" cx={47} cy={6.5} r={2.6} />,
      <circle key="c" cx={32} cy={35} r={20} />,
    ],
    inlay: [
      <path key="peaks" d="M17.5 10 L18.6 18.5 M32 7 L32 14 M46.5 10 L45.4 18.5" />,
      <circle key="ring" cx={32} cy={35} r={16.3} />,
    ],
    field: [<circle key="f" cx={32} cy={35} r={12.5} />],
    glyph: (c) => <Moon x={24.5} y={27.5} size={15} color={c} strokeWidth={2.2} aria-hidden />,
  },
  // Crew Compass: an eight-point compass rose on a ring.
  crew_compass: {
    body: [
      <circle key="ring" cx={32} cy={30} r={18} />,
      <path key="rose" d={radial(32, 30, [26, 7, 15, 7, 26, 7, 15, 7, 26, 7, 15, 7, 26, 7, 15, 7])} />,
    ],
    inlay: [
      <circle key="ring" cx={32} cy={30} r={14.8} />,
      <path key="ridges" d={spokes(32, 30, 18.5, 24, [-90, 0, 90, 180])} />,
    ],
    field: [<circle key="f" cx={32} cy={30} r={8.5} />],
    glyph: (c) => (
      <g>
        <path d="M32 22.5 L34.8 30 H29.2 Z" fill={c} />
        <path d="M32 37.5 L34.8 30 H29.2 Z" fill={c} opacity={0.45} />
        <circle cx={32} cy={30} r={1.3} fill={c} />
      </g>
    ),
  },
  // Crew Challenge: the crew shield, three stars over a rank chevron.
  crew_challenge: {
    body: [<path key="s" d={SHIELD} />],
    inlay: [<path key="inner" d={SHIELD_INLAY} />],
    field: [<path key="f" d={INNER_SHIELD} />],
    glyph: (c) => (
      <g fill={c}>
        <path d={radial(22.5, 26, [4.4, 1.8, 4.4, 1.8, 4.4, 1.8, 4.4, 1.8, 4.4, 1.8])} />
        <path d={radial(32, 23, [5.2, 2.1, 5.2, 2.1, 5.2, 2.1, 5.2, 2.1, 5.2, 2.1])} />
        <path d={radial(41.5, 26, [4.4, 1.8, 4.4, 1.8, 4.4, 1.8, 4.4, 1.8, 4.4, 1.8])} />
        <path d="M22 34 L32 39.5 L42 34 V38.4 L32 44 L22 38.4 Z" />
      </g>
    ),
  },
};

const RAYS = Array.from({ length: 16 }, (_, i) => {
  const a = ((i * 360) / 16 - 90) * (Math.PI / 180);
  const w = 0.09;
  const p = (r: number, da: number) => `${(32 + r * Math.cos(a + da)).toFixed(2)},${(30 + r * Math.sin(a + da)).toFixed(2)}`;
  return `M${p(6, -w)}L${p(i % 2 ? 31 : 37, 0)}L${p(6, w)}Z`;
}).join("");

const SPARKLES: [number, number, number, number][] = [
  // x, y, radius, animation delay (s)
  [55, 9, 3.4, 0],
  [8.5, 49, 2.6, 0.8],
  [57.5, 46, 2.2, 1.5],
  [7, 8, 2.4, 2.1],
];

export default function PrestigeBadge({
  code,
  count,
  size = 44,
  label,
}: {
  code: PatchCode;
  count: number;
  /** Rendered height in px (the emblem is slightly narrower than tall). */
  size?: number;
  /** Accessible name; omit when a parent already labels the badge. */
  label?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const tier = prestigeTier(count);
  const rar = RARITY[tier.key];
  const emblem = EMBLEMS[code];
  const id = (k: string) => `${uid}-${k}`;
  const url = (k: string) => `url(#${id(k)})`;
  const rank = tier.rank;
  const sparkles = rank >= 5 ? SPARKLES : rank >= 3 ? SPARKLES.slice(0, 2) : [];
  const pipStart = 32 - ((rank - 1) * 6.4) / 2;

  const width = (size * 64) / 70;
  return (
    <span className="relative inline-flex shrink-0" style={{ width, height: size }}>
    {/* Static emblem: metal, glowing inlays, halo, medallion. Its filters are drawn once. */}
    <svg
      viewBox="0 0 64 70"
      width={width}
      height={size}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="shrink-0 overflow-visible"
    >
      <defs>
        {/* Gunmetal face, polished chrome rim, dark medallion. */}
        <linearGradient id={id("face")} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#7d8796" />
          <stop offset="0.38" stopColor="#323a45" />
          <stop offset="0.72" stopColor="#161b22" />
          <stop offset="1" stopColor="#07090c" />
        </linearGradient>
        <linearGradient id={id("chrome")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.22" stopColor="#aeb8c4" />
          <stop offset="0.45" stopColor="#4a525d" />
          <stop offset="0.62" stopColor="#e9edf2" />
          <stop offset="0.82" stopColor="#6c7581" />
          <stop offset="1" stopColor="#c9d0d8" />
        </linearGradient>
        <radialGradient id={id("field")} cx="0.42" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#2a323d" />
          <stop offset="0.65" stopColor="#0d1116" />
          <stop offset="1" stopColor="#030405" />
        </radialGradient>
        <radialGradient id={id("rays")} cx="0.5" cy="0.43" r="0.5">
          <stop offset="0.15" stopColor={rar.glow} stopOpacity="0.85" />
          <stop offset="1" stopColor={rar.glow} stopOpacity="0" />
        </radialGradient>
        <filter id={id("glow")} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="0.9" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={id("halo")} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={2 + rank * 0.55} />
        </filter>
        <clipPath id={id("clip")}>{emblem.body}</clipPath>
      </defs>

      {/* Legendary and up: light rays behind the emblem. */}
      {rank >= 4 && <path d={RAYS} fill={url("rays")} opacity={rank >= 5 ? 0.95 : 0.7} />}

      {/* Halo in the rarity colour. */}
      <g fill={rar.glow} filter={url("halo")} opacity={0.3 + rank * 0.1}>
        {emblem.body}
      </g>

      {/* Body: cast shadow, gunmetal face, chrome rim. */}
      <g fill="#000000" opacity={0.5} transform="translate(0 1.6)">
        {emblem.body}
      </g>
      <g fill={url("face")} stroke={url("chrome")} strokeWidth={2.4} strokeLinejoin="round">
        {emblem.body}
      </g>

      <g clipPath={url("clip")}>
        {/* Static sheen across the metal. */}
        <path d="M-6 31 L33 -8 L41 -8 L2 31 Z" fill="#ffffff" opacity={0.16} />
        {/* Inlaid lines: an engraved groove, then the glowing rarity line inside it. */}
        <g fill="none" stroke="#000000" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" opacity={0.55}>
          {emblem.inlay}
        </g>
        <g fill="none" stroke={rar.line} strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" filter={url("glow")}>
          {emblem.inlay}
        </g>
      </g>

      {/* Medallion: dark field, glowing rarity ring, glowing glyph. */}
      <g fill={url("field")} stroke={rar.line} strokeWidth={1.4} filter={url("glow")}>
        {emblem.field}
      </g>
      <g filter={url("glow")}>{emblem.glyph(rar.light)}</g>

      {/* Rank pips: one per rarity tier reached. */}
      {Array.from({ length: rank }, (_, i) => {
        const x = pipStart + i * 6.4;
        return (
          <path
            key={i}
            d={`M${x} 61.4 L${x + 2.4} 64.4 L${x} 67.4 L${x - 2.4} 64.4 Z`}
            fill={rar.line}
            stroke="#0b0e12"
            strokeWidth={0.8}
            filter={url("glow")}
          />
        );
      })}
    </svg>

    {/*
      Moving effects (Epic+: twinkles, Legendary+: sweeping reflection) are plain HTML
      elements animated with transform and opacity only. The compositor (GPU) moves them
      without redrawing anything, and the filtered emblem underneath is never repainted.
    */}
    {rank >= 4 && (
      <span aria-hidden className="prestige-sweep-clip">
        <span className="prestige-sweep-band" />
      </span>
    )}
    {sparkles.map(([x, y, r, delay]) => (
      <span
        key={`${x}-${y}`}
        aria-hidden
        className="prestige-spark"
        style={{
          left: `${(x / 64) * 100}%`,
          top: `${(y / 70) * 100}%`,
          width: `${((r * 4.4) / 64) * 100}%`,
          animationDelay: `${delay}s`,
          background: `radial-gradient(circle, ${rar.light} 0%, ${rar.glow}99 32%, transparent 70%)`,
        }}
      >
        <svg viewBox="-1 -1 2 2" className="block h-full w-full overflow-visible">
          <path d={sparkle(0, 0, 0.46)} fill={rar.light} />
        </svg>
      </span>
    ))}
    </span>
  );
}
