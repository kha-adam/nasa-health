"""Project BLUE — FastAPI server.

Run from the backend/ directory:
    uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from core import profiles, psychologist, report_generator, speech
from schemas import AstronautProfile, ChatRequest, ChatResponse, MentalHealthReport

app = FastAPI(title="Project BLUE API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("BLUE_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


def _require_profile(astronaut_id: str) -> AstronautProfile:
    profile = profiles.get_profile(astronaut_id)
    if profile is None:
        raise HTTPException(status_code=404, detail=f"Unknown astronaut '{astronaut_id}'")
    return profile


@app.get("/api/health")
def health() -> dict[str, object]:
    return {"status": "ok", "speech": speech.speech_status()}


@app.get("/api/astronauts", response_model=list[AstronautProfile])
def list_astronauts() -> list[AstronautProfile]:
    return profiles.list_profiles()


@app.get("/api/astronauts/{astronaut_id}", response_model=AstronautProfile)
def get_astronaut(astronaut_id: str) -> AstronautProfile:
    return _require_profile(astronaut_id)


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    profile = _require_profile(req.astronaut_id)

    if req.finish_session:
        mode = psychologist.determine_mode(profile, req.messages)
        report = report_generator.generate_report(profile, req.messages, mode)
        profiles.prepend_report(profile.id, report)
        return ChatResponse(
            reply=psychologist.closing_reply(profile),
            session_mode=mode,
            suggested_to_wrap_up=True,
            generated_report=report,
        )

    reply, mode, wrap = psychologist.scripted_reply(profile, req.messages)
    return ChatResponse(reply=reply, session_mode=mode, suggested_to_wrap_up=wrap, generated_report=None)


@app.post("/api/astronauts/{astronaut_id}/reports/{report_id}/earth-reply", response_model=MentalHealthReport)
def simulate_earth_reply(astronaut_id: str, report_id: str) -> MentalHealthReport:
    profile = _require_profile(astronaut_id)
    report = profiles.get_report(astronaut_id, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail=f"Unknown report '{report_id}'")
    updated = report_generator.earth_reply(profile, report)
    profiles.replace_report(astronaut_id, updated)
    return updated
