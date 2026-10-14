"""The beat-cut edit: frames from the recorded screencasts, re-timed so the
taps land on the music's beats, with transitions, animated captions and a
mix of the music and the app's own sounds at the moments the app played
them.

    python edit.py            # video + audio -> out/tsuji_tiktok.mp4
    python edit.py --audio    # audio only (fast)
    python edit.py --frames 0,120,400   # stills, for checking
"""
import json, os, sys, math, bisect, subprocess, wave
from multiprocessing import Pool
import numpy as np
from PIL import Image, ImageFilter

WORK = os.environ.get('FILM_DIR', '/tmp/tsuji-film')
FR, OV, AUD, OUT = f'{WORK}/frames', f'{WORK}/ov', f'{WORK}/audio', f'{WORK}/out'
SFX_DIR = f'{WORK}/sfx'
os.makedirs(OUT, exist_ok=True)

BPM = 128; B = 60 / BPM; FPS = 30
END_BEAT = 127
T_END = END_BEAT * B
PX, PY, PW, PH = 190, 400, 700, 1400
def bt(b): return b * B

# ── the cut: (clip, [(source seconds, beat)...]) ─────────────────────────
# Each anchor pins a moment of the recording to a beat; between anchors the
# footage runs at whatever speed joins them. Taps are anchored on beats.
SEGS = [
    # 1 hook + 2 try: the hub, Board pressed on beat 12.5
    dict(clip='onboard', a=[(1.95, 0), (5.6, 8), (7.21, 12.5), (7.32, 14)]),
    # 3 the goal: N4 picked, Continue
    dict(clip='onboard', a=[(18.8, 14), (19.70, 16), (20.92, 18.5), (21.1, 19)]),
    #   the plan arrives under its sign (the chime on beat 19.5) and holds
    dict(clip='onboard', a=[(29.05, 19), (29.39, 19.5), (30.1, 21), (35.4, 32)]),
    # 4 connect, board: the pass ...
    dict(clip='onboard', a=[(41.0, 32), (43.4, 35.5)]),
    #   ... Enter the station, the gate, up to the station's sign
    dict(clip='onboard', a=[(46.6, 35.5), (46.90, 36), (48.75, 40)]),
    #   on track: Today, Depart, a card turned and right, the level up
    dict(clip='clear', a=[(0.5, 40), (2.42, 43), (5.28, 47), (6.70, 49), (9.04, 53), (9.9, 54.5)]),
    #   the day cleared on the 30th day: the stamp, 30 days, the 一ヶ月 ticket
    dict(clip='clear', a=[(16.3, 54.5), (16.82, 55.5), (27.23, 75), (30.5, 80)]),
    # 5 modes: Draw the kanji, 国 stroke by stroke ...
    dict(clip='draw', a=[(3.6, 80), (3.96, 81), (12.95, 96)]),
    #   ... revealed and marked right
    dict(clip='draw', a=[(14.6, 96), (14.84, 96.5), (17.34, 100.5), (17.7, 101)]),
    # 6 practice: timed reading, shown, typed, right
    dict(clip='readprac', a=[(0.6, 101), (0.98, 102), (6.53, 110), (9.65, 115), (10.1, 116)]),
    # 7 join: back to the hub
    dict(clip='onboard', a=[(1.95, 116), (5.6, END_BEAT)]),
]
SCENE_BEATS = [14, 32, 80, 101, 116]          # train-pull slides land here
# captions: (beat, state); the first of a scene pops in, later ones cross-fade
CAPS = [(8, 'try'), (14, 'goalA'), (27, 'goalB'), (32, 'boardAB'), (40, 'boardC'),
        (80, 'modes'), (101, 'practice'), (116, 'join')]
SAME_SCENE = {('goalA', 'goalB'), ('boardAB', 'boardC')}
PILL_BEAT = 120
FINAL_BEAT = 124

# ── easing ───────────────────────────────────────────────────────────────
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def out_cubic(p): p = clamp(p); return 1 - (1 - p) ** 3
def out_back(p, s=1.7): p = clamp(p) - 1; return 1 + (s + 1) * p ** 3 + s * p ** 2
def in_out(p): p = clamp(p); return 4 * p ** 3 if p < .5 else 1 - (-2 * p + 2) ** 3 / 2

# ── time maps ────────────────────────────────────────────────────────────
class Seg:
    def __init__(self, d):
        self.clip = d['clip']; self.a = [(s, bt(b)) for s, b in d['a']]
        self.t0, self.t1 = self.a[0][1], self.a[-1][1]
        meta = json.load(open(f'{FR}/{self.clip}/frames.json'))
        self.times = [t for _, t in meta['frames']]; self.files = [f for f, _ in meta['frames']]
        self.events = meta['events']
        self.zoom = [(bt(b), z, fx, fy) for b, z, fx, fy in d.get('zoom', [])]
    def zoom_at(self, t):
        z = self.zoom
        if not z: return 1.0, .5, .5
        if t <= z[0][0]: return z[0][1:]
        if t >= z[-1][0]: return z[-1][1:]
        i = max(k for k in range(len(z) - 1) if z[k][0] <= t); (t0, z0, x0, y0), (t1, z1, x1, y1) = z[i], z[i + 1]
        p = in_out((t - t0) / (t1 - t0)); return z0 + (z1 - z0) * p, x0 + (x1 - x0) * p, y0 + (y1 - y0) * p
    def image(self, t):
        im = content(self.frame_at(t)); s, fx, fy = self.zoom_at(t)
        if s <= 1.001: return im
        w, h = int(PW / s), int(PH / s)
        x = int(clamp(fx * PW - w / 2, 0, PW - w)); y = int(clamp(fy * PH - h / 2, 0, PH - h))
        return im.crop((x, y, x + w, y + h)).resize((PW, PH), Image.LANCZOS)
    def src(self, t):  # output seconds -> source seconds (extrapolated at the ends)
        a = self.a
        if t <= a[0][1]: (s0, t0), (s1, t1) = a[0], a[1]
        elif t >= a[-1][1]: (s0, t0), (s1, t1) = a[-2], a[-1]
        else:
            i = max(k for k in range(len(a) - 1) if a[k][1] <= t); (s0, t0), (s1, t1) = a[i], a[i + 1]
        return s0 + (t - t0) * (s1 - s0) / (t1 - t0)
    def out(self, s):  # source -> output (inverse, within the anchors)
        a = self.a
        for (s0, t0), (s1, t1) in zip(a, a[1:]):
            if s0 <= s <= s1: return t0 + (s - s0) * (t1 - t0) / (s1 - s0)
        return None
    def frame_at(self, t):
        s = self.src(t); i = max(0, bisect.bisect_right(self.times, s) - 1)
        return self.files[i]

SEG = None
def segs():
    global SEG
    if SEG is None: SEG = [Seg(d) for d in SEGS]
    return SEG

# ── images ───────────────────────────────────────────────────────────────
_cache = {}
def content(path):
    im = _cache.get(path)
    if im is None:
        if len(_cache) > 80: _cache.clear()
        im = Image.open(path).convert('RGB').resize((PW, PH), Image.LANCZOS); _cache[path] = im
    return im

def load_rgba(p):
    im = Image.open(p).convert('RGBA'); bb = im.getbbox() or (0, 0, 1, 1)
    return im.crop(bb), bb[:2]

_static = {}
def static():
    if _static: return _static
    bg = Image.open(f'{OV}/bg.png').convert('RGB')
    # a brighter twin of the background for the glow that breathes on the beat
    arr = np.asarray(bg).astype(np.float32)
    yy, xx = np.mgrid[0:1920, 0:1080]
    glow = np.exp(-(((xx - 540) / 520) ** 2 + ((yy - 1100) / 700) ** 2))[..., None] * np.array([201, 154, 62]) * 0.16
    _static['bg'] = bg; _static['bg_hi'] = Image.fromarray(np.clip(arr + glow, 0, 255).astype(np.uint8))
    mask = Image.open(f'{OV}/mask_phone.png').convert('L'); _static['mask'] = mask
    fr = Image.open(f'{OV}/frame.png').convert('RGBA')
    M = 40; _static['M'] = M
    _static['frame'] = fr.crop((PX - M, PY - M, PX + PW + M, PY + PH + M))
    caps = json.load(open(f'{OV}/captions.json'))
    _static['caps'] = {k: dict(full=load_rgba(f"{WORK}/{v['full']}"), words=[(load_rgba(f"{WORK}/{w['png']}"), w['kind']) for w in v['words']]) for k, v in caps.items()}
    return _static

def scale_crop(im, s):
    if abs(s - 1) < 1e-3: return im
    w, h = im.size; r = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.BILINEAR)
    if s > 1:
        x, y = (r.width - w) // 2, (r.height - h) // 2; return r.crop((x, y, x + w, y + h))
    c = Image.new(im.mode, (w, h)); c.paste(r, ((w - r.width) // 2, (h - r.height) // 2)); return c

def smear(im, k):  # horizontal motion blur
    if k <= 1.05: return im
    w, h = im.size; return im.resize((max(8, int(w / k)), h), Image.BILINEAR).resize((w, h), Image.BILINEAR)

def screen(t):
    """The phone's screen at output time t: one segment, or two in a transition."""
    S = segs()
    i = next((k for k, s in enumerate(S) if s.t0 <= t < s.t1), len(S) - 1)
    cur = S[i]
    # a train pull lands on each scene beat: next slides in from the right
    for b in SCENE_BEATS:
        tb = bt(b); d = 0.34
        if tb - d <= t < tb:
            nxt = next(s for s in S if abs(s.t0 - tb) < 1e-6); prv = next(s for s in S if abs(s.t1 - tb) < 1e-6)
            p = in_out((t - (tb - d)) / d); v = abs(in_out((t + 1 / FPS - (tb - d)) / d) - p) * PW
            strip = Image.new('RGB', (PW * 2, PH)); strip.paste(prv.image(t), (0, 0)); strip.paste(nxt.image(t), (PW, 0))
            strip = smear(strip, 1 + v / 18)
            x = int(round(p * PW)); return strip.crop((x, 0, x + PW, PH))
    # a cut inside a scene: the old screen grows and fades, the new one settles
    for k in range(1, len(S)):
        tb = S[k].t0
        if any(abs(tb - bt(b)) < 1e-6 for b in SCENE_BEATS) or S[k].clip == S[k - 1].clip and abs(S[k - 1].src(tb) - S[k].src(tb)) < 0.05: continue
        d = 0.22
        if tb - d / 2 <= t < tb + d / 2:
            p = out_cubic((t - (tb - d / 2)) / d)
            a = scale_crop(S[k - 1].image(t), 1 + 0.07 * p)
            b = scale_crop(S[k].image(t), 0.94 + 0.06 * p)
            return Image.blend(a, b, p)
    return cur.image(t)

def phone_scale(t):
    return 1.0

def with_alpha(im, k):
    if k >= 0.999: return im
    im = im.copy(); a = im.getchannel('A').point(lambda v: int(v * k)); im.putalpha(a); return im

def paste(frame, im, xy, k=1.0, s=1.0):
    if k <= 0.003: return
    if abs(s - 1) > 1e-3:
        w, h = im.size; im2 = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.BILINEAR)
        xy = (round(xy[0] + (w - im2.width) / 2), round(xy[1] + (h - im2.height) / 2)); im = im2
    frame.alpha_composite(with_alpha(im, k), dest=(int(xy[0]), int(xy[1])))

def runs():
    """Captions grouped by scene: [(first index, last index)]."""
    out, k = [], 0
    while k < len(CAPS):
        j = k
        while j + 1 < len(CAPS) and (CAPS[j][1], CAPS[j + 1][1]) in SAME_SCENE: j += 1
        out.append((k, j)); k = j + 1
    return out

def caption_layer(frame, t):
    for first, last in runs():
        t_in = bt(CAPS[first][0]); t_out = bt(CAPS[last + 1][0]) if last + 1 < len(CAPS) else 1e9
        if t_in - 0.15 <= t < t_out: draw_run(frame, t, first, last, t_in, t_out)

def draw_run(frame, t, first, last, t_in, t_out):
    st = static()['caps']
    p_exit = clamp((t - (t_out - 0.2)) / 0.2)
    exit_k, exit_dy = 1 - p_exit, -26 * out_cubic(p_exit)
    idx = max(k for k in range(first, last + 1) if bt(CAPS[k][0]) - 0.06 <= t) if t >= t_in - 0.06 else first
    state = CAPS[idx][1]
    since = t - t_in
    words = st[CAPS[first][1]]['words']
    if state == 'try':      # slams in on the drop
        for i, ((im, (x, y)), kind) in enumerate(words):
            p = clamp((since + 0.02 - 0.05 * i) / 0.22)
            if p > 0: paste(frame, im, (x, y + exit_dy), k=clamp(p * 3) * exit_k, s=1.35 - 0.35 * out_cubic(p))
        return
    if idx != first:        # the highlight moving on: cross-fade the full states
        prev = st[CAPS[idx - 1][1]]['full']; cur = st[state]['full']
        p = clamp((t - (bt(CAPS[idx][0]) - 0.06)) / 0.2)
        if p < 1: paste(frame, prev[0], (prev[1][0], prev[1][1] + exit_dy), k=(1 - p) * exit_k)
        paste(frame, cur[0], (cur[1][0], cur[1][1] + exit_dy), k=p * exit_k, s=1 + 0.03 * (1 - out_cubic(p)) if p < 1 else 1)
        return
    stagger = 0.05 if state == 'hook' else 0.06
    for i, ((im, (x, y)), kind) in enumerate(words):
        if kind == 'pill':
            p = clamp((t - bt(PILL_BEAT) + 0.05) / 0.32)
            if p > 0: paste(frame, im, (x, y + exit_dy), k=clamp(p * 4) * exit_k, s=0.55 + 0.45 * out_back(p, 2.2))
            continue
        p = clamp((since + 0.1 - stagger * i) / 0.3)
        if p > 0: paste(frame, im, (x, y + 30 * (1 - out_cubic(p)) + exit_dy), k=out_cubic(p) * exit_k, s=0.9 + 0.1 * out_back(p))

HOOK = [('hook_1', -0.3, 1.0), ('hook_2', 2, 1.0), ('hook_3', 4, 1.0), ('hook_4', 6, 1.5)]  # piece, beat, slam
PHONE_IN = 7.7      # the phone rises in, landing on the drop (beat 8)

def hook_layer(frame, t):
    st = static()
    if 'hook' not in st:
        st['hook'] = {k: load_rgba(f'{OV}/{k}.png') for k, _, _ in HOOK}; st['hook_line'] = load_rgba(f'{OV}/hook_line.png')
    p_out = clamp((t - bt(7.55)) / (bt(8.05) - bt(7.55)))
    k_out, dy_out = 1 - out_cubic(p_out), -90 * out_cubic(p_out)
    if k_out <= 0: return
    for k, b, slam in HOOK:
        p = clamp((t - bt(b)) / 0.24)
        if p <= 0: continue
        im, (x, y) = st['hook'][k]
        paste(frame, im, (x, y + dy_out), k=clamp(p * 2.5) * k_out, s=slam - (slam - 1) * out_cubic(p))
    # the gold line runs out under "goal?", left to right, onto its ring
    p = in_out((t - bt(6.5)) / (bt(7.3) - bt(6.5)))
    if p > 0:
        im, (x, y) = st['hook_line']
        w = max(1, int(im.width * p)); paste(frame, im.crop((0, 0, w, im.height)), (x, y + dy_out), k=k_out)

def render(n):
    t = n / FPS; st = static()
    frame = st['bg'].convert('RGBA')
    hook_layer(frame, t)
    if t >= bt(PHONE_IN):
        M = st['M']
        layer = Image.new('RGBA', (PW + 2 * M, PH + 2 * M), (0, 0, 0, 0))
        layer.paste(screen(t), (M, M), st['mask'])
        layer.alpha_composite(st['frame'])
        rise = 1 - out_cubic(clamp((t - bt(PHONE_IN)) / (bt(8) - bt(PHONE_IN) + 0.12)))
        paste(frame, layer, (PX - M, PY - M + int(1500 * rise)))
    caption_layer(frame, t)
    return frame.convert('RGB')

def render_chunk(args):
    lo, hi, out = args
    p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1080x1920', '-r', str(FPS), '-i', '-',
                          '-c:v', 'libx264', '-crf', '15', '-preset', 'medium', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
    for n in range(lo, hi): p.stdin.write(render(n).tobytes())
    p.stdin.close(); p.wait(); return out

# ── audio ────────────────────────────────────────────────────────────────
SR = 48000
def read_wav(p):
    with wave.open(p) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float32) / 32768
        return x.reshape(-1, w.getnchannels())
def key_tick(rng):
    n = int(0.03 * SR); t = np.arange(n) / SR
    x = rng.uniform(-1, 1, n) * np.exp(-t / 0.004) + 0.4 * np.sin(2 * np.pi * 2400 * t) * np.exp(-t / 0.006)
    return np.stack([x, x], 1) * 0.12

def audio():
    rng = np.random.default_rng(3)
    N = int((T_END + 0.05) * SR)
    music = np.load(f'{AUD}/music.npy')[:N]
    music = np.pad(music, ((0, max(0, N - len(music))), (0, 0)))
    sfx = np.zeros((N, 2), np.float32)
    def put(x, t, g):
        i = int(round(t * SR))
        if i >= N or i + len(x) <= 0: return
        if i < 0: x = x[-i:]; i = 0
        j = min(N, i + len(x)); sfx[i:j] += g * x[:j - i]
    cache = {}
    def snd(name):
        if name not in cache: cache[name] = read_wav(f'{SFX_DIR}/{name}.wav') if os.path.exists(f'{SFX_DIR}/{name}.wav') else None
        return cache[name]
    placed = []
    S = segs()
    for k, s in enumerate(S):
        for e in s.events:
            if e['kind'] not in ('voice', 'key'): continue
            to = s.out(e['t'])
            if to is None or not (s.t0 - 1e-6 <= to < s.t1 - 0.02): continue
            to += e.get('after', 0) or 0
            name = e['name'] if e['kind'] == 'voice' else '#key'
            if any(n == name and abs(tt - to) < 0.04 for n, tt in placed): continue
            placed.append((name, to))
    # a brush on paper under each kanji stroke
    for s_ in S:
        if s_.clip != 'draw': continue
        for e in s_.events:
            if e['kind'] != 'touch': continue
            a, b = s_.out(e['t']), s_.out(e['t'] + 0.62)
            if a is None or b is None or not (s_.t0 <= a < s_.t1): continue
            n = int((b - a) * SR); tt = np.arange(n) / SR
            from scipy.signal import butter, sosfilt
            x = sosfilt(butter(2, [1800, 6500], 'band', fs=SR, output='sos'), rng.uniform(-1, 1, n))
            env = np.minimum(1, tt / 0.02) * np.minimum(1, (tt[-1] - tt) / 0.05) * (0.6 + 0.4 * np.sin(np.pi * tt / tt[-1]))
            put(np.stack([x * env, x * env], 1) * 0.10, a, 1.0)
    for name, to in placed:
        if name == '#key': put(key_tick(rng), to, 1.0)
        elif snd(name) is not None: put(snd(name), to, 1.0)
    # the edit's own: a whoosh into each scene, the whisk at each inner cut,
    # the stamp on the address, the pass punched on the drop
    wh = np.load(f'{AUD}/whoosh.npy'); wh = np.stack([wh, wh], 1)
    for b in SCENE_BEATS: put(wh, bt(b) - len(wh) / SR + 0.03, 0.5)
    for k in range(1, len(S)):
        tb = S[k].t0
        if any(abs(tb - bt(b)) < 1e-6 for b in SCENE_BEATS) or S[k].clip == S[k - 1].clip and abs(S[k - 1].src(tb) - S[k].src(tb)) < 0.05: continue
        if snd('card-transition') is not None: put(snd('card-transition'), tb - 0.06, 0.9)
    for _, b, slam in HOOK[1:]:
        if slam > 1.2: put(snd('card-stamp'), bt(b), 1.3)
        else: put(snd('click-mode-selection'), bt(b), 1.1)
    put(wh, bt(8) - len(wh) / SR + 0.03, 0.55)
    put(snd('card-stamp'), bt(PILL_BEAT), 1.2); put(snd('pass-clip'), bt(PILL_BEAT) + 0.02, 0.7)
    # levels: the app's sounds sit on top of the music, which dips under them
    sp = np.max(np.abs(sfx)); print(f'sfx peak {sp:.3f}, {len(placed)} app sounds placed')
    env = np.abs(sfx).max(1)
    k = int(0.12 * SR); env = np.convolve(env, np.ones(k) / k, 'same')
    duck = 1 - 0.35 * np.clip(env / (env.max() + 1e-9) * 3, 0, 1)
    mix = music * 0.42 * duck[:, None] + sfx * (0.62 / max(sp, 1e-6)) * 0.85
    fade = int(0.9 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
    mix[:int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))[:, None]
    pcm = (np.clip(mix / max(1.0, np.max(np.abs(mix)) / 0.97), -1, 1) * 32767).astype('<i2')
    with wave.open(f'{OUT}/mix.wav', 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    # TikTok plays at about -14 LUFS; land there with true-peak headroom
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'{OUT}/mix.wav', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9,alimiter=limit=0.8:attack=2:release=60:level=false', '-ar', '48000', f'{OUT}/mix_norm.wav'], check=True)
    for ev in placed[:0]: pass
    return placed

if __name__ == '__main__':
    args = sys.argv[1:]
    if '--frames' in args:
        for n in map(int, args[args.index('--frames') + 1].split(',')): render(n).save(f'{OUT}/still_{n:04d}.png')
        sys.exit()
    placed = audio()
    json.dump(placed, open(f'{OUT}/placed.json', 'w'))
    if '--audio' in args: sys.exit()
    total = int(T_END * FPS)
    W = 4; step = math.ceil(total / W)
    jobs = [(i, min(total, i + step), f'{OUT}/part{k}.mp4') for k, i in enumerate(range(0, total, step))]
    with Pool(W) as pool: parts = pool.map(render_chunk, jobs)
    with open(f'{OUT}/parts.txt', 'w') as f:
        for p in parts: f.write(f"file '{p}'\n")
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', f'{OUT}/parts.txt', '-i', f'{OUT}/mix_norm.wav',
                    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart',
                    f'{OUT}/tsuji_tiktok.mp4'], check=True)
    print('done', total, 'frames')
