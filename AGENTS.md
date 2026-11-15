# AGENTS.md — Engineering Guardrails & 5-Agent Parallel Spec

> **PURPOSE:** This file is the single source of truth for all AI coding agents building **Project BLUE**. Every agent MUST read this file before generating code. Do not invent unapproved features, alter the night-navy console theme (Section 1), or touch files outside your assigned team directory.

---

## 1. Prime Directive & Visual Theme Lock

* **Mission:** Build a reliable, demo-ready web application for the NASA Space Apps Challenge ("Astronaut Health Monitoring") where an astronaut **signs in** and sees only their own data, views a 3-column Physical/Mental dashboard with a central human body model, and uses a bottom-right round voice button to talk to **BLUE**—an adaptive AI psychologist that writes summary reports for Earth.
* **Privacy first:** health data is personal. Every API route except `/api/health` and `/api/auth/login` requires a session; access rules are enforced server-side (Section 2B).
* **Primary info first:** the dashboard shows only key readings with a status. Charts, ranges, statistics and full reports live one click away on detail pages.
* **Strict Visual Theme — "BLUE / Crew Health" night-navy console** (tokens in `frontend/src/app/globals.css`):
  * **Canvas (bleu nuit):** `#0A1628` · **Rail & top bar:** `#060F1D` · **Panels:** `#0F1F36` with `1px solid #1E3556`, radius 4–6 px, almost no shadow · **Raised / hover:** `#152946`
  * **Light-blue accent (links, focus, selection):** `#7CC7F2` (hover `#A8DBF7`) · **NASA blue** `#0B3D91` (brand mark, active toggles, avatars, BLUE button) · **NASA red** `#FC3D21` (Urgent only)
  * **Text:** `#E6EEF8` primary · `#9AB0CB` secondary · `#7890AE` labels (all ≥ 4.5:1 on panels)
  * **Status (medical):** Normal `#3CC8AE` (teal, circle) · Watch `#EDB04F` (amber, triangle) · Urgent `#FC3D21` (NASA red, diamond) — always shape + word, never colour alone
  * **Charts:** series `#3E95DD` / `#D0699F` (2nd dashed), validated for colour-blind separation on `#0F1F36`
  * **Type:** IBM Plex Sans for text, IBM Plex Mono (tabular) for measures, times and identifiers
  * **STRICTLY FORBIDDEN:** purple/neon gradients, glows and halos, glassmorphism, star fields or sci-fi décor, big rounded corners, emojis, decorative illustrations without a function, light-mode toggles that break the palette.

---

## 2. Strict "DO NOT BUILD" List (Anti-Scope-Creep)

AI agents **MUST NOT** build, install, or execute any of the following:

1. **NO `"Hey Blue"` Wake Word:** Do NOT implement continuous microphone wake-word detection. Voice sessions are triggered *exclusively* by clicking the round floating button in the bottom-right corner.
2. **NO Heavy 3D WebGL Libraries:** Do NOT install `three`, `@react-three/fiber`, or Spline viewers. Build the central **Human Model** using a clean, multi-layered interactive **SVG anatomical component** so it loads instantaneously with zero WebGL crashes.
3. **NO Third-Party Auth Stacks:** Login is the built-in username/password flow in `backend/core/auth.py` (PBKDF2 hashes, httpOnly session cookie). Do NOT add OAuth, JWTs, auth SaaS, or client-readable tokens; never store credentials or health data in `localStorage`.
4. **NO External Databases:** Do NOT set up PostgreSQL, MongoDB, Redis, or Prisma. Accounts live in `backend/data/users.json`; crew profiles in `backend/data/astronauts.json`; history in `backend/data/telemetry/*.json`; sessions and generated reports in FastAPI in-memory state.
5. **NO Credentialed Dataset Downloads or Runtime CSV Parsing:** Do NOT download gated datasets or parse CSVs inside FastAPI endpoints. All normalization happens once offline (Section 3).

### 2B. Access Rules (enforced in `backend/main.py` + `core/auth.py`)

| Role | Sees | Never sees / cannot do |
| :--- | :--- | :--- |
| **Astronaut** (`vance`, `chen`, `lin`) | Their own profile, all their metrics, BLUE chats, mental-health reports | Any other astronaut's data (403) |
| **Flight surgeon** (`surgeon`) | All 3 crew: physical + cabin metrics, status, events | Mental-health reports, mental body highlights, private behavioural metrics (`voice_stress`, `speech_rate`, `blink_rate`), BLUE chat, Earth reply, crew life (403 / redacted) |

**Crew life** (`/api/crew-life*`, `core/crew_life.py`) is shared between the astronauts only and always acts as the signed-in astronaut. It names title leaders only (ties shared, no ranking, never another crewmate's numbers), counts BLUE messages without reading them, shows encouragements only to their sender and recipient, and lets anyone leave the titles (`share_in_titles`).

API responses carry `Cache-Control: no-store`; cross-origin POSTs are rejected. The frontend calls same-origin `/api/*`, proxied to FastAPI by `next.config.ts`.

---

## 3. Canonical Dataset & Seed Files

### A. Source data (committed)
* **`data/source/astra_donnees_enrichies_nasa.csv` — the single input of the ETL.** 4 crew, days 1–150, 15-minute cadence, 53 columns: the 37 ASTRA telemetry columns (vitals, HRV, respiration, core temp, glucose, voice stress, speech rate, blink rate, salivary cortisol, sleep, body mass, radiation, cabin environment, Earth delay, labelled events; days 120–150 from the original simulation, days 1–119 extended by `scripts/expand_dataset.py`: seeded donor-day + AR(1), tagged `data_source=simule_etendu`) plus 16 enrichment columns: the NASA in-flight sleep reference (7.33 ± 1.16 h, NTRS 20230003916), NASA behavioural-health reference ids, a 7-night sleep average and previous-7-day means for sleep, HRV and speech rate.

### B. Offline ETL
* `scripts/build_mock_data.py` reads only `astra_donnees_enrichies_nasa.csv`. Before writing, it checks the required columns, checks that the cited NASA sources match `core/metrics.py` (`REFERENCES`, `SLEEP_REFERENCE`) and recomputes every derived column; any mismatch stops the build. It maps **C1 → `astro-vance`, C2 → `astro-chen`, C3 → `astro-lin`** (C4 is not part of the demo crew) and writes `backend/data/astronauts.json` + `backend/data/telemetry/<id>.json`. **The CSV drives everything**: current values, status tags, body highlights, events and seeded reports are all derived from it. Never hand-edit the outputs; change the ETL and re-run it.
* Enrichment use: `sleep_duration` gets a second series `sleep_7d_avg_h` (7-night average) and a `reference` (NASA in-flight average); `profile.baselines` compares the last mission day with the previous 7 days (sleep, HRV, speech rate; speech rate is removed for the flight surgeon). Both are context only, never a status. The per-15-minute delta columns are not used (they track activity, not change).
* Metric labels, units, alert bands, NASA references and privacy class live in **`backend/core/metrics.py`** (single source of truth, served at `GET /api/metrics`).

### C. The 3 canonical crew profiles (as derived on mission day 150)
1. **`astro-vance` — Cmdr. Elena Vance (Commander):** `NOMINAL`. Lived through the cabin CO₂ scrubber fault (days 138–144) with steady readings. Triggers BLUE's `BRIEF_CHECKIN`.
2. **`astro-chen` — Eng. Marcus Chen (Flight Engineer):** `ADVISORY`. Slow sleep & stress drift, days 136–146 (up to 7 awakenings/night, voice stress up to 0.61, daily HRV down to 32 ms, cortisol up to 21.9 nmol/L), easing after the evening lighting was moved earlier on day 143. Mental-side highlights; triggers `DEEP_SUPPORT`.
3. **`astro-lin` — Spec. Maya Lin (Mission Specialist):** `ADVISORY`. Acute dizziness & breathlessness during exercise on day 148 (SpO₂ 88.5 %, HR 141 BPM), recovered; morning cortisol 19.9 nmol/L above the alert line. Physical highlights (`lungs`, `heart`) + `brain`; triggers `DEEP_SUPPORT` and a queued priority Earth report.

## 4. Exact Spatial Layout Invariant

The main dashboard (`frontend/src/app/dashboard/page.tsx`) must fit cleanly on a `1440x900` or `1920x1080` screen and obey this exact layout:

* **Entry:** `/` is the login screen. Astronauts land on `/dashboard` (their own); the flight surgeon lands on `/crew` (roster) and opens `/dashboard?id=<astronaut>`.
* **Shell (`AppShell`):** narrow navigation rail on the left (Overview, Crew [surgeon], Metrics, Reports + Log [astronaut]) and a compact mission bar on top: `BLUE / Crew Health`, mission and day, live UTC clock, sync state + last data time (offline state shown), `Earth link 21m 52s delay`, `Log out`.
* **Profile strip:** avatar, name, status, role · id (`Switch astronaut` for the flight surgeon only), the **`[ Physical | Mental ]`** toggle, the trend period (24 h · 7 d · 30 d) and `Export report` (weekly / 30-day Markdown export built in the browser from data the account may see).
* **Main 3-column grid (less detail on the home page — numbers, trend lines and statuses only):**
  * **Left ($\approx 30\%$) — Trends:** 5 key readings for the active panel (out-of-range ones first): label, value, unit, status, and a bare trend line (no axes; dashed alert lines; gaps for missing samples). Physical: heart rate, blood pressure, SpO₂, blood sugar, cortisol. Mental: voice stress, sleep, HRV, cortisol, speech rate. Each row links to its detail page.
  * **Centre ($\approx 38\%$):** one-line status summary, then — Physical panel — the **SVG body model** (matte silhouette, limited ±30° turntable by drag/slider/keys, discrete markers `heart`, `lungs`, `metabolic`, labels only for alerts, plus a **List** view); — Mental panel — **Mind & recovery** (observations over time + BLUE check-in counts). Mental health is never placed on the body.
  * **Right ($\approx 32\%$):** the selected zone's observations (date, provenance: Sensor / Lab sample / Computed / Self-reported, linked event, "View chart") or, with nothing selected, **To review**; below, the astronaut's **Reports for Earth** (one-line headlines, Earth status, `"Simulate Earth Psychologist Reply"` on queued ones; full list at `/dashboard/reports`) or, for the flight surgeon, **Recent events** (reports are private).
* **Detail pages:** `/dashboard/metrics/<metric>` — metric picker grouped Body / Mind & behaviour / Cabin environment, provenance + cadence, range tabs (24 h · 7 days · 30 days · whole mission · custom day range), chart with normal-range band, low–high band, numbered event markers and the astronaut's mission average, summary stats (avg/min/max/% in range + previous-period average), events in range, and a data table.
* **BLUE button:** fixed bottom-right pill (NASA blue, light-blue mic disc) labelled `"Talk to Blue"` / `LOG`. It opens the BLUE log panel bottom-right (microphone speech-to-text + spoken reply + text input) with a light backdrop so the readings and the body stay visible. The rail's **Log** entry opens the same panel.

---

## 5. Adaptive Psychologist AI Rules (`backend/core/psychologist.py`)

BLUE must behave like a calm, attentive human aerospace psychologist—not a generic chatbot:

1. **Situational Depth Adaptation:**
   * Inspect the astronaut's `current_vitals` and recent `mental_reports` before responding:
   * **`BRIEF_CHECKIN` Mode** (status `NOMINAL` and every personal metric inside its band in `core/metrics.py` — e.g., `astro-vance`): Ask **2 concise, warm check-in questions** (daily energy, crew morale), then offer to wrap up and file a routine report.
   * **`DEEP_SUPPORT` Mode** (status `ADVISORY`/`URGENT` or any personal metric out of band, such as `astro-chen` or `astro-lin`—OR astronaut expresses fatigue, anxiety, or sleep issues): Ask **3 to 5 empathetic, targeted follow-up questions** exploring physical symptoms, workload stress, and sleep before concluding.
2. **Automatic Earth Summary Report Generation:**
   * When the user clicks `"End Session & Generate Earth Report"` (or BLUE concludes the check-in), the backend generates a structured `MentalHealthReport` JSON object and prepends it to that astronaut's `mental_reports` list so it immediately renders in the **Right Column** of the dashboard.
3. **Demo Failsafe:**
   * If the LLM or speech service times out ($> 5\text{s}$) or is offline, fall back gracefully to deterministic, context-matched psychologist questions and report templates tailored to `astro-vance`, `astro-chen`, and `astro-lin` so the demo never stalls.

---

## 6. Approved Tech Stack & Directory Layout

```text
project-blue/
├── PROJECT_SCOPE.md             # Mission, datasets & product overview
├── AGENTS.md                    # This guardrail document
├── data/source/
│   └── astra_donnees_enrichies_nasa.csv  # single source: telemetry days 1–150 + NASA enrichment
├── scripts/
│   ├── expand_dataset.py        # history: generated the day 1–119 telemetry (not in the build)
│   ├── build_mock_data.py       # enriched CSV -> astronauts.json + telemetry/*.json
│   └── manage_users.py          # demo accounts / change passwords
├── backend/
│   ├── requirements.txt         # fastapi, uvicorn, pydantic, httpx, python-multipart
│   ├── main.py                  # FastAPI routes, auth guard, CORS/CSRF/no-store
│   ├── schemas.py               # Pydantic contracts (mirror: frontend/src/types/blue.ts)
│   ├── data/
│   │   ├── astronauts.json      # 3 canonical profiles (generated, committed)
│   │   ├── telemetry/<id>.json  # columnar history: 24 h raw, 7 d hourly, mission daily, nightly bed/wake times
│   │   ├── crew_life.json       # crew-life seed: past weeks, this week's check-ins, pauses, encouragements
│   │   └── users.json           # accounts with PBKDF2 hashes
│   ├── tests/test_api.py        # auth, privacy, data and BLUE flow tests
│   └── core/
│       ├── auth.py              # passwords, sessions, lockout, access rules
│       ├── metrics.py           # metric catalog: labels, units, bands, privacy
│       ├── telemetry.py         # history ranges + stats for detail pages
│       ├── profiles.py          # in-memory store + flight-surgeon redaction
│       ├── psychologist.py      # BRIEF_CHECKIN vs DEEP_SUPPORT engine
│       ├── report_generator.py  # Earth summary report + simulated Earth reply
│       ├── crew_life.py         # weekly titles, crew challenge, rewards aboard, mission map
│       ├── space_facts.py       # facts for the reward after each check-in
│       └── speech.py            # STT/TTS stub + graceful fallback
└── frontend/
    ├── next.config.ts           # proxies /api/* to FastAPI (first-party cookie)
    └── src/
        ├── types/blue.ts        # TypeScript mirror of backend/schemas.py
        ├── lib/api.ts           # typed same-origin fetch wrapper
        ├── lib/session.ts       # useRequireUser / useTargetAstronaut
        ├── lib/metrics.ts       # icons, formatting, primary metric lists
        ├── app/
        │   ├── page.tsx                         # Login
        │   ├── crew/page.tsx                    # Flight-surgeon crew overview
        │   └── dashboard/
        │       ├── page.tsx                     # 3-column dashboard (primary info)
        │       ├── metrics/[metric]/page.tsx    # Metric detail + charts
        │       ├── reports/page.tsx             # All reports (astronaut)
        │       ├── crew-life/page.tsx           # Weekly titles, crew challenge, mission map (astronaut)
        │       └── reports/[reportId]/page.tsx  # Full mental-health report
        └── components/
            ├── AppShell.tsx  TopNavBar.tsx  VitalsPanel.tsx  Sparkline.tsx
            ├── HumanBodyModel.tsx  MindPanel.tsx  ObservationsPanel.tsx  SourceTag.tsx
            ├── MentalReportsPanel.tsx  EventsPanel.tsx  MetricChart.tsx  ExportDialog.tsx
            ├── VoicePsychologistFab.tsx  StatusBadge.tsx  ScreenStates.tsx
            └── PrestigeBadge.tsx  PrestigeStrip.tsx  MissionStarMap.tsx
```

---

## 7. 5-Person Parallel Team Ownership Matrix

To prevent merge conflicts while running 5 AI agents simultaneously, each teammate owns **exclusive files** and works on a dedicated Git branch:

| Teammate | Branch | Exclusive Files (Only Touch These) | Core Responsibility |
| :--- | :--- | :--- | :--- |
| **Person 1: Crew Data & ETL Lead** | `feat/crew-data` | `data/source/*.csv`<br>`scripts/expand_dataset.py`<br>`scripts/build_mock_data.py`<br>`backend/data/astronauts.json`<br>`backend/data/telemetry/*.json`<br>`backend/core/metrics.py`<br>`backend/core/telemetry.py`<br>`backend/core/profiles.py` | Expand the ASTRA CSV, derive the 3 canonical profiles (`astro-vance`, `astro-chen`, `astro-lin`), events and history files, own the metric catalog and history API helpers. |
| **Person 2: Psychologist AI & Report Lead** | `feat/psychologist-ai` | `backend/core/psychologist.py`<br>`backend/core/report_generator.py` | Build BLUE's adaptive conversational logic (`BRIEF_CHECKIN` vs. `DEEP_SUPPORT`) and the structured Earth Psychologist Summary Report generator. |
| **Person 3: Voice UI & Speech Lead** | `feat/voice-blue` | `backend/core/speech.py`<br>`frontend/src/components/VoicePsychologistFab.tsx` | Build the bottom-right round voice button, live mic recording + Web Speech / backend STT-TTS loop, waveform animation, and text fallback input. |
| **Person 4: Body Model & Charts Lead** | `feat/body-charts` | `frontend/src/app/dashboard/metrics/[metric]/page.tsx`<br>`frontend/src/components/HumanBodyModel.tsx`<br>`frontend/src/components/VitalsPanel.tsx`<br>`frontend/src/components/MetricChart.tsx`<br>`frontend/src/lib/metrics.ts` | Build the left-column key readings, the metric detail pages and charts, and the center interactive anatomical SVG Human Model in light blue/white. |
| **Person 5: Reports UI, Auth & API Glue Lead** | `feat/integration` | `backend/main.py`<br>`backend/core/auth.py`<br>`backend/data/users.json`<br>`scripts/manage_users.py`<br>`frontend/next.config.ts`<br>`frontend/src/lib/api.ts`<br>`frontend/src/lib/session.ts`<br>`frontend/src/app/page.tsx` (login)<br>`frontend/src/app/crew/page.tsx`<br>`frontend/src/app/dashboard/page.tsx`<br>`frontend/src/app/dashboard/reports/[reportId]/page.tsx`<br>`frontend/src/components/TopNavBar.tsx`<br>`frontend/src/components/MentalReportsPanel.tsx`<br>`frontend/src/components/EventsPanel.tsx` | Wire FastAPI endpoints and access rules, login/session flow, the Top Switcher, the Right Column reports feed + Earth reply simulator, and manage serial merges into `main`. |

---

## 8. Data Contracts (`schemas.py` <-> `types/blue.ts`)

Both files must change together; Pydantic rejects unknown keys. Never rename keys without team approval.

### A. Auth & profile

* `POST /api/auth/login` `{username, password}` -> `SessionUser {username, display_name, role: "astronaut"|"flight_surgeon", astronaut_id}` + `blue_session` httpOnly cookie. `POST /api/auth/logout`, `GET /api/auth/me`.
* `GET /api/astronauts` / `GET /api/astronauts/{id}` -> `AstronautProfile`:

```json
{
  "id": "astro-lin", "name": "Spec. Maya Lin", "role": "Mission Specialist", "mission_day": 150,
  "avatar_initials": "ML", "status_tag": "ADVISORY",
  "status_summary": "Follow-up after an acute dizziness episode on day 148. Currently elevated: cortisol (saliva).",
  "last_reading_at": "2035-10-06T23:45:00Z", "last_activity": "Asleep",
  "current_vitals": { "heart_rate_bpm": 55, "systolic_bp": 109, "diastolic_bp": 72, "spo2_percent": 97.4,
                      "blood_sugar_mg_dl": 95, "cortisol_nmol_l": 19.9, "voice_stress_index": 0.24, "...": "29 fields" },
  "metric_status": { "heart_rate": "NOMINAL", "cortisol": "ADVISORY", "...": "one per metric" },
  "body_highlights": { "physical": [{ "zone": "lungs", "label": "SpO₂ fell to 88.5 %", "severity": "ADVISORY",
                                      "detail": "During exercise on day 148; back to 97.4 % now.", "metric": "spo2" }],
                       "mental": [] },
  "events": [{ "id": "evt-lin-00", "code": "ACUTE_DIZZINESS_BREATHLESSNESS", "scope": "crew", "severity": "URGENT",
               "label": "Dizziness & breathlessness during exercise", "detail": "...", "mission_day": 148,
               "start": "2035-10-04T14:15:00Z", "end": "2035-10-04T15:45:00Z", "metrics": ["spo2", "heart_rate"] }],
  "mental_reports": [{ "id": "rep-201", "created_at": "Mission Day 148", "session_mode": "DEEP_SUPPORT",
                       "headline": "...", "summary": "...", "biometric_correlation": "...",
                       "earth_status": "QUEUED_FOR_EARTH", "earth_psychologist_directive": null }],
  "baselines": { "mission_day": 150, "method": "...",
                 "items": [{ "metric": "hrv", "field": "hrv_rmssd_ms", "today": 52.85, "previous_7d_mean": 52.48,
                             "previous_7d_days": 7, "delta": 0.38, "delta_pct": 0.7 }],
                 "references": [{ "id": "HRR task 1623", "title": "...", "url": "..." }] },
  "mental_redacted": false
}
```

* `MetricDefinition.reference` (optional): `{label, mean, sd, detail, source: {id, title, url}}`, an external population average drawn on the chart (sleep: NASA in-flight 7.33 ± 1.16 h).

* `GET /api/metrics` -> `MetricDefinition[]` (private metrics omitted for the flight surgeon).
* `GET /api/astronauts/{id}/metrics/{metric}?range=24h|7d|30d|all` -> `MetricHistory {metric, range, resolution: "15min"|"hourly"|"daily", points[{t, mission_day, activity, values, low, high}], stats[{field, min, max, avg, last, pct_nominal}], events[]}`.

### B. Psychologist Conversation Turn (`POST /api/chat`, astronaut only, own `astronaut_id`)

* **Request JSON:**
```json
{
  "astronaut_id": "astro-lin",
  "messages": [
    { "role": "assistant", "content": "Hi Maya, I noticed your evening cortisol has been elevated over the past few cycles. How are you holding up today?" },
    { "role": "user", "content": "Honestly pretty drained—I've been waking up mid-sleep and feeling isolated from the crew rotation." }
  ],
  "finish_session": false
}
```

* **Response JSON:**
```json
{
  "reply": "Thank you for sharing that honestly, Maya. Fragmented sleep paired with feeling out of sync with the crew can weigh heavily over long stretches. Have you noticed that fatigue affecting your focus during lab work, or mostly during off-duty hours?",
  "session_mode": "DEEP_SUPPORT",
  "suggested_to_wrap_up": false,
  "generated_report": null
}
```

*(When `finish_session: true`, `generated_report` returns a completed `MentalHealthReport` object with `"earth_status": "QUEUED_FOR_EARTH"`, and the backend automatically prepends it to `astronaut.mental_reports`.)*

* `ChatRequest.session_id` (optional, random per conversation) lets crew life count each message once; when `finish_session: true`, the response also carries `reward: CheckinReward {thank_you, space_fact, checkin_days, target_days, streak_days, first_today, challenge_completed, challenge_just_completed, stars}`.

### C. Simulate Earth Psychologist Directive (`POST /api/astronauts/{id}/reports/{report_id}/earth-reply`)

* Triggers a realistic Earth psychologist response (`"earth_status": "REVIEWED_BY_EARTH"` + populated `"earth_psychologist_directive"`) on any newly generated report during the live demo.

---

## 9. Agent Execution & Merge Protocol

1. **Phase 0 (First 20 Minutes):** Person 5 initializes `main` with `PROJECT_SCOPE.md`, `AGENTS.md`, `backend/schemas.py`, `frontend/src/types/blue.ts`, and empty scaffold folders. Person 1 commits the initial `backend/data/astronauts.json` containing the 3 canonical profiles (`astro-vance`, `astro-chen`, `astro-lin`). All 5 teammates pull `main` and checkout their assigned branch.
2. **Parallel Build (Hours 1–16):** Each teammate instructs their AI agent:
   > *"Read `PROJECT_SCOPE.md`, `AGENTS.md`, and `schemas.py` / `types/blue.ts`. Only modify files listed under my branch in Section 7. Strictly use the 3 canonical astronaut profiles (`astro-vance`, `astro-chen`, `astro-lin`) and the night-navy console palette (`#0A1628` / `#0F1F36` / `#7CC7F2` / NASA `#0B3D91`)."*
3. **Serial Integration Checkpoints (Every 4 Hours):** Person 5 merges one branch at a time into `main`, verifies `npm run build` and `uvicorn main:app` pass cleanly, and notifies the team to pull `main`.
4. **Agent Self-Check Before Finishing Any Turn:**
   * Did I stick to the night-navy console tokens in `globals.css` (no light theme, no purple/neon, no glows) and show status with shape + word?
   * Did I avoid adding `"Hey Blue"` wake-word listeners, heavy 3D libraries, or credentialed dataset downloads?
   * Did I align with the 3 canonical profiles (`astro-vance`, `astro-chen`, `astro-lin`) and match Section 8 JSON keys verbatim?
   * Does every new route go through `current_user` and the access rules in Section 2B? Does the flight surgeon still get no mental-health data?
   * Did I keep the dashboard to primary information and put detail behind a click?

### D. Crew life (astronaut only, about the signed-in astronaut)

* `GET /api/crew-life` -> `CrewLifeBoard {week, titles[{code, name, criterion, holders, you_hold, your_value, perk}], challenge, mission_map[], stars, patches[], ritual_options, rituals_today, encouragements_received, encouragements_sent, share_in_titles, ...}`.
* `POST /api/crew-life/rituals {kind}`, `/encouragements {to_id, message}`, `/perks/{perk} {option}` (title holder only), `/challenge/vote {option}` (once the challenge is complete), `/preferences {share_in_titles}` -> updated `CrewLifeBoard`. `POST /api/crew-life/blue-activity {astronaut_id, session_id, user_messages}` -> 204 (conversation closed without a report).

