"""F⁷ · the pine's foliage redrawn the way the prints cut it: each tier
of the pine a stack of needle tufts, every tuft a half-disc of needles
fanning up from its shoot, its edge a crisp fringe of needle tips, lit
along the top and dark at its foot; a back row along the tier's dome
and a front row set between them, lower, so the tier reads as tufts
laid one over another. Under them the tier's dark mass. The trunk, its
bark and the branches are F⁶'s (el7.py)."""
import math
import random
from geo import f
from el7 import PINE, TRUNK, limb, lit_band, bark, mix

TUFT = {
    # the back row's top and foot, the front row's, the needles drawn
    # into each clump, and the tier's mass under them
    'day': dict(back=('#5f8c55', '#1d3826'), front=('#4c7747', '#152c1e'), needle='#0d1e14', mass='#10201a'),
    'dusk': dict(back=('#2b4237', '#0b1612'), front=('#223a30', '#08120e'), needle='#050b09', mass='#08100d'),
    'night': dict(back=('#1d3133', '#070e0e'), front=('#18292b', '#050b0b'), needle='#030707', mass='#040909'),
    'dawn': dict(back=('#463e5e', '#14111e'), front=('#3b3450', '#100d18'), needle='#09070f', mass='#0d0b14'),
}

# the boughs as before, the right-hand tier lifted clear of the train
BOUGHS = [
    ([(103, 481, 6), (110, 473, 4.6), (118, 468, 3.6)], (118, 466, 72, 21)),
    ([(92, 503, 7), (98, 498, 5.4), (104, 494, 4)], (94, 493, 94, 23)),
    ([(84, 521, 7.5), (72, 523, 6), (60, 518, 4.6), (47, 514, 3.6), (36, 509, 2.8)], (30, 507, 62, 19)),
    ([(72, 553, 8), (86, 555, 6.4), (102, 548, 5), (116, 539, 3.8), (127, 532, 3)], (136, 525, 70, 19)),
    ([(52, 598, 8), (42, 590, 6.2), (34, 578, 4.6), (32, 568, 3.6)], (40, 563, 56, 17)),
]


def clump(cx, cy, R, rng):
    """A clump of needles seen from the side: a low dome on its shoot at
    (cx, cy); the fine needles fringing its top, and a few drawn into
    it, fanning from the shoot."""
    ry = R * 0.74
    n = 26
    top = []
    for j in range(n + 1):
        a = math.pi + math.pi * j / n
        k = 1 + 0.05 * math.sin(j * 1.9 + rng.uniform(0, 6))
        top.append((cx + math.cos(a) * R * k, cy + math.sin(a) * ry * k))
    # its underside, flatter than its top: a clump, not a dome
    under = []
    for j in range(1, 12):
        a = math.pi * j / 12
        under.append((cx + math.cos(a) * R * 0.98, cy + math.sin(a) * ry * 0.55))
    d = 'M' + 'L'.join(f'{f(x)} {f(y)}' for x, y in top + under) + 'Z'
    fringe = []
    m = int(R * 3.2)
    for j in range(m + 1):
        a = math.pi * 1.06 + math.pi * 0.88 * j / m + rng.uniform(-0.02, 0.02)
        r0, r1 = rng.uniform(0.84, 0.94), rng.uniform(1.08, 1.24)
        tilt = rng.uniform(-0.18, 0.18)
        fringe.append(f'M{f(cx + math.cos(a) * R * r0)} {f(cy + math.sin(a) * ry * r0)}'
                      f'L{f(cx + math.cos(a + tilt) * R * r1)} {f(cy + math.sin(a + tilt) * ry * r1)}')
    lines = []
    for j in range(5):
        a = math.pi * (1.2 + 0.6 * j / 4) + rng.uniform(-0.08, 0.08)
        lines.append(f'M{f(cx + math.cos(a) * R * 0.2)} {f(cy + math.sin(a) * ry * 0.2)}'
                     f'L{f(cx + math.cos(a) * R * 0.72)} {f(cy + math.sin(a) * ry * 0.72)}')
    return d, ''.join(fringe), ''.join(lines)


def tier8(cx, cy, w, hh, rng, c, uid):
    """A tier of the pine: its dark mass; a back row of clumps along a
    low dome, catching the light; a front row set between them and
    lower, in the tier's shade."""
    R0 = hh * 0.5
    step = R0 * 1.02
    n = max(3, int(round(w / step)))
    rows = []
    for row in (0, 1):
        domes, fringes, lines = [], [], []
        count = n if row == 0 else n - 1
        for i in range(count):
            t = (i + 0.5) / n if row == 0 else (i + 1) / n
            u = 2 * t - 1
            R = R0 * (1 if row == 0 else 0.84) * (1 - 0.28 * u * u) * rng.uniform(0.9, 1.1)
            x = cx - w / 2 + t * w + rng.uniform(-0.15, 0.15) * step
            y = (cy + hh * 0.02 - (1 - u * u) * hh * 0.2) if row == 0 else (cy + hh * 0.34 - (1 - u * u) * hh * 0.07)
            y += rng.uniform(-0.04, 0.04) * hh
            d, fr, ln = clump(x, y, R, rng)
            domes.append(d)
            fringes.append(fr)
            lines.append(ln)
        key = 'back' if row == 0 else 'front'
        grad = f'{uid}Tuft{"B" if row == 0 else "F"}'
        rows.append(f'<path d="{"".join(domes)}" fill="url(#{grad})"></path>'
                    f'<path d="{"".join(lines)}" fill="none" stroke="{c["needle"]}" stroke-width="0.4" stroke-linecap="round" opacity="0.4"></path>'
                    f'<path d="{"".join(fringes)}" fill="none" stroke="{c[key][0]}" stroke-width="0.38" stroke-linecap="round" opacity="0.9"></path>')
    # the mass under the clumps, filling between the rows down to the
    # tier's shaded underside
    mass = (f'<rect x="{f(cx - w * 0.42)}" y="{f(cy - hh * 0.1)}" width="{f(w * 0.84)}" height="{f(hh * 0.4)}" '
            f'rx="{f(hh * 0.15)}" fill="{c["mass"]}"></rect>')
    return mass + ''.join(rows)


def pine_defs(hour, uid):
    c = TUFT[hour]
    out = []
    for key, name in (('back', 'B'), ('front', 'F')):
        top, foot = c[key]
        out.append(f'<linearGradient id="{uid}Tuft{name}" x1="0" y1="0" x2="0" y2="1">'
                   f'<stop offset="0" stop-color="{top}"></stop><stop offset="0.45" stop-color="{mix(top, foot, 0.5)}"></stop>'
                   f'<stop offset="1" stop-color="{foot}"></stop></linearGradient>')
    return ''.join(out)


def pine8(L, h, hour, gust, uid):
    """The pine at the left of the print, framing it: F⁶'s trunk and
    branches, its tiers redrawn as tufts of needles."""
    px, py, s = L.pine
    c = PINE[hour]
    t = TUFT[hour]
    rng = random.Random(11)
    trunk = limb(TRUNK, rng, wobble=0.12)
    trunk_lit = lit_band(TRUNK, rng, side=1, a=0.14, b=0.47)
    cracks, flecks = bark(TRUNK, rng)
    trng = random.Random(23)
    boughs = []
    for spine, (cx, cy, w, hh) in BOUGHS:
        branch = limb(spine, rng, wobble=0.15)
        branch_lit = lit_band(spine, rng, side=-1 if spine[-1][0] < spine[0][0] else 1, a=0.05, b=0.46)
        ax, ay = spine[0][0], spine[0][1]
        boughs.append(
            f'<g class="f5-gust" style="transform-origin: {f(ax)}px {f(ay)}px; --a: {f(rng.uniform(0.5, 0.9))}deg; {gust(px + ax * s, L.W)}">'
            f'<path d="{branch}" fill="{c["trunk"]}"></path>'
            f'<path d="{branch_lit}" fill="{c["trunk_lit"]}" opacity="0.5"></path>'
            f'{tier8(cx, cy, w, hh, trng, t, uid)}</g>')
    return (f'<g class="f8-pine" transform="translate({f(px)} {f(py - 746 * s)}) scale({f(s)})">'
            f'<g class="f5-gust" style="transform-origin: 22px 746px; --a: 0.25deg; {gust(px, L.W)}">'
            f'<path d="{trunk}" fill="{c["trunk"]}"></path>'
            f'<path d="{trunk_lit}" fill="{c["trunk_lit"]}" opacity="0.55"></path>'
            f'<path d="{cracks}" fill="none" stroke="{c["bark"]}" stroke-width="0.6" stroke-linecap="round" opacity="0.7"></path>'
            f'<path d="{flecks}" fill="none" stroke="{c["fleck"]}" stroke-width="0.7" stroke-linecap="round" opacity="0.5"></path>'
            f'{"".join(boughs)}</g></g>')
