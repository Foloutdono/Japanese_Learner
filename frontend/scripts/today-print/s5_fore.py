"""S⁵ · the foreground, laid out (plan 261, the canvas "Tsuji — Today, the
seasons", round 5). Round 9 set the bank's flowers on the bank's far edge
and the trees' feet on its near one, then drew the flowers over the
trunks: so the cosmos, the hydrangeas, the rape blossom grew out of the
pine's trunk and the season's tree halfway up, and between the two lay
a meadow of nothing; what fell from the trees lay on it as confetti.

The meadow has a depth now, from its far edge at the bridge's foot to
its near one at the frame's, and whatever stands on it is placed at a
depth and sized for it (`_near`): drawn behind the trees when it stands
farther than their feet, in front of them when nearer.

- the bank's flowers in drifts at the trees' feet, at the frame's foot,
  one smaller clump halfway, and far off a few patches of them, seen as
  the colour of a field;
- under each tree its shade, cast away from the sun;
- what the tree let fall lying where it fell: a carpet under its crown,
  thickest by the trunk, thinning out downwind; each petal lying flat,
  so seen at a slant (the cherry's notched petals, the crape myrtle's
  crinkled florets, maple leaves, the plum's petals on the snow);
- grass: tufts across the meadow, thicker and taller toward the viewer,
  a fringe of it along the frame's foot and a tuft over the tree's foot;
  in the snow, a few dry blades through it;
- the hydrangeas as bushes, their heads sitting in the leaves.

A clump sways as one (one moving part each, not one a stem); the far
patches and the halfway clump keep still."""
import dataclasses
import math
import random
import re

from geo import f
from el7 import mix, susuki7, cosmos7
from s1_flora import dot, scallop, nanohana, camellia, _dim
from s2_flora import PLUM
from scene_f4 import anim
import s4_flora

# per frame, in the print's units: the trees' shade (x, y, rx, ry, turn);
# the carpet under the season's tree (its centre, half-width, half-depth);
# the tree's foot where the frame shows it (x, y, half-width); the depth
# of the trees' feet (`front`: what stands nearer is drawn over them);
# and what grows: the flowers' clumps and the pampas (x, y, size,
# count), each drawn at its size times its nearness (`_near`), and far
# patches (x, y, width). The flowers grow in two drifts, one from each
# of the frame's feet under a tree, running back into the meadow toward
# its middle, which they leave open for the bay; a clump marked FIELD is
# for the flowers of a field (rape, cosmos), not for the bushes.
FIELD_ONLY = 'field'
FORE = {
    390: dict(
        base=1.0, front=714,
        shade=[(358, 734, 84, 13, 8), (34, 744, 48, 7, 0)],
        carpet=(318, 731, 96, 15), foot=(370, 713, 15), foot_kacho=(366, 731, 20),
        flowers=[(74, 749, 1.05, 7), (134, 752, 0.85, 4, FIELD_ONLY), (392, 748, 0.95, 5), (300, 752, 0.8, 4, FIELD_ONLY),
                 (176, 702, 0.85, 3, FIELD_ONLY), (262, 688, 0.8, 3)],
        pampas=[(384, 750, 1.05, 7), (12, 750, 1.0, 6), (214, 676, 0.85, 3)],
        far=[(96, 650, 58), (40, 634, 32), (292, 640, 48), (200, 618, 28)],
    ),
    1184: dict(
        base=1.3, front=880,
        shade=[(1086, 896, 170, 20, 0), (60, 898, 120, 13, 0)],
        carpet=(1040, 884, 180, 18), foot=None, foot_kacho=None,
        flowers=[(122, 906, 1.1, 8), (206, 908, 0.9, 6, FIELD_ONLY), (292, 904, 0.75, 4), (1014, 906, 1.0, 7),
                 (1172, 906, 1.0, 6, FIELD_ONLY), (918, 908, 0.8, 4, FIELD_ONLY), (640, 909, 0.7, 3, FIELD_ONLY),
                 (342, 860, 0.85, 4, FIELD_ONLY), (404, 836, 0.7, 3), (858, 852, 0.85, 4), (796, 828, 0.7, 3, FIELD_ONLY)],
        pampas=[(1150, 906, 1.15, 9), (60, 908, 1.1, 7), (470, 846, 0.85, 4), (742, 840, 0.8, 3)],
        far=[(214, 802, 110), (334, 786, 60), (902, 792, 92), (1012, 780, 50), (616, 782, 56)],
    ),
}


def _near(L, y):
    """How near a point of the ground is: 1 at the frame's foot, falling
    toward the horizon, as a thing standing there is drawn."""
    return max(0.25, (y - L.horizon) / (L.H - L.horizon))


def _K(L):
    return 1.0 if L.W < 600 else 1.5


def _still(svg, parts='[a-z]+'):
    """A drawing's moving parts kept still (those `parts` names): their
    classes and timing gone."""
    return re.sub(r' class="f5-' + parts + r'" style="[^"]*"', '', svg)


def _as_one(svg, x, y, a, gust, W):
    """A clump's stems swaying as one, about its foot: the stems' own
    sway kept still (a head still nods, a plume still flutters)."""
    return (f'<g class="f5-gust" style="transform-origin: {f(x)}px {f(y)}px; --a: {f(a)}deg; {gust(x, W)}">'
            f'{_still(svg, "gust")}</g>')


def _xf(pts, x, y, rot, sq):
    """Points drawn about (0, 0), turned by rot and laid on the ground at
    (x, y): their depth squashed by sq, as the ground is seen."""
    c, s = math.cos(rot), math.sin(rot)
    return [(x + px * c - py * s, y + (px * s + py * c) * sq) for px, py in pts]


def _poly(pts):
    """A filled shape through the points (a fill closes it: left open, a
    run of them is straight lines alone, which the build writes short)."""
    return 'M' + 'L'.join(f'{f(x)} {f(y)}' for x, y in pts)


# ── what grows ───────────────────────────────────────────────────

def hydrangea(clumps, hour, rng):
    """紫陽花 as bushes: a mound of broad leaves, the round heads sitting in
    its top and its front, a few leaves over their feet."""
    leaf_ink = _dim('#2f5a36', hour)
    leaf_lit = _dim('#467a48', hour)
    vein = _dim('#1f3a26', hour)
    heads = [('#5b7fd4', '#9db8f0', '#3a539a'), ('#8a6cc8', '#c2abef', '#5a4592'), ('#d98ab8', '#f4c0dc', '#9a5584'),
             ('#6f98da', '#b4cdf4', '#40619e')]
    out = []
    for x0, y0, sc, n in clumps:
        W, H = (24 + 2 * n) * sc, (34 + 1.5 * n) * sc

        def leaf(bx, by, a, ln):
            ex, ey = bx + math.cos(a) * ln, by + math.sin(a) * ln
            nx, ny = -math.sin(a), math.cos(a)
            w = ln * 0.42
            return (f'M{f(bx)} {f(by)}Q{f((bx + ex) / 2 + nx * w)} {f((by + ey) / 2 + ny * w)} {f(ex)} {f(ey)}'
                    f'Q{f((bx + ex) / 2 - nx * w)} {f((by + ey) / 2 - ny * w)} {f(bx)} {f(by)}Z', f'M{f(bx)} {f(by)}L{f(ex)} {f(ey)}')
        back, front, ribs = [], [], []
        for _ in range(int(14 + n * 2.4)):
            u = rng.uniform(-1, 1)
            bx, by = x0 + u * W, y0 - rng.uniform(0, H * (1 - u * u) ** 0.6)
            o_, r_ = leaf(bx, by, -math.pi / 2 + u * 1.1 + rng.uniform(-0.6, 0.6), rng.uniform(10, 15) * sc)
            back.append(o_)
            ribs.append(r_)
        bush = [f'<path d="{"".join(back)}" fill="{leaf_ink}"></path>']
        for _ in range(max(3, n // 2 + 2)):
            base, lit, shade_ = (_dim(c, hour) for c in heads[rng.randrange(len(heads))])
            r = rng.uniform(8, 11) * sc
            u = rng.uniform(-0.72, 0.72)
            hx = x0 + u * W * 0.9
            hy = y0 - H * (1 - u * u) ** 0.6 * rng.uniform(0.6, 0.9)
            florets = []
            for _ in range(int(16 + r * 1.4 / sc)):
                a = rng.uniform(0, 2 * math.pi)
                rr = r * math.sqrt(rng.random()) * 0.92
                fx, fy = hx + math.cos(a) * rr, hy + math.sin(a) * rr * 0.86
                fr = rng.uniform(1.1, 1.6) * sc
                rot = rng.uniform(0, 90)
                for k in range(4):
                    aa = math.radians(rot + 90 * k)
                    florets.append(dot(fx + math.cos(aa) * fr * 0.5, fy + math.sin(aa) * fr * 0.5, fr * 0.42))
            bush.append(f'<path d="{dot(hx + r * 0.1, hy + r * 0.16, r)}" fill="{shade_}"></path>'
                        f'<path d="{dot(hx, hy, r * 0.9)}" fill="{base}"></path>'
                        f'<path d="{"".join(florets)}" fill="{lit}" opacity="0.92"></path>')
        for _ in range(int(6 + n)):
            u = rng.uniform(-0.9, 0.9)
            bx, by = x0 + u * W, y0 - rng.uniform(0, H * 0.42)
            o_, r_ = leaf(bx, by, -math.pi / 2 + u * 0.9 + rng.uniform(-0.5, 0.5), rng.uniform(10, 14) * sc)
            front.append(o_)
            ribs.append(r_)
        bush.append(f'<path d="{"".join(front)}" fill="{leaf_lit}"></path>'
                    f'<path d="{"".join(ribs)}" fill="none" stroke="{vein}" stroke-width="{f(0.5 * sc)}"></path>')
        out.append((x0, y0, ''.join(bush)))
    return out


def _at_depth(L, items):
    """Clumps (x, y, size, count) at the scale their depth draws them."""
    base = FORE[L.W]['base']
    return [(x, y, base * size * _near(L, y), n) for x, y, size, n in items]


def _plants(L, h, o, hour, gust, near):
    """The season's flowers and its pampas, nearer than the trees' feet
    or farther (`near`): one drawing per clump, (x, y, svg), the
    farthest first."""
    F = FORE[L.W]
    keep = (lambda y: y >= F['front']) if near else (lambda y: y < F['front'])
    kind = o.get('bank', 'cosmos')
    field = kind in ('nanohana', 'cosmos')
    clumps = _at_depth(L, [c[:4] for c in F['flowers'] if keep(c[1]) and (field or FIELD_ONLY not in c)])
    pampas = _at_depth(L, [c for c in F['pampas'] if keep(c[1])])
    out = []

    def each(draw, cs, field):
        for c in cs:
            out.append((c[0], c[1], draw(dataclasses.replace(L, **{field: [c]}))))
    if kind == 'hydrangea':
        out += hydrangea(clumps, hour, random.Random(L.seed + 431 + near))
    elif kind == 'nanohana':
        each(lambda Lc: nanohana(Lc, h, hour, gust), clumps, 'cosmos')
    elif kind == 'cosmos':
        each(lambda Lc: cosmos7(Lc, h, hour, gust, anim), clumps, 'cosmos')
        each(lambda Lc: susuki7(Lc, h, hour, gust, anim), pampas, 'susuki')
    elif kind == 'camellia':
        each(lambda Lc: susuki7(Lc, h, hour, gust, anim), pampas, 'susuki')
        each(lambda Lc: camellia(Lc, h, o, hour, gust), clumps, 'cosmos')
    return sorted(out, key=lambda t: t[1])


# ── far off: the flowers as the colour of a field ─────────────────

FIELD = {
    'nanohana': ('#f3d23a', '#e9b91e', '#fbe57a'),
    'cosmos': ('#f4a6c8', '#fbeef2', '#d9558f', '#f7c6da'),
    'hydrangea': ('#5b7fd4', '#8a6cc8', '#d98ab8', '#9db8f0'),
    'camellia': ('#c8263a', '#e65a68'),
}


def _dome(cx, base, rx, ry, rng):
    """A bush's mass: the upper half of an ellipse, lumped along its rim
    as leaves heap, on a flat foot."""
    n = max(6, int((rx + ry) / 3))
    pts = []
    for j in range(n + 1):
        th = math.pi + math.pi * j / n
        k = rng.uniform(0.9, 1.04) if 0 < j < n else 1
        pts.append((cx + math.cos(th) * rx * k, base + math.sin(th) * ry * k))
    d = [f'M{f(pts[0][0])} {f(pts[0][1])}']
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        ox, oy = mx - cx, my - base
        ln = math.hypot(ox, oy) or 1
        b = math.hypot(x1 - x0, y1 - y0) * 0.38 * rng.uniform(0.6, 1.1)
        d.append(f'Q{f(mx + ox / ln * b)} {f(my + oy / ln * b)} {f(x1)} {f(y1)}')
    return ''.join(d) + 'Z'


def patches(L, h, o, hour):
    """The bank's flowers far off across the meadow, as a field of them is
    seen from afar: low heaps of green along a drift, overlapping and of
    uneven size, the flowers' colour heaped on them in dots; the bushes
    (hydrangea, camellia) as a few round masses of dark leaves with
    their flowers on them, and in the snow its lumps on their tops."""
    kind = o.get('bank', 'cosmos')
    if kind not in FIELD:
        return ''
    rng = random.Random(L.seed + 771)
    K = _K(L)
    snow = o.get('crowns') == 'snow'
    inks = [_dim(c, hour) for c in FIELD[kind]]
    bushes = kind in ('hydrangea', 'camellia')
    if bushes:
        greens = (_dim('#2f5a36' if kind == 'hydrangea' else '#1d3a2a', hour), _dim('#467a48' if kind == 'hydrangea' else '#3d6a4a', hour))
    else:
        greens = (mix(h['ground'], _dim('#5c8a3c', hour), 0.5), None)
    # far off, the colours go toward the far meadow's, as the air takes
    # them; after dark, toward the meadow's own dark
    dark = hour in ('dusk', 'night')
    haze = mix(h['ground'], h['hill_near'], 0.15 if dark else 0.45)
    out = []
    for x, y, w in sorted(FORE[L.W]['far'], key=lambda p: p[1]):
        s = _near(L, y) * K
        air = (1 - _near(L, y)) * (0.8 if dark else 0.55)
        cols = [mix(c, haze, air) for c in inks]
        green, lit = (mix(c, haze, air) if c else None for c in greens)
        base, tops, seats, dots = [], [], [], {c: [] for c in cols}
        if bushes:
            # one to three bushes, of uneven size, the larger in front
            nb = 1 if w < 50 * K else rng.choice((2, 3))
            spots = sorted(((x + rng.uniform(-0.45, 0.45) * w * (nb > 1), rng.uniform(0.6, 1.0)) for _ in range(nb)), key=lambda t: t[1])
            for bx, size in spots:
                br = (6 + 4 * size) * s
                gy = y + (1 - size) * 2 * s
                by = gy - br * 0.45
                seats.append(f'M{f(bx - br * 1.6)} {f(gy)}a{f(br * 1.6)} {f(br * 0.22)} 0 1 0 {f(br * 3.2)} 0a{f(br * 1.6)} {f(br * 0.22)} 0 1 0 {f(-br * 3.2)} 0')
                base.append(_dome(bx, gy, br * 1.4, br * 1.05, rng))
                tops.append(_dome(bx - br * 0.15, gy - br * 0.3, br * 0.95, br * 0.62, rng))
                for _ in range(int(3 + 5 * size * K)):
                    a = rng.uniform(math.pi * 1.0, math.pi * 2.0)
                    rr = rng.uniform(0.2, 0.85)
                    dots[rng.choice(cols)].append(dot(bx + math.cos(a) * rr * br * 1.2, by + math.sin(a) * rr * br * 0.6,
                                                      rng.uniform(1.0, 1.6) * s * (1.3 if kind == 'hydrangea' else 0.9)))
                if snow:
                    for _ in range(3):
                        dots.setdefault(o['cap'], []).append(dot(bx + rng.uniform(-0.8, 0.8) * br, by - br * rng.uniform(0.75, 0.95),
                                                                 rng.uniform(1.0, 1.6) * s))
        else:
            # low heaps over the drift's depth, the middle the tallest
            hgt = w * 0.15
            xs = x - w / 2
            heaps = []
            while xs < x + w / 2:
                hw = rng.uniform(0.12, 0.22) * w
                u = (xs + hw / 2 - x) / (w / 2)
                hh = hgt * rng.uniform(0.6, 1.0) * max(0.25, 1 - u * u) ** 0.5
                heaps.append((xs + hw / 2, y + rng.uniform(-0.6, 0.5) * hgt * (1 - abs(u)), hw, hh))
                xs += hw * rng.uniform(0.7, 1.1)
            for cx, hy, hw, hh in sorted(heaps, key=lambda t: t[1]):
                base.append(scallop(cx, hy - hh * 0.45, hw * 0.75, hh * 0.65, rng, depth=0.35))
                for _ in range(int(hw * 0.9 / s ** 0.5)):
                    t = rng.uniform(-1, 1)
                    top = hh * (1 - t * t) ** 0.6
                    dots[rng.choice(cols)].append(dot(cx + t * hw * 0.7, hy - hh * 0.45 - top * rng.uniform(-0.1, 0.62),
                                                      rng.uniform(0.9, 1.4) * s))
        out.append((f'<path d="{"".join(seats)}" fill="{mix(h["ground"], "#000000", 0.4)}" opacity="0.5"></path>' if seats else '')
                   + f'<path d="{"".join(base)}" fill="{green}"></path>'
                   + (f'<path d="{"".join(tops)}" fill="{lit}" opacity="0.7"></path>' if tops else '')
                   + ''.join(f'<path d="{"".join(ds)}" fill="{c}"></path>' for c, ds in dots.items() if ds))
    return ''.join(out)


# ── the ground: shade, grass ─────────────────────────────────────

SHADE = {'day': 0.36, 'dawn': 0.3, 'dusk': 0.26, 'night': 0.12}


def _foot(L, o):
    """The season's tree's foot (x, y, half-width), where the frame shows it."""
    F = FORE[L.W]
    if not o.get('tree'):
        return None
    return F['foot_kacho'] if o.get('tree') == 'sarusuberi' and o.get('myrtle') == 'kacho' else F['foot']


def shade(L, h, o, hour, uid):
    """Each tree's shade on the ground, cast away from the sun (up and to
    the left of both): a soft ellipse about its foot, and a darker one
    where the trunk meets the ground; blue on the snow."""
    snow = o.get('crowns') == 'snow'
    ink = mix(h['ground'], '#3c4a74', 0.6) if snow else mix(h['ground'], '#000000', 0.62)
    op = SHADE[hour] * (1.25 if snow else 1)
    out = []
    ells = [(*e, 1.0) for e in FORE[L.W]['shade']]
    foot = _foot(L, o)
    if foot:
        x, y, w = foot
        ells.append((x + w * 0.9, y + 2.5, w * 1.8, w * 0.38, 12, 1.7))
    for j, (x, y, rx, ry, turn, k) in enumerate(ells):
        gid = f'{uid}Shade{j}'
        out.append(f'<defs><radialGradient id="{gid}"><stop offset="0" stop-color="{ink}" stop-opacity="{f(min(0.8, op * k))}"></stop>'
                   f'<stop offset="0.55" stop-color="{ink}" stop-opacity="{f(min(0.8, op * k) * 0.6)}"></stop>'
                   f'<stop offset="1" stop-color="{ink}" stop-opacity="0"></stop></radialGradient></defs>'
                   f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(rx)}" ry="{f(ry)}" fill="url(#{gid})"'
                   + (f' transform="rotate({f(turn)} {f(x)} {f(y)})"' if turn else '') + '></ellipse>')
    return ''.join(out)


def _grass_inks(h, o, hour):
    if o.get('crowns') == 'snow':
        return tuple(_dim(c, hour) for c in ('#6e6252', '#8a7c66', '#a8987e'))
    g, st = h['ground'], h['stem']
    lift = {'day': 0.3, 'dawn': 0.1, 'dusk': 0.06, 'night': 0.04}[hour]
    return mix(g, '#000000', 0.3), mix(g, st, 0.75), mix(st, '#d6e49a', lift)


def _blade(x, y, ln, lean, w):
    """A blade of grass: from a foot w wide, curving with its lean to a
    point (written from its foot, in steps: short)."""
    tx, ty = lean * ln + w / 2, -ln * (1 - 0.3 * abs(lean))
    cx, cy = lean * ln * 0.2 + w / 2, -ln * 0.62
    return (f'M{f(x - w / 2)} {f(y)}q{f(cx - w * 0.25)} {f(cy)} {f(tx)} {f(ty)}'
            f'q{f(cx + w * 0.25 - tx)} {f(cy - ty)} {f(w / 2 - tx + w / 2)} {f(-ty)}')


def tufts(L, h, o, hour, lo, hi, n, seed):
    """Tufts of grass on the ground between depths lo and hi, more of
    them toward the viewer, each sized for its depth."""
    rng = random.Random(L.seed + seed)
    K = _K(L)
    inks = _grass_inks(h, o, hour)
    out = {c: [] for c in inks}
    snow = o.get('crowns') == 'snow'
    for _ in range(int(n * (0.45 if snow else 1))):
        y = lo + (hi - lo) * rng.random() ** 0.6
        x = rng.uniform(-6, L.W + 6)
        s = _near(L, y) * K
        for j in range(rng.randint(3, 7)):
            out[inks[j % 3]].append(_blade(x + rng.uniform(-2.5, 2.5) * s, y + rng.uniform(-0.4, 0.6) * s, rng.uniform(3.5, 9) * s,
                                           rng.uniform(-0.65, 0.65), rng.uniform(0.8, 1.2) * s))
    return ''.join(f'<path d="{"".join(ds)}" fill="{c}"></path>' for c, ds in out.items() if ds)


def fringe(L, h, o, hour):
    """The grass along the frame's foot, the nearest of the meadow: long
    blades in clumps, thicker under the trees at the two sides."""
    rng = random.Random(L.seed + 787)
    K = _K(L)
    inks = _grass_inks(h, o, hour)
    out = {c: [] for c in inks}
    snow = o.get('crowns') == 'snow'
    x = -8.0
    while x < L.W + 8:
        side = min(x, L.W - x) / L.W
        thick = 1.0 if side < 0.2 else 0.55
        if rng.random() > thick * (0.5 if snow else 1):
            x += rng.uniform(6, 14) * K
            continue
        for j in range(rng.randint(4, 9)):
            ln = rng.uniform(7, 19) * K * (1.1 if side < 0.2 else 0.85)
            out[inks[j % 3]].append(_blade(x + rng.uniform(-3, 3) * K, L.H + rng.uniform(0, 3) * K, ln, rng.uniform(-0.7, 0.7),
                                           rng.uniform(1.1, 1.7) * K))
        x += rng.uniform(4, 10) * K
    return ''.join(f'<path d="{"".join(ds)}" fill="{c}"></path>' for c, ds in out.items() if ds)


def foot_tuft(L, h, o, hour):
    """A tuft of grass over the season's tree's foot, where the frame
    shows it, so the trunk rises from the grass (the kachō-e myrtle has
    its own)."""
    foot = _foot(L, o)
    if not foot or o.get('myrtle') == 'kacho' and o.get('tree') == 'sarusuberi':
        return ''
    x0, y0, w = foot
    rng = random.Random(L.seed + 797)
    inks = _grass_inks(h, o, hour)
    out = {c: [] for c in inks}
    for j in range(24 if o.get('crowns') != 'snow' else 9):
        u = rng.uniform(-1, 1)
        out[inks[j % 3]].append(_blade(x0 + u * w * 1.6, y0 + rng.uniform(0, 3.5), rng.uniform(5, 14) * (1.15 - 0.45 * abs(u)),
                                       u * 0.55 + rng.uniform(-0.3, 0.3), rng.uniform(1.1, 1.6)))
    return ''.join(f'<path d="{"".join(ds)}" fill="{c}"></path>' for c, ds in out.items() if ds)


# ── what fell: the carpet under the tree ─────────────────────────

def _spot(rng, L):
    """Where a fallen petal lies: most in the carpet under the crown,
    thickest by the trunk; the rest carried off downwind (to the left),
    thinning out across the meadow."""
    cx, cy, rx, ry = FORE[L.W]['carpet']
    if rng.random() < 0.8:
        while True:
            u, v = rng.gauss(0, 0.5), rng.gauss(0, 0.5)
            if u * u + v * v < 1.4:
                return cx + u * rx, cy + v * ry
    far = rng.random()
    return cx - rx * (0.8 + 2.2 * far), cy + ry * rng.uniform(-1.2, 1.3) - far * ry * 1.6


def _sakura(ln):
    """A cherry petal about its middle, along x: narrow at its foot,
    broad at its notched tip."""
    a, w = ln / 2, ln * 0.4
    return [(-a, 0), (-a * 0.55, -w * 0.62), (0, -w * 0.95), (a * 0.62, -w * 0.88), (a, -w * 0.35), (a * 0.8, 0),
            (a, w * 0.35), (a * 0.62, w * 0.88), (0, w * 0.95), (-a * 0.55, w * 0.62)]


def _floret(r, rng):
    """A crape myrtle floret: a crinkled round."""
    return [(math.cos(t) * r * (0.72 + 0.28 * (j % 2)) * rng.uniform(0.9, 1.1), math.sin(t) * r * (0.72 + 0.28 * (j % 2)))
            for j, t in enumerate(i * math.pi / 5 for i in range(10))]


def _maple(r):
    """A maple leaf about its heart: seven lobes cut deep, pointed, the
    middle three the longest, and its stalk."""
    lobes = ((-90, 1.0), (-42, 0.9), (4, 0.68), (48, 0.4), (132, 0.4), (176, 0.68), (222, 0.9))
    pts = []
    for i, (deg, ln) in enumerate(lobes):
        a = math.radians(deg)
        pts.append((math.cos(a) * r * ln, math.sin(a) * r * ln))
        nxt = lobes[(i + 1) % len(lobes)][0] + (360 if i == len(lobes) - 1 else 0)
        if i == 3:
            # the stalk, between the two lowest lobes
            pts += [(r * 0.06, r * 0.3), (r * 0.1, r * 0.7), (-r * 0.02, r * 0.7), (-r * 0.06, r * 0.3)]
            continue
        b = math.radians((deg + nxt) / 2)
        pts.append((math.cos(b) * r * 0.3, math.sin(b) * r * 0.3))
    return pts


def carpet_inks(o, hour):
    """What the season's tree lets fall, and its inks; (None, ()) for none."""
    kind = o.get('tree')
    if kind == 'sakura':
        lit, mid, shade_ = o['bloom']
        return 'petal', (mix(lit, '#ffffff', 0.35), lit, mid, mix(mid, shade_, 0.35))
    if kind == 'sarusuberi':
        if o.get('myrtle') == 'kacho':
            flit, fcrim, fdeep, _bud = s4_flora.KACHO[hour][0]
            return 'floret', (flit, fcrim, fdeep, mix(fcrim, flit, 0.5))
        light, lilac, pink, magenta, _deep = s4_flora.INK[hour][1]
        return 'floret', (light, lilac, pink, magenta)
    if kind == 'maple':
        bright, mid, deep = o['maple']
        return 'leaf', (bright, mid, _dim('#e0862e', hour), _dim('#d4a43a', hour), deep)
    if kind == 'ume':
        (lit, mid, deep), _bark = PLUM[hour]
        return 'plum', (lit, mid, deep)
    return None, ()


# how many fall on the phone's carpet, and how strongly they tint it
CARPET = {'petal': (300, 0.5), 'floret': (320, 0.5), 'leaf': (130, 0.4), 'plum': (90, 0.18)}


def fallen(L, h, o, hour, uid):
    """散り花: what the season's tree let fall, lying where it fell: the
    ground under the crown tinted with it, and on it each petal (each
    leaf) lying flat, the nearer the larger."""
    shape, inks = carpet_inks(o, hour)
    if not shape:
        return ''
    rng = random.Random(L.seed + 761)
    K = _K(L)
    n, tint = CARPET[shape]
    n = int(n * (L.W / 390) ** 0.55)
    cx, cy, rx, ry = FORE[L.W]['carpet']
    gid = f'{uid}Carpet'
    wash = mix(inks[1], h['ground'], 0.25)
    out = [f'<defs><radialGradient id="{gid}"><stop offset="0" stop-color="{wash}" stop-opacity="{f(tint)}"></stop>'
           f'<stop offset="0.6" stop-color="{wash}" stop-opacity="{f(tint * 0.45)}"></stop>'
           f'<stop offset="1" stop-color="{wash}" stop-opacity="0"></stop></radialGradient></defs>'
           f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx * 1.1)}" ry="{f(ry * 1.25)}" fill="url(#{gid})"></ellipse>']
    paths = {}
    for j in range(n):
        x, y = _spot(rng, L)
        s = _near(L, y) * K
        rot = rng.uniform(0, 2 * math.pi)
        sq = rng.uniform(0.42, 0.62)
        if shape == 'petal':
            pts = _xf(_sakura(rng.uniform(3.0, 4.6) * s), x, y, rot, sq)
        elif shape == 'floret':
            pts = _xf(_floret(rng.uniform(1.1, 1.7) * s, rng), x, y, rot, sq + 0.12)
        elif shape == 'leaf':
            pts = _xf(_maple(rng.uniform(3.2, 4.8) * s), x, y, rot, sq)
        else:
            r = rng.uniform(1.1, 1.6) * s
            pts = _xf([(math.cos(t) * r, math.sin(t) * r) for t in (i * math.pi / 4 for i in range(8))], x, y, rot, sq)
        paths.setdefault(inks[j % len(inks)], []).append(_poly(pts))
    out += [f'<path d="{"".join(ds)}" fill="{c}"></path>' for c, ds in paths.items()]
    return ''.join(out)


# ── the hooks round 1's composition calls ─────────────────────────

def fore_back(L, h, o, hour, gust, uid):
    """On the ground behind the trees' feet: the shade, what fell, the
    grass and the flowers far off and halfway (these keep still)."""
    mid = ''.join(_still(svg) for _x, _y, svg in _plants(L, h, o, hour, gust, False))
    return (shade(L, h, o, hour, uid) + fallen(L, h, o, hour, uid)
            + tufts(L, h, o, hour, L.ground + 6, FORE[L.W]['front'], 34 if L.W < 600 else 84, 751)
            + patches(L, h, o, hour) + mid)


def bank(L, h, o, hour, gust, anim_):
    """The clumps nearer than the trees' feet, each swaying as one."""
    rng = random.Random(L.seed + 803)
    return ''.join(_as_one(svg, x, y, rng.uniform(1.2, 2.4), gust, L.W) for x, y, svg in _plants(L, h, o, hour, gust, True))


def fore_front(L, h, o, hour, gust, uid):
    """The grass over the tree's foot and along the frame's foot."""
    return (foot_tuft(L, h, o, hour) + tufts(L, h, o, hour, FORE[L.W]['front'], L.H - 2, 14 if L.W < 600 else 34, 757)
            + fringe(L, h, o, hour))
