"""逆さ富士 the mirror lake, and 鳥居 the lake gate (plan 309).

The lake: Fuji over a still lake and again upside down in it, the
reflection broken into strips by the ripples and sinking into the
water's ink toward the viewer; the line along the far shore on a low
stone embankment, its train a toy under the mountain, its lit windows
doubled in the water at night; the season's tree leaning in from the
left over the water; reeds and the season's flowers on the near shore,
under the feed's caption. The light's road lies under the disc the
challenge sets in the sky.

The gate (`gate=True`): the same lake without the line, the far shore
plain; a vermilion torii standing in the water in the left margin
(Hakone's), its reflection broken as Fuji's is; the season's tree on the
right bank, where the bay has it. Nothing in it moves: the quiet one.

    lake(season, hour, variant=None, gate=False) -> dict(layers, run, band, L)

Units are the phone's (390 x 746); the challenge shows the top 693 at
2.769 px a unit, then raises the print 52.7 units for the reading."""
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
from scene_f4 import anim
from scene_f5 import clouds, gust
from scene_f6 import fog, fleet, mix, ridges, seawall, smoke6, village, water
from el7 import boats7, catenary7, reflections7
from scene_f9 import ground9

# the lake, in the print's units: Fuji centred over it, its summit under
# the hook's plate (975 px), its flanks leaving the frame; the far shore
# at 462-472, the water to 655, the near shore under the caption
LAKE = dataclasses.replace(
    PHONE, cx=195, cy=150, disc_r=34, halo_r=40, fare_r=46, horizon=472,
    fuji=(195, 352, 462, 226), hills=(436, 450), water=(472, 655), wall=(462, 472), viaduct=(640, 700), ground=655,
    rows=15, chimneys=[],
    fog=[(118, 426, 300, 15, 0, 0.62, 0), (-90, 436, 250, 12, 1, 0.5, 0), (30, 450, 300, 8, 1, 0.42, 1),
         (170, 460, 260, 5, 0, 0.3, 2), (-50, 462, 170, 5, 0, 0.26, 2)],
    cloud_sets={
        'dawn': [(-34, 80, 150, 14), (238, 44, 168, 16), (-26, 262, 104, 11), (300, 280, 110, 11)],
        'day': [(-34, 84, 158, 16), (236, 42, 178, 18), (-26, 268, 108, 12), (296, 284, 116, 12)],
        'dusk': [(-44, 64, 176, 9), (236, 94, 150, 8)],
        'night': [(-34, 74, 176, 9), (258, 280, 150, 8)],
    },
    boats=[(236, 494, 0.5), (318, 508, 0.62), (272, 530, 0.78)],
    lone_boats=[(256, 502, 0.62), (306, 520, 0.72)],
    star_box=(0, 40, 390, 446),
    geese_path=((-70, 392), (440, 428), 30), cranes_path=((440, 50), (-170, 30), 40),
)
# the near shore's meadow (s5_fore.FORE's layout): the gate's is the
# bay's own, its tree where the bay's stands, less the far patches (the
# lake is where they lay); the lake's is the bay's turned over with its
# tree, the drift under the tree at the left, and what the tree lets fall
# lying on the water under its crown (花筏)
FIELD = s5_fore.FIELD_ONLY
TORII_FORE = {**s5_fore.FORE[390], 'far': []}
LAKE_FORE = dict(
    base=1.0, front=714, shade=[(30, 736, 70, 11, -8)], carpet=(66, 614, 50, 11), foot=(2, 714, 8), foot_kacho=(4, 716, 10),
    flowers=[(316, 749, 1.05, 7), (256, 752, 0.85, 4, FIELD), (-2, 748, 0.95, 5), (90, 752, 0.8, 4, FIELD),
             (214, 702, 0.85, 3, FIELD), (128, 688, 0.8, 3)],
    pampas=[(6, 750, 1.05, 7), (378, 750, 1.0, 6), (176, 676, 0.85, 3)],
    far=[],
)
# spring dawn's thin bands (s1_air.THIN), the first drawn short of the
# disc the challenge sets in the sky
THIN = [(-40, 94, 176, 6)] + s1_air.THIN[390][1:]
# August's fireworks over the far shore at the column's edges; for the
# gate, right of Fuji
FIREWORKS = {
    'lake': [(48, 404, 28, '#ffd27a', 4.6), (346, 418, 20, '#ff8a7a', 5.9), (68, 436, 12, '#bff0a8', 7.3)],
    'torii': [(334, 396, 26, '#ffd27a', 4.6), (304, 424, 14, '#ff8a7a', 5.9), (362, 428, 11, '#bff0a8', 7.3)],
}
MIRROR = 0.78           # Fuji in the water, shortened as still water shows it
STRIPS = 8              # and broken into this many strips by the ripples
TREE_FOOT = (370, 712)  # the season's tree stands here on the bay's print
TRAIN_K = 0.5           # the line's train, far off: half the bay's


# ── 逆さ富士 ───────────────────────────────────────────────────────

def mirror(L, fj, h, o, fuji_s, uid):
    """Fuji upside down in the water: the mountain again (its own uid),
    turned over at the waterline and shortened, held once in <defs> and
    printed in strips, each strip moved a little sideways as the ripples
    move it (and held there in a still), the whole sinking into the
    water's ink toward the viewer: strong at the shore, so it holds under
    the challenge's wash, faint where its summit lies."""
    y0 = L.water[0]
    yb = fj.yb
    low = y0 + (yb - fj.ys) * MIRROR + 4
    m = f'matrix(1 0 0 {f(-MIRROR)} 0 {f(y0 + MIRROR * yb)})'
    body = fuji_s(fj, h['fuji'], uid + 'Fm', L.seed, o.get('snow', 0.27))
    # a <defs> inside another is cut short by the carousel's loader:
    # the mountain's own defs are lifted out beside the turned body
    inner, rest = body.split('</defs>', 1)
    inner = inner.split('<defs>', 1)[1]
    band = (low - y0) / STRIPS
    clips, strips = [], []
    for j in range(STRIPS):
        sy = y0 + j * band
        clips.append(f'<clipPath id="{uid}Ms{j}"><rect x="-40" y="{f(sy)}" width="{L.W + 80}" height="{f(band + 0.6)}"></rect></clipPath>')
        dx = (0.4 + j * 0.35) * (1 if j % 2 else -1)
        strips.append(f'<g clip-path="url(#{uid}Ms{j})"><g transform="translate({f(dx)} 0)">'
                      f'<g class="f6-ripple" style="--r: {f(0.5 + j * 0.3)}px; {anim(4.4, 4.4 - j * 0.5)}">'
                      f'<use href="#{uid}Mir"></use></g></g></g>')
    defs = (f'<defs>{inner}<g id="{uid}Mir" transform="{m}">{rest}</g>{"".join(clips)}'
            f'<linearGradient id="{uid}MFade" x1="0" y1="{f(y0)}" x2="0" y2="{f(low)}" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="#fff" stop-opacity="0.82"></stop><stop offset="0.55" stop-color="#fff" stop-opacity="0.56"></stop>'
            f'<stop offset="1" stop-color="#fff" stop-opacity="0.14"></stop></linearGradient>'
            f'<mask id="{uid}MMask" maskUnits="userSpaceOnUse" x="-40" y="{f(y0)}" width="{L.W + 80}" height="{f(low - y0 + 2)}">'
            f'<rect x="-40" y="{f(y0)}" width="{L.W + 80}" height="{f(low - y0 + 2)}" fill="url(#{uid}MFade)"></rect></mask></defs>')
    return defs, f'<g mask="url(#{uid}MMask)"><g filter="url(#f6Smear)">{"".join(strips)}</g></g>'


def lake_water(L, h, s, o, far, near, hour, under):
    """scene_f6.water, the bay's surface, with `under` laid on it before
    the hills' reflection and the waves, as the hills' own is. August's
    night has no moon (the fireworks are its light): its road is laid
    off the print."""
    if o.get('fireworks'):
        L = dataclasses.replace(L, cx=-L.W)
    surface = water(L, h, s, far, near, hour, [], grouped=True)
    at = surface.index('<g mask="url(#f6ReflFade)">')
    return surface[:at] + under + surface[at:]


# ── the far shore ───────────────────────────────────────────────────

def embankment(L, s, o, air, h, hour):
    """The far shore's low stone embankment (the bay's sea wall, far off:
    half its size), the snow along its coping in winter, and the line on
    it: the masts and wires over the rail, at the train's scale."""
    top, foot = L.wall
    k = (foot - top) / 20
    Lw = dataclasses.replace(L, W=int(L.W / k) + 20, wall=(0, 20))
    Lm = dataclasses.replace(L, W=int(L.W / TRAIN_K) + 80, viaduct=(100, 140))
    return (f'<g transform="translate(0 {f(top)}) scale({f(k)})">{seawall(Lw, s)}{air.snow_line(Lw, o, "wall")}</g>'
            f'<g transform="translate(-14 {f(top - TRAIN_K * 100)}) scale({f(TRAIN_K)})">{catenary7(Lm, h, hour, 30)}</g>')


# ── the near shore ──────────────────────────────────────────────────

def shore(L, h, uid):
    """The near shore: the bank's ground meeting the water in a soft
    wave, in ground9's bokashi."""
    g, W = L.ground, L.W
    return (f'<path d="M-10 {f(g + 3)} C{f(W * 0.18)} {f(g - 3)} {f(W * 0.34)} {f(g + 4)} {f(W * 0.52)} {f(g)} '
            f'S{f(W * 0.84)} {f(g + 3)} {W + 10} {f(g - 2)} L{W + 10} {f(L.H + 2)} L-10 {f(L.H + 2)} Z" fill="{h["ground"]}"></path>'
            + ground9(L, h, uid))


GLOW = {'day': 1.0, 'dawn': 0.95, 'dusk': 0.85, 'night': 0.45}   # how the plumes catch the light (el7.susuki7's)


def reeds(L, h, o, hour, spans, seed):
    """葦: reeds along the shore where the water meets the bank, in
    clumps with bare stretches between, taller toward a clump's middle:
    their blades in the meadow's grass inks (s5_fore's), and over them
    the stems, each nodding under its plume (穂), a few racemes drooping
    downwind as the pampas's do (el7.susuki7), smaller; in the snow fewer
    and shorter, the stems dry, their plumes white with it."""
    inks = s5_fore._grass_inks(h, o, hour)
    snow = o.get('crowns') == 'snow'
    rng = random.Random(L.seed + seed)
    blades = {c: [] for c in inks}
    stems, racemes = [], []
    y = L.ground + 2
    for x0, x1 in spans:
        x = x0 + rng.uniform(0, 4)
        while x < x1:
            if rng.random() < (0.4 if snow else 0.22):
                x += rng.uniform(6, 14)
                continue
            u = (x - (x0 + x1) / 2) / max(1, (x1 - x0) / 2)
            tall = rng.uniform(0.7, 1.0) * (1 - 0.4 * u * u) * (0.75 if snow else 1)
            for j in range(rng.randint(3, 6)):
                blades[inks[j % 3]].append(s5_fore._blade(x + rng.uniform(-2.5, 2.5), y + rng.uniform(-0.5, 2.5),
                                                          rng.uniform(6, 13) * tall, rng.uniform(-0.55, 0.45), rng.uniform(0.9, 1.3)))
            for _ in range(rng.randint(1, 3)):
                ln = rng.uniform(15, 26) * tall
                lean = rng.uniform(-0.28, 0.12)
                bx = x + rng.uniform(-2, 2)
                tx, ty = bx + lean * ln, y - ln
                stems.append(f'M{f(bx)} {f(y + 1)}Q{f(bx + lean * ln * 0.15)} {f(y - ln * 0.6)} {f(tx)} {f(ty)}')
                # the plume: racemes leaving the stem's last stretch, each
                # arching out and down the way the wind leans it
                for m in range(rng.randint(3, 5)):
                    ax, ay = tx - lean * m * 0.9, ty + m * 1.1
                    side = -1 if (m + (lean > -0.08)) % 2 else 1
                    rl = rng.uniform(2.6, 4.2) * (1 - 0.12 * m)
                    dx = side * rl * 0.55 + lean * rl * 1.6
                    racemes.append(f'M{f(ax)} {f(ay)}q{f(dx * 0.6)} {f(-rl * 0.25)} {f(dx)} {f(rl * 0.7)}')
            x += rng.uniform(3, 9)
    stem_ink = inks[2] if snow else mix(inks[1], h['stem'], 0.5)
    plume = o['cap'] if snow else h['plume']
    return (''.join(f'<path d="{"".join(ds)}" fill="{c}"></path>' for c, ds in blades.items() if ds)
            + f'<path d="{"".join(stems)}" fill="none" stroke="{stem_ink}" stroke-width="0.6" stroke-linecap="round"></path>'
            + f'<path d="{"".join(racemes)}" fill="none" stroke="{plume}" stroke-width="0.7" stroke-linecap="round" '
              f'opacity="{f(0.9 * (1 if snow else GLOW[hour]))}"></path>')


# ── 鳥居 ───────────────────────────────────────────────────────────

TORII_INK = {
    # the vermilion lit, its body, its shade; the black lintel's; at
    # night lifted so the gate still reads
    'dawn': ('#d8603f', '#b34430', '#7c2e2a', '#2c2228'),
    'day': ('#da4a2e', '#b9381f', '#8a2a1c', '#28221f'),
    'dusk': ('#c4503a', '#96382e', '#5e2a2e', '#221c26'),
    'night': ('#7e3c3e', '#5c2d35', '#3b2230', '#15131c'),
}
GATE = (54, 520, 61)    # the gate's middle, the pillars' feet (in the water), its size
GATE_MIRROR = 0.74


def torii(x, base, a, hour, o, uid):
    """鳥居, a myōjin gate: two pillars leaning in a little, shaded from
    their lit side to the dark; the tie beam (貫) through them, the strut
    (額束), the lower lintel (島木) and over it the black lintel (笠木),
    its ends swept up (反り); snow along it in winter. Returns its defs,
    the gate, the gate without its snow (for the water) and where its
    pillars stand (x left and right, their width, the lintel's half-span
    and its top)."""
    lit, mid, shade, black = TORII_INK[hour]
    hp = 1.22 * a
    span = 0.92 * a
    lean = 0.035 * a
    dw = 0.085 * a
    top = base - hp
    xl, xr = x - span / 2, x + span / 2

    def pillar(xb, inward):
        xt = xb + inward * lean
        return (f'<path d="M{f(xb - dw / 2)} {f(base)} L{f(xt - dw * 0.42)} {f(top)} L{f(xt + dw * 0.42)} {f(top)} '
                f'L{f(xb + dw / 2)} {f(base)} Z" fill="url(#{uid}Pil)"></path>')
    nuki_y = top + 0.26 * a
    nuki = (f'<rect x="{f(xl - 0.16 * a)}" y="{f(nuki_y)}" width="{f(span + 0.32 * a)}" height="{f(0.065 * a)}" fill="{mid}"></rect>'
            f'<rect x="{f(xl - 0.16 * a)}" y="{f(nuki_y + 0.05 * a)}" width="{f(span + 0.32 * a)}" height="{f(0.015 * a)}" fill="{shade}"></rect>')
    strut = f'<rect x="{f(x - 0.05 * a)}" y="{f(top - 0.02 * a)}" width="{f(0.1 * a)}" height="{f(nuki_y - top + 0.02 * a)}" fill="{mid}"></rect>'
    shim_y = top - 0.075 * a
    shim = (f'<rect x="{f(xl - 0.2 * a)}" y="{f(shim_y)}" width="{f(span + 0.4 * a)}" height="{f(0.075 * a)}" fill="{lit}"></rect>'
            f'<rect x="{f(xl - 0.2 * a)}" y="{f(shim_y + 0.055 * a)}" width="{f(span + 0.4 * a)}" height="{f(0.02 * a)}" fill="{shade}"></rect>')
    kw = span / 2 + 0.36 * a
    ky = shim_y - 0.012 * a
    th = 0.085 * a
    rise = 0.11 * a

    def sweep(lift):
        # the lintel's top or bottom edge, swept up toward its ends
        return (f'Q{f(x - kw * 0.55)} {f(ky - lift + 0.01 * a)} {f(x)} {f(ky - lift)} '
                f'Q{f(x + kw * 0.55)} {f(ky - lift + 0.01 * a)} {f(x + kw)} {f(ky - rise - lift)}')
    kasa = (f'<path d="M{f(x - kw)} {f(ky - rise)} {sweep(0)} L{f(x + kw + 0.02 * a)} {f(ky - rise - th)} '
            f'Q{f(x + kw * 0.55)} {f(ky - th - 0.01 * a)} {f(x)} {f(ky - th)} '
            f'Q{f(x - kw * 0.55)} {f(ky - th - 0.01 * a)} {f(x - kw - 0.02 * a)} {f(ky - rise - th)} Z" fill="{black}"></path>')
    under = (f'<path d="M{f(x - kw * 0.96)} {f(ky - rise * 0.8)} Q{f(x - kw * 0.55)} {f(ky + 0.01 * a)} {f(x)} {f(ky)} '
             f'Q{f(x + kw * 0.55)} {f(ky + 0.01 * a)} {f(x + kw * 0.96)} {f(ky - rise * 0.8)}" fill="none" stroke="{lit}" stroke-width="{f(0.03 * a)}"></path>')
    cap = ''
    if o.get('crowns') == 'snow':
        cap = (f'<path d="M{f(x - kw)} {f(ky - rise - th)} Q{f(x - kw * 0.55)} {f(ky - th - 0.01 * a)} {f(x)} {f(ky - th)} '
               f'Q{f(x + kw * 0.55)} {f(ky - th - 0.01 * a)} {f(x + kw)} {f(ky - rise - th)} '
               f'Q{f(x + kw * 0.5)} {f(ky - th - 0.06 * a)} {f(x)} {f(ky - th - 0.05 * a)} '
               f'Q{f(x - kw * 0.5)} {f(ky - th - 0.06 * a)} {f(x - kw)} {f(ky - rise - th)} Z" fill="{o["cap"]}"></path>')
    defs = (f'<linearGradient id="{uid}Pil" x1="0" y1="0" x2="1" y2="0">'
            f'<stop offset="0" stop-color="{shade}"></stop><stop offset="0.35" stop-color="{lit}"></stop>'
            f'<stop offset="0.7" stop-color="{mid}"></stop><stop offset="1" stop-color="{shade}"></stop></linearGradient>')
    body = f'{pillar(xl, 1)}{pillar(xr, -1)}{nuki}{strut}{shim}{kasa}{under}'
    return defs, body + cap, body, (xl, xr, dw, kw, ky - rise - th)


def standing(s, hour, o, uid):
    """The gate standing in the water, its feet lapped, and the gate
    upside down under it, shortened, faded and broken in five strips:
    its defs, its reflection (for the water) and the gate."""
    x, base, a = GATE
    defs, dressed, plain, (xl, xr, dw, kw, top) = torii(x, base, a, hour, o, uid)
    shade = TORII_INK[hour][2]
    m = f'matrix(1 0 0 {f(-GATE_MIRROR)} 0 {f((1 + GATE_MIRROR) * base)})'
    low = base + (base - top) * GATE_MIRROR + 2
    n = 5
    band = (low - base) / n
    clips, strips = [], []
    for j in range(n):
        sy = base + j * band
        clips.append(f'<clipPath id="{uid}Gs{j}"><rect x="{f(x - kw - 20)}" y="{f(sy)}" width="{f(kw * 2 + 40)}" height="{f(band + 0.6)}"></rect></clipPath>')
        dx = (0.5 + j * 0.45) * (1 if j % 2 else -1)
        strips.append(f'<g clip-path="url(#{uid}Gs{j})"><g transform="translate({f(dx)} 0)">'
                      f'<g class="f6-ripple" style="--r: {f(0.45 + j * 0.35)}px; {anim(3.8, 3.8 - j * 0.6)}">'
                      f'<use href="#{uid}Gm"></use></g></g></g>')
    defs = (f'<defs>{defs}<g id="{uid}Gm" transform="{m}">{plain}</g>{"".join(clips)}'
            f'<linearGradient id="{uid}GFade" x1="0" y1="{f(base)}" x2="0" y2="{f(low)}" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="#fff" stop-opacity="0.62"></stop><stop offset="1" stop-color="#fff" stop-opacity="0.06"></stop></linearGradient>'
            f'<mask id="{uid}GMask" maskUnits="userSpaceOnUse" x="{f(x - kw - 30)}" y="{f(base)}" width="{f(kw * 2 + 60)}" height="{f(low - base + 2)}">'
            f'<rect x="{f(x - kw - 30)}" y="{f(base)}" width="{f(kw * 2 + 60)}" height="{f(low - base + 2)}" fill="url(#{uid}GFade)"></rect></mask></defs>')
    refl = f'<g mask="url(#{uid}GMask)"><g filter="url(#f6Smear)">{"".join(strips)}</g></g>'
    # where each pillar stands in the water: a dark ring and the lap's light
    laps = ''.join(f'<ellipse cx="{f(px)}" cy="{f(base + 0.4)}" rx="{f(dw * 1.5)}" ry="{f(0.024 * a)}" fill="{shade}" opacity="0.55"></ellipse>'
                   for px in (xl, xr))
    wash = ''.join(f'M{f(px - dw * 1.6)} {f(base + 1.2)}l{f(dw * 1.1)} 0M{f(px + dw * 0.5)} {f(base + 1.6)}l{f(dw * 1.2)} 0' for px in (xl, xr))
    laps += (f'<g class="f6-lap" style="{anim(3.2, 1)}" stroke="{s["wet"]}" stroke-opacity="0.55" stroke-width="0.7" '
             f'stroke-linecap="round"><path d="{wash}" fill="none"></path></g>')
    return defs, refl, laps + dressed


# ── the print ───────────────────────────────────────────────────────

# the reeds' runs along the near shore: where the lake's tree stands and
# the gate's, a gap for the trunk
REEDS = {'lake': [(14, 60), (96, 178), (226, 300), (330, 400)], 'torii': [(-6, 40), (88, 176), (214, 300)]}


def lake(season, hour, variant=None, gate=False):
    """One print of the lake (or of the gate): its four layers, the
    train's run, and the rows the train layer takes (None: no line)."""
    L = LAKE
    kind = 'torii' if gate else 'lake'
    sky = common.sky(L, season, hour, variant)
    with common.inside(season, hour, variant) as c, common.fore(TORII_FORE if gate else LAKE_FORE), \
            common.fireworks_at(FIREWORKS[kind]), common.swapped((s1_air.THIN, 390, THIN)):
        air, flora, h, s, o = c.air, c.flora, c.h, c.s, c.o
        fj = Fuji(*L.fuji)
        far, near = ridges(L)
        Lc = air.cloud_layout(L, hour, o)
        birds = air.flight(L, h, o, hour)
        fleet_ = fleet(L, h)
        defs, under = mirror(L, fj, h, o, c.fuji, 'lk')
        if gate:
            gdefs, grefl, torii_ = standing(s, hour, o, "tg")
            defs += gdefs
            under += grefl
        back = (f'{defs}<g class="f5-clouds">{clouds(Lc, hour)}</g>'
                f'{air.thunderhead(L, h, o, hour, UID)}'
                f'{birds if h["birds"] == "cranes" else ""}'
                f'{c.fuji(fj, h["fuji"], UID + "Fj", L.seed, o.get("snow", 0.27))}'
                f'{fog(L, s, 0)}{s1_scene.hills_far_s(L, h, s, far, o, hour)}{fog(L, s, 1)}'
                f'{s1_scene.hills_near_s(L, h, s, near, o, hour)}{village(L, h, s)}{smoke6(L, h)}{fog(L, s, 2)}'
                f'{air.fireworks(L, h, o, hour, UID)}'
                f'{lake_water(L, h, s, o, far, near, hour, under)}'
                f'<g clip-path="url(#f6Bay)">{reflections7(fleet_, hour, UID, anim, grouped=True)}{air.fireworks_mirror(L, h, o, hour, UID)}</g>'
                f'{"" if gate else embankment(L, s, o, air, h, hour)}'
                f'{boats7(fleet_, s, hour, UID, anim)}'
                f'{torii_ if gate else ""}'
                f'{birds if h["birds"] not in ("cranes", None) else ""}'
                f'{air.fireflies(L, h, o, hour, "far")}')
        if gate:
            train, run, band = '', 0.0, None
        else:
            train, run, band = common.small_train(L, h, s, hour, TRAIN_K, L.wall[0] - 0.2, reflect=L.water[0], uid='lk')
        tree = flora.tree(L, h, o, hour, gust, UID)
        falls = air.falls(L, h, o, hour) + s2_air.close(L, h, o, hour, UID)
        if not gate:
            # the tree leans in from the left, over the water, and the wind
            # carries what falls off it the other way
            tree = common.turned(tree, TREE_FOOT, LAKE_FORE['foot'][:2], 0.9)
            falls = f'<g transform="matrix(-1 0 0 1 {L.W} 0)">{falls}</g>'
        front = (shore(L, h, UID)
                 + reeds(L, h, o, hour, REEDS[kind], 851)
                 + flora.fore_back(L, h, o, hour, gust, UID)
                 + tree
                 + flora.bank(L, h, o, hour, gust, anim)
                 + flora.fore_front(L, h, o, hour, gust, UID)
                 + falls
                 + air.fireflies(L, h, o, hour, 'near'))
    return dict(layers=(sky, back, train, front), run=run, band=band, L=L)

