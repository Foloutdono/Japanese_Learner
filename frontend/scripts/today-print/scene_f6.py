"""F⁵ · the print, reviewed. The lower part of the print recomposed so
every layer has its own room, far to near:

  the hills, wooded along their ridges and shaded the way the prints
  shade them (bokashi: the ink strongest at the ridge, fading into the
  mist at the foot), the far range paler; fog lying in soft banks, one
  over Fuji's foot, one between the ranges, one on the far shore;
  the bay, in perspective: lighter under the far shore where it holds
  the sky, darker toward the viewer; the hills' reflection soft and
  fading; rows of small waves that open out toward the viewer; the
  light's road built on those same rows; glints that catch on them;
  each boat over its own reflection;
  the near shore: a stone sea wall, wet where the water laps it;
  the viaduct, a stone bridge: its parapet catching the light, the
  deck's shadow, arches ringed in voussoirs over openings in shade;
  the train on it.

The water ends at the sea wall above the train's roof, and everything
on the water is clipped to the water, so nothing of it ever shows
between the cars or behind the bridge. Transform and opacity only;
under reduced motion the still print."""
import math
import random
from dataclasses import dataclass, field
from geo import f
from fuji import Fuji, fuji_svg
from scene_f3 import stops, smooth
from scene_f4 import stars, disc, pine, anim
from scene_f5 import HOURS, Layout5, clouds, cloud_defs, susuki, cosmos, leaves, birds


def mix(a, b, t):
    a = [int(a[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(x + (y - x) * t):02x}' for x, y in zip(a, b))


SEA = {
    # the bay's own inks: its far edge (the sky in it) and its near edge,
    # the waves' light, the sea wall and its wet top, the shade under the
    # arches, the stone's lit edge, the fog (near, far)
    'dawn': dict(far='#b48ca2', near='#3f3858', wave='#ffd9c4', wall='#24202f', wet='#f0b8a2',
                 shade=('#121019', '#29243a'), lit='#5a4a63', fog=('#f8d6c8', '#efc4bc'), village=0),
    'day': dict(far='#b2cfe6', near='#2f6496', wave='#ffffff', wall='#4f453e', wet='#e7f2fa',
                shade=('#1c2420', '#33443a'), lit='#8f8074', fog=('#f4f7f9', '#e6edf2'), village=0),
    'dusk': dict(far='#9a8ea6', near='#222d46', wave='#f6d3bb', wall='#121a28', wet='#e9b79c',
                 shade=('#080d16', '#172235'), lit='#3a4560', fog=('#ebc6b9', '#c9adb8'), village=6),
    'night': dict(far='#3a5680', near='#0f1a30', wave='#c9d7ec', wall='#0a111d', wet='#9fb6d6',
                  shade=('#05080f', '#0d1626'), lit='#26354f', fog=('#6c80a6', '#56698f'), village=14),
}


@dataclass
class Layout6(Layout5):
    wall: tuple = (0, 0)                        # the sea wall's top, and its foot (the bridge's deck)
    fog: list = field(default_factory=list)     # (x, y, w, h, colour, opacity, layer)
    rows: int = 9                               # the bay's rows of waves


# ── the land ──────────────────────────────────────────────────────

def ridges(L):
    W = L.W
    far_y, near_y = L.hills

    def ridge(y0, amp, n, seed):
        r = random.Random(seed)
        return [(-20 + (W + 40) * k / n, y0 + r.uniform(-amp, amp)) for k in range(n + 1)]
    return ridge(far_y, 9, max(4, W // 80), L.seed + 1), ridge(near_y, 5, max(5, W // 60), L.seed + 2)


def ridge_y(pts, x):
    """The ridge's height at x, on the curve smooth() draws through it."""
    for i in range(len(pts) - 1):
        (x1, y1), (x2, y2) = pts[i], pts[i + 1]
        if x1 <= x <= x2:
            p0 = pts[i - 1] if i else pts[i]
            p3 = pts[i + 2] if i + 2 < len(pts) else pts[i + 1]
            c1, c2 = y1 + (y2 - p0[1]) / 6, y2 - (p3[1] - y1) / 6
            t = (x - x1) / (x2 - x1)
            u = 1 - t
            return u ** 3 * y1 + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t ** 3 * y2
    return pts[-1][1]


def trees(pts, W, rng, r0, r1, step, cedars=0.0):
    """The ridge's woods: rounded crowns of uneven size standing along
    it, here in a clump, there a clearing, and now and then a cedar
    (杉) standing above the rest."""
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
            out.append(f'<path d="M{f(x - wd / 2)} {f(y + 1)} Q{f(x - wd * 0.28)} {f(y - ht * 0.55)} {f(x)} {f(y - ht)} '
                       f'Q{f(x + wd * 0.28)} {f(y - ht * 0.55)} {f(x + wd / 2)} {f(y + 1)} Z"></path>')
        else:
            for _ in range(1 if rng.random() < 0.7 else rng.randint(2, 3)):
                r = rng.uniform(r0, r1) * (1.35 if rng.random() < 0.12 else 1)
                cx = x + rng.uniform(-0.6, 0.6) * r
                out.append(f'<circle cx="{f(cx)}" cy="{f(ridge_y(pts, cx) + r * rng.uniform(0.3, 0.7))}" r="{f(r)}"></circle>')
        x += step * rng.uniform(0.55, 1.3)
    return ''.join(out)


def hills_far(L, h, s, far):
    close = f' L{L.W + 20} {f(L.water[0] + 4)} L-20 {f(L.water[0] + 4)} Z'
    k = (L.W / 390) ** 0.5
    rng = random.Random(L.seed + 71)
    return (f'<path d="{smooth(far) + close}" fill="url(#f6HillFar)"></path>'
            f'<g fill="url(#f6HillFar)">{trees(far, L.W, rng, 1.1 * k, 2.4 * k, 4.6 * k, cedars=0.07)}</g>')


def hills_near(L, h, s, near):
    wt = L.water[0]
    close = f' L{L.W + 20} {f(wt + 4)} L-20 {f(wt + 4)} Z'
    k = (L.W / 390) ** 0.5
    rng = random.Random(L.seed + 72)
    lights = ''
    if s['village']:
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
            f'<g fill="url(#f6HillNear)">{trees(near, L.W, rng, 1.5 * k, 3.4 * k, 6 * k, cedars=0.04)}</g>'
            f'{lights}')


def fog(L, s, layer):
    """Fog lying in banks: each bank three soft masses run together,
    feathered, drifting, a little thicker, a little thinner."""
    out = []
    rng = random.Random(L.seed + 81 + layer)
    for x, y, w, hh, which, op, lay in L.fog:
        if lay != layer:
            continue
        masses = [(x, y, w, hh),
                  (x + w * rng.uniform(0.08, 0.22), y - hh * 0.38, w * rng.uniform(0.45, 0.6), hh * 0.72),
                  (x + w * rng.uniform(0.4, 0.55), y + hh * 0.18, w * rng.uniform(0.38, 0.5), hh * 0.62)]
        rects = ''.join(f'<rect x="{f(mx)}" y="{f(my)}" width="{f(mw)}" height="{f(mh)}" rx="{f(mh / 2)}"></rect>'
                        for mx, my, mw, mh in masses)
        out.append(f'<g class="f6-fog" style="--fx: {f(rng.uniform(8, 16) * (L.W / 390) ** 0.5 * rng.choice((1, -1)))}px; '
                   f'{anim(rng.uniform(22, 34), rng.uniform(0, 22))}">'
                   f'<g class="f6-fog-breathe" style="{anim(rng.uniform(9, 14), rng.uniform(0, 9))}">'
                   f'<g fill="{s["fog"][which]}" opacity="{f(op)}" filter="url(#f6Feather)">{rects}</g></g></g>')
    return ''.join(out)


# ── the bay ───────────────────────────────────────────────────────

def bay_rows(L):
    """The rows the water's surface is drawn in: close together under
    the far shore, opening out toward the viewer."""
    y0, y1 = L.water
    depth = y1 - y0
    return [(y0 + 2.5 + (depth - 5.5) * ((i + 1) / L.rows) ** 1.45, (i + 1) / L.rows) for i in range(L.rows)]


def fleet(L, h):
    """The hour's boats, each with the drift its hull and its reflection
    share, so the two move together."""
    kind = h['boat']
    rng = random.Random(L.seed + 17)
    if kind in ('sails', 'isaribi'):
        spots = L.boats
    elif kind == 'fisher':
        spots = L.lone_boats[:1]
    elif kind == 'sail_dark':
        spots = L.lone_boats[1:2]
    else:
        spots = []
    out = []
    for x, y, sc in spots:
        if kind == 'sails':
            drift = rng.uniform(16, 30)
        elif kind == 'isaribi':
            drift = rng.uniform(6, 12)
        else:
            drift = 34 if kind == 'fisher' else -30
        dur = rng.uniform(40, 56)
        out.append(dict(kind=kind, x=x, y=y, sc=sc, drift=drift * sc, dur=dur, d0=rng.uniform(0, dur), seed=rng.random()))
    return out


HULL = {
    'sails': '<path d="M-9 0 L9 0 L6 3 L-6 3 Z" fill="#1d2b3a"></path><path d="M0 0 L0 -15" stroke="#1d2b3a" stroke-width="0.8"></path>',
    'isaribi': ('<path d="M-8 0 L8 0 L5.5 2.6 L-5.5 2.6 Z" fill="#090d16"></path>'
                '<path d="M5 0 L8 -9" stroke="#090d16" stroke-width="0.8"></path>'),
    'fisher': '<path d="M-9 0 L9 0 L6 3 L-6 3 Z" fill="#1d1a2c"></path>',
    'sail_dark': ('<path d="M-9 0 L9 0 L6 3 L-6 3 Z" fill="#141c2c"></path><path d="M0 0 L0 -15" stroke="#141c2c" stroke-width="0.8"></path>'
                  '<path d="M0.6 -14.5 L7.5 -2 L0.6 -1.5 Z" fill="#2a3550"></path>'),
}
SAILS = '<path d="M0.6 -14.5 L7.5 -2 L0.6 -1.5 Z" fill="#fffdf6"></path><path d="M-0.6 -12 L-6 -2 L-0.6 -1.8 Z" fill="#f1ede2"></path>'
# a boat's reflection: its silhouette turned over at the waterline (y 2.6)
# and shortened, as still water shows it
MIRROR = 'translate(0 4.2) scale(1 -0.62)'


def boat_reflections(fleet_):
    out = []
    for b in fleet_:
        r = random.Random(b['seed'])
        kind = b['kind']
        if kind == 'sails':
            ink, op = HULL['sails'] + SAILS, 0.32
        elif kind == 'fisher':
            ink, op = HULL['fisher'] + '<path d="M-1.4 0 L-1.4 -8" stroke="#1d1a2c" stroke-width="1"></path><circle cx="-1.3" cy="-8.2" r="1.3" fill="#1d1a2c"></circle>', 0.4
        else:
            ink, op = HULL[kind], 0.4
        extra = ''
        if kind == 'isaribi':
            # the lantern's light on the water: a glow, and over it a broken
            # column of glints, each row swaying a beat after the one above
            rows = []
            for j in range(7):
                ly = 3.2 + j * 2.2
                sig = 0.7 + j * 0.42
                pieces = []
                for _ in range(2 if j < 3 else 3):
                    dx = r.gauss(0, sig)
                    ln = r.uniform(1.1, 2.4) + j * 0.3
                    pieces.append(f'<line class="f6-twinkle" x1="{f(8.4 + dx - ln / 2)}" y1="{f(ly)}" x2="{f(8.4 + dx + ln / 2)}" y2="{f(ly)}" '
                                  f'style="--o: {f(r.uniform(0.6, 1) * (1 - j * 0.08))}; {anim(r.uniform(1.1, 2.2), r.uniform(0, 2.2))}"></line>')
                rows.append(f'<g class="f6-road" style="--w: {f(0.35 + j * 0.25)}px; --o: 1; {anim(2.3, 2.3 - j * 0.3)}">{"".join(pieces)}</g>')
            extra = (f'<ellipse cx="8.4" cy="9" rx="3.4" ry="7.5" fill="#ffb54d" opacity="0.28" filter="url(#f6Haze)"></ellipse>'
                     f'<g stroke="#ffc46b" stroke-opacity="0.9" stroke-width="1" stroke-linecap="round">{"".join(rows)}</g>')
        out.append(f'<g class="f5-drift" style="--dx: {f(b["drift"])}px; {anim(b["dur"], b["d0"])}">'
                   f'<g transform="translate({f(b["x"])} {f(b["y"])}) scale({f(b["sc"])})">'
                   f'<g class="f6-wobble" style="{anim(r.uniform(1.7, 2.5), r.uniform(0, 2.5))}">'
                   f'<g transform="{MIRROR}" opacity="{f(op)}">{ink}</g></g>{extra}</g></g>')
    return ''.join(out)


def boats(fleet_, s):
    out = []
    for b in fleet_:
        r = random.Random(b['seed'] + 1)
        kind = b['kind']
        if kind == 'sails':
            wake = (f'<g class="f5-wake" style="{anim(2.8, r.uniform(0, 2.8))}"><path d="M-9 3.2 L-21 3.6 M-8 4.3 L-15 5" '
                    f'stroke="{s["wave"]}" stroke-width="0.8" stroke-linecap="round"></path></g>')
            sails = (f'<path class="f5-belly" d="M0.6 -14.5 L7.5 -2 L0.6 -1.5 Z" fill="#fffdf6" style="{anim(5.3, r.uniform(0, 5))}"></path>'
                     '<path d="M-0.6 -12 L-6 -2 L-0.6 -1.8 Z" fill="#f1ede2"></path>')
            inner = wake + HULL['sails'] + sails
        elif kind == 'isaribi':
            inner = (HULL['isaribi'] +
                     '<path d="M-3 0 L-3 -5 M-3 -5 L-1 -3" stroke="#090d16" stroke-width="1.1" stroke-linecap="round"></path>'
                     f'<circle class="f4-flame" cx="8.4" cy="-9.6" r="7" fill="url(#f6Isaribi)" style="{anim(r.uniform(0.9, 1.5), r.uniform(0, 1))}"></circle>'
                     '<circle cx="8.4" cy="-9.6" r="1.4" fill="#fff0c4"></circle>')
        elif kind == 'fisher':
            wake = (f'<g class="f5-wake" style="{anim(2.8, 1)}"><path d="M8 3 L19 3.4 M7 4.2 L13 4.9" stroke="{s["wave"]}" '
                    f'stroke-width="0.8" stroke-linecap="round"></path></g>')
            figure = (f'<g class="f5-row" style="{anim(2.4, 0)}"><path d="M-2 0 L-1.4 -7 M-1.4 -7 L4 -12" stroke="#1d1a2c" stroke-width="1" '
                      f'stroke-linecap="round"></path><circle cx="-1.3" cy="-8.2" r="1.3" fill="#1d1a2c"></circle></g>')
            inner = wake + HULL['fisher'] + figure
        else:
            inner = HULL['sail_dark']
        out.append(f'<g class="f5-drift" style="--dx: {f(b["drift"])}px; {anim(b["dur"], b["d0"])}">'
                   f'<g transform="translate({f(b["x"])} {f(b["y"])}) scale({f(b["sc"])})">'
                   f'<g class="f5-heave" style="{anim(r.uniform(3.1, 3.9), r.uniform(0, 3))}">'
                   f'<g class="f5-pitch" style="{anim(r.uniform(4.3, 5.7), r.uniform(0, 4))}">{inner}</g></g></g></g>')
    return ''.join(out)


def water(L, h, s, far, near, hour, fleet_, twinkle=1.0, grouped=False):
    """... `grouped`: the glints, the glitter and the road's glints twinkle in a
    few shared groups instead of one animation each: the same shimmer,
    for a fraction of the work per frame."""
    y0, y1 = L.water
    depth = y1 - y0
    rng = random.Random(L.seed + 13)
    k = (L.W / 390) ** 0.5
    rows = bay_rows(L)

    # the hills in the water: soft, shortened, fading toward the viewer
    def mirrored(pts, kk):
        return [(x, y0 + (y0 - y) * kk) for x, y in pts]
    far_m, near_m = mirrored(far, 0.55), mirrored(near, 0.55)
    refl = (f'<path d="M-20 {f(y0)} L{L.W + 20} {f(y0)} L{smooth(far_m[::-1])[1:]} Z" fill="{mix(h["hill_far"], s["far"], 0.35)}"></path>'
            f'<path d="M-20 {f(y0)} L{L.W + 20} {f(y0)} L{smooth(near_m[::-1])[1:]} Z" fill="{mix(h["hill_near"], s["far"], 0.25)}"></path>')
    band = (max(y for _, y in far_m) - y0) + 3
    strips = []
    for j in range(5):
        sy = y0 + j * band / 5
        strips.append(f'<clipPath id="f6Strip{j}"><rect x="-30" y="{f(sy)}" width="{L.W + 60}" height="{f(band / 5 + 0.8)}"></rect></clipPath>'
                      f'<g clip-path="url(#f6Strip{j})"><g class="f6-ripple" style="--r: {f(0.5 + j * 0.3)}px; {anim(4.4, 4.4 - j * 0.55)}">{refl}</g></g>')
    hills_in_water = f'<g mask="url(#f6ReflFade)"><g filter="url(#f6Smear)" opacity="0.8">{"".join(strips)}</g></g>'

    # the waves: on each row, crests drawn as shallow arcs of uneven
    # strength, longer and further apart toward the viewer; in the far
    # half, where the water holds the sky, the troughs between them too
    waves, troughs = [], []
    for i, (y, t) in enumerate(rows):
        crests = []
        x = rng.uniform(-30, 0)
        while x < L.W:
            ln = (4 + 20 * t) * rng.uniform(0.6, 1.3) * k
            bow = (0.25 + 0.8 * t) * rng.uniform(0.6, 1.2) * k
            op = '' if rng.random() < 0.5 else f' opacity="{f(rng.uniform(0.45, 0.9))}"'
            crests.append(f'<path d="M{f(x)} {f(y)} q{f(ln / 2)} {f(-bow)} {f(ln)} 0"{op}></path>')
            x += ln + (14 + 46 * t) * rng.uniform(0.6, 1.4) * k
        waves.append(f'<g class="f6-row" style="--d: {f((1.2 + 5 * t) * (1 if i % 2 else -1))}px; {anim(7 + 3 * t, rng.uniform(0, 7))}" '
                     f'stroke-opacity="{f(0.1 + 0.18 * t)}" stroke-width="{f((0.55 + 0.75 * t) * k)}">{"".join(crests)}</g>')
        if t < 0.65:
            gap = (rows[i + 1][0] - y) if i + 1 < len(rows) else 2
            dashes = []
            x = rng.uniform(-30, 0)
            while x < L.W:
                ln = (6 + 18 * t) * rng.uniform(0.6, 1.4) * k
                dashes.append(f'<line x1="{f(x)}" y1="{f(y + gap * 0.5)}" x2="{f(x + ln)}" y2="{f(y + gap * 0.5)}"></line>')
                x += ln + (10 + 30 * t) * rng.uniform(0.6, 1.4) * k
            troughs.append(f'<g class="f6-row" style="--d: {f((1 + 4 * t) * (-1 if i % 2 else 1))}px; {anim(8 + 3 * t, rng.uniform(0, 8))}">{"".join(dashes)}</g>')
    waves = (f'<g stroke="{s["near"]}" stroke-opacity="0.22" stroke-width="{f(0.7 * k)}" stroke-linecap="round">{"".join(troughs)}</g>'
             f'<g fill="none" stroke="{s["wave"]}" stroke-linecap="round">{"".join(waves)}</g>')

    # the light's road, built on the same rows: a soft cone of light on
    # the water, and over it glints scattered about the line under the
    # light, close together under the far shore, spreading and breaking
    # up toward the viewer; each row sways a beat after the one above,
    # each glint brightens and fades on its own; by day, glitter
    road_rows = list(rows)
    trng = random.Random(L.seed + 333)
    for (ya, ta), (yb, tb) in zip(rows, rows[1:]):
        if ta > 0.3:
            road_rows.append(((ya + yb) / 2, (ta + tb) / 2))
    road_rows.sort()
    cone = (f'<path d="M{f(L.cx - L.disc_r * 0.07)} {f(y0)} L{f(L.cx + L.disc_r * 0.07)} {f(y0)} '
            f'L{f(L.cx + L.disc_r * 0.42)} {f(y1)} L{f(L.cx - L.disc_r * 0.42)} {f(y1)} Z" '
            f'fill="url(#f6Cone)" opacity="{f(0.24 if hour in ("day", "dawn") else 0.17)}" filter="url(#f6Haze)"></path>')
    road = []
    for i, (y, t) in enumerate(road_rows):
        sigma = L.disc_r * (0.05 + 0.2 * t)
        row = []
        n = (3 + 6 * min(t, 0.75) - 4 * max(0.0, t - 0.75)) * k
        for _ in range(int(n) if hour != 'day' else int(n * 0.6)):
            dx = rng.gauss(0, sigma)
            ln = (1.6 + 6 * t) * rng.uniform(0.45, 1.35) * k
            op = max(0.22, math.exp(-0.5 * (dx / sigma) ** 2)) * rng.uniform(0.7, 1)
            yy = y + rng.uniform(-0.3, 0.3) * (1 + t)
            dur, delay = rng.uniform(1.3, 2.8), rng.uniform(0, 2.8)
            if grouped:
                row.append((len(row) % 2, dur, delay, f'<line x1="{f(L.cx + dx - ln / 2)}" y1="{f(yy)}" x2="{f(L.cx + dx + ln / 2)}" y2="{f(yy)}" opacity="{f(op)}"></line>'))
            elif twinkle >= 1 or trng.random() < twinkle:
                row.append(f'<line class="f6-twinkle" x1="{f(L.cx + dx - ln / 2)}" y1="{f(yy)}" x2="{f(L.cx + dx + ln / 2)}" y2="{f(yy)}" '
                           f'style="--o: {f(op)}; {anim(dur, delay)}"></line>')
            else:
                row.append(f'<line x1="{f(L.cx + dx - ln / 2)}" y1="{f(yy)}" x2="{f(L.cx + dx + ln / 2)}" y2="{f(yy)}" opacity="{f(op * 0.7)}"></line>')
        if grouped:
            parts = []
            for g in (0, 1):
                mine = [r_ for r_ in row if r_[0] == g]
                if mine:
                    parts.append(f'<g class="f6-twinkle" style="--o: 1; {anim(mine[0][1], mine[0][2])}">{"".join(r_[3] for r_ in mine)}</g>')
            row = parts
        road.append(f'<g class="f6-road" style="--w: {f((0.4 + 2.2 * t) * k)}px; --o: 1; {anim(2.9, 2.9 - (i * 0.24) % 2.9)}" '
                    f'stroke-width="{f((0.9 + 1.0 * t) * k)}">{"".join(row)}</g>')
    road = f'{cone}<g stroke="{h["refl"]}" stroke-opacity="{h["refl_op"]}" stroke-linecap="round">{"".join(road)}</g>'
    if hour == 'day':
        sparks = []
        for i, (y, t) in enumerate(rows):
            for _ in range(int((2 + 5 * t) * k)):
                x = rng.gauss(L.cx, L.disc_r * (0.1 + 0.3 * t))
                r = (0.9 + 1.6 * t) * k
                q = 0.28 * k
                d_ = (f'M{f(x)} {f(y - r)} L{f(x + q)} {f(y - q)} L{f(x + r)} {f(y)} '
                      f'L{f(x + q)} {f(y + q)} L{f(x)} {f(y + r)} L{f(x - q)} {f(y + q)} L{f(x - r)} {f(y)} '
                      f'L{f(x - q)} {f(y - q)} Z')
                timing = anim(rng.uniform(1.2, 2.6), rng.uniform(0, 2.6))
                sparks.append((d_, timing))
        if grouped:
            groups = [sparks[g::6] for g in range(6)]
            road += '<g fill="#ffffff">' + ''.join(f'<g class="f9-glitter" style="{grp[0][1]}"><path d="{"".join(d_ for d_, _ in grp)}"></path></g>'
                                                    for grp in groups if grp) + '</g>'
        else:
            road += '<g fill="#ffffff">' + ''.join(f'<path class="f6-glitter" d="{d_}" style="{timing}"></path>' for d_, timing in sparks) + '</g>'

    # glints that catch on the rows, most of them near the light
    glints = []
    for _ in range(int(16 * L.W / 390)):
        y, t = rows[rng.randrange(len(rows))]
        x = rng.gauss(L.cx, L.disc_r * 0.6) if rng.random() < 0.55 else rng.uniform(0, L.W)
        ln = (2 + 6 * t) * k
        glints.append((f'M{f(x)} {f(y)}L{f(x + ln)} {f(y)}', anim(rng.uniform(1.8, 3.6), rng.uniform(0, 3.6))))
    if grouped:
        glints = ''.join(f'<g class="f6-glint" style="{grp[0][1]}"><path d="{"".join(d_ for d_, _ in grp)}"></path></g>'
                         for grp in (glints[g::6] for g in range(6)) if grp)
    else:
        glints = ''.join(f'<line class="f6-glint" x1="{d_[1:].split("L")[0].split()[0]}" y1="{d_[1:].split("L")[0].split()[1]}" '
                         f'x2="{d_.split("L")[1].split()[0]}" y2="{d_.split("L")[1].split()[1]}" style="{timing}"></line>' for d_, timing in glints)
    glints = f'<g stroke="{h["glint"]}" stroke-width="{f(0.9 * k)}" stroke-linecap="round">{glints}</g>'

    # where the water laps the sea wall
    wl = []
    x = rng.uniform(-10, 0)
    while x < L.W:
        ln = rng.uniform(10, 30) * k
        wl.append(f'<line x1="{f(x)}" y1="{f(y1 - 0.7)}" x2="{f(x + ln)}" y2="{f(y1 - 0.7)}"></line>')
        x += ln + rng.uniform(4, 12) * k
    waterline = (f'<g class="f6-lap" style="{anim(3.2, 1)}" stroke="{s["wet"]}" stroke-opacity="0.5" stroke-width="{f(0.9 * k)}" '
                 f'stroke-linecap="round">{"".join(wl)}</g>')

    return (f'<g clip-path="url(#f6Bay)">'
            f'<rect y="{f(y0)}" width="{L.W}" height="{f(depth)}" fill="url(#f6BayInk)"></rect>'
            f'<rect y="{f(y0)}" width="{L.W}" height="{f(depth * 0.5)}" fill="url(#f6Sheen)"></rect>'
            f'{hills_in_water}{waves}{road}{glints}{boat_reflections(fleet_)}{waterline}</g>')


def village(L, h, s):
    """The village on the near shore: a few houses about each hearth,
    dark roofs over pale walls; at dusk and at night the walls are in
    shade and the windows lit (the lamps, in hills_near)."""
    roofs, walls = [], []
    rng = random.Random(L.seed + 61)
    k = (L.W / 390) ** 0.5
    for x, y in L.chimneys:
        for j in (-1, 1, 0):
            w = rng.uniform(6.5, 9) * k
            hh = rng.uniform(2.2, 3) * k
            rx = x + j * rng.uniform(8, 11) * k
            top = y + (0 if j == 0 else rng.uniform(1, 2.4) * k)
            roofs.append(f'<path d="M{f(rx - w / 2 - 0.6)} {f(top + hh)} L{f(rx - w / 2 + hh * 0.9)} {f(top)} '
                         f'L{f(rx + w / 2 - hh * 0.9)} {f(top)} L{f(rx + w / 2 + 0.6)} {f(top + hh)} Z"></path>')
            walls.append(f'<rect x="{f(rx - w / 2 + 0.8)}" y="{f(top + hh)}" width="{f(w - 1.6)}" height="{f(2 * k)}"></rect>')
    lit = s['village'] == 0
    wall = mix(h['mist'][0], h['hill_near'], 0.35) if lit else mix(h['hill_near'], '#000000', 0.15)
    return (f'<g fill="{wall}">{"".join(walls)}</g>'
            f'<g fill="{mix(h["hill_near"], "#000000", 0.38)}">{"".join(roofs)}</g>')


def smoke6(L, h):
    """Smoke from the hearths: thin puffs that rise, spread and thin out
    downwind."""
    if not h['smoke']:
        return ''
    out = []
    k = (L.W / 390) ** 0.5
    for x, y in L.chimneys:
        for j in range(6):
            out.append(f'<ellipse class="f6-puff" cx="{f(x)}" cy="{f(y - 0.5)}" rx="{f(2 * k)}" ry="{f(1.3 * k)}" style="{anim(9, j * 1.5)}"></ellipse>')
    return f'<g fill="{mix(h["mist"][0], h["hill_near"], 0.2)}" filter="url(#f6Puff)">{"".join(out)}</g>'


def train6(L, h, s):
    """The train as before, its roofs catching the hour's light so it
    stands off the sea wall behind it."""
    top = L.viaduct[0]
    y0, y1 = top - 14, top - 1
    cars, wins = [], []
    roof = mix(h['train'], s['wet'], 0.4)
    x = 0
    for k in range(L.cars):
        wdt = 60
        if k == L.cars - 1:
            body = f'M{x} {y0} H{x + wdt - 12} Q{x + wdt} {y0} {x + wdt + 2} {y1} H{x} Z'
        else:
            body = f'M{x} {y0} H{x + wdt} V{y1} H{x} Z'
        cars.append(f'<path d="{body}" fill="{h["train"]}"></path>')
        cars.append(f'<rect x="{x}" y="{y0}" width="{wdt - (12 if k == L.cars - 1 else 0)}" height="0.9" fill="{roof}"></rect>')
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


def seawall(L, s):
    """The near shore: a stone sea wall in two courses, its coping
    catching the light."""
    top, foot = L.wall
    rng = random.Random(L.seed + 91)
    k = (L.W / 390) ** 0.5
    mid = top + (foot - top) * 0.42
    joints = [f'<line x1="0" y1="{f(mid)}" x2="{L.W}" y2="{f(mid)}"></line>']
    for ya, yb, off in ((top + 1.2, mid, 0), (mid, foot, 0.5)):
        x = rng.uniform(0, 8) + off * 14 * k
        while x < L.W:
            joints.append(f'<line x1="{f(x)}" y1="{f(ya)}" x2="{f(x)}" y2="{f(yb)}"></line>')
            x += rng.uniform(11, 17) * k
    return (f'<rect y="{f(top)}" width="{L.W}" height="{f(foot - top)}" fill="{s["wall"]}"></rect>'
            f'<rect y="{f(top)}" width="{L.W}" height="1.2" fill="{s["lit"]}"></rect>'
            f'<g stroke="#000" stroke-opacity="0.4" stroke-width="0.8">{"".join(joints)}</g>')


# ── the bridge ─────────────────────────────────────────────────────

def bridge(L, s, h):
    """The viaduct as a stone bridge: a parapet catching the light, the
    deck and the shadow under it, arches ringed in voussoirs over
    openings in shade."""
    top, base = L.viaduct
    deck = top + 6
    span = 42 * (L.W / 390) ** 0.25
    half = span * 0.36
    spring = deck + 6 + half
    arches, rings = [], []
    x = -20
    while x < L.W + 20:
        a, b = x + span * 0.14, x + span * 0.86
        arches.append(f'<path d="M{f(a)} {f(base + 2)} V{f(spring)} A{f(half)} {f(half)} 0 0 1 {f(b)} {f(spring)} V{f(base + 2)} Z"></path>')
        rings.append(f'<path d="M{f(a - 1.7)} {f(spring)} A{f(half + 1.7)} {f(half + 1.7)} 0 0 1 {f(b + 1.7)} {f(spring)}"></path>')
        x += span
    return (f'<rect y="{f(top)}" width="{L.W}" height="{f(base - top)}" fill="{h["viaduct"]}"></rect>'
            f'<g fill="url(#f6Arch)">{"".join(arches)}</g>'
            f'<g fill="none" stroke="{s["lit"]}" stroke-width="2.6" stroke-dasharray="2.4 0.9" opacity="0.55">{"".join(rings)}</g>'
            f'<rect y="{f(top - 2)}" width="{L.W}" height="1.2" fill="{s["lit"]}"></rect>'
            f'<rect y="{f(deck)}" width="{L.W}" height="1.4" fill="#000" fill-opacity="0.4"></rect>')


# ── the print ─────────────────────────────────────────────────────

def scene(L, hour, uid='f6'):
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
    return f'''<defs>
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
        <filter id="f6Feather" x="-25%" y="-200%" width="150%" height="500%"><feGaussianBlur stdDeviation="{f(5 * fk)} {f(2.4 * fk)}"></feGaussianBlur></filter>
        <filter id="f6Haze" x="-50%" y="-30%" width="200%" height="160%"><feGaussianBlur stdDeviation="{f(3.5 * fk)} {f(2 * fk)}"></feGaussianBlur></filter>
        <filter id="f6Puff" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="{f(0.9 * fk)}"></feGaussianBlur></filter>
        <filter id="f6Smear" x="-5%" y="-30%" width="110%" height="160%"><feGaussianBlur stdDeviation="0.6 1.2"></feGaussianBlur></filter>
      </defs>
      <rect width="{L.W}" height="{f(L.horizon + 12)}" fill="url(#f4Sky)"></rect>
      <rect width="{L.W}" height="{f(L.H * 0.11)}" fill="url(#f4Band)"></rect>
      <g class="f4-stars">{stars(L, h)}</g>
      <rect width="{L.W}" height="{f(L.horizon + 12)}" filter="url(#f4Grain)"></rect>
      <g class="f5-clouds">{clouds(L, hour)}</g>
      {birds_svg if h['birds'] == 'cranes' else ''}
      {disc(L, h, uid)}
      {fuji_svg(fj, h['fuji'], uid=uid + 'Fj', seed=L.seed)}
      {fog(L, s, 0)}
      {hills_far(L, h, s, far)}
      {fog(L, s, 1)}
      {hills_near(L, h, s, near)}
      {village(L, h, s)}
      {smoke6(L, h)}
      {fog(L, s, 2)}
      {water(L, h, s, far, near, hour, fleet_)}
      {boats(fleet_, s)}
      {seawall(L, s)}
      {birds_svg if h['birds'] in ('gulls', 'geese') else ''}
      {train6(L, h, s)}
      {bridge(L, s, h)}
      <rect y="{f(L.ground)}" width="{L.W}" height="{f(L.H - L.ground)}" fill="{h['ground']}"></rect>
      <path d="M-10 {f(L.ground + 4)} C{f(L.W * 0.15)} {f(L.ground - 4)} {f(L.W * 0.3)} {f(L.ground + 6)} {f(L.W * 0.5)} {f(L.ground)} S{f(L.W * 0.82)} {f(L.ground + 4)} {L.W + 10} {f(L.ground - 2)} L{L.W + 10} {f(L.ground + 12)} L-10 {f(L.ground + 12)} Z" fill="{h['ground']}"></path>
      {pine(L, h)}
      {cosmos(L, h)}
      {susuki(L, h)}
      {leaves(L, h)}
      <rect width="{L.W}" height="{L.H}" filter="url(#f4Paper)"></rect>'''
