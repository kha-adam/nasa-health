"""Synthesizes a BLUE conversation + vitals into an Earth summary report.

Deterministic templates tailored to the three canonical profiles, enriched
with themes and a short quote extracted from the astronaut's own words.
"""

from __future__ import annotations

import uuid

from core.psychologist import detect_themes, user_text
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
    ("astro-chen", "DEEP_SUPPORT"): "Sleep & Stress Recovery Check",
    ("astro-lin", "DEEP_SUPPORT"): "Priority: Follow-Up After Exercise Dizziness Episode",
}

EARTH_DIRECTIVES: dict[str, str] = {
    "astro-vance": "No intervention required. Maintain current sleep schedule and weekly crew debriefs; next routine "
    "BLUE check-in in 3 days.",
    "astro-chen": "Keep the earlier warm-light evening schedule, stop troubleshooting work after 20:00 and protect "
    "an 8-hour sleep window. Follow up with BLUE in 3 days.",
    "astro-lin": "Light exercise only, supervised by the crew medical officer, until the flight surgeon has reviewed "
    "the episode data. A live session with the flight psychologist is booked for the next high-bandwidth comm "
    "window to talk through the worry about it happening again.",
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
    """Tie the conversation to what the sensors show, using the profile's alerts."""
    alerts = [
        h
        for h in profile.body_highlights.physical + profile.body_highlights.mental
        if h.severity != "NOMINAL"
    ]
    if not alerts:
        v = profile.current_vitals
        g = lambda x: "n/a" if x is None else f"{x:g}"  # noqa: E731
        text = (
            f"All readings within normal range (BP {g(v.systolic_bp)}/{g(v.diastolic_bp)} mmHg, "
            f"SpO2 {g(v.spo2_percent)}%, glucose {g(v.blood_sugar_mg_dl)} mg/dL, morning cortisol "
            f"{g(v.cortisol_nmol_l)} nmol/L, sleep {g(v.sleep_hours)} h)."
        )
        if distress := set(themes) & {"sleep", "fatigue", "anxiety", "isolation"}:
            text += f" Self-reported {', '.join(sorted(distress))} not yet reflected in biomarkers — monitor."
        return text

    text = " ".join(f"{h.label}: {h.detail[0].lower()}{h.detail[1:].rstrip('.')}." for h in alerts[:3])
    zones = {h.zone for h in alerts}
    if "brain" in zones and {"sleep", "anxiety", "isolation", "fatigue"} & set(themes):
        text += " Self-reported strain is consistent with the stress markers."
    elif zones & {"lungs", "heart"} and {"physical", "anxiety"} & set(themes):
        text += " Reported symptoms and worry line up with the recent physical episode."
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
