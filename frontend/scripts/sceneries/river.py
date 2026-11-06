"""川 the river and its avenue (plan 309).

The river comes down from under Fuji to the viewer's feet, winding and
widening as it comes, between two levees (土手); far up it the line
crosses on the bay's own stone bridge (el7.bridge7) at 0.36 of its size,
its train on it, the river going on through the arch it runs under,
narrowing away (at night in the arch's shade). Fuji is small and far,
its summit at (195, 358), its foot at 430, the horizon at 432.

The water is the bay's (scene_f6.water) clipped to the river's course,
its rows as close under the bridge as the bay's under its far shore,
opening out toward the viewer, and the sky held in it under its
ripples: the sky turned over at the horizon, its glow far up the river
and the higher sky nearer, held less as the water is seen more from
above, so that at dawn and dusk the river is a ribbon of the sky's light
through the dark land; in the snow it keeps the dark of the view under
its white banks, as the prints keep it. The light's road lies on it
under the disc, broken as the bay's. Each levee runs down to a ragged
edge, the light along its slope, the wet at its foot and its lit crest
in stretches, in the snow the drifts with the earth showing at the
water; the water laps it in short strokes and holds it, and the trees
on it, faintly, the less as it nears and by day, their reflections the
shorter as the trees near.

Down each bank the season's tree stands five times (桜堤), from about
0.12 to 0.78 of its size, as far off as perspective puts each, the two
banks out of step but for the nearest pair (the crape myrtle's, one
tree for both banks, out of step too): each bank's tree drawn once with
the bay's tuft at its foot (the snow banked there in winter) and placed
again with <use>, sharing the print's uid, so the night's lanterns keep
their gradients; the nearest pair's crowns at the column's two edges,
above the feed's caption; the farthest stand in the haze over the
river's head, as the bay's far shore stands in its fog. What the trees
let fall gathers in the slack water along the left bank, drawn out down
it (花筏); the season's flowers grow at their feet and in the corners,
and boats ride the river. Wooded knolls stand on the plain in the
margins, their feet lost in its mist, a tree only where a knoll stands
taller than it; in the snow they keep the blue the snowy woods give the
hills. In spring the cherries, their lanterns lit at night (夜桜); in
summer the crape myrtle and the fireflies over the water; the maples in
autumn; the plums on white banks in winter, with the evening snow at
dusk. August's fireworks open above the far banks on both sides of
Fuji, the small ones outside the text's column; no water lies under any
of them, so the river holds none.

    river(season, hour, variant=None) -> dict(layers, run, band, L)

as lake.lake, from common's parts and the bay's. Units are the phone's
(390 x 746); the challenge shows the top 693 at 2.769 px a unit, then
raises the print 52.7 units for the reading."""
import dataclasses
import math
import random
import re

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
from scene_f6 import fog, fleet, mix, ridge_y, ridges, water
from el7 import boats7, bridge7, bridge_defs, catenary7, reflections7

# what the river shares with the lake (lake.py), written here rather than
# taken from it, so a change to the lake never moves the river: spring
# dawn's thin bands, the first drawn short of the disc the challenge sets
# in the sky, and where the season's tree stands on the bay's print
THIN = [(-40, 94, 176, 6)] + s1_air.THIN[390][1:]
TREE_FOOT = (370, 712)

# the river's country, in the print's units: Fuji small and far over the
# middle, its summit under the hook's plate (991 px), the far hills over
# its foot, the horizon at 432; the water from the bridge's foot to the
# frame's, in rows as close under the bridge as the bay's under its far
# shore, opening out toward the viewer (fewer, they lie across the river
# as rungs)
RIVER = dataclasses.replace(
    PHONE, cx=195, cy=150, disc_r=34, halo_r=40, fare_r=46, horizon=432,
    fuji=(195, 358, 430, 140), hills=(414, 426), water=(446, 746), wall=(746, 746), viaduct=(560, 600), ground=746,
    rows=30,
    fog=[(112, 398, 172, 10, 0, 0.55, 0), (-80, 406, 220, 9, 1, 0.45, 0), (214, 410, 220, 8, 1, 0.4, 1),
         (10, 424, 250, 6, 0, 0.34, 2), (196, 428, 210, 5, 1, 0.3, 2)],
    cloud_sets={
        'dawn': [(-34, 80, 150, 14), (238, 44, 168, 16), (-26, 262, 104, 11), (300, 280, 110, 11)],
        'day': [(-34, 84, 158, 16), (236, 42, 178, 18), (-26, 268, 108, 12), (296, 284, 116, 12)],
        'dusk': [(-44, 64, 176, 9), (236, 94, 150, 8)],
        'night': [(-34, 74, 176, 9), (258, 280, 150, 8)],
    },
    # the boats down the middle of the river, smaller as it narrows
    boats=[(206, 494, 0.4), (192, 546, 0.6), (180, 614, 0.85)],
    lone_boats=[(202, 524, 0.56), (174, 578, 0.72)],
    star_box=(0, 40, 390, 396),
    geese_path=((-70, 380), (440, 404), 30), cranes_path=((440, 50), (-170, 30), 40),
)
# the light's road on the river: the bay's glints about the line under
# the disc, a little narrower, the river being narrow
ROAD_R = 64
# how much of the sky the water holds, far up the river (where it is seen
# at a slant) and at the frame's foot (seen from above): the river at
# dusk a ribbon of the sky's glow through the dark land, as still water
# holds it
HELD = {'dawn': (0.9, 0.42), 'day': (0.5, 0.12), 'dusk': (0.9, 0.42), 'night': (0.8, 0.36)}
# in the snow the water stays the dark of the view under its white banks,
# as the prints keep it: the bay's near ink laid over the whole river,
# and less of the sky held
HELD_SNOW = {'dawn': (0.5, 0.2), 'day': (0.35, 0.1), 'dusk': (0.25, 0.12), 'night': (0.6, 0.25)}
DEEP_SNOW = 0.35
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
# size), the two banks out of step but for the nearest pair; the crape
# myrtle, whose crown stands the tallest, smaller again, and cut once for
# both banks: its nearest pair stand out of step too, the left one
# nearer, larger and further into the corner, or the one tree turned over
# reads as a stage's two wings
AVENUE = {'L': (0.16, 0.25, 0.39, 0.6, 0.78), 'R': (0.12, 0.2, 0.32, 0.5, 0.78)}
AVENUE_SHARED = {'L': (0.16, 0.25, 0.39, 0.6, 0.88), 'R': AVENUE['R']}
DEPTH = 362
TREE_K = {'sarusuberi': 0.82}
SHARED = ('sarusuberi',)
# the water shortens what it holds, as still water does, and the more as
# the tree nears and its trunk would lie across the river
MIRROR = 0.8
MIRROR_NEAR = (0.5, 0.55)
# how strongly the water holds the trees: by day the bright water lets
# their trunks through as streaks, and holds them less
HELD_TREES = {'dawn': 0.42, 'day': 0.3, 'dusk': 0.42, 'night': 0.42}
# mist lying on the plain beside the river, banks of the bay's fog (x, y,
# width, height, ink, opacity, layer)
MIST = [(-60, 452, 210, 7, 0, 0.42, 3), (236, 456, 220, 7, 1, 0.38, 3), (-80, 482, 190, 9, 1, 0.3, 3),
        (276, 488, 170, 9, 0, 0.28, 3)]
# and the haze far up the river, over its head and the avenue's farthest
# trees (those whose feet lie above HAZE_AT), which stand in it as the
# bay's far shore stands in its fog; the nearer trees in front of it
HAZE = [(118, 468, 168, 12, 0, 0.42, 4), (134, 490, 136, 10, 1, 0.36, 4), (150, 452, 104, 7, 1, 0.3, 4)]
HAZE_AT = 506
# the meadow (s5_fore.FORE's layout): the flowers and the pampas in the
# corners, on the levees' slopes; the season's flowers far off across
# the plain, beyond the levees; the bay's tree's foot, whose tuft each
# tree of the avenue carries; and the carpet, which here places only the
# tint fallen lays under what fell (afloat leaves it out: raft_at lays
# the petals on the river)
RIVER_FORE = dict(
    base=1.0, front=680, shade=[], carpet=(138, 664, 48, 5), foot=(370, 713, 15), foot_kacho=None,
    flowers=[(14, 716, 1.0, 6), (380, 712, 1.0, 6)],
    pampas=[(2, 734, 1.05, 6), (390, 730, 1.0, 6)],
    far=[(30, 612, 44), (356, 620, 40), (48, 656, 30), (322, 662, 32)],
)
# 花筏: what the avenue lets fall gathers in the slack water along the
# left bank, drawn out down it by the current: where along the bank it
# gathers, and how far up and down each gathering runs
RAFT = [(584, 9), (626, 13), (672, 17)]
# knolls on the plain in the margins, either side of the text's column,
# each wooded along its back as the hills are: (x, y, width, rise), the
# nearer the larger
KNOLLS = [(-16, 463, 84, 9), (322, 461, 84, 8), (-12, 508, 70, 13), (330, 514, 72, 12)]
# how far down a knoll its ink holds before it fades into the plain; in
# the snow, how far its ink is taken from the hills' toward the snow, and
# its woods' dark toward its own blue
KNOLL_FOOT = 0.45
KNOLL_SNOW = (0.25, 0.35)
# August's fireworks above the far banks, either side of Fuji, the small
# ones outside the text's column; no water lies under any of them, so
# none is held in the river
FIREWORKS = [(66, 396, 24, '#ffd27a', 4.6), (322, 388, 22, '#ff8a7a', 5.9), (48, 418, 12, '#bff0a8', 7.3),
             (342, 420, 11, '#f4f0ff', 8.1)]


# ── the river's course ─────────────────────────────────────────────

def course_at(y):
    """The river's middle and width at y: the course's points joined
    smoothly, each stretch a cubic whose slope at a point is its
    neighbours'."""
    if y <= COURSE[0][0]:
        return COURSE[0][1:]
    if y >= COURSE[-1][0]:
        return COURSE[-1][1:]
    i = max(j for j in range(len(COURSE) - 1) if COURSE[j][0] <= y)

    def lean(j, k):
        a, b = COURSE[max(0, j - 1)], COURSE[min(len(COURSE) - 1, j + 1)]
        return (b[k] - a[k]) / (b[0] - a[0])
    (ya, *pa), (yb, *pb) = COURSE[i], COURSE[i + 1]
    d = yb - ya
    t = (y - ya) / d
    h00, h10, h01, h11 = 2 * t ** 3 - 3 * t * t + 1, t ** 3 - 2 * t * t + t, 3 * t * t - 2 * t ** 3, t ** 3 - t * t
    return tuple(h00 * pa[k] + h10 * d * lean(i, k + 1) + h01 * pb[k] + h11 * d * lean(i + 1, k + 1) for k in (0, 1))


def near(y):
    """How near a point of the ground is: 0 at the horizon, 1 at the
    frame's foot (s5_fore._near's measure, unclamped)."""
    return max(0.0, (y - RIVER.horizon) / (RIVER.H - RIVER.horizon))


# the banks are drawn through a point every few units down the course
DOWN = [COURSE[0][0] + 3 * j for j in range(int((COURSE[-1][0] - COURSE[0][0]) / 3) + 1)]


def bank(side, off=lambda y: 0.0):
    """A bank's line (side -1 the left, 1 the right) at each depth: where
    the water meets it, moved out over the land by off(y)."""
    def x(y):
        c, w = course_at(y)
        return c + side * (w / 2 + off(y))
    return x


def line(x, ys=DOWN):
    """A line down the course through x(y) at each depth."""
    return 'M' + 'L'.join(f'{f(x(y))} {f(y)}' for y in ys)


def band(inner, outer, ys=DOWN):
    """The strip between two lines down the course, as one shape."""
    return line(inner, ys) + 'L' + line(outer, ys[::-1])[1:] + 'Z'


def slope(y):
    """How wide a levee's inner slope shows at y, wider as it nears."""
    return 1.6 + 20 * near(y)


def waver(rng, space):
    """A line that wanders between 0 and 1 down the course, easing
    between values `space(y)` apart (nearer, the farther apart)."""
    knots, y = [], COURSE[0][0] - 4
    while y < RIVER.H + 4:
        knots.append((y, rng.random()))
        y += space(y) * rng.uniform(0.7, 1.3)
    knots.append((y, rng.random()))

    def at(y):
        for (ya, va), (yb, vb) in zip(knots, knots[1:]):
            if ya <= y <= yb:
                return va + (vb - va) * (1 - math.cos(math.pi * (y - ya) / (yb - ya))) / 2
        return knots[-1][1]
    return at


def stretches(rng, on, off, y0=None, y1=None):
    """Stretches down the course, each about on(y) long and off(y)
    apart."""
    y0 = COURSE[0][0] if y0 is None else y0
    y1 = RIVER.H + 2 if y1 is None else y1
    out, y = [], y0 + rng.uniform(0, off(y0))
    while y < y1:
        ln = on(y) * rng.uniform(0.5, 1.5)
        out.append((y, min(y1, y + ln)))
        y += ln + off(y) * rng.uniform(0.4, 1.4)
    return out


def strip(x, ya, yb, width, d):
    """A strip laid along the line x(y) from ya to yb, width(y) wide
    toward d (-1 the left, 1 the right), drawn to a point at its ends."""
    n = max(2, int((yb - ya) / 2.5))
    ys = [ya + (yb - ya) * j / n for j in range(n + 1)]
    edge = [(x(y), y) for y in ys]
    rim = [(x(y) + d * width(y) * max(0.0, math.sin(math.pi * j / n)) ** 0.5, y) for j, y in enumerate(ys)]
    return 'M' + 'L'.join(f'{f(px)} {f(py)}' for px, py in edge + rim[::-1]) + 'Z'


# ── the land ───────────────────────────────────────────────────────

def land(L, h, s, o, hour, uid):
    """The plain from the horizon to the frame's foot, in its bokashi
    (misty far off, the season's ground near), the river cut in it; the
    two levees along it, each its inner slope down to a ragged water's
    edge: the light along its upper part, the wet along its foot and the
    crest catching the light, each in stretches, as grass and earth
    take the light; in the snow, the snow lying in drifts down the slope
    and the dark earth showing at the water. Returns its defs, the
    plain, the levees, and the water's edge (it goes over the water):
    each levee held in the water along its foot, and the water lapping
    it in short strokes, as it laps the bay's sea wall."""
    g = h['ground']
    snow = o.get('crowns') == 'snow'
    far = mix(h['hill_near'], s['fog'][0], 0.3)
    rng = random.Random(L.seed + 917)
    # the plain beyond each crest, for the grass that grows on it
    head = L.horizon + 12
    plain_l = f'M-40 {head}L{line(bank(-1, slope))[1:]}L-40 {L.H + 10}Z'
    plain_r = f'M{L.W + 40} {head}L{line(bank(1, slope))[1:]}L{L.W + 40} {L.H + 10}Z'
    defs = (f'<clipPath id="{uid}River"><path d="{band(bank(-1), bank(1))}"></path></clipPath>'
            f'<clipPath id="{uid}Plain"><path d="{plain_l}{plain_r}"></path></clipPath>'
            f'<linearGradient id="{uid}Floor" x1="0" y1="{f(L.horizon)}" x2="0" y2="{L.H}" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{far}"></stop><stop offset="0.3" stop-color="{mix(g, far, 0.55)}"></stop>'
            f'<stop offset="0.7" stop-color="{mix(g, far, 0.2)}"></stop><stop offset="1" stop-color="{g}"></stop></linearGradient>')
    plain = f'<rect y="{f(L.horizon)}" width="{L.W}" height="{f(L.H - L.horizon)}" fill="url(#{uid}Floor)"></rect>'
    dark, mid, lit = s5_fore._grass_inks(h, o, hour)
    if snow:
        # the snow in the slope's shade, lit, its crest; the earth it leaves
        face, top, crest = mix(g, '#3c4a74', 0.14), mix(g, '#ffffff', 0.45), o['cap']
        foot = mix(dark, s['near'], 0.3)
    else:
        face, top, foot, crest = mix(g, mid, 0.5), mix(g, lit, 0.5), mix(g, dark, 0.6), lit
    levees, held, laps = [], [], []
    for side in (-1, 1):
        crest_x = bank(side, slope)
        # the water's edge wanders out over the water, by up to a few units
        # near, as a bank's grass and stones do
        wv = waver(rng, lambda y: 3 + 34 * near(y))
        edge_x = bank(side, lambda y, wv=wv: -(0.2 + 3.2 * near(y)) * wv(y))
        tops = ''.join(strip(crest_x, a, b, lambda y, k=rng.uniform(0.35, 0.75): k * slope(y), -side)
                       for a, b in stretches(rng, lambda y: 4 + 70 * near(y), lambda y: 1 + 18 * near(y)))
        wet = 0.3 if snow else 0.12
        feet = ''.join(strip(edge_x, a, b, lambda y, k=rng.uniform(0.6, 1.4): k * (0.4 + wet * slope(y)), side)
                       for a, b in stretches(rng, lambda y: 3 + (30 if snow else 50) * near(y), lambda y: 1 + 20 * near(y)))
        crests = ''.join(strip(crest_x, a, b, lambda y, k=rng.uniform(0.5, 1.5): k * (0.3 + 1.6 * near(y)), side)
                         for a, b in stretches(rng, lambda y: 5 + 80 * near(y), lambda y: 1 + 14 * near(y)))
        levees.append(f'<path d="{band(edge_x, crest_x)}" fill="{face}"></path>'
                      f'<path d="{tops}" fill="{top}"></path>'
                      f'<path d="{feet}" fill="{foot}"></path>'
                      f'<path d="{crests}" fill="{crest}" opacity="{f(0.95 if snow else 0.8)}"></path>')
        # the levee in the water along its foot: its face, turned over
        wh = waver(rng, lambda y: 4 + 40 * near(y))
        held.append(band(edge_x, lambda y, wh=wh, edge_x=edge_x, side=side: edge_x(y) - side * (0.25 + 0.5 * wh(y)) * slope(y)))
        # where the water laps it: short strokes along the edge
        for a, b in stretches(rng, lambda y: 3 + 30 * near(y), lambda y: 1 + 12 * near(y)):
            laps.append(line(lambda y, edge_x=edge_x, side=side: edge_x(y) - side * 0.5, [a + (b - a) * j / 4 for j in range(5)]))
    shade = (f'<g clip-path="url(#{uid}River)"><path d="{"".join(held)}" fill="{mix(face, s["near"], 0.45)}" opacity="0.42" '
             f'filter="url(#f6Smear)"></path></g>')
    edge = (f'<g class="f6-lap" style="{anim(3.2, 1)}" fill="none" stroke="{s["wet"]}" stroke-opacity="0.45" stroke-width="0.7" '
            f'stroke-linecap="round"><path d="{"".join(laps)}"></path></g>')
    return defs, plain, ''.join(levees), shade + edge


def bank_grass(L, h, o, hour, seed):
    """Grass along the water's edge, down both banks, leaning out over
    the water and larger as it nears, in the meadow's grass inks; fewer
    blades and dry in the snow."""
    rng = random.Random(L.seed + seed)
    inks = s5_fore._grass_inks(h, o, hour)
    snow = o.get('crowns') == 'snow'
    blades = {c: [] for c in inks}
    for side in (-1, 1):
        x_at = bank(side)
        y = COURSE[0][0] + 6
        while y < L.H + 4:
            n = near(y)
            if rng.random() < (0.5 if snow else 0.25):
                y += 2 + 10 * n
                continue
            x = x_at(y)
            for j in range(rng.randint(3, 6)):
                blades[inks[j % 3]].append(s5_fore._blade(x + side * rng.uniform(-0.6, 2.4) * (0.4 + 3 * n), y + rng.uniform(-0.3, 0.6),
                                                          rng.uniform(2, 6) * (0.3 + 2.6 * n) * (0.7 if snow else 1),
                                                          -side * rng.uniform(0.05, 0.6), rng.uniform(0.7, 1.1) * (0.3 + 1.8 * n)))
            y += (1.5 + 9 * n) * rng.uniform(0.7, 1.3)
    return ''.join(f'<path d="{"".join(ds)}" fill="{c}"></path>' for c, ds in blades.items() if ds)


def knolls(L, h, s, o, hour, uid):
    """Low knolls on the plain in the margins, wooded along their backs
    as the near hills are (s1_scene.crowns and woods: the season's tint
    and its snow), in the near hills' ink taken toward the plain's as
    they near, their feet lost in the plain's mist as the hills' are in
    the bay's (a bokashi, the crowns in it too); a tree only where the
    knoll stands taller than it, so none hangs off its ends. In the snow
    the knoll keeps the blue the snowy woods give the hills, which the
    white plain tells apart, and its trees are its own woods under the
    snow, the knoll's blue deepened, not the far hills' dark. Returns
    their defs and the knolls."""
    snow = o.get('crowns') == 'snow'
    defs, out = [], []
    for j, (x, y, w, rise) in enumerate(KNOLLS):
        rng = random.Random(L.seed + 941 + j)
        ink = mix(h['hill_near'], h['ground'], KNOLL_SNOW[0] if snow else 0.2 + 1.2 * near(y))
        back = [(w * i / 6, y - rise * math.sin(math.pi * i / 6) ** 0.8 * rng.uniform(0.85, 1.1)) for i in range(7)]
        top = min(py for _, py in back)
        gid = f'{uid}Knoll{j}'
        defs.append(f'<linearGradient id="{gid}" x1="0" y1="{f(top)}" x2="0" y2="{f(y + 2)}" gradientUnits="userSpaceOnUse">'
                    f'<stop offset="0" stop-color="{ink}"></stop><stop offset="{f(KNOLL_FOOT)}" stop-color="{ink}"></stop>'
                    f'<stop offset="1" stop-color="{ink}" stop-opacity="0"></stop></linearGradient>')
        k = 0.8 + 3.5 * near(y)

        def stands(c):
            # a tree only where the knoll is the taller: a round crown sits
            # 0.3-0.7 of its radius under the ridge, so where the knoll
            # stands 1.8 radii its foot is inside it; a cedar, 0.8 of its
            # width
            at = c[1] if c[0] == 'c' else c[2]
            if not 0 <= at <= w:
                return False
            tall = y - ridge_y(back, at)
            return tall >= (1.8 * c[3] if c[0] == 'c' else 0.8 * c[4])
        cs = [c for c in s1_scene.crowns(back, w, rng, 1.2 * k, 2.6 * k, 4.2 * k, cedars=0.08) if stands(c)]
        dressed = {**o, 'crown_ink': mix(ink, o['crown_ink'], KNOLL_SNOW[1])} if snow else o
        out.append(f'<g transform="translate({f(x)} 0)">'
                   f'<path d="{smooth(back)} L{f(w)} {f(y + 2)} L0 {f(y + 2)} Z" fill="url(#{gid})"></path>'
                   f'{s1_scene.woods(cs, dressed, hour, L.seed + 951 + j, f"url(#{gid})")}</g>')
    return ''.join(defs), ''.join(out)


# ── the far line ───────────────────────────────────────────────────

def far_bridge(L, s, h, o, air, hour, uid, beyond):
    """The line far up the river: the bay's stone bridge across the
    valley, 0.36 of its size, its top at DECK, its parapet's snow in
    winter, and through the arch the river runs under, the river going
    on beyond it (`beyond`, its ink), a glint on it; and the masts and
    wires over it (behind the train). Returns the bridge's defs, the
    bridge and the masts."""
    k = BRIDGE_K
    Lb = dataclasses.replace(L, W=int(L.W / k) + 40, viaduct=(100, 140))
    Lm = dataclasses.replace(L, W=int(L.W / k) + 80, viaduct=(100, 140))
    at = f'translate(-6 {f(DECK - k * 100)}) scale({f(k)})'
    stone = bridge7(Lb, s, h, hour, uid)
    arches = re.search(rf'<path d="([^"]+)" fill="url\(#{uid}Arch\)"', stone).group(1)
    # the river's head, in the bridge's own units: the water beyond fills
    # the foot of the arch over it, as the lit ground beyond fills the
    # others' (fading up into the arch's shade, as theirs does), narrowing
    # as it goes away under the arch
    c, w = course_at(L.water[0])
    x0, x1 = (c - w / 2 + 6) / k, (c + w / 2 + 6) / k
    xm, xw = (x0 + x1) / 2, (x1 - x0) * 0.3
    through = (f'<g clip-path="url(#{uid}Arches)">'
               f'<path d="M{f(x0)} 143L{f(xm - xw)} 129L{f(xm + xw)} 129L{f(x1)} 143Z" fill="url(#{uid}Through)"></path>'
               f'<path d="M{f(xm - xw)} 139.2L{f(xm + xw)} 139.2" stroke="{s["wave"]}" stroke-opacity="0.4" '
               f'stroke-width="0.8"></path></g>')
    fade = (f'<linearGradient id="{uid}Through" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{beyond}" stop-opacity="0"></stop>'
            f'<stop offset="0.8" stop-color="{beyond}" stop-opacity="0.8"></stop><stop offset="1" stop-color="{beyond}"></stop>'
            f'</linearGradient>')
    return (bridge_defs(Lb, s, h, hour, uid) + f'<clipPath id="{uid}Arches"><path d="{arches}"></path></clipPath>' + fade,
            f'<g transform="{at}">{stone}{through}{air.snow_line(Lb, o, "bridge")}</g>',
            f'<g transform="translate(-14 {f(DECK - k * 100)}) scale({f(k)})">{catenary7(Lm, h, hour, 30)}</g>')


# ── the avenue ─────────────────────────────────────────────────────

def foot(L, h, o, hour):
    """What a tree of the avenue stands in on the crest, drawn with it so
    that every place it is set down carries it: the bay's tuft over its
    foot (s5_fore.foot_tuft, at the meadow's foot), so the trunk rises
    from the grass as the bay's does; in the snow the snow banked against
    the trunk, the dry blades through it, so it rises from the snow."""
    tuft = s5_fore.foot_tuft(L, h, o, hour)
    if o.get('crowns') != 'snow':
        return tuft
    x, y, w = RIVER_FORE['foot']
    # a low skirt of snow, flat over the trunk's foot and tapering away
    # either side: higher, it stands on the crest as a cap would
    a, b = 1.2 * w, 0.2 * w
    return (tuft + f'<path d="M{f(x - a)} {f(y + 1)}C{f(x - 0.6 * a)} {f(y + 1)} {f(x - 0.55 * a)} {f(y - b)} {f(x - 0.3 * a)} {f(y - b)}'
            f'L{f(x + 0.3 * a)} {f(y - b)}C{f(x + 0.55 * a)} {f(y - b)} {f(x + 0.6 * a)} {f(y + 1)} {f(x + a)} {f(y + 1)}Z" '
            f'fill="{o["cap"]}"></path>')


def avenue(L, h, o, hour, flora, uid, haze):
    """桜堤: the season's tree down each levee's crest, five times a bank,
    the farthest first: each bank's tree drawn once (the nearest), at
    the bay's place, with its foot's grass, and placed again down the
    bank with <use>, turned on the left bank to lean over the water as
    the right's does; drawn with the print's uid, so whatever it points
    into (the lanterns' glow) is the shared defs'. The crape myrtle, the
    heaviest of the trees, is cut once for both banks. `haze` stands in
    front of the farthest (HAZE_AT). Returns the avenue, and its
    reflection in the river: each tree again, turned over at the water
    under its foot and shortened, the more as it nears (the river's mask
    fades it as the water nears, holding less)."""
    k0 = TREE_K.get(o.get('tree'), 1.0)
    shared = o.get('tree') in SHARED
    rows = AVENUE_SHARED if shared else AVENUE
    placed, mirrored = [(HAZE_AT, haze)], []
    for side, seed, flip in (('L', 13, True), ('R', 34, False)):
        cut = 'R' if shared else side
        Lt = dataclasses.replace(L, seed=L.seed + seed)
        body = '' if cut != side else flora.tree(Lt, h, o, hour, gust, UID) + foot(Lt, h, o, hour)
        crest = bank(-1 if flip else 1, slope)
        for j, kk in enumerate(rows[side]):
            y = L.horizon + DEPTH * kk
            at = (crest(y), y)
            again = f'<use href="#{uid}Tree{cut}"></use>'
            part = f'<g id="{uid}Tree{side}">{body}</g>' if body and j == len(rows[side]) - 1 else again
            placed.append((y + (0.5 if side == 'R' else 0), common.turned(part, TREE_FOOT, at, kk * k0, flip=flip)))
            # the water under the foot: the levee's height below it
            yw = y + 1 + 0.5 * slope(y)
            if yw >= L.H:
                continue
            m = MIRROR_NEAR[1] if kk >= MIRROR_NEAR[0] else MIRROR
            mirrored.append(f'<g transform="matrix(1 0 0 {f(-m)} 0 {f((1 + m) * yw)})">'
                            f'{common.turned(again, TREE_FOOT, at, kk * k0, flip=flip)}</g>')
    trees = ''.join(svg for _, svg in sorted(placed, key=lambda p: p[0]))
    return trees, ''.join(mirrored)


def raft_at(rng, L):
    """Where a fallen petal floats (s5_fore._spot's place, on the river):
    in one of the raft's gatherings along the left bank, drawn out down
    it, the most close in by the bank, thinning toward the middle."""
    y0, run = RAFT[rng.randrange(len(RAFT))]
    y = y0 + rng.gauss(0, run)
    n = near(y)
    return bank(-1)(y) + 0.4 + 3.2 * n + abs(rng.gauss(0, 1)) * (1.2 + 8 * n), y


def afloat(meadow):
    """What the trees let fall lying on the water: s5_fore.fallen's
    petals without the tint it lays under them, which on the meadow is
    the ground taking their colour and on the water would read as a glow
    (lake.afloat's, written here for the reason THIN is)."""
    return re.sub(rf'<defs><radialGradient id="{UID}Carpet">[\s\S]*?</defs><ellipse [^>]*fill="url\(#{UID}Carpet\)"></ellipse>',
                  '', meadow, count=1)


# ── the print ──────────────────────────────────────────────────────

def sky_at(stops, t):
    """The sky's ink at t of its height (0 the zenith, 1 the horizon)."""
    t = min(1.0, max(0.0, t))
    for (ta, ca), (tb, cb) in zip(stops, stops[1:]):
        if ta <= t <= tb:
            return mix(ca, cb, (t - ta) / ((tb - ta) or 1))
    return stops[-1][1]


def held_sky(L, h, o, hour, uid):
    """The sky the river holds: the sky turned over at the horizon (the
    water at y holds what stands as far above it), the horizon's glow far
    up the river, the higher sky nearer, the water holding less of it as
    it is seen more from above. Its gradient, over the water's depth."""
    y0, y1 = L.water
    far, near_ = (HELD_SNOW if o.get('crowns') == 'snow' else HELD)[hour]
    out = []
    for j in range(9):
        t = j / 8
        y = y0 + (y1 - y0) * t
        out.append(f'<stop offset="{f(t)}" stop-color="{sky_at(h["sky"], 2 - y / L.horizon)}" '
                   f'stop-opacity="{f(far + (near_ - far) * t ** 0.8)}"></stop>')
    return (f'<linearGradient id="{uid}Held" x1="0" y1="{f(y0)}" x2="0" y2="{f(y1)}" gradientUnits="userSpaceOnUse">'
            f'{"".join(out)}</linearGradient>')


def held_less(L, uid):
    """The mask the trees' reflection is held through: whole far up the
    river, fading as the water nears and holds less (lake.mirror's
    fade, over the river's depth)."""
    y0, y1 = L.water
    fade = ''.join(f'<stop offset="{f(t)}" stop-color="#fff" stop-opacity="{f(1 - 0.78 * t ** 0.8)}"></stop>'
                   for t in (0, 0.25, 0.5, 0.75, 1))
    return (f'<linearGradient id="{uid}MFade" x1="0" y1="{f(y0)}" x2="0" y2="{f(y1)}" gradientUnits="userSpaceOnUse">'
            f'{fade}</linearGradient>'
            f'<mask id="{uid}MMask" maskUnits="userSpaceOnUse" x="-40" y="{f(y0)}" width="{L.W + 80}" height="{f(y1 - y0)}">'
            f'<rect x="-40" y="{f(y0)}" width="{L.W + 80}" height="{f(y1 - y0)}" fill="url(#{uid}MFade)"></rect></mask>')


def beyond_ink(L, h, s, o, hour):
    """The river's ink far up it, where it goes under the bridge: the
    bay's far water with the horizon's sky held in it; at night half in
    the arch's shade, which the night sky held would otherwise outshine."""
    snow = o.get('crowns') == 'snow'
    far = (HELD_SNOW if snow else HELD)[hour][0]
    water_ = mix(s['far'], s['near'], DEEP_SNOW) if snow else s['far']
    ink = mix(water_, sky_at(h['sky'], 2 - L.water[0] / L.horizon), far)
    return mix(ink, s['shade'][1], 0.5) if hour == 'night' else ink


NUM = r'(-?[\d.]+)'


def unseen(svg):
    """The bay's surface without the marks the river's course hides: a
    wave, a trough, a glint or a spark wholly off the river on its row
    is clipped away unseen and only weighs, so it is left out, and the
    rows it leaves empty with it."""
    def on(xs, y):
        c, w = course_at(y)
        return max(xs) >= c - w / 2 - 2 and min(xs) <= c + w / 2 + 2

    def marks(m):
        kept = []
        for part in re.findall(r'M[^M]+', m[1]):
            nums = [float(v) for v in re.findall(NUM, part)]
            if on(nums[0::2], sum(nums[1::2]) / len(nums[1::2])):
                kept.append(part)
        return f'<path d="{"".join(kept)}"></path>'
    svg = re.sub(rf'<line x1="{NUM}" y1="{NUM}" x2="{NUM}" y2="{NUM}"[^>]*></line>',
                 lambda m: m[0] if on((float(m[1]), float(m[3])), float(m[2])) else '', svg)
    svg = re.sub(rf'<path d="M{NUM} {NUM} q{NUM} {NUM} {NUM} 0"[^>]*></path>',
                 lambda m: m[0] if on((float(m[1]), float(m[1]) + float(m[5])), float(m[2])) else '', svg)
    svg = re.sub(r'<path d="(M[-\d.\sLMZ]*)"></path>', marks, svg)
    for empty in (r'<g class="(f6-glint|f9-glitter)" style="[^"]*"><path d=""></path></g>',
                  r'<g class="f6-twinkle" style="[^"]*"></g>',
                  r'<g class="f6-(row|road)" style="[^"]*"( stroke-[a-z]+="[^"]*")*></g>'):
        svg = re.sub(empty, '', svg)
    return svg


def river_water(L, h, s, o, far, near_, hour, uid):
    """scene_f6.water, the bay's surface, clipped to the river's course,
    the sky held in it under its ripples, its light's road spread as the
    bay's ripples spread it. August's night has no moon (the fireworks
    are its light): its road is laid off the print."""
    Lw = dataclasses.replace(L, disc_r=ROAD_R, cx=-L.W if o.get('fireworks') else L.cx)
    surface = water(Lw, h, s, far, near_, hour, [], grouped=True)
    y0, y1 = L.water
    at = surface.index('fill="url(#f6Sheen)"></rect>') + len('fill="url(#f6Sheen)"></rect>')
    held = f'<rect y="{f(y0)}" width="{L.W}" height="{f(y1 - y0)}" fill="url(#{uid}Held)"></rect>'
    if o.get('crowns') == 'snow':
        held = (f'<rect y="{f(y0)}" width="{L.W}" height="{f(y1 - y0)}" fill="{s["near"]}" opacity="{f(DEEP_SNOW)}"></rect>'
                + held)
    surface = unseen(surface[:at] + held + surface[at:])
    return surface.replace('clip-path="url(#f6Bay)"', f'clip-path="url(#{uid}River)"', 1)


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
        kdefs, knolls_ = knolls(L, h, s, o, hour, uid)
        ldefs += held_sky(L, h, o, hour, uid) + held_less(L, uid) + kdefs
        bdefs, bridge, masts = far_bridge(L, s, h, o, air, hour, uid, beyond_ink(L, h, s, o, hour))
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
                f'{knolls_}'
                f'{air.fireworks(L, h, o, hour, UID)}'
                f'{river_water(L, h, s, o, far, near_, hour, uid)}'
                f'<g clip-path="url(#{uid}River)">{reflections7(fleet_, hour, UID, anim, grouped=True)}</g>'
                f'{levees}{shore}{fog(dataclasses.replace(L, fog=MIST), s, 3)}'
                f'{masts}'
                f'{birds if h["birds"] not in ("cranes", None) else ""}'
                f'{air.fireflies(dataclasses.replace(L, hills=(L.hills[0], 444), water=(446, 540)), h, o, hour, "far")}')
        train, run, band_ = common.small_train(L, h, s, hour, BRIDGE_K, DECK - 0.4 * BRIDGE_K, uid=uid)
        trees, mirrored = avenue(L, h, o, hour, flora, uid, fog(dataclasses.replace(L, fog=HAZE), s, 4))
        # what the avenue let fall (s5_fore.fallen, the bay's petals in
        # its inks), laid where the river gathers it: fallen's place for
        # each (_spot) given the raft's while it is drawn, and given back
        with common.swapped((vars(s5_fore), '_spot', raft_at)):
            raft = afloat(s5_fore.fallen(L, h, o, hour, UID))
        front = (bridge
                 + f'<g clip-path="url(#{uid}River)"><g mask="url(#{uid}MMask)">'
                 f'<g opacity="{f(HELD_TREES[hour])}" filter="url(#f6Smear)">{mirrored}</g></g></g>'
                 + f'<g clip-path="url(#{uid}River)">{raft}</g>'
                 + boats7(fleet_, s, hour, UID, anim)
                 + f'<g clip-path="url(#{uid}Plain)">{s5_fore.tufts(L, h, o, hour, L.horizon + 30, L.H, 70, 761)}</g>'
                 + bank_grass(L, h, o, hour, 931)
                 + s5_fore.patches(L, h, o, hour)
                 + trees
                 + flora.bank(L, h, o, hour, gust, anim)
                 + air.falls(L, h, o, hour) + s2_air.close(L, h, o, hour, UID)
                 + air.fireflies(L, h, o, hour, 'near'))
    return dict(layers=(sky, back, train, front), run=run, band=band_, L=L)
