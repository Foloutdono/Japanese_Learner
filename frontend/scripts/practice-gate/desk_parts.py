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
                      SIGN, SIGN_RODS, STRIPE, H, W, bases)

SKY_TOP = 88                  # the sky's top, between the lamps
HORIZON = 330                 # where the sky meets the far hills, for the hours' gradient
LAND_FROM = 240               # no land higher than this (Fuji's summit is at 263)
FOREST_SURE = 356             # the forest from here down, surely land
TOWN_FROM = 344               # the town's windows: the forest's rows where its roofs show
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
HUNG_BOX = (354, 84, 379, 122)       # the box hung beside the first pillar, under the canopy
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
    """The pillars' bands (and the frame's at the left edge) with their
    round bases, all rows or `rows`."""
    m = np.zeros(shape, bool)
    for x0, x1 in (P0,) + PILLARS:
        m[:, x0:x1] = True
    m |= bases(shape)
    if rows is not None:
        keep = np.zeros(shape[0], bool)
        keep[rows[0]:rows[1]] = True
        m &= keep[:, None]
    return m


def fuji_line(W):
    """Per column, Fuji's traced outline (inf where it is not)."""
    fx = np.array([p[0] for p in FUJI], np.float32)
    fy = np.array([p[1] for p in FUJI], np.float32)
    cols = np.arange(W, dtype=np.float32)
    return np.where((cols >= fx[0]) & (cols <= fx[-1]), np.interp(cols, fx, fy), np.inf)


def horizon(a):
    """Per column, the row the land begins (the matte's half way), the
    pillars' columns taking their neighbours' line."""
    land = a > 0.5
    land[:LAND_FROM] = False
    land[ROOF:] = True
    h = np.argmax(land, axis=0).astype(np.float32)
    cols = np.arange(a.shape[1], dtype=np.float32)
    cut = pillars(a.shape)[0]
    h[cut] = np.interp(cols[cut], cols[~cut], h[~cut])
    return h


def matte(rgb):
    """How much of each pixel is the land (Fuji, the far hills, the forest)
    rather than the sky, 0..1, and the two colours a pixel of the land's
    edge mixes: the land's (F) and the sky's (B). The hours light each on
    its own and lay them back together by it, so a tree's top, Fuji's
    slope and the far hills' ridge keep the painting's soft edge at every
    hour (cut hard by a line per column, the land's edge stood in steps,
    and what of the sky's light the edge held stood round it as a rim).

    The land is told from the sky by GrabCut, seeded by what is surely
    each (the sky high up and over Fuji's traced outline, the forest low
    down and Fuji under it); its edge is softened by a guided filter on
    the painting, then read again where the two colours differ enough,
    as the share of the way from the sky's colour to the land's."""
    H, W = rgb.shape[:2]
    y0, y1 = SKY_TOP, ROOF
    img = np.clip(rgb[y0:y1] * 255 + 0.5, 0, 255).astype(np.uint8)
    L = lum(rgb[y0:y1])
    yy = np.arange(y0, y1)[:, None] * np.ones((1, W), np.int32)
    fuji = fuji_line(W)[None, :]
    seed = np.full(img.shape[:2], cv2.GC_PR_BGD, np.uint8)
    seed[L < 0.62] = cv2.GC_PR_FGD
    seed[yy < LAND_FROM + 10] = cv2.GC_BGD
    seed[(yy < fuji - 4) & (yy < 300)] = cv2.GC_BGD
    seed[yy >= fuji + 2] = cv2.GC_FGD
    seed[yy >= FOREST_SURE] = cv2.GC_FGD
    cv2.setRNGSeed(244)
    cv2.grabCut(img[..., ::-1].copy(), seed, None, np.zeros((1, 65)), np.zeros((1, 65)), 6, cv2.GC_INIT_WITH_MASK)
    land = np.zeros((H, W), np.float32)
    land[y0:y1] = (seed == cv2.GC_FGD) | (seed == cv2.GC_PR_FGD)
    land[y1:] = 1
    a = np.clip(cv2.ximgproc.guidedFilter(rgb.astype(np.float32), land, 2, 1e-3), 0, 1)
    a[:y0] = 0
    a[y1:] = 1

    # the two colours, each spread from where it is surely itself
    front = pillars((H, W))

    def spread(sure):
        """A colour where it is surely itself, carried out from there: from
        the nearest, and from farther where nothing near is it."""
        sure = cv2.erode(sure.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(np.float32)
        out = None
        for r in (18.0, 6.0, 2.0):
            w = cv2.GaussianBlur(sure, (0, 0), r)
            c = cv2.GaussianBlur(rgb * sure[..., None], (0, 0), r) / np.maximum(w, 1e-6)[..., None]
            out = c if out is None else np.where((w >= 0.05)[..., None], c, out)
        return out

    F = spread((a > 0.97) & ~front)
    B = spread((a < 0.03) & ~front)
    d = F - B
    n2 = (d * d).sum(-1)
    seen = np.clip(((rgb - B) * d).sum(-1) / np.maximum(n2, 1e-4), 0, 1)
    k = np.clip((np.sqrt(n2) - 0.08) / 0.15, 0, 1)
    edge = (a > 0.01) & (a < 0.99)
    a = np.where(edge, seen * k + a * (1 - k), a)
    # a pixel or two of edge, never a haze
    a = np.clip((a - 0.15) / 0.7, 0, 1)
    a = a * a * (3 - 2 * a)
    return a.astype(np.float32), F.astype(np.float32), B.astype(np.float32)


def scene(bg):
    """The scene's parts, as Lighter.scene reads them, over bg (RGB 0..1)."""
    rgb = bg
    shape = rgb.shape[:2]
    L, S = lum(rgb), sat(rgb)
    yy = np.arange(H)[:, None]
    a, F, B = matte(rgb)
    h = horizon(a)
    front = pillars(shape, (0, PILLAR_FOOT))
    # the sign: its box less the sky round its frame, in the box's outer
    # ring, which the hour lights as sky (lit as the sign, it stood round it
    # as a pale rim); the letters are a cool white, and stay the sign's
    blue = (rgb[..., 2] - rgb[..., 0] > 0.15) & (L > 0.5)
    sign = box(shape, *SIGN)
    ring = sign & ~(cv2.erode(sign.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0)
    sign &= ~(blue & ring)
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
    # what hangs from the canopy into the sky's first rows, lit as the
    # canopy (lit as sky, the box's sunlit edge was a pale crescent at
    # night): the lamps' end caps, grey and joined to the canopy, and the
    # box beside P1, what of its box is not the sky
    grey = (yy < SKY_TOP + 40) & (S < 0.14) & ~front & ~sign & ~tube
    n, lab = cv2.connectedComponents(grey.astype(np.uint8), connectivity=8)
    roots = np.unique(lab[SKY_TOP - 1][grey[SKY_TOP - 1]])
    hung = np.isin(lab, roots[roots > 0]) & (yy >= SKY_TOP)
    hung = cv2.dilate(hung.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    sky_blue = (rgb[..., 2] - rgb[..., 0] > 0.17) & (L > 0.62)
    clear = cv2.erode(sky_blue.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    hung |= box(shape, *HUNG_BOX) & ~clear
    hung &= (yy >= SKY_TOP) & ~front
    canopy = (yy < SKY_TOP) | (lamp_box & ~tube & (L < 0.62)) | rods | hung
    canopy &= ~front & ~sign & ~tube

    sky_like = ((rgb[..., 2] - rgb[..., 0] > 0.17) & (L > 0.62)) | ((L > 0.86) & (S < 0.12))
    # the sky and the land overlap by the land's soft edge, where each is lit
    # from its own colour (the matte's) and the hour lays them together
    sky = (yy >= SKY_TOP) & (a < 0.999) & (yy < ROOF) & ~front & ~sign & ~canopy & ~tube
    land = (a > 0.001) & (yy < ROOF) & ~front
    wires = box(shape, 0, WIRES[0], W, WIRES[1]) & ~sky_like & ~land & ~front & ~sign & ~canopy
    sky &= ~wires
    sky_rgb = np.where((a > 0.001)[..., None], B, rgb)
    land_rgb = np.where((a < 0.999)[..., None], F, rgb)
    Ls, Ss = lum(sky_rgb), sat(sky_rgb)
    clouds = sky & (Ss < 0.16) & (Ls > 0.78)

    # the land's parts, read on its own colour: Fuji's snow (and how much
    # of a pixel is snow, so a streak's edge is soft), the mountains and
    # the far hills (blue), the forest
    Ll, Sl = lum(land_rgb), sat(land_rgb)
    fx = np.array([p[0] for p in FUJI], np.float32)
    peak = box(shape, int(fx[0]), 0, int(fx[-1]), FUJI_SNOW)
    snow = land & peak & (Ll > 0.72) & (Sl < 0.3)
    snow_w = np.clip((Ll - 0.62) / 0.2, 0, 1) * np.clip((0.36 - Sl) / 0.1, 0, 1) * (land & peak)
    snow_w = np.clip(cv2.GaussianBlur(snow_w.astype(np.float32), (0, 0), 0.6), 0, 1) * (land & peak)
    blue = (land_rgb[..., 2] > land_rgb[..., 1] + 0.02) & (land_rgb[..., 1] > land_rgb[..., 0])
    mount = land & ~snow & (yy < 352) & blue
    forest = land & ~snow & ~mount

    bench = bench_mask(rgb)
    platform = box(shape, 0, FLOOR[0], W, FLOOR[1]) & ~bench & ~pillars(shape, (0, PILLAR_FOOT))
    tactile = platform & box(shape, 0, TACTILE[0], W, TACTILE[1])
    # the far town's windows: in the forest, where its houses stand
    town = forest & (yy >= TOWN_FROM)
    return dict(sky=sky, clouds=clouds, land=land, snow=snow, mount=mount, forest=forest, canopy=canopy,
                tube=tube, wires=wires, platform=platform, tactile=tactile, horizon=h, sign=sign, bench=bench,
                matte=dict(alpha=a, sky=sky_rgb, land=land_rgb), snow_w=snow_w, town=town)


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
    # the windows: each opening, found by the trees seen through it
    # (green), out to the glass's own edge and up over its transom; never
    # the stripe
    g = rgb
    tree = side & (g[..., 1] > g[..., 0] + 0.04) & (g[..., 1] > g[..., 2] - 0.02) & (sat(g) > 0.2)
    tree &= ~((rows >= STRIPE[0] - CAR[0] - 2) & (rows < STRIPE[1] - CAR[0] + 2))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(tree.astype(np.uint8), 8)
    windows = np.zeros(shape, bool)
    for k in range(1, n):
        x, y, w, h, area = stats[k]
        if area < 400 or h < 30:
            continue
        # a window of the car's side rises over its transom; the doorway's
        # far window keeps its own top, the wall over it the inside's
        through = DOORWAY[0] <= x + w / 2 < DOORWAY[2]
        windows[y if through else min(y, GLASS_TOP):y + h, x:x + w] = True
    windows = cv2.dilate(windows.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    windows &= side
    # the glass: an opening less its mullions and transom (whole columns and
    # rows of grey steel, kept whole, so they stand against the light inside)
    # and, near its edge, less what is not coloured (the gasket, the steel at
    # its rounded corners)
    grey = sat(g) < 0.12
    glass = np.zeros(shape, bool)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(windows.astype(np.uint8), 8)
    for k in range(1, n):
        x, y, w, h, _ = stats[k]
        own = lab[y:y + h, x:x + w] == k
        low = grey[y:y + h, x:x + w] & own
        bars = np.zeros((h, w), bool)
        bars[:, low.sum(axis=0) > 0.35 * own.sum(axis=0)] = True
        bars[low.sum(axis=1) > 0.35 * own.sum(axis=1), :] = True
        bars = cv2.dilate(bars.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        core = cv2.erode(own.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
        glass[y:y + h, x:x + w] |= own & ~bars & (core | ~low)
    inside = np.zeros(shape, bool)
    far = np.zeros(shape, bool)
    if open_door:
        x0, y0, x1, y1 = DOORWAY
        inside = box(shape, x0, y0 - CAR[0], x1, y1 - CAR[0]) & on
        far = inside & glass
        glass &= ~inside
        windows &= ~inside
    body = side & ~glass & ~inside
    return dict(roof=roof, under=under, glass=glass, inside=inside & ~far, far=far, body=body, windows=windows)


def near(a):
    """The near layer's parts: the pillars (the pillar's sign apart) and the bench."""
    rgb = a[..., :3]
    shape = rgb.shape[:2]
    sign = box(shape, *PILLAR_SIGN)
    pil = pillars(shape, (0, PILLAR_FOOT)) & ~sign
    bench = (a[..., 3] > 0.02) & ~pil & ~sign
    return dict(pillars=pil, sign=sign, bench=bench)
