# Project BLUE — MVP

Astronaut physical & psychological health dashboard with **BLUE**, an adaptive AI psychologist
(NASA Space Apps — Astronaut Health Monitoring). See `PROJECT_SCOPE.md` and `AGENTS.md`.

## Quick start

```bash
# 1. Backend (FastAPI, port 8000)
python3.12 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt
cd backend && ../.venv/bin/uvicorn main:app --reload --port 8000

# 2. Frontend (Next.js, port 3000) — in another terminal
cd frontend && npm install && npm run dev
```

For a demo or everyday use, run the frontend in production mode instead of `npm run dev`:
`cd frontend && npm run demo` builds and serves the optimized app on port 3000 (about 4.5× less
JavaScript, pages shown 1.5–2.5× faster). Use `npm run dev` only while editing the code.

Open http://localhost:3000 and sign in. The frontend proxies `/api/*` to the backend
(`BLUE_API_URL`, default `http://localhost:8000`, see `frontend/.env.example`), so the
session cookie stays first-party.

## Groq demo conversation

Set `GROQ_API_KEY` in the backend environment, or put it in an ignored `backend/.env` file and start Uvicorn from `backend/` with `--env-file .env`.
The dashboard uses GPT-OSS 20B for the conversation and Whisper Large V3 Turbo for microphone turns. Set FISH_TTS_API_KEY and FISH_VOICE_ID in the backend environment for Fish Audio spoken replies. The browser supplies spoken replies when Fish Audio is unavailable.
With no key or when Groq is unavailable, the scripted check-in is available. Use simulated demo data for the cloud flow.

## Accounts & privacy

| Username | Password (demo) | Role | Sees |
| --- | --- | --- | --- |
| `vance` | `blue-vance-2035` | Commander | own data, BLUE, own reports |
| `chen` | `blue-chen-2035` | Flight Engineer | own data, BLUE, own reports |
| `lin` | `blue-lin-2035` | Mission Specialist | own data, BLUE, own reports |
| `surgeon` | `blue-surgeon-2035` | Flight surgeon | all crew — physical & cabin data only |

These passwords are public — change them before showing the app outside the team:
`.venv/bin/python scripts/manage_users.py set-password vance` (or `init` to reset all).
Set `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=1` to list the demo accounts on the login screen.

What is enforced on the server (`backend/core/auth.py`, `backend/main.py`):

* every route except `/api/health` and `/api/auth/login` needs a session; sessions are random
  tokens in an httpOnly, SameSite=Lax cookie (8 h; set `BLUE_COOKIE_SECURE=1` behind HTTPS);
* passwords are PBKDF2-SHA256 hashed; 5 failed logins lock the username for 5 minutes;
* astronauts get 403 on anyone else's data; the flight surgeon gets a redacted profile with no
  mental-health reports, no mental highlights and no voice/behaviour metrics, and cannot use BLUE;
* API responses are `Cache-Control: no-store`; POSTs from unknown origins are rejected.

Sessions live in memory: restarting the backend signs everyone out.

## Demo flow (3 min)

1. Sign in as `surgeon` → crew overview (physical only) → open **Spec. Maya Lin**; note the
   mental reports are replaced by mission events. Log out.
2. Sign in as `lin` → the dashboard shows only key readings. Click **Blood oxygen** → the
   7-day chart shows the day-148 dip to 88.5 % with a numbered event marker; try *Whole mission*.
3. Toggle **Physical / Mental Panel**; click body markers for details and "View chart".
4. **Talk to Blue** → BLUE opens with the episode context and asks 3–5 follow-ups
   (`DEEP_SUPPORT`); `vance` gets a 2-question `BRIEF_CHECKIN`.
5. **End Session & Generate Earth Report** → new headline at the top of the reports list →
   open it or **Simulate Earth Psychologist Reply** for the "What to do" directive.

6. Still as `lin`, open **Crew life** in the rail. Maya is the last crewmate missing for this
   week's challenge (4 of 5 days): her check-in completes it, BLUE thanks her with a space fact,
   a 17th star joins the **mission map** and the crew can vote for the shared reward. Send three
   encouragements to make her the week's **Crew Compass**.

Generated reports and crew-life activity live in memory only: restart the backend to reset the demo.

## Crew life (weekly titles & crew challenge)

A light "employee of the month", space edition, to make talking to BLUE something the crew want
to do (`backend/core/crew_life.py`, page `/dashboard/crew-life`, astronauts only):

| Title | Who leads |
| --- | --- |
| Keeper of Calm | most pauses / calming rituals validated (max 3 a day count) |
| Check-in Star | most regular run of check-ins with BLUE |
| Voice of the Station | most messages to BLUE, whatever the topic (counted, never read) |
| Sleep Captain | most regular bedtime from the CSV, rewarding regularity, not hours slept |
| Crew Compass | most encouragements sent to crewmates (max 3 a day) |

* **Crew challenge instead of duels:** the whole crew checks in on 5 of 7 days. Completing it
  unlocks a shared reward the crew votes on (movie night or special meal), raises the Crew Challenge badge, and adds a
  **star on the mission map**.
* **Rewards aboard:** each title holder picks a concrete perk (station playlist, a favourite meal
  on the menu, the wake-up song, the quiet-hour programme, the Sunday activity).
* **Prestige badges:** each title and the crew challenge has its own emblem (wings, star, blades,
  crown, compass rose, crew shield) on one premium gunmetal-and-chrome body. Earning it again
  raises its rarity, coded by the colour of the glowing inlaid lines: Common white ×1, Rare blue
  ×2, Epic purple ×3, Legendary red ×5, Mythic yellow ×10, with one pip per tier (sparkles from
  Epic, light rays and a moving reflection from Legendary). The overview's mission bar shows the
  astronaut's badges next to *BLUE / Crew Health* (details on hover).
* **Immediate reward:** every check-in filed with BLUE returns a thank-you, the week's progress
  and a space fact (`ChatResponse.reward`).
* **No pressure, no exposure:** only leaders are named, ties are shared, nobody is ranked last,
  and nobody sees another crewmate's numbers. Anyone can leave the titles; their check-ins still
  count for the crew. The flight surgeon has no access (403).

Mission weeks start on day 4 (days 1–3 were launch and commissioning), so day 150 closes week 21.
The week's activity is seeded from `backend/data/crew_life.json`; Sleep Captain comes from the
bedtimes `scripts/build_mock_data.py` extracts into `telemetry/<id>.json` (`sleep` block).

## Data

Source: `data/source/astra_donnees_simulees.csv` (ASTRA simulated telemetry, 4 crew, mission
days 120–150, 15-minute cadence). Crew C1–C3 become Vance, Chen and Lin; C4 is not used.

```bash
.venv/bin/python scripts/expand_dataset.py           # -> data/source/astra_donnees_etendues.csv (days 1–150)
.venv/bin/python scripts/build_mock_data.py          # -> backend/data/astronauts.json + telemetry/*.json
.venv/bin/python scripts/build_mock_data.py --check  # validate against schemas.py
```

Everything shown in the app (current values, statuses, highlights, events, seeded reports, history)
is derived from the CSV by these scripts. Metric labels, units and alert bands live in
`backend/core/metrics.py`; they are demo alert bands, not clinical reference ranges.

## Tests & checks

```bash
cd backend && ../.venv/bin/python -m pytest -q
cd frontend && npm run typecheck && npm run build
```

## MVP status

| Area | Status |
| --- | --- |
| Login, sessions, astronaut / flight-surgeon access rules | Done |
| Dashboard with primary info only; per-metric detail pages (26 metrics, 4 ranges, events) | Done |
| ASTRA CSV expanded to the whole mission; data-driven profiles and events | Done |
| SVG body model (brain / heart / lungs / metabolic) with callouts | Done |
| BLUE conversation (`BRIEF_CHECKIN` / `DEEP_SUPPORT`), Earth report, Earth reply | Done — deterministic scripted engine |
| LLM-backed BLUE | Live Fish Audio conversation, with crew context and an offline check-in fallback |
| Voice & animated character | Animated blue octopus, continuous live microphone, separate microphone/speaker mute, text and backup voice input |

## BLUE voice companion

Click the bottom-right blue dot to open BLUE and allow microphone access. The animated octopus listens and talks using the
Fish Audio live agent. The microphone stays connected throughout the conversation; replies do not require another click.
**Mute microphone** controls your input, while the speaker button controls BLUE’s output independently.
Closing the drawer releases the microphone. Hidden tabs suspend the session; returning resumes with the conversation history.

Spoken and typed messages use the same live agent, with the selected astronaut’s vitals and recent check-in history.
The agent answers direct questions before continuing the voluntary survey. **End Session & Generate Earth Report** still files
the conversation through the existing backend. If live voice is unavailable, the text check-in and backup speech input remain available.

Each live session receives the astronaut's dashboard snapshot: all current readings and metric definitions/alert bands,
24-hour/7-day/30-day/whole-mission chart statistics, events, reports and Earth directives, plus the current Crew life board
(weekly titles, holders, perks, own challenge progress, anonymous crew progress, rewards and mission stars).
Dashboard questions do not count as check-in answers. BLUE answers first, then continues the unanswered check-in topics.
Offline replies can explain recorded metrics and weekly titles/challenges; open-ended medical education requires the live agent.
Context refreshes when BLUE opens a new live session; changes made while a session is open require reopening BLUE.
BLUE explains general medical topics without diagnosing, prescribing or treating demo alert bands as clinical reference ranges.
Medical guidance follows the limits described by [MedlinePlus](https://medlineplus.gov/encyclopedia.html), including
[urgent symptom guidance](https://medlineplus.gov/ency/article/001927.htm) adapted to the onboard medical officer and mission protocol.
The agent cannot change votes/perks, validate rituals, send messages to crew or Earth, or file reports by voice alone.

Wake recognition uses the browser when available, with backup transcription if its speech service fails.
Say “Hey Bleu” or “Hey Blue”, or use the dot by mouse/keyboard. The activation phrase is discarded.

The backend reads `FISH_API_KEY`, `FISH_AGENT_ID`, and `FISH_VOICE_ID` from environment variables or `fish-blue/.env`.
The current voice is `933563129e564b19a115bedd57b7406a`. API keys stay server-side; browsers receive temporary session tokens.
Use Python 3.11+ and Node 22.18+ for local development and tests.

```bash
node --test frontend/tests/browserSpeech.test.mjs
# With frontend :3000 and backend :8000 running; uses a disposable desktop Chrome profile and a test microphone.
node frontend/tests/voiceCharacter.chrome.mjs
```
