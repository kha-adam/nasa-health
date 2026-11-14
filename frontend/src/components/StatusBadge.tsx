import type { StatusTag } from "@/types/blue";
import { STATUS_STYLES } from "@/lib/metrics";

export default function StatusBadge({ status, className = "" }: { status: StatusTag; className?: string }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ${s.bg} ${s.text} ${s.ring} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.hex }} />
      {status}
    </span>
  );
}
