"""Crew life: weekly titles, crew challenge, rewards aboard, mission map."""

import pytest
from fastapi.testclient import TestClient

from core import auth, crew_life, profiles
from main import app

PASSWORDS = {
    "vance": "blue-vance-2035",
    "chen": "blue-chen-2035",
    "lin": "blue-lin-2035",
    "surgeon": "blue-surgeon-2035",
}
IDS = {"vance": "astro-vance", "chen": "astro-chen", "lin": "astro-lin"}


@pytest.fixture(autouse=True)
def reset_store():
    profiles.load_seed()
    crew_life.load_seed()
    auth.reset_state()


def client_for(username: str) -> TestClient:
    c = TestClient(app)
    r = c.post("/api/auth/login", json={"username": username, "password": PASSWORDS[username]})
    assert r.status_code == 200, r.text
    return c


def board(c) -> dict:
    r = c.get("/api/crew-life")
    assert r.status_code == 200, r.text
    return r.json()


def title(b: dict, code: str) -> dict:
    return next(t for t in b["titles"] if t["code"] == code)


def file_checkin(c, username: str, session_id: str | None = None, answers: int = 1) -> dict:
    messages = [{"role": "assistant", "content": "How are you today?"}]
    messages += [{"role": "user", "content": f"Doing fine, answer {i}."} for i in range(answers)]
    body = {"astronaut_id": IDS[username], "messages": messages, "finish_session": True}
    if session_id:
        body["session_id"] = session_id
    r = c.post("/api/chat", json=body)
    assert r.status_code == 200, r.text
    return r.json()


# --------------------------------------------------------------------------
# Week, access and privacy
# --------------------------------------------------------------------------


def test_week_21_covers_days_144_to_150():
    assert crew_life.week_of(150) == 21 and crew_life.week_bounds(21) == (144, 150)
    assert crew_life.week_of(3) == 0 and crew_life.week_of(4) == 1
    b = board(client_for("lin"))
    assert (b["week"], b["week_start_day"], b["week_end_day"], b["mission_day"]) == (21, 144, 150, 150)


def test_crew_life_requires_login_and_is_closed_to_the_flight_surgeon():
    assert TestClient(app).get("/api/crew-life").status_code == 401
    surgeon = client_for("surgeon")
    assert surgeon.get("/api/crew-life").status_code == 403
    assert surgeon.post("/api/crew-life/rituals", json={"kind": "breathing"}).status_code == 403
    assert surgeon.post("/api/crew-life/encouragements",
                        json={"to_id": "astro-chen", "message": "Hi"}).status_code == 403


def test_board_names_leaders_but_never_shows_other_crewmates_numbers():
    b = board(client_for("lin"))
    text = str(b)
    # Chen's own figures (9 pauses, 16 BLUE messages) never reach Lin.
    assert "9 pauses" not in text and "16 messages" not in text
    for t in b["titles"]:
        assert set(t) == {"code", "name", "criterion", "holders", "you_hold", "your_value", "perk"}
    # Encouragements: only those sent to or by Lin.
    for e in b["encouragements_received"]:
        assert e["to_id"] == "astro-lin"
    for e in b["encouragements_sent"]:
        assert e["from_id"] == "astro-lin"


def test_seeded_titles_follow_the_crew_story():
    b = board(client_for("lin"))
    assert title(b, "calm_keeper")["holders"] == ["astro-chen"]
    assert title(b, "checkin_star")["holders"] == ["astro-vance"]
    assert title(b, "station_voice")["holders"] == ["astro-lin"]
    assert title(b, "crew_compass")["holders"] == ["astro-vance"]
    assert {t["code"] for t in b["titles"] if t["you_hold"]} == {"station_voice", "sleep_captain"}
    names = {t["code"]: t["name"] for t in b["titles"]}
    assert names == {"calm_keeper": "Keeper of Calm", "checkin_star": "Check-in Star",
                     "station_voice": "Voice of the Station", "sleep_captain": "Sleep Captain",
                     "crew_compass": "Crew Compass"}


def test_sleep_captain_rewards_regular_bedtime_from_the_data():
    # Chen's bedtime drifted 22:45 -> 22:00 over days 144-150; Vance and Lin kept 22:00.
    b = board(client_for("chen"))
    assert title(b, "sleep_captain")["holders"] == ["astro-vance", "astro-lin"]
    assert title(b, "sleep_captain")["your_value"].startswith("Bedtime within ±13 min")
    spread, nights = crew_life._bedtime_spread("astro-chen", 21, 150)
    assert nights == 7 and 12 < spread < 14
    assert crew_life._bedtime_spread("astro-vance", 21, 150) == (0.0, 7)


# --------------------------------------------------------------------------
# Crew challenge, immediate reward and the mission map
# --------------------------------------------------------------------------


def test_checkin_gives_an_immediate_reward_and_completes_the_crew_challenge():
    lin = client_for("lin")
    before = board(lin)
    assert before["challenge"]["crew_on_target"] == 2 and not before["challenge"]["completed"]
    stars = before["stars"]

    res = file_checkin(lin, "lin")
    reward = res["reward"]
    assert res["generated_report"]["earth_status"] == "QUEUED_FOR_EARTH"
    assert reward["first_today"] and reward["checkin_days"] == 5 and reward["target_days"] == 5
    assert reward["challenge_just_completed"] and reward["challenge_completed"]
    assert reward["stars"] == stars + 1
    assert "Maya" in reward["thank_you"] and "star" in reward["thank_you"]
    assert reward["space_fact"] in crew_life.SPACE_FACTS

    after = board(lin)
    assert after["challenge"]["completed"] and after["challenge"]["crew_on_target"] == 3
    assert after["stars"] == stars + 1 and after["mission_map"][-1] == {
        "week": 21, "start_day": 144, "end_day": 150, "completed": True, "current": True}
    assert {"code": "crew_challenge", "name": "Crew Challenge", "week": 21, "current": True} in after["patches"]

    # A second check-in the same day is thanked but not counted twice, with a new fact.
    again = file_checkin(lin, "lin")["reward"]
    assert not again["first_today"] and again["checkin_days"] == 5 and not again["challenge_just_completed"]
    assert again["space_fact"] != reward["space_fact"]


def test_crew_reward_vote_unlocks_with_the_challenge():
    lin, vance = client_for("lin"), client_for("vance")
    r = lin.post("/api/crew-life/challenge/vote", json={"option": "film_the_martian"})
    assert r.status_code == 409
    file_checkin(lin, "lin")
    assert lin.post("/api/crew-life/challenge/vote", json={"option": "nope"}).status_code == 422
    lin.post("/api/crew-life/challenge/vote", json={"option": "film_the_martian"})
    b = vance.post("/api/crew-life/challenge/vote", json={"option": "meal_pizza"}).json()
    assert b["challenge"]["your_vote"] == "meal_pizza"
    assert b["challenge"]["vote_counts"]["film_the_martian"] == 1
    assert b["challenge"]["reward_choice"] == "film_the_martian"  # ties go to the first listed option
    b = client_for("chen").post("/api/crew-life/challenge/vote", json={"option": "meal_pizza"}).json()
    assert b["challenge"]["reward_choice"] == "meal_pizza"


def test_mission_map_has_one_star_per_completed_week():
    b = board(client_for("vance"))
    assert [w["week"] for w in b["mission_map"]] == list(range(1, 22))
    assert b["stars"] == sum(w["completed"] for w in b["mission_map"]) == 16


# --------------------------------------------------------------------------
# Titles change with what the crew does
# --------------------------------------------------------------------------


def test_encouragements_make_lin_the_crew_compass():
    lin = client_for("lin")
    for message in ["Great job on the EVA prep!", "Thanks for the help today.", "You've got this."]:
        b = lin.post("/api/crew-life/encouragements", json={"to_id": "astro-chen", "message": message}).json()
    assert title(b, "crew_compass")["holders"] == ["astro-lin"]
    r = lin.post("/api/crew-life/encouragements", json={"to_id": "astro-chen", "message": "One more"})
    assert r.status_code == 409  # 3 a day is plenty
    # Chen receives them; Vance never sees them.
    chen_inbox = board(client_for("chen"))["encouragements_received"]
    assert chen_inbox[0]["from_id"] == "astro-lin" and chen_inbox[0]["mission_day"] == 150
    assert all(e["to_id"] == "astro-vance" for e in board(client_for("vance"))["encouragements_received"])


def test_encouragement_rules():
    lin = client_for("lin")
    assert lin.post("/api/crew-life/encouragements", json={"to_id": "astro-lin", "message": "Me!"}).status_code == 422
    assert lin.post("/api/crew-life/encouragements", json={"to_id": "astro-chen", "message": "   "}).status_code == 422
    assert lin.post("/api/crew-life/encouragements",
                    json={"to_id": "astro-chen", "message": "x" * 141}).status_code == 422


def test_rituals_are_capped_per_day():
    lin = client_for("lin")  # already validated a breathing pause today
    assert lin.post("/api/crew-life/rituals", json={"kind": "breathing"}).status_code == 409
    b = lin.post("/api/crew-life/rituals", json={"kind": "stretch"}).json()
    assert b["rituals_today"] == ["breathing", "stretch"] and b["rituals_week"] == 7
    lin.post("/api/crew-life/rituals", json={"kind": "music"})
    r = lin.post("/api/crew-life/rituals", json={"kind": "gratitude"})
    assert r.status_code == 409 and "Rest counts too" in r.json()["detail"]
    assert lin.post("/api/crew-life/rituals", json={"kind": "nap"}).status_code == 422


def test_voice_of_the_station_counts_each_message_once():
    vance = client_for("vance")
    sid = "session-abc"
    convo = [{"role": "assistant", "content": "Hi"}]
    for i in range(3):
        convo.append({"role": "user", "content": f"message {i}"})
        r = vance.post("/api/chat", json={"astronaut_id": "astro-vance", "messages": convo, "session_id": sid})
        assert r.status_code == 200
        convo.append({"role": "assistant", "content": r.json()["reply"]})
    file_checkin(vance, "vance", session_id=sid, answers=3)  # same conversation: still 3
    assert title(board(vance), "station_voice")["your_value"] == "12 messages to BLUE"  # 9 seeded + 3
    r = vance.post("/api/crew-life/blue-activity",
                   json={"astronaut_id": "astro-vance", "session_id": "voice-1", "user_messages": 2})
    assert r.status_code == 204
    assert title(board(vance), "station_voice")["your_value"] == "14 messages to BLUE"
    # Someone else's tally cannot be touched.
    r = vance.post("/api/crew-life/blue-activity",
                   json={"astronaut_id": "astro-lin", "session_id": "x", "user_messages": 50})
    assert r.status_code == 403


def test_only_the_title_holder_chooses_the_reward_aboard():
    chen, lin = client_for("chen"), client_for("lin")
    r = lin.post("/api/crew-life/perks/station_playlist", json={"option": "Lo-fi orbit"})
    assert r.status_code == 403
    assert chen.post("/api/crew-life/perks/station_playlist", json={"option": "Heavy metal"}).status_code == 422
    b = chen.post("/api/crew-life/perks/station_playlist", json={"option": "Lo-fi orbit"}).json()
    perk = title(b, "calm_keeper")["perk"]
    assert perk["choice"] == "Lo-fi orbit" and perk["chosen_by"] == "astro-chen"
    assert title(board(lin), "calm_keeper")["perk"]["choice"] == "Lo-fi orbit"  # the whole crew sees it
    assert chen.post("/api/crew-life/perks/unknown", json={"option": "x"}).status_code == 422


def test_leaving_the_titles_hides_you_and_passes_the_title_on():
    lin = client_for("lin")
    b = lin.post("/api/crew-life/preferences", json={"share_in_titles": False}).json()
    assert not b["share_in_titles"]
    assert title(b, "station_voice")["holders"] == ["astro-chen"]
    assert title(b, "sleep_captain")["holders"] == ["astro-vance"]
    assert all("astro-lin" not in t["holders"] for t in b["titles"])
    assert title(b, "station_voice")["your_value"] == "21 messages to BLUE"  # still visible to herself
    # Lin's check-ins still count for the crew challenge.
    assert file_checkin(lin, "lin")["reward"]["challenge_just_completed"]


def test_patches_collect_past_titles_and_crew_challenges():
    patches = board(client_for("vance"))["patches"]
    current = [p for p in patches if p["current"]]
    assert {p["code"] for p in current} == {"checkin_star", "sleep_captain", "crew_compass"}
    assert {"code": "crew_compass", "name": "Crew Compass", "week": 20, "current": False} in patches
    assert {"code": "sleep_captain", "name": "Sleep Captain", "week": 20, "current": False} in patches
    assert sum(p["code"] == "crew_challenge" for p in patches) == 16
