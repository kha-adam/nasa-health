"use client";

import { useRef, useState } from "react";
import { List, PersonStanding } from "lucide-react";
import type { AstronautProfile, BodyHighlight, BodyZone, StatusTag } from "@/types/blue";
import { STATUS_RANK, STATUS_STYLES } from "@/lib/metrics";
import { StatusGlyph } from "./StatusBadge";
import BodyIllustration from "./BodyIllustration";

interface Props {
  profile: AstronautProfile;
  selected: BodyZone | null;
  onSelect: (zone: BodyZone | null) => void;
}

/** Physical zones, with a marker position, a depth (for the turntable) and a label side. */
export const ZONES: Record<
  BodyZone,
  { name: string; system: string; marker: [number, number]; depth: number; side: "left" | "right" }
> = {
  brain: { name: "Head", system: "Neurological", marker: [100, 36], depth: 0, side: "right" },
  lungs: { name: "Lungs", system: "Respiratory", marker: [80, 136], depth: -4, side: "left" },
  heart: { name: "Heart", system: "Cardiovascular", marker: [106, 148], depth: 10, side: "right" },
  metabolic: { name: "Metabolism", system: "Metabolic", marker: [100, 196], depth: 8, side: "left" },
};

const PHYSICAL_ZONES: BodyZone[] = ["lungs", "heart", "metabolic"];
const FULL_TURN = 360;

const ORGAN_PATHS: Record<BodyZone, string[]> = {
  brain: [
    "M 100 21 C 86 19, 80 30, 82 40 C 83 50, 92 54, 100 53 C 108 54, 117 50, 118 40 C 120 30, 114 19, 100 21 Z",
  ],
  lungs: [
    "M 96 108 C 84 106, 74 120, 72 140 C 70 160, 74 172, 86 170 C 94 168, 96 160, 96 150 Z",
    "M 104 108 C 116 106, 126 120, 128 140 C 130 160, 126 172, 114 170 C 106 168, 104 160, 104 150 Z",
  ],
  heart: [
    "M 105 141 C 101 135, 93 138, 95 146 C 97 153, 104 158, 107 161 C 111 156, 117 150, 116 144 C 115 137, 108 136, 105 141 Z",
  ],
  metabolic: [
    "M 72 180 C 84 174, 98 177, 97 187 C 94 197, 81 199, 72 193 Z",
    "M 100 180 C 114 176, 126 184, 124 197 C 122 209, 108 213, 101 207 C 94 201, 92 186, 100 180 Z",
  ],
};

/** Physical findings grouped by zone, most severe first. */
export function groupByZone(highlights: BodyHighlight[]): Map<BodyZone, BodyHighlight[]> {
  const grouped = new Map<BodyZone, BodyHighlight[]>();
  for (const h of highlights) grouped.set(h.zone, [...(grouped.get(h.zone) ?? []), h]);
  for (const list of grouped.values()) list.sort((a, b) => STATUS_RANK[b.severity] - STATUS_RANK[a.severity]);
  return grouped;
}

/**
 * Centre column (physical panel): a shaded SVG illustration with front, side and back
 * views (drag, slider or arrow keys). Only zones that need
 * attention carry a label. Selecting a zone shows its observations in the right column.
 * A list view gives the same information without the model.
 */
export default function HumanBodyModel({ profile, selected, onSelect }: Props) {
  const [view, setView] = useState<"model" | "list">("model");
  const [angle, setAngle] = useState(0);
  const [focused, setFocused] = useState<BodyZone | null>(null);
  const drag = useRef<{ id: number; x: number; start: number; moved: boolean } | null>(null);

  const grouped = groupByZone(profile.body_highlights.physical);
  const zones = (Object.keys(ZONES) as BodyZone[]).filter((z) => PHYSICAL_ZONES.includes(z) || grouped.has(z));
  const severityOf = (z: BodyZone): StatusTag => grouped.get(z)?.[0]?.severity ?? "NOMINAL";
  const toggle = (z: BodyZone) => onSelect(selected === z ? null : z);

  const rad = (angle * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const facing = c < -0.32 ? "Back" : c > 0.32 ? "Front" : angle <= 180 ? "Right side" : "Left side";
  const turn = (depth: number) => `translate(${100 + depth * s} 0) scale(${c} 1) translate(-100 0)`;
  const markerX = (z: BodyZone) => 100 + (ZONES[z].marker[0] - 100) * c + ZONES[z].depth * s;
  const wrap = (degrees: number) => ((Math.round(degrees) % FULL_TURN) + FULL_TURN) % FULL_TURN;

  return (
    <section aria-labelledby="body-title" className="card flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
        <h2 id="body-title" className="min-w-0 text-[17px] font-medium text-ink">
          Body <span className="hidden text-[15px] font-normal text-ink-faint xl:inline">· physical observations</span>
        </h2>
        <div role="radiogroup" aria-label="Body view" className="seg">
          {(
            [
              ["model", "Model", PersonStanding],
              ["list", "List", List],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              role="radio"
              aria-checked={view === key}
              onClick={() => setView(key)}
              className="seg-option px-3 py-1 text-xs"
            >
              <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
            </button>
          ))}
        </div>
      </header>

      {view === "list" ? (
        <ul className="thin-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-2.5 pb-3 pt-1">
          {zones.map((z) => {
            const sev = severityOf(z);
            return (
              <li key={z}>
                <button
                  onClick={() => toggle(z)}
                  aria-pressed={selected === z}
                  className={`flex w-full items-start gap-3 rounded-[18px] px-4 py-3 text-left transition ${
                    selected === z ? "bg-tint ring-1 ring-inset ring-sky/30" : "hover:bg-raised"
                  }`}
                >
                  <span className="mt-1.5">
                    <StatusGlyph status={sev} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-ink">{ZONES[z].name}</span>
                      <span className={`text-[12px] font-semibold ${STATUS_STYLES[sev].text}`}>
                        {STATUS_STYLES[sev].label}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[13px] text-ink-soft">Select to review this area</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
          <div
            className="relative min-h-0 flex-1 touch-none select-none bg-[radial-gradient(55%_48%_at_50%_46%,#e6f3ff_0%,rgb(255_255_255/0)_72%)]"
            onPointerDown={(e) => {
              if (!e.isPrimary || e.button !== 0) return;
              drag.current = { id: e.pointerId, x: e.clientX, start: angle, moved: false };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d || e.pointerId !== d.id || !e.buttons) return;
              const dx = e.clientX - d.x;
              if (!d.moved && Math.abs(dx) > 4) {
                d.moved = true;
                e.currentTarget.setPointerCapture(e.pointerId);
              }
              if (d.moved) setAngle(wrap(d.start + dx));
            }}
            onPointerUp={(e) => {
              const active = drag.current;
              if (active?.id === e.pointerId) {
                setTimeout(() => { if (drag.current === active) drag.current = null; }, 0);
              }
            }}
            onPointerCancel={() => { drag.current = null; }}
          >
            <svg
              viewBox="-80 4 360 444"
              className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
              role="group"
              aria-label={`Body model of ${profile.name}. ${zones.length} zones; select one to see its observations.`}
            >
              {[60, 140, 220, 300, 380].map((y) => (
                <g key={y} stroke="#C9D8E5">
                  <line x1="-76" x2="-68" y1={y} y2={y} />
                  <line x1="268" x2="276" y1={y} y2={y} />
                </g>
              ))}

              <BodyIllustration cosine={c} sine={s} />
              {/* organs */}
              {c > 0.16 && zones.map((z) => {
                const sev = severityOf(z);
                const alert = sev !== "NOMINAL";
                const color = alert ? STATUS_STYLES[sev].hex : "#245BCB";
                return (
                  <g key={z} transform={turn(ZONES[z].depth)} opacity={Math.min(1, (c - 0.16) * 2)} onClick={() => !drag.current?.moved && toggle(z)} className="cursor-pointer">
                    {ORGAN_PATHS[z].map((d, i) => (
                      <path
                        key={i}
                        d={d}
                        fill={color}
                        fillOpacity={alert ? 0.2 : selected === z ? 0.16 : 0.07}
                        stroke={color}
                        strokeOpacity={alert || selected === z ? 0.9 : 0.4}
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </g>
                );
              })}

              {/* labels for zones that need attention (or the selected one) */}
              {zones.map((z) => {
                const sev = severityOf(z);
                if (sev === "NOMINAL" && selected !== z) return null;
                const meta = ZONES[z];
                const x = markerX(z);
                const y = meta.marker[1];
                const left = meta.side === "left";
                const edge = left ? -8 : 208;
                const color = sev === "NOMINAL" ? "#245BCB" : STATUS_STYLES[sev].hex;
                return (
                  <g key={`label-${z}`} aria-hidden>
                    <polyline
                      points={`${x + (left ? -8 : 8)},${y} ${left ? 40 : 160},${y} ${edge + (left ? 4 : -4)},${y}`}
                      fill="none"
                      stroke={color}
                      strokeOpacity="0.6"
                      strokeWidth="0.8"
                      vectorEffect="non-scaling-stroke"
                    />
                    <text
                      x={edge}
                      y={y - 3}
                      textAnchor={left ? "end" : "start"}
                      className="fill-ink"
                      style={{ font: "600 11px var(--font-display)", letterSpacing: "-0.01em" }}
                    >
                      {meta.name}
                    </text>
                    <text
                      x={edge}
                      y={y + 10}
                      textAnchor={left ? "end" : "start"}
                      fill="currentColor"
                      className={sev === "NOMINAL" ? "text-sky" : STATUS_STYLES[sev].text}
                      style={{ font: "600 9.5px var(--font-sans)" }}
                    >
                      {STATUS_STYLES[sev].label}
                    </text>
                  </g>
                );
              })}

              {/* markers */}
              {zones.map((z) => {
                const sev = severityOf(z);
                const color = STATUS_STYLES[sev].hex;
                const x = markerX(z);
                const y = ZONES[z].marker[1];
                return (
                  <g
                    key={`marker-${z}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selected === z}
                    aria-label={`${ZONES[z].name}: ${STATUS_STYLES[sev].label}. Select to review this area.`}
                    className="cursor-pointer outline-none"
                    onClick={() => !drag.current?.moved && toggle(z)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(z);
                      }
                    }}
                    onFocus={() => setFocused(z)}
                    onBlur={() => setFocused(null)}
                  >
                    <circle cx={x} cy={y} r="14" fill="transparent" />
                    {sev !== "NOMINAL" && <circle cx={x} cy={y} r="8.5" fill="none" stroke={color} strokeOpacity="0.5" />}
                    {(selected === z || focused === z) && (
                      <circle
                        cx={x}
                        cy={y}
                        r="11.5"
                        fill="none"
                        stroke="#245BCB"
                        strokeWidth="1.4"
                        strokeDasharray={focused === z && selected !== z ? "2 2" : undefined}
                      />
                    )}
                    <circle cx={x} cy={y} r="4.6" fill="#FFFFFF" stroke={color} strokeWidth="1.8" />
                    <circle cx={x} cy={y} r="1.9" fill={color} />
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="mx-auto flex w-full max-w-[370px] items-center gap-2 pt-1 sm:gap-3">
            <span className="eyebrow w-14">{facing}</span>
            <div className="relative flex-1">
              <input
                type="range"
                min={0}
                max={FULL_TURN}
                step={1}
                value={angle}
                onChange={(e) => setAngle(Number(e.target.value))}
                aria-label="Rotate the body model"
                aria-valuetext={`${angle} degrees, ${facing.toLowerCase()} view`}
                className="ruler w-full"
              />
              <div className="num pointer-events-none flex justify-between px-[3px] text-[9px] text-ink-faint" aria-hidden>
                {[0, 90, 180, 270, 360].map((d) => (
                  <span key={d}>{d}°</span>
                ))}
              </div>
            </div>
            <button
              onClick={() => setAngle(0)}
              disabled={angle === 0 || angle === FULL_TURN}
              className="btn-ghost num w-14 justify-center py-1 text-[11px] text-ink-soft"
              aria-label="Reset rotation"
            >
              {angle}°
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
