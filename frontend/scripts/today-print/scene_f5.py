"""F⁗ · the print, alive and natural. F‴'s scene with its moving parts
redrawn the way they move:

- the birds are jointed (birds5.py) and fly paths that rise, sink and
  bank instead of straight lines: two oscillators at prime periods
  under the crossing, so no loop is ever seen to repeat;
- the moon's road on the water is broken dashes swaying in a wave that
  runs down toward the viewer; by day the sun's road is glitter; the
  hills tremble in eight strips; a slow swell drifts across the bay;
  the glints gather where the light is;
- the clouds are tiers of soft-ended bands with a lit edge and a shaded
  underside, drifting, rising and falling a little, stretching;
- the wind is a gust that runs across the field left to right, every
  stem leaning with it a beat after its neighbour, the plumes and
  flower heads trembling on top;
- smoke is puffs that swell and lean off with the wind; a leaf falls
  like a pendulum, tilting into each swing; a boat heaves and pitches
  on two different waves.

Transform and opacity only; under reduced motion, the still print."""
import math
import random
from dataclasses import dataclass, field
from geo import LINE, f
from brush import polar, momiji
from fuji import Fuji, fuji_svg
from scene_f3 import stops, mist_band, smooth, viaduct
from scene_f4 import HOURS as H4, Layout4, stars, disc, ridges, hills, train, pine, anim
import copy
import birds5

HOURS = copy.deepcopy(H4)
CLOUD_INK = {
    'dawn': dict(top='#fff1e0', mid='#f6c9b6', bottom='#d79a95', op=0.92),
    'day': dict(top='#ffffff', mid='#f6f8fb', bottom='#c9d6e6', op=0.96),
    'dusk': dict(top='#6f6187', mid='#9a7c96', bottom='#f3ae86', op=0.85),
    'night': dict(top='#c3cee2', mid='#5b6d92', bottom='#38466a', op=0.62),
}


@dataclass
class Layout5(Layout4):
    cloud_sets: dict = field(default_factory=dict)   # hour -> [(x, y, w, h)]


# ── clouds ────────────────────────────────────────────────────────

def cloud_defs():
    out = []
    for hour, c in CLOUD_INK.items():
        out.append(f'<linearGradient id="f5C{hour}" x1="0" y1="0" x2="0" y2="1">'
                   f'<stop offset="0" stop-color="{c["top"]}"></stop>'
                   f'<stop offset="0.42" stop-color="{c["mid"]}"></stop>'
                   f'<stop offset="1" stop-color="{c["bottom"]}" stop-opacity="0.85"></stop></linearGradient>')
    return ''.join(out)


def cloud_path(x, y, w, hh, rng, lobes, floor=0.32):
    """The outline: a flat underside, a top of lobes of different
    breadths and heights, rounded at both ends."""
    humps = []
    for k in range(lobes):
        c = (k + rng.uniform(0.2, 0.8)) / lobes
        humps.append((c, rng.uniform(0.1, 0.2), rng.uniform(0.55, 1.0)))
    top = []
    m = 64
    bottom_y = y + hh * 0.5
    for i in range(m + 1):
        t = i / m
        ht = 0.0
        for c, wd, ampl in humps:
            u = (t - c) / wd
            if abs(u) < 1:
                ht = max(ht, ampl * math.sqrt(1 - u * u))
        end = math.sqrt(max(0.0, 1 - (2 * t - 1) ** 10))
        ht = max(ht, floor) * end
        top.append((x + t * w, bottom_y - ht * hh))
    return smooth(top) + f' Q{f(x + w * 0.5)} {f(bottom_y + hh * 0.07)} {f(x)} {f(bottom_y)} Z'


def cloud(x, y, w, hh, hour, rng):
    """A cloud bank as the prints draw one, in two layers for its depth:
    a paler bank behind, set up and to one side, and the bank in front;
    each a flat underside and a top of soft lobes, lit along its top and
    shaded under in the hour's light."""
    c = CLOUD_INK[hour]
    thin = hh < 12
    lobes = rng.randint(3, 4) if thin else rng.randint(4, 6)
    back = cloud_path(x + w * rng.uniform(0.18, 0.34), y - hh * 0.55, w * rng.uniform(0.5, 0.66), hh * 0.85, rng, max(2, lobes - 2))
    front = cloud_path(x, y, w, hh, rng, lobes, floor=0.26 if not thin else 0.38)
    return (f'<path d="{back}" fill="url(#f5C{hour})" opacity="{f(c["op"] * 0.62)}"></path>'
            f'<path d="{front}" fill="url(#f5C{hour})" opacity="{c["op"]}"></path>')


def clouds(L, hour):
    out = []
    rng = random.Random(L.seed + 61)
    for k, (x, y, w, hh) in enumerate(L.cloud_sets.get(hour, [])):
        a, b = -(x + w * 1.3) - 10, L.W - x + 10
        depth = 0.6 + 0.4 * (1 - y / L.horizon)
        dur = rng.uniform(80, 120) * (L.W / 390) ** 0.5 / depth
        p0 = -a / (b - a)
        out.append(f'<g class="f5-cloud" style="--a: {f(a)}px; --b: {f(b)}px; {anim(dur, p0 * dur)}">'
                   f'<g class="f5-rise" style="{anim(rng.uniform(9, 14), rng.uniform(0, 9))}">'
                   f'<g class="f5-stretch" style="{anim(rng.uniform(11, 17), rng.uniform(0, 11))}">{cloud(x, y, w, hh, hour, rng)}</g></g></g>')
    return ''.join(out)


# ── the water ─────────────────────────────────────────────────────

def water(L, h, far, near, hour):
    y0, y1 = L.water
    rng = random.Random(L.seed + 13)
    depth = y1 - y0
    # the hills in the water, trembling in eight strips
    def mirrored(pts, k):
        return [(x, y0 + (y0 - y) * k) for x, y in pts]
    far_m, near_m = mirrored(far, 0.62), mirrored(near, 0.62)
    reflection = (f'<path d="M-20 {f(y0)} L{L.W + 20} {f(y0)} L{smooth(far_m[::-1])[1:]} Z" fill="{h["hill_far"]}" fill-opacity="0.55"></path>'
                  f'<path d="M-20 {f(y0)} L{L.W + 20} {f(y0)} L{smooth(near_m[::-1])[1:]} Z" fill="{h["hill_near"]}" fill-opacity="0.7"></path>')
    band = 34 * 0.62 + 6
    strips = []
    for k in range(8):
        sy = y0 + k * band / 8
        strips.append(f'<clipPath id="f5Strip{k}"><rect x="-30" y="{f(sy)}" width="{L.W + 60}" height="{f(band / 8 + 0.6)}"></rect></clipPath>'
                      f'<g clip-path="url(#f5Strip{k})"><g class="f5-ripple" style="--r: {f(1.2 + k * 0.35)}px; {anim(3.4, 3.4 - k * 0.28)}">{reflection}</g></g>')
    # the swell: long faint lines drifting, three layers at their own pace
    swell = []
    for layer in range(3):
        lines = []
        for _ in range(int(L.W / 60) + 2):
            y = rng.uniform(y0 + 2 + layer * depth * 0.22, y0 + 6 + (layer + 1) * depth * 0.3)
            x = rng.uniform(-60, L.W)
            ln = rng.uniform(40, 120) * (L.W / 390) ** 0.3
            lines.append(f'<line x1="{f(x)}" y1="{f(y)}" x2="{f(x + ln)}" y2="{f(y)}"></line>')
        swell.append(f'<g class="f5-swell" style="--s: {f((10 + layer * 6) * (1 if layer % 2 == 0 else -1))}px; {anim(9 + layer * 3.7, rng.uniform(0, 9))}" '
                     f'stroke="{h["ripple"]}" stroke-opacity="{f(0.14 + layer * 0.05)}" stroke-width="{f(0.8 + layer * 0.25)}" stroke-linecap="round">{"".join(lines)}</g>')
    # glints: short-lived, gathered toward the light's road
    glints = []
    for _ in range(int(L.W / 10)):
        y = rng.uniform(y0 + 3, y1 - 3)
        near_light = rng.random() < 0.45
        x = rng.gauss(L.cx, L.disc_r * 0.55) if near_light else rng.uniform(-10, L.W)
        ln = rng.uniform(6, 22) * (0.6 + 0.4 * (y - y0) / depth)
        glints.append(f'<line class="f5-glint" x1="{f(x)}" y1="{f(y)}" x2="{f(x + ln)}" y2="{f(y)}" style="{anim(rng.uniform(2.6, 5.5), rng.uniform(0, 5.5))}"></line>')
    # the light's road: rows of broken dashes swaying in a wave that runs
    # down toward the viewer, each row wider and more broken than the one
    # above it; by day, glitter
    road = []
    n = int((depth - 4) / 3.1)
    if hour == 'day':
        for k in range(int(L.W / 6)):
            y = rng.uniform(y0 + 3, y1 - 2)
            spread = L.disc_r * (0.22 + 0.45 * (y - y0) / depth)
            x = rng.gauss(L.cx, spread * 0.6)
            s = rng.uniform(0.9, 2.2)
            road.append(f'<path class="f5-spark" d="M{f(x)} {f(y - s)} L{f(x + 0.35)} {f(y - 0.35)} L{f(x + s)} {f(y)} L{f(x + 0.35)} {f(y + 0.35)} '
                        f'L{f(x)} {f(y + s)} L{f(x - 0.35)} {f(y + 0.35)} L{f(x - s)} {f(y)} L{f(x - 0.35)} {f(y - 0.35)} Z" '
                        f'style="{anim(rng.uniform(1.1, 2.4), rng.uniform(0, 2.4))}"></path>')
        road = f'<g fill="#ffffff">{"".join(road)}</g>'
    else:
        for k in range(n):
            y = y0 + 3 + k * 3.1
            t = k / max(1, n - 1)
            half = L.disc_r * (0.2 + 0.2 * t) * rng.uniform(0.85, 1.15)
            pieces = 1 if t < 0.25 else (2 if t < 0.6 else 3)
            xs, x = [], L.cx - half
            for p in range(pieces):
                seg = (2 * half) / pieces
                a = x + seg * rng.uniform(0, 0.25)
                b = x + seg * rng.uniform(0.6, 1.0)
                xs.append(f'<line x1="{f(a)}" y1="{f(y)}" x2="{f(b)}" y2="{f(y)}"></line>')
                x += seg
            road.append(f'<g class="f5-road" style="--w: {f(1.5 + t * 3.5)}px; --o: {f(1 - 0.45 * t)}; {anim(2.6, 2.6 - (k * 0.21) % 2.6)}">'
                        f'<g class="f5-road-breathe" style="{anim(rng.uniform(2.2, 3.6), rng.uniform(0, 3))}">{"".join(xs)}</g></g>')
        road = (f'<g stroke="{h["refl"]}" stroke-opacity="{h["refl_op"]}" stroke-width="{f(1.7 * (L.disc_r / 80) ** 0.5)}" '
                f'stroke-linecap="round">{"".join(road)}</g>')
    return (f'<rect y="{f(y0)}" width="{L.W}" height="{f(depth + 4)}" fill="url(#f5Water)"></rect>'
            f'{"".join(strips)}{"".join(swell)}'
            f'<g stroke="{h["glint"]}" stroke-width="0.9" stroke-linecap="round">{"".join(glints)}</g>'
            f'{road}')


# ── boats: heaving and pitching on two waves ────────────────────────

def boats(L, h):
    kind = h['boat']
    out = []
    rng = random.Random(L.seed + 17)

    def sea(inner, x, y, s, drift, dur):
        return (f'<g class="f5-drift" style="--dx: {f(drift)}px; {anim(dur, rng.uniform(0, dur))}">'
                f'<g transform="translate({f(x)} {f(y)}) scale({f(s)})">'
                f'<g class="f5-heave" style="{anim(rng.uniform(3.1, 3.9), rng.uniform(0, 3))}">'
                f'<g class="f5-pitch" style="{anim(rng.uniform(4.3, 5.7), rng.uniform(0, 4))}">{inner}</g></g></g></g>')
    if kind == 'sails':
        for x, y, s in L.boats:
            wake = (f'<g class="f5-wake" style="{anim(2.8, rng.uniform(0, 2.8))}"><path d="M-9 3.4 L-24 3.8 M-8 4.6 L-18 5.4" stroke="#e8f1f8" stroke-width="0.8" stroke-linecap="round"></path></g>')
            hull = ('<path d="M-9 0 L9 0 L6 3 L-6 3 Z" fill="#1d2b3a"></path>'
                    '<path d="M0 0 L0 -15" stroke="#1d2b3a" stroke-width="0.8"></path>'
                    f'<path class="f5-belly" d="M0.6 -14.5 L7.5 -2 L0.6 -1.5 Z" fill="#fffdf6" style="{anim(5.3, rng.uniform(0, 5))}"></path>'
                    '<path d="M-0.6 -12 L-6 -2 L-0.6 -1.8 Z" fill="#f1ede2"></path>')
            out.append(sea(wake + hull, x, y, s, rng.uniform(18, 34) * s, rng.uniform(34, 48)))
    elif kind == 'isaribi':
        for x, y, s in L.boats:
            refl = ''.join(f'<line x1="{f(-2.6 + rng.uniform(-1, 1))}" y1="{f(4 + k * 3)}" x2="{f(2.6 + rng.uniform(-1, 1))}" y2="{f(4 + k * 3)}"></line>' for k in range(5))
            refl = (f'<g class="f5-road" style="--w: 1.6px; --o: 0.8; {anim(2.2, rng.uniform(0, 2))}" stroke="#ffb54d" stroke-opacity="0.75" stroke-width="1.3" stroke-linecap="round">'
                    f'<g class="f5-road-breathe" style="{anim(1.7, rng.uniform(0, 1.7))}">{refl}</g></g>')
            hull = ('<path d="M-8 0 L8 0 L5.5 2.6 L-5.5 2.6 Z" fill="#090d16"></path>'
                    '<path d="M5 0 L8 -9" stroke="#090d16" stroke-width="0.8"></path>'
                    '<path d="M-3 0 L-3 -5 M-3 -5 L-1 -3" stroke="#090d16" stroke-width="1.1" stroke-linecap="round"></path>'
                    f'<circle class="f4-flame" cx="8.4" cy="-9.6" r="7" fill="url(#f5Isaribi)" style="{anim(rng.uniform(0.9, 1.5), rng.uniform(0, 1))}"></circle>'
                    '<circle cx="8.4" cy="-9.6" r="1.4" fill="#fff0c4"></circle>')
            out.append(f'<g transform="translate({f(x)} {f(y)}) scale({f(s)})">{refl}</g>')
            out.append(sea(hull, x, y, s, rng.uniform(8, 16) * s, rng.uniform(36, 50)))
    elif kind == 'fisher':
        x, y, s = L.lone_boats[0]
        wake = f'<g class="f5-wake" style="{anim(2.8, 1)}"><path d="M8 3.2 L22 3.6 M7 4.4 L16 5.2" stroke="#f3c9b4" stroke-width="0.8" stroke-linecap="round"></path></g>'
        hull = ('<path d="M-9 0 L9 0 L6 3 L-6 3 Z" fill="#1d1a2c"></path>'
                f'<g class="f5-row" style="{anim(2.4, 0)}"><path d="M-2 0 L-1.4 -7 M-1.4 -7 L4 -12" stroke="#1d1a2c" stroke-width="1" stroke-linecap="round"></path>'
                '<circle cx="-1.3" cy="-8.2" r="1.3" fill="#1d1a2c"></circle></g>')
        out.append(sea(wake + hull, x, y, s, 40 * s, 56))
    elif kind == 'sail_dark':
        x, y, s = L.lone_boats[1]
        hull = ('<path d="M-9 0 L9 0 L6 3 L-6 3 Z" fill="#141c2c"></path>'
                '<path d="M0 0 L0 -15" stroke="#141c2c" stroke-width="0.8"></path>'
                '<path d="M0.6 -14.5 L7.5 -2 L0.6 -1.5 Z" fill="#2a3550"></path>')
        out.append(sea(hull, x, y, s, -36 * s, 60))
    return ''.join(out)


# ── smoke: puffs that swell and lean off with the wind ────────────────

def smoke(L, h):
    if not h['smoke']:
        return ''
    out = []
    for x, y in L.chimneys:
        for k in range(5):
            out.append(f'<circle class="f5-puff" cx="{f(x)}" cy="{f(y)}" r="2.4" style="{anim(8, k * 1.6)}"></circle>')
    return f'<g fill="{h["mist"][0]}" filter="url(#f5Blur)">{"".join(out)}</g>'


# ── the field: a gust running across it ────────────────────────────

def gust(x, W):
    """Every stem gets the same gust, later the further right it stands."""
    period = 6.5
    return f'animation-duration: {period}s; animation-delay: -{f(period - (x / W) * period * 0.55)}s'


def susuki(L, h):
    out = []
    rng = random.Random(L.seed + 21)
    for x0, y0, sc, n in L.susuki:
        for k in range(n):
            lean = rng.uniform(-0.55, 0.9)
            ln = rng.uniform(52, 88) * sc
            bx0 = x0 + rng.uniform(-4, 4) * sc
            tx = x0 + lean * ln * 0.55 + rng.uniform(-6, 6) * sc
            ty = y0 - ln
            cx_, cy_ = x0 + lean * ln * 0.12, y0 - ln * 0.6
            stem = f'M{f(bx0)} {f(y0)} Q{f(cx_)} {f(cy_)} {f(tx)} {f(ty)}'
            ang = math.atan2(ty - cy_, tx - cx_)
            hairs = []
            for m in range(7):
                t = m / 6
                bx = tx - math.cos(ang) * 14 * sc * t
                by = ty - math.sin(ang) * 14 * sc * t
                side = -1 if m % 2 else 1
                hl = rng.uniform(9, 16) * sc * (1 - 0.35 * t)
                spread = ang + side * rng.uniform(0.25, 0.6)
                ex, ey = bx + math.cos(spread) * hl, by + math.sin(spread) * hl + hl * 0.55
                mx, my = bx + math.cos(spread) * hl * 0.6, by + math.sin(spread) * hl * 0.6
                hairs.append(f'M{f(bx)} {f(by)} Q{f(mx)} {f(my)} {f(ex)} {f(ey)}')
            out.append(f'<g class="f5-gust" style="transform-origin: {f(bx0)}px {f(y0)}px; --a: {f(rng.uniform(2.5, 5))}deg; {gust(bx0, L.W)}">'
                       f'<path d="{stem}" fill="none" stroke="{h["stem"]}" stroke-width="{f(1.2 * sc)}" stroke-linecap="round"></path>'
                       f'<g class="f5-flutter" style="transform-origin: {f(tx)}px {f(ty)}px; {anim(rng.uniform(0.9, 1.5), rng.uniform(0, 1.5))}">'
                       f'<path d="{" ".join(hairs)}" fill="none" stroke="{h["plume"]}" stroke-opacity="0.8" stroke-width="{f(0.85 * sc)}" stroke-linecap="round"></path></g></g>')
    return ''.join(out)


def cosmos(L, h):
    out = []
    rng = random.Random(L.seed + 31)
    cols = h['cosmos']
    for x0, y0, sc, n in L.cosmos:
        for k in range(n):
            ln = rng.uniform(46, 92) * sc
            bx = x0 + rng.uniform(-10, 10) * sc
            tx, ty = bx + rng.uniform(-14, 14) * sc, y0 - ln
            col = cols[rng.randrange(len(cols))]
            pr = rng.uniform(4.2, 6.2) * sc
            tilt = rng.uniform(-30, 30)
            petals = ''.join(f'<path d="M0 0 C{f(-pr * 0.36)} {f(-pr * 0.3)} {f(-pr * 0.34)} {f(-pr * 0.92)} {f(-pr * 0.12)} {f(-pr * 1.02)} '
                             f'L0 {f(-pr * 0.9)} L{f(pr * 0.12)} {f(-pr * 1.02)} C{f(pr * 0.34)} {f(-pr * 0.92)} {f(pr * 0.36)} {f(-pr * 0.3)} 0 0 Z" '
                             f'transform="rotate({a + rng.uniform(-6, 6):.1f})"></path>'
                             for a in range(0, 360, 45))
            leaf = ''.join(f'<path d="M{f(bx + (tx - bx) * t)} {f(y0 - ln * t)} q{f(side * 6 * sc)} {f(-3 * sc)} {f(side * 10 * sc)} {f(-9 * sc)}"></path>'
                           for t, side in ((0.35, 1), (0.55, -1)))
            out.append(f'<g class="f5-gust" style="transform-origin: {f(bx)}px {f(y0)}px; --a: {f(rng.uniform(3, 6))}deg; {gust(bx, L.W)}">'
                       f'<path d="M{f(bx)} {f(y0)} Q{f((bx + tx) / 2 + rng.uniform(-6, 6) * sc)} {f(y0 - ln * 0.5)} {f(tx)} {f(ty)}" fill="none" stroke="{h["flower_stem"]}" stroke-width="{f(1.1 * sc)}"></path>'
                       f'<g fill="none" stroke="{h["flower_stem"]}" stroke-width="{f(0.7 * sc)}">{leaf}</g>'
                       f'<g transform="translate({f(tx)} {f(ty)}) rotate({f(tilt)})"><g class="f5-nod" style="{anim(rng.uniform(1.8, 2.8), rng.uniform(0, 2.8))}">'
                       f'<g fill="{col}">{petals}</g><circle r="{f(pr * 0.24)}" fill="#e8b84a"></circle></g></g></g>')
    return ''.join(out)


def leaves(L, h):
    """Leaves let go: each falls like a pendulum, swinging side to side
    and tilting into each swing, drifting with the wind as it goes."""
    if not h['leaves']:
        return ''
    out = []
    rng = random.Random(L.seed + 41)
    for k, (x, y, dx, dy) in enumerate(L.leaves):
        col = ['#c8562e', '#d9a23a', '#b8432a'][k % 3]
        dur = rng.uniform(14, 19)
        outline, veins, _ = momiji(0.28)
        out.append(f'<g class="f5-fall" style="--dx: {f(dx)}px; --dy: {f(dy)}px; {anim(dur, dur * k / len(L.leaves) + rng.uniform(0, 2))}">'
                   f'<g transform="translate({f(x)} {f(y)})"><g class="f5-swing" style="{anim(rng.uniform(2.2, 2.9), rng.uniform(0, 2.9))}">'
                   f'<g class="f5-spin" style="{anim(rng.uniform(3.4, 4.6), rng.uniform(0, 4))}">'
                   f'<path d="{outline}" fill="{col}"></path></g></g></g></g>')
    return ''.join(out)


# ── the birds' flights ─────────────────────────────────────────────

def birds(L, h):
    kind = h['birds']
    if not kind:
        return ''
    rng = random.Random(L.seed + 51)
    if kind in ('geese', 'cranes'):
        (x0, y0), (x1, y1), dur = L.geese_path if kind == 'geese' else L.cranes_path
        if kind == 'geese':
            form = [(0, 0), (-15, -7), (-30, -13), (-14, 8), (-29, 15), (-44, -19), (-45, 21)]
            make = lambda b, p, s: f'<g transform="scale({f(s)})">{birds5.goose(beat=b, phase=p)}</g>'
            beats = (0.62, 0.8)
            sizes = (0.7, 0.92)
        else:
            s = L.crane_scale
            form = [(0, 0), (46 * s, 14 * s), (92 * s, 4 * s)]
            make = lambda b, p, sz: f'<g transform="scale({f(sz)})">{birds5.crane(beat=b, phase=p)}</g>'
            beats = (1.7, 2.2)
            sizes = (s * 0.95, s * 1.05)
        flock = []
        for dx, dy in form:
            beat = rng.uniform(*beats)
            flock.append(f'<g transform="translate({f(dx)} {f(dy)})">'
                         f'<g class="f5-keep" style="--kx: {f(rng.uniform(1.5, 3))}px; --ky: {f(rng.uniform(1, 2.2))}px; {anim(rng.uniform(5, 8), rng.uniform(0, 8))}">'
                         f'{make(beat, rng.uniform(0, beat), rng.uniform(*sizes))}</g></g>')
        return (f'<g class="f5-flock" style="--x0: {f(x0)}px; --y0: {f(y0)}px; --x1: {f(x1)}px; --y1: {f(y1)}px; '
                f'--xm: {f(x0 + (x1 - x0) * 0.42)}px; --ym: {f(y0 + (y1 - y0) * 0.42)}px; {anim(dur, dur * 0.42)}">'
                f'<g class="f5-undulate" style="--u: {f(7 if kind == "geese" else 5)}px; {anim(7.3, 2)}">'
                f'<g class="f5-tilt f5-tilt--{kind}" style="{anim(7.3, 2 + 3.65)}">{"".join(flock)}</g></g></g>')
    if kind == 'gulls':
        out = []
        for cx, cy, r, dur in L.gulls:
            px, py = dur, dur * rng.uniform(0.55, 0.7)
            dx = rng.uniform(0, px)
            out.append(f'<g transform="translate({f(cx)} {f(cy)})">'
                       f'<g class="f5-sweep-x" style="--rx: {f(r * 1.6)}px; {anim(px, dx)}">'
                       f'<g class="f5-sweep-y" style="--ry: {f(r * 0.55)}px; {anim(py, rng.uniform(0, py))}">'
                       f'<g class="f5-bank" style="{anim(px, dx)}">'
                       f'<g transform="scale(0.85)">{birds5.gull(beat=rng.uniform(0.36, 0.46), phase=rng.uniform(0, 4))}</g></g></g></g></g>')
        return ''.join(out)
    return ''


# ── the print ─────────────────────────────────────────────────────

def scene(L, hour, uid='f5'):
    h = HOURS[hour]
    x0, ys, yb, hb = L.fuji
    fj = Fuji(x0, ys, yb, hb)
    far, near = ridges(L)
    mists = ''.join(mist_band(x, y, w, hh, h['mist'][which], 0.7 if which == 0 else 0.58) for x, y, w, hh, which in L.mists)
    birds_svg = birds(L, h)
    return f'''<defs>
        <linearGradient id="f4Sky" x1="0" y1="0" x2="0" y2="{f(L.horizon)}" gradientUnits="userSpaceOnUse">{stops(h['sky'])}</linearGradient>
        <linearGradient id="f4Band" x1="0" y1="0" x2="0" y2="{f(L.H * 0.11)}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="{h['band']}" stop-opacity="1"></stop><stop offset="0.55" stop-color="{h['band']}" stop-opacity="0.7"></stop><stop offset="1" stop-color="{h['band']}" stop-opacity="0"></stop>
        </linearGradient>
        <linearGradient id="f5Water" x1="0" y1="{f(L.water[0])}" x2="0" y2="{f(L.water[1])}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="{h['water'][0]}"></stop><stop offset="1" stop-color="{h['water'][1]}"></stop></linearGradient>
        <linearGradient id="f4Meteor" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fffaf0" stop-opacity="0"></stop><stop offset="1" stop-color="#fffaf0" stop-opacity="0.95"></stop></linearGradient>
        <radialGradient id="f4Lamp"><stop offset="0" stop-color="#fff1c4" stop-opacity="0.55"></stop><stop offset="1" stop-color="#fff1c4" stop-opacity="0"></stop></radialGradient>
        <radialGradient id="f5Isaribi"><stop offset="0" stop-color="#ffd37a" stop-opacity="0.95"></stop><stop offset="0.35" stop-color="#ff9a3c" stop-opacity="0.55"></stop><stop offset="1" stop-color="#ff7a2a" stop-opacity="0"></stop></radialGradient>
        {cloud_defs()}
        <filter id="f4Grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="{f(2.3 / L.W)} 0.32" numOctaves="2" seed="3"></feTurbulence>
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 0.97  0 0 0 0 0.92  0 0 0 0.1 0"></feColorMatrix>
        </filter>
        <filter id="f4Paper" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"></feTurbulence>
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 0.96  0 0 0 0 0.9  0 0 0 0.07 0"></feColorMatrix>
        </filter>
        <filter id="f4Win" x="-10%" y="-100%" width="120%" height="300%"><feGaussianBlur stdDeviation="2.2"></feGaussianBlur></filter>
        <filter id="f5Blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"></feGaussianBlur></filter>
      </defs>
      <rect width="{L.W}" height="{f(L.horizon + 12)}" fill="url(#f4Sky)"></rect>
      <rect width="{L.W}" height="{f(L.H * 0.11)}" fill="url(#f4Band)"></rect>
      <g class="f4-stars">{stars(L, h)}</g>
      <rect width="{L.W}" height="{f(L.horizon + 12)}" filter="url(#f4Grain)"></rect>
      <g class="f5-clouds">{clouds(L, hour)}</g>
      {birds_svg if h['birds'] == 'cranes' else ''}
      {disc(L, h, uid)}
      {fuji_svg(fj, h['fuji'], uid=uid + 'Fj', seed=L.seed)}
      <g class="f4-mist">{mists}</g>
      {hills(L, h, far, near)}
      {smoke(L, h)}
      {water(L, h, far, near, hour)}
      {boats(L, h)}
      {birds_svg if h['birds'] in ('gulls', 'geese') else ''}
      {train(L, h)}
      {viaduct(L, h)}
      <rect y="{f(L.ground)}" width="{L.W}" height="{f(L.H - L.ground)}" fill="{h['ground']}"></rect>
      <path d="M-10 {f(L.ground + 4)} C{f(L.W * 0.15)} {f(L.ground - 4)} {f(L.W * 0.3)} {f(L.ground + 6)} {f(L.W * 0.5)} {f(L.ground)} S{f(L.W * 0.82)} {f(L.ground + 4)} {L.W + 10} {f(L.ground - 2)} L{L.W + 10} {f(L.ground + 12)} L-10 {f(L.ground + 12)} Z" fill="{h['ground']}"></path>
      {pine(L, h)}
      {cosmos(L, h)}
      {susuki(L, h)}
      {leaves(L, h)}
      <rect width="{L.W}" height="{L.H}" filter="url(#f4Paper)"></rect>'''
