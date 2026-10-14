"""The drawing kit the second round shares: a brush made of bristles, a
stroke that tapers at both ends, washi's fibres, gold dust and cut gold
leaf, a maple leaf. Every function takes its own random generator, so a
board draws the same thing every time it is built."""
import math
from geo import f


def polar(cx, cy, r, deg):
    a = math.radians(deg)
    return cx + r * math.sin(a), cy - r * math.cos(a)


def pts(points):
    return ' L'.join(f'{f(x)} {f(y)}' for x, y in points)


def bristle_brush(rng, cx, cy, r0, a0=48, sweep=334, n=150, bristles=28, wmax=27, tail_in=8, blots=False):
    """An ensō drawn bristle by bristle: each bristle a polyline that
    runs dry at its own moment and skips more as the ink runs out, so
    the stroke lands solid and lifts in streaks (掠れ). Returns the
    bristles' paths and the landing's blots."""
    def width(t):
        if t < 0.04:
            return wmax * (0.8 + 0.2 * math.sin(t / 0.04 * math.pi / 2))
        if t < 0.55:
            return wmax * (1 - 0.17 * (t - 0.04) / 0.51)
        return wmax * (0.83 * (1 - ((t - 0.55) / 0.45) ** 1.7) + 0.06)

    def radius(t):
        return (r0 + 2.4 * math.sin(2 * math.pi * 1.15 * t + 0.5) + 1.1 * math.sin(2 * math.pi * 3.4 * t)
                - tail_in * max(0.0, t - 0.78) / 0.22)

    paths = []
    for i in range(bristles):
        u = -0.5 + (i + 0.5) / bristles + rng.uniform(-0.3, 0.3) / bristles
        edge = min(1.0, abs(u) * 2)
        if rng.random() < 0.5 * (1 - edge) + 0.08:
            t_end = 1.0
        else:
            t_end = rng.uniform(0.46 + 0.22 * (1 - edge), 0.985)
        fr, ph = rng.uniform(0.8, 2.6), rng.uniform(0, 1)
        sw = rng.uniform(1.25, 2.2) * wmax / bristles
        op = rng.uniform(0.84, 1.0)
        seg, inked = [], True
        for k in range(n + 1):
            t = k / n
            if t > t_end:
                break
            if t > 0.5:
                dry = (t - 0.5) / 0.5
                if inked and rng.random() < 0.05 * dry * (0.4 + edge):
                    inked = False
                elif not inked and rng.random() < 0.3:
                    inked = True
            if not inked:
                if len(seg) > 1:
                    paths.append((seg, sw, op))
                seg = []
                continue
            ut = u + 0.035 * math.sin(2 * math.pi * (fr * t + ph))
            rr = radius(t) + ut * width(t)
            seg.append(polar(cx, cy, rr, a0 + sweep * t))
        if len(seg) > 1:
            paths.append((seg, sw, op))
    # the landing: the brush pressed down before it moved
    hx, hy = polar(cx, cy, radius(0) + 0.6, a0 + 1.2)
    bx, by = polar(cx, cy, radius(0) + 2.2, a0 - 1.6)
    spots = [(hx, hy, wmax * 0.43), (bx, by, wmax * 0.33)] if blots else []
    # the wet body under the bristles: solid where the brush is loaded,
    # narrowing away before the ink runs out, so only bristles lift
    outer, inner = [], []
    for k in range(n + 1):
        t = k / n
        if t > 0.62:
            break
        fade = 1 - max(0.0, min(1.0, (t - 0.4) / 0.22)) ** 2
        w = width(t) * 0.8 * fade
        a = a0 + sweep * t
        outer.append(polar(cx, cy, radius(t) + w / 2, a))
        inner.append(polar(cx, cy, radius(t) - w / 2, a))
    body = f'<path d="M{pts(outer + inner[::-1])} Z" stroke="none"></path>'
    # the landing is round: the loaded brush set down before it moved
    lx, ly = polar(cx, cy, radius(0), a0 + 0.6)
    body += f'<ellipse cx="{f(lx)}" cy="{f(ly)}" rx="{f(width(0) * 0.42)}" ry="{f(width(0) * 0.36)}" transform="rotate({f(a0 + 90 + 25)} {f(lx)} {f(ly)})" stroke="none"></ellipse>'
    out = [body] + [f'<path d="M{pts(s)}" fill="none" stroke-width="{f(w)}" stroke-opacity="{f(o)}"></path>' for s, w, o in paths]
    out += [f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}"></circle>' for x, y, r in spots]
    return '\n'.join(out)


def reveal_path(cx, cy, r, a0, sweep, back=8):
    """The brush's centreline, from just behind the landing: the mask
    that draws the stroke on as the brush moves."""
    s = polar(cx, cy, r, a0 - back)
    e = polar(cx, cy, r, a0 + sweep)
    length = r * math.radians(sweep + back)
    return f'M{f(s[0])} {f(s[1])} A{f(r)} {f(r)} 0 1 1 {f(e[0])} {f(e[1])}', length


def tapered_arc(cx, cy, r, th0, th1, wmax, steps=48, power=0.45):
    """A stroke along an arc, thickest in its middle and pointed at both
    ends, as a brush draws a line."""
    outer, inner = [], []
    for k in range(steps + 1):
        t = k / steps
        th = th0 + (th1 - th0) * t
        w = wmax * max(0.0, math.sin(math.pi * t)) ** power
        outer.append(polar(cx, cy, r + w / 2, th))
        inner.append(polar(cx, cy, r - w / 2, th))
    return 'M' + pts(outer + inner[::-1]) + ' Z'


def fibres(rng, w, h, n, color, alpha=(0.04, 0.1)):
    """Washi's long fibres (楮), as hair-thin curves."""
    out = []
    for _ in range(n):
        x, y = rng.uniform(-20, w + 20), rng.uniform(-20, h + 20)
        a = rng.uniform(0, math.pi)
        ln = rng.uniform(14, 70)
        bend = rng.uniform(-14, 14)
        x2, y2 = x + ln * math.cos(a), y + ln * math.sin(a)
        mx, my = (x + x2) / 2 - bend * math.sin(a), (y + y2) / 2 + bend * math.cos(a)
        out.append(f'<path d="M{f(x)} {f(y)} Q{f(mx)} {f(my)} {f(x2)} {f(y2)}" stroke="{color}" '
                   f'stroke-opacity="{f(rng.uniform(*alpha))}" stroke-width="{f(rng.uniform(0.35, 0.9))}" fill="none"></path>')
    return '\n'.join(out)


def sunago(rng, x0, y0, x1, y1, clusters, golds, spread=(7, 16), per=(10, 26), flakes=0, flake_golds=None):
    """Gold dust (砂子) blown in clumps along a band, and cut gold leaf
    (切箔) among it."""
    dots, leaf = [], []
    for _ in range(clusters):
        t = rng.random()
        cx, cy = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        cx += rng.gauss(0, 10)
        cy += rng.gauss(0, 12)
        s = rng.uniform(*spread)
        for _ in range(rng.randint(*per)):
            x, y = rng.gauss(cx, s), rng.gauss(cy, s * 0.7)
            dots.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(rng.uniform(0.3, 0.95))}" fill="{rng.choice(golds)}" '
                        f'fill-opacity="{f(rng.uniform(0.35, 0.95))}"></circle>')
    for _ in range(flakes):
        t = rng.random()
        x = x0 + (x1 - x0) * t + rng.gauss(0, 18)
        y = y0 + (y1 - y0) * t + rng.gauss(0, 16)
        s = rng.uniform(1.5, 3.6)
        kind = rng.random()
        if kind < 0.45:
            shape = f'<rect x="{f(-s / 2)}" y="{f(-s / 2)}" width="{f(s)}" height="{f(s)}"></rect>'
        elif kind < 0.8:
            shape = f'<rect x="{f(-s)}" y="{f(-s * 0.18)}" width="{f(s * 2)}" height="{f(s * 0.36)}"></rect>'
        else:
            shape = (f'<path d="M{f(-s)} {f(s * 0.3)} L{f(s * 0.9)} {f(s * 0.45)} L{f(s * 0.6)} {f(-s * 0.25)} '
                     f'L{f(-s * 0.4)} {f(-s * 0.35)} Z"></path>')
        leaf.append(f'<g transform="translate({f(x)} {f(y)}) rotate({f(rng.uniform(0, 180))})" '
                    f'fill="{rng.choice(flake_golds or golds)}" fill-opacity="{f(rng.uniform(0.75, 1))}">{shape}</g>')
    return '\n'.join(dots), '\n'.join(leaf)


def momiji(size=1.0):
    """A Japanese maple's leaf, pointing up, centred on its stalk's
    joint: seven lobes, the middle three long, each lanceolate and
    toothed, deeply cut between."""
    lobes = [(-112, 0.44), (-74, 0.74), (-37, 0.93), (0, 1.0), (37, 0.93), (74, 0.74), (112, 0.44)]
    R = 20 * size
    p = []

    def flank(ang, L, side):
        # from the lobe's base out to its tip, toothed: (radius, angle offset)
        pts_ = [(0.42, 15.5), (0.56, 14), (0.6, 15.5), (0.72, 11), (0.76, 12.5), (0.87, 7), (0.9, 8)]
        return [polar(0, 0, L * r, ang + side * a) for r, a in pts_]

    for k, (ang, ln) in enumerate(lobes):
        L = R * ln
        if k == 0:
            p.append(polar(0, 0, R * 0.14, 180 - 14))
        prev = lobes[k - 1][0] if k else ang - 40
        p.append(polar(0, 0, R * 0.3, (prev + ang) / 2 if k else ang - 22))
        p.extend(flank(ang, L, -1))
        p.append(polar(0, 0, L, ang))
        p.extend(reversed(flank(ang, L, 1)))
        if k == len(lobes) - 1:
            p.append(polar(0, 0, R * 0.3, ang + 22))
            p.append(polar(0, 0, R * 0.14, 180 + 14))
    outline = 'M' + pts(p) + ' Z'
    veins = ' '.join(f'M0 0 L{f(polar(0, 0, R * ln * 0.84, ang)[0])} {f(polar(0, 0, R * ln * 0.84, ang)[1])}'
                     for ang, ln in lobes)
    stalk = f'M0 0 Q{f(R * 0.06)} {f(R * 0.3)} {f(-R * 0.04)} {f(R * 0.62)}'
    return outline, veins, stalk
