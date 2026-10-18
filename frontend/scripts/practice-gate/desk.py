"""The Practice gate's painted platform on the desk (plan 244), from the
owner's painting of it, source/desk.webp, and of the car's inside seen
through its open door, source/interior.webp (plan 244c).

  python3 scripts/practice-gate/desk.py

writes public/practice/gate/desk/<REV>/ -- the layers (bg, car, car2,
near) and the shut door's two leaves at each of Today's four hours, and
the stripe's masks -- and src/components/practice/gate/desk.json, the
revision the app asks for and where the scene keeps what the app draws
over it or reads to fit it (the car, the door, the clock, the sign, the
pillars). The day is the painting itself; dawn, dusk and night are it
lit again by the phone's own recipes (hours.py), on this painting's
parts (desk_parts.py), every window showing the trees the painting
shows through the car, lit for the hour, with the hour's light on its
glass (windows_at). Needs numpy, Pillow and
opencv-contrib-python-headless, as build.py does.

A change to anything it writes bumps REV: the layers are cached under
their path for a year (the service worker's /practice/gate/ rule)."""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import clouds                   # noqa: E402
import desk_cut as cut          # noqa: E402
import desk_parts as parts      # noqa: E402
from hours import Geometry, Lighter, HOUR_ORDER, lin, srgb   # noqa: E402

REV = 4
FRONT = HERE.parent.parent
PRINT = FRONT / 'src/components/station/print/print.json'
OUT = FRONT / 'public/practice/gate/desk'
DATA = FRONT / 'src/components/practice/gate/desk.json'
QUALITY = 86


class Desk(Geometry):
    """Where the desk's painting keeps what the hours light (one px a unit)."""
    px = 1
    sky_top = parts.SKY_TOP
    horizon = parts.HORIZON
    fascia = 1e9                # no fascia: the canopy's beam is steel, toned as the canopy
    floor = cut.FLOOR
    stars_y = 312
    stars_margin = 12
    star = 0.5                  # a px here is a unit, the phone's half one: its stars at their size
    towns = ((560, 840, 330, 346, 0.4), (870, 1330, 334, 350, 0.35), (20, 290, 334, 350, 0.25))
    rims = tuple(x for x0, x1 in cut.PILLARS for x in (x0 + 1.5, x1 - 2.5))
    bloom = (5, 15, 36)
    pillar_knee = 0.3           # the painting's sun lights the pillars' right edge white
    recipe = {
        'night': dict(disc=dict(at=(556, 146), r=11, glow_r=62), stars=900, town=110),
        'dusk': dict(disc=dict(at=(520, 138), r=9, glow_r=40), stars=70, town=46),
        'dawn': dict(disc=dict(at=(232, 326), r=13, glow_r=82), stars=110, town=26),
    }


class DeskSky(clouds.Sky):
    """Where the desk's clouds are read, and how far they drift (px)."""
    drift = 64                  # the app drifts them DRIFT either way; this is past it
    top = parts.SKY_TOP + 30    # under the lamps' halo
    low = 5

    def carry(self, pre, al, hole, m):
        """The clouds carried along their rows behind what hides the sky
        (the sign, the pillars, past the scene's sides), each hidden pixel
        between the nearest it was read at either side: a drift is a
        slide along the row, and inpainted the sign's rods drew cones down
        it that a drift brought out. Where the sky shows but no cloud was
        read (the lamps' halo, the land's line) none is carried, so at
        rest the sky is the hour's to the pixel."""
        hole = hole & (m < 0.02)
        out_p, out_a = pre.copy(), al.copy()
        cols = np.arange(al.shape[1])
        for y in np.nonzero(hole.any(axis=1))[0]:
            known = ~hole[y]
            if not known.any():
                continue
            h = hole[y]
            out_a[y, h] = np.interp(cols[h], cols[known], al[y, known])
            for c in range(3):
                out_p[y, h, c] = np.interp(cols[h], cols[known], pre[y, known, c])
        return out_p, out_a

    def clear_of(self, z):
        """Clear of the pillars' painted edges (in a sky padded each side,
        theirs), and a few px clear of what stands upright in the sky: a
        sign's pale steel edge, read as a cloud, slid out beside it."""
        pad = (z.shape[1] - cut.W) // 2
        p = np.pad(parts.pillars((z.shape[0], cut.W)), ((0, 0), (pad, pad)))
        z = z & ~(cv2.dilate(p.astype(np.uint8), np.ones((1, 9), np.uint8)) > 0)
        return cv2.erode(z.astype(np.uint8), np.ones((1, 13), np.uint8)) > 0


SKY = DeskSky()
DRIFT = 48                    # px the app's clouds drift either way (index.css's desk-drift)
# The stars that twinkle (the app's glints over the brightest the hour drew)
# and the disc whose glow breathes, at each hour.
TWINKLE = {'night': 16, 'dusk': 5, 'dawn': 5}


def drifting(lit, clear, sky, M):
    """The sky they drift over and the clouds (clouds.split), the clouds
    carried SKY.drift px past the scene's two sides, so a drift never
    shows the scene's edge: the clouds' layer is that much wider each
    side, and the sky the scene's own width."""
    d = SKY.drift

    def wide(x):
        return np.pad(x, ((0, 0), (d, d)) + ((0, 0),) * (x.ndim - 2), mode='edge')

    Mw = {'sky': np.pad(M['sky'], ((0, 0), (d, d))), 'horizon': wide(M['horizon'][None, :])[0]}
    clear, col, al = clouds.split(wide(lit), wide(clear), np.pad(sky, ((0, 0), (d, d))), Mw, SKY)
    return clear[:, d:-d], col, al


def sky_mask(M):
    """Where the clouds show: the sky, less the land's soft edge in front of it."""
    sky = np.clip(cv2.GaussianBlur(M['sky'].astype(np.float32), (0, 0), 0.7), 0, 1)
    return sky * (1 - M['matte']['alpha'])


# What the hour does to a thing it has no part for: the bench, the
# pillar's sign, the hanging sign (multiplied, in linear light's stead a
# plain multiply: they are small and stand in the hour's light).
AMBIENT = {'dawn': (0.80, 0.75, 0.86), 'dusk': (0.74, 0.60, 0.58), 'night': (0.30, 0.33, 0.44)}
# The signs after dark: the hanging one lit from inside, the pillar's under
# the platform's lamps. The panel dims less than the platform's things,
# the white letters keep their light, the steel round the panel is steel.
SIGN_LIT = {'dawn': 0.86, 'dusk': 0.8, 'night': 0.62}
SIGN_FRAME = 7                # px: the steel ring round a sign's panel, twice over and one
# The sun the painted inside has on its floor, after dark the lamps': how
# much of the floor's light above its own middle each hour keeps.
FLOOR_SHINE = {'dawn': 0.55, 'dusk': 0.5, 'night': 0.4}
SILL = 8                      # px: the yellow edge and the sill, under the floor, keep theirs
# The windows at the hour (windows_at): the trees the painting shows
# through the car, their colours kept, in the hour's light (GRADE, linear),
# and on the glass the hour's sky (from these rows of the scene) fading
# down the pane, the lit car's warm light, the ceiling's tubes caught
# along a pane's top and a soft sheen across it: how much of each.
GAP_SKY = (286, 326)
GRADE = {'dawn': (0.3, 0.25, 0.36), 'dusk': (0.3, 0.19, 0.15), 'night': (0.022, 0.03, 0.055)}
SKY_IN = {'dawn': 0.26, 'dusk': 0.26, 'night': 0.1}
GLOW = {'dawn': 0.05, 'dusk': 0.1, 'night': 0.15}
TUBES = {'dawn': 0.16, 'dusk': 0.3, 'night': 0.42}
SHEEN = {'dawn': 0.12, 'dusk': 0.09, 'night': 0.06}
TUBE_ROW = (4, 2.2)           # px under a pane's top, and the streak's half height
EDGE = 2                      # px: the near layer's soft edge past a pillar's band


def to_f(a):
    return a.astype(np.float32) / 255


def webp(rgb, al, path):
    rgb8 = np.clip(rgb * 255 + 0.5, 0, 255).astype(np.uint8)
    if al is None:
        Image.fromarray(rgb8, 'RGB').save(path, 'WEBP', quality=QUALITY, method=6)
        return
    al8 = np.clip(al * 255 + 0.5, 0, 255).astype(np.uint8)
    Image.fromarray(np.dstack([rgb8, al8]), 'RGBA').save(path, 'WEBP', quality=QUALITY, method=6)


def png_mask(m, path):
    img = np.zeros(m.shape + (4,), np.uint8)
    img[..., :3] = 255
    img[..., 3] = np.clip(m * 255 + 0.5, 0, 255).astype(np.uint8)
    Image.fromarray(img).save(path, optimize=True)


def ink(rgb):
    return '#%02x%02x%02x' % tuple(int(round(c * 255)) for c in rgb.reshape(-1, 3).mean(axis=0))


def ambient(rgb, mask, hour):
    if hour == 'day':
        return rgb
    out = rgb.copy()
    out[mask] = np.clip(rgb[mask] * np.array(AMBIENT[hour], np.float32), 0, 1)
    return out


def sign_lit(rgb, day, mask, hour):
    """A sign at the hour: its panel dimmed, its letters lit, the steel
    ring round the panel lit as the hour leaves the platform's things (kept
    with the letters, it stood out bright round the sign at night)."""
    if hour == 'day':
        return rgb
    out = rgb.copy()
    k = SIGN_LIT[hour]
    inner = cv2.erode(mask.astype(np.uint8), np.ones((SIGN_FRAME, SIGN_FRAME), np.uint8)) > 0
    frame = mask & ~inner
    # the letters by how white they are, so a thin stroke's soft edge is
    # lit with it and the stroke stays whole
    white = (np.clip((parts.lum(day) - 0.4) / 0.32, 0, 1) * (parts.sat(day) < 0.25))[..., None]
    tint = np.array(AMBIENT[hour], np.float32) * 0.35 + 0.65
    lit = np.clip(day * k * tint * (1 - white) + day * (0.9 + 0.1 * k) * white, 0, 1)
    out[inner] = lit[inner]
    out[frame] = np.clip(day[frame] * np.array(AMBIENT[hour], np.float32), 0, 1)
    return out


def windows_at(cars, day, Mc, scene, sky, T, hour):
    """Every window at the hour as the painting has it by day: the trees
    seen through the car, the doorway's far window's too, their colours
    kept, in the hour's light; and on the glass what the hour puts there
    -- its sky, fading down the pane, the lit car's warm light, its
    ceiling's tubes caught along each pane's top, and a soft sheen."""
    if hour == 'day':
        return cars
    band = scene[GAP_SKY[0]:GAP_SKY[1]][sky[GAP_SKY[0]:GAP_SKY[1]]]
    gap = np.median(band, axis=0)
    sheen = np.clip(gap * 0.6 + 0.4, 0, 1)
    lamp = np.asarray(T['glass'], np.float32)
    tube = np.asarray(T['tube'], np.float32)
    out = {}
    for name, (rgb, al) in cars.items():
        M = Mc[name]
        glass = M['glass'] | M['far']
        # the painting's own trees, their colours kept, in the hour's light
        # (in linear light: the hour's colour and how much of the day's)
        d = day[name][..., :3]
        view = srgb(lin(d) * np.asarray(GRADE[hour], np.float32))
        view = view * (1 - GLOW[hour]) + lamp * GLOW[hour]
        rows = np.arange(rgb.shape[0], dtype=np.float32)[:, None]
        cols = np.arange(rgb.shape[1], dtype=np.float32)[None, :]
        n, lab, stats, _ = cv2.connectedComponentsWithStats(glass.astype(np.uint8), 8)
        for k in range(1, n):
            bx, by, bw, bh, area = stats[k]
            if area < 40:
                continue
            own = (lab == k)[by:by + bh, bx:bx + bw]
            r, c = rows[by:by + bh], cols[:, bx:bx + bw]
            pane = view[by:by + bh, bx:bx + bw]
            # the hour's sky in the glass, faint, fading down the pane
            sk = np.clip(1 - (r - by) / max(bh * 0.6, 1), 0, 1) * SKY_IN[hour]
            pane = pane * (1 - sk[..., None]) + gap * sk[..., None]
            # the ceiling's tubes, along the pane's top
            st = np.exp(-((r - by - TUBE_ROW[0]) / TUBE_ROW[1]) ** 2) * TUBES[hour]
            pane = pane * (1 - st[..., None]) + tube * st[..., None]
            # a sheen across the glass, leaning, a little apart in each pane
            at = bx + bw * (0.3 + 0.4 * ((bx * 0.618) % 1))
            sh = np.exp(-((c - at + (r - by) * 0.55) / max(bw * 0.09, 3)) ** 2) * SHEEN[hour]
            pane = pane * (1 - sh[..., None]) + sheen * sh[..., None]
            view[by:by + bh, bx:bx + bw][own] = pane[own]
        w = cv2.GaussianBlur(glass.astype(np.float32), (3, 3), 0)[..., None] * (M['windows'] | M['far'])[..., None]
        out[name] = (np.clip(rgb * (1 - w) + view * w, 0, 1), al)
    return out


def pillars_edged(lit, near_rgb):
    """The pillars' soft edges at the hour. The near layer's edge is a
    pixel of the pillar over a pixel of what is behind it: out of the
    pillar's band, that pixel takes the pillar's lit edge (it kept the
    day's sky, and stood as a pale line by the pillar at night); and
    under the band the scene is the pillar too (it kept the day's pillar
    and floor, which the edge let through)."""
    band = parts.pillars(lit.shape[:2], (0, cut.PILLAR_FOOT))
    have = band.copy()
    for _ in range(EDGE):
        for step in (1, -1):
            grow = np.roll(have, step, axis=1) & ~have
            grow[:, 0 if step == 1 else -1] = False
            near_rgb[grow] = np.roll(near_rgb, step, axis=1)[grow]
            have |= grow
    lit = lit.copy()
    lit[band] = near_rgb[band]
    return lit


def inside_lit(cars, Mc, hour):
    """The open doorway's inside at the hour: the sun the owner painted on
    its floor gone with the sun, the floor keeping the lamps' sheen."""
    if hour == 'day':
        return cars
    rgb, al = cars['car']
    ins = Mc['car']['inside']
    rows = np.arange(rgb.shape[0])[:, None]
    floor = ins & (rows >= cut.FLOOR_IN - cut.CAR[0]) & (rows < cut.INSIDE[3] - SILL - cut.CAR[0])
    L = parts.lum(rgb)
    mid = np.median(L[floor])
    keep = FLOOR_SHINE[hour]
    k = np.where(floor & (L > mid), (mid + (L - mid) * keep) / np.maximum(L, 1e-4), 1)
    k = cv2.GaussianBlur(k.astype(np.float32), (0, 0), 1.2) * floor + (1 - floor)
    return dict(cars, car=(np.clip(rgb * k[..., None], 0, 1), al))


def leaves(car2, al):
    """The shut door's two leaves, cut from car2 where they stand."""
    x0, y0, x1, y1 = cut.DOORWAY
    r0, r1 = y0 - cut.CAR[0], y1 - cut.CAR[0]
    mid = (x0 + x1) // 2
    return car2[r0:r1, x0:mid], car2[r0:r1, mid:x1]


def main():
    out = OUT / str(REV)
    out.mkdir(parents=True, exist_ok=True)
    for old in out.iterdir():
        old.unlink()

    S = cut.clean(HERE / 'source' / 'desk.webp')
    L = cut.layers(S)
    bg = to_f(L['bg'])
    car = {name: to_f(L[name]) for name in ('car', 'car2')}
    near = to_f(L['near'])

    M = parts.scene(bg)
    Mc = {name: parts.car(car[name], open_door=name == 'car') for name in car}
    Mn = parts.near(near)

    png_mask(L['band_car'], out / 'band-car.png')
    png_mask(L['band_car2'], out / 'band-car2.png')
    bl, br = leaves(L['band_car2'], None)
    png_mask(bl, out / 'band-leaf-l.png')
    png_mask(br, out / 'band-leaf-r.png')

    # the clouds, lifted off the sky so they drift behind its mask (clouds.py)
    sky = sky_mask(M)
    r0, r1 = (int(r) for r in clouds.rows(M, SKY))
    png_mask(sky[r0:r1], out / 'sky.png')

    def write(hour, lit, clear, cars, near_rgb):
        clear, col, al = drifting(lit, clear, sky, M)
        webp(clear, None, out / f'bg-{hour}.webp')
        webp(col[r0:r1], al[r0:r1], out / f'clouds-{hour}.webp')
        for name, (rgb, al) in cars.items():
            webp(rgb, al, out / f'{name}-{hour}.webp')
        lf, rt = leaves(cars['car2'][0], None)
        webp(lf, None, out / f'leaf-l-{hour}.webp')
        webp(rt, None, out / f'leaf-r-{hour}.webp')
        webp(near_rgb, near[..., 3], out / f'near-{hour}.webp')
        return {'top': ink(lit[:4, 300:1600]), 'side': ink(near_rgb[:600, cut.PILLARS[0][0] + 20:cut.PILLARS[0][0] + 30])}

    day = bg[..., :3]
    fill = {'day': write('day', day, clouds.day_clear(day, M, SKY),
                         {n: (a[..., :3], a[..., 3]) for n, a in car.items()}, near[..., :3])}

    light = Lighter(json.loads(PRINT.read_text())['hours'], Desk())
    bg_a = np.dstack([bg, np.ones(bg.shape[:2], np.float32)])
    stars, discs = {}, {}
    for hour in HOUR_ORDER:
        rgb, _ = light.pillars(hour, near)
        near_rgb = near[..., :3].copy()
        near_rgb[Mn['pillars']] = rgb[Mn['pillars']]
        near_rgb = ambient(near_rgb, Mn['bench'], hour)
        near_rgb = sign_lit(near_rgb, near[..., :3], Mn['sign'], hour)

        def finish(lit):
            lit = ambient(lit, M['bench'], hour)
            lit = sign_lit(lit, bg, M['sign'], hour)
            return pillars_edged(lit, near_rgb)

        # the same stars with the clouds and without them
        state = light.rng.bit_generator.state
        light.placed = []
        lit = finish(light.scene(hour, bg_a, M)[0])
        light.rng.bit_generator.state = state
        drawn, light.placed = light.placed, []
        clear = finish(light.scene(hour, bg_a, M, clouds=False)[0])
        cars = inside_lit({name: light.car(hour, a, Mc[name]) for name, a in car.items()}, Mc, hour)
        cars = windows_at(cars, car, Mc, clear, M['sky'], light.H[hour], hour)
        fill[hour] = write(hour, lit, clear, cars, near_rgb)
        stars[hour] = [[round(float(x), 1), round(float(y), 1), round(float(b), 2)]
                       for x, y, b in sorted(drawn, key=lambda st: -st[2])[:TWINKLE[hour]]]
        d = light.H[hour]['disc']
        discs[hour] = {'kind': d['kind'], 'x': float(d['at'][0]), 'y': float(d['at'][1]), 'r': float(d['r']),
                       'glow': ink(d['glow']), 'reach': float(d['glow_r'])}
        print('lit', hour)

    x0, y0, x1, y1 = cut.DOORWAY
    data = {
        'rev': REV,
        'scene': {'w': cut.W, 'h': cut.H},
        'car': {'top': cut.CAR[0], 'h': cut.CAR[1] - cut.CAR[0]},
        'door': {'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0},
        'clock': cut.CLOCK,
        'sign': {'x': cut.SIGN[0], 'right': cut.SIGN[2]},
        'pillars': [list(p) for p in cut.PILLARS],
        'floor': cut.FLOOR[0],
        'fill': {hour: fill[hour] for hour in ('dawn', 'day', 'dusk', 'night')},
        'sky': {'top': r0, 'h': r1 - r0, 'pad': SKY.drift, 'drift': DRIFT},
        'stars': {hour: stars[hour] for hour in ('dawn', 'dusk', 'night')},
        'disc': {hour: discs[hour] for hour in ('dawn', 'dusk', 'night')},
        'lamps': {'rows': list(parts.TUBE_ROWS), 'tubes': [[x0, min(x1, cut.W)] for x0, x1 in cut.LAMPS]},
    }
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    for f in sorted(out.iterdir()):
        print(f'{f.relative_to(FRONT)}  {f.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
