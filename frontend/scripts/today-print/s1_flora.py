"""S¹ · what grows (plan 261): the season's tree at the print's right, answering
the pine at its left (a cherry in spring, a maple in autumn); the pine
under its snow in winter; the bank's flowers (rape blossom, hydrangea,
cosmos and pampas, camellia by the withered pampas).

Every bough sways with the print's gust (f5-gust) a beat after the one
below, as the pine's do; nothing else here moves."""
import math
import random
from geo import f
from el7 import (PINE, TRUNK, limb, lit_band, bark, tier, mix, cosmos7, susuki7, DUSKEN, smooth)
from brush import polar

# ── where the season's tree stands, per frame ───────────────────────
# the trunk's spine (x, y, width), foot to crown, and its limbs, each a
# spine from the trunk out; the crown's clusters are set along them.
# The phone's crown keeps above the train's roof and under Fuji's
# flank; the desk's stands at the window's right, under the board.

TREE = {
    390: dict(
        trunk=[(370, 712, 13), (365, 680, 11.5), (358, 648, 10), (351, 620, 8.8), (346, 596, 7.8), (342, 574, 7),
               (339, 556, 6.2), (337, 540, 5.4)],
        limbs=[
            [(341, 566, 5.6), (326, 552, 4.4), (306, 540, 3.4), (284, 532, 2.6), (262, 528, 1.8)],
            [(338, 546, 4.8), (331, 528, 3.8), (321, 512, 2.9), (309, 500, 2.1), (298, 492, 1.4)],
            [(337, 541, 4.6), (346, 522, 3.6), (357, 506, 2.7), (368, 494, 2), (378, 486, 1.4)],
            [(343, 566, 5), (360, 548, 4), (378, 536, 3), (396, 528, 2.2)],
        ],
        crown=(318, 512), spread=1.0, lanterns=[(276, 553), (296, 559), (318, 561), (366, 566), (388, 563)],
        # the crown's lobes (cx, cy, rx, ry), back to front, each held by
        # the limb it hangs on (an index into `limbs`)
        lobes=[(330, 492, 34, 15, 1), (372, 496, 26, 17, 2), (292, 505, 28, 13, 1), (318, 514, 52, 19, 0),
               (268, 524, 26, 11, 0), (384, 516, 22, 15, 3), (346, 524, 34, 13, 3)],
    ),
    1184: dict(
        trunk=[(1110, 930, 24), (1102, 880, 21), (1090, 834, 18), (1080, 796, 16), (1072, 764, 14), (1066, 738, 12.5),
               (1062, 716, 11)],
        limbs=[
            [(1068, 742, 10), (1040, 722, 8), (1006, 706, 6), (972, 696, 4.4), (940, 692, 3)],
            [(1064, 722, 9), (1052, 692, 7), (1036, 668, 5.2), (1018, 652, 3.8), (1002, 644, 2.6)],
            [(1063, 716, 9), (1078, 686, 7), (1094, 664, 5.2), (1112, 648, 3.8), (1128, 640, 2.6)],
            [(1072, 752, 9.5), (1102, 730, 7.4), (1134, 714, 5.4), (1170, 704, 3.6), (1196, 700, 2.6)],
        ],
        crown=(1060, 690), spread=1.9, lanterns=[(948, 742), (986, 752), (1024, 756), (1112, 762), (1154, 756)],
        lobes=[(1030, 652, 70, 30, 1), (1118, 650, 56, 34, 2), (976, 676, 56, 26, 1), (1050, 690, 104, 36, 0),
               (930, 706, 50, 22, 0), (1150, 690, 50, 30, 3), (1092, 712, 70, 26, 3)],
    ),
}


def defs(L, h, o, hour, uid):
    out = []
    if o.get('lanterns'):
        out.append(f'<radialGradient id="{uid}Lantern"><stop offset="0" stop-color="#ffd9a0" stop-opacity="0.75"></stop>'
                   f'<stop offset="0.4" stop-color="#ffb070" stop-opacity="0.32"></stop><stop offset="1" stop-color="#ff9a5c" stop-opacity="0"></stop></radialGradient>')
    return ''.join(out)


# ── the season's tree ──────────────────────────────────────────────

def _along(spine, t):
    """The point at t (0..1) along a spine's polyline."""
    segs = list(zip(spine, spine[1:]))
    lens = [math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in segs]
    total = sum(lens)
    d = t * total
    for (a, b), ln in zip(segs, lens):
        if d <= ln:
            u = d / ln if ln else 0
            return a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u
        d -= ln
    return spine[-1][0], spine[-1][1]


def twigs(spine, rng, k):
    """Thin twigs off a limb's outer half, where the clusters hang."""
    out = []
    for t in (0.45, 0.62, 0.78, 0.92):
        x, y = _along(spine, t)
        a = rng.uniform(-2.4, -0.7) if rng.random() < 0.5 else rng.uniform(-2.4, -0.7) + rng.uniform(-0.3, 0.3)
        ln = rng.uniform(6, 12) * k
        out.append(f'M{f(x)} {f(y)}Q{f(x + math.cos(a) * ln * 0.5)} {f(y + math.sin(a) * ln * 0.6)} {f(x + math.cos(a) * ln)} {f(y + math.sin(a) * ln)}')
    return ''.join(out)


def clusters(spine, rng, k, n=6):
    """Where the crown's clusters sit along a limb: thicker toward its
    tip, a little above the wood."""
    out = []
    for j in range(n):
        t = 0.28 + 0.72 * (j + rng.uniform(0.1, 0.9)) / n
        x, y = _along(spine, min(1, t))
        r = rng.uniform(5.5, 9.5) * k * (0.75 + 0.35 * t)
        out.append((x + rng.uniform(-3, 3) * k, y - r * rng.uniform(0.25, 0.6), r))
    # and a cluster on the tip
    x, y = spine[-1][0], spine[-1][1]
    out.append((x, y - 2 * k, rng.uniform(5, 7.5) * k))
    return out


def blob(cx, cy, r, rng, lobes=6):
    """A soft mass: a ring of overlapping circles round a centre one."""
    d = [f'M{f(cx - r * 0.7)} {f(cy)}a{f(r * 0.7)} {f(r * 0.7)} 0 1 0 {f(r * 1.4)} 0a{f(r * 0.7)} {f(r * 0.7)} 0 1 0 {f(-r * 1.4)} 0']
    for j in range(lobes):
        a = 2 * math.pi * j / lobes + rng.uniform(-0.3, 0.3)
        rr = r * rng.uniform(0.42, 0.58)
        x, y = cx + math.cos(a) * r * 0.55, cy + math.sin(a) * r * 0.42
        d.append(f'M{f(x - rr)} {f(y)}a{f(rr)} {f(rr)} 0 1 0 {f(rr * 2)} 0a{f(rr)} {f(rr)} 0 1 0 {f(-rr * 2)} 0')
    return ''.join(d)


def scallop(cx, cy, rx, ry, rng, n=None, depth=0.5):
    """A cloud's edge round an ellipse: points on it, jittered, each pair
    joined by a bump pushed outward (a blossom's or a crown's lumps)."""
    n = n or max(9, int((rx + ry) / 4.2))
    th0 = rng.uniform(0, 2 * math.pi)
    pts = []
    for j in range(n):
        th = th0 + 2 * math.pi * (j + rng.uniform(-0.3, 0.3)) / n
        k = rng.uniform(0.86, 1.04)
        pts.append((cx + math.cos(th) * rx * k, cy + math.sin(th) * ry * k))
    d = [f'M{f(pts[0][0])} {f(pts[0][1])}']
    for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        ox, oy = mx - cx, my - cy
        ln = math.hypot(ox, oy) or 1
        chord = math.hypot(x1 - x0, y1 - y0)
        b = chord * depth * rng.uniform(0.6, 1.1)
        d.append(f'Q{f(mx + ox / ln * b)} {f(my + oy / ln * b)} {f(x1)} {f(y1)}')
    return ''.join(d) + 'Z'


def dot(x, y, r):
    return f'M{f(x - r)} {f(y)}a{f(r)} {f(r)} 0 1 0 {f(r * 2)} 0a{f(r)} {f(r)} 0 1 0 {f(-r * 2)} 0'


def five(x, y, r, rot):
    """A five-petalled flower seen face on: five round petals about a
    heart, each notched as a cherry's is (by its dent between)."""
    d = []
    for j in range(5):
        a = math.radians(rot + 72 * j)
        px, py = x + math.cos(a) * r * 0.55, y + math.sin(a) * r * 0.55
        d.append(dot(px, py, r * 0.48))
    return ''.join(d)


def sakura_clusters(cs, rng, bloom, k):
    """The blossom: each cluster a pale mass, lit along its top, shaded
    under; flowers at its edge, and the dots of their hearts."""
    lit, mid, shade = bloom
    shade_d, mass_d, lit_d, flower_d, heart_d, spot_d = [], [], [], [], [], []
    for cx, cy, r in cs:
        shade_d.append(blob(cx + r * 0.12, cy + r * 0.22, r * 0.95, rng))
        mass_d.append(blob(cx, cy, r, rng))
        lit_d.append(blob(cx - r * 0.18, cy - r * 0.24, r * 0.62, rng, lobes=5))
        for _ in range(int(5 + r / k * 0.5)):
            a = rng.uniform(0, 2 * math.pi)
            rr = r * math.sqrt(rng.uniform(0.35, 1.05))
            fx, fy = cx + math.cos(a) * rr, cy + math.sin(a) * rr * 0.8
            fr = rng.uniform(1.2, 1.9) * k
            flower_d.append(five(fx, fy, fr, rng.uniform(0, 72)))
            heart_d.append(dot(fx, fy, fr * 0.2))
        for _ in range(int(4 + r / k * 0.6)):
            a = rng.uniform(0, 2 * math.pi)
            rr = r * math.sqrt(rng.random()) * 0.85
            spot_d.append(dot(cx + math.cos(a) * rr, cy + math.sin(a) * rr * 0.8, rng.uniform(0.45, 0.8) * k))
    heart = mix(shade, '#c2416a', 0.55)
    return (f'<path d="{"".join(shade_d)}" fill="{shade}" opacity="0.85"></path>'
            f'<path d="{"".join(mass_d)}" fill="{mid}"></path>'
            f'<path d="{"".join(lit_d)}" fill="{lit}" opacity="0.75"></path>'
            f'<path d="{"".join(spot_d)}" fill="{mix(lit, "#ffffff", 0.5)}" opacity="0.9"></path>'
            f'<path d="{"".join(flower_d)}" fill="{lit}"></path>'
            f'<path d="{"".join(heart_d)}" fill="{heart}"></path>')


def sakura_lobe(cx, cy, rx, ry, rng, bloom, k):
    """A lobe of the cherry's crown: a pale cloud of blossom, its
    underside in shade, lit along its top; the flowers' faces scattered
    over it, the dark dots of their hearts, a few gaps where the wood
    shows through."""
    lit, mid, shade = bloom
    out = [f'<path d="{scallop(cx + rx * 0.05, cy + ry * 0.22, rx, ry * 0.92, rng)}" fill="{shade}"></path>',
           f'<path d="{scallop(cx, cy, rx * 0.97, ry * 0.9, rng)}" fill="{mid}"></path>',
           f'<path d="{scallop(cx - rx * 0.12, cy - ry * 0.26, rx * 0.66, ry * 0.5, rng, depth=0.42)}" fill="{lit}" opacity="0.8"></path>']
    flowers, hearts, spots, holes = [], [], [], []
    for _ in range(int(rx * ry / (14 * k * k))):
        a = rng.uniform(0, 2 * math.pi)
        u = math.sqrt(rng.random())
        fx, fy = cx + math.cos(a) * u * rx * 0.96, cy + math.sin(a) * u * ry * 0.9
        if rng.random() < 0.55:
            fr = rng.uniform(1.1, 1.8) * k
            flowers.append(five(fx, fy, fr, rng.uniform(0, 72)))
            hearts.append(dot(fx, fy, fr * 0.2))
        else:
            spots.append(dot(fx, fy, rng.uniform(0.45, 0.85) * k))
    for _ in range(max(1, int(rx / (16 * k)))):
        a = rng.uniform(0.3, 2.8)
        hx, hy = cx + math.cos(a) * rx * 0.55, cy + math.sin(a) * ry * 0.5
        holes.append(dot(hx, hy, rng.uniform(1.2, 2.2) * k))
    heart = mix(shade, '#b8345e', 0.6)
    out += [f'<path d="{"".join(holes)}" fill="{mix(shade, "#000000", 0.25)}" opacity="0.55"></path>',
            f'<path d="{"".join(spots)}" fill="{mix(lit, "#ffffff", 0.45)}" opacity="0.9"></path>',
            f'<path d="{"".join(flowers)}" fill="{lit}"></path>',
            f'<path d="{"".join(hearts)}" fill="{heart}"></path>']
    return ''.join(out)


def maple_lobe(cx, cy, rx, ry, rng, inks, k):
    """A lobe of the maple's crown: a dome of red, deep under and bright
    on top, its edge and its face cut into leaves."""
    bright, mid, deep = inks
    gold = mix(bright, '#e8b040', 0.45)
    out = [f'<path d="{scallop(cx + rx * 0.05, cy + ry * 0.2, rx, ry * 0.92, rng, depth=0.35)}" fill="{deep}"></path>',
           f'<path d="{scallop(cx, cy, rx * 0.94, ry * 0.86, rng, depth=0.35)}" fill="{mid}"></path>']
    leaves = {bright: [], gold: [], mid: [], deep: []}
    for _ in range(int(rx * ry / (10 * k * k))):
        a = rng.uniform(0, 2 * math.pi)
        u = math.sqrt(rng.random())
        lx, ly = cx + math.cos(a) * u * rx, cy + math.sin(a) * u * ry * 0.95
        up = (cy - ly) / ry
        col = bright if up > -0.1 and rng.random() < 0.7 else (gold if rng.random() < 0.3 else (deep if up < -0.4 else mid))
        leaves[col].append(leaf5(lx, ly, rng.uniform(2.0, 3.0) * k, rng.uniform(-60, 60)))
    for col, ds in leaves.items():
        if ds:
            out.append(f'<path d="{"".join(ds)}" fill="{col}"></path>')
    return ''.join(out)


def leaf5(x, y, s, rot):
    """A maple leaf, cut simply for its size on the print: five pointed
    lobes about the stalk's joint."""
    pts = []
    for j in range(5):
        a = math.radians(rot - 90 + (j - 2) * 52)
        ln = s * (1.0 if j == 2 else (0.86 if j in (1, 3) else 0.6))
        pts.append(polar(x, y, ln, math.degrees(a) + 90))
        b = math.radians(rot - 90 + (j - 2) * 52 + 26)
        if j < 4:
            pts.append(polar(x, y, s * 0.36, math.degrees(b) + 90))
    pts.append(polar(x, y, s * 0.22, rot + 180 - 30))
    pts.append(polar(x, y, s * 0.22, rot + 180 + 30))
    return 'M' + 'L'.join(f'{f(px)} {f(py)}' for px, py in pts) + 'Z'


def maple_clusters(cs, rng, inks, k):
    """The maple's crown: masses of leaves, deep under and bright on
    top, the leaves cut at their edges."""
    bright, mid, deep = inks
    gold = mix(bright, '#e8b040', 0.45)
    deep_d, mass_d, leaves = [], [], {bright: [], mid: [], gold: []}
    for cx, cy, r in cs:
        deep_d.append(blob(cx + r * 0.1, cy + r * 0.2, r * 0.95, rng))
        mass_d.append(blob(cx, cy, r * 0.88, rng))
        for _ in range(int(6 + r / k * 0.7)):
            a = rng.uniform(0, 2 * math.pi)
            rr = r * math.sqrt(rng.uniform(0.2, 1.08))
            col = rng.choice((bright, bright, mid, gold))
            leaves[col].append(leaf5(cx + math.cos(a) * rr, cy + math.sin(a) * rr * 0.82, rng.uniform(2.1, 3.1) * k, rng.uniform(-50, 50)))
    out = [f'<path d="{"".join(deep_d)}" fill="{deep}"></path>', f'<path d="{"".join(mass_d)}" fill="{mid}"></path>']
    for col, ds in leaves.items():
        if ds:
            out.append(f'<path d="{"".join(ds)}" fill="{col}"></path>')
    return ''.join(out)


def tree(L, h, o, hour, gust, uid):
    """The season's tree: a cherry (桜) in spring, a maple (紅葉) in
    autumn, standing on the bank at the right in front of the bridge,
    its crown over the bay. Its trunk and limbs are the pine's kind of
    wood (el7.limb), lit along one edge."""
    kind = 'sakura' if 'bloom' in o else ('maple' if o.get('maple_tree') else None)
    if not kind:
        return ''
    T = TREE[L.W]
    k = T['spread']
    rng = random.Random(L.seed + (201 if kind == 'sakura' else 211))
    c = PINE[hour]
    bark_ink = o.get('bark', mix(c['trunk'], '#3a2a2a', 0.3))
    lit_ink = mix(bark_ink, c['trunk_lit'], 0.7)
    trunk = limb(T['trunk'], rng, wobble=0.1)
    trunk_lit = lit_band(T['trunk'], rng, side=1, a=0.12, b=0.46)
    cracks, flecks = bark(T['trunk'], rng)
    woods = []
    for spine in T['limbs']:
        wood = limb(spine, rng, wobble=0.12)
        wood_lit = lit_band(spine, rng, side=-1 if spine[-1][0] < spine[0][0] else 1, a=0.05, b=0.45)
        tw = twigs(spine, rng, k)
        woods.append((spine, f'<path d="{wood}" fill="{bark_ink}"></path><path d="{wood_lit}" fill="{lit_ink}" opacity="0.45"></path>'
                             f'<path d="{tw}" fill="none" stroke="{bark_ink}" stroke-width="{f(0.7 * k)}" stroke-linecap="round"></path>'))
    # the wood first, then the crown's lobes back to front, each lobe
    # swaying with the limb that holds it
    sway = [(spine[0][0], spine[0][1], rng.uniform(0.5, 0.9)) for spine, _ in woods]

    def swaying(i, inner):
        ax, ay, a = sway[i]
        return (f'<g class="f5-gust" style="transform-origin: {f(ax)}px {f(ay)}px; --a: {f(a)}deg; {gust(ax, L.W)}">'
                f'{inner}</g>')
    limbs = [swaying(i, wood) for i, (_, wood) in enumerate(woods)]
    for j, (cx, cy, rx, ry, i) in enumerate(T['lobes']):
        if kind == 'sakura':
            lobe = sakura_lobe(cx, cy, rx, ry, rng, o['bloom'], k)
        else:
            # a maple turns unevenly: one lobe still orange, one gold, as
            # far as the hour's light shows it
            bright, mid, deep = o['maple']
            t = {'day': 1.0, 'dawn': 0.75, 'dusk': 0.55, 'night': 0.18}[hour]
            if j in (1, 5):
                inks_ = (mix(bright, '#e89a36', 0.5 * t), mix(mid, '#d0702c', 0.45 * t), deep)
            elif j == 2:
                inks_ = (mix(bright, '#e8b440', 0.55 * t), mix(mid, '#c88a30', 0.5 * t), mix(deep, '#7a4a20', 0.4 * t))
            else:
                inks_ = o['maple']
            lobe = maple_lobe(cx, cy, rx, ry, rng, inks_, k)
        limbs.append(swaying(i, lobe))
    heart = ''
    fallen = ''
    if kind == 'sakura':
        # petals lying on the bank under the tree
        fr = random.Random(L.seed + 205)
        bx = T['trunk'][0][0]
        spots = ''.join(dot(bx + fr.gauss(0, 30 * k), L.ground + fr.uniform(6, 60) * k, fr.uniform(0.5, 1.0) * k) for _ in range(int(40 * k)))
        fallen = f'<path d="{spots}" fill="{o["bloom"][1]}" opacity="0.7"></path>'
    lanterns = lanterns_s(L, T, o, uid) if o.get('lanterns') else ''
    tx, ty = T['trunk'][0][0], T['trunk'][0][1]
    return (f'{fallen}<g>'
            f'<g class="f5-gust" style="transform-origin: {f(tx)}px {f(ty)}px; --a: 0.3deg; {gust(tx, L.W)}">'
            f'<path d="{trunk}" fill="{bark_ink}"></path>'
            f'<path d="{trunk_lit}" fill="{lit_ink}" opacity="0.5"></path>'
            f'<path d="{cracks}" fill="none" stroke="{mix(bark_ink, "#000000", 0.4)}" stroke-width="0.6" stroke-linecap="round" opacity="0.6"></path>'
            f'<path d="{flecks}" fill="none" stroke="{lit_ink}" stroke-width="0.7" stroke-linecap="round" opacity="0.4"></path>'
            f'{"".join(limbs)}{heart}</g></g>{lanterns}')


def lanterns_s(L, T, o, uid):
    """夜桜: paper lanterns (提灯) strung under the cherry for the night's
    viewing, each lit and lighting the blossom over it."""
    pts = T['lanterns']
    k = T['spread']
    line = smooth([(pts[0][0] - 8 * k, pts[0][1] - 6 * k)] + [(x, y - 4.4 * k) for x, y in pts] + [(pts[-1][0] + 10 * k, pts[-1][1] - 8 * k)])
    glows, bodies, bands = [], [], []
    rng = random.Random(L.seed + 207)
    for j, (x, y) in enumerate(pts):
        glows.append(f'<circle class="f4-flame" cx="{f(x)}" cy="{f(y)}" r="{f(16 * k)}" fill="url(#{uid}Lantern)" '
                     f'style="animation-duration: {f(rng.uniform(2.6, 3.8))}s; animation-delay: -{f(rng.uniform(0, 3))}s"></circle>')
        bodies.append(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(2.5 * k)}" ry="{f(3.3 * k)}"></ellipse>')
        bands.append(f'M{f(x - 2.4 * k)} {f(y + 0.4 * k)}L{f(x + 2.4 * k)} {f(y + 0.4 * k)}'
                     f'M{f(x - 1.4 * k)} {f(y - 3.2 * k)}L{f(x + 1.4 * k)} {f(y - 3.2 * k)}M{f(x - 1.4 * k)} {f(y + 3.2 * k)}L{f(x + 1.4 * k)} {f(y + 3.2 * k)}')
    return (f'<path d="{line}" fill="none" stroke="#1a1418" stroke-width="{f(0.45 * k)}" opacity="0.8"></path>'
            f'{"".join(glows)}<g fill="#ffe2b8">{"".join(bodies)}</g>'
            f'<path d="{"".join(bands)}" fill="none" stroke="#c43a2a" stroke-width="{f(0.9 * k)}"></path>')


# ── the pine, under its snow in winter ──────────────────────────────

def pine_s(L, h, o, hour, gust):
    """el7.pine7, drawn the same; in winter each tier carries its snow
    (雪持ち松) along its top, and each branch a line of it."""
    from scene_f9 import BOUGHS8
    snow = o.get('crowns') == 'snow'
    px, py, s = L.pine
    c = PINE[hour]
    rng = random.Random(11)
    trunk = limb(TRUNK, rng, wobble=0.12)
    trunk_lit = lit_band(TRUNK, rng, side=1, a=0.14, b=0.47)
    cracks, flecks = bark(TRUNK, rng)
    boughs = []
    for spine, (cx, cy, w, hh) in BOUGHS8:
        branch = limb(spine, rng, wobble=0.15)
        branch_lit = lit_band(spine, rng, side=-1 if spine[-1][0] < spine[0][0] else 1, a=0.05, b=0.46)
        state = rng.getstate()
        outline, top, bottom = tier(cx, cy, w, hh, rng)
        rng.setstate(state)
        outline, inner, upper, crest, under = _needles(cx, cy, w, hh, rng)
        ax, ay = spine[0][0], spine[0][1]
        cap = snow_cap(top, hh, o) if snow else ''
        boughs.append(
            f'<g class="f5-gust" style="transform-origin: {f(ax)}px {f(ay)}px; --a: {f(rng.uniform(0.5, 0.9))}deg; {gust(px + ax * s, L.W)}">'
            f'<path d="{branch}" fill="{c["trunk"]}"></path>'
            f'<path d="{branch_lit}" fill="{c["trunk_lit"]}" opacity="0.5"></path>'
            f'<path d="{outline}" fill="{c["mass"]}"></path>'
            f'<path d="{under}" fill="none" stroke="{c["mass"]}" stroke-width="0.55" stroke-linecap="round"></path>'
            f'<path d="{inner}" fill="none" stroke="{c["tuft"]}" stroke-width="0.5" stroke-linecap="round"></path>'
            f'<path d="{upper}" fill="none" stroke="{c["top"]}" stroke-width="0.55" stroke-linecap="round"></path>'
            f'<path d="{crest}" fill="none" stroke="{c["hi"]}" stroke-width="0.55" stroke-linecap="round"></path>{cap}</g>')
    trunk_snow = ''
    if snow:
        sr = random.Random(L.seed + 301)
        bits = []
        for (x0, y0, w0), (x1, y1, w1) in zip(TRUNK, TRUNK[1:]):
            if sr.random() < 0.55:
                t = sr.uniform(0.2, 0.8)
                x, y, w = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w0 + (w1 - w0) * t
                bits.append(f'M{f(x - w * 0.42)} {f(y)}q{f(w * 0.3)} {f(-w * 0.18)} {f(w * 0.6)} {f(-w * 0.05)}')
        trunk_snow = f'<path d="{"".join(bits)}" fill="none" stroke="{o["cap"]}" stroke-width="1.4" stroke-linecap="round" opacity="0.85"></path>'
    return (f'<g class="f7-pine" transform="translate({f(px)} {f(py - 746 * s)}) scale({f(s)})">'
            f'<g class="f5-gust" style="transform-origin: 22px 746px; --a: 0.25deg; {gust(px, L.W)}">'
            f'<path d="{trunk}" fill="{c["trunk"]}"></path>'
            f'<path d="{trunk_lit}" fill="{c["trunk_lit"]}" opacity="0.55"></path>'
            f'<path d="{cracks}" fill="none" stroke="{c["bark"]}" stroke-width="0.6" stroke-linecap="round" opacity="0.7"></path>'
            f'<path d="{flecks}" fill="none" stroke="{c["fleck"]}" stroke-width="0.7" stroke-linecap="round" opacity="0.5"></path>'
            f'{trunk_snow}{"".join(boughs)}</g></g>')


def _needles(cx, cy, w, hh, rng, r=3.4):
    import el7
    return el7.needles(cx, cy, w, hh, rng, r)


def snow_cap(top, hh, o):
    """Snow lying along a tier's top: thickest over its crown, thinning
    to nothing at its ends, its underside lumped where it sags between
    the tufts; a line of shade under it."""
    n = len(top)
    up, low = [], []
    for i, (x, y) in enumerate(top):
        t = i / (n - 1)
        th = hh * 0.28 * math.sin(math.pi * t) ** 0.7 * (0.85 + 0.15 * math.sin(i * 1.7))
        up.append((x, y - 0.8 - th * 0.35))
        low.append((x, y + th * 0.75))
    d = smooth(up) + ' L' + smooth(low[::-1])[1:] + ' Z'
    shade = smooth([(x, y + 0.6) for x, y in low])
    return (f'<path d="{shade}" fill="none" stroke="{o["cap_shade"]}" stroke-width="1.1" stroke-linecap="round" opacity="0.8"></path>'
            f'<path d="{d}" fill="{o["cap"]}"></path>')


# ── the foreground: what a later round lays on the ground behind the
# trees (fore_back) and in front of them (fore_front); none here ────

def fore_back(L, h, o, hour, gust, uid):
    return ''


def fore_front(L, h, o, hour, gust, uid):
    return ''


# ── the bank ──────────────────────────────────────────────────────

def bank(L, h, o, hour, gust, anim_):
    kind = o.get('bank', 'cosmos')
    if kind == 'cosmos':
        return cosmos7(L, h, hour, gust, anim_) + susuki7(L, h, hour, gust, anim_)
    if kind == 'nanohana':
        return nanohana(L, h, hour, gust)
    if kind == 'hydrangea':
        return hydrangea(L, h, hour, gust)
    if kind == 'camellia':
        return susuki7(L, h, hour, gust, anim_) + camellia(L, h, o, hour, gust)
    return ''


def _dim(col, hour):
    dim, shade = DUSKEN[hour]
    return mix(col, shade, dim)


def nanohana(L, h, hour, gust):
    """菜の花, rape blossom: tall stems and their clasping leaves, each
    stem ending in a head of small four-petalled yellow flowers, buds
    above them still green."""
    rng = random.Random(L.seed + 401)
    stem_ink = _dim('#5c8a3c', hour)
    leaf_ink = _dim('#6e9a54', hour)
    yellows = [_dim(c, hour) for c in ('#f3d23a', '#e9b91e', '#fbe57a')]
    bud = _dim('#9db84a', hour)
    out = []
    for x0, y0, sc, n in L.cosmos:
        for _ in range(n + 2):
            ln = rng.uniform(46, 80) * sc
            bx = x0 + rng.uniform(-12, 12) * sc
            tx, ty = bx + rng.uniform(-10, 10) * sc, y0 - ln
            mx = (bx + tx) / 2 + rng.uniform(-5, 5) * sc
            leaves = []
            for t in (0.25, 0.45):
                lx, ly = bx + (tx - bx) * t, y0 - ln * t
                side = rng.choice((-1, 1))
                ll = rng.uniform(8, 13) * sc
                leaves.append(f'M{f(lx)} {f(ly)}q{f(side * ll * 0.5)} {f(-ll * 0.6)} {f(side * ll)} {f(-ll * 0.3)}q{f(-side * ll * 0.5)} {f(ll * 0.2)} {f(-side * ll)} {f(ll * 0.3)}Z')
            heads = {c: [] for c in yellows}
            hr = rng.uniform(5.2, 7) * sc
            heads[yellows[1]].append(blob(tx, ty + hr * 0.5, hr * 0.85, rng, lobes=5))
            for _ in range(rng.randint(18, 26)):
                a = rng.uniform(0, 2 * math.pi)
                rr = hr * math.sqrt(rng.random())
                fx, fy = tx + math.cos(a) * rr, ty + hr * 0.5 + math.sin(a) * rr * 0.75
                col = rng.choice(yellows)
                fr = rng.uniform(1.3, 2.0) * sc
                heads[col].append(f'M{f(fx - fr)} {f(fy)}L{f(fx)} {f(fy - fr)}L{f(fx + fr)} {f(fy)}L{f(fx)} {f(fy + fr)}Z')
            buds = ''.join(dot(tx + rng.uniform(-1.6, 1.6) * sc, ty - rng.uniform(0.5, 3.5) * sc, 0.75 * sc) for _ in range(4))
            body = ''.join(f'<path d="{"".join(ds)}" fill="{c}"></path>' for c, ds in heads.items() if ds)
            out.append(f'<g class="f5-gust" style="transform-origin: {f(bx)}px {f(y0)}px; --a: {f(rng.uniform(2.5, 5))}deg; {gust(bx, L.W)}">'
                       f'<path d="M{f(bx)} {f(y0)}Q{f(mx)} {f(y0 - ln * 0.5)} {f(tx)} {f(ty)}" fill="none" stroke="{stem_ink}" stroke-width="{f(1.1 * sc)}" stroke-linecap="round"></path>'
                       f'<path d="{"".join(leaves)}" fill="{leaf_ink}"></path>'
                       f'<path d="{buds}" fill="{bud}"></path>{body}</g>')
    return ''.join(out)


def hydrangea(L, h, hour, gust):
    """紫陽花, the rainy season's flower: bushes of broad toothed leaves
    and round heads of four-petalled florets, blue, violet and pink,
    shaded under and lit on top."""
    rng = random.Random(L.seed + 411)
    leaf_ink = _dim('#2f5a36', hour)
    vein = _dim('#1f3a26', hour)
    heads = [('#5b7fd4', '#9db8f0', '#3a539a'), ('#8a6cc8', '#c2abef', '#5a4592'), ('#d98ab8', '#f4c0dc', '#9a5584'),
             ('#6f98da', '#b4cdf4', '#40619e')]
    out = []
    for x0, y0, sc, n in L.cosmos:
        bush = []
        lf, ll = [], []
        for _ in range(int(8 + n * 1.6)):
            a = rng.uniform(-2.7, -0.4)
            ln = rng.uniform(12, 18) * sc
            bx, by = x0 + rng.uniform(-20, 20) * sc, y0 - rng.uniform(4, 46) * sc
            ex, ey = bx + math.cos(a) * ln, by + math.sin(a) * ln
            nx, ny = -math.sin(a), math.cos(a)
            w = ln * 0.42
            lf.append(f'M{f(bx)} {f(by)}Q{f((bx + ex) / 2 + nx * w)} {f((by + ey) / 2 + ny * w)} {f(ex)} {f(ey)}'
                      f'Q{f((bx + ex) / 2 - nx * w)} {f((by + ey) / 2 - ny * w)} {f(bx)} {f(by)}Z')
            ll.append(f'M{f(bx)} {f(by)}L{f(ex)} {f(ey)}')
        bush.append(f'<path d="{"".join(lf)}" fill="{leaf_ink}"></path>'
                    f'<path d="{"".join(ll)}" fill="none" stroke="{vein}" stroke-width="{f(0.5 * sc)}"></path>')
        for _ in range(max(3, n // 2 + 2)):
            base, lit, shade = (_dim(c, hour) for c in heads[rng.randrange(len(heads))])
            r = rng.uniform(8, 11) * sc
            hx, hy = x0 + rng.uniform(-20, 20) * sc, y0 - rng.uniform(46, 70) * sc
            stem = f'M{f(hx + rng.uniform(-3, 3) * sc)} {f(y0 - 4 * sc)}Q{f(hx)} {f((hy + y0) / 2)} {f(hx)} {f(hy + r * 0.6)}'
            florets = []
            for _ in range(int(16 + r * 1.4 / sc)):
                a = rng.uniform(0, 2 * math.pi)
                rr = r * math.sqrt(rng.uniform(0.0, 1.0)) * 0.92
                fx, fy = hx + math.cos(a) * rr, hy + math.sin(a) * rr * 0.86
                fr = rng.uniform(1.1, 1.6) * sc
                rot = rng.uniform(0, 90)
                for j in range(4):
                    aa = math.radians(rot + 90 * j)
                    florets.append(dot(fx + math.cos(aa) * fr * 0.5, fy + math.sin(aa) * fr * 0.5, fr * 0.42))
            bush.append(f'<path d="{stem}" fill="none" stroke="{leaf_ink}" stroke-width="{f(0.9 * sc)}"></path>'
                        f'<path d="{dot(hx + r * 0.1, hy + r * 0.16, r)}" fill="{shade}"></path>'
                        f'<path d="{dot(hx, hy, r * 0.9)}" fill="{base}"></path>'
                        f'<path d="{"".join(florets)}" fill="{lit}" opacity="0.92"></path>')
        out.append(f'<g class="f5-gust" style="transform-origin: {f(x0)}px {f(y0)}px; --a: {f(rng.uniform(0.8, 1.6))}deg; {gust(x0, L.W)}">{"".join(bush)}</g>')
    return ''.join(out)


def camellia(L, h, o, hour, gust):
    """寒椿, the camellia of the cold: a low bush of dark glossy leaves,
    its red flowers open in the snow, snow lying on its top."""
    rng = random.Random(L.seed + 421)
    leaf_ink = _dim('#1d3a2a', hour)
    leaf_lit = _dim('#3d6a4a', hour)
    reds = [(_dim('#c8263a', hour), _dim('#e65a68', hour)), (_dim('#b01e34', hour), _dim('#d84a5c', hour))]
    gold = _dim('#f2c84a', hour)
    out = []
    for x0, y0, sc, n in L.cosmos:
        lf, hi = [], []
        cx, cy = x0, y0 - 34 * sc
        for _ in range(int(40 + n * 4)):
            a = rng.uniform(0, 2 * math.pi)
            rr = math.sqrt(rng.random())
            bx, by = cx + math.cos(a) * rr * 30 * sc, cy + math.sin(a) * rr * 22 * sc
            ang = rng.uniform(0, 2 * math.pi)
            ln = rng.uniform(5, 7.5) * sc
            ex, ey = bx + math.cos(ang) * ln, by + math.sin(ang) * ln
            nx, ny = -math.sin(ang), math.cos(ang)
            w = ln * 0.36
            lf.append(f'M{f(bx)} {f(by)}Q{f((bx + ex) / 2 + nx * w)} {f((by + ey) / 2 + ny * w)} {f(ex)} {f(ey)}'
                      f'Q{f((bx + ex) / 2 - nx * w)} {f((by + ey) / 2 - ny * w)} {f(bx)} {f(by)}Z')
            if rng.random() < 0.4:
                hi.append(f'M{f(bx + (ex - bx) * 0.2)} {f(by + (ey - by) * 0.2)}L{f(bx + (ex - bx) * 0.7)} {f(by + (ey - by) * 0.7)}')
        flowers = []
        for _ in range(max(4, n + 2)):
            a = rng.uniform(0, 2 * math.pi)
            rr = math.sqrt(rng.random())
            fx, fy = cx + math.cos(a) * rr * 25 * sc, cy + math.sin(a) * rr * 16 * sc - 2 * sc
            deep, light = reds[rng.randrange(2)]
            fr = rng.uniform(3.2, 4.4) * sc
            flowers.append(f'<path d="{five(fx, fy, fr * 1.6, rng.uniform(0, 72))}" fill="{deep}"></path>'
                           f'<path d="{five(fx - fr * 0.1, fy - fr * 0.15, fr * 1.15, rng.uniform(0, 72))}" fill="{light}" opacity="0.7"></path>'
                           f'<path d="{dot(fx, fy, fr * 0.36)}" fill="{gold}"></path>')
        # snow on the bush: lumps along its top
        lumps = ''.join(blob(cx + rng.uniform(-22, 22) * sc, cy - rng.uniform(14, 21) * sc, rng.uniform(4, 6.5) * sc, rng, lobes=4)
                        for _ in range(5 + n // 3))
        out.append(f'<g class="f5-gust" style="transform-origin: {f(x0)}px {f(y0)}px; --a: {f(rng.uniform(0.5, 1))}deg; {gust(x0, L.W)}">'
                   f'<path d="{"".join(lf)}" fill="{leaf_ink}"></path>'
                   f'<path d="{"".join(hi)}" fill="none" stroke="{leaf_lit}" stroke-width="{f(0.5 * sc)}" stroke-linecap="round"></path>'
                   f'{"".join(flowers)}<path d="{lumps}" fill="{o["cap"]}" opacity="0.95"></path></g>')
    return ''.join(out)
