import pytest
from fastapi.testclient import TestClient

from core import auth, profiles
from main import app

PASSWORDS = {
    "vance": "blue-vance-2035",
    "chen": "blue-chen-2035",
    "lin": "blue-lin-2035",
    "surgeon": "blue-surgeon-2035",
}


@pytest.fixture(autouse=True)
def reset_store():
    profiles.load_seed()
    auth.reset_state()


def client_for(username: str | None) -> TestClient:
    c = TestClient(app)
    if username:
        r = c.post("/api/auth/login", json={"username": username, "password": PASSWORDS[username]})
        assert r.status_code == 200, r.text
    return c


def chat(c, aid, messages, finish=False):
    r = c.post("/api/chat", json={"astronaut_id": aid, "messages": messages, "finish_session": finish})
    assert r.status_code == 200, r.text
    return r.json()


# --------------------------------------------------------------------------
# Authentication
# --------------------------------------------------------------------------


def test_everything_requires_login():
    c = client_for(None)
    assert c.get("/api/health").status_code == 200
    for path in ["/api/astronauts", "/api/astronauts/astro-chen", "/api/metrics", "/api/auth/me",
                 "/api/astronauts/astro-chen/metrics/heart_rate"]:
        assert c.get(path).status_code == 401, path
    assert c.post("/api/chat", json={"astronaut_id": "astro-chen", "messages": []}).status_code == 401


def test_login_sets_httponly_cookie_and_logout_ends_session():
    c = TestClient(app)
    r = c.post("/api/auth/login", json={"username": "Chen ", "password": PASSWORDS["chen"]})
    assert r.status_code == 200
    assert r.json() == {"username": "chen", "display_name": "Eng. Marcus Chen", "role": "astronaut",
                        "astronaut_id": "astro-chen"}
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    assert "password_hash" not in r.text
    assert c.get("/api/auth/me").status_code == 200
    assert c.post("/api/auth/logout").status_code == 204
    assert c.get("/api/auth/me").status_code == 401


def test_wrong_password_and_unknown_user_look_the_same():
    c = TestClient(app)
    a = c.post("/api/auth/login", json={"username": "chen", "password": "nope"})
    b = c.post("/api/auth/login", json={"username": "nobody", "password": "nope"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


def test_repeated_failures_lock_the_account():
    c = TestClient(app)
    for _ in range(auth.MAX_FAILURES):
        assert c.post("/api/auth/login", json={"username": "lin", "password": "bad"}).status_code == 401
    r = c.post("/api/auth/login", json={"username": "lin", "password": PASSWORDS["lin"]})
    assert r.status_code == 429 and "retry-after" in r.headers


def test_cross_origin_post_is_rejected():
    c = TestClient(app)
    r = c.post("/api/auth/login", json={"username": "chen", "password": PASSWORDS["chen"]},
               headers={"Origin": "https://evil.example"})
    assert r.status_code == 403


def test_api_responses_are_not_cacheable():
    c = client_for("vance")
    assert c.get("/api/astronauts/astro-vance").headers["cache-control"] == "no-store"


# --------------------------------------------------------------------------
# Privacy rules
# --------------------------------------------------------------------------


def test_astronaut_sees_only_their_own_data():
    c = client_for("chen")
    assert [p["id"] for p in c.get("/api/astronauts").json()] == ["astro-chen"]
    assert c.get("/api/astronauts/astro-chen").json()["mental_reports"]
    for path in ["/api/astronauts/astro-lin", "/api/astronauts/astro-lin/metrics/heart_rate"]:
        assert c.get(path).status_code == 403, path
    assert c.post("/api/chat", json={"astronaut_id": "astro-lin", "messages": []}).status_code == 403
    assert c.post("/api/astronauts/astro-lin/reports/rep-201/earth-reply").status_code == 403


def test_flight_surgeon_gets_medical_view_without_mental_health_data():
    c = client_for("surgeon")
    crew = c.get("/api/astronauts").json()
    assert [p["id"] for p in crew] == ["astro-vance", "astro-chen", "astro-lin"]
    for p in crew:
        assert p["mental_redacted"] is True
        assert p["mental_reports"] == [] and p["body_highlights"]["mental"] == []
        assert p["current_vitals"]["voice_stress_index"] is None
        assert p["current_vitals"]["heart_rate_bpm"] is not None
        assert "voice_stress" not in p["metric_status"]
        assert all("voice_stress" not in e["metrics"] for e in p["events"])
    keys = {m["key"] for m in c.get("/api/metrics").json()}
    assert "heart_rate" in keys and "voice_stress" not in keys
    assert c.get("/api/astronauts/astro-chen/metrics/heart_rate").status_code == 200
    assert c.get("/api/astronauts/astro-chen/metrics/voice_stress").status_code == 403
    assert c.post("/api/chat", json={"astronaut_id": "astro-chen", "messages": []}).status_code == 403
    assert c.post("/api/astronauts/astro-lin/reports/rep-201/earth-reply").status_code == 403


# --------------------------------------------------------------------------
# Data derived from the ASTRA CSV
# --------------------------------------------------------------------------


@pytest.mark.parametrize("user,aid,status", [("vance", "astro-vance", "NOMINAL"), ("chen", "astro-chen", "ADVISORY"),
                                             ("lin", "astro-lin", "ADVISORY")])
def test_status_comes_from_the_data(user, aid, status):
    p = client_for(user).get(f"/api/astronauts/{aid}").json()
    assert p["status_tag"] == status
    assert p["mission_day"] == 150


def test_events_are_surfaced():
    lin = client_for("lin").get("/api/astronauts/astro-lin").json()
    acute = next(e for e in lin["events"] if e["code"] == "ACUTE_DIZZINESS_BREATHLESSNESS")
    assert acute["mission_day"] == 148 and acute["severity"] == "URGENT" and "88.5" in acute["detail"]
    chen = client_for("chen").get("/api/astronauts/astro-chen").json()
    assert {"SLOW_DRIFT_SLEEP_STRESS", "PRE_SLEEP_LIGHT_ADVANCED", "CO2_REMOVAL_DEGRADED"} <= {
        e["code"] for e in chen["events"]
    }


@pytest.mark.parametrize("rng,resolution,count", [("24h", "15min", 96), ("7d", "hourly", 168), ("30d", "daily", 30),
                                                  ("all", "daily", 150)])
def test_metric_history_ranges(rng, resolution, count):
    r = client_for("lin").get(f"/api/astronauts/astro-lin/metrics/spo2?range={rng}")
    assert r.status_code == 200
    body = r.json()
    assert body["resolution"] == resolution and len(body["points"]) == count
    assert body["stats"][0]["field"] == "spo2_percent"


def test_metric_history_includes_events_in_range():
    body = client_for("lin").get("/api/astronauts/astro-lin/metrics/spo2?range=7d").json()
    assert any(e["code"] == "ACUTE_DIZZINESS_BREATHLESSNESS" for e in body["events"])
    assert body["stats"][0]["min"] == 88.5


def test_unknown_metric_and_range():
    c = client_for("lin")
    assert c.get("/api/astronauts/astro-lin/metrics/nope").status_code == 404
    assert c.get("/api/astronauts/astro-lin/metrics/spo2?range=1y").status_code == 422


# --------------------------------------------------------------------------
# BLUE conversation
# --------------------------------------------------------------------------


@pytest.mark.parametrize("user,aid,mode", [("vance", "astro-vance", "BRIEF_CHECKIN"), ("chen", "astro-chen", "DEEP_SUPPORT"),
                                           ("lin", "astro-lin", "DEEP_SUPPORT")])
def test_mode_from_status(user, aid, mode):
    assert chat(client_for(user), aid, [])["session_mode"] == mode


def run_until_wrap(c, aid, answers):
    msgs = [{"role": "assistant", "content": chat(c, aid, [])["reply"]}]
    for i, a in enumerate(answers):
        msgs.append({"role": "user", "content": a})
        res = chat(c, aid, msgs)
        msgs.append({"role": "assistant", "content": res["reply"]})
        if res["suggested_to_wrap_up"]:
            return i + 1, res, msgs
    return None, res, msgs


def test_brief_checkin_asks_two_questions():
    n, res, _ = run_until_wrap(client_for("vance"), "astro-vance",
                               ["Energy is good, feeling rested.", "Crew morale is great.", "x"])
    assert n == 2 and res["session_mode"] == "BRIEF_CHECKIN"


def test_deep_support_asks_three_to_five_questions():
    n, res, _ = run_until_wrap(client_for("lin"), "astro-lin", ["I feel drained."] + ["ok"] * 6)
    assert 3 <= n <= 5 and res["session_mode"] == "DEEP_SUPPORT"


def test_lin_opening_mentions_the_episode_day():
    assert "day 148" in chat(client_for("lin"), "astro-lin", [])["reply"]


def test_vance_escalates_on_distress():
    msgs = [{"role": "user", "content": "Honestly I've been exhausted and can't sleep."}]
    assert chat(client_for("vance"), "astro-vance", msgs)["session_mode"] == "DEEP_SUPPORT"


def test_finish_generates_report_and_earth_reply():
    c = client_for("lin")
    _, _, msgs = run_until_wrap(c, "astro-lin", ["Still a bit dizzy and anxious about it.", "no", "worried", "poor sleep", "less lab"])
    res = chat(c, "astro-lin", msgs, finish=True)
    rep = res["generated_report"]
    assert rep["earth_status"] == "QUEUED_FOR_EARTH" and rep["earth_psychologist_directive"] is None
    assert "88.5" in rep["biometric_correlation"]
    assert "21m" in res["reply"]  # Earth delay taken from the data
    reports = c.get("/api/astronauts/astro-lin").json()["mental_reports"]
    assert reports[0]["id"] == rep["id"]

    r = c.post(f"/api/astronauts/astro-lin/reports/{rep['id']}/earth-reply")
    assert r.status_code == 200
    assert r.json()["earth_status"] == "REVIEWED_BY_EARTH" and r.json()["earth_psychologist_directive"]
    assert c.get("/api/astronauts/astro-lin").json()["mental_reports"][0]["earth_status"] == "REVIEWED_BY_EARTH"
