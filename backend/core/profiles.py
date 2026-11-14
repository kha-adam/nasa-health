"""In-memory astronaut profile store backed by the static seed file.

The seed (backend/data/astronauts.json) is loaded once at import time and is
never written back: generated reports live only in process memory, so
restarting the server resets the demo to its canonical state.
"""

from __future__ import annotations

import json
import threading
from pathlib import Path

from schemas import AstronautProfile, MentalHealthReport

SEED_PATH = Path(__file__).resolve().parent.parent / "data" / "astronauts.json"

_lock = threading.Lock()
_profiles: dict[str, AstronautProfile] = {}


def load_seed(path: Path = SEED_PATH) -> None:
    """(Re)load the canonical crew from disk, discarding in-memory changes."""
    raw = json.loads(path.read_text())
    with _lock:
        _profiles.clear()
        for item in raw:
            profile = AstronautProfile.model_validate(item)
            _profiles[profile.id] = profile


def list_profiles() -> list[AstronautProfile]:
    with _lock:
        return [p.model_copy(deep=True) for p in _profiles.values()]


def get_profile(astronaut_id: str) -> AstronautProfile | None:
    with _lock:
        profile = _profiles.get(astronaut_id)
        return profile.model_copy(deep=True) if profile else None


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
