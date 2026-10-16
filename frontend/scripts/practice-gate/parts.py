"""The scene's parts as masks on the day's layers (plan 223), so each hour can
light them on their own: the sky and its clouds, the land under it (Fuji's
snow, the mountains, the forest), the canopy and its two lamps, the wires,
the platform and its tactile strip; on the cars, their body, glass, lit
inside, the far window seen through the open door, the roof and the
underframe.

Layers are 2 px to a unit. bg / near: the gate (390 x 724). car / car2: the
tile (340.71 x 360.17) whose origin is (24.65, 195.86)."""
import numpy as np
import cv2
from PIL import Image

ORIGIN = (24.65, 195.86)
# Fuji's outline and the far hills' line to its left, traced on the painting (u, v)
HORIZON = [(0, 291.5), (60, 291), (100, 292), (130, 291.5), (140, 291), (150, 288.5), (158, 285.2),
           (166, 283.2), (174, 283.6), (182, 283.2), (190, 280.3), (200, 276.5), (210, 271.8), (220, 266.8),
           (230, 262.0), (240, 256.6), (250, 248.6), (258, 241.9), (266, 235.2), (272, 230.2), (276, 226.4),
           (280, 225.2), (288, 224.8), (294, 225.4), (298, 227.6), (305, 232.8), (312, 238.2), (320, 243.8),
           (330, 249.6), (340, 255.0), (350, 260.4), (360, 265.6), (366, 268.6), (390, 281.0)]
FUJI_FROM = 163.0
LAMPS = ((63, 161), (228, 323))
# windows (glass) and the open doorway, by hand on each car layer: (u0, v0, u1, v1)
GLASS = {'car': [(24.65, 377.0, 37.6, 465.0), (359.4, 377.0, 365.5, 465.0)],
         'car2': [(38.0, 379.0, 63.2, 462.0), (76.4, 379.0, 101.2, 462.0), (356.8, 377.0, 365.5, 463.5)]}
DOORWAY = {'car': (50.8, 360.6, 136.2, 549.0)}
FAR_WINDOW = {'car': (97.0, 402.0, 133.5, 453.5)}


def load(work, name):
    return np.asarray(Image.open(work / f'{name}.png').convert('RGBA')).astype(np.float32) / 255


def lum(rgb):
    return rgb[..., 0] * 0.3 + rgb[..., 1] * 0.59 + rgb[..., 2] * 0.11


def sat(rgb):
    mx, mn = rgb.max(-1), rgb.min(-1)
    return np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0)


def _rows(shape, v0, v1):
    m = np.zeros(shape[:2], bool)
    m[int(v0 * 2):int(v1 * 2)] = True
    return m


def _cols(shape, u0, u1):
    m = np.zeros(shape[:2], bool)
    m[:, int(u0 * 2):int(u1 * 2)] = True
    return m


def scene(work):
    a = load(work, 'bg')
    rgb = a[..., :3]
    H, W = rgb.shape[:2]
    L, S = lum(rgb), sat(rgb)
    inner = _cols(a.shape, 24.6, 365.4)
    hu = np.array([p[0] for p in HORIZON], np.float32) * 2
    hv = np.array([p[1] for p in HORIZON], np.float32) * 2
    h = np.interp(np.arange(W), hu, hv)
    sky_like = ((rgb[..., 2] - rgb[..., 0] > 0.17) & (L > 0.62)) | ((L > 0.86) & (S < 0.12))
    yy = np.arange(H)[:, None]
    land = (yy >= h[None, :]) & _rows(a.shape, 0, 330) & inner
    sky = (yy < h[None, :]) & _rows(a.shape, 46, 330) & inner
    # the two lamps and the canopy (with the clock's rod)
    canopy = _rows(a.shape, 0, 46) & inner
    lamp_box = np.zeros((H, W), bool)
    for u0, u1 in LAMPS:
        lamp_box[int(45 * 2):int(57.5 * 2), int(u0 * 2):int(u1 * 2)] = True
    tube = lamp_box & (L > 0.82)
    housing = lamp_box & ~tube & (L < 0.62)
    rod = np.zeros((H, W), bool)
    rod[int(36 * 2):int(64 * 2), int(336.5 * 2):int(345 * 2)] = True
    rod &= (L < 0.5)
    canopy |= housing | rod
    sky &= ~(tube | housing | rod)
    # the wires (catenary): what is not sky, in their band
    wires = _rows(a.shape, 180, 198) & inner & ~sky_like & ~land
    sky &= ~wires
    clouds = sky & (S < 0.16) & (L > 0.78)
    platform = _rows(a.shape, 556, 724) & inner
    # the tactile strip: its yellow (saturated), not the sun's warm patches beside it
    tactile = platform & _rows(a.shape, 602, 633) & (rgb[..., 0] > rgb[..., 2] + 0.12) & (S > 0.3)
    tactile = cv2.morphologyEx(tactile.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0
    # the land's kinds: Fuji's snow (inside its outline, white), the mountains (blue), the forest
    u = np.arange(W)[None, :] / 2
    v = np.arange(H)[:, None] / 2
    snow = land & (u >= FUJI_FROM) & (v < 292) & (L > 0.78) & (S < 0.22)
    mount = land & ~snow & (v < 296) & (rgb[..., 2] > rgb[..., 1] + 0.02) & (rgb[..., 1] > rgb[..., 0])
    forest = land & ~snow & ~mount
    return a, dict(sky=sky, clouds=clouds, land=land, snow=snow, mount=mount, forest=forest, canopy=canopy,
                   tube=tube, wires=wires, platform=platform, tactile=tactile, horizon=h)


def car(work, name):
    a = load(work, name)
    rgb, al = a[..., :3], a[..., 3]
    H, W = rgb.shape[:2]
    L = lum(rgb)
    v = np.arange(H)[:, None] / 2 + ORIGIN[1]
    u = np.arange(W)[None, :] / 2 + ORIGIN[0]
    on = al > 0.02

    def box(b):
        u0, v0, u1, v1 = b
        return (u >= u0) & (u <= u1) & (v >= v0) & (v <= v1)

    roof = on & (v < 329.5)
    under = on & (v > 549.0)
    side = on & ~roof & ~under
    glass = np.zeros((H, W), bool)
    for b in GLASS[name]:
        glass |= box(b)
    glass &= side & (L < 0.62)
    inside = (box(DOORWAY[name]) & side) if name in DOORWAY else np.zeros((H, W), bool)
    far = (box(FAR_WINDOW[name]) & inside & (rgb[..., 2] > rgb[..., 0] + 0.04)) if name in FAR_WINDOW else np.zeros((H, W), bool)
    body = side & ~glass & ~inside
    return a, dict(roof=roof, under=under, glass=glass, inside=inside, far=far, body=body)
