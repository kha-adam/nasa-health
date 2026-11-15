import { SOURCE_LABELS, type SourceKind } from "@/lib/metrics";

const STYLES: Record<SourceKind, string> = {
  sensor: "border-sky/45 text-sky",
  sample: "border-ink-soft/50 text-ink-soft",
  computed: "border-dashed border-ink-soft/60 text-ink-soft",
  declared: "border-transparent bg-tint text-ink",
};

/** Provenance chip: sensor measurement, lab sample, computed observation or self-report. */
export default function SourceTag({ kind, origin }: { kind: SourceKind; origin?: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-ink-faint">
      <span
        className={`num shrink-0 rounded-[2px] border px-1 py-px text-[9.5px] font-medium uppercase tracking-wider ${STYLES[kind]}`}
      >
        {SOURCE_LABELS[kind]}
      </span>
      {origin && <span className="truncate">{origin}</span>}
    </span>
  );
}
