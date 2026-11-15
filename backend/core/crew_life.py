"""Crew life: weekly titles, the crew challenge, rewards aboard and the mission map.

A light "employee of the month", space edition, designed to make check-ins with
BLUE something the crew want to do, without turning wellbeing into a contest:

* Five weekly titles (Keeper of Calm, Check-in Star, Voice of the Station,
  Sleep Captain, Crew Compass). Only the leaders are named, ties are shared,
  nobody is ranked last and nobody sees another crewmate's numbers. Anyone can
  leave the titles at any time (``share_in_titles``).
* One crew challenge per week instead of duels: every crew member checks in
  with BLUE on 5 of the 7 days. Completing it unlocks a shared reward the crew
  votes on (movie night or a special meal), a Crew Challenge prestige badge, and a star on the
  mission map.
* Each title comes with a concrete reward aboard that its holder picks
  (station playlist, a favourite meal on the menu, the wake-up song, the quiet
  hour, the Sunday activity) and a prestige badge whose metal climbs each time.
* Every check-in gets an immediate thank-you and a space fact (CheckinReward).

Sleep Captain rewards a regular bedtime, not hours slept, so nobody feels
pushed to sleep "more". It is computed from the bedtimes the ETL extracts
from the ASTRA CSV (telemetry ``sleep`` block). Everything else is crew activity
inside the app, seeded from backend/data/crew_life.json and kept in memory like
generated reports: restarting the server resets the demo.

Mission weeks start on day 4 (days 1-3 were launch and commissioning), so the
demo's mission day 150 is the last day of week 21 (days 144-150).

Privacy: this board is for astronauts only (main.py returns 403 to the flight
surgeon, like BLUE). It never exposes what anyone said to BLUE, only how many
messages they exchanged, and only through the Voice of the Station leader.
"""

from __future__ import annotations

import json
import threading
import uuid
from dataclasses import dataclass
from pathlib import Path
from statistics import mean, median

from core import profiles
from core.space_facts import SPACE_FACTS
from schemas import (
    AstronautProfile,
    ChallengeStatus,
    CheckinReward,
    CrewLifeBoard,
    CrewMember,
    Encouragement,
    MissionWeek,
    Patch,
    PerkStatus,
    RewardOption,
    RitualOption,
    TitleStanding,
)

SEED_PATH = Path(__file__).resolve().parent.parent / "data" / "crew_life.json"

FIRST_WEEK_DAY = 4
WEEK_LENGTH = 7
CHALLENGE_TARGET_DAYS = 5
MAX_RITUALS_PER_DAY = 3
MAX_ENCOURAGEMENTS_PER_DAY = 3
MIN_SLEEP_NIGHTS = 4


def week_of(day: int) -> int:
    """Mission week of a mission day (0 for launch and commissioning)."""
    return 0 if day < FIRST_WEEK_DAY else (day - FIRST_WEEK_DAY) // WEEK_LENGTH + 1


def week_bounds(week: int) -> tuple[int, int]:
    start = FIRST_WEEK_DAY + (week - 1) * WEEK_LENGTH
    return start, start + WEEK_LENGTH - 1


# --------------------------------------------------------------------------
# Catalog
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class TitleDef:
    code: str
    name: str
    criterion: str
    perk: str
    perk_label: str
    perk_options: tuple[str, ...]


TITLES: list[TitleDef] = [
    TitleDef(
        "calm_keeper", "Keeper of Calm",
        "Most pauses and calming rituals validated this week.",
        "station_playlist", "Choose the station playlist",
        ("Lo-fi orbit", "Ocean & rain sounds", "Jazz for the night shift", "Classical calm", "Crew requests mix"),
    ),
    TitleDef(
        "checkin_star", "Check-in Star",
        "Most regular run of check-ins with BLUE this week.",
        "menu_meal", "Add a favourite meal to this week's menu",
        ("Shrimp cocktail", "Beef lasagna", "Tortilla tacos", "Chicken teriyaki", "Chocolate pudding cake"),
    ),
    TitleDef(
        "station_voice", "Voice of the Station",
        "Talked the most with BLUE this week, whatever the topic.",
        "wakeup_song", "Pick the crew's wake-up song",
        ("Here Comes the Sun", "Space Oddity", "Beautiful Day", "Walking on Sunshine", "Good Morning Starshine"),
    ),
    TitleDef(
        "sleep_captain", "Sleep Captain",
        "Most regular bedtime this week. Rewards regularity, not hours slept.",
        "quiet_hour", "Choose what plays during the crew's quiet hour",
        ("Audiobook: The Little Prince", "Earth soundscape: forest at dawn", "Earth soundscape: ocean waves",
         "Poetry reading"),
    ),
    TitleDef(
        "crew_compass", "Crew Compass",
        "Encouraged crewmates the most this week.",
        "sunday_activity", "Choose the crew's Sunday activity",
        ("Board-game night", "Crew photo session", "Cooking together", "Music jam", "Video message to Earth"),
    ),
]
TITLE_BY_CODE = {t.code: t for t in TITLES}
TITLE_BY_PERK = {t.perk: t for t in TITLES}
CREW_PATCH_NAME = "Crew Challenge"

RITUALS: list[RitualOption] = [
    RitualOption(kind="breathing", label="Breathing pause", minutes=5),
    RitualOption(kind="stretch", label="Stretch break", minutes=10),
    RitualOption(kind="window", label="A moment at the window", minutes=5),
    RitualOption(kind="music", label="Music break", minutes=15),
    RitualOption(kind="wind_down", label="Evening wind-down", minutes=20),
    RitualOption(kind="gratitude", label="Gratitude note", minutes=3),
]

REWARD_OPTIONS: list[RewardOption] = [
    RewardOption(code="film_apollo13", label="Movie night: Apollo 13", kind="film"),
    RewardOption(code="film_hidden_figures", label="Movie night: Hidden Figures", kind="film"),
    RewardOption(code="film_the_martian", label="Movie night: The Martian", kind="film"),
    RewardOption(code="meal_pizza", label="Special meal: pizza night", kind="meal"),
    RewardOption(code="meal_feast", label="Special meal: holiday feast", kind="meal"),
]
REWARD_CODES = [o.code for o in REWARD_OPTIONS]

CHALLENGE_LABEL = f"The whole crew checks in with BLUE on {CHALLENGE_TARGET_DAYS} of {WEEK_LENGTH} days"

# Each astronaut starts the fact list at a different place.
FACT_OFFSET = {"astro-vance": 0, "astro-chen": 8, "astro-lin": 16}

THANKS = [
    "Thank you for checking in, {first}.",
    "Thanks for taking a few minutes with me, {first}.",
    "Check-in logged. Thank you, {first}.",
    "Thank you, {first}. Talking things through is part of the mission too.",
]


class CrewLifeError(Exception):
    """A request the rules refuse; main.py turns it into an HTTP error."""

    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


# --------------------------------------------------------------------------
# State (seeded, then in memory)
# --------------------------------------------------------------------------

_lock = threading.RLock()
_history: dict[int, dict] = {}
_checkins: dict[str, set[int]] = {}
_rituals: list[tuple[str, int, str]] = []
_encouragements: list[Encouragement] = []
_blue_seed: dict[tuple[str, int], int] = {}
_blue_sessions: dict[tuple[str, str], tuple[int, int]] = {}
_blue_unkeyed: dict[tuple[str, int], int] = {}
_perks: dict[tuple[int, str], tuple[str, str]] = {}
_votes: dict[int, dict[str, str]] = {}
_share: dict[str, bool] = {}
_rewards_given: dict[str, int] = {}


def load_seed(path: Path = SEED_PATH) -> None:
    """(Re)load the crew-life seed, discarding in-memory changes."""
    raw = json.loads(path.read_text())
    current = raw["current_week"]
    seed_week = week_of(max(d for days in current["checkin_days"].values() for d in days))
    with _lock:
        _history.clear()
        for item in raw["history"]:
            _history[item["week"]] = {
                "completed": item["challenge_completed"],
                "reward": item.get("reward"),
                "titles": item.get("titles", {}),
            }
        _checkins.clear()
        _checkins.update({aid: set(days) for aid, days in current["checkin_days"].items()})
        _rituals[:] = [(r["astronaut_id"], r["day"], r["kind"]) for r in current["rituals"]]
        _encouragements[:] = [
            Encouragement(id=f"enc-{i:02d}", from_id=e["from_id"], to_id=e["to_id"], mission_day=e["day"],
                          message=e["message"])
            for i, e in enumerate(current["encouragements"], 1)
        ]
        _blue_seed.clear()
        _blue_seed.update({(aid, seed_week): n for aid, n in current["blue_messages"].items()})
        _blue_sessions.clear()
        _blue_unkeyed.clear()
        _perks.clear()
        _votes.clear()
        _share.clear()
        _rewards_given.clear()


def _crew() -> list[AstronautProfile]:
    return profiles.list_profiles()


def _today() -> int:
    return max(p.mission_day for p in _crew())


def _first_name(profile: AstronautProfile) -> str:
    parts = profile.name.split()
    return parts[1] if len(parts) > 1 else parts[0]


def _sharing(aid: str) -> bool:
    return _share.get(aid, True)


# --------------------------------------------------------------------------
# Weekly measures
# --------------------------------------------------------------------------


def _days_in(week: int, today: int) -> tuple[int, int]:
    start, end = week_bounds(week)
    return start, min(end, today)


def _checkin_days(aid: str, week: int, today: int) -> list[int]:
    start, end = _days_in(week, today)
    return sorted(d for d in _checkins.get(aid, set()) if start <= d <= end)


def _longest_run(days: list[int]) -> int:
    best = run = 0
    prev = None
    for d in days:
        run = run + 1 if prev is not None and d == prev + 1 else 1
        best = max(best, run)
        prev = d
    return best


def _streak_ending(days: list[int], today: int) -> int:
    present, n = set(days), 0
    while today - n in present:
        n += 1
    return n


def _rituals_count(aid: str, week: int, today: int) -> int:
    start, end = _days_in(week, today)
    return sum(1 for a, d, _ in _rituals if a == aid and start <= d <= end)


def _encouragements_sent(aid: str, week: int, today: int) -> list[Encouragement]:
    start, end = _days_in(week, today)
    return [e for e in _encouragements if e.from_id == aid and start <= e.mission_day <= end]


def _blue_messages(aid: str, week: int) -> int:
    sessions = sum(n for (a, _), (w, n) in _blue_sessions.items() if a == aid and w == week)
    return _blue_seed.get((aid, week), 0) + _blue_unkeyed.get((aid, week), 0) + sessions


def _bedtime_spread(aid: str, week: int, today: int) -> tuple[float | None, int]:
    """Mean distance (minutes) between each bedtime and the week's median bedtime."""
    tele = profiles.get_telemetry(aid) or {}
    sleep = tele.get("sleep")
    if not sleep:
        return None, 0
    start, end = _days_in(week, today)
    beds = [b for d, b in zip(sleep["day"], sleep["bed_min"]) if start <= d <= end and b is not None]
    if len(beds) < MIN_SLEEP_NIGHTS:
        return None, len(beds)
    mid = median(beds)
    return round(mean(abs(b - mid) for b in beds), 1), len(beds)


def _scores(code: str, crew_ids: list[str], week: int, today: int) -> dict[str, float | None]:
    """Higher is better. None means "not enough data to take part"."""
    out: dict[str, float | None] = {}
    for aid in crew_ids:
        if code == "calm_keeper":
            out[aid] = _rituals_count(aid, week, today)
        elif code == "checkin_star":
            days = _checkin_days(aid, week, today)
            out[aid] = _longest_run(days) * 10 + len(days)  # longest run first, then total days
        elif code == "station_voice":
            out[aid] = _blue_messages(aid, week)
        elif code == "sleep_captain":
            spread, _ = _bedtime_spread(aid, week, today)
            out[aid] = None if spread is None else -spread
        else:
            out[aid] = len(_encouragements_sent(aid, week, today))
    return out


def _holders(code: str, crew_ids: list[str], week: int, today: int, *, respect_sharing: bool = True) -> list[str]:
    scores = _scores(code, crew_ids, week, today)
    eligible = {
        a: s
        for a, s in scores.items()
        if s is not None and (code == "sleep_captain" or s > 0) and (not respect_sharing or _sharing(a))
    }
    if not eligible:
        return []
    best = max(eligible.values())
    return [a for a in crew_ids if a in eligible and abs(eligible[a] - best) < 1e-9]


def _your_value(code: str, aid: str, week: int, today: int) -> str:
    def plural(n: int, word: str) -> str:
        return f"{n} {word}{'' if n == 1 else 's'}"

    if code == "calm_keeper":
        n = _rituals_count(aid, week, today)
        return f"{plural(n, 'pause')} validated" if n else "No pause validated yet"
    if code == "checkin_star":
        days = _checkin_days(aid, week, today)
        if not days:
            return "No check-in yet this week"
        return f"{plural(_longest_run(days), 'day')} in a row · {len(days)} of {WEEK_LENGTH} days"
    if code == "station_voice":
        n = _blue_messages(aid, week)
        return f"{plural(n, 'message')} to BLUE" if n else "No conversation yet this week"
    if code == "sleep_captain":
        spread, nights = _bedtime_spread(aid, week, today)
        if spread is None:
            return f"Needs {MIN_SLEEP_NIGHTS} nights of data ({nights} so far)"
        if spread < 1:
            return f"Same bedtime every night · {plural(nights, 'night')}"
        return f"Bedtime within ±{round(spread)} min · {plural(nights, 'night')}"
    n = len(_encouragements_sent(aid, week, today))
    return f"{plural(n, 'encouragement')} sent" if n else "No encouragement sent yet"


def _challenge_done(crew_ids: list[str], week: int, today: int) -> bool:
    if week in _history and week < week_of(today):
        return bool(_history[week]["completed"])
    return all(len(_checkin_days(a, week, today)) >= CHALLENGE_TARGET_DAYS for a in crew_ids)


def _reward_choice(week: int) -> str | None:
    votes = _votes.get(week, {})
    if not votes:
        return None
    counts = {c: list(votes.values()).count(c) for c in REWARD_CODES}
    best = max(counts.values())
    return next(c for c in REWARD_CODES if counts[c] == best)


def _stars(crew_ids: list[str], today: int) -> int:
    return sum(_challenge_done(crew_ids, w, today) for w in range(1, week_of(today) + 1))


# --------------------------------------------------------------------------
# Board
# --------------------------------------------------------------------------


def board(aid: str) -> CrewLifeBoard:
    crew = _crew()
    crew_ids = [p.id for p in crew]
    if aid not in crew_ids:
        raise CrewLifeError(404, f"Unknown astronaut '{aid}'")
    with _lock:
        today = _today()
        week = week_of(today)
        start, end = week_bounds(week)

        titles = []
        for t in TITLES:
            holders = _holders(t.code, crew_ids, week, today)
            choice = _perks.get((week, t.perk))
            titles.append(
                TitleStanding(
                    code=t.code,
                    name=t.name,
                    criterion=t.criterion,
                    holders=holders,
                    you_hold=aid in holders,
                    your_value=_your_value(t.code, aid, week, today),
                    perk=PerkStatus(
                        code=t.perk,
                        label=t.perk_label,
                        options=list(t.perk_options),
                        choice=choice[0] if choice else None,
                        chosen_by=choice[1] if choice else None,
                    ),
                )
            )

        completed = _challenge_done(crew_ids, week, today)
        votes = _votes.get(week, {})
        challenge = ChallengeStatus(
            week=week,
            start_day=start,
            end_day=end,
            label=CHALLENGE_LABEL,
            target_days=CHALLENGE_TARGET_DAYS,
            your_days=_checkin_days(aid, week, today),
            crew_size=len(crew_ids),
            crew_on_target=sum(len(_checkin_days(a, week, today)) >= CHALLENGE_TARGET_DAYS for a in crew_ids),
            days_left=max(0, end - today),
            completed=completed,
            reward_options=REWARD_OPTIONS,
            vote_counts={c: list(votes.values()).count(c) for c in REWARD_CODES},
            your_vote=votes.get(aid),
            reward_choice=_reward_choice(week) if completed else None,
        )

        mission_map = []
        for w in range(1, week + 1):
            ws, we = week_bounds(w)
            mission_map.append(
                MissionWeek(week=w, start_day=ws, end_day=we, completed=_challenge_done(crew_ids, w, today),
                            current=w == week)
            )

        return CrewLifeBoard(
            astronaut_id=aid,
            mission_day=today,
            week=week,
            week_start_day=start,
            week_end_day=end,
            crew=[CrewMember(id=p.id, name=p.name, role=p.role, avatar_initials=p.avatar_initials) for p in crew],
            titles=titles,
            challenge=challenge,
            mission_map=mission_map,
            stars=sum(w.completed for w in mission_map),
            patches=_patches(aid, crew_ids, titles, completed, week, today),
            ritual_options=RITUALS,
            rituals_today=[k for a, d, k in _rituals if a == aid and d == today],
            rituals_week=_rituals_count(aid, week, today),
            max_rituals_per_day=MAX_RITUALS_PER_DAY,
            encouragements_received=sorted(
                (e for e in _encouragements if e.to_id == aid and start <= e.mission_day <= end),
                key=lambda e: e.mission_day, reverse=True,
            ),
            encouragements_sent=sorted(_encouragements_sent(aid, week, today), key=lambda e: e.mission_day,
                                       reverse=True),
            max_encouragements_per_day=MAX_ENCOURAGEMENTS_PER_DAY,
            share_in_titles=_sharing(aid),
        )


def _patches(aid: str, crew_ids: list[str], titles: list[TitleStanding], completed: bool, week: int,
             today: int) -> list[Patch]:
    """The astronaut's badge history (one entry per title held or crew challenge), newest first."""
    out = [Patch(code=t.code, name=t.name, week=week, current=True) for t in titles if t.you_hold]
    if completed:
        out.append(Patch(code="crew_challenge", name=CREW_PATCH_NAME, week=week, current=True))
    for w in sorted(_history, reverse=True):
        if w >= week:
            continue
        past = dict(_history[w]["titles"])
        if past:  # titles were recorded that week; Sleep Captain always comes from the data
            past["sleep_captain"] = _holders("sleep_captain", crew_ids, w, today, respect_sharing=False)
        out += [Patch(code=t.code, name=t.name, week=w) for t in TITLES if aid in past.get(t.code, [])]
        if _history[w]["completed"]:
            out.append(Patch(code="crew_challenge", name=CREW_PATCH_NAME, week=w))
    return out


# --------------------------------------------------------------------------
# Actions
# --------------------------------------------------------------------------


def validate_ritual(aid: str, kind: str) -> CrewLifeBoard:
    with _lock:
        today = _today()
        done = [k for a, d, k in _rituals if a == aid and d == today]
        if kind in done:
            raise CrewLifeError(409, "Already validated today. Try another pause, or enjoy this one again off the record.")
        if len(done) >= MAX_RITUALS_PER_DAY:
            raise CrewLifeError(409, f"{MAX_RITUALS_PER_DAY} pauses validated today: that's plenty. Rest counts too.")
        _rituals.append((aid, today, kind))
    return board(aid)


def encourage(aid: str, to_id: str, message: str) -> CrewLifeBoard:
    text = " ".join(message.split())
    if not text:
        raise CrewLifeError(422, "Write a few words for your crewmate.")
    if to_id == aid:
        raise CrewLifeError(422, "Encouragements go to a crewmate.")
    if to_id not in {p.id for p in _crew()}:
        raise CrewLifeError(404, f"Unknown astronaut '{to_id}'")
    with _lock:
        today = _today()
        sent_today = sum(1 for e in _encouragements if e.from_id == aid and e.mission_day == today)
        if sent_today >= MAX_ENCOURAGEMENTS_PER_DAY:
            raise CrewLifeError(409, f"{MAX_ENCOURAGEMENTS_PER_DAY} encouragements sent today. Save the next one for tomorrow.")
        _encouragements.append(
            Encouragement(id=f"enc-{uuid.uuid4().hex[:8]}", from_id=aid, to_id=to_id, mission_day=today, message=text)
        )
    return board(aid)


def choose_perk(aid: str, perk: str, option: str) -> CrewLifeBoard:
    title = TITLE_BY_PERK.get(perk)
    if title is None:
        raise CrewLifeError(404, f"Unknown reward '{perk}'")
    if option not in title.perk_options:
        raise CrewLifeError(422, "Pick one of the listed options.")
    crew_ids = [p.id for p in _crew()]
    with _lock:
        today = _today()
        week = week_of(today)
        if aid not in _holders(title.code, crew_ids, week, today):
            raise CrewLifeError(403, f"This week's {title.name} chooses this reward.")
        _perks[(week, perk)] = (option, aid)
    return board(aid)


def vote_reward(aid: str, option: str) -> CrewLifeBoard:
    if option not in REWARD_CODES:
        raise CrewLifeError(422, "Pick one of the listed rewards.")
    crew_ids = [p.id for p in _crew()]
    with _lock:
        today = _today()
        week = week_of(today)
        if not _challenge_done(crew_ids, week, today):
            raise CrewLifeError(
                409, f"The crew reward unlocks once everyone has checked in on {CHALLENGE_TARGET_DAYS} days this week."
            )
        _votes.setdefault(week, {})[aid] = option
    return board(aid)


def set_sharing(aid: str, share: bool) -> CrewLifeBoard:
    with _lock:
        _share[aid] = share
    return board(aid)


def record_blue_messages(aid: str, session_id: str | None, user_messages: int) -> None:
    """Tally messages to BLUE for Voice of the Station.

    With a session id, the highest count seen for that conversation is kept, so
    re-sending the transcript (every backup turn, voice reconnects, filing the
    report) never counts a message twice. Without one, call this once, when
    the conversation is filed.
    """
    if user_messages <= 0:
        return
    with _lock:
        week = week_of(_today())
        if session_id is None:
            _blue_unkeyed[(aid, week)] = _blue_unkeyed.get((aid, week), 0) + user_messages
            return
        key = (aid, session_id)
        seen_week, seen = _blue_sessions.get(key, (week, 0))
        _blue_sessions[key] = (seen_week, max(seen, user_messages))


def record_checkin(profile: AstronautProfile) -> CheckinReward:
    """Count today's check-in and return the immediate reward."""
    crew_ids = [p.id for p in _crew()]
    aid, today = profile.id, profile.mission_day
    with _lock:
        week = week_of(today)
        was_done = _challenge_done(crew_ids, week, today)
        days_set = _checkins.setdefault(aid, set())
        first_today = today not in days_set
        days_set.add(today)
        now_done = _challenge_done(crew_ids, week, today)
        days = _checkin_days(aid, week, today)
        n = _rewards_given.get(aid, 0)
        _rewards_given[aid] = n + 1
        stars = _stars(crew_ids, today)

    first = _first_name(profile)
    parts = [THANKS[n % len(THANKS)].format(first=first)]
    just_done = now_done and not was_done
    if just_done:
        parts.append(
            f"Your check-in completed the crew challenge: everyone reached {CHALLENGE_TARGET_DAYS} days this week. "
            "A new star joins the mission map and the crew reward is unlocked."
        )
    elif not first_today:
        parts.append("Today was already counted for the crew challenge. Thanks for coming back.")
    elif now_done:
        parts.append("The crew challenge is already complete this week, so this one is a bonus.")
    elif len(days) >= CHALLENGE_TARGET_DAYS:
        parts.append(f"That makes {len(days)} days this week: your part of the crew challenge is done.")
    else:
        parts.append(f"That's day {len(days)} of {CHALLENGE_TARGET_DAYS} for this week's crew challenge.")

    return CheckinReward(
        thank_you=" ".join(parts),
        space_fact=SPACE_FACTS[(FACT_OFFSET.get(aid, 0) + n) % len(SPACE_FACTS)],
        checkin_days=len(days),
        target_days=CHALLENGE_TARGET_DAYS,
        streak_days=_streak_ending(days, today),
        first_today=first_today,
        challenge_completed=now_done,
        challenge_just_completed=just_done,
        stars=stars,
    )


load_seed()
