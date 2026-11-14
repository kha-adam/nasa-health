import type { CurrentVitals, StatusTag } from "@/types/blue";

/** Display thresholds for dashboard status badges. */
export function heartRateStatus(bpm: number): StatusTag {
  if (bpm < 40 || bpm > 120) return "URGENT";
  if (bpm < 50 || bpm > 90) return "ADVISORY";
  return "NOMINAL";
}

export function bloodSugarStatus(mg: number): StatusTag {
  if (mg < 54 || mg > 250) return "URGENT";
  if (mg < 72 || mg > 140) return "ADVISORY";
  return "NOMINAL";
}

export function bloodPressureStatus(sys: number, dia: number): StatusTag {
  if (sys >= 160 || dia >= 100 || sys < 85) return "URGENT";
  if (sys >= 130 || dia >= 80 || sys < 95) return "ADVISORY";
  return "NOMINAL";
}

export function spo2Status(pct: number): StatusTag {
  if (pct < 90) return "URGENT";
  if (pct < 95) return "ADVISORY";
  return "NOMINAL";
}

export function cortisolStatus(ug: number): StatusTag {
  if (ug > 30) return "URGENT";
  if (ug > 16) return "ADVISORY";
  return "NOMINAL";
}

export function vitalsStatuses(v: CurrentVitals) {
  return {
    heart: heartRateStatus(v.heart_rate_bpm),
    sugar: bloodSugarStatus(v.blood_sugar_mg_dl),
    bp: bloodPressureStatus(v.systolic_bp, v.diastolic_bp),
    spo2: spo2Status(v.spo2_percent),
    cortisol: cortisolStatus(v.cortisol_ug_dl),
  };
}

export const STATUS_STYLES: Record<StatusTag, { text: string; bg: string; ring: string; hex: string }> = {
  NOMINAL: { text: "text-nominal", bg: "bg-teal-50", ring: "ring-teal-200", hex: "#0D9488" },
  ADVISORY: { text: "text-advisory", bg: "bg-amber-50", ring: "ring-amber-200", hex: "#D97706" },
  URGENT: { text: "text-urgent", bg: "bg-red-50", ring: "ring-red-200", hex: "#DC2626" },
};

export const EARTH_DELAY = "20m 42s";
