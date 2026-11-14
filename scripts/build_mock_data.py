#!/usr/bin/env python3
"""Offline ETL for Project BLUE -> backend/data/astronauts.json.

Hybrid strategy (AGENTS.md Section 3):

1. If open-access PhysioNet files have been downloaded locally into
   ``data/raw/`` (never fetched by this script, never read at runtime), we
   extract real intra-day *variability* from them:

   * ``data/raw/mimic-iv-demo/icu/chartevents.csv(.gz)`` — heart rate
     (itemid 220045) and glucose (220621 / 225664 / 226537) trajectories.

   The variability (relative residuals around each patient's trend) is used
   as a realistic noise texture on top of the canonical anchor curves.

2. Otherwise, a seeded synthetic texture is used so the output is
   deterministic and the demo never depends on network or credentials.

Either way, the canonical anchor values from AGENTS.md (current vitals and
the documented history points) are preserved *exactly*.

Usage:
    python scripts/build_mock_data.py            # writes backend/data/astronauts.json
    python scripts/build_mock_data.py --check    # validates against backend/schemas.py
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
OUT_PATH = ROOT / "backend" / "data" / "astronauts.json"

HR_ITEMIDS = {"220045"}
GLUCOSE_ITEMIDS = {"220621", "225664", "226537"}


# --------------------------------------------------------------------------
# Optional real-data texture extraction
# --------------------------------------------------------------------------


def _open_maybe_gz(path: Path):
    if path.suffix == ".gz":
        return gzip.open(path, "rt", newline="")
    return path.open(newline="")


def _find(*candidates: str) -> Path | None:
    for rel in candidates:
        p = RAW_DIR / rel
        if p.exists():
            return p
    return None


def extract_mimic_texture(max_rows: int = 400_000) -> dict[str, list[float]] | None:
    """Return relative residual series for HR and glucose, or None."""
    path = _find(
        "mimic-iv-demo/icu/chartevents.csv.gz",
        "mimic-iv-demo/icu/chartevents.csv",
        "mimic-iv-clinical-database-demo-2.2/icu/chartevents.csv.gz",
    )
    if path is None:
        return None

    series: dict[str, dict[str, list[float]]] = {"hr": {}, "glucose": {}}
    try:
        with _open_maybe_gz(path) as fh:
            reader = csv.DictReader(fh)
            for i, row in enumerate(reader):
                if i >= max_rows:
                    break
                item = row.get("itemid", "")
                kind = "hr" if item in HR_ITEMIDS else "glucose" if item in GLUCOSE_ITEMIDS else None
                if kind is None:
                    continue
                try:
                    val = float(row.get("valuenum") or "")
                except ValueError:
                    continue
                if val <= 0:
                    continue
                series[kind].setdefault(row.get("stay_id") or row.get("subject_id", "?"), []).append(val)
    except (OSError, csv.Error) as exc:
        print(f"[warn] could not read {path}: {exc}", file=sys.stderr)
        return None

    texture: dict[str, list[float]] = {}
    for kind, by_stay in series.items():
        residuals: list[float] = []
        for values in by_stay.values():
            if len(values) < 5:
                continue
            for j in range(2, len(values) - 2):
                local = sum(values[j - 2 : j + 3]) / 5
                residuals.append((values[j] - local) / local)
        # Clip extreme ICU artefacts: we only want gentle texture.
        texture[kind] = [max(-0.04, min(0.04, r)) for r in residuals]
    if not any(texture.values()):
        return None
    print(f"[info] using MIMIC-IV demo texture from {path.relative_to(ROOT)}")
    return texture


# --------------------------------------------------------------------------
# Curve building
# --------------------------------------------------------------------------


class Texture:
    def __init__(self, real: dict[str, list[float]] | None, seed: int):
        self.real = real or {}
        self.rng = random.Random(seed)

    def jitter(self, kind: str, scale: float) -> float:
        pool = self.real.get(kind)
        if pool:
            return self.rng.choice(pool)
        return self.rng.gauss(0, scale)


def interpolate(anchors: dict[str, float], times: list[str]) -> dict[str, float]:
    """Piecewise-linear interpolation over HH:MM keys."""

    def minutes(t: str) -> int:
        h, m = t.split(":")
        return int(h) * 60 + int(m)

    pts = sorted((minutes(t), v) for t, v in anchors.items())
    out: dict[str, float] = {}
    for t in times:
        x = minutes(t)
        if x <= pts[0][0]:
            out[t] = pts[0][1]
            continue
        if x >= pts[-1][0]:
            out[t] = pts[-1][1]
            continue
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            if x0 <= x <= x1:
                out[t] = y0 + (y1 - y0) * (x - x0) / (x1 - x0)
                break
    return out


def build_history(
    times: list[str],
    anchors: dict[str, dict[str, float]],
    texture: Texture,
) -> list[dict]:
    hr = interpolate(anchors["hr"], times)
    bg = interpolate(anchors["glucose"], times)
    co = interpolate(anchors["cortisol"], times)
    history = []
    for t in times:
        point = {
            "time": t,
            "heart_rate_bpm": hr[t],
            "blood_sugar_mg_dl": bg[t],
            "cortisol_ug_dl": co[t],
        }
        # Exact anchors stay exact; interpolated points get realistic texture.
        if t not in anchors["hr"]:
            point["heart_rate_bpm"] *= 1 + texture.jitter("hr", 0.015)
        if t not in anchors["glucose"]:
            point["blood_sugar_mg_dl"] *= 1 + texture.jitter("glucose", 0.012)
        if t not in anchors["cortisol"]:
            point["cortisol_ug_dl"] *= 1 + texture.jitter("cortisol", 0.02)
        point["heart_rate_bpm"] = round(point["heart_rate_bpm"])
        point["blood_sugar_mg_dl"] = round(point["blood_sugar_mg_dl"])
        point["cortisol_ug_dl"] = round(point["cortisol_ug_dl"], 1)
        history.append(point)
    return history


# --------------------------------------------------------------------------
# Canonical crew (AGENTS.md Section 3.B / Section 8.A)
# --------------------------------------------------------------------------


def build_profiles(real_texture: dict[str, list[float]] | None) -> list[dict]:
    day_times = ["08:00", "10:00", "12:00", "14:00", "16:00"]
    evening_times = ["08:00", "11:00", "14:00", "17:00", "20:00", "22:00"]

    vance = {
        "id": "astro-vance",
        "name": "Cmdr. Elena Vance",
        "role": "Commander",
        "mission_day": 118,
        "avatar_initials": "EV",
        "status_tag": "NOMINAL",
        "current_vitals": {
            "heart_rate_bpm": 64,
            "blood_sugar_mg_dl": 92,
            "systolic_bp": 116,
            "diastolic_bp": 74,
            "spo2_percent": 98.6,
            "cortisol_ug_dl": 11.5,
        },
        "vitals_history": build_history(
            day_times,
            {
                "hr": {"08:00": 61, "12:00": 66, "16:00": 64},
                "glucose": {"08:00": 90, "12:00": 96, "16:00": 92},
                "cortisol": {"08:00": 14.8, "12:00": 12.6, "16:00": 11.5},
            },
            Texture(real_texture, seed=101),
        ),
        "body_highlights": {
            "physical": [
                {
                    "zone": "heart",
                    "label": "Stable Resting HR",
                    "severity": "NOMINAL",
                    "detail": "64 BPM resting rate within personal baseline.",
                },
                {
                    "zone": "lungs",
                    "label": "Optimal Oxygenation",
                    "severity": "NOMINAL",
                    "detail": "SpO2 holding at 98.6% across all shifts.",
                },
            ],
            "mental": [
                {
                    "zone": "brain",
                    "label": "Healthy Cortisol Rhythm",
                    "severity": "NOMINAL",
                    "detail": "Cortisol tapering normally from 14.8 to 11.5 ug/dL over the day.",
                }
            ],
        },
        "mental_reports": [
            {
                "id": "rep-001",
                "created_at": "Mission Day 114",
                "session_mode": "BRIEF_CHECKIN",
                "headline": "Steady Command Rhythm & Good Crew Cohesion",
                "summary": "Commander reported restful sleep, good energy and positive crew morale following the week-16 resupply docking.",
                "biometric_correlation": "Resting HR 63 BPM and cortisol 11.8 ug/dL consistent with a well-regulated circadian rhythm.",
                "earth_status": "REVIEWED_BY_EARTH",
                "earth_psychologist_directive": "Maintain current sleep schedule and continue weekly crew debriefs; no intervention required.",
            }
        ],
    }

    chen = {
        "id": "astro-chen",
        "name": "Eng. Marcus Chen",
        "role": "Flight Engineer",
        "mission_day": 118,
        "avatar_initials": "MC",
        "status_tag": "ADVISORY",
        "current_vitals": {
            "heart_rate_bpm": 98,
            "blood_sugar_mg_dl": 62,
            "systolic_bp": 132,
            "diastolic_bp": 84,
            "spo2_percent": 96.8,
            "cortisol_ug_dl": 17.8,
        },
        "vitals_history": build_history(
            day_times,
            {
                "hr": {"08:00": 74, "12:00": 88, "16:00": 98},
                "glucose": {"08:00": 95, "12:00": 74, "16:00": 62},
                "cortisol": {"08:00": 14.2, "12:00": 16.5, "16:00": 17.8},
            },
            Texture(real_texture, seed=202),
        ),
        "body_highlights": {
            "physical": [
                {
                    "zone": "metabolic",
                    "label": "Hypoglycemic Trend",
                    "severity": "ADVISORY",
                    "detail": "Blood sugar dropped from 95 to 62 mg/dL post-EVA prep.",
                },
                {
                    "zone": "heart",
                    "label": "Elevated Exertion HR",
                    "severity": "ADVISORY",
                    "detail": "98 BPM elevated during airlock calibration.",
                },
            ],
            "mental": [
                {
                    "zone": "brain",
                    "label": "Mild Cortisol Drift",
                    "severity": "ADVISORY",
                    "detail": "Cortisol at 17.8 ug/dL linked to skipped meal & task load.",
                }
            ],
        },
        "mental_reports": [
            {
                "id": "rep-101",
                "created_at": "Mission Day 115",
                "session_mode": "DEEP_SUPPORT",
                "headline": "Post-EVA Fatigue & Nutritional Timing Drift",
                "summary": "Astronaut reported mild lightheadedness and reduced focus after delaying midday nutrition during EVA suit checks.",
                "biometric_correlation": "Blood glucose dropped to 62 mg/dL alongside compensatory HR rise (98 BPM).",
                "earth_status": "REVIEWED_BY_EARTH",
                "earth_psychologist_directive": "Enforce mandatory pre-EVA carbohydrate intake and 20-minute post-shift decompression; follow up with BLUE tomorrow.",
            }
        ],
    }

    lin = {
        "id": "astro-lin",
        "name": "Spec. Maya Lin",
        "role": "Mission Specialist",
        "mission_day": 118,
        "avatar_initials": "ML",
        "status_tag": "ADVISORY",
        "current_vitals": {
            "heart_rate_bpm": 82,
            "blood_sugar_mg_dl": 86,
            "systolic_bp": 122,
            "diastolic_bp": 78,
            "spo2_percent": 98.1,
            "cortisol_ug_dl": 22.4,
        },
        # Inverted (elevated evening) cortisol curve — MAST-style stress profile.
        "vitals_history": build_history(
            evening_times,
            {
                "hr": {"08:00": 72, "14:00": 76, "22:00": 82},
                "glucose": {"08:00": 88, "14:00": 90, "22:00": 86},
                "cortisol": {"08:00": 15.1, "14:00": 13.2, "17:00": 16.9, "20:00": 20.6, "22:00": 22.4},
            },
            Texture(real_texture, seed=303),
        ),
        "body_highlights": {
            "physical": [
                {
                    "zone": "heart",
                    "label": "Evening HR Creep",
                    "severity": "NOMINAL",
                    "detail": "HR rising gently to 82 BPM late evening; within operational bounds.",
                }
            ],
            "mental": [
                {
                    "zone": "brain",
                    "label": "Elevated Evening Cortisol",
                    "severity": "ADVISORY",
                    "detail": "Cortisol at 22.4 ug/dL at 22:00 — inverted circadian curve over 3 sleep cycles.",
                }
            ],
        },
        "mental_reports": [
            {
                "id": "rep-201",
                "created_at": "Mission Day 112",
                "session_mode": "DEEP_SUPPORT",
                "headline": "Early Signs of Isolation & Sleep Fragmentation",
                "summary": "Specialist described waking twice per night and feeling disconnected from the crew rotation during the long lab cycle.",
                "biometric_correlation": "Evening cortisol trending upward (18.9 ug/dL) with no matching physical exertion.",
                "earth_status": "REVIEWED_BY_EARTH",
                "earth_psychologist_directive": "Schedule two shared crew meals per day, a weekly private family call, and dim cabin lighting 60 minutes before sleep.",
            }
        ],
    }

    return [vance, chen, lin]


def validate(profiles: list[dict]) -> None:
    sys.path.insert(0, str(ROOT / "backend"))
    from schemas import AstronautProfile  # noqa: PLC0415

    ids = [AstronautProfile.model_validate(p).id for p in profiles]
    assert ids == ["astro-vance", "astro-chen", "astro-lin"], ids


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="validate the committed seed only")
    args = parser.parse_args()

    if args.check:
        profiles = json.loads(OUT_PATH.read_text())
        validate(profiles)
        print(f"[ok] {OUT_PATH.relative_to(ROOT)} matches schemas.py")
        return

    texture = extract_mimic_texture()
    if texture is None:
        print("[info] no raw datasets in data/raw/ — using seeded synthetic texture")
    profiles = build_profiles(texture)
    try:
        validate(profiles)
    except ImportError:
        print("[warn] pydantic not installed; skipping schema validation", file=sys.stderr)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(profiles, indent=2) + "\n")
    print(f"[ok] wrote {OUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
