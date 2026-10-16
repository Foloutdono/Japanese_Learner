"""The stripe's own mask (plan 223), from the painted car layers: every pixel
of the blue band along the cars and its soft rim, nothing else -- not the
blue seats seen through the open door, not the lake at the roof line, not
the painted sign. The app lays the line's pigment over it with a colour
blend, so the stripe keeps its paint (its shading, its edges) and takes the
line's colour, whole, on every car and at every hour (a blend keeps the
backdrop's light, so the night's darker stripe takes it darker).

Layers are 2 px to a unit, origin (24.65, 195.86)."""
import numpy as np
import cv2
from PIL import Image

ORIGIN = (24.65, 195.86)
ROWS = (469.0, 496.0)            # the stripe lies in these rows on both cars
DOORWAY = (55.0, 134.5)          # the standing car's open door: seats, not stripe


def mask(work, name, out):
    a = np.asarray(Image.open(work / f'{name}.png').convert('RGBA')).astype(np.float32) / 255
    rgb, al = a[..., :3], a[..., 3]
    mx, mn = rgb.max(2), rgb.min(2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    hue = np.degrees(np.arctan2(np.sqrt(3) * (g - b), 2 * r - g - b)) % 360
    huew = np.clip(1 - np.abs(hue - 216) / 22, 0, 1) ** 0.5
    m = np.clip((sat - 0.08) / 0.32, 0, 1) * huew * (b > r) * np.clip((mx - 0.22) / 0.1, 0, 1)
    m *= al
    rows = np.zeros(a.shape[0], bool)
    rows[int((ROWS[0] - ORIGIN[1]) * 2):int((ROWS[1] - ORIGIN[1]) * 2)] = True
    m[~rows] = 0
    # only the stripe and its rim: what lies within two pixels of its saturated core
    core = (sat > 0.45) & (b > g) & (g > r) & (mx > 0.3) & rows[:, None]
    near = cv2.dilate(core.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    m[~near] = 0
    if name == 'car':
        u0, u1 = DOORWAY
        m[:, int((u0 - ORIGIN[0]) * 2):int((u1 - ORIGIN[0]) * 2)] = 0
    # one pixel softer, so the stripe's anti-aliased rim takes the colour too
    grown = cv2.dilate(m, np.ones((3, 3), np.uint8))
    m = np.maximum(m, grown * 0.55)
    img = np.zeros(a.shape, np.uint8)
    img[..., :3] = 255
    img[..., 3] = np.clip(m * 255, 0, 255).astype(np.uint8)
    Image.fromarray(img).save(out / f'band-{name}.png', optimize=True)
