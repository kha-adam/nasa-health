"""Pad the colour under fully transparent pixels of a PNG sequence ("alpha bleeding").

Browsers capture transparent pixels as black. Lossy, 4:2:0 encoders (VP9, HEVC) mix
neighbouring pixels, so that black would leak into the anti-aliased edges of the
mascot as a dark fringe. This fills every transparent pixel with the colour of the
nearest visible content (push-pull pyramid); visible pixels and alpha are unchanged.

    python3 -I bleed_alpha.py <input_dir> <output_dir>
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image


def push_pull(premul: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Straight colour everywhere: own colour where alpha > 0, else from coarser levels."""
    h, w = alpha.shape
    with np.errstate(invalid="ignore", divide="ignore"):
        straight = premul / alpha[..., None]
    if h <= 1 and w <= 1:
        return np.nan_to_num(straight)
    hh, ww = (h + 1) // 2 * 2, (w + 1) // 2 * 2
    pa = np.zeros((hh, ww), alpha.dtype)
    pp = np.zeros((hh, ww, 3), premul.dtype)
    pa[:h, :w] = alpha
    pp[:h, :w] = premul
    a2 = pa.reshape(hh // 2, 2, ww // 2, 2).sum(axis=(1, 3))
    p2 = pp.reshape(hh // 2, 2, ww // 2, 2, 3).sum(axis=(1, 3))
    coarse = push_pull(p2, a2)
    up = np.repeat(np.repeat(coarse, 2, axis=0), 2, axis=1)[:h, :w]
    return np.where(alpha[..., None] > 0, straight, up)


def bleed(src: Path, dst: Path) -> None:
    rgba = np.asarray(Image.open(src).convert("RGBA"), dtype=np.float32) / 255.0
    alpha = rgba[..., 3]
    rgb = push_pull(rgba[..., :3] * alpha[..., None], alpha)
    # Keep the captured colour of visible pixels exactly; only transparent ones change.
    rgb = np.where(alpha[..., None] > 0, rgba[..., :3], rgb)
    out = np.dstack([rgb, alpha])
    Image.fromarray(np.clip(out * 255.0 + 0.5, 0, 255).astype(np.uint8), "RGBA").save(dst, compress_level=1)


def main() -> None:
    src_dir, dst_dir = Path(sys.argv[1]), Path(sys.argv[2])
    dst_dir.mkdir(parents=True, exist_ok=True)
    frames = sorted(src_dir.glob("*.png"))
    for i, frame in enumerate(frames):
        bleed(frame, dst_dir / frame.name)
        if i % 60 == 0:
            print(f"\rbleed {i}/{len(frames)}", end="", flush=True)
    print(f"\rbleed {len(frames)}/{len(frames)} frames")


if __name__ == "__main__":
    main()
