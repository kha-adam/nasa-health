"""Earth psychologist summary reports.

AGENTS.md Section 5 and Section 8. `build_report` turns a finished check-in
into a MentalHealthReport. Person 5 calls `next_turn` with finish_session
true and prepends `generated_report` onto the astronaut's mental_reports.

The report is queued for Earth. `earth_psychologist_directive` stays null
until the Earth-reply route reviews it. This module does not write
astronauts.json.

The same profile and transcript always produce the same report id.
"""

from __future__ import annotations

import hashlib
import re

from backend.schemas import (
    AstronautProfile,
    ChatMessage,
    MentalHealthReport,
    SessionMode,
)

_SLEEP = re.compile(
    r"can(?:not|'t) sleep|cannot sleep|couldn'?t sleep|insomnia|"
    r"waking up|woke up|poor sleep|bad sleep|fragmented sleep|broken sleep|"
    r"trouble sleeping|haven'?t slept|didn'?t sleep|not sleeping",
    re.IGNORECASE,
)
_FATIGUE = re.compile(r"fatigu|tired|exhausted|drained|worn out", re.IGNORECASE)
_ANXIETY = re.compile(r"anxious|anxiety|worried|on edge|nervous|panic", re.IGNORECASE)
_LIGHTHEADED = re.compile(r"light[-\s]?headed|dizzy", re.IGNORECASE)
_NUTRITION = re.compile(
    r"\b(meals?|eat|ate|eaten|eating|food|hungry|nutrition|skipped (?:a |the )?(?:meal|lunch|dinner|breakfast))\b",
    re.IGNORECASE,
)
_ISOLATION = re.compile(r"isolat|alone|lonely|out of sync|left out", re.IGNORECASE)
_WORKLOAD = re.compile(r"\b(work(?:load|ing)?|eva|airlock|shift|lab|tasks?)\b", re.IGNORECASE)


def build_report(
    profile: AstronautProfile,
    messages: list[ChatMessage],
    session_mode: SessionMode,
) -> MentalHealthReport:
    """Build a queued Earth summary from this session and the live vitals."""
    lines = _user_lines(messages)
    themes = _themes("\n".join(lines))
    return MentalHealthReport(
        id=_report_id(profile, messages),
        created_at=f"Mission Day {profile.mission_day}",
        session_mode=session_mode,
        headline=_headline(profile, session_mode, themes),
        summary=_summary(profile, lines, themes, session_mode),
        biometric_correlation=_biometric(profile, session_mode),
        earth_status="QUEUED_FOR_EARTH",
        earth_psychologist_directive=None,
    )


def _user_lines(messages: list[ChatMessage]) -> list[str]:
    return [message.content.strip() for message in messages if message.role == "user" and message.content.strip()]


def _report_id(profile: AstronautProfile, messages: list[ChatMessage]) -> str:
    transcript = "\n".join(f"{message.role}:{message.content.strip()}" for message in messages)
    digest = hashlib.sha256(f"{profile.id}|{profile.mission_day}|{transcript}".encode()).hexdigest()[:8]
    candidate = f"rep-d{profile.mission_day}-{digest}"
    existing = {report.id for report in profile.mental_reports}
    if candidate not in existing:
        return candidate
    suffix = 2
    while f"{candidate}-{suffix}" in existing:
        suffix += 1
    return f"{candidate}-{suffix}"


def _themes(text: str) -> list[str]:
    found: list[str] = []
    checks = (
        (_SLEEP, "fragmented sleep"),
        (_FATIGUE, "fatigue"),
        (_ANXIETY, "anxiety"),
        (_LIGHTHEADED, "lightheadedness"),
        (_NUTRITION, "nutrition timing"),
        (_ISOLATION, "isolation from the crew"),
        (_WORKLOAD, "workload strain"),
    )
    for pattern, label in checks:
        if pattern.search(text):
            found.append(label)
    return found


def _headline(profile: AstronautProfile, mode: SessionMode, themes: list[str]) -> str:
    if profile.id == "astro-chen":
        if "nutrition timing" in themes and ("fatigue" in themes or "lightheadedness" in themes):
            return "Post-Shift Fatigue and Nutritional Timing"
        if "lightheadedness" in themes:
            return "Lightheadedness with a Falling Glucose Trend"
        if "nutrition timing" in themes:
            return "Nutritional Timing Drift under Exertion"
        return "Physical Strain and Hypoglycemic Trend"
    if profile.id == "astro-lin":
        if "fragmented sleep" in themes and "isolation from the crew" in themes:
            return "Fragmented Sleep and Isolation Fatigue"
        if "fragmented sleep" in themes:
            return "Fragmented Sleep with Elevated Evening Cortisol"
        if "isolation from the crew" in themes:
            return "Isolation Fatigue and Elevated Cortisol"
        if "anxiety" in themes:
            return "Anxiety with Elevated Evening Cortisol"
        return "Elevated Evening Cortisol and Mood Load"
    if mode == "DEEP_SUPPORT":
        if "fragmented sleep" in themes:
            return "Sleep Strain on an Otherwise Nominal Day"
        if "anxiety" in themes:
            return "Anxiety Noted during a Nominal Vital Window"
        if "fatigue" in themes:
            return "Fatigue Reported against Nominal Vitals"
        return "Strain Reported during a Routine Check-In"
    return "Routine Check-In — Steady Energy and Crew Morale"


def _summary(
    profile: AstronautProfile,
    lines: list[str],
    themes: list[str],
    mode: SessionMode,
) -> str:
    if not lines:
        return _empty_summary(profile, mode)
    excerpt = _quote(lines[0])
    if themes:
        summary = f"Astronaut reported {_join(themes)}. In their words: {excerpt}"
    else:
        summary = f"Astronaut reported: {excerpt}"
    if len(lines) > 1 and lines[-1] != lines[0]:
        summary += f" Later in the session they added: {_quote(lines[-1])}"
    return summary


def _empty_summary(profile: AstronautProfile, mode: SessionMode) -> str:
    if profile.id == "astro-chen":
        return (
            "Astronaut ended the session before describing symptoms. "
            "The falling glucose and elevated heart rate remain the clinical context."
        )
    if profile.id == "astro-lin":
        return (
            "Astronaut ended the session before describing mood or sleep. "
            "Elevated evening cortisol remains the clinical context."
        )
    if mode == "DEEP_SUPPORT":
        return "Astronaut ended the session after strain was indicated, without further notes."
    return "Astronaut ended the check-in before adding personal notes. Vitals supported a routine filing."


def _biometric(profile: AstronautProfile, mode: SessionMode) -> str:
    vitals = profile.current_vitals
    low_glucose = vitals.blood_sugar_mg_dl < 72.0
    high_cortisol = vitals.cortisol_ug_dl > 16.0
    high_hr = vitals.heart_rate_bpm > 100.0
    if profile.id == "astro-chen" or low_glucose:
        return (
            f"{_glucose_phrase(profile)}, with heart rate at {_num(vitals.heart_rate_bpm)} BPM "
            f"and cortisol at {_num(vitals.cortisol_ug_dl)} μg/dL."
        )
    if profile.id == "astro-lin" or (high_cortisol and not low_glucose):
        return (
            f"Cortisol at {_num(vitals.cortisol_ug_dl)} μg/dL is above the evening band. "
            f"Heart rate {_num(vitals.heart_rate_bpm)} BPM and blood glucose "
            f"{_num(vitals.blood_sugar_mg_dl)} mg/dL remain in operational bounds."
        )
    if mode == "DEEP_SUPPORT" and high_hr:
        return (
            f"Heart rate at {_num(vitals.heart_rate_bpm)} BPM is above the nominal band, "
            f"with blood glucose {_num(vitals.blood_sugar_mg_dl)} mg/dL and cortisol "
            f"{_num(vitals.cortisol_ug_dl)} μg/dL."
        )
    return (
        f"Heart rate {_num(vitals.heart_rate_bpm)} BPM, blood glucose "
        f"{_num(vitals.blood_sugar_mg_dl)} mg/dL, blood pressure "
        f"{_num(vitals.systolic_bp)}/{_num(vitals.diastolic_bp)} mmHg, "
        f"SpO2 {_num(vitals.spo2_percent)}%, and cortisol {_num(vitals.cortisol_ug_dl)} μg/dL "
        f"remained nominal."
    )


def _glucose_phrase(profile: AstronautProfile) -> str:
    """Vitals history is chronological, oldest first, matching the frozen schema."""
    current = profile.current_vitals.blood_sugar_mg_dl
    history = profile.vitals_history
    if len(history) >= 2 and history[-1].blood_sugar_mg_dl < history[0].blood_sugar_mg_dl:
        start = _num(history[0].blood_sugar_mg_dl)
        end = _num(history[-1].blood_sugar_mg_dl)
        return f"Blood glucose dropped from {start} to {end} mg/dL"
    return f"Blood glucose at {_num(current)} mg/dL"


def _quote(text: str) -> str:
    cleaned = " ".join(text.split()).replace('"', "'").rstrip(".!? ")
    if len(cleaned) > 177:
        cleaned = cleaned[:177].rstrip() + "..."
    return f'"{cleaned}."'


def _join(themes: list[str]) -> str:
    if len(themes) == 1:
        return themes[0]
    if len(themes) == 2:
        return f"{themes[0]} and {themes[1]}"
    return ", ".join(themes[:-1]) + ", and " + themes[-1]


def _num(value: float) -> str:
    rounded = round(float(value), 1)
    if rounded == int(rounded):
        return str(int(rounded))
    return f"{rounded:.1f}"
