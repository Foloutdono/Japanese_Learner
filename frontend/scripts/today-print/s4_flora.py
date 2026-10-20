"""S⁴ · the crape myrtle, three ways to choose from (plan 261, the canvas
"Tsuji — Today, the seasons", round 4). Round 3 crowned it with upright
pink cones on green pads: candles on a hedge. The owner's own photo of
the tree, and the kachō-e that draw it, show something else:

- photo: as the owner's photo has it. A broad dome of small dark leaves
  on a vase of stems that fork and fork again, the branches showing
  under the crown; the flowers in frothy heaps of crinkled florets over
  its top and its sunny side, lilac-pink to magenta, a few panicles'
  tips standing out of the dome.
- kacho: as Nakayama Sugakudō draws it (百日紅, kachō-e): one sculpted
  trunk, pale and smooth, twisting, its hollows grey; crooked limbs; at
  their ends round heaps of tiny crimson florets among small paired
  leaves, the sky between them.
- flat: as a shin-hanga block would cut it: a few big shapes, the leaves
  in two greens, the flowers in broad pink masses lit at the top and
  soft at the edge, the stems pale; what reads at a glance.

`variant={'myrtle': name}`; left out, round 3's (s3_flora)."""
import math
import random
from geo import f
from el7 import limb, lit_band, mix
from s1_air import _faller
from s1_flora import scallop, dot, blob
import s3_flora
from s3_flora import defs, plates, _fallen

__all__ = ['tree', 'defs', 'MYRTLES']

MYRTLES = ('photo', 'kacho', 'flat')

# where each frame's tree stands: the phone's units, scaled about its
# crown for the desk (as s3_flora's)
ANCHOR = s3_flora.ANCHOR
LIGHT = (-0.6, -0.8)

INK = {
    # leaves (lit, mid, deep, inside); flowers (light, lilac, pink,
    # magenta, deep); bark (skin, cinnamon, grey, cream, shade)
    'day': (('#5f9a50', '#3c703e', '#24492c', '#16321f'),
            ('#fbd2e8', '#e9a0d2', '#e070b4', '#c84893', '#8e2a6a'),
            ('#bea488', '#9c6644', '#8a847e', '#e2d4bc', '#6c5a48')),
    'dawn': (('#58745a', '#3d5a44', '#24382c', '#18261e'),
             ('#f4cbdc', '#d898c2', '#c86aa2', '#a84a84', '#6a2c58'),
             ('#7c6a68', '#6a4c44', '#5e5a62', '#9a8682', '#3c3034')),
    'dusk': (('#425a48', '#30443a', '#1c2a24', '#121c18'),
             ('#e6b2cc', '#b67ea8', '#a85a90', '#86406e', '#4e2446'),
             ('#5e4e52', '#4c3a3c', '#4a4654', '#74626a', '#2a2228')),
    'night': (('#223030', '#1a2624', '#101a18', '#0a1210'),
              ('#9a7a98', '#7e6080', '#6a4a6a', '#56385a', '#2e1e32'),
              ('#323440', '#2a2630', '#2a2c36', '#46485a', '#16151c')),
}


def _k(L):
    (ax, ay), k = ANCHOR[L.W]

    def p(x, y):
        return ax + (x - 330) * k, ay + (y - 510) * k
    return p, k


def _sway(ax, ay, a, inner, gust, L):
    return (f'<g class="f5-gust" style="transform-origin: {f(ax)}px {f(ay)}px; --a: {f(a)}deg; {gust(ax, L.W)}">'
            f'{inner}</g>')


# ── photo: the dome on its vase of stems ───────────────────────────

def _grow(rng, x, y, ang, ln, w, depth, out, spread):
    """A stem and what forks from it: a slightly sinuous run, then two or
    three forks fanning up and out, shorter and thinner, to the crown."""
    pts = [(x, y, w)]
    cx, cy, ca = x, y, ang
    n = 4
    for i in range(n):
        ca += rng.uniform(-0.12, 0.12)
        cx, cy = cx + math.cos(ca) * ln / n, cy + math.sin(ca) * ln / n
        pts.append((cx, cy, w * (1 - 0.32 * (i + 1) / n)))
    out.append((pts, depth))
    if depth == 0:
        return
    forks = 3 if depth >= 2 else 2
    for j in range(forks):
        t = (j / (forks - 1) - 0.5) if forks > 1 else 0
        na = ang + t * spread * 2 + rng.uniform(-0.1, 0.1)
        # up more than out: pull each fork toward the sky
        na += (-math.pi / 2 - na) * 0.18
        _grow(rng, cx, cy, na, ln * rng.uniform(0.8, 0.9), w * 0.66, depth - 1, out, spread * 0.86)


def photo(L, h, o, hour, gust, uid):
    rng = random.Random(L.seed + 251)
    leaves, flowers, bark = INK[hour]
    llit, lmid, ldeep, linside = leaves
    p, k = _k(L)
    skin, cinnamon, grey, cream, dark = bark
    # the vase: a short trunk, three stems, their forks
    segs = []
    rx0, ry0 = p(367, 716)
    _grow(rng, rx0, ry0, -math.pi / 2 + 0.04, 58 * k, 8.6 * k, 3, segs, 0.42)
    wood, thin = [], []
    for pts, depth in segs:
        if pts[0][2] > 2.2 * k:
            wood.append(pts)
        else:
            thin.append(pts)
    body = []
    for pts in wood:
        body.append(f'<path d="{limb(pts, rng, wobble=0.04)}" fill="{skin}"></path>')
        for c, ds in plates(pts, rng, (cinnamon, grey, cream)).items():
            if ds:
                body.append(f'<path d="{"".join(ds)}" fill="{c}" opacity="0.85"></path>')
        body.append(f'<path d="{lit_band(pts, rng, side=-1, a=0.18, b=0.5)}" fill="{dark}" opacity="0.45"></path>')
        body.append(f'<path d="{lit_band(pts, rng, side=1, a=0.12, b=0.4)}" fill="{cream}" opacity="0.5"></path>')
    twigs = ''.join('M' + 'L'.join(f'{f(x)} {f(y)}' for x, y, _w in pts) for pts in thin)
    body.append(f'<path d="{twigs}" fill="none" stroke="{mix(skin, dark, 0.55)}" stroke-width="{f(1.1 * k)}" '
                f'stroke-linecap="round" stroke-linejoin="round"></path>')
    # the dome: the crown's outline, then its leaves in clumps, deepest
    # first, the lit ones toward the sun
    cx, cy = p(328, 510)
    RX, RY = 84 * k, 60 * k
    lx, ly = LIGHT

    def inside(x, y, m=1.0):
        u, v = (x - cx) / (RX * m), (y - cy) / (RY * m)
        # a dome: rounder on top, its underside flatter
        if v > 0:
            v *= 1.35
        return u * u + v * v <= 1

    pts = []
    step = 8 * k
    yy = cy - RY
    while yy < cy + RY:
        xx = cx - RX
        while xx < cx + RX:
            x, y = xx + rng.uniform(-0.45, 0.45) * step, yy + rng.uniform(-0.45, 0.45) * step
            if inside(x, y):
                pts.append((x, y))
            xx += step
        yy += step * 0.85
    clumps = {linside: [], ldeep: [], lmid: [], llit: []}
    for x, y in pts:
        u, v = (x - cx) / RX, (y - cy) / RY
        s = 0.5 + 0.6 * (u * lx + v * ly)
        # the dome's rim catches the light, its inside and its underside
        # stay deep
        rim = math.hypot(u, v * (1.35 if v > 0 else 1))
        r = rng.uniform(5.5, 7.5) * k
        clumps[linside].append(blob(x + 1.2 * k, y + 2 * k, r, rng, lobes=5))
        if v > 0.45 or (rim < 0.55 and rng.random() < 0.5):
            continue
        col = llit if s > 0.8 and rim > 0.6 else (lmid if s > 0.42 else ldeep)
        clumps[col].append(blob(x - lx * 1.6 * k, y - ly * 1.6 * k, r * 0.78, rng, lobes=5))
    leaf_d = []
    for x, y in pts:
        if rng.random() < 0.55:
            for _ in range(3):
                a = rng.uniform(0, 2 * math.pi)
                d = rng.uniform(3, 8) * k
                leaf_d.append(_leaf(x + math.cos(a) * d, y + math.sin(a) * d, rng.uniform(2.2, 3.2) * k, rng.uniform(0, math.pi)))
    crown = [f'<path d="{"".join(ds)}" fill="{c}"></path>' for c, ds in clumps.items() if ds]
    crown.append(f'<path d="{"".join(leaf_d)}" fill="{llit}" opacity="0.55"></path>')
    # the flowers: frothy masses over the dome's top and its sunny side,
    # each a crowd of panicles merging, the lone ones between them
    light, lilac, pink, magenta, deep = flowers
    masses = []
    for j in range(8):
        a = math.pi * (1.04 + 0.92 * (j + rng.uniform(0.2, 0.8)) / 8)
        m = rng.uniform(0.66, 0.95)
        masses.append((cx + math.cos(a) * RX * m, cy + math.sin(a) * RY * m + RY * 0.08, rng.uniform(0.8, 1.2)))
    for _ in range(3):
        masses.append((cx + rng.uniform(-0.55, 0.45) * RX, cy + rng.uniform(-0.15, 0.25) * RY, rng.uniform(0.6, 0.85)))
    heaps = []
    for mx, my, size in masses:
        tone = rng.choice((lilac, pink, pink, magenta))
        for _ in range(int(5 * size) + 1):
            heaps.append((mx + rng.uniform(-1, 1) * 13 * k * size, my + rng.uniform(-0.7, 0.6) * 8 * k * size,
                          rng.uniform(4.5, 7) * k, tone))
    for _ in range(16):
        a = rng.uniform(math.pi * 1.05, math.pi * 1.95)
        heaps.append((cx + math.cos(a) * RX * rng.uniform(0.88, 1.04), cy + math.sin(a) * RY * rng.uniform(0.9, 1.06),
                      rng.uniform(3.5, 5.5) * k, rng.choice((lilac, pink, pink, magenta))))
    fl = {c: [] for c in (deep, magenta, pink, lilac, light)}
    for x, y, r, tone in sorted(heaps, key=lambda t: t[1]):
        u, v = (x - cx) / RX, (y - cy) / RY
        _heap(x, y, r, k, rng, 0.5 + 0.6 * (u * lx + v * ly), tone, flowers, fl)
    flower = [f'<path d="{"".join(ds)}" fill="{c}"></path>' for c, ds in fl.items() if ds]
    ax, ay = p(358, 600)
    tree_ = (_fallen(L, (light, pink, magenta, deep)) +
             _sway(rx0, ry0, 0.2, ''.join(body) + _sway(ax, ay, 0.45, ''.join(crown) + ''.join(flower), gust, L), gust, L) +
             _falling(L, (pink, lilac), cx, cy, RX, RY, k))
    return tree_


def _leaf(x, y, ln, a):
    c, s = math.cos(a) * ln / 2, math.sin(a) * ln / 2
    return (f'M{f(x - c)} {f(y - s)}Q{f(x - s * 0.6)} {f(y + c * 0.6)} {f(x + c)} {f(y + s)}'
            f'Q{f(x + s * 0.6)} {f(y - c * 0.6)} {f(x - c)} {f(y - s)}Z')


def _heap(x, y, r, k, rng, s, tone, flowers, fl):
    """One heap of flowers: a panicle seen whole, its crinkled florets
    massed into a rounded cone, the tip a few florets standing up; lit
    on the sun's side, deep in its folds."""
    light, lilac, pink, magenta, deep = flowers
    lx, ly = LIGHT
    # its body, a cluster of rounds under the florets
    fl[deep].append(blob(x + 1.0 * k, y + 1.3 * k, r * 0.9, rng, lobes=6))
    fl[tone].append(blob(x, y, r * 0.84, rng, lobes=6))
    lit = mix(tone, light, 0.55)
    shade = mix(tone, deep, 0.45)
    fl.setdefault(lit, [])
    fl.setdefault(shade, [])
    for _ in range(int(22 + r / k * 1.5)):
        a = rng.uniform(0, 2 * math.pi)
        d = r * math.sqrt(rng.random())
        fx, fy = x + math.cos(a) * d, y + math.sin(a) * d * 0.9 - r * 0.15
        fr = rng.uniform(0.7, 1.25) * k
        facing = (math.cos(a) * lx + math.sin(a) * ly) * (d / r)
        if facing > 0.2 or (s > 0.75 and rng.random() < 0.3):
            fl[lit].append(dot(fx, fy, fr))
        elif facing < -0.3:
            fl[shade].append(dot(fx, fy, fr * 0.9))
        else:
            fl[tone].append(dot(fx, fy, fr))
    # the tip: a few florets standing out of the heap
    for j in range(rng.randint(2, 4)):
        fl[tone].append(dot(x + rng.uniform(-0.3, 0.3) * r, y - r * (0.85 + 0.22 * j), (1.1 - 0.18 * j) * k))


def _falling(L, inks, cx, cy, RX, RY, k):
    rng = random.Random(L.seed + 257)
    out = []
    n = 6 if L.W < 600 else 9
    for j in range(n):
        x, y = cx + rng.uniform(-0.8, 0.8) * RX, cy + rng.uniform(0.1, 0.7) * RY
        dur = rng.uniform(9, 13)
        out.append(_faller(x, y, -rng.uniform(30, 80) * k, rng.uniform(120, 170) * k, dur, dur * j / n + rng.uniform(0, 2),
                           blob(0, 0, rng.uniform(1.3, 1.8) * k, rng, lobes=5), inks[j % 2], rng))
    return ''.join(out)


# ── kacho: Sugakudō's tree ─────────────────────────────────────────

KACHO = {
    # the flowers (light, crimson, deep, buds); the trunk (cream, its
    # shade, its hollows, its line); the leaves (light, deep)
    'day': (('#f49cae', '#d8405a', '#a62a44', '#c42a42'), ('#f1e9d8', '#c9c1b2', '#9d9486', '#6f6658'), ('#80b6a0', '#4b8673')),
    'dawn': (('#e9909e', '#c04058', '#7c2238', '#a8304a'), ('#b8aaa4', '#958882', '#766a68', '#4c4246'), ('#6c8e84', '#3e6258')),
    'dusk': (('#cf7a92', '#a03856', '#5e1e36', '#8a2c46'), ('#8a7c80', '#6c6066', '#544a52', '#352e36'), ('#4f6e66', '#2e4a44')),
    'night': (('#86607a', '#6a3e58', '#3a2236', '#5a344c'), ('#4c4c58', '#3c3c48', '#30303a', '#1c1c24'), ('#2c3c3c', '#1a2828')),
}
# the trunk from its root: (x, y, width), twisting as it climbs
KTRUNK = [(366, 730, 26), (365, 720, 17.5), (360, 698, 14), (350, 676, 12.5), (342, 652, 11.5), (343, 628, 10.5), (350, 606, 9.5),
          (354, 586, 8.6), (350, 566, 7.6)]
# the limbs from the trunk's head, crooked: each its points
KLIMBS = [
    [(350, 568, 6.8), (334, 552, 5.6), (314, 536, 4.6), (292, 524, 3.6), (272, 514, 2.6)],
    [(350, 566, 6.4), (346, 544, 5.2), (338, 522, 4.2), (334, 500, 3.2), (330, 482, 2.4)],
    [(352, 568, 6.4), (366, 552, 5.2), (380, 536, 4.2), (392, 520, 3.2), (402, 506, 2.4)],
]
# the masses of flower: (x, y, r), at the limbs' ends and along them
KMASS = [(272, 502, 22), (312, 494, 24), (350, 474, 24), (392, 492, 21), (296, 526, 15), (366, 514, 16), (330, 512, 14)]
# the root flaring into the grass: (from, to) pairs, each a tapering root
# the root's buttresses, low domes either side of the foot: (x, y, rx, ry)
KROOTS = [(352, 731, 9, 4.6), (381, 731, 10, 5)]


def kacho(L, h, o, hour, gust, uid):
    rng = random.Random(L.seed + 263)
    (flit, fcrim, fdeep, fbud), (cream, shade, hollow, line), (leaf, leaf_deep) = KACHO[hour]
    p, k = _k(L)

    def P(pts):
        return [(*p(x, y), w * k) for x, y, w in pts]
    trunk = P(KTRUNK)
    limbs = [P(lm) for lm in KLIMBS]
    wood = []
    # the roots, flaring over the grass
    for x, y, rx, ry in KROOTS:
        X, Y = p(x, y)
        # a dome: its half above the ground
        wood.append(f'M{f(X - rx * k)} {f(Y)}a{f(rx * k)} {f(ry * k)} 0 0 1 {f(2 * rx * k)} 0Z')
    for pts in [trunk] + limbs:
        wood.append(limb(pts, rng, wobble=0.12))
    body = [f'<path d="{"".join(wood)}" fill="{cream}"></path>']
    # its shade and its hollows: the side away from the sun, and the
    # swirls of a trunk that twisted as it grew
    for pts in [trunk] + limbs:
        body.append(f'<path d="{lit_band(pts, rng, side=-1, a=0.1, b=0.5)}" fill="{shade}"></path>')
    swirls = []
    for pts in [trunk] + limbs[:2]:
        for i in range(1, len(pts) - 1):
            x, y, w = pts[i]
            if rng.random() < 0.75:
                dx = rng.uniform(-0.3, 0.3) * w
                swirls.append(f'M{f(x + dx - w * 0.3)} {f(y + w * 0.5)}C{f(x + dx + w * 0.3)} {f(y + w * 0.2)} '
                              f'{f(x + dx - w * 0.3)} {f(y - w * 0.3)} {f(x + dx + w * 0.25)} {f(y - w * 0.7)}')
    # the grooves, twisting round the trunk as it climbs
    grooves = []
    for g in range(2):
        pts_g = []
        for i, (x, y, w) in enumerate(trunk):
            t = i / (len(trunk) - 1)
            pts_g.append((x + math.sin(t * 5.2 + g * 2.4) * w * 0.32, y))
        grooves.append('M' + 'L'.join(f'{f(x)} {f(y)}' for x, y in pts_g))
    body.append(f'<path d="{"".join(grooves)}" fill="none" stroke="{hollow}" stroke-width="{f(1.6 * k)}" stroke-linecap="round" opacity="0.7"></path>')
    knots = ''.join(_ell(x + rng.uniform(-0.2, 0.2) * w, y, w * 0.18, w * 0.28) for x, y, w in trunk[1:-1:2])
    body.append(f'<path d="{knots}" fill="{hollow}"></path>')
    body.append(f'<path d="{"".join(swirls)}" fill="none" stroke="{line}" stroke-width="{f(0.55 * k)}" stroke-linecap="round" opacity="0.7"></path>')
    body.append(f'<path d="{"".join(wood)}" fill="none" stroke="{line}" stroke-width="{f(0.6 * k)}" opacity="0.55"></path>')
    # the grass over the foot: the roots go into the ground
    blades = []
    for _ in range(44):
        X, Y = p(366 + rng.uniform(-28, 28), 733 + rng.uniform(-1, 5))
        hgt = rng.uniform(3.5, 8) * k
        lean = rng.uniform(-2, 2) * k
        blades.append(f'M{f(X)} {f(Y)}q{f(lean * 0.4)} {f(-hgt * 0.6)} {f(lean)} {f(-hgt)}')
    body.append(f'<path d="{"".join(blades)}" fill="none" stroke="{mix(h["ground"], leaf_deep, 0.3)}" stroke-width="{f(1.5 * k)}" stroke-linecap="round"></path>')
    # the twigs off the limbs, and at their ends the buds in chains
    twigs, buds = [], []
    for pts in limbs:
        for t in (0.45, 0.7, 0.9):
            i = min(len(pts) - 2, int(t * (len(pts) - 1)))
            x, y, _w = pts[i]
            a = -math.pi / 2 + rng.uniform(-1.2, 1.2)
            ln = rng.uniform(10, 18) * k
            ex, ey = x + math.cos(a) * ln, y + math.sin(a) * ln
            twigs.append(f'M{f(x)} {f(y)}Q{f(x + math.cos(a + 0.4) * ln * 0.5)} {f(y + math.sin(a + 0.4) * ln * 0.5)} {f(ex)} {f(ey)}')
            for j in range(rng.randint(3, 6)):
                buds.append(dot(ex + rng.uniform(-2.5, 2.5) * k, ey + rng.uniform(-3, 2) * k - j * 1.6 * k, rng.uniform(0.9, 1.3) * k))
    body.append(f'<path d="{"".join(twigs)}" fill="none" stroke="{line}" stroke-width="{f(0.9 * k)}" stroke-linecap="round"></path>')
    # the leaves, in pairs, sparse among the flowers
    leaves = {leaf: [], leaf_deep: []}
    for pts in limbs:
        for x, y, w in pts[1:]:
            for side in (-1, 1):
                if rng.random() < 0.9:
                    a = rng.uniform(-2.6, -0.5) if side < 0 else rng.uniform(-2.6, -0.5) + 0.9
                    ln = rng.uniform(5.5, 8) * k
                    lxx, lyy = x + math.cos(a) * ln * 0.6, y + math.sin(a) * ln * 0.6
                    leaves[leaf if rng.random() < 0.6 else leaf_deep].append(_leaf(lxx, lyy, ln, a))
    # the flowers: each mass a froth of small heaps of tiny florets, the
    # sky between some of them, lit on the sun's side, deep under; small
    # rosettes on its rim
    lx, ly = LIGHT
    tone = {flit: [], fcrim: [], fdeep: []}
    lit_d, deep_d, rose_d = [], [], []
    for x, y, r in KMASS:
        X, Y = p(x, y)
        R = r * k
        for _ in range(int(r * 0.7)):
            a = rng.uniform(0, 2 * math.pi)
            d = R * math.sqrt(rng.random()) * 0.78
            sx, sy = X + math.cos(a) * d, Y + math.sin(a) * d * 0.82
            facing = (math.cos(a) * lx + math.sin(a) * ly) * d / R
            col = flit if facing > 0.35 else (fdeep if facing < -0.3 else fcrim)
            tone[col].append(blob(sx, sy, R * rng.uniform(0.26, 0.38), rng, lobes=6))
        for _ in range(int(r * 1.4)):
            a = rng.uniform(0, 2 * math.pi)
            d = R * math.sqrt(rng.random()) * 0.92
            fx, fy = X + math.cos(a) * d, Y + math.sin(a) * d * 0.85
            facing = (math.cos(a) * lx + math.sin(a) * ly) * d / R
            if facing > 0.0:
                lit_d.append(dot(fx, fy, rng.uniform(0.7, 1.2) * k))
            else:
                deep_d.append(dot(fx, fy, rng.uniform(0.7, 1.2) * k))
        for j in range(int(r * 0.5)):
            a = math.pi * (0.9 + 1.2 * j / max(1, int(r * 0.5) - 1)) + rng.uniform(-0.1, 0.1)
            rose_d.append(blob(X + math.cos(a) * R * 0.9, Y + math.sin(a) * R * 0.84, rng.uniform(1.6, 2.3) * k, rng, lobes=5))
    mass_d = ''.join(f'<path d="{"".join(ds)}" fill="{c}"></path>' for c, ds in tone.items() if ds)
    flower = (f'{mass_d}<path d="{"".join(rose_d)}" fill="{fcrim}"></path>'
              f'<path d="{"".join(deep_d)}" fill="{fdeep}" opacity="0.8"></path><path d="{"".join(lit_d)}" fill="{flit}"></path>'
              f'<path d="{"".join(buds)}" fill="{fbud}"></path>')
    for x, y, r in KMASS:
        X, Y = p(x, y)
        for _ in range(int(r * 0.5)):
            a = rng.uniform(0, 2 * math.pi)
            ln = rng.uniform(5.5, 8) * k
            leaves[leaf if rng.random() < 0.55 else leaf_deep].append(
                _leaf(X + math.cos(a) * r * k * 1.02, Y + math.sin(a) * r * k * 0.9, ln, a + rng.uniform(-0.5, 0.5)))
    leaf_s = ''.join(f'<path d="{"".join(ds)}" fill="{c}"></path>' for c, ds in leaves.items() if ds)
    rx0, ry0 = trunk[0][0], trunk[0][1]
    ax, ay = trunk[-1][0], trunk[-1][1]
    return (_fallen(L, (flit, fcrim, fdeep, fbud)) +
            _sway(rx0, ry0, 0.15, ''.join(body) + _sway(ax, ay, 0.4, leaf_s + flower, gust, L), gust, L))


def _ell(x, y, rx, ry):
    return f'M{f(x - rx)} {f(y)}a{f(rx)} {f(ry)} 0 1 0 {f(2 * rx)} 0a{f(rx)} {f(ry)} 0 1 0 {f(-2 * rx)} 0Z'


# ── flat: a few big shapes ────────────────────────────────────────

FLAT = {
    # leaves (light, deep); flowers (top, foot, florets); stems (skin, shade)
    'day': (('#4f8c48', '#2c5a33'), ('#f6a6cc', '#d9549a', '#fbd3e6'), ('#d2bea2', '#9c8468')),
    'dawn': (('#476a4c', '#2a4232'), ('#e8a2c0', '#bc5a8c', '#f4cadc'), ('#857470', '#5c4c4a')),
    'dusk': (('#3a5242', '#22342c'), ('#cc86ac', '#93467a', '#e6b2cc'), ('#625256', '#3e3236')),
    'night': (('#1e2c2a', '#121c1c'), ('#8a6a88', '#5a3c5a', '#a68aa4'), ('#363844', '#24242e')),
}


def flat(L, h, o, hour, gust, uid):
    rng = random.Random(L.seed + 271)
    (lg, ld), (ftop, ffoot, fdot), (skin, sshade) = FLAT[hour]
    p, k = _k(L)
    stems = [[(*p(x, y), w * k * 1.35) for x, y, w in st] for st in s3_flora.STEMS]
    body = ''.join(f'<path d="{limb(st, rng, wobble=0.04)}" fill="{skin}"></path>'
                   f'<path d="{lit_band(st, rng, side=-1, a=0.15, b=0.5)}" fill="{sshade}" opacity="0.6"></path>' for st in stems)
    cx, cy = p(330, 508)
    gid = f'{uid}MyF'
    grad = (f'<linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{ftop}"></stop>'
            f'<stop offset="1" stop-color="{ffoot}"></stop></linearGradient>')
    greens = [(-46, 18, 50, 26, ld), (34, 16, 52, 28, ld), (-10, 4, 70, 34, lg), (52, -6, 34, 24, lg), (-62, 0, 30, 20, lg)]
    pinks = [(-40, -14, 26, 17), (-6, -28, 30, 19), (32, -20, 26, 17), (60, -4, 20, 14), (-66, 6, 18, 12), (8, -2, 22, 14), (36, 6, 18, 12)]
    shapes = [f'<path d="{scallop(cx + dx * k, cy + dy * k, rx * k, ry * k, rng, depth=0.42)}" fill="{c}"></path>' for dx, dy, rx, ry, c in greens]
    flowers = []
    dots = []
    for dx, dy, rx, ry in pinks:
        X, Y = cx + dx * k, cy + dy * k
        flowers.append(f'<path d="{scallop(X, Y, rx * k, ry * k, rng, depth=0.5)}" fill="url(#{gid})"></path>')
        for _ in range(int(rx * 0.5)):
            a = rng.uniform(math.pi * 1.05, math.pi * 1.95)
            dots.append(dot(X + math.cos(a) * rx * k * rng.uniform(0.2, 0.8), Y + math.sin(a) * ry * k * rng.uniform(0.2, 0.8), rng.uniform(0.9, 1.4) * k))
    rx0, ry0 = stems[0][0][0], stems[0][0][1]
    ax, ay = p(352, 600)
    crown = ''.join(shapes) + ''.join(flowers) + f'<path d="{"".join(dots)}" fill="{fdot}"></path>'
    return (f'<defs>{grad}</defs>' + _fallen(L, (fdot, ftop, ffoot, ffoot)) +
            _sway(rx0, ry0, 0.2, body + _sway(ax, ay, 0.45, crown, gust, L), gust, L))


def tree(L, h, o, hour, gust, uid):
    if o.get('tree') == 'sarusuberi':
        m = o.get('myrtle')
        if m == 'photo':
            return photo(L, h, o, hour, gust, uid)
        if m == 'kacho':
            return kacho(L, h, o, hour, gust, uid)
        if m == 'flat':
            return flat(L, h, o, hour, gust, uid)
    return s3_flora.tree(L, h, o, hour, gust, uid)
