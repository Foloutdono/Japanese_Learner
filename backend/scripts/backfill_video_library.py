"""
Put the videos learners analysed before the library existed into it (plan 322).

    python -m scripts.backfill_video_library          # report only, changes nothing
    python -m scripts.backfill_video_library --yes    # do it

WHY THIS EXISTS
----------------
The video library (routes/video_library.py) takes a video when a link
fetch makes it ready. Every whole YouTube video a learner fetched before
the deploy that carries it is a session on that learner's shelf and
nothing else -- and since the same deploy takes whole YouTube videos off
the shelf (core/history.LIBRARY_SESSION), those sessions would be
reachable from nowhere until they are in the library. Run this once,
after the backend that carries the library is up.

WHAT IT DOES
------------
For each video_id with a ready, whole (no window), link-fetched session
the library lacks, the OLDEST such session's lines become the library's
row: the first analysis stands, as it does for a video added live. No
learner goes on the row, and the session's own translations are left
behind (some are a model's, asked for by one learner; the video's own
tracks are cheap to read again). The row has no kind: a video is sorted
by a model when it is next opened (study/video_category.py), on the
opener's ration, so this script spends nothing.

A row already in the library is left alone, so it can be run twice.
Reports first, like every operator script here: the run without --yes
counts and changes nothing.
"""
import argparse
import logging
import sys

from core.db import db_conn

logging.basicConfig(level=logging.INFO, format="%(message)s", stream=sys.stdout)
logger = logging.getLogger("backfill_video_library")

_SOURCES = """
    SELECT DISTINCT ON (s.video_id)
           s.video_id, s.sentences, s.truncated
      FROM video_sessions s
     WHERE s.source = 'youtube' AND s.status = 'ready' AND s.deleted_at IS NULL
       AND s.window_start IS NULL AND s.window_end IS NULL
       AND s.video_id IS NOT NULL AND s.sentences IS NOT NULL
       AND jsonb_array_length(s.sentences) > 0
       AND NOT EXISTS (SELECT 1 FROM video_library l WHERE l.video_id = s.video_id)
     ORDER BY s.video_id, s.created_at ASC, s.id ASC
"""


def count_pending(cur) -> int:
    cur.execute(f"SELECT COUNT(*) FROM ({_SOURCES}) pending")
    return cur.fetchone()[0]


def backfill(cur) -> int:
    """The library's rows for the videos it lacks. Returns how many."""
    cur.execute(
        f"""
        INSERT INTO video_library (video_id, sentences, truncated, line_count, first_line)
        SELECT video_id, sentences, truncated,
               jsonb_array_length(sentences),
               jsonb_path_query_first(sentences, '$[*] ? (!(@.foreign == true))') ->> 'text'
          FROM ({_SOURCES}) pending
        ON CONFLICT (video_id) DO NOTHING
        """
    )
    return cur.rowcount


def main() -> int:
    ap = argparse.ArgumentParser(description="Put the videos analysed before the library into it.")
    ap.add_argument("--yes", action="store_true", help="actually insert; without it, only report")
    args = ap.parse_args()

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            pending = count_pending(cur)
            logger.info("  %d video(s) analysed whole and not yet in the library", pending)
            if not pending:
                logger.info("Nothing to add.")
                return 0
            if not args.yes:
                logger.info("Dry run. Re-run with --yes to add them.")
                return 0
            added = backfill(cur)
        conn.commit()
        logger.info("Added %d video(s). They are sorted into kinds as learners open them.", added)
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
