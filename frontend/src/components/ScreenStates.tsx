import { Loader2, RefreshCw } from "lucide-react";

/** Full-page error with a retry button. */
export function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card flex max-w-md flex-col items-center gap-3 p-6 text-center">
        <p className="text-sm text-urgent">{message}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-full bg-sky px-4 py-2 text-sm font-medium text-white hover:bg-sky-hover"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    </div>
  );
}

/** Full-page spinner. */
export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sky">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}
