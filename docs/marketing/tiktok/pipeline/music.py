"""An original backing track for the promo, synthesized from scratch.

128 BPM, D major. Intro (2 bars, filtered, a riser) -> drop on bar 2 ->
the 王道進行 (IV-V-iii-vi: G maj7, A7, F#m7, Bm7) looping under a
koto-like pluck (Karplus-Strong) in the major pentatonic, FM electric
piano chords, a sub bass and a light kit -> resolution on D at bar 24.
"""
import numpy as np, sys, json, os
AUD = os.path.join(os.environ.get('FILM_DIR', '/tmp/tsuji-film'), 'audio'); os.makedirs(AUD, exist_ok=True)
from scipy.signal import lfilter, butter, sosfilt, fftconvolve
SR = 48000; BPM = 128; BEAT = 60 / BPM; BAR = 4 * BEAT; STEP = BEAT / 4
BARS = 28; TAIL = 2.5
N = int((BARS * BAR + TAIL) * SR)
rng = np.random.default_rng(11)
def hz(n):  # note name -> Hz
    names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    p, o = n[:-1], int(n[-1]); return 440 * 2 ** ((names[p] + 12 * (o + 1) - 69) / 12)
def buf(): return np.zeros((N, 2))
def at(t): return int(round(t * SR))
def place(dst, x, t, gain=1.0, pan=0.0):
    i = at(t); x = np.asarray(x)
    if x.ndim == 1: x = np.stack([x * np.sqrt(0.5 * (1 - pan)), x * np.sqrt(0.5 * (1 + pan))], 1) * np.sqrt(2)
    j = min(N, i + len(x)); dst[i:j] += gain * x[:j - i]
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x, axis=0)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x, axis=0)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x, axis=0)

# ── instruments ────────────────────────────────────────────
def ep(f, dur=1.6, vel=1.0):  # FM electric piano
    t = np.arange(int(dur * SR)) / SR
    I = 1.7 * np.exp(-t / 0.25) * vel + 0.25
    y = np.sin(2 * np.pi * f * t + I * np.sin(2 * np.pi * f * t))
    y += 0.12 * np.exp(-t / 0.04) * np.sin(2 * np.pi * f * 14 * t)          # tine
    env = np.minimum(1, t / 0.004) * np.exp(-t / (0.9 * (220 / f) ** 0.3))
    rel = np.minimum(1, (dur - t) / 0.08)
    return y * env * rel * vel
def koto(f, dur=1.4, vel=1.0, bright=0.5):  # Karplus-Strong pluck
    L = int(SR / f); n = int(dur * SR)
    exc = rng.uniform(-1, 1, L); exc = lfilter([bright, 1 - bright], [1], exc)
    x = np.zeros(n); x[:L] = exc
    g = 0.996 ** (440 / f) ** 0.15
    a = np.zeros(L + 2); a[0] = 1; a[L] = -g / 2; a[L + 1] = -g / 2
    y = lfilter([1], a, x)
    y = hp(y, 120)
    return y / (np.max(np.abs(y)) + 1e-9) * vel * np.minimum(1, (dur - np.arange(n) / SR) / 0.05)
def bass(f, dur, vel=1.0):
    t = np.arange(int(dur * SR)) / SR
    y = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t) + 0.08 * np.sin(6 * np.pi * f * t)
    env = np.minimum(1, t / 0.006) * np.exp(-t / 0.45) * np.minimum(1, (dur - t) / 0.03)
    return np.tanh(1.4 * y * env) * vel
def kick(vel=1.0):
    t = np.arange(int(0.45 * SR)) / SR
    f = 46 + 110 * np.exp(-t / 0.035)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    y += 0.25 * np.exp(-t / 0.004) * rng.uniform(-1, 1, len(t))
    return np.tanh(1.6 * y) * vel
def snare(vel=1.0):
    t = np.arange(int(0.32 * SR)) / SR
    nz = bp(rng.uniform(-1, 1, len(t)), 900, 9000) * np.exp(-t / 0.075)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05)
    clap = sum(np.roll(bp(rng.uniform(-1, 1, len(t)), 1000, 4000) * np.exp(-t / 0.012), int(k * 0.009 * SR)) for k in range(3))
    return (0.9 * nz + 0.5 * tone + 0.6 * clap) * vel
def hat(open_=False, vel=1.0):
    d = 0.32 if open_ else 0.05
    t = np.arange(int(d * SR)) / SR
    return hp(rng.uniform(-1, 1, len(t)), 7000, 4) * np.exp(-t / (0.12 if open_ else 0.014)) * vel
def crash(vel=1.0):
    t = np.arange(int(2.6 * SR)) / SR
    return hp(rng.uniform(-1, 1, (len(t), 2)), 4500, 2) * np.exp(-t / 0.7)[:, None] * vel
def boom(vel=1.0):
    t = np.arange(int(1.4 * SR)) / SR
    return np.sin(2 * np.pi * np.cumsum(38 + 30 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.5) * vel
def riser(dur):
    n = int(dur * SR); t = np.arange(n) / SR; x = rng.uniform(-1, 1, n); out = np.zeros(n)
    seg = 2048
    for i in range(0, n, seg):
        fc = 300 * (40 ** (i / n)); out[i:i + seg] = bp(x[max(0, i - 4096):i + seg], fc * 0.7, min(fc * 1.4, 20000))[-len(out[i:i + seg]):]
    return out * (t / dur) ** 2.2
def whoosh(dur=0.42):  # a fast sweep that peaks at its end: lands on the cut
    n = int(dur * SR); t = np.arange(n) / SR; x = rng.uniform(-1, 1, n); out = np.zeros(n); seg = 1024
    for i in range(0, n, seg):
        fc = 600 * (12 ** (i / n)); out[i:i + seg] = bp(x[max(0, i - 4096):i + seg], fc * 0.6, min(fc * 1.6, 20000))[-len(out[i:i + seg]):]
    env = (t / dur) ** 2.5 * np.minimum(1, (dur - t) / 0.03)
    return out * env

CH = {'Gmaj7': ['G3', 'B3', 'D4', 'F#4'], 'A7': ['A3', 'C#4', 'E4', 'G4'], 'F#m7': ['F#3', 'A3', 'C#4', 'E4'],
      'Bm7': ['B3', 'D4', 'F#4', 'A4'], 'Em7': ['E3', 'G3', 'B3', 'D4'], 'A7sus': ['A3', 'D4', 'E4', 'G4'], 'Dmaj9': ['D3', 'F#3', 'A3', 'C#4', 'E4']}
ROOT = {'Gmaj7': 'G2', 'A7': 'A2', 'F#m7': 'F#2', 'Bm7': 'B1', 'Em7': 'E2', 'A7sus': 'A2', 'Dmaj9': 'D2'}
LOOP = ['Gmaj7', 'A7', 'F#m7', 'Bm7']
prog = ['Bm7', 'A7sus'] + [LOOP[i % 4] for i in range(23)] + ['Gmaj7', 'A7', 'Dmaj9']
MOTIF = {0: [(0, 'B4'), (3, 'A4'), (6, 'F#4'), (8, 'A4'), (10, 'B4'), (14, 'D5'), (16, 'E5'), (19, 'D5'), (22, 'B4'), (24, 'A4'), (28, 'F#4'), (30, 'E4')],
         1: [(0, 'F#4'), (3, 'A4'), (6, 'B4'), (8, 'A4'), (10, 'F#4'), (14, 'E4'), (16, 'D4'), (19, 'E4'), (22, 'F#4'), (24, 'A4'), (26, 'B4'), (28, 'F#4')]}

keys, bas, drum, pl, fx = buf(), buf(), buf(), buf(), buf()
kicks = []
DROP = 2; END = 27
for b, ch in enumerate(prog):
    t0 = b * BAR
    intro, final = b < DROP, b >= END
    # EP chords: one long voicing a bar, a softer push on step 10
    for k, n in enumerate(CH[ch]):
        pan = -0.35 + 0.7 * k / max(1, len(CH[ch]) - 1)
        if final:
            place(keys, ep(hz(n), 4.0, 0.9), t0 + 0.012 * k, 0.24, pan)
        else:
            place(keys, ep(hz(n), 1.7, 0.8), t0, 0.2, pan)
            if not intro: place(keys, ep(hz(n), 0.6, 0.45), t0 + 10 * STEP, 0.16, pan)
    if final:
        place(bas, bass(hz(ROOT[ch]), 3.0, 1.0), t0, 0.55); place(fx, crash(0.5), t0, 0.32); place(fx, boom(1.0), t0, 0.55)
        for s, n in [(0, 'A5'), (2, 'F#5'), (4, 'E5'), (6, 'D5'), (10, 'A4')]: place(pl, koto(hz(n), 2.4, 0.9, 0.35), t0 + s * STEP, 0.3, 0.25)
        continue
    # pluck motif: two bars each, octave up from bar 14 (the deeper modes)
    m = MOTIF[(b // 2) % 2] if not intro else MOTIF[1]
    half = (b % 2) * 16
    up = 2 if 16 <= b < 25 else 1
    for s, n in m:
        if half <= s < half + 16:
            f = hz(n) * (up if not intro else 1)
            place(pl, koto(f, 1.3, 0.9 if not intro else 0.6, 0.45), t0 + (s - half) * STEP, 0.26, 0.3 if s % 2 else -0.2)
    if intro:
        continue
    # bass: R . . R  R . 8 R  (8ths)
    r = hz(ROOT[ch])
    for e, mul, v in [(0, 1, 1.0), (3, 1, 0.8), (4, 1, 0.9), (6, 2, 0.7), (7, 1, 0.75)]:
        place(bas, bass(r * mul, BEAT / 2 * 0.95, v), t0 + e * BEAT / 2, 0.5)
    # drums
    for s in (0, 6, 8) + ((14,) if b % 4 == 3 else ()):
        place(drum, kick(1.0 if s in (0, 8) else 0.75), t0 + s * STEP, 0.62); kicks.append(t0 + s * STEP)
    for s in (4, 12): place(drum, snare(1.0), t0 + s * STEP, 0.32)
    for s in range(0, 16, 2):
        v = 0.55 if s % 4 == 2 else (0.3 if s % 2 == 0 else 0.16)
        place(drum, hat(False, v), t0 + s * STEP, 0.22, 0.35)
    if b % 2 == 1: place(drum, hat(True, 0.5), t0 + 14 * STEP, 0.16, 0.35)
    if b in (15, 24):  # fills into the deeper modes and into the address
        for s in (12, 13, 14, 15): place(drum, snare(0.5 + 0.12 * (s - 12)), t0 + s * STEP, 0.28)

# intro: filtered keys, a riser and a snare roll into the drop
iN = at(DROP * BAR)
sweep = np.zeros(iN); seg = 2048
for ch in range(2):
    x = keys[:iN, ch].copy(); y = np.zeros(iN)
    for i in range(0, iN, seg):
        fc = 500 * (16 ** (i / iN)); y[i:i + seg] = lp(x[max(0, i - 8192):i + seg], fc)[-len(y[i:i + seg]):]
    keys[:iN, ch] = y
place(fx, riser(BAR * 1.0), (DROP - 1) * BAR, 0.28)
for s in range(8, 16): place(drum, snare(0.25 + 0.05 * (s - 8)), (DROP - 1) * BAR + s * STEP, 0.3)
for s in (14, 15): place(drum, snare(0.6), (DROP - 1) * BAR + s * STEP + STEP / 2, 0.3)
place(fx, crash(0.9), DROP * BAR, 0.35); place(fx, boom(1.0), DROP * BAR, 0.6)

# sidechain: keys and bass breathe with the kick
sc = np.ones(N)
for k in kicks:
    i = at(k); n = int(0.28 * SR); t = np.arange(n) / SR
    sc[i:i + n] = np.minimum(sc[i:i + n], 1 - 0.45 * np.exp(-t / 0.09))
keys *= sc[:, None]; bas *= sc[:, None]

# a hall: decorrelated decaying noise, low-passed
tI = np.arange(int(2.2 * SR)) / SR
ir = lp(rng.normal(0, 1, (len(tI), 2)), 6000) * np.exp(-tI / 0.42)[:, None]; ir /= np.sqrt(np.sum(ir ** 2, 0))
def verb(x, amt): return np.stack([fftconvolve(x[:, c], ir[:, c])[:N] for c in range(2)], 1) * amt
keys = hp(keys, 150)
mix = keys + 0.78 * bas + drum + 1.25 * pl + fx + hp(verb(keys, 0.28), 300) + hp(verb(pl, 0.55), 250) + hp(verb(drum, 0.08), 400)
mix = hp(mix, 48, 3)
mix = mix + 0.45 * hp(mix, 1800)  # presence, for phone speakers
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(1.6 * mix) / np.tanh(1.6)
np.save(f'{AUD}/music.npy', mix.astype(np.float32))
# stems for the mix: whoosh
np.save(f'{AUD}/whoosh.npy', whoosh().astype(np.float32))
import wave
pcm = (np.clip(mix, -1, 1) * 32767 * 0.89).astype('<i2')
with wave.open(f'{AUD}/music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
json.dump({'bpm': BPM, 'beat': BEAT, 'bar': BAR, 'bars': BARS, 'drop_bar': DROP, 'end_bar': END, 'seconds': N / SR}, open(f'{AUD}/music.json', 'w'))
print('music', N / SR, 's')
