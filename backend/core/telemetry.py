"""Metric history for the detail pages, served from the precomputed seed.

Range -> resolution:
    24h -> 15-minute samples
    7d  -> hourly mean with min/max band
    30d -> daily mean with min/max band (last 30 mission days)
    all -> daily mean with min/max band (whole mission)
"""

from __future__ import annotations

from core.metrics import value_status
from schemas import AstronautProfile, HistoryPoint, HistoryRange, MetricDefinition, MetricHistory, SeriesStats

_RESOLUTION = {"24h": "15min", "7d": "hourly", "30d": "daily", "all": "daily"}


def _points(tele: dict, metric: MetricDefinition, rng: HistoryRange) -> list[HistoryPoint]:
    fields = [s.field for s in metric.series]
    if rng == "24h":
        block = tele["raw"]
        return [
            HistoryPoint(
                t=t,
                mission_day=block["day"][i],
                activity=block["activity"][i],
                values={f: block["fields"][f][i] for f in fields},
            )
            for i, t in enumerate(block["t"])
        ]

    block = tele["hourly" if rng == "7d" else "daily"]
    n = len(block["t"])
    start = max(0, n - 30) if rng == "30d" else 0
    return [
        HistoryPoint(
            t=block["t"][i],
            mission_day=block["day"][i],
            activity=block["activity"][i] if rng == "7d" else None,
            values={f: block["fields"][f]["mean"][i] for f in fields},
            low={f: block["fields"][f]["min"][i] for f in fields},
            high={f: block["fields"][f]["max"][i] for f in fields},
        )
        for i in range(start, n)
    ]


def _stats(metric: MetricDefinition, points: list[HistoryPoint]) -> list[SeriesStats]:
    out = []
    for s in metric.series:
        vals = [p.values[s.field] for p in points if p.values.get(s.field) is not None]
        lows = [p.low[s.field] for p in points if p.low and p.low.get(s.field) is not None] or vals
        highs = [p.high[s.field] for p in points if p.high and p.high.get(s.field) is not None] or vals
        nominal = (
            round(100 * sum(value_status(s.thresholds, v) == "NOMINAL" for v in vals) / len(vals), 1)
            if vals and s.thresholds
            else None
        )
        out.append(
            SeriesStats(
                field=s.field,
                min=min(lows) if lows else None,
                max=max(highs) if highs else None,
                avg=round(sum(vals) / len(vals), 2) if vals else None,
                last=vals[-1] if vals else None,
                pct_nominal=nominal,
            )
        )
    return out


def history(profile: AstronautProfile, tele: dict, metric: MetricDefinition, rng: HistoryRange) -> MetricHistory:
    points = _points(tele, metric, rng)
    first = points[0].t if points else ""
    first_day = points[0].mission_day if points else 0
    events = [
        e
        for e in profile.events
        if metric.key in e.metrics and ((e.end or e.start) >= first if rng != "30d" else e.mission_day >= first_day)
    ]
    return MetricHistory(
        astronaut_id=profile.id,
        metric=metric,
        range=rng,
        resolution=_RESOLUTION[rng],
        points=points,
        stats=_stats(metric, points),
        events=events,
    )
