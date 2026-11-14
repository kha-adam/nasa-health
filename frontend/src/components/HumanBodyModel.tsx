"use client";

import { useState } from "react";
import Link from "next/link";
import { Brain, ChevronRight, HeartPulse, Wind, Zap } from "lucide-react";
import type { AstronautProfile, BodyHighlight, BodyZone, StatusTag } from "@/types/blue";
import { STATUS_STYLES, metricHref, type PanelMode } from "@/lib/metrics";
import StatusBadge from "./StatusBadge";

interface Props {
  profile: AstronautProfile;
  panel: PanelMode;
  asSurgeon: boolean;
}

const RANK: Record<StatusTag, number> = { NOMINAL: 0, ADVISORY: 1, URGENT: 2 };

const VIEW_H = 440;

const ZONES: Record<
  BodyZone,
  { label: string; marker: [number, number]; side: "left" | "right"; icon: typeof Brain; panels: PanelMode[] }
> = {
  brain: { label: "Neuro / Stress", marker: [100, 36], side: "right", icon: Brain, panels: ["mental"] },
  lungs: { label: "Respiratory", marker: [80, 136], side: "left", icon: Wind, panels: ["physical"] },
  heart: { label: "Cardiovascular", marker: [106, 148], side: "right", icon: HeartPulse, panels: ["physical", "mental"] },
  metabolic: { label: "Metabolic", marker: [100, 196], side: "left", icon: Zap, panels: ["physical"] },
};

// Vertical callout anchor (% of model height) per zone, chosen to avoid overlaps.
const CALLOUT_TOP: Record<BodyZone, number> = { brain: 4, lungs: 24, heart: 32, metabolic: 44 };

const BODY_PATH =
  "M 90 72 C 90 82, 88 86, 80 89 C 66 93, 54 96, 49 108 C 44 122, 42 150, 38 178 C 35 200, 30 225, 28 248 " +
  "C 27 258, 30 266, 36 264 C 41 262, 41 252, 42 244 C 45 222, 50 200, 54 180 C 57 165, 60 150, 62 138 " +
  "C 64 160, 66 190, 68 214 C 69 232, 64 246, 64 262 C 64 300, 70 345, 74 380 C 76 398, 74 412, 72 422 " +
  "C 70 430, 88 432, 90 424 C 90 400, 92 360, 94 330 C 96 305, 98 290, 100 282 C 102 290, 104 305, 106 330 " +
  "C 108 360, 110 400, 110 424 C 112 432, 130 430, 128 422 C 126 412, 124 398, 126 380 C 130 345, 136 300, 136 262 " +
  "C 136 246, 131 232, 132 214 C 134 190, 136 160, 138 138 C 140 150, 143 165, 146 180 C 150 200, 155 222, 158 244 " +
  "C 159 252, 159 262, 164 264 C 170 266, 173 258, 172 248 C 170 225, 165 200, 162 178 C 158 150, 156 122, 151 108 " +
  "C 146 96, 134 93, 120 89 C 112 86, 110 82, 110 72 Z";

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

export default function HumanBodyModel({ profile, panel, asSurgeon }: Props) {
  const [selected, setSelected] = useState<BodyZone | null>(null);
  const highlights = profile.body_highlights[panel];
  // Several findings can share a zone: keep them all, most severe first.
  const grouped = new Map<BodyZone, BodyHighlight[]>();
  for (const h of highlights) grouped.set(h.zone, [...(grouped.get(h.zone) ?? []), h]);
  for (const list of grouped.values()) list.sort((a, b) => RANK[b.severity] - RANK[a.severity]);
  const byZone = new Map<BodyZone, BodyHighlight>([...grouped].map(([z, list]) => [z, list[0]]));
  const activeZones = (Object.keys(ZONES) as BodyZone[]).filter(
    (z) => ZONES[z].panels.includes(panel) || byZone.has(z),
  );

  const severityOf = (zone: BodyZone): StatusTag | null => byZone.get(zone)?.severity ?? null;

  return (
    <section className="card relative flex min-h-0 flex-col overflow-hidden p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">Body Systems Model</h2>
          <p className="text-[11px] text-ink-soft">
            {panel === "physical" ? "Heart, lungs & metabolism" : "Stress & recovery"}
          </p>
        </div>
        <div className="flex gap-1.5">
          {(["NOMINAL", "ADVISORY", "URGENT"] as StatusTag[]).map((s) => (
            <span key={s} className="flex items-center gap-1 text-[10px] text-ink-soft">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_STYLES[s].hex }} />
              {s.toLowerCase()}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mt-2 min-h-0 flex-1">
        {/* soft radial backdrop */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#E0F2FE_0%,transparent_60%)]" />

        <svg
          viewBox={`0 0 200 ${VIEW_H}`}
          className="relative mx-auto block h-full max-w-full"
          role="img"
          aria-label={`Anatomical model of ${profile.name}`}
        >
          <defs>
            <linearGradient id="body-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E0F2FE" />
              <stop offset="100%" stopColor="#FFFFFF" />
            </linearGradient>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#DBEAFE" strokeWidth="0.4" />
            </pattern>
            <clipPath id="body-clip">
              <path d={BODY_PATH} />
              <ellipse cx="100" cy="42" rx="26" ry="31" />
            </clipPath>
          </defs>

          <ellipse cx="100" cy="432" rx="52" ry="6" fill="#BAE6FD" opacity="0.45" />

          {/* Layer 1: silhouette */}
          <g>
            <path d={BODY_PATH} fill="url(#body-fill)" stroke="#7DD3FC" strokeWidth="1.4" />
            <ellipse cx="100" cy="42" rx="26" ry="31" fill="url(#body-fill)" stroke="#7DD3FC" strokeWidth="1.4" />
            <rect width="200" height={VIEW_H} fill="url(#grid)" clipPath="url(#body-clip)" opacity="0.7" />
            {/* spine & center line */}
            <path d="M 100 76 L 100 270" stroke="#BAE6FD" strokeWidth="0.8" strokeDasharray="2 3" />
          </g>

          {/* Layer 2: organs */}
          {(Object.keys(ORGAN_PATHS) as BodyZone[]).map((zone) => {
            const sev = severityOf(zone);
            const active = activeZones.includes(zone);
            const color = sev ? STATUS_STYLES[sev].hex : "#38BDF8";
            return (
              <g
                key={zone}
                className="cursor-pointer transition-opacity duration-300"
                opacity={active ? 1 : 0.28}
                onClick={() => setSelected(selected === zone ? null : zone)}
              >
                {ORGAN_PATHS[zone].map((d, i) => (
                  <path
                    key={i}
                    d={d}
                    fill={color}
                    fillOpacity={sev && sev !== "NOMINAL" ? 0.32 : 0.14}
                    stroke={color}
                    strokeWidth={selected === zone ? 1.8 : 1}
                  />
                ))}
                {zone === "brain" && (
                  <path
                    d="M 100 23 C 97 32, 103 40, 99 51 M 88 32 C 92 35, 92 41, 87 45 M 112 32 C 108 35, 108 41, 113 45"
                    fill="none"
                    stroke={color}
                    strokeWidth="0.7"
                    opacity="0.6"
                  />
                )}
              </g>
            );
          })}

          {/* Layer 3: markers */}
          {activeZones.map((zone) => {
            const [x, y] = ZONES[zone].marker;
            const sev = severityOf(zone) ?? "NOMINAL";
            const color = STATUS_STYLES[sev].hex;
            const alert = sev !== "NOMINAL";
            return (
              <g
                key={zone}
                className="cursor-pointer"
                onClick={() => setSelected(selected === zone ? null : zone)}
                role="button"
                aria-label={`${ZONES[zone].label} marker`}
              >
                {alert && <circle cx={x} cy={y} r="7" fill={color} opacity="0.5" className="marker-pulse" />}
                <circle cx={x} cy={y} r="5" fill="#FFFFFF" stroke={color} strokeWidth="2" />
                <circle cx={x} cy={y} r="2.2" fill={color} />
              </g>
            );
          })}
        </svg>

        {/* Layer 4: callout cards — alerts always, nominal zones only when selected */}
        {activeZones.map((zone) => {
          const meta = ZONES[zone];
          const list = grouped.get(zone) ?? [];
          const h = list[0];
          const Icon = meta.icon;
          const isSelected = selected === zone;
          const alert = h && h.severity !== "NOMINAL";
          if (!alert && !isSelected) return null;
          return (
            <div
              key={zone}
              className={`absolute w-[38%] max-w-[230px] rounded-xl border bg-white/95 p-2.5 text-left shadow-card backdrop-blur transition ${
                isSelected ? "z-10 border-sky ring-2 ring-tint-strong" : "border-line hover:border-tint-strong"
              }`}
              style={{ top: `${CALLOUT_TOP[zone]}%`, [meta.side]: 0 }}
            >
              <button className="block w-full text-left" onClick={() => setSelected(isSelected ? null : zone)}>
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-sky">
                    <Icon className="h-3 w-3" /> {meta.label}
                  </span>
                  {h && <StatusBadge status={h.severity} />}
                </div>
                <p className="mt-1 text-xs font-semibold leading-tight text-ink">
                  {h?.label ?? "Within normal range"}
                  {!isSelected && list.length > 1 && <span className="font-normal text-ink-soft"> +{list.length - 1}</span>}
                </p>
              </button>
              {isSelected && (
                <div className="mt-1 space-y-1.5">
                  {(list.length ? list : [null]).map((item, i) => (
                    <div key={i} className="text-[11px] leading-snug text-ink-soft">
                      {i > 0 && item && <p className="font-semibold text-ink">{item.label}</p>}
                      <p>{item?.detail ?? "No anomalies detected for this system."}</p>
                      {item?.metric && (
                        <Link
                          href={metricHref(item.metric, profile.id, asSurgeon)}
                          className="mt-0.5 inline-flex items-center gap-0.5 font-semibold text-sky hover:text-sky-hover"
                        >
                          View chart <ChevronRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-1 text-center text-[10px] text-ink-soft">Tap a marker for details</p>
    </section>
  );
}
