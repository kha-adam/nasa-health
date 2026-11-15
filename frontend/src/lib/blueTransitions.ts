/*
 * BLUE login/logout transitions: every duration, mark, size and curve in one place.
 *
 * The clip marks come from blueTransitionTimeline.json, which also drives the offline
 * renderer of the two videos (scripts/blue_transitions). Changing a clip mark means
 * re-rendering the videos; the values below that are not in the JSON (veil, reveal,
 * cross-fades, navigation, time-outs) only concern the page and can change freely.
 *
 * Coordinates: the clips are square. The octopus artwork (320 x 280 viewBox) is drawn
 * `octopusWidth` px wide with its box centred in the frame, and the sphere (diameter
 * `sphereDiameter`) is centred too. So the visible mascot is NOT the whole video
 * rectangle: the frontend sizes the <video> so that this centred box matches the real
 * icon (anchor point = frame centre = centre of the octopus image), and the transparent
 * margin around it holds the halo and orbit trails.
 */
import timeline from "./blueTransitionTimeline.json";

export type TransitionKind = "login" | "logout";
/** Elements tagged data-blue-anchor: the octopus in the login title and in "Talk to Blue". */
export type AnchorName = "login-title" | "talk-to-blue";

export const ANCHOR_ATTR = "data-blue-anchor";
/** Login elements the transitions fade in/out themselves: "title" and "form". */
export const REVEAL_ATTR = "data-blue-reveal";

type Window2 = readonly [number, number];
/** [clip time (s), value]; values ease (smoothstep) between keys, equal times make a step. */
export type Track = readonly (readonly [number, number])[];

export const CLIP = timeline.clip;

/**
 * Media sources, tried in order; each one must pass a real alpha check before use (a
 * browser that drops the alpha layer gets the short fade instead of an opaque square).
 * VP9 with alpha in WebM: Chrome, Edge, Firefox. Safari needs HEVC with alpha; when the
 * renderer can produce it (x265 built with alpha), add after the WebM:
 *   { src: `/brand/transitions/blue-${kind}-transition.mp4`, type: 'video/mp4; codecs="hvc1"' }
 */
const media = (kind: TransitionKind) => [
  { src: `/brand/transitions/blue-${kind}-transition.webm`, type: 'video/webm; codecs="vp09.00.10.08"' },
];

interface ClipTiming {
  duration: number;
  toCenter: Window2;
  toTarget: Window2;
  /** Live SVG <-> video cross-fades, inside the clip's rest-pose frames. */
  capToVideo: Window2;
  videoToCap: Window2;
  /** Start looking for the destination icon this early (s). */
  lookupFrom: number;
  /** blur: live blur of the page under the veils (px). Costly on weak GPUs, so only used
   *  where the page must visibly sharpen (dashboard reveal) and guarded at run time. */
  veil: { wave: Track; app: Track; blur: Track };
  reveal: { title: Track; titleBlur: Track; form: Track; formBlur: Track };
}

export const TRANSITIONS: Record<TransitionKind, ClipTiming & { media: { src: string; type: string }[] }> = {
  login: {
    media: media("login"),
    duration: timeline.login.duration,
    toCenter: timeline.login.toCenter as unknown as Window2, // 0 - 0.45 s: title -> centre
    toTarget: timeline.login.toTarget as unknown as Window2, // 2.45 - 3.45 s: centre -> Talk to Blue
    capToVideo: [0.22, 0.38], // before the morph starts (0.45 s)
    videoToCap: [3.88, 4.05], // after the settle ends (3.85 s)
    lookupFrom: 1,
    veil: {
      // Pre-blurred login wave: the login page turns diffuse, then hides the route change.
      wave: [[0, 0], [0.5, 1], [3.05, 1], [3.06, 0]],
      // Dashboard tone, then the reveal once BLUE has landed.
      app: [[2.35, 0], [3.05, 1], [3.45, 0.86], [4.2, 0]],
      // The dashboard sharpens as BLUE lands (the login side uses the pre-blurred wave).
      blur: [[3.04, 0], [3.05, 14], [3.45, 12], [4.1, 0]],
    },
    reveal: {
      title: [[0, 1], [0.4, 0]],
      titleBlur: [[0, 0], [0.4, 6]],
      form: [[0, 1], [0.42, 0]],
      formBlur: [[0, 0], [0.42, 8]],
    },
  },
  logout: {
    media: media("logout"),
    duration: timeline.logout.duration,
    toCenter: timeline.logout.toCenter as unknown as Window2, // 0 - 0.45 s: Talk to Blue -> centre
    toTarget: timeline.logout.toTarget as unknown as Window2, // 2.30 - 2.95 s: centre -> login title
    capToVideo: [0.15, 0.32], // before the morph starts (0.42 s)
    videoToCap: [3.22, 3.38], // after the settle ends (3.2 s)
    lookupFrom: 1.2,
    veil: {
      // Opaque dashboard tone from the first frame: no health data stays visible.
      app: [[0, 1], [1.1, 1], [1.12, 0]],
      // Fading the pre-blurred wave out over the sharp login backdrop reads as un-blurring.
      wave: [[0, 0], [0.45, 0], [1.1, 1], [2.3, 1], [2.95, 0]],
      blur: [[0, 0]],
    },
    reveal: {
      title: [[0, 0], [2.3, 0], [2.95, 1]],
      titleBlur: [[0, 6], [2.3, 6], [2.95, 0]],
      form: [[0, 0], [2.95, 0], [3.6, 1]],
      formBlur: [[0, 10], [2.95, 10], [3.6, 0]],
    },
  },
};

export const TRANSITION_SETTINGS = {
  /** Login: open the destination once the wave veil is opaque (s). */
  loginNavigateAt: timeline.login.spin[1],
  /** Logout: leave the dashboard once sign-out is confirmed, not before BLUE has left its button (s). */
  logoutNavigateNotBefore: 0.5,
  /** Logout: the "Talk to Blue" label fades out above the veil. */
  ghostFade: [[0, 1], [0.3, 0]] as Track,
  /** Sphere diameter during the spin, CSS px: a share of the smaller viewport side, capped. */
  sphere: { viewportShare: 0.22, min: 120, max: 210 },
  /** Octopus width when there is no destination icon (flight surgeon, error page). */
  lostOctopus: { viewportShare: 0.12, min: 64, max: 110 },
  /** Live blur is dropped for the rest of a run once this many frames (in total) run slow while it is on. */
  blurGuard: { slowFrameMs: 34, slowFrames: 3 },
  /** Cross-fade from the travelling copy to the real icon at the very end (ms). */
  handoffMs: 140,
  /** Waits and fallbacks (ms): never block the interface on the film. */
  prepareWaitMs: 900, // media not ready by then -> short fade instead of the film
  startTimeoutMs: 1500, // play() did not start
  stallTimeoutMs: 1200, // playback stopped advancing
  anchorWaitMs: 2000, // destination icon missing when BLUE should leave the centre
  probeTimeoutMs: 6000,
  fadeInMs: 240,
  fadeOutMs: 320,
  /** Logout fallback: give up waiting for the server after this (the request itself times out at 8 s). */
  logoutWaitMs: 9000,
};

// ------------------------------------------------------------------ maths
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const progress = (t: number, [a, b]: Window2) => clamp((t - a) / (b - a));
export const easeInOutCubic = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

export function track(t: number, keys: Track): number {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      if (t1 <= t0) return v1;
      const u = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * u * u * (3 - 2 * u);
    }
  }
  return keys[keys.length - 1][1];
}

export interface Point {
  x: number;
  y: number;
}

export function cubic(p0: Point, p1: Point, p2: Point, p3: Point, u: number): Point {
  const v = 1 - u;
  const a = v * v * v;
  const b = 3 * v * v * u;
  const c = 3 * v * u * u;
  const d = u * u * u;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

/**
 * Control points of the flight paths: a soft arc, never a broken angle.
 * - "descend": centre -> Talk to Blue (login): leaves to the right, lands from above.
 * - "rise": Talk to Blue -> centre (logout): leaves upwards, arrives moving left.
 * - "arc": short, slightly bent path (title <-> centre).
 */
export function pathControls(kind: "descend" | "rise" | "arc", a: Point, b: Point): [Point, Point] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (kind === "descend") return [{ x: a.x + dx * 0.5, y: a.y - Math.abs(dy) * 0.1 }, { x: b.x, y: b.y - dy * 0.5 }];
  if (kind === "rise") return [{ x: a.x, y: a.y + dy * 0.5 }, { x: b.x - dx * 0.5, y: b.y + Math.abs(dy) * 0.1 }];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bend = 0.08 * len;
  return [
    { x: a.x + dx / 3 + nx * bend, y: a.y + dy / 3 + ny * bend },
    { x: a.x + (2 * dx) / 3 + nx * bend, y: a.y + (2 * dy) / 3 + ny * bend },
  ];
}

/** CSS size of the whole <video> so that its centred octopus box is `octopusCssWidth` wide. */
export const videoSizeForOctopus = (octopusCssWidth: number) => (octopusCssWidth * CLIP.masterSize) / CLIP.octopusWidth;
/** CSS size of the whole <video> so that its sphere is `sphereCssDiameter` wide. */
export const videoSizeForSphere = (sphereCssDiameter: number) => (sphereCssDiameter * CLIP.masterSize) / CLIP.sphereDiameter;
/** Octopus box (CSS px) inside a <video> of size `videoCss`. */
export const octopusBoxIn = (videoCss: number) => {
  const width = (videoCss * CLIP.octopusWidth) / CLIP.masterSize;
  return { width, height: (width * 280) / 320 };
};
