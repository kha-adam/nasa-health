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

  const field =
    "mt-1.5 w-full rounded-[4px] border border-line bg-raised px-3 py-2.5 text-sm text-ink outline-none transition focus:border-sky focus:ring-2 focus:ring-sky/25";

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex h-12 items-center border-b border-line bg-rail px-5">
        <p className="flex items-baseline gap-1.5 text-sm">
          <span className="num font-semibold tracking-wide text-ink">BLUE</span>
          <span className="text-ink-faint">/</span>
          <span className="font-medium text-ink-soft">Crew Health</span>
        </p>
        <p className="num ml-auto hidden text-[12px] text-ink-faint sm:block">Mission ASTRA · secure console</p>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6">
            <div className="num mb-5 flex h-10 w-10 items-center justify-center rounded-[4px] bg-nasa text-base font-bold text-white ring-1 ring-sky/40">
              B
            </div>
            <p className="eyebrow">Crew health monitoring</p>
            <h1 className="mt-1 text-2xl font-semibold text-ink">Sign in</h1>
          </div>

          <form onSubmit={submit} className="card space-y-4 p-6" noValidate>
            <label className="block">
              <span className="text-xs font-medium text-ink-soft">Username</span>
              <input
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`num ${field}`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-ink-soft">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={field}
              />
            </label>

            {error && (
              <p role="alert" className="rounded-[4px] bg-urgent/10 px-3 py-2 text-xs text-urgent">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || !username.trim() || !password}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[4px] bg-sky px-4 py-2.5 text-sm font-semibold text-rail transition hover:bg-sky-hover disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
              Sign in
            </button>
          </form>

          <p className="mt-4 flex items-start gap-2 px-1 text-xs leading-relaxed text-ink-faint">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-nominal" aria-hidden />
            Your health data is private. Astronauts see only their own records. The flight surgeon sees physical data,
            never your conversations with BLUE or mental-health reports.
          </p>

          {SHOW_DEMO_ACCOUNTS && (
            <details className="mt-4 rounded-[4px] border border-dashed border-line-strong px-4 py-3 text-xs text-ink-soft">
              <summary className="cursor-pointer font-medium text-sky">Demo accounts</summary>
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
    </main>
  );
}
