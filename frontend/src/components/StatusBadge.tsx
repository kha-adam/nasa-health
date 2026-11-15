import type { StatusTag } from "@/types/blue";
import { STATUS_STYLES } from "@/lib/metrics";

/**
 * Shape + colour + word, so status never relies on colour alone:
 * Normal = circle, Watch = triangle, Urgent = diamond.
 */
export function StatusGlyph({ status, size = 8 }: { status: StatusTag; size?: number }) {
  const fill = STATUS_STYLES[status].hex;
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden className="shrink-0">
      {status === "NOMINAL" && <circle cx="5" cy="5" r="4" fill={fill} />}
      {status === "ADVISORY" && <path d="M5 0.8 9.4 9H0.6Z" fill={fill} />}
      {status === "URGENT" && <path d="M5 0.3 9.7 5 5 9.7 0.3 5Z" fill={fill} />}
    </svg>
  );
}

export default function StatusBadge({
  status,
  className = "",
  quiet = false,
}: {
  status: StatusTag;
  className?: string;
  /** Text-only variant for dense lists. */
  quiet?: boolean;
}) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 text-[12px] font-semibold leading-none ${s.text} ${
        quiet ? "" : `rounded-full px-2.5 py-1 ring-1 ring-inset ${s.bg} ${s.ring}`
      } ${className}`}
    >
      <StatusGlyph status={status} />
      {s.label}
    </span>
  );
}
