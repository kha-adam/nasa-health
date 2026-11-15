"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import type { AstronautProfile, MetricDefinition, MetricHistory } from "@/types/blue";
import { api } from "@/lib/api";
import { PRIMARY_METRICS, STATUS_STYLES, formatNumber, metricValue, metricSource, SOURCE_LABELS } from "@/lib/metrics";

interface Props {
  open: boolean;
  onClose: () => void;
  profile: AstronautProfile;
  catalog: MetricDefinition[];
  asSurgeon: boolean;
}

type Section = "readings" | "observations" | "events" | "reports";

const PERIODS = [
  { key: "7d", label: "Week", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
] as const;

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Weekly export, built in the browser from data this account may already see (the flight
 * surgeon's profile arrives redacted, so mental data can't leak into their export).
 * Nothing is stored; the file goes straight to the user's downloads.
 */
export default function ExportDialog({ open, onClose, profile, catalog, asSurgeon }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("7d");
  const [include, setInclude] = useState<Record<Section, boolean>>({
    readings: true,
    observations: true,
    events: true,
    reports: !asSurgeon,
  });
  const [metrics, setMetrics] = useState<Set<string>>(
    () => new Set([...PRIMARY_METRICS.physical, ...PRIMARY_METRICS.mental]),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const available = catalog.filter((m) => m.category !== "environment" || m.key === "cabin_co2");
  const sections: { key: Section; label: string; hint: string }[] = [
    { key: "readings", label: "Measurements", hint: "Latest value + period low / average / high" },
    { key: "observations", label: "Observations", hint: "Computed findings with their source" },
    { key: "events", label: "Mission events", hint: "Episodes and habitat changes" },
    ...(asSurgeon
      ? []
      : [{ key: "reports" as const, label: "Report summaries", hint: "Headlines and Earth replies (private)" }]),
  ];

  const build = async () => {
    setBusy(true);
    setError(null);
    try {
      const days = PERIODS.find((p) => p.key === period)!.days;
      const from = profile.mission_day - days + 1;
      const chosen = available.filter((m) => metrics.has(m.key));
      const histories = include.readings
        ? await Promise.allSettled(chosen.map((m) => api.metricHistory(profile.id, m.key, period)))
        : [];

      const lines: string[] = [
        `# Crew health export — ${profile.name}`,
        "",
        `${profile.role} · ${profile.id} · Mission days ${from}–${profile.mission_day} · status ${
          STATUS_STYLES[profile.status_tag].label
        }`,
        `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC from BLUE / Crew Health.`,
        "",
        `> ${profile.status_summary}`,
      ];

      if (include.readings) {
        lines.push("", "## Measurements", "", "| Metric | Latest | Low | Avg | High | In range | Source |", "|---|---|---|---|---|---|---|");
        chosen.forEach((m, i) => {
          const r = histories[i];
          const st = r?.status === "fulfilled" ? (r.value as MetricHistory).stats[0] : null;
          const src = metricSource(m.key);
          const f = (v: number | null | undefined) => formatNumber(v, m.decimals);
          lines.push(
            `| ${m.label}${m.series.length > 1 ? ` — ${m.series[0].label.toLowerCase()} range` : ""} (${m.unit}) | ${metricValue(m, profile.current_vitals)} | ${f(st?.min)} | ${f(st?.avg)} | ${f(
              st?.max,
            )} | ${st?.pct_nominal == null ? "—" : `${formatNumber(st.pct_nominal)} %`} | ${SOURCE_LABELS[src.kind]} · ${
              src.origin
            } |`,
          );
        });
      }

      if (include.observations) {
        const obs = [...profile.body_highlights.physical, ...profile.body_highlights.mental];
        lines.push("", "## Observations (computed)", "");
        if (!obs.length) lines.push("None.");
        obs.forEach((h) => lines.push(`- **${STATUS_STYLES[h.severity].label}** — ${h.label}. ${h.detail}`));
      }

      if (include.events) {
        const ev = profile.events.filter((e) => e.mission_day >= from);
        lines.push("", "## Mission events", "");
        if (!ev.length) lines.push("None in this period.");
        ev.forEach((e) =>
          lines.push(`- Day ${e.mission_day} · ${e.scope === "cabin" ? "cabin" : "personal"} · ${e.label}. ${e.detail}`),
        );
      }

      if (include.reports && !asSurgeon) {
        lines.push("", "## Report summaries (self-reported, private)", "");
        if (!profile.mental_reports.length) lines.push("None.");
        profile.mental_reports.forEach((r) => {
          lines.push(`- ${r.created_at} — **${r.headline}** (${r.earth_status === "REVIEWED_BY_EARTH" ? "Earth replied" : "queued for Earth"})`);
          if (r.earth_psychologist_directive) lines.push(`  - Earth: ${r.earth_psychologist_directive}`);
        });
      }

      download(`blue-${profile.id}-days-${from}-${profile.mission_day}.md`, lines.join("\n") + "\n");
      onClose();
    } catch {
      setError("The export could not be built. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const toggleMetric = (key: string) =>
    setMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="export-title"
      className="m-auto max-h-[calc(100dvh-32px)] w-[min(580px,calc(100vw-24px))] overflow-hidden rounded-[28px] border border-line bg-white p-0 text-ink shadow-[var(--shadow-pop)] backdrop:bg-[rgb(12_40_90/0.28)] backdrop:backdrop-blur-[2px]"
    >
      <header className="relative flex items-start justify-between gap-3 overflow-hidden border-b border-line bg-[radial-gradient(100%_140%_at_100%_0%,#d9ecff_0%,#f4faff_45%,#ffffff_80%)] px-6 pb-4 pt-5">
        <div>
          <p className="pill">Export</p>
          <h2 id="export-title" className="mt-2.5 text-[22px] font-normal tracking-[-0.02em]">
            Report for {profile.name}
          </h2>
        </div>
        <button onClick={onClose} aria-label="Close export" className="btn-ghost h-9 w-9 shrink-0 justify-center p-0 text-ink-soft">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="thin-scroll max-h-[min(62dvh,600px)] space-y-6 overflow-y-auto px-6 py-5">
        <fieldset>
          <legend className="eyebrow">Period</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <label
                key={p.key}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                  period === p.key ? "border-sky/50 bg-tint text-ink ring-1 ring-inset ring-sky/30" : "border-line bg-white hover:bg-raised"
                }`}
              >
                <input
                  type="radio"
                  name="period"
                  className="accent-sky"
                  checked={period === p.key}
                  onChange={() => setPeriod(p.key)}
                />
                {p.label}
                <span className="num text-[11px] text-ink-faint">
                  D{profile.mission_day - p.days + 1}–{profile.mission_day}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="eyebrow">Include</legend>
          <div className="mt-2 grid gap-1">
            {sections.map((s) => (
              <label key={s.key} className="flex cursor-pointer items-start gap-3 rounded-[14px] px-3 py-2 hover:bg-raised">
                <input
                  type="checkbox"
                  className="mt-1 accent-sky"
                  checked={include[s.key]}
                  onChange={(e) => setInclude({ ...include, [s.key]: e.target.checked })}
                />
                <span>
                  <span className="block text-sm font-medium">{s.label}</span>
                  <span className="block text-[12px] text-ink-faint">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {include.readings && (
          <fieldset>
            <legend className="eyebrow">Measurements</legend>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-3">
              {available.map((m) => (
                <label key={m.key} className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2 py-1 text-[13px] text-ink-soft hover:bg-raised hover:text-ink">
                  <input type="checkbox" className="accent-sky" checked={metrics.has(m.key)} onChange={() => toggleMetric(m.key)} />
                  <span className="truncate">{m.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {error && (
          <p role="alert" className="rounded-[14px] bg-urgent-soft px-3.5 py-2 text-xs text-urgent ring-1 ring-inset ring-urgent-line">
            {error}
          </p>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-[#f7fbfe] px-6 py-4">
        <p className="text-[12px] text-ink-faint">Markdown file · stays on this device</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-ghost h-10 px-4 text-sm">
            Cancel
          </button>
          <button
            onClick={build}
            disabled={busy || (include.readings && metrics.size === 0) || !Object.values(include).some(Boolean)}
            className="btn-cta h-10 pl-4 pr-1 text-sm"
          >
            Export
            <span className="cta-disc h-8 w-8">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
            </span>
          </button>
        </div>
      </footer>
    </dialog>
  );
}
