"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Satellite, ShieldCheck } from "lucide-react";
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
      <div className="flex min-h-screen items-center justify-center text-sky">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky to-sky-light text-white shadow-card">
            <Satellite className="h-7 w-7" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky">Project BLUE</p>
          <h1 className="mt-2 text-2xl font-bold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-ink-soft">Crew health monitoring</p>
        </header>

        <form onSubmit={submit} className="card space-y-4 p-6" noValidate>
          <label className="block">
            <span className="text-xs font-medium text-ink-soft">Username</span>
            <input
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-sky focus:ring-2 focus:ring-tint"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-soft">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-sky focus:ring-2 focus:ring-tint"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-urgent">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !username.trim() || !password}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-sky px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-hover disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Sign in
          </button>
        </form>

        <p className="mt-4 flex items-start gap-2 px-1 text-xs leading-relaxed text-ink-soft">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-nominal" />
          Your health data is private. Astronauts see only their own records. The flight surgeon sees physical data,
          never your conversations with BLUE or mental-health reports.
        </p>

        {SHOW_DEMO_ACCOUNTS && (
          <details className="mt-4 rounded-xl border border-dashed border-line px-4 py-3 text-xs text-ink-soft">
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
                    <code className="font-semibold text-ink">{u}</code> · {role}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </main>
  );
}
