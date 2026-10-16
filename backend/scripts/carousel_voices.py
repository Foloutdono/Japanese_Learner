"""
The carousel studio's voices (plan 232): the reading of every word the
theme decks draw in a picture, said by the app's own reader, for the
word echo (frontend/carousel/echo.js), which says one word over and
over for ten seconds and needs the sound in the page, not behind the
app's /api/tts.

Each clip is said by the app's reader (the voice in slot 0, at its
tempo, encoded as a card's clip is), with more energy than the app's
own: ENERGY, the owner's pick by ear from three takes (plan 232, "B,
lively"), lifts its intonation, pace, pitch and level. Only a reading
the app says is made (word_tts.speakable), and a lone kana is said by
its notation as the app says it. It needs the voice engine
(VOICEVOX_URL, CLAUDE.md "Speech") and nothing else: no database. The
clips are written into frontend/carousel/voices/, one per reading, with
index.json naming each, the voice's revision (voice_engine.VOICE_REV,
which a test holds equal to the app's) and the energy: a new voice, or
new energy, means running this again.

The licence's one condition is the credit "VOICEVOX Nemo", which the
echo draws on its frame; it also forbids the audio's use for machine
learning (CLAUDE.md), so never publish these clips as a dataset.

    python -m scripts.carousel_voices            # report what is missing or stale
    python -m scripts.carousel_voices --yes      # make it, and drop clips nothing names

Run it after a change to the theme decks (frontend/carousel/bank/themes.json,
written by scripts.carousel_bank) or to the voice, and commit the files.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
CAROUSEL = BACKEND.parent / "frontend" / "carousel"
THEMES = CAROUSEL / "bank" / "themes.json"
OUT = CAROUSEL / "voices"


def pictured_readings() -> list[str]:
    """Every reading a theme draws in a picture, once, in the bank's order."""
    themes = json.loads(THEMES.read_text(encoding="utf-8"))["themes"]
    seen: dict[str, None] = {}
    for theme in themes.values():
        for word in theme["words"]:
            if word.get("e") and word.get("r"):
                seen.setdefault(word["r"], None)
    return list(seen)


# The echo's delivery: the app's reader, livelier (plan 232's take B).
# Speed multiplies the reader's own tempo; the rest is voice_engine.say's tone.
ENERGY = {"speed": 1.1, "intonationScale": 1.45, "pitchScale": 0.04, "volumeScale": 1.15}


def file_for(reading: str) -> str:
    """A reading's clip name: stable, plain ASCII for any server, and
    new when the energy is, so a browser never plays the old take."""
    key = reading + json.dumps(ENERGY, sort_keys=True)
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:12] + ".mp3"


def make(reading: str) -> bytes:
    """The reading said by the app's reader, with ENERGY, as an mp3."""
    from study import voice_engine as engine
    from study.exam_tts import READER_SLOT
    tone = {k: v for k, v in ENERGY.items() if k != "speed"}
    pcm = engine.say(reading, engine.style_for_slot(READER_SLOT),
                     speed=engine.tempo_for_slot(READER_SLOT) * ENERGY["speed"], tone=tone)
    return engine.encode_mp3(pcm, kbps=engine.DIALOGUE_KBPS)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--yes", action="store_true", help="make the clips (needs VOICEVOX_URL) and write index.json")
    args = ap.parse_args()

    from study import voice_engine
    from study.word_tts import speakable

    readings = pictured_readings()
    index_path = OUT / "index.json"
    old = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {"rev": None, "words": {}}
    stale = old.get("rev") != voice_engine.VOICE_REV or old.get("energy") != ENERGY
    unsaid = [r for r in readings if not speakable(r)]
    wanted = [r for r in readings if r not in unsaid]
    missing = [r for r in wanted if stale or old["words"].get(r) != file_for(r) or not (OUT / file_for(r)).exists()]
    print(f"{len(readings)} pictured readings; {len(wanted)} the app says, {len(unsaid)} it does not.")
    if unsaid:
        print("  not in the app's catalogue (no clip, the echo will not offer them):", "、".join(unsaid))
    print(f"voice {voice_engine.VOICE_REV} with energy {ENERGY} (index.json: {old.get('rev')}, {old.get('energy')}); {len(missing)} clip(s) to make.")
    if not args.yes:
        print("Nothing written. Run again with --yes (and VOICEVOX_URL set) to make them.")
        return 1 if missing else 0

    OUT.mkdir(parents=True, exist_ok=True)
    words = {}
    failed = []
    for i, reading in enumerate(wanted, 1):
        name = file_for(reading)
        if reading not in missing and (OUT / name).exists():
            words[reading] = name
            continue
        try:
            (OUT / name).write_bytes(make(reading))
            words[reading] = name
        except Exception as e:  # noqa: BLE001 -- reported, the run goes on
            failed.append(reading)
            print(f"  {reading}: {type(e).__name__}: {e}", file=sys.stderr)
        if i % 50 == 0:
            print(f"  {i}/{len(wanted)}")
    index = {"rev": voice_engine.VOICE_REV, "energy": ENERGY, "credit": "VOICEVOX Nemo", "words": dict(sorted(words.items()))}
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    named = set(words.values())
    dropped = [f for f in OUT.glob("*.mp3") if f.name not in named]
    for f in dropped:
        f.unlink()
    print(f"wrote {len(words)} clip(s) and index.json; dropped {len(dropped)}; {len(failed)} failed.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
