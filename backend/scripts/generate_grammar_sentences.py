"""
Materialise example sentences for the grammar catalogue.

    python -m scripts.generate_grammar_sentences --level N3
    python -m scripts.generate_grammar_sentences --all --dry-run

Resumable and idempotent: a point already stored at the current
generator version is skipped, so a re-run after an interruption (or a
rate-limit) costs nothing for what already succeeded.

Nothing here is on a user's request path -- sessions read the cache, and
a point with no sentences simply hides the hint.
"""
import argparse
import logging
import sys
import time

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
from study import grammar_sentence_store as store
from study.grammar_sentence_gen import (
    BATCH_SIZE, GENERATOR_VERSION, SENTENCES_PER_POINT, batches,
    generate_for_points,
)
from study.llm_shared import OPENROUTER_API_KEY

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("grammar-sentences")

LEVELS = ["N5", "N4", "N3", "N2", "N1"]


def run_level(level: str, dry_run: bool, pause: float, retries: int) -> tuple[int, int]:
    points = GRAMMAR_POINTS_BY_LEVEL.get(level, [])
    done = set() if dry_run else store.existing_patterns(level, GENERATOR_VERSION)
    todo = [p for p in points if p["pattern"] not in done]

    logger.info("%s: %d points, %d already stored, %d to generate",
                level, len(points), len(done), len(todo))
    if dry_run or not todo:
        return 0, len(todo)

    saved = 0
    # Points the model fails on are retried in a later pass rather than
    # abandoned: a batch that lost two entries to a bad kanji or a missing
    # pattern usually succeeds on a second attempt, and re-asking two
    # points costs far less than the batch that produced them.
    pending = todo
    for attempt in range(retries + 1):
        if not pending:
            break
        if attempt:
            logger.info("  retry pass %d for %d point(s)", attempt, len(pending))
        failed = []
        for batch in batches(pending, BATCH_SIZE):
            try:
                got = generate_for_points(batch, level, SENTENCES_PER_POINT)
            except RuntimeError as e:
                logger.warning("  batch failed (%s) -- will retry", e)
                failed.extend(batch)
                time.sleep(pause)
                continue
            for point in batch:
                sentences = got.get(point["pattern"])
                if sentences:
                    store.save(level, point["pattern"], sentences, GENERATOR_VERSION)
                    saved += 1
                else:
                    failed.append(point)
            logger.info("  %s: +%d saved (%d/%d)", level, len(got), saved, len(todo))
            time.sleep(pause)
        pending = failed
    if pending:
        logger.warning("%s: %d point(s) produced nothing: %s", level, len(pending),
                       ", ".join(p["pattern"] for p in pending[:8]))
    return saved, len(pending)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--level", choices=LEVELS, help="one level")
    ap.add_argument("--all", action="store_true", help="every level")
    ap.add_argument("--dry-run", action="store_true", help="report what would run")
    ap.add_argument("--pause", type=float, default=2.0, help="seconds between calls")
    ap.add_argument("--retries", type=int, default=2, help="extra passes over failures")
    args = ap.parse_args()

    if not args.level and not args.all:
        ap.error("pass --level or --all")
    if not args.dry_run and not OPENROUTER_API_KEY:
        logger.error("OPENROUTER_API_KEY not configured")
        return 1

    if not args.dry_run:
        store.ensure_grammar_sentence_schema()

    total_saved = total_failed = 0
    for level in (LEVELS if args.all else [args.level]):
        saved, failed = run_level(level, args.dry_run, args.pause, args.retries)
        total_saved += saved
        total_failed += failed

    if not args.dry_run:
        logger.info("stored: %s", dict(store.counts()))
    logger.info("saved %d point(s), %d still without sentences", total_saved, total_failed)
    return 0


if __name__ == "__main__":
    sys.exit(main())
