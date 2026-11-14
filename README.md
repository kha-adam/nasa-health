# Project BLUE — MVP

Astronaut physical & psychological health dashboard with **BLUE**, an adaptive AI psychologist
(NASA Space Apps — Astronaut Health Monitoring). See `PROJECT_SCOPE.md` and `AGENTS.md`.

## Quick start

```bash
# 1. Backend (FastAPI, port 8000)
python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt
cd backend && ../.venv/bin/uvicorn main:app --reload --port 8000

# 2. Frontend (Next.js, port 3000) — in another terminal
cd frontend && npm install && npm run dev
```

Open http://localhost:3000, pick an astronaut, then click **Talk to Blue** (bottom-right).
Override the API URL with `NEXT_PUBLIC_API_URL` (see `frontend/.env.example`).

## Demo flow (3 min)

1. Selector → **Eng. Marcus Chen** (hypoglycemic trend) or **Spec. Maya Lin** (high evening cortisol).
2. Toggle **Physical Panel / Mental Panel** — the body model & telemetry emphasis change.
3. **Talk to Blue** → BLUE opens with the astronaut's context, asks 4–5 follow-ups (`DEEP_SUPPORT`)
   or 2 for Cmdr. Vance (`BRIEF_CHECKIN`, escalates if fatigue/anxiety/sleep issues are mentioned).
4. **End Session & Generate Earth Report** → the report appears at the top of the right column
   (`QUEUED_FOR_EARTH`) → **Simulate Earth Psychologist Reply** fills the "What to Do" directive.

Generated reports live in memory only: restart the backend to reset the demo.

## Data

`backend/data/astronauts.json` is the committed seed, produced by:

```bash
.venv/bin/python scripts/build_mock_data.py          # regenerate
.venv/bin/python scripts/build_mock_data.py --check  # validate against schemas.py
```

Hybrid ETL: if PhysioNet `mimic-iv-demo` is downloaded into `data/raw/mimic-iv-demo/`
(git-ignored), real HR/glucose variability is used as texture; otherwise a seeded synthetic texture.
Canonical anchor values from AGENTS.md are always preserved exactly.

## Tests & checks

```bash
cd backend && ../.venv/bin/python -m pytest -q
cd frontend && npm run typecheck && npm run build
```

## MVP status

| Area | Status |
| --- | --- |
| Crew selector, 3-column dashboard, Physical/Mental switcher | Done |
| SVG body model (brain / heart / lungs / metabolic) with callouts | Done |
| BLUE conversation (`BRIEF_CHECKIN` / `DEEP_SUPPORT`), Earth report, Earth reply | Done — deterministic scripted engine |
| LLM-backed BLUE | Not yet — `core/psychologist.py` is ready to be the timeout fallback |
| Voice (STT/TTS) | Deferred — text input in the BLUE drawer; `core/speech.py` is a stub |
