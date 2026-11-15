"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Award, FileText, Keyboard, Mic, MicOff, Send, Sparkles, Star, Volume2, VolumeX, X, RotateCcw } from "lucide-react";
import type { AstronautId, ChatMessage, CheckinReward, MentalHealthReport } from "@/types/blue";
import { api, API_BASE } from "@/lib/api";
import { OPEN_LOG_EVENT } from "@/lib/metrics";
import { browserSpeech, recognitionConstructor, WakeListener, isWakePhrase } from "@/lib/browserSpeech";
import { HandsFreeCapture } from "@/lib/handsFreeCapture";
import BlueOctopus, { moodFromText, type BlueMood } from "./BlueOctopus";
import VoiceSubtitle from "./VoiceSubtitle";
import styles from "./VoicePsychologistFab.module.css";

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
  const input = useRef<HTMLTextAreaElement>(null);
  const mounted = useRef(false);
  const opened = useRef(false);
  const transitioning = useRef(false);
  const generation = useRef(0);
  const muted = useRef(false);
  const keyboardOpen = useRef(false);
  const voice = useRef(true);
  const done = useRef(false);
  const transcript = useRef<Turn[]>([]);
  const client = useRef(Symbol("BLUE wake microphone"));
  const wake = useRef<WakeListener | null>(null);
  const wakeFallback = useRef(false);
  const permission = useRef<PermissionState | null>(null);
  const capture = useRef<HandsFreeCapture | null>(null);
  const captureMode = useRef<"wake" | "input" | null>(null);
  const captureEpoch = useRef(0);
  const captureFetch = useRef<AbortController | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioFetch = useRef<AbortController | null>(null);
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
    audioFetch.current?.abort(); audioFetch.current = null;
    const player = audio.current; audio.current = null;
    if (player) {
      player.pause();
      player.removeAttribute("src");
      player.load();
    }
    stopPlayback.current?.(); stopPlayback.current = null;
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
    if (!mounted.current || document.hidden || muted.current || (mode === "wake" ? opened.current : !opened.current || done.current || keyboardOpen.current)) return;
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
        const response = await fetch(`${API_BASE}/api/transcribe${mode === "wake" ? "?wake=true" : ""}`, { method: "POST", body, signal: request.signal });
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
        if (capture.current !== instance || token !== captureEpoch.current) return;
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

  const speak = async (text: string) => {
    if (!voice.current || !opened.current || document.hidden) return;
    stopAudio();
    const token = generation.current;
    const active = () => opened.current && token === generation.current && voice.current && !document.hidden;
    try {
      const controller = new AbortController();
      audioFetch.current = controller;
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(17000)]);
      const response = await fetch(API_BASE + "/api/speech?stream=true", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }), signal,
      });
      if (!response.ok) throw new Error("Speech unavailable");
      const { url } = await response.json() as { url: string };
      if (!active()) return;
      const player = new Audio(); audio.current = player;
      await new Promise<void>((resolve, reject) => {
        stopPlayback.current = resolve;
        player.onplaying = () => { if (active()) setPhase("speaking"); };
        player.onended = () => resolve();
        player.onerror = () => reject(new Error("Playback failed"));
        player.src = url;
        void player.play().catch(reject);
      });
    } catch {
      if (!active()) return;
      stopAudio();
      if (!("speechSynthesis" in window)) {
        setNotice("Bleu’s audio is unavailable. You can read the subtitles.");
        return;
      }
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.12;
      await new Promise<void>(resolve => {
        const settle = () => { window.clearTimeout(timer); resolve(); };
        const timer = window.setTimeout(settle, 30_000);
        stopPlayback.current = settle;
        utterance.onstart = () => { if (active()) setPhase("speaking"); };
        utterance.onend = settle;
        utterance.onerror = () => {
          if (active()) setNotice("Bleu’s audio is unavailable. You can read the subtitles.");
          settle();
        };
        synth.speak(utterance);
      });
    } finally { if (token === generation.current) stopAudio(); }
  };

  const resumeInput = () => {
    if (!opened.current || document.hidden) return;
    setPhase(muted.current || keyboardOpen.current || captureMode.current !== "input" ? "idle" : "listening");
    if (!muted.current && !keyboardOpen.current) {
      if (capture.current && captureMode.current === "input") capture.current.setEnabled(true);
      else void startCapture("input");
    }
  };

  const connect = async (greet: boolean) => {
    if (!mounted.current || !opened.current || document.hidden || pendingReply.current) return;
    if (!greet || transcript.current.length) { resumeInput(); return; }
    const token = generation.current;
    pendingReply.current = true; setPhase("connecting"); setError("");
    try {
      const response = await api.chat({ astronaut_id: astronautId, messages: [], finish_session: false, session_id: sessionId.current });
      if (token !== generation.current || !opened.current) return;
      if (response.reply_source === "offline") setNotice("Live conversation is unavailable. Bleu’s offline check-in is still available.");
      update(`a-${++sequence.current}`, "assistant", response.reply, true);
      setPhase("thinking");
      await speak(response.reply);
    } catch { if (token === generation.current) setError("Bleu couldn’t connect. You can try sending a message."); }
    finally {
      if (token === generation.current) { pendingReply.current = false; resumeInput(); }
    }
  };
  connectRef.current = connect;

  const send = async (text: string) => {
    if (!text.trim() || !opened.current || done.current || phase === "connecting" || pendingReply.current) return;
    setDraft(""); setError("");
    const token = generation.current;
    pendingReply.current = true; captureFetch.current?.abort(); captureFetch.current = null;
    capture.current?.setEnabled(false); stopAudio(); setPhase("thinking");
    update(`u-${++sequence.current}`, "user", text, true);
    try {
      const response = await api.chat({ astronaut_id: astronautId, messages: messages(), finish_session: false, session_id: sessionId.current });
      if (token !== generation.current || !opened.current) return;
      setNotice(response.reply_source === "offline" ? "Live conversation is unavailable. Bleu’s offline check-in is still available." : "");
      update(`a-${++sequence.current}`, "assistant", response.reply, true); await speak(response.reply);
    } catch { if (token === generation.current) setError("BLUE couldn’t reach the habitat server. Your message is saved; try again."); }
    finally {
      if (token === generation.current) { pendingReply.current = false; resumeInput(); }
    }
  };
  sendRef.current = send;

  const releaseSession = useCallback(async () => {
    pendingReply.current = false;
    stopAudio(); await stopCapture();
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
    keyboardOpen.current = false;
    restoreFocus.current = true; setOpen(false); setTyping(false); setFiling(false); dialog.current?.close();
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
    opened.current = true; setNotice(""); setOpen(true); dialog.current?.showModal(); transitioning.current = false;
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
      await stopCapture(); setLevel(0); if (phase === "listening") setPhase("idle");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      muted.current = false; setMicMuted(false); permission.current = "granted"; setNotice("");
      if (!pendingReply.current) await startCapture("input");
    } catch { setNotice("Microphone access is blocked. Allow it in your browser and system microphone settings, then try again."); }
  };

  const toggleKeyboard = async () => {
    keyboardOpen.current = !keyboardOpen.current;
    setTyping(keyboardOpen.current);
    if (keyboardOpen.current) {
      await stopCapture();
      if (!pendingReply.current) setPhase("idle");
    } else if (!pendingReply.current) resumeInput();
  };

  const finish = async () => {
    if (filing || done.current || pendingReply.current) return;
    pendingReply.current = true; setFiling(true); const token = generation.current;
    capture.current?.setEnabled(false);
    try {
      const response = await api.chat({ astronaut_id: astronautId, messages: messages(), finish_session: true, session_id: sessionId.current });
      if (token !== generation.current || !opened.current) return;
      if (response.generated_report) { onReportGenerated(response.generated_report); done.current = true; setFinished(true); setReward(response.reward); muted.current = true; setMicMuted(true); }
      await releaseSession(); update(`a-${++sequence.current}`, "assistant", response.reply, true); setPhase("idle");
    } catch { setError("The report couldn’t be filed. Your conversation is saved here; please try again."); }
    finally {
      if (token === generation.current) {
        pendingReply.current = false; setFiling(false);
        if (!done.current) resumeInput();
      }
    }
  };

  useEffect(() => {
    mounted.current = true;
    const detector = new WakeListener(browserSpeech, client.current,
      () => mounted.current && !opened.current && !transitioning.current && !document.hidden && !muted.current && permission.current === "granted",
      () => void activateRef.current(true), text => { if (mounted.current && !opened.current) setNotice(text); },
      () => { wakeFallback.current = true; if (mounted.current && !opened.current) { setNotice("Using backup wake-word recognition. Say Hey Blue or press Talk to Blue."); resumeWakeRef.current(); } });
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
      else if (opened.current && !done.current) void connectRef.current(!transcript.current.length);
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
  useEffect(() => { if (typing) input.current?.focus(); }, [typing]);
  useEffect(() => { if (!open && restoreFocus.current) { restoreFocus.current = false; fab.current?.focus(); } }, [open]);

  const characterMood: BlueMood = phase === "connecting" || phase === "thinking" ? "thinking" : phase === "speaking" ? "speaking" : phase === "listening" && !micMuted ? "listening" : mood;
  const status = finished ? "Report queued for Earth" : phase === "connecting" ? "Connecting…" : phase === "thinking" ? "Thinking…" : phase === "speaking" ? "Bleu is speaking" : typing ? "Keyboard input" : micMuted ? "Microphone muted" : phase === "listening" ? "Listening…" : "Ready";
  return <>
    <button type="button" ref={fab} className={styles.fab} aria-label="Talk to Blue" aria-haspopup="dialog" aria-controls="blue-conversation" aria-expanded={open} hidden={open} onClick={() => void activate()}>
      <span aria-hidden="true" data-blue-anchor="talk-to-blue"><BlueOctopus mood="idle" size={64}/></span>
    </button>
    <dialog ref={dialog} id="blue-conversation" className={styles.dialog} aria-label={`Bleu check-in with ${astronautName}`} onCancel={event => { event.preventDefault(); void close(); }}>
      <button type="button" className={`${styles.icon} ${styles.close}`} aria-label="Close Blue" onClick={() => void close()} autoFocus><X size={22}/></button>
      <div className={styles.stage}>
      <div data-blue-voice-character ref={character} className={styles.character} aria-hidden="true">
        <BlueOctopus mood={characterMood} level={level}/>
      </div>
      <div className={styles.captions}>
        <p role="status" className={styles.status}>{status}</p>
        <VoiceSubtitle key={latest?.id} turn={latest} />
      </div>
      </div>
      <footer className={styles.footer}>
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
          <div className={styles.controls}>
            <button type="button" className={styles.icon} disabled={phase === "connecting" || filing} aria-label={micMuted ? "Unmute microphone" : "Mute microphone"} aria-pressed={micMuted} onClick={() => void toggleMic()}>{micMuted ? <MicOff size={19}/> : <Mic size={19}/>}</button>
            <button type="button" className={styles.icon} aria-label={voiceOn ? "Mute Blue’s voice" : "Enable Blue’s voice"} aria-pressed={!voiceOn} onClick={() => { voice.current = !voice.current; setVoiceOn(voice.current); if (!voice.current) stopAudio(); }}>{voiceOn ? <Volume2 size={19}/> : <VolumeX size={19}/>}</button>
            <button type="button" className={styles.icon} aria-label="Type a message" aria-expanded={typing} onClick={() => void toggleKeyboard()}><Keyboard size={19}/></button>
          </div>
          {typing && <form className={styles.composer} onSubmit={event => { event.preventDefault(); void send(draft.trim()); }}><textarea ref={input} className={styles.input} aria-label="Your message to Blue" placeholder="Type a message…" rows={1} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(draft.trim()); } }}/><button type="submit" className={`${styles.icon} ${styles.primary}`} aria-label="Send message" disabled={!draft.trim() || phase === "connecting" || phase === "thinking" || phase === "speaking" || filing}><Send size={18}/></button></form>}
          {turns.some(t => t.role === "user" && t.final) && <button className={styles.report} disabled={filing || phase === "connecting" || phase === "thinking" || phase === "speaking"} onClick={() => void finish()}><FileText size={15}/>{filing ? "Filing report…" : "End session & generate Earth report"}</button>}
        </>}
      </footer>
      <div className={styles.noticeArea}>
        {error ? <p className={styles.error} role="alert">{error}</p> : notice && <p role="status">{notice}</p>}
      </div>
    </dialog>
  </>;
}
