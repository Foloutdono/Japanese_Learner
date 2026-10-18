"""F⁸ · F⁷'s print with F⁶'s needle tiers back on the pine, in F⁷'s
places (the right-hand tier clear of the train, the masts clear of the
tiers). F⁷ · the print in three layers: everything behind the train, the
train on a layer of its own, everything in front of it (the bridge, the
bank, the pine, the flowers). The train glides: no rattle, and its
layer is moved by the compositor, so it keeps its pace however busy the
rest of the print is. The pine's tiers are redrawn as tufts of needles
(el8.py); on the phone the village is left out."""
import math
import random
from dataclasses import dataclass
from geo import f
from fuji import Fuji, fuji_svg
from scene_f3 import stops
from scene_f4 import stars, disc, anim
from scene_f5 import HOURS as H5, clouds, cloud_defs, leaves, birds, gust
import copy

# The hours as before, with the dawn and dusk skies' afterglow beginning
# higher, so the lines of text under the disc sit on the lit sky instead
# of its darkest mid-tones (they measured 2.2-3.6:1 there); and the dawn
# caption on the red sun lighter (2.9:1 before).
HOURS = copy.deepcopy(H5)
HOURS['dusk']['sky'] = [(0, '#0e1934'), (0.14, '#172a52'), (0.36, '#2d426f'), (0.5, '#6a6e98'), (0.6, '#b39aa9'),
                        (0.72, '#dcae98'), (0.85, '#e9b383'), (0.93, '#ecb87f'), (1, '#f2cb94')]
HOURS['dawn']['sky'] = [(0, '#1d2148'), (0.22, '#30305c'), (0.42, '#6a5684'), (0.54, '#b07e98'), (0.66, '#e8a597'),
                        (0.8, '#f3bea0'), (0.92, '#f8cfa6'), (1, '#fbe2bb')]
HOURS['dawn']['disc_soft'] = '#fff6ec'
HOURS['dawn']['disc_fill'] = ('#d4553a', '#a8301f')
from scene_f6 import (SEA, Layout6, mix, ridges, hills_far, hills_near, fog, water, fleet, seawall, village, smoke6)
from el7 import (boats7, reflections7, boat_defs, catenary7, train_defs, bridge7, bridge_defs,
                 cosmos7, cosmos_defs, susuki7, grass7, TRAIN, CAR, GAP, NOSE, car, nose)
from boughs9 import seated
BOUGHS8 = seated()
from el7 import pine7


@dataclass
class Layout8(Layout6):
    mast0: float = 0.0          # where the overhead line's masts stand (one of them), clear of the pine's tiers


def train8(L, h, s, hour, uid):
    """The bullet train, drawn just off the left edge of the print, for
    its own layer to carry across; and how far that layer travels, as a
    share of the print's width."""
    c = TRAIN[hour]
    top = L.viaduct[0]
    y0, y1 = top - 13.5, top - 0.4
    parts, glass, bellows = [], [], []
    x = NOSE
    for k in range(L.cars):
        body, wins = car(x, y0, y1, c, uid, k, pantograph=k in (1, L.cars - 2))
        parts.append(body)
        glass.append(wins)
        if k < L.cars - 1:
            bellows.append(f'<rect x="{f(x + CAR - 0.5)}" y="{f(y0 + 1.6)}" width="{GAP + 1}" height="{f(y1 - y0 - 1.6)}" fill="{c["bellows"]}"></rect>')
        x += CAR + GAP
    x -= GAP
    lead = nose(x, y0, y1, c, uid, lead=True)
    tail = nose(NOSE, y0, y1, c, uid, lead=False)
    length = x + NOSE
    glow = f'<g filter="url(#f4Win)" opacity="0.75">{"".join(glass)}</g>' if c['lit'] else ''
    run = (L.W + length + 40) / L.W * 100
    return (f'<g transform="translate(-{f(length + 20)} 0)">{"".join(bellows)}{tail}{lead}{"".join(parts)}{glow}{"".join(glass)}</g>'), run


def stars9(L, h):
    """F⁴'s stars, where they were, twinkling in five groups rather than
    one animation each; the meteor as before."""
    if not h['stars']:
        return ''
    sx0, sy0, sx1, sy1 = L.star_box
    sr = random.Random(L.seed + 9)
    groups = [[] for _ in range(5)]
    n = 0
    while n < h['stars']:
        x, y = sr.uniform(sx0, sx1), sr.uniform(sy0, sy1)
        if math.hypot(x - L.cx, y - L.cy) < L.fare_r + 26:
            continue
        # nor among the lines of text under the disc, where a star reads
        # as a stray mark (≈'73 min)
        if L.cy + L.fare_r + 8 < y < L.cy + L.fare_r + (70 if L.W < 600 else 150) and (L.W < 600 or abs(x - L.cx) < 280):
            continue
        r = sr.uniform(0.4, 1.15)
        o = sr.uniform(0.35, 0.95)
        sr.uniform(2.2, 5.5), sr.uniform(0, 5)
        groups[n % 5].append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill-opacity="{f(o)}"></circle>')
        n += 1
    out = ''.join(f'<g class="f4-star" fill="#f3ecdf" style="--o: 1; {anim(2.4 + g * 0.7, g * 1.1)}">{"".join(grp)}</g>'
                  for g, grp in enumerate(groups))
    mx, my = L.meteor
    return out + (f'<g transform="translate({f(mx)} {f(my)}) rotate(24)"><g class="f4-meteor">'
                  f'<rect x="-64" y="-0.6" width="64" height="1.2" rx="0.6" fill="url(#f4Meteor)"></rect>'
                  f'<circle r="1.3" fill="#fffaf0"></circle></g></g>')


def ground9(L, h, uid):
    """The bank in front of the bridge: lighter where it meets the
    bridge's foot, darkening toward the viewer; on the desk, where a
    wide band of it shows, a few low tussocks across it."""
    g = h['ground']
    out = [f'<linearGradient id="{uid}Ground" x1="0" y1="{f(L.ground)}" x2="0" y2="{f(L.H)}" gradientUnits="userSpaceOnUse">'
           f'<stop offset="0" stop-color="{mix(g, h["hill_near"], 0.45)}"></stop><stop offset="0.3" stop-color="{g}"></stop>'
           f'<stop offset="1" stop-color="{mix(g, "#000000", 0.35)}"></stop></linearGradient>',
           f'<rect y="{f(L.ground)}" width="{L.W}" height="{f(L.H - L.ground)}" fill="url(#{uid}Ground)"></rect>']
    if L.W > 600:
        rng = random.Random(L.seed + 141)
        d = []
        for _ in range(40):
            x = rng.uniform(0, L.W)
            y = rng.uniform(L.ground + 24, L.H - 6)
            k = 0.6 + 0.6 * (y - L.ground) / (L.H - L.ground)
            for _ in range(rng.randint(3, 6)):
                a = rng.uniform(-0.8, 0.8)
                ln = rng.uniform(3, 8) * k
                bx = x + rng.uniform(-3, 3) * k
                d.append(f'M{f(bx)} {f(y)}Q{f(bx + math.sin(a) * ln * 0.3)} {f(y - ln * 0.6)} {f(bx + math.sin(a) * ln)} {f(y - ln * math.cos(a * 0.6))}')
        out.append(f'<path d="{"".join(d)}" fill="none" stroke="{mix(g, h["stem"], 0.6)}" stroke-width="0.75" stroke-linecap="round" opacity="0.9"></path>')
    return ''.join(out)


def scene(L, hour, uid='f9', with_disc=True):
    h = HOURS[hour]
    s = SEA[hour]
    x0, ys, yb, hb = L.fuji
    fj = Fuji(x0, ys, yb, hb)
    far, near = ridges(L)
    birds_svg = birds(L, h)
    fleet_ = fleet(L, h)
    y0, y1 = L.water
    horizon_sky = h['sky'][-1][1]
    fk = (L.W / 390) ** 0.4
    gust_ = gust
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
'''
    back = f'''      <g class="f5-clouds">{clouds(L, hour)}</g>
      {birds_svg if h['birds'] == 'cranes' else ''}
      {disc(L, h, uid) if with_disc else ''}
      {fuji_svg(fj, h['fuji'], uid=uid + 'Fj', seed=L.seed)}
      {fog(L, s, 0)}
      {hills_far(L, h, s, far)}
      {fog(L, s, 1)}
      {hills_near(L, h, s, near)}
      {village(L, h, s)}
      {smoke6(L, h)}
      {fog(L, s, 2)}
      {water(L, h, s, far, near, hour, [], grouped=True)}
      <g clip-path="url(#f6Bay)">{reflections7(fleet_, hour, uid, anim, grouped=True)}</g>
      {boats7(fleet_, s, hour, uid, anim)}
      {seawall(L, s)}
      {birds_svg if h['birds'] in ('gulls', 'geese') else ''}
      {catenary7(L, h, hour, L.mast0)}'''
    train, run = train8(L, h, s, hour, uid)
    front = f'''{bridge7(L, s, h, hour, uid)}
      <rect y="{f(L.ground)}" width="{L.W}" height="{f(L.H - L.ground)}" fill="{h['ground']}"></rect>
      <path d="M-10 {f(L.ground + 4)} C{f(L.W * 0.15)} {f(L.ground - 4)} {f(L.W * 0.3)} {f(L.ground + 6)} {f(L.W * 0.5)} {f(L.ground)} S{f(L.W * 0.82)} {f(L.ground + 4)} {L.W + 10} {f(L.ground - 2)} L{L.W + 10} {f(L.ground + 12)} L-10 {f(L.ground + 12)} Z" fill="{h['ground']}"></path>
      {ground9(L, h, uid)}
      {grass7(L, h)}
      {pine7(L, h, hour, gust_, BOUGHS8)}
      {cosmos7(L, h, hour, gust_, anim)}
      {susuki7(L, h, hour, gust_, anim)}
      {leaves(L, h)}
'''
    return sky, back, train, front, run
