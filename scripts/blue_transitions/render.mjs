#!/usr/bin/env node
/*
 * Renders the BLUE login/logout transition clips (deterministic, transparent background).
 *
 *   node scripts/blue_transitions/render.mjs                 # both clips, web exports + masters
 *   node scripts/blue_transitions/render.mjs --clip login    # one clip
 *   node scripts/blue_transitions/render.mjs --preview 0,0.8,1.8,3.2 --clip login
 *                                                            # a few PNG frames for review
 *
 * Needs Playwright with Chromium (not a project dependency), ffmpeg (libvpx-vp9, libx265
 * with alpha, prores_ks) and Python 3 with numpy + Pillow. See README.md in this folder.
 *
 * Outputs
 *   frontend/public/brand/transitions/blue-<clip>-transition.webm   VP9 + alpha (Chrome, Edge, Firefox)
 *   frontend/public/brand/transitions/blue-<clip>-transition.mp4    HEVC + alpha (Safari)
 *   scripts/blue_transitions/out/blue-<clip>-transition-master.mov  ProRes 4444 master, 1024 px (not committed)
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const frontend = join(root, "frontend");
const timeline = JSON.parse(readFileSync(join(frontend, "src/lib/blueTransitionTimeline.json"), "utf8"));
const outDir = join(here, "out");
const publicDir = join(frontend, "public/brand/transitions");

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const clips = (opt("clip", "all") === "all" ? ["login", "logout"] : [opt("clip")]);
const preview = opt("preview", null);

// ------------------------------------------------------------- original mascot markup
/** Server-render the real BlueOctopus component (mood "idle", as on the login title and in Talk to Blue). */
function octopusMarkup() {
  const req = createRequire(join(frontend, "package.json"));
  const ts = req("typescript");
  const React = req("react");
  const { renderToStaticMarkup } = req("react-dom/server");
  const source = readFileSync(join(frontend, "src/components/BlueOctopus.tsx"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  // CSS module classes keep their plain names, so the module CSS applies as is.
  const styles = new Proxy({}, { get: (_, key) => (key === "__esModule" ? false : String(key)) });
  const mod = { exports: {} };
  const localRequire = (id) => (id.endsWith(".module.css") ? styles : req(id));
  new Function("require", "module", "exports", outputText)(localRequire, mod, mod.exports);
  const BlueOctopus = mod.exports.default;
  return renderToStaticMarkup(React.createElement(BlueOctopus, { mood: "idle" }));
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const fromEnv = process.env.PLAYWRIGHT_MODULE;
    if (fromEnv) return import(pathToFileURL(fromEnv).href);
    throw new Error("Playwright not found. Install it next to this script (npm i --no-save playwright) or set PLAYWRIGHT_MODULE.");
  }
}

// ------------------------------------------------------------- render
async function main() {
  const markup = octopusMarkup();
  const moduleCss = readFileSync(join(frontend, "src/components/BlueOctopus.module.css"), "utf8");
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(here, "scene.html")).href);

  mkdirSync(outDir, { recursive: true });
  mkdirSync(publicDir, { recursive: true });

  for (const clip of clips) {
    await page.evaluate((cfg) => window.setupScene(cfg), { markup, moduleCss, timeline, clip });
    const fps = timeline.clip.fps;

    if (preview) {
      for (const t of preview.split(",").map(Number)) {
        await page.evaluate((time) => window.renderFrame(time), t);
        const file = join(outDir, `preview-${clip}-${t.toFixed(2)}.png`);
        await page.screenshot({ path: file, omitBackground: true });
        console.log(file);
      }
      continue;
    }

    const frames = Math.round(timeline[clip].duration * fps);
    const raw = join(outDir, `frames-${clip}`);
    const bled = join(outDir, `frames-${clip}-bled`);
    rmSync(raw, { recursive: true, force: true });
    mkdirSync(raw, { recursive: true });
    for (let i = 0; i < frames; i++) {
      await page.evaluate((time) => window.renderFrame(time), i / fps);
      await page.screenshot({ path: join(raw, `f${String(i).padStart(4, "0")}.png`), omitBackground: true });
      if (i % 30 === 0) process.stdout.write(`\r${clip}: frame ${i}/${frames}`);
    }
    process.stdout.write(`\r${clip}: ${frames} frames rendered\n`);

    // Pad colours under transparent pixels so lossy, subsampled encodes keep clean edges.
    execFileSync("python3", ["-I", join(here, "bleed_alpha.py"), raw, bled], { stdio: "inherit" });
    encode(clip, bled, fps);
  }
  await browser.close();
}

function ffmpeg(argv) {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...argv], { stdio: "inherit" });
}

function encode(clip, frames, fps) {
  const input = ["-framerate", String(fps), "-i", join(frames, "f%04d.png")];
  const web = timeline.clip.webSize;
  const scale = `scale=${web}:${web}:flags=lanczos`;
  const name = `blue-${clip}-transition`;

  // Master: ProRes 4444 with alpha, full resolution.
  ffmpeg([...input, "-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le", "-alpha_bits", "16", join(outDir, `${name}-master.mov`)]);

  // Web, Chrome / Edge / Firefox: VP9 with alpha in WebM.
  ffmpeg([
    ...input, "-vf", scale, "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "30",
    "-deadline", "good", "-cpu-used", "1", "-row-mt", "1", "-auto-alt-ref", "0", "-g", "600", "-an",
    "-metadata:s:v:0", "alpha_mode=1", join(publicDir, `${name}.webm`),
  ]);

  // Web, Safari: HEVC with an alpha layer. Needs an x265 built with ENABLE_ALPHA (x265 >= 4);
  // many distribution builds lack it. Then the frontend must also list the .mp4 source.
  const hevc = join(publicDir, `${name}.mp4`);
  try {
    ffmpeg([
      ...input, "-vf", scale, "-c:v", "libx265", "-pix_fmt", "yuva420p", "-crf", "26", "-preset", "slow",
      "-tag:v", "hvc1", "-x265-params", "log-level=error", "-an", "-movflags", "+faststart", hevc,
    ]);
    console.log(`${clip}: wrote ${name}.webm, ${name}.mp4 (HEVC alpha) and the master`);
  } catch {
    rmSync(hevc, { force: true });
    console.warn(`${clip}: HEVC with alpha is not supported by this ffmpeg/x265 build; no Safari source written.`);
    console.log(`${clip}: wrote ${name}.webm and the master`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
