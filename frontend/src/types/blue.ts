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
 * - CheckinReward: ChatResponse.reward when a check-in (finish_session) is filed
 * - CrewLifeBoard: GET /api/crew-life and every POST /api/crew-life/* (astronaut only)
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
export type TitleCode = "calm_keeper" | "checkin_star" | "station_voice" | "sleep_captain" | "crew_compass";
export type PerkCode = "station_playlist" | "menu_meal" | "wakeup_song" | "quiet_hour" | "sunday_activity";
export type RitualKind = "breathing" | "stretch" | "window" | "music" | "wind_down" | "gratitude";
export type PatchCode = TitleCode | "crew_challenge";

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

/** Published NASA source cited by the enriched ASTRA dataset. */
export interface SourceReference {
  id: string;
  title: string;
  url: string;
}

/** External population average drawn next to a metric: context, not an alert band. */
export interface MetricReference {
  label: string;
  mean: number;
  sd: number | null;
  detail: string;
  source: SourceReference;
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
  reference: MetricReference | null;
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
  sleep_7d_avg_h: number | null;
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

/** One reading of the last mission day against the astronaut's own previous 7 days. */
export interface BaselineComparison {
  metric: string;
  field: string;
  today: number | null;
  previous_7d_mean: number | null;
  previous_7d_days: number;
  delta: number | null;
  delta_pct: number | null;
}

export interface PersonalBaselines {
  mission_day: number;
  method: string;
  items: BaselineComparison[];
  references: SourceReference[];
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
  baselines: PersonalBaselines | null;
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
  /** Random id per BLUE conversation, so the crew-life tally counts each message once. */
  session_id?: string | null;
}

/** Small, immediate thank-you shown after each check-in with BLUE. */
export interface CheckinReward {
  thank_you: string;
  space_fact: string;
  checkin_days: number;
  target_days: number;
  streak_days: number;
  first_today: boolean;
  challenge_completed: boolean;
  challenge_just_completed: boolean;
  stars: number;
}

export interface ChatResponse {
  reply: string;
  reply_source?: "groq" | "offline" | null;
  session_mode: SessionMode;
  suggested_to_wrap_up: boolean;
  generated_report: MentalHealthReport | null;
  reward: CheckinReward | null;
}

// --------------------------------------------------------------------------
// Crew life — weekly titles, crew challenge, rewards aboard, mission map
// --------------------------------------------------------------------------

export interface CrewMember {
  id: AstronautId;
  name: string;
  role: string;
  avatar_initials: string;
}

export interface PerkStatus {
  code: PerkCode;
  label: string;
  options: string[];
  choice: string | null;
  chosen_by: AstronautId | null;
}

export interface TitleStanding {
  code: TitleCode;
  name: string;
  criterion: string;
  /** Only the leaders are named: never a ranking, never other people's scores. */
  holders: AstronautId[];
  you_hold: boolean;
  your_value: string;
  perk: PerkStatus;
}

export interface RewardOption {
  code: string;
  label: string;
  kind: "film" | "meal";
}

export interface ChallengeStatus {
  week: number;
  start_day: number;
  end_day: number;
  label: string;
  target_days: number;
  your_days: number[];
  crew_size: number;
  crew_on_target: number;
  days_left: number;
  completed: boolean;
  reward_options: RewardOption[];
  vote_counts: Record<string, number>;
  your_vote: string | null;
  reward_choice: string | null;
}

export interface MissionWeek {
  week: number;
  start_day: number;
  end_day: number;
  completed: boolean;
  current: boolean;
}

export interface Patch {
  code: PatchCode;
  name: string;
  week: number;
  current: boolean;
}

export interface RitualOption {
  kind: RitualKind;
  label: string;
  minutes: number;
}

export interface Encouragement {
  id: string;
  from_id: AstronautId;
  to_id: AstronautId;
  mission_day: number;
  message: string;
}

export interface CrewLifeBoard {
  astronaut_id: AstronautId;
  mission_day: number;
  streak_days: number;
  week: number;
  week_start_day: number;
  week_end_day: number;
  crew: CrewMember[];
  titles: TitleStanding[];
  challenge: ChallengeStatus;
  mission_map: MissionWeek[];
  stars: number;
  patches: Patch[];
  ritual_options: RitualOption[];
  rituals_today: RitualKind[];
  rituals_week: number;
  max_rituals_per_day: number;
  encouragements_received: Encouragement[];
  encouragements_sent: Encouragement[];
  max_encouragements_per_day: number;
  share_in_titles: boolean;
}
