"""
Fill the phrase-breakdown cache for the curated reading bank.

    python -m scripts.prewarm_phrase_cache --dry-run
    python -m scripts.prewarm_phrase_cache --level N5
    python -m scripts.prewarm_phrase_cache --all

Reading practice fires POST /api/phrase/analyze in the background for
every phrase it shows, so the word-by-word breakdown is ready the moment
the reader asks for it (see ReadingScreen.jsx's fetchAnalysis). Those
calls are cached now -- see routes/phrase.py's phrase_analysis_cache --
which means each distinct sentence costs one model call ONCE, ever,
shared across every user.

Running this turns that "once" into "zero on the user's path": the whole
curated bank (content/reading_sentences, ~220 sentences) is analysed here
instead, ahead of time. After a run, a reader at any level gets an
instant breakdown on every curated sentence without a single request
leaving the server.

Resumable and idempotent: an already-cached phrase is skipped, so a
re-run after a rate limit or an interruption only pays for what is still
missing. Bump routes/phrase.CACHE_VERSION to force a rebuild.
"""
import argparse
import logging
import sys
import time

import scripts._env  # noqa: F401  -- must precede the route import, which
#                       reads the provider API keys at module scope.
from content.reading_sentences import BY_LEVEL
from routes.phrase import _cached_analysis, _call_llm, _store_analysis
from study.llm_shared import llm_configured

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("prewarm-phrases")

# The model is called in a loop here, not on anyone's request path, so a
# pause between calls costs nothing and keeps a free-tier key under its
# per-minute limit rather than burning the retry budget on 429s.
PAUSE_SECONDS = 1.0


def phrases_for(levels: list[str]) -> list[tuple[str, str]]:
    """(level, sentence) for every curated sentence at those levels."""
    return [(level, row["jp"]) for level in levels for row in BY_LEVEL.get(level, [])]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--level", action="append", dest="levels",
                        help="JLPT level to warm; repeatable. Defaults to all.")
    parser.add_argument("--all", action="store_true", help="every level (the default)")
    parser.add_argument("--dry-run", action="store_true",
                        help="report what is missing without calling the model")
    args = parser.parse_args()

    levels = args.levels or list(BY_LEVEL)
    unknown = [l for l in levels if l not in BY_LEVEL]
    if unknown:
        logger.error("unknown level(s): %s", ", ".join(unknown))
        return 2

    todo = phrases_for(levels)
    missing = [(level, jp) for level, jp in todo if _cached_analysis(jp) is None]

    logger.info("%d curated sentences across %s", len(todo), ", ".join(levels))
    logger.info("%d already cached, %d to fetch", len(todo) - len(missing), len(missing))

    if args.dry_run or not missing:
        for level, jp in missing:
            logger.info("  MISS %s  %s", level, jp)
        return 0

    if not llm_configured():
        logger.error("No LLM provider is configured -- nothing to call.")
        return 2

    done = failed = 0
    for i, (level, jp) in enumerate(missing, 1):
        try:
            result = _call_llm(jp)
        except Exception as exc:  # the route raises HTTPException on exhaustion
            failed += 1
            logger.warning("  [%d/%d] %s FAILED  %s  (%s)", i, len(missing), level, jp, exc)
        else:
            _store_analysis(jp, result)
            done += 1
            logger.info("  [%d/%d] %s ok  %s", i, len(missing), level, jp)
        time.sleep(PAUSE_SECONDS)

    logger.info("cached %d, failed %d", done, failed)
    # A failure here is not fatal to the app -- an uncached phrase simply
    # falls through to the model on first read, which is the behaviour
    # this script exists to avoid rather than to enable.
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
