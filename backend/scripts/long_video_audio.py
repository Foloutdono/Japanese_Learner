"""
The long videos' sound (plan 233, frontend/carousel/long.js): every
Japanese line a video says, voiced by the app's own voices, and the mix
of those lines with the app's sounds. No video carries music (plan 273,
the owner's call): its voices and its sounds are the whole of it.

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
recipes by the page, one WAV a sound) on the timeline.

A line marked `marks` (a challenge read along) is also written down
syllable by syllable: when each of the engine's morae starts in its
clip, from the audio query it is said from, so the video lights each
word as the voice reaches it.

A line that carries its `words` (a read along, a "Say it" sentence:
each part's text, the reading the page prints over it, whether it is a
particle) is said as the page prints it: the engine's reading is held
to the words', and a word it reads otherwise is handed to it in kana
(see "What the page prints is what is said" below).

It needs the voice engine (VOICEVOX_URL, CLAUDE.md "Speech") for
`voice`, numpy for `mix`, and no database. The licence's one condition
is the credit "VOICEVOX Nemo", which every video's description carries;
it also forbids the audio's use for machine learning: never publish
these clips, or a video's sound, as a dataset.
"""
import argparse
import difflib
import hashlib
import json
import re
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
# tuned to sound spoken (TUNE, plan 233): the vowel let go after
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
    """A line's file in the cache: new with a new voice, a remade kana
    clip, or a line held to its words (READ, the words themselves)."""
    kana = kana_clip(cue["text"])
    if kana:
        rev = f"kana|{TUNE}|" + hashlib.sha1(kana.read_bytes()).hexdigest()[:12]
    elif held(cue):
        rev = f"{rev}|{READ}|" + json.dumps(cue["words"], ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha1(f"{rev}|{cue_key(cue)}".encode()).hexdigest()[:16] + ".wav"


# ── What the page prints is what is said ─────────────────────────
# A line is handed to the engine as text, and Open JTalk's dictionary
# reads a kanji word one way whatever the sentence means: 米 べい for
# こめ, 角 かく for かど, 辛かった からかった for つらかった, 上で じょうで
# for うえで, 方 ほう for かた, 十分 じゅうぶん for "ten minutes", 日本
# にっぽん. A read along prints the bank's reading over every word and
# lights each on the engine's syllables, which then no longer count as
# the text's: of the 1,010 sentences "Say it" (plan 311) can say, 20 were
# said otherwise than printed, and 138 of the reading challenge's 2,245.
#
# Such a line carries its words, and the engine's own reading of it (its
# audio query) is held to them, mora by mora: a word with a kanji that
# it reads otherwise is handed over in hiragana (つらかった), in katakana
# where the engine still errs, and the query is asked and checked again;
# the line is said from the query that reads as printed, or the nearest.
# A word written in kana is read as written and never checked: the page
# prints no reading over it, and は inside one (または) is the engine's to
# say wa. A quotation's marks are said as a speaker says them: the
# engine took both for commas (…来ます、と言いました), so the opening one
# is a pause and the closing one nothing.

# The reading a line is held to: a change of the rule is a new clip.
READ = "read1"

_KANJI = re.compile(r"[㐀-鿿豈-﫿々〆ヶ]")
# Each kana as the engine's phonemes write it (consonant and vowel).
_KANA = dict(zip(
    "あいうえおかきくけこがぎぐげごさしすせそざじずぜぞたちつてとだぢづでどなにぬねの"
    "はひふへほばびぶべぼぱぴぷぺぽまみむめもやゆよらりるれろわゐゑをんっゔ",
    "a i u e o ka ki ku ke ko ga gi gu ge go sa shi su se so za ji zu ze zo ta chi tsu te to "
    "da ji zu de do na ni nu ne no ha hi fu he ho ba bi bu be bo pa pi pu pe po ma mi mu me mo "
    "ya yu yo ra ri ru re ro wa i e o N Q vu".split()))
_SMALL = {"ぁ": "a", "ぃ": "i", "ぅ": "u", "ぇ": "e", "ぉ": "o", "ゃ": "ya", "ゅ": "yu", "ょ": "yo", "ゎ": "wa"}
# The consonant a kana gives the small ゃゅょ after it (きゃ kya), and a small vowel (ファ fa, ティ ti).
_BEFORE_YA = {"き": "ky", "ぎ": "gy", "し": "sh", "じ": "j", "ち": "ch", "ぢ": "j", "に": "ny", "ひ": "hy", "び": "by",
              "ぴ": "py", "み": "my", "り": "ry", "て": "ty", "で": "dy"}
_BEFORE_SMALL_VOWEL = {"ふ": "f", "て": "t", "で": "d", "と": "t", "ど": "d", "う": "w", "ゔ": "v", "つ": "ts",
                       "し": "sh", "じ": "j", "ち": "ch", "い": "y", "く": "kw", "ぐ": "gw", "す": "s", "ず": "z",
                       "き": "ky", "ぎ": "gy"}
_VOWELS = "aiueo"
_QUOTE_OPEN = re.compile(r"(?<=[^\s、。，．！？!?「『])[「『]")
_QUOTES = re.compile(r"[「」『』]")


def held(cue: dict) -> bool:
    """Whether a line carries its words, to be said as printed."""
    words = cue.get("words")
    return bool(words) and isinstance(words, list) and all(isinstance(w, list) and len(w) == 3 for w in words)


def hiragana(text: str) -> str:
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in text)


def katakana(text: str) -> str:
    return "".join(chr(ord(c) + 0x60) if "ぁ" <= c <= "ゖ" else c for c in text)


def kana_morae(kana: str) -> list[str] | None:
    """A reading's morae in the engine's own phonemes (きゃ kya, っ Q,
    ん N, ー -), or None where it is not all kana."""
    s, out, i = hiragana(kana), [], 0
    while i < len(s):
        c, nxt = s[i], s[i + 1] if i + 1 < len(s) else ""
        if nxt and nxt in "ゃゅょ" and c in _BEFORE_YA:
            out.append(_BEFORE_YA[c] + _SMALL[nxt][1])
            i += 2
        elif nxt and nxt in "ぁぃぅぇぉ" and c in _BEFORE_SMALL_VOWEL:
            out.append(_BEFORE_SMALL_VOWEL[c] + _SMALL[nxt])
            i += 2
        elif c == "ー":
            out.append("-")
            i += 1
        elif c in _KANA or c in _SMALL:
            out.append(_KANA.get(c) or _SMALL[c])
            i += 1
        else:
            return None
    return out


def heard_morae(query: dict) -> list[str]:
    """The morae an audio query says, in kana_morae's terms (a vowel said
    without voice, as す in です, is the same mora)."""
    out = []
    for phrase in query.get("accent_phrases", []):
        for mora in phrase.get("moras", []):
            vowel = mora.get("vowel") or ""
            out.append("Q" if vowel == "cl" else "N" if vowel == "N" else (mora.get("consonant") or "") + vowel.lower())
    return out


def _folded(morae: list[tuple[str, int]]) -> list[tuple[str, int]]:
    """[(mora, word)] with a long vowel as one mark however it is spelt
    (こう, こお, コー, けい, せえ): two readings that sound alike are equal."""
    out, last = [], ""
    for mora, word in morae:
        if mora == "-" or (mora in _VOWELS and (mora == last or (last + mora) in ("ou", "ei"))):
            if not out or out[-1][0] != "-":
                out.append(("-", word))
            continue
        out.append((mora, word))
        last = mora[-1] if mora[-1] in _VOWELS else ""
    return out


def printed_morae(words: list) -> list[tuple[str, int]] | None:
    """[(mora, word)] as the page prints the line, a particle said as it
    is (は wa, へ e, を o), or None where a reading is not kana."""
    out = []
    for i, (text, reading, particle) in enumerate(words):
        if not reading:
            continue
        if particle:
            reading = re.sub("^[へを]", lambda m: {"へ": "え", "を": "お"}[m[0]], re.sub("は$", "わ", reading))
        elif text.endswith("は") and _KANJI.search(text):
            reading = re.sub("は$", "わ", reading)  # 実は, 又は, 今日は: the particle grown into the word
        morae = kana_morae(reading)
        if morae is None:
            return None
        out += [(m, i) for m in morae]
    return out


def misread(words: list, query: dict) -> set[int]:
    """The words written with a kanji that the query reads otherwise
    than the page prints them."""
    printed = printed_morae(words)
    if not printed:
        return set()
    want = _folded(printed)
    heard = _folded([(m, -1) for m in heard_morae(query)])
    off = set()
    matcher = difflib.SequenceMatcher(None, [m for m, _ in want], [m for m, _ in heard], autojunk=False)
    for op, i1, i2, _, _ in matcher.get_opcodes():
        if op != "equal":
            # Morae said in place of none are the words either side's.
            off |= {want[k][1] for k in (range(i1, i2) if i2 > i1 else (i1 - 1, i1)) if 0 <= k < len(want)}
    return {i for i in off if _KANJI.search(words[i][0])}


def said_text(text: str) -> str:
    """A line as the engine is handed it: a quotation opened with a pause
    and closed with none."""
    return _QUOTES.sub("", _QUOTE_OPEN.sub("、", text))


def held_query(text: str, words: list, style: int) -> tuple[str, dict, set[int]]:
    """The audio query a line is said from, held to its words: the text
    the engine was handed, its query, and the words it still reads
    otherwise (none, but where neither kana helps)."""
    said = said_text(text)
    query = engine_query(said, style)
    if "".join(w[0] for w in words) != text:
        return said, query, set()
    wrong = misread(words, query)
    best = (said, query, wrong)
    respelt: dict[int, str] = {}
    for kana in (hiragana, katakana):
        if not wrong:
            break
        respelt.update({i: kana(words[i][1]) for i in wrong})
        said = said_text("".join(respelt.get(i, w[0]) for i, w in enumerate(words)))
        query = engine_query(said, style)
        wrong = misread(words, query)
        if len(wrong) < len(best[2]):
            best = (said, query, wrong)
    return best


def engine_query(text: str, style: int) -> dict:
    from study import voice_engine as engine
    return engine.audio_query(text, style)


def line_query(cue: dict, style: int, quiet: bool = False) -> dict:
    """A held line's audio query (held_query), saying where it was
    handed over otherwise than written, or is still read otherwise."""
    said, query, wrong = held_query(cue["text"], cue["words"], style)
    if not quiet and said != cue["text"]:
        print(f"  {cue['text']}: said as {said}")
    if wrong:
        print(f"  {cue['text']}: still read otherwise than printed: {', '.join(cue['words'][i][0] for i in sorted(wrong))}",
              file=sys.stderr)
    return query


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


def mora_marks(query: dict, speed: float) -> list[dict]:
    """When each mora of an audio query starts in its clip, in seconds:
    the engine lays the lead-in silence, each mora's consonant and vowel
    and each pause at its length, all divided by the speed (a pause is
    marked `p`). Within a frame (about 11ms) of the clip it makes."""
    t = float(query.get("prePhonemeLength", 0.1))
    out = []
    for phrase in query.get("accent_phrases", []):
        for mora in phrase.get("moras", []):
            out.append({"t": round(t / speed, 3), "k": mora.get("text", "")})
            t += float(mora.get("consonant_length") or 0) + float(mora.get("vowel_length") or 0)
        pause = phrase.get("pause_mora")
        if pause:
            out.append({"t": round(t / speed, 3), "k": "、", "p": 1})
            t += float(pause.get("vowel_length") or 0)
    return out


def voice(cues_path: Path, cache: Path, out: Path) -> int:
    from study import voice_engine as engine
    cues = json.loads(cues_path.read_text(encoding="utf-8"))
    cache.mkdir(parents=True, exist_ok=True)
    rev = engine.VOICE_REV
    durs, marks, files, failed = {}, {}, {}, []
    unique = {cue_key(c): c for c in cues}
    todo = [c for c in unique.values() if not (cache / clip_name(c, rev)).exists()]
    print(f"{len(unique)} line(s), {len(todo)} to voice (voice {rev}).")
    for i, cue in enumerate(unique.values(), 1):
        path = cache / clip_name(cue, rev)
        kana = kana_clip(cue["text"])
        if not path.exists() and kana:
            write_wav(path, from_kana_clip(kana), VOICE_RATE)
        slot = SLOTS.get(cue["who"], 0)
        speed = engine.tempo_for_slot(slot) * (SLOW if cue.get("slow") else 1.0)
        # What the line is said from: as printed where it carries its words.
        query = None
        if not path.exists():
            try:
                style = engine.style_for_slot(slot)
                if held(cue) and engine.lone_kana_notation(cue["text"]) is None:
                    query = line_query(cue, style)
                    pcm = engine.synthesize(query, style, speed=speed, sample_rate=VOICE_RATE)
                else:
                    pcm = engine.say(cue["text"], style, speed=speed, sample_rate=VOICE_RATE)
            except Exception as e:  # noqa: BLE001 -- reported; the line goes unsaid
                failed.append(cue["text"])
                print(f"  {cue['text']}: {type(e).__name__}: {e}", file=sys.stderr)
                continue
            write_wav(path, pcm.frames, pcm.rate)
        with wave.open(str(path)) as w:
            durs[cue_key(cue)] = round(w.getnframes() / w.getframerate(), 3)
        # Where it is: a feature's video plays it in the app it records (plan 270).
        files[cue_key(cue)] = str(path)
        if cue.get("marks") and not kana:
            try:
                if query is None:
                    style = engine.style_for_slot(slot)
                    query = line_query(cue, style, quiet=True) if held(cue) else engine.audio_query(cue["text"], style)
                marks[cue_key(cue)] = mora_marks(query, speed)
            except Exception as e:  # noqa: BLE001 -- the words are then lit in proportion
                print(f"  {cue['text']}: no syllables ({type(e).__name__}: {e})", file=sys.stderr)
        if i % 50 == 0:
            print(f"  {i}/{len(unique)}")
    out.write_text(json.dumps({"rev": rev, "durs": durs, "marks": marks, "files": files}, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"wrote {out}: {len(durs)} line(s); {len(failed)} failed.")
    return 1 if failed else 0


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


# The whole mix's last moment, faded: a chime's tail never stops on a cut.
END_FADE_S = 0.3


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
    # The voice at the front, the app's sounds under it.
    peak = float(np.abs(voice_track).max()) or 1
    voice_track *= 0.7 / peak
    left = voice_track + fx[:, 0] * 0.5
    right = voice_track + fx[:, 1] * 0.5
    stereo = np.stack([left, right], axis=1)
    # As loud as a video on YouTube: the voice where it speaks at LOUD, its
    # few peaks above the ceiling held down by a limiter rather than the
    # whole video turned down for them.
    speaking = np.abs(voice_track) > 0.02
    rms = float(np.sqrt(np.mean(stereo[speaking, 0] ** 2))) if speaking.any() else 0.1
    stereo *= 10 ** (LOUD / 20) / max(rms, 1e-6)
    stereo = limited(stereo)
    stereo = stereo[: int(seconds * RATE)]
    tail = min(len(stereo), int(END_FADE_S * RATE))
    if tail:
        stereo[-tail:] *= np.linspace(1, 0, tail, dtype=np.float32)[:, None]
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
    m = sub.add_parser("mix", help="lay the lines and the sounds on the timeline")
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
