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
music this script plays itself: soft chords and a slow pluck, nothing
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


def from_kana_clip(path: Path) -> bytes:
    """A kana clip as the engine's PCM: mono at VOICE_RATE, its silence
    trimmed to a breath either side, at the engine's speaking level."""
    import subprocess

    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(VOICE_RATE), "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768
    loud = np.flatnonzero(np.abs(a) >= GATE)
    if loud.size:
        pad = int(0.05 * VOICE_RATE)
        a = a[max(0, loud[0] - pad):loud[-1] + pad]
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
        rev = "kana|" + hashlib.sha1(kana.read_bytes()).hexdigest()[:12]
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


# ── The bed ───────────────────────────────────────────────────────
# Four chords, eight seconds each, in D major's quiet corner: Gmaj7,
# F#m7, Em7, Dmaj9 -- a pad of soft sines and a pluck walking the chord.
CHORDS = [[55, 59, 62, 66], [54, 57, 61, 64], [52, 55, 59, 62], [50, 57, 61, 64]]
BAR = 8.0
# The bed's level against the voice: some 15dB under a line said, as a
# soft bed should sit (5dB under, the first take's, fought the voice).
MUSIC = 0.3


def bed(seconds: float):
    import numpy as np
    n = int(seconds * RATE)
    out = np.zeros(n, dtype=np.float32)
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)
    span = int(BAR * RATE)
    tail = int(2.0 * RATE)
    t = np.arange(span + tail, dtype=np.float32) / RATE
    # A chord swells in and lets go into the next one.
    env = np.minimum(1, t / 2.0) * np.clip((BAR + 2.0 - t) / 2.0, 0, 1)
    plucks = [0, 1.5, 3, 4, 5.5, 7]
    for b in range(int(np.ceil(seconds / BAR))):
        chord = CHORDS[b % len(CHORDS)]
        pad = np.zeros_like(t)
        for j, m in enumerate(chord):
            f = hz(m - 12 if j == 0 else m)
            for detune in (-0.7, 0.7):
                pad += np.sin(2 * np.pi * (f + detune) * t + j) * (0.5 if j else 0.8)
            pad += 0.08 * np.sin(2 * np.pi * 2 * f * t)
        pad *= env * 0.05
        for k, at in enumerate(plucks):
            m = chord[(k * 2 + b) % len(chord)] + 12
            dt = np.clip(t - at, 0, None)
            on = (t >= at).astype(np.float32)
            pad += on * np.sin(2 * np.pi * hz(m) * dt) * np.exp(-dt * 2.2) * 0.035 * np.minimum(1, dt / 0.01)
        a = b * span
        z = min(n, a + span + tail) - a
        if z <= 0:
            break
        out[a:a + z] += pad[:z]
    # The video opens and closes on it.
    fade = int(2.5 * RATE)
    out[:fade] *= np.linspace(0, 1, fade, dtype=np.float32)
    out[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
    return out


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


def mix(tl_path: Path, cache: Path, sfx: Path, out: Path) -> int:
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
    music = bed(n / RATE) * MUSIC
    level = np.abs(voice_track)
    win = int(0.25 * RATE)
    run = np.concatenate([[0], np.cumsum(level, dtype=np.float64)])
    idx = np.arange(n)
    lo, hi = np.clip(idx - win // 2, 0, n), np.clip(idx + win // 2, 0, n)
    follow = ((run[hi] - run[lo]) / win).astype(np.float32)
    duck = 1 - 0.55 * np.clip(follow / 0.05, 0, 1)
    music *= duck
    left = voice_track + music + fx[:, 0] * 0.5
    right = voice_track + music + fx[:, 1] * 0.5
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
    args = ap.parse_args()
    if args.step == "voice":
        return voice(args.cues, args.cache, args.out)
    return mix(args.timeline, args.cache, args.sfx, args.out)


if __name__ == "__main__":
    sys.exit(main())
