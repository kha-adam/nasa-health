/*
 * BLUE transition scene: deterministic frame renderer for the login/logout clips.
 *
 * render.mjs opens scene.html in headless Chromium, calls setupScene() once with the
 * original BlueOctopus markup and CSS (rendered from frontend/src/components/BlueOctopus.tsx)
 * and the shared timeline (frontend/src/lib/blueTransitionTimeline.json), then calls
 * renderFrame(t) for every frame and captures it on a transparent background.
 *
 * Every frame is a pure function of t: no timers, no randomness, no CSS animation.
 *
 * Frame layout (master 1024 x 1024 px):
 *   - the octopus artwork (320 x 280 viewBox) is drawn `octopusWidth` px wide, its box
 *     centred in the frame: at rest, frames show exactly the original component;
 *   - the sphere (diameter `sphereDiameter`) is centred in the frame;
 *   - halo and orbit trails stay inside the frame with a transparent margin.
 *
 * Story: octopus at rest -> tentacles fold up and turn into blue curves, the face sinks
 * into the surface, the head becomes a pearl-grey sphere wrapped in blue ribbons -> the
 * sphere spins (ease in / ease out) with a thin orbit trail -> the ribbons unwind into
 * tentacles, the face and the fuchsia accents return -> a small settle -> rest pose.
 */
"use strict";

const SIZE = 1024;
const CX = SIZE / 2;
const CY = SIZE / 2;

let TL = null; // timeline of the clip being rendered
let CLIP = "login";
let K = 1.25; // frame px per viewBox unit
let BOX_X = 0;
let BOX_Y = 0;
let RS = 230; // sphere radius, frame px
let GATHER = 0.35;
const el = {};
const ctx = {};

// ---------------------------------------------------------------- helpers
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const smoother = (t) => {
  t = clamp(t);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const progress = (t, w) => clamp((t - w[0]) / (w[1] - w[0]));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const toHex = (c) => "#" + c.map((v) => Math.round(clamp(v) * 255).toString(16).padStart(2, "0")).join("");
const rgba = (c, a) => `rgba(${Math.round(clamp(c[0]) * 255)},${Math.round(clamp(c[1]) * 255)},${Math.round(clamp(c[2]) * 255)},${clamp(a)})`;
const DEG = Math.PI / 180;

// Palette: deep blue, luminous blue, discreet cyan, silver grey, pearl white.
const C = {
  deep: hex("#0B3D91"),
  royal: hex("#1E5FD0"),
  bright: hex("#3C8CF2"),
  cyan: hex("#52D3F6"),
  pearlHi: hex("#F1F5FA"),
  pearlLo: hex("#B9C4D2"),
  silverShadow: hex("#6F7E93"),
  envLow: hex("#1A2F5E"),
  envHigh: hex("#F5F9FF"),
  rim: hex("#D2E8FF"),
  halo: hex("#4A96F2"),
  white: [1, 1, 1],
};

// Original colours of the character (BlueOctopus.tsx) and their blue counterparts.
const ORIG = {
  arm: [hex("#00B5E3"), hex("#0284C7")],
  body: [hex("#20D4F2"), hex("#00B5E3"), hex("#0284C7")],
};
const BLUE = {
  arm: [hex("#2D7FE6"), hex("#0B3D91")],
  body: [hex("#4A95F0"), hex("#2D7FE6"), hex("#0B3D91")],
};

// ---------------------------------------------------------------- timeline curves
/** 0 = octopus, 1 = sphere. */
function morphAmount(t) {
  return smooth(0, 1, progress(t, TL.morph)) * (1 - smooth(0, 1, progress(t, TL.unmorph)));
}

/** Signed rotation angle of the sphere (rad): ease in, ease out. */
function rotationAngle(t) {
  const r = TL.rotation;
  return r.direction * r.turns * 2 * Math.PI * smoother(progress(t, r.window));
}

/** Normalised angular speed (0..1), used for the energy of the halo and trails. */
function spinEnergy(t) {
  const u = progress(t, TL.rotation.window);
  return 16 * u * u * (1 - u) * (1 - u); // derivative shape of smootherstep, peak 1 at u = .5
}

/** Ribbons gather towards the equator, then relax. */
function gatherAmount(t) {
  const u = progress(t, TL.gather);
  return GATHER * Math.pow(Math.sin(Math.PI * u), 2);
}

/** Small decaying sway when the octopus lands; exactly 0 at both ends. */
function settleWobble(t) {
  const u = progress(t, TL.settle);
  if (u <= 0 || u >= 1) return 0;
  return Math.sin(u * Math.PI * 2) * Math.pow(1 - u, 2) * smooth(0, 0.12, u);
}

/** Contact shadow: present at rest, gone while flying. */
function shadowAmount(t) {
  const off = smooth(TL.morph[0] - 0.07, TL.morph[0] + 0.08, t);
  const on = smooth(TL.settle[0], TL.settle[1], t);
  return clamp(1 - off + on);
}

// ---------------------------------------------------------------- setup
window.setupScene = function ({ markup, moduleCss, timeline, clip }) {
  CLIP = clip;
  TL = timeline[clip];
  const c = timeline.clip;
  K = c.octopusWidth / 320;
  BOX_X = CX - 160 * K;
  BOX_Y = CY - 140 * K;
  RS = c.sphereDiameter / 2;
  GATHER = clip === "logout" ? 0.62 : 0.32;

  document.getElementById("octopus-css").textContent = moduleCss;
  const host = document.getElementById("octo");
  host.innerHTML = markup;
  host.style.left = `${BOX_X}px`;
  host.style.top = `${BOX_Y}px`;
  const svg = host.querySelector("svg");
  svg.style.width = `${c.octopusWidth}px`;
  svg.style.height = `${(c.octopusWidth * 280) / 320}px`;

  el.svg = svg;
  el.shadow = svg.querySelector(":scope > ellipse");
  el.left = svg.querySelector(".leftTentacles");
  el.right = svg.querySelector(".rightTentacles");
  el.front = svg.querySelector(".frontTentacles");
  el.head = svg.querySelector(".head");
  el.headShape = el.head.querySelector(":scope > ellipse");
  const headPaths = el.head.querySelectorAll(":scope > path");
  el.shine = headPaths[0];
  el.nose = headPaths[1];
  el.face = [el.head.querySelector(".eyes"), el.head.querySelector(".brows"), el.nose, el.head.querySelector(".mouth")];

  const radials = svg.querySelectorAll("radialGradient");
  const linears = svg.querySelectorAll("linearGradient");
  el.gArm = linears[0];
  // The front tentacles share the head gradient; give them their own copy so they can
  // turn blue while the head keeps its colour under the forming sphere.
  const body = radials[0];
  const tBody = body.cloneNode(true);
  tBody.id = `${body.id}-tentacles`;
  body.parentNode.appendChild(tBody);
  for (const p of el.front.querySelectorAll("path")) {
    if (p.getAttribute("fill") === `url(#${body.id})`) p.setAttribute("fill", `url(#${tBody.id})`);
  }
  el.gTBody = tBody;
  el.fuchsia = [...svg.querySelectorAll('path[fill="#C90068"]')];

  for (const g of [el.left, el.right, el.front, el.head, ...el.face, el.shine, el.shadow]) {
    g.style.transformOrigin = "0 0";
    g.style.transformBox = "view-box";
  }
  for (const id of ["halo", "back", "sphere", "front"]) ctx[id] = document.getElementById(id).getContext("2d");
  return { box: [BOX_X, BOX_Y], k: K };
};

// ---------------------------------------------------------------- octopus pose
function setStops(grad, from, to, amount) {
  grad.querySelectorAll("stop").forEach((s, i) => s.setAttribute("stop-color", toHex(mixc(from[i], to[i], amount))));
}

function poseOctopus(t, m) {
  // Head: the ellipse rounds into the sphere and moves to the frame centre.
  const grow = smooth(0.1, 1, m);
  const centre = smooth(0.05, 0.9, m);
  const rx = lerp(111 * K, RS, grow);
  const ry = lerp(103 * K, RS, grow);
  const cyFrame = lerp(BOX_Y + 127 * K, CY, centre);
  const sx = rx / (111 * K);
  const sy = ry / (103 * K);
  const cyv = (cyFrame - BOX_Y) / K;
  const headT = `translate(160px, ${cyv}px) scale(${sx}, ${sy}) translate(-160px, -127px)`;
  el.head.style.transform = headT;

  // Face sinks into the surface.
  const face = 1 - smooth(0.08, 0.45, m);
  const sink = lerp(0.86, 1, face);
  for (const f of el.face) {
    f.style.opacity = face;
    f.style.transform = `translate(160px, 135px) scale(${sink}) translate(-160px, -135px)`;
  }
  el.shine.style.opacity = 1 - smooth(0.2, 0.7, m);

  // Tentacles fold up around the head like closing petals and turn blue.
  const fold = smooth(0, 0.6, m);
  const tint = smooth(0.02, 0.45, m);
  const fade = 1 - smooth(0.2, 0.5, m);
  const wob = settleWobble(t);
  const hug = 1 - 0.3 * fold;
  const swing = 82 * fold;
  el.left.style.transform = `${headT} translate(160px, 127px) rotate(${swing}deg) scale(${hug}) translate(-160px, -127px) translate(113px, 197px) rotate(${4.5 * wob}deg) translate(-113px, -197px)`;
  el.right.style.transform = `${headT} translate(160px, 127px) rotate(${-swing}deg) scale(${hug}) translate(-160px, -127px) translate(207px, 197px) rotate(${-4.5 * wob}deg) translate(-207px, -197px)`;
  el.front.style.transform = `${headT} translate(160px, 127px) scale(${1 - 0.3 * fold}, ${1 - 0.56 * fold}) translate(-160px, -127px) translate(160px, 205px) scale(1, ${1 + 0.035 * wob}) translate(-160px, -205px)`;
  for (const g of [el.left, el.right, el.front]) g.style.opacity = fade;

  // The fuchsia undersides fade out instead of shifting hue (a hue shift would pass through purple).
  const accent = 1 - smooth(0, 0.32, m);
  for (const p of el.fuchsia) p.style.opacity = accent;
  setStops(el.gArm, ORIG.arm, BLUE.arm, tint);
  setStops(el.gTBody, ORIG.body, BLUE.body, tint);

  el.shadow.style.opacity = 0.16 * shadowAmount(t);

  return { cx: CX, cy: cyFrame, rx, ry };
}

// ---------------------------------------------------------------- sphere (per pixel)
function rotationMatrix(theta) {
  // Object -> view: tilt (roll about z, then pitch about x) applied after a spin about y.
  const roll = -18 * DEG;
  const pitch = 16 * DEG;
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const ct = Math.cos(theta), st = Math.sin(theta);
  // Ry(theta)
  const Ry = [ct, 0, st, 0, 1, 0, -st, 0, ct];
  const Rx = [1, 0, 0, 0, cp, -sp, 0, sp, cp];
  const Rz = [cr, -sr, 0, sr, cr, 0, 0, 0, 1];
  const mul = (a, b) => {
    const r = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    return r;
  };
  return mul(Rz, mul(Rx, Ry));
}

const BANDS = [
  { a: 0.56, b: 0.34, psi: 0, w: 0.2 },
  { a: 0.56, b: -0.34, psi: Math.PI, w: 0.2 },
];

function drawSphere(g, s) {
  const { cx, cy, rx, ry, alpha, bands, theta, gather } = s;
  g.clearRect(0, 0, SIZE, SIZE);
  if (alpha <= 0.001) return;
  const x0 = Math.max(0, Math.floor(cx - rx - 2));
  const x1 = Math.min(SIZE, Math.ceil(cx + rx + 2));
  const y0 = Math.max(0, Math.floor(cy - ry - 2));
  const y1 = Math.min(SIZE, Math.ceil(cy + ry + 2));
  const w = x1 - x0;
  const h = y1 - y0;
  const img = g.createImageData(w, h);
  const d = img.data;
  const M = rotationMatrix(theta); // view = M * object  ->  object = M^T * view
  const rmin = Math.min(rx, ry);
  const L = normalize([-0.42, -0.62, 0.66]);
  const H = normalize([L[0], L[1], L[2] + 1]);
  const ga = 1 - 0.45 * gather;
  const gb = 1 - 0.6 * gather;
  const gw = 1 + 0.12 * gather;
  const pxAngle = 1.25 / rmin;

  for (let j = 0; j < h; j++) {
    const ny0 = (y0 + j + 0.5 - cy) / ry;
    for (let i = 0; i < w; i++) {
      const nx0 = (x0 + i + 0.5 - cx) / rx;
      const rr = nx0 * nx0 + ny0 * ny0;
      const r = Math.sqrt(rr);
      const cov = clamp((1 - r) * rmin + 0.5);
      if (cov <= 0) continue;
      const k = r > 1 ? 1 / r : 1;
      const nx = nx0 * k;
      const ny = ny0 * k;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));

      // Lighting terms (key light from the top left, like the character's highlight).
      const ndl = nx * L[0] + ny * L[1] + nz * L[2];
      const diff = 0.3 + 0.7 * Math.max(0, (ndl + 0.18) / 1.18);
      const ndh = Math.max(0, nx * H[0] + ny * H[1] + nz * H[2]);
      const spec = 0.85 * Math.pow(ndh, 90) + 0.22 * Math.pow(ndh, 14);
      const fres = Math.pow(1 - nz, 2.6);
      const refY = 2 * nz * ny; // reflected view vector, y component (down is +)
      const sky = smooth(0.3, -0.75, refY);
      const env = mixc(C.envLow, C.envHigh, sky);

      // Pearl-grey core.
      const albedo = mixc(C.pearlHi, C.pearlLo, smooth(-0.7, 0.95, ny * 0.8 + nx * 0.35));
      let col = [
        albedo[0] * diff * 0.74 + env[0] * 0.3 + spec + fres * C.rim[0] * 0.5,
        albedo[1] * diff * 0.74 + env[1] * 0.3 + spec + fres * C.rim[1] * 0.5,
        albedo[2] * diff * 0.74 + env[2] * 0.3 + spec + fres * C.rim[2] * 0.5,
      ];

      if (bands > 0.001) {
        // Object-space position of this surface point.
        const px = M[0] * nx + M[3] * ny + M[6] * nz;
        const py = M[1] * nx + M[4] * ny + M[7] * nz;
        const pz = M[2] * nx + M[5] * ny + M[8] * nz;
        const lon = Math.atan2(px, pz);
        const lat = Math.asin(clamp(py, -1, 1));
        const cosLat = Math.max(Math.cos(lat), 0.2);
        const eps = pxAngle / Math.max(nz, 0.16);
        for (const band of BANDS) {
          const amp = band.a * ga;
          const centreLat = amp * Math.sin(lon + band.psi) + band.b * gb;
          const slope = (amp * Math.cos(lon + band.psi)) / cosLat;
          const dist = Math.abs(lat - centreLat) / Math.sqrt(1 + slope * slope);
          const half = band.w * bands * gw;
          // Soft groove just outside the ribbon (reads as a raised band).
          const groove = 1 - 0.14 * clamp(1 - (dist - half) / 0.05) * (dist > half ? 1 : 0) * bands;
          col = [col[0] * groove, col[1] * groove, col[2] * groove];
          const inside = clamp((half - dist) / eps + 0.5);
          if (inside <= 0) continue;
          const tb = clamp(1 - dist / Math.max(half, 1e-4));
          let base = mixc(C.bright, C.deep, smooth(0.04, 0.8, tb));
          const edge = 0.6 * Math.exp(-Math.pow((tb - 0.12) / 0.08, 2));
          base = mixc(base, C.cyan, edge);
          const benv = mixc(C.deep, C.rim, sky);
          const bc = [
            base[0] * diff * 0.86 + benv[0] * 0.16 + spec * 0.8 + fres * C.rim[0] * 0.35,
            base[1] * diff * 0.86 + benv[1] * 0.16 + spec * 0.8 + fres * C.rim[1] * 0.35,
            base[2] * diff * 0.86 + benv[2] * 0.16 + spec * 0.8 + fres * C.rim[2] * 0.35,
          ];
          col = mixc(col, bc, inside);
        }
      }

      const o = (j * w + i) * 4;
      d[o] = Math.round(clamp(col[0]) * 255);
      d[o + 1] = Math.round(clamp(col[1]) * 255);
      d[o + 2] = Math.round(clamp(col[2]) * 255);
      d[o + 3] = Math.round(cov * alpha * 255);
    }
  }
  g.putImageData(img, x0, y0);
}

function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}

// ---------------------------------------------------------------- rings (ribbons, trails)
/**
 * Arc of a tilted circle around (cx, cy): radius r, pitch (0 = facing the viewer,
 * 90 deg = edge on) and roll. Parametric angle phi in (0, pi) is in front of the sphere,
 * (pi, 2pi) behind it. Drawn from the tail (phiA) to the head (phiB); colour and alpha
 * follow the arc through a conic gradient, so each pass is a single seamless stroke.
 */
function drawArc(cx, cy, r, pitch, roll, phiA, phiB, colourAt, width) {
  const ry = r * Math.cos(pitch);
  const point = (phi) => {
    const x = r * Math.cos(phi);
    const y = ry * Math.sin(phi);
    return [cx + x * Math.cos(roll) - y * Math.sin(roll), cy + x * Math.sin(roll) + y * Math.cos(roll)];
  };
  // Conic gradient from screen polar angles of samples along the arc.
  const N = 28;
  const samples = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const p = point(lerp(phiA, phiB, s));
    samples.push({ s, a: Math.atan2(p[1] - cy, p[0] - cx) });
  }
  for (let i = 1; i < samples.length; i++) {
    let a = samples[i].a;
    while (a - samples[i - 1].a > Math.PI) a -= 2 * Math.PI;
    while (a - samples[i - 1].a < -Math.PI) a += 2 * Math.PI;
    samples[i].a = a;
  }
  const ordered = samples[N].a >= samples[0].a ? samples : [...samples].reverse();
  const start = ordered[0].a;
  const span = ordered[ordered.length - 1].a - start;
  if (span <= 0 || span >= 2 * Math.PI - 0.01) return;

  // Split into front / back pieces at multiples of pi.
  const dir = phiB >= phiA ? 1 : -1;
  const cuts = [phiA];
  const lo = Math.min(phiA, phiB);
  const hi = Math.max(phiA, phiB);
  const kStart = Math.ceil(lo / Math.PI);
  const inner = [];
  for (let k = kStart; k * Math.PI < hi; k++) if (k * Math.PI > lo) inner.push(k * Math.PI);
  if (dir < 0) inner.reverse();
  cuts.push(...inner, phiB);

  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i];
    const b = cuts[i + 1];
    const mid = (a + b) / 2;
    const front = Math.sin(mid) * Math.sin(pitch) >= 0;
    const g = front ? ctx.front : ctx.back;
    const grad = g.createConicGradient(start, cx, cy);
    for (const smp of ordered) grad.addColorStop(clamp((smp.a - start) / (2 * Math.PI)), colourAt(smp.s));
    g.strokeStyle = grad;
    g.lineWidth = width;
    g.lineCap = "butt";
    g.beginPath();
    g.ellipse(cx, cy, r, Math.abs(ry), roll, Math.min(a, b), Math.max(a, b));
    g.stroke();
  }
  return point;
}

/** Small glowing head of an orbit trail, in front of or behind the sphere. */
function drawSpark(x, y, front, radius, alpha) {
  if (alpha <= 0.001) return;
  const g = front ? ctx.front : ctx.back;
  const grad = g.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
  grad.addColorStop(0.35, `rgba(150,215,255,${alpha * 0.55})`);
  grad.addColorStop(1, "rgba(80,160,245,0)");
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, radius, 0, 2 * Math.PI);
  g.fill();
}

/** Blue curves that come out of the folding tentacles and wrap onto the sphere. */
function drawTransitionRibbons(t, m, head) {
  // Visible while the tentacles fold away and until the surface bands take over.
  const env = Math.pow(Math.sin(Math.PI * clamp((m - 0.12) / 0.8)), 1.2);
  if (env <= 0.002) return;
  const h = smooth(0.12, 0.92, m);
  const R = Math.max(head.rx, head.ry);
  const theta = rotationAngle(t);
  // One ribbon per side: each leaves the lower side where its tentacles were, sweeps up
  // and around the head, and settles on the surface (radius -> R) like the sphere bands.
  const ribbons = [
    { pitch: 58 * DEG, roll: 34 * DEG, phi0: 0.78 * Math.PI, sweep: 2.4 },
    { pitch: 58 * DEG, roll: -34 * DEG, phi0: 0.22 * Math.PI, sweep: -2.4 },
  ];
  for (const rb of ribbons) {
    const r = R * (1.24 - 0.22 * h);
    const headPhi = rb.phi0 + rb.sweep * h + 0.3 * theta;
    const len = 0.5 + 2.1 * Math.sin(Math.PI * clamp(h * 0.9 + 0.05));
    const tail = headPhi - Math.sign(rb.sweep) * len;
    const colour = (from, to, peak) => (s) => {
      const ends = Math.pow(Math.sin(Math.PI * clamp(s * 0.94 + 0.03)), 0.7);
      return rgba(mixc(from, to, s), env * peak * ends);
    };
    const width = lerp(26, 14, h);
    drawArc(head.cx, head.cy, r, rb.pitch, rb.roll, tail, headPhi, colour(C.deep, C.royal, 0.25), width * 1.9);
    drawArc(head.cx, head.cy, r, rb.pitch, rb.roll, tail, headPhi, colour(C.deep, C.bright, 1), width);
    drawArc(head.cx, head.cy, r, rb.pitch, rb.roll, tail, headPhi, colour(C.royal, C.cyan, 0.7), Math.max(2.5, width * 0.22));
  }
}

/** One or two thin orbit trails while the sphere spins. */
function drawOrbits(t, sphere) {
  const o = TL.orbit;
  const env = smooth(o[0], o[0] + 0.35, t) * (1 - smooth(o[1] - 0.4, o[1], t));
  if (env <= 0.002) return;
  const theta = rotationAngle(t);
  const dir = TL.rotation.direction;
  const energy = spinEnergy(t);
  const trails = [
    { r: 1.4, pitch: 74 * DEG, roll: -15 * DEG, phi0: 0.3, speed: 1.55, alpha: 1, len: 2.5 },
    { r: 1.6, pitch: 66 * DEG, roll: 22 * DEG, phi0: 2.6, speed: 1.2, alpha: 0.55, len: 1.9 },
  ];
  for (const tr of trails) {
    const R = RS * tr.r;
    const headPhi = tr.phi0 + tr.speed * theta;
    const len = tr.len * (0.55 + 0.45 * energy);
    const tail = headPhi - dir * len;
    const a = env * tr.alpha;
    // Royal-blue body (reads on the light dashboard tone) with a light core (reads on the blue login tone).
    const body = (peak) => (s) => rgba(mixc(C.deep, C.royal, s), a * peak * Math.pow(s, 1.4));
    const core = (peak) => (s) => rgba(mixc(C.bright, mixc(C.cyan, C.white, 0.6), Math.pow(s, 2)), a * peak * Math.pow(s, 1.8));
    drawArc(sphere.cx, sphere.cy, R, tr.pitch, tr.roll, tail, headPhi, body(0.28), 14);
    drawArc(sphere.cx, sphere.cy, R, tr.pitch, tr.roll, tail, headPhi, body(0.9), 6);
    const point = drawArc(sphere.cx, sphere.cy, R, tr.pitch, tr.roll, tail, headPhi, core(1), 2.6);
    if (point) {
      const [x, y] = point(headPhi);
      const front = Math.sin(headPhi) * Math.sin(tr.pitch) >= 0;
      drawSpark(x, y, front, 15, a * 0.95);
    }
  }
}

function drawHalo(sphere, presence, energy) {
  const g = ctx.halo;
  const R = Math.max(sphere.rx, sphere.ry);
  const a = presence * (0.55 + 0.45 * energy);
  if (a <= 0.002) return;
  const grad = g.createRadialGradient(sphere.cx, sphere.cy, R * 0.8, sphere.cx, sphere.cy, R * 1.85);
  grad.addColorStop(0, rgba(C.halo, 0.3 * a));
  grad.addColorStop(0.3, rgba(C.halo, 0.12 * a));
  grad.addColorStop(0.7, rgba(C.halo, 0.03 * a));
  grad.addColorStop(1, rgba(C.halo, 0));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(sphere.cx, sphere.cy, R * 1.85, 0, 2 * Math.PI);
  g.fill();
}

// ---------------------------------------------------------------- frame
window.renderFrame = function (t) {
  for (const id of ["halo", "back", "front"]) ctx[id].clearRect(0, 0, SIZE, SIZE);
  const m = morphAmount(t);
  const head = poseOctopus(t, m);
  const sphere = {
    ...head,
    alpha: smooth(0.3, 0.82, m),
    bands: smooth(0.5, 1, m),
    theta: rotationAngle(t),
    gather: gatherAmount(t),
  };
  drawHalo(sphere, smooth(0.35, 0.95, m), spinEnergy(t));
  drawSphere(ctx.sphere, sphere);
  drawTransitionRibbons(t, m, head);
  drawOrbits(t, sphere);
  return { m };
};
