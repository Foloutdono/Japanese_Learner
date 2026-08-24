"""
Delete generated exam papers no learner can be served any more.

    python -m scripts.prune_exam_papers          # report only, changes nothing
    python -m scripts.prune_exam_papers --yes    # do it

-- What counts as prunable ------------------------------------
A paper row is prunable when BOTH hold:

  1. Its generator_version is not the one routes/exams.py's
     EXAM_GENERATORS currently registers for that exam id. Bumping that
     string is how a bad generation is retired -- _select_paper filters
     on it, so an older revision stops being served the moment the
     version changes, whether or not this script ever runs.
  2. Nothing in exam_attempts references it. A paper somebody sat is
     kept forever: their result screen re-fetches it by revision (see
     get_exam's `revision` parameter) and would render an old attempt
     against nothing at all if the row were gone. The foreign key would
     refuse the delete anyway; this reports it as kept rather than
     letting the transaction fail.

So this is housekeeping, never a correctness requirement -- retiring a
paper is the version bump, and this only reclaims the storage after it.
Nothing in the request path deletes papers.

-- Listening audio --------------------------------------------
Deliberately untouched. A listening paper's questions point at
datas/exam_audio/<content-hash>.mp3 files (study/exam_tts.py), and the
hash is over the CONTENT: two papers that happen to contain the same
dialogue share one file, so deleting the files a pruned paper referenced
can silently break a paper that was kept. They are small, and
synthesis is free and idempotent.
"""
import argparse
import logging

import scripts._env  # noqa: F401  -- must precede core.db, which reads
#                       DATABASE_URL at module scope. See scripts/_env.py.
from core.db import db_conn
from routes.exams import EXAM_GENERATORS

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("prune-exam-papers")


def _rows(cur):
    """Every paper, with its exam id's CURRENT version and whether any
    attempt references it. One query rather than one per row: the table
    holds at most a few rows per registered exam id."""
    cur.execute(
        """
        SELECT p.exam_id, p.revision, p.generator_version, p.created_at,
               EXISTS (SELECT 1 FROM exam_attempts a
                        WHERE a.exam_id = p.exam_id AND a.revision = p.revision)
          FROM exam_papers p
         ORDER BY p.exam_id, p.revision
        """
    )
    return cur.fetchall()


def main() -> int:
    ap = argparse.ArgumentParser(description="Delete unservable, unattempted exam papers.")
    ap.add_argument("--yes", action="store_true", help="actually delete; without it, only report")
    args = ap.parse_args()

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            prunable, kept_attempted, current = [], [], 0
            for exam_id, revision, version, created_at, attempted in _rows(cur):
                registered = EXAM_GENERATORS.get(exam_id)
                # An unregistered exam id is stale by definition -- its
                # generator was removed or renamed, so nothing can ever
                # serve it again.
                if registered is not None and registered[0] == version:
                    current += 1
                elif attempted:
                    kept_attempted.append((exam_id, revision, version))
                else:
                    prunable.append((exam_id, revision, version, created_at))

            logger.info("%d paper(s) at the current generator version, left alone.", current)
            for exam_id, revision, version in kept_attempted:
                logger.info("KEEP  %s r%d (%s) -- stale, but a learner has sat it", exam_id, revision, version)
            for exam_id, revision, version, created_at in prunable:
                logger.info("PRUNE %s r%d (%s, generated %s)", exam_id, revision, version, created_at)

            if not prunable:
                logger.info("Nothing to prune.")
                return 0
            if not args.yes:
                logger.info("\n%d paper(s) would be deleted. Re-run with --yes to do it.", len(prunable))
                return 0

            cur.executemany(
                "DELETE FROM exam_papers WHERE exam_id = %s AND revision = %s",
                [(exam_id, revision) for exam_id, revision, _v, _c in prunable],
            )
        conn.commit()
        logger.info("\nDeleted %d paper(s).", len(prunable))
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
