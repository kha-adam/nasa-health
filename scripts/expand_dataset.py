#!/usr/bin/env python3
"""Expand the ASTRA simulated telemetry CSV backwards in mission time.

Input : data/source/astra_donnees_simulees.csv   (mission days 120-150, 4 crew,
        15-minute cadence, 37 columns — kept verbatim in the output)
Output: data/source/astra_donnees_etendues.csv   (mission days 1-150 by default)

Method (deterministic, seeded):

* Each synthetic day copies the 15-minute schedule of a *donor* day drawn from
  the original nominal days (no injected events, no drift/acute labels, normal
  cabin CO2). The same donor is used for every crew member that day, so the
  shared cabin environment stays identical across the crew, as in the source.
* Day-level AR(1) offsets (per crew for physiology, shared for the cabin) make
  consecutive days wander realistically instead of repeating donors exactly.
  Small row-level noise is added on top, scaled to each field's within-day
  variability. Values are clamped to the range observed in the source.
* Fields with physical continuity are rebuilt instead of copied:
  - radiation_dose_cum_msv is integrated backwards from the first source row;
  - earth_comm_delay_min follows the source's linear trend;
  - body_mass_kg keeps its weekly 07:00 cadence and per-crew linear trend.
* Daily values (sleep_*) stay constant within a day, cortisol stays a single
  06:30 sample, and sensor dropouts (empty cells) are preserved from the donor.
* Synthetic rows are tagged data_source="simule_etendu".

Usage:
    python scripts/expand_dataset.py                 # days 1-150
    python scripts/expand_dataset.py --start-day 60  # shorter history
"""

from __future__ import annotations

import argparse
import csv
import math
import random
import statistics as st
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "source" / "astra_donnees_simulees.csv"
OUT = ROOT / "data" / "source" / "astra_donnees_etendues.csv"

CABIN_FIELDS = [
    "cabin_co2_mmhg",
    "cabin_ppo2_kpa",
    "cabin_pressure_kpa",
    "cabin_temp_c",
    "cabin_humidity_pct",
    "noise_dba",
    "radiation_dose_rate_usv_h",
]
CREW_FIELDS = [
    "heart_rate_bpm",
    "hrv_rmssd_ms",
    "systolic_bp_mmhg",
    "diastolic_bp_mmhg",
    "spo2_pct",
    "resp_rate_bpm",
    "core_temp_c",
    "glucose_mg_dl",
    "voice_stress_index",
    "speech_rate_wpm",
    "blink_rate_per_min",
    "salivary_cortisol_nmol_l",
]
DAILY_FIELDS = ["sleep_last_night_h", "sleep_efficiency_pct", "sleep_awakenings"]
# Fields that move together with another field's offset.
COUPLED = {"hr_webcam_est_bpm": "heart_rate_bpm"}
# Light follows the habitat schedule: copied from the donor, only lit values jitter.
LIGHT_FIELDS = ["light_lux", "light_cct_k"]
# Fields without row-level noise (single daily samples or step-like signals).
NO_ROW_NOISE = {"salivary_cortisol_nmol_l", "spo2_pct", "cabin_pressure_kpa"}

AR_PHI = 0.85  # day-to-day persistence of offsets
AR_SCALE = 0.35  # innovation sd as a fraction of the between-day sd
ROW_NOISE = 0.15  # row noise sd as a fraction of the within-day sd


def fnum(x: str) -> float | None:
    return float(x) if x not in ("", None) else None


def decimals(values: list[str]) -> int:
    best = 0
    for v in values[:2000]:
        if "." in v:
            best = max(best, len(v.split(".")[1].rstrip("0")))
    return best


def fmt(value: float, ndp: int) -> str:
    return f"{value:.{max(ndp, 1)}f}"


def linear_fit(xs: list[float], ys: list[float]) -> tuple[float, float]:
    mx, my = st.mean(xs), st.mean(ys)
    den = sum((x - mx) ** 2 for x in xs) or 1.0
    slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den
    return slope, my - slope * mx


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--start-day", type=int, default=1)
    parser.add_argument("--seed", type=int, default=2035)
    args = parser.parse_args()

    with SRC.open(newline="") as fh:
        reader = csv.DictReader(fh)
        header = list(reader.fieldnames or [])
        rows = list(reader)

    first_day = min(int(r["mission_day"]) for r in rows)
    if args.start_day >= first_day:
        raise SystemExit(f"--start-day must be < {first_day}")
    crews = sorted({r["crew_id"] for r in rows})
    roles = {r["crew_id"]: r["crew_role"] for r in rows}
    ndp = {k: decimals([r[k] for r in rows if r[k]]) for k in header}

    by_day: dict[int, list[dict]] = defaultdict(list)
    for r in rows:
        by_day[int(r["mission_day"])].append(r)

    # ---- donor pool: fully nominal days with a normal cabin -----------------
    def nominal(day: int) -> bool:
        rs = by_day[day]
        if any(r["injected_event"] or r["ground_truth_label"] != "nominal" for r in rs):
            return False
        co2 = st.mean(float(r["cabin_co2_mmhg"]) for r in rs)
        return co2 < 3.0

    donors = [d for d in sorted(by_day) if nominal(d)]

    # ---- per-field statistics from the donor pool ---------------------------
    def field_stats(field: str, crew: str | None) -> tuple[float, float]:
        """Return (between-day sd, within-day sd) of a field."""
        daily_means, within = [], []
        for d in donors:
            vals = [fnum(r[field]) for r in by_day[d] if crew is None or r["crew_id"] == crew]
            vals = [v for v in vals if v is not None]
            if len(vals) >= 1:
                daily_means.append(st.mean(vals))
            if len(vals) >= 3:
                within.append(st.pstdev(vals))
        between = st.pstdev(daily_means) if len(daily_means) > 1 else 0.0
        return between, (st.mean(within) if within else 0.0)

    stats: dict[tuple[str | None, str], tuple[float, float]] = {}
    for f in CABIN_FIELDS:
        stats[(None, f)] = field_stats(f, None)
    for c in crews:
        for f in CREW_FIELDS + DAILY_FIELDS:
            stats[(c, f)] = field_stats(f, c)

    bounds = {}
    for f in CABIN_FIELDS + CREW_FIELDS + DAILY_FIELDS + list(COUPLED) + LIGHT_FIELDS:
        vals = [float(r[f]) for d in donors for r in by_day[d] if r[f]]
        bounds[f] = (min(vals), max(vals))

    # ---- continuity models --------------------------------------------------
    first_rows = sorted(by_day[first_day], key=lambda r: r["timestamp_utc"])
    t0 = datetime.fromisoformat(first_rows[0]["timestamp_utc"].replace("Z", "+00:00"))
    cum_at_t0 = float(first_rows[0]["radiation_dose_cum_msv"])

    ts_days = [float(r["met_h"]) / 24 for r in rows if r["crew_id"] == crews[0]]
    delays = [float(r["earth_comm_delay_min"]) for r in rows if r["crew_id"] == crews[0]]
    delay_slope, delay_icpt = linear_fit(ts_days, delays)

    mass_model = {}
    for c in crews:
        pts = [(int(r["mission_day"]), float(r["body_mass_kg"])) for r in rows if r["crew_id"] == c and r["body_mass_kg"]]
        mass_model[c] = linear_fit([p[0] for p in pts], [p[1] for p in pts])
    mass_phase = min(int(r["mission_day"]) for r in rows if r["body_mass_kg"]) % 7
    mass_slot = next(r["timestamp_utc"][11:16] for r in rows if r["body_mass_kg"])

    # ---- generate -----------------------------------------------------------
    rng = random.Random(args.seed)
    offsets: dict[tuple[str | None, str], float] = defaultdict(float)
    synthetic: list[dict] = []
    days = list(range(args.start_day, first_day))

    # Walk offsets backwards from the source so the join at day 119/120 is smooth.
    day_offsets: dict[int, dict[tuple[str | None, str], float]] = {}
    for day in reversed(days):
        for key, (between, _) in stats.items():
            offsets[key] = AR_PHI * offsets[key] + rng.gauss(0, AR_SCALE * between)
        day_offsets[day] = dict(offsets)

    for day in days:
        donor = rng.choice(donors)
        offs = day_offsets[day]
        donor_rows = sorted(by_day[donor], key=lambda r: (r["timestamp_utc"], r["crew_id"]))
        date = t0 + timedelta(days=day - first_day)
        cabin_noise: dict[tuple[str, str], float] = {}
        for src in donor_rows:
            hhmm = src["timestamp_utc"][11:16]
            h, m = (int(x) for x in hhmm.split(":"))
            ts = date.replace(hour=h, minute=m)
            row = dict(src)
            row["timestamp_utc"] = ts.strftime("%Y-%m-%dT%H:%M:%SZ")
            row["mission_day"] = str(day)
            row["met_h"] = fmt((day - 1) * 24 + h + m / 60, 2)
            row["injected_event"] = ""
            row["ground_truth_label"] = "nominal"
            row["data_source"] = "simule_etendu"
            crew = src["crew_id"]

            def jitter(field: str, key: tuple[str | None, str], noise_key: tuple[str, str] | None = None) -> None:
                v = fnum(src[field])
                if v is None:
                    return
                between, within = stats[key]
                v += offs[key]
                if field not in NO_ROW_NOISE and field not in DAILY_FIELDS:
                    if noise_key is not None:  # shared cabin noise per timestamp
                        if noise_key not in cabin_noise:
                            cabin_noise[noise_key] = rng.gauss(0, ROW_NOISE * within)
                        v += cabin_noise[noise_key]
                    else:
                        v += rng.gauss(0, ROW_NOISE * within)
                elif field == "salivary_cortisol_nmol_l":
                    v += rng.gauss(0, 0.5 * between)
                lo, hi = bounds[field]
                v = min(hi, max(lo, v))
                row[field] = fmt(round(v, ndp[field]), ndp[field]) if ndp[field] else str(round(v)) + ".0"

            for f in CABIN_FIELDS:
                jitter(f, (None, f), noise_key=(hhmm, f))
            for f in CREW_FIELDS + DAILY_FIELDS:
                jitter(f, (crew, f))
            if src["sleep_awakenings"]:
                row["sleep_awakenings"] = str(max(0, round(float(row["sleep_awakenings"]))))
            for f, base in COUPLED.items():
                v, b_src, b_new = fnum(src[f]), fnum(src[base]), fnum(row[base])
                if v is not None and b_src is not None and b_new is not None:
                    lo, hi = bounds[f]
                    row[f] = fmt(min(hi, max(lo, round(v + (b_new - b_src)))), ndp[f])
            for f in LIGHT_FIELDS:
                v = fnum(src[f])
                if v:
                    key = (hhmm, f)
                    if key not in cabin_noise:
                        cabin_noise[key] = rng.gauss(0, 0.03 * v)
                    row[f] = fmt(round(v + cabin_noise[key]), ndp[f])

            # Continuity fields
            row["earth_comm_delay_min"] = fmt(
                round(delay_slope * float(row["met_h"]) / 24 + delay_icpt, 2), ndp["earth_comm_delay_min"]
            )
            if day % 7 == mass_phase and hhmm == mass_slot and crew in mass_model:
                slope, icpt = mass_model[crew]
                row["body_mass_kg"] = fmt(round(slope * day + icpt + rng.gauss(0, 0.05), 2), 2)
            else:
                row["body_mass_kg"] = ""
            synthetic.append(row)

    # Radiation dose: integrate backwards from the first source sample (shared cabin).
    by_ts: dict[str, list[dict]] = defaultdict(list)
    for r in synthetic:
        by_ts[r["timestamp_utc"]].append(r)
    cum = cum_at_t0
    for ts in sorted(by_ts, reverse=True):
        rate = float(by_ts[ts][0]["radiation_dose_rate_usv_h"])
        cum = max(0.0, cum - rate * 0.25 / 1000)
        for r in by_ts[ts]:
            r["radiation_dose_cum_msv"] = fmt(round(cum, 2), ndp["radiation_dose_cum_msv"])

    synthetic.sort(key=lambda r: (r["timestamp_utc"], r["crew_id"]))
    with OUT.open("w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=header, lineterminator="\n")
        writer.writeheader()
        writer.writerows(synthetic)
        writer.writerows(rows)

    print(
        f"[ok] wrote {OUT.relative_to(ROOT)}: {len(synthetic)} synthetic + {len(rows)} source rows, "
        f"days {args.start_day}-{max(by_day)}, crew {', '.join(f'{c} ({roles[c]})' for c in crews)}; "
        f"{len(donors)} donor days"
    )
    if math.isnan(delay_slope):  # pragma: no cover - defensive
        raise SystemExit("bad delay fit")


if __name__ == "__main__":
    main()
