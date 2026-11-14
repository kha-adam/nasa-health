"""Speech (STT/TTS) handler — placeholder.

Voice is intentionally deferred for the MVP: BLUE currently runs through the
text fallback input in the voice drawer. When voice is built, this module will
host the backend STT/TTS loop (with graceful fallback to text, AGENTS.md §5.3).
"""

from __future__ import annotations

VOICE_ENABLED = False


def speech_status() -> dict[str, object]:
    return {"voice_enabled": VOICE_ENABLED, "fallback": "text"}
