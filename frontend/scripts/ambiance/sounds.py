"""What the lake under Fuji sounds like: the water at its stone shore,
the pine, the birds of the hours, the temple across the water, the
crickets, and the local line along the shore (plan 219).

Every function here draws one thing, on kit's periodic loop or as a
short event to be placed on it. The hours (hours.py) are mixes of them.
"""
import numpy as np
from kit import SR, lp, hp, bp, peak, filt, env, fade_tail

# ── 湖 the water ───────────────────────────────────────────────────
def bubble(rng, f0, rise=None):
    """One bubble's ring: a sine whose pitch climbs a little as it dies
    (the sound every small splash is made of)."""
    rise = rng.uniform(0.1, 0.35) if rise is None else rise
    d = 0.13 * f0 + 0.0072 * f0 ** 1.5                 # damping, 1/s
    n = int(min(0.15, 7 / d) * SR)
    t = np.arange(n) / SR
    f = f0 * (1 + rise * (1 - np.exp(-d * t)))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-d * t)
    y *= 0.5 - 0.5 * np.cos(np.pi * np.clip(t / 0.003, 0, 1))
    return fade_tail(y, 0.004)


def lap(rng, size=1.0, hollow=0.5):
    """A wavelet against stones: a slosh, a bubble or two, and the
    hollow gulp of water under an overhang."""
    n = int(0.5 * SR)
    y = np.zeros(n)
    # the slosh: dark water turning over, a quarter second
    m = int(rng.uniform(0.16, 0.3) * SR)
    u = np.arange(m) / m
    sl = filt(rng.standard_normal(m), lambda f: bp(f, 140, 650 + 500 * size, 3))[:m]
    sl *= np.sin(np.pi * u ** 0.6) ** 2
    y[:m] += sl * 0.9
    # its lip: a brief, brighter splash
    k = int(rng.uniform(0.03, 0.07) * SR)
    sp = filt(rng.standard_normal(k), lambda f: bp(f, 500, 2000, 3))[:k]
    sp *= np.sin(np.pi * np.arange(k) / k) ** 2
    p0 = int(rng.uniform(0.02, 0.06) * SR)
    y[p0:p0 + k] += sp * 0.35 * size
    for _ in range(int(rng.integers(0, 3))):
        b = bubble(rng, rng.uniform(300, 850))
        p = int(rng.uniform(0.02, 0.15) * SR)
        q = min(len(b), n - p)
        y[p:p + q] += b[:q] * rng.uniform(0.15, 0.4)
    if rng.random() < hollow:
        g = int(0.16 * SR)
        tt = np.arange(g) / SR
        fg = rng.uniform(130, 210)
        gulp = np.sin(2 * np.pi * fg * (1 + 0.5 * tt / 0.16) * tt) * np.exp(-tt / 0.035)
        gulp *= 0.5 - 0.5 * np.cos(np.pi * np.clip(tt / 0.01, 0, 1))
        p = int(rng.uniform(0.03, 0.09) * SR)
        y[p:p + g] += fade_tail(gulp, 0.03) * 0.6
    return fade_tail(y * size, 0.05)


def lake_shore(loop, calm=1.0, groups=(1.6, 4.0), per=(2, 5), hollow=0.5, width=0.7):
    """Wavelets reaching the stone edge in little groups, left to right
    along the shore. `calm` 1 is a still dawn; lower is a breezier day."""
    rng = loop.rng
    t = rng.uniform(0, 1)
    while t < loop.T:
        pan0 = rng.uniform(-width, width)
        size = rng.uniform(0.4, 1.0) * (1.25 - 0.45 * calm)
        for k in range(int(rng.integers(*per))):
            loop.place(lap(rng, size * rng.uniform(0.6, 1.0), hollow) * rng.uniform(0.6, 1.0),
                       t + k * rng.uniform(0.09, 0.32), float(np.clip(pan0 + rng.uniform(-0.2, 0.2), -1, 1)))
        t += rng.uniform(*groups) * (0.7 + 0.6 * calm)
    return loop.out


def lake_wash(loop, breeze=0.5):
    """The open water: a soft, steady seethe of ripples, brighter
    when the breeze is up."""
    g = loop.curve(9, slope=1)

    def shape(off):
        def s(f, tt):
            F = f[None, :]
            a = (0.6 + 0.4 * loop.at(g, tt + off))[:, None]
            return (a * bp(F, 180, 900 + 1400 * breeze, 2) * np.minimum(1, (np.maximum(F, 1) / 300) ** -0.5)).astype(np.float32)
        return s
    return np.stack([loop.tvnoise(shape(0)), loop.tvnoise(shape(3.1))])

# ── 松風 the wind in the pine ───────────────────────────────────────
def pine_wind(loop, strength=1.0, gust_cycles=14, base=0.25, whistle=0.0):
    """Needles turn wind into a soft, high, sea-like rush that rises
    and brightens with each gust; the boughs add a low body."""
    g1 = loop.curve(gust_cycles, slope=0.9)
    g2 = loop.curve(gust_cycles * 2, slope=1.2)

    def shape(off):
        def s(f, tt):
            F = f[None, :]
            g = 0.5 + 0.5 * (0.75 * loop.at(g1, tt + off) + 0.25 * loop.at(g2, tt + off * 1.7))
            g = np.clip(g, 0, 1) ** 1.6
            G = (base + (1 - base) * g)[:, None]
            fc = (420 + 650 * g)[:, None]
            rush = bp(F, fc * 0.55, fc * 2.0, 2) * lp(F, 2600, 1) * G ** 1.3
            body = lp(F, 220, 2) * hp(F, 45, 2) * G * 0.45
            out = rush + body
            if whistle:
                wf = (1500 + 500 * g)[:, None]
                out = out * (1 + whistle * G * (1 / (1 + ((F - wf) / 60) ** 2)))
            return (out * strength).astype(np.float32)
        return s

    L = loop.tvnoise(shape(0.0))
    R = loop.tvnoise(shape(0.35))
    return np.stack([L, R]) * 0.5

# ── 櫓 a fisher sculling at dawn ───────────────────────────────────
def oar_creak(rng, d=None):
    """The oar turning on its pin: stick-slip, a train of tiny
    impacts through the wood's resonances, swelling and easing."""
    d = d or rng.uniform(0.35, 0.55)
    n = int(d * SR)
    t = np.arange(n) / SR
    rate = 70 + 70 * np.sin(np.pi * t / d) + rng.uniform(-8, 8)
    ph = np.cumsum(rate) / SR
    hits = np.zeros(n)
    idx = np.nonzero(np.diff(np.floor(ph)) > 0)[0]
    hits[idx] = (np.sin(np.pi * t[idx] / d) ** 0.7) * rng.uniform(0.6, 1.0, len(idx))
    m = int(0.03 * SR)
    tm = np.arange(m) / SR
    wood = sum(a * np.exp(-tm / 0.006) * np.sin(2 * np.pi * f * tm)
               for f, a in [(620, 1.0), (1080, 0.7), (1730, 0.5), (2650, 0.3)])
    return np.convolve(hits, wood)[:n]


def sculling(loop, t0, strokes=10, period=2.3, pan=(-0.5, 0.2), level=1.0):
    """A boat sculled slowly across the lake: a creak each way of the
    oar, and the water turning off its blade."""
    rng = loop.rng
    for k in range(strokes):
        t = t0 + k * period * rng.uniform(0.95, 1.05)
        p = pan[0] + (pan[1] - pan[0]) * k / max(1, strokes - 1)
        loop.place(oar_creak(rng) * level, t, p)
        loop.place(oar_creak(rng) * level * 0.6, t + period * 0.5, p)
        m = int(0.9 * SR)
        sw = filt(rng.standard_normal(m), lambda f: bp(f, 300, 1500, 2))[:m]
        sw *= np.sin(np.pi * np.arange(m) / m) ** 2
        loop.place(sw * level * 0.35, t + 0.1, p)
    return loop.out

# ── far off: the air between ──────────────────────────────────────
def flutter(rng, n, depth=0.35, rate=5.0):
    """Air between us and a far sound: its loudness shimmering a little
    (turbulence), never a steady tone."""
    k = max(4, int(n / SR * rate * 2))
    pts = rng.standard_normal(k + 3)
    x = np.interp(np.linspace(0, k, n), np.arange(k + 3), pts)
    x = filt(x, lambda f: lp(f, rate, 2))[:n]
    x /= np.abs(x).max() + 1e-9
    return 1 + depth * x


def distant(y, rng, cutoff=3500, depth=0.3):
    """Far away: the highs absorbed, the level wavering in the air."""
    y = filt(y, lambda f: lp(f, cutoff, 2) * hp(f, 250, 1))[: len(y)]
    return y * flutter(rng, len(y), depth)

# ── 鳥 the birds of the hours, all whistlers ───────────────────────
def whistle(f, a, rng, breath=0.06):
    """A bird's whistled note: a near-pure tone on a moving pitch, with
    the faint breath of a real syrinx around it."""
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) + 0.05 * np.sin(2 * ph + 0.7)
    nb = filt(rng.standard_normal(len(f)), lambda ff: lp(ff, 120, 2))[: len(f)]
    nb /= np.abs(nb).max() + 1e-9
    y = y * (1 + breath * nb * 6) * 0.9 + breath * nb * np.sin(ph * 1.003)
    return y * a


def note(d, f0, f1, rng, curve=1.0, attack=0.012, release=0.02):
    n = int(d * SR)
    u = np.linspace(0, 1, n)
    f = f0 + (f1 - f0) * u ** curve
    a = np.minimum(1, np.minimum(u * d / attack, (1 - u) * d / release)) ** 1.5
    return f, a


def tit_song(rng):
    """シジュウカラ, the Japanese tit: ツツピー ツツピー, a high grace
    note and a lower whistled one, three or four times."""
    base = rng.uniform(0.95, 1.05)
    hi_f, lo_f = 6400 * base, 4100 * base
    parts = []
    for k in range(int(rng.integers(3, 5))):
        for (d, f0, f1, gap) in [(0.045, hi_f, hi_f * 0.82, 0.035), (0.045, hi_f, hi_f * 0.82, 0.04),
                                 (0.13, lo_f * 1.04, lo_f * 0.97, 0.13)]:
            f, a = note(d, f0, f1, rng, attack=0.006, release=0.025)
            parts.append(whistle(f, a, rng))
            parts.append(np.zeros(int(gap * rng.uniform(0.9, 1.1) * SR)))
    return np.concatenate(parts)


def kite_call(rng):
    """トンビ: ピーー, then ヒョロロロ, a run of short notes each slurring
    down, the run itself falling and slowing."""
    parts = []
    f, a = note(rng.uniform(0.7, 0.95), 2750, 2950, rng, curve=0.5, attack=0.08, release=0.06)
    f = f * (1 + 0.004 * np.sin(2 * np.pi * 6 * np.arange(len(f)) / SR))
    parts.append(whistle(f, a, rng, breath=0.05))
    parts.append(np.zeros(int(0.07 * SR)))
    m = int(rng.integers(6, 9))
    for k in range(m):
        top = 3050 - 520 * k / m
        d = 0.075 + 0.02 * k / m
        f, a = note(d, top, top * 0.86, rng, curve=0.8, attack=0.01, release=0.03)
        parts.append(whistle(f, a * (1 - 0.45 * k / m), rng, breath=0.05))
        parts.append(np.zeros(int(0.012 * SR)))
    return np.concatenate(parts)


def owl_call(rng):
    """フクロウ, far in the woods: ホーー … ゴロスケ ホッホー, breathy
    low hoots."""
    f0 = rng.uniform(370, 410)
    parts = []
    for (d, r, g, gap) in [(0.55, 1.0, 1.0, 1.1), (0.16, 1.04, 0.7, 0.07), (0.16, 1.0, 0.7, 0.1),
                           (0.2, 0.98, 0.8, 0.15), (0.55, 0.95, 0.9, 0.0)]:
        n = int(d * SR)
        u = np.linspace(0, 1, n)
        f = f0 * r * (1 + 0.035 * np.sin(np.pi * u))
        ph = 2 * np.pi * np.cumsum(f) / SR
        br = filt(rng.standard_normal(n), lambda ff: bp(ff, 250, 1200, 1))[:n]
        y = (np.sin(ph) + 0.12 * np.sin(2 * ph)) * (1 + 0.15 * br) + 0.08 * br
        parts.append(y * np.sin(np.pi * u) ** 1.2 * g)
        parts.append(np.zeros(int(gap * SR)))
    return np.concatenate(parts)

# ── 鐘 the temple bell across the water ────────────────────────────
def temple_bell(rng, f0=98.0, vel=1.0, dur=34.0):
    """A bonshō struck by a wooden beam: a low hum that outlasts
    everything, inharmonic partials over it, each one a close pair
    beating against itself (うなり, the bell's waver)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    parts = [  # ratio, amplitude, decay s, beat Hz
        (0.5, 0.55, 26.0, 0.18), (1.0, 1.0, 16.0, 0.42), (1.18, 0.5, 11.0, 0.7),
        (1.51, 0.45, 9.0, 0.9), (2.0, 0.4, 7.0, 1.1), (2.74, 0.35, 4.5, 1.6),
        (3.42, 0.22, 3.2, 2.1), (4.18, 0.16, 2.2, 2.5), (5.33, 0.1, 1.5, 3.0),
        (6.6, 0.06, 1.0, 3.4)]
    y = np.zeros(n)
    for r, a, tau, beat in parts:
        f = f0 * r
        ph = rng.uniform(0, 6.28)
        pair = np.sin(2 * np.pi * f * t + ph) + 0.8 * np.sin(2 * np.pi * (f + beat) * t + ph * 1.3)
        y += a * np.exp(-t / tau) * pair
    y *= np.clip(t / 0.004, 0, 1)
    thud = filt(rng.standard_normal(int(0.25 * SR)), lambda f: lp(f, 260, 2))[: int(0.25 * SR)]
    thud *= np.exp(-np.arange(len(thud)) / SR / 0.05)
    y[:len(thud)] += 1.2 * thud
    return fade_tail(y * vel, 2.0)

# ── 虫の音 the autumn night ──────────────────────────────────────────
def suzumushi(rng, dur, f0=4300.0):
    """The bell cricket's ri-i-i-n: a pure, high tone in fast pulses."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    pr = rng.uniform(32, 42)
    pulses = (0.5 + 0.5 * np.sin(2 * np.pi * pr * t)) ** 3
    shape = env(n, 0.04, dur * 0.7) * np.clip((dur - t) / 0.05, 0, 1)
    f = f0 * (1 - 0.01 * t / dur)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * pulses * shape
    return y


def matsumushi(rng, f0=3300.0):
    """The pine cricket's chin-chirorin: two clear chirps and a trill."""
    def chirp(d, g):
        u = np.arange(int(d * SR)) / (d * SR)
        return g * np.sin(np.pi * u) ** 2
    trill_n = int(0.32 * SR)
    tt = np.arange(trill_n) / SR
    trill = (0.5 - 0.5 * np.cos(2 * np.pi * 26 * tt)) ** 2 * 0.8 * np.sin(np.pi * tt / 0.32) ** 0.5
    a = np.concatenate([chirp(0.07, 1.0), np.zeros(int(0.04 * SR)), chirp(0.07, 0.9),
                        np.zeros(int(0.08 * SR)), trill])
    n = len(a)
    t = np.arange(n) / SR
    y = a * np.sin(2 * np.pi * f0 * t + 0.4 * np.sin(2 * np.pi * 26 * t))
    return y


def night_insects(loop, density=1.0, suzu=4, matsu=2, bout=(6, 16), rest=(3, 9), matsu_gap=(2.5, 9)):
    """A chorus of bell crickets at their own pitches and distances,
    singing in bouts (`bout` s long, `rest` s apart), and a pine
    cricket now and then (`matsu_gap` s apart, or a long silence)."""
    rng = loop.rng
    T = loop.T
    for k in range(suzu):
        f0 = rng.uniform(3900, 4700)
        pan = rng.uniform(-0.9, 0.9)
        dist = rng.uniform(0.35, 1.0)
        t = rng.uniform(0, 4)
        while t < T:
            end = t + rng.uniform(*bout)
            while t < end:
                d = rng.uniform(0.5, 1.3)
                loop.place(suzumushi(rng, d, f0) * dist * 0.5 * density, t, pan)
                t += d + rng.uniform(0.25, 0.6)
            t += rng.uniform(*rest)
    for k in range(matsu):
        f0 = rng.uniform(3000, 3600)
        pan = rng.uniform(-0.8, 0.8)
        t = rng.uniform(0, 10)
        while t < T:
            loop.place(matsumushi(rng, f0) * 0.4 * density, t, pan)
            t += rng.uniform(*matsu_gap) if rng.random() < 0.7 else rng.uniform(12, 25)
    return loop.out

# ── 踏切 the level crossing down the shore ──────────────────────────
def crossing_bell(rng, f0=784.0):
    """One strike of a level crossing's bell, heard down the shore: a
    struck plate's inharmonic ring, a hard little hammer."""
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    y = sum(a * np.exp(-t / tau) * np.sin(2 * np.pi * f0 * r * t + rng.uniform(0, 6))
            for r, a, tau in [(1.0, 1.0, 0.16), (1.47, 0.35, 0.1), (2.09, 0.45, 0.07),
                              (2.76, 0.3, 0.05), (3.9, 0.15, 0.03)])
    k = int(0.004 * SR)
    y[:k] += filt(rng.standard_normal(k), lambda f: bp(f, 1500, 6000, 2))[:k] * 0.6
    return fade_tail(y * np.clip(t / 0.0007, 0, 1), 0.05)


def crossing(loop, t_on, t_off, pan=0.3, rate=1.85):
    rng = loop.rng
    t = t_on
    while t < t_off:
        g = np.clip((t - t_on) / 0.6, 0, 1) * np.clip((t_off - t) / 0.6, 0, 1)
        loop.place(crossing_bell(rng) * (0.25 + 0.75 * g) * rng.uniform(0.92, 1.0), t, pan)
        t += 1 / rate * rng.uniform(0.98, 1.02)
    return loop.out

# ── 電車 the local train along the lake ─────────────────────────────
def train_pass(loop, t_mid, cars=2, speed=14.0, dist=90.0, direction=1):
    """A short local train going by along the far side of the shore
    road. What carries that far: the steel wheels' rolling hiss and
    roar, swelling and fading with distance, its highs only when
    close; a low body; and the joints, a soft タタン…タタン, the
    sound most people know a train by. Returns (roll, joints)."""
    rng = loop.rng
    T = loop.T
    half = 32.0

    def at(d):
        x = speed * d
        r = np.sqrt(x * x + dist * dist)
        return x, r

    def shape(side):
        def s(f, tt):
            d = (tt - t_mid + T / 2) % T - T / 2
            x, r = at(d)
            near = (dist / r) ** 2 * np.clip((half - np.abs(d)) / 6, 0, 1)
            pan = np.clip(direction * x / (dist * 1.2), -1, 1)
            g = np.sqrt(0.5 * (1 + side * pan))
            F = f[None, :]
            top = (700 + 2300 * near)[:, None]               # air absorbs the highs of far
            roll = bp(F, 280, top, 2) * peak(F, 900, 1.2, 1.6)
            body = lp(F, 160, 2) * hp(F, 40, 2) * 0.8
            return ((near * g)[:, None] * (roll + body)).astype(np.float32)
        return s
    roll = np.stack([loop.tvnoise(shape(-1)), loop.tvnoise(shape(+1))])

    joint, car, bogie, axle = 25.0, 20.0, 13.8, 2.1
    joints = []
    offs = []
    for c in range(cars):
        offs += [c * car + 3.1, c * car + 3.1 + axle, c * car + 3.1 + bogie, c * car + 3.1 + bogie + axle]
    for j in range(-30, 31):
        for o in offs:
            d = (j * joint + o) / speed
            if abs(d) > half - 4:
                continue
            x, r = at(d)
            near = (dist / r) ** 2
            m = int(0.06 * SR)
            th = filt(rng.standard_normal(m), lambda f: bp(f, 110, 500 + 1300 * near, 2))[:m]
            th *= np.exp(-np.arange(m) / SR / 0.011) * (0.5 - 0.5 * np.cos(np.pi * np.clip(np.arange(m) / SR / 0.002, 0, 1)))
            joints.append((t_mid + d, fade_tail(th, 0.01) * near * rng.uniform(0.7, 1.0),
                           float(np.clip(direction * x / (dist * 1.2), -1, 1))))
    return roll, joints
