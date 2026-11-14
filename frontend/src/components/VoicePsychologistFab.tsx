"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, Mic, RotateCcw, Send, X } from "lucide-react";
import type { AstronautId, ChatMessage, MentalHealthReport, SessionMode } from "@/types/blue";
import { api } from "@/lib/api";

interface Props {
  astronautId: AstronautId;
  astronautName: string;
  onReportGenerated: (report: MentalHealthReport) => void;
}

const MIN_THINK_MS = 700; // small pause so BLUE feels conversational, not instant

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function VoicePsychologistFab({ astronautId, astronautName, onReportGenerated }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<SessionMode | null>(null);
  const [wrapSuggested, setWrapSuggested] = useState(false);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const send = useCallback(
    async (history: ChatMessage[], finish = false) => {
      setBusy(true);
      setError(null);
      try {
        const [res] = await Promise.all([
          api.chat({ astronaut_id: astronautId, messages: history, finish_session: finish }),
          wait(MIN_THINK_MS),
        ]);
        setMessages([...history, { role: "assistant", content: res.reply }]);
        setMode(res.session_mode);
        setWrapSuggested(res.suggested_to_wrap_up);
        if (res.generated_report) {
          setFinished(true);
          onReportGenerated(res.generated_report);
        }
      } catch {
        setMessages(history);
        setError("BLUE can't reach the habitat server right now. Check the backend and try again.");
      } finally {
        setBusy(false);
      }
    },
    [astronautId, onReportGenerated],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setMode(null);
    setWrapSuggested(false);
    setFinished(false);
    setError(null);
    setDraft("");
  }, []);

  // Context-aware opening when the drawer is opened on a fresh session.
  useEffect(() => {
    if (open && messages.length === 0 && !busy && !error) void send([]);
  }, [open, messages.length, busy, error, send]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  const submit = () => {
    const text = draft.trim();
    if (!text || busy || finished) return;
    setDraft("");
    void send([...messages, { role: "user", content: text }]);
  };

  const userTurns = messages.filter((m) => m.role === "user").length;
  const first = astronautName.split(" ")[1] ?? astronautName;

  return (
    <>
      {/* Floating action button — the only way to start a BLUE session (no wake word). */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-center gap-1">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Talk to Blue"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#0284C7] to-[#38BDF8] text-white shadow-lg shadow-sky/30 ring-4 ring-white transition hover:scale-105 focus:outline-none focus-visible:ring-tint-strong"
        >
          {open ? <X className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
        </button>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-sky shadow-card">
          Talk to Blue
        </span>
      </div>

      {/* Drawer */}
      <div
        className={`fixed inset-0 z-30 bg-ink/10 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setOpen(false)}
      />
      <aside
        aria-hidden={!open}
        className={`fixed bottom-28 right-6 z-40 flex h-[min(640px,calc(100vh-9rem))] w-[420px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl transition-all duration-300 ${
          open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        <header className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-tint to-white px-4 py-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#0284C7] to-[#38BDF8] text-sm font-bold text-white">
            B
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-nominal" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">BLUE · Aerospace Psychologist</p>
            <p className="text-[11px] text-ink-soft">Private session with {astronautName} · text mode</p>
          </div>
          {mode && (
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold tracking-wide text-sky ring-1 ring-tint-strong">
              {mode === "DEEP_SUPPORT" ? "DEEP SUPPORT" : "BRIEF CHECK-IN"}
            </span>
          )}
        </header>

        <div ref={scrollRef} className="thin-scroll flex-1 space-y-3 overflow-y-auto bg-canvas/60 px-4 py-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <p
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "rounded-br-sm bg-sky text-white"
                    : "rounded-bl-sm border border-line bg-white text-ink"
                }`}
              >
                {m.content}
              </p>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <span className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-line bg-white px-3.5 py-3">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-light"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </span>
            </div>
          )}
          {error && (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-urgent">
              {error}{" "}
              <button
                className="font-semibold underline"
                onClick={() => {
                  setError(null);
                  if (messages.length) void send(messages);
                }}
              >
                Retry
              </button>
            </div>
          )}
          {finished && (
            <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-nominal">
              Report filed and queued for Earth — it is now at the top of your Mental Health Reports.
            </div>
          )}
        </div>

        <footer className="space-y-2 border-t border-line bg-white px-3 py-3">
          {finished ? (
            <button
              onClick={reset}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-sky px-3 py-2 text-sm font-semibold text-sky hover:bg-tint"
            >
              <RotateCcw className="h-4 w-4" /> Start a new session
            </button>
          ) : (
            <>
              <button
                onClick={() => void send(messages, true)}
                disabled={busy || userTurns === 0}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  wrapSuggested
                    ? "bg-sky text-white shadow hover:bg-sky-hover"
                    : "border border-line text-ink-soft hover:border-tint-strong hover:text-sky"
                }`}
              >
                {busy && wrapSuggested ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                End Session & Generate Earth Report
              </button>
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder={`Reply to BLUE, ${first}…`}
                  className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-soft/70 focus:border-sky focus:ring-2 focus:ring-tint"
                />
                <button
                  onClick={submit}
                  disabled={busy || !draft.trim()}
                  aria-label="Send"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky text-white transition hover:bg-sky-hover disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </footer>
      </aside>
    </>
  );
}
