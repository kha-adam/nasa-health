# AGENTS.md — Engineering Guardrails & 5-Agent Parallel Spec

> **PURPOSE:** This file is the single source of truth for all AI coding agents building **Project BLUE**. Every agent MUST read this file before generating code. Do not invent unapproved features, alter the light-blue/white visual theme, or touch files outside your assigned team directory.

## 1. Prime Directive & Design Lock

* **Mission:** Build a reliable, demo-ready web application for the NASA Space Apps Challenge ("Astronaut Health Monitoring") where an astronaut selects their profile, views a 3-column Physical/Mental dashboard with a central human body model, and uses a bottom-right round voice button to talk to **BLUE**—an adaptive AI psychologist that writes summary reports for Earth.
* **Strict Visual Theme (Light Blue & White ONLY):**
  * **Background Canvas:** `#F4F9FF` (Soft Ice White-Blue)
  * **Cards & Panels:** `#FFFFFF` with `1px solid #DBEAFE` border and soft shadow
  * **Primary Accent (Medical Sky Blue):** `#0284C7` (hover `#0369A1`)
  * **Secondary Accent (Soft Cyan/Blue Tint):** `#E0F2FE` / `#BAE6FD`
  * **Primary Text:** `#0F172A` (Deep Slate) | **Secondary Text:** `#475569`
  * **Status Colors:** Nominal `#0D9488` (Teal), Advisory `#D97706` (Amber), Urgent `#DC2626` (Clinical Red)
  * **STRICTLY FORBIDDEN:** Dark mode, black sci-fi backgrounds, neon green/purple themes, or cyberpunk styling.

## 2. Strict "DO NOT BUILD" List (Anti-Scope-Creep)

AI agents **MUST NOT** build or install any of the following:

1. **NO `"Hey Blue"` Wake Word:** Do NOT implement continuous microphone wake-word detection. Voice sessions are triggered *exclusively* by clicking the round floating button in the bottom-right corner.
2. **NO Heavy 3D WebGL Libraries:** Do NOT install `three`, `@react-three/fiber`, or Spline viewers. Build the central **Human Model** using a clean, multi-layered interactive **SVG anatomical component** so it loads instantaneously with zero WebGL crashes.
3. **NO Authentication / Passwords:** The entry screen is a 1-click **Astronaut Selector** grid—no login forms, JWTs, or OAuth.
4. **NO External Databases:** Do NOT set up PostgreSQL, MongoDB, Redis, or Prisma. Store crew profiles, telemetry curves, and generated mental health reports in clean JSON files + FastAPI in-memory state (`backend/data/`).

## 3. Exact Spatial Layout Invariant

The main dashboard (`frontend/src/app/dashboard/page.tsx`) must fit cleanly on a `1440x900` or `1920x1080` screen and obey this exact layout:

* **Top Header Bar:**
  * Left: Astronaut Avatar, Name, Role, Mission Day, and `"Switch Astronaut"` button.
  * Center: Segmented Toggle Switcher: **`[ Physical Panel | Mental Panel ]`**.
  * Right: Earth Comms Latency Indicator (e.g., `Earth Link: 20m 42s Delay`).
* **Main 3-Column Body Grid:**
  * **Left Column (~30% width):** **Physical Telemetry & Charts** — Heartbeat (BPM), Blood Sugar ($\text{mg/dL}$), Blood Pressure ($\text{mmHg}$), $\text{SpO}_2$ ($\%$), and Cortisol ($\mu\text{g/dL}$) with clean Recharts/SVG sparklines and status badges.
  * **Center Column (~38% width):** **Interactive Human Body Model** — Anatomical silhouette in light blue/white with interactive body-system markers (Brain/Neurological, Heart/Cardiovascular, Lungs/Respiratory, Metabolic/Glucose). Toggling between `Physical Panel` and `Mental Panel` dynamically changes which markers and callout cards are highlighted on the body model.
  * **Right Column (~32% width):** **Mental Health Reports** — Scrollable list of structured psychological check-in reports, showing:
    * Session summary written by BLUE
    * Earth Uplink Status badge (`READY FOR EARTH UPLINK` / `EARTH PSYCHOLOGIST REVIEWED`)
    * `"What to Do"` actionable directives from the Earth psychologist (plus a demo button `"Simulate Earth Psychologist Reply"` on newly generated reports).
* **Bottom-Right Floating Action Button (FAB):**
  * Fixed at `bottom-6 right-6`, circular (`w-16 h-16 rounded-full`), sky-blue gradient (`#0284C7` to `#38BDF8`) with microphone icon and label `"Talk to Blue"`.
  * Clicking opens the **BLUE Psychologist Voice Drawer/Modal** (supports microphone speech-to-text + spoken audio reply, plus a text input bar fallback for noisy hackathon rooms).

## 4. Adaptive Psychologist AI Rules (`backend/core/psychologist.py`)

BLUE must behave like a calm, attentive human aerospace psychologist—not a generic chatbot:

1. **Situational Depth Adaptation:**
   * Before generating questions, inspect the astronaut's `vitals` and `mental_baseline`:
   * **`BRIEF_CHECKIN` Mode** (all vitals nominal, cortisol $\le 16\ \mu\text{g/dL}$, stress score $< 0.5$): Ask **2 concise, warm check-in questions** (e.g., daily energy, crew morale), then offer to wrap up and file a routine report.
   * **`DEEP_SUPPORT` Mode** (any vital out of nominal range—such as blood sugar $< 72\ \text{mg/dL}$, elevated heart rate $> 105\ \text{BPM}$, or cortisol $> 16\ \mu\text{g/dL}$—OR astronaut expresses fatigue, anxiety, or sleep issues): Ask **3 to 5 empathetic, targeted follow-up questions** exploring physical symptoms, workload stress, and sleep before concluding.
2. **Automatic Earth Summary Report Generation:**
   * When the user clicks `"End Session & Generate Earth Report"` (or BLUE naturally concludes the check-in), the backend generates a structured `MentalHealthReport` JSON object and appends it to that astronaut's report list so it immediately renders in the **Right Column** of the dashboard.
3. **Demo Failsafe:**
   * If the LLM or speech service times out (`> 5s`) or is offline, fall back gracefully to deterministic, context-matched psychologist questions and report templates so the demo never stalls.

## 5. Approved Tech Stack & Directory Layout

```text
project-blue/
├── PROJECT_SCOPE.md             # Mission & product overview
├── AGENTS.md                    # This guardrail document
├── backend/
│   ├── requirements.txt         # fastapi, uvicorn, pydantic, httpx, python-multipart
│   ├── main.py                  # FastAPI server + CORS + REST routes
│   ├── schemas.py               # FROZEN Pydantic contracts (DO NOT DRIFT)
│   ├── data/
│   │   └── astronauts.json      # 4 rich astronaut profiles + vitals + initial reports
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
        │   ├── page.tsx         # Screen 1: Astronaut Crew Selector
        │   └── dashboard/
        │       └── page.tsx     # Screen 2: 3-Column Light Blue/White Dashboard
        └── components/
            ├── TopNavBar.tsx            # Astronaut badge + [Physical | Mental] switcher
            ├── PhysicalChartsPanel.tsx  # Left column: Heartbeat, Blood Sugar, BP, SpO2, Cortisol
            ├── HumanBodyModel.tsx       # Center column: Interactive anatomical SVG model
            ├── MentalReportsPanel.tsx   # Right column: Mental health reports + Earth feedback
            └── VoicePsychologistFab.tsx # Bottom-right round button + BLUE voice modal
```

## 6. 5-Person Parallel Team Ownership Matrix

To prevent merge conflicts while running 5 AI agents simultaneously, each teammate owns **exclusive files** and works on a dedicated Git branch:

| Teammate | Branch | Exclusive Files (Only Touch These) | Core Responsibility |
| :--- | :--- | :--- | :--- |
| **Person 1: Crew Data & Telemetry Lead** | `feat/crew-data` | `backend/data/astronauts.json`<br>`backend/core/profiles.py` | Create 4 realistic astronaut profiles (1 nominal, 1 blood sugar + cortisol strain, 1 sleep/isolation fatigue, 1 post-EVA cardiovascular load) with 24h chart arrays and initial reports. |
| **Person 2: Psychologist AI & Report Lead** | `feat/psychologist-ai` | `backend/core/psychologist.py`<br>`backend/core/report_generator.py` | Build BLUE's adaptive conversational logic (`BRIEF_CHECKIN` vs. `DEEP_SUPPORT`) and the structured Earth Psychologist Summary Report generator. |
| **Person 3: Voice UI & Speech Lead** | `feat/voice-blue` | `backend/core/speech.py`<br>`frontend/src/components/VoicePsychologistFab.tsx` | Build the bottom-right round voice button, live mic recording + Web Speech / backend STT-TTS loop, waveform animation, and text fallback input. |
| **Person 4: Body Model & Charts Lead** | `feat/body-charts` | `frontend/src/app/page.tsx`<br>`frontend/src/components/HumanBodyModel.tsx`<br>`frontend/src/components/PhysicalChartsPanel.tsx` | Build the Astronaut Selector page, the Left Column charts (heartbeat, blood sugar, etc.), and the Center interactive anatomical Human Model in light blue/white. |
| **Person 5: Reports UI & API Glue Lead** | `feat/integration` | `backend/main.py`<br>`frontend/src/app/dashboard/page.tsx`<br>`frontend/src/components/TopNavBar.tsx`<br>`frontend/src/components/MentalReportsPanel.tsx` | Wire FastAPI endpoints, build the Top Switcher (`Physical` vs. `Mental`), the Right Column Mental Health Reports feed, and manage serial merges into `main`. |

## 7. Frozen Data Contracts (`schemas.py` <-> `types/blue.ts`)

All 5 agents must code against these exact JSON structures. Never rename keys without team approval.

### A. `AstronautProfile` (`GET /api/astronauts` & `GET /api/astronauts/{id}`)

```json
{
  "id": "astro-chen",
  "name": "Dr. Marcus Chen",
  "role": "Flight Surgeon & Payload Specialist",
  "mission_day": 118,
  "avatar_initials": "MC",
  "status_tag": "ADVISORY",
  "current_vitals": {
    "heart_rate_bpm": 92,
    "blood_sugar_mg_dl": 68,
    "systolic_bp": 128,
    "diastolic_bp": 82,
    "spo2_percent": 97.4,
    "cortisol_ug_dl": 19.6
  },
  "vitals_history": [
    { "time": "08:00", "heart_rate_bpm": 74, "blood_sugar_mg_dl": 94, "cortisol_ug_dl": 14.2 },
    { "time": "12:00", "heart_rate_bpm": 88, "blood_sugar_mg_dl": 72, "cortisol_ug_dl": 18.1 },
    { "time": "16:00", "heart_rate_bpm": 92, "blood_sugar_mg_dl": 68, "cortisol_ug_dl": 19.6 }
  ],
  "body_highlights": {
    "physical": [
      { "zone": "metabolic", "label": "Glucose Trend Low", "severity": "ADVISORY", "detail": "Blood sugar dipped to 68 mg/dL post-EVA prep." },
      { "zone": "heart", "label": "Mildly Elevated HR", "severity": "NOMINAL", "detail": "92 BPM within exertion recovery band." }
    ],
    "mental": [
      { "zone": "brain", "label": "Elevated Cortisol Load", "severity": "ADVISORY", "detail": "Cortisol at 19.6 ug/dL suggests acute cognitive/sleep strain." }
    ]
  },
  "mental_reports": [
    {
      "id": "rep-101",
      "created_at": "Mission Day 115",
      "session_mode": "DEEP_SUPPORT",
      "headline": "Mild Circadian Fatigue & Workload Strain",
      "summary": "Astronaut reported fragmented sleep over 3 cycles and heightened focus fatigue during docking simulations.",
      "biometric_correlation": "Evening cortisol elevated (+22% above baseline); resting HR slightly raised.",
      "earth_status": "REVIEWED_BY_EARTH",
      "earth_psychologist_directive": "Shift heavy cognitive tasks to morning window; schedule 30-min decompression block and re-check with BLUE in 48h."
    }
  ]
}
```

### B. Psychologist Conversation Turn (`POST /api/chat`)

* **Request JSON:**

```json
{
  "astronaut_id": "astro-chen",
  "messages": [
    { "role": "assistant", "content": "Hi Marcus, I noticed your blood sugar dipped a bit and cortisol is elevated today. How are you feeling right now?" },
    { "role": "user", "content": "Honestly a bit lightheaded and drained, I skipped lunch to finish the airlock calibration." }
  ],
  "finish_session": false
}
```

* **Response JSON:**

```json
{
  "reply": "That makes complete sense—pushing through an airlock calibration without fuel puts real strain on both your body and focus. Before we send a quick note to Earth, have you been feeling overwhelmed by the schedule this week, or was today a one-off push?",
  "session_mode": "DEEP_SUPPORT",
  "suggested_to_wrap_up": false,
  "generated_report": null
}
```

*(When `finish_session: true`, `generated_report` returns a completed `MentalHealthReport` object with `"earth_status": "QUEUED_FOR_EARTH"`, and the backend automatically appends it to `astronaut.mental_reports`.)*

### C. Simulate Earth Psychologist Directive (`POST /api/astronauts/{id}/reports/{report_id}/earth-reply`)

* Allows the live demo presenter to trigger a realistic Earth psychologist response (`"earth_status": "REVIEWED_BY_EARTH"` + populated `"earth_psychologist_directive"`) on any newly generated report.

## 8. Agent Execution & Merge Protocol

1. **Phase 0 (First 20 Minutes):** Person 5 initializes `main` with `PROJECT_SCOPE.md`, `AGENTS.md`, `backend/schemas.py`, `frontend/src/types/blue.ts`, and empty scaffold folders. All 5 teammates pull `main` and checkout their assigned branch.
2. **Parallel Build (Hours 1–16):** Each teammate instructs their AI agent:
   > *"Read `AGENTS.md` and `schemas.py` / `types/blue.ts`. Only modify files listed under my branch in Section 6. Strictly follow the light-blue and white palette (`#F4F9FF` / `#FFFFFF` / `#0284C7`)."*
3. **Serial Integration Checkpoints (Every 4 Hours):** Person 5 merges one branch at a time into `main`, verifies `npm run build` and `uvicorn main:app` pass cleanly, and notifies the team to pull `main`.
4. **Agent Self-Check Before Finishing Any Turn:**
   * Did I avoid dark-mode colors and strictly use the light-blue/white clinical theme?
   * Did I avoid adding `"Hey Blue"` wake-word listeners or heavy 3D libraries?
   * Do all my JSON keys match Section 7 verbatim?