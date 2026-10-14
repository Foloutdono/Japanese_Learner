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
END_BEAT = 101
T_END = END_BEAT * B
PX, PY, PW, PH = 190, 400, 700, 1400
def bt(b): return b * B

# ── the cut: (clip, [(source seconds, beat)...]) ─────────────────────────
# Each anchor pins a moment of the recording to a beat; between anchors the
# footage runs at whatever speed joins them. Taps are anchored on beats.
SEGS = [
    # 1 hook + 2 try: one take, the drop at beat 8, Board pressed on beat 10
    dict(clip='onboard', a=[(1.95, 0), (5.6, 8), (7.15, 10), (9.9, 14), (10.6, 16)]),
    # 3 goal: goal, lines, rhythm, hour, then the plan (its chime on the off-beat)
    dict(clip='onboard', a=[(18.6, 16), (19.62, 18), (24.99, 22), (27.72, 24), (28.93, 26), (29.31, 26.5), (32.4, 31)]),
    #   ... and the progress
    dict(clip='progress', a=[(1.2, 31), (4.39, 34), (6.2, 36)]),
    # 4 board: the account, the pass, the gate
    dict(clip='onboard', a=[(36.0, 36), (38.14, 38), (40.21, 40), (42.3, 41), (46.82, 44), (47.54, 45), (49.4, 48)]),
    #   ... and the run: Depart, the door, a card turned, Correct
    dict(clip='run', a=[(1.9, 48), (2.45, 49), (5.21, 52), (6.53, 54), (7.6, 56)]),
    # 5 modes: the grammar ladder, answered on a beat
    dict(clip='ladder', a=[(0.8, 56), (1.18, 57), (2.94, 59), (5.64, 62), (7.0, 64)]),
    #   ... a kanji drawn, a stroke a beat-ish
    dict(clip='draw', a=[(2.6, 64), (3.15, 65), (8.1, 69)]),
    #   ... revealed and marked right
    dict(clip='draw', a=[(9.6, 69), (12.02, 71.5), (12.5, 72)]),
    # 6 practice: the list, into a reading ...
    dict(clip='practice', a=[(3.3, 72), (5.66, 73.5), (7.6, 75)]),
    #   ... its question answered
    dict(clip='practice', a=[(11.7, 75), (12.08, 76), (13.3, 78)]),
    #   ... then timed reading: shown, typed, right
    dict(clip='readprac', a=[(0.6, 78), (0.97, 79), (4.20, 83), (6.93, 86), (7.9, 88)]),
    # 7 join: back to the hub
    dict(clip='onboard', a=[(1.95, 88), (5.6, END_BEAT)]),
]
SCENE_BEATS = [16, 36, 56, 72, 88]          # train-pull slides land here
# captions: (beat, state); the first of a scene pops in, later ones cross-fade
CAPS = [(0, 'hook'), (8, 'try'), (16, 'goalA'), (31, 'goalB'), (36, 'boardA'), (40, 'boardB'), (48, 'boardC'),
        (56, 'modes'), (72, 'practice'), (88, 'join')]
SAME_SCENE = {('goalA', 'goalB'), ('boardA', 'boardB'), ('boardB', 'boardC')}
PILL_BEAT = 92
FINAL_BEAT = 96

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
            strip = Image.new('RGB', (PW * 2, PH)); strip.paste(content(prv.frame_at(t)), (0, 0)); strip.paste(content(nxt.frame_at(t)), (PW, 0))
            strip = smear(strip, 1 + v / 18)
            x = int(round(p * PW)); return strip.crop((x, 0, x + PW, PH))
    # a cut inside a scene: the old screen grows and fades, the new one settles
    for k in range(1, len(S)):
        tb = S[k].t0
        if any(abs(tb - bt(b)) < 1e-6 for b in SCENE_BEATS) or S[k].clip == S[k - 1].clip and abs(S[k - 1].src(tb) - S[k].src(tb)) < 0.05: continue
        d = 0.22
        if tb - d / 2 <= t < tb + d / 2:
            p = out_cubic((t - (tb - d / 2)) / d)
            a = scale_crop(content(S[k - 1].frame_at(t)), 1 + 0.07 * p)
            b = scale_crop(content(S[k].frame_at(t)), 0.94 + 0.06 * p)
            return Image.blend(a, b, p)
    return content(cur.frame_at(t))

def phone_scale(t):
    b = t / B
    s = 1 + 0.035 * clamp(b / 8) if b < 8 else 1.0           # the hook's slow push in
    for pb, amp, dur in ((8, 0.075, 0.45), (FINAL_BEAT, 0.035, 0.5)):  # the drop, the last chord
        if bt(pb) <= t < bt(pb) + dur: s = 1 + amp * (1 - out_cubic((t - bt(pb)) / dur))
    return s

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

def render(n):
    t = n / FPS; st = static()
    b = t / B
    # the background breathes with the kick once the beat is in
    pulse = 0.0
    if 8 <= b < FINAL_BEAT: pulse = 0.55 * math.exp(-((b % 1) * B) / 0.22)
    if b >= FINAL_BEAT: pulse = 0.8 * math.exp(-(t - bt(FINAL_BEAT)) / 0.6)
    frame = Image.blend(st['bg'], st['bg_hi'], pulse).convert('RGBA')
    M = st['M']
    layer = Image.new('RGBA', (PW + 2 * M, PH + 2 * M), (0, 0, 0, 0))
    layer.paste(screen(t), (M, M), st['mask'])
    layer.alpha_composite(st['frame'])
    s = phone_scale(t)
    paste(frame, layer, (PX - M, PY - M), s=s)
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
    put(snd('card-stamp'), bt(PILL_BEAT), 1.2); put(snd('pass-clip'), bt(PILL_BEAT) + 0.02, 0.7)
    put(snd('pass-clip'), bt(8), 0.8)
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
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'{OUT}/mix.wav', '-af', 'loudnorm=I=-14:TP=-1.0:LRA=9', '-ar', '48000', f'{OUT}/mix_norm.wav'], check=True)
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
