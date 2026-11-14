/**
 * TypeScript mirror of backend/schemas.py — keep both files in sync.
 *
 * Route mapping:
 * - SessionUser: POST /api/auth/login, GET /api/auth/me
 * - AstronautProfile: GET /api/astronauts and GET /api/astronauts/{id}
 *   (flight surgeons get a redacted copy: mental_redacted = true)
 * - MetricDefinition[]: GET /api/metrics
 * - MetricHistory: GET /api/astronauts/{id}/metrics/{metric}?range=24h|7d|30d|all
 * - ChatRequest / ChatResponse: POST /api/chat (astronaut only)
 * - POST /api/astronauts/{id}/reports/{report_id}/earth-reply -> MentalHealthReport
 */

export type AstronautId = "astro-vance" | "astro-chen" | "astro-lin";
export type StatusTag = "NOMINAL" | "ADVISORY" | "URGENT";
export type SessionMode = "BRIEF_CHECKIN" | "DEEP_SUPPORT";
export type EarthStatus = "QUEUED_FOR_EARTH" | "REVIEWED_BY_EARTH";
export type BodyZone = "brain" | "heart" | "lungs" | "metabolic";
export type ChatRole = "user" | "assistant";
export type UserRole = "astronaut" | "flight_surgeon";
export type MetricCategory = "physical" | "mental" | "environment";
export type MetricCadence = "continuous" | "daily" | "weekly";
export type HistoryRange = "24h" | "7d" | "30d" | "all";
export type Resolution = "15min" | "hourly" | "daily";
export type EventScope = "crew" | "cabin";

export interface SessionUser {
  username: string;
  display_name: string;
  role: UserRole;
  astronaut_id: AstronautId | null;
}

export interface Thresholds {
  advisory_low: number | null;
  advisory_high: number | null;
  urgent_low: number | null;
  urgent_high: number | null;
}

export interface MetricSeries {
  field: string;
  label: string;
  thresholds: Thresholds | null;
}

export interface MetricDefinition {
  key: string;
  label: string;
  unit: string;
  category: MetricCategory;
  private: boolean;
  cadence: MetricCadence;
  decimals: number;
  description: string;
  series: MetricSeries[];
}

export interface CurrentVitals {
  heart_rate_bpm: number | null;
  hr_webcam_bpm: number | null;
  hrv_rmssd_ms: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  spo2_percent: number | null;
  resp_rate_bpm: number | null;
  core_temp_c: number | null;
  blood_sugar_mg_dl: number | null;
  voice_stress_index: number | null;
  speech_rate_wpm: number | null;
  blink_rate_per_min: number | null;
  cortisol_nmol_l: number | null;
  sleep_hours: number | null;
  sleep_efficiency_pct: number | null;
  sleep_awakenings: number | null;
  body_mass_kg: number | null;
  radiation_cum_msv: number | null;
  cabin_co2_mmhg: number | null;
  cabin_ppo2_kpa: number | null;
  cabin_pressure_kpa: number | null;
  cabin_temp_c: number | null;
  cabin_humidity_pct: number | null;
  noise_dba: number | null;
  light_lux: number | null;
  light_cct_k: number | null;
  radiation_rate_usv_h: number | null;
  earth_delay_min: number | null;
}

export interface BodyHighlight {
  zone: BodyZone;
  label: string;
  severity: StatusTag;
  detail: string;
  metric: string | null;
}

export interface BodyHighlights {
  physical: BodyHighlight[];
  mental: BodyHighlight[];
}

export interface MissionEvent {
  id: string;
  code: string;
  scope: EventScope;
  severity: StatusTag;
  label: string;
  detail: string;
  mission_day: number;
  start: string;
  end: string | null;
  metrics: string[];
}

export interface MentalHealthReport {
  id: string;
  created_at: string;
  session_mode: SessionMode;
  headline: string;
  summary: string;
  biometric_correlation: string;
  earth_status: EarthStatus;
  earth_psychologist_directive: string | null;
}

export interface AstronautProfile {
  id: AstronautId;
  name: string;
  role: string;
  mission_day: number;
  avatar_initials: string;
  status_tag: StatusTag;
  status_summary: string;
  last_reading_at: string;
  last_activity: string;
  current_vitals: CurrentVitals;
  metric_status: Record<string, StatusTag>;
  body_highlights: BodyHighlights;
  events: MissionEvent[];
  mental_reports: MentalHealthReport[];
  mental_redacted: boolean;
}

export interface HistoryPoint {
  t: string;
  mission_day: number;
  activity: string | null;
  values: Record<string, number | null>;
  low: Record<string, number | null> | null;
  high: Record<string, number | null> | null;
}

export interface SeriesStats {
  field: string;
  min: number | null;
  max: number | null;
  avg: number | null;
  last: number | null;
  pct_nominal: number | null;
}

export interface MetricHistory {
  astronaut_id: AstronautId;
  metric: MetricDefinition;
  range: HistoryRange;
  resolution: Resolution;
  points: HistoryPoint[];
  stats: SeriesStats[];
  events: MissionEvent[];
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  astronaut_id: AstronautId;
  messages: ChatMessage[];
  finish_session: boolean;
}

export interface ChatResponse {
  reply: string;
  session_mode: SessionMode;
  suggested_to_wrap_up: boolean;
  generated_report: MentalHealthReport | null;
}
