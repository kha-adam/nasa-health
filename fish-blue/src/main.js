import { AgentSession } from "@fishaudio/agent-client"

const $ = (id) => document.getElementById(id)
const orb = $("orb"), statusEl = $("status"), hintEl = $("hint"), transcript = $("transcript")
const muteBtn = $("mute"), endBtn = $("end")

const IDLE_CLOSE_MS = 30_000

let session = null
let starting = false
let configured = false
let lastActivity = Date.now()
const bubbles = new Map()

// ---------------------------------------------------------------- UI helpers
function setStatus(text, hint) {
  statusEl.textContent = text
  if (hint !== undefined) hintEl.innerHTML = hint
}
function setOrb(mode) { orb.className = `orb ${mode}` }
function bubble(role, id, text, interim = false) {
  let el = id ? bubbles.get(id) : null
  if (!el) {
    el = document.createElement("div")
    transcript.appendChild(el)
    if (id) bubbles.set(id, el)
  }
  el.className = `msg ${role}${interim ? " interim" : ""}`
  el.textContent = text
  transcript.scrollTop = transcript.scrollHeight
}
const note = (text, error = false) => bubble(error ? "system error" : "system", null, text)

// ---------------------------------------------------------------- audio-reactive orb
function animate() {
  if (session) {
    const inV = session.getInputVolume?.() ?? 0
    const outV = session.getOutputVolume?.() ?? 0
    const v = Math.max(inV, outV)
    orb.style.setProperty("--core", (1 + Math.min(0.18, v * 0.6)).toFixed(3))
    orb.style.setProperty("--halo", (1 + Math.min(0.5, v * 1.6)).toFixed(3))
  } else {
    orb.style.removeProperty("--core")
    orb.style.removeProperty("--halo")
  }
  requestAnimationFrame(animate)
}
requestAnimationFrame(animate)

// ---------------------------------------------------------------- Fish Audio session
async function startSession(said = "") {
  if (session || starting) return
  if (!configured) { note("The server isn't configured: run `npm run setup`.", true); return }
  starting = true
  orb.disabled = true
  setOrb("thinking")
  setStatus("Connecting…", "")
  try {
    const res = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ said }) })
    const sessionToken = await res.json()
    if (!res.ok) throw new Error(sessionToken.error || `HTTP ${res.status}`)
    if (said) bubble("user", null, said)
    session = await AgentSession.start({
      sessionToken,
      callbacks: {
        onModeChange: (mode) => {
          lastActivity = Date.now()
          setOrb(mode === "thinking" ? "thinking" : "live")
          setStatus(mode === "speaking" ? "Blue is speaking" : mode === "thinking" ? "Thinking…" : "Listening…", "Say “bye Blue” or tap End to finish")
        },
        onUserTranscript: ({ segmentId, text, final }) => { lastActivity = Date.now(); bubble("user", `u-${segmentId}`, text, !final) },
        onAgentResponseDelta: ({ segmentId, text }) => { lastActivity = Date.now(); bubble("agent", `a-${segmentId}`, text, true) },
        onAgentResponse: ({ segmentId, text }) => bubble("agent", `a-${segmentId}`, text),
        onDisconnect: ({ reason }) => endedUI(reason),
        onError: (err) => note(`Error: ${err.code ?? err.message}`, true),
      },
    })
    await session.startAudio?.().catch(() => {})
    muteBtn.hidden = false
    endBtn.hidden = false
    setOrb("live")
    setStatus("Listening…", "Say “bye Blue” or tap End to finish")
    lastActivity = Date.now()
  } catch (err) {
    session = null
    const msg = err?.code === "mic_permission_denied" ? "Microphone access was denied." : err?.message || String(err)
    note(`Could not start: ${msg}`, true)
    endedUI()
  } finally {
    starting = false
    orb.disabled = false
  }
}

function endedUI(reason) {
  session = null
  muteBtn.hidden = true
  endBtn.hidden = true
  muteBtn.textContent = "Mute"
  setOrb("idle")
  if (reason) note(reason === "agent_hangup" ? "Blue said goodbye." : reason === "user_hangup" ? "Conversation ended." : `Conversation ended (${reason}).`)
  idleStatus()
}

// Close idle conversations and wait for another explicit click.
setInterval(() => {
  if (session && session.mode === "listening" && Date.now() - lastActivity > IDLE_CLOSE_MS) {
    note("Closed after 30 s of silence.")
    session.end()
  }
}, 1000)

// ---------------------------------------------------------------- click-to-start standby
function idleStatus() {
  if (!configured) return setStatus("Not configured", "Run <code>npm run setup</code> on the server")
  setStatus("Tap the orb to talk", "Blue is ready when you are")
}

// ---------------------------------------------------------------- controls
orb.addEventListener("click", () => { if (session) session.interrupt(); else void startSession() })
endBtn.addEventListener("click", () => session?.end())
muteBtn.addEventListener("click", async () => {
  if (!session) return
  await session.setMicMuted(!session.micMuted)
  muteBtn.textContent = session.micMuted ? "Unmute" : "Mute"
})
$("form").addEventListener("submit", async (e) => {
  e.preventDefault()
  const input = $("text")
  const text = input.value.trim()
  if (!text) return
  input.value = ""
  if (!session) { await startSession(text); return }
  lastActivity = Date.now()
  session.sendUserMessage(text, { audio: true }) // the SDK echoes it as a user transcript
})

// ---------------------------------------------------------------- boot
fetch("/api/status").then((r) => r.json()).then((s) => {
  configured = s.configured
  setOrb("idle")
  idleStatus()
}).catch(() => setStatus("Server unreachable", ""))
