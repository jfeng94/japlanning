"""Generate placeholder app icons as PNGs with no dependencies.

Draws a terracotta square with a lighter inner square that sits inside the
maskable safe zone (the central 80%), so the icon survives Android's
circular/rounded masks. Replace with real artwork whenever.

Run from the repo root:  python -I scripts/make-icons.py
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
BG = (0xB5, 0x45, 0x2B)  # --accent
FG = (0xFA, 0xF7, 0xF2)  # --bg


def png(size: int) -> bytes:
    inner_lo = int(size * 0.30)
    inner_hi = int(size * 0.70)
    rows = bytearray()
    for y in range(size):
        rows.append(0)  # filter type 0 (none)
        for x in range(size):
            inside = inner_lo <= x < inner_hi and inner_lo <= y < inner_hi
            rows.extend(FG if inside else BG)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit RGB
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(rows), 9))
        + chunk(b"IEND", b"")
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, size in [("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)]:
        (OUT / name).write_bytes(png(size))
        print(f"wrote {OUT / name} ({size}x{size})")


if __name__ == "__main__":
    main()
