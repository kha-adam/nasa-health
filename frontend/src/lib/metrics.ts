import {
  Activity,
  AudioLines,
  BedDouble,
  Brain,
  Droplet,
  Eye,
  Gauge,
  HeartPulse,
  Lightbulb,
  Moon,
  Radiation,
  Radio,
  Scale,
  Sun,
  Thermometer,
  Volume2,
  Waves,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type {
  AstronautProfile,
  BodyHighlight,
  CurrentVitals,
  HistoryRange,
  MetricDefinition,
  MissionEvent,
  StatusTag,
  Thresholds,
} from "@/types/blue";

export type PanelMode = "physical" | "mental";

/** The few readings the dashboard shows up front; everything else lives on detail pages. */
export const PRIMARY_METRICS: Record<PanelMode, string[]> = {
  physical: ["heart_rate", "blood_pressure", "spo2", "glucose", "cortisol"],
  mental: ["voice_stress", "sleep_duration", "hrv", "cortisol", "speech_rate"],
};

export const METRIC_ICONS: Record<string, LucideIcon> = {
  heart_rate: HeartPulse,
  blood_pressure: Activity,
  spo2: Wind,
  glucose: Droplet,
  respiration: Waves,
  core_temp: Thermometer,
  hrv: HeartPulse,
  cortisol: Brain,
  sleep_duration: Moon,
  sleep_efficiency: BedDouble,
  sleep_awakenings: BedDouble,
  body_mass: Scale,
  voice_stress: AudioLines,
  speech_rate: AudioLines,
  blink_rate: Eye,
  cabin_co2: Wind,
  cabin_o2: Wind,
  cabin_pressure: Gauge,
  cabin_temp: Thermometer,
  cabin_humidity: Droplet,
  noise: Volume2,
  light: Lightbulb,
  light_color: Sun,
  radiation_rate: Radiation,
  radiation_total: Radiation,
  earth_delay: Radio,
};

export const CATEGORY_LABELS: Record<MetricDefinition["category"], string> = {
  physical: "Body",
  mental: "Mind & behaviour",
  environment: "Cabin environment",
};

export const STATUS_STYLES: Record<
  StatusTag,
  { text: string; bg: string; ring: string; border: string; hex: string; label: string }
> = {
  NOMINAL: {
    text: "text-nominal",
    bg: "bg-nominal/10",
    ring: "ring-nominal/30",
    border: "border-nominal",
    hex: "#3CC8AE",
    label: "Normal",
  },
  ADVISORY: {
    text: "text-advisory",
    bg: "bg-advisory/10",
    ring: "ring-advisory/35",
    border: "border-advisory",
    hex: "#EDB04F",
    label: "Watch",
  },
  URGENT: {
    text: "text-urgent",
    bg: "bg-urgent/10",
    ring: "ring-urgent/40",
    border: "border-urgent",
    hex: "#FC3D21",
    label: "Urgent",
  },
};

/** Where a value comes from: measured, sampled, computed, or told by the astronaut. */
export type SourceKind = "sensor" | "sample" | "computed" | "declared";

export const SOURCE_LABELS: Record<SourceKind, string> = {
  sensor: "Sensor",
  sample: "Lab sample",
  computed: "Computed",
  declared: "Self-reported",
};

const METRIC_SOURCES: Record<string, { kind: SourceKind; origin: string }> = {
  heart_rate: { kind: "sensor", origin: "Chest strap" },
  blood_pressure: { kind: "sensor", origin: "Pressure cuff" },
  spo2: { kind: "sensor", origin: "Pulse oximeter" },
  glucose: { kind: "sensor", origin: "Glucose monitor" },
  respiration: { kind: "sensor", origin: "Chest strap" },
  core_temp: { kind: "sensor", origin: "Ingestible / patch sensor" },
  hrv: { kind: "computed", origin: "Heartbeat intervals" },
  cortisol: { kind: "sample", origin: "Saliva, 06:30 daily" },
  sleep_duration: { kind: "sensor", origin: "Sleep wearable" },
  sleep_efficiency: { kind: "computed", origin: "Sleep wearable" },
  sleep_awakenings: { kind: "sensor", origin: "Sleep wearable" },
  body_mass: { kind: "sensor", origin: "Weekly mass measurement" },
  voice_stress: { kind: "computed", origin: "Voice analysis during comms" },
  speech_rate: { kind: "computed", origin: "Voice analysis during comms" },
  blink_rate: { kind: "computed", origin: "Workstation camera" },
};

export function metricSource(key: string | null | undefined): { kind: SourceKind; origin: string } {
  return (key && METRIC_SOURCES[key]) || { kind: "sensor", origin: "Habitat sensor" };
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Headline value of a metric: BP shows "sys/dia", others their first series. */
export function metricValue(metric: MetricDefinition, vitals: CurrentVitals): string {
  const v = vitals as unknown as Record<string, number | null>;
  if (metric.key === "blood_pressure") {
    return `${formatNumber(v.systolic_bp)}/${formatNumber(v.diastolic_bp)}`;
  }
  return formatNumber(v[metric.series[0].field], metric.decimals);
}

export function formatDelay(minutes: number | null): string {
  if (minutes == null) return "—";
  const m = Math.floor(minutes);
  return `${m}m ${String(Math.round((minutes - m) * 60)).padStart(2, "0")}s`;
}

/** Mission time label, e.g. "Day 148 · 14:15 UTC". */
export function missionTime(iso: string, day: number, withTime = true): string {
  const hhmm = iso.slice(11, 16);
  return withTime ? `Day ${day} · ${hhmm} UTC` : `Day ${day}`;
}

export function defaultRange(metric: MetricDefinition): HistoryRange {
  return metric.cadence === "continuous" ? "7d" : "30d";
}

/** Human-readable normal range of a series, e.g. "40–110" or "≥ 95". */
export function normalRange(t: Thresholds | null): string | null {
  if (!t) return null;
  const lo = t.advisory_low;
  const hi = t.advisory_high;
  if (lo != null && hi != null) return `${lo}–${hi}`;
  if (lo != null) return `≥ ${lo}`;
  if (hi != null) return `≤ ${hi}`;
  return null;
}

export interface OutOfRange {
  direction: "high" | "low";
  /** Normal range of the series that is out of band, e.g. "≤ 19". */
  normal: string | null;
}

/** Whether the current value of a metric sits above or below its normal band (first offending series). */
export function outOfRange(metric: MetricDefinition, vitals: CurrentVitals): OutOfRange | null {
  const v = vitals as unknown as Record<string, number | null>;
  for (const s of metric.series) {
    const t = s.thresholds;
    const value = v[s.field];
    if (!t || value == null) continue;
    if (t.advisory_low != null && value < t.advisory_low) return { direction: "low", normal: normalRange(t) };
    if (t.advisory_high != null && value > t.advisory_high) return { direction: "high", normal: normalRange(t) };
  }
  return null;
}

export const STATUS_RANK: Record<StatusTag, number> = { NOMINAL: 0, ADVISORY: 1, URGENT: 2 };

/** Personal (non-cabin) metrics currently outside their normal band, most severe first. */
export function alertMetrics(
  catalog: MetricDefinition[],
  status: Record<string, StatusTag>,
): MetricDefinition[] {
  return catalog
    .filter((m) => m.category !== "environment" && (status[m.key] ?? "NOMINAL") !== "NOMINAL")
    .sort((a, b) => STATUS_RANK[status[b.key]] - STATUS_RANK[status[a.key]]);
}

export function dashboardHref(astronautId: string, asSurgeon: boolean): string {
  return asSurgeon ? `/dashboard?id=${astronautId}` : "/dashboard";
}

export function metricHref(metricKey: string, astronautId: string, asSurgeon: boolean): string {
  return `/dashboard/metrics/${metricKey}${asSurgeon ? `?id=${astronautId}` : ""}`;
}

/** Mission event linked to an observation's metric, if any (most severe first). */
export function relatedEvent(
  events: MissionEvent[],
  metric: string | null,
): MissionEvent | null {
  if (!metric) return null;
  const linked = events.filter((e) => e.metrics.includes(metric) && e.severity !== "NOMINAL");
  linked.sort((a, b) => STATUS_RANK[b.severity] - STATUS_RANK[a.severity] || b.mission_day - a.mission_day);
  return linked[0] ?? null;
}

/** When an observation was made: its linked event's start, else the latest reading. */
export function observationTime(profile: AstronautProfile, h: BodyHighlight): string {
  const e = h.severity !== "NOMINAL" ? relatedEvent(profile.events, h.metric) : null;
  return e ? missionTime(e.start, e.mission_day) : `Latest · ${missionTime(profile.last_reading_at, profile.mission_day)}`;
}

/** Ask the BLUE log (VoicePsychologistFab) to open, from anywhere on the page. */
export const OPEN_LOG_EVENT = "blue:open-log";
export function openLog() {
  window.dispatchEvent(new Event(OPEN_LOG_EVENT));
}
