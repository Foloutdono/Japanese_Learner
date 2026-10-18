"""Fuji, as the prints draw it. The flanks are concave, steep under the
summit and spreading wide at the foot; the summit is the crater's rim,
flat with small rises; the snow covers the upper part and runs down the
gullies in streaks that follow the slope, radiating from the summit
(a streak is a line of constant position across the mountain, so it
fans out as the mountain does). The body is printed in bokashi, darker
at the summit's height and paling into the mist at its foot; the side
away from the light is a shade deeper, the snow's too."""
import math
import random
from geo import f


class Fuji:
    def __init__(self, x0, ys, yb, hb, s0=None, p=1.42):
        self.x0, self.ys, self.yb, self.hb, self.p = x0, ys, yb, hb, p
        self.s0 = s0 if s0 is not None else hb * 0.07

    def at(self, u, v):
        """The point at height u (0 summit .. 1 foot) and position v
        across the mountain (-1 left flank .. 1 right flank)."""
        off = self.s0 + (self.hb - self.s0) * u ** self.p
        return self.x0 + v * off, self.ys + u * (self.yb - self.ys)

    def rim(self):
        """The summit's crater rim, left to right: flat, small rises."""
        x0, ys, s = self.x0, self.ys, self.s0
        h = max(1.2, s * 0.09)
        return [(x0 - s, ys + h * 0.5), (x0 - s * 0.7, ys - h * 0.9), (x0 - s * 0.45, ys - h * 0.3), (x0 - s * 0.15, ys - h * 1.1),
                (x0 + s * 0.2, ys - h * 0.4), (x0 + s * 0.48, ys - h * 1.4), (x0 + s * 0.78, ys - h * 0.5), (x0 + s, ys + h * 0.5)]

    def body(self, n=60):
        left = [self.at(k / n, -1) for k in range(n, -1, -1)]
        right = [self.at(k / n, 1) for k in range(0, n + 1)]
        pts = left + self.rim()[1:-1] + right
        return 'M' + ' L'.join(f'{f(x)} {f(y)}' for x, y in pts) + ' Z'

    def snow_edge(self, seed=3, base=0.27, streaks=None):
        """u of the snow's lower edge across v: a gentle wave, and the
        streaks running down the gullies."""
        rng = random.Random(seed)
        if streaks is None:
            streaks = []
            v = -0.9 + rng.uniform(0, 0.08)
            while v < 0.92:
                streaks.append((v, rng.uniform(0.028, 0.07), rng.uniform(0.04, 0.2)))
                v += rng.uniform(0.13, 0.24)
        ph = rng.uniform(0, 6)

        def u_of(v):
            u = base + 0.025 * math.sin(v * 5.3 + ph) + 0.012 * math.sin(v * 13 + ph * 2)
            for c, w, ln in streaks:
                u += ln * math.exp(-((v - c) / w) ** 2)
            # the flanks hold less snow: the edge rises toward them
            u -= 0.05 * abs(v) ** 6
            return u
        return u_of

    def snow(self, u_of, n=240, m=30):
        """The snow cap's outline: the rim, down the right flank to the
        edge, along the edge to the left flank, back up."""
        ur, ul = u_of(1.0), u_of(-1.0)
        right = [self.at(ur * k / m, 1) for k in range(1, m + 1)]
        edge = [self.at(u_of(v), v) for v in (1 - 2 * k / n for k in range(n + 1))]
        left = [self.at(ul * k / m, -1) for k in range(m, 0, -1)]
        pts = self.rim() + right + edge + left
        return 'M' + ' L'.join(f'{f(x)} {f(y)}' for x, y in pts) + ' Z'

    def ridges(self, rng, n=7, u0=0.36, u1=0.82):
        """Faint lines down the bare slopes, where the gullies are: the
        print's few strokes that give the mountain its form."""
        out = []
        for k in range(n):
            v = -0.85 + 1.7 * (k + 0.5) / n + rng.uniform(-0.05, 0.05)
            a, b = rng.uniform(u0, u0 + 0.12), rng.uniform(u1 - 0.2, u1)
            pts = [self.at(a + (b - a) * t / 12, v) for t in range(13)]
            out.append('M' + ' L'.join(f'{f(x)} {f(y)}' for x, y in pts))
        return out


def fuji_svg(fj, pal, uid='fj', seed=3):
    """The mountain, its snow, its shading and the mist at its foot."""
    rng = random.Random(seed + 11)
    u_of = fj.snow_edge(seed=seed)
    body, snow = fj.body(), fj.snow(u_of)
    x0, ys, yb, hb = fj.x0, fj.ys, fj.yb, fj.hb
    ridges = ''.join(f'<path d="{d}"></path>' for d in fj.ridges(rng))
    return f'''<defs>
        <linearGradient id="{uid}Body" x1="0" y1="{f(ys)}" x2="0" y2="{f(yb)}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="{pal['fuji_top']}"></stop>
          <stop offset="0.55" stop-color="{pal['fuji_mid']}"></stop>
          <stop offset="1" stop-color="{pal['fuji_foot']}"></stop>
        </linearGradient>
        <linearGradient id="{uid}Side" x1="{f(x0 - hb * 0.7)}" y1="0" x2="{f(x0 + hb * 0.25)}" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="{pal['fuji_shade']}" stop-opacity="0.55"></stop>
          <stop offset="1" stop-color="{pal['fuji_shade']}" stop-opacity="0"></stop>
        </linearGradient>
        <linearGradient id="{uid}Snow" x1="{f(x0 - hb * 0.32)}" y1="0" x2="{f(x0 + hb * 0.3)}" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="{pal['snow_shade']}"></stop>
          <stop offset="0.48" stop-color="{pal['snow']}"></stop>
          <stop offset="1" stop-color="{pal['snow_lit']}"></stop>
        </linearGradient>
        <linearGradient id="{uid}Mist" x1="0" y1="{f(yb - (yb - ys) * 0.42)}" x2="0" y2="{f(yb)}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="{pal['fuji_mist']}" stop-opacity="0"></stop>
          <stop offset="0.7" stop-color="{pal['fuji_mist']}" stop-opacity="0.72"></stop>
          <stop offset="1" stop-color="{pal['fuji_mist']}" stop-opacity="0.9"></stop>
        </linearGradient>
        <clipPath id="{uid}Clip"><path d="{body}"></path></clipPath>
      </defs>
      <g class="fuji">
        <path d="{body}" fill="url(#{uid}Body)"></path>
        <g clip-path="url(#{uid}Clip)">
          <rect x="{f(x0 - hb - 4)}" y="{f(ys - 4)}" width="{f(hb * 2 + 8)}" height="{f(yb - ys + 8)}" fill="url(#{uid}Side)"></rect>
          <g fill="none" stroke="{pal['fuji_ridge']}" stroke-width="1" stroke-opacity="0.22" stroke-linecap="round">{ridges}</g>
          <path d="{snow}" fill="url(#{uid}Snow)"></path>
          <rect x="{f(x0 - hb - 4)}" y="{f(yb - (yb - ys) * 0.42)}" width="{f(hb * 2 + 8)}" height="{f((yb - ys) * 0.42 + 4)}" fill="url(#{uid}Mist)"></rect>
        </g>
      </g>'''
