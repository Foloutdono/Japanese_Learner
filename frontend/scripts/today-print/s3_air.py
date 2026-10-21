"""S³ · the summer's cloud peak, drawn as a cumulus (plan 261, the
canvas "Tsuji — Today, the seasons", round 3). Round 1 piled circles
and lit each one alike: a heap of balls. Round 2 stacked the print's
cloud banks: a pile of plates. Neither was a cloud.

A cumulus is lit as one great form before it is lit as billows. So the
tower is filled with one light, from the sun's side (the dial's disc)
to the shade at its foot away from it, and built of a few great lobes,
the crown's first, each billowed at its edge by smaller ones. Laid from
the crown down, each lobe first lays its shade, soft, on the lobes
behind it round its rim -- the crevice -- then its body in the tower's
light: so the crevices fall only between lobes, a lobe's lit edge
stands against the shaded underside of the one above it, and that
edge, repeated, is the cauliflower. The foot is lost in the haze of the
far hills.

The tower stays still but for the slow rise the print's clouds have.
Also here: the August night's fireworks on the desk, and the evening
snow, as the app lifts them (below)."""
import contextlib
import dataclasses
import math
import random
import s1_air
from geo import f
from scene_f4 import anim

# a tower's shape, in its own units: x across its foot (0 to 1), y up
# from it (0 the foot, negative up); each of its lobes (x, y, r), the
# great billows a cumulus is built of, the crown's first
MAIN = [
    (0.52, -0.74, 0.15), (0.37, -0.65, 0.11), (0.67, -0.63, 0.12),
    (0.47, -0.52, 0.17), (0.63, -0.46, 0.15), (0.34, -0.43, 0.14),
    (0.85, -0.42, 0.12), (0.14, -0.35, 0.12),
    (0.86, -0.27, 0.15), (0.5, -0.3, 0.2), (0.29, -0.24, 0.17), (0.7, -0.24, 0.17), (0.09, -0.2, 0.15),
    (-0.04, -0.06, 0.15), (0.2, -0.07, 0.18), (0.44, -0.06, 0.2), (0.68, -0.07, 0.19), (0.92, -0.06, 0.17), (1.1, -0.03, 0.12),
]
SMALL = [
    (0.46, -0.48, 0.16), (0.3, -0.36, 0.14), (0.62, -0.36, 0.15),
    (0.8, -0.24, 0.15), (0.46, -0.24, 0.19), (0.16, -0.2, 0.15),
    (-0.04, -0.06, 0.16), (0.24, -0.08, 0.2), (0.52, -0.06, 0.2), (0.78, -0.08, 0.19), (1.02, -0.05, 0.15),
]
TOWERS = {
    # (shape, left, foot, width, opacity): the foot behind the far hills;
    # on the phone Fuji's flank fills the right, so the one tower
    390: [(MAIN, -10, 478, 160, 1.0)],
    1184: [(MAIN, -30, 654, 400, 1.0), (SMALL, 900, 654, 250, 0.72)],
}
INK = dict(light='#fffdf8', light_far='#f1f4fa', shade='#c4cde3', shade_far='#a7b3d2', crease='#8e9cc4', deep='#8c9ac2', haze='#dfe9f1')


def disc(cx, cy, r):
    return f'M{f(cx - r)} {f(cy)}a{f(r)} {f(r)} 0 1 0 {f(2 * r)} 0a{f(r)} {f(r)} 0 1 0 {f(-2 * r)} 0Z'


def lobe(x, y, r, rng):
    """A lobe as the circles of its outline: its body, and on its upper
    rim smaller billows breaking out of it, bigger toward its crest."""
    out = [(x, y, r)]
    n = rng.randint(4, 6)
    for j in range(n):
        a = math.pi * (1.08 + 0.84 * (j + rng.uniform(0.2, 0.8)) / n)
        rr = r * rng.uniform(0.34, 0.5) * (1 - 0.35 * abs(math.cos(a)))
        dd = r - rr * rng.uniform(0.25, 0.6)
        out.append((x + math.cos(a) * dd, y + math.sin(a) * dd, rr))
    return out


def union(circles):
    """Circles as one path, all wound alike, so it fills their union."""
    return ''.join(disc(x, y, r) for x, y, r in circles)


def peak(shape, left, foot, w, op, sun, uid, rng):
    """One tower in the frame: lit as one form, from the sun's side to the
    shade at its foot away from it; its lobes laid from the crown down,
    each first laying its shade, soft, on the lobes behind it round its
    rim (the crevice), then its body in the tower's light, then its own
    far side a shade deeper. The crevices fall only between lobes, so the
    tower reads as a few great billows, each billowed at its edge."""
    lobes = [lobe(left + x * w, foot + y * w, r * w, rng) for x, y, r in shape]
    bl = [c for lb in lobes for c in lb]
    x0 = min(x - r for x, y, r in bl)
    x1 = max(x + r for x, y, r in bl)
    y0 = min(y - r for x, y, r in bl)
    cx, cy = (x0 + x1) / 2, (y0 + foot) / 2
    R = max(x1 - x0, foot - y0) / 2
    lx, ly = sun[0] - cx, sun[1] - cy
    d = math.hypot(lx, ly)
    lx, ly = lx / d, ly / d
    c = INK
    gid = f'{uid}Cu{int(left)}'
    defs = (f'<radialGradient id="{gid}" cx="{f(cx + lx * R * 0.5)}" cy="{f(cy + ly * R * 0.5)}" r="{f(R * 1.45)}" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{c["light"]}"></stop><stop offset="0.34" stop-color="{c["light"]}"></stop>'
            f'<stop offset="0.5" stop-color="{c["light_far"]}"></stop><stop offset="0.64" stop-color="{c["shade"]}"></stop>'
            f'<stop offset="1" stop-color="{c["shade_far"]}"></stop></radialGradient>'
            # a lobe's far side, deepening away from the light
            f'<linearGradient id="{gid}C" x1="{f(0.5 + 0.5 * lx)}" y1="{f(0.5 + 0.5 * ly)}" x2="{f(0.5 - 0.5 * lx)}" y2="{f(0.5 - 0.5 * ly)}">'
            f'<stop offset="0.35" stop-color="{c["crease"]}" stop-opacity="0"></stop><stop offset="1" stop-color="{c["crease"]}"></stop></linearGradient>'
            f'<filter id="{gid}B" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="{f(w * 0.016)}"></feGaussianBlur></filter>'
            f'<linearGradient id="{gid}F" x1="0" y1="{f(foot)}" x2="0" y2="{f(foot - (foot - y0) * 0.5)}" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{c["deep"]}" stop-opacity="0.7"></stop>'
            f'<stop offset="1" stop-color="{c["deep"]}" stop-opacity="0"></stop></linearGradient>'
            f'<linearGradient id="{gid}H" x1="0" y1="{f(foot)}" x2="0" y2="{f(foot - (foot - y0) * 0.3)}" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{c["haze"]}" stop-opacity="0.8"></stop>'
            f'<stop offset="1" stop-color="{c["haze"]}" stop-opacity="0"></stop></linearGradient>')
    out = []
    for lb in sorted(lobes, key=lambda lb: lb[0][1] - lb[0][2] * 0.3):
        x, y, r = lb[0]
        s = max(0.0, min(1.0, 0.5 + 0.7 * ((x - cx) * lx + (y - cy) * ly) / R))
        u = union(lb)
        out.append(f'<path d="{u}" fill="{c["crease"]}" opacity="{f(0.75 - 0.35 * s)}" filter="url(#{gid}B)" '
                   f'transform="translate({f(-lx * r * 0.08)} {f(-ly * r * 0.08)})"></path>')
        out.append(f'<path d="{u}" fill="url(#{gid})"></path>')
        out.append(f'<path d="{u}" fill="url(#{gid}C)" opacity="{f(0.42 - 0.22 * s)}"></path>')
    sil = union(bl)
    # the shade laid round each rim stays on the cloud, never on the sky
    return (f'<defs>{defs}<clipPath id="{gid}K"><path d="{sil}"></path></clipPath></defs>'
            f'<g opacity="{f(op)}"><g clip-path="url(#{gid}K)">{"".join(out)}</g>'
            f'<path d="{sil}" fill="url(#{gid}F)"></path><path d="{sil}" fill="url(#{gid}H)"></path></g>')


def thunderhead(L, h, o, hour, uid):
    """雲の峰: the summer's cloud peak behind the far hills, and a lower
    one beyond Fuji's flank, lit from the sun the dial stands in."""
    if not o.get('thunderhead'):
        return ''
    rng = random.Random(L.seed + 521)
    out = []
    for shape, left, foot, w, op in TOWERS[L.W]:
        out.append(f'<g class="f5-rise" style="{anim(rng.uniform(13, 17), rng.uniform(0, 13))}">'
                   f'{peak(shape, left, foot, w, op, (L.cx, L.cy), uid, rng)}</g>')
    return ''.join(out)


def cloud_layout(L, hour, o):
    """The hour's clouds, less any of the print's flat banks the towers
    would stand in front of or behind: a bank cut by a tower reads as a
    slip of the knife, not as weather."""
    L = s1_air.cloud_layout(L, hour, o)
    if not o.get('thunderhead'):
        return L
    boxes = []
    for shape, left, foot, w, op in TOWERS[L.W]:
        top = foot + min(y - r for x, y, r in shape) * w
        right = left + max(x + r for x, y, r in shape) * w
        boxes.append((left - w * 0.2, top - w * 0.12, right, foot))
    keep = [c for c in L.cloud_sets.get(hour, [])
            if not any(c[0] < x1 and c[0] + c[2] > x0 and c[1] + c[3] > y0 and c[1] < y1 for x0, y0, x1, y1 in boxes)]
    return dataclasses.replace(L, cloud_sets={**L.cloud_sets, hour: keep})


# 花火 on the desk: round 1 set them under the dial, where they burst
# behind its lines (1.6:1); here they open beside them, over the bay
# and in front of Fuji, clear of the lines and of the services' board
FIREWORKS = {**s1_air.FIREWORKS, 1184: [
    (652, 500, 62, '#ffd27a', 4.6), (300, 572, 34, '#ff8a7a', 5.9), (110, 560, 40, '#bff0a8', 7.3), (880, 574, 40, '#f4f0ff', 8.1)]}


@contextlib.contextmanager
def _fireworks():
    saved = s1_air.FIREWORKS
    s1_air.FIREWORKS = FIREWORKS
    try:
        yield
    finally:
        s1_air.FIREWORKS = saved


def fireworks(L, h, o, hour, uid):
    with _fireworks():
        return s1_air.fireworks(L, h, o, hour, uid)


def fireworks_mirror(L, h, o, hour, uid):
    with _fireworks():
        return s1_air.fireworks_mirror(L, h, o, hour, uid)


def snowfall(L, o):
    """暮雪, the evening snow, as round 1 drew it (s1_air.snowfall), each
    falling group marked as a flake rather than the crowd wrapped in a
    group of its own: in the app a marked group is lifted as a moving box
    (liftPrint.js), and the wrapper would be a box with nothing to move.
    Under reduced motion the flakes stay, the view itself (index.css,
    .tpr-flake)."""
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
            out.append(f'<g class="f5-fall s1-flake" style="--dx: {f(-depth * 0.18)}px; --dy: {f(depth * 0.75)}px; {anim(dur, dur * g / n + rng.uniform(0, 2))}">'
                       f'<g class="s1-sway" style="--sx: {f((2 + layer * 2) * k)}px; {anim(rng.uniform(3.5, 5.5), rng.uniform(0, 5))}">'
                       f'<path d="{"".join(flakes)}" fill="{o["cap"]}" opacity="{f(op)}"></path></g></g>')
    return ''.join(out)
