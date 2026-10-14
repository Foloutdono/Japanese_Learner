"""F⁶ · the print's foreground and its traffic, redrawn: the pine, the
boats, the train and its bridge, the flowers.

- The pine (黒松) is drawn the way the prints draw one: a gnarled trunk
  that tapers as it climbs, its bark in scales, lit along one edge;
  angular branches; the foliage in flat tiers, each tier built of tufts
  of needles fanning out from their shoots, light along the top, dark
  under. Each bough sways with the gust a beat after the one below.
- The boats are Japanese boats (和船): a low hull with an upswept bow;
  by day and at dusk a square sail of cloth strips hung from a yard,
  bellied by the wind; at dawn a man sculling with the long oar (櫓)
  under a sedge hat; at night a fishing boat with its fire basket (篝火)
  and the fisherman lit by it.
- The train is a bullet train: noses at both ends, the window band and
  the skirt in blue, doors, the bellows between the cars, pantographs
  under the overhead line; the bridge is stone: a parapet, a cornice,
  coursed ashlar, arches ringed in voussoirs with a keystone, imposts.
- The flowers: cosmos with toothed petals shaded from the heart out,
  heads turned every way, buds and thread leaves; pampas grass with
  arching blades and plumes of silk.
"""
import math
import random
from geo import f


def mix(a, b, t):
    a = [int(a[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(x + (y - x) * t):02x}' for x, y in zip(a, b))


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


def resample(spine, step):
    """Points every `step` along a polyline of (x, y, w), widths
    interpolated."""
    out = [spine[0]]
    for (x0, y0, w0), (x1, y1, w1) in zip(spine, spine[1:]):
        ln = math.hypot(x1 - x0, y1 - y0)
        n = max(1, int(ln / step))
        for k in range(1, n + 1):
            t = k / n
            out.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w0 + (w1 - w0) * t))
    return out


def normals(pts):
    out = []
    for i, p in enumerate(pts):
        a = pts[max(0, i - 1)]
        b = pts[min(len(pts) - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy) or 1
        out.append((-dy / ln, dx / ln, dx / ln, dy / ln))   # normal (to the right of travel), tangent
    return out


def limb(spine, rng, wobble=0.0, tip='round'):
    """A tapered limb along a spine of (x, y, width): its outline as one
    closed path, the two sides smoothed, the far end rounded."""
    pts = resample(spine, 5)
    ns = normals(pts)
    left, right = [], []
    for (x, y, w), (nx, ny, _, _) in zip(pts, ns):
        a = w / 2 * (1 + rng.uniform(-wobble, wobble))
        b = w / 2 * (1 + rng.uniform(-wobble, wobble))
        left.append((x - nx * a, y - ny * a))
        right.append((x + nx * b, y + ny * b))
    x, y, w = pts[-1]
    _, _, tx, ty = ns[-1]
    cap = f' Q{f(x + tx * w * 0.9)} {f(y + ty * w * 0.9)} {f(right[-1][0])} {f(right[-1][1])}'
    return smooth(left) + cap + ' L' + smooth(right[::-1])[1:] + ' Z'


def lit_band(spine, rng, side=1, a=0.12, b=0.48):
    """The lit edge of a limb: a band along one side, from a to b of its
    half-width."""
    pts = resample(spine, 5)
    ns = normals(pts)
    inner, outer = [], []
    for (x, y, w), (nx, ny, _, _) in zip(pts, ns):
        inner.append((x + side * nx * w * a, y + side * ny * w * a))
        outer.append((x + side * nx * w * b * rng.uniform(0.9, 1.0), y + side * ny * w * b * rng.uniform(0.9, 1.0)))
    return smooth(inner) + ' L' + smooth(outer[::-1])[1:] + ' Z'


# ── the pine ──────────────────────────────────────────────────────

PINE = {
    # trunk, its lit edge, the bark's fissures; the needles: the tier's
    # mass, the tufts inside it, the tufts along its top, the brightest
    'dawn': dict(trunk='#1f1924', trunk_lit='#5a4150', bark='#0d0a11', fleck='#6b5060',
                 mass='#120f1a', tuft='#1b1827', top='#28243a', hi='#3a3350'),
    'day': dict(trunk='#3b3330', trunk_lit='#7f7062', bark='#1d1715', fleck='#9a8a78',
                mass='#14241a', tuft='#1d3325', top='#2f4d35', hi='#4f7048'),
    'dusk': dict(trunk='#161b1f', trunk_lit='#58464a', bark='#090c0f', fleck='#6a5458',
                 mass='#0b1411', tuft='#111e19', top='#1b2d26', hi='#2a3e36'),
    'night': dict(trunk='#0d1216', trunk_lit='#2b384a', bark='#05080b', fleck='#33425a',
                  mass='#070d0c', tuft='#0c1615', top='#122020', hi='#1b2c30'),
}

# drawn for a 746-high frame with its foot at the frame's foot
TRUNK = [(18, 772, 34), (22, 740, 29), (28, 708, 25), (36, 678, 22), (42, 652, 19.5), (45, 628, 18),
         (50, 604, 16.5), (58, 582, 15), (68, 560, 13.5), (77, 538, 12), (85, 518, 10.5), (93, 501, 9),
         (100, 487, 7.5), (107, 475, 6)]
# each bough: the branch's spine from the trunk, then its tier of needles
# (cx, cy, width, height); listed back to front
BOUGHS = [
    ([(103, 481, 6), (110, 473, 4.6), (118, 468, 3.6)], (118, 466, 72, 21)),
    ([(92, 503, 7), (98, 498, 5.4), (104, 494, 4)], (94, 493, 94, 23)),
    ([(84, 521, 7.5), (72, 523, 6), (60, 518, 4.6), (47, 514, 3.6), (36, 509, 2.8)], (30, 507, 62, 19)),
    ([(72, 553, 8), (86, 556, 6.4), (102, 551, 5), (118, 542, 3.8), (130, 537, 3)], (138, 531, 70, 19)),
    ([(52, 598, 8), (42, 590, 6.2), (34, 578, 4.6), (32, 568, 3.6)], (40, 563, 56, 17)),
]


def tier(cx, cy, w, hh, rng):
    """A tier of foliage: its top a run of rounded lobes, its underside
    nearly flat; returned as the outline and the two edges, sampled."""
    n = max(3, round(w / 15))
    lobes = [((k + rng.uniform(0.3, 0.7)) / n, (1 / n) * rng.uniform(0.65, 0.9), rng.uniform(0.5, 0.95)) for k in range(n)]
    m = 56
    top, bottom = [], []
    for i in range(m + 1):
        t = i / m
        ht = 0.0
        for c, wd, a in lobes:
            u = (t - c) / wd
            if abs(u) < 1:
                ht = max(ht, a * math.sqrt(1 - u * u))
        end = math.sqrt(max(0.0, 1 - (2 * t - 1) ** 4))
        x = cx - w / 2 + t * w
        top.append((x, cy + hh * 0.28 - max(ht, 0.32) * end * hh))
        bottom.append((x, cy + hh * 0.28 + 0.1 * hh * math.sin(t * 9.4 + 1.3) * end))
    outline = smooth(top) + ' L' + smooth(bottom[::-1])[1:] + ' Z'
    return outline, top, bottom


def fan(cx, cy, ang, r, rng, spread=2.1, n=7):
    """A tuft of needles fanning out from its shoot."""
    out = []
    for j in range(n):
        a = ang + (j / (n - 1) - 0.5) * spread + rng.uniform(-0.08, 0.08)
        r0, r1 = r * 0.18, r * rng.uniform(0.72, 1.05)
        out.append(f'M{f(cx + math.cos(a) * r0)} {f(cy + math.sin(a) * r0)}L{f(cx + math.cos(a) * r1)} {f(cy + math.sin(a) * r1)}')
    return ''.join(out)


def needles(cx, cy, w, hh, rng, r=3.4):
    """The tier's needles in four inks: tufts through its mass, tufts
    along its top, the brightest on its crests, and a fringe under it."""
    outline, top, bottom = tier(cx, cy, w, hh, rng)
    inner, upper, crest, under = [], [], [], []
    hi_y = min(y for _, y in top)
    # along the top: a tuft every ~r*0.8, fanning outward
    for i in range(1, len(top) - 1, 1):
        (x0, y0), (x1, y1) = top[i - 1], top[i + 1]
        tx, ty = x1 - x0, y1 - y0
        # the outward normal of a left-to-right edge points up: (ty, -tx)
        nx, ny = ty, -tx
        ln = math.hypot(nx, ny) or 1
        ang = math.atan2(ny / ln, nx / ln)
        x, y = top[i]
        for _ in range(2):
            px = x + rng.uniform(-1.2, 1.2)
            py = y + rng.uniform(0.2, 1.6)
            a = ang + rng.uniform(-0.25, 0.25)
            d = fan(px, py, a, r * rng.uniform(0.85, 1.1), rng)
            if y < hi_y + hh * 0.22 and rng.random() < 0.55:
                crest.append(d)
            else:
                upper.append(d)
    # through the mass: tufts pointing up and out
    k = int(w * hh / (r * r * 1.1))
    for _ in range(k):
        t = rng.uniform(0.04, 0.96)
        i = int(t * (len(top) - 1))
        ya, yb = top[i][1], bottom[i][1]
        if yb - ya < 2:
            continue
        x = top[i][0]
        y = rng.uniform(ya + 2, yb - 0.5)
        ang = -math.pi / 2 + (t - 0.5) * 1.4 + rng.uniform(-0.35, 0.35)
        inner.append(fan(x, y, ang, r * rng.uniform(0.75, 1.0), rng))
    # under: a fringe hanging from the underside
    for i in range(3, len(bottom) - 3, 3):
        x, y = bottom[i]
        under.append(fan(x + rng.uniform(-1, 1), y - 0.8, math.pi / 2 + rng.uniform(-0.3, 0.3), r * 0.45, rng, spread=1.4, n=4))
    return outline, ''.join(inner), ''.join(upper), ''.join(crest), ''.join(under)


def bark(spine, rng):
    """The bark of a black pine: plates split by fissures that run up
    the trunk, now and then a scale across them; returned as the
    fissures and the flecks of light on the plates of the lit side."""
    pts = resample(spine, 2.6)
    ns = normals(pts)
    cracks, flecks = [], []
    for i, ((x, y, w), (nx, ny, tx, ty)) in enumerate(zip(pts, ns)):
        for _ in range(2 if w > 14 else 1):
            if rng.random() < 0.45:
                continue
            off = rng.uniform(-0.38, 0.38) * w
            cx, cy = x + nx * off, y + ny * off
            if rng.random() < 0.7:
                # a fissure along the trunk, wavering
                ln = w * rng.uniform(0.22, 0.5)
                bend = rng.uniform(-0.6, 0.6)
                cracks.append(f'M{f(cx)} {f(cy)}Q{f(cx + tx * ln * 0.5 + nx * bend)} {f(cy + ty * ln * 0.5 + ny * bend)} '
                              f'{f(cx + tx * ln + nx * bend * 0.4)} {f(cy + ty * ln + ny * bend * 0.4)}')
            else:
                # a scale across it
                half = w * rng.uniform(0.07, 0.13)
                cracks.append(f'M{f(cx - nx * half)} {f(cy - ny * half)}Q{f(cx + tx * half)} {f(cy + ty * half)} {f(cx + nx * half)} {f(cy + ny * half)}')
            if off > w * 0.1 and rng.random() < 0.35:
                flecks.append(f'M{f(cx + tx * 0.6)} {f(cy + ty * 0.6)}l{f(tx * w * 0.12)} {f(ty * w * 0.12)}')
    return ''.join(cracks), ''.join(flecks)


def pine7(L, h, hour, gust, boughs_=None):
    """The pine at the left of the print, framing it; its boughs where
    `boughs_` puts them (F⁶'s by default)."""
    px, py, s = L.pine
    c = PINE[hour]
    rng = random.Random(11)
    k = 1.0
    trunk = limb(TRUNK, rng, wobble=0.12)
    trunk_lit = lit_band(TRUNK, rng, side=1, a=0.14, b=0.47)
    cracks, flecks = bark(TRUNK, rng)
    boughs = []
    for spine, (cx, cy, w, hh) in (boughs_ or BOUGHS):
        branch = limb(spine, rng, wobble=0.15)
        branch_lit = lit_band(spine, rng, side=-1 if spine[-1][0] < spine[0][0] else 1, a=0.05, b=0.46)
        outline, inner, upper, crest, under = needles(cx, cy, w, hh, rng)
        ax, ay = spine[0][0], spine[0][1]
        boughs.append(
            f'<g class="f5-gust" style="transform-origin: {f(ax)}px {f(ay)}px; --a: {f(rng.uniform(0.5, 0.9))}deg; {gust(px + ax * s, L.W)}">'
            f'<path d="{branch}" fill="{c["trunk"]}"></path>'
            f'<path d="{branch_lit}" fill="{c["trunk_lit"]}" opacity="0.5"></path>'
            f'<path d="{outline}" fill="{c["mass"]}"></path>'
            f'<path d="{under}" fill="none" stroke="{c["mass"]}" stroke-width="0.55" stroke-linecap="round"></path>'
            f'<path d="{inner}" fill="none" stroke="{c["tuft"]}" stroke-width="0.5" stroke-linecap="round"></path>'
            f'<path d="{upper}" fill="none" stroke="{c["top"]}" stroke-width="0.55" stroke-linecap="round"></path>'
            f'<path d="{crest}" fill="none" stroke="{c["hi"]}" stroke-width="0.55" stroke-linecap="round"></path></g>')
    return (f'<g class="f7-pine" transform="translate({f(px)} {f(py - 746 * s)}) scale({f(s)})">'
            f'<g class="f5-gust" style="transform-origin: 22px 746px; --a: 0.25deg; {gust(px, L.W)}">'
            f'<path d="{trunk}" fill="{c["trunk"]}"></path>'
            f'<path d="{trunk_lit}" fill="{c["trunk_lit"]}" opacity="0.55"></path>'
            f'<path d="{cracks}" fill="none" stroke="{c["bark"]}" stroke-width="0.6" stroke-linecap="round" opacity="0.7"></path>'
            f'<path d="{flecks}" fill="none" stroke="{c["fleck"]}" stroke-width="0.7" stroke-linecap="round" opacity="0.5"></path>'
            f'{"".join(boughs)}</g></g>')


# ── the boats (和船) ────────────────────────────────────────────────

BOAT = {
    # hull, its wale (the rail along the sheer), the sail, its shaded
    # side, its seams, a rim of light, the people
    'day': dict(hull='#2c2521', wale='#76624f', sail='#fffaf0', sail_shade='#ddd1b6', seam='#c4b593', rim='', man='#2c2521'),
    'dusk': dict(hull='#121a28', wale='#2b3549', sail='#2a3550', sail_shade='#1e2840', seam='#3a4664', rim='#eab89c', man='#121a28'),
    'dawn': dict(hull='#1d1a2c', wale='#3d3550', sail='#2e2a40', sail_shade='#24203a', seam='#3e3852', rim='#f0b39a', man='#1d1a2c'),
    'night': dict(hull='#080c15', wale='#1b2333', sail='#10172a', sail_shade='#0c1222', seam='#1b2438', rim='#ff9a3c', man='#080c15'),
}


def hull_path(ln=12, bow=4.4):
    """A wasen's hull in profile, bow to the right: a long low sheer
    sweeping up into the stem, a flat bottom, a square stern."""
    return (f'M{-ln} -1.4 C{f(-ln * 0.58)} -0.2 {f(ln * 0.25)} -0.1 {f(ln * 0.72)} -1.1 '
            f'C{f(ln * 0.85)} -1.6 {f(ln * 0.95)} {f(-bow * 0.6)} {f(ln * 1.05)} {f(-bow)} '
            f'L{f(ln * 1.01)} {f(-bow)} C{f(ln * 0.95)} {f(-bow * 0.45)} {f(ln * 0.88)} 0.6 {f(ln * 0.73)} 2.6 '
            f'L{f(-ln * 0.73)} 2.8 C{f(-ln * 0.87)} 2.2 {f(-ln * 0.97)} 0.8 {-ln} -1.4 Z')


def sheer_path(ln=12, bow=4.4):
    return (f'M{-ln} -1.4 C{f(-ln * 0.58)} -0.2 {f(ln * 0.25)} -0.1 {f(ln * 0.72)} -1.1 '
            f'C{f(ln * 0.85)} -1.6 {f(ln * 0.95)} {f(-bow * 0.6)} {f(ln * 1.05)} {f(-bow)}')


def square_sail(c, uid, belly=True):
    """A square sail of cloth strips hung from its yard, bellied by the
    wind, the strips' seams bowing with it."""
    top, foot, l, r = -20.6, -4.6, -6.8, 8.8
    seams = []
    for j in range(1, 6):
        xt = l + (r - l) * j / 6
        xc = xt + (j / 6 - 0.5) * 3.2
        seams.append(f'M{f(xt)} {top}Q{f(xc)} -12.6 {f(xt + (j / 6 - 0.5) * 0.4)} {foot}')
    outline = f'M{l} {top}L{r} {top}Q{f(r + 1.8)} -12.6 {f(r + 0.4)} {foot}L{f(l + 0.2)} {foot}Q{f(l - 1.6)} -12.6 {l} {top}Z'
    rim = (f'<path d="M{r} {top}Q{f(r + 1.8)} -12.6 {f(r + 0.4)} {foot}" fill="none" stroke="{c["rim"]}" stroke-width="0.55" opacity="0.75"></path>'
           if c['rim'] else '')
    return (f'<path d="M1 -0.2L1 -22.4" stroke="{c["hull"]}" stroke-width="0.75"></path>'
            f'<path d="M1 -22.2 L12.6 -4.2 M1 -22.2 L-11.8 -1.4" stroke="{c["hull"]}" stroke-width="0.3" opacity="0.55"></path>'
            f'<g class="{"f7-sail" if belly else ""}">'
            f'<path d="{outline}" fill="url(#{uid}Sail)"></path>'
            f'<path d="{"".join(seams)}" fill="none" stroke="{c["seam"]}" stroke-width="0.4"></path>{rim}</g>'
            f'<path d="M{f(l - 0.6)} {f(top - 0.2)}L{f(r + 0.6)} {f(top - 0.2)}" stroke="{c["hull"]}" stroke-width="0.7" stroke-linecap="round"></path>')


def sailboat(c, uid):
    man = (f'<circle cx="-9.3" cy="-4.7" r="0.95" fill="{c["man"]}"></circle>'
           f'<path d="M-10.3 -0.9 L-9.9 -3.9 L-8.8 -3.9 L-8.3 -0.9 Z" fill="{c["man"]}"></path>')
    return (square_sail(c, uid) + man +
            f'<path d="{hull_path()}" fill="{c["hull"]}"></path>'
            f'<path d="{sheer_path()}" fill="none" stroke="{c["wale"]}" stroke-width="0.6"></path>'
            f'<path d="M-11 0.6 C-6 1.3 3 1.3 9.4 0.5" fill="none" stroke="{c["wale"]}" stroke-width="0.35" opacity="0.6"></path>')


def sculler(c, rng):
    """At dawn: a man standing at the stern under a sedge hat (菅笠),
    sculling with the long oar (櫓); another sits at the bow over the
    nets."""
    ln = 10
    return (f'<g class="f7-scull" style="transform-origin: -9.6px -1.6px; animation-duration: 2.4s; animation-delay: -{f(rng.uniform(0, 2.4))}s">'
            f'<path d="M-6.6 -4.4 L-17.6 3.4" stroke="{c["man"]}" stroke-width="0.6" stroke-linecap="round"></path>'
            f'<path d="M-15.4 1.9 L-18.4 4" stroke="{c["man"]}" stroke-width="1.3" stroke-linecap="round"></path>'
            f'<g class="f7-lean" style="transform-origin: -6.6px -0.4px; animation-duration: 2.4s; animation-delay: -{f(rng.uniform(0, 2.4))}s">'
            f'<path d="M-7.6 -0.4 L-7.1 -6.0 L-5.5 -5.8 L-5.4 -0.4 Z" fill="{c["man"]}"></path>'
            f'<path d="M-6.4 -4.9 L-7.4 -3.8" stroke="{c["man"]}" stroke-width="0.6" stroke-linecap="round"></path>'
            f'<circle cx="-6.3" cy="-6.9" r="0.9" fill="{c["man"]}"></circle>'
            f'<path d="M-9.4 -7.0 L-6.3 -9.4 L-3.2 -7.0 Q-6.3 -6.5 -9.4 -7.0 Z" fill="{c["man"]}"></path>'
            f'<path d="M-9.4 -7.0 Q-6.3 -6.5 -3.2 -7.0" fill="none" stroke="{c["rim"]}" stroke-width="0.35" opacity="0.6"></path></g></g>'
            f'<circle cx="5.4" cy="-3.4" r="0.85" fill="{c["man"]}"></circle>'
            f'<path d="M4.3 -0.4 L4.7 -2.7 L6.1 -2.7 L6.6 -0.4 Z" fill="{c["man"]}"></path>'
            f'<path d="{hull_path(ln, 3.8)}" fill="{c["hull"]}"></path>'
            f'<path d="{sheer_path(ln, 3.8)}" fill="none" stroke="{c["wale"]}" stroke-width="0.55"></path>')


def fire_boat(c, rng):
    """At night: a fishing boat with its fire basket hung out over the
    bow on a pole, the flames and their sparks, and the fisherman, lit
    by them, his spear down in the water."""
    flames = []
    for j, (d, col) in enumerate((
            ('M10.9 -10.9 C10.5 -12.6 11.6 -13.3 11.2 -15.1 C12.4 -13.9 12.8 -12.4 12.4 -10.9 Z', '#ff8a34'),
            ('M11.7 -10.9 C11.5 -13.3 12.9 -14.6 12.5 -17.4 C14.1 -15.2 14.3 -12.8 13.4 -10.9 Z', '#ffb547'),
            ('M12.2 -10.9 C12.1 -12.5 12.9 -13.3 12.7 -14.6 C13.5 -13.4 13.6 -12.1 13.1 -10.9 Z', '#fff1bc'))):
        flames.append(f'<path class="f7-flame" d="{d}" fill="{col}" style="animation-duration: {f(rng.uniform(0.5, 0.9))}s; animation-delay: -{f(rng.uniform(0, 0.9))}s"></path>')
    sparks = ''.join(f'<circle class="f7-spark" cx="{f(12.4 + rng.uniform(-0.8, 0.8))}" cy="-15" r="0.32" fill="#ffd27a" '
                     f'style="animation-duration: {f(rng.uniform(1.4, 2.2))}s; animation-delay: -{f(rng.uniform(0, 2.2))}s"></circle>' for _ in range(4))
    return (f'<circle class="f4-flame" cx="12.3" cy="-12.5" r="9.5" fill="url(#f7Fire)" style="animation-duration: 1.3s; animation-delay: -0.4s"></circle>'
            f'<path d="M6.6 -0.6 L11.9 -10" stroke="{c["hull"]}" stroke-width="0.6"></path>'
            f'{"".join(flames)}{sparks}'
            f'<path d="M10.5 -10.9 Q12.2 -8.3 13.9 -10.9 M11 -10.6 L11.6 -9.2 M12.2 -10.8 L12.2 -8.9 M13.4 -10.6 L12.8 -9.2" fill="none" stroke="#24180f" stroke-width="0.4"></path>'
            f'<path d="M3.2 -4.4 L10.6 3.2" stroke="{c["man"]}" stroke-width="0.45"></path>'
            f'<path d="M1.1 -0.4 L1.6 -5.4 L3.1 -5.4 L3.5 -0.4 Z" fill="{c["man"]}"></path>'
            f'<circle cx="2.4" cy="-6.4" r="1" fill="{c["man"]}"></circle>'
            f'<path d="M3.1 -5.4 L3.5 -0.4 M3.3 -6.6 A1 1 0 0 1 3.1 -5.8" fill="none" stroke="{c["rim"]}" stroke-width="0.35" opacity="0.85"></path>'
            f'<path d="{hull_path(9, 3.4)}" fill="{c["hull"]}"></path>'
            f'<path d="M4 -0.7 C6 -0.9 7.6 -1.4 9.4 -3.2" fill="none" stroke="{c["rim"]}" stroke-width="0.45" opacity="0.7"></path>')


def boat_ink(kind, hour, uid, rng):
    """The boat for the hour, and the shape its reflection takes."""
    c = BOAT[hour]
    if kind in ('sails', 'sail_dark'):
        return sailboat(c, uid), (f'<path d="{hull_path()}" fill="{c["hull"]}"></path>'
                                  f'<path d="M-6.8 -20.6L8.8 -20.6L9.2 -4.6L-6.6 -4.6Z" fill="{c["sail"]}"></path>'
                                  f'<path d="M1 0 L1 -22.4" stroke="{c["hull"]}" stroke-width="0.8"></path>')
    if kind == 'fisher':
        return sculler(c, rng), (f'<path d="{hull_path(10, 3.8)}" fill="{c["hull"]}"></path>'
                                 f'<path d="M-7.4 0 L-6.6 -6 L-5.4 -6 L-5.4 0 Z M-9.4 -7 L-6.3 -9.4 L-3.2 -7 Z" fill="{c["man"]}"></path>')
    return fire_boat(c, rng), (f'<path d="{hull_path(9, 3.4)}" fill="{c["hull"]}"></path>'
                               f'<path d="M1.1 0 L1.6 -5.4 L3.1 -5.4 L3.5 0 Z" fill="{c["man"]}"></path>')


def boats7(fleet_, s, hour, uid, anim):
    out = []
    for b in fleet_:
        r = random.Random(b['seed'] + 1)
        ink, _ = boat_ink(b['kind'], hour, uid, r)
        wake = ''
        if b['kind'] in ('sails', 'fisher'):
            d = 'M-11 3.1 L-24 3.6 M-9.6 4.3 L-18 5' if b['kind'] == 'sails' else 'M-12 3.1 L-20 3.5'
            wake = (f'<g class="f5-wake" style="{anim(2.8, r.uniform(0, 2.8))}"><path d="{d}" stroke="{s["wave"]}" '
                    f'stroke-width="0.7" stroke-linecap="round"></path></g>')
        out.append(f'<g class="f5-drift" style="--dx: {f(b["drift"])}px; {anim(b["dur"], b["d0"])}">'
                   f'<g transform="translate({f(b["x"])} {f(b["y"])}) scale({f(b["sc"])})">{wake}'
                   f'<g class="f5-heave" style="{anim(r.uniform(3.1, 3.9), r.uniform(0, 3))}">'
                   f'<g class="f5-pitch" style="{anim(r.uniform(4.3, 5.7), r.uniform(0, 4))}">{ink}</g></g></g></g>')
    return ''.join(out)


def reflections7(fleet_, hour, uid, anim, grouped=False):
    """Each boat's reflection, turned over at the waterline, shortened,
    and broken by the ripples into three bands that slide apart."""
    out = []
    for b in fleet_:
        r = random.Random(b['seed'])
        _, mirror = boat_ink(b['kind'], hour, uid, random.Random(b['seed'] + 1))
        op = 0.34 if b['kind'] == 'sails' else 0.42
        bands = ''.join(f'<g clip-path="url(#{uid}Rip{j})"><g class="f6-ripple" style="--r: {f(0.45 + j * 0.45)}px; {anim(1.9 + j * 0.4, r.uniform(0, 2))}">'
                        f'<g transform="translate(0 4.2) scale(1 -0.62)">{mirror}</g></g></g>' for j in range(3))
        extra = ''
        if b['kind'] == 'isaribi':
            rows = []
            for j in range(7):
                ly = 3.2 + j * 2.2
                flecks = [(dx, ln, r.uniform(0.6, 1) * (1 - j * 0.08), r.uniform(1.1, 2.2), r.uniform(0, 2.2))
                          for dx, ln in ((r.gauss(0, 0.7 + j * 0.42), r.uniform(1.1, 2.4) + j * 0.3) for _ in range(2 if j < 3 else 3))]
                if grouped:
                    # the row's flecks twinkle together
                    pieces = (f'<g class="f6-twinkle" style="--o: 1; {anim(flecks[0][3], flecks[0][4])}">'
                              + ''.join(f'<line x1="{f(12.3 + dx - ln / 2)}" y1="{f(ly)}" x2="{f(12.3 + dx + ln / 2)}" y2="{f(ly)}" opacity="{f(o)}"></line>'
                                        for dx, ln, o, _, _ in flecks) + '</g>')
                else:
                    pieces = ''.join(
                        f'<line class="f6-twinkle" x1="{f(12.3 + dx - ln / 2)}" y1="{f(ly)}" x2="{f(12.3 + dx + ln / 2)}" y2="{f(ly)}" '
                        f'style="--o: {f(o)}; {anim(dur, delay)}"></line>' for dx, ln, o, dur, delay in flecks)
                rows.append(f'<g class="f6-road" style="--w: {f(0.35 + j * 0.25)}px; --o: 1; {anim(2.3, 2.3 - j * 0.3)}">{pieces}</g>')
            extra = (f'<ellipse cx="12.3" cy="9.5" rx="3.6" ry="8" fill="#ffb54d" opacity="0.3" filter="url(#f6Haze)"></ellipse>'
                     f'<g stroke="#ffc46b" stroke-opacity="0.9" stroke-width="1" stroke-linecap="round">{"".join(rows)}</g>')
        out.append(f'<g class="f5-drift" style="--dx: {f(b["drift"])}px; {anim(b["dur"], b["d0"])}">'
                   f'<g transform="translate({f(b["x"])} {f(b["y"])}) scale({f(b["sc"])})">'
                   f'<g opacity="{f(op)}">{bands}</g>{extra}</g></g>')
    return ''.join(out)


def boat_defs(hour, uid):
    c = BOAT[hour]
    return (f'<linearGradient id="{uid}Sail" x1="0" y1="0" x2="1" y2="1">'
            f'<stop offset="0" stop-color="{c["sail"]}"></stop><stop offset="0.55" stop-color="{c["sail"]}"></stop>'
            f'<stop offset="1" stop-color="{c["sail_shade"]}"></stop></linearGradient>'
            f'<radialGradient id="f7Fire"><stop offset="0" stop-color="#ffd37a" stop-opacity="0.9"></stop>'
            f'<stop offset="0.3" stop-color="#ff9a3c" stop-opacity="0.45"></stop><stop offset="1" stop-color="#ff7a2a" stop-opacity="0"></stop></radialGradient>'
            # the ripple bands, in the boat's own coordinates
            f'<clipPath id="{uid}Rip0"><rect x="-40" y="2.3" width="80" height="4.2"></rect></clipPath>'
            f'<clipPath id="{uid}Rip1"><rect x="-40" y="6.5" width="80" height="4.6"></rect></clipPath>'
            f'<clipPath id="{uid}Rip2"><rect x="-40" y="11.1" width="80" height="16"></rect></clipPath>')


# ── the train ─────────────────────────────────────────────────────

TRAIN = {
    # body, roof, the blue of the window band and the stripe, glass,
    # door lines, the bellows between cars, the roof's rim of light
    'day': dict(body='#f1ecdf', roof='#cdc8bb', band='#26468c', glass='#8fa9c4', glass_lo='#3f5a7d',
                door='#a59d8a', bellows='#4a4744', rim='#ffffff', lit=False),
    'dusk': dict(body='#1e2536', roof='#2b3244', band='#131a29', glass='#ffd27a', glass_lo='#ffb85a',
                 door='#131a29', bellows='#0b0f17', rim='#b88f86', lit=True),
    'night': dict(body='#161d2b', roof='#20293a', band='#0d131f', glass='#ffd27a', glass_lo='#ffb85a',
                  door='#0d131f', bellows='#070a11', rim='#5e7393', lit=True),
    'dawn': dict(body='#28243c', roof='#353049', band='#1b1829', glass='#ffd98c', glass_lo='#ffbe6a',
                 door='#1b1829', bellows='#100e18', rim='#c08e95', lit=True),
}
CAR, GAP, NOSE = 64, 3, 18


def nose(x0, y0, y1, c, uid, lead=True):
    """A bullet nose, drawn facing right from x0; the tail car's is the
    same turned round."""
    sx = 1 if lead else -1
    X = lambda dx: f(x0 + sx * dx)
    body = (f'M{X(0)} {f(y0)} C{X(7)} {f(y0)} {X(12.5)} {f(y0 + 1.9)} {X(15.8)} {f(y0 + 5.2)} '
            f'C{X(17.6)} {f(y0 + 7.2)} {X(18.4)} {f(y0 + 9.6)} {X(18.2)} {f(y1)} L{X(0)} {f(y1)} Z')
    shield = (f'M{X(2.4)} {f(y0 + 1.1)} C{X(6.2)} {f(y0 + 1.2)} {X(9.6)} {f(y0 + 2.2)} {X(11.8)} {f(y0 + 3.9)} '
              f'L{X(2.8)} {f(y0 + 4.1)} Z')
    band = (f'M{X(0)} {f(y0 + 9.0)} L{X(14.6)} {f(y0 + 9.0)} C{X(16.2)} {f(y0 + 9.2)} {X(17.4)} {f(y0 + 9.6)} {X(18.2)} {f(y0 + 10.4)} '
            f'L{X(18.2)} {f(y0 + 11.0)} C{X(17)} {f(y0 + 10.4)} {X(15.8)} {f(y0 + 10.0)} {X(14.2)} {f(y0 + 9.8)} L{X(0)} {f(y0 + 9.8)} Z')
    lamp_x, lamp_y = x0 + sx * 16.9, y0 + 8.2
    if lead:
        light = '#fff6d6' if c['lit'] else '#f3ead0'
    else:
        light = '#ff5a4a' if c['lit'] else '#d9cfb6'
    lamp = f'<ellipse cx="{f(lamp_x)}" cy="{f(lamp_y)}" rx="0.95" ry="0.6" fill="{light}"></ellipse>'
    if c['lit']:
        if lead:
            lamp += (f'<path d="M{f(lamp_x)} {f(lamp_y - 0.6)} L{f(lamp_x + 40)} {f(lamp_y - 5)} L{f(lamp_x + 40)} {f(lamp_y + 5)} L{f(lamp_x)} {f(lamp_y + 0.6)} Z" '
                     f'fill="url(#{uid}Beam)"></path>'
                     f'<circle cx="{f(lamp_x)}" cy="{f(lamp_y)}" r="5" fill="url(#f4Lamp)"></circle>')
        else:
            lamp += f'<circle cx="{f(lamp_x)}" cy="{f(lamp_y)}" r="2.6" fill="#ff5a4a" opacity="0.35" filter="url(#f4Win)"></circle>'
    rim = (f'<path d="M{X(0)} {f(y0 + 0.3)} C{X(7)} {f(y0 + 0.3)} {X(12.3)} {f(y0 + 2.1)} {X(15.5)} {f(y0 + 5.3)}" fill="none" '
           f'stroke="{c["rim"]}" stroke-width="0.6" opacity="{0.9 if c["lit"] else 0.7}"></path>')
    glass = 'url(#' + uid + 'Glass)' if not c['lit'] else c['band']
    return (f'<path d="{body}" fill="{c["body"]}"></path><path d="{band}" fill="{c["band"]}"></path>'
            f'<path d="{shield}" fill="{glass}"></path>{rim}{lamp}')


def car(x, y0, y1, c, uid, k, pantograph):
    """One car: the roof, the body, the window band and its windows,
    the stripe under it, the doors at both ends."""
    out = [f'<rect x="{f(x)}" y="{f(y0)}" width="{CAR}" height="{f(y1 - y0)}" rx="1.6" fill="{c["body"]}"></rect>',
           f'<rect x="{f(x)}" y="{f(y0)}" width="{CAR}" height="2.2" rx="1.1" fill="{c["roof"]}"></rect>',
           f'<rect x="{f(x + 0.8)}" y="{f(y0 + 0.15)}" width="{CAR - 1.6}" height="0.6" rx="0.3" fill="{c["rim"]}" opacity="{0.85 if c["lit"] else 0.6}"></rect>',
           f'<rect x="{f(x)}" y="{f(y0 + 4.0)}" width="{CAR}" height="3.6" fill="{c["band"]}"></rect>',
           f'<rect x="{f(x)}" y="{f(y0 + 9.0)}" width="{CAR}" height="0.8" fill="{c["band"]}"></rect>']
    glass = c['glass'] if c['lit'] else f'url(#{uid}Glass)'
    wins = []
    for j in range(11):
        wx = x + 8.2 + j * 4.5
        wins.append(f'<rect x="{f(wx)}" y="{f(y0 + 4.6)}" width="2.9" height="2.4" rx="0.5"></rect>')
    for dx in (2.2, CAR - 5.6):
        out.append(f'<rect x="{f(x + dx)}" y="{f(y0 + 2.8)}" width="3.4" height="{f(y1 - y0 - 2.6)}" fill="none" stroke="{c["door"]}" stroke-width="0.35"></rect>')
        wins.append(f'<rect x="{f(x + dx + 1)}" y="{f(y0 + 4.5)}" width="1.4" height="2.6" rx="0.4"></rect>')
    if pantograph:
        px = x + 20
        out.append(f'<path d="M{f(px - 5)} {f(y0 + 0.1)} L{f(px)} {f(y0 - 4.3)} L{f(px + 5)} {f(y0 + 0.1)} M{f(px - 2.6)} {f(y0 - 4.4)} L{f(px + 2.6)} {f(y0 - 4.4)}" '
                   f'fill="none" stroke="{c["bellows"]}" stroke-width="0.45" stroke-linejoin="round"></path>'
                   f'<rect x="{f(px - 6.5)}" y="{f(y0 - 0.7)}" width="13" height="0.9" rx="0.4" fill="{c["roof"]}"></rect>')
    return ''.join(out), f'<g fill="{glass}">{"".join(wins)}</g>'


def train7(L, h, s, hour, uid):
    """The bullet train on the bridge: a nose at each end, the cars and
    the bellows between them, lit at dusk and at night."""
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
    return (f'<g class="f4-train" style="--run: {f(L.W + length + 40)}px; --from: -{f(length + 20)}px">'
            f'<g class="f4-rattle">{"".join(bellows)}{tail}{lead}{"".join(parts)}{glow}{"".join(glass)}</g></g>')


def catenary7(L, h, hour, x0=None):
    """The overhead line: masts standing behind the track at every
    second pier, the messenger wire sagging between them, the contact
    wire under it, hung from droppers."""
    top = L.viaduct[0]
    y0 = top - 13.5
    span = 42 * (L.W / 390) ** 0.25
    pitch = span * 2
    ink = {'day': '#3d3c3e', 'dusk': '#0d121c', 'night': '#090d16', 'dawn': '#151221'}[hour]
    masts, wires = [], []
    x = -span * 0.5 if x0 is None else x0 - pitch * math.ceil((x0 + 10) / pitch)
    xs = []
    while x < L.W + pitch:
        xs.append(x)
        masts.append(f'M{f(x)} {f(top)}L{f(x)} {f(y0 - 7.4)}M{f(x - 1.4)} {f(y0 - 6.6)}L{f(x + 1.6)} {f(y0 - 6.6)}')
        x += pitch
    for a, b in zip(xs, xs[1:]):
        m = (a + b) / 2
        wires.append(f'M{f(a)} {f(y0 - 6.6)}Q{f(m)} {f(y0 - 4.2)} {f(b)} {f(y0 - 6.6)}')
        for t in (0.2, 0.4, 0.6, 0.8):
            x = a + (b - a) * t
            yy = (1 - t) ** 2 * (y0 - 6.6) + 2 * (1 - t) * t * (y0 - 4.2) + t * t * (y0 - 6.6)
            wires.append(f'M{f(x)} {f(yy)}L{f(x)} {f(y0 - 4.4)}')
    wires.append(f'M-10 {f(y0 - 4.4)}L{L.W + 10} {f(y0 - 4.4)}')
    return (f'<path d="{"".join(masts)}" fill="none" stroke="{ink}" stroke-width="0.9"></path>'
            f'<path d="{"".join(wires)}" fill="none" stroke="{ink}" stroke-width="0.32" opacity="0.8"></path>')


def train_defs(hour, uid):
    c = TRAIN[hour]
    return (f'<linearGradient id="{uid}Glass" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{c["glass"]}"></stop><stop offset="1" stop-color="{c["glass_lo"]}"></stop></linearGradient>'
            f'<linearGradient id="{uid}Beam" x1="0" y1="0" x2="1" y2="0">'
            f'<stop offset="0" stop-color="#fff4d0" stop-opacity="0.45"></stop><stop offset="1" stop-color="#fff4d0" stop-opacity="0"></stop></linearGradient>')


# ── the bridge ─────────────────────────────────────────────────────

BRIDGE = {
    # what shows through the arches: the ground beyond, lit
    'day': '#55704f', 'dusk': '#1e2638', 'night': '#111a29', 'dawn': '#352f47',
}


def bridge7(L, s, h, hour, uid):
    """A stone bridge: the parapet and its coping, the cornice and the
    shadow under it, the spandrels in coursed ashlar, each arch ringed
    in voussoirs with a keystone, imposts at the springing, the arches
    open on the lit ground beyond."""
    top, base = L.viaduct
    k = (L.W / 390) ** 0.25
    span = 42 * k
    half = span * 0.33
    spring = top + 9.5 + half
    stone = h['viaduct']
    lit = s['lit']
    joint = mix(stone, '#000000', 0.45)
    rng = random.Random(L.seed + 101)
    # the ashlar: courses, each stone its own tint
    courses, tints = [], []
    y = top + 3.4
    row = 0
    while y < base:
        hh = 4.4 * k
        x = -20 + (row % 2) * 5 * k
        courses.append(f'M-20 {f(y)}L{L.W + 20} {f(y)}')
        while x < L.W + 20:
            w = rng.uniform(8, 12) * k
            courses.append(f'M{f(x)} {f(y)}L{f(x)} {f(min(base, y + hh))}')
            if rng.random() < 0.3:
                tints.append(f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(hh)}" opacity="{f(rng.uniform(0.05, 0.14))}"></rect>')
            x += w
        y += hh
        row += 1
    arches, rings, keys, imposts, beyond = [], [], [], [], []
    x = -20
    while x < L.W + 20:
        a = x + (span - 2 * half) / 2
        b = a + 2 * half
        cx = (a + b) / 2
        arches.append(f'M{f(a)} {f(base + 2)}V{f(spring)}A{f(half)} {f(half)} 0 0 1 {f(b)} {f(spring)}V{f(base + 2)}Z')
        beyond.append(f'<rect x="{f(a)}" y="{f(base - 9 * k)}" width="{f(b - a)}" height="{f(9 * k + 2)}"></rect>')
        n = 13
        r0, r1 = half, half + 3.4 * k
        for j in range(n):
            t0, t1 = math.pi * j / n, math.pi * (j + 1) / n
            ro = r1 + (1.3 * k if j == n // 2 else 0)
            p = [(cx - math.cos(t0) * r0, spring - math.sin(t0) * r0), (cx - math.cos(t0) * ro, spring - math.sin(t0) * ro),
                 (cx - math.cos(t1) * ro, spring - math.sin(t1) * ro), (cx - math.cos(t1) * r0, spring - math.sin(t1) * r0)]
            d = 'M' + 'L'.join(f'{f(px)} {f(py)}' for px, py in p) + 'Z'
            (keys if j == n // 2 else rings).append((d, j))
        imposts.append(f'M{f(a - 1.8 * k)} {f(spring)}L{f(a + 0.8 * k)} {f(spring)}M{f(b - 0.8 * k)} {f(spring)}L{f(b + 1.8 * k)} {f(spring)}')
        x += span
    ring_a = ''.join(d for d, j in rings if j % 2 == 0)
    ring_b = ''.join(d for d, j in rings if j % 2 == 1)
    key_d = ''.join(d for d, _ in keys)
    return (f'<rect y="{f(top - 3.6)}" width="{L.W}" height="{f(base - top + 3.6)}" fill="{stone}"></rect>'
            f'<g fill="{lit}">{"".join(tints)}</g>'
            f'<path d="{"".join(courses)}" fill="none" stroke="{joint}" stroke-width="0.45" opacity="0.42"></path>'
            f'<path d="{"".join(arches)}" fill="url(#{uid}Arch)"></path>'
            f'<g fill="url(#{uid}Beyond)">{"".join(beyond)}</g>'
            f'<path d="{ring_a}" fill="{mix(stone, lit, 0.45)}" stroke="{joint}" stroke-width="0.4"></path>'
            f'<path d="{ring_b}" fill="{mix(stone, lit, 0.32)}" stroke="{joint}" stroke-width="0.4"></path>'
            f'<path d="{key_d}" fill="{mix(stone, lit, 0.62)}" stroke="{joint}" stroke-width="0.4"></path>'
            f'<path d="{"".join(imposts)}" fill="none" stroke="{mix(stone, lit, 0.6)}" stroke-width="{f(1.3 * k)}"></path>'
            f'<rect y="{f(top - 0.4)}" width="{L.W}" height="{f(2.6 * k)}" fill="{mix(stone, lit, 0.5)}"></rect>'
            f'<rect y="{f(top - 0.4 + 2.6 * k)}" width="{L.W}" height="1.1" fill="#000" fill-opacity="0.35"></rect>'
            f'<rect y="{f(top - 3.6)}" width="{L.W}" height="1" fill="{lit}"></rect>'
            f'<rect y="{f(top - 2.6)}" width="{L.W}" height="0.5" fill="#000" fill-opacity="0.25"></rect>')


def bridge_defs(L, s, h, hour, uid):
    top, base = L.viaduct
    return (f'<linearGradient id="{uid}Arch" x1="0" y1="{f(top + 6)}" x2="0" y2="{f(base)}" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{s["shade"][0]}"></stop><stop offset="1" stop-color="{s["shade"][1]}"></stop></linearGradient>'
            f'<linearGradient id="{uid}Beyond" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{BRIDGE[hour]}" stop-opacity="0"></stop><stop offset="1" stop-color="{BRIDGE[hour]}" stop-opacity="1"></stop></linearGradient>')


# ── the flowers ───────────────────────────────────────────────────

def petal(ln, wd):
    """A cosmos petal pointing up from the heart: narrow at its base,
    broad at its tip, the tip cut in three teeth."""
    W, L_ = wd, ln
    return (f'M0 0 C{f(-W * 0.2)} {f(-L_ * 0.22)} {f(-W * 0.54)} {f(-L_ * 0.55)} {f(-W * 0.5)} {f(-L_ * 0.88)} '
            f'L{f(-W * 0.31)} {f(-L_ * 0.97)} L{f(-W * 0.17)} {f(-L_ * 0.9)} L0 {f(-L_)} L{f(W * 0.17)} {f(-L_ * 0.9)} '
            f'L{f(W * 0.31)} {f(-L_ * 0.97)} L{f(W * 0.5)} {f(-L_ * 0.88)} C{f(W * 0.54)} {f(-L_ * 0.55)} {f(W * 0.2)} {f(-L_ * 0.22)} 0 0 Z')


DUSKEN = {
    # how far the hour's light takes the flowers' colours toward its shade
    'day': (0.0, '#000000'), 'dawn': (0.12, '#2a2238'), 'dusk': (0.3, '#1d2436'), 'night': (0.22, '#141c2c'),
}


def cosmos_defs(h, hour):
    dim, shade = DUSKEN[hour]
    out = []
    for i, col in enumerate(h['cosmos']):
        base = mix(col, '#6a1840', 0.38) if col.lower() not in ('#ffffff', '#fbeef2', '#f1e6ea') else mix(col, '#d77fa4', 0.55)
        tip, base = mix(col, shade, dim), mix(base, shade, dim)
        out.append(f'<linearGradient id="f7Cos{i}" x1="0" y1="1" x2="0" y2="0">'
                   f'<stop offset="0" stop-color="{base}"></stop><stop offset="0.42" stop-color="{mix(base, tip, 0.75)}"></stop>'
                   f'<stop offset="1" stop-color="{tip}"></stop></linearGradient>')
    return ''.join(out)


def thread_leaf(x, y, ang, ln, sc):
    """A cosmos leaf: a midrib and its pairs of thread-fine leaflets."""
    d = [f'M{f(x)} {f(y)}L{f(x + math.cos(ang) * ln)} {f(y + math.sin(ang) * ln)}']
    for t, sl in ((0.3, 0.42), (0.55, 0.36), (0.78, 0.26)):
        bx, by = x + math.cos(ang) * ln * t, y + math.sin(ang) * ln * t
        for side in (-1, 1):
            a = ang + side * 0.85
            d.append(f'M{f(bx)} {f(by)}L{f(bx + math.cos(a) * ln * sl)} {f(by + math.sin(a) * ln * sl)}')
    return ''.join(d)


def cosmos7(L, h, hour, gust, anim):
    """Cosmos (秋桜), October's flower: tall thin stems with their thread
    leaves; heads of eight toothed petals, deep at the heart and pale at
    the tip, turned every way; a bud or two."""
    out = []
    rng = random.Random(L.seed + 31)
    dim, shade = DUSKEN[hour]
    heart = [mix(c, shade, dim) for c in ('#c98f2a', '#e9bd4f', '#9a6414')]
    for x0, y0, sc, n in L.cosmos:
        for k in range(n):
            ln = rng.uniform(46, 92) * sc
            bx = x0 + rng.uniform(-10, 10) * sc
            tx, ty = bx + rng.uniform(-14, 14) * sc, y0 - ln
            mx = (bx + tx) / 2 + rng.uniform(-6, 6) * sc
            ci = rng.randrange(len(h['cosmos']))
            pr = rng.uniform(4.6, 6.6) * sc
            tilt = rng.uniform(-35, 35)
            squash = rng.choice((1.0, 0.92, 0.8, 0.62, 0.5))
            stem = f'M{f(bx)} {f(y0)}Q{f(mx)} {f(y0 - ln * 0.5)} {f(tx)} {f(ty)}'
            leaves = ''.join(thread_leaf(bx + (mx - bx) * t * 1.6 if t < 0.5 else mx + (tx - mx) * (t - 0.5) * 2, y0 - ln * t,
                                         -math.pi / 2 + side * rng.uniform(0.6, 1.1), rng.uniform(8, 12) * sc, sc)
                             for t, side in ((0.22, 1), (0.4, -1), (0.6, 1)))
            bud = ''
            if rng.random() < 0.35:
                bt = rng.uniform(0.45, 0.7)
                sx = bx + (tx - bx) * bt
                sy = y0 - ln * bt
                ex, ey = sx + rng.choice((-1, 1)) * rng.uniform(5, 8) * sc, sy - rng.uniform(7, 11) * sc
                bud = (f'<path d="M{f(sx)} {f(sy)}Q{f((sx + ex) / 2)} {f(sy - 2 * sc)} {f(ex)} {f(ey)}" fill="none" stroke="{h["flower_stem"]}" stroke-width="{f(0.6 * sc)}"></path>'
                       f'<ellipse cx="{f(ex)}" cy="{f(ey - 1.4 * sc)}" rx="{f(1.5 * sc)}" ry="{f(1.9 * sc)}" fill="{mix(h["flower_stem"], "#6b7a3a", 0.5)}"></ellipse>'
                       f'<ellipse cx="{f(ex)}" cy="{f(ey - 2.6 * sc)}" rx="{f(0.9 * sc)}" ry="{f(0.8 * sc)}" fill="url(#f7Cos{ci})"></ellipse>')
            petals = ''.join(f'<path d="{petal(pr, pr * 0.66)}" transform="rotate({f(a + rng.uniform(-6, 6))})"></path>'
                             for a in range(0, 360, 45))
            dots = ''.join(f'<circle cx="{f(math.cos(t) * pr * 0.13)}" cy="{f(math.sin(t) * pr * 0.13)}" r="{f(0.32 * sc)}"></circle>'
                           for t in (j * 1.047 for j in range(6)))
            head = (f'<g fill="url(#f7Cos{ci})">{petals}</g>'
                    f'<circle r="{f(pr * 0.27)}" fill="{heart[0]}"></circle><circle r="{f(pr * 0.19)}" fill="{heart[1]}"></circle>'
                    f'<g fill="{heart[2]}">{dots}</g>')
            out.append(f'<g class="f5-gust" style="transform-origin: {f(bx)}px {f(y0)}px; --a: {f(rng.uniform(3, 6))}deg; {gust(bx, L.W)}">'
                       f'<path d="{stem}" fill="none" stroke="{h["flower_stem"]}" stroke-width="{f(1 * sc)}" stroke-linecap="round"></path>'
                       f'<path d="{leaves}" fill="none" stroke="{h["flower_stem"]}" stroke-width="{f(0.45 * sc)}" stroke-linecap="round"></path>{bud}'
                       f'<g transform="translate({f(tx)} {f(ty)}) rotate({f(tilt)}) scale(1 {f(squash)})">'
                       f'<g class="f5-nod" style="{anim(rng.uniform(1.8, 2.8), rng.uniform(0, 2.8))}">{head}</g></g></g>')
    return ''.join(out)


def blade(x, y, ang, ln, droop, w0, rng):
    """A grass blade: from its foot it rises, arches over and droops,
    narrowing to its tip; returned as a filled outline and its midrib."""
    pts = []
    for i in range(13):
        t = i / 12
        a = ang + droop * t * t
        pts.append((t, a))
    # walk the blade
    xs, ys, x_, y_ = [], [], x, y
    step = ln / 12
    for t, a in pts:
        xs.append(x_)
        ys.append(y_)
        x_ += math.sin(a) * step
        y_ -= math.cos(a) * step
    left, right, mid = [], [], []
    for i in range(13):
        t = i / 12
        a = pts[i][1]
        w = w0 * (1 - t) ** 0.8 * (0.6 + 0.4 * math.sin(min(1, t * 3) * math.pi / 2))
        nx, ny = math.cos(a), math.sin(a)
        left.append((xs[i] - nx * w / 2, ys[i] - ny * w / 2))
        right.append((xs[i] + nx * w / 2, ys[i] + ny * w / 2))
        mid.append((xs[i], ys[i]))
    return smooth(left) + ' L' + smooth(right[::-1])[1:] + ' Z', smooth(mid[:10])


def susuki7(L, h, hour, gust, anim):
    """Pampas grass (薄): a clump of long blades arching out from its
    foot, and the tall stems, each ending in a plume of silky racemes
    that fan out and droop with the weight."""
    out = []
    rng = random.Random(L.seed + 21)
    rib = mix(h['stem'], h['plume'], 0.35)
    glow = {'day': 1.0, 'dawn': 0.95, 'dusk': 0.85, 'night': 0.45}[hour]
    for x0, y0, sc, n in L.susuki:
        blades, ribs = [], []
        for j in range(int(5 + n * 0.6)):
            side = rng.choice((-1, 1))
            o, r_ = blade(x0 + rng.uniform(-4, 4) * sc, y0, side * rng.uniform(0.05, 0.5), rng.uniform(40, 70) * sc,
                          side * rng.uniform(0.9, 1.8), rng.uniform(1.6, 2.4) * sc, rng)
            blades.append(o)
            ribs.append(r_)
        out.append(f'<g class="f5-gust" style="transform-origin: {f(x0)}px {f(y0)}px; --a: {f(rng.uniform(1.5, 2.5))}deg; {gust(x0, L.W)}">'
                   f'<path d="{" ".join(blades)}" fill="{h["stem"]}"></path>'
                   f'<path d="{" ".join(ribs)}" fill="none" stroke="{rib}" stroke-width="{f(0.35 * sc)}" opacity="0.7"></path></g>')
        for k in range(n):
            lean = rng.uniform(-0.55, 0.9)
            ln = rng.uniform(58, 92) * sc
            bx0 = x0 + rng.uniform(-4, 4) * sc
            tx = x0 + lean * ln * 0.5 + rng.uniform(-6, 6) * sc
            ty = y0 - ln
            cx_, cy_ = x0 + lean * ln * 0.1, y0 - ln * 0.6
            ang = math.atan2(ty - cy_, tx - cx_)
            # the plume: racemes leaving the axis along its last stretch,
            # fanning out and drooping, each furred with fine silky hairs
            racemes, hairs = [], []
            for m in range(7):
                t = m / 6
                ax = tx - math.cos(ang) * 12 * sc * t
                ay = ty - math.sin(ang) * 12 * sc * t
                side = -1 if m % 2 else 1
                rl = rng.uniform(10, 17) * sc * (1 - 0.3 * t)
                a0 = ang + side * rng.uniform(0.2, 0.5)
                pts = []
                px_, py_ = ax, ay
                for i in range(9):
                    u = i / 8
                    a = a0 + side * 0.25 * u + 1.1 * u * u * (math.pi / 2 - a0) * 0.6
                    pts.append((px_, py_))
                    px_ += math.cos(a) * rl / 8
                    py_ += math.sin(a) * rl / 8
                racemes.append(smooth(pts))
                for i in range(1, 9):
                    (qx, qy), (rx_, ry_) = pts[i - 1], pts[i]
                    da = math.atan2(ry_ - qy, rx_ - qx)
                    for hs in (-1, 1):
                        hl = rng.uniform(2.0, 3.4) * sc * (0.6 + 0.4 * (1 - i / 9))
                        ha = da + hs * rng.uniform(0.35, 0.6)
                        hairs.append(f'M{f(rx_)} {f(ry_)}L{f(rx_ + math.cos(ha) * hl)} {f(ry_ + math.sin(ha) * hl)}')
            out.append(f'<g class="f5-gust" style="transform-origin: {f(bx0)}px {f(y0)}px; --a: {f(rng.uniform(2.5, 5))}deg; {gust(bx0, L.W)}">'
                       f'<path d="M{f(bx0)} {f(y0)} Q{f(cx_)} {f(cy_)} {f(tx)} {f(ty)}" fill="none" stroke="{h["stem"]}" stroke-width="{f(1.05 * sc)}" stroke-linecap="round"></path>'
                       f'<g class="f5-flutter" style="transform-origin: {f(tx)}px {f(ty)}px; {anim(rng.uniform(0.9, 1.5), rng.uniform(0, 1.5))}">'
                       f'<path d="{" ".join(racemes)}" fill="none" stroke="{h["plume"]}" stroke-width="{f(0.6 * sc)}" stroke-linecap="round" opacity="{f(0.9 * glow)}"></path>'
                       f'<path d="{"".join(hairs)}" fill="none" stroke="{h["plume"]}" stroke-width="{f(0.38 * sc)}" stroke-linecap="round" opacity="{f(0.6 * glow)}"></path></g></g>')
    return ''.join(out)


def grass7(L, h):
    """The bank under the bridge: clumps of grass along its edge, of
    uneven size, with bare stretches between them."""
    rng = random.Random(L.seed + 111)
    ink = mix(h['ground'], h['stem'], 0.42)
    d = []
    x = rng.uniform(-4, 10)
    k = (L.W / 390) ** 0.3
    while x < L.W + 4:
        if rng.random() < 0.35:
            x += rng.uniform(10, 26) * k
            continue
        y = L.ground + rng.uniform(-0.5, 2.5)
        tall = rng.uniform(0.5, 1.2)
        for _ in range(rng.randint(2, 6)):
            a = rng.uniform(-0.7, 0.7)
            ln = rng.uniform(2.5, 7.5) * k * tall
            bx = x + rng.uniform(-2, 2) * k
            d.append(f'M{f(bx)} {f(y)}Q{f(bx + math.sin(a) * ln * 0.25)} {f(y - ln * 0.6)} {f(bx + math.sin(a) * ln)} {f(y - ln * math.cos(a * 0.6))}')
        x += rng.uniform(4, 14) * k
    return f'<path d="{"".join(d)}" fill="none" stroke="{ink}" stroke-width="0.55" stroke-linecap="round" opacity="0.85"></path>'
