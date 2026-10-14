"""
The carousel studio's voices (plan 213): the reading of every word the
theme decks draw in a picture, said by the app's own reader, for the
word echo (frontend/carousel/echo.js), which says one word over and
over for ten seconds and needs the sound in the page, not behind the
app's /api/tts.

Each clip is made by the path a card's speaker button takes
(study/word_tts.clip_for: the reader's voice, slot 0, at its tempo,
encoded as the app encodes it), so the echo says a word exactly as the
app does. It needs the voice engine (VOICEVOX_URL, CLAUDE.md "Speech")
and nothing else: no database. The clips are copied into
frontend/carousel/voices/, one per reading, with index.json naming each
and the voice's revision (voice_engine.VOICE_REV), which a test holds
equal to the app's: a new voice means running this again.

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
import os
import shutil
import sys
import tempfile
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


def file_for(reading: str) -> str:
    """A reading's clip name: stable, and plain ASCII for any server."""
    return hashlib.sha1(reading.encode("utf-8")).hexdigest()[:12] + ".mp3"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--yes", action="store_true", help="make the clips (needs VOICEVOX_URL) and write index.json")
    args = ap.parse_args()

    # The clip store is word_tts's own (EXAM_AUDIO_DIR/words); outside a
    # deployment a scratch one, so nothing lands in datas/.
    os.environ.setdefault("EXAM_AUDIO_DIR", tempfile.mkdtemp(prefix="carousel-voices-"))
    from study import voice_engine
    from study.word_tts import clip_for, speakable

    readings = pictured_readings()
    index_path = OUT / "index.json"
    old = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {"rev": None, "words": {}}
    stale = old.get("rev") != voice_engine.VOICE_REV
    unsaid = [r for r in readings if not speakable(r)]
    wanted = [r for r in readings if r not in unsaid]
    missing = [r for r in wanted if stale or r not in old["words"] or not (OUT / old["words"][r]).exists()]
    print(f"{len(readings)} pictured readings; {len(wanted)} the app says, {len(unsaid)} it does not.")
    if unsaid:
        print("  not in the app's catalogue (no clip, the echo will not offer them):", "、".join(unsaid))
    print(f"voice {voice_engine.VOICE_REV} (index.json: {old.get('rev')}); {len(missing)} clip(s) to make.")
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
            shutil.copyfile(clip_for(reading), OUT / name)
            words[reading] = name
        except Exception as e:  # noqa: BLE001 -- reported, the run goes on
            failed.append(reading)
            print(f"  {reading}: {type(e).__name__}: {e}", file=sys.stderr)
        if i % 50 == 0:
            print(f"  {i}/{len(wanted)}")
    index = {"rev": voice_engine.VOICE_REV, "credit": "VOICEVOX Nemo", "words": dict(sorted(words.items()))}
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    named = set(words.values())
    dropped = [f for f in OUT.glob("*.mp3") if f.name not in named]
    for f in dropped:
        f.unlink()
    print(f"wrote {len(words)} clip(s) and index.json; dropped {len(dropped)}; {len(failed)} failed.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
