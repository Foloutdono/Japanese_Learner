"""
Synthesize the grammar tours' lines, so they are on disk before a learner
taps one (plan 187d).

    python -m scripts.build_grammar_audio            # make what is missing
    python -m scripts.build_grammar_audio --tours    # only the scenes and twists
    python -m scripts.build_grammar_audio --check    # report, synthesize nothing
    python -m scripts.build_grammar_audio --force    # re-make clips that exist

A warm-up, like scripts/build_dictation_audio.py: GET /api/grammar/audio
already makes a missing clip on the request that wants it, so nothing
depends on running this, and running it twice costs nothing (a clip the
current voice made is skipped). What it buys is that the first learner
to meet a point does not wait on the voice engine for every line.

No database: it reads backend/.env for VOICEVOX_URL (required) and
EXAM_AUDIO_DIR (where to write, optional), and writes the names
study/grammar_audio.py derives, so the app finds every file it makes.

`--tours` is the authored half alone -- the scenes, their replies and the
twists, a few hundred lines -- where the default also voices every
example sentence of the catalogue (~2,200).
"""
import argparse
import logging
import os
from pathlib import Path

from dotenv import load_dotenv

# Before the study imports, for build_dictation_audio's reason: the audio
# directory is resolved, and cached, the first time it is asked.
load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL   # noqa: E402
from study import grammar_audio, voice_engine                     # noqa: E402
from study.exam_tts import TTSFailed, is_current                   # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("build_grammar_audio")


def _tour_lines() -> set[tuple[str, str]]:
    out: set[tuple[str, str]] = set()
    for entries in GRAMMAR_POINTS_BY_LEVEL.values():
        for entry in entries:
            tour = entry.get("tour")
            if not tour:
                continue
            out.update((twist["jp"], "reader") for twist in tour["twists"])
            scene = tour["scene"]
            for line in [*scene["lines"], scene["ask"]["cue"]]:
                out.add((line["jp"], line["who"]))
            out.update((jp, "me") for jp in scene["ask"]["choices"])
    return out


def _rows(tours_only: bool) -> list[tuple[str, str]]:
    if tours_only:
        rows = _tour_lines()
    else:
        rows = {(text, who) for who, lines in grammar_audio.catalog().items() for text in lines}
    return sorted(rows, key=lambda r: (r[1], r[0]))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--tours", action="store_true", help="only the scenes, replies and twists")
    parser.add_argument("--check", action="store_true", help="report which clips are missing and stop")
    parser.add_argument("--force", action="store_true", help="re-synthesize clips that already exist")
    args = parser.parse_args()

    directory = grammar_audio.clip_dir()
    rows = _rows(args.tours)
    logger.info("%d lines, audio in %s", len(rows), directory)
    missing = [r for r in rows if not is_current(os.path.join(directory, grammar_audio.clip_name(*r)))]
    logger.info("%d already there, %d missing or stale.", len(rows) - len(missing), len(missing))

    if args.check:
        for text, who in missing:
            logger.info("  missing %-6s %s", who, text)
        return 0

    todo = rows if args.force else missing
    if not todo:
        logger.info("Nothing to do.")
        return 0
    if not voice_engine.configured():
        logger.error("No voice engine configured: set VOICEVOX_URL (see backend/.env.example).")
        return 1

    made, failed = 0, []
    for i, (text, who) in enumerate(todo, 1):
        try:
            grammar_audio.clip_for(text, who, force=args.force)
        except TTSFailed as e:
            failed.append(f"{who} {text} ({e})")
            continue
        made += 1
        logger.info("  [%d/%d] %-6s %s", i, len(todo), who, text)

    logger.info("Synthesized %d clip(s).", made)
    if failed:
        logger.error("%d failed:", len(failed))
        for line in failed:
            logger.error("  %s", line)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
