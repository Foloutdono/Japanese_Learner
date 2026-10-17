"""The Practice gate's painted platform on the desk (plan 244), from the
owner's painting of it: source/desk.webp.

  python3 scripts/practice-gate/desk.py

writes public/practice/gate/desk/<REV>/ -- the layers (bg, car, car2,
near) and the shut door's two leaves at each of Today's four hours, and
the stripe's masks -- and src/components/practice/gate/desk.json, the
revision the app asks for and where the scene keeps what the app draws
over it or reads to fit it (the car, the door, the clock, the sign, the
pillars). The day is the painting itself; dawn, dusk and night are it
lit again by the phone's own recipes (hours.py), on this painting's
parts (desk_parts.py), the car's windows showing its lit inside as the
open doorway does (lit_windows). Needs numpy, Pillow and
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

import desk_cut as cut          # noqa: E402
import desk_parts as parts      # noqa: E402
from hours import Geometry, Lighter, HOUR_ORDER   # noqa: E402

REV = 2
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
    recipe = {
        'night': dict(disc=dict(at=(556, 146), r=11, glow_r=62), stars=900, town=110),
        'dusk': dict(disc=dict(at=(520, 138), r=9, glow_r=40), stars=70, town=46),
        'dawn': dict(disc=dict(at=(232, 326), r=13, glow_r=82), stars=110, town=26),
    }


# What the hour does to a thing it has no part for: the bench, the
# pillar's sign, the hanging sign (multiplied, in linear light's stead a
# plain multiply: they are small and stand in the hour's light).
AMBIENT = {'dawn': (0.80, 0.75, 0.86), 'dusk': (0.74, 0.60, 0.58), 'night': (0.30, 0.33, 0.44)}
# The signs after dark: the hanging one lit from inside, the pillar's under
# the platform's lamps. The panel dims less than the platform's things,
# the white letters keep their light, the steel round the panel is steel.
SIGN_LIT = {'dawn': 0.86, 'dusk': 0.8, 'night': 0.62}
SIGN_FRAME = 7                # px: the steel ring round a sign's panel, twice over and one
# The open doorway's inside between its two stanchions, as a window shows
# it at every hour but the painting's own: the strap rail and its rings,
# the cream wall and the far window in it, at the window's own rows.
INTERIOR = (435, 561)
FAR_MID = 503.5               # the far window's middle
SEEN_THROUGH = 0.94           # what the near glass keeps of the light inside
# Lit inside and darker out, the far glass gives the inside back: how much
# of its light the far window shows over what lies past it, at each hour.
MIRROR = {'dawn': 0.34, 'dusk': 0.45, 'night': 0.8}
GLASS_DIM = 0.66              # the glass gives back less than the wall it mirrors
STREAK = (7, 3.0)             # px under the far window's top, and half its height


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


def lit_windows(cars, Mc, hour):
    """Each car's windows at the hour: the open doorway's lit inside seen
    through them, tiled along each window with a far window at its middle,
    where the painting showed the trees through the car (lit as glass, the
    trees glowed amber in the panes). The day keeps the painting's own."""
    if hour == 'day':
        return cars
    # the far window, in the doorway and so in every window, mirroring the
    # lit inside: the wall's light, brightest under the ceiling, over the
    # forest past it, softened by the glass
    rgb, al = cars['car']
    far, inside = Mc['car']['far'], Mc['car']['inside']
    rows = np.arange(rgb.shape[0])[:, None]
    ys = np.nonzero(far)[0]
    top, foot = ys.min(), ys.max()
    wall = np.median(rgb[inside & (rows < top) & (np.arange(rgb.shape[1]) >= INTERIOR[0])[None, :]
                         & (np.arange(rgb.shape[1]) < INTERIOR[1])[None, :]], axis=0)
    fall = 1 - 0.3 * np.clip((rows - top) / max(foot - top, 1), 0, 1)
    glow = wall[None, None, :] * fall[..., None] * GLASS_DIM
    # and the ceiling's tubes caught in it, a soft streak under its top
    tube = rgb[inside & (rows < top)].max(axis=0)
    streak = np.exp(-((rows - top - STREAK[0]) / STREAK[1]) ** 2)[..., None]
    glow = glow * (1 - streak * 0.55) + tube[None, None, :] * streak * 0.55
    past = cv2.GaussianBlur(rgb, (0, 0), 2)
    m = (cv2.GaussianBlur(far.astype(np.float32), (3, 3), 0) * MIRROR[hour])[..., None]
    soft = cv2.GaussianBlur(far.astype(np.float32), (3, 3), 0)[..., None]
    rgb = rgb * (1 - soft) + (past * (1 - m / np.maximum(soft, 1e-3)) + glow * (m / np.maximum(soft, 1e-3))) * soft
    cars = dict(cars, car=(np.clip(rgb, 0, 1), al))
    x0, x1 = INTERIOR
    tile = cars['car'][0][:, x0:x1]
    tw = x1 - x0
    out = {}
    for name, (rgb, al) in cars.items():
        M = Mc[name]
        weight = cv2.GaussianBlur(M['glass'].astype(np.float32), (3, 3), 0) * M['windows']
        n, lab, stats, _ = cv2.connectedComponentsWithStats(M['windows'].astype(np.uint8), 8)
        lit = rgb.copy()
        for k in range(1, n):
            bx, by, bw, bh, _ = stats[k]
            cols = np.floor(np.arange(bx, bx + bw) - (bx + bw / 2) + (FAR_MID - x0)).astype(int) % tw
            seen = tile[by:by + bh][:, cols] * SEEN_THROUGH
            w = (weight[by:by + bh, bx:bx + bw] * (lab[by:by + bh, bx:bx + bw] == k))[..., None]
            lit[by:by + bh, bx:bx + bw] = lit[by:by + bh, bx:bx + bw] * (1 - w) + seen * w
        out[name] = (lit, al)
    return out


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

    def write(hour, bg_rgb, cars, near_rgb):
        webp(bg_rgb, None, out / f'bg-{hour}.webp')
        for name, (rgb, al) in cars.items():
            webp(rgb, al, out / f'{name}-{hour}.webp')
        lf, rt = leaves(cars['car2'][0], None)
        webp(lf, None, out / f'leaf-l-{hour}.webp')
        webp(rt, None, out / f'leaf-r-{hour}.webp')
        webp(near_rgb, near[..., 3], out / f'near-{hour}.webp')
        return {'top': ink(bg_rgb[:4, 300:1600]), 'side': ink(near_rgb[:600, cut.PILLARS[0][0] + 20:cut.PILLARS[0][0] + 30])}

    fill = {'day': write('day', bg[..., :3], {n: (a[..., :3], a[..., 3]) for n, a in car.items()}, near[..., :3])}

    light = Lighter(json.loads(PRINT.read_text())['hours'], Desk())
    bg_a = np.dstack([bg, np.ones(bg.shape[:2], np.float32)])
    for hour in HOUR_ORDER:
        lit, _ = light.scene(hour, bg_a, M)
        lit = ambient(lit, M['bench'], hour)
        lit = sign_lit(lit, bg, M['sign'], hour)
        cars = lit_windows({name: light.car(hour, a, Mc[name]) for name, a in car.items()}, Mc, hour)
        rgb, _ = light.pillars(hour, near)
        near_rgb = near[..., :3].copy()
        near_rgb[Mn['pillars']] = rgb[Mn['pillars']]
        near_rgb = ambient(near_rgb, Mn['bench'], hour)
        near_rgb = sign_lit(near_rgb, near[..., :3], Mn['sign'], hour)
        fill[hour] = write(hour, lit, cars, near_rgb)
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
    }
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    for f in sorted(out.iterdir()):
        print(f'{f.relative_to(FRONT)}  {f.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
