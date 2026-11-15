"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Award, FileText, Keyboard, Mic, MicOff, Send, Sparkles, Star, Volume2, VolumeX, X, RotateCcw } from "lucide-react";
import type { AgentSession as LiveSession, SessionToken } from "@fishaudio/agent-client";
import type { AstronautId, ChatMessage, CheckinReward, MentalHealthReport } from "@/types/blue";
import { api, API_BASE } from "@/lib/api";
import { OPEN_LOG_EVENT } from "@/lib/metrics";
import { browserSpeech, recognitionConstructor, WakeListener, isWakePhrase } from "@/lib/browserSpeech";
import { HandsFreeCapture } from "@/lib/handsFreeCapture";
import BlueOctopus, { moodFromText, type BlueMood } from "./BlueOctopus";
import styles from "./VoicePsychologistFab.module.css";

const GREETING = "Hi, how are you doing today? Ready to take your survey?";
interface Props { astronautId: AstronautId; astronautName: string; onReportGenerated: (report: MentalHealthReport) => void; }
interface Turn extends ChatMessage { id: string; final: boolean; }
type Phase = "idle" | "connecting" | "listening" | "thinking" | "speaking";
/** One id per BLUE conversation, so crew life counts each message once. */
const newSessionId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export default function VoicePsychologistFab({ astronautId, astronautName, onReportGenerated }: Props) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [mood, setMood] = useState<BlueMood>("happy");
  const [level, setLevel] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);
  const [filing, setFiling] = useState(false);
  const [reward, setReward] = useState<CheckinReward | null>(null);
  const sessionId = useRef(newSessionId());
  const dialog = useRef<HTMLDialogElement>(null);
  const fab = useRef<HTMLButtonElement>(null);
  const character = useRef<HTMLDivElement>(null);
  const subtitle = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const mounted = useRef(false);
  const opened = useRef(false);
  const transitioning = useRef(false);
  const generation = useRef(0);
  const muted = useRef(false);
  const voice = useRef(true);
  const done = useRef(false);
  const transcript = useRef<Turn[]>([]);
  const session = useRef<LiveSession | null>(null);
  const engine = useRef<"live" | "backup">("live");
  const frame = useRef(0);
  const client = useRef(Symbol("BLUE wake microphone"));
  const wake = useRef<WakeListener | null>(null);
  const wakeFallback = useRef(false);
  const permission = useRef<PermissionState | null>(null);
  const capture = useRef<HandsFreeCapture | null>(null);
  const captureMode = useRef<"wake" | "input" | null>(null);
  const captureEpoch = useRef(0);
  const captureFetch = useRef<AbortController | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const stopPlayback = useRef<(() => void) | null>(null);
  const restoreFocus = useRef(false);
  const sequence = useRef(0);
  const pendingReply = useRef(false);
  const activateRef = useRef<(fromWake?: boolean) => Promise<void>>(async () => {});
  const sendRef = useRef<(text: string) => Promise<void>>(async () => {});
  const resumeWakeRef = useRef<() => void>(() => {});
  const connectRef = useRef<(greet: boolean) => Promise<void>>(async () => {});
  const reportActivityRef = useRef<() => void>(() => {});

  const messages = (): ChatMessage[] => transcript.current.filter(t => t.final).map(({ role, content }) => ({ role, content }));
  const update = useCallback((id: string, role: ChatMessage["role"], content: string, final: boolean) => {
    if (!mounted.current) return;
    const existing = transcript.current.findIndex(t => t.id === id);
    const next = { id, role, content, final };
    transcript.current = existing < 0 ? [...transcript.current, next] : transcript.current.map((t, i) => i === existing ? next : t);
    setTurns([...transcript.current]);
    if (role === "user" && final) setMood(moodFromText(content));
  }, []);

  const stopAudio = useCallback(() => {
    audio.current?.pause(); audio.current = null;
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = null; stopPlayback.current?.(); stopPlayback.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);
  const stopCapture = useCallback(async () => {
    captureEpoch.current++; captureFetch.current?.abort(); captureFetch.current = null;
    const current = capture.current; capture.current = null; captureMode.current = null;
    await current?.stop();
    if (mounted.current) setLevel(0);
  }, []);
  const pauseWake = useCallback(async () => {
    const released = await wake.current?.pause();
    if (captureMode.current === "wake") await stopCapture();
    return released !== false;
  }, [stopCapture]);

  const startCapture = async (mode: "wake" | "input") => {
    if (!mounted.current || document.hidden || muted.current || (mode === "wake" ? opened.current : !opened.current || done.current)) return;
    if (capture.current && captureMode.current === mode) { capture.current.setEnabled(true); return; }
    await stopCapture();
    if (!await pauseWake()) { setNotice("The microphone is still closing. You can type your message."); return; }
    const token = captureEpoch.current;
    const instance = new HandsFreeCapture(async recording => {
      if (capture.current !== instance) return;
      const request = new AbortController(); captureFetch.current = request;
      if (mode === "input") setPhase("thinking");
      const timer = setTimeout(() => request.abort(), 5000);
      try {
        const body = new FormData(); body.append("audio", recording, "microphone.wav");
        const response = await fetch(`${API_BASE}/api/transcribe`, { method: "POST", body, signal: request.signal });
        if (!response.ok) throw new Error("Transcription unavailable");
        const result = await response.json() as { text: string };
        if (capture.current !== instance || token !== captureEpoch.current || document.hidden || muted.current) return;
        if (mode === "wake") {
          if (isWakePhrase(result.text)) { void activateRef.current(true); return; }
          instance.setEnabled(true);
        } else if (result.text.trim()) {
          await sendRef.current(result.text.trim());
        } else { instance.setEnabled(true); setPhase("listening"); }
      } catch {
        if (request.signal.aborted) return;
        if (capture.current === instance) setNotice("Speech recognition is temporarily unavailable. Use the microphone button to retry, or type below.");
        if (capture.current === instance) { await stopCapture(); if (mode === "input") { muted.current = true; setMicMuted(true); setPhase("idle"); } }
      } finally { clearTimeout(timer); }
    }, value => { if (mounted.current && capture.current === instance) setLevel(value); });
    capture.current = instance; captureMode.current = mode;
    try {
      await instance.start();
      if (capture.current === instance && mode === "input") setPhase("listening");
    } catch (err) {
      if (capture.current !== instance) return;
      capture.current = null; captureMode.current = null;
      if (mode === "input") { muted.current = true; setMicMuted(true); setPhase("idle"); }
      setNotice(err instanceof Error && /denied|allowed|permission/i.test(err.message)
        ? "Microphone access is blocked. Allow it in your browser or system settings, then press Unmute microphone. You can still type."
        : "The microphone couldn’t start. Check your input device, or type your message.");
    }
  };

  const backupSpeak = async (text: string) => {
    if (!voice.current || !opened.current || document.hidden) return;
    stopAudio(); setPhase("thinking");
    const token = generation.current;
    try {
      const response = await fetch(`${API_BASE}/api/speech`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error("Speech unavailable");
      const blob = await response.blob();
      if (!opened.current || token !== generation.current || !voice.current || document.hidden) return;
      const url = URL.createObjectURL(blob); audioUrl.current = url;
      const player = new Audio(url); audio.current = player;
      await new Promise<void>((resolve, reject) => {
        stopPlayback.current = resolve;
        player.onplay = () => setPhase("speaking"); player.onended = () => resolve(); player.onerror = () => reject(new Error("Playback failed"));
        void player.play().catch(reject);
      });
    } catch {
      if (opened.current && token === generation.current) setNotice("BLUE’s audio is unavailable. You can read the reply below.");
    } finally { if (token === generation.current) stopAudio(); }
  };

  const connect = async (greet: boolean) => {
    if (!mounted.current || !opened.current || document.hidden || session.current) return;
    const token = generation.current; engine.current = "live"; setPhase("connecting"); setError("");
    try {
      const response = await fetch(`${API_BASE}/api/voice-session`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ astronaut_id: astronautId, messages: messages(), finish_session: false, session_id: sessionId.current }), signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error("Live voice unavailable");
      const sessionToken = await response.json() as SessionToken;
      const { AgentSession } = await import("@fishaudio/agent-client");
      if (token !== generation.current || !opened.current) return;
      const active = () => mounted.current && opened.current && generation.current === token && engine.current === "live";
      const connecting = AgentSession.start({ sessionToken, microphone: !muted.current, callbacks: {
        onModeChange: mode => { if (active()) setPhase(mode === "listening" && muted.current ? "idle" : mode); },
        onUserTranscript: ({ segmentId, text, final }) => { if (active()) update(`u-${token}-${segmentId}`, "user", text, final); },
        onAgentResponseDelta: ({ segmentId, text }) => { if (active()) update(`a-${token}-${segmentId}`, "assistant", text, false); },
        onAgentResponse: ({ segmentId, text }) => { if (active()) { pendingReply.current = false; update(`a-${token}-${segmentId}`, "assistant", text, true); } },
        onError: err => { if (active()) setNotice(err.code === "mic_permission_denied" ? "Microphone access was denied. You can still type, or allow it and press Unmute microphone." : "The voice service had a problem. Your conversation remains here; use Reconnect voice if needed."); },
        onDisconnect: () => { if (active()) { session.current = null; cancelAnimationFrame(frame.current); setPhase("idle"); setLevel(0); setNotice("Voice connection ended. Press Reconnect voice to continue, or keep typing."); } },
      } });
      let timer: ReturnType<typeof setTimeout> | undefined;
      let live: LiveSession;
      try { live = await Promise.race([connecting, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Voice connection timed out")), 5000); })]); }
      catch (err) { void connecting.then(late => late.end()).catch(() => {}); throw err; }
      finally { clearTimeout(timer); }
      if (!active()) { await live.end(); return; }
      session.current = live; live.setOutputVolume(voice.current ? 1 : 0);
      await live.startAudio().catch(() => setNotice("Press the speaker button to enable BLUE’s audio."));
      if (permission.current !== "denied") setNotice("");
      let previous = 0;
      const animate = (time: number) => {
        if (session.current !== live || !active()) return;
        if (time - previous > 80) { previous = time; setLevel(Math.min(1, Math.max(live.getInputVolume(), live.getOutputVolume()) * 3)); }
        frame.current = requestAnimationFrame(animate);
      };
      frame.current = requestAnimationFrame(animate);
      setPhase(live.mode === "listening" && muted.current ? "idle" : live.mode);
    } catch {
      if (token !== generation.current || !opened.current) return;
      engine.current = "backup"; setNotice("Live conversation is unavailable. BLUE’s offline check-in is available, with backup voice input.");
      if (!transcript.current.length) { update(`a-${++sequence.current}`, "assistant", GREETING, true); if (greet) await backupSpeak(GREETING); }
      if (!muted.current) await startCapture("input"); else setPhase("idle");
    }
  };
  connectRef.current = connect;

  const send = async (text: string) => {
    if (!text.trim() || !opened.current || done.current || phase === "connecting" || pendingReply.current) return;
    setDraft(""); setError("");
    if (session.current) { pendingReply.current = true; session.current.sendUserMessage(text, { audio: voice.current }); return; }
    if (engine.current === "live") { await connectRef.current(false); const reconnected = session.current as LiveSession | null; if (reconnected) { pendingReply.current = true; reconnected.sendUserMessage(text, { audio: voice.current }); return; } }
    const token = generation.current;
    pendingReply.current = true; captureFetch.current?.abort(); captureFetch.current = null;
    capture.current?.setEnabled(false); stopAudio(); setPhase("thinking");
    update(`u-${++sequence.current}`, "user", text, true);
    try {
      const response = await api.chat({ astronaut_id: astronautId, messages: messages(), finish_session: false, session_id: sessionId.current });
      if (token !== generation.current || !opened.current) return;
      update(`a-${++sequence.current}`, "assistant", response.reply, true); await backupSpeak(response.reply);
    } catch { if (token === generation.current) setError("BLUE couldn’t reach the habitat server. Your message is saved; try again."); }
    finally {
      pendingReply.current = false;
      if (token === generation.current && opened.current && !document.hidden) {
        setPhase(muted.current ? "idle" : "listening");
        if (!muted.current) { if (capture.current) capture.current.setEnabled(true); else void startCapture("input"); }
      }
    }
  };
  sendRef.current = send;

  const releaseSession = useCallback(async () => {
    const live = session.current; session.current = null; pendingReply.current = false; cancelAnimationFrame(frame.current);
    await live?.end().catch(() => {});
    await stopCapture(); stopAudio();
  }, [stopCapture, stopAudio]);

  const resumeWake = () => {
    if (!mounted.current || opened.current || transitioning.current || document.hidden || muted.current || permission.current !== "granted") return;
    if (wakeFallback.current) void startCapture("wake"); else wake.current?.resume();
  };
  resumeWakeRef.current = resumeWake;

  const reportActivity = () => {
    // A conversation closed without a report still counts for Voice of the Station (message count only).
    const said = messages().filter(m => m.role === "user").length;
    if (said && !done.current) void api.blueActivity(astronautId, sessionId.current, said).catch(() => {});
  };

  reportActivityRef.current = reportActivity;

  const close = async () => {
    if (transitioning.current && !opened.current) return;
    reportActivity();
    transitioning.current = true; opened.current = false; generation.current++;
    restoreFocus.current = true; setOpen(false); setTyping(false); dialog.current?.close();
    await releaseSession();
    if (!mounted.current) return;
    setPhase("idle"); setLevel(0); transitioning.current = false; resumeWakeRef.current();
  };

  const activate = async () => {
    if (!mounted.current || opened.current || transitioning.current || document.hidden) return;
    transitioning.current = true; const token = ++generation.current;
    const released = await pauseWake();
    if (!mounted.current || document.hidden || token !== generation.current) { transitioning.current = false; return; }
    const origin = fab.current?.querySelector("svg")?.getBoundingClientRect();
    opened.current = true; setOpen(true); dialog.current?.showModal(); transitioning.current = false;
    const target = character.current?.getBoundingClientRect();
    if (origin && target?.width && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const x = origin.left + origin.width / 2 - target.left - target.width / 2;
      const y = origin.top + origin.height / 2 - target.top - target.height / 2;
      character.current?.animate(
        [{ transform: `translate(${x}px, ${y}px) scale(${origin.width / target.width})` }, { transform: "none" }],
        { duration: 440, easing: "cubic-bezier(.2,.75,.25,1)" },
      );
    }
    if (!released) { muted.current = true; setMicMuted(true); setNotice("The microphone hasn’t released. Text chat is still available."); }
    if (!muted.current && permission.current !== "granted") {
      try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.getTracks().forEach(track => track.stop()); permission.current = "granted"; }
      catch { muted.current = true; setMicMuted(true); permission.current = "denied"; setNotice("Microphone access is blocked. Allow it in browser/system settings, then press Unmute microphone. You can still type."); }
    }
    if (token === generation.current && opened.current) await connectRef.current(!transcript.current.length);
  };
  activateRef.current = activate;

  const toggleMic = async () => {
    const next = !muted.current;
    if (next) {
      muted.current = true; setMicMuted(true);
      if (session.current) await session.current.setMicMuted(true);
      await stopCapture(); setLevel(0); if (phase === "listening") setPhase("idle");
      return;
    }
    try {
      if (session.current) await session.current.setMicMuted(false);
      else { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.getTracks().forEach(track => track.stop()); }
      muted.current = false; setMicMuted(false); permission.current = "granted"; setNotice("");
      if (!session.current) { if (engine.current === "backup") await startCapture("input"); else await connectRef.current(false); }
      else if (!session.current.isSpeaking) setPhase("listening");
    } catch { setNotice("Microphone access is blocked. Allow it in your browser and system microphone settings, then try again."); }
  };

  const finish = async () => {
    if (filing || done.current) return;
    setFiling(true); const token = generation.current;
    await session.current?.setMicMuted(true); capture.current?.setEnabled(false);
    try {
      const response = await api.chat({ astronaut_id: astronautId, messages: messages(), finish_session: true, session_id: sessionId.current });
      if (token !== generation.current || !opened.current) return;
      if (response.generated_report) { onReportGenerated(response.generated_report); done.current = true; setFinished(true); setReward(response.reward); muted.current = true; setMicMuted(true); }
      await releaseSession(); update(`a-${++sequence.current}`, "assistant", response.reply, true); setPhase("idle");
    } catch { setError("The report couldn’t be filed. Your conversation is saved here; please try again."); }
    finally { if (token === generation.current) setFiling(false); }
  };

  useEffect(() => {
    mounted.current = true;
    const detector = new WakeListener(browserSpeech, client.current,
      () => mounted.current && !opened.current && !transitioning.current && !document.hidden && !muted.current && permission.current === "granted",
      () => void activateRef.current(true), text => { if (mounted.current) setNotice(text); },
      () => { wakeFallback.current = true; if (mounted.current) { setNotice("Using backup wake-word recognition. Say Hey Blue or press Talk to Blue."); resumeWakeRef.current(); } });
    wake.current = detector;
    let status: PermissionStatus | undefined;
    const changed = () => { permission.current = status?.state ?? null; if (permission.current === "granted") resumeWakeRef.current(); };
    if (navigator.permissions?.query) void navigator.permissions.query({ name: "microphone" as PermissionName }).then(value => {
      if (!mounted.current || wake.current !== detector) return;
      status = value; status.addEventListener("change", changed); changed();
    }).catch(() => { permission.current = null; });
    if (!recognitionConstructor()) wakeFallback.current = true;
    const visibility = async () => {
      if (document.hidden) { generation.current++; await detector.pause(); await releaseSession(); setPhase("idle"); }
      else if (opened.current && !done.current) void connectRef.current(false);
      else resumeWakeRef.current();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      if (opened.current) reportActivityRef.current();
      mounted.current = false; opened.current = false; generation.current++; detector.dispose();
      status?.removeEventListener("change", changed); document.removeEventListener("visibilitychange", visibility); void releaseSession();
    };
  }, [releaseSession]);
  useEffect(() => {
    const openFromNav = () => void activateRef.current();
    window.addEventListener(OPEN_LOG_EVENT, openFromNav);
    return () => window.removeEventListener(OPEN_LOG_EVENT, openFromNav);
  }, []);
  const latest = turns.at(-1);
  useEffect(() => {
    if (subtitle.current) subtitle.current.scrollTop = subtitle.current.scrollHeight;
  }, [latest]);
  useEffect(() => { if (typing) input.current?.focus(); }, [typing]);
  useEffect(() => { if (!open && restoreFocus.current) { restoreFocus.current = false; fab.current?.focus(); } }, [open]);

  const characterMood: BlueMood = phase === "connecting" || phase === "thinking" ? "thinking" : phase === "speaking" ? "speaking" : phase === "listening" && !micMuted ? "listening" : mood;
  const status = finished ? "Report queued for Earth" : phase === "connecting" ? "Connecting…" : phase === "thinking" ? "Thinking…" : phase === "speaking" ? "Bleu is speaking" : micMuted ? "Microphone muted" : phase === "listening" ? "Listening…" : "Ready";
  return <>
    <button type="button" ref={fab} className={styles.fab} aria-label="Talk to Blue" aria-haspopup="dialog" aria-controls="blue-conversation" aria-expanded={open} hidden={open} onClick={() => void activate()}>
      <span aria-hidden="true" data-blue-anchor="talk-to-blue"><BlueOctopus mood="idle" size={64}/></span>
    </button>
    <dialog ref={dialog} id="blue-conversation" className={styles.dialog} aria-label={`Bleu check-in with ${astronautName}`} onCancel={event => { event.preventDefault(); void close(); }}>
      <button type="button" className={`${styles.icon} ${styles.close}`} aria-label="Close Blue" onClick={() => void close()} autoFocus><X size={22}/></button>
      <div data-blue-voice-character ref={character} className={styles.character} aria-hidden="true">
        <BlueOctopus mood={characterMood} level={level}/>
      </div>
      <div className={styles.captions}>
        <p role="status" className={styles.status}>{status}</p>
        <div ref={subtitle} className={styles.subtitle} aria-live="off" tabIndex={latest?.content ? 0 : undefined} aria-label="Current subtitle">
          {latest?.content && <p><span className="sr-only">{latest.role === "user" ? "You: " : "Bleu: "}</span>{latest.content}</p>}
        </div>
        <span className="sr-only" aria-live="polite">{latest?.final && latest.role === "assistant" ? latest.content : ""}</span>
      </div>
      <footer className={styles.footer}>
        {error && <p className={`${styles.notice} ${styles.error}`} role="alert">{error}</p>}
        {!error && notice && <p className={styles.notice} role="status">{notice}</p>}
        {finished && reward && <details className={styles.reward}>
          <summary>Check-in reward</summary>
          <p id="blue-reward-title" className={styles.rewardTitle}><Sparkles size={15} aria-hidden="true"/> Thank you</p>
          <p className={styles.rewardText}>{reward.thank_you}</p>
          <ol className={styles.rewardDays} aria-label={`${reward.checkin_days} of ${reward.target_days} check-in days this week`}>
            {Array.from({ length: Math.max(reward.target_days, reward.checkin_days) }, (_, i) => <li key={i} className={i < reward.checkin_days ? styles.dayDone : ""} aria-hidden="true"/>)}
          </ol>
          {reward.challenge_just_completed && <p className={styles.rewardStar}><Star size={14} aria-hidden="true"/> New star on the mission map · {reward.stars} stars</p>}
          <p className={styles.fact}><span>Space fact</span>{reward.space_fact}</p>
          <Link className={styles.rewardLink} onClick={() => void close()} href={reward.challenge_just_completed ? "/dashboard/crew-life?star=new" : "/dashboard/crew-life"}><Award size={14} aria-hidden="true"/> Crew life: titles, challenge &amp; mission map</Link>
        </details>}
        {finished ? <button className={styles.report} onClick={() => { transcript.current = []; setTurns([]); done.current = false; setFinished(false); setReward(null); sessionId.current = newSessionId(); muted.current = false; setMicMuted(false); setNotice(""); setError(""); void connectRef.current(true); }}><RotateCcw size={16}/> Start a new session</button> : <>
          {typing && <form className={styles.composer} onSubmit={event => { event.preventDefault(); void send(draft.trim()); }}><textarea ref={input} className={styles.input} aria-label="Your message to Blue" placeholder="Type a message…" rows={1} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(draft.trim()); } }}/><button type="submit" className={`${styles.icon} ${styles.primary}`} aria-label="Send message" disabled={!draft.trim() || phase === "connecting" || phase === "thinking" || filing}><Send size={18}/></button></form>}
          <div className={styles.controls}>
            <button type="button" className={styles.icon} disabled={phase === "connecting" || filing} aria-label={micMuted ? "Unmute microphone" : "Mute microphone"} aria-pressed={micMuted} onClick={() => void toggleMic()}>{micMuted ? <MicOff size={19}/> : <Mic size={19}/>}</button>
            <button type="button" className={styles.icon} aria-label={voiceOn ? "Mute Blue’s voice" : "Enable Blue’s voice"} aria-pressed={!voiceOn} onClick={() => { voice.current = !voice.current; setVoiceOn(voice.current); session.current?.setOutputVolume(voice.current ? 1 : 0); if (!voice.current) stopAudio(); else void session.current?.startAudio(); }}>{voiceOn ? <Volume2 size={19}/> : <VolumeX size={19}/>}</button>
            <button type="button" className={styles.icon} aria-label="Type a message" aria-expanded={typing} onClick={() => setTyping(value => !value)}><Keyboard size={19}/></button>
          </div>
          {!session.current && engine.current === "live" && phase !== "connecting" && <button className={styles.report} onClick={() => void connectRef.current(false)}>Reconnect voice</button>}
          {turns.some(t => t.role === "user" && t.final) && <button className={styles.report} disabled={filing || phase === "connecting" || phase === "thinking"} onClick={() => void finish()}><FileText size={15}/>{filing ? "Filing report…" : "End session & generate Earth report"}</button>}
        </>}
      </footer>
    </dialog>
  </>;
}
