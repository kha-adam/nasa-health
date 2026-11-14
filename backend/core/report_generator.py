"""Synthesizes a BLUE conversation + vitals into an Earth summary report.

Deterministic templates tailored to the three canonical profiles, enriched
with themes and a short quote extracted from the astronaut's own words.
"""

from __future__ import annotations

import uuid

from core.psychologist import (
    MAX_CORTISOL,
    MAX_HEART_RATE,
    MIN_BLOOD_SUGAR,
    detect_themes,
    user_text,
)
from schemas import AstronautProfile, ChatMessage, MentalHealthReport, SessionMode

THEME_SENTENCES = {
    "physical": "Reported physical symptoms (e.g. lightheadedness or tension) during or after duty.",
    "nutrition": "Described disrupted meal timing linked to operational schedule.",
    "sleep": "Described fragmented or insufficient sleep over recent cycles.",
    "fatigue": "Expressed notable fatigue and reduced energy reserves.",
    "anxiety": "Acknowledged elevated workload pressure and stress.",
    "isolation": "Voiced feelings of isolation or disconnection from the crew rotation.",
    "focus": "Noted reduced focus or concentration on task work.",
    "positive": "Reported good energy and a positive outlook.",
}

THEME_HEADLINE = {
    "sleep": "Sleep Disruption",
    "fatigue": "Fatigue",
    "anxiety": "Workload Stress",
    "isolation": "Isolation Strain",
    "physical": "Physical Symptoms",
    "nutrition": "Nutritional Timing Drift",
    "focus": "Reduced Focus",
}
HEADLINE_PRIORITY = ["isolation", "sleep", "nutrition", "physical", "anxiety", "fatigue", "focus"]

BASE_HEADLINES: dict[tuple[str, SessionMode], str] = {
    ("astro-vance", "BRIEF_CHECKIN"): "Routine Check-In: Stable Energy & Crew Morale",
    ("astro-vance", "DEEP_SUPPORT"): "Commander Check-In: Emerging Strain Despite Nominal Vitals",
    ("astro-chen", "DEEP_SUPPORT"): "Post-EVA Metabolic Strain",
    ("astro-lin", "DEEP_SUPPORT"): "Priority: Isolation Fatigue & Elevated Evening Cortisol",
}

EARTH_DIRECTIVES: dict[str, str] = {
    "astro-vance": "No intervention required. Maintain current sleep schedule and weekly crew debriefs; next routine "
    "BLUE check-in in 3 days.",
    "astro-chen": "Mandatory 30 g fast-acting carbohydrate now and a full meal within 1 hour; enforce pre-EVA "
    "nutrition checkpoints and a 20-minute post-shift decompression. Re-check glucose in 2 hours and follow up with "
    "BLUE tomorrow.",
    "astro-lin": "Schedule two shared crew meals per day and a private family call within 48 hours; dim cabin "
    "lighting and stop screen work 60 minutes before sleep. Flight psychologist live session booked for the next "
    "high-bandwidth comm window.",
}
THEME_DIRECTIVES = {
    "sleep": "Add a 20-minute wind-down protocol (guided breathing) before the sleep period.",
    "anxiety": "Ask the Commander to rebalance tomorrow's task timeline with one buffer block.",
    "isolation": "Pair with a crewmate for one shared off-duty activity this week.",
    "fatigue": "Protect an 8.5-hour sleep opportunity for the next two cycles.",
    "physical": "Report any recurrence of symptoms to the crew medical officer immediately.",
}


def _quote(messages: list[ChatMessage]) -> str | None:
    """Pick the astronaut's most informative statement as a short quote."""
    best, best_score = None, 0
    for m in messages:
        if m.role != "user":
            continue
        score = len(set(detect_themes(m.content)) - {"positive"}) * 100 + min(len(m.content), 99)
        if score > best_score:
            best, best_score = m.content.strip(), score
    if not best:
        return None
    return best if len(best) <= 160 else best[:157].rsplit(" ", 1)[0] + "…"


def _headline(profile: AstronautProfile, mode: SessionMode, themes: list[str]) -> str:
    base = BASE_HEADLINES.get((profile.id, mode))
    if base is None:
        base = "Routine Psychological Check-In" if mode == "BRIEF_CHECKIN" else "Supportive Check-In"
    if mode == "BRIEF_CHECKIN":
        return base
    extra = next((THEME_HEADLINE[t] for t in HEADLINE_PRIORITY if t in themes and THEME_HEADLINE[t] not in base), None)
    if extra and not base.startswith("Priority"):
        return f"{base} & {extra}"
    return base


def _biometric_correlation(profile: AstronautProfile, themes: list[str]) -> str:
    v = profile.current_vitals
    hist = profile.vitals_history
    parts: list[str] = []

    if v.blood_sugar_mg_dl < MIN_BLOOD_SUGAR:
        if hist:
            parts.append(
                f"Blood glucose fell from {hist[0].blood_sugar_mg_dl:g} to {v.blood_sugar_mg_dl:g} mg/dL "
                f"({hist[0].time}–{hist[-1].time})"
            )
        else:
            parts.append(f"Blood glucose low at {v.blood_sugar_mg_dl:g} mg/dL")
    if v.heart_rate_bpm > MAX_HEART_RATE or (v.blood_sugar_mg_dl < MIN_BLOOD_SUGAR and v.heart_rate_bpm > 90):
        parts.append(f"compensatory HR rise to {v.heart_rate_bpm:g} BPM")
    if v.cortisol_ug_dl > MAX_CORTISOL:
        trend = ""
        if hist and hist[-1].cortisol_ug_dl > hist[0].cortisol_ug_dl:
            trend = f", rising since {hist[0].time}"
        parts.append(f"cortisol {v.cortisol_ug_dl:g} ug/dL above the {MAX_CORTISOL:.1f} threshold{trend}")

    if not parts:
        text = (
            f"All vitals within nominal range (HR {v.heart_rate_bpm:g} BPM, glucose {v.blood_sugar_mg_dl:g} mg/dL, "
            f"BP {v.systolic_bp:g}/{v.diastolic_bp:g} mmHg, SpO2 {v.spo2_percent:g}%, cortisol {v.cortisol_ug_dl:g} ug/dL)."
        )
        if distress := set(themes) & {"sleep", "fatigue", "anxiety", "isolation"}:
            text += f" Self-reported {', '.join(sorted(distress))} not yet reflected in biomarkers — monitor."
        return text

    text = "; ".join(parts)
    text = text[0].upper() + text[1:] + "."
    if v.cortisol_ug_dl > MAX_CORTISOL and ({"sleep", "isolation", "anxiety"} & set(themes)):
        text += " Self-reported psychological strain is consistent with the elevated cortisol curve."
    elif v.blood_sugar_mg_dl < MIN_BLOOD_SUGAR and ({"physical", "nutrition"} & set(themes)):
        text += " Reported symptoms align with the hypoglycemic trend."
    return text


def generate_report(
    profile: AstronautProfile, messages: list[ChatMessage], mode: SessionMode
) -> MentalHealthReport:
    themes = detect_themes(user_text(messages))
    n_answers = sum(1 for m in messages if m.role == "user")

    mode_label = "brief check-in" if mode == "BRIEF_CHECKIN" else "deep-support"
    sentences = [f"{profile.role} completed a {n_answers}-response {mode_label} session with BLUE."]
    sentences += [THEME_SENTENCES[t] for t in THEME_SENTENCES if t in themes]
    if len(sentences) == 1:
        sentences.append("No specific concerns were raised during the conversation.")
    if quote := _quote(messages):
        sentences.append(f"In their own words: “{quote}”")

    return MentalHealthReport(
        id=f"rep-{uuid.uuid4().hex[:8]}",
        created_at=f"Mission Day {profile.mission_day}",
        session_mode=mode,
        headline=_headline(profile, mode, themes),
        summary=" ".join(sentences),
        biometric_correlation=_biometric_correlation(profile, themes),
        earth_status="QUEUED_FOR_EARTH",
        earth_psychologist_directive=None,
    )


def earth_reply(profile: AstronautProfile, report: MentalHealthReport) -> MentalHealthReport:
    """Simulate the Earth flight psychologist reviewing a queued report."""
    directive = EARTH_DIRECTIVES.get(profile.id, "Continue routine BLUE check-ins; no changes required.")
    if report.session_mode == "DEEP_SUPPORT":
        themes = detect_themes(report.summary)
        extras = [THEME_DIRECTIVES[t] for t in THEME_DIRECTIVES if t in themes]
        if extras:
            directive = f"{directive} {extras[0]}"
    return report.model_copy(
        update={"earth_status": "REVIEWED_BY_EARTH", "earth_psychologist_directive": directive}
    )
