"""BLUE — adaptive aerospace psychologist engine (deterministic MVP).

AGENTS.md Section 5:
* BRIEF_CHECKIN when the astronaut's status and every personal reading are
  nominal and they voice no distress: 2 warm questions, then an offer to wrap up.
* DEEP_SUPPORT when the status tag is ADVISORY/URGENT, any personal reading is
  out of range (see core/metrics.py), OR the astronaut mentions fatigue,
  anxiety, sleep issues, etc.: 3-5 empathetic, targeted follow-ups.

The engine is fully scripted per canonical profile so the demo never depends
on a network service. An LLM can later be slotted in front of
``scripted_reply`` with this module as its timeout fallback.
"""

from __future__ import annotations

import re

from core.metrics import BY_KEY
from schemas import AstronautProfile, ChatMessage, SessionMode

# --------------------------------------------------------------------------
# Themes detected in the astronaut's own words
# --------------------------------------------------------------------------

THEME_PATTERNS: dict[str, list[str]] = {
    "sleep": [r"sleep", r"insomnia", r"wak(e|ing) up", r"nightmare", r"restless", r"sommeil", r"dorm"],
    "fatigue": [r"tired", r"fatigue", r"exhaust", r"drained", r"worn out", r"no energy", r"low energy", r"fatigu", r"épuis"],
    "anxiety": [r"anxi", r"stress", r"nervous", r"worr", r"overwhelm", r"panic", r"pressure", r"tense", r"angoiss"],
    "isolation": [r"lonely", r"alone", r"isolat", r"miss (my|home|family|earth)", r"(thinking|think) about (home|my family|earth)", r"homesick", r"disconnect", r"out of sync", r"seul"],
    "physical": [r"dizz", r"lighthead", r"light-head", r"headache", r"nause", r"shak", r"weak", r"pain", r"vertige"],
    "nutrition": [r"skip(ped)? (a |my )?(meal|lunch|breakfast)", r"didn'?t eat", r"hungry", r"no time to eat", r"meal", r"snack", r"food"],
    "focus": [r"focus", r"concentrat", r"distract", r"foggy", r"mistake"],
    "positive": [r"\bgood\b", r"\bgreat\b", r"\bfine\b", r"\bwell\b", r"rested", r"energ(y|ized) (is )?(good|high)", r"\bhappy\b", r"motivated"],
}

DISTRESS_THEMES = {"sleep", "fatigue", "anxiety", "isolation", "physical"}

WRAP_PATTERNS = [r"that'?s all", r"nothing else", r"wrap( it)? up", r"\bbye\b", r"end (the )?session", r"i'?m done", r"that'?s it"]


def detect_themes(text: str) -> list[str]:
    lowered = text.lower()
    found = []
    for theme, patterns in THEME_PATTERNS.items():
        if any(re.search(p, lowered) for p in patterns):
            found.append(theme)
    # "not good", "not well" etc. should not count as positive.
    if "positive" in found and re.search(r"\bnot (so |very |that )?(good|great|fine|well)\b", lowered):
        found.remove("positive")
    return found


def user_text(messages: list[ChatMessage]) -> str:
    return "\n".join(m.content for m in messages if m.role == "user")


# --------------------------------------------------------------------------
# Mode selection
# --------------------------------------------------------------------------


def flagged_metrics(profile: AstronautProfile) -> list[str]:
    """Personal (non-environment) metrics currently out of range."""
    return [
        key
        for key, status in profile.metric_status.items()
        if status != "NOMINAL" and key in BY_KEY and BY_KEY[key].category != "environment"
    ]


def determine_mode(profile: AstronautProfile, messages: list[ChatMessage]) -> SessionMode:
    if profile.status_tag != "NOMINAL" or flagged_metrics(profile):
        return "DEEP_SUPPORT"
    if DISTRESS_THEMES & set(detect_themes(user_text(messages))):
        return "DEEP_SUPPORT"
    return "BRIEF_CHECKIN"


def earth_delay(profile: AstronautProfile) -> str:
    minutes = profile.current_vitals.earth_delay_min
    if minutes is None:
        return "current"
    m = int(minutes)
    return f"{m}m {round((minutes - m) * 60):02d}s"


# --------------------------------------------------------------------------
# Scripted question banks per canonical profile
# --------------------------------------------------------------------------
# Index 0 is the context-aware opening; index i is asked after the i-th user
# answer. Once every question has been answered, BLUE offers to wrap up.

QUESTIONS: dict[tuple[str, SessionMode], list[str]] = {
    ("astro-vance", "BRIEF_CHECKIN"): [
        "Good evening, Commander Vance. Your readings look steady and your sleep held up well through the cabin "
        "CO₂ issue. How has your energy been today?",
        "How is the crew feeling from where you sit — morale, communication, anything you think I should know about?",
    ],
    ("astro-vance", "DEEP_SUPPORT"): [
        "Good evening, Commander Vance. Your readings look steady today. How has your energy been?",
        "Even when the numbers look fine, how you feel matters most. Can you tell me a little more about when that "
        "feeling tends to show up — during command duties, or more in your off-hours?",
        "How has your sleep been over the last few nights — falling asleep, staying asleep, waking up rested?",
        "Is there anything about the responsibility of command that has been sitting heavier than usual lately?",
    ],
    ("astro-chen", "DEEP_SUPPORT"): [
        "Hi Marcus, it's BLUE. Your sleep has been more broken than usual over the last couple of weeks, and your "
        "stress markers rose before easing after the evening lighting change. How are you feeling tonight?",
        "When you wake up during the night, what tends to be on your mind — work, or something else?",
        "How heavy has the troubleshooting workload felt this week — manageable, or closer to overwhelming?",
        "Since the evening lighting moved earlier, have you noticed any difference in how easily you fall asleep?",
        "One last question: what is one thing that would make tomorrow's shift feel more manageable for you?",
    ],
    ("astro-lin", "DEEP_SUPPORT"): [
        "Hi Maya, it's BLUE. I saw what happened on the treadmill on day {acute_day} — that must have been "
        "frightening. How are you feeling now, physically?",
        "Have you had any dizziness or breathlessness since then, even briefly?",
        "How do you feel about getting back on the treadmill — is there any worry about it happening again?",
        "How have your nights been since the episode — are you sleeping through?",
        "You've been pushing hard on the lab schedule. Is there anything you'd like the crew or Earth to take off "
        "your plate?",
    ],
}

GENERIC_QUESTIONS: dict[SessionMode, list[str]] = {
    "BRIEF_CHECKIN": [
        "Hi {first}, it's BLUE. Your vitals look steady today. How has your energy been?",
        "How is the crew feeling from where you sit?",
    ],
    "DEEP_SUPPORT": [
        "Hi {first}, it's BLUE. I've been looking at today's readings and wanted to check in. How are you holding up?",
        "Have you noticed any physical symptoms today — lightheadedness, headaches, tension?",
        "How has the workload been feeling this week?",
        "How has your sleep been over the last few nights?",
    ],
}

ACKNOWLEDGMENTS: dict[str, str] = {
    "physical": "Thank you for telling me — symptoms like that are important for me to track alongside your vitals.",
    "nutrition": "Meal timing matters a lot on long shifts — thank you for mentioning it.",
    "sleep": "Fragmented sleep can wear anyone down over long stretches, {first}.",
    "isolation": "Feeling out of sync with the crew is something many long-duration astronauts describe. I'm glad you said it out loud.",
    "anxiety": "It makes sense to feel that pressure given what's on your plate. You don't have to carry it alone.",
    "fatigue": "That sounds genuinely draining — thank you for being honest about it.",
    "focus": "That's a very normal effect of accumulated strain, and it's worth paying attention to.",
    "positive": "That's really good to hear.",
}
ACK_PRIORITY = ["physical", "nutrition", "sleep", "isolation", "anxiety", "fatigue", "focus", "positive"]
NEUTRAL_ACKS = [
    "I appreciate you sharing that.",
    "Thank you, that's helpful context.",
    "Understood — thank you for walking me through it.",
]

WRAP_UP = {
    "BRIEF_CHECKIN": "Thank you, {first}. Everything points to a steady rhythm. If there's nothing else on your mind, "
    "I can wrap up and file a routine report for Earth — just tap “End Session & Generate Earth Report”.",
    "DEEP_SUPPORT": "Thank you for trusting me with all of this, {first}. I have a clear picture now. When you're "
    "ready, I'll compile a summary for the flight psychologist on Earth so they can send back concrete next steps — "
    "tap “End Session & Generate Earth Report”.",
}

CLOSING = (
    "Thank you, {first}. I've compiled your summary report and queued it for Earth uplink. With the current "
    "{delay} signal delay, expect the flight psychologist's guidance in the next comm window. Take care of yourself "
    "tonight."
)


def first_name(profile: AstronautProfile) -> str:
    parts = profile.name.split()
    return parts[1] if len(parts) > 1 else parts[0]


def _context(profile: AstronautProfile) -> dict[str, object]:
    acute = next((e for e in profile.events if e.code == "ACUTE_DIZZINESS_BREATHLESSNESS"), None)
    return {"first": first_name(profile), "acute_day": acute.mission_day if acute else profile.mission_day}


def _questions(profile: AstronautProfile, mode: SessionMode) -> list[str]:
    script = QUESTIONS.get((profile.id, mode)) or GENERIC_QUESTIONS[mode]
    ctx = _context(profile)
    return [q.format(**ctx) for q in script]


def _acknowledge(profile: AstronautProfile, last_user: str, history: list[ChatMessage]) -> tuple[str, bool]:
    """Return (acknowledgment, is_theme_specific), avoiding repeats."""
    said_before = " ".join(m.content for m in history if m.role == "assistant")
    themes = detect_themes(last_user)
    for theme in ACK_PRIORITY:
        if theme in themes:
            ack = ACKNOWLEDGMENTS[theme].format(first=first_name(profile))
            if ack not in said_before:
                return ack, True
    for ack in NEUTRAL_ACKS:
        if ack not in said_before:
            return ack, False
    return NEUTRAL_ACKS[0], False


def scripted_reply(profile: AstronautProfile, messages: list[ChatMessage]) -> tuple[str, SessionMode, bool]:
    """Return (reply, session_mode, suggested_to_wrap_up) for the next turn."""
    mode = determine_mode(profile, messages)
    script = _questions(profile, mode)
    first = first_name(profile)

    user_turns = [m for m in messages if m.role == "user"]
    if not user_turns:
        return script[0], mode, False

    last = user_turns[-1].content
    ack, themed = _acknowledge(profile, last, messages[:-1])

    wants_out = any(re.search(p, last.lower()) for p in WRAP_PATTERNS)
    answered = len(user_turns)
    if wants_out or answered >= len(script):
        wrap = WRAP_UP[mode].format(first=first)
        # The wrap-up already thanks the astronaut; only keep a meaningful ack.
        return (f"{ack} {wrap}" if themed else wrap), mode, True

    return f"{ack} {script[answered]}", mode, False


def closing_reply(profile: AstronautProfile) -> str:
    return CLOSING.format(first=first_name(profile), delay=earth_delay(profile))
