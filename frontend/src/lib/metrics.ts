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
import type { CurrentVitals, HistoryRange, MetricDefinition, StatusTag, Thresholds } from "@/types/blue";

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

export const STATUS_STYLES: Record<StatusTag, { text: string; bg: string; ring: string; hex: string; label: string }> = {
  NOMINAL: { text: "text-nominal", bg: "bg-teal-50", ring: "ring-teal-200", hex: "#0D9488", label: "Normal" },
  ADVISORY: { text: "text-advisory", bg: "bg-amber-50", ring: "ring-amber-200", hex: "#D97706", label: "Watch" },
  URGENT: { text: "text-urgent", bg: "bg-red-50", ring: "ring-red-200", hex: "#DC2626", label: "Urgent" },
};

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

export function dashboardHref(astronautId: string, asSurgeon: boolean): string {
  return asSurgeon ? `/dashboard?id=${astronautId}` : "/dashboard";
}

export function metricHref(metricKey: string, astronautId: string, asSurgeon: boolean): string {
  return `/dashboard/metrics/${metricKey}${asSurgeon ? `?id=${astronautId}` : ""}`;
}
