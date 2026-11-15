"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { AstronautProfile, MetricDefinition, MetricHistory } from "@/types/blue";
import { defaultRange, metricHref, metricValue } from "@/lib/metrics";
import { api } from "@/lib/api";
import Sparkline from "./Sparkline";

const OVERVIEW_METRICS = ["heart_rate", "radiation_rate", "sleep_duration"];

interface Props {
  profile: AstronautProfile;
  catalog: MetricDefinition[];
  asSurgeon: boolean;
}

function MetricPreview({ metric, profile, asSurgeon }: Omit<Props, "catalog"> & { metric: MetricDefinition }) {
  const [history, setHistory] = useState<MetricHistory | null | undefined>();
  const range = defaultRange(metric);
  const key = metric.key;
  const astronautId = profile.id;

  useEffect(() => {
    let cancelled = false;
    api.metricHistory(astronautId, key, range).then(
      (result) => { if (!cancelled) setHistory(result); },
      () => { if (!cancelled) setHistory(null); },
    );
    return () => { cancelled = true; };
  }, [astronautId, key, range]);

  const chart = history?.stats[0]?.last != null ? history : null;

  return (
    <li className="border-t border-line first:border-t-0">
      <Link
        href={metricHref(key, astronautId, asSurgeon)}
        className="group block rounded-xl px-2 py-2 transition-colors hover:bg-raised focus-visible:bg-raised"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <h3 className="text-[13px] font-medium text-ink">{metric.label}</h3>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="num text-[13px] font-semibold text-ink">
              {metricValue(metric, profile.current_vitals)} <span className="text-[10px] font-medium text-ink-soft">{metric.unit}</span>
            </span>
            <ChevronRight className="size-3.5 text-ink-faint transition-colors group-hover:text-sky" aria-hidden />
          </div>
        </div>
        <div className="mt-1">
          {chart ? (
            <Sparkline history={chart} height={32} />
          ) : (
            <p className="flex h-[49px] items-center text-xs text-ink-soft" role="status">
              {history === undefined ? "Loading trend…" : history === null ? "Trend unavailable" : "No readings in this period"}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}

/** The same history and default date range used by each metric's detail chart. */
export default function VitalsPanel({ profile, catalog, asSurgeon }: Props) {
  const rows = OVERVIEW_METRICS.flatMap((key) => catalog.find((metric) => metric.key === key) ?? []);

  return (
    <section aria-labelledby="readings-title" className="card">
      <header className="px-5 pb-1 pt-4">
        <h2 id="readings-title" className="text-[17px] font-medium text-ink">Health at a glance</h2>
      </header>
      <ul className="px-3 pb-2">
        {rows.map((metric) => (
          <MetricPreview
            key={profile.id + ":" + metric.key + ":" + defaultRange(metric)}
            metric={metric}
            profile={profile}
            asSurgeon={asSurgeon}
          />
        ))}
      </ul>
    </section>
  );
}
