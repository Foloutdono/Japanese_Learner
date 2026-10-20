"""S¹ · the print of the hour, in its season (plan 261, the canvas
"Tsuji — Today, the seasons", round 1). Round 9's landscape and
its four hours as the owner picked them, dressed by the year: the inks
of each season's hours (s1_inks.py), the snow on Fuji, the woods on the
hills turning, the bank's flowers, what falls and what flies.

    scene(L, hour, season) -> sky, back, train, front, run

as scene_f9.scene: the same four layers and the train's run."""
import contextlib
import copy
import random

import el7  # noqa: E402
import scene_f5  # noqa: E402
import scene_f9  # noqa: E402
from geo import f  # noqa: E402
from fuji import Fuji  # noqa: E402
from scene_f3 import stops, smooth  # noqa: E402
from scene_f4 import disc, anim  # noqa: E402
from scene_f5 import clouds, cloud_defs, gust  # noqa: E402
from scene_f6 import (SEA, mix, ridges, ridge_y, fog, water, fleet, seawall, village, smoke6)  # noqa: E402
from el7 import (boats7, reflections7, boat_defs, catenary7, train_defs, bridge7, bridge_defs,
                 cosmos_defs, grass7)  # noqa: E402
from scene_f9 import train8, stars9, ground9  # noqa: E402

import s1_inks as pal  # noqa: E402
import s1_flora as flora  # noqa: E402
import s1_air as air  # noqa: E402


# ── the season's inks, laid over the hour's ─────────────────────────

def inks(season, hour):
    """The hour's inks as the season has them: the scene's, the bay's,
    and the season's own notes (what grows, falls, flies)."""
    o = pal.P[season][hour]
    h = copy.deepcopy(scene_f9.HOURS[hour])
    for k, v in o.get('h', {}).items():
        if k == 'fuji':
            h['fuji'] = {**h['fuji'], **v}
        else:
            h[k] = v
    s = {**SEA[hour], **o.get('sea', {})}
    h['view'] = pal.VIEWS[season][hour]
    h['view_fr'] = pal.VIEWS_FR[season][hour]
    return h, s, o


@contextlib.contextmanager
def dressed(season, hour, o):
    """The tables el7 and scene_f5 read by hour, given the season's
    entries while the print is drawn."""
    saved = []

    def put(table, key, value):
        saved.append((table, key, table[key]))
        table[key] = value
    if 'cloud' in o:
        put(scene_f5.CLOUD_INK, hour, {**scene_f5.CLOUD_INK[hour], **o['cloud']})
    if 'bridge' in o:
        put(el7.BRIDGE, hour, o['bridge'])
    if 'train_roof' in o:
        put(el7.TRAIN, hour, {**el7.TRAIN[hour], 'roof': o['train_roof']})
    try:
        yield
    finally:
        for table, key, value in reversed(saved):
            table[key] = value


# ── Fuji, its snow as the season leaves it ─────────────────────────

def fuji_s(fj, pal_, uid, seed, base):
    """scene_f9's Fuji with its snow line where the season has it: low
    in winter, a few streaks in the gullies in summer."""
    rng = random.Random(seed + 11)
    streak = 0.35 if base < 0.1 else (1.0 if base < 0.4 else 1.25)
    edge = fj.snow_edge(seed=seed, base=base)
    if streak != 1.0:
        # the streaks scaled: summer keeps the gullies' snow and little else
        r2 = random.Random(seed)
        streaks = []
        v = -0.9 + r2.uniform(0, 0.08)
        while v < 0.92:
            streaks.append((v, r2.uniform(0.028, 0.07), r2.uniform(0.04, 0.2) * streak))
            v += r2.uniform(0.13, 0.24)
        edge = fj.snow_edge(seed=seed, base=base, streaks=streaks)
    u_of = edge
    body, snow = fj.body(), fj.snow(u_of)
    x0, ys, yb, hb = fj.x0, fj.ys, fj.yb, fj.hb
    ridges_ = ''.join(f'<path d="{d}"></path>' for d in fj.ridges(rng))
    p = pal_
    return f'''<defs>
        <linearGradient id="{uid}Body" x1="0" y1="{f(ys)}" x2="0" y2="{f(yb)}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="{p['fuji_top']}"></stop>
          <stop offset="0.55" stop-color="{p['fuji_mid']}"></stop>
          <stop offset="1" stop-color="{p['fuji_foot']}"></stop>
        </linearGradient>
        <linearGradient id="{uid}Side" x1="{f(x0 - hb * 0.7)}" y1="0" x2="{f(x0 + hb * 0.25)}" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="{p['fuji_shade']}" stop-opacity="0.55"></stop>
          <stop offset="1" stop-color="{p['fuji_shade']}" stop-opacity="0"></stop>
        </linearGradient>
        <linearGradient id="{uid}Snow" x1="{f(x0 - hb * 0.32)}" y1="0" x2="{f(x0 + hb * 0.3)}" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="{p['snow_shade']}"></stop>
          <stop offset="0.48" stop-color="{p['snow']}"></stop>
          <stop offset="1" stop-color="{p['snow_lit']}"></stop>
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
          <rect x="{f(x0 - hb - 4)}" y="{f(ys - 4)}" width="{f(hb * 2 + 8)}" height="{f(yb - ys + 8)}" fill="url(#{uid}Side)"></rect>
          <g fill="none" stroke="{p['fuji_ridge']}" stroke-width="1" stroke-opacity="0.22" stroke-linecap="round">{ridges_}</g>
          <path d="{snow}" fill="url(#{uid}Snow)"></path>
          <rect x="{f(x0 - hb - 4)}" y="{f(yb - (yb - ys) * 0.42)}" width="{f(hb * 2 + 8)}" height="{f((yb - ys) * 0.42 + 4)}" fill="url(#{uid}Mist)"></rect>
        </g>
      </g>'''


# ── the hills, their woods in the season's colours ──────────────────

def crowns(pts, W, rng, r0, r1, step, cedars=0.0):
    """scene_f6.trees, drawn the same (the same draws from the same
    generator), returning the crowns themselves: ('c', x, y, r) for a
    rounded crown, ('p', d, x, top) for a cedar."""
    out = []
    x = -10
    while x < W + 10:
        if rng.random() < 0.16:
            x += step * rng.uniform(1.2, 2.6)
            continue
        y = ridge_y(pts, x)
        if rng.random() < cedars:
            ht = r1 * rng.uniform(1.7, 2.3)
            wd = r1 * rng.uniform(1.1, 1.4)
            d = (f'M{f(x - wd / 2)} {f(y + 1)} Q{f(x - wd * 0.28)} {f(y - ht * 0.55)} {f(x)} {f(y - ht)} '
                 f'Q{f(x + wd * 0.28)} {f(y - ht * 0.55)} {f(x + wd / 2)} {f(y + 1)} Z')
            out.append(('p', d, x, y - ht, wd))
        else:
            for _ in range(1 if rng.random() < 0.7 else rng.randint(2, 3)):
                r = rng.uniform(r0, r1) * (1.35 if rng.random() < 0.12 else 1)
                cx = x + rng.uniform(-0.6, 0.6) * r
                out.append(('c', cx, ridge_y(pts, cx) + r * rng.uniform(0.3, 0.7), r))
        x += step * rng.uniform(0.55, 1.3)
    return out


def crown_svg(c):
    if c[0] == 'c':
        return f'<circle cx="{f(c[1])}" cy="{f(c[2])}" r="{f(c[3])}"></circle>'
    return f'<path d="{c[1]}"></path>'


def woods(cs, o, hour, seed, fill):
    """The woods as the season colours them: in spring the wild cherries
    (山桜) among the green, in autumn the maples (紅葉), in winter every
    crown under its snow; in summer only the green, deeper."""
    tint = o.get('crowns')
    if tint is None:
        return f'<g fill="{fill}">{"".join(crown_svg(c) for c in cs)}</g>'
    if tint == 'snow':
        base = f'<g fill="{o["crown_ink"]}">{"".join(crown_svg(c) for c in cs)}</g>'
        caps = []
        for c in cs:
            if c[0] == 'c':
                _, x, y, r = c
                caps.append(f'<path d="M{f(x - r * 0.98)} {f(y - r * 0.05)} A{f(r)} {f(r)} 0 0 1 {f(x + r * 0.98)} {f(y - r * 0.05)} '
                            f'Q{f(x)} {f(y - r * 0.38)} {f(x - r * 0.98)} {f(y - r * 0.05)} Z"></path>')
            else:
                _, d, x, top, wd = c
                caps.append(f'<path d="M{f(x - wd * 0.2)} {f(top + wd * 0.55)} Q{f(x)} {f(top - 0.4)} {f(x + wd * 0.2)} {f(top + wd * 0.55)} Z"></path>')
        return base + f'<g fill="{o["cap"]}">{"".join(caps)}</g>'
    colours, p, op = tint
    rng = random.Random(seed)
    extra = []
    for c in cs:
        if rng.random() < p:
            col = colours[rng.randrange(len(colours))]
            if c[0] == 'c':
                _, x, y, r = c
                extra.append(f'<circle cx="{f(x - r * 0.08)}" cy="{f(y - r * 0.1)}" r="{f(r * rng.uniform(0.82, 0.98))}" fill="{col}"></circle>')
    return (f'<g fill="{fill}">{"".join(crown_svg(c) for c in cs)}</g>'
            f'<g opacity="{f(op)}">{"".join(extra)}</g>')


def hills_far_s(L, h, s, far, o, hour):
    close = f' L{L.W + 20} {f(L.water[0] + 4)} L-20 {f(L.water[0] + 4)} Z'
    k = (L.W / 390) ** 0.5
    rng = random.Random(L.seed + 71)
    cs = crowns(far, L.W, rng, 1.1 * k, 2.4 * k, 4.6 * k, cedars=0.07)
    return (f'<path d="{smooth(far) + close}" fill="url(#f6HillFar)"></path>'
            f'{woods(cs, o, hour, L.seed + 171, "url(#f6HillFar)")}')


def hills_near_s(L, h, s, near, o, hour):
    wt = L.water[0]
    close = f' L{L.W + 20} {f(wt + 4)} L-20 {f(wt + 4)} Z'
    k = (L.W / 390) ** 0.5
    rng = random.Random(L.seed + 72)
    cs = crowns(near, L.W, rng, 1.5 * k, 3.4 * k, 6 * k, cedars=0.04)
    lights = ''
    if s['village'] and h.get('village', True):
        lr = random.Random(L.seed + 3)

        def lx():
            if L.chimneys and lr.random() < 0.7:
                cx_, _ = L.chimneys[lr.randrange(len(L.chimneys))]
                return min(L.W - 4, max(4, lr.gauss(cx_, 16 * k)))
            return lr.uniform(10, L.W - 10)
        lights = ''.join(f'<rect class="{"f4-lamp" if j % 3 == 0 else ""}" x="{f(lx())}" '
                         f'y="{f(lr.uniform(L.hills[1] + 6, wt - 3))}" width="1.6" height="1.6" fill="#ffd27a" '
                         f'fill-opacity="{f(lr.uniform(0.5, 1))}" style="{anim(lr.uniform(3, 7), lr.uniform(0, 6))}"></rect>'
                         for j in range(int(s['village'] * L.W / 390)))
    return (f'<path d="{smooth(near) + close}" fill="url(#f6HillNear)"></path>'
            f'{woods(cs, o, hour, L.seed + 172, "url(#f6HillNear)")}{lights}')


# ── the print ─────────────────────────────────────────────────────

def scene(L, hour, season, uid='s1', with_disc=True, variant=None):
    h, s, o = inks(season, hour)
    o = {**o, **(variant or {}), 'uid': uid}
    with dressed(season, hour, o):
        return _scene(L, hour, season, h, s, o, uid, with_disc)


def _scene(L, hour, season, h, s, o, uid, with_disc):
    x0, ys, yb, hb = L.fuji
    fj = Fuji(x0, ys, yb, hb)
    far, near = ridges(L)
    Lc = air.cloud_layout(L, hour, o)
    birds_svg = air.flight(L, h, o, hour)
    fleet_ = fleet(L, h)
    y0, y1 = L.water
    horizon_sky = h['sky'][-1][1]
    fk = (L.W / 390) ** 0.4
    sky = f'''<defs>
        <linearGradient id="f4Sky" x1="0" y1="0" x2="0" y2="{f(L.horizon)}" gradientUnits="userSpaceOnUse">{stops(h['sky'])}</linearGradient>
        <linearGradient id="f4Band" x1="0" y1="0" x2="0" y2="{f(L.H * 0.11)}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="{h['band']}" stop-opacity="1"></stop><stop offset="0.55" stop-color="{h['band']}" stop-opacity="0.7"></stop><stop offset="1" stop-color="{h['band']}" stop-opacity="0"></stop>
        </linearGradient>
        <linearGradient id="f6BayInk" x1="0" y1="{f(y0)}" x2="0" y2="{f(y1)}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="{s['far']}"></stop><stop offset="0.5" stop-color="{mix(s['far'], s['near'], 0.62)}"></stop><stop offset="1" stop-color="{s['near']}"></stop>
        </linearGradient>
        <linearGradient id="f6Sheen" x1="0" y1="{f(y0)}" x2="0" y2="{f(y0 + (y1 - y0) * 0.5)}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="{horizon_sky}" stop-opacity="0"></stop><stop offset="0.4" stop-color="{horizon_sky}" stop-opacity="0.3"></stop><stop offset="1" stop-color="{horizon_sky}" stop-opacity="0"></stop>
        </linearGradient>
        <linearGradient id="f6HillFar" x1="0" y1="{f(L.hills[0] - 10)}" x2="0" y2="{f(y0)}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="{h['hill_far']}"></stop><stop offset="1" stop-color="{mix(h['hill_far'], s['fog'][1], 0.42)}"></stop>
        </linearGradient>
        <linearGradient id="f6HillNear" x1="0" y1="{f(L.hills[1] - 6)}" x2="0" y2="{f(y0)}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="{h['hill_near']}"></stop><stop offset="1" stop-color="{mix(h['hill_near'], s['fog'][0], 0.22)}"></stop>
        </linearGradient>
        <linearGradient id="f6Arch" x1="0" y1="{f(L.viaduct[0] + 6)}" x2="0" y2="{f(L.viaduct[1])}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="{s['shade'][0]}"></stop><stop offset="1" stop-color="{s['shade'][1]}"></stop>
        </linearGradient>
        <linearGradient id="f6Fade" x1="0" y1="{f(y0)}" x2="0" y2="{f(y0 + (y1 - y0) * 0.7)}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#fff" stop-opacity="1"></stop><stop offset="1" stop-color="#fff" stop-opacity="0"></stop>
        </linearGradient>
        <mask id="f6ReflFade" maskUnits="userSpaceOnUse" x="-40" y="{f(y0)}" width="{L.W + 80}" height="{f(y1 - y0)}"><rect x="-40" y="{f(y0)}" width="{L.W + 80}" height="{f(y1 - y0)}" fill="url(#f6Fade)"></rect></mask>
        <linearGradient id="f6Cone" x1="0" y1="{f(y0)}" x2="0" y2="{f(y1)}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="{h['refl']}" stop-opacity="0.5"></stop><stop offset="0.35" stop-color="{h['refl']}" stop-opacity="1"></stop><stop offset="1" stop-color="{h['refl']}" stop-opacity="0.35"></stop>
        </linearGradient>
        <clipPath id="f6Bay"><rect x="-40" y="{f(y0)}" width="{L.W + 80}" height="{f(y1 - y0)}"></rect></clipPath>
        <linearGradient id="f4Meteor" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fffaf0" stop-opacity="0"></stop><stop offset="1" stop-color="#fffaf0" stop-opacity="0.95"></stop></linearGradient>
        <radialGradient id="f4Lamp"><stop offset="0" stop-color="#fff1c4" stop-opacity="0.55"></stop><stop offset="1" stop-color="#fff1c4" stop-opacity="0"></stop></radialGradient>
        <radialGradient id="f6Isaribi"><stop offset="0" stop-color="#ffd37a" stop-opacity="0.95"></stop><stop offset="0.35" stop-color="#ff9a3c" stop-opacity="0.55"></stop><stop offset="1" stop-color="#ff7a2a" stop-opacity="0"></stop></radialGradient>
        {cloud_defs()}
        {boat_defs(hour, uid)}{train_defs(hour, uid)}{bridge_defs(L, s, h, hour, uid)}{cosmos_defs(h, hour)}
        {air.defs(L, h, o, hour, uid)}{flora.defs(L, h, o, hour, uid)}
        <filter id="f4Win" x="-10%" y="-100%" width="120%" height="300%"><feGaussianBlur stdDeviation="2.2"></feGaussianBlur></filter>
        <filter id="f5Blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"></feGaussianBlur></filter>
        <filter id="f6Feather" x="-25%" y="-200%" width="150%" height="500%"><feGaussianBlur stdDeviation="{f(5 * fk)} {f(2.4 * fk)}"></feGaussianBlur></filter>
        <filter id="f6Haze" x="-50%" y="-30%" width="200%" height="160%"><feGaussianBlur stdDeviation="{f(3.5 * fk)} {f(2 * fk)}"></feGaussianBlur></filter>
        <filter id="f6Puff" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="{f(0.9 * fk)}"></feGaussianBlur></filter>
        <filter id="f6Smear" x="-5%" y="-30%" width="110%" height="160%"><feGaussianBlur stdDeviation="0.6 1.2"></feGaussianBlur></filter>
      </defs>
      <rect width="{L.W}" height="{f(L.horizon + 12)}" fill="url(#f4Sky)"></rect>
      <rect width="{L.W}" height="{f(L.H * 0.11)}" fill="url(#f4Band)"></rect>
      <g class="f4-stars">{stars9(L, h)}</g>
      {air.oboro(L, h, o, uid)}
'''
    back = f'''      <g class="f5-clouds">{clouds(Lc, hour)}</g>
      {air.thunderhead(L, h, o, hour, uid)}
      {birds_svg if h['birds'] == 'cranes' else ''}
      {disc(L, h, uid) if with_disc else ''}
      {fuji_s(fj, h['fuji'], uid + 'Fj', L.seed, o.get('snow', 0.27))}
      {fog(L, s, 0)}
      {hills_far_s(L, h, s, far, o, hour)}
      {fog(L, s, 1)}
      {hills_near_s(L, h, s, near, o, hour)}
      {village(L, h, s)}
      {smoke6(L, h)}
      {fog(L, s, 2)}
      {air.fireworks(L, h, o, hour, uid)}
      {water(L, h, s, far, near, hour, [], grouped=True)}
      <g clip-path="url(#f6Bay)">{reflections7(fleet_, hour, uid, anim, grouped=True)}{air.fireworks_mirror(L, h, o, hour, uid)}</g>
      {boats7(fleet_, s, hour, uid, anim)}
      {seawall(L, s)}
      {air.snow_line(L, o, 'wall')}
      {birds_svg if h['birds'] not in ('cranes', None) else ''}
      {catenary7(L, h, hour, L.mast0)}
      {air.fireflies(L, h, o, hour, 'far')}'''
    train, run = train8(L, h, s, hour, uid)
    front = f'''{bridge7(L, s, h, hour, uid)}
      {air.snow_line(L, o, 'bridge')}
      <rect y="{f(L.ground)}" width="{L.W}" height="{f(L.H - L.ground)}" fill="{h['ground']}"></rect>
      <path d="M-10 {f(L.ground + 4)} C{f(L.W * 0.15)} {f(L.ground - 4)} {f(L.W * 0.3)} {f(L.ground + 6)} {f(L.W * 0.5)} {f(L.ground)} S{f(L.W * 0.82)} {f(L.ground + 4)} {L.W + 10} {f(L.ground - 2)} L{L.W + 10} {f(L.ground + 12)} L-10 {f(L.ground + 12)} Z" fill="{h['ground']}"></path>
      {ground9(L, h, uid)}
      {grass7(L, h) if o.get('crowns') != 'snow' else ''}
      {flora.fore_back(L, h, o, hour, gust, uid)}
      {flora.tree(L, h, o, hour, gust, uid)}
      {flora.pine_s(L, h, o, hour, gust)}
      {flora.bank(L, h, o, hour, gust, anim)}
      {flora.fore_front(L, h, o, hour, gust, uid)}
      {air.falls(L, h, o, hour)}
      {air.fireflies(L, h, o, hour, 'near')}
'''
    return sky, back, train, front, run
