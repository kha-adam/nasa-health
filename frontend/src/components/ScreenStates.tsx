import { Loader2, RefreshCw, WifiOff } from "lucide-react";
import BlueOctopus from "./BlueOctopus";

/** Full-page error with a retry button. */
export function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card flex max-w-md flex-col items-center gap-4 px-8 py-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-advisory-soft ring-1 ring-inset ring-advisory-line">
          <WifiOff className="h-5 w-5 text-advisory" aria-hidden />
        </span>
        <div>
          <p className="eyebrow">Connection</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{message}</p>
        </div>
        <button onClick={onRetry} className="btn-cta py-1.5 pl-5 pr-1.5 text-sm">
          Retry
          <span className="cta-disc">
            <RefreshCw className="h-3.5 w-3.5" />
          </span>
        </button>
      </div>
    </div>
  );
}

/** Full-page loading state. */
export function FullScreenLoader({ label = "Receiving telemetry…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-sky" role="status">
      {/* Animated BLUE while the page loads (no CSS filter: it would be recomputed every frame). */}
      <span aria-hidden className="inline-flex">
        <BlueOctopus mood="idle" size={96} />
      </span>
      <span className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span className="eyebrow">{label}</span>
      </span>
    </div>
  );
}

/** Inline placeholder for a panel that is still loading. */
export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-[14px] bg-raised" />
      ))}
    </div>
  );
}
