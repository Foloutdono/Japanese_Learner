"""S³ · the season's trees, round 3 (plan 261, the canvas "Tsuji — Today,
the seasons"). The owner chose the crape myrtle (百日紅) for summer, to
be drawn better than round 2 drew it, and the red plum (紅梅) for
winter, as round 2 drew it (s2_flora); every other season's tree is
round 2's.

百日紅 as it grows: several smooth stems from one root, rising in easy
S-curves and opening like a vase; its bark shed in plates, so the stems
are mottled cream, cinnamon and grey, and so smooth the monkeys slip
(さるすべり); small dark leaves; and at the end of every new shoot a
cone of crinkled flowers held upright over the leaves, so many in high
summer that the crown is more pink than green, for a hundred days. They
fall as they go over, and lie in the grass under it."""
import math
import random
from geo import f
from el7 import limb, lit_band, mix
from s1_air import _faller
from s1_flora import scallop, dot, blob
import s2_flora
from s2_flora import defs

__all__ = ['tree', 'defs', 'crape']

CRAPE = {
    # the leaves (lit, mid, deep); the flowers (lit, mid, deep, the sun on
    # them); the bark (its skin, its plates: cinnamon, grey, cream; the
    # shade on it)
    'day': (('#62a050', '#3f7c42', '#22502e'), ('#ff8cc4', '#e8509c', '#a92a6e', '#ffd6ea'),
            ('#cdb89c', '#a86c46', '#8f8a84', '#efe4cf', '#76624f')),
    # the foreground is in shadow at dawn and dusk and under the moon at
    # night, as the pine is (el7.PINE): the pale bark keeps its place
    # among the darks, a step above the pine's
    'dawn': (('#4c6a50', '#34503e', '#1c3026'), ('#e88ab4', '#c25a8c', '#7a2c5e', '#f8c8dc'),
             ('#7c6a68', '#6a4c44', '#5e5a62', '#9a8682', '#3c3034')),
    'dusk': (('#3a5040', '#2a3c34', '#16221e'), ('#c4689e', '#94467a', '#4e2446', '#e8a8c4'),
             ('#5e4e52', '#4c3a3c', '#4a4654', '#74626a', '#2a2228')),
    'night': (('#1e2a2a', '#162220', '#0c1414'), ('#7a5878', '#5a3c5a', '#2e1e32', '#9a7894'),
              ('#323440', '#2a2630', '#2a2c36', '#46485a', '#16151c')),
}

# the tree on the phone's print, from its root up; the desk's is the same
# tree, scaled about its crown (ANCHOR)
STEMS = [
    # the centre stem, the right, the left: (x, y, width)
    [(368, 716, 6.4), (362, 690, 6), (356, 662, 5.6), (353, 636, 5.2), (353, 610, 4.8), (356, 586, 4.3),
     (353, 562, 3.8), (345, 540, 3.2), (335, 522, 2.6), (325, 508, 2.0)],
    [(372, 716, 6), (375, 690, 5.4), (373, 664, 5), (368, 640, 4.6), (368, 616, 4.2), (373, 592, 3.8),
     (380, 570, 3.3), (386, 548, 2.8), (390, 530, 2.3), (394, 514, 1.8)],
    [(364, 716, 5.8), (358, 694, 5.3), (349, 672, 4.9), (342, 650, 4.5), (338, 626, 4.1), (331, 604, 3.7),
     (319, 584, 3.2), (306, 566, 2.7), (293, 549, 2.2), (282, 533, 1.8)],
]
ROOT = [(368, 724, 17), (368, 716, 13), (367, 706, 9.5)]
LOBES = [
    # (cx, cy, rx, ry, the stem it is held by), back to front
    (330, 492, 28, 15, 0), (366, 490, 28, 17, 1), (300, 504, 26, 14, 2), (390, 506, 22, 15, 1),
    (334, 518, 32, 13, 0), (276, 526, 22, 11, 2), (372, 522, 24, 12, 1), (306, 530, 22, 10, 2),
]
ANCHOR = {390: ((330, 510), 1.0), 1184: ((1060, 690), 1.9)}
# the flowers fallen in the grass: (x, y) about the root, the spread
FALLEN = {390: (356, 718, 40, 24), 1184: (1090, 880, 96, 18)}
# the sun, up and to the left of the tree in both frames
LIGHT = (-0.6, -0.8)


def _place(L):
    (ax, ay), k = ANCHOR[L.W]

    def p(x, y):
        return ax + (x - 330) * k, ay + (y - 510) * k
    stems = [[(*p(x, y), w * k * 1.35) for x, y, w in s] for s in STEMS]
    root = [(*p(x, y), w * k * 1.35) for x, y, w in ROOT]
    lobes = [(*p(x, y), rx * k, ry * k, i) for x, y, rx, ry, i in LOBES]
    return stems, root, lobes, k


def _heading(spine, i):
    a = spine[max(0, i - 1)]
    b = spine[min(len(spine) - 1, i + 1)]
    return math.atan2(b[1] - a[1], b[0] - a[0])


def ellipse(x, y, rx, ry, rot):
    """An ellipse about (x, y), its rx along the angle rot (radians)."""
    c, s = math.cos(rot), math.sin(rot)
    x0, y0 = x - c * rx, y - s * rx
    deg = math.degrees(rot)
    return (f'M{f(x0)} {f(y0)}A{f(rx)} {f(ry)} {f(deg)} 1 0 {f(x + c * rx)} {f(y + s * rx)}'
            f'A{f(rx)} {f(ry)} {f(deg)} 1 0 {f(x0)} {f(y0)}Z')


def plates(spine, rng, inks):
    """The bark's plates: patches long along the stem, of the three
    colours the bark sheds to, kept inside its edges."""
    out = {c: [] for c in inks}
    for i in range(len(spine) - 1):
        x, y, w = spine[i]
        a = _heading(spine, i)
        for _ in range(3):
            t = rng.random()
            px = x + (spine[i + 1][0] - x) * t
            py = y + (spine[i + 1][1] - y) * t
            ry = w * rng.uniform(0.16, 0.28)
            off = rng.uniform(-1, 1) * (w * 0.5 - ry * 1.1)
            px, py = px - math.sin(a) * off, py + math.cos(a) * off
            out[rng.choice(inks)].append(ellipse(px, py, w * rng.uniform(0.6, 1.4), ry, a))
    return out


def leaflets(cx, cy, rx, ry, rng, k, n):
    """Small leaves at a lobe's edge, each a pointed oval, so the mass
    reads as leaves and not as a hedge."""
    out = []
    for _ in range(n):
        a = rng.uniform(0, 2 * math.pi)
        x, y = cx + math.cos(a) * rx * rng.uniform(0.86, 1.02), cy + math.sin(a) * ry * rng.uniform(0.86, 1.04)
        ln = rng.uniform(2.6, 3.6) * k
        r = a + rng.uniform(-0.6, 0.6)
        c, s = math.cos(r) * ln / 2, math.sin(r) * ln / 2
        out.append(f'M{f(x - c)} {f(y - s)}Q{f(x - s * 0.7)} {f(y + c * 0.7)} {f(x + c)} {f(y + s)}'
                   f'Q{f(x + s * 0.7)} {f(y - c * 0.7)} {f(x - c)} {f(y - s)}Z')
    return ''.join(out)


def panicle(bx, by, w, h, tilt, rng, k):
    """One cone of flowers, upright from (bx, by): a lumpy mass of
    florets, a few abreast at its foot, one at its tip, the shade of it
    moved from the sun; and on it the florets' crinkled heads, lit on the
    sun's side, dark in its folds."""
    lx, ly = LIGHT
    mass, shade, lit, fold, hi = [], [], [], [], []
    rows = 5
    for i in range(rows):
        t = i / (rows - 1) * 0.86
        x, y = bx + tilt * h * t, by - h * t
        half = (w / 2) * (1 - 0.78 * t)
        n = 3 if t < 0.3 else (2 if t < 0.65 else 1)
        for j in range(n):
            u = 0 if n == 1 else (j / (n - 1) - 0.5) * 2
            r = half * (0.62 if n > 1 else 0.9) * rng.uniform(0.9, 1.12) + 0.35 * k
            px, py = x + u * (half - r * 0.55), y + rng.uniform(-0.25, 0.25) * r
            mass.append(dot(px, py, r))
            shade.append(dot(px - lx * r * 0.34, py - ly * r * 0.3, r))
    for _ in range(int(14 + h / k * 0.7)):
        t = rng.random() ** 1.2 * 0.92
        x, y = bx + tilt * h * t, by - h * t
        half = (w / 2) * (1 - 0.78 * t)
        u = rng.uniform(-1, 1)
        fx, fy = x + u * half * 0.95, y + rng.uniform(-0.5, 0.5) * half
        fr = rng.uniform(0.5, 0.9) * k
        if u * lx + rng.uniform(-0.45, 0.45) > -0.15:
            lit.append(dot(fx, fy, fr))
            if rng.random() < 0.2:
                hi.append(dot(fx + lx * 0.35 * k, fy + ly * 0.35 * k, 0.42 * k))
        else:
            fold.append(dot(fx, fy, fr * 0.85))
    return mass, shade, lit, fold, hi


def crown(lb, rng, inks, k):
    """A lobe of the crown: its leaves, deep under and lit on top, small
    leaves at its edge; and over it the cones of flowers, crowded on its
    top and round its rim, leaning out as the shoots do, each cone a
    little of its own pink."""
    cx, cy, rx, ry, _ = lb
    (llit, lmid, ldeep), (flit, fmid, fdeep, fhi), _bark = inks
    out = [f'<path d="{scallop(cx + rx * 0.04, cy + ry * 0.22, rx, ry * 0.9, rng, depth=0.3)}" fill="{ldeep}"></path>',
           f'<path d="{scallop(cx - rx * 0.03, cy, rx * 0.93, ry * 0.82, rng, depth=0.3)}" fill="{lmid}"></path>',
           f'<path d="{scallop(cx - rx * 0.16, cy - ry * 0.24, rx * 0.56, ry * 0.44, rng, depth=0.28)}" fill="{llit}" opacity="0.75"></path>',
           f'<path d="{leaflets(cx, cy, rx, ry, rng, k, int(rx / k * 0.6))}" fill="{ldeep}"></path>',
           f'<path d="{leaflets(cx - rx * 0.05, cy - ry * 0.1, rx * 0.9, ry * 0.85, rng, k, int(rx / k * 0.35))}" fill="{llit}"></path>']
    tones = (fmid, mix(fmid, flit, 0.35), mix(fmid, fdeep, 0.3))
    mass = {c: [] for c in tones}
    shade, lit, fold, hi = [], [], [], []
    n = max(5, int(rx / (3.4 * k)))
    spots = []
    for j in range(n):
        a = math.pi * (1.0 + (j + rng.uniform(0.15, 0.85)) / n)
        u = rng.uniform(0.3, 1.0)
        spots.append((cx + math.cos(a) * rx * u, cy + math.sin(a) * ry * u * 0.95 + ry * 0.16, math.cos(a) * u))
    # a few among the leaves, lower, half hidden
    for _ in range(max(1, n // 3)):
        spots.append((cx + rng.uniform(-0.7, 0.7) * rx, cy + ry * rng.uniform(0.2, 0.5), rng.uniform(-0.4, 0.4)))
    for j, (x, y, out_) in enumerate(sorted(spots, key=lambda s_: s_[1])):
        h = rng.uniform(7, 11) * k
        w = h * rng.uniform(0.62, 0.8)
        m, s_, l_, fo, hh = panicle(x, y, w, h, out_ * 0.45 + rng.uniform(-0.12, 0.12), rng, k)
        mass[tones[rng.randrange(3)]] += m
        shade += s_
        lit += l_
        fold += fo
        hi += hh
    out.append(f'<path d="{"".join(shade)}" fill="{fdeep}"></path>')
    out += [f'<path d="{"".join(ds)}" fill="{c}"></path>' for c, ds in mass.items() if ds]
    out += [f'<path d="{"".join(fold)}" fill="{fdeep}" opacity="0.7"></path>',
            f'<path d="{"".join(lit)}" fill="{flit}"></path>',
            f'<path d="{"".join(hi)}" fill="{fhi}" opacity="0.85"></path>']
    return ''.join(out)


def crape(L, h, o, hour, gust, uid):
    """百日紅: its stems from the root, smooth and mottled, the wood of
    its shoots, its crown in lobes held by the stems, each stem swaying
    with what it holds; the flowers fallen in the grass, and a few
    falling."""
    rng = random.Random(L.seed + 241)
    inks = CRAPE[hour]
    skin, cinnamon, grey, cream, dark = inks[2]
    stems, root, lobes, k = _place(L)
    parts = []
    for i, spine in enumerate(stems):
        wood = limb(spine, rng, wobble=0.05)
        lit = lit_band(spine, rng, side=1, a=0.1, b=0.46)
        dim = lit_band(spine, rng, side=-1, a=0.18, b=0.5)
        # the sheen the smooth bark takes, the reason the monkeys slip
        sheen = lit_band(spine[1:-1], rng, side=1, a=0.2, b=0.3)
        pl = plates(spine, rng, (cinnamon, grey, cream))
        body = (f'<path d="{wood}" fill="{skin}"></path>'
                + ''.join(f'<path d="{"".join(ds)}" fill="{c}" opacity="0.9"></path>' for c, ds in pl.items() if ds)
                + f'<path d="{dim}" fill="{dark}" opacity="0.5"></path>'
                f'<path d="{lit}" fill="{cream}" opacity="0.45"></path>'
                f'<path d="{sheen}" fill="{cream}" opacity="0.7"></path>')
        held = ''.join(crown(lb, rng, inks, k) for lb in lobes if lb[4] == i)
        parts.append((i, body, held))
    # the stems first, then the crown over them, back to front, each part
    # swaying about the foot of the stem that holds it
    out = []
    for i, body, _ in parts:
        out.append(_sway(stems[i], i, body, gust, L))
    for i, _, held in parts:
        out.append(_sway(stems[i], i, held, gust, L))
    rx, ry = root[0][0], root[0][1]
    base = f'<path d="{limb(root, rng, wobble=0.05)}" fill="{skin}"></path>'
    fallen = _fallen(L, inks[1]) if o.get('fallen', True) else ''
    falling = _falling(L, inks[1], lobes, k)
    return (f'{fallen}<g class="f5-gust" style="transform-origin: {f(rx)}px {f(ry)}px; --a: 0.2deg; {gust(rx, L.W)}">'
            f'{base}{"".join(out)}</g>{falling}')


def _sway(spine, i, inner, gust, L):
    ax, ay = spine[4][0], spine[4][1]
    a = (0.55, 0.75, 0.65)[i]
    return (f'<g class="f5-gust" style="transform-origin: {f(ax)}px {f(ay)}px; --a: {f(a)}deg; {gust(ax, L.W)}">'
            f'{inner}</g>')


def _fallen(L, flowers):
    lit, mid, deep, _ = flowers
    fr = random.Random(L.seed + 245)
    x0, y0, sx, sy = FALLEN[L.W]
    k = ANCHOR[L.W][1]
    by = {lit: [], mid: [], deep: []}
    for j in range(int(56 * k ** 0.7)):
        x = x0 + fr.gauss(0, sx)
        y = min(L.H - 2, y0 + fr.uniform(-1, 1) * sy * (1 - min(0.8, abs(x - x0) / (sx * 3))))
        by[(lit, mid, deep)[j % 3]].append(dot(x, y, fr.uniform(0.55, 1.1) * k ** 0.8))
    return ''.join(f'<path d="{"".join(ds)}" fill="{c}" opacity="0.85"></path>' for c, ds in by.items() if ds)


def _falling(L, flowers, lobes, k):
    """A few florets let go from the crown, tumbling down to the grass."""
    lit, mid, _, _ = flowers
    rng = random.Random(L.seed + 247)
    out = []
    n = 6 if L.W < 600 else 9
    for j in range(n):
        cx, cy, rx, ry, _ = lobes[rng.randrange(len(lobes))]
        x, y = cx + rng.uniform(-0.8, 0.8) * rx, cy + rng.uniform(0, 0.6) * ry
        dur = rng.uniform(9, 13)
        shape = blob(0, 0, rng.uniform(1.3, 1.8) * k, rng, lobes=5)
        out.append(_faller(x, y, -rng.uniform(30, 80) * k, rng.uniform(120, 170) * k, dur, dur * j / n + rng.uniform(0, 2),
                           shape, (lit, mid)[j % 2], rng))
    return ''.join(out)


def tree(L, h, o, hour, gust, uid):
    if o.get('tree') == 'sarusuberi':
        return crape(L, h, o, hour, gust, uid)
    return s2_flora.tree(L, h, o, hour, gust, uid)
