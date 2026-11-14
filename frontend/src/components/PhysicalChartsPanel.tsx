"use client";

import { Activity, Brain, Droplet, HeartPulse, Wind } from "lucide-react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AstronautProfile, StatusTag, VitalsHistoryPoint } from "@/types/blue";
import { STATUS_STYLES, vitalsStatuses } from "@/lib/vitals";
import type { PanelMode } from "./TopNavBar";
import StatusBadge from "./StatusBadge";

type SeriesKey = keyof Omit<VitalsHistoryPoint, "time">;

interface Props {
  profile: AstronautProfile;
  panel: PanelMode;
}

export default function PhysicalChartsPanel({ profile, panel }: Props) {
  const v = profile.current_vitals;
  const st = vitalsStatuses(v);
  const history = profile.vitals_history;
  const mental = panel === "mental";

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-sm font-semibold text-ink">Physical Telemetry</h2>
        <span className="text-[11px] text-ink-soft">
          Today {history[0]?.time}–{history[history.length - 1]?.time}
        </span>
      </div>

      <div className="thin-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        <VitalCard
          icon={<HeartPulse className="h-4 w-4" />}
          label="Heartbeat"
          value={v.heart_rate_bpm}
          unit="BPM"
          status={st.heart}
          dimmed={false}
        >
          <Sparkline data={history} dataKey="heart_rate_bpm" unit="BPM" status={st.heart} threshold={100} />
        </VitalCard>

        <VitalCard
          icon={<Droplet className="h-4 w-4" />}
          label="Blood Sugar"
          value={v.blood_sugar_mg_dl}
          unit="mg/dL"
          status={st.sugar}
          dimmed={mental}
        >
          <Sparkline data={history} dataKey="blood_sugar_mg_dl" unit="mg/dL" status={st.sugar} threshold={72} />
        </VitalCard>

        <VitalCard
          icon={<Activity className="h-4 w-4" />}
          label="Blood Pressure"
          value={`${v.systolic_bp}/${v.diastolic_bp}`}
          unit="mmHg"
          status={st.bp}
          dimmed={mental}
        >
          <RangeBar min={80} max={170} value={v.systolic_bp} bands={[95, 130, 160]} label="Systolic" status={st.bp} />
        </VitalCard>

        <VitalCard
          icon={<Wind className="h-4 w-4" />}
          label="SpO₂"
          value={v.spo2_percent}
          unit="%"
          status={st.spo2}
          dimmed={mental}
        >
          <RangeBar min={85} max={100} value={v.spo2_percent} bands={[90, 95]} label="Saturation" status={st.spo2} reversed />
        </VitalCard>

        <VitalCard
          icon={<Brain className="h-4 w-4" />}
          label="Cortisol"
          value={v.cortisol_ug_dl}
          unit="µg/dL"
          status={st.cortisol}
          dimmed={false}
          emphasized={mental}
        >
          <Sparkline data={history} dataKey="cortisol_ug_dl" unit="µg/dL" status={st.cortisol} threshold={16} />
        </VitalCard>
      </div>
    </section>
  );
}

function VitalCard({
  icon,
  label,
  value,
  unit,
  status,
  dimmed,
  emphasized = false,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  unit: string;
  status: StatusTag;
  dimmed: boolean;
  emphasized?: boolean;
  children: React.ReactNode;
}) {
  return (
    <article
      className={`card shrink-0 px-4 py-3 transition ${dimmed ? "opacity-55" : ""} ${
        emphasized ? "ring-2 ring-sky-light" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-ink-soft">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-tint text-sky">{icon}</span>
          {label}
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="mt-1 flex items-end gap-3">
        <p className="shrink-0 text-2xl font-bold leading-none text-ink">
          {value}
          <span className="ml-1 text-xs font-medium text-ink-soft">{unit}</span>
        </p>
        <div className="h-11 min-w-0 flex-1">{children}</div>
      </div>
    </article>
  );
}

function Sparkline({
  data,
  dataKey,
  unit,
  status,
  threshold,
}: {
  data: VitalsHistoryPoint[];
  dataKey: SeriesKey;
  unit: string;
  status: StatusTag;
  threshold: number;
}) {
  const color = status === "NOMINAL" ? "#0284C7" : STATUS_STYLES[status].hex;
  const gradientId = `grad-${dataKey}`;
  const values = data.map((d) => d[dataKey]);
  const lo = Math.min(...values, threshold);
  const hi = Math.max(...values, threshold);
  const pad = (hi - lo) * 0.15 || 1;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="time" hide />
        <YAxis hide domain={[lo - pad, hi + pad]} />
        <ReferenceLine y={threshold} stroke="#BAE6FD" strokeDasharray="3 3" />
        <Tooltip
          cursor={{ stroke: "#BAE6FD" }}
          contentStyle={{ borderRadius: 8, border: "1px solid #DBEAFE", fontSize: 11, padding: "4px 8px" }}
          labelStyle={{ color: "#475569" }}
          formatter={(val) => [`${val} ${unit}`, ""]}
          separator=""
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 3 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Horizontal range indicator for vitals without a time series (BP, SpO2). */
function RangeBar({
  min,
  max,
  value,
  bands,
  label,
  status,
  reversed = false,
}: {
  min: number;
  max: number;
  value: number;
  bands: number[];
  label: string;
  status: StatusTag;
  reversed?: boolean;
}) {
  const pct = (x: number) => Math.max(0, Math.min(100, ((x - min) / (max - min)) * 100));
  return (
    <div className="flex h-full flex-col justify-center gap-1">
      <div className="relative h-2 rounded-full bg-tint">
        {bands.map((b) => (
          <span key={b} className="absolute top-0 h-2 w-px bg-tint-strong" style={{ left: `${pct(b)}%` }} />
        ))}
        <span
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${pct(value)}%`, backgroundColor: STATUS_STYLES[status].hex }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-ink-soft">
        <span>{reversed ? "Low" : label}</span>
        <span>{reversed ? label : "High"}</span>
      </div>
    </div>
  );
}
