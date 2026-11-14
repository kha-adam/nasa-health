"""In-memory astronaut profile store backed by the static seed files.

The seeds (backend/data/astronauts.json and backend/data/telemetry/*.json) are
loaded once at import time and never written back: generated reports live only
in process memory, so restarting the server resets the demo.
"""

from __future__ import annotations

import json
import threading
from pathlib import Path

from core.metrics import CATALOG
from schemas import AstronautProfile, MentalHealthReport

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SEED_PATH = DATA_DIR / "astronauts.json"
TELEMETRY_DIR = DATA_DIR / "telemetry"

PRIVATE_METRICS = {m.key for m in CATALOG if m.private}
PRIVATE_FIELDS = {s.field for m in CATALOG if m.private for s in m.series}

_lock = threading.Lock()
_profiles: dict[str, AstronautProfile] = {}
_telemetry: dict[str, dict] = {}


def load_seed(path: Path = SEED_PATH) -> None:
    """(Re)load the canonical crew from disk, discarding in-memory changes."""
    raw = json.loads(path.read_text())
    with _lock:
        _profiles.clear()
        _telemetry.clear()
        for item in raw:
            profile = AstronautProfile.model_validate(item)
            _profiles[profile.id] = profile
            _telemetry[profile.id] = json.loads((TELEMETRY_DIR / f"{profile.id}.json").read_text())


def redact(profile: AstronautProfile) -> AstronautProfile:
    """Medical view for the flight surgeon: no mental-health content."""
    vitals = profile.current_vitals.model_copy(update={f: None for f in PRIVATE_FIELDS})
    return profile.model_copy(
        update={
            "current_vitals": vitals,
            "metric_status": {k: v for k, v in profile.metric_status.items() if k not in PRIVATE_METRICS},
            "body_highlights": profile.body_highlights.model_copy(update={"mental": []}),
            "events": [
                e.model_copy(update={"metrics": [m for m in e.metrics if m not in PRIVATE_METRICS]})
                for e in profile.events
            ],
            "mental_reports": [],
            "mental_redacted": True,
        },
        deep=True,
    )


def list_profiles() -> list[AstronautProfile]:
    with _lock:
        return [p.model_copy(deep=True) for p in _profiles.values()]


def get_profile(astronaut_id: str) -> AstronautProfile | None:
    with _lock:
        profile = _profiles.get(astronaut_id)
        return profile.model_copy(deep=True) if profile else None


def get_telemetry(astronaut_id: str) -> dict | None:
    """Columnar history (read-only; do not mutate)."""
    return _telemetry.get(astronaut_id)


def prepend_report(astronaut_id: str, report: MentalHealthReport) -> None:
    with _lock:
        profile = _profiles[astronaut_id]
        profile.mental_reports.insert(0, report)


def get_report(astronaut_id: str, report_id: str) -> MentalHealthReport | None:
    with _lock:
        profile = _profiles.get(astronaut_id)
        if profile is None:
            return None
        for report in profile.mental_reports:
            if report.id == report_id:
                return report.model_copy(deep=True)
        return None


def replace_report(astronaut_id: str, report: MentalHealthReport) -> None:
    with _lock:
        reports = _profiles[astronaut_id].mental_reports
        for i, existing in enumerate(reports):
            if existing.id == report.id:
                reports[i] = report
                return
        raise KeyError(report.id)


load_seed()
