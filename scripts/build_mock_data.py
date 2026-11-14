#!/usr/bin/env python3
"""Offline ETL for Project BLUE: ASTRA telemetry CSV -> backend seed files.

Input : data/source/astra_donnees_etendues.csv
        (run scripts/expand_dataset.py first; it extends the original
        data/source/astra_donnees_simulees.csv back to mission day 1)
Output: backend/data/astronauts.json          3 canonical profiles
        backend/data/telemetry/<id>.json      per-astronaut history, columnar:
            raw    — 15-minute samples, last 24 h
            hourly — mean/min/max per hour, last 7 days
            daily  — mean/min/max per mission day, whole mission

Crew mapping: C1 -> astro-vance, C2 -> astro-chen, C3 -> astro-lin (C4 is not
part of the demo crew). Everything shown in the app — current values, status
tags, body highlights, mission events and the seeded psychologist reports — is
derived from the CSV here, once. The API never parses CSV at runtime.

Usage:
    python scripts/build_mock_data.py            # write the seed files
    python scripts/build_mock_data.py --check    # validate committed seeds
"""

from __future__ import annotations

import argparse
import csv
import json
import statistics as st
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from core.metrics import BY_KEY, CATALOG, CSV_FIELDS, FIELDS, metric_status, worst  # noqa: E402
from schemas import AstronautProfile  # noqa: E402

SRC = ROOT / "data" / "source" / "astra_donnees_etendues.csv"
OUT_PROFILES = ROOT / "backend" / "data" / "astronauts.json"
OUT_TELEMETRY = ROOT / "backend" / "data" / "telemetry"

CREW = {
    "C1": {"id": "astro-vance", "name": "Cmdr. Elena Vance", "role": "Commander", "initials": "EV"},
    "C2": {"id": "astro-chen", "name": "Eng. Marcus Chen", "role": "Flight Engineer", "initials": "MC"},
    "C3": {"id": "astro-lin", "name": "Spec. Maya Lin", "role": "Mission Specialist", "initials": "ML"},
}

ACTIVITY = {
    "sommeil": "Asleep",
    "travail": "Working",
    "loisir": "Leisure",
    "repas": "Meal",
    "exercice": "Exercise",
    "hygiene": "Hygiene",
    "repos_medical": "Medical rest",
}

FOLLOW_UP_DAYS = 7  # a crew event keeps the astronaut ADVISORY this long after it ends


# --------------------------------------------------------------------------
# Loading
# --------------------------------------------------------------------------


def parse_ts(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def load() -> dict[str, list[dict]]:
    if not SRC.exists():
        raise SystemExit(f"{SRC.relative_to(ROOT)} not found — run scripts/expand_dataset.py first")
    by_crew: dict[str, list[dict]] = defaultdict(list)
    with SRC.open(newline="") as fh:
        for raw in csv.DictReader(fh):
            if raw["crew_id"] not in CREW:
                continue
            row = {
                "ts": parse_ts(raw["timestamp_utc"]),
                "day": int(raw["mission_day"]),
                "activity": raw["activity_state"],
                "event": raw["injected_event"],
                "label": raw["ground_truth_label"],
            }
            for col, field in CSV_FIELDS.items():
                row[field] = float(raw[col]) if raw[col] != "" else None
            by_crew[raw["crew_id"]].append(row)
    for rows in by_crew.values():
        rows.sort(key=lambda r: r["ts"])
    return by_crew


# --------------------------------------------------------------------------
# Aggregation
# --------------------------------------------------------------------------


def r2(x: float | None, nd: int = 2) -> float | None:
    return None if x is None else round(x, nd)


def aggregate(rows: list[dict], key) -> dict:
    groups: dict[object, list[dict]] = {}
    for r in rows:
        groups.setdefault(key(r), []).append(r)
    out = {"t": [], "day": [], "activity": [], "fields": {f: {"mean": [], "min": [], "max": []} for f in FIELDS}}
    for _, grp in groups.items():
        out["t"].append(iso(grp[0]["ts"]))
        out["day"].append(grp[0]["day"])
        out["activity"].append(ACTIVITY.get(Counter(g["activity"] for g in grp).most_common(1)[0][0]))
        for f in FIELDS:
            vals = [g[f] for g in grp if g[f] is not None]
            out["fields"][f]["mean"].append(r2(st.mean(vals)) if vals else None)
            out["fields"][f]["min"].append(r2(min(vals)) if vals else None)
            out["fields"][f]["max"].append(r2(max(vals)) if vals else None)
    return out


def telemetry(rows: list[dict]) -> dict:
    now = rows[-1]["ts"]
    raw_rows = [r for r in rows if r["ts"] > now - timedelta(hours=24)]
    hourly_rows = [r for r in rows if r["ts"] > now - timedelta(days=7)]
    return {
        "raw": {
            "t": [iso(r["ts"]) for r in raw_rows],
            "day": [r["day"] for r in raw_rows],
            "activity": [ACTIVITY.get(r["activity"]) for r in raw_rows],
            "fields": {f: [r[f] for r in raw_rows] for f in FIELDS},
        },
        "hourly": aggregate(hourly_rows, lambda r: r["ts"].replace(minute=0)),
        "daily": aggregate(rows, lambda r: r["day"]),
    }


def daily_means(rows: list[dict], field: str) -> dict[int, float]:
    acc: dict[int, list[float]] = defaultdict(list)
    for r in rows:
        if r[field] is not None:
            acc[r["day"]].append(r[field])
    return {d: st.mean(v) for d, v in acc.items()}


def latest(rows: list[dict]) -> dict[str, float | None]:
    out: dict[str, float | None] = {f: None for f in FIELDS}
    for r in reversed(rows):
        for f in FIELDS:
            if out[f] is None and r[f] is not None:
                out[f] = r[f]
        if all(v is not None for v in out.values()):
            break
    return out


def mean_where(rows: list[dict], field: str, pred) -> float | None:
    vals = [r[field] for r in rows if pred(r) and r[field] is not None]
    return st.mean(vals) if vals else None


# --------------------------------------------------------------------------
# Events
# --------------------------------------------------------------------------


def runs(rows: list[dict], pred) -> list[list[dict]]:
    """Consecutive stretches of rows matching pred."""
    out, cur = [], []
    for r in rows:
        if pred(r):
            cur.append(r)
        elif cur:
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def detect_events(crew: str, rows: list[dict]) -> list[dict]:
    events: list[dict] = []

    # Acute episode: injected VERTIGES_* followed by ACUTE_EN_COURS / RECUPERATION rows.
    for run in runs(rows, lambda r: r["label"] == "aigu"):
        start, end = run[0]["ts"], run[-1]["ts"] + timedelta(minutes=15)
        spo2 = min(r["spo2_percent"] for r in run if r["spo2_percent"] is not None)
        hr = max(r["heart_rate_bpm"] for r in run if r["heart_rate_bpm"] is not None)
        rr = max(r["resp_rate_bpm"] for r in run if r["resp_rate_bpm"] is not None)
        sbp = min(r["systolic_bp"] for r in run if r["systolic_bp"] is not None)
        mins = int((end - start).total_seconds() // 60)
        events.append({
            "code": "ACUTE_DIZZINESS_BREATHLESSNESS",
            "scope": "crew",
            "severity": "URGENT",
            "label": "Dizziness & breathlessness during exercise",
            "detail": f"Exercise stopped and {mins} min of medical rest. SpO₂ fell to {spo2:g} %, heart rate peaked at "
            f"{hr:g} BPM, breathing at {rr:g}/min and systolic pressure dropped to {sbp:g} mmHg, then all recovered.",
            "start": start, "end": end, "day": run[0]["day"],
            "metrics": ["spo2", "heart_rate", "respiration", "blood_pressure", "voice_stress"],
            "peaks": {"spo2_min": spo2, "hr_max": hr, "resp_max": rr,
                      "voice_max": max((r["voice_stress_index"] or 0) for r in run)},
        })

    # Slow drift label (derive_lente) -> one event spanning the drift.
    for run in runs(rows, lambda r: r["label"] == "derive_lente"):
        d0, d1 = run[0]["day"], run[-1]["day"]
        win = [r for r in rows if d0 <= r["day"] <= d1]
        awak = max(r["sleep_awakenings"] for r in win if r["sleep_awakenings"] is not None)
        sleep_min = min(r["sleep_hours"] for r in win if r["sleep_hours"] is not None)
        hrv_daily = daily_means(win, "hrv_rmssd_ms")
        voice_daily = daily_means(win, "voice_stress_index")
        cort = max(r["cortisol_nmol_l"] for r in win if r["cortisol_nmol_l"] is not None)
        events.append({
            "code": "SLOW_DRIFT_SLEEP_STRESS",
            "scope": "crew",
            "severity": "ADVISORY",
            "label": "Gradual sleep & stress drift",
            "detail": f"Over days {d0}–{d1} sleep fell to {sleep_min:g} h with up to {awak:g} awakenings a night, "
            f"daily HRV dropped to {min(hrv_daily.values()):.0f} ms and morning cortisol reached {cort:g} nmol/L.",
            "start": run[0]["ts"], "end": run[-1]["ts"] + timedelta(minutes=15), "day": d0,
            "metrics": ["sleep_awakenings", "sleep_duration", "sleep_efficiency", "hrv", "cortisol",
                        "voice_stress", "speech_rate", "blink_rate"],
            "peaks": {"awakenings_max": awak, "sleep_min": sleep_min, "hrv_min": min(hrv_daily.values()),
                      "voice_max": max(voice_daily.values()), "cortisol_max": cort},
        })

    # Point events written by the habitat's ASTRA assistant.
    for r in rows:
        code = r["event"]
        if code.startswith("ASTRA_LUMIERE_PRE_SOMMEIL"):
            events.append({
                "code": "PRE_SLEEP_LIGHT_ADVANCED", "scope": "crew", "severity": "NOMINAL",
                "label": "Evening lighting moved earlier",
                "detail": "Habitat switched this crew member's cabin to warm, dim light earlier in the evening to "
                "help them fall asleep.",
                "start": r["ts"], "end": None, "day": r["day"],
                "metrics": ["sleep_duration", "sleep_awakenings", "sleep_efficiency", "light_color", "light"],
            })
        elif code == "DEGRADATION_ELIMINATION_CO2_DEBUT":
            events.append({
                "code": "CO2_REMOVAL_DEGRADED", "scope": "cabin", "severity": "ADVISORY",
                "label": "CO₂ removal system degrading",
                "detail": "The CO₂ scrubber started losing efficiency; cabin CO₂ climbed over the following days.",
                "start": r["ts"], "end": None, "day": r["day"], "metrics": ["cabin_co2", "respiration"],
            })
        elif code == "ASTRA_VENTILATION_RENFORCEE":
            events.append({
                "code": "VENTILATION_BOOSTED", "scope": "cabin", "severity": "NOMINAL",
                "label": "Ventilation boosted",
                "detail": "Habitat increased air circulation to bring cabin CO₂ back down.",
                "start": r["ts"], "end": None, "day": r["day"], "metrics": ["cabin_co2"],
            })
    events.sort(key=lambda e: e["start"], reverse=True)
    return events


def serialize_event(e: dict, aid: str, i: int) -> dict:
    return {
        "id": f"evt-{aid.split('-')[1]}-{i:02d}",
        "code": e["code"],
        "scope": e["scope"],
        "severity": e["severity"],
        "label": e["label"],
        "detail": e["detail"],
        "mission_day": e["day"],
        "start": iso(e["start"]),
        "end": iso(e["end"]) if e["end"] else None,
        "metrics": e["metrics"],
    }


# --------------------------------------------------------------------------
# Profile synthesis
# --------------------------------------------------------------------------


def fmt_delay(minutes: float) -> str:
    m = int(minutes)
    return f"{m}m {round((minutes - m) * 60):02d}s"


def build_profile(crew: str, rows: list[dict], cabin_events: list[dict]) -> tuple[dict, dict]:
    meta = CREW[crew]
    aid = meta["id"]
    now = rows[-1]["ts"]
    today = rows[-1]["day"]
    cur = latest(rows)
    last24 = [r for r in rows if r["ts"] > now - timedelta(hours=24)]
    last7 = [r for r in rows if r["ts"] > now - timedelta(days=7)]

    status = {m.key: metric_status(m, cur) for m in CATALOG}
    crew_events = [e for e in detect_events(crew, rows) if e["scope"] == "crew"]
    events = crew_events + cabin_events
    events.sort(key=lambda e: e["start"], reverse=True)

    def recent(e: dict, days: float) -> bool:
        return (e["end"] or e["start"]) > now - timedelta(days=days)

    active = [e for e in crew_events if e["severity"] != "NOMINAL" and recent(e, FOLLOW_UP_DAYS)]
    personal = [status[m.key] for m in CATALOG if m.category != "environment"]
    tags = personal + ["URGENT" if e["severity"] == "URGENT" and recent(e, 1) else "ADVISORY" for e in active]
    status_tag = worst(tags)

    acute = next((e for e in active if e["code"] == "ACUTE_DIZZINESS_BREATHLESSNESS"), None)
    drift = next((e for e in active if e["code"] == "SLOW_DRIFT_SLEEP_STRESS"), None)
    flagged = [BY_KEY[k].label.lower() for k, s in status.items() if s != "NOMINAL" and BY_KEY[k].category != "environment"]

    if acute:
        summary = f"Follow-up after an acute dizziness episode on day {acute['day']}."
    elif drift:
        summary = f"Recovering from a sleep & stress drift (days {drift['day']}–{_day(rows, drift['end'])})."
    elif flagged:
        summary = f"Watch: {', '.join(flagged)}."
    else:
        summary = "All readings within normal range."
    if flagged and (acute or drift):
        summary += f" Currently elevated: {', '.join(flagged)}."

    # ---- body highlights ------------------------------------------------
    resting_hr = mean_where(last24, "heart_rate_bpm", lambda r: r["activity"] == "sommeil")
    spo2_24 = mean_where(last24, "spo2_percent", lambda r: True)
    glu_24 = mean_where(last24, "blood_sugar_mg_dl", lambda r: True)
    voice_7 = mean_where(last7, "voice_stress_index", lambda r: True)
    hrv_7 = mean_where(last7, "hrv_rmssd_ms", lambda r: True)
    sleep_7 = st.mean(daily_means(last7, "sleep_hours").values())

    physical, mental = [], []
    if acute:
        p = acute["peaks"]
        physical.append({"zone": "lungs", "label": f"SpO₂ fell to {p['spo2_min']:g} %", "severity": "ADVISORY",
                         "detail": f"During exercise on day {acute['day']}; back to {cur['spo2_percent']:g} % now.",
                         "metric": "spo2"})
        physical.append({"zone": "heart", "label": f"Heart rate peaked at {p['hr_max']:g} BPM", "severity": "ADVISORY",
                         "detail": f"Same episode; resting rate now {resting_hr:.0f} BPM.", "metric": "heart_rate"})
    else:
        physical.append({"zone": "heart", "label": f"Resting heart rate {resting_hr:.0f} BPM",
                         "severity": status["heart_rate"], "detail": "Average while asleep over the last night.",
                         "metric": "heart_rate"})
        physical.append({"zone": "lungs", "label": f"SpO₂ {spo2_24:.1f} %", "severity": status["spo2"],
                         "detail": "Average oxygen saturation over the last 24 hours.", "metric": "spo2"})
    physical.append({"zone": "metabolic", "label": f"Blood sugar {glu_24:.0f} mg/dL", "severity": status["glucose"],
                     "detail": "Average over the last 24 hours.", "metric": "glucose"})

    if drift:
        p = drift["peaks"]
        mental.append({"zone": "brain", "label": "Sleep & stress drift", "severity": "ADVISORY",
                       "detail": f"Voice stress peaked at {p['voice_max']:.2f} and awakenings at {p['awakenings_max']:g}"
                       f"/night (days {drift['day']}–{_day(rows, drift['end'])}); 7-day voice stress now {voice_7:.2f}.",
                       "metric": "voice_stress"})
        mental.append({"zone": "heart", "label": f"HRV dipped to {p['hrv_min']:.0f} ms", "severity": "ADVISORY",
                       "detail": f"Daily average during the drift; {hrv_7:.0f} ms over the last 7 days.", "metric": "hrv"})
    elif acute:
        mental.append({"zone": "brain", "label": "Stress spike during the episode", "severity": "ADVISORY",
                       "detail": f"Voice stress reached {acute['peaks']['voice_max']:.2f} on day {acute['day']}; "
                       f"7-day average {voice_7:.2f}.", "metric": "voice_stress"})
    else:
        mental.append({"zone": "brain", "label": f"Voice stress {voice_7:.2f}", "severity": status["voice_stress"],
                       "detail": f"7-day average; sleep {sleep_7:.1f} h a night.", "metric": "voice_stress"})
    if status["cortisol"] != "NOMINAL":
        mental.append({"zone": "brain", "label": f"Morning cortisol {cur['cortisol_nmol_l']:g} nmol/L",
                       "severity": status["cortisol"], "detail": "Above the 19 nmol/L alert line in today's saliva sample.",
                       "metric": "cortisol"})

    profile = {
        "id": aid,
        "name": meta["name"],
        "role": meta["role"],
        "mission_day": today,
        "avatar_initials": meta["initials"],
        "status_tag": status_tag,
        "status_summary": summary,
        "last_reading_at": iso(now),
        "last_activity": ACTIVITY.get(rows[-1]["activity"], rows[-1]["activity"]),
        "current_vitals": {f: cur[f] for f in FIELDS},
        "metric_status": status,
        "body_highlights": {"physical": physical, "mental": mental},
        "events": [serialize_event(e, aid, i) for i, e in enumerate(events)],
        "mental_reports": seed_reports(aid, rows, crew_events, cabin_events),
    }
    return profile, telemetry(rows)


def _day(rows: list[dict], ts: datetime) -> int:
    for r in reversed(rows):
        if r["ts"] < ts:
            return r["day"]
    return rows[0]["day"]


def window(rows: list[dict], d0: int, d1: int) -> list[dict]:
    return [r for r in rows if d0 <= r["day"] <= d1]


def seed_reports(aid: str, rows: list[dict], crew_events: list[dict], cabin_events: list[dict]) -> list[dict]:
    """Historical BLUE reports, written from what the data shows on that day."""
    if aid == "astro-vance":
        co2 = next((e for e in cabin_events if e["code"] == "CO2_REMOVAL_DEGRADED"), None)
        day = (co2["day"] + 8) if co2 else rows[-1]["day"] - 4
        w = window(rows, day - 6, day)
        co2_peak = max(daily_means(window(rows, day - 10, day), "cabin_co2_mmhg").values())
        return [{
            "id": "rep-001",
            "created_at": f"Mission Day {day}",
            "session_mode": "BRIEF_CHECKIN",
            "headline": "Steady Command Rhythm Through the CO₂ Scrubber Fault",
            "summary": "Commander reported good energy and steady crew morale during the cabin CO₂ fault. Mild "
            "afternoon headaches eased once ventilation was boosted.",
            "biometric_correlation": f"Resting HR {mean_where(w, 'heart_rate_bpm', lambda r: r['activity'] == 'sommeil'):.0f} "
            f"BPM, sleep {st.mean(daily_means(w, 'sleep_hours').values()):.1f} h a night and voice stress "
            f"{mean_where(w, 'voice_stress_index', lambda r: True):.2f}, all within range, while cabin CO₂ peaked at "
            f"{co2_peak:.1f} mmHg (daily average).",
            "earth_status": "REVIEWED_BY_EARTH",
            "earth_psychologist_directive": "No intervention required. Keep the current sleep schedule and weekly crew "
            "debriefs; report any return of headaches to the crew medical officer.",
        }]

    if aid == "astro-chen":
        drift = next(e for e in crew_events if e["code"] == "SLOW_DRIFT_SLEEP_STRESS")
        light = next((e for e in crew_events if e["code"] == "PRE_SLEEP_LIGHT_ADVANCED"), None)
        d_mid = (light["day"] - 2) if light else drift["day"] + 6
        w = window(rows, drift["day"], d_mid)
        rec_day = _day(rows, drift["end"]) + 3
        wr = window(rows, rec_day - 1, rec_day)
        return [
            {
                "id": "rep-102",
                "created_at": f"Mission Day {rec_day}",
                "session_mode": "DEEP_SUPPORT",
                "headline": "Recovery Check: Sleep Improving After the Lighting Change",
                "summary": "Engineer says falling asleep is easier since the evening lighting moved earlier and feels "
                "less on edge during comms. Still tired in the late afternoon.",
                "biometric_correlation": f"Over the last 2 days: sleep {st.mean(daily_means(wr, 'sleep_hours').values()):.1f} h, "
                f"HRV {mean_where(wr, 'hrv_rmssd_ms', lambda r: True):.0f} ms and voice stress "
                f"{mean_where(wr, 'voice_stress_index', lambda r: True):.2f}, all moving back toward pre-drift levels.",
                "earth_status": "REVIEWED_BY_EARTH",
                "earth_psychologist_directive": "Keep the earlier warm-light schedule for two more weeks and protect "
                "an 8-hour sleep window. Weekly BLUE check-ins; no other changes.",
            },
            {
                "id": "rep-101",
                "created_at": f"Mission Day {d_mid}",
                "session_mode": "DEEP_SUPPORT",
                "headline": "Fragmented Sleep & Rising Stress During Comms",
                "summary": "Engineer described waking several times a night and feeling wired before sleep after long "
                "evening troubleshooting sessions. Says patience with routine tasks is running short.",
                "biometric_correlation": f"Since day {drift['day']}: up to {max(r['sleep_awakenings'] for r in w):g} "
                f"awakenings a night, daily HRV down to {min(daily_means(w, 'hrv_rmssd_ms').values()):.0f} ms, voice "
                f"stress up to {max(daily_means(w, 'voice_stress_index').values()):.2f} and morning cortisol up to "
                f"{max(r['cortisol_nmol_l'] for r in w if r['cortisol_nmol_l'] is not None):g} nmol/L.",
                "earth_status": "REVIEWED_BY_EARTH",
                "earth_psychologist_directive": "Move warm, dim cabin lighting 90 minutes before sleep, stop "
                "troubleshooting work after 20:00, and follow up with BLUE in 3 days.",
            },
        ]

    acute = next(e for e in crew_events if e["code"] == "ACUTE_DIZZINESS_BREATHLESSNESS")
    p = acute["peaks"]
    return [{
        "id": "rep-201",
        "created_at": f"Mission Day {acute['day']}",
        "session_mode": "DEEP_SUPPORT",
        "headline": "Priority: Dizziness During Exercise & Worry About It Returning",
        "summary": "Specialist described sudden dizziness and shortness of breath on the treadmill and is now "
        "anxious about the next exercise session. Reports pushing hard to keep up with the lab schedule.",
        "biometric_correlation": f"During the episode SpO₂ fell to {p['spo2_min']:g} %, heart rate reached "
        f"{p['hr_max']:g} BPM and voice stress {p['voice_max']:.2f}; all readings recovered within the hour.",
        "earth_status": "QUEUED_FOR_EARTH",
        "earth_psychologist_directive": None,
    }]


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------


def cabin_events_from(rows_by_crew: dict[str, list[dict]]) -> list[dict]:
    # Cabin events are recorded on one crew member's rows but affect everyone.
    seen, out = set(), []
    for rows in rows_by_crew.values():
        for e in detect_events("", rows):
            if e["scope"] == "cabin" and e["code"] not in seen:
                seen.add(e["code"])
                out.append(e)
    return out


def validate(profiles: list[dict]) -> None:
    ids = [AstronautProfile.model_validate(p).id for p in profiles]
    assert ids == ["astro-vance", "astro-chen", "astro-lin"], ids


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="validate the committed seed only")
    args = parser.parse_args()

    if args.check:
        validate(json.loads(OUT_PROFILES.read_text()))
        for c in CREW.values():
            assert (OUT_TELEMETRY / f"{c['id']}.json").exists(), c["id"]
        print(f"[ok] {OUT_PROFILES.relative_to(ROOT)} and telemetry match schemas.py")
        return

    by_crew = load()
    cabin = cabin_events_from(by_crew)
    profiles = []
    OUT_TELEMETRY.mkdir(parents=True, exist_ok=True)
    for crew in CREW:
        profile, tele = build_profile(crew, by_crew[crew], cabin)
        profiles.append(profile)
        (OUT_TELEMETRY / f"{profile['id']}.json").write_text(json.dumps(tele, separators=(",", ":")) + "\n")
        print(f"[info] {profile['id']}: {profile['status_tag']} — {profile['status_summary']}")
    validate(profiles)
    OUT_PROFILES.write_text(json.dumps(profiles, indent=2, ensure_ascii=False) + "\n")
    print(f"[ok] wrote {OUT_PROFILES.relative_to(ROOT)} and {OUT_TELEMETRY.relative_to(ROOT)}/*.json")


if __name__ == "__main__":
    main()
