"""The Practice gate's painted platform (plan 225), from the owner's two
paintings: source/open.png (the car standing, its door open) and
source/closed.png (the same platform, the door shut: the next cars).

  python3 scripts/practice-gate/build.py

writes public/practice/gate/<REV>/ -- the five layers (bg, clouds, car,
car2, near) at each of Today's four hours, the stripe's two masks and the
sky's (the clouds drift behind it, clouds.py) -- and
src/components/practice/gate/gate.json, the revision the app asks for and
the door leaves' inks at each hour (the leaves are drawn, so they take the
hour's light from here). The day is the painting itself; dawn, dusk and
night are it lit again (hours.py). Needs numpy, Pillow and
opencv-contrib-python-headless (the forest is filled by xphoto's shift-map).

A change to anything it writes bumps REV: the layers are cached under
their path for a year."""
import json
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from cut import cut          # noqa: E402
from band import mask         # noqa: E402
import clouds                 # noqa: E402
import parts                  # noqa: E402
from hours import Lighter, HOUR_ORDER, LEAF   # noqa: E402

REV = 3
FRONT = HERE.parent.parent
PRINT = FRONT / 'src/components/station/print/print.json'
OUT = FRONT / 'public/practice/gate'
DATA = FRONT / 'src/components/practice/gate/gate.json'
QUALITY = 90


def ink(rgb):
    return '#%02x%02x%02x' % tuple(int(round(c * 255)) for c in rgb.reshape(-1, 3).mean(axis=0))


def fills(bg, near):
    """What a frame of another shape shows past the scene: over its top,
    the canopy's top row (a tall screen); beside it, the pillars' outer
    edge (a short one)."""
    return {'top': ink(bg[:4, 100:680]), 'side': ink(near[:2600, :4])}


def webp(rgb, al, path):
    rgb8 = np.clip(rgb * 255 + 0.5, 0, 255).astype(np.uint8)
    if al is None:
        Image.fromarray(rgb8, 'RGB').save(path, 'WEBP', quality=QUALITY, method=6)
        return
    al8 = np.clip(al * 255 + 0.5, 0, 255).astype(np.uint8)
    Image.fromarray(np.dstack([rgb8, al8]), 'RGBA').save(path, 'WEBP', quality=QUALITY, method=6)


def main():
    out = OUT / str(REV)
    out.mkdir(parents=True, exist_ok=True)
    for old in out.iterdir():
        old.unlink()
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        cut(HERE / 'source', work)
        mask(work, 'car', out)
        mask(work, 'car2', out)

        bg, scene_masks = parts.scene(work)
        near = parts.load(work, 'near')
        cars = {name: parts.car(work, name) for name in ('car', 'car2')}
        sky = clouds.mask(scene_masks)
        r0, r1 = clouds.rows(scene_masks)
        sky_png = np.zeros((r1 - r0, sky.shape[1], 4), np.uint8)
        sky_png[..., :3] = 255
        sky_png[..., 3] = np.clip(sky[r0:r1] * 255 + 0.5, 0, 255).astype(np.uint8)
        Image.fromarray(sky_png).save(out / 'sky.png', optimize=True)

        def scene_and_clouds(hour, lit, clear):
            clear, col, al = clouds.split(lit, clear, sky, scene_masks)
            webp(clear, None, out / f'bg-{hour}.webp')
            webp(col[r0:r1], al[r0:r1], out / f'clouds-{hour}.webp')

        scene_and_clouds('day', bg[..., :3], clouds.day_clear(bg[..., :3], scene_masks))
        webp(near[..., :3], near[..., 3], out / 'near-day.webp')
        fill = {'day': fills(bg[..., :3], near[..., :3])}
        for name, (a, _) in cars.items():
            webp(a[..., :3], a[..., 3], out / f'{name}-day.webp')

        light = Lighter(json.loads(PRINT.read_text())['hours'])
        for hour in HOUR_ORDER:
            # the same stars with the clouds and without them
            state = light.rng.bit_generator.state
            lit, _ = light.scene(hour, bg, scene_masks)
            light.rng.bit_generator.state = state
            clear, _ = light.scene(hour, bg, scene_masks, clouds=False)
            scene_and_clouds(hour, lit, clear)
            rgb, al = light.pillars(hour, near)
            webp(rgb, al, out / f'near-{hour}.webp')
            fill[hour] = fills(lit, rgb)
            for name, (a, m) in cars.items():
                rgb, al = light.car(hour, a, m)
                webp(rgb, al, out / f'{name}-{hour}.webp')
            print('lit', hour)

    leaf = {hour: {key: [light.hexc(c, hour, kind) for c in cols] for key, (cols, kind) in LEAF.items()}
            for hour in ('dawn', 'day', 'dusk', 'night')}
    DATA.parent.mkdir(parents=True, exist_ok=True)
    fill = {hour: fill[hour] for hour in ('dawn', 'day', 'dusk', 'night')}
    sky_at = {'top': r0 / 2, 'height': (r1 - r0) / 2}
    DATA.write_text(json.dumps({'rev': REV, 'leaf': leaf, 'fill': fill, 'sky': sky_at}, ensure_ascii=False, indent=2) + '\n')
    for f in sorted(out.iterdir()):
        print(f'{f.relative_to(FRONT)}  {f.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
