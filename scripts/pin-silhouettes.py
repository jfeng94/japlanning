"""Make the SDF pin renderer's silhouettes from the full-colour pin art.

Every pin icon has two files (src/config/icons.ts): the artwork in
src/map/icons/dom/ and, in src/map/icons/sdf/, a black silhouette on
transparent that MapLibre turns into a signed distance field and tints per
layer. This writes the missing silhouettes: the artwork's alpha channel,
painted black, as PNG. Existing files are left alone unless --force.

Needs Pillow (pip install pillow). Run from the repo root:
    python -I scripts/pin-silhouettes.py [--force]
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DOM = ROOT / "src" / "map" / "icons" / "dom"
SDF = ROOT / "src" / "map" / "icons" / "sdf"


def main() -> None:
    force = "--force" in sys.argv[1:]
    SDF.mkdir(parents=True, exist_ok=True)
    for art in sorted(DOM.iterdir()):
        if art.suffix.lower() not in {".png", ".webp"}:
            continue  # coffee.svg has a hand-made silhouette
        out = SDF / f"{art.stem}.png"
        existing = [p for p in SDF.glob(f"{art.stem}.*")]
        if existing and not force:
            continue
        alpha = Image.open(art).convert("RGBA").getchannel("A")
        silhouette = Image.new("RGBA", alpha.size, (0, 0, 0, 0))
        silhouette.putalpha(alpha)
        silhouette.save(out)
        print(f"wrote {out.relative_to(ROOT)} ({alpha.size[0]}x{alpha.size[1]})")


if __name__ == "__main__":
    main()
