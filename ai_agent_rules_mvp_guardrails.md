# AGENTS.md — Engineering Guardrails & MVP Execution Spec

> **PURPOSE:** This file is the single source of truth for all AI coding agents working on **Project ASTRA**. Follow every rule in this document strictly. Do not invent features, add unapproved dependencies, or deviate from the data schemas defined below.

---

## 1. Prime Directive & Hackathon Mindset

* **Goal:** Deliver a **rock-solid, 100% offline, live-demoable MVP** for the NASA Space Apps Challenge ("Astronaut Health Monitoring") within 48 hours.
* **Priority Order:**
  1. **Demo Reliability** (Never crashes on stage; deterministic fallbacks exist for every AI model).
  2. **Offline Determinism** (Zero internet calls; runs cleanly with Wi-Fi disabled).
  3. **Visual & Vocal Clarity** (High-contrast Crew HUD + plain-English spoken guidance).
  4. **Code Minimalism** (Simplest working implementation wins; no over-engineering).

---

## 2. Strict "DO NOT BUILD" List (Anti-Scope-Creep)

AI agents **MUST NOT** generate or propose any of the following:
* **NO Cloud APIs:** Never import or call OpenAI, Anthropic, ElevenLabs, Google Cloud, AWS, or HuggingFace Inference endpoints. All inference must target `localhost` or local disk weights.
* **NO Authentication / User Management:** No login screens, JWTs, OAuth, or multi-tenant user tables. Hardcode a single astronaut profile (`Commander Vance — Mars Transit Day 142`).
* **NO External Databases:** Do not set up PostgreSQL, MongoDB, or Redis. Keep state in memory (Python dataclasses/globals) and use local file-backed `ChromaDB` or `FAISS` (or lightweight local JSON keyword/vector search) for medical protocols.
* **NO Model Training From Scratch:** Do not write PyTorch training loops. Use pre-trained local quantized models (`Ollama`, `faster-whisper`, `Piper TTS`) and deterministic signal processing (`librosa` / `numpy`) for vocal stress extraction.
* **NO Hardware Drivers:** Do not write Bluetooth, serial, or wearable SDK integrations. Use the built-in telemetry simulator and Anomaly Injector.

---

## 3. Architectural Invariants (Non-Negotiable)

1. **Deterministic Triage Before LLM Generation:**
   * The LLM **never** decides clinical severity.
   * A pure Python rule engine (`backend/core/triage.py`) must evaluate incoming vitals and vocal stress *first*, outputting a strict severity enum (`NOMINAL`, `ADVISORY`, `URGENT`, `CRITICAL`) and matched protocol IDs.
   * The LLM's sole job is **plain-English translation, empathy, and tone adaptation** constrained by the triage engine's output.
2. **Stress-Adaptive Prompt Conditioning:**
   * When `stress_index >= 0.65` OR `severity in ["URGENT", "CRITICAL"]`, the system prompt **must** force the LLM into **Directive Calm Mode**: maximum 3 short sentences, imperative verbs, zero medical jargon, numbered action steps.
   * When `stress_index < 0.65` AND `severity == "NOMINAL"`, use **Companion Mode**: warm, conversational, concise wellness summary.
3. **Graceful Demo Failsafes (`DEMO_SAFE_MODE`):**
   * Every AI component (Whisper STT, Ollama LLM, Piper TTS) must have a timeout (`<= 4.0s`) and a deterministic fallback.
   * If Ollama is slow or unreachable, automatically return a pre-templated plain-English response populated from the matched medical protocol JSON so the live pitch never hangs.
   * Provide a text-input fallback next to the Push-to-Talk mic button on the HUD in case a noisy hackathon venue interferes with microphone capture.

---

## 4. Approved Tech Stack & Directory Layout

Do not deviate from this folder structure or introduce alternative frameworks:

```text
astra-mvp/
├── AGENTS.md                  # This guardrail file
├── PROJECT_SCOPE.md           # High-level mission & pitch reference
├── start.sh                   # Single-command launcher (backend + frontend)
├── backend/
│   ├── requirements.txt       # fastapi, uvicorn, websockets, pydantic, numpy, librosa, soundfile, faster-whisper, httpx
│   ├── main.py                # FastAPI app, REST endpoints, WebSocket telemetry loop
│   ├── schemas.py             # Canonical Pydantic models (DO NOT DRIFT)
│   ├── core/
│   │   ├── simulator.py       # Streams baseline vitals + handles Anomaly Injector triggers
│   │   ├── triage.py          # Deterministic threshold engine (NOMINAL -> CRITICAL)
│   │   ├── prosody.py         # Acoustic vocal stress scorer (pitch, energy, tempo -> 0.0..1.0)
│   │   ├── rag.py             # Offline spaceflight medical protocol retriever
│   │   └── llm_bridge.py      # Local Ollama client + tone-adaptive prompt builder + fallback
│   └── data/
│       ├── protocols.json     # Structured ISS/NASA emergency checklists (plain-English + steps)
│       └── baseline_curves.json # Sampled PhysioNet/WESAD/OSDR trajectories
└── frontend/
    ├── package.json           # Next.js / React, Tailwind CSS, Lucide Icons
    └── src/
        ├── types/astra.ts     # Exact mirror of backend/schemas.py
        ├── components/
        │   ├── TopTelemetryBar.tsx   # Earth latency clock (21m 18s), Comms status, Mission Day
        │   ├── VitalsGrid.tsx        # BP, SpO2, Glucose, HR, Cortisol cards + sparklines
        │   ├── MentalResilience.tsx  # Vocal stress gauge + adaptive AI tone indicator
        │   ├── TriageActionCard.tsx  # Plain-English diagnosis + 3-step emergency checklist
        │   ├── VoiceConsole.tsx      # Push-to-talk mic + text fallback + live transcript
        │   └── AnomalyInjector.tsx   # Demo control panel to trigger scenarios live
        └── app/page.tsx              # Single-screen high-contrast Crew HUD (no scrolling required)
```

---

## 5. Canonical Data Contracts (Backend <-> Frontend)

Both `backend/schemas.py` and `frontend/src/types/astra.ts` **MUST** match these exact field names and types. Never rename keys without updating both files simultaneously.

### A. WebSocket Telemetry Stream (`WS /ws/telemetry` @ 1 Hz)
```json
{
  "timestamp": "2026-11-14T13:26:00Z",
  "mission_day": 142,
  "earth_latency_seconds": 1278,
  "vitals": {
    "systolic_bp": 118,
    "diastolic_bp": 76,
    "spo2": 98.2,
    "glucose_mg_dl": 94.0,
    "heart_rate": 68,
    "cortisol_ug_dl": 11.4
  },
  "mental_state": {
    "vocal_stress_index": 0.18,
    "cognitive_load": "LOW",
    "communication_mode": "COMPANION"
  },
  "triage": {
    "severity": "NOMINAL",
    "active_scenario": "BASELINE_TRANSIT",
    "headline": "All physiological and stress markers within nominal flight range.",
    "plain_english_explanation": "Your oxygen, blood sugar, and stress levels look steady for Day 142.",
    "action_steps": []
  }
}
```

### B. Voice / Text Interaction Endpoint (`POST /api/interact`)
* **Request:** `multipart/form-data` with optional `audio` (`.wav`/`.webm`) and/or `text_query` (`string`).
* **Response JSON:**
```json
{
  "transcript": "I feel dizzy, my hands are shaking, what is going on with my numbers?",
  "vocal_stress_index": 0.82,
  "communication_mode": "DIRECTIVE_CALM",
  "severity": "URGENT",
  "plain_english_response": "Your blood sugar has dropped sharply to 58 mg/dL, which explains the dizziness and shaking. Stay seated and follow these three steps now.",
  "action_steps": [
    "1. Drink one 15g fast-acting glucose pouch from Medical Kit Slot B2.",
    "2. Remain seated for 10 minutes and avoid sudden head movements.",
    "3. Re-check blood glucose on my prompt in 15 minutes."
  ],
  "audio_base64": null
}
```

### C. Anomaly Injector Endpoint (`POST /api/inject`)
* **Request JSON:** `{ "scenario": "BASELINE_TRANSIT" | "ACUTE_HYPOGLYCEMIA" | "CABIN_HYPOXIA" | "CIRCADIAN_STRESS_SPIKE" }`
* Immediately shifts `simulator.py` trajectories so the Crew HUD and `triage.py` react within 1–2 seconds during the live presentation.

---

## 6. Deterministic Triage Rules (`backend/core/triage.py`)

Implement these exact clinical thresholds before calling the LLM:

* **`CRITICAL`:** $\text{SpO}_2 < 90\%$ OR `glucose_mg_dl` $< 50$ OR `systolic_bp` $> 180$ OR `systolic_bp` $< 85$.
* **`URGENT`:** $\text{SpO}_2 \in [90\%, 93\%]$ OR `glucose_mg_dl` $\in [50, 68]$ OR (`heart_rate` $> 115$ AND `cortisol_ug_dl` $> 22$).
* **`ADVISORY`:** `cortisol_ug_dl` $> 18$ OR `vocal_stress_index` $\ge 0.65$ OR `glucose_mg_dl` $\in [69, 75]$.
* **`NOMINAL`:** All parameters outside the above alert bands.

---

## 7. Mandatory Build Sequence (Vertical Slices)

AI agents must build and verify the application in **four sequential slices**. Do not start Slice $N+1$ until Slice $N$ runs without errors:

* **Slice 1 — Deterministic Core & Simulator:**
  * Create `schemas.py`, `data/protocols.json`, `core/simulator.py`, and `core/triage.py`.
  * *Verification:* Run a standalone Python test confirming `ACUTE_HYPOGLYCEMIA` transitions severity from `NOMINAL` to `URGENT` and outputs 3 plain-English action steps.
* **Slice 2 — FastAPI Server & Crew HUD:**
  * Build `main.py` (`/ws/telemetry`, `/api/inject`) and the single-screen React HUD (`page.tsx` + components).
  * *Verification:* Open browser, confirm live 1 Hz vitals, Earth latency countdown (`21m 18s`), and working Anomaly Injector buttons.
* **Slice 3 — Local RAG & Stress-Adaptive LLM:**
  * Build `core/rag.py` and `core/llm_bridge.py` connected to local Ollama (`llama3.1:8b` or `phi3.5`) with deterministic fallback enabled.
  * *Verification:* Test `/api/interact` with `text_query` under `NOMINAL` vs. `URGENT` states and verify tone changes from warm companion to concise directive steps.
* **Slice 4 — Offline Voice Pipeline (STT + Prosody + TTS):**
  * Add `core/prosody.py` (`librosa` RMS energy + pitch variance $F_0$), `faster-whisper` transcription, and local TTS output.
  * *Verification:* Turn off Wi-Fi on the host machine and execute the full 3-scene demo storyboard end-to-end.

---

## 8. Agent Self-Check Before Finishing Any Task

Before concluding any code generation turn, the AI agent must verify:
1. Are all imports present in `requirements.txt` or `package.json`?
2. Are zero external network URLs hardcoded anywhere in the codebase?
3. Does the UI fit cleanly on a single `1920x1080` or `1440x900` viewport without broken overflow so judges can see vitals, vocal stress, and emergency cards simultaneously?
4. If the local LLM service is stopped, does `/api/interact` still return a valid, helpful plain-English response via the deterministic fallback?