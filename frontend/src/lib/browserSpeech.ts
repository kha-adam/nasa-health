/** One microphone owner. An abort request is NOT proof of release: only onend is. */
export interface RecognitionEvent {
  resultIndex: number;
  results: { length: number; [i: number]: { isFinal: boolean; length?: number; [i: number]: { transcript: string } } };
}
export interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives?: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
export type RecognitionConstructor = new () => Recognition;
export function recognitionConstructor(): RecognitionConstructor | undefined {
  const w = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}
interface Callbacks {
  result: (event: RecognitionEvent) => void;
  error: (error: string) => void;
  end: (stopped: boolean) => void;
}
interface Slot {
  client: symbol; rec: Recognition; stopped: boolean;
  ended: Promise<boolean>; resolve: (released: boolean) => void;
}
export class BrowserSpeech {
  private slot: Slot | null = null;
  private request = 0;
  private create: () => RecognitionConstructor | undefined;
  private releaseTimeout: number;
  constructor(create = recognitionConstructor, releaseTimeout = 2000) {
    this.create = create; this.releaseTimeout = releaseTimeout;
  }
  async start(client: symbol, continuous: boolean, callbacks: Callbacks, allowed: () => boolean): Promise<Recognition | null> {
    const request = ++this.request;
    if (this.slot && !await this.release()) {
      callbacks.error("release-timeout"); return null;
    }
    if (request !== this.request || !allowed()) return null;
    const Constructor = this.create();
    if (!Constructor) { callbacks.error("unsupported"); return null; }
    const rec = new Constructor();
    let resolve!: (released: boolean) => void;
    const ended = new Promise<boolean>(done => { resolve = done; });
    const slot: Slot = { client, rec, stopped: false, ended, resolve };
    this.slot = slot;
    rec.lang = continuous ? "en-US" : navigator.language || "en-US";
    rec.continuous = continuous; rec.interimResults = true; rec.maxAlternatives = 3;
    rec.onresult = event => { if (this.slot === slot && !slot.stopped && allowed()) callbacks.result(event); };
    rec.onerror = event => { if (this.slot === slot && !slot.stopped) callbacks.error(event.error); };
    rec.onend = () => {
      if (this.slot !== slot) return;
      this.slot = null; slot.resolve(true);
      rec.onresult = rec.onerror = rec.onend = null;
      callbacks.end(slot.stopped);
    };
    try { rec.start(); return rec; }
    catch {
      this.slot = null; slot.resolve(true);
      callbacks.error("start-failed"); return null;
    }
  }
  async release(client?: symbol): Promise<boolean> {
    const slot = this.slot;
    if (!slot || (client && slot.client !== client)) return true;
    if (!slot.stopped) {
      slot.stopped = true;
      try { slot.rec.abort(); } catch { /* Keep waiting for confirmed release. */ }
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([slot.ended, new Promise<boolean>(done => { timer = setTimeout(() => done(false), this.releaseTimeout); })]);
    } finally { clearTimeout(timer); }
  }
}
export const browserSpeech = new BrowserSpeech();

/** Whole words only; punctuation between the two words is harmless. */
export function isWakePhrase(text: string): boolean {
  return /(?<![\p{L}\p{N}_])hey[\s,!.?;:—-]+(?:bleu|blue)(?![\p{L}\p{N}_])/iu.test(text);
}

export class WakeListener {
  private speech: BrowserSpeech;
  private client: symbol;
  private allowed: () => boolean;
  private activate: () => void;
  private notice: (text: string) => void;
  private enabled = false;
  private blocked = false;
  private disposed = false;
  private failures = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private fallback: (() => void) | undefined;
  constructor(speech: BrowserSpeech, client: symbol, allowed: () => boolean, activate: () => void, notice: (text: string) => void, fallback?: () => void) {
    this.speech = speech; this.client = client; this.allowed = allowed; this.activate = activate; this.notice = notice; this.fallback = fallback;
  }
  block(text: string, fallback = false) { this.blocked = true; this.enabled = false; clearTimeout(this.timer); this.notice(text); void this.speech.release(this.client); if (fallback) this.fallback?.(); }
  resume() {
    if (this.disposed || this.blocked || this.enabled || !this.allowed()) return;
    this.enabled = true; void this.listen();
  }
  async pause(): Promise<boolean> {
    this.enabled = false; clearTimeout(this.timer);
    return this.speech.release(this.client);
  }
  dispose() { this.disposed = true; void this.pause(); }
  private retry() {
    if (!this.enabled || this.blocked || this.disposed || !this.allowed()) return;
    this.timer = setTimeout(() => void this.listen(), this.failures ? 400 * 2 ** this.failures : 250);
  }
  private async listen() {
    if (!this.enabled || this.blocked || this.disposed || !this.allowed()) return;
    let failure = false;
    const started = Date.now();
    const rec = await this.speech.start(this.client, true, {
      result: event => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          for (let j = 0; j < (result.length || 1); j++) {
            if (isWakePhrase(result[j].transcript)) {
              // Latch before opening: interim/final duplicates cannot activate twice.
              this.enabled = false; clearTimeout(this.timer); this.activate(); return;
            }
          }
        }
      },
      error: error => {
        if (["not-allowed", "service-not-allowed", "audio-capture", "unsupported", "release-timeout"].includes(error)) {
          this.block(error === "unsupported" ? "Wake-word listening isn’t supported in this browser. You can still use the dot and text input." : error === "release-timeout" ? "The microphone hasn’t released. Please close other voice apps or reload; text chat is available." : "Wake-word listening is off because microphone access is unavailable. You can still click the dot and type.", error === "unsupported");
          return;
        }
        if (error !== "no-speech" && error !== "aborted") { failure = true; this.failures++; }
        if (this.failures >= 3) this.block("Wake-word listening stopped after repeated speech-service failures. Click the dot to chat or reload to try again.", true);
      },
      end: stopped => {
        if (!stopped && !failure && Date.now() - started < 1000) this.failures++;
        if (this.failures >= 3) this.block("Wake-word listening stopped after repeated speech-service failures. Click the dot to chat or reload to try again.", true);
        else this.retry();
      },
    }, () => this.enabled && !this.blocked && !this.disposed && this.allowed());
    if (!rec && this.enabled && !this.blocked) this.retry();
  }
}
