"""BLUE's adaptive check-in.

AGENTS.md Section 5. `select_session_mode` runs before every reply.
`next_turn(profile, request) -> ChatResponse` asks the questions.

When `request.finish_session` is true, `generated_report` is a
MentalHealthReport from `build_report` with earth_status QUEUED_FOR_EARTH
and earth_psychologist_directive null. Person 5 prepends that object in
POST /api/chat. Offering to wrap up does not file the report by itself.

BRIEF_CHECKIN when all of these hold, and the astronaut has not described strain:
- blood sugar >= 72 mg/dL
- heart rate <= 100 BPM
- cortisol <= 16.0 μg/dL

Two warm questions (energy, then crew morale), then an offer to file a routine report.
DEEP_SUPPORT asks three questions on symptoms, workload, and sleep, and up to
two more while the astronaut is still describing strain. Chen's questions stay
on glucose, exertion, and meal timing. Lin's stay on cortisol, sleep, and isolation.
"""

from __future__ import annotations

import re

from backend.core.report_generator import build_report
from backend.schemas import (
    AstronautProfile,
    ChatMessage,
    ChatRequest,
    ChatResponse,
    MentalHealthReport,
    SessionMode,
)

GLUCOSE_BRIEF_MIN_MG_DL = 72.0
HEART_RATE_BRIEF_MAX_BPM = 100.0
CORTISOL_BRIEF_MAX_UG_DL = 16.0

# Problem phrases first. Several of these contain "not" or "n't".
_SLEEP_TROUBLE = re.compile(
    r"\b("
    r"can(?:not|'t) sleep|cannot sleep|couldn'?t sleep|"
    r"trouble sleeping|hard to sleep|"
    r"haven'?t slept|have not slept|didn'?t sleep|did not sleep|"
    r"not sleeping|no sleep|"
    r"poor sleep|bad sleep|fragmented sleep|broken sleep|"
    r"slept (?:badly|poorly)|"
    r"insomnia|"
    r"waking up|woke up|"
    r"restless(?: night)?|"
    r"sleep issues?|sleep problems?|sleep trouble"
    r")\b",
    re.IGNORECASE,
)

_STRAIN = re.compile(
    r"\b("
    r"fatigu(?:e|ed)|"
    r"tired|exhausted|drained|worn out|"
    r"no energy|low energy|"
    r"anxious|anxiety|"
    r"worried|on edge|panic(?:ked|king)?|nervous|"
    r"light[-\s]?headed|dizzy"
    r")\b",
    re.IGNORECASE,
)

# "not really tired" stays nominal. "can't sleep" is handled above.
_NEGATED = re.compile(
    r"(?:"
    r"\b(?:not|no|never|without)\b|"
    r"\b(?:is|are|was|were|am|feel|feeling)n'?t\b"
    r")"
    r"(?:\s+\w+){0,2}\s+$",
    re.IGNORECASE,
)


def vitals_need_deep_support(profile: AstronautProfile) -> bool:
    """True when any mode-critical vital is outside the nominal band."""
    vitals = profile.current_vitals
    return (
        vitals.blood_sugar_mg_dl < GLUCOSE_BRIEF_MIN_MG_DL
        or vitals.heart_rate_bpm > HEART_RATE_BRIEF_MAX_BPM
        or vitals.cortisol_ug_dl > CORTISOL_BRIEF_MAX_UG_DL
    )


def expresses_strain(messages: list[ChatMessage]) -> bool:
    """True when the astronaut describes fatigue, anxiety, sleep trouble, or lightheadedness."""
    text = "\n".join(message.content for message in messages if message.role == "user")
    if not text.strip():
        return False
    if _SLEEP_TROUBLE.search(text):
        return True
    for match in _STRAIN.finditer(text):
        prefix = text[max(0, match.start() - 32) : match.start()]
        if _NEGATED.search(prefix):
            continue
        return True
    return False


def select_session_mode(
    profile: AstronautProfile,
    messages: list[ChatMessage] | None = None,
) -> SessionMode:
    """Pick BRIEF_CHECKIN or DEEP_SUPPORT for this turn."""
    if vitals_need_deep_support(profile) or expresses_strain(messages or []):
        return "DEEP_SUPPORT"
    return "BRIEF_CHECKIN"


_GIVEN_NAMES = {
    "astro-vance": "Elena",
    "astro-chen": "Marcus",
    "astro-lin": "Maya",
}

# Present on a closing reply so a later turn does not ask another question.
_FILE_FOR_EARTH = "I can file this for Earth when you end the session."
_QUEUED_FOR_EARTH = "The summary is queued for Earth."

_BRIEF_QUESTIONS = 2
_DEEP_MIN_QUESTIONS = 3
_DEEP_MAX_QUESTIONS = 5


def next_turn(profile: AstronautProfile, request: ChatRequest) -> ChatResponse:
    """Return BLUE's next reply for this astronaut and transcript.

    Signature for Person 5: next_turn(profile, request) -> ChatResponse.
    File the report only when request.finish_session is true.
    """
    messages = request.messages
    mode = select_session_mode(profile, messages)
    name = _given_name(profile)
    last_user = _last_user_text(messages)

    if request.finish_session:
        return _response(
            mode,
            _filed_reply(name, mode, last_user),
            wrap_up=True,
            report=build_report(profile, messages, mode),
        )

    if _already_offered_to_close(messages):
        return _response(mode, _close_reply(name, mode, last_user), wrap_up=True)

    asked = _assistant_count(messages)
    bank = _question_bank(profile, mode)
    if _should_ask(mode, asked, messages):
        question = bank[asked]
        reply = question if last_user is None else _follow_up(name, last_user, question)
        return _response(mode, reply, wrap_up=False)

    return _response(mode, _close_reply(name, mode, last_user), wrap_up=True)


def _response(
    mode: SessionMode,
    reply: str,
    *,
    wrap_up: bool,
    report: MentalHealthReport | None = None,
) -> ChatResponse:
    return ChatResponse(
        reply=reply,
        session_mode=mode,
        suggested_to_wrap_up=wrap_up,
        generated_report=report,
    )


def _should_ask(mode: SessionMode, asked: int, messages: list[ChatMessage]) -> bool:
    if mode == "BRIEF_CHECKIN":
        return asked < _BRIEF_QUESTIONS
    if asked < _DEEP_MIN_QUESTIONS:
        return True
    if asked >= _DEEP_MAX_QUESTIONS:
        return False
    last_user = _last_user_text(messages)
    if last_user is None:
        return False
    return expresses_strain([ChatMessage(role="user", content=last_user)])


def _given_name(profile: AstronautProfile) -> str:
    return _GIVEN_NAMES.get(profile.id, profile.name.split()[-1])


def _num(value: float) -> str:
    rounded = round(float(value), 1)
    if rounded == int(rounded):
        return str(int(rounded))
    return f"{rounded:.1f}"


def _assistant_count(messages: list[ChatMessage]) -> int:
    return sum(1 for message in messages if message.role == "assistant")


def _last_user_text(messages: list[ChatMessage]) -> str | None:
    for message in reversed(messages):
        if message.role == "user" and message.content.strip():
            return message.content.strip()
    return None


def _already_offered_to_close(messages: list[ChatMessage]) -> bool:
    for message in reversed(messages):
        if message.role == "assistant":
            return _FILE_FOR_EARTH in message.content or _QUEUED_FOR_EARTH in message.content
    return False


def _report_clause(profile: AstronautProfile) -> str:
    if not profile.mental_reports:
        return ""
    latest = profile.mental_reports[0]
    return f' I still have your note from {latest.created_at}, "{latest.headline}."'


def _glucose_phrase(profile: AstronautProfile) -> str:
    current = profile.current_vitals.blood_sugar_mg_dl
    history = profile.vitals_history
    if len(history) >= 2 and history[-1].blood_sugar_mg_dl < history[0].blood_sugar_mg_dl:
        start = _num(history[0].blood_sugar_mg_dl)
        end = _num(history[-1].blood_sugar_mg_dl)
        return f"your blood sugar has dropped from {start} to {end} mg/dL"
    return f"your blood sugar is {_num(current)} mg/dL"


def _question_bank(profile: AstronautProfile, mode: SessionMode) -> list[str]:
    name = _given_name(profile)
    vitals = profile.current_vitals
    report = _report_clause(profile)
    if mode == "BRIEF_CHECKIN":
        return [
            (
                f"Hi {name}, your readings look steady this cycle — heart rate "
                f"{_num(vitals.heart_rate_bpm)} BPM, blood sugar "
                f"{_num(vitals.blood_sugar_mg_dl)} mg/dL, cortisol "
                f"{_num(vitals.cortisol_ug_dl)} μg/dL.{report} "
                f"How is your energy today?"
            ),
            "How is the crew feeling from where you sit — morale, and anyone you are keeping an eye on?",
        ]
    if profile.id == "astro-chen":
        return [
            (
                f"Hi {name}, I noticed {_glucose_phrase(profile)}, and your heart rate "
                f"is {_num(vitals.heart_rate_bpm)} BPM.{report} "
                f"How are you feeling in your body right now — any lightheadedness, shakiness, or a drop in focus?"
            ),
            "When did you last eat a real meal, and did EVA prep push both that timing and the exertion?",
            "How did you sleep before this shift, and has the physical strain followed you into rest?",
            "How has the pace of the airlock work sat with you since that meal?",
            "Where is this showing up most now, in the work itself or once you stop moving?",
        ]
    if profile.id == "astro-lin":
        return [
            (
                f"Hi {name}, your cortisol is at {_num(vitals.cortisol_ug_dl)} μg/dL, "
                f"above the usual evening band.{report} How are you holding up today?"
            ),
            "How has sleep been across the last few cycles — waking in the night, trouble settling, or both?",
            "Have you noticed that affecting your focus during lab work, or mostly during off-duty hours?",
            "How connected have you felt to the crew rotation lately, and when does the isolation sit heavier?",
            "What would make the next cycle a little more manageable — sleep, a conversation with the crew, or a lighter task block?",
        ]
    return [
        (
            f"Hi {name}, I want to stay with {_vital_concern(profile)}.{report} "
            f"Where are you feeling that most right now?"
        ),
        "Where is this sitting most — in your body, in your sleep, or in the workload?",
        "How has the workload felt over the last day or two?",
        "How has sleep been, including whether you are waking or having trouble coming down after a shift?",
        "What would you want the Earth psychologist to know before the next cycle?",
    ]


def _vital_concern(profile: AstronautProfile) -> str:
    vitals = profile.current_vitals
    parts: list[str] = []
    if vitals.blood_sugar_mg_dl < GLUCOSE_BRIEF_MIN_MG_DL:
        parts.append(f"blood sugar at {_num(vitals.blood_sugar_mg_dl)} mg/dL")
    if vitals.heart_rate_bpm > HEART_RATE_BRIEF_MAX_BPM:
        parts.append(f"heart rate at {_num(vitals.heart_rate_bpm)} BPM")
    if vitals.cortisol_ug_dl > CORTISOL_BRIEF_MAX_UG_DL:
        parts.append(f"cortisol at {_num(vitals.cortisol_ug_dl)} μg/dL")
    if not parts:
        return "what you are carrying today"
    if len(parts) == 1:
        return parts[0]
    return ", ".join(parts[:-1]) + " and " + parts[-1]


def _unnegated(pattern: re.Pattern[str], text: str) -> bool:
    for match in pattern.finditer(text):
        prefix = text[max(0, match.start() - 32) : match.start()]
        if _NEGATED.search(prefix):
            continue
        return True
    return False


_FATIGUE = re.compile(
    r"fatigu|tired|exhausted|drained|worn out|no energy|low energy",
    re.IGNORECASE,
)
_ANXIETY = re.compile(
    r"anxious|anxiety|worried|on edge|panic|nervous",
    re.IGNORECASE,
)
_LIGHTHEADED = re.compile(r"light[-\s]?headed|dizzy", re.IGNORECASE)


def _reflection(text: str) -> str:
    if _SLEEP_TROUBLE.search(text):
        return "Interrupted sleep can color the whole day that follows."
    if _unnegated(_FATIGUE, text):
        return "That kind of tiredness is worth slowing down for."
    if _unnegated(_ANXIETY, text):
        return "That worry makes sense to name out loud."
    if _unnegated(_LIGHTHEADED, text):
        return "Lightheadedness after a shift is a signal we should stay with."
    if re.search(r"isolat|alone|lonely|out of sync|left out", text, re.IGNORECASE):
        return "Feeling out of step with the crew can weigh more than it looks on a chart."
    if re.search(r"\b(meals?|eat|ate|eaten|eating|food|hungry|nutrition)\b", text, re.IGNORECASE):
        return "When meals slide, the rest of the shift often follows."
    if re.search(r"\b(work(?:load|ing|ed)?|eva|airlock|tasks?|busy|shift|lab)\b", text, re.IGNORECASE):
        return "The shape of the shift matters as much as the numbers."
    if _sounds_settled(text):
        return "It helps to hear this stretch feels manageable."
    return "I hear you."


def _sounds_settled(text: str) -> bool:
    match = re.search(r"\b(fine|good|okay|ok|steady|well|great)\b", text, re.IGNORECASE)
    if match is None:
        return False
    prefix = text[max(0, match.start() - 32) : match.start()]
    return _NEGATED.search(prefix) is None


def _follow_up(name: str, last_user: str, question: str) -> str:
    return f"Thank you for sharing that, {name}. {_reflection(last_user)} {question}"


def _filed_reply(name: str, mode: SessionMode, last_user: str | None) -> str:
    if last_user is None:
        if mode == "BRIEF_CHECKIN":
            lead = f"Thank you, {name}. I have filed a routine summary for Earth."
        else:
            lead = f"Thank you, {name}. I have filed a summary for the Earth psychologist."
    else:
        lead = (
            f"Thank you for sharing that, {name}. {_reflection(last_user)} "
            f"I have filed the summary for Earth."
        )
    return f"{lead} {_QUEUED_FOR_EARTH}"


def _close_reply(name: str, mode: SessionMode, last_user: str | None) -> str:
    if last_user is None:
        if mode == "BRIEF_CHECKIN":
            lead = f"Thank you, {name}. We can keep this as a routine check-in."
        else:
            lead = f"Thank you, {name}. I have enough of today's picture to close carefully."
    else:
        enough = (
            "That's enough for a routine report to Earth."
            if mode == "BRIEF_CHECKIN"
            else "I have enough to write a careful summary for Earth."
        )
        lead = f"Thank you for sharing that, {name}. {_reflection(last_user)} {enough}"
    return f"{lead} {_FILE_FOR_EARTH}"
