"""
One counter for every daily ceiling (plan 124).

routes/ocr.py and routes/reading.py each grew a table of their own --
ocr_usage, comprehension_usage, the same three columns -- and each said
so: two counters is a coincidence, three is a pattern, and the third
would be the moment to generalise. 作文's tutor review is the third. It
counts here, in daily_usage keyed by (learner, feature, local day), and
the two older tables stay where they are: moving them is a data
migration with nothing to gain yet. The day a fourth feature or an
operator report wants one table is the day they move -- a one-shot
INSERT ... SELECT each, and one line in each route.

The rules are the two routes' own, kept:

  - the day is the LEARNER's (user_profiles.tz_offset_min through
    core.credits.local_today), so an allowance comes back at their
    midnight and the screen's "tomorrow" is true;
  - the slot is claimed BEFORE the model call, so a failed call still
    costs one -- a client retrying a failure is exactly what a cap
    exists to stop;
  - a database failure fails OPEN (0, under any cap): comprehension's
    choice rather than OCR's, because a hiccup must not refuse a run
    that works without the model.

claim() only counts. The route decides what over the cap means -- a 429
naming core.credits.resets_at, or a repeat served from a pool -- and
says it in its own words.
"""
import logging

from core.credits import local_today
from core.db import db_conn

logger = logging.getLogger(__name__)


def _init_db() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS daily_usage (
                    user_id TEXT NOT NULL,
                    feature TEXT NOT NULL,
                    day     DATE NOT NULL,
                    count   INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (user_id, feature, day)
                )
                """
            )
        conn.commit()
    finally:
        conn.close()


try:
    _init_db()
except Exception:  # pragma: no cover - a missing DB must not stop import
    logger.exception("daily_usage could not be initialised")


def claim(user_id: str, feature: str, limit: int) -> int:
    """Take one of today's `feature` slots for `user_id` and return how
    many are taken, this one included.

    Over `limit` is the caller's reading of the number; `limit` is used
    here for one thing, logging the crossing once, so an operator sees
    a ceiling being reached without a query."""
    try:
        conn = db_conn()
    except Exception:
        logger.exception("daily_usage: no connection; %s counted as under the cap", feature)
        return 0
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT tz_offset_min FROM user_profiles WHERE user_id = %s",
                (user_id,),
            )
            row = cur.fetchone()
            cur.execute(
                """
                INSERT INTO daily_usage (user_id, feature, day, count)
                VALUES (%s, %s, %s, 1)
                ON CONFLICT (user_id, feature, day)
                DO UPDATE SET count = daily_usage.count + 1
                RETURNING count
                """,
                (user_id, feature, local_today(row[0] if row else None)),
            )
            (count,) = cur.fetchone()
        conn.commit()
    except Exception:
        logger.exception("daily_usage: counter failed; %s counted as under the cap", feature)
        return 0
    finally:
        conn.close()
    if count == limit + 1:
        logger.info("daily limit crossed feature=%s user=%s limit=%d", feature, user_id, limit)
    return count
