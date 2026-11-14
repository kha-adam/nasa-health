"""Project BLUE — FastAPI server.

Run from the backend/ directory:
    uvicorn main:app --reload --port 8000

Every /api route except /api/health and /api/auth/login requires a session
cookie; access rules live in core/auth.py.
"""

from __future__ import annotations

import os
from typing import Annotated

from fastapi import Cookie, Depends, FastAPI, HTTPException, Query, Request, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field


from core import auth, metrics, profiles, psychologist, report_generator, speech, telemetry
from schemas import (
    AstronautProfile,
    ChatRequest,
    ChatResponse,
    HistoryRange,
    LoginRequest,
    MentalHealthReport,
    MetricDefinition,
    MetricHistory,
    SessionUser,
)

ALLOWED_ORIGINS = os.environ.get("BLUE_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
COOKIE_SECURE = os.environ.get("BLUE_COOKIE_SECURE", "0") == "1"

app = FastAPI(title="Project BLUE API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def privacy_guard(request: Request, call_next):
    # CSRF defence in depth (the cookie is already SameSite=Lax): browsers always
    # send Origin on cross-site POSTs, so reject state changes from unknown origins.
    if request.method == "POST":
        origin = request.headers.get("origin")
        if origin and origin not in ALLOWED_ORIGINS:
            return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        # Health data must never be cached by browsers or proxies.
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
    return response


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------


def current_user(blue_session: Annotated[str | None, Cookie()] = None) -> SessionUser:
    user = auth.session_user(blue_session)
    if user is None:
        raise HTTPException(status_code=401, detail="Not signed in")
    return user


User = Annotated[SessionUser, Depends(current_user)]


@app.post("/api/auth/login", response_model=SessionUser)
def login(body: LoginRequest, response: Response) -> SessionUser:
    try:
        user = auth.authenticate(body.username, body.password)
    except auth.LockedOut as exc:
        raise HTTPException(
            status_code=429,
            detail="Too many failed attempts. Try again in a few minutes.",
            headers={"Retry-After": str(exc.retry_after)},
        ) from None
    if user is None:
        raise HTTPException(status_code=401, detail="Wrong username or password")
    response.set_cookie(
        auth.COOKIE_NAME,
        auth.create_session(user),
        max_age=auth.SESSION_TTL_S,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        path="/",
    )
    return user


@app.post("/api/auth/logout", status_code=204)
def logout(response: Response, blue_session: Annotated[str | None, Cookie()] = None) -> Response:
    auth.end_session(blue_session)
    response.delete_cookie(auth.COOKIE_NAME, path="/")
    response.status_code = 204
    return response


@app.get("/api/auth/me", response_model=SessionUser)
def me(user: User) -> SessionUser:
    return user


# --------------------------------------------------------------------------
# Crew data
# --------------------------------------------------------------------------


def _view(user: SessionUser, astronaut_id: str) -> AstronautProfile:
    """Return the profile as this user is allowed to see it."""
    profile = profiles.get_profile(astronaut_id)
    if profile is None:
        raise HTTPException(status_code=404, detail=f"Unknown astronaut '{astronaut_id}'")
    if not auth.can_view(user, astronaut_id):
        raise HTTPException(status_code=403, detail="You can only view your own health data")
    return profile if auth.can_see_private(user, astronaut_id) else profiles.redact(profile)


def _require_private(user: SessionUser, astronaut_id: str) -> AstronautProfile:
    profile = _view(user, astronaut_id)
    if not auth.can_see_private(user, astronaut_id):
        raise HTTPException(status_code=403, detail="Mental-health data is private to the astronaut")
    return profile


@app.get("/api/health")
def health() -> dict[str, object]:
    return {"status": "ok", "speech": speech.speech_status()}


@app.get("/api/metrics", response_model=list[MetricDefinition])
def list_metrics(user: User) -> list[MetricDefinition]:
    return metrics.visible_metrics(can_see_private=user.role == "astronaut")


@app.get("/api/astronauts", response_model=list[AstronautProfile])
def list_astronauts(user: User) -> list[AstronautProfile]:
    return [_view(user, p.id) for p in profiles.list_profiles() if auth.can_view(user, p.id)]


@app.get("/api/astronauts/{astronaut_id}", response_model=AstronautProfile)
def get_astronaut(astronaut_id: str, user: User) -> AstronautProfile:
    return _view(user, astronaut_id)


@app.get("/api/astronauts/{astronaut_id}/metrics/{metric_key}", response_model=MetricHistory)
def metric_history(
    astronaut_id: str,
    metric_key: str,
    user: User,
    range: Annotated[HistoryRange, Query()] = "7d",  # noqa: A002
) -> MetricHistory:
    profile = _view(user, astronaut_id)
    metric = metrics.BY_KEY.get(metric_key)
    if metric is None:
        raise HTTPException(status_code=404, detail=f"Unknown metric '{metric_key}'")
    if metric.private and not auth.can_see_private(user, astronaut_id):
        raise HTTPException(status_code=403, detail="This metric is private to the astronaut")
    tele = profiles.get_telemetry(astronaut_id)
    assert tele is not None
    return telemetry.history(profile, tele, metric, range)


# --------------------------------------------------------------------------
# BLUE (private to the astronaut)
# --------------------------------------------------------------------------


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest, user: User) -> ChatResponse:
    profile = _require_private(user, req.astronaut_id)

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
def simulate_earth_reply(astronaut_id: str, report_id: str, user: User) -> MentalHealthReport:
    profile = _require_private(user, astronaut_id)
    report = profiles.get_report(astronaut_id, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail=f"Unknown report '{report_id}'")
    updated = report_generator.earth_reply(profile, report)
    profiles.replace_report(astronaut_id, updated)
    return updated


class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


@app.post("/api/speech")
async def speak(req: SpeechRequest, user: User) -> Response:
    if user.role != "astronaut":
        raise HTTPException(status_code=403, detail="BLUE voice is private to the astronaut")
    audio = await speech.synthesize(req.text)
    if audio is None:
        raise HTTPException(status_code=503, detail="Voice unavailable; use browser speech or the text transcript.")
    return Response(audio, media_type="audio/mpeg", headers={"Cache-Control": "no-store"})


@app.post("/api/transcribe")
async def transcribe(user: User, audio: UploadFile = File(...)) -> dict[str, str]:
    if user.role != "astronaut":
        raise HTTPException(status_code=403, detail="BLUE voice is private to the astronaut")
    recording = await audio.read(2_000_001)
    await audio.close()
    if len(recording) > 2_000_000:
        raise HTTPException(status_code=413, detail="Recording is too large. Please use a shorter reply.")
    if not recording or not recording.startswith(b"RIFF") or recording[8:12] != b"WAVE":
        raise HTTPException(status_code=422, detail="A WAV microphone recording is required.")
    text = await speech.transcribe(recording)
    if text is None:
        raise HTTPException(status_code=503, detail="Speech recognition unavailable. Please try again or type your reply.")
    return {"text": text}


@app.post("/api/voice-session")
async def voice_session(req: ChatRequest, user: User) -> JSONResponse:
    profile = _require_private(user, req.astronaut_id)
    context = profile.model_dump()
    # Keep only recent reports in the voice prompt; the frozen profile remains untouched.
    context["mental_reports"] = context["mental_reports"][:3]
    token = await speech.create_voice_session(context, [message.model_dump() for message in req.messages], not req.messages)
    if token is None:
        raise HTTPException(status_code=503, detail="Live voice is unavailable. You can keep using text chat.")
    return JSONResponse(token, headers={"Cache-Control": "no-store"})
