"""川 the river and its avenue (plan 309).

The river comes down from under Fuji to the viewer's feet, widening as
it comes, between two levees (土手), each its inner slope down to the
water in three tones and its crest lit, white in the snow; the plain
beyond them in its bokashi, mist lying on it; far up the river the line
crosses it on the bay's own stone bridge (el7.bridge7) at 0.36 of its
size, its train on it; boats on the water, scene_f6.water clipped to
the river's course in place of the bay. A river winds where a road runs
straight: out from under the bridge it bends right, then left, and back
as it nears. Fuji is small and far, its summit at (195, 358), its foot
at 430, the horizon at 432.

Down each bank the season's tree stands five times (桜堤), from 0.12 to
0.78 of its size, as far off as perspective puts each: each bank's tree
drawn once and placed again with <use>, sharing the print's uid, so the
night's lanterns keep their gradients; the nearest pair's crowns at the
column's two edges, above the feed's caption; the trees and the levees
again in the water, turned over and faint. The flowers and the pampas
fill the corners under the caption. In spring the cherries, their
lanterns lit all down the avenue at night (夜桜); in summer the crape
myrtle and the fireflies over the water; the maples in autumn; the
plums on white banks in winter, with the evening snow at dusk. August's
fireworks open above the far banks on both sides of Fuji, and their
light lies on the river.

    river(season, hour, variant=None) -> dict(layers, run, band, L)

as lake.lake, from common's parts alone. Units are the phone's (390 x
746); the challenge shows the top 693 at 2.769 px a unit, then raises
the print 52.7 units for the reading."""
import dataclasses
import random

import common
from common import UID, f
import s1_air
import s1_scene
import s2_air
import s5_fore
from fuji import Fuji
from layouts import PHONE
from scene_f3 import smooth
from scene_f4 import anim
from scene_f5 import clouds, gust
from scene_f6 import fog, fleet, mix, ridges, water
from el7 import boats7, bridge7, bridge_defs, catenary7, reflections7

# the river's country, in the print's units: Fuji small and far over the
# middle, its summit under the hook's plate (991 px), the far hills over
# its foot, the horizon at 432; the water from the bridge's foot to the
# frame's, its rows opening out toward the viewer as a river's do
RIVER = dataclasses.replace(
    PHONE, cx=195, cy=150, disc_r=34, halo_r=40, fare_r=46, horizon=432,
    fuji=(195, 358, 430, 140), hills=(414, 426), water=(446, 746), wall=(746, 746), viaduct=(560, 600), ground=746,
    rows=11,
    fog=[(112, 398, 172, 10, 0, 0.55, 0), (-80, 406, 220, 9, 1, 0.45, 0), (214, 410, 220, 8, 1, 0.4, 1),
         (10, 424, 250, 6, 0, 0.34, 2), (196, 428, 210, 5, 1, 0.3, 2)],
    cloud_sets={
        'dawn': [(-34, 80, 150, 14), (238, 44, 168, 16), (-26, 262, 104, 11), (300, 280, 110, 11)],
        'day': [(-34, 84, 158, 16), (236, 42, 178, 18), (-26, 268, 108, 12), (296, 284, 116, 12)],
        'dusk': [(-44, 64, 176, 9), (236, 94, 150, 8)],
        'night': [(-34, 74, 176, 9), (258, 280, 150, 8)],
    },
    # the boats down the middle of the river, smaller as it narrows
    boats=[(206, 494, 0.34), (190, 548, 0.48), (178, 612, 0.66)],
    lone_boats=[(200, 524, 0.44), (176, 576, 0.56)],
    star_box=(0, 40, 390, 396),
    geese_path=((-70, 380), (440, 404), 30), cranes_path=((440, 50), (-170, 30), 40),
)
# the light's road on the river spread as the ripples spread the bay's,
# not a line of glints down its middle
ROAD_R = 110
# the river's course down the print: (y, its middle, its width), out
# from under the bridge to the right, then a long bend to the left and
# back as it nears, widening to the frame's foot: a river winds, where a
# road runs straight
COURSE = [(446, 195, 16), (472, 204, 26), (502, 210, 40), (534, 200, 58), (566, 180, 80), (600, 168, 108),
          (640, 174, 150), (690, 196, 236), (746, 206, 400)]
# the far line's bridge: the bay's, 0.36 of its size, its top at 434
BRIDGE_K = 0.36
DECK = 434
# the avenue: the season's tree five times down each bank, each as large
# as its depth makes it (its foot 362 units under the horizon at full
# size); the crape myrtle, whose crown stands the tallest, smaller again
AVENUE = (0.12, 0.2, 0.32, 0.5, 0.78)
DEPTH = 362
TREE_FOOT = (370, 712)  # the season's tree stands here on the bay's print
TREE_K = {'sarusuberi': 0.82}
SHARED = ('sarusuberi',)
# the water shortens what it holds, as still water does
MIRROR = 0.8
# mist lying on the plain beside the river, banks of the bay's fog (x, y,
# width, height, ink, opacity, layer)
MIST = [(-60, 452, 210, 7, 0, 0.42, 3), (236, 456, 220, 7, 1, 0.38, 3), (-80, 482, 190, 9, 1, 0.3, 3),
        (276, 488, 170, 9, 0, 0.28, 3)]
# the meadow (s5_fore.FORE's layout): the flowers and the pampas in the
# corners, on the levees' slopes
RIVER_FORE = dict(
    base=1.0, front=680, shade=[], carpet=(-400, 2000, 1, 1), foot=None, foot_kacho=None,
    flowers=[(14, 716, 1.0, 6), (4, 742, 0.85, 4), (380, 712, 1.0, 6), (392, 742, 0.85, 4)],
    pampas=[(2, 734, 1.05, 6), (390, 730, 1.0, 6)],
    far=[],
)
# spring dawn's thin bands (s1_air.THIN), the first drawn short of the
# disc the challenge sets in the sky, as the lake's
THIN = [(-40, 94, 176, 6)] + s1_air.THIN[390][1:]
# August's fireworks above the far banks, either side of Fuji
FIREWORKS = [(66, 396, 24, '#ffd27a', 4.6), (322, 388, 22, '#ff8a7a', 5.9), (104, 418, 12, '#bff0a8', 7.3),
             (288, 420, 11, '#f4f0ff', 8.1)]


# ── the river's course ─────────────────────────────────────────────

def course_at(y):
    """The river's middle and width at y, between the course's points."""
    for (ya, ca, wa), (yb, cb, wb) in zip(COURSE, COURSE[1:]):
        if ya <= y <= yb:
            t = (y - ya) / (yb - ya)
            return ca + (cb - ca) * t, wa + (wb - wa) * t
    _, c, w = COURSE[0] if y < COURSE[0][0] else COURSE[-1]
    return c, w


def near(y):
    """How near a point of the ground is: 0 at the horizon, 1 at the
    frame's foot (s5_fore._near's measure, unclamped)."""
    return max(0.0, (y - RIVER.horizon) / (RIVER.H - RIVER.horizon))


def banks(off=lambda y: 0.0):
    """The two banks, left and right, as points down the course, each
    moved out from the water by off(y)."""
    left = [(c - w / 2 - off(y), y) for y, c, w in COURSE]
    right = [(c + w / 2 + off(y), y) for y, c, w in COURSE]
    return left, right


def bank_x(pts, y):
    """Where a bank's line (points down the course) stands at y."""
    for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
        if ya <= y <= yb:
            return xa + (xb - xa) * (y - ya) / (yb - ya)
    return pts[-1][0]


def slope(y):
    """How wide a levee's inner slope shows at y, wider as it nears."""
    return 1.6 + 20 * near(y)


def band(inner, outer):
    """The strip between two lines down the course, as one shape."""
    return f'{smooth(inner)} L{smooth(outer[::-1])[1:]} Z'


# ── the land ───────────────────────────────────────────────────────

def land(L, h, s, o, hour, uid):
    """The plain from the horizon to the frame's foot, in its bokashi
    (misty far off, the season's ground near), the river cut in it; the
    two levees along it, each its inner slope in three tones (lit under
    the crest, the grass, the wet foot) and the crest catching the
    light, white in the snow. Returns its defs, the plain, the levees,
    and the water's edge (it goes over the water): each levee held in
    the water along its foot, and the water lapping it."""
    g = h['ground']
    snow = o.get('crowns') == 'snow'
    far = mix(h['hill_near'], s['fog'][0], 0.3)
    left, right = banks()
    out_l, out_r = banks(slope)
    # the plain beyond each crest, for the grass that grows on it
    head = L.horizon + 12
    plain_l = f'M-40 {head} L{f(out_l[0][0])} {head} L{smooth(out_l)[1:]} L-40 {L.H + 10} Z'
    plain_r = f'M{L.W + 40} {head} L{f(out_r[0][0])} {head} L{smooth(out_r)[1:]} L{L.W + 40} {L.H + 10} Z'
    defs = (f'<clipPath id="{uid}River"><path d="{band(left, right)}"></path></clipPath>'
            f'<clipPath id="{uid}Plain"><path d="{plain_l}{plain_r}"></path></clipPath>'
            f'<linearGradient id="{uid}Floor" x1="0" y1="{f(L.horizon)}" x2="0" y2="{L.H}" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{far}"></stop><stop offset="0.3" stop-color="{mix(g, far, 0.55)}"></stop>'
            f'<stop offset="0.7" stop-color="{mix(g, far, 0.2)}"></stop><stop offset="1" stop-color="{g}"></stop></linearGradient>')
    plain = f'<rect y="{f(L.horizon)}" width="{L.W}" height="{f(L.H - L.horizon)}" fill="url(#{uid}Floor)"></rect>'
    dark, mid, lit = s5_fore._grass_inks(h, o, hour)
    if snow:
        face, top, foot, crest = mix(g, '#3c4a74', 0.12), mix(g, '#ffffff', 0.4), mix(g, '#3c4a74', 0.3), o['cap']
    else:
        face, top, foot, crest = mix(g, mid, 0.5), mix(g, lit, 0.5), mix(g, dark, 0.6), lit
    levees = []
    for bank, out in ((left, out_l), (right, out_r)):
        side = -1 if bank is left else 1
        # the face, the light along its upper third, the wet along its foot
        upper = [(x - side * 0.62 * slope(y), y) for x, y in out]
        lower = [(x + side * (0.5 + 0.12 * slope(y)), y) for x, y in bank]
        ridge = [(x + side * (0.3 + 1.6 * near(y)), y) for x, y in out]
        levees.append(f'<path d="{band(bank, out)}" fill="{face}"></path>'
                      f'<path d="{band(upper, out)}" fill="{top}"></path>'
                      f'<path d="{band(bank, lower)}" fill="{foot}"></path>'
                      f'<path d="{band(out, ridge)}" fill="{crest}" opacity="{f(0.95 if snow else 0.8)}"></path>')
    # each levee in the water along its foot: its face, turned over
    held = mix(face, s['near'], 0.45)
    inner_l = [(x + 0.5 * slope(y), y) for x, y in left]
    inner_r = [(x - 0.5 * slope(y), y) for x, y in right]
    shade = (f'<g clip-path="url(#{uid}River)"><g fill="{held}" opacity="0.42" filter="url(#f6Smear)">'
             f'<path d="{band(left, inner_l)}"></path><path d="{band(right, inner_r)}"></path></g></g>')
    edge = (f'<g class="f6-lap" style="{anim(3.2, 1)}" fill="none" stroke="{s["wet"]}" stroke-opacity="0.4" stroke-width="0.7" '
            f'stroke-linecap="round"><path d="{smooth(left)}"></path><path d="{smooth(right)}"></path></g>')
    return defs, plain, ''.join(levees), shade + edge


def bank_grass(L, h, o, hour, seed):
    """Grass along the water's edge, down both banks, leaning out over
    the water and larger as it nears, in the meadow's grass inks; fewer
    blades and dry in the snow."""
    rng = random.Random(L.seed + seed)
    inks = s5_fore._grass_inks(h, o, hour)
    snow = o.get('crowns') == 'snow'
    blades = {c: [] for c in inks}
    left, right = banks()
    for pts, side in ((left, -1), (right, 1)):
        y = COURSE[0][0] + 6
        while y < L.H + 4:
            n = near(y)
            if rng.random() < (0.5 if snow else 0.25):
                y += 2 + 10 * n
                continue
            x = bank_x(pts, y)
            for j in range(rng.randint(3, 6)):
                blades[inks[j % 3]].append(s5_fore._blade(x + side * rng.uniform(-0.6, 2.4) * (0.4 + 3 * n), y + rng.uniform(-0.3, 0.6),
                                                          rng.uniform(2, 6) * (0.3 + 2.6 * n) * (0.7 if snow else 1),
                                                          -side * rng.uniform(0.05, 0.6), rng.uniform(0.7, 1.1) * (0.3 + 1.8 * n)))
            y += (1.5 + 9 * n) * rng.uniform(0.7, 1.3)
    return ''.join(f'<path d="{"".join(ds)}" fill="{c}"></path>' for c, ds in blades.items() if ds)


# ── the far line ───────────────────────────────────────────────────

def far_bridge(L, s, h, o, air, hour, uid):
    """The line far up the river: the bay's stone bridge across the
    valley, 0.36 of its size, its top at DECK, its parapet's snow in
    winter; and the masts and wires over it (behind the train). Returns
    the bridge's defs, the bridge and the masts."""
    k = BRIDGE_K
    Lb = dataclasses.replace(L, W=int(L.W / k) + 40, viaduct=(100, 140))
    Lm = dataclasses.replace(L, W=int(L.W / k) + 80, viaduct=(100, 140))
    at = f'translate(-6 {f(DECK - k * 100)}) scale({f(k)})'
    return (bridge_defs(Lb, s, h, hour, uid),
            f'<g transform="{at}">{bridge7(Lb, s, h, hour, uid)}{air.snow_line(Lb, o, "bridge")}</g>',
            f'<g transform="translate(-14 {f(DECK - k * 100)}) scale({f(k)})">{catenary7(Lm, h, hour, 30)}</g>')


# ── the avenue ─────────────────────────────────────────────────────

def avenue(L, h, o, hour, flora, uid):
    """桜堤: the season's tree down each levee's crest, five times a bank,
    the farthest first: each bank's tree drawn once (the nearest), at
    the bay's place, and placed again down the bank with <use>, turned
    on the left bank to lean over the water as the right's does; drawn
    with the print's uid, so whatever it points into (the lanterns'
    glow) is the shared defs'. The crape myrtle, the heaviest of the
    trees, is cut once for both banks. Returns the avenue, and its
    reflection in the river: each tree again, turned over at the water
    under its foot and shortened, softened and faint."""
    k0 = TREE_K.get(o.get('tree'), 1.0)
    out_l, out_r = banks(slope)
    shared = o.get('tree') in SHARED
    placed, mirrored = [], []
    for side, seed, flip in (('L', 13, True), ('R', 34, False)):
        cut = 'R' if shared else side
        body = '' if cut != side else flora.tree(dataclasses.replace(L, seed=L.seed + seed), h, o, hour, gust, UID)
        crest = out_l if flip else out_r
        for j, kk in enumerate(AVENUE):
            y = L.horizon + DEPTH * kk
            at = (bank_x(crest, y), y)
            again = f'<use href="#{uid}Tree{cut}"></use>'
            part = f'<g id="{uid}Tree{side}">{body}</g>' if body and j == len(AVENUE) - 1 else again
            placed.append((y + (0.5 if side == 'R' else 0), common.turned(part, TREE_FOOT, at, kk * k0, flip=flip)))
            # the water under the foot: the levee's height below it
            yw = y + 1 + 0.5 * slope(y)
            mirrored.append(f'<g transform="matrix(1 0 0 {f(-MIRROR)} 0 {f((1 + MIRROR) * yw)})">'
                            f'{common.turned(again, TREE_FOOT, at, kk * k0, flip=flip)}</g>')
    trees = ''.join(svg for _, svg in sorted(placed, key=lambda p: p[0]))
    return trees, ''.join(mirrored)


# ── the print ──────────────────────────────────────────────────────

def river_water(L, h, s, o, far, near_, hour, uid):
    """scene_f6.water, the bay's surface, clipped to the river's course,
    its light's road spread as wide as the bay's ripples spread it.
    August's night has no moon (the fireworks are its light): its road
    is laid off the print."""
    Lw = dataclasses.replace(L, disc_r=ROAD_R, cx=-L.W if o.get('fireworks') else L.cx)
    surface = water(Lw, h, s, far, near_, hour, [], grouped=True)
    return surface.replace('clip-path="url(#f6Bay)"', f'clip-path="url(#{uid}River)"', 1)


def mirrored_bursts(L, h, o, hour, air):
    """Each burst's light on the river: fireworks_mirror's own, moved
    over the water nearest under it (the river is narrow where its
    light would fall), at the depth the mirror puts it."""
    spots = []
    for x, y, r, col, dur in FIREWORKS:
        my = L.water[0] + (L.water[0] - y) * 0.42
        c, w = course_at(my)
        spots.append((min(max(x, c - w / 2 + r * 0.3), c + w / 2 - r * 0.3), y, r, col, dur))
    with common.fireworks_at(spots):
        return air.fireworks_mirror(L, h, o, hour, UID)


def river(season, hour, variant=None):
    """One print of the river: its four layers, the train's run, and the
    rows the train layer takes."""
    L = RIVER
    uid = 'rv'
    sky = common.sky(L, season, hour, variant)
    with common.inside(season, hour, variant) as c, common.fore(RIVER_FORE), common.fireworks_at(FIREWORKS), \
            common.swapped((s1_air.THIN, 390, THIN)):
        air, flora, h, s, o = c.air, c.flora, c.h, c.s, c.o
        fj = Fuji(*L.fuji)
        far, near_ = ridges(L)
        Lc = air.cloud_layout(L, hour, o)
        birds = air.flight(L, h, o, hour)
        fleet_ = fleet(L, h)
        ldefs, plain, levees, shore = land(L, h, s, o, hour, uid)
        bdefs, bridge, masts = far_bridge(L, s, h, o, air, hour, uid)
        # the hills close just under the horizon, on the plain
        Lh = dataclasses.replace(L, water=(L.horizon + 6, L.water[1]))
        back = (f'<defs>{ldefs}{bdefs}</defs>'
                f'<g class="f5-clouds">{clouds(Lc, hour)}</g>'
                f'{air.thunderhead(L, h, o, hour, UID)}'
                f'{birds if h["birds"] == "cranes" else ""}'
                f'{c.fuji(fj, h["fuji"], UID + "Fj", L.seed, o.get("snow", 0.27))}'
                f'{plain}'
                f'{fog(L, s, 0)}{s1_scene.hills_far_s(Lh, h, s, far, o, hour)}{fog(L, s, 1)}'
                f'{s1_scene.hills_near_s(Lh, h, s, near_, o, hour)}{fog(L, s, 2)}'
                f'{air.fireworks(L, h, o, hour, UID)}'
                f'{river_water(L, h, s, o, far, near_, hour, uid)}'
                f'<g clip-path="url(#{uid}River)">{reflections7(fleet_, hour, UID, anim, grouped=True)}'
                f'{mirrored_bursts(L, h, o, hour, air)}</g>'
                f'{levees}{shore}{fog(dataclasses.replace(L, fog=MIST), s, 3)}'
                f'{masts}'
                f'{birds if h["birds"] not in ("cranes", None) else ""}'
                f'{air.fireflies(dataclasses.replace(L, hills=(L.hills[0], 444), water=(446, 540)), h, o, hour, "far")}')
        train, run, band_ = common.small_train(L, h, s, hour, BRIDGE_K, DECK - 0.4 * BRIDGE_K, uid=uid)
        trees, mirrored = avenue(L, h, o, hour, flora, uid)
        front = (bridge
                 + f'<g clip-path="url(#{uid}River)"><g opacity="0.34" filter="url(#f6Smear)">{mirrored}</g></g>'
                 + boats7(fleet_, s, hour, UID, anim)
                 + f'<g clip-path="url(#{uid}Plain)">{s5_fore.tufts(L, h, o, hour, L.horizon + 20, L.H, 46, 761)}</g>'
                 + bank_grass(L, h, o, hour, 931)
                 + trees
                 + flora.bank(L, h, o, hour, gust, anim)
                 + air.falls(L, h, o, hour) + s2_air.close(L, h, o, hour, UID)
                 + air.fireflies(L, h, o, hour, 'near'))
    return dict(layers=(sky, back, train, front), run=run, band=band_, L=L)
