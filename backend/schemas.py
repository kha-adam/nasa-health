"""Frozen Pydantic contracts for Project BLUE.

Mirrors AGENTS.md Section 8 and frontend/src/types/blue.ts.
Do not rename keys, add fields, or loosen these shapes without team approval.

Route mapping:
- AstronautProfile: GET /api/astronauts and GET /api/astronauts/{id}
- ChatRequest / ChatResponse: POST /api/chat
- MentalHealthReport: generated_report when finish_session is true
  (earth_status QUEUED_FOR_EARTH; directive stays null until Earth replies)
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


class FrozenModel(BaseModel):
    """Reject unknown keys so parallel agents cannot drift the contract."""

    model_config = ConfigDict(extra="forbid")


class CurrentVitals(FrozenModel):
    heart_rate_bpm: float
    blood_sugar_mg_dl: float
    systolic_bp: float
    diastolic_bp: float
    spo2_percent: float
    cortisol_ug_dl: float


class VitalsHistoryPoint(FrozenModel):
    time: str
    heart_rate_bpm: float
    blood_sugar_mg_dl: float
    cortisol_ug_dl: float


class BodyHighlight(FrozenModel):
    zone: BodyZone
    label: str
    severity: StatusTag
    detail: str


class BodyHighlights(FrozenModel):
    physical: list[BodyHighlight]
    mental: list[BodyHighlight]


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
    current_vitals: CurrentVitals
    vitals_history: list[VitalsHistoryPoint]
    body_highlights: BodyHighlights
    mental_reports: list[MentalHealthReport]


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
