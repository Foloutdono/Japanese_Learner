"""
Make the kana deck's syllables: one clip per sound, from the voice
engine, into frontend/public/sounds/kanas/.

    python -m scripts.build_kana_audio --check      # what is missing, stray or off-spec
    python -m scripts.build_kana_audio              # make what is missing
    python -m scripts.build_kana_audio --force      # remake every clip
    python -m scripts.build_kana_audio --only ka kya wo_foreign

-- Why synthesis, when the README once refused it -------------------
frontend/public/sounds/README.md turned speech synthesis down for the
kana because "a lone mora gives a TTS engine no prosody to work with,
and it reads as a letter name rather than a sound" -- and, read as TEXT,
it does: the engine takes a lone は for the topic particle and says
"wa". This script never hands the engine text. It hands it the kana
NOTATION (study/voice_engine.say_kana): 「ハ'」 is the syllable "ha",
with the pitch where the mark puts it, and nothing is left to guess.

The set it replaced was 102 recordings of undocumented origin, forty of
them clipping, with 24 of the deck's sounds missing outright (the long
vowels, ファ ティ ヴ and the rest) and ウォ borrowing を's file. Plan 113.

-- What one clip is ---------------------------------------------
The README's spec, for a re-recording: one voice, 48 kHz mono, peak no
higher than -3 dBFS, trimmed to the syllable with ~20 ms of air each
side. On top of that, the file's loudness is set to what
lib/audio/playback.js aims every kana at (TARGET_RMS), so the playback
correction there has little left to do -- it measures the whole buffer,
and so does this.

-- Which clip is which ---------------------------------------------
Files are named by content/kana_data.sound_of(entry): the romaji, which
already files twins together (あ/ア, を/ヲ, じ/ぢ...), except for ウォ.
Every entry that shares a name must come out as the same notation, and
the script stops if two do not -- that would be one file asked to say
two things.

Needs the voice engine (VOICEVOX_URL, see backend/.env.example) and
nothing else: no database. The clips are committed; the credit they
carry ("VOICEVOX Nemo") and the ban on using them for machine learning
are in THIRD_PARTY_NOTICES.md. A remade set is a new KANA_REV in
lib/audio/playback.js, or returning learners keep the old one for a year.
"""
import argparse
import logging
import math
import os
import sys
from array import array
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)

from content.kana_data import get_all_kana, sound_of  # noqa: E402
from study import voice_engine  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)  # a line per request otherwise
logger = logging.getLogger("build_kana_audio")

OUT_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public" / "sounds" / "kanas"

RATE = 48000
KBPS = 96
# playback.js's TARGET_RMS (about -19 dBFS), measured the way it measures
# it: over the whole buffer, air included.
TARGET_RMS = 0.11
PEAK_CEILING = 10 ** (-3 / 20)          # -3 dBFS
_GATE = 32767 * 10 ** (-50 / 20)        # -50 dBFS: where the syllable starts and ends
_AIR_S = 0.020
_FADE_S = 0.005
# Engine-side padding, trimmed away again below: enough that the gate,
# not the engine, decides where the syllable begins.
_ENGINE_PAD_S = 0.08

_SMALL = set("ァィゥェォャュョ")
_VOWEL_OF = {}
for _row, _vowel in (("アカサタナハマヤラワガザダバパャ", "ア"), ("イキシチニヒミリギジヂビピィ", "イ"),
                     ("ウクスツヌフムユルグズヅブプュゥヴ", "ウ"), ("エケセテネヘメレゲゼデベペェ", "エ"),
                     ("オコソトノホモヨロヲゴゾドボポョォ", "オ")):
    for _kana in _row:
        _VOWEL_OF[_kana] = _vowel

# The two long spellings whose sound is not their letters: the lesson
# (kana_data.py, 長音) teaches えい as ē and おう as ō, so that is what
# the learner must hear. ああ, いい, おい and the rest say what they spell.
SPOKEN_AS = {"えい": "エエ", "おう": "オオ"}
# ヂ and ヅ are ジ and ズ to the engine; folded before two entries sharing
# a file are compared.
_SAME_SOUND = str.maketrans({"ヂ": "ジ", "ヅ": "ズ"})


def notation(kana: str) -> str:
    """The kana notation that says `kana` as the deck teaches it:
    katakana, ー spelled out as the vowel it lengthens, and the accent
    mark after the first mora ("キャ'", "ア'ア")."""
    spoken = SPOKEN_AS.get(kana) or voice_engine.to_katakana(kana)
    chars = []
    for ch in spoken:
        if ch == "ー":
            if not chars or chars[-1] not in _VOWEL_OF:
                raise ValueError(f"{kana!r}: ー with no vowel before it")
            ch = _VOWEL_OF[chars[-1]]
        chars.append(ch)
    first = 2 if len(chars) > 1 and chars[1] in _SMALL else 1
    return "".join(chars[:first]) + "'" + "".join(chars[first:])


def plan() -> dict[str, dict]:
    """sound name -> {"notation", "kana": [every entry filed under it]}.
    Raises ValueError when two entries sharing a name would say
    different things."""
    by_sound: dict[str, dict] = {}
    for entry in get_all_kana():
        name = sound_of(entry)
        said = notation(entry["kana"])
        slot = by_sound.setdefault(name, {"notation": said, "kana": []})
        if said.translate(_SAME_SOUND) != slot["notation"].translate(_SAME_SOUND):
            raise ValueError(
                f"{name}.mp3 would have to say both {slot['notation']} ({slot['kana'][0]}) "
                f"and {said} ({entry['kana']}): give one of them its own \"sound\" in kana_data.py"
            )
        slot["kana"].append(entry["kana"])
    return by_sound


def finish(pcm: voice_engine.Pcm) -> tuple[bytes, dict]:
    """Trim to the syllable, air and fades either side, loudness to
    TARGET_RMS under the peak ceiling -> 16-bit samples, and the numbers
    for the report."""
    samples = array("h", pcm.frames)
    loud = [i for i, s in enumerate(samples) if abs(s) > _GATE]
    if not loud:
        raise voice_engine.TTSFailed("nothing above the gate")
    body = [s / 32768 for s in samples[loud[0]:loud[-1] + 1]]
    fade = int(_FADE_S * pcm.rate)
    for i in range(min(fade, len(body) // 2)):
        body[i] *= i / fade
        body[-1 - i] *= i / fade
    air = [0.0] * int(_AIR_S * pcm.rate)
    signal = air + body + air

    rms = math.sqrt(sum(x * x for x in signal) / len(signal))
    peak = max(abs(x) for x in signal)
    gain = min(TARGET_RMS / rms, PEAK_CEILING / peak)
    out = array("h", (max(-32768, min(32767, round(x * gain * 32768))) for x in signal))
    report = {
        "seconds": len(signal) / pcm.rate,
        "peak_db": 20 * math.log10(peak * gain),
        "rms_db": 20 * math.log10(rms * gain),
        "gain_db": 20 * math.log10(gain),
    }
    return out.tobytes(), report


def _check(sounds: dict[str, dict], out_dir: Path) -> int:
    problems = 0
    present = {p.stem for p in out_dir.glob("*.mp3")}
    for name in sorted(sounds):
        path = out_dir / f"{name}.mp3"
        if not path.exists():
            logger.info("  missing  %-11s %s", name, " ".join(sounds[name]["kana"]))
            problems += 1
            continue
        info = voice_engine.mp3_summary(path.read_bytes())
        if (info["sample_rate"], info["channels"], info["kbps"]) != (RATE, 1, [KBPS]):
            logger.info("  off-spec %-11s %s Hz, %s ch, %s kbps", name,
                        info["sample_rate"], info["channels"], info["kbps"])
            problems += 1
    for stray in sorted(present - set(sounds)):
        logger.info("  stray    %s.mp3 (no kana is filed under it)", stray)
        problems += 1
    logger.info("%d sound(s), %d problem(s).", len(sounds), problems)
    return 1 if problems else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--check", action="store_true",
                        help="report missing, stray and off-spec files; make nothing")
    parser.add_argument("--force", action="store_true", help="remake clips that exist")
    parser.add_argument("--only", nargs="+", metavar="NAME", help="only these sound names")
    parser.add_argument("--voice", help="voice name (default: the reader's, slot 0)")
    parser.add_argument("--speed", type=float, default=1.0, help="speedScale (default 1.0)")
    parser.add_argument("--out", type=Path, default=OUT_DIR, help=f"directory (default {OUT_DIR})")
    args = parser.parse_args()

    try:
        sounds = plan()
    except ValueError as e:
        logger.error("%s", e)
        return 1
    if args.check:
        return _check(sounds, args.out)

    names = sorted(sounds)
    if args.only:
        unknown = sorted(set(args.only) - set(sounds))
        if unknown:
            logger.error("No kana is filed under: %s", ", ".join(unknown))
            return 1
        names = sorted(args.only)
    if not args.force:
        names = [n for n in names if not (args.out / f"{n}.mp3").exists()]
    if not names:
        logger.info("Nothing to do.")
        return 0
    if not voice_engine.configured():
        logger.error("No voice engine configured: set VOICEVOX_URL (see backend/.env.example).")
        return 1

    voice = args.voice or voice_engine.voices()[0]
    try:
        style = voice_engine.style_named(voice)
    except voice_engine.TTSFailed as e:
        logger.error("%s", e)
        return 1
    logger.info("Voice %s (style %d), %d clip(s) into %s", voice, style, len(names), args.out)
    logger.info("  %-11s %-8s %6s %7s %7s %7s  kana", "name", "notation", "len", "peak", "rms", "gain")
    args.out.mkdir(parents=True, exist_ok=True)

    failed = []
    for name in names:
        said = sounds[name]["notation"]
        try:
            pcm = voice_engine.say_kana(said, style, speed=args.speed, sample_rate=RATE,
                                        level_pitch=True, pad=_ENGINE_PAD_S,
                                        hold=voice_engine.LONE_KANA_HOLD_S)
            frames, report = finish(pcm)
            data = voice_engine.encode_mp3(voice_engine.Pcm(frames, RATE), kbps=KBPS)
        except voice_engine.TTSFailed as e:
            failed.append(f"{name} ({e})")
            continue
        partial = args.out / f".{name}.mp3.part"
        partial.write_bytes(data)
        os.replace(partial, args.out / f"{name}.mp3")
        logger.info("  %-11s %-8s %5.2fs %6.1fdB %6.1fdB %+6.1fdB  %s", name, said, report["seconds"],
                    report["peak_db"], report["rms_db"], report["gain_db"], " ".join(sounds[name]["kana"]))

    logger.info("Made %d clip(s).", len(names) - len(failed))
    if failed:
        logger.error("%d failed:", len(failed))
        for line in failed:
            logger.error("  %s", line)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
