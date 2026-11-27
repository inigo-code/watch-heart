"""Turn a Gemini mascot drawing on a white background into the app's sticker: cut out, cream edge, WebP.

    python scripts/mascot-sticker.py IN.png assets/mascot/NAME.webp [LONG_SIDE]

LONG_SIDE is 1024 by default (the app, and the website at normal zoom); the website also has a 2048 copy,
NAME-2048.webp, for zoomed-in and high-density screens.

Needs Pillow and numpy (Frame Heart's .venv has both). Run Frame Heart on the PNG first if it carries the
Gemini sparkle. Steps:
1. The background is everything near-white and grey (not cream) that joins the picture's corners.
2. Pockets of background she encloses (between her hair and neck) are found as wide near-white areas
   that survive a shrink, so her eye whites and teeth stay.
3. A thin cream edge (#F4EFE6), about 0.3% of the height, grows around her so black hair reads on dark pages.
4. Cropped, scaled so the longer side is LONG_SIDE, saved as WebP (quality 86).
"""

import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

CREAM = np.array([244, 239, 230], np.float32)


def sticker(src: str, dst: str, long_side: int = 1024) -> None:
    a = np.asarray(Image.open(src).convert('RGB')).astype(np.int16)
    h, w = a.shape[:2]
    mn, mx = a.min(2), a.max(2)
    loose = (mn >= 222) & ((mx - mn) <= 20)

    # 1. Background joined to the corners.
    m = Image.fromarray(loose.astype(np.uint8) * 255).copy()
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if m.getpixel(seed) == 255:
            ImageDraw.floodfill(m, seed, 128, thresh=0)
    fg = np.asarray(m) != 128

    # 2. Enclosed pockets: pure near-white, wider than an eye's white.
    strict = fg & (mn >= 236) & ((mx - mn) <= 6)
    small = Image.fromarray((strict * 255).astype(np.uint8)).resize((w // 4, h // 4), Image.BOX)
    small = small.point(lambda v: 255 if v > 200 else 0).filter(ImageFilter.MinFilter(7))
    m = Image.fromarray((loose & fg).astype(np.uint8) * 255).copy()
    for y, x in np.argwhere(np.asarray(small) > 0) * 4 + 2:
        if m.getpixel((int(x), int(y))) == 255:
            ImageDraw.floodfill(m, (int(x), int(y)), 128, thresh=0)
    fg &= np.asarray(m) != 128

    # 3. The cream edge.
    blur = np.asarray(Image.fromarray(fg.astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(h * 0.003))).astype(np.float32) / 255
    alpha = np.maximum(np.clip((blur - 0.02) / 0.06, 0, 1), fg)
    col = np.where(fg[..., None], a.astype(np.float32), CREAM)
    im = Image.fromarray(np.dstack([col, alpha * 255]).astype(np.uint8), 'RGBA')

    # 4. Crop, scale, save.
    bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    pad = 8
    im = im.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(w, bb[2] + pad), min(h, bb[3] + pad)))
    s = long_side / max(im.size)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=86, method=6)
    print(dst, im.size)


if __name__ == '__main__':
    sticker(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 1024)
