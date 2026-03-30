#!/usr/bin/env python3

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = PROJECT_ROOT / "apps" / "desktop" / "src-tauri" / "icons"

PNG_SIZES = {
    "32x32.png": 32,
    "128x128.png": 128,
    "128x128@2x.png": 256,
    "icon.png": 512,
    "Square30x30Logo.png": 30,
    "Square44x44Logo.png": 44,
    "Square71x71Logo.png": 71,
    "Square89x89Logo.png": 89,
    "Square107x107Logo.png": 107,
    "Square142x142Logo.png": 142,
    "Square150x150Logo.png": 150,
    "Square284x284Logo.png": 284,
    "Square310x310Logo.png": 310,
    "StoreLogo.png": 50,
}

ICO_SIZES = [(16, 16), (20, 20), (24, 24), (32, 32), (40, 40), (48, 48), (64, 64), (128, 128), (256, 256)]


def main() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)

    for filename, size in PNG_SIZES.items():
        render_icon(size).save(ICON_DIR / filename, format="PNG")

    icon_1024 = render_icon(1024)
    icon_1024.save(ICON_DIR / "icon.icns", format="ICNS")
    icon_1024.save(ICON_DIR / "icon.ico", format="ICO", sizes=ICO_SIZES)


def render_icon(size: int) -> Image.Image:
    scale = 4
    canvas_size = size * scale
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    cream = (248, 238, 226, 255)
    amber = (216, 143, 61, 255)
    slate = (15, 21, 27, 255)
    ash = (192, 200, 196, 204)

    ring_width = round(canvas_size * 0.075)
    ring_box = inset_box(canvas_size, 0.16)
    sun_box = inset_box(canvas_size, 0.23)
    moon_box = shift_box(inset_box(canvas_size, 0.25), canvas_size * 0.14, canvas_size * 0.03)
    slit_box = (
        round(canvas_size * 0.24),
        round(canvas_size * 0.61),
        round(canvas_size * 0.52),
        round(canvas_size * 0.68),
    )

    draw.ellipse(ring_box, outline=cream, width=ring_width)
    draw.ellipse(sun_box, fill=amber)
    draw.ellipse(moon_box, fill=slate)
    draw.rounded_rectangle(slit_box, radius=round(canvas_size * 0.03), fill=ash)

    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def inset_box(size: int, inset_ratio: float) -> tuple[int, int, int, int]:
    inset = round(size * inset_ratio)
    return (inset, inset, size - inset, size - inset)


def shift_box(
    box: tuple[int, int, int, int], x_offset: float, y_offset: float
) -> tuple[int, int, int, int]:
    dx = round(x_offset)
    dy = round(y_offset)
    return (box[0] + dx, box[1] + dy, box[2] + dx, box[3] + dy)


if __name__ == "__main__":
    main()
