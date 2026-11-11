"""S² · the summer's cloud peak, and what falls close to the eye (plan
261, the canvas "Tsuji — Today, the seasons", round 2).

- 雲の峰: round 1 piled circles into a tower and drew each one lit and
  shaded, so the cloud read as a heap of balls. It is now the print's
  own cloud (scene_f5.cloud_path: a flat underside, a top of soft
  lobes) stacked in tiers, each narrower and taller-lobed than the one
  under it, each lit along its lobes and grey-blue under them, the side
  away from the light a shade deeper: the billows read where one tier
  rises over the next, as the prints draw a cloud peak.
- What falls is fuller: twice the petals and leaves of round 1, from the
  tree's crown across the bay; and a few falling close to the eye, large,
  soft at the edge, tumbling across the whole print on the wind, far
  apart in time, so the vibe is there and the print stays the print."""
import random
from geo import f
from scene_f4 import anim
from scene_f5 import cloud_path
from brush import momiji
from el7 import mix
from s1_air import _faller, petal

# ── 雲の峰, the cloud peak ───────────────────────────────────────────

TOWERS = {
    # each tower its billows, from its head down to its foot, each a bank
    # (x, y, width, lobe height, lobes): the head's few and tall, the
    # body's overlapping and leaning as the tower rises, the foot wide
    390: [
        [(30, 382, 84, 30, 3), (6, 398, 72, 28, 2), (60, 396, 76, 28, 3), (-12, 416, 98, 28, 3), (66, 414, 88, 26, 3),
         (-26, 436, 122, 26, 4), (82, 434, 98, 24, 3), (-36, 456, 216, 22, 6)],
        [(356, 436, 64, 22, 2), (332, 452, 100, 20, 3)],
    ],
    1184: [
        [(70, 476, 170, 58, 3), (20, 506, 146, 52, 2), (124, 502, 154, 54, 3), (-14, 542, 196, 54, 3), (140, 538, 178, 50, 3),
         (-40, 580, 246, 50, 4), (172, 576, 200, 46, 3), (-60, 618, 440, 42, 6)],
        [(984, 566, 140, 42, 2), (924, 594, 230, 36, 3), (880, 620, 320, 30, 5)],
    ],
}
PEAK_INK = dict(top='#ffffff', mid='#f6f8fc', under='#c2cfe3', shade='#90a5c6')


def thunderhead(L, h, o, hour, uid):
    if not o.get('thunderhead'):
        return ''
    rng = random.Random(L.seed + 511)
    c = PEAK_INK
    out = [f'<defs><linearGradient id="{uid}Peak" x1="0.75" y1="0" x2="0.35" y2="1">'
           f'<stop offset="0" stop-color="{c["top"]}"></stop><stop offset="0.48" stop-color="{c["mid"]}"></stop>'
           f'<stop offset="1" stop-color="{c["under"]}"></stop></linearGradient>'
           f'<linearGradient id="{uid}PeakShade" x1="0" y1="0" x2="1" y2="0">'
           f'<stop offset="0" stop-color="{c["shade"]}" stop-opacity="0.38"></stop>'
           f'<stop offset="0.55" stop-color="{c["shade"]}" stop-opacity="0"></stop></linearGradient></defs>']
    for tiers in TOWERS[L.W]:
        bank = []
        for x, y, w, hh, lobes in tiers:
            d = cloud_path(x, y, w, hh, rng, lobes, floor=0.42)
            # each tier lit along its lobes, its body shading under them,
            # the side away from the light a shade deeper
            bank.append(f'<path d="{d}" fill="url(#{uid}Peak)"></path><path d="{d}" fill="url(#{uid}PeakShade)"></path>')
        out.append(f'<g class="f5-rise" style="{anim(rng.uniform(13, 17), rng.uniform(0, 13))}">{"".join(bank)}</g>')
    return f'<g opacity="0.97">{"".join(out)}</g>'


# ── what falls ─────────────────────────────────────────────────────

def _spread(L, n, seed, x0, x1, y0, y1, dx, dy):
    """n starting points over the crown and the air beside it, each with
    its drift, the wind carrying everything left and down."""
    rng = random.Random(seed)
    out = []
    for _ in range(n):
        out.append((rng.uniform(x0, x1), rng.uniform(y0, y1), dx * rng.uniform(0.7, 1.3), dy * rng.uniform(0.8, 1.2)))
    return out


def petals(L, o):
    """花吹雪, fuller: petals off the cherry and across the bay, in the
    blossom's three pinks and its white."""
    rng = random.Random(L.seed + 601)
    if L.W < 600:
        pts = _spread(L, 18, L.seed + 603, 150, 400, 420, 540, -150, 190)
        k = 1.0
    else:
        pts = _spread(L, 22, L.seed + 603, 700, 1190, 560, 720, -320, 230)
        k = 1.5
    lit, mid, shade = o['bloom']
    inks = (lit, mid, mix(lit, '#ffffff', 0.45), mix(mid, shade, 0.4))
    out = []
    for j, (x, y, dx, dy) in enumerate(pts):
        dur = rng.uniform(11, 17)
        out.append(_faller(x, y, dx, dy, dur, dur * j / len(pts) + rng.uniform(0, 2), petal(rng.uniform(2.2, 3.0) * k),
                           inks[j % 4], rng))
    return ''.join(out)


def leaves(L, o):
    """The maple's leaves let go, fuller: from its crown, in its reds,
    its orange and its gold."""
    rng = random.Random(L.seed + 611)
    if L.W < 600:
        pts = _spread(L, 12, L.seed + 613, 200, 400, 440, 540, -150, 200)
        s = 0.26
    else:
        pts = _spread(L, 14, L.seed + 613, 760, 1190, 580, 720, -300, 240)
        s = 0.38
    bright, mid, deep = o['maple']
    inks = (bright, mid, '#e08a2c', '#d9a23a', deep)
    out = []
    for j, (x, y, dx, dy) in enumerate(pts):
        dur = rng.uniform(13, 19)
        outline, _, _ = momiji(s * rng.uniform(0.85, 1.15))
        out.append(_faller(x, y, dx, dy, dur, dur * j / len(pts) + rng.uniform(0, 2), outline, inks[j % 5], rng))
    return ''.join(out)


CLOSE = {
    # (x, y) where each enters, above the frame's top or off its right
    # edge, how far it travels while it falls, and how near the eye it
    # passes (1 nearest: largest and softest)
    390: [(330, -60, -280, 860, 1.0), (440, 110, -400, 720, 0.55), (230, -80, -240, 900, 0.75),
          (440, 330, -440, 520, 0.9), (380, -70, -320, 880, 0.45)],
    1184: [(900, -90, -640, 1060, 1.0), (1260, 150, -920, 900, 0.55), (600, -100, -540, 1080, 0.8),
           (1260, 420, -840, 640, 0.9), (1080, -90, -720, 1060, 0.5), (760, -90, -600, 1060, 0.65)],
}


def close(L, h, o, hour, uid):
    """A few petals (or leaves) close to the eye: large, soft at the
    edge as what is near the lens is, tumbling across the whole print on
    the wind, each far from the next in time, so one or two are seen at
    once. In front of everything the print draws; the gate's dial and
    lines stand over them, as over the rest of the print."""
    kind = o.get('close')
    if not kind:
        return ''
    rng = random.Random(L.seed + 641)
    k = 1.0 if L.W < 600 else 1.6
    out, blurs = [], set()
    for j, (x, y, dx, dy, near) in enumerate(CLOSE[L.W]):
        dur = rng.uniform(15, 22) * (1.15 - 0.3 * near)
        delay = dur * j / len(CLOSE[L.W]) + rng.uniform(0, 3)
        b = round(0.5 + 1.5 * near, 1)
        blurs.add(b)
        if kind == 'petals':
            lit, mid, shade = o['bloom']
            col = (mix(lit, '#ffffff', 0.25), mid, lit, mix(mid, shade, 0.3), lit)[j % 5]
            shape = petal(rng.uniform(18, 24) * (0.6 + 0.5 * near) * k)
            vein = ''
        else:
            bright, mid, deep = o['maple']
            col = (bright, '#e08a2c', mid, '#d9a23a', bright)[j % 5]
            shape, veins, _ = momiji(rng.uniform(1.15, 1.4) * (0.6 + 0.5 * near) * k)
            vein = f'<path d="{veins}" fill="none" stroke="{mix(col, deep, 0.55)}" stroke-width="{f(1.1 * k)}" stroke-linecap="round" opacity="0.6"></path>'
        out.append(f'<g class="f5-fall" style="--dx: {f(dx)}px; --dy: {f(dy)}px; {anim(dur, delay)}">'
                   f'<g transform="translate({f(x)} {f(y)}) scale(3.4)"><g class="f5-swing" style="{anim(rng.uniform(2.8, 3.6), rng.uniform(0, 3.6))}">'
                   f'<g transform="scale({f(1 / 3.4)})"><g class="f5-spin" style="{anim(rng.uniform(3.2, 4.6), rng.uniform(0, 4))}">'
                   f'<g filter="url(#{uid}Near{str(b).replace(".", "_")})" opacity="{f(0.95 - 0.12 * near)}"><path d="{shape}" fill="{col}"></path>{vein}</g></g></g></g></g></g>')
    filters = ''.join(f'<filter id="{uid}Near{str(b).replace(".", "_")}" x="-30%" y="-30%" width="160%" height="160%">'
                      f'<feGaussianBlur stdDeviation="{f(b * k)}"></feGaussianBlur></filter>' for b in sorted(blurs))
    return f'<defs>{filters}</defs>{"".join(out)}'
