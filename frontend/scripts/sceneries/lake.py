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
import re

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
from el7 import boats7, catenary7, reflections7, susuki7
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
    # the boats nearer than the train's reflection (its rows end at 494):
    # the train layer is drawn over the water, so a sail standing in those
    # rows would have the reflection pass over it
    boats=[(236, 508, 0.5), (318, 518, 0.62), (272, 540, 0.78)],
    lone_boats=[(256, 512, 0.62), (306, 528, 0.72)],
    star_box=(0, 40, 390, 446),
    geese_path=((-70, 392), (440, 428), 30), cranes_path=((440, 50), (-170, 30), 40),
)
# the gate's lake: its boats in the open water between the gate and the
# tree on the right bank, whose crown hides the water where the lake's
# boats sail; the fisher on the light's road
GATE_LAKE = dataclasses.replace(
    LAKE, boats=[(146, 504, 0.5), (230, 514, 0.6), (172, 538, 0.74)], lone_boats=[(188, 516, 0.62), (226, 528, 0.7)])
# the near shore's meadow (s5_fore.FORE's layout): the gate's is the
# bay's own, its tree where the bay's stands, less the far patches (the
# lake is where they lay) and the pine's shade (the bay's second: the
# gate has no pine to cast it); the lake's is the bay's turned over with
# its tree, the drift under the tree at the left, and what the tree lets
# fall afloat on the water under its crown, drawn out by the water into a
# long shallow raft (花筏)
FIELD = s5_fore.FIELD_ONLY
TORII_FORE = {**s5_fore.FORE[390], 'far': [], 'shade': s5_fore.FORE[390]['shade'][:1]}
LAKE_FORE = dict(
    base=1.0, front=714, shade=[(30, 736, 70, 11, -8)], carpet=(92, 606, 78, 5), foot=(2, 714, 8), foot_kacho=(4, 716, 10),
    flowers=[(316, 749, 1.05, 7), (256, 752, 0.85, 4, FIELD), (-2, 748, 0.95, 5), (90, 752, 0.8, 4, FIELD),
             (214, 702, 0.85, 3, FIELD), (128, 688, 0.8, 3)],
    pampas=[(6, 750, 1.05, 7), (378, 750, 1.0, 6), (176, 676, 0.85, 3)],
    far=[],
)
# spring dawn's thin bands (s1_air.THIN), the first drawn short of the
# disc the challenge sets in the sky
THIN = [(-40, 94, 176, 6)] + s1_air.THIN[390][1:]
# August's fireworks over the far shore: on the lake one at the column's
# left edge, over the tree, and two right of Fuji, whose light lies in the
# open water (the tree hides the water at the left, the feed's buttons at
# the right); for the gate, right of Fuji
FIREWORKS = {
    'lake': [(48, 404, 28, '#ffd27a', 4.6), (306, 410, 20, '#ff8a7a', 5.9), (270, 438, 12, '#bff0a8', 7.3)],
    'torii': [(334, 396, 26, '#ffd27a', 4.6), (304, 424, 14, '#ff8a7a', 5.9), (362, 428, 11, '#bff0a8', 7.3)],
}
MIRROR = 0.78           # Fuji in the water, shortened as still water shows it
STRIPS = 8              # and broken into this many strips by the ripples
TREE_FOOT = (370, 712)  # the season's tree stands here on the bay's print
TRAIN_K = 0.5           # the line's train, far off: half the bay's
# the lake's tree, turned in from the left, a little under the bay's size;
# the crape myrtle, whose crown stands the tallest, smaller again, so its
# crown clears the far shore as the others' do (from about 500)
TREE_K = {'sarusuberi': 0.8}


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


def afloat(meadow, o, hour):
    """What the tree let fall lying on the water: s5_fore.fallen's petals
    without the tint it lays under them, which on the meadow is the
    ground taking their colour and on the water read as a glow. A tree
    that let something fall with no tint found to take out (fallen
    written otherwise than this reads it) fails the build."""
    out, n = re.subn(rf'<defs><radialGradient id="{UID}Carpet">[\s\S]*?</defs><ellipse [^>]*fill="url\(#{UID}Carpet\)"></ellipse>',
                     '', meadow, count=1)
    if not n and s5_fore.carpet_inks(o, hour)[0]:
        raise ValueError('lake.afloat: no tint under what fell to take out (s5_fore.fallen no longer lays it as read here)')
    return out


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


# the banks the bay draws its pampas in flower with (s5_fore._plants:
# autumn's cosmos, winter's camellia): the reeds flower from late summer
# as they do, and before it, with spring's rape and summer's hydrangea,
# stand as a bed of young stems
IN_FLOWER = ('cosmos', 'camellia')
YOUNG = 0.72    # a young stem's height, of a flowering one's


def plume_light(L, h, hour):
    """How the plumes catch the light at the hour: the opacity the bay's
    pampas give their racemes, which the reeds' share. el7.susuki7 keeps
    its table of the hours inline, so a stem of its pampas is drawn here
    and the opacity read off its plume; a pampas drawn otherwise than
    this reads it fails the build."""
    stem = susuki7(dataclasses.replace(L, susuki=[(0, 0, 1, 1)]), h, hour, gust, anim)
    m = re.search(r'class="f5-flutter"[^>]*><path [^>]*opacity="([\d.]+)"', stem)
    if not m:
        raise ValueError('lake.plume_light: el7.susuki7 no longer draws its plume as this reads it')
    return m.group(1)


def reeds(L, h, o, hour, spans, seed):
    """葦: reeds along the shore where the water meets the bank, in
    clumps with bare stretches between, taller toward a clump's middle:
    their blades in the meadow's grass inks (s5_fore's), and over them
    the stems. In flower (IN_FLOWER), each stem nods under its plume
    (穂), a few racemes drooping downwind as the pampas's do (el7.susuki7),
    smaller, and lit as theirs are; in the snow fewer and shorter, the
    stems dry, their plumes white with it. Before they flower, the young
    stems alone, shorter and green, each with a leaf arching off it."""
    inks = s5_fore._grass_inks(h, o, hour)
    snow = o.get('crowns') == 'snow'
    flowered = o.get('bank') in IN_FLOWER
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
            for k in range(rng.randint(1, 3)):
                ln = rng.uniform(15, 26) * tall * (1 if flowered else YOUNG)
                lean = rng.uniform(-0.28, 0.12)
                bx = x + rng.uniform(-2, 2)
                tx, ty = bx + lean * ln, y - ln
                stems.append(f'M{f(bx)} {f(y + 1)}Q{f(bx + lean * ln * 0.15)} {f(y - ln * 0.6)} {f(tx)} {f(ty)}')
                if not flowered:
                    # a leaf leaving the stem partway up (a point of the
                    # stem's curve), arching out to one side and the next
                    # stem's to the other
                    t = rng.uniform(0.3, 0.55)
                    lx = bx + lean * ln * (0.3 * t * (1 - t) + t * t)
                    ly = (1 - t) ** 2 * (y + 1) + 2 * (1 - t) * t * (y - ln * 0.6) + t * t * ty
                    side = 1 if (k + int(x)) % 2 else -1
                    blades[inks[1 + k % 2]].append(s5_fore._blade(lx, ly, ln * rng.uniform(0.38, 0.55), side * rng.uniform(0.75, 1.1),
                                                                  rng.uniform(0.75, 0.95)))
                    continue
                # the plume: racemes leaving the stem's last stretch, each
                # arching out and down the way the wind leans it
                for m in range(rng.randint(3, 5)):
                    ax, ay = tx - lean * m * 0.9, ty + m * 1.1
                    side = -1 if (m + (lean > -0.08)) % 2 else 1
                    rl = rng.uniform(2.6, 4.2) * (1 - 0.12 * m)
                    dx = side * rl * 0.55 + lean * rl * 1.6
                    racemes.append(f'M{f(ax)} {f(ay)}q{f(dx * 0.6)} {f(-rl * 0.25)} {f(dx)} {f(rl * 0.7)}')
            x += rng.uniform(3, 9)
    if snow:
        stem_ink = inks[2]                          # dry
    elif flowered:
        stem_ink = mix(inks[1], h['stem'], 0.5)
    else:
        stem_ink = mix(inks[1], inks[2], 0.5)       # young: the greener
    plumes = ''
    if racemes:
        # white with the snow, they are lit as the day's plumes at any hour
        plumes = (f'<path d="{"".join(racemes)}" fill="none" stroke="{o["cap"] if snow else h["plume"]}" stroke-width="0.7" '
                  f'stroke-linecap="round" opacity="{plume_light(L, h, "day" if snow else hour)}"></path>')
    return (''.join(f'<path d="{"".join(ds)}" fill="{c}"></path>' for c, ds in blades.items() if ds)
            + f'<path d="{"".join(stems)}" fill="none" stroke="{stem_ink}" stroke-width="0.6" stroke-linecap="round"></path>'
            + plumes)


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
    their lit side to the dark and ringed where they meet the lintel (台輪);
    the tie beam (貫) through them, the strut (額束) and its plaque (額),
    the lower lintel (島木) and on it the black lintel (笠木), the two
    swept up toward their ends together (反り), the lower a little the
    shorter; the beams lit along their tops and shaded under; snow along
    the top in winter. Returns its defs, the gate, the gate without its
    snow (for the water) and where its pillars stand (x left and right,
    their width, the lintel's half-span and its top)."""
    lit, mid, shade, black = TORII_INK[hour]
    hp = 1.22 * a
    span = 0.92 * a
    lean = 0.035 * a
    dw = 0.085 * a
    top = base - hp             # the lower lintel's foot, at the middle
    xl, xr = x - span / 2, x + span / 2
    sh = 0.075 * a              # the lower lintel's depth
    ky = top - sh               # where the two lintels meet, at the middle
    kw = span / 2 + 0.36 * a    # the black lintel's half-span
    th = 0.085 * a
    rise = 0.11 * a
    edge = 0.022 * a            # a beam's lit top and its shade under

    def sweep(lift):
        # the lintel's top or bottom edge, swept up toward its ends
        return (f'Q{f(x - kw * 0.55)} {f(ky - lift + 0.01 * a)} {f(x)} {f(ky - lift)} '
                f'Q{f(x + kw * 0.55)} {f(ky - lift + 0.01 * a)} {f(x + kw)} {f(ky - rise - lift)}')

    def at(X):
        # the black lintel's foot over X: its curve's right half from the
        # middle reaches x + kw (1.1 t - 0.1 t^2) at t, the left is the
        # same turned. Returns t and the curve's y there, less ky (up is
        # less than nought)
        q = min(1.0, abs(X - x) / kw)
        t = (1.1 - (1.21 - 0.4 * q) ** 0.5) / 0.2
        return t, 2 * t * (1 - t) * 0.01 * a - t * t * rise
    # the lower lintel runs under the black one's own curve, to ks each
    # way: that curve cut where it reaches x + ks
    ks = kw - 0.07 * a
    t, ey = at(x + ks)
    cx, cy = t * 0.55 * kw, t * 0.01 * a

    def under(dy):
        # the lower lintel's curve, dy below the black one's, end to end
        return (f'M{f(x - ks)} {f(ky + ey + dy)} Q{f(x - cx)} {f(ky + cy + dy)} {f(x)} {f(ky + dy)} '
                f'Q{f(x + cx)} {f(ky + cy + dy)} {f(x + ks)} {f(ky + ey + dy)}')
    shim = (f'<path d="{under(0)} L{f(x + ks)} {f(ky + ey + sh)} Q{f(x + cx)} {f(ky + cy + sh)} {f(x)} {f(ky + sh)} '
            f'Q{f(x - cx)} {f(ky + cy + sh)} {f(x - ks)} {f(ky + ey + sh)} Z" fill="{mid}"></path>'
            f'<path d="{under(edge / 2)}" fill="none" stroke="{lit}" stroke-width="{f(edge)}"></path>'
            f'<path d="{under(sh - edge / 2)}" fill="none" stroke="{shade}" stroke-width="{f(edge)}"></path>')

    def pillar(xb, inward):
        # up into the lower lintel, which covers its head; ringed under it
        xt = xb + inward * lean
        ring = ky + at(xt)[1] + sh - 0.004 * a
        return (f'<path d="M{f(xb - dw / 2)} {f(base)} L{f(xt - dw * 0.42)} {f(ky)} L{f(xt + dw * 0.42)} {f(ky)} '
                f'L{f(xb + dw / 2)} {f(base)} Z" fill="url(#{uid}Pil)"></path>'
                f'<rect x="{f(xt - dw * 0.62)}" y="{f(ring)}" width="{f(dw * 1.24)}" height="{f(0.05 * a)}" fill="{shade}"></rect>')
    nuki_y = top + 0.26 * a
    nuki = f'<rect x="{f(xl - 0.16 * a)}" y="{f(nuki_y)}" width="{f(span + 0.32 * a)}" height="{f(0.065 * a)}" fill="url(#{uid}Beam)"></rect>'
    strut = f'<rect x="{f(x - 0.05 * a)}" y="{f(top - 0.01 * a)}" width="{f(0.1 * a)}" height="{f(nuki_y - top + 0.01 * a)}" fill="url(#{uid}Pil)"></rect>'
    pw, ph = 0.12 * a, 0.17 * a
    plaque = (f'<rect x="{f(x - pw / 2)}" y="{f((top + nuki_y - ph) / 2)}" width="{f(pw)}" height="{f(ph)}" rx="{f(0.01 * a)}" '
              f'fill="{black}" stroke="{lit}" stroke-width="{f(0.014 * a)}"></rect>')
    kasa = (f'<path d="M{f(x - kw)} {f(ky - rise)} {sweep(0)} L{f(x + kw + 0.02 * a)} {f(ky - rise - th)} '
            f'Q{f(x + kw * 0.55)} {f(ky - th - 0.01 * a)} {f(x)} {f(ky - th)} '
            f'Q{f(x - kw * 0.55)} {f(ky - th - 0.01 * a)} {f(x - kw - 0.02 * a)} {f(ky - rise - th)} Z" fill="{black}"></path>'
            # the sky's light along its top
            f'<path d="M{f(x - kw * 0.98)} {f(ky - rise * 0.96 - th + edge / 2)} Q{f(x - kw * 0.55)} {f(ky - th - 0.01 * a + edge / 2)} '
            f'{f(x)} {f(ky - th + edge / 2)} Q{f(x + kw * 0.55)} {f(ky - th - 0.01 * a + edge / 2)} {f(x + kw * 0.98)} '
            f'{f(ky - rise * 0.96 - th + edge / 2)}" fill="none" stroke="{mix(black, "#ffffff", 0.2)}" stroke-width="{f(edge)}"></path>')
    cap = ''
    if o.get('crowns') == 'snow':
        cap = (f'<path d="M{f(x - kw)} {f(ky - rise - th)} Q{f(x - kw * 0.55)} {f(ky - th - 0.01 * a)} {f(x)} {f(ky - th)} '
               f'Q{f(x + kw * 0.55)} {f(ky - th - 0.01 * a)} {f(x + kw)} {f(ky - rise - th)} '
               f'Q{f(x + kw * 0.5)} {f(ky - th - 0.06 * a)} {f(x)} {f(ky - th - 0.05 * a)} '
               f'Q{f(x - kw * 0.5)} {f(ky - th - 0.06 * a)} {f(x - kw)} {f(ky - rise - th)} Z" fill="{o["cap"]}"></path>')
    defs = (f'<linearGradient id="{uid}Pil" x1="0" y1="0" x2="1" y2="0">'
            f'<stop offset="0" stop-color="{shade}"></stop><stop offset="0.35" stop-color="{lit}"></stop>'
            f'<stop offset="0.7" stop-color="{mid}"></stop><stop offset="1" stop-color="{shade}"></stop></linearGradient>'
            f'<linearGradient id="{uid}Beam" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{lit}"></stop><stop offset="0.45" stop-color="{mid}"></stop>'
            f'<stop offset="1" stop-color="{shade}"></stop></linearGradient>')
    body = f'{pillar(xl, 1)}{pillar(xr, -1)}{nuki}{strut}{plaque}{shim}{kasa}'
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
    L = GATE_LAKE if gate else LAKE
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
            tree = common.turned(tree, TREE_FOOT, LAKE_FORE['foot'][:2], TREE_K.get(o.get('tree'), 0.9))
            falls = f'<g transform="matrix(-1 0 0 1 {L.W} 0)">{falls}</g>'
        meadow = flora.fore_back(L, h, o, hour, gust, UID)
        front = (shore(L, h, UID)
                 + reeds(L, h, o, hour, REEDS[kind], 851)
                 + (meadow if gate else afloat(meadow, o, hour))
                 + tree
                 + flora.bank(L, h, o, hour, gust, anim)
                 + flora.fore_front(L, h, o, hour, gust, UID)
                 + falls
                 + air.fireflies(L, h, o, hour, 'near'))
    return dict(layers=(sky, back, train, front), run=run, band=band, L=L)
