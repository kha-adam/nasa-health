"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { homeFor } from "@/lib/session";

// Opt-in for hackathon demos only: lists the public demo accounts on the login screen.
const SHOW_DEMO_ACCOUNTS = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "1";
const DEMO_ACCOUNTS = [
  ["vance", "blue-vance-2035", "Commander"],
  ["chen", "blue-chen-2035", "Flight Engineer"],
  ["lin", "blue-lin-2035", "Mission Specialist"],
  ["surgeon", "blue-surgeon-2035", "Flight Surgeon"],
];

export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in? Go straight to the right home screen.
  useEffect(() => {
    api
      .me()
      .then((u) => router.replace(homeFor(u)))
      .catch(() => setChecking(false));
  }, [router]);

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
    <main className="flex min-h-screen flex-col p-3 sm:p-5">
      <div
        className="envelope flex flex-1 flex-col bg-[url('/brand/fluid-wave.webp')] px-4 pb-8 pt-4 sm:px-8 sm:pb-12 sm:pt-6"
      >
        {/* Soft veil so the white type keeps its contrast over the bright parts of the wave. */}
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(24_72_170/0.55)_0%,rgb(36_91_203/0.18)_45%,rgb(10_40_120/0.35)_100%)]"
          aria-hidden
        />

        <header className="relative flex items-center gap-3">
          <p className="flex items-baseline gap-1.5 text-[15px] text-white">
            <span className="font-display font-bold tracking-[0.02em]">BLUE</span>
            <span className="text-white/60">/</span>
            <span className="font-display font-medium">Crew Health</span>
          </p>
          <p className="ml-auto hidden items-center rounded-full border border-white/35 bg-white/15 px-3.5 py-1.5 text-[12px] font-medium text-white backdrop-blur-sm sm:flex">
            Mission ASTRA · secure console
          </p>
        </header>

        <div className="relative flex flex-1 flex-col items-center justify-center py-8 sm:py-10">
          <p className="mb-4 rounded-full border border-white/35 bg-white/15 px-3.5 py-1.5 text-[13px] font-medium text-white backdrop-blur-sm">
            Crew health monitoring
          </p>
          <p
            aria-hidden
            className="mb-8 flex flex-wrap items-center justify-center gap-x-3 text-center font-display text-[40px] font-light leading-[1.05] tracking-[-0.03em] text-white sm:mb-10 sm:text-[64px] lg:text-[76px]"
          >
            <span>BLUE</span>
            {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized decorative asset */}
            <img
              src="/brand/chrome-sphere.webp"
              alt=""
              width={88}
              height={88}
              className="h-12 w-12 drop-shadow-[0_12px_20px_rgba(2,20,60,0.45)] sm:h-[72px] sm:w-[72px] lg:h-[84px] lg:w-[84px]"
            />
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
              Your health data is private. Astronauts see only their own records. The flight surgeon sees physical data,
              never your conversations with BLUE or mental-health reports.
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
    </main>
  );
}
