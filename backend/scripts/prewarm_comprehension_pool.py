"""
Fill the shared pool of comprehension exercises, ahead of demand.

    python -m scripts.prewarm_comprehension_pool --dry-run
    python -m scripts.prewarm_comprehension_pool --target 40
    python -m scripts.prewarm_comprehension_pool --level N5 --lang en --target 60

The comprehension exercise is the most expensive model call this app
makes -- one request writes a passage, ten questions, a per-sentence
translation and a glossed word list per sentence, at max_tokens=12000.
Since plan 092 the answer is pooled per (level, lang) and served to
every learner who has not read it (routes/reading.py, "The exercise
pool"), so the cost is paid once for everybody rather than once per
learner.

Running this moves that "once" off the learner's path: without it the
first reader at each level and language waits for a generation, and
every reader who has exhausted the pool waits for another. With it they
are served from the pool and wait for nothing.

Resumable and idempotent in the way that matters: it tops each bucket
up TO `--target`, so a re-run after a rate limit or an interruption
only pays for what is still missing, and a bucket already at target
costs nothing. It never deletes. Bump routes/reading._POOL_VERSION to
retire the existing exercises; this then refills against the new one.

Offline by design -- nothing here is on a request path. That makes it
the obvious candidate for a provider's 50%-off batch queue, which is
why docs/llm-commercial-plan.md's step 4 measured it and declined: the
whole offline surface of this app is about $4 a run, so batching it
saves two dollars for an asynchronous subsystem and a refactor of
routes/reading.py's retry loop. Read that section before reopening it.

If this script is ever a problem it will be for its DURATION, not its
price -- serial calls with a pause between them, so a full 300-exercise
fill is on the order of an hour and a half. A worker pool is the fix
for that, and it costs nothing.
"""
import argparse
import json
import logging
import random
import sys
import time

import scripts._env  # noqa: F401  -- must precede the route import, which
#                       reads the provider API keys at module scope.
from core.db import db_conn
from routes.reading import (
    COMPREHENSION_SPECS, _POOL_VERSION, _call_llm_comprehension,
    _pick_grammar_seeds, _pick_word_seeds,
)
from study.llm_shared import llm_configured

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("prewarm-comprehension")

# The languages the app's UI actually ships (frontend/src/locales), and
# so the ones worth warming. The prompt names a language, which is what
# makes a bucket (level, lang) rather than just a level: an English
# exercise is not a French one -- its translations, notes and every
# gloss in it are in the wrong language. routes/reading.LANG_NAMES
# accepts more than these two; a learner on one of them still gets an
# exercise, generated on demand as before.
LANGS = ("en", "fr")

# Enough that a daily learner meets a fresh text for a month before the
# pool has to grow, and small enough that a first run is affordable.
DEFAULT_TARGET = 30

# Not on anyone's request path, so a pause between calls costs nothing
# and keeps a key under its per-minute limit rather than burning the
# retry budget on 429s.
PAUSE_SECONDS = 1.0


def _counts() -> dict[tuple[str, str], int]:
    """How many live exercises each bucket already holds."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT level, lang, COUNT(*) FROM comprehension_pool
                 WHERE generator_version = %s
                 GROUP BY level, lang
                """,
                (_POOL_VERSION,),
            )
            return {(level, lang): n for level, lang, n in cur.fetchall()}
    finally:
        conn.close()


def _store(level: str, lang: str, data: dict) -> None:
    """The pool insert without the served row _pool_add writes: nobody
    has read this one. Deliberately not reusing that function for the
    sake of it -- a prewarmed exercise that arrived pre-marked as read
    would be invisible to the first learner it was generated for."""
    grammar = [p["pattern"] for p in data.get("grammar_points", []) if p.get("pattern")]
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO comprehension_pool
                    (level, lang, generator_version, grammar, exercise)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (level, lang, _POOL_VERSION,
                 json.dumps(grammar, ensure_ascii=False),
                 json.dumps(data, ensure_ascii=False)),
            )
        conn.commit()
    finally:
        conn.close()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--level", action="append", dest="levels",
                    help="JLPT level to warm; repeatable. Defaults to all.")
    ap.add_argument("--lang", action="append", dest="langs",
                    help="language to warm; repeatable. Defaults to all.")
    ap.add_argument("--target", type=int, default=DEFAULT_TARGET,
                    help=f"exercises per (level, lang) bucket (default {DEFAULT_TARGET})")
    ap.add_argument("--dry-run", action="store_true",
                    help="report what is missing without calling the model")
    args = ap.parse_args()

    levels = args.levels or list(COMPREHENSION_SPECS)
    langs = args.langs or list(LANGS)
    unknown = [l for l in levels if l not in COMPREHENSION_SPECS]
    if unknown:
        logger.error("unknown level(s): %s", ", ".join(unknown))
        return 2

    have = _counts()
    todo = [
        (level, lang, args.target - have.get((level, lang), 0))
        for level in levels for lang in langs
        if have.get((level, lang), 0) < args.target
    ]

    total = sum(n for _l, _g, n in todo)
    logger.info("pool version %s, target %d per bucket", _POOL_VERSION, args.target)
    for level in levels:
        for lang in langs:
            logger.info("  %s/%s: %d stored", level, lang, have.get((level, lang), 0))
    logger.info("%d exercise(s) to generate", total)

    if args.dry_run or not total:
        return 0
    if not llm_configured():
        logger.error("No LLM provider is configured; nothing to generate with.")
        return 2

    rng = random.Random()
    made = failed = 0
    for level, lang, n in todo:
        for _ in range(n):
            try:
                data = _call_llm_comprehension(
                    level, lang,
                    grammar_seeds=_pick_grammar_seeds(level, rng),
                    word_seeds=_pick_word_seeds(level, rng),
                )
                _store(level, lang, data)
                made += 1
                logger.info("  %s/%s ok (%d/%d)", level, lang, made, total)
            except Exception as e:
                # A rejected exercise is one the checks refused, which is
                # the system working. Keep going: the next seeds are
                # different and the bucket only has to reach its target.
                failed += 1
                logger.warning("  %s/%s failed: %s", level, lang, e)
            time.sleep(PAUSE_SECONDS)

    logger.info("%d generated, %d failed", made, failed)
    return 0 if made else 1


if __name__ == "__main__":
    sys.exit(main())
