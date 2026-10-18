"""A small periodic synthesis kit for looping ambiance.

Everything here is built on a buffer of exactly N samples that is
treated as a circle: noise is shaped frame by frame with circular
overlap-add, events are added modulo N, filters and the reverb are
circular convolutions done in the frequency domain, and every slow
control curve has a whole number of cycles per loop. So the last
sample runs into the first as if the buffer had no ends: the loop has
no seam to hide, rather than a crossfade hiding one.
"""
import numpy as np

SR = 48000


class Loop:
    def __init__(self, seconds, seed):
        self.N = int(round(seconds * SR))
        self.T = seconds
        self.rng = np.random.default_rng(seed)
        self.out = np.zeros((2, self.N))

    # ── slow curves ─────────────────────────────────────────────
    def curve(self, max_cycles, slope=1.0, rate=200):
        """A smooth periodic random curve in about [-1, 1], sampled at
        `rate` Hz over the loop (whole cycles only, so it wraps)."""
        n = int(self.T * rate)
        spec = np.zeros(n // 2 + 1, complex)
        k = np.arange(1, max_cycles + 1)
        spec[1:max_cycles + 1] = (self.rng.standard_normal(max_cycles)
                                  + 1j * self.rng.standard_normal(max_cycles)) / k ** slope
        c = np.fft.irfft(spec, n)
        return c / (np.abs(c).max() + 1e-12)

    def at(self, curve, times):
        """Read a curve (periodic, sampled over the loop) at times in s."""
        n = len(curve)
        x = (np.asarray(times) / self.T * n) % n
        i = np.floor(x).astype(int)
        f = x - i
        return curve[i] * (1 - f) + curve[(i + 1) % n] * f

    # ── shaped noise ────────────────────────────────────────────
    def tvnoise(self, shape, nfft=2048):
        """Noise whose spectrum is `shape(freqs, times)` -> (frames, bins)
        magnitude, synthesised by circular overlap-add. Returns mono."""
        hop = nfft // 4
        frames = self.N // hop
        assert frames * hop == self.N, 'loop length must be a multiple of the hop'
        f = np.fft.rfftfreq(nfft, 1 / SR)
        t = (np.arange(frames) * hop + nfft / 2) / SR % self.T
        mag = shape(f, t).astype(np.float32)
        ph = self.rng.standard_normal((frames, len(f))) + 1j * self.rng.standard_normal((frames, len(f)))
        X = (mag * ph).astype(np.complex64)
        win = np.hanning(nfft + 1)[:-1].astype(np.float32)
        y = np.zeros(self.N + nfft, np.float32)
        chunk = 512
        for s in range(0, frames, chunk):
            blk = np.fft.irfft(X[s:s + chunk], nfft, axis=1) * win
            for j in range(blk.shape[0]):
                p = (s + j) * hop
                y[p:p + nfft] += blk[j]
        y[:nfft] += y[self.N:self.N + nfft]
        y = y[:self.N]
        # a flat spectrum of 1 comes out at unit standard deviation:
        # each frame's variance is 4 * bins / nfft^2, and hann^2 at a
        # quarter hop sums to 1.5
        return y * np.sqrt(nfft * nfft / (4 * (len(f)) * 1.5))

    # ── events ──────────────────────────────────────────────────
    def place(self, ev, t0, pan=0.0, gain=1.0, width=None):
        """Add a mono (or stereo) event at t0 seconds, wrapping round."""
        ev = np.asarray(ev)
        if ev.ndim == 1:
            a = (pan + 1) * np.pi / 4
            ev = np.stack([ev * np.cos(a), ev * np.sin(a)]) * np.sqrt(2)
        p = int(round(t0 * SR)) % self.N
        n = ev.shape[1]
        idx = (np.arange(n) + p) % self.N
        np.add.at(self.out[0], idx, ev[0] * gain)
        np.add.at(self.out[1], idx, ev[1] * gain)


# ── filters (zero phase, in the frequency domain) ───────────────
def lp(f, fc, order=2):
    return 1 / np.sqrt(1 + (np.maximum(f, 1e-6) / fc) ** (2 * order))


def hp(f, fc, order=2):
    return 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-6)) ** (2 * order))


def bp(f, lo, hi, order=2):
    return lp(f, hi, order) * hp(f, lo, order)


def peak(f, fc, q, g):
    """A resonance of gain g (linear, >1 boosts) at fc."""
    x = (f - fc) / (fc / q)
    return 1 + (g - 1) / (1 + x * x)


def filt(x, H, circular=False):
    """Filter a signal by a magnitude response H(f). An event (not
    circular) is padded so its tail is not folded onto its head."""
    x = np.asarray(x)
    n = x.shape[-1] if circular else x.shape[-1] + SR // 2
    X = np.fft.rfft(x, n)
    y = np.fft.irfft(X * H(np.fft.rfftfreq(n, 1 / SR)), n)
    return y


def env(n, attack, decay, curve=1.0):
    """Exponential decay after a raised-cosine attack, n samples."""
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    a = 0.5 - 0.5 * np.cos(np.pi * a)
    d = np.exp(-np.maximum(t - attack, 0) / decay)
    return a * d ** curve


def fade_tail(x, sec=0.05):
    n = min(int(sec * SR), x.shape[-1])
    w = np.ones(x.shape[-1])
    w[-n:] = np.linspace(1, 0, n)
    return x * w


# ── the room ────────────────────────────────────────────────────
def reverb(loop, x, rt60=2.4, pre=0.02, hf=0.45, seed=7, bright=6000):
    """A circular convolution with a synthetic hall, stereo in and out.
    `hf`: how much faster the highs die (0 none, 1 twice as fast)."""
    rng = np.random.default_rng(seed)
    n_ir = int((rt60 * 1.1 + pre) * SR)
    t = np.arange(n_ir) / SR
    out = []
    for ch in range(2):
        nz = rng.standard_normal(n_ir)
        lo = filt(nz, lambda f: lp(f, 900, 1))[:n_ir]
        mid = filt(nz, lambda f: bp(f, 900, 4000, 1))[:n_ir]
        hi = filt(nz, lambda f: hp(f, 4000, 1) * lp(f, bright, 1))[:n_ir]
        dec = lambda r: np.exp(-6.9 * t / (rt60 * r))
        ir = lo * dec(1.0) + mid * dec(1 - hf * 0.5) + hi * dec(1 - hf)
        ir *= np.clip((t - pre) / 0.004, 0, 1)
        ir /= np.sqrt((ir ** 2).sum())
        out.append(ir)
    N = loop.N
    y = np.zeros((2, N))
    for ch in range(2):
        X = np.fft.rfft(x[ch], N)
        H = np.fft.rfft(out[ch], N)
        y[ch] = np.fft.irfft(X * H, N)
    return y


# ── mastering ───────────────────────────────────────────────────
def circular_filter(stereo, H):
    return np.stack([filt(c, H, circular=True) for c in stereo])


def level(x, db, pct=95, win=0.4):
    """Scale a layer so its loud moments (the pct-th percentile of its
    short-term RMS) sit at `db` dBFS. Sparse layers are judged by their
    events, not by the silence between them."""
    n = int(win * SR)
    m = (x ** 2).mean(0)
    k = len(m) // n
    r = np.sqrt(m[:k * n].reshape(k, n).mean(1))
    if r.max() == 0:
        return x
    active = r[r > r.max() * 0.1]          # its events, not the air between
    ref = np.percentile(active, pct) + 1e-12
    return x * (10 ** (db / 20) / ref)


def soft_limit(x, ceiling=0.7):
    return ceiling * np.tanh(x / ceiling)
