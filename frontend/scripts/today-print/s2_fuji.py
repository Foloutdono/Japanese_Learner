"""S² · Fuji in summer, its snow gone (plan 261, the canvas "Tsuji —
Today, the seasons", round 2). Round 1 drew the summer mountain as the
snowy one with its snow taken away, and left a dark cone. Without snow
the mountain shows what the snow hides, the way the prints draw it
(凱風快晴):

- two grounds: the bare cone of cinder above the tree line, warm under
  the blue of the distance; the forest below it, blue-green, climbing
  the ravines in fingers and breaking into the crowns of its trees at
  its upper edge;
- the gullies: lines radiating from the crater, each a dark furrow with
  a lit edge on the side the light comes from, fading as they reach the
  forest;
- the summit's last snow, a few thin streaks in the gullies under the
  crater's rim, never a cap;
- the side away from the light a shade deeper, the mist at the foot, as
  the snowy mountain has them.

At dawn the cinder is the red of 凱風快晴, lit along its right flank."""
import math
import random
from geo import f


def tree_line(fj, seed, base=0.56):
    """u of the tree line across v: a slow wave, lower toward the
    flanks, and fingers of forest climbing the ravines."""
    rng = random.Random(seed + 23)
    ph = rng.uniform(0, 6)
    fingers = []
    v = -0.86 + rng.uniform(0, 0.08)
    while v < 0.9:
        fingers.append((v, rng.uniform(0.03, 0.075), rng.uniform(0.025, 0.11)))
        v += rng.uniform(0.09, 0.24)

    def u_of(v):
        u = base + 0.03 * math.sin(v * 6.1 + ph) + 0.015 * math.sin(v * 17 + ph * 2) + 0.06 * abs(v) ** 3
        for c, w, ln in fingers:
            u -= ln * math.exp(-((v - c) / w) ** 2)
        return u
    return u_of, fingers


def bare(fj, p, uid, seed, hour):
    """The snowless mountain, in the hour's inks (`p`, the Fuji palette
    with its bare_* and forest_* inks)."""
    rng = random.Random(seed + 11)
    body = fj.body()
    x0, ys, yb, hb = fj.x0, fj.ys, fj.yb, fj.hb
    k = hb / 210
    u_of, fingers = tree_line(fj, seed)
    # the forest: from the tree line down to the foot, flank to flank
    n = 160
    line = [fj.at(u_of(v), v) for v in (1 - 2 * j / n for j in range(n + 1))]
    ur, ul = u_of(1.0), u_of(-1.0)
    right = [fj.at(ur + (1 - ur) * j / 20, 1) for j in range(21)]
    left = [fj.at(1 - (1 - ul) * j / 20, -1) for j in range(21)]
    forest = 'M' + ' L'.join(f'{f(x)} {f(y)}' for x, y in right + [fj.at(1, -1)] + left + line) + ' Z'
    # its upper edge broken into crowns: the trees standing highest
    crowns = []
    for j in range(int(140 * k ** 0.5)):
        v = rng.uniform(-0.98, 0.98)
        u = u_of(v) + rng.uniform(-0.004, 0.03)
        x, y = fj.at(u, v)
        r = rng.uniform(0.7, 1.5) * k ** 0.6
        crowns.append(f'M{f(x - r)} {f(y)}a{f(r)} {f(r)} 0 1 0 {f(2 * r)} 0a{f(r)} {f(r)} 0 1 0 {f(-2 * r)} 0')
    # the gullies: furrows from under the rim, each with its lit edge
    dark, lit = [], []
    m = int(19 * k ** 0.3)
    for j in range(m):
        v = -0.94 + 1.88 * (j + rng.uniform(0.15, 0.85)) / m
        u0 = rng.uniform(0.02, 0.09)
        u1 = min(u_of(v) + 0.03, rng.uniform(0.26, 0.62))
        wob = rng.uniform(-0.02, 0.02)
        pts = [fj.at(u0 + (u1 - u0) * t / 14, v + wob * math.sin(t * 0.7)) for t in range(15)]
        dark.append(_taper(pts, rng.uniform(0.9, 2.0) * k ** 0.5, start=0.35))
        if j % 2 == 0:
            side = 1 if v > -0.15 else -1
            off = 1.1 * k ** 0.5 * side
            lp = [(x + off, y) for x, y in pts[:10]]
            lit.append(_taper(lp, rng.uniform(0.6, 1.2) * k ** 0.5, start=0.35))
    # the last snow: a few streaks in the gullies under the rim
    snow = []
    for j in range(p.get('streaks', 7)):
        v = -0.55 + 1.1 * (j + rng.uniform(0.25, 0.75)) / max(1, p.get('streaks', 7))
        u1 = rng.uniform(0.07, 0.17)
        pts = [fj.at(0.004 + (u1 - 0.004) * t / 8, v + 0.01 * math.sin(t)) for t in range(9)]
        w = rng.uniform(0.9, 1.6) * k ** 0.5
        snow.append((pts, w))
    snow_d = ''.join(_taper(pts, w) for pts, w in snow)
    return f'''<defs>
        <linearGradient id="{uid}Body" x1="0" y1="{f(ys)}" x2="0" y2="{f(yb)}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="{p['bare_top']}"></stop>
          <stop offset="0.45" stop-color="{p['bare_mid']}"></stop>
          <stop offset="1" stop-color="{p['fuji_foot']}"></stop>
        </linearGradient>
        <linearGradient id="{uid}Forest" x1="0" y1="{f(fj.at(0.5, 0)[1])}" x2="0" y2="{f(yb)}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="{p['forest_top']}"></stop>
          <stop offset="1" stop-color="{p['forest_foot']}"></stop>
        </linearGradient>
        <linearGradient id="{uid}Side" x1="{f(x0 - hb * 0.7)}" y1="0" x2="{f(x0 + hb * 0.25)}" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="{p['fuji_shade']}" stop-opacity="0.5"></stop>
          <stop offset="1" stop-color="{p['fuji_shade']}" stop-opacity="0"></stop>
        </linearGradient>
        <linearGradient id="{uid}Light" x1="{f(x0)}" y1="0" x2="{f(x0 + hb)}" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="{p['ridge_lit']}" stop-opacity="0"></stop>
          <stop offset="1" stop-color="{p['ridge_lit']}" stop-opacity="{p.get('light_op', 0.22)}"></stop>
        </linearGradient>
        <linearGradient id="{uid}Mist" x1="0" y1="{f(yb - (yb - ys) * 0.42)}" x2="0" y2="{f(yb)}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="{p['fuji_mist']}" stop-opacity="0"></stop>
          <stop offset="0.7" stop-color="{p['fuji_mist']}" stop-opacity="0.72"></stop>
          <stop offset="1" stop-color="{p['fuji_mist']}" stop-opacity="0.9"></stop>
        </linearGradient>
        <clipPath id="{uid}Clip"><path d="{body}"></path></clipPath>
      </defs>
      <g class="fuji">
        <path d="{body}" fill="url(#{uid}Body)"></path>
        <g clip-path="url(#{uid}Clip)">
          <path d="{forest}" fill="url(#{uid}Forest)"></path>
          <path d="{"".join(crowns)}" fill="{p['forest_top']}"></path>
          <rect x="{f(x0 - hb - 4)}" y="{f(ys - 4)}" width="{f(hb * 2 + 8)}" height="{f(yb - ys + 8)}" fill="url(#{uid}Side)"></rect>
          <rect x="{f(x0 - 4)}" y="{f(ys - 4)}" width="{f(hb + 8)}" height="{f(yb - ys + 8)}" fill="url(#{uid}Light)"></rect>
          <path d="{"".join(dark)}" fill="{p['gully']}" opacity="0.5"></path>
          <path d="{"".join(lit)}" fill="{p['ridge_lit']}" opacity="0.4"></path>
          <path d="{snow_d}" fill="{p['snow']}" opacity="{p.get('snow_op', 0.92)}"></path>
          <rect x="{f(x0 - hb - 4)}" y="{f(yb - (yb - ys) * 0.42)}" width="{f(hb * 2 + 8)}" height="{f((yb - ys) * 0.42 + 4)}" fill="url(#{uid}Mist)"></rect>
        </g>
      </g>'''


def _taper(pts, w, start=0.7):
    """A streak along `pts`, widest near its top and thinning to a
    point, as snow lies in a gully (and a furrow runs down the cone)."""
    left, right = [], []
    n = len(pts) - 1
    for i, (x, y) in enumerate(pts):
        t = i / n
        hw = w / 2 * (1 - t) ** 0.8 * (start + (1 - start) * math.sin(min(1, t * 4) * math.pi / 2))
        left.append((x - hw, y))
        right.append((x + hw, y))
    pts_ = left + right[::-1]
    return 'M' + 'L'.join(f'{f(x)} {f(y)}' for x, y in pts_) + 'Z'
