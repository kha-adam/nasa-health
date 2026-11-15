# BLUE login / logout transition clips

Two short, transparent clips of the BLUE octopus, played by the frontend as the real
sign-in and sign-out transitions (`frontend/src/components/BlueTransitionLayer.tsx`):

| Clip | Story | Length |
| --- | --- | --- |
| `blue-login-transition` | octopus → blue and pearl-grey sphere spinning (clockwise from above) → octopus | 4.2 s |
| `blue-logout-transition` | octopus → sphere spinning the other way, ribbons gather then relax → octopus | 3.6 s |

The clips contain only the mascot (no page, text or data). The page moves and scales the
clip, fades the veils and reveals the interface; see `frontend/src/lib/blueTransitions.ts`.

## How they are made

A deterministic local render, no generative video model:

- `scene.html` + `scene.js`: one frame = a pure function of the clip time. The octopus is
  the **real component** `frontend/src/components/BlueOctopus.tsx` (mood `idle`), rendered
  to SVG by `render.mjs`, with its CSS module. Its tentacles fold up and turn blue, the face
  sinks, the head becomes a sphere shaded per pixel (pearl-grey core, blue ribbons, cyan
  edges, soft highlights), with a thin orbit trail and a subtle blue halo. First and last
  frames are the untouched component at rest.
- `render.mjs`: captures every frame in headless Chromium on a transparent background,
  then encodes.
- `bleed_alpha.py`: fills the colour under fully transparent pixels from the nearest
  visible pixel, so lossy 4:2:0 encodes keep clean edges (no dark fringe).

Timeline and sizes are shared with the frontend: `frontend/src/lib/blueTransitionTimeline.json`.

## Frame layout (anchor point)

- Square frame, master 1024 px, web export 768 px, 60 fps, no audio, no loop.
- The octopus box (320 × 280 viewBox) is `octopusWidth` = 400 master px wide, **centred in
  the frame**. The sphere (`sphereDiameter` = 460 px) is centred too.
- So the anchor point is the frame centre = the centre of the octopus image, and the
  visible mascot is not the whole video rectangle: the transparent margin holds the halo
  and the trails. The frontend sizes the video as `iconWidth × 1024 / 400`.

## Outputs

| File | Use |
| --- | --- |
| `frontend/public/brand/transitions/blue-<clip>-transition.webm` | VP9 + alpha, 768 px, 60 fps: Chrome, Edge, Firefox (committed) |
| `frontend/public/brand/transitions/blue-<clip>-transition.mp4` | HEVC + alpha for Safari, **only if** your ffmpeg's x265 has alpha support |
| `scripts/blue_transitions/out/blue-<clip>-transition-master.mov` | ProRes 4444 master, 1024 px (not committed, ~250 MB) |

The frontend checks real transparency on the first frame before using a clip; a browser
that drops the alpha layer (Safari with the WebM) gets the short fade instead.

**Safari:** the x265 build used here has no alpha support, so no `.mp4` was produced. On a
machine with an alpha-capable x265 (x265 ≥ 4 built with `ENABLE_ALPHA`), re-run the
render, then add the `.mp4` source to `media()` in `frontend/src/lib/blueTransitions.ts`
(the line is ready in the comment there) and check it in Safari.

## Re-render

```bash
# One-off tools (not project dependencies)
cd scripts/blue_transitions
npm i --no-save playwright && npx playwright install chromium
cd ../..
node scripts/blue_transitions/render.mjs                    # both clips
node scripts/blue_transitions/render.mjs --clip logout      # one clip
node scripts/blue_transitions/render.mjs --clip login --preview 0,0.8,1.8,3.3   # a few PNGs in out/
```

Needs ffmpeg (libvpx-vp9, prores_ks; libx265 with alpha for the Safari file), Python 3 with
numpy and Pillow, and the frontend's `node_modules` (React and TypeScript render the mascot).
If Playwright is installed elsewhere, point `PLAYWRIGHT_MODULE` at its `index.mjs`.

After changing a clip mark in the JSON, re-render both clips: the page reads the same marks.
