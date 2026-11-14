# Project ASTRA: Autonomous Spaceflight Triage & Resilience Assistant
**Track:** NASA Space Apps Challenge — Astronaut Health Monitoring  
**Deployment Model:** 100% Local / Offline Edge AI  

---

## 1. Executive Summary & Mission Problem

### The Deep-Space Latency Bottleneck
On the International Space Station (ISS) in Low Earth Orbit (LEO), crew members rely on near-real-time telemetry links and live consultations with Houston flight surgeons. However, as humanity pushes toward the Lunar Gateway and Mars transit missions, one-way communication latency scales up to **20–24 minutes** (over 40 minutes round-trip). In an acute medical emergency or sudden psychological crisis, waiting nearly an hour for Earth-based guidance is not viable.

### The Gap in Current Crew Systems
* **Telemetry Overload:** Standard biomedical dashboards display raw clinical metrics that can overwhelm a fatigued or hypoxic astronaut.
* **Cloud Dependency:** Existing spaceflight assistants (such as CIMON) rely heavily on ground-station processing and focus primarily on procedural task support rather than integrated physiological-psychological triage.

### Our Solution
**Project ASTRA** is an offline, Jarvis-like AI Flight Surgeon and Crew Companion engineered to run entirely on local spacecraft hardware. By fusing **physical telemetry** (blood pressure, $\text{SpO}_2$, blood glucose, heart rate) with **mental and endocrine stress indicators** (cortisol curves and real-time vocal speech analysis), ASTRA detects anomalies early, explains complex health states in plain English, adapts its communication tone to the astronaut's cognitive load, and delivers calm, step-by-step emergency guidance with zero Earth connectivity.

---

## 2. Core Functional Pillars

### Pillar 1: Physical Health & Plain-English Triage
* **Multi-Vital Monitoring:** Tracks systolic/diastolic blood pressure, blood oxygen saturation ($\text{SpO}_2$), blood glucose, heart rate, and heart rate variability (HRV).
* **Contextual Translation:** Instead of flashing raw alarm codes, ASTRA correlates multi-sensor trends and explains *what* is happening and *why* in clear, accessible language (e.g., *"Your blood sugar has dropped rapidly while your heart rate is elevated. You are likely experiencing mild hypoglycemia."*).
* **Hands-Free Emergency Protocols:** Retrieves verified spaceflight medical checklists and walks the astronaut through immediate stabilization steps via voice and high-contrast visual cards.

### Pillar 2: Mental Health & Cognitive Load Adaptation (CIMON-Inspired)
* **Multimodal Stress & Fatigue Detection:** Combines circadian/salivary **cortisol trends** with real-time **speech prosody analysis** (vocal pitch jitter, speaking rate, pause duration, and vocal energy).
* **Stress-Adaptive Tone:** 
  * *Nominal State:* Conversational, warm, and proactive (e.g., daily wellness check-ins, sleep and hydration nudges).
  * *High-Stress / Panic State:* Automatically shifts to short, calm, authoritative micro-instructions to prevent cognitive overload and decision paralysis.

### Pillar 3: Deterministic Safety + Local AI Reasoning
* **Zero-Hallucination Guardrails:** Hard clinical thresholds are evaluated by a deterministic rule engine *before* the Large Language Model (LLM) generates advice, ensuring critical emergencies are never missed or downplayed.
* **Air-Gapped Execution:** Every model—Speech-to-Text, vocal emotion classifier, LLM, vector database, and Text-to-Speech—runs locally on a single edge machine.

---

## 3. Local System Architecture

```text
+-----------------------------------------------------------------------------+
|                        OFFLINE SPACECRAFT EDGE NODE                         |
|                                                                             |
|  [ Open Datasets & Simulator ]          [ Astronaut Microphone ]            |
|   - BP, SpO2, Glucose, HR                - Live Voice Query / Check-in      |
|   - Cortisol Curves                      - Push-to-Talk / Wake Word         |
|   - Live "Anomaly Injector"                        |                        |
|               |                                    +--------------+         |
|               v                                    |              |         |
|  +-------------------------+           +-----------v---+  +-------v------+  |
|  | Deterministic Clinical  |           |  Local STT    |  | Vocal Stress |  |
|  | Triage Engine (Rules)   |           | (Whisper)     |  | (Prosody/ML) |  |
|  | [NOMINAL -> CRITICAL]   |           +-----------+---+  +-------+------+  |
|  +------------+------------+                       |              |         |
|               |                                    |              |         |
|               +------------------+-----------------+--------------+         |
|                                  |                                          |
|                                  v                                          |
|                    +---------------------------+                            |
|                    |   Context Fusion Engine   | <--- [ Local Vector DB ]   |
|                    | (Vitals + Stress + State) |      (ISS Med Checklists & |
|                    +-------------+-------------+       NASA-STD-3001 RAG)   |
|                                  |                                          |
|                                  v                                          |
|                    +---------------------------+                            |
|                    |   Local Quantized LLM     |                            |
|                    | (Llama-3.1-8B / Phi-3.5)  |                            |
|                    +-------------+-------------+                            |
|                                  |                                          |
|                  +---------------+---------------+                          |
|                  v                               v                          |
|     +-------------------------+     +-------------------------+             |
|     |   Local Neural TTS      |     |    Crew HUD Dashboard   |             |
|     |   (Piper / Kokoro)      |     | (Vitals, Stress, Cards) |             |
|     +-------------------------+     +-------------------------+             |
+-----------------------------------------------------------------------------+
```

---

## 4. Data Strategy & Open Knowledge Sources

To ground our simulation and models in realistic physiological and spaceflight data without proprietary hardware, we leverage the following open-source datasets:

| Domain | Dataset / Source | Usage in Project ASTRA |
| :--- | :--- | :--- |
| **Physiological Vitals** | **PhysioNet (MIMIC-III / VitalDB)** | Baseline time-series modeling and synthetic anomaly curves for blood pressure, $\text{SpO}_2$, heart rate, and blood glucose. |
| **Multimodal Stress** | **WESAD** *(Wearable Stress and Affect Detection)* | Correlating physiological shifts (HRV, respiration, skin conductance) with baseline, stress, and amusement states. |
| **Spaceflight Biomarkers** | **NASA OSDR** *(Open Science Data Repository)* | Reference circadian rhythm disruption and salivary cortisol response profiles from spaceflight and analog bed-rest studies. |
| **Speech & Emotion** | **RAVDESS** & **CREMA-D** | Training/calibrating our lightweight vocal prosody classifier to detect calm, fatigued, anxious, or panicked speech patterns. |
| **Medical Protocols (RAG)** | **ISS Medical Checklist** & **NASA-STD-3001** | Grounding the local LLM in real aerospace emergency procedures (hypoxia, hypoglycemia, acute stress, decompression sickness). |

---

## 5. Proposed Hackathon Tech Stack

* **Backend & Orchestration:** Python 3.11+, `FastAPI`, `WebSockets` (for real-time telemetry streaming to the UI).
* **Telemetry Simulator & Triage Engine:** `NumPy`, `Pandas`, custom finite-state clinical threshold engine.
* **Speech-to-Text (Offline):** `faster-whisper` (`base.en` or `small.en` quantized for sub-second local transcription).
* **Vocal Stress Analysis:** `librosa` / `openSMILE` extracting pitch variance ($F_0$), RMS energy, zero-crossing rate, and speech tempo mapped to a stress index ($0.0 - 1.0$).
* **Local LLM & RAG:** `Ollama` or `llama.cpp` running `Llama-3.1-8B-Instruct` (4-bit quantized) + `ChromaDB` / `FAISS` with `nomic-embed-text` for offline protocol retrieval.
* **Text-to-Speech (Offline):** `Piper TTS` or `Kokoro` for natural, low-latency Jarvis-style voice output.
* **Frontend (Crew HUD):** `React` / `Next.js` + `Tailwind CSS` featuring an Earth-latency timer, live vital waveforms, mental resilience gauge, and step-by-step emergency action cards.

---

## 6. Hackathon Scope: 48-Hour MVP vs. Future Vision

### In Scope (48-Hour Hackathon Deliverable)
1. **Live Telemetry Streamer + Anomaly Injector:** Interactive control panel allowing judges/presenters to trigger realistic medical events (e.g., *Acute Hypoglycemia*, *Cabin $\text{CO}_2$ / Hypoxia*, or *Chronic Circadian Stress*) from open dataset curves.
2. **End-to-End Offline Voice Loop:** Push-to-talk microphone capture $\rightarrow$ local transcription + vocal stress scoring $\rightarrow$ triage-aware LLM response $\rightarrow$ spoken audio + HUD update (demonstrated with Wi-Fi disabled).
3. **Plain-English Diagnostic & Action Cards:** Automatic translation of multi-vital alerts into clear explanations and 3-step checklists grounded in spaceflight protocols.
4. **Adaptive Tone Demonstration:** Side-by-side proof showing how the AI changes its verbosity and pacing when vocal stress is high vs. nominal.

### Out of Scope (Post-Hackathon Roadmap)
* Direct Bluetooth/serial hardware integration with flight-certified wearables (e.g., Astroskin / Bio-Monitor).
* Radiation-hardened flight computer deployment and avionics bus (MIL-STD-1553) integration.
* Longitudinal federated learning across multi-month crew mission logs.

---

## 7. Live Demo Storyboard: *"The 20-Minute Blackout"*

1. **Scene 1 — Nominal Transit (0:00 – 0:45):**  
   * Display the Crew HUD during Day 142 of a Mars transit. The **Earth One-Way Latency** indicator reads `21m 18s` (`COMMS: DELAYED`).
   * An astronaut asks casually: *"Hey Astra, how am I looking today?"*  
   * Vocal stress is low (`0.18`), vitals are green, and ASTRA responds warmly with a brief, encouraging summary of sleep and hydration.
2. **Scene 2 — Dual Physical & Mental Trigger (0:45 – 1:45):**  
   * Using the Anomaly Injector, we trigger a **rapid blood glucose drop** paired with **elevated morning cortisol**.
   * A team member speaks quickly and breathlessly into the mic: *"I feel dizzy, my hands are shaking, what's going on with my numbers?"*
3. **Scene 3 — Autonomous Triage & Plain-English Guidance (1:45 – 2:30):**  
   * The deterministic engine flags `URGENT: HYPOGLYCEMIA RISK`, while the speech analyzer flags `HIGH VOCAL STRESS (0.82)`.
   * ASTRA immediately shifts into a calm, steady, directive cadence, explains the drop in simple terms without medical jargon, and displays a 3-step recovery protocol on the HUD—proving life-saving autonomy when Earth is 20 minutes away.

---

## 8. 48-Hour Execution Milestones

* **Hours 0–10 (Foundation & Data):** Set up local Ollama/Whisper/Piper pipeline; curate sample vital curves from PhysioNet/WESAD and chunk ISS medical protocols into ChromaDB.
* **Hours 10–22 (Core Engines):** Build the deterministic triage state machine, vocal prosody stress scorer, and FastAPI WebSocket server.
* **Hours 22–34 (Crew HUD & Integration):** Build the React Crew HUD, connect live telemetry streams, and wire the Anomaly Injector for demo triggers.
* **Hours 34–48 (Offline Stress-Testing & Pitch):** Disconnect network to verify 100% offline stability, tune prompt guardrails for plain-English clarity, and rehearse the 3-minute live demo.