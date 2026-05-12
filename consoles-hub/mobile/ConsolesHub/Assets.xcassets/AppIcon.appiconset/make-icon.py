#!/usr/bin/env python3
"""
Regenerates AppIcon.png — the 1024x1024 placeholder icon for consoles-hub.

Style is intentionally minimal: dark Terminal-style background, rounded inner
square in a slightly lighter shade, a `>_` zsh-prompt glyph in green. iOS
rounds the outer corners itself; we only ship the square master.

Run from anywhere:

    python3 mobile/ConsolesHub/Assets.xcassets/AppIcon.appiconset/make-icon.py

Requires `pillow`. Install via `python3 -m pip install --user pillow` if
missing. The PNG is checked into the asset catalog — running this script
again only matters when the colors or glyph change.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

SIZE = 1024
INSET = 96                  # margin from outer edge to inner rounded square
CORNER_RADIUS = 160
BG = (10, 12, 18)           # near-black, Terminal.app vibe
FG_BG = (32, 38, 50)        # slightly lighter inner panel
GLYPH = (90, 220, 130)      # zsh-prompt green
GLYPH_SIZE = 360
FONT_CANDIDATES = [
    "/System/Library/Fonts/Menlo.ttc",
    "/System/Library/Fonts/Monaco.ttf",
    "/System/Library/Fonts/Courier.ttc",
]


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def main() -> None:
    out = Path(__file__).resolve().parent / "AppIcon.png"
    img = Image.new("RGB", (SIZE, SIZE), BG)
    draw = ImageDraw.Draw(img)
    inner = (INSET, INSET, SIZE - INSET, SIZE - INSET)
    draw.rounded_rectangle(inner, radius=CORNER_RADIUS, fill=FG_BG)

    font = load_font(GLYPH_SIZE)
    # The visual centroid of ">_" sits slightly above the geometric center
    # because the underscore drops below baseline. Nudge down a hair.
    draw.text((SIZE // 2, SIZE // 2 + 20), ">_", font=font, fill=GLYPH, anchor="mm")
    img.save(out, "PNG")
    print(f"wrote {out} ({SIZE}x{SIZE})")


if __name__ == "__main__":
    main()
