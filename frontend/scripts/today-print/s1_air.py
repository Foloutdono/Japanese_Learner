"""S¹ · what is in the air (plan 261): the season's clouds (spring dawn's thin
purple bands, Red Fuji's mackerel sky, the summer's cloud peak), the
hazy spring moon, the birds of the season, what falls (petals, leaves,
snow), the fireflies, the fireworks.

Moving parts are transform and opacity only, in groups where a crowd
moves (the snow, the fireflies), as the stars do; under reduced motion
the still print. New moving parts carry s1-* classes (CSS, below), which
the canvas loads as its seasons.css."""
import dataclasses
import math
import random
from geo import f
from scene_f4 import anim
from scene_f5 import birds
import birds5
from el7 import mix

# ── the clouds the season brings ────────────────────────────────────

THIN = {
    # 紫だちたる雲の細くたなびきたる: thin bands trailing across the dawn
    390: [(-40, 100, 214, 6), (226, 72, 206, 7), (-30, 292, 150, 5), (262, 282, 160, 6), (40, 40, 120, 4)],
    1184: [(-40, 120, 360, 9), (560, 92, 380, 10), (-30, 396, 240, 7), (840, 560, 360, 8), (220, 60, 220, 6)],
}
def _rows(rows, seed):
    """Small clouds in rows, as a mackerel sky lies: each row a slant of
    cloudlets, close and of a size, the rows parallel."""
    rng = random.Random(seed)
    out = []
    for x0, y0, x1, y1, n, w, hh in rows:
        for j in range(n):
            t = (j + rng.uniform(0.2, 0.8)) / n
            out.append((x0 + (x1 - x0) * t + rng.uniform(-4, 4), y0 + (y1 - y0) * t + rng.uniform(-2, 2),
                        w * rng.uniform(0.75, 1.2), hh * rng.uniform(0.8, 1.15)))
    return out


MACKEREL = {
    # うろこ雲: the small clouds of a late-summer dawn, in rows (凱風快晴),
    # clear of the dial's ring and of the lines under it
    390: _rows([(-10, 18, 120, 6, 5, 22, 4.2), (270, 6, 400, 22, 5, 22, 4.2), (-14, 40, 70, 30, 3, 20, 4),
                (322, 40, 400, 56, 3, 20, 4), (-10, 62, 60, 56, 2, 18, 3.6), (336, 74, 402, 84, 2, 18, 3.6),
                (-12, 286, 74, 296, 3, 18, 3.6), (318, 284, 404, 298, 3, 18, 3.6), (-8, 372, 120, 392, 5, 20, 3.8),
                (250, 380, 400, 398, 5, 20, 3.8)], 9),
    1184: _rows([(20, 30, 260, 18, 7, 46, 7), (540, 26, 900, 46, 8, 46, 7), (900, 60, 1190, 84, 6, 42, 6.5),
                 (-10, 70, 180, 60, 4, 40, 6), (560, 90, 760, 110, 4, 40, 6), (-10, 440, 200, 464, 5, 40, 6),
                 (820, 470, 1190, 500, 7, 42, 6), (600, 520, 900, 540, 6, 38, 5.5)], 9),
}


def cloud_layout(L, hour, o):
    """The layout with the season's clouds in the hour's place."""
    which = o.get('clouds_at')
    if not which:
        return L
    sets = dict(L.cloud_sets)
    sets[hour] = (THIN if which == 'thin' else MACKEREL)[L.W]
    return dataclasses.replace(L, cloud_sets=sets)


def thunderhead(L, h, o, hour, uid):
    """雲の峰: a cumulonimbus rising behind the far hills, its towers
    in lobes lit from the sun's side, shaded under; a lower mound beyond
    Fuji. Still but for a slow rise."""
    if not o.get('thunderhead'):
        return ''
    if L.W < 600:
        towers = [(-24, 468, 168, 104), (318, 470, 110, 44)]
    else:
        towers = [(-30, 630, 380, 190), (880, 628, 330, 90)]
    rng = random.Random(L.seed + 501)
    out = []
    for x0, base, w, ht in towers:
        lobes = []
        # the tower's mass: lobes stacked, narrowing as they climb
        rows = 5 if ht > 80 else 3
        for j in range(rows):
            t = j / max(1, rows - 1)
            yc = base - ht * (0.12 + 0.78 * t)
            span = w * (1 - 0.55 * t)
            cx0 = x0 + w * 0.5 + (w * 0.08 * t)
            n = max(2, int(5 - 2.5 * t))
            for m in range(n):
                cx = cx0 - span / 2 + span * (m + 0.5) / n + rng.uniform(-4, 4)
                r = span / n * rng.uniform(0.62, 0.8)
                lobes.append((cx, yc + rng.uniform(-3, 3), r))
        shade = ''.join(f'<circle cx="{f(x + r * 0.16)}" cy="{f(y + r * 0.2)}" r="{f(r)}"></circle>' for x, y, r in lobes)
        mass = ''.join(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r * 0.94)}"></circle>' for x, y, r in lobes)
        lit = ''.join(f'<circle cx="{f(x + r * 0.22)}" cy="{f(y - r * 0.28)}" r="{f(r * 0.62)}"></circle>' for x, y, r in lobes)
        foot = f'<rect x="{f(x0 - 10)}" y="{f(base - ht * 0.2)}" width="{f(w + 20)}" height="{f(ht * 0.2 + 10)}" rx="{f(ht * 0.1)}"></rect>'
        out.append(f'<g class="f5-rise" style="{anim(rng.uniform(12, 16), rng.uniform(0, 12))}">'
                   f'<g fill="#a9bcd6">{shade}{foot}</g><g fill="#eef3f9">{mass}</g><g fill="#ffffff">{lit}</g></g>')
    return f'<g opacity="0.96">{"".join(out)}</g>'


def oboro(L, h, o, uid):
    """朧月: the spring moon in its haze, a wide soft light round it."""
    if not o.get('oboro'):
        return ''
    r = L.disc_r * 2.7
    return f'<circle cx="{f(L.cx)}" cy="{f(L.cy)}" r="{f(r)}" fill="url(#{uid}Oboro)"></circle>'


def defs(L, h, o, hour, uid):
    out = []
    if o.get('oboro'):
        out.append(f'<radialGradient id="{uid}Oboro" cx="{f(L.cx)}" cy="{f(L.cy)}" r="{f(L.disc_r * 2.7)}" gradientUnits="userSpaceOnUse">'
                   f'<stop offset="{f(1 / 2.7)}" stop-color="#e9e2d0" stop-opacity="0.34"></stop>'
                   f'<stop offset="0.6" stop-color="#bdb8d8" stop-opacity="0.12"></stop>'
                   f'<stop offset="1" stop-color="#bdb8d8" stop-opacity="0"></stop></radialGradient>')
    if 'fireflies' in (o.get('flies') or ''):
        out.append(f'<radialGradient id="{uid}Glow"><stop offset="0" stop-color="#e4ff8a" stop-opacity="0.85"></stop>'
                   f'<stop offset="0.3" stop-color="#c8f060" stop-opacity="0.35"></stop><stop offset="1" stop-color="#b0e050" stop-opacity="0"></stop></radialGradient>')
    if o.get('fireworks'):
        out.append(f'<radialGradient id="{uid}Burst"><stop offset="0" stop-color="#fff1c8" stop-opacity="0.5"></stop>'
                   f'<stop offset="1" stop-color="#ffb080" stop-opacity="0"></stop></radialGradient>')
    return ''.join(out)


# ── the birds of the season ─────────────────────────────────────────

def flight(L, h, o, hour):
    kind = h['birds']
    if kind in ('cranes', 'gulls', 'geese'):
        return birds(L, h)
    if kind == 'geese_away':
        return geese_away(L)
    if kind == 'egrets':
        return egrets(L)
    return ''


def geese_away(L):
    """帰雁: the geese going home in spring, north, away and up into the
    dusk, smaller as they go: the autumn's flock flown the other way."""
    rng = random.Random(L.seed + 551)
    if L.W < 600:
        (x0, y0), (x1, y1), dur = (430, 446), (-110, 372), 34
    else:
        (x0, y0), (x1, y1), dur = (1260, 600), (-160, 470), 44
    form = [(0, 0), (15, -7), (30, -13), (14, 8), (29, 15), (44, -19), (45, 21)]
    flock = []
    for dx, dy in form:
        beat = rng.uniform(0.62, 0.8)
        g = birds5.goose(beat=beat, phase=rng.uniform(0, beat))
        flock.append(f'<g transform="translate({f(dx)} {f(dy)})">'
                     f'<g class="f5-keep" style="--kx: {f(rng.uniform(1.5, 3))}px; --ky: {f(rng.uniform(1, 2.2))}px; {anim(rng.uniform(5, 8), rng.uniform(0, 8))}">'
                     f'<g transform="scale(-{f(rng.uniform(0.62, 0.8))} {f(rng.uniform(0.62, 0.8))})">{g}</g></g></g>')
    return (f'<g class="f5-flock" style="--x0: {f(x0)}px; --y0: {f(y0)}px; --x1: {f(x1)}px; --y1: {f(y1)}px; '
            f'--xm: {f(x0 + (x1 - x0) * 0.42)}px; --ym: {f(y0 + (y1 - y0) * 0.42)}px; {anim(dur, dur * 0.42)}">'
            f'<g class="f5-undulate" style="--u: 6px; {anim(7.3, 2)}">'
            f'<g class="f5-tilt f5-tilt--geese" style="{anim(7.3, 2 + 3.65)}">{"".join(flock)}</g></g></g>')


def egret(beat, phase):
    """A white egret (白鷺) flying left: the neck drawn back in its S,
    the bill forward, the legs trailing; broad white wings beating
    slowly. Jointed as birds5's crane is."""
    st = f'--beat: {f(beat)}s; --ph: -{f(phase)}s'
    w, sh = '#fbfaf6', '#d6d4ce'
    far_wing = (f'<g class="b5-arm b5-arm--far b5-arm--glide" style="{st}">'
                f'<path d="M0 0 C-1 -3.4 0 -7 2.4 -10 L4.8 -9 C4 -6.2 3.8 -3.2 4.2 -0.4 Z" fill="{sh}"></path>'
                f'<g transform="translate(3.6 -9.5)"><g class="b5-hand b5-hand--glide" style="{st}">'
                f'<path d="M-1.2 -0.5 C0 -3.6 2.4 -6.8 5.8 -9.2 C4.9 -5.8 4 -2.8 2.4 0.5 Z" fill="{sh}"></path></g></g></g>')
    near_wing = (f'<g class="b5-arm b5-arm--glide" style="{st}">'
                 f'<path d="M-1 0 C-2.2 -4 -1 -8.2 1.8 -11.6 L4.8 -10.4 C4 -6.8 3.8 -3.4 4.4 -0.4 Z" fill="{w}"></path>'
                 f'<g transform="translate(3.3 -11)"><g class="b5-hand b5-hand--glide" style="{st}">'
                 f'<path d="M-1.4 -0.6 C-0.2 -4.2 2.4 -7.8 6.2 -10.8 C5.3 -6.9 4.4 -3.3 2.6 0.6 Z" fill="{w}"></path></g></g></g>')
    body = (f'<path d="M-9 0.6 C-5 -1.4 3 -2 8 -1.2 C11 -0.7 12.4 0.4 13 1.4 C8.6 2.6 2 3 -3 2.6 C-6 2.3 -8 1.6 -9 0.6 Z" fill="{w}"></path>'
            f'<path d="M-8.6 0.4 C-11 -0.6 -11.6 -2.8 -10.2 -3.8 C-9 -4.6 -10.4 -6 -12.6 -5.6" fill="none" stroke="{w}" stroke-width="1.7" stroke-linecap="round"></path>'
            f'<path d="M-12.8 -5.6 L-18.6 -5" stroke="#d9a33a" stroke-width="0.8" stroke-linecap="round"></path>'
            f'<path d="M12.6 1.4 L24 2.6 M12.4 2 L23.4 3.8" stroke="#2a2a2a" stroke-width="0.7" stroke-linecap="round"></path>')
    return (f'<g class="b5-heave b5-heave--glide" style="{st}">'
            f'<g transform="translate(-2.6 -0.6)">{far_wing}</g>{body}<g transform="translate(-1.4 -0.8)">{near_wing}</g></g>')


def egrets(L):
    """白鷺: three egrets going home to their roost across the dusk."""
    rng = random.Random(L.seed + 561)
    if L.W < 600:
        (x0, y0), (x1, y1), dur, s = (440, 396), (-120, 430), 40, 0.8
    else:
        (x0, y0), (x1, y1), dur, s = (1260, 560), (-200, 600), 52, 1.0
    form = [(0, 0), (34 * s, 10 * s), (70 * s, 2 * s)]
    flock = []
    for dx, dy in form:
        beat = rng.uniform(1.6, 2.1)
        flock.append(f'<g transform="translate({f(dx)} {f(dy)})">'
                     f'<g class="f5-keep" style="--kx: {f(rng.uniform(1.5, 3))}px; --ky: {f(rng.uniform(1, 2.2))}px; {anim(rng.uniform(5, 8), rng.uniform(0, 8))}">'
                     f'<g transform="scale({f(s * rng.uniform(0.92, 1.06))})">{egret(beat, rng.uniform(0, beat))}</g></g></g>')
    return (f'<g class="f5-flock" style="--x0: {f(x0)}px; --y0: {f(y0)}px; --x1: {f(x1)}px; --y1: {f(y1)}px; '
            f'--xm: {f(x0 + (x1 - x0) * 0.42)}px; --ym: {f(y0 + (y1 - y0) * 0.42)}px; {anim(dur, dur * 0.42)}">'
            f'<g class="f5-undulate" style="--u: 4px; {anim(7.3, 2)}">'
            f'<g class="f5-tilt f5-tilt--cranes" style="{anim(7.3, 2 + 3.65)}">{"".join(flock)}</g></g></g>')


# ── what falls ─────────────────────────────────────────────────────

PETALS = {
    390: [(346, 492, -150, 170), (300, 470, -120, 200), (382, 508, -190, 150), (250, 486, -110, 190), (330, 520, -170, 130),
          (214, 430, -100, 210), (366, 456, -200, 220), (150, 444, -90, 180), (276, 510, -140, 120)],
    1184: [(1040, 640, -300, 220), (980, 620, -260, 260), (1120, 660, -340, 200), (900, 600, -240, 280), (1060, 680, -320, 180),
           (760, 560, -220, 300), (1150, 600, -380, 300), (620, 590, -200, 260), (840, 650, -280, 220), (500, 610, -180, 250)],
}
LEAVES = {
    390: [(330, 498, -150, 190), (296, 480, -110, 210), (372, 512, -170, 170), (250, 492, -100, 180)],
    1184: [(1040, 650, -280, 220), (980, 630, -240, 250), (1120, 668, -320, 200), (900, 620, -220, 260)],
}


def petal(s):
    """A cherry petal: a rounded fan narrowing to its base, the notch in
    its tip."""
    return (f'M0 {f(s * 0.9)} C{f(-s * 0.7)} {f(s * 0.4)} {f(-s * 0.8)} {f(-s * 0.5)} {f(-s * 0.32)} {f(-s * 0.86)} '
            f'L0 {f(-s * 0.6)} L{f(s * 0.32)} {f(-s * 0.86)} C{f(s * 0.8)} {f(-s * 0.5)} {f(s * 0.7)} {f(s * 0.4)} 0 {f(s * 0.9)} Z')


def falls(L, h, o, hour):
    kind = o.get('falls')
    if kind == 'petals':
        return petals(L, o)
    if kind == 'leaves':
        return leaves_s(L, o)
    if kind == 'snow':
        return snowfall(L, o)
    return ''


def _faller(x, y, dx, dy, dur, delay, shape, fill, rng, spin=True):
    return (f'<g class="f5-fall" style="--dx: {f(dx)}px; --dy: {f(dy)}px; {anim(dur, delay)}">'
            f'<g transform="translate({f(x)} {f(y)})"><g class="f5-swing" style="{anim(rng.uniform(2.2, 2.9), rng.uniform(0, 2.9))}">'
            f'<g class="{"f5-spin" if spin else ""}" style="{anim(rng.uniform(3.4, 4.6), rng.uniform(0, 4))}">'
            f'<path d="{shape}" fill="{fill}"></path></g></g></g></g>')


def petals(L, o):
    """花吹雪: petals let go by the wind, drifting down and away across
    the bay, each swinging and turning over as it falls."""
    rng = random.Random(L.seed + 601)
    pts = PETALS[L.W]
    k = 1.0 if L.W < 600 else 1.5
    inks = (o['bloom'][0], o['bloom'][1], mix(o['bloom'][0], '#ffffff', 0.4))
    out = []
    for j, (x, y, dx, dy) in enumerate(pts):
        dur = rng.uniform(11, 16)
        out.append(_faller(x, y, dx, dy, dur, dur * j / len(pts) + rng.uniform(0, 2), petal(rng.uniform(2.2, 2.9) * k),
                           inks[j % 3], rng))
    return ''.join(out)


def leaves_s(L, o):
    """The maple's leaves let go, after scene_f5's three: falling as
    theirs do, from the maple's crown."""
    from brush import momiji
    rng = random.Random(L.seed + 611)
    pts = LEAVES[L.W]
    inks = list(o['maple'][:2]) + ['#d9a23a']
    out = []
    for j, (x, y, dx, dy) in enumerate(pts):
        dur = rng.uniform(14, 19)
        outline, _, _ = momiji(0.26 if L.W < 600 else 0.38)
        out.append(_faller(x, y, dx, dy, dur, dur * j / len(pts) + rng.uniform(0, 2), outline, inks[j % 3], rng))
    return ''.join(out)


def snowfall(L, o):
    """暮雪, the evening snow: flakes falling slow and slanting, in three
    depths, each depth in a few groups that fall together, so the crowd
    costs a handful of moving parts. None falls across the dial's lines:
    the snow begins under them, out of the haze."""
    rng = random.Random(L.seed + 621)
    top = L.cy + L.fare_r + (90 if L.W < 600 else 300)
    depth = L.H - top
    out = []
    k = 1.0 if L.W < 600 else 1.4
    for layer, (n, r0, r1, op, fall) in enumerate(((7, 0.7, 1.0, 0.6, 26), (6, 1.0, 1.5, 0.8, 20), (5, 1.5, 2.2, 0.92, 15))):
        for g in range(n):
            flakes = []
            for _ in range(12 if L.W < 600 else 36):
                x = rng.uniform(-20, L.W + 40)
                y = rng.uniform(top - 40, top + depth * 0.6)
                flakes.append(f'M{f(x - r0)} {f(y)}a{f(r0)} {f(r0)} 0 1 0 {f(2 * r0)} 0a{f(r0)} {f(r0)} 0 1 0 {f(-2 * r0)} 0' if rng.random() < 0.5 else
                              f'M{f(x - r1)} {f(y)}a{f(r1)} {f(r1)} 0 1 0 {f(2 * r1)} 0a{f(r1)} {f(r1)} 0 1 0 {f(-2 * r1)} 0')
            dur = fall * rng.uniform(0.85, 1.15)
            out.append(f'<g class="f5-fall" style="--dx: {f(-depth * 0.18)}px; --dy: {f(depth * 0.75)}px; {anim(dur, dur * g / n + rng.uniform(0, 2))}">'
                       f'<g class="s1-sway" style="--sx: {f((2 + layer * 2) * k)}px; {anim(rng.uniform(3.5, 5.5), rng.uniform(0, 5))}">'
                       f'<path d="{"".join(flakes)}" fill="{o["cap"]}" opacity="{f(op)}"></path></g></g>')
    return f'<g class="s1-snow">{"".join(out)}</g>'


def snow_line(L, o, which):
    """Snow lying along the sea wall's coping and the bridge's parapet."""
    if o.get('crowns') != 'snow':
        return ''
    rng = random.Random(L.seed + 631 + (0 if which == 'wall' else 7))
    y = L.wall[0] if which == 'wall' else L.viaduct[0] - 3.6
    k = (L.W / 390) ** 0.4
    d = [f'M-10 {f(y + 0.4)}']
    x = -10
    while x < L.W + 10:
        w = rng.uniform(6, 16) * k
        d.append(f'Q{f(x + w / 2)} {f(y - rng.uniform(0.8, 1.8) * k)} {f(x + w)} {f(y + 0.2)}')
        x += w
    d.append(f'L{L.W + 10} {f(y + 1.4 * k)} L-10 {f(y + 1.4 * k)} Z')
    return f'<path d="{"".join(d)}" fill="{o["cap"]}"></path>'


# ── what glows ─────────────────────────────────────────────────────

def fireflies(L, h, o, hour, depth):
    """蛍: fireflies over the bank and along the shore, each glowing and
    going out, the crowd in five groups that blink together and wander
    slowly; across the bay smaller and fainter."""
    kind = o.get('flies') or ''
    if 'fireflies' not in kind:
        return ''
    rng = random.Random(L.seed + 701 + (0 if depth == 'near' else 9))
    few = kind == 'fireflies_few'
    if depth == 'near':
        n = 10 if few else 28
        box = (0, L.viaduct[0] - 20, L.W, L.H - 40) if L.W < 600 else (0, L.viaduct[0] - 40, L.W, L.H - 20)
        r = 0.9 if L.W < 600 else 1.3
    else:
        n = 4 if few else 14
        box = (0, L.hills[1] + 2, L.W, L.water[1] - 2)
        r = 0.55 if L.W < 600 else 0.8
    groups = [[] for _ in range(5)]
    for j in range(n):
        x = rng.uniform(box[0] + 6, box[2] - 6)
        y = rng.uniform(box[1], box[3])
        groups[j % 5].append((x, y))
    out = []
    for g, pts in enumerate(groups):
        if not pts:
            continue
        glow = ''.join(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r * 6)}"></circle>' for x, y in pts)
        core = ''.join(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}"></circle>' for x, y in pts)
        out.append(f'<g class="s1-wander" style="--wx: {f(rng.uniform(4, 9))}px; --wy: {f(rng.uniform(-6, -2))}px; {anim(rng.uniform(7, 11), rng.uniform(0, 9))}">'
                   f'<g class="s1-blink" style="{anim(rng.uniform(2.6, 4.2), rng.uniform(0, 4))}">'
                   f'<g fill="url(#{o.get("uid", "s1")}Glow)">{glow}</g><g fill="#f4ffc0">{core}</g></g></g>')
    return ''.join(out)


FIREWORKS = {
    390: [(84, 412, 30, '#ffd27a', 4.6), (150, 444, 18, '#ff8a7a', 5.9), (44, 452, 12, '#bff0a8', 7.3)],
    1184: [(180, 520, 70, '#ffd27a', 4.6), (330, 560, 44, '#ff8a7a', 5.9), (90, 580, 30, '#bff0a8', 7.3), (420, 500, 34, '#f4f0ff', 8.1)],
}


def _burst(x, y, r, col, rng):
    rays, tips = [], []
    n = 22
    for j in range(n):
        a = 2 * math.pi * j / n + rng.uniform(-0.05, 0.05)
        r0, r1 = r * 0.22, r * rng.uniform(0.86, 1.0)
        rays.append(f'M{f(x + math.cos(a) * r0)} {f(y + math.sin(a) * r0)}L{f(x + math.cos(a) * r1)} {f(y + math.sin(a) * r1 + r * 0.06)}')
        tips.append(f'M{f(x + math.cos(a) * r1 - 0.7)} {f(y + math.sin(a) * r1 + r * 0.08)}a0.7 0.7 0 1 0 1.4 0a0.7 0.7 0 1 0 -1.4 0')
    return ''.join(rays), ''.join(tips)


def fireworks(L, h, o, hour, uid):
    """花火: fireworks over the bay, far off: each opens, hangs and falls
    away, in its own time, so no two open together."""
    if not o.get('fireworks'):
        return ''
    rng = random.Random(L.seed + 801)
    out = []
    for x, y, r, col, dur in FIREWORKS[L.W]:
        rays, tips = _burst(x, y, r, col, rng)
        out.append(f'<g class="s1-burst" style="transform-origin: {f(x)}px {f(y)}px; {anim(dur, rng.uniform(0, dur))}">'
                   f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r * 1.3)}" fill="url(#{uid}Burst)"></circle>'
                   f'<path d="{rays}" fill="none" stroke="{col}" stroke-width="{f(max(0.5, r / 34))}" stroke-linecap="round" opacity="0.9"></path>'
                   f'<path d="{tips}" fill="{mix(col, "#ffffff", 0.5)}"></path></g>')
    return ''.join(out)


def fireworks_mirror(L, h, o, hour, uid):
    """The fireworks in the water: a soft light under each, breaking on
    the ripples, opening and fading with it."""
    if not o.get('fireworks'):
        return ''
    rng = random.Random(L.seed + 801)
    y0 = L.water[0]
    out = []
    for x, y, r, col, dur in FIREWORKS[L.W]:
        _burst(x, y, r, col, rng)
        delay = rng.uniform(0, dur)
        my = y0 + (y0 - y) * 0.42
        out.append(f'<g class="s1-burst" style="transform-origin: {f(x)}px {f(my)}px; {anim(dur, delay)}">'
                   f'<ellipse cx="{f(x)}" cy="{f(my)}" rx="{f(r * 0.5)}" ry="{f(r * 0.32)}" fill="{col}" opacity="0.35" filter="url(#f6Haze)"></ellipse></g>')
    return ''.join(out)


CSS = '''/* ── S¹ · the seasons' moving parts ─────────────────────────────── */
.s1-sway { animation-iteration-count: infinite; animation-timing-function: ease-in-out; animation-name: s1-sway; animation-direction: alternate; }
.s1-wander { animation-iteration-count: infinite; animation-timing-function: ease-in-out; animation-name: s1-wander; animation-direction: alternate; }
.s1-blink { animation-iteration-count: infinite; animation-timing-function: ease-in-out; animation-name: s1-blink; }
.s1-burst { transform-box: view-box; opacity: 0; animation-iteration-count: infinite; animation-name: s1-burst; animation-timing-function: cubic-bezier(0.2, 0.7, 0.3, 1); }
@keyframes s1-sway { from { translate: calc(var(--sx, 0px) * -1) 0; } to { translate: var(--sx, 0px) 0; } }
@keyframes s1-wander { 0% { translate: 0 0; } 50% { translate: var(--wx, 0px) var(--wy, 0px); } 100% { translate: calc(var(--wx, 0px) * -0.6) calc(var(--wy, 0px) * 0.4); } }
@keyframes s1-blink { 0%, 100% { opacity: 0.12; } 30% { opacity: 1; } 55% { opacity: 0.85; } 75% { opacity: 0.08; } }
@keyframes s1-burst { 0% { opacity: 0; scale: 0.15; } 6% { opacity: 1; } 34% { opacity: 0.85; scale: 1; translate: 0 2px; } 52% { opacity: 0; scale: 1.05; translate: 0 6px; } 100% { opacity: 0; scale: 1.05; } }
@media (prefers-reduced-motion: reduce) {
  .s1-sway, .s1-wander, .s1-blink, .s1-burst { animation: none; }
  .s1-burst { opacity: 0.85; }
  .s1-blink { opacity: 0.9; }
}
/* the evening snow (暮雪) is the view itself: still, it stays */
@media (prefers-reduced-motion: reduce) {
  .s1-snow > g { opacity: 0.9; }
}
'''
