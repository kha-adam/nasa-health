import { Loader2, RefreshCw, WifiOff } from "lucide-react";

/** Full-page error with a retry button. */
export function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card flex max-w-md flex-col items-center gap-4 p-6 text-center">
        <WifiOff className="h-6 w-6 text-advisory" aria-hidden />
        <div>
          <p className="eyebrow">Connection</p>
          <p className="mt-1 text-sm text-ink">{message}</p>
        </div>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-[4px] bg-sky px-4 py-2 text-sm font-semibold text-rail transition hover:bg-sky-hover"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    </div>
  );
}

/** Full-page loading state. */
export function FullScreenLoader({ label = "Receiving telemetry…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sky" role="status">
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      <span className="eyebrow">{label}</span>
    </div>
  );
}

/** Inline placeholder for a panel that is still loading. */
export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-[4px] bg-raised" />
      ))}
    </div>
  );
}
