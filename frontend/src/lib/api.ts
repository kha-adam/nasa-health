import type { AstronautId, AstronautProfile, ChatRequest, ChatResponse, MentalHealthReport } from "@/types/blue";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init?.timeoutMs ?? 8000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new ApiError(res.status, body || res.statusText);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  listAstronauts: () => request<AstronautProfile[]>("/api/astronauts"),
  getAstronaut: (id: AstronautId) => request<AstronautProfile>(`/api/astronauts/${id}`),
  chat: (body: ChatRequest) => request<ChatResponse>("/api/chat", { method: "POST", body: JSON.stringify(body) }),
  simulateEarthReply: (id: AstronautId, reportId: string) =>
    request<MentalHealthReport>(`/api/astronauts/${id}/reports/${reportId}/earth-reply`, { method: "POST" }),
};

export const ASTRONAUT_IDS: AstronautId[] = ["astro-vance", "astro-chen", "astro-lin"];

export function isAstronautId(value: string | null): value is AstronautId {
  return value !== null && (ASTRONAUT_IDS as string[]).includes(value);
}
