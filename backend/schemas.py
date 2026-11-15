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
- CheckinReward: ChatResponse.reward when a check-in (finish_session) is filed
- CrewLifeBoard: GET /api/crew-life and every POST /api/crew-life/* (astronaut
  only, always about the signed-in astronaut; the flight surgeon gets 403)
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

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
TitleCode = Literal["calm_keeper", "checkin_star", "station_voice", "sleep_captain", "crew_compass"]
PerkCode = Literal["station_playlist", "menu_meal", "wakeup_song", "quiet_hour", "sunday_activity"]
RitualKind = Literal["breathing", "stretch", "window", "music", "wind_down", "gratitude"]
PatchCode = Literal["calm_keeper", "checkin_star", "station_voice", "sleep_captain", "crew_compass", "crew_challenge"]


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


class SourceReference(FrozenModel):
    """Published NASA source cited by the enriched ASTRA dataset."""

    id: str  # e.g. "NTRS 20230003916"
    title: str
    url: str


class MetricReference(FrozenModel):
    """External population average drawn next to a metric: context, not an alert band."""

    label: str
    mean: float
    sd: float | None = None
    detail: str
    source: SourceReference


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
    reference: MetricReference | None = None


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
    sleep_7d_avg_h: float | None = None
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


class BaselineComparison(FrozenModel):
    """One reading of the last mission day against the astronaut's own previous 7 days."""

    metric: str  # catalog key
    field: str
    today: float | None  # last night's sleep, or the day's mean for continuous signals
    previous_7d_mean: float | None  # mean of the 7 mission days before (null until 7 exist)
    previous_7d_days: int
    delta: float | None  # today - previous_7d_mean, in the metric's unit
    delta_pct: float | None


class PersonalBaselines(FrozenModel):
    mission_day: int
    method: str
    items: list[BaselineComparison]
    references: list[SourceReference]


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
    baselines: PersonalBaselines | None = None
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
    # Random id the client draws for each BLUE conversation, so the crew-life
    # tally counts every message once however many times the transcript is sent.
    session_id: str | None = Field(default=None, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")


class CheckinReward(FrozenModel):
    """Small, immediate thank-you shown after each check-in with BLUE."""

    thank_you: str
    space_fact: str
    checkin_days: int  # distinct days with a check-in this mission week (today included)
    target_days: int
    streak_days: int  # consecutive mission days ending with today's check-in
    first_today: bool  # False when today's check-in was already counted
    challenge_completed: bool
    challenge_just_completed: bool  # this check-in completed the crew challenge
    stars: int  # stars on the mission map


class ChatResponse(FrozenModel):
    reply: str
    reply_source: Literal["groq", "offline"] | None = None
    session_mode: SessionMode
    suggested_to_wrap_up: bool
    generated_report: MentalHealthReport | None = None
    reward: CheckinReward | None = None


# --------------------------------------------------------------------------
# Crew life — weekly titles, crew challenge, rewards aboard, mission map
# --------------------------------------------------------------------------


class CrewMember(FrozenModel):
    id: AstronautId
    name: str
    role: str
    avatar_initials: str


class PerkStatus(FrozenModel):
    """Concrete reward aboard that the title holder chooses."""

    code: PerkCode
    label: str
    options: list[str]
    choice: str | None = None
    chosen_by: AstronautId | None = None


class TitleStanding(FrozenModel):
    code: TitleCode
    name: str
    criterion: str
    # Only the leaders are named — never a ranking, never other people's scores.
    holders: list[AstronautId]
    you_hold: bool
    your_value: str
    perk: PerkStatus


class RewardOption(FrozenModel):
    code: str
    label: str
    kind: Literal["film", "meal"]


class ChallengeStatus(FrozenModel):
    week: int
    start_day: int
    end_day: int
    label: str
    target_days: int
    your_days: list[int]
    crew_size: int
    crew_on_target: int  # how many crew members reached the target (anonymous)
    days_left: int
    completed: bool
    reward_options: list[RewardOption]
    vote_counts: dict[str, int]
    your_vote: str | None = None
    reward_choice: str | None = None


class MissionWeek(FrozenModel):
    week: int
    start_day: int
    end_day: int
    completed: bool
    current: bool


class Patch(FrozenModel):
    code: PatchCode
    name: str
    week: int
    current: bool = False  # held this week; awarded when the week closes


class RitualOption(FrozenModel):
    kind: RitualKind
    label: str
    minutes: int


class Encouragement(FrozenModel):
    id: str
    from_id: AstronautId
    to_id: AstronautId
    mission_day: int
    message: str


class CrewLifeBoard(FrozenModel):
    astronaut_id: AstronautId
    mission_day: int
    streak_days: int
    week: int
    week_start_day: int
    week_end_day: int
    crew: list[CrewMember]
    titles: list[TitleStanding]
    challenge: ChallengeStatus
    mission_map: list[MissionWeek]
    stars: int
    patches: list[Patch]
    ritual_options: list[RitualOption]
    rituals_today: list[RitualKind]
    rituals_week: int
    max_rituals_per_day: int
    encouragements_received: list[Encouragement]
    encouragements_sent: list[Encouragement]
    max_encouragements_per_day: int
    share_in_titles: bool


class RitualRequest(FrozenModel):
    kind: RitualKind


class EncouragementRequest(FrozenModel):
    to_id: AstronautId
    message: str = Field(min_length=1, max_length=140)


class ChoiceRequest(FrozenModel):
    option: str = Field(min_length=1, max_length=80)


class PreferencesRequest(FrozenModel):
    share_in_titles: bool


class BlueActivityRequest(FrozenModel):
    """Message count of a BLUE conversation closed without filing a report."""

    astronaut_id: AstronautId
    session_id: str = Field(max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    user_messages: int = Field(ge=0, le=500)
