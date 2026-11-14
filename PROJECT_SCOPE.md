# Project BLUE: Astronaut Physical & Psychological Health Platform

**Track:** NASA Space Apps Challenge — Astronaut Health Monitoring

**Interface Aesthetic:** Clinical Light Blue & White Medical Aerospace UI

**AI Companion:** **BLUE** (Behavioral & Longitudinal Unified Evaluation)

---

## 1. Executive Summary & Mission Problem

### The Deep-Space Psychological & Physiological Challenge

Long-duration missions to the Lunar Gateway and Mars place unprecedented strain on both the astronaut's body and mind. Microgravity alters cardiovascular regulation, glucose metabolism, and circadian cortisol rhythms, while prolonged isolation, confinement, and high-stakes operational workloads elevate risks of anxiety, sleep disruption, and cognitive fatigue.

Because deep-space communication latency reaches **up to 20+ minutes one-way**, astronauts cannot hold real-time therapy sessions with flight psychologists on Earth. Meanwhile, traditional spacecraft medical interfaces dump raw telemetry charts without connecting how an astronaut's *physical state* affects their *mental well-being*—or translating check-ins into structured clinical briefs for Earth-based specialists.

### Our Solution

**Project BLUE** is a unified, light-blue and white clinical web application that bridges daily biometric tracking with empathetic, adaptive psychological support:

1. **Astronaut Identity Selection:** Crew members select their astronaut profile upon entry to load personalized longitudinal biometrics, mission context, and psychological history.
2. **Spatial 3-Column Health Dashboard:**
   * **Left Panel (Physical Telemetry):** Interactive charts and live metrics for Heartbeat ($\text{BPM}$), Blood Sugar ($\text{mg/dL}$), Blood Pressure ($\text{mmHg}$), Blood Oxygen ($\text{SpO}_2$), and Cortisol ($\mu\text{g/dL}$).
   * **Center Stage (Interactive Human Model):** An anatomical human body visualization linking physical vitals and psychological stress markers directly to physiological systems, adapting dynamically when switching between the **Physical Panel** and **Mental Panel** views.
   * **Right Panel (Mental Health Reports & Earth Link):** A longitudinal log of psychological check-in summaries, risk assessments, and actionable directives sent back from Earth's flight psychologist.
3. **Conversational Voice AI Psychologist ("BLUE"):** Triggered via a round floating voice button in the bottom-right corner, **BLUE** speaks and listens like a calm, perceptive human psychologist. It tailors its questioning depth to the astronaut's current physical and emotional state—conducting a brief check-in when everything looks steady, or asking thoughtful follow-up questions when biomarkers or vocal cues suggest strain—and automatically writes a structured **Summary Report for Earth** so a real psychologist can review the case and prescribe next steps.

---

## 2. Core User Journey & Canonical Crew Profiles

### Step 1: Astronaut Crew Selector (3 Canonical Profiles)

Upon opening the web app, the user chooses which astronaut they are from **three canonical crew personas**, each backed by real physiological and stress trajectories:

1. **Commander — Cmdr. Elena Vance (`astro-vance` | Nominal Baseline):**
   * **Clinical Profile:** Steady resting heart rate ($\approx 64\ \text{BPM}$), stable blood glucose ($\approx 92\ \text{mg/dL}$), normal blood pressure ($116/74\ \text{mmHg}$), $\text{SpO}_2$ ($98.6\%$), and low baseline cortisol ($11.5\ \mu\text{g/dL}$).
   * **Demo Purpose:** Demonstrates a healthy baseline state and triggers BLUE's concise **`BRIEF_CHECKIN`** conversational mode.
2. **Flight Engineer — Eng. Marcus Chen (`astro-chen` | Physical Strain & Hypoglycemic Trend):**
   * **Clinical Profile:** Dropping blood sugar curve ($95 \rightarrow 62\ \text{mg/dL}$) and elevated heart rate ($98\ \text{BPM}$) following an intense EVA airlock prep shift, with borderline cortisol ($17.8\ \mu\text{g/dL}$).
   * **Demo Purpose:** Showcases **Physical Panel** alerts, highlights metabolic and cardiovascular zones on the central human body model, and triggers BLUE's **`DEEP_SUPPORT`** mode.
3. **Mission Specialist — Spec. Maya Lin (`astro-lin` | Isolation Fatigue & High Cortisol):**
   * **Clinical Profile:** Elevated evening salivary cortisol ($22.4\ \mu\text{g/dL}$) and heightened state anxiety/affect drift over multiple sleep cycles, while core physical vitals remain within operational bounds.
   * **Demo Purpose:** Showcases **Mental Panel** neuro-stress highlights, demonstrates empathetic psychological interviewing by BLUE, and generates a priority **Summary Report for Earth**.

### Step 2: Unified Dashboard with Physical / Mental Panel Switcher

* **Top Control Bar:** Displays the active astronaut's profile, mission day, Earth communication delay indicator (`20m 42s Delay`), and a prominent **`Physical Panel` | `Mental Panel`** mode switcher.
  * **Physical Panel Focus:** Emphasizes cardiovascular, metabolic, and respiratory chart detail on the left and highlights organ/system nodes (Heart, Metabolic/Glucose, Lungs) on the central human body model.
  * **Mental Panel Focus:** Highlights neurological/cortisol stress pathways on the central human model, surfaces cognitive load & mood trends, and expands Earth psychologist report details on the right.
* **Left Column — Physiological Charts & Telemetry:** Clean time-series line/area charts and current readouts for **Heartbeat ($\text{BPM}$)**, **Blood Sugar ($\text{mg/dL}$)**, **Blood Pressure ($\text{mmHg}$)**, **$\text{SpO}_2$ ($\%$)**, and **Cortisol ($\mu\text{g/dL}$)**.
* **Center Column — Interactive Human Model:** Clean anatomical silhouette in light blue and white with clickable, status-aware body zones showing real-time physical and psychological stress indicators.
* **Right Column — Mental Health Reports:** Displays chronological psychological summary reports generated by BLUE, Earth transmission status (`QUEUED_FOR_EARTH`, `REVIEWED_BY_EARTH`), and clinical guidance from Earth.

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

## 3. Open-Access Data Strategy & Static Seed Rule

To guarantee offline reliability and zero credential bottlenecks during the hackathon, all biometric and psychological trajectories are extracted from **open-access datasets** and normalized once into a static seed file (`backend/data/astronauts.json`):

| Project BLUE Layer | Approved Open-Access Dataset | Access Method | Extracted Signals |
| :--- | :--- | :--- | :--- |
| **Heartbeat, $\text{SpO}_2$, BP & Glucose** | **PhysioNet Open Access** (`mimic-iv-demo` v2.2 & `pulse-transit-time-ppg`) | `pip install physionet` $\rightarrow$ `physionet download mimic-iv-demo --version 2.2` (no login required) | Heart rate, systolic/diastolic blood pressure, $\text{SpO}_2$, and blood glucose trajectories. |
| **Wearable Stress & HRV Curves** | **PhysioNet Wearable Stress Dataset** (`wearable-device-dataset` v1.0.1) & **WESAD** | `physionet download wearable-device-dataset --version 1.0.1` ($\approx 69.7\ \text{MB}$) / UCI ML Repository | Clean `IBI.csv` (heart rate variability), `TEMP.csv`, and `EDA.csv` baseline vs. stress windows. |
| **Cortisol & Anxiety Logs** | **MAST Acute Stress & Cortisol Dataset** (OSF) | Open CSV tables via Open Science Framework (OSF) | Time-stamped salivary cortisol curves paired with state anxiety and positive/negative affect scores. |
| **Spaceflight Analog Context** | **NASA Open Science Data Repository (OSDR)** | Public studies at `osdr.nasa.gov/bio/repo` | Inspiration4 physiological assays and analog isolation/bed-rest baselines. |
| **Vocal Stress Calibration** | **RAVDESS** (Audio-Only Subset) | 1,440 speech-only `.wav` files ($\approx 200\ \text{MB}$) | Labeled `calm`, `neutral`, `sad`, and `fearful` speech clips for calibrating BLUE's empathetic tone. |

* **Static Seed Mandate (`backend/data/astronauts.json`):** A standalone preprocessing script (`scripts/build_mock_data.py`) converts sampled rows from these open CSVs into `backend/data/astronauts.json`, which is committed directly to `main`. Neither the backend API nor the frontend ever parses raw clinical CSVs or makes external dataset network calls at runtime.

---

## 4. Hackathon Scope: 48-Hour MVP vs. Future Vision

### In Scope (48-Hour Hackathon Deliverable)

1. **Astronaut Selection Screen:** The 3 canonical astronaut personas (`astro-vance`, `astro-chen`, `astro-lin`) loaded from `backend/data/astronauts.json`.
2. **Light Blue & White 3-Column Crew Dashboard:**
   * Top switcher between **Physical Panel** and **Mental Panel**.
   * Left column interactive charts (Heartbeat, Blood Sugar, Blood Pressure, $\text{SpO}_2$, Cortisol).
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

1. **0:00 – 0:30 | Astronaut Selection & Nominal Baseline:** Open the light-blue/white portal. Briefly highlight **Cmdr. Elena Vance** (Nominal) before selecting **Eng. Marcus Chen** (Physical Strain: dropping blood sugar $95 \rightarrow 62\ \text{mg/dL}$) or **Spec. Maya Lin** (Isolation Fatigue: elevated cortisol $22.4\ \mu\text{g/dL}$).
2. **0:30 – 1:15 | Dashboard & Physical/Mental Panel Switching:** Walk judges through the 3-column layout: left physiological charts, center anatomical human model highlighting affected body systems, and right mental health reports. Toggle between **Physical Panel** and **Mental Panel** to show dynamic focus adaptation.
3. **1:15 – 2:25 | Talking to BLUE (Adaptive Psychologist AI):** Click the **round voice button in the bottom-right corner**. Speak naturally about feeling mentally drained, anxious, or lightheaded after an EVA prep shift. Show how BLUE responds like a human psychologist, asks targeted follow-up questions due to the elevated cortisol/glucose context, and wraps up naturally.
4. **2:25 – 3:00 | Earth Summary Report & Clinician Reply:** Watch BLUE automatically publish a structured **Earth Psychologist Summary Report** into the right column, then trigger the Earth psychologist's directive (`"What to Do"`) to complete the deep-space care loop.