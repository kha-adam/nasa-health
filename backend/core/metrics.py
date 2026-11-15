"""Metric catalog: labels, units, nominal ranges and privacy class.

Single source of truth shared by the offline ETL (scripts/build_mock_data.py),
the API (served at GET /api/metrics) and the psychologist engine. The frontend
reads ranges from the API instead of duplicating them.

Ranges are operational alert bands for a demo, calibrated on the ASTRA
simulated dataset — they are not clinical reference values. The NASA
in-flight sleep average shown next to sleep duration is a population
reference for context only; it never changes a status.
"""

from __future__ import annotations

from schemas import (
    MetricCadence,
    MetricCategory,
    MetricDefinition,
    MetricReference,
    MetricSeries,
    SourceReference,
    StatusTag,
    Thresholds,
)

# --------------------------------------------------------------------------
# NASA sources cited by data/source/astra_donnees_enrichies_nasa.csv
# --------------------------------------------------------------------------
# Keys are the identifiers written in the CSV's nasa_*_reference_id(s) columns.
# scripts/build_mock_data.py fails if the CSV cites anything not listed here,
# or if its sleep reference values differ from SLEEP_REFERENCE below.

REFERENCES: dict[str, SourceReference] = {
    "NTRS_20230003916_SLEEP_INFLIGHT": SourceReference(
        id="NTRS 20230003916",
        title="Astronaut Sleep Duration Varies by Timing of Scheduled Sleep (NASA Ames, AsMA 2023)",
        url="https://ntrs.nasa.gov/citations/20230003916",
    ),
    "HRR_TASK_1623": SourceReference(
        id="HRR task 1623",
        title="Standardized Behavioral Measures for Detecting Behavioral Health Risks during Exploration Missions",
        url="https://humanresearchroadmap.nasa.gov/tasks/task.aspx?i=1623",
    ),
    "HRR_TASK_1164": SourceReference(
        id="HRR task 1164",
        title="Development and testing of biomarkers to determine individual astronauts' vulnerabilities to "
        "behavioral health disruptions",
        url="https://humanresearchroadmap.nasa.gov/tasks/task.aspx?i=1164",
    ),
    "NTRS_20100026549": SourceReference(
        id="NTRS 20100026549",
        title="Behavioral Issues Associated With Long Duration Space Expeditions: Review and Analysis of "
        "Astronaut Journals (2010)",
        url="https://ntrs.nasa.gov/citations/20100026549",
    ),
}

SLEEP_REFERENCE_ID = "NTRS_20230003916_SLEEP_INFLIGHT"
SLEEP_REFERENCE = MetricReference(
    label="NASA in-flight average",
    mean=7.33,
    sd=1.16,
    detail="Actigraphy of 19 ISS crewmembers over 2,137 in-flight nights (2019–2022).",
    source=REFERENCES[SLEEP_REFERENCE_ID],
)

# Signals compared with the astronaut's own previous 7 mission days (profile.baselines).
# Value: the CSV column holding that previous-7-day mean.
BASELINE_COLUMNS: dict[str, str] = {
    "sleep_duration": "sleep_previous_7d_mean_h",
    "hrv": "hrv_previous_7d_mean_ms",
    "speech_rate": "speech_rate_previous_7d_mean_wpm",
}
BASELINE_METHOD = (
    "Each value is compared with the astronaut's own mean over the 7 mission days before it "
    "(daily means for continuous signals, last night's total for sleep). Individual baselines follow "
    "NASA behavioural-health monitoring practice; a change is context, not a diagnosis."
)

# CSV column -> normalized field name used everywhere in the app.
CSV_FIELDS: dict[str, str] = {
    "heart_rate_bpm": "heart_rate_bpm",
    "hr_webcam_est_bpm": "hr_webcam_bpm",
    "hrv_rmssd_ms": "hrv_rmssd_ms",
    "systolic_bp_mmhg": "systolic_bp",
    "diastolic_bp_mmhg": "diastolic_bp",
    "spo2_pct": "spo2_percent",
    "resp_rate_bpm": "resp_rate_bpm",
    "core_temp_c": "core_temp_c",
    "glucose_mg_dl": "blood_sugar_mg_dl",
    "voice_stress_index": "voice_stress_index",
    "speech_rate_wpm": "speech_rate_wpm",
    "blink_rate_per_min": "blink_rate_per_min",
    "salivary_cortisol_nmol_l": "cortisol_nmol_l",
    "sleep_last_night_h": "sleep_hours",
    "sleep_trailing_7d_mean_h": "sleep_7d_avg_h",
    "sleep_efficiency_pct": "sleep_efficiency_pct",
    "sleep_awakenings": "sleep_awakenings",
    "body_mass_kg": "body_mass_kg",
    "radiation_dose_cum_msv": "radiation_cum_msv",
    "cabin_co2_mmhg": "cabin_co2_mmhg",
    "cabin_ppo2_kpa": "cabin_ppo2_kpa",
    "cabin_pressure_kpa": "cabin_pressure_kpa",
    "cabin_temp_c": "cabin_temp_c",
    "cabin_humidity_pct": "cabin_humidity_pct",
    "noise_dba": "noise_dba",
    "light_lux": "light_lux",
    "light_cct_k": "light_cct_k",
    "radiation_dose_rate_usv_h": "radiation_rate_usv_h",
    "earth_comm_delay_min": "earth_delay_min",
}
FIELDS = list(CSV_FIELDS.values())


def _m(
    key: str,
    label: str,
    unit: str,
    category: MetricCategory,
    series: list[tuple[str, str, Thresholds | None]],
    description: str,
    *,
    private: bool = False,
    decimals: int = 0,
    cadence: MetricCadence = "continuous",
    reference: MetricReference | None = None,
) -> MetricDefinition:
    return MetricDefinition(
        key=key,
        label=label,
        unit=unit,
        category=category,
        private=private,
        cadence=cadence,
        decimals=decimals,
        description=description,
        series=[MetricSeries(field=f, label=lbl, thresholds=t) for f, lbl, t in series],
        reference=reference,
    )


def T(
    advisory_low: float | None = None,
    advisory_high: float | None = None,
    urgent_low: float | None = None,
    urgent_high: float | None = None,
) -> Thresholds:
    return Thresholds(
        advisory_low=advisory_low, advisory_high=advisory_high, urgent_low=urgent_low, urgent_high=urgent_high
    )


CATALOG: list[MetricDefinition] = [
    # --- Physical ---------------------------------------------------------
    _m("heart_rate", "Heart rate", "BPM", "physical",
       [("heart_rate_bpm", "Chest strap", T(40, 110, 35, 130)), ("hr_webcam_bpm", "Webcam estimate", None)],
       "Beats per minute from the chest-strap sensor, with the contact-free webcam estimate as a cross-check. "
       "Short rises during exercise are expected."),
    _m("blood_pressure", "Blood pressure", "mmHg", "physical",
       [("systolic_bp", "Systolic", T(90, 135, 80, 160)), ("diastolic_bp", "Diastolic", T(None, 85, None, 100))],
       "Arterial pressure from the cuff sensor. Fluid shifts in microgravity can change both values."),
    _m("spo2", "Blood oxygen (SpO₂)", "%", "physical",
       [("spo2_percent", "SpO₂", T(95, None, 90, None))],
       "Peripheral oxygen saturation. Sustained values under 95 % warrant attention; under 90 % is urgent.",
       decimals=1),
    _m("glucose", "Blood sugar", "mg/dL", "physical",
       [("blood_sugar_mg_dl", "Glucose", T(70, 140, 54, 250))],
       "Interstitial glucose. Rises after meals and dips during long work blocks without food are normal."),
    _m("respiration", "Breathing rate", "breaths/min", "physical",
       [("resp_rate_bpm", "Respiration", T(10, 22, 8, 28))],
       "Breaths per minute. High values at rest can signal breathlessness or a cabin CO₂ problem."),
    _m("core_temp", "Core temperature", "°C", "physical",
       [("core_temp_c", "Core temperature", T(36.0, 37.8, 35.5, 38.5))],
       "Core body temperature from the ingestible / patch sensor.", decimals=2),
    _m("hrv", "Heart rate variability", "ms", "physical",
       [("hrv_rmssd_ms", "RMSSD", T(25, None, 15, None))],
       "RMSSD between heartbeats. Lower variability over several days is a marker of accumulated stress or poor "
       "recovery.", decimals=1),
    _m("cortisol", "Cortisol (saliva)", "nmol/L", "physical",
       [("cortisol_nmol_l", "Morning cortisol", T(None, 19, None, 30))],
       "Salivary cortisol from the daily 06:30 sample. Persistently high morning values follow periods of stress "
       "and poor sleep.", decimals=1, cadence="daily"),
    _m("sleep_duration", "Sleep duration", "h", "physical",
       [("sleep_hours", "Sleep last night", T(6.0, None, 4.5, None)), ("sleep_7d_avg_h", "7-night average", None)],
       "Hours slept in the previous sleep period, with the average of the last 7 nights. The reference line is "
       "the in-flight average NASA measured on ISS crews.", decimals=2, cadence="daily", reference=SLEEP_REFERENCE),
    _m("sleep_efficiency", "Sleep efficiency", "%", "physical",
       [("sleep_efficiency_pct", "Efficiency", T(85, None, 75, None))],
       "Share of time in bed actually spent asleep.", decimals=1, cadence="daily"),
    _m("sleep_awakenings", "Night awakenings", "per night", "physical",
       [("sleep_awakenings", "Awakenings", T(None, 3.5, None, 6.5))],
       "Number of times the astronaut woke up during the last sleep period.", cadence="daily"),
    _m("body_mass", "Body mass", "kg", "physical",
       [("body_mass_kg", "Body mass", None)],
       "Weekly body-mass measurement. Slow loss is common on long missions.", decimals=2, cadence="weekly"),
    # --- Mental (behavioural signals — private to the astronaut & psychologist)
    _m("voice_stress", "Voice stress", "index 0–1", "mental",
       [("voice_stress_index", "Voice stress", T(None, 0.5, None, 0.8))],
       "Stress index computed from voice recordings during comms. Above 0.5 for several days suggests mounting "
       "psychological strain.", private=True, decimals=2),
    _m("speech_rate", "Speech rate", "words/min", "mental",
       [("speech_rate_wpm", "Speech rate", T(120, None, 100, None))],
       "Words per minute during comms. Slower speech often accompanies fatigue or low mood.", private=True),
    _m("blink_rate", "Blink rate", "blinks/min", "mental",
       [("blink_rate_per_min", "Blink rate", T(None, 20, None, 26))],
       "Blinks per minute from the workstation camera; higher rates are linked to tiredness.",
       private=True, decimals=1),
    # --- Environment (shared cabin) ----------------------------------------
    _m("cabin_co2", "Cabin CO₂", "mmHg", "environment",
       [("cabin_co2_mmhg", "CO₂ partial pressure", T(None, 4.0, None, 6.0))],
       "Carbon dioxide in the cabin air. Above 4 mmHg can cause headaches and poorer focus.", decimals=2),
    _m("cabin_o2", "Cabin oxygen", "kPa", "environment",
       [("cabin_ppo2_kpa", "O₂ partial pressure", T(19.5, 23.1, 17.0, 25.0))],
       "Oxygen partial pressure in the cabin air.", decimals=2),
    _m("cabin_pressure", "Cabin pressure", "kPa", "environment",
       [("cabin_pressure_kpa", "Total pressure", T(99.0, 103.0, 95.0, 105.0))],
       "Total cabin air pressure.", decimals=2),
    _m("cabin_temp", "Cabin temperature", "°C", "environment",
       [("cabin_temp_c", "Air temperature", T(18.0, 27.0, 15.0, 30.0))],
       "Cabin air temperature.", decimals=1),
    _m("cabin_humidity", "Cabin humidity", "%", "environment",
       [("cabin_humidity_pct", "Relative humidity", T(25, 70, 20, 75))],
       "Relative humidity of the cabin air.", decimals=1),
    _m("noise", "Noise level", "dBA", "environment",
       [("noise_dba", "Noise", T(None, 62, None, 70))],
       "Ambient noise. Sustained noise above ~62 dBA disturbs rest and concentration.", decimals=1),
    _m("light", "Lighting", "lux", "environment",
       [("light_lux", "Illuminance", None)],
       "Cabin illuminance. The lighting schedule follows a 24-hour day to support the body clock."),
    _m("light_color", "Light colour temperature", "K", "environment",
       [("light_cct_k", "Colour temperature", None)],
       "Warmer light (lower K) in the evening helps sleep; blue-rich light (higher K) supports alertness."),
    _m("radiation_rate", "Radiation dose rate", "µSv/h", "environment",
       [("radiation_rate_usv_h", "Dose rate", T(None, 120, None, 500))],
       "Current ionizing-radiation dose rate inside the habitat.", decimals=1),
    _m("radiation_total", "Total radiation dose", "mSv", "environment",
       [("radiation_cum_msv", "Cumulative dose", None)],
       "Mission dose accumulated since launch.", decimals=1),
    _m("earth_delay", "Earth signal delay", "min", "environment",
       [("earth_delay_min", "One-way delay", None)],
       "One-way communication delay with mission control on Earth.", decimals=2),
]

BY_KEY: dict[str, MetricDefinition] = {m.key: m for m in CATALOG}

# Metrics shown on the dashboard's primary column, per panel.
PRIMARY: dict[str, list[str]] = {
    "physical": ["heart_rate", "blood_pressure", "spo2", "glucose", "cortisol"],
    "mental": ["voice_stress", "sleep_duration", "hrv", "cortisol", "speech_rate"],
}

_RANK: dict[StatusTag, int] = {"NOMINAL": 0, "ADVISORY": 1, "URGENT": 2}


def worst(statuses: list[StatusTag]) -> StatusTag:
    return max(statuses, key=_RANK.__getitem__, default="NOMINAL")


def value_status(t: Thresholds | None, value: float | None) -> StatusTag:
    if t is None or value is None:
        return "NOMINAL"
    if (t.urgent_low is not None and value < t.urgent_low) or (t.urgent_high is not None and value > t.urgent_high):
        return "URGENT"
    if (t.advisory_low is not None and value < t.advisory_low) or (
        t.advisory_high is not None and value > t.advisory_high
    ):
        return "ADVISORY"
    return "NOMINAL"


def metric_status(metric: MetricDefinition, values: dict[str, float | None]) -> StatusTag:
    return worst([value_status(s.thresholds, values.get(s.field)) for s in metric.series])


def visible_metrics(can_see_private: bool) -> list[MetricDefinition]:
    return [m for m in CATALOG if can_see_private or not m.private]
