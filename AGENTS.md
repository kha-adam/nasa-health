# AGENTS.md — Engineering Guardrails & 5-Agent Parallel Spec

> **PURPOSE:** This file is the single source of truth for all AI coding agents building **Project BLUE**. Every agent MUST read this file before generating code. Do not invent unapproved features, alter the light-blue/white visual theme, or touch files outside your assigned team directory.

---

## 1. Prime Directive & Visual Theme Lock

* **Mission:** Build a reliable, demo-ready web application for the NASA Space Apps Challenge ("Astronaut Health Monitoring") where an astronaut selects one of three canonical profiles, views a 3-column Physical/Mental dashboard with a central human body model, and uses a bottom-right round voice button to talk to **BLUE**—an adaptive AI psychologist that writes summary reports for Earth.
* **Strict Visual Theme (Light Blue & White ONLY):**
  * **Background Canvas:** `#F4F9FF` (Soft Ice White-Blue)
  * **Cards & Panels:** `#FFFFFF` with `1px solid #DBEAFE` border and soft shadow
  * **Primary Accent (Medical Sky Blue):** `#0284C7` (hover `#0369A1`)
  * **Secondary Accent (Soft Cyan/Blue Tint):** `#E0F2FE` / `#BAE6FD`
  * **Primary Text:** `#0F172A` (Deep Slate) | **Secondary Text:** `#475569`
  * **Status Colors:** Nominal `#0D9488` (Teal), Advisory `#D97706` (Amber), Urgent `#DC2626` (Clinical Red)
  * **STRICTLY FORBIDDEN:** Dark mode, black sci-fi backgrounds, neon green/purple themes, or cyberpunk styling.

---

## 2. Strict "DO NOT BUILD" List (Anti-Scope-Creep)

AI agents **MUST NOT** build, install, or execute any of the following:

1. **NO `"Hey Blue"` Wake Word:** Do NOT implement continuous microphone wake-word detection. Voice sessions are triggered *exclusively* by clicking the round floating button in the bottom-right corner.
2. **NO Heavy 3D WebGL Libraries:** Do NOT install `three`, `@react-three/fiber`, or Spline viewers. Build the central **Human Model** using a clean, multi-layered interactive **SVG anatomical component** so it loads instantaneously with zero WebGL crashes.
3. **NO Authentication / Passwords:** The entry screen is a 1-click **Astronaut Selector** grid—no login forms, JWTs, or OAuth.
4. **NO External Databases:** Do NOT set up PostgreSQL, MongoDB, Redis, or Prisma. Store crew profiles, telemetry curves, and generated mental health reports in `backend/data/astronauts.json` + FastAPI in-memory state.
5. **NO Credentialed Dataset Downloads or Runtime CSV Parsing:** Do NOT attempt to download full gated `MIMIC-IV` (which requires CITI credentialing) or parse raw CSVs inside FastAPI endpoints. All dataset normalization happens once in `scripts/build_mock_data.py`, outputting `backend/data/astronauts.json`.

---

## 3. Canonical Dataset & Static `astronauts.json` Rule

All 5 teammates' agents MUST code against the exact same **three canonical astronaut profiles** stored in `backend/data/astronauts.json`:

### A. Approved Open-Access Data Sources (For `scripts/build_mock_data.py`)
* **Heartbeat, $\text{SpO}_2$, BP & Blood Glucose:** PhysioNet Open Access `mimic-iv-demo` (v2.2) via `pip install physionet` (`physionet download mimic-iv-demo --version 2.2`).
* **Wearable Stress & HRV Curves:** PhysioNet `wearable-device-dataset` (v1.0.1, $\approx 69.7\ \text{MB}$) and UCI **WESAD** (`IBI.csv`, `TEMP.csv`, `EDA.csv`).
* **Cortisol & State Anxiety Curves:** OSF **MAST Acute Stress & Cortisol Dataset** open CSV tables.
* **Spaceflight Analog Context:** **NASA OSDR** public datasets (`osdr.nasa.gov/bio/repo`).
* **Vocal Stress Calibration:** **RAVDESS** audio-only speech `.wav` subset ($\approx 200\ \text{MB}$).

### B. Static Seed Rule
* `backend/data/astronauts.json` is the **single offline source of truth** committed to `main`.
* Never invent extra astronaut IDs or random schemas. Every UI component, API route, and psychologist prompt must expect these exact **3 Canonical Crew Profiles**:
  1. **`astro-vance` — Cmdr. Elena Vance (Commander | Nominal Baseline):**
     * Vitals: HR $64\ \text{BPM}$, Blood Sugar $92\ \text{mg/dL}$, BP $116/74\ \text{mmHg}$, $\text{SpO}_2$ $98.6\%$, Cortisol $11.5\ \mu\text{g/dL}$.
     * Status: `NOMINAL`. Triggers BLUE's `BRIEF_CHECKIN` mode.
  2. **`astro-chen` — Eng. Marcus Chen (Flight Engineer | Physical Strain & Hypoglycemic Trend):**
     * Vitals: HR $98\ \text{BPM}$, Blood Sugar dropping $95 \rightarrow 62\ \text{mg/dL}$, BP $132/84\ \text{mmHg}$, $\text{SpO}_2$ $96.8\%$, Cortisol $17.8\ \mu\text{g/dL}$.
     * Status: `ADVISORY`. Highlights `metabolic` and `heart` zones on the **Physical Panel** and triggers BLUE's `DEEP_SUPPORT` mode.
  3. **`astro-lin` — Spec. Maya Lin (Mission Specialist | Isolation Fatigue & High Cortisol):**
     * Vitals: HR $82\ \text{BPM}$, Blood Sugar $86\ \text{mg/dL}$, BP $122/78\ \text{mmHg}$, $\text{SpO}_2$ $98.1\%$, Cortisol $22.4\ \mu\text{g/dL}$ (elevated evening stress curve).
     * Status: `ADVISORY`. Highlights `brain` (neuro-stress) zone on the **Mental Panel** and triggers BLUE's `DEEP_SUPPORT` mode + priority Earth psychologist report.

---

## 4. Exact Spatial Layout Invariant

The main dashboard (`frontend/src/app/dashboard/page.tsx`) must fit cleanly on a `1440x900` or `1920x1080` screen and obey this exact layout:

* **Top Header Bar:**
  * Left: Astronaut Avatar, Name, Role, Mission Day, and `"Switch Astronaut"` button.
  * Center: Segmented Toggle Switcher: **`[ Physical Panel | Mental Panel ]`**.
  * Right: Earth Comms Latency Indicator (`Earth Link: 20m 42s Delay`).
* **Main 3-Column Body Grid:**
  * **Left Column ($\approx 30\%$ width):** **Physical Telemetry & Charts** — Heartbeat ($\text{BPM}$), Blood Sugar ($\text{mg/dL}$), Blood Pressure ($\text{mmHg}$), $\text{SpO}_2$ ($\%$), and Cortisol ($\mu\text{g/dL}$) with clean Recharts/SVG sparklines and status badges.
  * **Center Column ($\approx 38\%$ width):** **Interactive Human Body Model** — Anatomical silhouette in light blue/white with interactive body-system markers (`brain`, `heart`, `lungs`, `metabolic`). Toggling between `Physical Panel` and `Mental Panel` dynamically changes which markers and callout cards are emphasized on the body model.
  * **Right Column ($\approx 32\%$ width):** **Mental Health Reports** — Scrollable list of structured psychological check-in reports, showing:
    * Session summary written by BLUE
    * Earth Uplink Status badge (`QUEUED_FOR_EARTH` / `REVIEWED_BY_EARTH`)
    * `"What to Do"` actionable directives from the Earth psychologist (plus a demo button `"Simulate Earth Psychologist Reply"` on newly generated reports).
* **Bottom-Right Floating Action Button (FAB):**
  * Fixed at `bottom-6 right-6`, circular (`w-16 h-16 rounded-full`), sky-blue gradient (`#0284C7` to `#38BDF8`) with microphone icon and label `"Talk to Blue"`.
  * Clicking opens the **BLUE Psychologist Voice Drawer/Modal** (supports microphone speech-to-text + spoken audio reply, plus a text input bar fallback for noisy hackathon rooms).

---

## 5. Adaptive Psychologist AI Rules (`backend/core/psychologist.py`)

BLUE must behave like a calm, attentive human aerospace psychologist—not a generic chatbot:

1. **Situational Depth Adaptation:**
   * Inspect the astronaut's `current_vitals` and recent `mental_reports` before responding:
   * **`BRIEF_CHECKIN` Mode** (all vitals nominal, blood sugar $\ge 72\ \text{mg/dL}$, heart rate $\le 100\ \text{BPM}$, cortisol $\le 16.0\ \mu\text{g/dL}$ — e.g., `astro-vance`): Ask **2 concise, warm check-in questions** (daily energy, crew morale), then offer to wrap up and file a routine report.
   * **`DEEP_SUPPORT` Mode** (any vital out of nominal range—blood sugar $< 72\ \text{mg/dL}$, heart rate $> 100\ \text{BPM}$, or cortisol $> 16.0\ \mu\text{g/dL}$, such as `astro-chen` or `astro-lin`—OR astronaut expresses fatigue, anxiety, or sleep issues): Ask **3 to 5 empathetic, targeted follow-up questions** exploring physical symptoms, workload stress, and sleep before concluding.
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
├── scripts/
│   └── build_mock_data.py       # Offline ETL normalizing PhysioNet/OSF CSVs -> astronauts.json
├── backend/
│   ├── requirements.txt         # fastapi, uvicorn, pydantic, httpx, python-multipart
│   ├── main.py                  # FastAPI server + CORS + REST routes
│   ├── schemas.py               # FROZEN Pydantic contracts (DO NOT DRIFT)
│   ├── data/
│   │   └── astronauts.json      # FROZEN 3 canonical astronaut profiles (committed seed)
│   └── core/
│       ├── profiles.py          # Load/update astronaut profiles & reports in memory
│       ├── psychologist.py      # Adaptive questioning engine (BRIEF_CHECKIN vs DEEP_SUPPORT)
│       ├── report_generator.py  # Synthesizes conversation + vitals into Earth summary report
│       └── speech.py            # STT/TTS handler + graceful fallback
└── frontend/
    ├── package.json             # next, react, tailwindcss, lucide-react, recharts
    └── src/
        ├── types/blue.ts        # FROZEN TypeScript mirror of backend/schemas.py
        ├── lib/api.ts           # Typed fetch wrapper for localhost:8000
        ├── app/
        │   ├── page.tsx         # Screen 1: Astronaut Crew Selector (3 canonical cards)
        │   └── dashboard/
        │       └── page.tsx     # Screen 2: 3-Column Light Blue/White Dashboard
        └── components/
            ├── TopNavBar.tsx            # Astronaut badge + [Physical | Mental] switcher
            ├── PhysicalChartsPanel.tsx  # Left column: Heartbeat, Blood Sugar, BP, SpO2, Cortisol
            ├── HumanBodyModel.tsx       # Center column: Interactive anatomical SVG model
            ├── MentalReportsPanel.tsx   # Right column: Mental health reports + Earth feedback
            └── VoicePsychologistFab.tsx # Bottom-right round button + BLUE voice modal
```

---

## 7. 5-Person Parallel Team Ownership Matrix

To prevent merge conflicts while running 5 AI agents simultaneously, each teammate owns **exclusive files** and works on a dedicated Git branch:

| Teammate | Branch | Exclusive Files (Only Touch These) | Core Responsibility |
| :--- | :--- | :--- | :--- |
| **Person 1: Crew Data & ETL Lead** | `feat/crew-data` | `scripts/build_mock_data.py`<br>`backend/data/astronauts.json`<br>`backend/core/profiles.py` | Normalize open-access PhysioNet (`mimic-iv-demo`, `wearable-device-dataset`) & OSF MAST cortisol curves into the 3 canonical profiles (`astro-vance`, `astro-chen`, `astro-lin`) in `astronauts.json` and build profile CRUD helpers. |
| **Person 2: Psychologist AI & Report Lead** | `feat/psychologist-ai` | `backend/core/psychologist.py`<br>`backend/core/report_generator.py` | Build BLUE's adaptive conversational logic (`BRIEF_CHECKIN` vs. `DEEP_SUPPORT`) and the structured Earth Psychologist Summary Report generator. |
| **Person 3: Voice UI & Speech Lead** | `feat/voice-blue` | `backend/core/speech.py`<br>`frontend/src/components/VoicePsychologistFab.tsx` | Build the bottom-right round voice button, live mic recording + Web Speech / backend STT-TTS loop, waveform animation, and text fallback input. |
| **Person 4: Body Model & Charts Lead** | `feat/body-charts` | `frontend/src/app/page.tsx`<br>`frontend/src/components/HumanBodyModel.tsx`<br>`frontend/src/components/PhysicalChartsPanel.tsx` | Build the 3-card Astronaut Selector page, the Left Column charts (heartbeat, blood sugar, BP, $\text{SpO}_2$, cortisol), and the Center interactive anatomical SVG Human Model in light blue/white. |
| **Person 5: Reports UI & API Glue Lead** | `feat/integration` | `backend/main.py`<br>`frontend/src/app/dashboard/page.tsx`<br>`frontend/src/components/TopNavBar.tsx`<br>`frontend/src/components/MentalReportsPanel.tsx` | Wire FastAPI endpoints, build the Top Switcher (`Physical` vs. `Mental`), the Right Column Mental Health Reports feed + Earth reply simulator, and manage serial merges into `main`. |

---

## 8. Frozen Data Contracts (`schemas.py` <-> `types/blue.ts`)

All 5 agents must code against these exact JSON structures. Never rename keys without team approval.

### A. `AstronautProfile` (`GET /api/astronauts` & `GET /api/astronauts/{id}`)

```json
{
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
    "cortisol_ug_dl": 17.8
  },
  "vitals_history": [
    { "time": "08:00", "heart_rate_bpm": 74, "blood_sugar_mg_dl": 95, "cortisol_ug_dl": 14.2 },
    { "time": "12:00", "heart_rate_bpm": 88, "blood_sugar_mg_dl": 74, "cortisol_ug_dl": 16.5 },
    { "time": "16:00", "heart_rate_bpm": 98, "blood_sugar_mg_dl": 62, "cortisol_ug_dl": 17.8 }
  ],
  "body_highlights": {
    "physical": [
      { "zone": "metabolic", "label": "Hypoglycemic Trend", "severity": "ADVISORY", "detail": "Blood sugar dropped from 95 to 62 mg/dL post-EVA prep." },
      { "zone": "heart", "label": "Elevated Exertion HR", "severity": "ADVISORY", "detail": "98 BPM elevated during airlock calibration." }
    ],
    "mental": [
      { "zone": "brain", "label": "Mild Cortisol Drift", "severity": "ADVISORY", "detail": "Cortisol at 17.8 ug/dL linked to skipped meal & task load." }
    ]
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
      "earth_psychologist_directive": "Enforce mandatory pre-EVA carbohydrate intake and 20-minute post-shift decompression; follow up with BLUE tomorrow."
    }
  ]
}
```

### B. Psychologist Conversation Turn (`POST /api/chat`)

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

### C. Simulate Earth Psychologist Directive (`POST /api/astronauts/{id}/reports/{report_id}/earth-reply`)

* Triggers a realistic Earth psychologist response (`"earth_status": "REVIEWED_BY_EARTH"` + populated `"earth_psychologist_directive"`) on any newly generated report during the live demo.

---

## 9. Agent Execution & Merge Protocol

1. **Phase 0 (First 20 Minutes):** Person 5 initializes `main` with `PROJECT_SCOPE.md`, `AGENTS.md`, `backend/schemas.py`, `frontend/src/types/blue.ts`, and empty scaffold folders. Person 1 commits the initial `backend/data/astronauts.json` containing the 3 canonical profiles (`astro-vance`, `astro-chen`, `astro-lin`). All 5 teammates pull `main` and checkout their assigned branch.
2. **Parallel Build (Hours 1–16):** Each teammate instructs their AI agent:
   > *"Read `PROJECT_SCOPE.md`, `AGENTS.md`, and `schemas.py` / `types/blue.ts`. Only modify files listed under my branch in Section 7. Strictly use the 3 canonical astronaut profiles (`astro-vance`, `astro-chen`, `astro-lin`) and the light-blue and white palette (`#F4F9FF` / `#FFFFFF` / `#0284C7`)."*
3. **Serial Integration Checkpoints (Every 4 Hours):** Person 5 merges one branch at a time into `main`, verifies `npm run build` and `uvicorn main:app` pass cleanly, and notifies the team to pull `main`.
4. **Agent Self-Check Before Finishing Any Turn:**
   * Did I avoid dark-mode colors and strictly use the light-blue/white clinical theme?
   * Did I avoid adding `"Hey Blue"` wake-word listeners, heavy 3D libraries, or credentialed dataset downloads?
   * Did I align with the 3 canonical profiles (`astro-vance`, `astro-chen`, `astro-lin`) and match Section 8 JSON keys verbatim?