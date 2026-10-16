"""
The long videos' sound (plan 214, frontend/carousel/long.js): every
Japanese line a video says, voiced by the app's own voices, and the mix
of those lines with the app's sounds and a quiet bed of music.

Two steps, both called by frontend/carousel/long/render.mjs:

    python -m scripts.long_video_audio voice CUES.json --cache DIR --out DURS.json
    python -m scripts.long_video_audio mix TIMELINE.json --cache DIR --sfx DIR --out MIX.wav

`voice` says each line once ({text, who, slow}) and files it in the
cache under its key and the voice's revision, so a second video, or the
same one made again, waits for nothing it already has; it writes how
long each line lasts, which the timeline is then laid out on, so every
reveal lands on its voice. Who says a line is the app's casting
(voice_engine.DEFAULT_VOICES): the reader (slot 0) says words and
examples, as a card does; a scene's other person is speaker A (slot 1),
the learner speaker B (slot 2), each at its tempo. A line marked slow is
the reader again, a little slower, for a learner to follow. A line of one
syllable (め, ニ, に, きゃ) is the kana deck's own recording instead
(frontend/public/sounds/kanas/, the clip content/kana_data.sound_of
names), started where the sound starts and brought to the engine's
level, as the app's playKana does: a lone kana is what the deck was
recorded for.

`mix` lays the lines and the app's sounds (rendered from the app's own
recipes by the page, one WAV a sound) on the timeline, under a bed of
music this script plays itself (plan 219): a jazz band, an electric
piano comping over a walking bass and brushes (`--music trio`, the
default) or the same tune over a lo-fi beat (`--music lofi`), nothing
recorded, so the video owes no one for it. The music steps back while a
line is said.

It needs the voice engine (VOICEVOX_URL, CLAUDE.md "Speech") for
`voice`, numpy for `mix`, and no database. The licence's one condition
is the credit "VOICEVOX Nemo", which every video's description carries;
it also forbids the audio's use for machine learning: never publish
these clips, or a video's sound, as a dataset.
"""
import argparse
import hashlib
import json
import sys
import wave
from pathlib import Path

RATE = 48000          # the mix's rate, the browser's
VOICE_RATE = 24000    # the engine's, as the app's clips
SLOW = 0.82           # a slow line's pace against the reader's own
SLOTS = {"reader": 0, "them": 1, "me": 2}
KANAS = Path(__file__).resolve().parents[2] / "frontend" / "public" / "sounds" / "kanas"
SPEECH_RMS = 0.069    # the engine's level where it speaks; a kana clip is brought to it
GATE = 0.0056         # -45dBFS, where a kana clip's sound starts and ends (playback.js)
_kana_names: dict[str, str] | None = None


def kana_clip(text: str) -> Path | None:
    """The kana deck's recording of a one-syllable line, or None."""
    global _kana_names
    if _kana_names is None:
        from content.kana_data import KANA_SETS, sound_of
        _kana_names = {}
        for entries in KANA_SETS.values():
            for entry in entries:
                _kana_names.setdefault(entry["kana"], sound_of(entry))
    name = _kana_names.get(text.strip())
    path = KANAS / f"{name}.mp3" if name else None
    return path if path and path.exists() else None


# The kana deck was recorded to teach a sound: each syllable sung on one
# held pitch (A3) for half a second. Said in a sentence's place it is
# tuned to sound spoken (TUNE, plan 214): the vowel let go after
# SPOKEN_S, the pitch falling FALL semitones across it as a word said
# alone falls, its level decaying rather than held.
TUNE = "spoken1"   # in the cache's names: a new tuning remakes the clips
SPOKEN_S = 0.30    # the syllable's length, its sound's start to its fade
FADE_S = 0.07
FALL = 2.5         # semitones, from its start to its end
DECAY = 0.55       # the level at its end against its start


def spoken(a, rate: int = VOICE_RATE):
    """A held, sung syllable made a spoken one (see TUNE)."""
    import numpy as np
    keep = min(len(a), int((SPOKEN_S + FADE_S) * rate * 2 ** (FALL / 12)))
    a = a[:keep]
    # The pitch falls by reading the clip ever slower: a rate gliding from
    # a little above 1 to FALL semitones under it, its mean near 1.
    top, bottom = 2 ** (FALL / 24), 2 ** (-FALL / 24)
    step = np.linspace(top, bottom, len(a))
    where = np.concatenate([[0], np.cumsum(step)[:-1]])
    where = where[where <= len(a) - 1]
    out = np.interp(where, np.arange(len(a)), a)
    n = min(len(out), int((SPOKEN_S + FADE_S) * rate))
    out = out[:n] * np.linspace(1, DECAY, n)
    fade = min(n, int(FADE_S * rate))
    out[n - fade:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, fade))
    return out.astype(np.float32)


def from_kana_clip(path: Path) -> bytes:
    """A kana clip as the engine's PCM: mono at VOICE_RATE, starting on its
    sound, said rather than sung (spoken), at the engine's speaking level."""
    import subprocess

    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(VOICE_RATE), "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768
    loud = np.flatnonzero(np.abs(a) >= GATE)
    if loud.size:
        pad = int(0.05 * VOICE_RATE)
        a = a[max(0, loud[0] - pad):loud[-1] + pad]
    a = spoken(a)
    speech = a[np.abs(a) >= GATE]
    rms = float(np.sqrt(np.mean(speech ** 2))) if speech.size else 0
    a = a * (min(4.0, SPEECH_RMS / rms) if rms else 1.0)
    return (np.clip(a, -1, 1) * 32767).astype("<i2").tobytes()


def cue_key(cue: dict) -> str:
    """long.js's cueKey: who|slow|text."""
    return f"{cue['who']}|{'slow' if cue.get('slow') else ''}|{cue['text']}"


def clip_name(cue: dict, rev: str) -> str:
    """A line's file in the cache: new with a new voice, or a remade kana clip."""
    kana = kana_clip(cue["text"])
    if kana:
        rev = f"kana|{TUNE}|" + hashlib.sha1(kana.read_bytes()).hexdigest()[:12]
    return hashlib.sha1(f"{rev}|{cue_key(cue)}".encode()).hexdigest()[:16] + ".wav"


def write_wav(path: Path, frames: bytes, rate: int, channels: int = 1) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(frames)


def read_wav(path: Path):
    import numpy as np
    with wave.open(str(path)) as w:
        ch, rate, n = w.getnchannels(), w.getframerate(), w.getnframes()
        data = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float32) / 32768
    return data.reshape(-1, ch), rate


def voice(cues_path: Path, cache: Path, out: Path) -> int:
    from study import voice_engine as engine
    cues = json.loads(cues_path.read_text(encoding="utf-8"))
    cache.mkdir(parents=True, exist_ok=True)
    rev = engine.VOICE_REV
    durs, failed = {}, []
    unique = {cue_key(c): c for c in cues}
    todo = [c for c in unique.values() if not (cache / clip_name(c, rev)).exists()]
    print(f"{len(unique)} line(s), {len(todo)} to voice (voice {rev}).")
    for i, cue in enumerate(unique.values(), 1):
        path = cache / clip_name(cue, rev)
        kana = kana_clip(cue["text"])
        if not path.exists() and kana:
            write_wav(path, from_kana_clip(kana), VOICE_RATE)
        if not path.exists():
            slot = SLOTS.get(cue["who"], 0)
            speed = engine.tempo_for_slot(slot) * (SLOW if cue.get("slow") else 1.0)
            try:
                pcm = engine.say(cue["text"], engine.style_for_slot(slot), speed=speed, sample_rate=VOICE_RATE)
            except Exception as e:  # noqa: BLE001 -- reported; the line goes unsaid
                failed.append(cue["text"])
                print(f"  {cue['text']}: {type(e).__name__}: {e}", file=sys.stderr)
                continue
            write_wav(path, pcm.frames, pcm.rate)
        with wave.open(str(path)) as w:
            durs[cue_key(cue)] = round(w.getnframes() / w.getframerate(), 3)
        if i % 50 == 0:
            print(f"  {i}/{len(unique)}")
    out.write_text(json.dumps({"rev": rev, "durs": durs}, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"wrote {out}: {len(durs)} line(s); {len(failed)} failed.")
    return 1 if failed else 0


# ── The bed (plan 219) ────────────────────────────────────────────
# A small jazz band the script plays itself, nothing recorded, so the
# video owes no one for it: an electric piano comping rootless voicings
# in a swing rhythm, an upright bass walking from chord to chord, and a
# kit, under an eight-bar tune in F (Fmaj9 Dm9 Gm9 C13 | Am9 D9 Gm9 C13).
# Two feels, chosen by ear:
#
# - "trio": a late-night trio, swung at 92 -- brushes on two and four,
#   the ride's ding, ding-da ding, a feathered kick, the bass walking
#   in quarters.
# - "lofi": jazz hop at 80 -- the same piano and tune over a soft
#   boom-bap with a lazy swing, the bass on the beat and its push, a
#   needle's crackle.
#
# Every note is drawn from one seed, so a video made again sounds the same.
CHORDS = [
    # (the bass's root, its chord's tones above the root, the piano's rootless voicing)
    (41, (0, 4, 7, 11), (57, 60, 64, 67)),  # Fmaj9: A C E G
    (38, (0, 3, 7, 10), (53, 57, 60, 64)),  # Dm9: F A C E
    (43, (0, 3, 7, 10), (58, 62, 65, 69)),  # Gm9: Bb D F A
    (36, (0, 4, 7, 10), (58, 62, 64, 69)),  # C13: Bb D E A
    (45, (0, 3, 7, 10), (55, 59, 60, 64)),  # Am9: G B C E
    (38, (0, 4, 7, 10), (54, 57, 60, 64)),  # D9: F# A C E
    (43, (0, 3, 7, 10), (58, 62, 65, 69)),  # Gm9
    (36, (0, 4, 7, 10), (58, 62, 64, 69)),  # C13
]
STYLES = {
    "trio": {"bpm": 92, "swing": 2 / 3},
    "lofi": {"bpm": 80, "swing": 0.6},
}
STYLE = "trio"
SEED = 219
# The bed's level before MUSIC: the first bed's (plan 214), so the voice
# keeps the room over it test_long_video_audio holds.
BED_RMS = 0.058
# The bed's level against the voice: some 15dB under a line said, as a
# soft bed should sit (5dB under, the first take's, fought the voice).
MUSIC = 0.3


def _env(t, attack: float, decay: float, length: float | None = None, release: float = 0.05):
    import numpy as np
    e = np.minimum(1, t / attack) * np.exp(-t * decay)
    if length is not None:
        e = e * np.where(t < length, 1, np.exp(-(t - length) / release))
    return e


def _hz(m: float) -> float:
    return 440 * 2 ** ((m - 69) / 12)


def _rhodes(m: int, length: float, vel: float):
    """An electric piano's note: a sine bent by its own frequency (FM), the
    bend falling as the tine rings out, a bell of the tine at its strike."""
    import numpy as np
    f = _hz(m)
    t = np.arange(int((length + 0.9) * RATE), dtype=np.float32) / RATE
    index = (1.1 * vel) * np.exp(-t * 5) + 0.2
    y = np.sin(2 * np.pi * f * t + index * np.sin(2 * np.pi * f * t))
    y += 0.08 * vel * np.sin(2 * np.pi * f * 7.03 * t) * np.exp(-t * 28)
    return (y * _env(t, 0.004, 1.1, length, 0.12) * vel).astype(np.float32)


def _bass(m: int, length: float, vel: float):
    """An upright's note: its fundamental and two partials, plucked."""
    import numpy as np
    f = _hz(m)
    t = np.arange(int((length + 0.2) * RATE), dtype=np.float32) / RATE
    # Its overtones louder than an upright's own, so a phone's speaker, which
    # plays nothing under 150Hz, still hears the line.
    y = 0.7 * np.sin(2 * np.pi * f * t) + 0.55 * np.sin(4 * np.pi * f * t) + 0.3 * np.sin(6 * np.pi * f * t) + 0.12 * np.sin(8 * np.pi * f * t)
    y += 0.25 * np.sin(2 * np.pi * f * 5 * t) * np.exp(-t * 45)  # the finger on the string
    return (y * _env(t, 0.006, 2.6, length, 0.04) * vel).astype(np.float32)


def _drums(rng):
    """The kit, each piece drawn once: a ride, a brush, a brush's sweep,
    a feathered kick, a boom-bap kick, a snare and a closed hat."""
    import numpy as np

    def t_of(s):
        return np.arange(int(s * RATE), dtype=np.float32) / RATE

    def noise(s):
        return rng.standard_normal(int(s * RATE)).astype(np.float32)

    def high(x, k=4):  # what a short average leaves: the hiss of a noise
        return x - np.convolve(x, np.ones(k) / k, mode="same")

    def low(x, k=6):
        return np.convolve(x, np.ones(k) / k, mode="same")

    kit = {}
    t = t_of(1.8)
    ride = sum(a * np.sin(2 * np.pi * f * t + p) for f, a, p in ((3151, 1, 0), (4176, 0.7, 1), (5207, 0.5, 2), (6789, 0.35, 3), (8022, 0.25, 4)))
    kit["ride"] = (ride * _env(t, 0.001, 2.4) * 0.12 + high(noise(1.8)) * _env(t, 0.001, 9) * 0.2).astype(np.float32)
    t = t_of(0.4)
    kit["brush"] = (low(high(noise(0.4), 3), 3) * _env(t, 0.012, 13) * 0.5).astype(np.float32)
    t = t_of(0.6)
    kit["sweep"] = (low(high(noise(0.6), 3), 4) * np.sin(np.pi * t / 0.6) ** 2 * 0.12).astype(np.float32)
    t = t_of(0.4)
    kit["kick"] = (np.sin(2 * np.pi * (48 * t + 30 * (1 - np.exp(-t * 30)) / 30)) * _env(t, 0.004, 9) * 0.5).astype(np.float32)
    t = t_of(0.5)
    bend = 2 * np.pi * (50 * t + 70 * (1 - np.exp(-t * 25)) / 25)
    kit["boom"] = ((np.sin(bend) + 0.3 * np.sin(2 * bend)) * _env(t, 0.003, 8) * 0.55).astype(np.float32)
    t = t_of(0.35)
    kit["snare"] = ((low(noise(0.35), 3) * 0.7 + 0.5 * np.sin(2 * np.pi * 185 * t)) * _env(t, 0.002, 16) * 0.45).astype(np.float32)
    t = t_of(0.09)
    kit["hat"] = (high(noise(0.09), 2) * _env(t, 0.001, 45) * 0.9).astype(np.float32)
    return kit


def bed(seconds: float, style: str = STYLE):
    """The bed, stereo: (samples, 2) at RATE, as loud as BED_RMS."""
    import numpy as np
    S = STYLES[style]
    rng = np.random.default_rng(SEED)
    n = int(seconds * RATE)
    keys = np.zeros(n + RATE * 3, dtype=np.float32)
    low_end = np.zeros_like(keys)
    kit_l = np.zeros_like(keys)
    kit_r = np.zeros_like(keys)
    beat = 60 / S["bpm"]
    bar = 4 * beat
    swing = S["swing"]
    kit = _drums(rng)
    notes = {}

    def put(track, clip, at, gain=1.0):
        a = int(at * RATE)
        if a >= len(track):
            return
        z = min(len(clip), len(track) - a)
        track[a:a + z] += clip[:z] * gain

    def note(fn, m, length, vel):
        key = (fn.__name__, m, round(length, 2))
        if key not in notes:
            notes[key] = fn(m, length, 1.0)
        return notes[key] * vel

    # The piano's figures in a bar, as (beat, length in beats): on one, the
    # Charleston (one, the and of two), an anticipation, the and of one.
    comps = [[(0, 1.6)], [(0, 0.6), (1 + swing, 1.2)], [(1 + swing, 2.0)], [(swing, 1.0), (2 + swing, 1.2)], [(0, 0.6), (2, 0.6), (3 + swing, 0.9)]]
    bars = int(np.ceil(seconds / bar)) + 1
    for b in range(bars):
        at = b * bar
        root, tones, voicing = CHORDS[b % len(CHORDS)]
        nroot = CHORDS[(b + 1) % len(CHORDS)][0]
        # The piano: a figure a bar, each chord a few milliseconds spread, as a hand lays it.
        for k, (on, length) in enumerate(comps[rng.integers(len(comps))]):
            vel = float(rng.uniform(0.55, 0.85)) * (0.85 if k else 1)
            for j, m in enumerate(voicing):
                put(keys, note(_rhodes, m, length * beat, vel), at + on * beat + j * 0.007 + float(rng.uniform(0, 0.006)), 0.5)
        # The bass.
        if style == "trio":
            # Walking: the root, two of the chord's tones, and a step into the next root.
            line = [root, root + int(rng.choice(tones[1:])), root + int(rng.choice(tones[1:])), nroot + int(rng.choice([-1, 1]))]
            line = [m - 12 if m > 52 else m + 12 if m < 31 else m for m in line]
            for q, m in enumerate(line):
                put(low_end, note(_bass, m, beat * 0.92, 1.0), at + q * beat, 0.42 if q == 0 else 0.36)
        else:
            for on, m, length in ((0, root, 1.4), (1 + swing, root, 0.5), (2.5, root + 7, 0.9), (3 + swing, nroot - 1 if nroot > 32 else nroot + 1, 0.4)):
                put(low_end, note(_bass, m, length * beat, 1.0), at + on * beat, 0.4)
        # The kit, in after the first two bars.
        if b < 2:
            continue
        if style == "trio":
            for on, v in ((0, 0.9), (1, 1.0), (1 + swing, 0.55), (2, 0.9), (3, 1.0), (3 + swing, 0.55)):
                put(kit_r, kit["ride"], at + on * beat, v * float(rng.uniform(0.85, 1.0)))
                put(kit_l, kit["ride"], at + on * beat, v * 0.45)
            for on in (1, 3):
                put(kit_l, kit["brush"], at + on * beat, 0.9)
                put(kit_r, kit["brush"], at + on * beat, 0.6)
            for on in (0, 2):
                put(kit_l, kit["sweep"], at + on * beat, 0.8)
                put(kit_r, kit["sweep"], at + on * beat, 0.8)
                put(kit_l, kit["kick"], at + on * beat, 0.3)
                put(kit_r, kit["kick"], at + on * beat, 0.3)
        else:
            for on, v in ((0, 1.0), (1 + swing, 0.6), (2.5, 0.8)):
                put(kit_l, kit["boom"], at + on * beat, v)
                put(kit_r, kit["boom"], at + on * beat, v)
            for on in (1, 3):
                put(kit_l, kit["snare"], at + on * beat + 0.012, 0.8)
                put(kit_r, kit["snare"], at + on * beat + 0.012, 0.8)
            for e in range(8):
                on = e // 2 + (swing if e % 2 else 0)
                v = (0.7 if e % 2 else 1.0) * float(rng.uniform(0.7, 1.0))
                put(kit_r, kit["hat"], at + on * beat, v * 0.8)
                put(kit_l, kit["hat"], at + on * beat, v * 0.5)
    # The piano's tremolo, from side to side, as a suitcase piano's.
    t = np.arange(len(keys), dtype=np.float32) / RATE
    pan = 0.28 * np.sin(2 * np.pi * 4.2 * t)
    left = keys * (1 + pan) + low_end + kit_l
    right = keys * (1 - pan) + low_end + kit_r
    if style == "lofi":
        # The needle: a crackle, a click now and then.
        clicks = (rng.random(len(t)) < 6 / RATE) * rng.uniform(-1, 1, len(t)).astype(np.float32) * 0.25
        hiss = np.convolve(rng.standard_normal(len(t)).astype(np.float32), np.ones(8) / 8, mode="same") * 0.004
        left += clicks + hiss
        right += np.roll(clicks, 37) + hiss
    out = np.stack([left, right], axis=1)[:n]
    # The video opens on it and closes on it.
    fin, fout = min(n, int(1.5 * RATE)), min(n, int(3.0 * RATE))
    out[:fin] *= np.linspace(0, 1, fin, dtype=np.float32)[:, None]
    out[n - fout:] *= np.linspace(1, 0, fout, dtype=np.float32)[:, None]
    rms = float(np.sqrt(np.mean(out ** 2))) or 1.0
    return (out * (BED_RMS / rms)).astype(np.float32)


LOUD = -14.0      # dBFS, the voice's level where it speaks
CEILING = 0.84    # the limiter's ceiling, about -1.5dBFS


def limited(x, block: int = 120, release: float = 0.08):
    """A peak limiter: per 2.5ms block, the gain that keeps the block under
    CEILING, taken a block early (lookahead) and let go over `release`
    seconds, so a peak is turned down smoothly and nothing clips."""
    import numpy as np
    n = len(x)
    blocks = -(-n // block)
    pad = np.zeros((blocks * block, x.shape[1]), dtype=np.float32)
    pad[:n] = x
    peak = np.abs(pad).reshape(blocks, block, -1).max(axis=(1, 2))
    want = np.minimum(1.0, CEILING / np.maximum(peak, 1e-9))
    want = np.minimum(want, np.concatenate([want[1:], [1.0]]))
    step = np.exp(-block / (RATE * release))
    gain = np.empty(blocks, dtype=np.float32)
    g = 1.0
    for i, w in enumerate(want):
        g = w if w < g else w + (g - w) * step
        gain[i] = g
    smooth = np.interp(np.arange(blocks * block), np.arange(blocks) * block + block / 2, gain)
    out = pad * smooth[:, None].astype(np.float32)
    return np.clip(out[:n], -CEILING, CEILING)


def mix(tl_path: Path, cache: Path, sfx: Path, out: Path, style: str = STYLE) -> int:
    import numpy as np

    from study import voice_engine as engine
    tl = json.loads(tl_path.read_text(encoding="utf-8"))
    seconds = tl["seconds"]
    n = int(seconds * RATE) + RATE
    voice_track = np.zeros(n, dtype=np.float32)
    missing = 0
    for cue in tl["cues"]:
        path = cache / clip_name(cue, engine.VOICE_REV)
        if not path.exists():
            missing += 1
            continue
        data, rate = read_wav(path)
        mono = data[:, 0]
        up = np.interp(np.arange(int(len(mono) * RATE / rate)) * rate / RATE, np.arange(len(mono)), mono).astype(np.float32)
        a = int(cue["at"] * RATE)
        z = min(len(up), n - a)
        if z > 0:
            voice_track[a:a + z] += up[:z]
    fx = np.zeros((n, 2), dtype=np.float32)
    sounds = {}
    for s in tl["sfx"]:
        key = s["key"]
        if key not in sounds:
            path = sfx / f"{key}.wav"
            sounds[key] = read_wav(path)[0] if path.exists() else None
        clip = sounds[key]
        if clip is None:
            continue
        if clip.shape[1] == 1:
            clip = np.repeat(clip, 2, axis=1)
        a = int(s["at"] * RATE)
        z = min(len(clip), n - a)
        if z > 0:
            fx[a:a + z] += clip[:z] * s.get("gain", 1)
    # The voice at the front, the app's sounds under it, the bed under both,
    # stepping back while a line is said (a quarter-second follower).
    peak = float(np.abs(voice_track).max()) or 1
    voice_track *= 0.7 / peak
    # Where little is said (a carousel's short says one line), the bed
    # carries the video: it rises, up to twice its level, still stepping
    # back under the voice.
    spoken = float(np.mean(np.abs(voice_track) > 0.02)) if n else 0.0
    music = bed(n / RATE, style) * MUSIC * float(np.clip(0.12 / max(spoken, 0.06), 1.0, 2.0))
    level = np.abs(voice_track)
    win = int(0.25 * RATE)
    run = np.concatenate([[0], np.cumsum(level, dtype=np.float64)])
    idx = np.arange(n)
    lo, hi = np.clip(idx - win // 2, 0, n), np.clip(idx + win // 2, 0, n)
    follow = ((run[hi] - run[lo]) / win).astype(np.float32)
    duck = 1 - 0.55 * np.clip(follow / 0.05, 0, 1)
    music *= duck[:, None]
    left = voice_track + music[:, 0] + fx[:, 0] * 0.5
    right = voice_track + music[:, 1] + fx[:, 1] * 0.5
    stereo = np.stack([left, right], axis=1)
    # As loud as a video on YouTube: the voice where it speaks at LOUD, its
    # few peaks above the ceiling held down by a limiter rather than the
    # whole video turned down for them.
    speaking = np.abs(voice_track) > 0.02
    rms = float(np.sqrt(np.mean(stereo[speaking, 0] ** 2))) if speaking.any() else 0.1
    stereo *= 10 ** (LOUD / 20) / max(rms, 1e-6)
    stereo = limited(stereo)
    stereo = stereo[: int(seconds * RATE)]
    pcm = (np.clip(stereo, -1, 1) * 32767).astype("<i2").tobytes()
    write_wav(out, pcm, RATE, channels=2)
    print(f"wrote {out}: {seconds:.1f}s, {len(tl['cues'])} line(s) ({missing} unsaid), {len(tl['sfx'])} sound(s).")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="step", required=True)
    v = sub.add_parser("voice", help="voice every line and write how long each lasts")
    v.add_argument("cues", type=Path)
    v.add_argument("--cache", type=Path, required=True)
    v.add_argument("--out", type=Path, required=True)
    m = sub.add_parser("mix", help="lay the lines, the sounds and the bed on the timeline")
    m.add_argument("timeline", type=Path)
    m.add_argument("--cache", type=Path, required=True)
    m.add_argument("--sfx", type=Path, required=True)
    m.add_argument("--out", type=Path, required=True)
    m.add_argument("--music", choices=sorted(STYLES), default=STYLE, help="the bed's feel (plan 219)")
    args = ap.parse_args()
    if args.step == "voice":
        return voice(args.cues, args.cache, args.out)
    return mix(args.timeline, args.cache, args.sfx, args.out, args.music)


if __name__ == "__main__":
    sys.exit(main())
