# Project BLUE: Astronaut Physical & Psychological Health Platform

**Track:** NASA Space Apps Challenge — Astronaut Health Monitoring

**Interface Aesthetic:** Night-navy mission console — light-blue accents, NASA blue & red, medical teal ("BLUE / Crew Health")

**AI Companion:** **BLUE** (Behavioral & Longitudinal Unified Evaluation)

---

## 1. Executive Summary & Mission Problem

### The Deep-Space Psychological & Physiological Challenge

Long-duration missions to the Lunar Gateway and Mars place unprecedented strain on both the astronaut's body and mind. Microgravity alters cardiovascular regulation, glucose metabolism, and circadian cortisol rhythms, while prolonged isolation, confinement, and high-stakes operational workloads elevate risks of anxiety, sleep disruption, and cognitive fatigue.

Because deep-space communication latency reaches **up to 20+ minutes one-way**, astronauts cannot hold real-time therapy sessions with flight psychologists on Earth. Meanwhile, traditional spacecraft medical interfaces dump raw telemetry charts without connecting how an astronaut's *physical state* affects their *mental well-being*—or translating check-ins into structured clinical briefs for Earth-based specialists.

### Our Solution

**Project BLUE** is a unified, night-navy clinical console that bridges daily biometric tracking with empathetic, adaptive psychological support:

1. **Private Sign-In:** Each crew member signs in and sees only their own biometrics, mission context and psychological history. A flight-surgeon account sees the crew's physical data but never mental-health reports or BLUE conversations.
2. **Spatial 3-Column Health Dashboard:**
   * **Left Panel (Key Readings):** The five most important readings for the active panel, each with a plain Normal / Watch / Urgent status — Heart rate, Blood pressure, SpO₂, Blood sugar and salivary Cortisol (nmol/L) on the Physical Panel. Every reading opens a detail page with charts over 24 h, 7 days, 30 days or the whole mission, plus 20+ further metrics (HRV, respiration, temperature, sleep, voice stress, cabin CO₂, radiation…).
   * **Center Stage (Interactive Human Model):** An anatomical human body visualization linking physical vitals and psychological stress markers directly to physiological systems, adapting dynamically when switching between the **Physical Panel** and **Mental Panel** views.
   * **Right Panel (Mental Health Reports & Earth Link):** A longitudinal log of psychological check-in summaries, risk assessments, and actionable directives sent back from Earth's flight psychologist.
3. **Conversational Voice AI Psychologist ("BLUE"):** Triggered via a round floating voice button in the bottom-right corner, **BLUE** speaks and listens like a calm, perceptive human psychologist. It tailors its questioning depth to the astronaut's current physical and emotional state—conducting a brief check-in when everything looks steady, or asking thoughtful follow-up questions when biomarkers or vocal cues suggest strain—and automatically writes a structured **Summary Report for Earth** so a real psychologist can review the case and prescribe next steps.

---

## 2. Core User Journey & Canonical Crew Profiles

### Step 1: Sign-In & the 3 Canonical Crew Profiles

The app opens on a login screen. Astronauts land on their own dashboard; the flight surgeon lands on a crew overview. All data comes from the ASTRA simulated mission telemetry (`data/source/astra_donnees_simulees.csv`, extended back to mission day 1), crew members C1–C3:

1. **Commander — Cmdr. Elena Vance (`astro-vance` | Nominal Baseline):**
   * **Data story:** Steady readings throughout, including the cabin CO₂ scrubber fault on days 138–144.
   * **Demo Purpose:** Healthy baseline; triggers BLUE's concise **`BRIEF_CHECKIN`** mode.
2. **Flight Engineer — Eng. Marcus Chen (`astro-chen` | Sleep & Stress Drift):**
   * **Data story:** Over days 136–146 sleep broke up (up to 7 awakenings a night), voice stress rose to 0.61, HRV fell to 32 ms and morning cortisol reached 21.9 nmol/L; the habitat moved evening lighting earlier on day 143 and the drift has been easing since.
   * **Demo Purpose:** **Mental Panel** highlights, a two-report history with Earth guidance, and BLUE's **`DEEP_SUPPORT`** mode.
3. **Mission Specialist — Spec. Maya Lin (`astro-lin` | Acute Episode Follow-Up):**
   * **Data story:** Dizziness and breathlessness on the treadmill on day 148 (SpO₂ 88.5 %, HR 141 BPM), recovered within the hour; morning cortisol 19.9 nmol/L still above the alert line.
   * **Demo Purpose:** **Physical Panel** lung and heart highlights, the episode visible as a marked dip on the SpO₂ chart, and a queued priority **Summary Report for Earth**.

### Step 2: Unified Dashboard with Physical / Mental Panel Switcher

* **Top Control Bar:** Displays the active astronaut's profile, mission day, Earth communication delay indicator (from the data, e.g. `21m 52s Delay`), and a prominent **`Physical Panel` | `Mental Panel`** mode switcher.
  * **Physical Panel Focus:** Emphasizes cardiovascular, metabolic, and respiratory chart detail on the left and highlights organ/system nodes (Heart, Metabolic/Glucose, Lungs) on the central human body model.
  * **Mental Panel Focus:** Highlights neurological/cortisol stress pathways on the central human model, surfaces cognitive load & mood trends, and expands Earth psychologist report details on the right.
* **Left Column — Key Readings:** Current value and status only. Detailed charts (normal-range band, low–high band, numbered mission events, statistics, data table) live on per-metric detail pages one click away.
* **Center Column — Interactive Human Model:** Matte anatomical silhouette on a limited ±30° turntable with clickable, status-aware body zones showing real-time physical and psychological stress indicators.
* **Right Column — Mental Health Reports (private):** One-line headlines of the psychological summary reports generated by BLUE, opening to the full report, with Earth transmission status (`QUEUED_FOR_EARTH`, `REVIEWED_BY_EARTH`), and clinical guidance from Earth.

### Step 3: Bottom-Right Voice AI Psychologist ("BLUE")

* **Trigger:** A round floating action button in the bottom-right corner opens the **BLUE Voice Session** interface.
* **Human-Like Adaptive Interviewing:**
  * **Context-Aware Opening:** Before asking its first question, BLUE reads the astronaut's active vitals and recent reports (e.g., noticing a drop in blood sugar or elevated evening cortisol).
  * **Dynamic Follow-Up Depth:**
    * *Nominal Situation (`BRIEF_CHECKIN`):* Keeps the conversation light, supportive, and brief (2–3 questions) before wrapping up.
    * *Elevated Physical/Mental Strain (`DEEP_SUPPORT`):* Gently asks targeted follow-up questions (3–5 turns) about sleep quality, workload pressure, physical symptoms, and emotional state without sounding robotic or alarmist.
* **Automated Earth Psychologist Summary Report:**
  * At the end of the conversation, BLUE compiles a structured clinical brief containing: *Mission Day*, *Headline*, *Session Summary*, *Biometric Correlation*, and *Earth Uplink Status*.
  * The new report immediately appears at the top of the **Right Column (Mental Health Reports)** ready for Earth uplink, with a demo control to simulate receiving the Earth psychologist's actionable directives (`"What to Do"`).

---

## 3. Data Strategy & Static Seed Rule

* **Source:** `data/source/astra_donnees_simulees.csv` — ASTRA simulated mission telemetry (4 crew, mission days 120–150, 15-minute cadence, 37 columns including vitals, HRV, glucose, voice stress, salivary cortisol, sleep, cabin environment, radiation and labelled events).
* **Expansion:** `scripts/expand_dataset.py` extends it back to mission day 1 (`astra_donnees_etendues.csv`) by resampling the crew's own nominal days with day-to-day drift, keeping cabin data shared across the crew and rebuilding cumulative radiation, Earth delay and weekly body mass for continuity. Original rows are kept verbatim; synthetic rows are tagged `simule_etendu`.
* **Static seed:** `scripts/build_mock_data.py` derives everything the app shows — current values, status tags, body highlights, mission events, seeded reports, and history at three resolutions — into `backend/data/astronauts.json` and `backend/data/telemetry/*.json`. The API never parses CSV at runtime.
* **Calibration references (future):** PhysioNet `mimic-iv-demo` / `wearable-device-dataset`, WESAD, the OSF MAST cortisol tables, NASA OSDR and RAVDESS remain the approved open-access sources for validating ranges and BLUE's tone.

---

## 4. Hackathon Scope: 48-Hour MVP vs. Future Vision

### In Scope (48-Hour Hackathon Deliverable)

1. **Login & privacy:** Per-astronaut accounts plus a flight-surgeon account, server-enforced access rules, httpOnly session cookie.
2. **Night-Navy 3-Column Crew Dashboard:**
   * Top switcher between **Physical Panel** and **Mental Panel**.
   * Left column key readings, with detailed per-metric chart pages behind them.
   * Center interactive anatomical **Human Model** linked to live metrics and panel mode.
   * Right column **Mental Health Reports** feed with Earth transmission status and psychologist directives.
3. **Bottom-Right Round Voice AI Button ("BLUE"):**
   * Live speech-to-text + natural voice output (with text-chat fallback for noisy demo rooms).
   * Adaptive psychologist conversation logic (`BRIEF_CHECKIN` vs. `DEEP_SUPPORT`).
   * Automatic generation of an **Earth Summary Report** saved directly into the right-hand panel.

### Out of Scope (Post-Hackathon Roadmap)

* **Hands-Free Wake Word (`"Hey Blue"`):** Planned for v2 so astronauts can initiate sessions hands-free in microgravity; strictly excluded from the 48-hour MVP in favor of the reliable bottom-right round button.
* **Live Wearable Hardware Integration:** Direct Bluetooth/telemetry ingestion from Astroskin or Bio-Monitor flight hardware.
* **Real Deep Space Network (DSN) Uplink:** Live ground-control clinician portal authentication and satellite routing.

---

## 5. 3-Minute Live Demo Storyboard

1. **0:00 – 0:30 | Sign-In & Privacy:** Sign in as the flight surgeon to show the crew overview (physical data only, reports hidden), then sign in as **Spec. Maya Lin** (acute episode on day 148) or **Eng. Marcus Chen** (sleep & stress drift).
2. **0:30 – 1:15 | Dashboard & Physical/Mental Panel Switching:** Walk judges through the 3-column layout: left key readings (click SpO₂ to show the day-148 dip on the detailed chart), center anatomical human model highlighting affected body systems, and right mental health reports. Toggle between **Physical Panel** and **Mental Panel** to show dynamic focus adaptation.
3. **1:15 – 2:25 | Talking to BLUE (Adaptive Psychologist AI):** Click the **round voice button in the bottom-right corner**. Speak naturally about feeling mentally drained, anxious, or dizzy on the treadmill. Show how BLUE responds like a human psychologist, asks targeted follow-up questions because of the recent episode and stress markers, and wraps up naturally.
4. **2:25 – 3:00 | Earth Summary Report & Clinician Reply:** Watch BLUE automatically publish a structured **Earth Psychologist Summary Report** into the right column, then trigger the Earth psychologist's directive (`"What to Do"`) to complete the deep-space care loop.