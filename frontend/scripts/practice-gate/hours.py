"""時刻 — the painted platform at the four hours of Today's print (plan 223,
after plan 205): 曙 dawn, 帰帆 the day (the owner's painting itself), 落雁
dusk, 秋月 the night.

Each hour is the day's painting lit again part by part (parts.py): its sky
is Today's sky for that hour (print.json's stops), the clouds keep their
shapes and take the hour's light, the land darkens and cools or warms, the
canopy's two lamps come on with their glow, the platform loses the sun's
patches and keeps its tiles, the cars' windows and their open door light
from inside. The sun and the moon are Today's discs.

The stars and the moon's seas draw from one seeded stream, the hours in a
fixed order (HOUR_ORDER), so two builds write the same bytes."""
import math
import numpy as np
import cv2

from parts import lum, sat


def hexrgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255


C = hexrgb


def grad(stops, t):
    ts = np.array([s[0] for s in stops], np.float32)
    cs = np.array([hexrgb(s[1]) for s in stops], np.float32)
    return np.stack([np.interp(t, ts, cs[:, k]) for k in range(3)], -1).astype(np.float32)


def lin(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4).astype(np.float32)


def srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055).astype(np.float32)


def mix(a, b, t):
    t = np.asarray(t, np.float32)
    if t.ndim == 2:
        t = t[..., None]
    return a + (b - a) * t


def blur(x, r):
    return cv2.GaussianBlur(x.astype(np.float32), (0, 0), r)


def smooth(m, r=0.8):
    return np.clip(blur(m.astype(np.float32), r), 0, 1)


def tone(color, L, ref, gamma=1.0):
    """The hour's colour, keeping the painting's light and shade inside the part."""
    k = np.clip(L / ref, 0, 3) ** gamma
    return np.clip(color[None, None, :] * k[..., None], 0, 1)


HORIZON_V = 291.0
SKY_TOP_V = 46.0
HOUR_ORDER = ('night', 'dusk', 'dawn')


def recipes(print_hours):
    """What each hour lights, and how. The skies are Today's own."""
    return {
        'night': dict(
            sky=print_hours['night']['sky'],
            cloud=dict(body=C('#1d2a45'), lit=C('#5d6e93'), amount=0.62, under=0.0),
            stars=210, disc=dict(kind='moon', at=(92, 116), r=8.6, fill=('#fdf9ec', '#e6ddc2'), glow=C('#dfe6f2'), glow_r=46, glow_k=0.42),
            snow=(C('#3e4c6e'), C('#a7b6d4')), mount=C('#121c34'), mount_ref=0.62, far=C('#16233e'),
            forest=C('#0b1519'), forest_ref=0.42, town=48,
            canopy=C('#121316'), fascia=C('#5b4630'), tube=C('#fff4dc'), bloom=(C('#ffcf8e'), 0.85), wires=C('#0b0e14'),
            floor=(C('#2b2f3a'), C('#1b1e26')), floor_tex=0.55, tactile=C('#5a4519'),
            pillar=C('#17191f'), pillar_rim=(C('#ffcf8e'), 0.10),
            body=C('#3a4250'), body_ref=0.70, body_gamma=1.15, glass=C('#ffd9a2'), glass_k=0.95, inside=(1.06, 0.96, 0.80), inside_k=1.0,
            far_win=C('#1a2944'), key=(C('#9fb3d8'), 0.35), roof=C('#1b1e25'), roof_ref=0.6, under=C('#06070a'),
            mist=None),
        'dusk': dict(
            sky=print_hours['dusk']['sky'],
            cloud=dict(body=C('#5d5878'), lit=C('#f4b98f'), amount=0.8, under=0.75),
            stars=26, disc=dict(kind='moon', at=(96, 112), r=7.0, fill=('#fbf4df', '#eadbb6'), glow=C('#f6e7c4'), glow_r=30, glow_k=0.22),
            snow=(C('#8c7ea2'), C('#f6c6ae')), mount=C('#3e4468'), mount_ref=0.62, far=C('#4f5378'),
            forest=C('#1d2622'), forest_ref=0.42, town=20,
            canopy=C('#1e1b1c'), fascia=C('#7a5a3c'), tube=C('#fff1d6'), bloom=(C('#ffcb8a'), 0.55), wires=C('#221f26'),
            floor=(C('#6a5f63'), C('#4a4552')), floor_tex=0.8, tactile=C('#9a6e2a'), sun_patch=(C('#f4a25c'), 0.55),
            pillar=C('#26232a'), pillar_rim=(C('#ffb36a'), 0.14),
            body=C('#857d8a'), body_ref=0.70, body_gamma=1.1, glass=C('#f7b77e'), glass_k=0.6, inside=(1.04, 0.95, 0.84), inside_k=0.92,
            far_win=C('#e2a07a'), key=(C('#ffb478'), 0.75), roof=C('#45404c'), roof_ref=0.6, under=C('#121015'),
            mist=None),
        'dawn': dict(
            sky=print_hours['dawn']['sky'],
            cloud=dict(body=C('#8a77a0'), lit=C('#f6b4a6'), amount=0.8, under=0.7),
            stars=40, disc=dict(kind='sun', at=(54, 284.5), r=10.0, fill=('#d4553a', '#a8301f'), glow=C('#f08c64'), glow_r=60, glow_k=0.42),
            snow=(C('#a58fb4'), C('#fbd2c4')), mount=C('#5a4d74'), mount_ref=0.62, far=C('#6c5f86'),
            forest=C('#262a36'), forest_ref=0.42, town=12,
            canopy=C('#1c1c24'), fascia=C('#6a5a56'), tube=C('#f6f1ea'), bloom=(C('#ffd7b0'), 0.35), wires=C('#22202c'),
            floor=(C('#8d8a9c'), C('#6e6c80')), floor_tex=0.85, tactile=C('#b18a49'), sun_patch=(C('#f7b6a0'), 0.35),
            pillar=C('#2a2834'), pillar_rim=(C('#f6b29a'), 0.10),
            body=C('#8f8ba3'), body_ref=0.70, body_gamma=1.1, glass=C('#d9b8b4'), glass_k=0.35, inside=(1.02, 0.97, 0.92), inside_k=0.95,
            far_win=C('#f2b7a6'), key=(C('#ffc4b4'), 0.6), roof=C('#5b5868'), roof_ref=0.6, under=C('#16151c'),
            mist=dict(color=C('#f3d6d8'), v=(288, 330), k=0.3)),
    }


class Lighter:
    def __init__(self, print_hours):
        self.H = recipes(print_hours)
        self.rng = np.random.default_rng(205)

    # ── the sky's disc, its stars, the far town ──
    def disc(self, img_lin, d):
        """Today's sun or moon: a soft disc, its glow, the moon's quiet seas."""
        Hh, Ww = img_lin.shape[:2]
        cu, cv = d['at']
        cx, cy, r = cu * 2, cv * 2, d['r'] * 2
        yy, xx = np.mgrid[0:Hh, 0:Ww].astype(np.float32)
        dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
        glow = np.exp(-(np.maximum(dist - r, 0) / (d['glow_r'] * 2 / 2.2)) ** 1.4) * d['glow_k']
        out = img_lin + lin(d['glow'])[None, None, :] * glow[..., None] * (1 - img_lin)
        inner, edge = C(d['fill'][0]), C(d['fill'][1])
        t = np.clip(dist / r, 0, 1)
        col = mix(inner[None, None, :], edge[None, None, :], t ** 2)
        if d['kind'] == 'moon':
            seas = blur((self.rng.random((Hh, Ww)) > 0.9965).astype(np.float32), r * 0.18)
            seas = seas / max(seas.max(), 1e-6)
            col = col * (1 - 0.12 * seas[..., None])
        a = np.clip(r + 0.8 - dist, 0, 1)
        return out * (1 - a[..., None]) + lin(col) * a[..., None]

    def stars(self, img_lin, n, sky, clouds, horizon_px, keep_out):
        rng = self.rng
        Hh, Ww = img_lin.shape[:2]
        out = img_lin.copy()
        placed = tries = 0
        while placed < n and tries < n * 30:
            tries += 1
            x = rng.uniform(52, Ww - 52)
            y = rng.uniform(SKY_TOP_V * 2 + 14, 268 * 2)
            xi, yi = int(x), int(y)
            if not sky[yi, xi] or clouds[yi, xi] > 0.08:
                continue
            if math.hypot(x - keep_out[0], y - keep_out[1]) < keep_out[2]:
                continue
            fade = np.clip((horizon_px[xi] - y) / 140.0, 0, 1)
            if rng.random() > fade:
                continue
            b = (rng.random() ** 2.6) * 0.9 + 0.12
            s = 0.55 + rng.random() ** 3 * 1.1
            tint = np.array([1.0, 0.97, 0.92]) if rng.random() < 0.5 else np.array([0.88, 0.93, 1.0])
            x0, x1, y0, y1 = max(0, xi - 4), min(Ww, xi + 5), max(0, yi - 4), min(Hh, yi + 5)
            gy, gx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
            g = np.exp(-((gx - x) ** 2 + (gy - y) ** 2) / (2 * s * s)) * b * fade
            out[y0:y1, x0:x1] += (g[..., None] * tint[None, None, :] * (1 - clouds[y0:y1, x0:x1, None] * 6).clip(0, 1)).astype(np.float32)
            placed += 1
        return out

    def town(self, img_lin, n, land_mask):
        """Windows lit in the far town at Fuji's foot and along the hills."""
        rng = self.rng
        Hh, Ww = img_lin.shape[:2]
        out = img_lin.copy()
        zones = [(300, 366, 284, 297, 0.55), (180, 300, 289, 298, 0.3), (40, 175, 292, 300, 0.15)]
        for u0, u1, v0, v1, share in zones:
            for _ in range(int(n * share)):
                x, y = rng.uniform(u0 * 2, u1 * 2), rng.uniform(v0 * 2, v1 * 2)
                xi, yi = int(x), int(y)
                if not land_mask[yi, xi]:
                    continue
                b = 0.25 + rng.random() * 0.55
                col = np.array([1.0, 0.78, 0.45]) if rng.random() < 0.75 else np.array([0.9, 0.95, 1.0])
                x0, x1, y0, y1 = max(0, xi - 3), min(Ww, xi + 4), max(0, yi - 3), min(Hh, yi + 4)
                gy, gx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
                g = np.exp(-((gx - x) ** 2 + (gy - y) ** 2) / (2 * 0.7 ** 2)) * b
                out[y0:y1, x0:x1] += (g[..., None] * lin(col)[None, None, :]).astype(np.float32)
        return out

    # ── the three layers ──
    def scene(self, hour, a, M):
        T = self.H[hour]
        rgb = a[..., :3]
        L, S = lum(rgb), sat(rgb)
        Hh, Ww = L.shape
        v = (np.arange(Hh, dtype=np.float32) / 2)[:, None] * np.ones((1, Ww), np.float32)
        sky, land, horizon = M['sky'], M['land'], M['horizon']

        # the sky and its clouds
        t = np.clip((v - SKY_TOP_V) / (HORIZON_V - SKY_TOP_V), 0, 1)
        base = grad(T['sky'], t)
        Lsky = np.where(sky, L, np.nan)
        with np.errstate(all='ignore'):
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter('ignore')
                Lb = np.nanpercentile(Lsky, 22, axis=1)
        Lb = np.where(np.isnan(Lb), np.nanmean(Lb), Lb)
        Lb = cv2.GaussianBlur(Lb.reshape(-1, 1).astype(np.float32), (0, 0), 6).ravel()
        cloud = np.clip((L - Lb[:, None] - 0.012) / 0.2, 0, 1) * sky
        cloud = cloud * np.clip((S < 0.3).astype(np.float32) + 0.3, 0, 1)
        shade = np.clip((L - Lb[:, None]) / np.maximum(1 - Lb[:, None], 0.05), 0, 1)
        cl = T['cloud']
        # what the low sun lights: the clouds' undersides (the painting's shaded half)
        under = np.clip(1 - shade, 0, 1) ** 1.4 * cl['under']
        cbody = mix(np.broadcast_to(cl['body'], base.shape), np.broadcast_to(cl['lit'], base.shape),
                    np.clip(shade * (1 - cl['under']) + under, 0, 1))
        skyc = mix(base, cbody, cloud * cl['amount'])
        out = rgb.copy()
        out[sky] = skyc[sky]

        # the land: Fuji's snow, the mountains, the forest
        snow_s, snow_l = T['snow']
        snow = mix(np.broadcast_to(snow_s, rgb.shape), np.broadcast_to(snow_l, rgb.shape), np.clip((L - 0.72) / 0.28, 0, 1))
        mount = tone(T['mount'], L, T['mount_ref'], 1.25)
        farness = np.clip((L - 0.45) / 0.35, 0, 1)          # the far hills lean to the hour's far colour
        mount = mix(mount, np.broadcast_to(T['far'], rgb.shape), farness * 0.6)
        forest = tone(T['forest'], L, T['forest_ref'], 1.15)
        landc = rgb.copy()
        landc[M['snow']] = snow[M['snow']]
        landc[M['mount']] = mount[M['mount']]
        landc[M['forest']] = forest[M['forest']]
        w_land = smooth(land, 0.9)                           # the land's edge against the sky, softened
        zone = smooth(land | sky, 0.6) > 0.5
        blend = mix(out, landc, w_land)
        out[zone] = blend[zone]
        if T['mist']:
            m = T['mist']
            mv = np.exp(-((v - (m['v'][0] + m['v'][1]) / 2) / ((m['v'][1] - m['v'][0]) / 2.6)) ** 2)
            mv = mv * smooth(land | sky, 2)
            out = mix(out, np.broadcast_to(m['color'], rgb.shape), mv * m['k'])

        # the canopy, its fascia, the wires
        can = M['canopy']
        fascia = can & (v >= 37.5)
        out[can] = tone(T['canopy'], L, 0.26, 1.0)[can]
        out[fascia] = tone(T['fascia'], L, 0.5, 1.0)[fascia]
        wires = M['wires']
        near_w = wires | (smooth(wires, 0.6) > 0.05)
        wc = mix(out, np.broadcast_to(T['wires'], rgb.shape), smooth(wires, 0.5) * 0.9)
        out[near_w] = wc[near_w]

        # the platform: the sun's patches gone, the hour's light, the tiles kept
        plat = M['platform']
        Lp = np.where(plat, L, np.nan)
        lowf = blur(np.nan_to_num(Lp, nan=float(np.nanmean(Lp))), 22)
        tex = np.clip(L / np.maximum(lowf, 0.05), 0.4, 1.6) ** T['floor_tex']
        near_c, far_c = T['floor']
        fv = np.clip((v - 556) / (724 - 556), 0, 1)
        floor = mix(np.broadcast_to(near_c, rgb.shape), np.broadcast_to(far_c, rgb.shape), fv) * tex[..., None]
        if 'sun_patch' in T:
            pc, pk = T['sun_patch']
            patch = np.clip((lowf - np.nanpercentile(Lp, 40)) / 0.25, 0, 1)
            floor = mix(floor, np.broadcast_to(pc, rgb.shape) * tex[..., None], patch * pk)
        tac = M['tactile']
        floor[tac] = (np.broadcast_to(T['tactile'], rgb.shape) * tex[..., None])[tac]
        out[plat] = np.clip(floor, 0, 1)[plat]

        # light: the sky's disc, the stars, the town, the lamps and their glow
        lo = lin(out)
        d = T['disc']
        lo = mix(lo, self.disc(lo, d), smooth(sky, 0.7 if d['kind'] == 'sun' else 0.8))
        if T['stars']:
            keep = (d['at'][0] * 2, d['at'][1] * 2, d['r'] * 2 * 3.2)
            lo = self.stars(lo, T['stars'], sky, cloud, horizon, keep)
        if T['town']:
            lo = self.town(lo, T['town'] * (1 if hour == 'night' else 0.5), M['forest'] | M['mount'])
        tube = M['tube']
        lo[tube] = lin(T['tube'])
        bc, bk = T['bloom']
        tm = tube.astype(np.float32)
        bloom = blur(tm, 6) * 1.6 + blur(tm, 18) * 1.1 + blur(tm, 44) * 0.5
        lo = lo + lin(bc)[None, None, :] * (bloom * bk)[..., None] * 0.55
        return np.clip(srgb(lo), 0, 1), a[..., 3]

    def pillars(self, hour, a):
        T = self.H[hour]
        rgb, al = a[..., :3], a[..., 3]
        L = lum(rgb)
        out = tone(T['pillar'], L, 0.3, 1.0)
        # a warm rim on the pillars' inner edges, from the platform's lamps
        Hh, Ww = L.shape
        u = (np.arange(Ww, dtype=np.float32) / 2)[None, :] * np.ones((Hh, 1), np.float32)
        rc, rk = T['pillar_rim']
        rim = np.clip(1 - np.abs(u - 23.5) / 2.2, 0, 1) + np.clip(1 - np.abs(u - 366.4) / 2.2, 0, 1)
        out = out + rc[None, None, :] * (rim * rk)[..., None]
        return np.clip(out, 0, 1), al

    def car(self, hour, a, M):
        T = self.H[hour]
        rgb, al = a[..., :3], a[..., 3]
        L = lum(rgb)
        out = rgb.copy()
        body = tone(T['body'], L, T['body_ref'], T['body_gamma'])
        kc, kk = T['key']                                    # what the painting lit brightest takes the hour's light
        hi = np.clip((L - 0.78) / 0.18, 0, 1) ** 1.5
        body = np.clip(body + kc[None, None, :] * (hi * kk)[..., None] * 0.6, 0, 1)
        out[M['body']] = body[M['body']]
        out[M['roof']] = tone(T['roof'], L, T['roof_ref'], 1.1)[M['roof']]
        out[M['under']] = tone(T['under'], L, 0.2, 1.0)[M['under']]
        # glass: the light inside, and what of the painting's reflection stays
        g = M['glass']
        glow = np.broadcast_to(T['glass'], rgb.shape) * (0.72 + 0.28 * np.clip(L / 0.4, 0, 1.4))[..., None]
        out[g] = np.clip(mix(body, glow, T['glass_k']), 0, 1)[g]
        ins = M['inside']
        inside = np.clip(rgb * np.array(T['inside'], np.float32)[None, None, :] * T['inside_k'], 0, 1)
        out[ins] = inside[ins]
        far = M['far']
        out[far] = tone(T['far_win'], L, 0.8, 1.0)[far]
        return np.clip(out, 0, 1), al

    # ── the app's own drawing (the door's two leaves), lit like the painted car ──
    def hexc(self, hexc, hour, kind='body'):
        if hour == 'day':
            return hexc
        T = self.H[hour]
        rgb = hexrgb(hexc)
        L = float(rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11)
        body = T['body'] * min(max(L / T['body_ref'], 0), 3) ** T['body_gamma']
        kc, kk = T['key']
        hi = min(max((L - 0.78) / 0.18, 0), 1) ** 1.5
        body = np.clip(body + kc * hi * kk * 0.6, 0, 1)
        if kind == 'glass':
            glow = T['glass'] * (0.72 + 0.28 * min(max(L / 0.4, 0), 1.4))
            body = np.clip(body + (glow - body) * T['glass_k'], 0, 1)
        return '#%02x%02x%02x' % tuple(int(round(c * 255)) for c in body)


# The leaves' inks in the day's light; every other hour derives them (Lighter.hexc).
LEAF = {
    'faceA': (['#a9aaac', '#c7c7c9', '#c0c0c2', '#a8a9ab'], 'body'),
    'edge': (['#2f3034'], 'body'),
    'glass': (['#67635d', '#4d5157', '#2f3f4c', '#263441'], 'glass'),
    'glassEdge': (['#1f2124'], 'body'),
    'brass': (['#b6a27a', '#cbb68c'], 'body'),
    'band': (['#7b95bf', '#2c5a9e', '#2f63b0', '#2b61b0', '#2b5fad', '#2c5695', '#7c93ba'], 'body'),
}
