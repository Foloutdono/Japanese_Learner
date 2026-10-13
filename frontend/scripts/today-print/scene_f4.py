"""F‴ · the print, alive. The same landscape as F″, every part of it
moving the way it would: the bay's glints drifting and the disc's
reflection breaking on the ripples, the hills trembling in the water;
the hour's birds (cranes at dawn, gulls by day, geese at dusk), each
beating its wings; sails drifting home with a wake, fishing lanterns
(漁火) at night; cosmos and pampas grass swaying; smoke rising from the
village at dawn and dusk; leaves let go by the wind; clouds crossing;
stars twinkling and, now and then, one falling. Everything moves
slowly and by little: a print that breathes, not a cartoon. Under
reduced motion it is the still print.

Every moving part animates transform and opacity only."""
import copy
import math
import random
from geo import LINE, f
from brush import polar
from fuji import Fuji, fuji_svg
from dataclasses import dataclass, field
from scene_f3 import HOURS as H3, Layout, stops, ring, mist_band, smooth, viaduct


@dataclass
class Layout4(Layout):
    meteor: tuple = (0, 0)
    chimneys: list = field(default_factory=list)
    cosmos: list = field(default_factory=list)       # (x, y, scale, flowers)
    leaves: list = field(default_factory=list)       # (x, y, dx, dy)
    geese_path: tuple = ((0, 0), (0, 0), 30)
    cranes_path: tuple = ((0, 0), (0, 0), 38)
    crane_scale: float = 0.55
    gulls: list = field(default_factory=list)        # (cx, cy, r, seconds)
    lone_boats: list = field(default_factory=list)   # dawn's fisher, dusk's sail

HOURS = copy.deepcopy(H3)
HOURS['dawn'].update(birds='cranes', boat='fisher', cosmos=['#f2a5bf', '#d65c98', '#fbeef2'], leaves=False,
                     glint='#ffd7bf', smoke=True, flower_stem='#3a3346')
HOURS['day'].update(birds='gulls', boat='sails', cosmos=['#f6a9c6', '#de5c9e', '#ffffff'], leaves=True,
                    glint='#ffffff', smoke=False, flower_stem='#3d5a40')
HOURS['dusk'].update(birds='geese', boat='sail_dark', cosmos=['#e79ab5', '#c85590', '#f1e6ea'], leaves=True,
                     glint='#f3d2b6', smoke=True, flower_stem='#2b3446')
HOURS['night'].update(birds=None, boat='isaribi', cosmos=['#9d8aa8', '#7b6290', '#b9b4c8'], leaves=False,
                      glint='#b9c9e2', smoke=False, flower_stem='#1c2638')


def anim(dur, delay):
    return f'animation-duration: {f(dur)}s; animation-delay: -{f(delay)}s'


# ── the sky ───────────────────────────────────────────────────────

def stars(L, h):
    if not h['stars']:
        return ''
    sx0, sy0, sx1, sy1 = L.star_box
    sr = random.Random(L.seed + 9)
    out = []
    while len(out) < h['stars']:
        x, y = sr.uniform(sx0, sx1), sr.uniform(sy0, sy1)
        if math.hypot(x - L.cx, y - L.cy) < L.fare_r + 26:
            continue
        r = sr.uniform(0.4, 1.15)
        out.append(f'<circle class="f4-star" cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="#f3ecdf" '
                   f'style="--o: {f(sr.uniform(0.35, 0.95))}; {anim(sr.uniform(2.2, 5.5), sr.uniform(0, 5))}"></circle>')
    # one falling, now and then (流れ星)
    mx, my = L.meteor
    out.append(f'<g transform="translate({f(mx)} {f(my)}) rotate(24)"><g class="f4-meteor">'
               f'<rect x="-64" y="-0.6" width="64" height="1.2" rx="0.6" fill="url(#f4Meteor)"></rect>'
               f'<circle r="1.3" fill="#fffaf0"></circle></g></g>')
    return ''.join(out)


def clouds(L, h):
    if not h['clouds']:
        return ''
    out = []
    rng = random.Random(L.seed + 5)
    for k, (x, y, w, hh) in enumerate(L.clouds):
        col, op = h['clouds'][k % len(h['clouds'])]
        a, b = -(x + w) - 10, L.W - x + 10
        dur = rng.uniform(70, 110) * (L.W / 390) ** 0.5
        p0 = -a / (b - a)
        out.append(f'<g class="f4-cloud" style="--a: {f(a)}px; --b: {f(b)}px; {anim(dur, p0 * dur)}">'
                   f'{mist_band(x, y, w, hh, col, op)}</g>')
    return ''.join(out)


def disc(L, h, uid):
    """The disc, its halo (the lines) and the fare's ring, as in F″;
    its light breathes."""
    r, hr, fr = L.disc_r, L.halo_r, L.fare_r
    c = 2 * math.pi * fr
    share = 87 / 292
    fx, fy = polar(L.cx, L.cy, fr, share * 360)
    glow_r = r + 70
    maria = ''
    if h['maria']:
        rng = random.Random(L.seed)
        blobs = [(-0.56, -0.42, 0.2), (-0.2, -0.66, 0.16), (0.52, -0.5, 0.15), (0.66, 0.34, 0.16), (-0.6, 0.48, 0.13), (0.18, 0.72, 0.12)]
        maria = ''.join(f'<ellipse cx="{f(L.cx + x * r)}" cy="{f(L.cy + y * r)}" rx="{f(s * r)}" ry="{f(s * r * rng.uniform(0.7, 0.95))}"></ellipse>'
                        for x, y, s in blobs)
        maria = f'<g clip-path="url(#{uid}DiscClip)" fill="#c9b68a" opacity="0.2" filter="url(#{uid}Soft)">{maria}</g>'
    halo_glow = ''
    if h['halo_glow']:
        halo_glow = (f'<g class="f4-halo" style="--ho: {h["halo_glow"]}" filter="url(#{uid}Glow)">'
                     f'{ring(L, hr, 13 * r / 80, lambda k: LINE[k])}</g>')
    return f'''<defs>
        <radialGradient id="{uid}DiscGlow" cx="{f(L.cx)}" cy="{f(L.cy)}" r="{f(glow_r)}" gradientUnits="userSpaceOnUse">
          <stop offset="{f(r / glow_r)}" stop-color="{h['disc_glow']}" stop-opacity="{h['glow_op']}"></stop>
          <stop offset="{f((r + 24) / glow_r)}" stop-color="{h['disc_glow']}" stop-opacity="{f(h['glow_op'] * 0.35)}"></stop>
          <stop offset="1" stop-color="{h['disc_glow']}" stop-opacity="0"></stop>
        </radialGradient>
        <radialGradient id="{uid}DiscFill" cx="0.4" cy="0.36" r="0.72">
          <stop offset="0" stop-color="{h['disc_fill'][0]}"></stop>
          <stop offset="1" stop-color="{h['disc_fill'][1]}"></stop>
        </radialGradient>
        <clipPath id="{uid}DiscClip"><circle cx="{f(L.cx)}" cy="{f(L.cy)}" r="{f(r)}"></circle></clipPath>
        <filter id="{uid}Glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="{f(4.5 * r / 80)}"></feGaussianBlur></filter>
        <filter id="{uid}Soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="{f(2.4 * r / 80)}"></feGaussianBlur></filter>
      </defs>
      <g class="f4-disc">
        <circle class="f4-glow" cx="{f(L.cx)}" cy="{f(L.cy)}" r="{f(glow_r)}" fill="url(#{uid}DiscGlow)"></circle>
        {halo_glow}
        {ring(L, hr, 3.4 * r / 80, lambda k: LINE[k])}
        <circle cx="{f(L.cx)}" cy="{f(L.cy)}" r="{f(fr)}" fill="none" stroke="{h['fare_ink']}" stroke-opacity="0.38" stroke-width="{f(1.6 * r / 80)}" stroke-linecap="round" stroke-dasharray="0.01 {f(6.2 * r / 80)}"></circle>
        <circle cx="{f(L.cx)}" cy="{f(L.cy)}" r="{f(fr)}" fill="none" stroke="{h['fare_ink']}" stroke-opacity="0.78" stroke-width="{f(1.25 * r / 80)}" stroke-linecap="round" stroke-dasharray="{f(c * share)} {f(c)}" transform="rotate(-90 {f(L.cx)} {f(L.cy)})"></circle>
        <circle cx="{f(fx)}" cy="{f(fy)}" r="{f(2.4 * r / 80)}" fill="{h['fare_ink']}"></circle>
        <circle cx="{f(L.cx)}" cy="{f(L.cy)}" r="{f(r)}" fill="url(#{uid}DiscFill)"></circle>
        {maria}
      </g>'''


# ── the land ──────────────────────────────────────────────────────

def ridges(L):
    W = L.W
    far_y, near_y = L.hills

    def ridge(y0, amp, n, seed):
        r = random.Random(seed)
        return [(-20 + (W + 40) * k / n, y0 + r.uniform(-amp, amp)) for k in range(n + 1)]
    return ridge(far_y, 9, max(4, W // 80), L.seed + 1), ridge(near_y, 5, max(5, W // 60), L.seed + 2)


def hills(L, h, far, near):
    wt = L.water[0]
    close = f' L{L.W + 20} {f(wt + 6)} L-20 {f(wt + 6)} Z'
    lights = ''
    if h['village']:
        lr = random.Random(L.seed + 3)
        lights = ''.join(f'<rect class="{"f4-lamp" if k % 3 == 0 else ""}" x="{f(lr.uniform(10, L.W - 10))}" y="{f(lr.uniform(L.hills[1] + 6, wt - 3))}" '
                         f'width="1.6" height="1.6" fill="#ffd27a" fill-opacity="{f(lr.uniform(0.5, 1))}" style="{anim(lr.uniform(3, 7), lr.uniform(0, 6))}"></rect>'
                         for k in range(max(8, L.W // 30)))
    return (f'<path d="{smooth(far) + close}" fill="{h["hill_far"]}"></path>'
            f'<path d="{smooth(near) + close}" fill="{h["hill_near"]}"></path>{lights}')


def smoke(L, h):
    """Smoke from the village's hearths, rising and leaning off."""
    if not h['smoke']:
        return ''
    out = []
    for x, y in L.chimneys:
        for k in range(3):
            d = (f'M{f(x)} {f(y)} C{f(x - 3)} {f(y - 7)} {f(x + 4)} {f(y - 12)} {f(x + 1)} {f(y - 19)} '
                 f'C{f(x - 2)} {f(y - 24)} {f(x + 6)} {f(y - 28)} {f(x + 9)} {f(y - 33)}')
            out.append(f'<path class="f4-smoke" d="{d}" style="transform-origin: {f(x)}px {f(y)}px; {anim(7.5, k * 2.5)}"></path>')
    return f'<g fill="none" stroke="{h["mist"][0]}" stroke-width="2.2" stroke-linecap="round">{"".join(out)}</g>'


# ── the water ─────────────────────────────────────────────────────

def water(L, h, far, near):
    y0, y1 = L.water
    rng = random.Random(L.seed + 13)
    # the hills in the water, trembling in strips
    def mirrored(pts, k):
        return [(x, y0 + (y0 - y) * k) for x, y in pts]
    far_m, near_m = mirrored(far, 0.62), mirrored(near, 0.62)
    reflection = (f'<path d="M-20 {f(y0)} L{L.W + 20} {f(y0)} L{smooth(far_m[::-1])[1:]} Z" fill="{h["hill_far"]}" fill-opacity="0.55"></path>'
                  f'<path d="M-20 {f(y0)} L{L.W + 20} {f(y0)} L{smooth(near_m[::-1])[1:]} Z" fill="{h["hill_near"]}" fill-opacity="0.7"></path>')
    strips = []
    band = 34 * 0.62 + 4
    for k in range(4):
        sy = y0 + k * band / 4
        strips.append(f'<clipPath id="f4Strip{k}"><rect x="-30" y="{f(sy)}" width="{L.W + 60}" height="{f(band / 4 + 0.6)}"></rect></clipPath>'
                      f'<g clip-path="url(#f4Strip{k})"><g class="f4-tremble" style="{anim(rng.uniform(3.2, 4.6), rng.uniform(0, 4))}">{reflection}</g></g>')
    # glints drifting on the swell
    glints = []
    for _ in range(int(L.W / 11)):
        y = rng.uniform(y0 + 3, y1 - 3)
        x = rng.uniform(-10, L.W)
        ln = rng.uniform(10, 36) * (0.6 + 0.4 * (y - y0) / (y1 - y0))
        glints.append(f'<line class="f4-glint" x1="{f(x)}" y1="{f(y)}" x2="{f(x + ln)}" y2="{f(y)}" style="{anim(rng.uniform(3.5, 7), rng.uniform(0, 7))}"></line>')
    # the disc's reflection, breaking on the ripples
    refl = []
    n = int((y1 - y0 - 6) / 4.2)
    for k in range(n):
        y = y0 + 5 + k * 4.2
        half = (L.disc_r * 0.28) * (1 - k / (n + 2)) + rng.uniform(-2, 2)
        dx = rng.uniform(-3, 3)
        refl.append(f'<line class="f4-shim" x1="{f(L.cx - half + dx)}" y1="{f(y)}" x2="{f(L.cx + half + dx)}" y2="{f(y)}" '
                    f'style="{anim(rng.uniform(1.8, 3.2), rng.uniform(0, 3))}"></line>')
    sparks = ''
    if h['glint'] == '#ffffff':
        sparks = ''.join(f'<path class="f4-spark" d="M{f(x)} {f(y - 2.4)} L{f(x + 0.5)} {f(y - 0.5)} L{f(x + 2.4)} {f(y)} L{f(x + 0.5)} {f(y + 0.5)} '
                         f'L{f(x)} {f(y + 2.4)} L{f(x - 0.5)} {f(y + 0.5)} L{f(x - 2.4)} {f(y)} L{f(x - 0.5)} {f(y - 0.5)} Z" '
                         f'style="{anim(rng.uniform(2.5, 4.5), rng.uniform(0, 4))}"></path>'
                         for x, y in ((rng.uniform(20, L.W - 20), rng.uniform(y0 + 6, y1 - 4)) for _ in range(int(L.W / 40))))
    return (f'<rect y="{f(y0)}" width="{L.W}" height="{f(y1 - y0 + 4)}" fill="url(#f4Water)"></rect>'
            f'{"".join(strips)}'
            f'<g stroke="{h["glint"]}" stroke-width="0.9" stroke-linecap="round">{"".join(glints)}</g>'
            f'<g stroke="{h["refl"]}" stroke-opacity="{h["refl_op"]}" stroke-width="1.6" stroke-linecap="round">{"".join(refl)}</g>'
            f'<g fill="#ffffff">{sparks}</g>')


def boats(L, h):
    kind = h['boat']
    out = []
    rng = random.Random(L.seed + 17)
    if kind == 'sails':
        for x, y, s in L.boats:
            out.append(f'<g class="f4-drift" style="--dx: {f(rng.uniform(18, 34) * s)}px; {anim(rng.uniform(26, 40), rng.uniform(0, 30))}">'
                       f'<g transform="translate({f(x)} {f(y)}) scale({f(s)})">'
                       f'<path class="f4-wake" d="M-9 3.4 L-22 3.6 M-8 4.6 L-17 5.2" stroke="#e8f1f8" stroke-width="0.8" stroke-linecap="round" style="{anim(2.6, rng.uniform(0, 2))}"></path>'
                       f'<g class="f4-bob" style="{anim(rng.uniform(3.4, 4.8), rng.uniform(0, 4))}">'
                       f'<path d="M-9 0 L9 0 L6 3 L-6 3 Z" fill="#1d2b3a"></path>'
                       f'<path d="M0 0 L0 -15" stroke="#1d2b3a" stroke-width="0.8"></path>'
                       f'<path class="f4-belly" d="M0.6 -14.5 L7.5 -2 L0.6 -1.5 Z" fill="#fffdf6" style="{anim(5, rng.uniform(0, 5))}"></path>'
                       f'<path d="M-0.6 -12 L-6 -2 L-0.6 -1.8 Z" fill="#f1ede2"></path></g></g></g>')
    elif kind == 'isaribi':
        for x, y, s in L.boats:
            refl = ''.join(f'<line class="f4-shim" x1="{f(-2.6 + rng.uniform(-1, 1))}" y1="{f(4 + k * 3)}" x2="{f(2.6 + rng.uniform(-1, 1))}" y2="{f(4 + k * 3)}" '
                           f'style="{anim(rng.uniform(1.4, 2.4), rng.uniform(0, 2))}"></line>' for k in range(5))
            out.append(f'<g class="f4-drift" style="--dx: {f(rng.uniform(8, 16) * s)}px; {anim(rng.uniform(30, 44), rng.uniform(0, 30))}">'
                       f'<g transform="translate({f(x)} {f(y)}) scale({f(s)})">'
                       f'<g stroke="#ffb54d" stroke-opacity="0.7" stroke-width="1.3" stroke-linecap="round">{refl}</g>'
                       f'<g class="f4-bob" style="{anim(rng.uniform(3.4, 4.8), rng.uniform(0, 4))}">'
                       f'<path d="M-8 0 L8 0 L5.5 2.6 L-5.5 2.6 Z" fill="#090d16"></path>'
                       f'<path d="M5 0 L8 -9" stroke="#090d16" stroke-width="0.8"></path>'
                       f'<path d="M-3 0 L-3 -5 M-3 -5 L-1 -3" stroke="#090d16" stroke-width="1.1" stroke-linecap="round"></path>'
                       f'<circle class="f4-flame" cx="8.4" cy="-9.6" r="7" fill="url(#f4Isaribi)" style="{anim(rng.uniform(0.9, 1.5), rng.uniform(0, 1))}"></circle>'
                       f'<circle cx="8.4" cy="-9.6" r="1.4" fill="#fff0c4"></circle></g></g></g>')
    elif kind == 'fisher':
        x, y, s = L.lone_boats[0]
        out.append(f'<g class="f4-drift" style="--dx: {f(40 * s)}px; {anim(48, 10)}">'
                   f'<g transform="translate({f(x)} {f(y)}) scale({f(s)})">'
                   f'<path class="f4-wake" d="M8 3.2 L20 3.4 M7 4.4 L15 5" stroke="#f3c9b4" stroke-width="0.8" stroke-linecap="round" style="{anim(2.6, 1)}"></path>'
                   f'<g class="f4-bob" style="{anim(4.2, 1)}">'
                   f'<path d="M-9 0 L9 0 L6 3 L-6 3 Z" fill="#1d1a2c"></path>'
                   f'<path d="M-2 0 L-1.4 -7 M-1.4 -7 L4 -12" stroke="#1d1a2c" stroke-width="1" stroke-linecap="round"></path>'
                   f'<circle cx="-1.3" cy="-8.2" r="1.3" fill="#1d1a2c"></circle></g></g></g>')
    elif kind == 'sail_dark':
        x, y, s = L.lone_boats[1]
        out.append(f'<g class="f4-drift" style="--dx: {f(-36 * s)}px; {anim(52, 12)}">'
                   f'<g transform="translate({f(x)} {f(y)}) scale({f(s)})">'
                   f'<g class="f4-bob" style="{anim(4.4, 2)}">'
                   f'<path d="M-9 0 L9 0 L6 3 L-6 3 Z" fill="#141c2c"></path>'
                   f'<path d="M0 0 L0 -15" stroke="#141c2c" stroke-width="0.8"></path>'
                   f'<path d="M0.6 -14.5 L7.5 -2 L0.6 -1.5 Z" fill="#2a3550"></path></g></g></g>')
    return ''.join(out)


def train(L, h):
    top = L.viaduct[0]
    y0, y1 = top - 14, top - 1
    cars, wins = [], []
    x = 0
    for k in range(L.cars):
        wdt = 60
        if k == L.cars - 1:
            body = f'M{x} {y0} H{x + wdt - 12} Q{x + wdt} {y0} {x + wdt + 2} {y1} H{x} Z'
        else:
            body = f'M{x} {y0} H{x + wdt} V{y1} H{x} Z'
        cars.append(f'<path d="{body}" fill="{h["train"]}"></path>')
        if not h['lit']:
            cars.append(f'<rect x="{x}" y="{y1 - 3}" width="{wdt}" height="1.4" fill="#4f7aa6"></rect>')
        for wx in range(6):
            wins.append(f'<rect x="{f(x + 5 + wx * 8.4)}" y="{f(y0 + 3.5)}" width="5" height="4" rx="0.6" fill="{h["windows"]}"></rect>')
        x += wdt + 3
    glow = f'<g filter="url(#f4Win)" opacity="0.8">{"".join(wins)}</g>' if h['lit'] else ''
    lamp = (f'<circle cx="{x - 1}" cy="{y1 - 4}" r="2" fill="#fff4cf"></circle>'
            f'<circle cx="{x + 6}" cy="{y1 - 4}" r="12" fill="url(#f4Lamp)"></circle>') if h['lit'] else ''
    length = x
    return (f'<g class="f4-train" style="--run: {L.W + length + 40}px; --from: -{length + 20}px">'
            f'<g class="f4-rattle">{glow}{"".join(cars)}{"".join(wins)}{lamp}</g></g>')


# ── the foreground: the pine, the grass, the flowers ───────────────

def pine(L, h):
    from scene_f3 import pine as pine3
    return pine3(L, h).replace('class="f3-pine"', 'class="f4-pine"')


def susuki(L, h):
    """The pampas grass, each stem swaying from its own foot."""
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
            out.append(f'<g class="f4-sway" style="transform-origin: {f(bx0)}px {f(y0)}px; --a: {f(rng.uniform(2, 4.5))}deg; {anim(rng.uniform(3.4, 5.6), rng.uniform(0, 5))}">'
                       f'<path d="{stem}" fill="none" stroke="{h["stem"]}" stroke-width="{f(1.2 * sc)}" stroke-linecap="round"></path>'
                       f'<path d="{" ".join(hairs)}" fill="none" stroke="{h["plume"]}" stroke-opacity="0.8" stroke-width="{f(0.85 * sc)}" stroke-linecap="round"></path></g>')
    return ''.join(out)


def cosmos(L, h):
    """Cosmos (秋桜), October's flower: tall thin stems, eight petals
    round a gold heart, nodding in the wind."""
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
            petals = ''.join(f'<ellipse cx="0" cy="{f(-pr * 0.55)}" rx="{f(pr * 0.34)}" ry="{f(pr * 0.58)}" transform="rotate({a})"></ellipse>'
                             for a in range(0, 360, 45))
            leaf = ''.join(f'<path d="M{f(bx + (tx - bx) * t)} {f(y0 - ln * t)} q{f(side * 6 * sc)} {f(-3 * sc)} {f(side * 10 * sc)} {f(-9 * sc)}"></path>'
                           for t, side in ((0.35, 1), (0.55, -1)))
            out.append(f'<g class="f4-sway" style="transform-origin: {f(bx)}px {f(y0)}px; --a: {f(rng.uniform(3, 6))}deg; {anim(rng.uniform(3.8, 6), rng.uniform(0, 6))}">'
                       f'<path d="M{f(bx)} {f(y0)} Q{f((bx + tx) / 2 + rng.uniform(-6, 6) * sc)} {f(y0 - ln * 0.5)} {f(tx)} {f(ty)}" fill="none" stroke="{h["flower_stem"]}" stroke-width="{f(1.1 * sc)}"></path>'
                       f'<g fill="none" stroke="{h["flower_stem"]}" stroke-width="{f(0.7 * sc)}">{leaf}</g>'
                       f'<g transform="translate({f(tx)} {f(ty)}) rotate({f(tilt)})"><g class="f4-nod" style="{anim(rng.uniform(2.6, 4), rng.uniform(0, 4))}">'
                       f'<g fill="{col}">{petals}</g><circle r="{f(pr * 0.24)}" fill="#e8b84a"></circle></g></g></g>')
    return ''.join(out)


def leaves(L, h):
    """A few leaves let go by the wind, falling across the print."""
    if not h['leaves']:
        return ''
    out = []
    rng = random.Random(L.seed + 41)
    for k, (x, y, dx, dy) in enumerate(L.leaves):
        col = ['#c8562e', '#d9a23a', '#b8432a'][k % 3]
        dur = rng.uniform(13, 18)
        out.append(f'<g class="f4-fall" style="--dx: {f(dx)}px; --dy: {f(dy)}px; {anim(dur, dur * k / len(L.leaves) + rng.uniform(0, 2))}">'
                   f'<g transform="translate({f(x)} {f(y)})"><g class="f4-flutter" style="{anim(rng.uniform(1.6, 2.4), rng.uniform(0, 2))}">'
                   f'<path d="M0 -4 C2.6 -2.6 2.8 1.6 0 4 C-2.8 1.6 -2.6 -2.6 0 -4 Z M0 4 L0 6" fill="{col}" stroke="{col}" stroke-width="0.5"></path>'
                   f'</g></g></g>')
    return ''.join(out)


# ── the birds ─────────────────────────────────────────────────────

def goose(s=1.0):
    return (f'<path class="f4-wing" d="M-9 -4 C-5 -2 -2 -0.5 0 1 C2 -0.5 5 -2 9 -4 C5 -0.2 2 1.6 0 2.6 C-2 1.6 -5 -0.2 -9 -4 Z" '
            f'transform="scale({f(s)})"></path>')


def crane():
    """A red-crowned crane (丹頂) in flight, seen from the side, flying
    left: the neck straight out, black with a white nape, the red crown,
    legs trailing; the near wing beating over its back, black along its
    trailing edge, the far wing's tip showing under the body."""
    return ('<path d="M8 2 C14 5 16 9 14 12 C11 8 8 5 4 3 Z" fill="#cfcac0"></path>'
            '<path d="M-12 0.4 C-6 -1.8 2 -2.4 8 -1.6 C12 -1 14 0.4 15 1.6 C10 2.8 3 3.4 -3 3 C-7 2.7 -10 1.8 -12 0.4 Z" fill="#f6f3ec"></path>'
            '<path d="M-12 0.6 C-17 -0.6 -22 -1.6 -26 -2.4" fill="none" stroke="#14141c" stroke-width="2" stroke-linecap="round"></path>'
            '<path d="M-17 -0.5 C-19 -1 -21 -1.5 -22.5 -1.9" fill="none" stroke="#f6f3ec" stroke-width="0.9" stroke-linecap="round"></path>'
            '<circle cx="-27" cy="-2.6" r="1.7" fill="#14141c"></circle>'
            '<circle cx="-27.2" cy="-3.7" r="0.85" fill="#c33a2c"></circle>'
            '<path d="M-28.4 -2.4 L-33.5 -1.6" stroke="#cdb27a" stroke-width="0.9" stroke-linecap="round"></path>'
            '<path d="M14 1.4 L30 3.6 M14 2.2 L29.4 5" stroke="#14141c" stroke-width="0.8" stroke-linecap="round"></path>'
            '<g class="f4-wing f4-wing--slow">'
            '<path d="M-6 -1.6 C-8 -9 -3 -18 7 -24 C6 -17 7.5 -9 9 -1.4 Z" fill="#f6f3ec"></path>'
            '<path d="M7 -24 C5 -18 5.6 -12 6.4 -6 C6.8 -4 7.6 -2.6 9 -1.4 C8.4 -7 8.6 -14 9.8 -21 Z" fill="#14141c"></path>'
            '</g>')


def gull():
    return '<path class="f4-wing f4-wing--glide" d="M-7 0 Q-3.5 -3.2 0 0 Q3.5 -3.2 7 0" fill="none" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round"></path>'


def birds(L, h):
    kind = h['birds']
    if not kind:
        return ''
    rng = random.Random(L.seed + 51)
    if kind == 'geese':
        (x0, y0), (x1, y1), dur = L.geese_path
        form = [(0, 0), (-15, -7), (-30, -13), (-14, 8), (-29, 15), (-44, -19)]
        birds_ = ''.join(f'<g transform="translate({f(dx)} {f(dy)})"><g class="f4-bob" style="{anim(rng.uniform(2.4, 3.4), rng.uniform(0, 3))}">'
                         f'<g class="f4-flap" style="{anim(rng.uniform(0.8, 1.05), rng.uniform(0, 1))}">{goose(rng.uniform(0.7, 0.95))}</g></g></g>'
                         for dx, dy in form)
        return (f'<g class="f4-flock" fill="#1b2238" style="--x0: {f(x0)}px; --y0: {f(y0)}px; --x1: {f(x1)}px; --y1: {f(y1)}px; --xm: {f(x0 + (x1 - x0) * 0.42)}px; --ym: {f(y0 + (y1 - y0) * 0.42)}px; {anim(dur, dur * 0.42)}">'
                f'{birds_}</g>')
    if kind == 'cranes':
        (x0, y0), (x1, y1), dur = L.cranes_path
        form = [(0, 0), (46, 14), (92, 4)]
        s = L.crane_scale
        birds_ = ''.join(f'<g transform="translate({f(dx * s)} {f(dy * s)}) scale({f(s)})"><g class="f4-bob" style="{anim(rng.uniform(3, 4), rng.uniform(0, 3))}">'
                         f'{crane()}</g></g>' for dx, dy in form)
        return (f'<g class="f4-flock f4-flock--cranes" style="--x0: {f(x0)}px; --y0: {f(y0)}px; --x1: {f(x1)}px; --y1: {f(y1)}px; --xm: {f(x0 + (x1 - x0) * 0.35)}px; --ym: {f(y0 + (y1 - y0) * 0.35)}px; {anim(dur, dur * 0.35)}">'
                f'{birds_}</g>')
    if kind == 'gulls':
        out = []
        for cx, cy, r, dur in L.gulls:
            d = rng.uniform(0, dur)
            out.append(f'<g class="f4-orbit" style="transform-origin: {f(cx)}px {f(cy)}px; {anim(dur, d)}">'
                       f'<g transform="translate({f(cx + r)} {f(cy)})"><g class="f4-counter" style="{anim(dur, d)}">'
                       f'<g class="f4-flap f4-flap--glide" style="{anim(rng.uniform(4, 6), rng.uniform(0, 5))}">{gull()}</g></g></g></g>')
        return ''.join(out)
    return ''


# ── the print ─────────────────────────────────────────────────────

def scene(L, hour, uid='f4'):
    h = HOURS[hour]
    rng = random.Random(L.seed)
    x0, ys, yb, hb = L.fuji
    fj = Fuji(x0, ys, yb, hb)
    far, near = ridges(L)
    mists = ''.join(mist_band(x, y, w, hh, h['mist'][which], 0.7 if which == 0 else 0.58) for x, y, w, hh, which in L.mists)
    return f'''<defs>
        <linearGradient id="f4Sky" x1="0" y1="0" x2="0" y2="{f(L.horizon)}" gradientUnits="userSpaceOnUse">{stops(h['sky'])}</linearGradient>
        <linearGradient id="f4Band" x1="0" y1="0" x2="0" y2="{f(L.H * 0.11)}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="{h['band']}" stop-opacity="1"></stop><stop offset="0.55" stop-color="{h['band']}" stop-opacity="0.7"></stop><stop offset="1" stop-color="{h['band']}" stop-opacity="0"></stop>
        </linearGradient>
        <linearGradient id="f4Water" x1="0" y1="{f(L.water[0])}" x2="0" y2="{f(L.water[1])}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="{h['water'][0]}"></stop><stop offset="1" stop-color="{h['water'][1]}"></stop></linearGradient>
        <linearGradient id="f4Meteor" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fffaf0" stop-opacity="0"></stop><stop offset="1" stop-color="#fffaf0" stop-opacity="0.95"></stop></linearGradient>
        <radialGradient id="f4Lamp"><stop offset="0" stop-color="#fff1c4" stop-opacity="0.55"></stop><stop offset="1" stop-color="#fff1c4" stop-opacity="0"></stop></radialGradient>
        <radialGradient id="f4Isaribi"><stop offset="0" stop-color="#ffd37a" stop-opacity="0.95"></stop><stop offset="0.35" stop-color="#ff9a3c" stop-opacity="0.55"></stop><stop offset="1" stop-color="#ff7a2a" stop-opacity="0"></stop></radialGradient>
        <filter id="f4Grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="{f(2.3 / L.W)} 0.32" numOctaves="2" seed="3"></feTurbulence>
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 0.97  0 0 0 0 0.92  0 0 0 0.1 0"></feColorMatrix>
        </filter>
        <filter id="f4Paper" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"></feTurbulence>
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 0.96  0 0 0 0 0.9  0 0 0 0.07 0"></feColorMatrix>
        </filter>
        <filter id="f4Win" x="-10%" y="-100%" width="120%" height="300%"><feGaussianBlur stdDeviation="2.2"></feGaussianBlur></filter>
      </defs>
      <rect width="{L.W}" height="{f(L.horizon + 12)}" fill="url(#f4Sky)"></rect>
      <rect width="{L.W}" height="{f(L.H * 0.11)}" fill="url(#f4Band)"></rect>
      <g class="f4-stars">{stars(L, h)}</g>
      <rect width="{L.W}" height="{f(L.horizon + 12)}" filter="url(#f4Grain)"></rect>
      <g class="f4-clouds">{clouds(L, h)}</g>
      {birds(L, h) if h['birds'] == 'cranes' else ''}
      {disc(L, h, uid)}
      {fuji_svg(fj, h['fuji'], uid=uid + 'Fj', seed=L.seed)}
      <g class="f4-mist">{mists}</g>
      {smoke(L, h)}
      {hills(L, h, far, near)}
      {water(L, h, far, near)}
      {boats(L, h)}
      {birds(L, h) if h['birds'] in ('gulls', 'geese') else ''}
      {train(L, h)}
      {viaduct(L, h)}
      <rect y="{f(L.ground)}" width="{L.W}" height="{f(L.H - L.ground)}" fill="{h['ground']}"></rect>
      <path d="M-10 {f(L.ground + 4)} C{f(L.W * 0.15)} {f(L.ground - 4)} {f(L.W * 0.3)} {f(L.ground + 6)} {f(L.W * 0.5)} {f(L.ground)} S{f(L.W * 0.82)} {f(L.ground + 4)} {L.W + 10} {f(L.ground - 2)} L{L.W + 10} {f(L.ground + 12)} L-10 {f(L.ground + 12)} Z" fill="{h['ground']}"></path>
      {pine(L, h)}
      {cosmos(L, h)}
      {susuki(L, h)}
      {leaves(L, h)}
      <rect width="{L.W}" height="{L.H}" filter="url(#f4Paper)"></rect>'''
