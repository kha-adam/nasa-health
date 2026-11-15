import { SOURCE_LABELS, type SourceKind } from "@/lib/metrics";

const STYLES: Record<SourceKind, string> = {
  sensor: "border-sky/35 bg-white text-sky",
  sample: "border-line-strong bg-white text-ink-soft",
  computed: "border-dashed border-ink-soft/50 bg-white text-ink-soft",
  declared: "border-transparent bg-tint text-sky-hover",
};

/** Provenance chip: sensor measurement, lab sample, computed observation or self-report. */
export default function SourceTag({ kind, origin }: { kind: SourceKind; origin?: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-ink-faint">
      <span
        className={`shrink-0 rounded-full border px-2 py-px text-[10.5px] font-semibold ${STYLES[kind]}`}
      >
        {SOURCE_LABELS[kind]}
      </span>
      {origin && <span className="truncate">{origin}</span>}
    </span>
  );
}
