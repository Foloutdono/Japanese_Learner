"""駅 the station, under the eaves (plan 309).

We stand on a small station's platform with the bay beyond. Overhead the
eaves (0-100): the soffit's boards and the rafters under them receding
to the beam, the beam with its lower edge planed and lit, beyond it the
fascia at the eave's edge; a lamp hangs from the beam at x 300, lit at
dawn, dusk and night, its light pooled on the stone under it and caught
by the post beside it. Two posts stand in the margins (x 12-24 and
366-378), from their brackets (舟肘木) under the beam to their stones on
the platform at 600, grained, their inner faces turned to the light,
braced to the beam (方杖). Framed between them the bay: Fuji's summit at
(195, 352), its foot at 455; the far shore's embankment with the line
along it and the train at half size (455-462); the water and its boats
(462-512) and the sea wall (512-518); the season's tree on the bank at
the left. Then the track (528-560: the ballast, the sleepers, two rails
catching the light) and the platform's stone (560-746): its coping, the
white line (白線) at 572, the slabs laid in courses, the eaves' shade
across them, the planters at the corners with the season's flowers. The
timber is the pine's (el7.PINE), the stone the sea wall's
(scene_f6.SEA), lit by the sky; in winter icicles hang from the fascia
and snow lies on the rails and on the platform out to the eaves' drip.
August's fireworks open beyond, right of the tree.

Everything that recedes runs to one vanishing point under the summit
(VP), and the platform is laid by distance from an eye 1.6 m above its
stone (`at`), so its courses close up toward the edge and its joints and
the sleepers fan out toward the viewer.

    station(season, hour, variant=None) -> dict(layers, run, band, L)

as lake.lake, from common's parts and the bay's.

Units are the phone's (390 x 746); the challenge shows the top 693 at
2.769 px a unit, then raises the print 52.7 units for the reading."""
import dataclasses
import math
import random

import common
from common import UID, f
import s1_air
import s1_scene
import s2_air
import s5_fore
from fuji import Fuji
from layouts import PHONE
from scene_f4 import anim
from scene_f5 import clouds, gust
from scene_f6 import fog, fleet, mix, ridges, seawall, smoke6, village, water
from el7 import PINE, boats7, catenary7, reflections7

# the station, in the print's units: the eaves overhead, the bay beyond
# under Fuji (its summit under the hook's plate, 975 px), the far shore
# carrying the line at 455-462, the water to the sea wall at 512, the
# bank, the track, the platform from 560
EKI = dataclasses.replace(
    PHONE, cx=195, cy=150, disc_r=30, halo_r=40, fare_r=46, horizon=462,
    fuji=(195, 352, 455, 214), hills=(433, 447), water=(462, 512), wall=(512, 518), viaduct=(518, 528), ground=528,
    rows=10, chimneys=[],
    fog=[(118, 418, 300, 14, 0, 0.62, 0), (-90, 428, 250, 11, 1, 0.5, 0), (30, 440, 300, 8, 1, 0.42, 1),
         (170, 451, 260, 5, 0, 0.3, 2), (-50, 453, 170, 5, 0, 0.26, 2)],
    # clouds under the eaves, clear of the disc and of the masthead's rows
    cloud_sets={
        'dawn': [(-30, 230, 150, 14), (258, 216, 152, 15), (-24, 316, 104, 11), (296, 330, 108, 11)],
        'day': [(-30, 234, 156, 16), (254, 218, 160, 17), (-24, 318, 108, 12), (290, 332, 116, 12)],
        'dusk': [(-40, 226, 170, 9), (250, 238, 150, 8)],
        'night': [(-34, 232, 170, 9), (262, 300, 140, 8)],
    },
    # the boats nearer than the rows the train's reflection takes (to
    # 481), clear of the tree's trunk at the left
    boats=[(158, 497, 0.5), (236, 492, 0.44), (300, 503, 0.58)],
    lone_boats=[(178, 499, 0.55), (268, 495, 0.5)],
    star_box=(26, 104, 364, 446),
    # the geese parked right of Fuji, the cranes past its right flank
    geese_path=((-70, 388), (811, 424), 50), cranes_path=((520, 398), (-47, 382), 40),
)
# the eye: everything that recedes runs to VP; a point d metres off and
# `drop` metres under the eye lies at y = VP + FOCAL * drop / d (the
# platform's stone EYE metres under it)
VP = (195, 458)
FOCAL = 280
EYE = 1.6


def at(d, drop=EYE):
    """Where a point `drop` metres under the eye, d metres off, lies."""
    return VP[1] + FOCAL * drop / d


def off(y, drop=EYE):
    """How far off a point `drop` metres under the eye lies, at y."""
    return FOCAL * drop / (y - VP[1])


def toward(x, y0, y1):
    """A line through (x, y0) running to VP: its x at y1."""
    return VP[0] + (x - VP[0]) * (VP[1] - y1) / (VP[1] - y0)


def poly(pts):
    return 'M' + 'L'.join(f'{f(x)} {f(y)}' for x, y in pts) + 'Z'


def stipple(dots, opacity, long=1.0):
    """Dots (x, y, r, ink) written as the needles are: each a stroke with
    round ends, `long` of its radius long (a pebble lies flat, a fleck is
    round), so a thousand cost little; one path for each ink and width."""
    groups = {}
    for x, y, r, ink in dots:
        wd = max(0.25, round(r * 8) / 4)
        groups.setdefault((ink, wd), []).append(f'M{f(x - r * long / 2)} {f(y)}h{f(max(0.1, r * long))}')
    return ''.join(f'<path d="{"".join(ds)}" fill="none" stroke="{ink}" stroke-width="{f(wd)}" stroke-linecap="round" '
                   f'stroke-opacity="{f(opacity)}"></path>' for (ink, wd), ds in sorted(groups.items()))


TRAIN_K = 0.5            # the line's train, far off: half the bay's
TREE_FOOT = (370, 712)   # the season's tree stands here on the bay's print
TREE_AT = (46, 524)      # and here on the bank beyond the track, turned
# its size: the crape myrtle's crown is the widest, the plum's the barest
TREE_K = {'sarusuberi': 0.56, 'ume': 0.64}
# August's fireworks beyond, right of the tree: their light lies in the
# water between the boats
FIREWORKS = [(304, 398, 26, '#ffd27a', 4.6), (260, 424, 15, '#ff8a7a', 5.9), (344, 428, 11, '#bff0a8', 7.3)]
# spring dawn's thin bands (s1_air.THIN), the first lowered out of the
# eaves and drawn short of the disc the challenge sets in the sky
THIN = [(-40, 114, 168, 6)] + s1_air.THIN[390][1:]


# ── the timber ──────────────────────────────────────────────────────

def woods(hour, o):
    """The timber's inks, the pine's (el7.PINE): its face in the shade
    the eaves cast, a step lighter than the pine's trunk (sawn and
    weathered wood, not bark), the face turned to the light lighter
    again, the lit edge, the grain's dark and the deepest dark, a fleck."""
    c = PINE[hour]
    return dict(face=mix(c['trunk'], c['trunk_lit'], 0.32), side=mix(c['trunk'], c['trunk_lit'], 0.78),
                grain=c['trunk'], lit=c['trunk_lit'], dark=c['bark'], fleck=c['fleck'],
                snow=o.get('crowns') == 'snow')


def grain_lines(x0, x1, y0, y1, rng, n, knots=(), wave=0.5, step=6.0, vertical=True):
    """Grain along a sawn timber: n lines running its length, each
    wavering a little, now and then stopping short where another takes
    over, parting round the knots (x, y, r) and closing behind them.
    Along y if `vertical`, else along x."""
    if not vertical:
        x0, x1, y0, y1 = y0, y1, x0, x1
        knots = [(ky, kx, kr) for kx, ky, kr in knots]
    out = []
    span = x1 - x0
    for i in range(n):
        u = (i + rng.uniform(0.25, 0.75)) / n
        base = x0 + span * u
        ph, ln = rng.uniform(0, 6.3), rng.uniform(40, 90)
        a = y0 + (rng.uniform(0, (y1 - y0) * 0.4) if rng.random() < 0.3 else 0)
        b = y1 - (rng.uniform(0, (y1 - y0) * 0.4) if rng.random() < 0.3 else 0)
        pts = []
        y = a
        while y <= b + 0.01:
            x = base + wave * math.sin(y / ln * 6.28 + ph)
            for kx, ky, kr in knots:
                dy = (y - ky) / (kr * 3.2)
                if abs(dy) < 1:
                    push = kr * 1.25 * (1 - dy * dy) ** 1.5
                    x += push if base >= kx else -push
            pts.append((min(x1, max(x0, x)), y))
            y += step
        if len(pts) > 1:
            out.append('M' + 'L'.join(f'{f(px)} {f(py)}' if vertical else f'{f(py)} {f(px)}' for px, py in pts))
    return ''.join(out)


def knot(x, y, rx, ry, w):
    """A knot (節): its heart dark, the ring round it catching the light."""
    return (f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(rx)}" ry="{f(ry)}" fill="{w["grain"]}" fill-opacity="0.5" stroke="{w["fleck"]}" '
            f'stroke-width="0.45" stroke-opacity="0.45"></ellipse>'
            f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(rx * 0.55)}" ry="{f(ry * 0.6)}" fill="{w["dark"]}" fill-opacity="0.9"></ellipse>')


def flame(cx, y0, wd, ht, rng, up=True, across=False):
    """The flame (板目) a sawn face shows where it cuts across the growth
    rings: arches nested one in another, long and narrow, pointing up
    the timber (or down); `across`, along a beam (x and y swapped)."""
    out = []
    s = -1 if up else 1
    for j in range(3):
        k = 1 - j * 0.3
        a, h_ = wd * k, ht * (1 - j * 0.22)
        tip = y0 + s * h_
        pts = [(cx - a, y0), (cx - a * 0.9, y0 + s * h_ * 0.6), (cx - a * 0.25, tip - s * h_ * 0.08), (cx + rng.uniform(-0.3, 0.3), tip),
               (cx + a * 0.25, tip - s * h_ * 0.08), (cx + a * 0.9, y0 + s * h_ * 0.6), (cx + a, y0)]
        if across:
            pts = [(y, x) for x, y in pts]
        p = [f'{f(x)} {f(y)}' for x, y in pts]
        out.append(f'M{p[0]}C{p[1]} {p[2]} {p[3]}C{p[4]} {p[5]} {p[6]}')
    return ''.join(out)


def nail(x, y, w, ln):
    """An old nail, and the rust its rain has run down the wood."""
    return (f'<path d="M{f(x - 0.55)} {f(y)}L{f(x + 0.6)} {f(y)}L{f(x + 0.2)} {f(y + ln)}L{f(x - 0.1)} {f(y + ln)}Z" '
            f'fill="#8a4e2c" fill-opacity="0.38"></path>'
            f'<circle cx="{f(x)}" cy="{f(y)}" r="0.85" fill="{w["dark"]}"></circle>')


def soffit(W, w):
    """The eaves' underside, seen from under them: the boards running out
    to the beam and closing up as they go, the rafters (垂木) under them,
    each showing its foot and, toward the middle, its side; darkest
    overhead, where no light reaches."""
    top, foot = -4, 79
    seams, rafters, sides, edges = [], [], [], []
    for i in range(-14, 56):
        x = -40 + 9.6 * i
        seams.append(f'M{f(toward(x, foot, top))} {top}L{f(x)} {foot}')
    for i in range(-3, 14):
        x = 7 + 38.4 * i
        hw = 2.9
        rafters.append(poly([(toward(x - hw, foot, top), top), (toward(x + hw, foot, top), top), (x + hw, foot), (x - hw, foot)]))
        # the side toward the middle shows, the wider the farther out
        s = -1 if x > VP[0] else 1
        sw = min(4.2, abs(x - VP[0]) * 0.026)
        if sw > 0.3:
            e0 = x + s * hw
            sides.append(poly([(toward(e0, foot, top), top), (toward(e0 + s * sw, foot, top), top), (e0 + s * sw * 0.82, foot), (e0, foot)]))
        e = x - s * hw
        edges.append(f'M{f(toward(e, foot, top))} {top}L{f(e)} {foot}')
    return (f'<rect x="-10" y="{top}" width="{W + 20}" height="{foot - top + 1}" fill="url(#ekSoffit)"></rect>'
            f'<path d="{"".join(seams)}" fill="none" stroke="{w["dark"]}" stroke-width="0.5" stroke-opacity="0.55"></path>'
            f'<path d="{"".join(sides)}" fill="{w["dark"]}" fill-opacity="0.8"></path>'
            f'<path d="{"".join(rafters)}" fill="url(#ekRafter)"></path>'
            f'<path d="{"".join(edges)}" fill="none" stroke="{w["lit"]}" stroke-width="0.6" stroke-opacity="0.35"></path>')


BEAM = (79, 95.5, 97.6)   # the beam's face, its lit bevel down to its underside, its foot
FASCIA = 102              # the eave's edge beyond it, its foot


def beam(W, w, rng):
    """The beam (桁) over the posts: its face grained along its length,
    a knot or two, the rafters' shadow along its top, its lower edge
    planed off and catching the light (面取り), its underside; spliced
    (継手) and pinned right of the middle; beyond it the fascia at the
    eave's edge, its foot lit by the sky."""
    y0, y1, y2 = BEAM
    knots = [(rng.uniform(70, 120), rng.uniform(84, 90), 2.2, 1.5), (rng.uniform(250, 280), rng.uniform(84, 90), 1.8, 1.3)]
    grain = grain_lines(-10, W + 10, y0 + 1.4, y1 - 1.6, rng, 7, [(x, y, ry) for x, y, _, ry in knots], wave=0.45, step=7, vertical=False)
    grain += flame((y0 + y1) / 2, rng.uniform(140, 170), 3.0, 64, rng, up=False, across=True)
    fine = grain_lines(-10, W + 10, y0 + 1.2, y1 - 1.4, rng, 5, [(x, y, ry) for x, y, _, ry in knots], wave=0.3, step=8, vertical=False)
    sx = 222
    splice = f'M{sx} {f(y0)}L{sx} {f(y0 + 7.5)}L{sx + 15} {f(y0 + 7.5)}L{sx + 15} {f(y1)}'
    pegs = ''.join(f'<circle cx="{f(x)}" cy="{f(y0 + 4.2)}" r="1.15" fill="{w["dark"]}"></circle>'
                   f'<path d="M{f(x - 0.9)} {f(y0 + 3.5)}a1.15 1.15 0 0 1 1.6 -0.2" fill="none" stroke="{w["fleck"]}" stroke-width="0.4" stroke-opacity="0.7"></path>'
                   for x in (sx + 4.5, sx + 10.5))
    return (f'<rect x="-10" y="{f(y2)}" width="{W + 20}" height="{f(FASCIA - y2)}" fill="{mix(w["dark"], w["face"], 0.45)}"></rect>'
            f'<rect x="-10" y="{f(FASCIA - 0.9)}" width="{W + 20}" height="0.9" fill="{w["lit"]}" fill-opacity="0.75"></rect>'
            f'<rect x="-10" y="{f(y0)}" width="{W + 20}" height="{f(y1 - y0)}" fill="url(#ekBeam)"></rect>'
            f'<path d="{fine}" fill="none" stroke="{w["grain"]}" stroke-width="0.4" stroke-opacity="0.5"></path>'
            f'<path d="{grain}" fill="none" stroke="{w["dark"]}" stroke-width="0.45" stroke-opacity="0.55"></path>'
            + ''.join(knot(x, y, rx, ry, w) for x, y, rx, ry in knots)
            + f'<path d="{splice}" fill="none" stroke="{w["dark"]}" stroke-width="0.75"></path>{pegs}'
            f'<rect x="-10" y="{f(y0)}" width="{W + 20}" height="1.7" fill="{w["dark"]}" fill-opacity="0.75"></rect>'
            f'<rect x="-10" y="{f(y1)}" width="{W + 20}" height="{f(y2 - y1)}" fill="{w["dark"]}"></rect>'
            f'<rect x="-10" y="{f(y1 - 1.5)}" width="{W + 20}" height="1.5" fill="{w["lit"]}" fill-opacity="0.85"></rect>')


POSTS = ((12, 1), (366, -1))   # each post's face's left edge, and the way its inner face looks
POST_W, POST_SIDE = 12, 5
POST_FOOT = 600


def post(x0, side, w, rng):
    """A post (柱), squared: its face toward us in the eaves' shade,
    grained, its knots, a check or two where it dried, weathered paler
    in streaks and darker toward its foot, where the rain splashes; its
    inner face turned to the light; the corner between them planed (面取り)
    and lit."""
    x1 = x0 + POST_W
    xin = x1 if side > 0 else x0
    top, foot = 96, POST_FOOT
    xs = xin + side * POST_SIDE
    face = f'<rect x="{f(x0)}" y="{top}" width="{POST_W}" height="{foot - top}" fill="url(#ekPost)"></rect>'
    # the inner face: back from the corner toward VP; its far edge stands
    # a little higher at the foot, being farther off
    inner = f'<path d="M{f(xin)} {top}L{f(xs)} {top}L{f(xs)} {f(foot - 2.5)}L{f(xin)} {foot}Z" fill="url(#ekSide)"></path>'
    knots = [(x0 + POST_W * rng.uniform(0.3, 0.7), rng.uniform(230, 290), 1.5, 2.4),
             (x0 + POST_W * rng.uniform(0.3, 0.7), rng.uniform(430, 490), 1.3, 2.0)]
    grain = grain_lines(x0 + 0.8, x1 - 0.8, top, foot, rng, 6, [(x, y, ry) for x, y, _, ry in knots], wave=0.35, step=8)
    fine = grain_lines(x0 + 0.5, x1 - 0.5, top, foot, rng, 5, [(x, y, ry) for x, y, _, ry in knots], wave=0.25, step=9)
    side_grain = grain_lines(min(xin, xs) + 0.6, max(xin, xs) - 0.6, top, foot - 3, rng, 3, (), wave=0.25, step=10)
    # a flame where the face cuts across the rings, high on the post
    flames = flame(x0 + POST_W * rng.uniform(0.42, 0.58), rng.uniform(330, 380), rng.uniform(3.2, 4.2), rng.uniform(70, 110), rng)
    # streaks the weather bleached, long and narrow
    streaks = []
    for _ in range(3):
        sx = x0 + POST_W * rng.uniform(0.1, 0.8)
        sy = rng.uniform(120, 380)
        sl = rng.uniform(80, 200)
        sw = rng.uniform(0.9, 1.8)
        streaks.append(poly([(sx, sy), (sx + sw, sy + 6), (sx + sw * 0.8, sy + sl), (sx + 0.2, sy + sl - 8)]))
    # checks: the long splits seasoned timber opens along its grain
    checks = []
    for _ in range(3):
        cx = x0 + POST_W * rng.uniform(0.25, 0.75)
        cy = rng.uniform(140, 520)
        ln = rng.uniform(22, 52)
        checks.append(f'M{f(cx)} {f(cy)}Q{f(cx + rng.uniform(-0.6, 0.6))} {f(cy + ln / 2)} {f(cx + rng.uniform(-0.5, 0.5))} {f(cy + ln)}')
    nails = ''.join(nail(x0 + POST_W * rng.uniform(0.3, 0.7), rng.uniform(lo, hi), w, rng.uniform(6, 13))
                    for lo, hi in ((300, 340), (395, 410)))
    # where the rain splashes up off the stone: darker, its upper edge a
    # ragged tide line
    wet = [(x0, foot)]
    for j in range(7):
        wet.append((x0 + POST_W * j / 6, foot - rng.uniform(16, 26)))
    wet.append((x1, foot))
    chamfer = f'M{f(xin + side * 0.45)} {top}L{f(xin + side * 0.45)} {f(foot - 0.5)}'
    outer = x0 + 0.4 if side > 0 else x1 - 0.4
    return (face + inner
            + f'<path d="{"".join(streaks)}" fill="{w["fleck"]}" fill-opacity="0.16"></path>'
            + f'<path d="{fine}" fill="none" stroke="{w["grain"]}" stroke-width="0.4" stroke-opacity="0.55"></path>'
            + f'<path d="{grain}" fill="none" stroke="{w["dark"]}" stroke-width="0.5" stroke-opacity="0.6"></path>'
            + f'<path d="{flames}" fill="none" stroke="{w["dark"]}" stroke-width="0.45" stroke-opacity="0.55"></path>'
            + f'<path d="{side_grain}" fill="none" stroke="{w["grain"]}" stroke-width="0.4" stroke-opacity="0.6"></path>'
            + ''.join(knot(x, y, rx, ry, w) for x, y, rx, ry in knots)
            + f'<path d="{"".join(checks)}" fill="none" stroke="{w["dark"]}" stroke-width="0.75" stroke-linecap="round" stroke-opacity="0.85"></path>'
            + nails
            + f'<path d="{poly(wet)}" fill="{w["dark"]}" fill-opacity="0.32"></path>'
            + f'<path d="{chamfer}" fill="none" stroke="{w["fleck"]}" stroke-width="0.9" stroke-opacity="0.8"></path>'
            + f'<path d="M{f(outer)} {top}L{f(outer)} {foot}" fill="none" stroke="{w["lit"]}" stroke-width="0.5" stroke-opacity="0.35"></path>')


BRACKET = (25, 8.5)   # the bracket's half-length, its depth


def bracket_outline(x0, side):
    """The bracket's ends and its outline, a boat's: flat on top under
    the beam, its underside swept up to each end."""
    cx = x0 + POST_W / 2 + side * POST_SIDE / 2
    half, d = BRACKET
    y0 = BEAM[2]
    a, b = cx - half, cx + half
    return a, b, (f'M{f(a)} {f(y0)}L{f(b)} {f(y0)}L{f(b)} {f(y0 + 2.6)}'
                  f'Q{f(b - 6)} {f(y0 + d)} {f(b - 14)} {f(y0 + d)}L{f(a + 14)} {f(y0 + d)}Q{f(a + 6)} {f(y0 + d)} {f(a)} {f(y0 + 2.6)}Z')


def bracket(x0, side, w, rng):
    """The bracket (舟肘木) on the post's head under the beam: a block
    cut like a boat, its ends swept up, its curved underside catching
    the light from the stone below."""
    a, b, outline = bracket_outline(x0, side)
    y0, d = BEAM[2], BRACKET[1]
    under = (f'M{f(a)} {f(y0 + 2.6)}Q{f(a + 6)} {f(y0 + d)} {f(a + 14)} {f(y0 + d)}L{f(b - 14)} {f(y0 + d)}'
             f'Q{f(b - 6)} {f(y0 + d)} {f(b)} {f(y0 + 2.6)}')
    grain = grain_lines(a + 2, b - 2, y0 + 1.2, y0 + d - 1.5, rng, 3, (), wave=0.25, step=6, vertical=False)
    return (f'<path d="{outline}" fill="url(#ekBracket)"></path>'
            + f'<path d="{grain}" fill="none" stroke="{w["dark"]}" stroke-width="0.4" stroke-opacity="0.5"></path>'
            + f'<path d="{under}" fill="none" stroke="{w["fleck"]}" stroke-width="0.8" stroke-opacity="0.75"></path>'
            # its ends sawn across the grain, a shade paler
            + ''.join(f'<path d="M{f(x)} {f(y0 + 0.4)}L{f(x)} {f(y0 + 2.6)}" stroke="{w["fleck"]}" stroke-width="1.4" stroke-opacity="0.5"></path>'
                      for x in (a + 0.7, b - 0.7))
            + f'<path d="M{f(a)} {f(y0)}L{f(b)} {f(y0)}" stroke="{w["dark"]}" stroke-width="0.9"></path>')


BRACE = (38, 7.0)    # how far the brace rises (and reaches), its width


def brace_corners(x0, side):
    """The brace's corners: its two long edges, 45° up and inward from
    the post's inner face, cut by that face and by the bracket's
    underside (low and high at the post, high and low at the bracket)."""
    xin = (x0 + POST_W if side > 0 else x0) + side * POST_SIDE
    y_top = BEAM[2] + BRACKET[1]
    rise, width = BRACE
    t = width / math.sqrt(2)
    return xin, y_top, ((xin, y_top + rise + t), (xin, y_top + rise - t),
                        (xin + side * (rise - t), y_top), (xin + side * (rise + t), y_top))


def brace(x0, side, w, rng):
    """The brace (方杖) from the post up to the beam: a strut at 45°, its
    upper edge lit, grained along its length, housed in the post's face
    and under the bracket, a peg at each end."""
    xin, y_beam, (p_lo, p_hi, q_hi, q_lo) = brace_corners(x0, side)
    rise = BRACE[0]
    t = BRACE[1] / math.sqrt(2)
    shape = poly([p_lo, p_hi, q_hi, q_lo])
    lit = f'M{f(p_hi[0])} {f(p_hi[1] + 0.5)}L{f(q_hi[0] + side * 0.5)} {f(q_hi[1])}'
    g = []
    for j in range(3):
        q = (j + 0.5) / 3
        g.append(f'M{f(xin)} {f(p_hi[1] + q * 2 * t)}L{f(xin + side * (rise - t + q * 2 * t))} {f(y_beam)}')
    pegs = ''.join(f'<circle cx="{f(px)}" cy="{f(py)}" r="1.1" fill="{w["dark"]}"></circle>'
                   f'<path d="M{f(px - 0.8)} {f(py - 0.7)}a1.1 1.1 0 0 1 1.5 -0.2" fill="none" stroke="{w["fleck"]}" stroke-width="0.4" stroke-opacity="0.7"></path>'
                   for px, py in ((xin + side * 4.6, y_beam + rise - 0.4), (xin + side * (rise - 0.6), y_beam + 4.4)))
    return (f'<path d="{shape}" fill="url(#ekBrace)"></path>'
            f'<path d="{"".join(g)}" fill="none" stroke="{w["dark"]}" stroke-width="0.4" stroke-opacity="0.5"></path>'
            f'<path d="{lit}" fill="none" stroke="{w["fleck"]}" stroke-width="0.9" stroke-opacity="0.7"></path>'
            f'<path d="M{f(p_lo[0])} {f(p_lo[1])}L{f(q_lo[0])} {f(q_lo[1])}" fill="none" stroke="{w["dark"]}" stroke-width="0.8"></path>{pegs}')


def footing(x0, side, st):
    """The post's stone (礎石), squat under it, its top lit."""
    x1 = x0 + POST_W
    l, r = (x0 - 3, x1 + POST_SIDE + 3) if side > 0 else (x0 - POST_SIDE - 3, x1 + 3)
    y = POST_FOOT
    return (f'<path d="M{f(l)} {y + 7}L{f(l + 1.4)} {y - 4}L{f(r - 1.4)} {y - 4}L{f(r)} {y + 7}Z" fill="{st["block"]}"></path>'
            f'<path d="M{f(l + 1.4)} {y - 4}L{f(r - 1.4)} {y - 4}L{f(r - 0.8)} {y - 1.4}L{f(l + 0.8)} {y - 1.4}Z" fill="{st["arris"]}"></path>'
            f'<rect x="{f(l)}" y="{y + 6}" width="{f(r - l)}" height="1.6" fill="{st["joint"]}" fill-opacity="0.7"></rect>')


LAMP = (300, BEAM[2])   # where the lamp hangs from the beam
BULB = (300, BEAM[2] + 24.4)


def lamp(w, lit):
    """The platform's lamp (外灯): a rod from the beam, an enamel shade,
    green without and white within, the bulb under it; lit at dawn, at
    dusk and at night."""
    x, y = LAMP
    shade = mix(w['dark'], '#2f5a44', 0.55)
    inside = '#f6efd8' if lit else mix(w['side'], '#d8d2c2', 0.6)
    bulb = '#fff4cf' if lit else mix(w['lit'], '#ffffff', 0.45)
    glow = (f'<g class="f4-lamp" style="{anim(4.2, 1.3)}"><circle cx="{x}" cy="{f(BULB[1])}" r="26" fill="url(#f4Lamp)"></circle>'
            f'<circle cx="{x}" cy="{f(BULB[1])}" r="10" fill="url(#f4Lamp)"></circle></g>') if lit else ''
    return (f'{glow}<path d="M{x} {f(y)}L{x} {f(y + 13)}" stroke="{w["dark"]}" stroke-width="0.9"></path>'
            f'<path d="M{x - 2.4} {f(y + 13)}L{x + 2.4} {f(y + 13)}L{x + 2} {f(y + 15)}L{x - 2} {f(y + 15)}Z" fill="{w["dark"]}"></path>'
            f'<path d="M{x - 10} {f(y + 23)}Q{x} {f(y + 11)} {x + 10} {f(y + 23)}Z" fill="{shade}"></path>'
            f'<path d="M{x - 10} {f(y + 23)}Q{x} {f(y + 20.6)} {x + 10} {f(y + 23)}Q{x} {f(y + 21.8)} {x - 10} {f(y + 23)}Z" fill="{inside}"></path>'
            f'<circle cx="{x}" cy="{f(BULB[1])}" r="2.3" fill="{bulb}"></circle>'
            f'<path d="M{x - 9.4} {f(y + 22.4)}Q{x - 4} {f(y + 16)} {x + 1} {f(y + 14.6)}" fill="none" stroke="{w["lit"]}" stroke-width="0.5" stroke-opacity="0.6"></path>')


def icicles(W, o, rng):
    """氷柱 along the fascia's foot, and the snow lying on the gutter's
    lip above them."""
    d = []
    x = -4
    while x < W + 4:
        ln = rng.uniform(1.5, 9) if rng.random() < 0.78 else rng.uniform(9, 16)
        wd = rng.uniform(1.0, 2.2)
        d.append(f'M{f(x)} {FASCIA - 0.3}L{f(x + wd * 0.55)} {f(FASCIA + ln)}L{f(x + wd)} {FASCIA - 0.3}Z')
        x += rng.uniform(2.6, 8)
    return (f'<path d="{"".join(d)}" fill="{o["cap"]}" fill-opacity="0.92"></path>'
            f'<path d="M-10 {FASCIA - 0.7}L{W + 10} {FASCIA - 0.7}" stroke="{o["cap"]}" stroke-width="0.9" stroke-opacity="0.9"></path>')


# ── the track and the platform ─────────────────────────────────────

TRACK = (528, 560)          # the ballast's far edge, the coping's
RAILS = (539, 553)          # the rail heads' tops
COPING = (560, 568)
LINE = 572                  # the white line's top
DRIP = 597                  # the eaves' shade on the stone, and the snow's edge


def stones(h, s, hour):
    """The stone's inks: the sea wall's, lit from above by the sky (a
    floor takes the sky's light as a wall does not), its joints, its
    arrises, the ballast's and a block's."""
    sky = h['sky'][-1][1]
    t = {'day': 0.58, 'dawn': 0.46, 'dusk': 0.4, 'night': 0.42}[hour]
    top = mix(s['wall'], sky, t)
    joint = mix(top, '#000000', 0.42)
    return dict(top=top, joint=joint, arris=mix(top, '#ffffff', 0.32), shade=mix(top, s['wall'], 0.55),
                gravel=mix(top, s['wall'], 0.42), block=mix(top, s['wall'], 0.3),
                speck=(mix(top, '#000000', 0.28), mix(top, '#ffffff', 0.3)))


def track(W, st, w, o, hour, rng):
    """The track past the platform: the ballast (バラスト) in its stones,
    the sleepers (枕木) fanning out toward the viewer, two rails, each its
    head lit along its top and its web in shade; in the snow, white
    between and over the sleepers, the rails dark under their caps."""
    y0, y1 = TRACK
    snow = w['snow']
    gravel = o['cap'] if snow else st['gravel']
    inks = ([o['cap_shade'], mix(o['cap'], o['cap_shade'], 0.5), o['cap']] if snow else
            [mix(gravel, '#000000', 0.32), mix(gravel, '#ffffff', 0.22), mix(gravel, '#000000', 0.14)])
    dots = []
    for _ in range(1100):
        y = y0 + (y1 - y0) * rng.random() ** 0.85
        x = rng.uniform(-6, W + 6)
        r = (0.3 + 0.7 * (y - y0) / (y1 - y0)) * rng.uniform(0.6, 1.15)
        dots.append((x, y, r, inks[rng.randrange(3)]))
    # the sleepers: each a strip running toward the viewer from beyond the
    # far rail to under the coping, half bedded in the ballast; under the
    # snow only the hollows between its mounds
    tie =mix(w['grain'], gravel, 0.5) if not snow else mix(o['cap_shade'], o['cap'], 0.72)
    ties, lips = [], []
    sy0, sy1 = 532.5, y1 + 2
    for i in range(-8, 9):
        xm = VP[0] + i * 25.0 + 6
        hw = 3.6
        a0, a1 = xm - hw, xm + hw
        ties.append(poly([(a0, sy0), (a1, sy0), (toward(a1, sy0, sy1), sy1), (toward(a0, sy0, sy1), sy1)]))
        lips.append(f'M{f(a0)} {f(sy0)}L{f(a1)} {f(sy0)}')
    rail_dark = mix(st['joint'], '#000000', 0.35)
    rail_lit = mix(st['arris'], '#ffffff', 0.55 if hour == 'day' else 0.3)
    rails = ''
    for y, k in ((RAILS[0], 0.82), (RAILS[1], 1.0)):
        rails += (f'<rect x="-10" y="{f(y + 4.6 * k)}" width="{W + 20}" height="{f(1.2 * k)}" fill="{mix(rail_dark, gravel, 0.45)}"></rect>'
                  f'<rect x="-10" y="{f(y + 1.6 * k)}" width="{W + 20}" height="{f(3.1 * k)}" fill="{rail_dark}"></rect>'
                  f'<rect x="-10" y="{f(y)}" width="{W + 20}" height="{f(1.7 * k)}" fill="{mix(rail_dark, rail_lit, 0.32)}"></rect>'
                  f'<rect x="-10" y="{f(y)}" width="{W + 20}" height="{f(0.7 * k)}" fill="{rail_lit}"></rect>')
        if snow:
            rails += f'<rect x="-10" y="{f(y - 0.8 * k)}" width="{W + 20}" height="{f(1.0 * k)}" fill="{o["cap"]}"></rect>'
    return (f'<rect x="-10" y="{f(y0)}" width="{W + 20}" height="{f(y1 - y0 + 4)}" fill="{gravel}"></rect>'
            + f'<path d="{"".join(ties)}" fill="{tie}"></path>'
            + f'<path d="{"".join(lips)}" fill="none" stroke="{w["lit"] if not snow else o["cap"]}" stroke-width="0.6" stroke-opacity="0.5"></path>'
            + stipple(dots, 0.55 if snow else 0.8, 0.6)
            + rails)


# the platform's courses by their distance (metres): the coping's inner
# edge, then a course every 0.24 m toward the viewer
COURSES = []
_d = off(COPING[1])
while _d > 1.2:
    COURSES.append(_d)
    _d -= 0.24


def weeds(pts, h, o, hour, rng):
    """A few blades of grass come up where the joints meet, as on any
    country platform (s5_fore's blades and inks)."""
    inks = s5_fore._grass_inks(h, o, hour)
    out = {c: [] for c in inks}
    for x, y, k in pts:
        for j in range(rng.randint(3, 6)):
            out[inks[j % 3]].append(s5_fore._blade(x + rng.uniform(-1.5, 1.5) * k, y + rng.uniform(-0.3, 0.3), rng.uniform(2.5, 6) * k,
                                                   rng.uniform(-0.7, 0.7), rng.uniform(0.6, 0.9) * k))
    return ''.join(f'<path d="{"".join(ds)}" fill="{c}"></path>' for c, ds in out.items() if ds)


def platform(W, h, st, w, o, hour, lit, rng):
    """The platform's stone: the coping (笠石) along its edge, its nose
    lit, its joints running to VP; the white line (白線) painted inside
    it; the slabs in courses closing up toward the edge, each its own
    tint, flecked as granite is, the joints staggered course by course
    and each a groove, dark with a lit arris; the eaves' shade across
    them; in the snow, white out to the eaves' drip; at the lit hours
    the lamp's light pooled under it."""
    snow = w['snow']
    c0, c1 = COPING
    out = [f'<rect x="-10" y="{f(c0)}" width="{W + 20}" height="{f(746 - c0 + 4)}" fill="{st["top"]}"></rect>']
    # the slabs: courses at their distances, joints across each, each
    # slab its own tint (lighter, darker, warmer, cooler), the joints
    # wandering a little as cut stone's do, a shade along each course's
    # near edge where it meets the next; grass where joints meet, here and
    # there, most of it by the coping, where nobody treads
    grooves, arrises, steps, spots = [], [], [], []
    tints = {}
    inks = (st['arris'], st['joint'], mix(st['top'], '#c8a070', 0.4), mix(st['top'], '#7d8a96', 0.4))
    ys = [at(d) for d in COURSES]
    for k, (ya, yb) in enumerate(zip(ys, ys[1:])):
        dy = yb - ya
        grooves.append(f'M-10 {f(yb)}L{W + 10} {f(yb)}')
        arrises.append(f'M-10 {f(yb + 0.6)}L{W + 10} {f(yb + 0.6)}')
        steps.append(f'M-10 {f(yb - min(1.6, dy * 0.18))}L{W + 10} {f(yb - min(1.6, dy * 0.18))}L{W + 10} {f(yb)}L-10 {f(yb)}Z')
        da, db = COURSES[k], COURSES[k + 1]
        X = -4.6 + rng.uniform(0, 0.4)
        prev = None
        while True:
            xa = VP[0] + FOCAL * X / da
            xb = VP[0] + FOCAL * X / db
            if xa > W + 60:
                break
            mx = (xa + xb) / 2 + rng.uniform(-0.6, 0.6) * (1 + dy / 30)
            grooves.append(f'M{f(xa)} {f(ya)}L{f(mx)} {f((ya + yb) / 2)}L{f(xb)} {f(yb)}')
            arrises.append(f'M{f(xa + 0.6)} {f(ya + 0.3)}L{f(mx + 0.6)} {f((ya + yb) / 2)}L{f(xb + 0.7)} {f(yb - 0.2)}')
            if prev:
                pa, pb = prev
                r = rng.random()
                if r < 0.78:
                    ink = inks[0 if r < 0.26 else (1 if r < 0.48 else (2 if r < 0.64 else 3))]
                    tints.setdefault(ink, []).append((poly([(pa, ya), (xa, ya), (xb, yb), (pb, yb)]), rng.random()))
                if k < 4 and rng.random() < (0.16 if k < 2 else 0.06):
                    spots.append((xa, ya, 0.55 + 0.2 * k))
            prev = (xa, xb)
            X += rng.uniform(0.26, 0.58)
    out.append(''.join(f'<path d="{"".join(q for q, a in qs if a < 0.45)}" fill="{ink}" fill-opacity="0.12"></path>'
                       f'<path d="{"".join(q for q, a in qs if a >= 0.45)}" fill="{ink}" fill-opacity="0.24"></path>'
                       for ink, qs in tints.items()))
    out.append(f'<path d="{"".join(steps)}" fill="{st["joint"]}" fill-opacity="0.16"></path>')
    # granite's fleck, finer toward the edge
    flecks = []
    for _ in range(1400):
        y = c1 + (746 - c1) * rng.random() ** 1.3
        x = rng.uniform(-4, W + 4)
        r = 0.18 + 0.5 * (y - c1) / (746 - c1)
        flecks.append((x, y, r, st['speck'][0] if rng.random() < 0.55 else st['speck'][1]))
    out.append(stipple(flecks, 0.48, 0.8))
    out.append(f'<path d="{"".join(grooves)}" fill="none" stroke="{st["joint"]}" stroke-width="0.75" stroke-opacity="0.7"></path>'
               f'<path d="{"".join(arrises)}" fill="none" stroke="{st["arris"]}" stroke-width="0.5" stroke-opacity="0.55"></path>')
    if not snow:
        out.append(weeds(spots, h, o, hour, rng))
    # the coping: long stones, each its own tint, their joints toward VP,
    # the nose lit, a dark joint inside it
    cj, ct = [], []
    x = -30 + rng.uniform(0, 20)
    while x < W + 30:
        nx = x + rng.uniform(58, 72)
        ct.append((poly([(x, c0), (nx, c0), (toward(nx, c0, c1), c1), (toward(x, c0, c1), c1)]), rng.uniform(-0.12, 0.14)))
        cj.append(f'M{f(x)} {c0}L{f(toward(x, c0, c1))} {c1}')
        x = nx
    coping = mix(st['top'], '#ffffff', 0.14)
    out.append(f'<rect x="-10" y="{c0}" width="{W + 20}" height="{c1 - c0}" fill="{coping}"></rect>'
               + ''.join(f'<path d="{q}" fill="{"#ffffff" if a > 0 else st["joint"]}" fill-opacity="{f(abs(a))}"></path>' for q, a in ct)
               + f'<path d="{"".join(cj)}" fill="none" stroke="{st["joint"]}" stroke-width="0.7" stroke-opacity="0.7"></path>'
               f'<rect x="-10" y="{c0}" width="{W + 20}" height="1.4" fill="{mix(st["arris"], "#ffffff", 0.45)}"></rect>'
               f'<rect x="-10" y="{c1 - 0.7}" width="{W + 20}" height="1.2" fill="{st["joint"]}" fill-opacity="0.8"></rect>')
    if snow:
        # the snow out to the eaves' drip, its edge ragged where the drip
        # fell, blue in its hollows; under the eaves only a dusting
        edge = [(-10, DRIP + 1)]
        x = -10
        while x < W + 10:
            x += rng.uniform(5, 12)
            edge.append((x, DRIP + rng.uniform(-1.6, 1.6)))
        lumps = ''.join(f'L{f(px)} {f(py)}' for px, py in reversed(edge))
        out.append(f'<path d="M-10 {f(c0 - 0.8)}L{W + 10} {f(c0 - 0.8)}{lumps}Z" fill="{o["cap"]}"></path>'
                   f'<rect x="-10" y="{f(c0 - 0.8)}" width="{W + 20}" height="{f(DRIP - c0 + 0.8)}" fill="url(#ekSnow)"></rect>'
                   f'<path d="M{f(edge[0][0])} {f(edge[0][1] + 0.5)}{"".join(f"L{f(px)} {f(py + 0.5)}" for px, py in edge[1:])}" '
                   f'fill="none" stroke="{o["cap_shade"]}" stroke-width="1.2" stroke-opacity="0.7"></path>'
                   f'<path d="M-10 {f(c1 + 1.5)}L{W + 10} {f(c1 + 1.5)}" stroke="{o["cap_shade"]}" stroke-width="0.8" stroke-opacity="0.45"></path>')
        dust = ''.join(f'M{f(px)} {f(py)}h{f(rng.uniform(0.6, 1.6))}' for px, py in
                       ((rng.uniform(0, W), DRIP + 2 + (746 - DRIP) * rng.random() ** 2) for _ in range(160)))
        out.append(f'<path d="{dust}" fill="none" stroke="{o["cap"]}" stroke-width="0.7" stroke-opacity="0.55" stroke-linecap="round"></path>')
    else:
        # the white line, painted over the stone, worn at its edges
        out.append(f'<path d="M-10 {LINE}L{W + 10} {LINE}L{W + 10} {LINE + 2.8}L-10 {LINE + 2.8}Z" fill="#f2efe6" '
                   f'fill-opacity="{f(0.92 if hour == "day" else 0.8)}"></path>')
    # the eaves' shade on the stone from the drip in, deepening under them
    out.append(f'<rect x="-10" y="{DRIP}" width="{W + 20}" height="{746 - DRIP + 4}" fill="url(#ekEaves)"></rect>')
    if lit:
        out.append(f'<ellipse cx="{BULB[0]}" cy="{f(POST_FOOT + 6)}" rx="150" ry="46" fill="url(#ekPool)"></ellipse>')
    return ''.join(out)


PLANTERS = ((-8, 104), (286, 398))
SOIL = 652
# the planters' flowers (s5_fore.FORE's layout): each clump's foot in a
# planter's soil, behind its front board
EKI_FORE = dict(
    base=1.0, front=600, shade=[], carpet=(-400, 2000, 1, 1), foot=None, foot_kacho=None,
    flowers=[(20, SOIL + 6, 0.95, 5), (72, SOIL + 7, 0.85, 4), (316, SOIL + 6, 0.85, 4), (368, SOIL + 7, 0.95, 5)],
    pampas=[(-2, SOIL + 7, 0.8, 4), (392, SOIL + 6, 0.8, 4)],
    far=[],
)
BOX = (SOIL + 4, 714)       # the front board's top, the box's foot


def planter_back(x0, x1, w):
    """A planter's back rim and the soil in it."""
    return (f'<rect x="{f(x0 + 1)}" y="{f(SOIL - 2.5)}" width="{f(x1 - x0 - 2)}" height="2.6" fill="{mix(w["face"], w["dark"], 0.3)}"></rect>'
            f'<rect x="{f(x0 + 1)}" y="{f(SOIL - 0.2)}" width="{f(x1 - x0 - 2)}" height="{f(BOX[0] - SOIL + 1)}" fill="#2a2018"></rect>')


def planter_front(x0, x1, w, o, rng):
    """A planter's front: three boards, each its top edge lit, grained,
    nailed to battens at the corners; snow on its rim in winter."""
    top, foot = BOX
    boards = [top + 13 * j for j in range(4)]
    seams = ''.join(f'M{f(x0)} {f(y)}L{f(x1)} {f(y)}' for y in boards[1:])
    lits = ''.join(f'M{f(x0)} {f(y + 0.7)}L{f(x1)} {f(y + 0.7)}' for y in boards[1:])
    grain = grain_lines(x0 + 1, x1 - 1, top + 2, foot - 2, rng, 7, (), wave=0.3, step=9, vertical=False)
    battens = ''.join(f'<rect x="{f(bx)}" y="{f(top - 0.5)}" width="7" height="{f(foot - top + 0.5)}" fill="url(#ekBox)"></rect>'
                      f'<path d="M{f(bx + 0.4)} {f(top)}L{f(bx + 0.4)} {f(foot)}" stroke="{w["fleck"]}" stroke-width="0.6" stroke-opacity="0.55"></path>'
                      for bx in (x0 + 5, x1 - 12))
    nails = ''.join(f'<circle cx="{f(bx + 3.5)}" cy="{f(y + 6.5)}" r="0.7" fill="{w["dark"]}"></circle>'
                    for bx in (x0 + 5, x1 - 12) for y in boards)
    cap = (f'<path d="M{f(x0)} {f(top + 0.6)}Q{f((x0 + x1) / 2)} {f(top - 2.4)} {f(x1)} {f(top + 0.6)}Z" fill="{o["cap"]}"></path>'
           if w['snow'] else '')
    return (f'<rect x="{f(x0)}" y="{f(top)}" width="{f(x1 - x0)}" height="{f(foot - top)}" fill="url(#ekBox)"></rect>'
            f'<path d="{grain}" fill="none" stroke="{w["dark"]}" stroke-width="0.4" stroke-opacity="0.5"></path>'
            f'<path d="{seams}" fill="none" stroke="{w["dark"]}" stroke-width="0.9" stroke-opacity="0.85"></path>'
            f'<path d="{lits}" fill="none" stroke="{w["fleck"]}" stroke-width="0.5" stroke-opacity="0.5"></path>'
            f'<rect x="{f(x0)}" y="{f(top)}" width="{f(x1 - x0)}" height="1.4" fill="{w["fleck"]}" fill-opacity="0.75"></rect>'
            f'{battens}{nails}{cap}')


def defs(h, s, st, w, o, hour, lit):
    """The station's own gradients."""
    snow = (f'<linearGradient id="ekSnow" x1="0" y1="{COPING[0]}" x2="0" y2="{DRIP}" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{o["cap_shade"]}" stop-opacity="0.34"></stop>'
            f'<stop offset="0.55" stop-color="{o["cap_shade"]}" stop-opacity="0"></stop>'
            f'<stop offset="1" stop-color="{o["cap_shade"]}" stop-opacity="0.14"></stop></linearGradient>') if w['snow'] else ''
    return (snow + f'<linearGradient id="ekSoffit" x1="0" y1="-4" x2="0" y2="79" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{w["dark"]}"></stop><stop offset="1" stop-color="{mix(w["dark"], w["face"], 0.8)}"></stop></linearGradient>'
            f'<linearGradient id="ekRafter" x1="0" y1="-4" x2="0" y2="79" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{mix(w["dark"], w["face"], 0.6)}"></stop><stop offset="1" stop-color="{mix(w["face"], w["lit"], 0.25)}"></stop></linearGradient>'
            f'<linearGradient id="ekBeam" x1="0" y1="{BEAM[0]}" x2="0" y2="{BEAM[1]}" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{mix(w["face"], w["dark"], 0.35)}"></stop><stop offset="1" stop-color="{mix(w["face"], w["lit"], 0.18)}"></stop></linearGradient>'
            f'<linearGradient id="ekBracket" x1="0" y1="{BEAM[2]}" x2="0" y2="{BEAM[2] + 8.5}" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{mix(w["face"], w["dark"], 0.2)}"></stop><stop offset="1" stop-color="{mix(w["face"], w["lit"], 0.4)}"></stop></linearGradient>'
            f'<linearGradient id="ekPost" x1="0" y1="96" x2="0" y2="{POST_FOOT}" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{mix(w["face"], w["dark"], 0.35)}"></stop><stop offset="0.2" stop-color="{w["face"]}"></stop>'
            f'<stop offset="0.82" stop-color="{w["face"]}"></stop><stop offset="1" stop-color="{mix(w["face"], w["dark"], 0.6)}"></stop></linearGradient>'
            f'<linearGradient id="ekSide" x1="0" y1="96" x2="0" y2="{POST_FOOT}" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{mix(w["side"], w["dark"], 0.3)}"></stop><stop offset="0.25" stop-color="{w["side"]}"></stop>'
            f'<stop offset="0.88" stop-color="{w["side"]}"></stop><stop offset="1" stop-color="{mix(w["side"], w["dark"], 0.5)}"></stop></linearGradient>'
            f'<linearGradient id="ekBrace" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{mix(w["face"], w["lit"], 0.28)}"></stop><stop offset="1" stop-color="{mix(w["face"], w["dark"], 0.25)}"></stop></linearGradient>'
            f'<linearGradient id="ekBox" x1="0" y1="{BOX[0]}" x2="0" y2="{BOX[1]}" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{mix(w["face"], w["lit"], 0.3)}"></stop><stop offset="1" stop-color="{mix(w["face"], w["dark"], 0.4)}"></stop></linearGradient>'
            f'<linearGradient id="ekEaves" x1="0" y1="{DRIP}" x2="0" y2="746" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{st["shade"]}" stop-opacity="0.28"></stop><stop offset="0.04" stop-color="{st["shade"]}" stop-opacity="0.4"></stop>'
            f'<stop offset="1" stop-color="{st["shade"]}" stop-opacity="0.62"></stop></linearGradient>'
            + (f'<radialGradient id="ekPool"><stop offset="0" stop-color="#ffd9a0" stop-opacity="{0.42 if hour == "night" else 0.28}"></stop>'
               f'<stop offset="0.5" stop-color="#ffc98a" stop-opacity="{0.16 if hour == "night" else 0.1}"></stop>'
               f'<stop offset="1" stop-color="#ffc98a" stop-opacity="0"></stop></radialGradient>'
               f'<radialGradient id="ekLampLight" cx="{BULB[0]}" cy="{f(BULB[1])}" r="190" gradientUnits="userSpaceOnUse">'
               f'<stop offset="0" stop-color="#ffcf8f" stop-opacity="{0.5 if hour == "night" else 0.34}"></stop>'
               f'<stop offset="0.45" stop-color="#ffc480" stop-opacity="{0.2 if hour == "night" else 0.13}"></stop>'
               f'<stop offset="1" stop-color="#ffc480" stop-opacity="0"></stop></radialGradient>' if lit else ''))


def lamp_light(x0, side):
    """Where the lamp's light falls on the timber: the post beside it,
    the brace and the bracket over it; a clip for the warm wash laid
    over them."""
    a, b = (x0, x0 + POST_W + POST_SIDE) if side > 0 else (x0 - POST_SIDE, x0 + POST_W)
    _, _, corners = brace_corners(x0, side)
    return (f'<path d="M{f(a)} 96L{f(b)} 96L{f(b)} {POST_FOOT}L{f(a)} {POST_FOOT}Z{poly(corners)}'
            f'{bracket_outline(x0, side)[2]}"></path>')


# ── the bay beyond ─────────────────────────────────────────────────

FAR_WALL = (460.6, 464.6)   # the far shore's embankment, the line on it


def far_shore(L, s, o, air, h, hour):
    """The far shore's low stone embankment (the bay's sea wall, far off),
    the snow on its coping in winter, and the line on it: the masts and
    wires over the rail, at the train's scale."""
    top, foot = FAR_WALL
    k = (foot - top) / 18
    Lw = dataclasses.replace(L, W=int(L.W / k) + 20, wall=(0, 18))
    Lm = dataclasses.replace(L, W=int(L.W / TRAIN_K) + 80, viaduct=(100, 140))
    return (f'<g transform="translate(0 {f(top)}) scale({f(k)})">{seawall(Lw, s)}{air.snow_line(Lw, o, "wall")}</g>'
            f'<g transform="translate(-14 {f(top - TRAIN_K * 100)}) scale({f(TRAIN_K)})">{catenary7(Lm, h, hour, 30)}</g>')


def near_wall(L, s, o, air):
    """The bay's sea wall under the bank, at a third of its size."""
    top, foot = L.wall
    k = (foot - top) / 18
    Lw = dataclasses.replace(L, W=int(L.W / k) + 20, wall=(0, 18))
    return f'<g transform="translate(0 {f(top)}) scale({f(k)})">{seawall(Lw, s)}{air.snow_line(Lw, o, "wall")}</g>'


def bay_water(L, h, s, o, far, near, hour):
    """scene_f6.water, the bay's surface; August's night has no moon (the
    fireworks are its light): its road laid off the print."""
    if o.get('fireworks'):
        L = dataclasses.replace(L, cx=-L.W)
    return water(L, h, s, far, near, hour, [], grouped=True)


def verge(L, h, o, hour):
    """The verge between the sea wall and the track, where the tree
    stands: its grass (s5_fore's tufts), under the snow in winter."""
    g = h['ground']
    y0, y1 = L.wall[1], TRACK[0]
    return (f'<rect x="-10" y="{f(y0 - 0.5)}" width="{L.W + 20}" height="{f(y1 - y0 + 3)}" fill="{mix(g, h["hill_near"], 0.3)}"></rect>'
            + s5_fore.tufts(L, h, o, hour, y0 + 2, y1 + 1, 40, 911))


# ── the print ───────────────────────────────────────────────────────

def station(season, hour, variant=None):
    """One print of the station: its four layers, the train's run, and
    the rows the train layer takes."""
    L = EKI
    sky = common.sky(L, season, hour, variant)
    with common.inside(season, hour, variant) as c, common.fore(EKI_FORE), common.fireworks_at(FIREWORKS), \
            common.swapped((s1_air.THIN, 390, THIN)):
        air, flora, h, s, o = c.air, c.flora, c.h, c.s, c.o
        fj = Fuji(*L.fuji)
        far, near = ridges(L)
        Lc = air.cloud_layout(L, hour, o)
        birds = air.flight(L, h, o, hour)
        fleet_ = fleet(L, h)
        w = woods(hour, o)
        st = stones(h, s, hour)
        lit = hour in ('dawn', 'dusk', 'night')
        back = (f'<g class="f5-clouds">{clouds(Lc, hour)}</g>'
                f'{air.thunderhead(L, h, o, hour, UID)}'
                f'{c.fuji(fj, h["fuji"], UID + "Fj", L.seed, o.get("snow", 0.27))}'
                f'{fog(L, s, 0)}{s1_scene.hills_far_s(L, h, s, far, o, hour)}{fog(L, s, 1)}'
                f'{s1_scene.hills_near_s(L, h, s, near, o, hour)}{village(L, h, s)}{smoke6(L, h)}{fog(L, s, 2)}'
                f'{birds if h["birds"] else ""}'
                f'{air.fireworks(L, h, o, hour, UID)}'
                f'{bay_water(L, h, s, o, far, near, hour)}'
                f'<g clip-path="url(#f6Bay)">{reflections7(fleet_, hour, UID, anim, grouped=True)}{air.fireworks_mirror(L, h, o, hour, UID)}</g>'
                f'{far_shore(L, s, o, air, h, hour)}'
                f'{boats7(fleet_, s, hour, UID, anim)}'
                f'{near_wall(L, s, o, air)}'
                f'{air.fireflies(L, h, o, hour, "far")}')
        # the line along the far shore, its train parked under the summit's
        # right flank, clear of the tree and of the right post
        train, run, band = common.small_train(L, h, s, hour, TRAIN_K, FAR_WALL[0] - 0.3, lead=322, reflect=FAR_WALL[1], uid='ek')
        # the season's tree turned to lean in from the left, and what it lets
        # fall carried the other way, as on the lake
        tree = flora.tree(L, h, o, hour, gust, UID)
        tree = common.turned(tree, TREE_FOOT, TREE_AT, TREE_K.get(o.get('tree'), 0.62))
        falls = f'<g transform="matrix(-1 0 0 1 {L.W} 0)">{air.falls(L, h, o, hour)}{s2_air.close(L, h, o, hour, UID)}</g>'
        timber = ''.join(post(x0, side, w, random.Random(L.seed + 973 + j)) for j, (x0, side) in enumerate(POSTS))
        timber += ''.join(brace(x0, side, w, random.Random(L.seed + 991 + j)) for j, (x0, side) in enumerate(POSTS))
        timber += ''.join(bracket(x0, side, w, random.Random(L.seed + 995 + j)) for j, (x0, side) in enumerate(POSTS))
        warm = ''
        if lit:
            # the lamp's light caught by the post beside it, the brace and
            # the bracket over it
            warm = (f'<defs><clipPath id="ekWarm">{lamp_light(*POSTS[1])}</clipPath></defs>'
                    f'<rect x="250" y="96" width="140" height="{POST_FOOT - 96}" fill="url(#ekLampLight)" clip-path="url(#ekWarm)"></rect>')
        front = (f'<defs>{defs(h, s, st, w, o, hour, lit)}</defs>'
                 + verge(L, h, o, hour)
                 + tree
                 + track(L.W, st, w, o, hour, random.Random(L.seed + 975))
                 + platform(L.W, h, st, w, o, hour, lit, random.Random(L.seed + 979))
                 + ''.join(footing(x0, side, st) for x0, side in POSTS)
                 + ('' if w['snow'] else weeds([(9, POST_FOOT + 7, 1.0), (34, POST_FOOT + 6.5, 0.8), (357, POST_FOOT + 7, 0.9)],
                                               h, o, hour, random.Random(L.seed + 989)))
                 + timber + warm
                 + soffit(L.W, w)
                 + beam(L.W, w, random.Random(L.seed + 983))
                 + (icicles(L.W, o, random.Random(L.seed + 985)) if w['snow'] else '')
                 + lamp(w, lit)
                 + ''.join(planter_back(a, b, w) for a, b in PLANTERS)
                 + flora.bank(L, h, o, hour, gust, anim)
                 + ''.join(planter_front(a, b, w, o, random.Random(L.seed + 987 + j)) for j, (a, b) in enumerate(PLANTERS))
                 + falls
                 + air.fireflies(L, h, o, hour, 'near'))
    return dict(layers=(sky, back, train, front), run=run, band=band, L=L)
