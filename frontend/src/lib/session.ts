"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AstronautId, SessionUser } from "@/types/blue";
import { ApiError, api, isAstronautId } from "./api";

/** Load the signed-in user; send anyone without a session back to the login screen. */
export function useRequireUser() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .me()
      .then(setUser)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace("/");
        else setError("Cannot reach the BLUE server. Is the backend running?");
      });
  }, [router]);

  useEffect(load, [load]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      router.replace("/");
    }
  }, [router]);

  return { user, error, retry: load, logout };
}

/**
 * Which astronaut a page is about: astronauts always see themselves (the URL is
 * ignored); flight surgeons pick a crew member with ?id=.
 */
export function useTargetAstronaut(user: SessionUser | null): AstronautId | null {
  const params = useSearchParams();
  if (!user) return null;
  if (user.role === "astronaut") return user.astronaut_id;
  const id = params.get("id");
  return isAstronautId(id) ? id : null;
}

export function homeFor(user: SessionUser): string {
  return user.role === "flight_surgeon" ? "/crew" : "/dashboard";
}
