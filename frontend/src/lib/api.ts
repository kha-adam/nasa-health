import type {
  AstronautId,
  AstronautProfile,
  ChatRequest,
  ChatResponse,
  HistoryRange,
  MentalHealthReport,
  MetricDefinition,
  MetricHistory,
  SessionUser,
} from "@/types/blue";

/**
 * All calls go to same-origin /api/* — next.config.ts proxies them to FastAPI,
 * so the httpOnly session cookie stays first-party and is never readable by JS.
 */
// Voice endpoints use the same authenticated, first-party proxy as other API calls.
export const API_BASE = "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init?.timeoutMs ?? 8000);
  try {
    const res = await fetch(path, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        detail = (await res.json()).detail ?? detail;
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(res.status, typeof detail === "string" ? detail : res.statusText);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

let catalog: Promise<MetricDefinition[]> | null = null;

export const api = {
  login: (username: string, password: string) =>
    request<SessionUser>("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => {
    catalog = null;
    return request<void>("/api/auth/logout", { method: "POST" });
  },
  me: () => request<SessionUser>("/api/auth/me"),
  metrics: () => {
    catalog ??= request<MetricDefinition[]>("/api/metrics").catch((e) => {
      catalog = null;
      throw e;
    });
    return catalog;
  },
  listAstronauts: () => request<AstronautProfile[]>("/api/astronauts"),
  getAstronaut: (id: AstronautId) => request<AstronautProfile>(`/api/astronauts/${id}`),
  metricHistory: (id: AstronautId, metric: string, range: HistoryRange) =>
    request<MetricHistory>(`/api/astronauts/${id}/metrics/${encodeURIComponent(metric)}?range=${range}`),
  chat: (body: ChatRequest) => request<ChatResponse>("/api/chat", { method: "POST", body: JSON.stringify(body) }),
  simulateEarthReply: (id: AstronautId, reportId: string) =>
    request<MentalHealthReport>(`/api/astronauts/${id}/reports/${reportId}/earth-reply`, { method: "POST" }),
};

export const ASTRONAUT_IDS: AstronautId[] = ["astro-vance", "astro-chen", "astro-lin"];

export function isAstronautId(value: string | null | undefined): value is AstronautId {
  return value != null && (ASTRONAUT_IDS as string[]).includes(value);
}
