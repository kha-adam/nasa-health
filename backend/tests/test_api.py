import pytest
from fastapi.testclient import TestClient

from core import profiles
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_store():
    profiles.load_seed()


def chat(aid, messages, finish=False):
    r = client.post("/api/chat", json={"astronaut_id": aid, "messages": messages, "finish_session": finish})
    assert r.status_code == 200, r.text
    return r.json()


def test_three_canonical_profiles():
    ids = [p["id"] for p in client.get("/api/astronauts").json()]
    assert ids == ["astro-vance", "astro-chen", "astro-lin"]
    chen = client.get("/api/astronauts/astro-chen").json()
    assert chen["current_vitals"]["blood_sugar_mg_dl"] == 62
    assert client.get("/api/astronauts/astro-nope").status_code == 404


@pytest.mark.parametrize("aid,mode", [("astro-vance", "BRIEF_CHECKIN"), ("astro-chen", "DEEP_SUPPORT"), ("astro-lin", "DEEP_SUPPORT")])
def test_mode_from_vitals(aid, mode):
    assert chat(aid, [])["session_mode"] == mode


def run_until_wrap(aid, answers):
    msgs = [{"role": "assistant", "content": chat(aid, [])["reply"]}]
    for i, a in enumerate(answers):
        msgs.append({"role": "user", "content": a})
        res = chat(aid, msgs)
        msgs.append({"role": "assistant", "content": res["reply"]})
        if res["suggested_to_wrap_up"]:
            return i + 1, res, msgs
    return None, res, msgs


def test_brief_checkin_asks_two_questions():
    n, res, _ = run_until_wrap("astro-vance", ["Energy is good, feeling rested.", "Crew morale is great.", "x"])
    assert n == 2 and res["session_mode"] == "BRIEF_CHECKIN"


def test_deep_support_asks_three_to_five_questions():
    n, res, _ = run_until_wrap("astro-lin", ["I feel drained."] + ["ok"] * 6)
    assert 3 <= n <= 5 and res["session_mode"] == "DEEP_SUPPORT"


def test_vance_escalates_on_distress():
    msgs = [{"role": "user", "content": "Honestly I've been exhausted and can't sleep."}]
    assert chat("astro-vance", msgs)["session_mode"] == "DEEP_SUPPORT"


def test_finish_generates_report_and_earth_reply():
    _, _, msgs = run_until_wrap("astro-chen", ["I'm lightheaded, skipped lunch.", "busy", "stressed", "poor sleep", "more time"])
    res = chat("astro-chen", msgs, finish=True)
    rep = res["generated_report"]
    assert rep["earth_status"] == "QUEUED_FOR_EARTH" and rep["earth_psychologist_directive"] is None
    assert "62" in rep["biometric_correlation"]
    reports = client.get("/api/astronauts/astro-chen").json()["mental_reports"]
    assert reports[0]["id"] == rep["id"]

    r = client.post(f"/api/astronauts/astro-chen/reports/{rep['id']}/earth-reply")
    assert r.status_code == 200
    assert r.json()["earth_status"] == "REVIEWED_BY_EARTH" and r.json()["earth_psychologist_directive"]
    assert client.get("/api/astronauts/astro-chen").json()["mental_reports"][0]["earth_status"] == "REVIEWED_BY_EARTH"
