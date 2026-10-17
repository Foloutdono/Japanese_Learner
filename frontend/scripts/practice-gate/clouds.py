"""雲 — the clouds, lifted off the sky so they drift (plan 225).

Each hour's scene is split in two: the sky without its clouds (the bg
layer) and the clouds alone (the clouds layer), whose alpha and colour
are solved from the two so that, laid over the sky at rest, they give
back the scene to the pixel. The app moves the clouds a few units left
and right behind the sky's own mask (`sky.png`): the canopy, its lamps,
the clock's rod, the wires and the land stay in front.

Past the sky's edge (behind the wires, under the land, beyond the
pillars) the clouds are carried on by inpainting, as far as they drift,
so a cloud never shows the shape of what hid it.

Layers are 2 px to a unit; the clouds and the mask are the scene's rows
`rows` (the sky and the drift's margin), at the scene's full width."""
import numpy as np
import cv2

from parts import lum, sat

K = 0.2           # the colour difference read as a cloud whole
DRIFT = 46        # px past the sky the clouds are carried (the drift is 14 units, 28 px)
EDGE = (27.0, 363.0)   # units: the sky's columns clear of the pillars' painted edges
LOW = 5.0         # units above the land's line (Fuji's snow, the trees) no cloud is read
TOP = 64.0        # units: above it the lamps' halo and the clock's rod, never a cloud


def mask(M):
    """The sky, softened by a pixel: where a cloud may show."""
    sky = M['sky'].astype(np.float32)
    return np.clip(cv2.GaussianBlur(sky, (0, 0), 0.7), 0, 1)


def zone(M):
    """Where a cloud is read, softened by a pixel: the sky clear of the
    pillars' edges, the lamps' halo and the land's line, whose light
    parts (Fuji's snow) would otherwise be taken for clouds and carried
    off."""
    sky = M['sky']
    H, W = sky.shape
    z = sky.copy()
    z[:, :int(EDGE[0] * 2)] = False
    z[:, int(EDGE[1] * 2):] = False
    z[:int(TOP * 2)] = False
    z &= np.arange(H)[:, None] < (M['horizon'][None, :] - LOW * 2)
    return z, np.clip(cv2.GaussianBlur(z.astype(np.float32), (0, 0), 1.0), 0, 1) * sky


def rows(M):
    ys = np.nonzero(M['sky'].any(axis=1))[0]
    H = M['sky'].shape[0]
    return max(0, ys.min() - DRIFT), min(H, ys.max() + 1 + DRIFT)


def day_clear(rgb, M):
    """The painting's sky without its clouds: each cloud's place filled
    from the clear sky round it, smoothly (the sky is a gradient)."""
    sky = M['sky']
    L, S = lum(rgb), sat(rgb)
    Lsky = np.where(sky, L, np.nan)
    with np.errstate(all='ignore'):
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter('ignore')
            Lb = np.nanpercentile(Lsky, 22, axis=1)
    Lb = np.where(np.isnan(Lb), np.nanmean(Lb), Lb)
    Lb = cv2.GaussianBlur(Lb.reshape(-1, 1).astype(np.float32), (0, 0), 6).ravel()
    cloud = np.clip((L - Lb[:, None] - 0.012) / 0.2, 0, 1) * sky * np.clip((S < 0.3) + 0.3, 0, 1)
    hole = cv2.dilate((cloud > 0.02).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    hole &= zone(M)[0]
    r0, r1 = rows(M)
    h = rgb[r0:r1].astype(np.float32).copy()
    hl, w = hole[r0:r1], sky[r0:r1].astype(np.float32)
    # a first guess, each row's clear sky; then the membrane, over sky neighbours only
    for y in range(h.shape[0]):
        clear = sky[r0 + y] & ~hole[r0 + y]
        if hl[y].any():
            h[y, hl[y]] = h[y, clear].mean(axis=0) if clear.any() else h[y, hl[y]].mean(axis=0)
    hw = h * w[..., None]
    den = np.roll(w, 1, 0) + np.roll(w, -1, 0) + np.roll(w, 1, 1) + np.roll(w, -1, 1)
    den = np.maximum(den, 1e-6)[..., None]
    for _ in range(2500):
        num = np.roll(hw, 1, 0) + np.roll(hw, -1, 0) + np.roll(hw, 1, 1) + np.roll(hw, -1, 1)
        h[hl] = (num / den)[hl]
        hw = h * w[..., None]
    out = rgb.copy()
    out[r0:r1][hl] = h[hl]
    return out


def split(lit, clear, m, M):
    """The sky they drift over, and the clouds that, over it behind the
    mask `m`, give back `lit`: their colour and alpha, at the scene's full
    size. Outside the zone the sky keeps what `lit` has."""
    z = zone(M)[1][..., None]
    clear = clear * z + lit * (1 - z)
    d = lit - clear
    mag = np.abs(d).max(axis=-1)
    inside = (m > 0.02) & (z[..., 0] > 0.02)
    a = np.clip(mag / K, 0, 1) * inside
    s = np.where(inside, np.clip(a / np.maximum(m, 1e-3), 0, 1), 0).astype(np.float32)
    shown = np.maximum(s * m, 1e-3)[..., None]
    col = np.where((s > 0)[..., None], np.clip(clear + d / shown, 0, 1), clear).astype(np.float32)
    # carried on past the sky, as far as they drift: premultiplied, inpainted
    reach = cv2.dilate(M['sky'].astype(np.uint8), np.ones((2 * DRIFT + 1, 2 * DRIFT + 1), np.uint8)) > 0
    hole = (reach & ~inside).astype(np.uint8) * 255
    pre = np.clip(col * s[..., None] * 255 + 0.5, 0, 255).astype(np.uint8)
    al = np.clip(s * 255 + 0.5, 0, 255).astype(np.uint8)
    pre = cv2.inpaint(pre, hole, 6, cv2.INPAINT_TELEA).astype(np.float32) / 255
    s2 = cv2.inpaint(al, hole, 6, cv2.INPAINT_TELEA).astype(np.float32) / 255
    s2 = np.where(inside, s, s2 * reach)
    col2 = np.where((s2 > 1e-3)[..., None], np.clip(pre / np.maximum(s2, 1e-3)[..., None], 0, 1), col)
    col2[inside] = col[inside]
    return clear, col2, s2
