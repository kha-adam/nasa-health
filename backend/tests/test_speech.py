"""Speech failures must leave check-ins usable."""
import asyncio

import httpx
from fastapi.testclient import TestClient

from core import speech, profiles
from main import app


def voice_client(username="vance"):
    client = TestClient(app)
    response = client.post("/api/auth/login", json={"username": username, "password": f"blue-{username}-2035"})
    assert response.status_code == 200
    return client


def test_unconfigured_voice_falls_back(monkeypatch):
    monkeypatch.setattr(speech, "_settings", lambda: {})
    assert asyncio.run(speech.synthesize("Hello")) is None
    assert voice_client().post("/api/speech", json={"text": "Hello"}).status_code == 503


def test_voice_endpoint_returns_audio_without_credentials(monkeypatch):
    async def synthesize(text):
        assert text == "Hello"
        return b"ID3test-audio"
    monkeypatch.setattr(speech, "synthesize", synthesize)
    response = voice_client().post("/api/speech", json={"text": "Hello"})
    assert response.content == b"ID3test-audio"
    assert response.headers["content-type"] == "audio/mpeg"
    assert response.headers["cache-control"] == "no-store"


def test_provider_timeout_falls_back(monkeypatch):
    monkeypatch.setattr(speech, "_settings", lambda: {"FISH_API_KEY": "test-secret"})
    async def post(*args, **kwargs):
        raise httpx.ReadTimeout("Provider offline")
    monkeypatch.setattr(httpx.AsyncClient, "post", post)
    assert asyncio.run(speech.synthesize("Hello")) is None


def test_speech_rejects_empty_or_oversize_text():
    client = voice_client()
    for text in ("", "x" * 2001):
        assert client.post("/api/speech", json={"text": text}).status_code == 422


def test_live_session_preserves_crew_context_and_history(monkeypatch):
    from core import profiles
    seen = {}
    async def create(profile, messages, greeting):
        seen.update(profile=profile, messages=messages, greeting=greeting)
        return {"transport": "livekit", "token": "temporary-test-token"}
    monkeypatch.setattr(speech, "create_voice_session", create)
    response = voice_client("chen").post("/api/voice-session", json={"astronaut_id": "astro-chen", "messages": [{"role": "user", "content": "How are you?"}], "finish_session": False})
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert seen["profile"]["current_vitals"]["blood_sugar_mg_dl"] == profiles.get_profile("astro-chen").current_vitals.blood_sugar_mg_dl
    assert seen["messages"][0]["content"] == "How are you?"
    assert seen["greeting"] is False
    assert seen["profile"]["crew_life"]["astronaut_id"] == "astro-chen"
    assert "spo2" in seen["profile"]["metric_history"]
    assert seen["profile"]["metric_catalog"]
    prompt = speech.voice_prompt(seen["profile"], seen["messages"])
    assert "Always respond to what the person actually says" in prompt
    assert "astro-chen" in prompt


def test_live_session_outage_keeps_text_fallback(monkeypatch):
    async def create(*args):
        return None
    monkeypatch.setattr(speech, "create_voice_session", create)
    assert voice_client().post("/api/voice-session", json={"astronaut_id": "astro-vance", "messages": [], "finish_session": False}).status_code == 503


def test_voice_requires_login_and_own_private_profile():
    body = {"astronaut_id": "astro-chen", "messages": [], "finish_session": False}
    assert TestClient(app).post("/api/voice-session", json=body).status_code == 401
    assert TestClient(app).post("/api/speech", json={"text": "Hello"}).status_code == 401
    assert TestClient(app).post("/api/transcribe").status_code == 401
    assert voice_client("vance").post("/api/voice-session", json=body).status_code == 403
    surgeon = voice_client("surgeon")
    assert surgeon.post("/api/voice-session", json=body).status_code == 403
    assert surgeon.post("/api/speech", json={"text": "Hello"}).status_code == 403
