"""Read-only BLUE context, built from the same authorized data as the dashboard."""

import re

from core import crew_life, metrics, profiles, telemetry
from schemas import AstronautProfile


def dashboard_context(profile: AstronautProfile) -> dict:
    context = profile.model_dump()
    # Include report status/directives and history without exposing another crew member's health.
    context["crew_life"] = crew_life.board(profile.id).model_dump()
    context["metric_catalog"] = [m.model_dump() for m in metrics.CATALOG]
    tele = profiles.get_telemetry(profile.id)
    context["metric_history"] = {}
    if tele is not None:
        for metric in metrics.CATALOG:
            summaries = {}
            for span in ("24h", "7d", "30d", "all"):
                history = telemetry.history(profile, tele, metric, span)
                summaries[span] = {
                    "resolution": history.resolution,
                    "start": history.points[0].t if history.points else None,
                    "end": history.points[-1].t if history.points else None,
                    "stats": [s.model_dump() for s in history.stats],
                }
            context["metric_history"][metric.key] = summaries
    context["data_scope"] = {
        "source": "ASTRA simulated mission telemetry; not a live medical device feed",
        "as_of": profile.last_reading_at,
        "freshness": "Snapshot at voice session start; no live dashboard tools or web search available.",
        "ranges": "Operational demo alert bands, not clinical reference ranges or diagnoses.",
        "history": "Summary statistics only; individual chart points are not supplied. Null means unavailable.",
        "privacy": "Own health, reports and encouragements only; public crew names, shared titles and aggregate challenge progress.",
    }
    context["app_guide"] = {
        "overview": "/dashboard: Physical/Mental panels, current readings, body alert markers and reports",
        "metric_details": "/dashboard/metrics/<metric key>: 24h, 7d, 30d or whole-mission charts, statistics and events",
        "reports": "/dashboard/reports: own Earth summaries, delivery status and simulated Earth replies",
        "crew_life": "/dashboard/crew-life: weekly titles, title-holder perks, rituals, encouragements, reward voting and mission map",
        "checkin": "End Session & Generate Earth Report files a report and records this mission day's check-in; talking alone does not complete it. Repeated check-ins count once per day toward the challenge.",
        "challenge": "Every crew member must reach target_days within the mission week. Shared progress is anonymous. Completion unlocks a crew reward and one mission-map star.",
        "titles": "Weekly leaders may tie; only shared holders are named. your_value is the signed-in astronaut's score. Sleep Captain rewards bedtime regularity, not sleep duration. Titles are encouragement, not medical assessments.",
        "actions": "Explain where to click; cannot submit votes, validate rituals, send encouragements, choose perks, contact Earth or finish a check-in by speech alone.",
    }
    return context


def dashboard_answer(profile: AstronautProfile, text: str) -> str | None:
    """Factual answers for the offline fallback; never treat symptoms as FAQ queries."""
    if not re.search(r"\?|\b(what|which|who|explain|tell me about|how many|quel|qui|explique)\b", text, re.I):
        return None
    if re.search(r"\b(title|titles|perk|perks|titre|titres)\b", text, re.I) or any(t.name.lower() in text.lower() for t in crew_life.TITLES):
        board = crew_life.board(profile.id)
        names = {p.id: p.name for p in board.crew}
        selected = [t for t in board.titles if t.name.lower() in text.lower()]
        if selected:
            t = selected[0]
            holders = ", ".join(names[h] for h in t.holders) or "no shared holder yet"
            return f"{t.name}: {t.criterion} Week {board.week} holders: {holders}. Your progress: {t.your_value}; the perk is {t.perk.label.lower()}."
        return f"Mission week {board.week}, days {board.week_start_day}–{board.week_end_day}, has these titles: " + ", ".join(t.name for t in board.titles) + ". Open Crew life to see the holders and perks."
    if re.search(r"\b(challenge|reward|stars|défi|récompense)\b", text, re.I):
        board = crew_life.board(profile.id)
        c = board.challenge
        return f"This week's challenge is: {c.label}. You have {len(c.your_days)} of {c.target_days} days, and {c.crew_on_target} of {c.crew_size} crew members have reached the target. " + ("The crew reward is unlocked." if c.completed else "Finish your check-in with End Session & Generate Earth Report to count today; each day counts once.")
    # Symptom reports belong to the support flow, even if they mention a metric.
    if re.search(r"\b(i (?:feel|have|am)|i'm|my chest|can't breathe|cannot breathe|je (?:me sens|suis)|j'ai)\b", text, re.I):
        return None
    aliases = {"spo2": ("oxygen", "spo₂"), "glucose": ("blood sugar", "glucose"), "hrv": ("hrv",), "sleep": ("sleep", "sommeil")}
    for metric in metrics.CATALOG:
        terms = (metric.label.lower(), metric.key.replace("_", " "), *aliases.get(metric.key, ()))
        if any(re.search(r"(?<!\w)" + re.escape(term) + r"(?!\w)", text, re.I) for term in terms):
            readings = []
            for series in metric.series:
                value = getattr(profile.current_vitals, series.field, None)
                readings.append(f"{series.label}: {value} {metric.unit}" if value is not None else f"{series.label}: unavailable")
            return f"{metric.description} Your recorded {metric.label.lower()} is {', '.join(readings)} ({profile.metric_status.get(metric.key, 'unavailable')}), as of {profile.last_reading_at}. These are simulated mission readings, and the dashboard bands are demo alerts, not a diagnosis; open the metric detail for its history."
    return None
