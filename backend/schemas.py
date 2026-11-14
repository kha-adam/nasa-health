"""Pydantic contracts for Project BLUE.

Mirrors AGENTS.md Section 8 and frontend/src/types/blue.ts. Keep both files in
sync: unknown keys are rejected so the two sides cannot silently drift.

Route mapping:
- SessionUser: POST /api/auth/login, GET /api/auth/me
- AstronautProfile: GET /api/astronauts and GET /api/astronauts/{id}
  (flight surgeons receive a redacted copy: mental_redacted=True, no mental
  reports, no mental highlights, private metric values set to null)
- MetricDefinition: GET /api/metrics
- MetricHistory: GET /api/astronauts/{id}/metrics/{metric}?range=24h|7d|30d|all
- ChatRequest / ChatResponse: POST /api/chat (astronaut only, own profile)
- MentalHealthReport: generated_report when finish_session is true
- POST /api/astronauts/{id}/reports/{report_id}/earth-reply returns the
  updated MentalHealthReport (earth_status REVIEWED_BY_EARTH)
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict

AstronautId = Literal["astro-vance", "astro-chen", "astro-lin"]
StatusTag = Literal["NOMINAL", "ADVISORY", "URGENT"]
SessionMode = Literal["BRIEF_CHECKIN", "DEEP_SUPPORT"]
EarthStatus = Literal["QUEUED_FOR_EARTH", "REVIEWED_BY_EARTH"]
BodyZone = Literal["brain", "heart", "lungs", "metabolic"]
ChatRole = Literal["user", "assistant"]
UserRole = Literal["astronaut", "flight_surgeon"]
MetricCategory = Literal["physical", "mental", "environment"]
MetricCadence = Literal["continuous", "daily", "weekly"]
HistoryRange = Literal["24h", "7d", "30d", "all"]
Resolution = Literal["15min", "hourly", "daily"]
EventScope = Literal["crew", "cabin"]


class FrozenModel(BaseModel):
    """Reject unknown keys so parallel agents cannot drift the contract."""

    model_config = ConfigDict(extra="forbid")


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------


class LoginRequest(FrozenModel):
    username: str
    password: str


class SessionUser(FrozenModel):
    username: str
    display_name: str
    role: UserRole
    astronaut_id: AstronautId | None = None


# --------------------------------------------------------------------------
# Metric catalog
# --------------------------------------------------------------------------


class Thresholds(FrozenModel):
    advisory_low: float | None = None
    advisory_high: float | None = None
    urgent_low: float | None = None
    urgent_high: float | None = None


class MetricSeries(FrozenModel):
    field: str
    label: str
    thresholds: Thresholds | None = None


class MetricDefinition(FrozenModel):
    key: str
    label: str
    unit: str
    category: MetricCategory
    private: bool = False
    cadence: MetricCadence = "continuous"
    decimals: int = 0
    description: str
    series: list[MetricSeries]


# --------------------------------------------------------------------------
# Astronaut profile
# --------------------------------------------------------------------------


class CurrentVitals(FrozenModel):
    """Latest value of every telemetry field (null when not yet sampled)."""

    heart_rate_bpm: float | None = None
    hr_webcam_bpm: float | None = None
    hrv_rmssd_ms: float | None = None
    systolic_bp: float | None = None
    diastolic_bp: float | None = None
    spo2_percent: float | None = None
    resp_rate_bpm: float | None = None
    core_temp_c: float | None = None
    blood_sugar_mg_dl: float | None = None
    voice_stress_index: float | None = None
    speech_rate_wpm: float | None = None
    blink_rate_per_min: float | None = None
    cortisol_nmol_l: float | None = None
    sleep_hours: float | None = None
    sleep_efficiency_pct: float | None = None
    sleep_awakenings: float | None = None
    body_mass_kg: float | None = None
    radiation_cum_msv: float | None = None
    cabin_co2_mmhg: float | None = None
    cabin_ppo2_kpa: float | None = None
    cabin_pressure_kpa: float | None = None
    cabin_temp_c: float | None = None
    cabin_humidity_pct: float | None = None
    noise_dba: float | None = None
    light_lux: float | None = None
    light_cct_k: float | None = None
    radiation_rate_usv_h: float | None = None
    earth_delay_min: float | None = None


class BodyHighlight(FrozenModel):
    zone: BodyZone
    label: str
    severity: StatusTag
    detail: str
    metric: str | None = None


class BodyHighlights(FrozenModel):
    physical: list[BodyHighlight]
    mental: list[BodyHighlight]


class MissionEvent(FrozenModel):
    id: str
    code: str
    scope: EventScope
    severity: StatusTag
    label: str
    detail: str
    mission_day: int
    start: str
    end: str | None = None
    metrics: list[str]


class MentalHealthReport(FrozenModel):
    id: str
    created_at: str
    session_mode: SessionMode
    headline: str
    summary: str
    biometric_correlation: str
    earth_status: EarthStatus
    earth_psychologist_directive: str | None = None


class AstronautProfile(FrozenModel):
    id: AstronautId
    name: str
    role: str
    mission_day: int
    avatar_initials: str
    status_tag: StatusTag
    status_summary: str
    last_reading_at: str
    last_activity: str
    current_vitals: CurrentVitals
    metric_status: dict[str, StatusTag]
    body_highlights: BodyHighlights
    events: list[MissionEvent]
    mental_reports: list[MentalHealthReport]
    mental_redacted: bool = False


# --------------------------------------------------------------------------
# Metric history (detail pages)
# --------------------------------------------------------------------------


class HistoryPoint(FrozenModel):
    t: str
    mission_day: int
    activity: str | None = None
    values: dict[str, float | None]
    low: dict[str, float | None] | None = None
    high: dict[str, float | None] | None = None


class SeriesStats(FrozenModel):
    field: str
    min: float | None
    max: float | None
    avg: float | None
    last: float | None
    pct_nominal: float | None


class MetricHistory(FrozenModel):
    astronaut_id: AstronautId
    metric: MetricDefinition
    range: HistoryRange
    resolution: Resolution
    points: list[HistoryPoint]
    stats: list[SeriesStats]
    events: list[MissionEvent]


# --------------------------------------------------------------------------
# BLUE conversation
# --------------------------------------------------------------------------


class ChatMessage(FrozenModel):
    role: ChatRole
    content: str


class ChatRequest(FrozenModel):
    astronaut_id: AstronautId
    messages: list[ChatMessage]
    finish_session: bool = False


class ChatResponse(FrozenModel):
    reply: str
    session_mode: SessionMode
    suggested_to_wrap_up: bool
    generated_report: MentalHealthReport | None = None
