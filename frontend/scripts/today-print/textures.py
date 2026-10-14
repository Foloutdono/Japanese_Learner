"""The print's two textures, made once as tiles instead of computed by
an SVG filter on every frame: the wood grain the sky was printed from
(木目), long soft streaks that waver; and the paper's fibre, a fine
speckle over the whole print. Both seamless, both white at a few
percent. A filter here cost the desk a third of its frame time; a
tiled image costs next to nothing."""
import base64
import io
import numpy as np
from PIL import Image


def _blur_periodic(a, sx, sy):
    fy = np.fft.fftfreq(a.shape[0])[:, None]
    fx = np.fft.fftfreq(a.shape[1])[None, :]
    g = np.exp(-2 * np.pi ** 2 * ((fx * sx) ** 2 + (fy * sy) ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g))


def _png(alpha, rgb):
    h, w = alpha.shape
    im = Image.new('RGBA', (w, h), rgb + (0,))
    im.putalpha(Image.fromarray(alpha.astype(np.uint8), 'L'))
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def grain(w=640, h=120, seed=3, peak=0.058):
    """The sky's wood grain: streaks along the board, soft-edged, of
    uneven length, wavering a little; only the lighter half shows."""
    rng = np.random.default_rng(seed)
    s = _blur_periodic(rng.standard_normal((h, w)), sx=30, sy=1.7)
    # waver: each column slid up or down along a slow wave (whole
    # periods across the tile, so it stays seamless)
    x = np.arange(w)
    shift = np.round(2.2 * np.sin(2 * np.pi * x / w * 2) + 1.3 * np.sin(2 * np.pi * x / w * 5 + 1.1)).astype(int)
    s = np.stack([np.roll(s[:, i], shift[i]) for i in range(w)], axis=1)
    lo, hi = np.percentile(s, 50), np.percentile(s, 99.5)
    a = np.clip((s - lo) / (hi - lo), 0, 1) ** 1.4
    return _png(a * peak * 255, (255, 248, 236))


def paper(n=256, seed=7, peak=0.07):
    """The paper's fibre: a fine speckle, a hair softened."""
    rng = np.random.default_rng(seed)
    s = _blur_periodic(rng.random((n, n)), sx=0.55, sy=0.55)
    lo, hi = np.percentile(s, 2), np.percentile(s, 99.8)
    a = np.clip((s - lo) / (hi - lo), 0, 1)
    return _png(a * peak * 255, (255, 245, 230))


_CACHE = {}


def defs(prefix):
    """<pattern>s for the two textures: the grain in the print's own
    units, the paper at twice its pixel density so it stays fine on a
    2x screen."""
    if 'g' not in _CACHE:
        _CACHE['g'], _CACHE['p'] = grain(), paper()
    return (f'<pattern id="{prefix}Grain" patternUnits="userSpaceOnUse" width="640" height="120">'
            f'<image href="{_CACHE["g"]}" width="640" height="120" preserveAspectRatio="none"></image></pattern>'
            f'<pattern id="{prefix}Paper" patternUnits="userSpaceOnUse" width="128" height="128">'
            f'<image href="{_CACHE["p"]}" width="128" height="128" preserveAspectRatio="none"></image></pattern>')


if __name__ == '__main__':
    g, p = grain(), paper()
    print(len(g) // 1024, 'KB grain;', len(p) // 1024, 'KB paper')
