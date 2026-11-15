"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { homeFor } from "@/lib/session";
import BlueOctopus from "@/components/BlueOctopus";

// Opt-in for hackathon demos only: lists the public demo accounts on the login screen.
const SHOW_DEMO_ACCOUNTS = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "1";
const DEMO_ACCOUNTS = [
  ["vance", "blue-vance-2035", "Commander"],
  ["chen", "blue-chen-2035", "Flight Engineer"],
  ["lin", "blue-lin-2035", "Mission Specialist"],
  ["surgeon", "blue-surgeon-2035", "Flight Surgeon"],
];

/*
 * 16:9 scaling. On landscape screens the login composition is laid out on a
 * 1600×900 design stage and scaled as one block to fit the window (like a
 * slide), whatever the resolution or browser zoom: nothing is cut off and the
 * page never scrolls. The stage stretches to the window's own aspect ratio, so
 * the composition stays centred. Phones and portrait windows keep the normal
 * responsive layout.
 */
const DESIGN_W = 1600;
const DESIGN_H = 900;
/** Stage height (design px) around the centre column: paddings. */
const STAGE_CHROME = 170;
const MAX_SCALE = 2;

interface Stage {
  scale: number;
  width: number;
  height: number;
}

function isLandscape(): boolean {
  return window.innerWidth >= 768 && window.innerWidth > window.innerHeight;
}

export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const envelope = useRef<HTMLDivElement>(null);
  const column = useRef<HTMLDivElement>(null);
  const [landscape, setLandscape] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);

  // Already signed in? Go straight to the right home screen.
  useEffect(() => {
    api
      .me()
      .then((u) => router.replace(homeFor(u)))
      .catch(() => setChecking(false));
  }, [router]);

  // Layout effects run before paint, so the page appears already at the right scale.
  useLayoutEffect(() => {
    const update = () => setLandscape(isLandscape());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useLayoutEffect(() => {
    const env = envelope.current;
    const col = column.current;
    if (checking || !landscape || !env || !col) {
      setStage(null);
      return;
    }
    const measure = () => {
      const w = env.clientWidth;
      const h = env.clientHeight;
      // The column's own height is unaffected by the transform; error messages or the
      // demo-accounts list can make it taller, and the scale follows.
      const needed = Math.max(DESIGN_H, col.offsetHeight + STAGE_CHROME);
      const scale = Math.min(w / DESIGN_W, h / needed, MAX_SCALE);
      setStage({ scale, width: w / scale, height: h / scale });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(env);
    observer.observe(col);
    return () => observer.disconnect();
  }, [checking, landscape]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const user = await api.login(username.trim(), password);
      router.replace(homeFor(user));
    } catch (err) {
      setPassword("");
      if (err instanceof ApiError && (err.status === 401 || err.status === 429)) setError(err.message);
      else setError("Cannot reach the BLUE server. Is the backend running?");
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sky" role="status">
        <Loader2 className="h-6 w-6 animate-spin" aria-label="Checking session" />
      </div>
    );
  }

  const field = "field mt-1.5 h-12 px-4 text-[15px]";

  return (
    // The blue wave fills the page; the panel above it is liquid glass (globals.css).
    <main className={`login-backdrop ${landscape ? "h-dvh overflow-hidden p-5" : "flex min-h-screen flex-col p-3 sm:p-5"}`}>
      <div
        ref={envelope}
        className={`liquid-glass ${landscape ? "h-full" : "flex flex-1 flex-col px-4 pb-8 pt-4 sm:px-8 sm:pb-12 sm:pt-6"}`}
      >

        <div
          className={landscape ? `absolute left-0 top-0 flex flex-col px-12 py-10 ${stage ? "" : "invisible"}` : "contents"}
          style={
            landscape && stage
              ? { width: stage.width, height: stage.height, transform: `scale(${stage.scale})`, transformOrigin: "0 0" }
              : undefined
          }
        >
          <div className="relative flex flex-1 flex-col items-center justify-center py-8 sm:py-10">
            <div ref={column} className="flex w-full flex-col items-center">
              <p
                aria-hidden
                className={`flex flex-wrap items-center justify-center gap-x-3 text-center font-display font-light leading-[1.05] tracking-[-0.03em] text-white [text-shadow:0_2px_14px_rgb(10_40_120/0.35)] ${
                  landscape ? "mb-10 text-[76px]" : "mb-8 text-[40px] sm:mb-10 sm:text-[64px] lg:text-[76px]"
                }`}
              >
                <span>BLUE</span>
                {/* BLUE, the crew's companion, in place of a static logo. */}
                {/* Soft static shadow (a gradient, not a CSS filter: a filter would be recomputed on every
                    frame of the octopus animation). */}
                <span className="relative inline-flex">
                  <span className="pointer-events-none absolute inset-x-[6%] -bottom-[6%] h-[42%] rounded-full bg-[radial-gradient(closest-side,rgb(2_20_60/0.38),rgb(2_20_60/0))]" />
                  <span className="relative inline-flex">
                    <BlueOctopus mood="idle" size={landscape ? 120 : 76} />
                  </span>
                </span>
                <span>Crew Health</span>
              </p>

              <div className="w-full max-w-[420px] rounded-[28px] border border-white/60 bg-white p-6 shadow-[0_16px_36px_rgb(0_32_72/0.25)] sm:p-8">
                <div className="mb-6">
                  <h1 className="text-[28px] font-normal leading-tight tracking-[-0.02em] text-ink">Sign in</h1>
                </div>

                <form onSubmit={submit} className="space-y-4" noValidate>
                  <label className="block">
                    <span className="text-[13px] font-medium text-ink">Username</span>
                    <input
                      autoFocus
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={`num ${field}`}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[13px] font-medium text-ink">Password</span>
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={field}
                    />
                  </label>

                  {error && (
                    <p role="alert" className="rounded-[14px] bg-urgent-soft px-3.5 py-2.5 text-[13px] text-urgent ring-1 ring-inset ring-urgent-line">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={busy || !username.trim() || !password}
                    className="btn-cta mt-2 h-[52px] w-full pl-6 pr-2 text-[15px]"
                  >
                    Sign in
                    <span className="cta-disc h-9 w-9">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
                    </span>
                  </button>
                </form>

                <p className="mt-5 flex items-start gap-2.5 border-t border-line pt-5 text-[13px] leading-relaxed text-ink-soft">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-nominal" aria-hidden />
                  Your health data is private. Astronauts see only their own records. The flight surgeon sees physical
                  data, never your conversations with BLUE or mental-health reports.
                </p>

                {SHOW_DEMO_ACCOUNTS && (
                  <details className="mt-4 rounded-[16px] border border-dashed border-line-strong bg-raised/60 px-4 py-3 text-[13px] text-ink-soft">
                    <summary className="cursor-pointer font-semibold text-sky">Demo accounts</summary>
                    <ul className="mt-2 space-y-1">
                      {DEMO_ACCOUNTS.map(([u, p, role]) => (
                        <li key={u}>
                          <button
                            type="button"
                            className="hover:text-sky"
                            onClick={() => {
                              setUsername(u);
                              setPassword(p);
                            }}
                          >
                            <code className="num font-semibold text-ink">{u}</code> · {role}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
