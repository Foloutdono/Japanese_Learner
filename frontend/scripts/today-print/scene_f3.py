"""F″ · the print of the hour: one landscape, four prints. The hour
chooses the sky, the light on Fuji, the disc in the sky and what moves
in the scene; each is one of the Eight Views a print series would name
(八景): 曙 dawn, the red sun; 帰帆 day, sails coming home on the bay;
落雁 dusk, geese coming down under the moon; 秋月 night, October's moon.
A layout places the same scene on a phone or across the desk."""
import math
import random
from dataclasses import dataclass, field
from geo import LINE, arcs, f
from brush import polar
from fuji import Fuji, fuji_svg

HOURS = {
    'dawn': dict(
        view='曙', view_fr='l’aube', clock=('06:40', '07:53', '06:55'),
        sky=[(0, '#1d2148'), (0.22, '#30305c'), (0.5, '#6a5684'), (0.7, '#b07e98'), (0.84, '#eeaa96'), (0.94, '#f8cfa6'), (1, '#fbe2bb')],
        band='#121636', stars=0,
        disc='sun_red', disc_fill=('#e0623f', '#bf3a26'), disc_glow='#f08c64', glow_op=0.5,
        count=('#fff6e4', '#fde6c4'), disc_ink='#fbe8cf', disc_soft='#f6d2b4', maria=False,
        halo_glow=0.42, fare_ink='#fbeedd', text='#1c1a33', text_soft='#3a3352',
        clouds=[('#f6c3ae', 0.75), ('#fbe0c6', 0.7)], cloud_y=(0.22, 0.12),
        fuji=dict(fuji_top='#3a2e55', fuji_mid='#56456f', fuji_foot='#a07f99', fuji_shade='#20163a', fuji_ridge='#271d42',
                  snow='#fbe4da', snow_lit='#f3a796', snow_shade='#c6a4be', fuji_mist='#f3c6b8'),
        mist=('#f6cdbd', '#efc0b8'), hill_far='#4b3f61', hill_near='#2c2740',
        water=('#8a7a9c', '#4e4766'), ripple='#f3c9b4', refl='#f2885f', refl_op=0.8,
        viaduct='#1c1a2a', arch='#4a3f5c', ground='#110f1c', pine='#120f1a', pine_lit='#2b2338',
        plume='#f2cdb4', stem='#3a2f44', train='#25223a', windows='#ffd98c', lit=True, geese=False, boats=False, village=False,
    ),
    'day': dict(
        view='帰帆', view_fr='les voiles', clock=('12:30', '13:43', '12:45'),
        sky=[(0, '#1e3f7c'), (0.14, '#2f5694'), (0.4, '#6b93c3'), (0.66, '#a9c3dc'), (0.86, '#dfe7ea'), (1, '#f1efe4')],
        band='#152f63', stars=0,
        disc='sun', disc_fill=('#fffbf1', '#f4e7c4'), disc_glow='#fff3cf', glow_op=0.6,
        count=('#8b6421', '#5a3d0c'), disc_ink='#2b2217', disc_soft='#6b5a3e', maria=False,
        halo_glow=0.0, fare_ink='#22345a', text='#172748', text_soft='#33466b',
        clouds=[('#ffffff', 0.92), ('#f6f8fb', 0.85)], cloud_y=(0.2, 0.1),
        fuji=dict(fuji_top='#2c4d7e', fuji_mid='#46679a', fuji_foot='#93aac6', fuji_shade='#16305a', fuji_ridge='#1d3a66',
                  snow='#ffffff', snow_lit='#fbfaf4', snow_shade='#c6d3e6', fuji_mist='#e9eef1'),
        mist=('#f4f6f7', '#e7edf1'), hill_far='#5d7f6a', hill_near='#3d5e4a',
        water=('#5e8fbf', '#3b6b9c'), ripple='#e8f1f8', refl='#ffffff', refl_op=0.55,
        viaduct='#5a4e46', arch='#8fa3b8', ground='#1a2a22', pine='#16261c', pine_lit='#36513c',
        plume='#efe3c4', stem='#3d5a40', train='#e9e4d6', windows='#5f6f7c', lit=False, geese=False, boats=True, village=False,
    ),
    'dusk': dict(
        view='落雁', view_fr='les oies', clock=('18:40', '19:53', '18:55'),
        sky=[(0, '#0e1934'), (0.14, '#172a52'), (0.4, '#2d426f'), (0.6, '#5a6690'), (0.74, '#a08ca0'), (0.85, '#d99d7a'), (0.93, '#ebb67e'), (1, '#f2cb94')],
        band='#081230', stars=0,
        disc='moon', disc_fill=('#fbf4df', '#eadbb6'), disc_glow='#f6e7c4', glow_op=0.42,
        count=('#91692a', '#5a3c0c'), disc_ink='#2b2217', disc_soft='#6b5a3e', maria=True,
        halo_glow=0.5, fare_ink='#f6eed9', text='#121b31', text_soft='#2f3a55',
        clouds=[], cloud_y=(0, 0),
        fuji=dict(fuji_top='#2f3a5c', fuji_mid='#3d4a6f', fuji_foot='#6e6f8f', fuji_shade='#141a30', fuji_ridge='#161e38',
                  snow='#f6efe6', snow_lit='#f7d8ca', snow_shade='#b4bad0', fuji_mist='#cfa9ab'),
        mist=('#efc8b4', '#d9b3b6'), hill_far='#2a3850', hill_near='#1c283a',
        water=('#4d5a7a', '#28344e'), ripple='#c9b6b0', refl='#f8f0da', refl_op=0.75,
        viaduct='#101826', arch='#26324a', ground='#0a101b', pine='#0b1411', pine_lit='#1c2b26',
        plume='#dcc5a6', stem='#2b3446', train='#1a2232', windows='#ffd27a', lit=True, geese=True, boats=False, village=False,
    ),
    'night': dict(
        view='秋月', view_fr='la lune d’automne', clock=('22:00', '23:13', '22:15'),
        sky=[(0, '#050a1a'), (0.2, '#0b162e'), (0.5, '#152548'), (0.75, '#22385f'), (0.9, '#2f4b74'), (1, '#3a5a82')],
        band='#02061a', stars=46,
        disc='moon', disc_fill=('#fdf9ec', '#e6ddc2'), disc_glow='#eef0e6', glow_op=0.38,
        count=('#91692a', '#5a3c0c'), disc_ink='#2b2217', disc_soft='#6b5a3e', maria=True,
        halo_glow=0.55, fare_ink='#eef0e6', text='#ece5d8', text_soft='#b9b2a8',
        clouds=[], cloud_y=(0, 0),
        fuji=dict(fuji_top='#172239', fuji_mid='#1f2c47', fuji_foot='#34476b', fuji_shade='#0a1224', fuji_ridge='#0d162d',
                  snow='#dde6f2', snow_lit='#eef3fa', snow_shade='#93a5c3', fuji_mist='#3e5277'),
        mist=('#7e90b2', '#6577a0'), hill_far='#16233a', hill_near='#0f1a2c',
        water=('#22355a', '#142340'), ripple='#9fb3d1', refl='#fbf6e6', refl_op=0.85,
        viaduct='#0a111d', arch='#1a2944', ground='#070b14', pine='#070d0c', pine_lit='#14201d',
        plume='#b9c4d6', stem='#1c2638', train='#151c2a', windows='#ffd27a', lit=True, geese=False, boats=False, village=True,
    ),
}


@dataclass
class Layout:
    W: int
    H: int
    cx: float
    cy: float
    disc_r: float
    halo_r: float
    fare_r: float
    horizon: float
    fuji: tuple                       # x0, summit y, foot y, half-base
    hills: tuple                      # far top y, near top y
    water: tuple                      # top, bottom
    viaduct: tuple                    # deck top, base
    ground: float
    pine: tuple                       # x, y (the trunk's foot), scale
    cars: int = 5
    mists: list = field(default_factory=list)      # (x, y, w, h, which)
    clouds: list = field(default_factory=list)     # (x, y, w, h)
    geese: list = field(default_factory=list)      # (x, y, scale, flap)
    boats: list = field(default_factory=list)      # (x, y, scale)
    star_box: tuple = (0, 0, 0, 0)
    susuki: list = field(default_factory=list)     # (x, y, scale, stems)
    seed: int = 7


def stops(st):
    return ''.join(f'<stop offset="{o}" stop-color="{c}"></stop>' for o, c in st)


def ring(L, r, width, color, cls='', extra=''):
    out, c = arcs(r, gap=11 * r / 101, cap=width / 2)
    return '\n'.join(f'<circle cx="{f(L.cx)}" cy="{f(L.cy)}" r="{f(r)}" fill="none" stroke="{color(k)}" '
                     f'stroke-width="{f(width)}" stroke-linecap="round" stroke-dasharray="{f(ln)} {f(c)}" '
                     f'stroke-dashoffset="-{f(s)}" transform="rotate(-90 {f(L.cx)} {f(L.cy)})"{extra}></circle>'
                     for k, s, ln, _ in out)


def disc(L, h, uid):
    """The day's disc in the hour's sky: the moon (dusk, night), the
    sun (day), the red sun (dawn). Its halo is the lines, and a fainter
    ring beyond it the fare: solid as far as the balance boards."""
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
        maria = (f'<g clip-path="url(#{uid}DiscClip)" fill="#c9b68a" opacity="0.2" filter="url(#{uid}Soft)">{maria}</g>')
    halo_glow = ''
    if h['halo_glow']:
        halo_glow = (f'<g opacity="{h["halo_glow"]}" filter="url(#{uid}Glow)">'
                     f'{ring(L, hr, 13, lambda k: LINE[k])}</g>')
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
      <g class="f3-disc">
        <circle cx="{f(L.cx)}" cy="{f(L.cy)}" r="{f(glow_r)}" fill="url(#{uid}DiscGlow)"></circle>
        {halo_glow}
        {ring(L, hr, 3.4 * r / 80, lambda k: LINE[k])}
        <circle cx="{f(L.cx)}" cy="{f(L.cy)}" r="{f(fr)}" fill="none" stroke="{h['fare_ink']}" stroke-opacity="0.38" stroke-width="{f(1.6 * r / 80)}" stroke-linecap="round" stroke-dasharray="0.01 {f(6.2 * r / 80)}"></circle>
        <circle cx="{f(L.cx)}" cy="{f(L.cy)}" r="{f(fr)}" fill="none" stroke="{h['fare_ink']}" stroke-opacity="0.78" stroke-width="{f(1.25 * r / 80)}" stroke-linecap="round" stroke-dasharray="{f(c * share)} {f(c)}" transform="rotate(-90 {f(L.cx)} {f(L.cy)})"></circle>
        <circle cx="{f(fx)}" cy="{f(fy)}" r="{f(2.4 * r / 80)}" fill="{h['fare_ink']}"></circle>
        <circle cx="{f(L.cx)}" cy="{f(L.cy)}" r="{f(r)}" fill="url(#{uid}DiscFill)"></circle>
        {maria}
      </g>'''


def mist_band(x, y, w, h, color, op):
    return f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" rx="{f(h / 2)}" fill="{color}" fill-opacity="{op}"></rect>'


def smooth(pts):
    """A path through the points, Catmull-Rom as cubic Béziers."""
    d = f'M{f(pts[0][0])} {f(pts[0][1])}'
    for i in range(len(pts) - 1):
        p0 = pts[i - 1] if i else pts[i]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[i + 2] if i + 2 < len(pts) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f' C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}'
    return d


def hills(L, h, rng):
    W = L.W
    far_y, near_y = L.hills

    def ridge(y0, amp, n, seed):
        r = random.Random(seed)
        pts = [(-20 + (W + 40) * k / n, y0 + r.uniform(-amp, amp)) for k in range(n + 1)]
        return smooth(pts) + f' L{W + 20} {f(L.water[0] + 6)} L-20 {f(L.water[0] + 6)} Z'
    far = ridge(far_y, 9, max(4, W // 80), L.seed + 1)
    near = ridge(near_y, 5, max(5, W // 60), L.seed + 2)
    lights = ''
    if h['village']:
        lr = random.Random(L.seed + 3)
        lights = ''.join(f'<rect x="{f(lr.uniform(10, W - 10))}" y="{f(lr.uniform(near_y + 6, L.water[0] - 3))}" width="1.6" height="1.6" fill="#ffd27a" fill-opacity="{f(lr.uniform(0.5, 1))}"></rect>'
                         for _ in range(max(8, W // 30)))
    return (f'<path d="{far}" fill="{h["hill_far"]}"></path>'
            f'<path d="{near}" fill="{h["hill_near"]}"></path>{lights}')


def water(L, h, rng):
    y0, y1 = L.water
    rip = []
    for _ in range(int(L.W / 14)):
        y = rng.uniform(y0 + 4, y1 - 4)
        x = rng.uniform(-10, L.W)
        ln = rng.uniform(14, 44)
        rip.append(f'<line x1="{f(x)}" y1="{f(y)}" x2="{f(x + ln)}" y2="{f(y)}"></line>')
    refl = []
    n = int((y1 - y0 - 6) / 4.2)
    for k in range(n):
        y = y0 + 5 + k * 4.2
        half = (L.disc_r * 0.28) * (1 - k / (n + 2)) + rng.uniform(-2, 2)
        refl.append(f'<line x1="{f(L.cx - half)}" y1="{f(y)}" x2="{f(L.cx + half)}" y2="{f(y)}"></line>')
    return (f'<rect y="{f(y0)}" width="{L.W}" height="{f(y1 - y0 + 4)}" fill="url(#f3Water)"></rect>'
            f'<g stroke="{h["ripple"]}" stroke-opacity="0.35" stroke-width="0.9" stroke-linecap="round">{"".join(rip)}</g>'
            f'<g class="f3-refl" stroke="{h["refl"]}" stroke-opacity="{h["refl_op"]}" stroke-width="1.6" stroke-linecap="round">{"".join(refl)}</g>')


def boats(L, h):
    out = []
    for x, y, s in L.boats:
        out.append(f'<g class="f3-boat" transform="translate({f(x)} {f(y)}) scale({f(s)})">'
                   f'<path d="M-9 0 L9 0 L6 3 L-6 3 Z" fill="#1d2b3a"></path>'
                   f'<path d="M0 0 L0 -15 M0 -15 L-0.5 -15" stroke="#1d2b3a" stroke-width="0.8"></path>'
                   f'<path d="M0.6 -14.5 L7.5 -2 L0.6 -1.5 Z" fill="#fffdf6"></path>'
                   f'<path d="M-0.6 -12 L-6 -2 L-0.6 -1.8 Z" fill="#f1ede2"></path></g>')
    return ''.join(out)


def viaduct(L, h):
    top, base = L.viaduct
    deck = top + 6
    arches = []
    x = -20
    span = 42
    while x < L.W + 20:
        arches.append(f'<path d="M{f(x + 6)} {f(base)} V{f(deck + (base - deck) * 0.42)} A15 15 0 0 1 {f(x + 36)} {f(deck + (base - deck) * 0.42)} V{f(base)} Z"></path>')
        x += span
    return (f'<rect y="{f(top)}" width="{L.W}" height="{f(base - top)}" fill="{h["viaduct"]}"></rect>'
            f'<g fill="{h["arch"]}">{"".join(arches)}</g>'
            f'<rect y="{f(top - 2)}" width="{L.W}" height="2" fill="{h["viaduct"]}"></rect>')


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
    glow = f'<g filter="url(#f3Win)" opacity="0.8">{"".join(wins)}</g>' if h['lit'] else ''
    lamp = (f'<circle cx="{x - 1}" cy="{y1 - 4}" r="2" fill="#fff4cf"></circle>'
            f'<circle cx="{x + 6}" cy="{y1 - 4}" r="12" fill="url(#f3Lamp)"></circle>') if h['lit'] else ''
    length = x
    return f'<g class="f3-train" style="--run: {L.W + length + 40}px; --from: -{length + 20}px">{glow}{"".join(cars)}{"".join(wins)}{lamp}</g>'


def pine(L, h):
    px, py, s = L.pine
    trunk = ('M14 746 C22 680 30 620 52 566 C62 540 72 516 88 488 L96 492 C82 522 72 552 64 580 '
             'C48 630 42 690 40 746 Z')
    branches = ('M62 560 C86 556 108 548 132 532 L136 537 C114 552 90 562 66 566 Z '
                'M74 524 C56 516 38 510 16 509 L16 503 C40 503 62 509 80 517 Z '
                'M84 500 C98 494 112 482 120 470 L125 473 C118 487 104 499 88 506 Z')
    rng = random.Random(4)

    def cluster(cx, cy, w, hh):
        blobs = []
        n = max(5, int(w / 10))
        for k in range(n):
            x = cx - w / 2 + (k + 0.5) * w / n + rng.uniform(-3, 3)
            rx = w / n * rng.uniform(0.72, 0.95)
            ry = hh * rng.uniform(0.34, 0.46)
            y = cy - ry * 0.4 + rng.uniform(-1.5, 1) - (hh * 0.16 if 0 < k < n - 1 else 0)
            blobs.append((x, y, rx, ry))
        base = f'<rect x="{f(cx - w / 2 + 3)}" y="{f(cy - hh * 0.3)}" width="{f(w - 6)}" height="{f(hh * 0.42)}" rx="{f(hh * 0.2)}"></rect>'
        shapes = base + ''.join(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(rx)}" ry="{f(ry)}"></ellipse>' for x, y, rx, ry in blobs)
        tops = ''.join(f'<ellipse cx="{f(x - rx * 0.12)}" cy="{f(y - ry * 0.42)}" rx="{f(rx * 0.62)}" ry="{f(ry * 0.34)}"></ellipse>'
                       for x, y, rx, ry in blobs)
        return shapes, tops
    pads = [(118, 468, 74, 22), (96, 492, 96, 24), (140, 530, 70, 20), (28, 506, 64, 20), (66, 556, 58, 18)]
    shapes, tops = zip(*(cluster(*q) for q in pads))
    # drawn for a 746-high frame with its foot at the frame's foot
    return (f'<g class="f3-pine" transform="translate({f(px)} {f(py - 746 * s)}) scale({f(s)})">'
            f'<path d="{trunk}" fill="{h["pine"]}"></path><path d="{branches}" fill="{h["pine"]}"></path>'
            f'<g fill="{h["pine"]}">{"".join(shapes)}</g><g fill="{h["pine_lit"]}" opacity="0.5">{"".join(tops)}</g></g>')


def susuki(L, h):
    """Pampas grass (薄), October's grass, the moon-viewing's: clumps of
    arching stems, each ending in a seed head of fine drooping hairs
    that catches the light."""
    out = []
    rng = random.Random(L.seed + 21)
    for x0, y0, sc, n in L.susuki:
        stems, hairs = [], []
        for k in range(n):
            lean = rng.uniform(-0.55, 0.9)
            ln = rng.uniform(52, 88) * sc
            tx = x0 + lean * ln * 0.55 + rng.uniform(-6, 6) * sc
            ty = y0 - ln
            cx_, cy_ = x0 + lean * ln * 0.12, y0 - ln * 0.6
            stems.append(f'M{f(x0 + rng.uniform(-4, 4) * sc)} {f(y0)} Q{f(cx_)} {f(cy_)} {f(tx)} {f(ty)}')
            # the seed head: hairs leaving the stem's top along its last
            # stretch, bending over and down with the weight
            ang = math.atan2(ty - cy_, tx - cx_)
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
        out.append(f'<g class="f3-susuki"><path d="{" ".join(stems)}" fill="none" stroke="{h["stem"]}" stroke-width="{f(1.2 * sc)}" stroke-linecap="round"></path>'
                   f'<path d="{" ".join(hairs)}" fill="none" stroke="{h["plume"]}" stroke-opacity="0.8" stroke-width="{f(0.85 * sc)}" stroke-linecap="round"></path></g>')
    return ''.join(out)


def geese(L):
    def goose(x, y, s, flap):
        return (f'<path transform="translate({f(x)} {f(y)}) scale({f(s)})" d="M-9 {f(-2 - flap)} C-5 {f(-1 - flap * 0.4)} -2 -0.5 0 1 '
                f'C2 -0.5 5 {f(-1 - flap * 0.4)} 9 {f(-2 - flap)} C5 {f(0.2 - flap * 0.2)} 2 1.6 0 2.6 '
                f'C-2 1.6 -5 {f(0.2 - flap * 0.2)} -9 {f(-2 - flap)} Z"></path>')
    return f'<g class="f3-geese" fill="#1b2238">{"".join(goose(*g) for g in L.geese)}</g>'


def scene(L, hour, uid='f3'):
    h = HOURS[hour]
    rng = random.Random(L.seed)
    x0, ys, yb, hb = L.fuji
    fj = Fuji(x0, ys, yb, hb)
    stars = ''
    if h['stars']:
        sx0, sy0, sx1, sy1 = L.star_box
        sr = random.Random(L.seed + 9)
        pts = []
        while len(pts) < h['stars']:
            x, y = sr.uniform(sx0, sx1), sr.uniform(sy0, sy1)
            if math.hypot(x - L.cx, y - L.cy) < L.fare_r + 26:
                continue
            pts.append((x, y))
        stars = ''.join(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(sr.uniform(0.4, 1.15))}" fill="#f3ecdf" fill-opacity="{f(sr.uniform(0.3, 0.95))}"></circle>'
                        for x, y in pts)
    clouds = ''.join(mist_band(x, y, w, hh, h['clouds'][k % len(h['clouds'])][0], h['clouds'][k % len(h['clouds'])][1])
                     for k, (x, y, w, hh) in enumerate(L.clouds)) if h['clouds'] else ''
    mists = ''.join(mist_band(x, y, w, hh, h['mist'][which], 0.7 if which == 0 else 0.58) for x, y, w, hh, which in L.mists)
    return f'''<defs>
        <linearGradient id="f3Sky" x1="0" y1="0" x2="0" y2="{f(L.horizon)}" gradientUnits="userSpaceOnUse">{stops(h['sky'])}</linearGradient>
        <linearGradient id="f3Band" x1="0" y1="0" x2="0" y2="{f(L.H * 0.11)}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="{h['band']}" stop-opacity="1"></stop><stop offset="0.55" stop-color="{h['band']}" stop-opacity="0.7"></stop><stop offset="1" stop-color="{h['band']}" stop-opacity="0"></stop>
        </linearGradient>
        <linearGradient id="f3Water" x1="0" y1="{f(L.water[0])}" x2="0" y2="{f(L.water[1])}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="{h['water'][0]}"></stop><stop offset="1" stop-color="{h['water'][1]}"></stop></linearGradient>
        <radialGradient id="f3Lamp"><stop offset="0" stop-color="#fff1c4" stop-opacity="0.55"></stop><stop offset="1" stop-color="#fff1c4" stop-opacity="0"></stop></radialGradient>
        <filter id="f3Grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="{f(2.3 / L.W)} 0.32" numOctaves="2" seed="3"></feTurbulence>
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 0.97  0 0 0 0 0.92  0 0 0 0.1 0"></feColorMatrix>
        </filter>
        <filter id="f3Paper" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"></feTurbulence>
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 0.96  0 0 0 0 0.9  0 0 0 0.07 0"></feColorMatrix>
        </filter>
        <filter id="f3Win" x="-10%" y="-100%" width="120%" height="300%"><feGaussianBlur stdDeviation="2.2"></feGaussianBlur></filter>
      </defs>
      <rect width="{L.W}" height="{f(L.horizon + 12)}" fill="url(#f3Sky)"></rect>
      <rect width="{L.W}" height="{f(L.H * 0.11)}" fill="url(#f3Band)"></rect>
      {stars}
      <rect width="{L.W}" height="{f(L.horizon + 12)}" filter="url(#f3Grain)"></rect>
      <g class="f3-clouds">{clouds}</g>
      {disc(L, h, uid)}
      {fuji_svg(fj, h['fuji'], uid=uid + 'Fj', seed=L.seed)}
      <g class="f3-mist">{mists}</g>
      {hills(L, h, rng)}
      {water(L, h, rng)}
      {boats(L, h) if h['boats'] else ''}
      {train(L, h)}
      {viaduct(L, h)}
      <rect y="{f(L.ground)}" width="{L.W}" height="{f(L.H - L.ground)}" fill="{h['ground']}"></rect>
      <path d="M-10 {f(L.ground + 4)} C{f(L.W * 0.15)} {f(L.ground - 4)} {f(L.W * 0.3)} {f(L.ground + 6)} {f(L.W * 0.5)} {f(L.ground)} S{f(L.W * 0.82)} {f(L.ground + 4)} {L.W + 10} {f(L.ground - 2)} L{L.W + 10} {f(L.ground + 12)} L-10 {f(L.ground + 12)} Z" fill="{h['ground']}"></path>
      {pine(L, h)}
      {susuki(L, h)}
      {geese(L) if h['geese'] else ''}
      <rect width="{L.W}" height="{L.H}" filter="url(#f3Paper)"></rect>'''
