"""S² · the season's tree, in every season (plan 261, the canvas "Tsuji
— Today, the seasons", round 2). Round 1 gave the tree at the print's
right to spring (the cherry) and autumn (the maple) only. Each season
now has one, standing where they stand, on the same wood:

- 春 the cherry (桜), and 秋 the maple (紅葉), as round 1 drew them, in
  fuller colour;
- 夏, to choose from: the maple in its summer green (青もみじ), the
  crape myrtle in flower (百日紅), or a weeping willow (柳) letting its
  strands down over the bridge;
- 冬, to choose from: the red plum (紅梅), the year's first flowers, on
  bare angular branches with snow lying along them; or the maple
  itself, bare, every branch and twig carrying its line of snow.

A crown of leaves or blossom is round 1's lobes (s1_flora); the bare
trees branch from the same limbs, each branch splitting into smaller
ones, the plum's in straight shoots that change direction, the maple's
in curves. Every bough sways with the print's gust, a beat after the
one below."""
import math
import random
from geo import f
from el7 import PINE, limb, lit_band, bark, mix, smooth
from s1_flora import (TREE, twigs, sakura_lobe, maple_lobe, scallop, dot, five, blob, lanterns_s)

# ── the tree's inks, per kind and hour ──────────────────────────────

GREEN_MAPLE = {
    'day': ('#a9d062', '#70a242', '#3d6b2c'), 'dawn': ('#8fae70', '#617f52', '#2f4733'),
    'dusk': ('#647f5e', '#455d4c', '#24322d'), 'night': ('#2d3d3a', '#202e2e', '#111b1b'),
}
CRAPE = {
    # leaves (lit, mid, deep), flowers (lit, mid, deep), the bark and its mottle
    'day': (('#6f9a4e', '#4b7a3c', '#2a4a2c'), ('#f478b2', '#d8468e', '#a2286a'), ('#c2ab94', '#8f7a68')),
    'dawn': (('#5f7e54', '#43623f', '#22382a'), ('#e88ab4', '#c25a90', '#86306a'), ('#9a8678', '#6a5a52')),
    'dusk': (('#46604a', '#33493c', '#1a2a24'), ('#c86c98', '#a04a7a', '#62305a'), ('#7a6a66', '#544a4c')),
    'night': (('#22302e', '#192624', '#0e1716'), ('#6a4a68', '#56385a', '#30223a'), ('#3a3640', '#2a2830')),
}
WILLOW = {
    'day': ('#c4dc7c', '#93b456', '#5f8238'), 'dawn': ('#a2b47a', '#768c58', '#475a38'),
    'dusk': ('#76866a', '#55644e', '#2e3a30'), 'night': ('#2e3c36', '#22302c', '#131c1a'),
}
PLUM = {
    # blossom (lit, mid, deep), the bark
    'day': (('#f26a86', '#d63a5e', '#9c1e42'), '#2a2024'), 'dawn': (('#e8788e', '#c84c68', '#8a2a46'), '#231a22'),
    'dusk': (('#c2607a', '#9c3e5c', '#5e2238'), '#1a1620'), 'night': (('#7a4a62', '#5e3650', '#381e30'), '#0e0c14'),
}
BARE_BARK = {'day': '#3e3230', 'dawn': '#2c2430', 'dusk': '#22202c', 'night': '#0e1018'}


def defs(L, h, o, hour, uid):
    out = []
    if o.get('lanterns'):
        out.append(f'<radialGradient id="{uid}Lantern"><stop offset="0" stop-color="#ffd9a0" stop-opacity="0.75"></stop>'
                   f'<stop offset="0.4" stop-color="#ffb070" stop-opacity="0.32"></stop><stop offset="1" stop-color="#ff9a5c" stop-opacity="0"></stop></radialGradient>')
    return ''.join(out)


# ── branching, for the bare trees ──────────────────────────────────

def _heading(spine, i):
    a = spine[max(0, i - 1)]
    b = spine[min(len(spine) - 1, i + 1)]
    return math.atan2(b[1] - a[1], b[0] - a[0])


def branches(spine, rng, depth, angular, k):
    """The branches off a limb, and theirs off them: each leaves its
    parent at an angle, upward more than not, shorter and thinner; a
    plum's in straight shoots that turn at a joint (angular), a maple's
    in curves."""
    out = []
    if depth == 0:
        return out
    n = len(spine)
    for t in (0.3, 0.46, 0.62, 0.76, 0.9):
        i = min(n - 2, int(t * (n - 1)))
        x, y, w = spine[i]
        if w < 0.65:
            continue
        a = _heading(spine, i)
        side = rng.choice((-1, 1))
        turn = side * rng.uniform(0.35, 0.8)
        # upward more than not: pull the new heading toward the sky
        na = a + turn
        na = na + (-math.pi / 2 - na) * 0.25
        rest = sum(math.hypot(spine[j + 1][0] - spine[j][0], spine[j + 1][1] - spine[j][1]) for j in range(i, n - 1))
        ln = max(8 * k, rest * rng.uniform(0.45, 0.7))
        w0 = max(0.7, w * 0.62)
        pts = [(x, y, w0)]
        segs = 3 if angular else 4
        cx, cy, ca = x, y, na
        for j in range(segs):
            if angular:
                ca += rng.uniform(-0.55, 0.55)
            else:
                ca += rng.uniform(-0.2, 0.2) + (-math.pi / 2 - ca) * 0.08
            step = ln / segs
            cx, cy = cx + math.cos(ca) * step, cy + math.sin(ca) * step
            pts.append((cx, cy, max(0.45, w0 * (1 - (j + 1) / (segs + 0.6)))))
        out.append(pts)
        out.extend(branches(pts, rng, depth - 1, angular, k))
    return out


def snow_on(spine, cap, k, thick=1.0):
    """Snow lying along the top of a branch: thickest where the branch
    runs level, none where it rises steep."""
    up, low = [], []
    for i, (x, y, w) in enumerate(spine):
        a = _heading(spine, i)
        lev = abs(math.cos(a)) ** 1.5
        th = (0.5 + w * 0.32) * lev * thick * k ** 0.5
        nx, ny = math.sin(a), -math.cos(a)
        if nx * 0 + ny > 0:
            nx, ny = -nx, -ny
        up.append((x + nx * (w / 2 + th), y + ny * (w / 2 + th)))
        low.append((x + nx * w * 0.3, y + ny * w * 0.3))
    return smooth(up) + ' L' + smooth(low[::-1])[1:] + ' Z'


# ── the tree ───────────────────────────────────────────────────────

def tree(L, h, o, hour, gust, uid):
    kind = o.get('tree')
    if not kind:
        return ''
    T = TREE[L.W]
    k = T['spread']
    rng = random.Random(L.seed + {'sakura': 201, 'maple': 211}.get(kind, 221))
    c = PINE[hour]
    if kind == 'sarusuberi':
        bark_ink, mottle = CRAPE[hour][2]
    elif kind == 'ume':
        bark_ink, mottle = PLUM[hour][1], None
    elif kind == 'bare':
        bark_ink, mottle = BARE_BARK[hour], None
    else:
        bark_ink, mottle = o.get('bark', mix(c['trunk'], '#3a2a2a', 0.3)), None
    lit_ink = mix(bark_ink, c['trunk_lit'], 0.7)
    trunk = limb(T['trunk'], rng, wobble=0.1)
    trunk_lit = lit_band(T['trunk'], rng, side=1, a=0.12, b=0.46)
    cracks, flecks = bark(T['trunk'], rng)
    woods = []
    for spine in T['limbs']:
        wood = limb(spine, rng, wobble=0.12)
        wood_lit = lit_band(spine, rng, side=-1 if spine[-1][0] < spine[0][0] else 1, a=0.05, b=0.45)
        tw = twigs(spine, rng, k)
        woods.append((spine, f'<path d="{wood}" fill="{bark_ink}"></path><path d="{wood_lit}" fill="{lit_ink}" opacity="0.45"></path>'
                             f'<path d="{tw}" fill="none" stroke="{bark_ink}" stroke-width="{f(0.7 * k)}" stroke-linecap="round"></path>'))
    sway = [(spine[0][0], spine[0][1], rng.uniform(0.5, 0.9)) for spine, _ in woods]

    def swaying(i, inner):
        ax, ay, a = sway[i]
        return (f'<g class="f5-gust" style="transform-origin: {f(ax)}px {f(ay)}px; --a: {f(a)}deg; {gust(ax, L.W)}">'
                f'{inner}</g>')
    parts = [swaying(i, wood) for i, (_, wood) in enumerate(woods)]
    if kind in ('sakura', 'maple', 'aomomiji', 'sarusuberi'):
        for j, (cx, cy, rx, ry, i) in enumerate(T['lobes']):
            parts.append(swaying(i, lobe(kind, cx, cy, rx, ry, rng, o, hour, j, k)))
    elif kind == 'yanagi':
        for i, (spine, _) in enumerate(woods):
            parts.append(swaying(i, strands(spine, rng, WILLOW[hour], k, L)))
    else:
        angular = kind == 'ume'
        for i, (spine, _) in enumerate(woods):
            parts.append(swaying(i, bare_crown(spine, rng, angular, bark_ink, o, hour, k)))
    trunk_snow = ''
    if o.get('crowns') == 'snow':
        trunk_snow = f'<path d="{snow_on(T["trunk"][3:], o["cap"], k, 0.6)}" fill="{o["cap"]}" opacity="0.9"></path>'
    skin = ''
    if mottle:
        mr = random.Random(L.seed + 231)
        spots = ''.join(blob(x + mr.uniform(-w, w) * 0.25, y + mr.uniform(-4, 4), w * mr.uniform(0.18, 0.3), mr, lobes=3)
                        for x, y, w in T['trunk'][:-1] for _ in range(2))
        skin = f'<path d="{spots}" fill="{mottle}" opacity="0.55"></path>'
    fallen = ''
    if kind in ('sakura', 'sarusuberi'):
        fr = random.Random(L.seed + 205)
        bx = T['trunk'][0][0]
        col = o['bloom'][1] if kind == 'sakura' else CRAPE[hour][1][1]
        spots = ''.join(dot(bx + fr.gauss(0, 34 * k), L.ground + fr.uniform(6, 64) * k, fr.uniform(0.5, 1.1) * k) for _ in range(int(70 * k)))
        fallen = f'<path d="{spots}" fill="{col}" opacity="0.75"></path>'
    lanterns = lanterns_s(L, T, o, uid) if o.get('lanterns') else ''
    tx, ty = T['trunk'][0][0], T['trunk'][0][1]
    return (f'{fallen}<g>'
            f'<g class="f5-gust" style="transform-origin: {f(tx)}px {f(ty)}px; --a: 0.3deg; {gust(tx, L.W)}">'
            f'<path d="{trunk}" fill="{bark_ink}"></path>'
            f'<path d="{trunk_lit}" fill="{lit_ink}" opacity="0.5"></path>{skin}'
            f'<path d="{cracks}" fill="none" stroke="{mix(bark_ink, "#000000", 0.4)}" stroke-width="0.6" stroke-linecap="round" opacity="0.6"></path>'
            f'<path d="{flecks}" fill="none" stroke="{lit_ink}" stroke-width="0.7" stroke-linecap="round" opacity="0.4"></path>'
            f'{trunk_snow}{"".join(parts)}</g></g>{lanterns}')


def lobe(kind, cx, cy, rx, ry, rng, o, hour, j, k):
    if kind == 'sakura':
        return sakura_lobe(cx, cy, rx, ry, rng, o['bloom'], k)
    if kind == 'maple':
        bright, mid, deep = o['maple']
        t = {'day': 1.0, 'dawn': 0.75, 'dusk': 0.55, 'night': 0.18}[hour]
        if j in (1, 5):
            inks = (mix(bright, '#ec9a32', 0.6 * t), mix(mid, '#d8702a', 0.55 * t), deep)
        elif j == 2:
            inks = (mix(bright, '#ecb83c', 0.65 * t), mix(mid, '#cc8c2c', 0.6 * t), mix(deep, '#7a4a20', 0.45 * t))
        else:
            inks = o['maple']
        return maple_lobe(cx, cy, rx, ry, rng, inks, k)
    if kind == 'aomomiji':
        bright, mid, deep = GREEN_MAPLE[hour]
        if j in (1, 5):
            t = {'day': 1.0, 'dawn': 0.7, 'dusk': 0.4, 'night': 0.0}[hour]
            bright, mid = mix(bright, '#d6e888', 0.35 * t), mix(mid, '#94bc4c', 0.3 * t)
        return green_lobe(cx, cy, rx, ry, rng, (bright, mid, deep), k)
    return crape_lobe(cx, cy, rx, ry, rng, hour, k)


def green_lobe(cx, cy, rx, ry, rng, inks, k):
    """青もみじ: a lobe of the maple in its summer leaf, deep under, the
    sun through the leaves on top; the same cut leaves as autumn's, in
    green alone."""
    from s1_flora import leaf5
    bright, mid, deep = inks
    out = [f'<path d="{scallop(cx + rx * 0.05, cy + ry * 0.2, rx, ry * 0.92, rng, depth=0.35)}" fill="{deep}"></path>',
           f'<path d="{scallop(cx, cy, rx * 0.94, ry * 0.86, rng, depth=0.35)}" fill="{mid}"></path>']
    leaves = {bright: [], mid: [], deep: []}
    for _ in range(int(rx * ry / (10 * k * k))):
        a = rng.uniform(0, 2 * math.pi)
        u = math.sqrt(rng.random())
        lx, ly = cx + math.cos(a) * u * rx, cy + math.sin(a) * u * ry * 0.95
        up = (cy - ly) / ry
        col = bright if up > -0.15 and rng.random() < 0.75 else (deep if up < -0.4 else mid)
        leaves[col].append(leaf5(lx, ly, rng.uniform(2.0, 3.0) * k, rng.uniform(-60, 60)))
    out += [f'<path d="{"".join(ds)}" fill="{col}"></path>' for col, ds in leaves.items() if ds]
    return ''.join(out)


def crape_lobe(cx, cy, rx, ry, rng, hour, k):
    """百日紅: a lobe of small leaves, and on its top the crape myrtle's
    flowers, crinkled heads massed in cones at the shoots' ends."""
    leaves, flowers, _ = CRAPE[hour]
    out = [f'<path d="{scallop(cx + rx * 0.05, cy + ry * 0.2, rx, ry * 0.9, rng, depth=0.32)}" fill="{leaves[2]}"></path>',
           f'<path d="{scallop(cx, cy, rx * 0.94, ry * 0.84, rng, depth=0.32)}" fill="{leaves[1]}"></path>',
           f'<path d="{scallop(cx - rx * 0.1, cy - ry * 0.25, rx * 0.6, ry * 0.45, rng, depth=0.3)}" fill="{leaves[0]}" opacity="0.7"></path>']
    lit, mid, deep = flowers
    heads = {deep: [], mid: [], lit: []}
    for _ in range(max(3, int(rx / (7 * k)))):
        a = rng.uniform(math.pi * 1.05, math.pi * 1.95)
        hx, hy = cx + math.cos(a) * rx * rng.uniform(0.3, 0.85), cy + math.sin(a) * ry * rng.uniform(0.35, 0.9)
        hr = rng.uniform(3.2, 5) * k
        heads[deep].append(blob(hx + hr * 0.1, hy + hr * 0.25, hr, rng, lobes=4))
        heads[mid].append(blob(hx, hy, hr * 0.85, rng, lobes=5))
        for _ in range(7):
            fa = rng.uniform(0, 2 * math.pi)
            fr = hr * math.sqrt(rng.random()) * 0.8
            heads[lit].append(dot(hx + math.cos(fa) * fr, hy + math.sin(fa) * fr * 0.8 - hr * 0.15, rng.uniform(0.6, 1.0) * k))
    out += [f'<path d="{"".join(ds)}" fill="{col}"></path>' for col, ds in heads.items() if ds]
    return ''.join(out)


def strands(spine, rng, inks, k, L):
    """柳: the willow's strands, each arching out from its limb and over,
    then let down long and fine toward the bank, leaved in short pairs
    of dashes along its length: a curtain, its crown made by the arches;
    the outer strands in the light, the inner in shade."""
    lit, mid, deep = inks
    lines = {deep: [], mid: [], lit: []}
    leafs = {deep: [], mid: [], lit: []}
    n = len(spine)
    out_dir = 1 if spine[-1][0] > spine[0][0] else -1
    for _ in range(int(46 * k ** 0.6)):
        t = rng.uniform(0.15, 1.0) ** 0.7
        i = min(n - 1, int(t * (n - 1)))
        x, y, _w = spine[i]
        x += rng.uniform(-8, 8) * k
        y -= rng.uniform(0, 6) * k
        ln = rng.uniform(34, 100) * k * (0.6 + 0.5 * t)
        arc = rng.uniform(5, 13) * k * (0.5 + 0.7 * t)
        d = out_dir if rng.random() < 0.75 else -out_dir
        sway = rng.uniform(-8, 3) * k
        col = (deep, mid, lit)[min(2, int(rng.random() * 3 * (0.6 + 0.4 * t)))]
        # the arch, out and over, then the long fall
        pts = [(x, y), (x + d * arc * 0.45, y - arc * 0.55), (x + d * arc * 0.9, y - arc * 0.35)]
        hx, hy = x + d * arc, y
        for j in range(1, 8):
            u = j / 7
            pts.append((hx + sway * u ** 2 + 2.5 * k * math.sin(u * 3), hy + ln * u))
        lines[col].append(smooth(pts))
        for px, py in pts[2:]:
            for side in (-1, 1):
                lw = rng.uniform(2.0, 3.2) * k
                leafs[col].append(f'M{f(px)} {f(py - 2 * k)}l{f(side * lw * 0.42)} {f(lw * 0.95)}')
    out = []
    for col in (deep, mid, lit):
        if lines[col]:
            out.append(f'<path d="{"".join(lines[col])}" fill="none" stroke="{col}" stroke-width="{f(0.55 * k)}" stroke-linecap="round"></path>'
                       f'<path d="{"".join(leafs[col])}" fill="none" stroke="{col}" stroke-width="{f(1.0 * k)}" stroke-linecap="round"></path>')
    return ''.join(out)


def bare_crown(spine, rng, angular, bark_ink, o, hour, k):
    """The bare tree's branches off a limb, their snow, and for the plum
    its flowers: small, five-petalled, along the shoots and at their
    ends, with buds. The thicker branches are drawn whole, tapering; the
    thin ones, most of them, as strokes in three weights, and their snow
    as a stroke along their tops where they run level enough to hold it,
    so a tree of hundreds of twigs stays light to draw."""
    kids = branches(spine, rng, 3, angular, k)
    thick = [s_ for s_ in kids if s_[0][2] >= 1.6 * k]
    thin = [s_ for s_ in kids if s_[0][2] < 1.6 * k]
    wood = ''.join(f'<path d="{limb(s_, rng, wobble=0.08)}"></path>' for s_ in thick)
    weights = {0: [], 1: [], 2: []}
    for s_ in thin:
        b = 0 if s_[0][2] < 0.8 * k else (1 if s_[0][2] < 1.2 * k else 2)
        weights[b].append('M' + 'L'.join(f'{f(x)} {f(y)}' for x, y, _w in s_))
    out = [f'<g fill="{bark_ink}">{wood}</g>']
    for b, ds in weights.items():
        if ds:
            out.append(f'<path d="{"".join(ds)}" fill="none" stroke="{bark_ink}" stroke-width="{f((0.6 + 0.35 * b) * k)}" '
                       f'stroke-linecap="round" stroke-linejoin="round"></path>')
    if o.get('cap'):
        snow = ''.join(f'<path d="{snow_on(s_, o["cap"], k)}"></path>' for s_ in [spine] + thick)
        lines = []
        for s_ in thin:
            for (x0, y0, w0), (x1, y1, _w1) in zip(s_, s_[1:]):
                a = math.atan2(y1 - y0, x1 - x0)
                if abs(math.cos(a)) > 0.55:
                    up = w0 / 2 + 0.35 * k
                    lines.append(f'M{f(x0)} {f(y0 - up)}L{f(x1)} {f(y1 - up)}')
        out.append(f'<g fill="{o["cap"]}" opacity="0.95">{snow}</g>'
                   f'<path d="{"".join(lines)}" fill="none" stroke="{o["cap"]}" stroke-width="{f(0.9 * k)}" stroke-linecap="round" opacity="0.92"></path>')
    if angular:
        (lit, mid, deep), _ = PLUM[hour]
        flowers, hearts, buds = [], [], []
        for s_ in [spine] + kids:
            near = s_[0][2] >= 1.6 * k
            for j, (x, y, w) in enumerate(s_[1:], 1):
                if rng.random() < 0.5:
                    fr = rng.uniform(1.3, 1.9) * k
                    fx, fy = x + rng.uniform(-1.5, 1.5) * k, y + rng.uniform(-1.8, 0.6) * k
                    # a face of five petals where the flower is big enough
                    # to be read as one; on the twigs, the round of it
                    flowers.append(five(fx, fy, fr, rng.uniform(0, 72)) if near else dot(fx, fy, fr * 0.62))
                    hearts.append(dot(fx, fy, fr * 0.22))
                if rng.random() < 0.35:
                    buds.append(dot(x + rng.uniform(-2, 2) * k, y + rng.uniform(-2, 1) * k, rng.uniform(0.6, 0.9) * k))
        out.append(f'<path d="{"".join(buds)}" fill="{deep}"></path>'
                   f'<path d="{"".join(flowers)}" fill="{mid}"></path>'
                   f'<path d="{"".join(hearts)}" fill="{mix(lit, "#f6d07a", 0.6)}"></path>')
    return ''.join(out)
