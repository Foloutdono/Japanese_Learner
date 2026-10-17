"""The desk's painted platform as parts (plan 244), so each hour can light
them on their own, as parts.py does for the phone's: the sky and its
clouds, the land under it (Fuji's snow, the far hills, the forest), the
canopy and its lamps, the wires, the platform and its tactile strip; on
the cars, their roof, side, glass, the lit inside of the open door and
its far window, and the underframe; in front, the pillars, the pillar's
sign and the bench. The hanging sign (辻駅) is a part of its own.

The scene is desk_cut's: one px to a unit, rows from the canopy's top."""
import numpy as np
import cv2

from desk_cut import (BENCH, CAR, DOORWAY, FLOOR, LAMPS, P0, PILLARS, PILLAR_FOOT, ROOF,
                      SIGN, SIGN_RODS, STRIPE, H, W)

SKY_TOP = 88                  # the sky's top, between the lamps
HORIZON = 330                 # where the sky meets the far hills, for the hours' gradient
LAND_FROM = 240               # no land higher than this (Fuji's summit is at 263)
# Fuji's outline, traced on the painting (x, y): the land begins under it
FUJI = [(552, 334), (580, 318), (600, 309), (620, 300), (640, 292), (660, 283), (670, 278), (680, 268),
        (685, 265), (690, 263), (700, 263), (708, 265), (715, 268), (725, 275), (740, 283), (760, 293),
        (780, 300), (798, 306), (854, 318), (880, 326)]
FUJI_SNOW = 318               # the snow ends above this row
CLOCK_ROD = (755, 40, 771, 117)
LAMP_ROWS = (78, 100)         # a lamp's housing and its tube
TUBE_ROWS = (86, 99)
WIRES = (150, 196)
TACTILE = (730, 753)          # the tactile strip's rows, the whole platform's length
PILLAR_SIGN = (299, 236, 346, 444)   # 富士見台, on the first pillar
# the car layer's rows (the scene's less CAR[0])
ROOF_BAND = 420 - CAR[0]      # the roof's curve, over the windows
UNDER = 706 - CAR[0]          # the skirt and the underframe, under the doors
GLASS_TOP = 471 - CAR[0]      # a window's glass begins here, its transom over its panes


def lum(rgb):
    return rgb[..., 0] * 0.3 + rgb[..., 1] * 0.59 + rgb[..., 2] * 0.11


def sat(rgb):
    mx, mn = rgb.max(-1), rgb.min(-1)
    return np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0)


def box(shape, x0, y0, x1, y1):
    m = np.zeros(shape, bool)
    m[max(y0, 0):max(y1, 0), max(x0, 0):max(x1, 0)] = True
    return m


def pillars(shape, rows=None):
    """The pillars' bands (and the frame's at the left edge), all rows or `rows`."""
    m = np.zeros(shape, bool)
    for x0, x1 in (P0,) + PILLARS:
        m[:, x0:x1] = True
    if rows is not None:
        keep = np.zeros(shape[0], bool)
        keep[rows[0]:rows[1]] = True
        m &= keep[:, None]
    return m


def horizon(rgb):
    """Per column, the row the land begins: the far hills or the forest
    (darker and less blue than the sky), or Fuji under its outline."""
    L = lum(rgb)
    r = rgb[..., 0]
    land = (r < 0.53) & (L < 0.72)
    land[:LAND_FROM] = False
    land[ROOF:] = True
    first = np.argmax(land, axis=0).astype(np.float32)
    fx = np.array([p[0] for p in FUJI], np.float32)
    fy = np.array([p[1] for p in FUJI], np.float32)
    cols = np.arange(rgb.shape[1], dtype=np.float32)
    fuji = np.where((cols >= fx[0]) & (cols <= fx[-1]), np.interp(cols, fx, fy), np.inf)
    h = np.minimum(first, fuji)
    # the pillars stand in front: their columns take their neighbours' line
    cut = pillars(rgb.shape[:2])[0]
    h[cut] = np.interp(cols[cut], cols[~cut], h[~cut])
    # a lone dark pixel in the sky (a bird, a wire's post) is not the land
    k = 9
    pad = np.pad(h, k, mode='edge')
    med = np.median(np.lib.stride_tricks.sliding_window_view(pad, 2 * k + 1), axis=1)
    return np.where(np.abs(h - med) > 14, med, h).astype(np.float32)


def scene(bg):
    """The scene's parts, as Lighter.scene reads them, over bg (RGB 0..1)."""
    rgb = bg
    shape = rgb.shape[:2]
    L, S = lum(rgb), sat(rgb)
    yy = np.arange(H)[:, None]
    h = horizon(rgb)
    front = pillars(shape, (0, PILLAR_FOOT))
    sign = box(shape, *SIGN)
    rods = np.zeros(shape, bool)
    for b in SIGN_RODS + (CLOCK_ROD,):
        rods |= box(shape, *b)
    rods &= L < 0.6

    lamp_box = np.zeros(shape, bool)
    tube = np.zeros(shape, bool)
    for x0, x1 in LAMPS:
        lamp_box |= box(shape, x0 - 12, LAMP_ROWS[0], x1 + 12, LAMP_ROWS[1])
        tube |= box(shape, x0, TUBE_ROWS[0], x1, TUBE_ROWS[1])
    tube &= (L > 0.8) & (S < 0.25) & ~front
    canopy = (yy < SKY_TOP) | (lamp_box & ~tube & (L < 0.62)) | rods
    canopy &= ~front & ~sign & ~tube

    sky_like = ((rgb[..., 2] - rgb[..., 0] > 0.17) & (L > 0.62)) | ((L > 0.86) & (S < 0.12))
    sky = (yy >= SKY_TOP) & (yy < h[None, :]) & ~front & ~sign & ~canopy & ~tube
    land = (yy >= h[None, :]) & (yy < ROOF) & ~front
    wires = box(shape, 0, WIRES[0], W, WIRES[1]) & ~sky_like & ~land & ~front & ~sign & ~canopy
    sky &= ~wires
    clouds = sky & (S < 0.16) & (L > 0.78)

    fx = np.array([p[0] for p in FUJI], np.float32)
    snow = land & box(shape, int(fx[0]), 0, int(fx[-1]), FUJI_SNOW) & (L > 0.72) & (S < 0.3)
    mount = land & ~snow & (yy < 352) & (rgb[..., 2] > rgb[..., 1] + 0.02) & (rgb[..., 1] > rgb[..., 0])
    forest = land & ~snow & ~mount

    bench = bench_mask(rgb)
    platform = box(shape, 0, FLOOR[0], W, FLOOR[1]) & ~bench & ~pillars(shape, (0, PILLAR_FOOT))
    tactile = platform & box(shape, 0, TACTILE[0], W, TACTILE[1])
    return dict(sky=sky, clouds=clouds, land=land, snow=snow, mount=mount, forest=forest, canopy=canopy,
                tube=tube, wires=wires, platform=platform, tactile=tactile, horizon=h, sign=sign, bench=bench)


BENCH_FOOT = 846              # the bench's legs reach the platform here


def bench_mask(rgb):
    """The bench where it stands on the platform: its wood (warm) and its
    dark frame, in its box, never the tactile strip's yellow behind it."""
    x0, y0, x1, _ = BENCH
    L = lum(rgb)
    warm = (rgb[..., 0] - rgb[..., 2] > 0.1) & (sat(rgb) > 0.22) & (L < 0.8)
    dark = L < 0.3
    m = box(rgb.shape[:2], x0, y0, x1, BENCH_FOOT) & (warm | dark)
    m &= ~(box(rgb.shape[:2], 0, TACTILE[0], W, TACTILE[1]) & warm & (L > 0.55))
    return cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0


def car(a, open_door):
    """A car layer's parts, as Lighter.car reads them (a: RGBA 0..1)."""
    rgb, al = a[..., :3], a[..., 3]
    shape = rgb.shape[:2]
    on = al > 0.02
    rows = np.arange(shape[0])[:, None]
    roof = on & (rows < ROOF_BAND)
    under = on & (rows >= UNDER)
    side = on & ~roof & ~under
    # the windows: the trees seen through them (green), whole, with the
    # glass's own edge; never the stripe
    g = rgb
    tree = side & (g[..., 1] > g[..., 0] + 0.04) & (g[..., 1] > g[..., 2] - 0.02) & (sat(g) > 0.2)
    tree &= ~((rows >= STRIPE[0] - CAR[0] - 2) & (rows < STRIPE[1] - CAR[0] + 2))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(tree.astype(np.uint8), 8)
    glass = np.zeros(shape, bool)
    for k in range(1, n):
        x, y, w, h, area = stats[k]
        if area < 400 or h < 30:
            continue
        glass[min(y, GLASS_TOP):y + h, x:x + w] = True
    glass = cv2.dilate(glass.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    glass &= side
    inside = np.zeros(shape, bool)
    far = np.zeros(shape, bool)
    if open_door:
        x0, y0, x1, y1 = DOORWAY
        inside = box(shape, x0, y0 - CAR[0], x1, y1 - CAR[0]) & on
        far = inside & glass
        glass &= ~inside
    body = side & ~glass & ~inside
    return dict(roof=roof, under=under, glass=glass, inside=inside & ~far, far=far, body=body)


def near(a):
    """The near layer's parts: the pillars (the pillar's sign apart) and the bench."""
    rgb = a[..., :3]
    shape = rgb.shape[:2]
    sign = box(shape, *PILLAR_SIGN)
    pil = pillars(shape, (0, PILLAR_FOOT)) & ~sign
    bench = (a[..., 3] > 0.02) & ~pil & ~sign
    return dict(pillars=pil, sign=sign, bench=bench)
