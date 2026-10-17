"""The desk's painted platform (plan 244), cut from the owner's painting.

source/desk.webp is the owner's picture of the desk gate as they want it:
the station painted wide at Today's day hour, with the board of option B
of the canvas "Tsuji — Practice on the desk" drawn over its right side,
the gate button on the platform and the canvas frame's name strip along
its top. It is 1579 x 996 px; the scene is its rows 56..995, one px to a
unit, and everything below is measured in the scene's units.

  clean    the name strip cut off; the gate button, the clock's face (the
           app draws both) painted out; the platform under the board drawn
           again from the painting's own bays (its canopy at the rafters'
           repeat, its sky and floor mirrored at the seam, the car carried
           along its doors and windows, the middle pillar carried one bay
           on, where the painting shows its top); and one bay more past the
           painting's right edge, so a wide window is filled by the scene
           rather than by a crop of its height
  layers   bg (the scene, the roof's gear painted out: the car carries it),
           car (the standing car, its door open), car2 (the same car, its
           door shut: the cars before and after it), near (the pillars,
           the pillar's sign and the bench, in front), the shut door's two
           leaves (the app slides them), and the stripe's masks, over which
           the app lays the line's pigment

Every pixel is the painting's own, copied or drawn on from it."""
import numpy as np
import cv2
from PIL import Image

TOP = 56                      # the name strip's last row + 1
PAINTED = 1579                # the painting's width
W = 2127                      # the scene's: one bay more
H = 940
SEAM = 1140                   # past it, the painting is the board's
BAY = 548                     # a bay, pillar to pillar (P2 to P3)
# a pillar's band (x0, x1), its face and its rim; P3 is the painting's own
# (its top shows over the board), P4 is P3 a bay on
PILLARS = ((296, 355), (798, 854), (1346, 1402), (1894, 1950))
P0 = (0, 10)                  # the frame's own pillar, at the painting's left edge
PILLAR_FOOT = 796             # the pillars' bases end here; their reflections are the floor's
# the scene's bands, in rows
CANOPY = (0, 108)             # the roof, its beam and the lamps' row
SKY = (108, 338)              # the sky, the wire, the hills and the forest
CAR = (338, 726)              # the car, from its roof gear to its skirt
ROOF = 396                    # the car's roof line: its gear stands above it
FLOOR = (726, 940)            # the tactile strip and the platform
# what the app draws, painted out
BUTTON = dict(x0=378, x1=814, y0=801, y1=892)
CLOCK = dict(cx=763, cy=156, r=41)
# the lamps, the sign under the canopy, the gear on the roof
LAMP = (868, 1097)            # the lamp the painting shows whole in the board's bay
LAMPS_ON = (1262, 1656, 2050)  # where it hangs again past the seam
LAMPS = ((53, 212), (466, 708), (880, 1085), (1274, 1479), (1668, 1873), (2062, W))  # the tubes
SIGN = (8, 109, 233, 196)     # x0, y0, x1, y1: 辻駅 TSUJI STATION, on its two rods
SIGN_RODS = ((34, 50, 48, 112), (210, 50, 224, 112))
GEAR = ((398, 336, 534, 398), (566, 364, 752, 398))
# the car's own parts
DOORWAY = (384, 448, 592, 705)     # the open door's opening
SHUT = (984, 448, 1140, 705)       # the shut door, its two leaves
STRIPE = (601, 633)                # the stripe's rows
BENCH = (0, 600, 92, 726)          # the bench, where it stands in front of the car


def shiftmap(work, hole, pad=24):
    """xphoto's shift-map over `work` (RGB), filling `hole` from the rest.
    The work is framed in a margin of itself, mirrored, so no part of the
    hole lies on its edge (shift-map leaves such pixels unfilled)."""
    big = cv2.copyMakeBorder(np.ascontiguousarray(work), pad, pad, pad, pad, cv2.BORDER_REFLECT)
    known = cv2.copyMakeBorder(np.where(hole, 0, 255).astype(np.uint8), pad, pad, pad, pad,
                               cv2.BORDER_CONSTANT, value=255)
    lab = cv2.cvtColor(big, cv2.COLOR_RGB2Lab)
    dst = np.zeros_like(lab)
    cv2.xphoto.inpaint(lab, known, dst, cv2.xphoto.INPAINT_SHIFTMAP)
    out = cv2.cvtColor(dst, cv2.COLOR_Lab2RGB)[pad:-pad, pad:-pad]
    return np.where(hole[..., None], out, work)


def pill(shape, b, grow=4):
    m = np.zeros(shape, np.uint8)
    r = (b['y1'] - b['y0']) // 2
    cy = (b['y0'] + b['y1']) // 2
    cv2.rectangle(m, (b['x0'] + r, b['y0']), (b['x1'] - r, b['y1']), 255, -1)
    cv2.circle(m, (b['x0'] + r, cy), r, 255, -1)
    cv2.circle(m, (b['x1'] - r, cy), r, 255, -1)
    return cv2.dilate(m, np.ones((2 * grow + 1, 2 * grow + 1), np.uint8)) > 0


def carried(S, rows, x0, x1, shift):
    """S[rows, x0:x1] as the band `shift` columns to its left, column by
    column, so a run longer than the shift repeats what it has just drawn."""
    r0, r1 = rows
    for x in range(x0, x1):
        S[r0:r1, x] = S[r0:r1, x - shift]


def clean(path):
    """The painting as the scene: H x W, RGB uint8."""
    im = np.asarray(Image.open(path).convert('RGB'))[TOP:TOP + H, :PAINTED]
    S = np.zeros((H, W, 3), np.uint8)
    S[:, :PAINTED] = im
    P1, P2, P3, P4 = PILLARS

    # ── the button: P2's reflection drawn down through it, then the floor
    #    round it by shift-map, over the bay it stands in ──
    hole = pill((H, W), BUTTON)
    r0, r1 = FLOOR
    ys = np.nonzero(hole[:, P2[0]:P2[1]].any(axis=1))[0]
    if ys.size:
        a, b = ys.min() - 1, ys.max() + 1
        t = np.linspace(0, 1, b - a + 1)[:, None]
        for x in range(P2[0], P2[1]):
            if hole[:, x].any():
                S[a:b + 1, x] = (S[a, x] * (1 - t) + S[b, x] * t).astype(np.uint8)
    hole[:, P2[0]:] = False
    lo, hi = P1[1] + 1, SEAM
    S[r0:r1, lo:hi] = shiftmap(S[r0:r1, lo:hi].copy(), hole[r0:r1, lo:hi])

    # ── the clock's face: the sky and the wire 88 px to its left, the same
    #    rows (its shadow too); the rod over it and the pillar stay ──
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.sqrt((xx - CLOCK['cx']) ** 2 + (yy - CLOCK['cy']) ** 2)
    a = np.clip((CLOCK['r'] + 6 - d) / 5, 0, 1).astype(np.float32)
    a[:CLOCK['cy'] - CLOCK['r'] - 4] = 0
    a[:, P2[0] - 1:] = 0
    src = np.roll(S, 88, axis=1)
    S[:] = (S * (1 - a[..., None]) + src * a[..., None]).astype(np.uint8)

    # ── the canopy past the seam: its slats and beam at the rafters' own
    #    repeat; under them the lamps' row, plain, and a lamp a bay ──
    carried(S, (0, 70), SEAM, W, 192)
    carried(S, (70, CANOPY[1]), SEAM, W, 43)
    for x0 in LAMPS_ON:
        n = min(LAMP[1] - LAMP[0], W - x0)
        S[62:100, x0:x0 + n] = S[62:100, LAMP[0]:LAMP[0] + n]

    # ── the sky down to the car's roof, and the floor: the bay beside,
    #    mirrored at the seam so it runs on; past P3, the bay beside
    #    carried along ──
    n = P3[0] - SEAM
    for r0, r1 in ((SKY[0], ROOF), FLOOR):
        S[r0:r1, SEAM:P3[0]] = S[r0:r1, SEAM - n:SEAM][:, ::-1]
        carried(S, (r0, r1), P3[1], W, P3[1] - (P2[1] + 2))

    # ── the car past the seam: its doors and windows carried along ──
    carried(S, (ROOF, CAR[1]), SEAM, W, 545)

    # ── P3 and P4: the middle pillar's band, carried a bay along with its
    #    base and its reflection on the floor ──
    for x0, x1 in (P3, P4):
        S[:, x0 - 2:x1 + 1] = S[:, P2[0] - 2:P2[1] + 1]
    return S


# ── the layers ──────────────────────────────────────────────────────────

def lum(rgb):
    return rgb[..., 0] * 0.3 + rgb[..., 1] * 0.59 + rgb[..., 2] * 0.11


def sat(rgb):
    mx, mn = rgb.max(-1), rgb.min(-1)
    return np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0)


def gear_mask(S):
    """The roof's gear against the forest behind it: grey or dark, never green."""
    f = S.astype(np.float32) / 255
    L, Sa = lum(f), sat(f)
    m = np.zeros(S.shape[:2], np.uint8)
    for x0, y0, x1, y1 in GEAR:
        box = np.zeros_like(m)
        box[y0:y1, x0:x1] = 1
        m |= (box & ((Sa < 0.16) | (L < 0.3))).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    m[ROOF:] = 0
    return m > 0


def widened(leaf, at, n):
    """A shut leaf made the open doorway's half: `n` columns of its plain
    steel (the column `at`) let in, so its window keeps its width."""
    return np.concatenate([leaf[:, :at], np.repeat(leaf[:, at:at + 1], n, axis=1), leaf[:, at:]], axis=1)


def layers(S):
    """The scene's layers: bg (RGB), car / car2 / near (RGBA), the leaves
    (RGB) and the stripe's masks (0..1)."""
    # the scene without the roof's gear: the forest and the hills behind it
    gm = cv2.dilate(gear_mask(S).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    gm[ROOF + 2:] = False
    r0, r1, c0, c1 = 250, ROOF + 6, PILLARS[0][1] + 3, PILLARS[1][0] - 3
    bg = S.copy()
    bg[r0:r1, c0:c1] = shiftmap(S[r0:r1, c0:c1].copy(), gm[r0:r1, c0:c1])

    # the car: what the pillars and the bench hide of it drawn on, from the
    # car round each (its wall, its stripe, its windows' frames run on)
    car = S.copy()
    r0, r1 = ROOF - 4, CAR[1]
    car[r0:r1, P0[0]:P0[1] + 2] = car[r0:r1, P0[1] + 2:2 * P0[1] + 4][:, ::-1]
    for x0, x1 in PILLARS:
        c0, c1 = max(x0 - 140, 0), min(x1 + 140, W)
        hole = np.zeros((r1 - r0, c1 - c0), bool)
        hole[:, x0 - 2 - c0:x1 + 2 - c0] = True
        car[r0:r1, c0:c1] = shiftmap(car[r0:r1, c0:c1].copy(), hole)
    bx0, by0, bx1, _ = BENCH
    car[by0:CAR[1], bx0:bx1] = car[by0:CAR[1], bx0 + 96:bx1 + 96]
    al = np.zeros(S.shape[:2], np.float32)
    al[gear_mask(S)] = 1
    al = cv2.GaussianBlur(al, (3, 3), 0)
    al[ROOF:CAR[1]] = 1

    # the shut door, its two leaves widened to the open doorway's halves
    x0, y0, x1, y1 = SHUT
    shut = car[y0:y1, x0:x1]
    half = (x1 - x0) // 2
    gap = (DOORWAY[2] - DOORWAY[0]) // 2 - half
    leaf_l = widened(shut[:, :half], 10, gap)
    leaf_r = widened(shut[:, half:], half - 10, gap)
    car2 = car.copy()
    car2[DOORWAY[1]:DOORWAY[3], DOORWAY[0]:DOORWAY[2]] = np.concatenate([leaf_l, leaf_r], axis=1)

    # in front of the car: the frame, the pillars to their feet (the
    # pillar's sign with them), the bench where it stands before the car
    near_a = np.zeros(S.shape[:2], np.float32)
    near_a[:PILLAR_FOOT, P0[0]:P0[1]] = 1
    for x0, x1 in PILLARS:
        near_a[:PILLAR_FOOT, x0:x1] = 1
    bx0, by0, bx1, by1 = BENCH
    diff = np.abs(S[by0:by1, bx0:bx1].astype(np.int16) - car[by0:by1, bx0:bx1].astype(np.int16)).max(axis=2)
    bench = (diff > 34).astype(np.uint8)
    bench = cv2.morphologyEx(bench, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    bench = cv2.morphologyEx(bench, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    near_a[by0:by1, bx0:bx1] = np.maximum(near_a[by0:by1, bx0:bx1], bench)
    near_a = cv2.GaussianBlur(near_a, (3, 3), 0)
    for x0, x1 in PILLARS:
        near_a[:PILLAR_FOOT - 2, x0 + 1:x1 - 1] = 1

    def stripe(img):
        g = img.astype(np.float32) / 255
        mx = g.max(-1)
        r, gg, b = g[..., 0], g[..., 1], g[..., 2]
        hue = np.degrees(np.arctan2(np.sqrt(3) * (gg - b), 2 * r - gg - b)) % 360
        m = np.clip(1 - np.abs(hue - 184) / 16, 0, 1) ** 0.5 * np.clip((sat(g) - 0.25) / 0.3, 0, 1)
        m *= np.clip((mx - 0.18) / 0.1, 0, 1)
        keep = np.zeros(m.shape, bool)
        keep[STRIPE[0] - 2:STRIPE[1] + 2] = True
        m[~keep] = 0
        grown = cv2.dilate(m, np.ones((3, 3), np.uint8))
        return np.maximum(m, grown * 0.55)

    cr = slice(CAR[0], CAR[1])
    return dict(
        bg=bg,
        car=np.dstack([car, (al * 255 + 0.5).astype(np.uint8)])[cr],
        car2=np.dstack([car2, (al * 255 + 0.5).astype(np.uint8)])[cr],
        near=np.dstack([S, (np.clip(near_a, 0, 1) * 255 + 0.5).astype(np.uint8)]),
        band_car=stripe(car)[cr],
        band_car2=stripe(car2)[cr],
    )
