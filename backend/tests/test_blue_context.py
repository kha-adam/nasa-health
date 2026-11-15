"""BLUE must use dashboard facts without leaking another crew member's health."""

import pytest

from core import blue_context, crew_life, profiles, psychologist, telemetry, metrics
from schemas import ChatMessage


@pytest.fixture(autouse=True)
def reset():
    profiles.load_seed()
    crew_life.load_seed()


def test_context_matches_dashboard_and_chart_stats():
    profile = profiles.get_profile("astro-lin")
    context = blue_context.dashboard_context(profile)
    assert context["crew_life"] == crew_life.board(profile.id).model_dump()
    expected = telemetry.history(profile, profiles.get_telemetry(profile.id), metrics.BY_KEY["spo2"], "7d")
    assert context["metric_history"]["spo2"]["7d"]["stats"] == [s.model_dump() for s in expected.stats]
    assert context["mental_reports"] == [r.model_dump() for r in profile.mental_reports]
    assert len(context["metric_catalog"]) == len(metrics.CATALOG)
    # Shared names/roles are allowed, other astronauts' vitals/reports are not.
    assert all(set(member) == {"id", "name", "role", "avatar_initials"} for member in context["crew_life"]["crew"])
    assert "points" not in context["metric_history"]["spo2"]["7d"]


def test_context_refreshes_after_checkin_without_mutating_profile():
    profile = profiles.get_profile("astro-lin")
    before = blue_context.dashboard_context(profile)
    crew_life.record_checkin(profile)
    after = blue_context.dashboard_context(profile)
    assert len(after["crew_life"]["challenge"]["your_days"]) == len(before["crew_life"]["challenge"]["your_days"]) + 1
    assert "crew_life" not in profile.model_dump()


def test_fallback_answers_title_holder_and_metric_with_real_data():
    profile = profiles.get_profile("astro-chen")
    answer = blue_context.dashboard_answer(profile, "Who is Sleep Captain?")
    assert "Rewards regularity, not hours slept" in answer
    answer = blue_context.dashboard_answer(profile, "What is my blood oxygen?")
    assert str(profile.current_vitals.spo2_percent) in answer
    assert "not a diagnosis" in answer
    assert blue_context.dashboard_answer(profile, "I feel dizzy, is my blood pressure okay?") is None


def test_dashboard_question_does_not_advance_checkin():
    profile = profiles.get_profile("astro-vance")
    answer = ChatMessage(role="user", content="My energy is good today")
    _, _, wrap = psychologist.scripted_reply(profile, [answer, ChatMessage(role="user", content="What are the weekly titles?")])
    assert wrap is False
    reply, _, wrap = psychologist.scripted_reply(profile, [ChatMessage(role="user", content="What are the weekly titles?"), answer])
    assert "How is the crew feeling" in reply
    assert wrap is False
