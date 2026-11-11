"""S⁴ · the summer's cloud peak, four ways to choose from (plan 261, the
canvas "Tsuji — Today, the seasons", round 4).

雲の峰 (the cloud peak) is the summer's word for its sky, as the cherry
is the spring's: the towering cloud of a hot afternoon, a season word
in haiku since Bashō (雲の峰幾つ崩れて月の山). The summer's day print is
named for it (雲峰), so its sky says "summer afternoon" before anything
else does. Four ways to draw it:

- hokusai: as Hokusai draws cumulus over Fuji (山下白雨, Thirty-six
  Views): flat white heaps, each billow outlined in a fine grey-blue
  line, nothing shaded; the print's own language, no painting in it.
- tones: as a shin-hanga print would cut it, in three flat tones, one
  block each: the white the sun is on, a pale blue-grey, the shadow;
  each tone's edge follows the billows, the foot lost in a bokashi.
- far: the cloud far off behind Fuji, so the mountain stands dark in
  front of it: one great tower, pale with distance, its top flattening
  into an anvil.
- bank: no tower; a low bank of summer cumulus along the horizon on both
  sides of Fuji, as 山下白雨 has it, a few heads rising out of it,
  drawn as hokusai's are.

`variant={'peak': name}`; left out, round 3's (s3_air)."""
import math
import random
from geo import f
from scene_f4 import anim
import s3_air
from s3_air import MAIN, SMALL, lobe, union

PEAKS = ('hokusai', 'tones', 'far', 'bank')

# the far cloud behind Fuji's flank, in its own units as MAIN is: a
# broad dome of lobes, wider at its shoulders than a tower is, its crown
# rounded (a column with an anvil over Fuji reads as an eruption)
FAR = [
    (0.5, -0.82, 0.13), (0.34, -0.74, 0.12), (0.66, -0.72, 0.13),
    (0.44, -0.62, 0.17), (0.62, -0.58, 0.16), (0.24, -0.54, 0.13), (0.8, -0.5, 0.13),
    (0.5, -0.4, 0.2), (0.3, -0.36, 0.17), (0.72, -0.34, 0.18), (0.1, -0.28, 0.13), (0.92, -0.26, 0.14),
    (-0.02, -0.08, 0.14), (0.2, -0.09, 0.18), (0.42, -0.08, 0.2), (0.64, -0.09, 0.19), (0.86, -0.08, 0.17), (1.06, -0.05, 0.13),
]

TOWERS = {
    # per option, per frame: (shape, left, foot, width, opacity)
    'hokusai': {390: [(MAIN, -10, 478, 160, 1.0)], 1184: [(MAIN, -30, 654, 400, 1.0), (SMALL, 900, 654, 250, 0.9)]},
    'tones': {390: [(MAIN, -10, 478, 160, 1.0)], 1184: [(MAIN, -30, 654, 400, 1.0), (SMALL, 900, 654, 250, 0.9)]},
    'far': {390: [(FAR, 262, 472, 136, 1.0)], 1184: [(FAR, 410, 646, 236, 1.0)]},
}

HOKUSAI = dict(white='#fbfaf5', line='#8798b8', foot='#c9d3e4')
TONES = dict(lit='#fffdf6', mid='#dfe5f0', shade='#b3bfd8', deep='#97a5c6', far_lit='#eef2f8', haze='#dfe9f1')
# the far cloud, pale with distance: its inks mixed toward the sky
FARINK = dict(lit='#fbf6ee', mid='#e3e6ef', shade='#c9d0e2', deep='#b7c0d8', far_lit='#eff1f6', haze='#e6eef2')


def _lobes(shape, left, foot, w, rng, rim=None):
    out = []
    for x, y, r in shape:
        lb = lobe(left + x * w, foot + y * w, r * w, rng)
        if rim:
            lb = rim(lb, rng)
        out.append(lb)
    return out


def _even_rim(lb, rng):
    """Hokusai's billows: a lobe's rim heaped evenly with rounds of a
    size, as a woodblock line draws them."""
    x, y, r = lb[0]
    out = [(x, y, r)]
    n = 7
    for j in range(n):
        a = math.pi * (1.06 + 0.88 * (j + 0.5) / n) + rng.uniform(-0.04, 0.04)
        rr = r * 0.36 * rng.uniform(0.92, 1.08)
        dd = r - rr * 0.32
        out.append((x + math.cos(a) * dd, y + math.sin(a) * dd, rr))
    return out


def _order(lobes):
    return sorted(lobes, key=lambda lb: lb[0][1] - lb[0][2] * 0.3)


def hokusai(shape, left, foot, w, op, sun, uid, rng, lw=None):
    """Flat white heaps, each billow outlined: each lobe, from the crown
    down, stroked twice its line's width and filled over it, so the line
    shows outside it alone; the lobes under it cover its foot, and what
    is left are the arcs of every billow's top."""
    lw = lw or (0.9 if w < 200 else 1.25)
    c = HOKUSAI
    lobes = _lobes(shape, left, foot, w, rng, _even_rim)
    out = []
    for lb in _order(lobes):
        u = union(lb)
        out.append(f'<path d="{u}" fill="none" stroke="{c["line"]}" stroke-width="{f(lw * 2)}"></path>'
                   f'<path d="{u}" fill="{c["white"]}"></path>')
    bl = [cc for lb in lobes for cc in lb]
    y0 = min(y - r for x, y, r in bl)
    gid = f'{uid}Hk{int(left)}'
    return (f'<defs><linearGradient id="{gid}" x1="0" y1="{f(foot)}" x2="0" y2="{f(foot - (foot - y0) * 0.4)}" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{c["foot"]}" stop-opacity="0.9"></stop><stop offset="1" stop-color="{c["foot"]}" stop-opacity="0"></stop>'
            f'</linearGradient><clipPath id="{gid}K"><path d="{union(bl)}"></path></clipPath></defs>'
            f'<g opacity="{f(op)}">{"".join(out)}<rect x="{f(left - w)}" y="{f(y0)}" width="{f(w * 3)}" height="{f(foot - y0)}" '
            f'fill="url(#{gid})" clip-path="url(#{gid}K)"></rect></g>')


def tones(shape, left, foot, w, op, sun, uid, rng, ink=TONES):
    """Three flat tones, cut as blocks are: each lobe from the crown down
    laid in its shadow, then its half-light and its light, each the lobe
    moved toward the sun and cut to the lobe, so every tone's edge
    follows the billows and the shadow is a scalloped crescent on the
    side away from the sun. Lobes on the tower's far side, and low, are
    laid a tone deeper."""
    c = ink
    lobes = _lobes(shape, left, foot, w, rng)
    bl = [cc for lb in lobes for cc in lb]
    x0 = min(x - r for x, y, r in bl)
    x1 = max(x + r for x, y, r in bl)
    y0 = min(y - r for x, y, r in bl)
    cx, cy = (x0 + x1) / 2, (y0 + foot) / 2
    R = max(x1 - x0, foot - y0) / 2
    lx, ly = sun[0] - cx, sun[1] - cy
    d = math.hypot(lx, ly)
    lx, ly = lx / d, ly / d
    defs, out = [], []
    for j, lb in enumerate(_order(lobes)):
        x, y, r = lb[0]
        # where the lobe faces on the whole tower, and how high it is
        s = 0.5 + 0.7 * ((x - cx) * lx + (y - cy) * ly) / R
        hgt = (foot - y) / (foot - y0)
        far = s < 0.42 or hgt < 0.18
        lit, mid, shade = (c['mid'], c['shade'], c['deep']) if far else (c['lit'], c['mid'], c['shade'])
        if s > 0.75 and hgt > 0.5:
            lit = c['lit']
        u = union(lb)
        k = f'{uid}T{int(left)}_{j}'
        defs.append(f'<clipPath id="{k}"><path d="{u}"></path></clipPath>')
        d1, d2 = r * 0.16, r * 0.42
        out.append(f'<path d="{u}" fill="{shade}"></path>'
                   f'<g clip-path="url(#{k})"><path d="{u}" fill="{mid}" transform="translate({f(lx * d1)} {f(ly * d1)})"></path>'
                   f'<path d="{u}" fill="{lit}" transform="translate({f(lx * d2)} {f(ly * d2)})"></path></g>')
    gid = f'{uid}Th{int(left)}'
    return (f'<defs>{"".join(defs)}<linearGradient id="{gid}" x1="0" y1="{f(foot)}" x2="0" y2="{f(foot - (foot - y0) * 0.32)}" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{c["haze"]}" stop-opacity="0.9"></stop><stop offset="1" stop-color="{c["haze"]}" stop-opacity="0"></stop>'
            f'</linearGradient><clipPath id="{gid}K"><path d="{union(bl)}"></path></clipPath></defs>'
            f'<g opacity="{f(op)}">{"".join(out)}<rect x="{f(x0 - 10)}" y="{f(y0)}" width="{f(x1 - x0 + 20)}" height="{f(foot - y0)}" '
            f'fill="url(#{gid})" clip-path="url(#{gid}K)"></rect></g>')


# the bank: heaps along the horizon, (x, height) in frame units, the
# heads that rise out of it
BANK = {
    390: dict(foot=468, base=30, step=19, heads=[(14, 84), (62, 66), (112, 52), (338, 60), (384, 86)]),
    1184: dict(foot=644, base=50, step=34, heads=[(40, 150), (150, 120), (262, 92), (880, 104), (1010, 140), (1140, 118)]),
}


def bank(L, uid, rng):
    """夏雲: a low bank of cumulus along the horizon, as 山下白雨 has it,
    each heap a lobe of the bank's foot, a few heads rising out of it;
    drawn as Hokusai draws them, behind Fuji and the far hills."""
    b = BANK[L.W]
    foot, base, step = b['foot'], b['base'], b['step']
    shape = []
    x = -step
    while x < L.W + step:
        r = base * rng.uniform(0.8, 1.15)
        shape.append(((x - 0) / 100, -r * 0.55 / 100, r / 100))
        x += step * rng.uniform(0.8, 1.2)
    for hx, hh in b['heads']:
        r = hh * 0.36
        for k in range(3):
            t = k / 2
            shape.append(((hx + rng.uniform(-0.15, 0.15) * r) / 100, -(hh * (0.35 + 0.5 * t)) / 100, r * (1 - 0.25 * t) / 100))
    return hokusai(shape, 0, foot, 100, 1.0, (L.cx, L.cy), uid + 'Bk', rng, lw=0.9 if L.W < 600 else 1.25)


def thunderhead(L, h, o, hour, uid):
    """雲の峰, the way the variant names; round 3's without one."""
    if not o.get('thunderhead'):
        return ''
    kind = o.get('peak')
    if kind not in PEAKS:
        return s3_air.thunderhead(L, h, o, hour, uid)
    rng = random.Random(L.seed + 523)
    if kind == 'bank':
        return f'<g class="f5-rise" style="{anim(15, 4)}">{bank(L, uid, rng)}</g>'
    draw = {'hokusai': hokusai, 'tones': tones, 'far': lambda *a: tones(*a, ink=FARINK)}[kind]
    out = []
    for shape, left, foot, w, op in TOWERS[kind][L.W]:
        out.append(f'<g class="f5-rise" style="{anim(rng.uniform(13, 17), rng.uniform(0, 13))}">'
                   f'{draw(shape, left, foot, w, op, (L.cx, L.cy), uid, rng)}</g>')
    return ''.join(out)


def cloud_layout(L, hour, o):
    """The hour's flat banks, less any a tower would cut (as s3_air)."""
    kind = o.get('peak')
    if kind not in TOWERS:
        return s3_air.cloud_layout(L, hour, o)
    saved = s3_air.TOWERS
    s3_air.TOWERS = TOWERS[kind]
    try:
        return s3_air.cloud_layout(L, hour, o)
    finally:
        s3_air.TOWERS = saved
