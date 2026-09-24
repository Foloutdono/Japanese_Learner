"""
Synthesize the whole listening collection, so every clip is on disk
before a learner asks for it.

    python -m scripts.build_dictation_audio            # make what is missing
    python -m scripts.build_dictation_audio --level N5 # one level only
    python -m scripts.build_dictation_audio --check    # report, synthesize nothing
    python -m scripts.build_dictation_audio --force    # re-make clips that exist

-- Why this exists at all -------------------------------------
routes/dictation.py already synthesizes a missing clip on the request
that wants it, so the collection is never broken without this script.
What the script buys is that the FIRST learner of the day does not pay
for it: a batch of five unmade clips is five syntheses on the voice
engine (study/voice_engine.py) before the screen can show anything.

So this is a warm-up, not a migration. Nothing depends on having run it,
running it twice costs nothing (a clip the current voice already made
is skipped without a call to the engine), and it needs no database —
unlike every other script here, which is why it does not import
scripts._env: that module demands DATABASE_URL, and this job has nothing
to say to Postgres. It reads backend/.env for VOICEVOX_URL (the engine,
required) and EXAM_AUDIO_DIR (where to write, optional).

-- Where the files go ----------------------------------------
study/exam_tts.audio_dir() decides, exactly as it does for exam audio
and for study/word_tts.py's word clips: EXAM_AUDIO_DIR if it is
writable, backend/datas/exam_audio otherwise. The clips are named by
content key, so this script cannot produce a file the app then fails to
find — both sides derive the name from the same text.
"""
import argparse
import logging
import os
from pathlib import Path

from dotenv import load_dotenv

# Before the study imports: exam_tts resolves (and caches) its audio
# directory the first time it is asked, and EXAM_AUDIO_DIR has to be in
# the environment by then. override=False so `EXAM_AUDIO_DIR=/tmp/x
# python -m scripts.build_dictation_audio` still does what it looks
# like.
load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)

from content.listening_clips import BY_LEVEL, LEVELS, all_clips   # noqa: E402
from study import dictation                                        # noqa: E402
from study import voice_engine                                     # noqa: E402
from study.exam_tts import TTSFailed, audio_dir, is_current, synthesize_dialogue  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("build_dictation_audio")


def _rows(level: str | None) -> list[dict]:
    if level is None:
        return all_clips()
    return [dict(row, level=level) for row in BY_LEVEL[level]]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--level", choices=LEVELS, help="only this level")
    parser.add_argument("--check", action="store_true",
                        help="report which clips are missing and stop")
    parser.add_argument("--force", action="store_true",
                        help="re-synthesize clips that already exist")
    args = parser.parse_args()

    directory = audio_dir()
    rows = _rows(args.level)
    logger.info("%d lines, audio in %s", len(rows), directory)

    # Missing, or made by an earlier voice (study/exam_tts.py's voice
    # epoch) -- the two are the same thing to a learner about to hear it.
    missing = [r for r in rows
               if not is_current(os.path.join(directory, f"{dictation.clip_id(r['jp'])}.mp3"))]
    logger.info("%d already there, %d missing or stale.", len(rows) - len(missing), len(missing))

    if args.check:
        for row in missing:
            logger.info("  missing %s  %s", row["level"], row["jp"])
        return 0

    todo = rows if args.force else missing
    if not todo:
        logger.info("Nothing to do.")
        return 0
    if not voice_engine.configured():
        logger.error("No voice engine configured: set VOICEVOX_URL (see backend/.env.example).")
        return 1

    made = 0
    failed: list[str] = []
    for i, row in enumerate(todo, 1):
        try:
            # Through dictation's own rate, not the engine's default:
            # the rate is part of the content key, so synthesizing
            # without it writes a file the app never asks for. `force`
            # remakes a clip that exists, in place -- the old one keeps
            # being served until the new one is renamed over it, so a
            # failure here leaves the collection as it was.
            synthesize_dialogue(dictation.clip_turns(row["jp"]), dictation.RATE, force=args.force)
        except TTSFailed as e:
            failed.append(f"{row['jp']} ({e})")
            continue
        made += 1
        logger.info("  [%d/%d] %s  %s", i, len(todo), row["level"], row["jp"])

    logger.info("Synthesized %d clip(s).", made)
    if failed:
        # A partial run is fine and re-running finishes it, so this is a
        # report rather than a rollback -- but it exits non-zero, because
        # a warm-up that half-ran should not read as a success in CI or
        # in a deploy hook.
        logger.error("%d failed:", len(failed))
        for line in failed:
            logger.error("  %s", line)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
