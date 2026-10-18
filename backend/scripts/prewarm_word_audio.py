"""
Make the word clips a learner will ask for, ahead of the learner (plan 209).

    python -m scripts.prewarm_word_audio                  # report; makes nothing
    python -m scripts.prewarm_word_audio --yes            # N5, N4 and N3
    python -m scripts.prewarm_word_audio --level N5 --yes # one level only

-- Why this exists ---------------------------------------------
/api/tts makes a word's clip on the first request that wants it
(study/word_tts.clip_for), so nothing is broken without this script. What
it buys is that nobody pays for that first time: a clip takes about 2 s
on the voice service at Starter's 0.5 CPU, one at a time, so a burst of
words nobody has heard yet queues behind a single thread and the last
ones in it time out (a 503, and silence on the card). Run on a quiet
night, this does the waiting once, for everyone.

-- Which words -----------------------------------------------
Exactly the ones a card sends: the first reading of every vocab and
kanji entry at the levels asked for (word_tts.deck_readings), because a
card speaks `card.kana` and never its written form. Nothing outside the
decks can be made by it; the route would refuse the same text.

For N5, N4 and N3 that is 3,022 readings (September 2026's decks):
about 1.7 hours at 2 s each, and about 30 MB, under the 100 MB the word
store is capped at (word_tts._MAX_BYTES), so nothing it makes is evicted.
N2 would bring it to 4,626 (2.6 hours, 45 MB) and N1 to 7,301 (4.1 hours,
71 MB), which still fits; the report warns if a later deck pushes the
levels asked for past the cap.

-- Safe to stop, safe to run twice -----------------------------
Without --yes it only reports -- like every operator script here -- how
many clips each level has, how many are missing, and how long making
them would take. With it, a clip the current voice already made is
skipped without a call to the engine, so a second run resumes where an
interrupted one stopped, and a run on a finished store reports nothing to
do. It makes clips one at a time, so it adds one request to the engine's
queue while it runs: a quiet hour is kinder to learners, but nothing
breaks at a busy one.

After a change of voice (study/voice_engine.VOICE_REV) run it again:
revoice_audio deletes the word clips, which are disposable by design, and
this is what makes them again before anyone asks.

-- Where it runs ---------------------------------------------
From the backend's own shell (Render Shell), which holds EXAM_AUDIO_DIR
and VOICEVOX_URL, and where the disk the clips live on is mounted. It
needs no database, so, like build_dictation_audio, it does not import
scripts._env, which demands DATABASE_URL; it reads backend/.env if there
is one.
"""
import argparse
import logging
import time
from pathlib import Path

from dotenv import load_dotenv

# Before the study imports: exam_tts resolves (and caches) its audio
# directory the first time it is asked, and EXAM_AUDIO_DIR has to be in
# the environment by then. override=False, so a variable set on the
# command line still wins.
load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)

from study import voice_engine                                  # noqa: E402
from study import word_tts                                      # noqa: E402
from study.exam_tts import TTSFailed                            # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("prewarm_word_audio")

LEVELS = ("N5", "N4", "N3", "N2", "N1")
DEFAULT_LEVELS = ("N5", "N4", "N3")

# What the report assumes a clip costs. Measured on the engine at
# Starter's 0.5 CPU (docs/adr/0019), and a bound rather than a promise:
# the first clip after the engine wakes is slower.
SECONDS_PER_CLIP = 2.0
# What the store holds per clip (word_tts's own estimate, "~10 KB a
# spoken word"), for the warning that the levels asked for would not fit.
BYTES_PER_CLIP = 10 * 1024

# After this many failures in a row the engine is down, not the words
# difficult: stop, rather than log thousands of the same error. A rerun
# resumes from where this left off.
MAX_CONSECUTIVE_FAILURES = 5
PROGRESS_EVERY = 50


def _hours(seconds: float) -> str:
    return f"{seconds / 3600:.1f} h" if seconds >= 3600 else f"{seconds / 60:.0f} min"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--level", action="append", choices=LEVELS,
                        help=f"a level to make (repeat for several; default {' '.join(DEFAULT_LEVELS)})")
    parser.add_argument("--yes", action="store_true",
                        help="make the missing clips (without it, only report)")
    args = parser.parse_args(argv)
    levels = tuple(args.level) if args.level else DEFAULT_LEVELS

    # Each reading once, under the first level that has it, so the
    # per-level counts add up to the total and a word shared by N5 and N3
    # is made (and counted) once.
    seen: set[str] = set()
    wanted: list[str] = []
    for level in levels:
        forms = [f for f in word_tts.deck_readings([level]) if f not in seen]
        seen.update(forms)
        wanted.extend(forms)
        made = sum(1 for f in forms if word_tts.is_made(f))
        logger.info("%s: %d readings, %d already made, %d missing", level, len(forms), made, len(forms) - made)

    missing = [f for f in wanted if not word_tts.is_made(f)]
    logger.info("Total: %d readings, %d already made, %d missing.",
                len(wanted), len(wanted) - len(missing), len(missing))
    logger.info("Clips go in %s", word_tts.words_dir())

    if len(wanted) * BYTES_PER_CLIP > word_tts._MAX_BYTES:
        logger.warning(
            "These %d clips would come to about %d MB, past the %d MB the word store is capped at: "
            "the oldest would be evicted as new ones are made. Ask for fewer levels.",
            len(wanted), len(wanted) * BYTES_PER_CLIP // (1024 * 1024), word_tts._MAX_BYTES // (1024 * 1024))

    if not missing:
        logger.info("Nothing to do.")
        return 0
    logger.info("Making them would take about %s on the engine.", _hours(len(missing) * SECONDS_PER_CLIP))
    if not args.yes:
        logger.info("Report only. Run again with --yes to make them.")
        return 0
    if not voice_engine.configured():
        logger.error("No voice engine configured: set VOICEVOX_URL (see backend/.env.example).")
        return 1

    started = time.monotonic()
    made = 0
    failed: list[str] = []
    streak = 0
    for i, form in enumerate(missing, 1):
        try:
            word_tts.clip_for(form)
        except TTSFailed as e:
            failed.append(f"{form} ({e})")
            streak += 1
            if streak >= MAX_CONSECUTIVE_FAILURES:
                logger.error("%d failures in a row: the voice engine looks down. Stopping; "
                             "a rerun resumes from here.", streak)
                break
            continue
        streak = 0
        made += 1
        if made % PROGRESS_EVERY == 0:
            rate = (time.monotonic() - started) / made
            logger.info("  [%d/%d] made %d, about %s left", i, len(missing), made,
                        _hours(rate * (len(missing) - i)))

    logger.info("Made %d clip(s).", made)
    if failed:
        # A partial run is fine and a rerun finishes it, so this is a
        # report rather than a rollback -- but it exits non-zero, so a
        # warm-up that half-ran does not read as a success.
        logger.error("%d failed:", len(failed))
        for line in failed[:20]:
            logger.error("  %s", line)
        if len(failed) > 20:
            logger.error("  ... and %d more", len(failed) - 20)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
