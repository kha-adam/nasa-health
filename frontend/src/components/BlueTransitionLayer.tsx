"use client";

/*
 * BLUE login/logout transitions (see lib/blueTransitions.ts for every timing and size).
 *
 * Mounted once in the root layout, above the router, so it survives the route change and
 * the unmount of the dashboard. It owns:
 *   - the travelling actor: the transparent clip (<video>) moved and scaled by the page,
 *     plus a live copy of the original BlueOctopus ("cap") used at both ends so the first
 *     and last poses are exactly the real icon;
 *   - the veils (login wave, dashboard tone) and a live blur of the page beneath;
 *   - the fade of the login title and form (elements tagged data-blue-reveal).
 *
 * Authentication and animation are separate: the film starts only after a confirmed
 * sign-in, sign-out is sent at once and never waits for the film, and the end of a film
 * proves nothing. Any media problem, reduced motion or Escape switches to a short fade.
 * Clip time (video.currentTime, bounded by the frames really presented) drives movement,
 * veils and reveal together, so a stalled video holds everything in place.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import {
  ANCHOR_ATTR,
  REVEAL_ATTR,
  TRANSITIONS,
  TRANSITION_SETTINGS as S,
  clamp,
  cubic,
  easeInOutCubic,
  octopusBoxIn,
  pathControls,
  progress,
  track,
  videoSizeForOctopus,
  videoSizeForSphere,
  type AnchorName,
  type Point,
  type TransitionKind,
} from "@/lib/blueTransitions";
import BlueOctopus from "./BlueOctopus";

interface BlueTransitionApi {
  /** After a confirmed sign-in: plays the login film once, opening `href` under the veil. */
  login: (href: string, options: { toTalkToBlue: boolean }) => void;
  /** Hides private data at once, signs out for real and plays the logout film alongside. */
  logout: () => void;
}

const BlueTransitionContext = createContext<BlueTransitionApi | null>(null);

/** null outside the provider (callers then fall back to a plain navigation). */
export function useBlueTransition(): BlueTransitionApi | null {
  return useContext(BlueTransitionContext);
}

/** Base size of the <video> element; the actor is scaled from it with a transform. */
const BASE = 512;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Run {
  kind: TransitionKind;
  mode: "film" | "fade" | "done";
  video: HTMLVideoElement | null;
  href: string;
  fromPath: string;
  navigated: boolean;
  /** Last measured rectangle of the source icon (it may unmount after navigation). */
  source: Rect | null;
  target: AnchorName | null;
  /** No destination icon: BLUE comes back to an octopus at the centre and fades. */
  targetLost: boolean;
  waitingSince: number | null;
  lastT: number;
  lastAdvance: number;
  presented: number | null;
  /** Frame pacing guard for the live blur. */
  lastFrame: number;
  slowFrames: number;
  blurFrames: number;
  blurOff: boolean;
  auth: "pending" | "done" | "failed";
  raf: number;
  timers: number[];
}

interface Ui {
  status: string;
  recovery: boolean;
  recoveryBusy: boolean;
  announce: string;
}

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function anchorArt(name: AnchorName): Element | null {
  const host = document.querySelector(`[${ANCHOR_ATTR}="${name}"]`);
  return host ? (host.querySelector("svg") ?? host) : null;
}

/** Rectangle of the octopus image itself (not its button), in viewport coordinates. */
function measure(name: AnchorName | null): Rect | null {
  if (!name) return null;
  const art = anchorArt(name);
  if (!art) return null;
  const r = art.getBoundingClientRect();
  return r.width > 1 && r.height > 1 ? { x: r.left, y: r.top, width: r.width, height: r.height } : null;
}

const centre = (r: Rect): Point => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

function viewport() {
  const el = document.documentElement;
  return { w: el.clientWidth || window.innerWidth, h: el.clientHeight || window.innerHeight };
}

/** Restart the icon's idle animation from its rest pose: the pose the clips start and end with. */
function restartIdle(name: AnchorName) {
  const art = anchorArt(name);
  if (!art || !("getAnimations" in art)) return;
  for (const a of (art as Element & { getAnimations(o?: { subtree: boolean }): Animation[] }).getAnimations({ subtree: true })) {
    a.currentTime = 0;
  }
}

/** Does the first frame really carry transparency (corner clear, octopus opaque)? */
function alphaCheck(video: HTMLVideoElement): "yes" | "no" | "unknown" {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d", { willReadFrequently: true });
    if (!g) return "no";
    g.drawImage(video, 0, 0, 32, 32);
    const d = g.getImageData(0, 0, 32, 32).data;
    const corner = d[3];
    const middle = d[(16 * 32 + 16) * 4 + 3];
    if (middle < 8) return "unknown"; // frame not decoded yet
    return corner < 24 && middle > 200 ? "yes" : "no";
  } catch {
    return "no";
  }
}

function loadWithAlpha(video: HTMLVideoElement, src: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let tries = 0;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeEventListener("loadeddata", onData);
      video.removeEventListener("error", onError);
      resolve(ok);
    };
    const onData = () => {
      const result = alphaCheck(video);
      if (result === "unknown" && tries++ < 20) setTimeout(onData, 60);
      else finish(result === "yes");
    };
    const onError = () => finish(false);
    const timer = window.setTimeout(() => finish(false), S.probeTimeoutMs);
    video.addEventListener("loadeddata", onData);
    video.addEventListener("error", onError);
    video.preload = "auto";
    video.src = src;
    video.load();
  });
}

export default function BlueTransitionLayer({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ui, setUi] = useState<Ui>({ status: "", recovery: false, recoveryBusy: false, announce: "" });

  const page = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const blur = useRef<HTMLDivElement>(null);
  const wave = useRef<HTMLDivElement>(null);
  const tone = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const cap = useRef<HTMLDivElement>(null);
  const videos = useRef<Record<TransitionKind, HTMLVideoElement | null>>({ login: null, logout: null });
  const media = useRef<Partial<Record<TransitionKind, Promise<HTMLVideoElement | null>>>>({});
  const run = useRef<Run | null>(null);
  const recoveryButton = useRef<HTMLButtonElement>(null);

  // ------------------------------------------------------------ media
  /** Loads a clip once and checks its alpha; resolves null when no source works here. */
  const prepare = useCallback((kind: TransitionKind) => {
    const existing = media.current[kind];
    if (existing) return existing;
    const promise = (async () => {
      const video = videos.current[kind];
      if (!video) return null;
      video.muted = true;
      for (const source of TRANSITIONS[kind].media) {
        if (!video.canPlayType(source.type)) continue;
        if (await loadWithAlpha(video, source.src)) return video;
      }
      video.removeAttribute("src");
      video.load();
      return null;
    })();
    media.current[kind] = promise;
    return promise;
  }, []);

  // Preload only the clip the current screen can need, once.
  useEffect(() => {
    const kind: TransitionKind = pathname === "/" ? "login" : "logout";
    const id = window.setTimeout(() => void prepare(kind), kind === "login" ? 300 : 1500);
    return () => clearTimeout(id);
  }, [pathname, prepare]);

  // ------------------------------------------------------------ layers
  const setHidden = (tokens: AnchorName[]) => {
    const html = document.documentElement;
    if (tokens.length) html.setAttribute("data-blue-hide", tokens.join(" "));
    else html.removeAttribute("data-blue-hide");
  };

  const applyLayers = useCallback((kind: TransitionKind, t: number, allowBlur = true) => {
    const T = TRANSITIONS[kind];
    if (wave.current) wave.current.style.opacity = String(track(t, T.veil.wave));
    if (tone.current) tone.current.style.opacity = String(track(t, T.veil.app));
    if (blur.current) {
      const px = allowBlur ? track(t, T.veil.blur) : 0;
      const value = px > 0.25 ? `blur(${px.toFixed(2)}px)` : "none";
      blur.current.style.backdropFilter = value;
      blur.current.style.setProperty("-webkit-backdrop-filter", value);
    }
    if (ghost.current) ghost.current.style.opacity = kind === "logout" ? String(track(t, S.ghostFade)) : "0";
    for (const node of document.querySelectorAll<HTMLElement>(`[${REVEAL_ATTR}]`)) {
      const part = node.getAttribute(REVEAL_ATTR);
      if (part === "title") {
        node.style.opacity = String(track(t, T.reveal.title));
        const px = track(t, T.reveal.titleBlur);
        node.style.filter = px > 0.1 ? `blur(${px.toFixed(2)}px)` : "";
      }
      if (part === "form") {
        node.style.opacity = String(track(t, T.reveal.form));
        const px = track(t, T.reveal.formBlur);
        node.style.filter = px > 0.1 ? `blur(${px.toFixed(2)}px)` : "";
      }
    }
  }, []);

  const clearReveal = () => {
    for (const node of document.querySelectorAll<HTMLElement>(`[${REVEAL_ATTR}]`)) {
      node.style.opacity = "";
      node.style.filter = "";
      node.style.transition = "";
    }
  };

  const fade = (el: HTMLElement | null, opacity: number, ms: number) => {
    if (!el) return;
    el.style.transition = `opacity ${ms}ms ease`;
    el.style.opacity = String(opacity);
  };

  const hideActor = (ms = 160) => {
    const r = run.current;
    if (r?.video) fade(r.video, 0, ms);
    fade(cap.current, 0, ms);
  };

  // ------------------------------------------------------------ end of a run
  const cleanup = useCallback((announce?: string, focus?: () => void) => {
    const r = run.current;
    if (r) {
      cancelAnimationFrame(r.raf);
      r.timers.forEach(clearTimeout);
      r.mode = "done";
      if (r.video) {
        r.video.pause();
        r.video.style.cssText = "";
        r.video.hidden = true;
        try {
          r.video.currentTime = 0;
        } catch {
          /* not seekable yet */
        }
      }
    }
    run.current = null;
    setHidden([]);
    document.documentElement.removeAttribute("data-blue-transition");
    clearReveal();
    for (const el of [wave.current, tone.current, blur.current, cap.current, ghost.current]) {
      if (el) el.style.cssText = "";
    }
    ghost.current?.replaceChildren();
    if (overlay.current) overlay.current.hidden = true;
    if (page.current) page.current.inert = false;
    setUi((u) => ({ ...u, status: "", recovery: false, recoveryBusy: false, announce: announce ?? u.announce }));
    focus?.();
  }, []);

  const focusAfter = (kind: TransitionKind) => () => {
    requestAnimationFrame(() => {
      if (kind === "logout") {
        document.querySelector<HTMLInputElement>('input[autocomplete="username"]')?.focus();
        return;
      }
      // The current menu entry of the navigation actually shown (rail on desktop, chips on phones).
      const visible = (el: HTMLElement) => el.getClientRects().length > 0;
      const current =
        [...document.querySelectorAll<HTMLElement>('nav [aria-current="page"]')].find(visible) ??
        [...document.querySelectorAll<HTMLElement>("main, h1")].find(visible);
      if (current) {
        if (!current.matches("a, button, input, [tabindex]")) current.tabIndex = -1;
        current.focus({ preventScroll: true });
      }
    });
  };

  const navigate = (r: Run) => {
    if (r.navigated) return;
    r.navigated = true;
    router.replace(r.href);
  };

  /** Waits until the destination route is on screen (bounded), then calls `then`. */
  const whenRouteReady = (r: Run, then: () => void) => {
    const expected = r.href.split("?")[0];
    const started = performance.now();
    const check = () => {
      if (run.current !== r) return;
      const arrived = window.location.pathname === expected;
      if ((arrived && performance.now() - started > 60) || performance.now() - started > 2500) then();
      else r.raf = requestAnimationFrame(check);
    };
    r.raf = requestAnimationFrame(check);
  };

  /** Ends with the real icons back and the veils faded away; the page is usable after. */
  const releaseWithFade = useCallback((r: Run) => {
    if (run.current !== r) return;
    restartIdle("talk-to-blue");
    restartIdle("login-title");
    setHidden([]);
    clearReveal();
    fade(wave.current, 0, S.fadeOutMs);
    fade(tone.current, 0, S.fadeOutMs);
    if (blur.current) {
      blur.current.style.backdropFilter = "none";
      blur.current.style.setProperty("-webkit-backdrop-filter", "none");
    }
    hideActor(120);
    r.timers.push(window.setTimeout(() => cleanup(r.kind === "login" ? "Signed in." : "Signed out.", focusAfter(r.kind)), S.fadeOutMs));
  }, [cleanup]);

  /** Short, motion-free path: reduced motion, missing media, stalled playback or Escape. */
  const fadeFinish = useCallback((r: Run) => {
    if (run.current !== r || r.mode === "done") return;
    const wasFilm = r.mode === "film";
    r.mode = "fade";
    cancelAnimationFrame(r.raf);
    r.video?.pause();
    hideActor(wasFilm ? 160 : 0);
    if (!wasFilm) setHidden([]);
    if (blur.current) {
      blur.current.style.backdropFilter = "none";
      blur.current.style.setProperty("-webkit-backdrop-filter", "none");
    }
    fade(ghost.current, 0, 120);
    if (r.kind === "login") {
      if (r.navigated) {
        // The destination is already under the veils: just reveal it.
        whenRouteReady(r, () => releaseWithFade(r));
        return;
      }
      // Cover the login screen, open the destination, then reveal it.
      fade(wave.current, 1, S.fadeInMs);
      r.timers.push(
        window.setTimeout(() => {
          navigate(r);
          whenRouteReady(r, () => releaseWithFade(r));
        }, S.fadeInMs),
      );
      return;
    }
    // Logout: the private data stays covered until sign-out is confirmed.
    fade(tone.current, 1, 0);
    const proceed = () => {
      if (run.current !== r) return;
      if (r.auth === "pending") {
        setUi((u) => ({ ...u, status: "Signing out…" }));
        r.timers.push(window.setTimeout(proceed, 80));
        return;
      }
      if (r.auth === "failed") {
        setUi((u) => ({ ...u, status: "", recovery: true }));
        return;
      }
      setUi((u) => ({ ...u, status: "" }));
      navigate(r);
      whenRouteReady(r, () => releaseWithFade(r));
    };
    proceed();
  }, [releaseWithFade]);

  // Escape ends the visual part only; the sign-in or sign-out itself goes on.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const r = run.current;
      if (e.key !== "Escape" || !r || r.mode !== "film") return;
      e.preventDefault();
      e.stopPropagation();
      fadeFinish(r);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [fadeFinish]);

  // ------------------------------------------------------------ film
  const land = useCallback((r: Run) => {
    if (r.kind === "logout" && r.auth !== "done") {
      fadeFinish(r); // waits for (or reports) the real sign-out
      return;
    }
    cancelAnimationFrame(r.raf);
    navigate(r);
    // The travelling copy (identical to the icon, at its exact place) fades into the real one.
    if (r.target && !r.targetLost) restartIdle(r.target);
    setHidden([]);
    clearReveal();
    for (const el of [wave.current, tone.current]) if (el) el.style.opacity = "0";
    if (blur.current) {
      blur.current.style.backdropFilter = "none";
      blur.current.style.setProperty("-webkit-backdrop-filter", "none");
    }
    if (r.video) r.video.style.opacity = "0";
    fade(cap.current, 0, S.handoffMs);
    r.mode = "done";
    r.timers.push(window.setTimeout(() => cleanup(r.kind === "login" ? "Signed in." : "Signed out.", focusAfter(r.kind)), S.handoffMs));
  }, [cleanup, fadeFinish]);

  const frame = useCallback(() => {
    const r = run.current;
    if (!r || r.mode !== "film" || !r.video) return;
    const v = r.video;
    const T = TRANSITIONS[r.kind];
    const now = performance.now();

    // Clip time, never ahead of the frames actually presented.
    let t = v.currentTime;
    if (r.presented !== null) t = Math.min(t, r.presented + 2 / 60);
    if (v.ended) t = T.duration;
    if (t > r.lastT + 1e-4) {
      r.lastT = t;
      r.lastAdvance = now;
    } else if (r.waitingSince === null && now - r.lastAdvance > (r.lastT === 0 ? S.startTimeoutMs : S.stallTimeoutMs)) {
      fadeFinish(r);
      return;
    }

    if (r.kind === "logout" && r.auth === "failed") {
      fadeFinish(r);
      return;
    }
    if (r.kind === "login" && t >= S.loginNavigateAt) navigate(r);
    if (r.kind === "logout" && r.auth === "done" && t >= S.logoutNavigateNotBefore) navigate(r);

    // Destination: the real icon, measured on every frame (resize, zoom, late layout).
    let dst: Rect | null = null;
    if (!r.targetLost && t >= T.lookupFrom && r.navigated) dst = measure(r.target);
    if (!r.targetLost && !dst && t >= T.toTarget[0] - 0.04) {
      // Hold the sphere at the centre until the icon exists, within limits.
      if (r.waitingSince === null) {
        r.waitingSince = now;
        v.pause();
      }
      const limit = r.kind === "logout" && r.auth === "pending" ? S.logoutWaitMs : S.anchorWaitMs;
      if (now - r.waitingSince > limit) r.targetLost = true;
    }
    if (r.waitingSince !== null && (dst || r.targetLost)) {
      r.waitingSince = null;
      r.lastAdvance = now;
      void v.play().catch(() => fadeFinish(r));
    }

    // Geometry (CSS px, viewport coordinates).
    const vp = viewport();
    const mid = { x: vp.w / 2, y: vp.h / 2 };
    const sphere = clamp(Math.min(vp.w, vp.h) * S.sphere.viewportShare, S.sphere.min, S.sphere.max);
    const eMid = videoSizeForSphere(sphere);
    const live = r.navigated && r.kind === "login" ? null : measure(r.kind === "login" ? "login-title" : "talk-to-blue");
    if (live) r.source = live;
    const src = r.source;

    let pos: Point = mid;
    let size = eMid;
    let videoOpacity = 1;
    let capOpacity = 0;
    if (t < T.toCenter[1]) {
      if (src) {
        const u = easeInOutCubic(progress(t, T.toCenter));
        const a = centre(src);
        const eSrc = videoSizeForOctopus(src.width);
        const [p1, p2] = pathControls(r.kind === "logout" ? "rise" : "arc", a, mid);
        pos = cubic(a, p1, p2, mid, u);
        size = eSrc * Math.pow(eMid / eSrc, u);
      } else {
        videoOpacity = track(t, [[0, 0], [0.3, 1]]);
      }
    } else if (t >= T.toTarget[0]) {
      const u = easeInOutCubic(progress(t, T.toTarget));
      if (dst) {
        const b = centre(dst);
        const eDst = videoSizeForOctopus(dst.width);
        const [p1, p2] = pathControls(r.kind === "login" ? "descend" : "arc", mid, b);
        pos = cubic(mid, p1, p2, b, u);
        size = eMid * Math.pow(eDst / eMid, u);
      } else {
        const lost = clamp(Math.min(vp.w, vp.h) * S.lostOctopus.viewportShare, S.lostOctopus.min, S.lostOctopus.max);
        size = eMid * Math.pow(videoSizeForOctopus(lost) / eMid, u);
        videoOpacity = 1 - progress(t, [T.toTarget[0] + 0.3, T.toTarget[1]]);
      }
    }
    if (src && t < T.capToVideo[1]) capOpacity = 1 - progress(t, T.capToVideo);
    if (dst && t > T.videoToCap[0]) capOpacity = progress(t, T.videoToCap);

    v.style.opacity = String(videoOpacity);
    v.style.transform = `translate3d(${(pos.x - BASE / 2).toFixed(2)}px, ${(pos.y - BASE / 2).toFixed(2)}px, 0) scale(${(size / BASE).toFixed(5)})`;
    if (cap.current) {
      const c = cap.current.style;
      c.opacity = String(capOpacity);
      // Only lay out the live copy while it shows (start and end of the flight).
      c.visibility = capOpacity > 0 ? "" : "hidden";
      if (capOpacity > 0) {
        const box = octopusBoxIn(size);
        c.left = `${pos.x - box.width / 2}px`;
        c.top = `${pos.y - box.height / 2}px`;
        c.width = `${box.width}px`;
        c.height = `${box.height}px`;
      }
    }
    // A full-screen live blur can be too heavy for the GPU: after a few slow frames while
    // it is on, the veil alone finishes the reveal (the first blurred frame is not counted:
    // it includes the blur's set-up).
    const gap = now - r.lastFrame;
    r.lastFrame = now;
    const blurring = track(t, T.veil.blur) > 0.25;
    if (!r.blurOff && blurring && r.blurFrames++ > 0 && r.waitingSince === null) {
      if (gap > S.blurGuard.slowFrameMs) r.slowFrames++;
      if (r.slowFrames >= S.blurGuard.slowFrames) r.blurOff = true;
    }
    applyLayers(r.kind, t, !r.blurOff);

    if (t >= T.duration - 0.5 / 60) {
      land(r);
      return;
    }
    r.raf = requestAnimationFrame(frame);
  }, [applyLayers, fadeFinish, land]);

  /** Starts a run: page inert, icons swapped for the identical travelling copy, layers at t = 0. */
  const begin = useCallback((kind: TransitionKind, href: string, target: AnchorName | null): Run => {
    const r: Run = {
      kind,
      mode: "fade",
      video: null,
      href,
      fromPath: window.location.pathname,
      navigated: false,
      source: measure(kind === "login" ? "login-title" : "talk-to-blue"),
      target,
      targetLost: target === null,
      waitingSince: null,
      lastT: 0,
      lastAdvance: performance.now(),
      presented: null,
      lastFrame: performance.now(),
      slowFrames: 0,
      blurFrames: 0,
      blurOff: false,
      auth: kind === "login" ? "done" : "pending",
      raf: 0,
      timers: [],
    };
    run.current = r;
    if (page.current) page.current.inert = true;
    if (overlay.current) overlay.current.hidden = false;
    document.documentElement.setAttribute("data-blue-transition", kind);
    for (const el of [wave.current, tone.current, cap.current]) if (el) el.style.cssText = "opacity:0";
    setUi((u) => ({ ...u, status: "", recovery: false, announce: kind === "login" ? "Signing in…" : "Signing out…" }));
    return r;
  }, []);

  /** Shows the copy of the icon exactly over the source (rest pose), then hides the source. */
  const takeOffFrom = (r: Run) => {
    const src = r.source;
    if (!src || !cap.current) return;
    restartIdle(r.kind === "login" ? "login-title" : "talk-to-blue");
    const c = cap.current.style;
    c.transition = "";
    c.left = `${src.x}px`;
    c.top = `${src.y}px`;
    c.width = `${src.width}px`;
    c.height = `${src.height}px`;
    c.opacity = "1";
  };

  const startFilm = useCallback((r: Run, video: HTMLVideoElement) => {
    if (run.current !== r) return;
    r.mode = "film";
    r.video = video;
    video.hidden = false;
    video.style.transition = "";
    video.style.opacity = "0";
    try {
      video.currentTime = 0;
    } catch {
      /* fresh element */
    }
    if ("requestVideoFrameCallback" in video) {
      const onFrame: VideoFrameRequestCallback = (_now, meta) => {
        if (run.current !== r || r.mode !== "film") return;
        r.presented = meta.mediaTime;
        video.requestVideoFrameCallback(onFrame);
      };
      video.requestVideoFrameCallback(onFrame);
    }
    r.lastAdvance = performance.now();
    video.play().catch(() => fadeFinish(r));
    r.raf = requestAnimationFrame(frame);
  }, [fadeFinish, frame]);

  /** Picks film or fade once the media check is known (bounded wait). */
  const launch = useCallback((r: Run) => {
    if (reducedMotion()) {
      fadeFinish(r);
      return;
    }
    let decided = false;
    const timer = window.setTimeout(() => {
      decided = true;
      fadeFinish(r);
    }, S.prepareWaitMs);
    r.timers.push(timer);
    void prepare(r.kind).then((video) => {
      if (decided || run.current !== r) return;
      decided = true;
      clearTimeout(timer);
      if (video) startFilm(r, video);
      else fadeFinish(r);
    });
  }, [fadeFinish, prepare, startFilm]);

  // ------------------------------------------------------------ public API
  const login = useCallback<BlueTransitionApi["login"]>((href, { toTalkToBlue }) => {
    if (run.current) return; // one transition at a time
    router.prefetch(href);
    const r = begin("login", href, toTalkToBlue ? "talk-to-blue" : null);
    setHidden(["login-title", "talk-to-blue"]);
    takeOffFrom(r);
    applyLayers("login", 0);
    launch(r);
  }, [applyLayers, begin, launch, router]);

  const signOut = useCallback((r: Run) => {
    r.auth = "pending";
    api.logout().then(
      () => {
        r.auth = "done";
      },
      (e) => {
        // Already signed out on the server (expired session): that is a confirmed sign-out.
        r.auth = e instanceof ApiError && e.status === 401 ? "done" : "failed";
      },
    );
  }, []);

  const logout = useCallback<BlueTransitionApi["logout"]>(() => {
    if (run.current) return; // double click, or a transition already running
    const r = begin("logout", "/", "login-title");
    // Private data disappears in this very frame, before anything else.
    if (tone.current) tone.current.style.opacity = "1";
    const fab = document.querySelector(`[${ANCHOR_ATTR}="talk-to-blue"]`)?.closest("button");
    if (fab && r.source && ghost.current) {
      const copy = fab.cloneNode(true) as HTMLElement;
      copy.removeAttribute("id");
      copy.removeAttribute("aria-controls");
      copy.setAttribute("aria-hidden", "true");
      copy.setAttribute("tabindex", "-1");
      copy.inert = true;
      ghost.current.replaceChildren(copy);
      ghost.current.style.opacity = "1";
    }
    setHidden(["talk-to-blue", "login-title"]);
    takeOffFrom(r);
    applyLayers("logout", 0);
    signOut(r);
    launch(r);
  }, [applyLayers, begin, launch, signOut]);

  // Leaving for an unexpected page (browser back, link) aborts the visual part.
  useEffect(() => {
    const r = run.current;
    if (!r) return;
    const expected = r.href.split("?")[0];
    if (pathname !== expected && pathname !== r.fromPath) cleanup();
  }, [pathname, cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  useEffect(() => {
    if (ui.recovery) recoveryButton.current?.focus();
  }, [ui.recovery]);

  const retrySignOut = () => {
    const r = run.current;
    if (!r) return;
    setUi((u) => ({ ...u, recovery: false, status: "Signing out…" }));
    signOut(r);
    fadeFinish(r); // waits for the answer, then reveals the login screen or shows this card again
  };

  const returnToBlue = () => {
    const r = run.current;
    if (!r) return;
    setUi((u) => ({ ...u, recoveryBusy: true }));
    api
      .me()
      .then(() => cleanup("Still signed in."))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          // The session is gone after all: finish the sign-out.
          r.auth = "done";
          setUi((u) => ({ ...u, recovery: false, recoveryBusy: false }));
          navigate(r);
          whenRouteReady(r, () => releaseWithFade(r));
        } else setUi((u) => ({ ...u, recoveryBusy: false }));
      });
  };

  const value = useMemo(() => ({ login, logout }), [login, logout]);

  return (
    <BlueTransitionContext.Provider value={value}>
      <div ref={page} className="contents">
        {children}
      </div>

      <div ref={overlay} className="blue-transition" hidden>
        <div ref={blur} className="blue-transition-layer blue-transition-blur" aria-hidden />
        <div ref={wave} className="blue-transition-layer blue-transition-wave" aria-hidden />
        <div ref={tone} className="blue-transition-layer blue-transition-app" aria-hidden />
        <div ref={ghost} className="blue-transition-ghost" aria-hidden />
        {(["login", "logout"] as const).map((kind) => (
          <video
            key={kind}
            ref={(el) => {
              videos.current[kind] = el;
            }}
            className="blue-transition-actor"
            muted
            playsInline
            preload="none"
            disablePictureInPicture
            disableRemotePlayback
            aria-hidden
            tabIndex={-1}
            hidden
          />
        ))}
        <div ref={cap} className="blue-transition-cap" aria-hidden>
          <BlueOctopus mood="idle" />
        </div>
        {ui.status && (
          <p className="blue-transition-status" role="status">
            {ui.status}
          </p>
        )}
        {ui.recovery && (
          <div className="blue-transition-recovery card" role="alertdialog" aria-labelledby="blue-recovery-title" aria-describedby="blue-recovery-text">
            <p id="blue-recovery-title" className="text-[17px] font-medium text-ink">
              Sign-out not confirmed
            </p>
            <p id="blue-recovery-text" className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
              The BLUE server did not confirm the sign-out, so your session may still be open. Your health data stays
              hidden.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button ref={recoveryButton} type="button" className="btn-cta h-10 px-5 text-[14px]" onClick={retrySignOut} disabled={ui.recoveryBusy}>
                Try again
              </button>
              <button type="button" className="btn-ghost h-10 px-4 text-[14px]" onClick={returnToBlue} disabled={ui.recoveryBusy}>
                Return to BLUE
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {ui.announce}
      </p>
    </BlueTransitionContext.Provider>
  );
}
