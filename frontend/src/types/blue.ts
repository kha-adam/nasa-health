/**
 * Frozen TypeScript mirror of backend/schemas.py.
 *
 * AGENTS.md Section 8. Do not rename keys or add fields without team approval.
 *
 * Route mapping:
 * - AstronautProfile: GET /api/astronauts and GET /api/astronauts/{id}
 * - ChatRequest / ChatResponse: POST /api/chat
 * - When finish_session is true, generated_report is a MentalHealthReport
 *   with earth_status "QUEUED_FOR_EARTH" and earth_psychologist_directive null.
 * - POST /api/astronauts/{id}/reports/{report_id}/earth-reply returns the
 *   updated MentalHealthReport (earth_status "REVIEWED_BY_EARTH").
 */

export type AstronautId = "astro-vance" | "astro-chen" | "astro-lin";

export type StatusTag = "NOMINAL" | "ADVISORY" | "URGENT";

export type SessionMode = "BRIEF_CHECKIN" | "DEEP_SUPPORT";

export type EarthStatus = "QUEUED_FOR_EARTH" | "REVIEWED_BY_EARTH";

export type BodyZone = "brain" | "heart" | "lungs" | "metabolic";

export type ChatRole = "user" | "assistant";

export interface CurrentVitals {
  heart_rate_bpm: number;
  blood_sugar_mg_dl: number;
  systolic_bp: number;
  diastolic_bp: number;
  spo2_percent: number;
  cortisol_ug_dl: number;
}

export interface VitalsHistoryPoint {
  time: string;
  heart_rate_bpm: number;
  blood_sugar_mg_dl: number;
  cortisol_ug_dl: number;
}

export interface BodyHighlight {
  zone: BodyZone;
  label: string;
  severity: StatusTag;
  detail: string;
}

export interface BodyHighlights {
  physical: BodyHighlight[];
  mental: BodyHighlight[];
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
  current_vitals: CurrentVitals;
  vitals_history: VitalsHistoryPoint[];
  body_highlights: BodyHighlights;
  mental_reports: MentalHealthReport[];
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
