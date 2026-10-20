"""
One counter for every daily ceiling (plan 125).

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
from core.pool import PoolBusy
from core.rls import enable_rls

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
            enable_rls(cur, "daily_usage")
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
    except PoolBusy:
        # Not a hiccup but a server out of connections (plan 211): open
        # here, a flood that dried the pool would also have lifted every
        # model call's ceiling. The 503 refuses the call instead.
        raise
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
    # 足跡 (plan 218): daily_usage is pruned at thirty days, so how much
    # the rationed features are used, and how often a ceiling is met,
    # would be a month's question only. The event folds into
    # event_daily and outlives it. Never the prompt, only the count.
    from core import events
    events.record(user_id, "ai_use", {
        "feature": feature, "count": count, "limit": limit, "over": count > limit,
    })
    return count



def claim_up_to(user_id: str, feature: str, limit: int, amount: int) -> int | None:
    """Take `amount` of today's `feature` allowance at once (plan 265:
    a transcription spends its minutes, not one slot), or nothing when
    that would pass `limit`: the total taken, this claim included, or
    None for a refusal.

    Unlike claim(), a refusal spends nothing. A slot is one call, and a
    call refused over the cap is one the learner retries; a claim is a
    recording's length, and a forty-minute one refused must not eat the
    ten minutes a shorter one could still have used. The rest is
    claim()'s: claimed before the model call, the learner's day, and a
    database failure open (the amount, under any cap)."""
    if amount > limit:
        return None
    try:
        conn = db_conn()
    except PoolBusy:
        raise
    except Exception:
        logger.exception("daily_usage: no connection; %s counted as under the cap", feature)
        return amount
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
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (user_id, feature, day)
                DO UPDATE SET count = daily_usage.count + EXCLUDED.count
                WHERE daily_usage.count + EXCLUDED.count <= %s
                RETURNING count
                """,
                (user_id, feature, local_today(row[0] if row else None), amount, limit),
            )
            got = cur.fetchone()
        conn.commit()
    except Exception:
        logger.exception("daily_usage: counter failed; %s counted as under the cap", feature)
        return amount
    finally:
        conn.close()
    count = got[0] if got else None
    if count is None:
        logger.info("daily limit refused feature=%s user=%s limit=%d amount=%d", feature, user_id, limit, amount)
    from core import events
    events.record(user_id, "ai_use", {
        "feature": feature, "count": count if count is not None else limit,
        "limit": limit, "over": count is None,
    })
    return count


def used_today(user_id: str, feature: str) -> int:
    """What `user_id` has taken of today's `feature`, read and not
    claimed: what an intake shows before it asks (plan 265). 0 on a
    database failure, as the counters fail open."""
    try:
        conn = db_conn()
    except Exception:
        return 0
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT tz_offset_min FROM user_profiles WHERE user_id = %s", (user_id,))
            row = cur.fetchone()
            cur.execute(
                "SELECT count FROM daily_usage WHERE user_id = %s AND feature = %s AND day = %s",
                (user_id, feature, local_today(row[0] if row else None)),
            )
            got = cur.fetchone()
        return got[0] if got else 0
    except Exception:
        logger.exception("daily_usage: read failed for %s", feature)
        return 0
    finally:
        conn.close()


def give_back(user_id: str, feature: str, amount: int) -> None:
    """Return `amount` of today's `feature` a claim took for work that
    was then refused before it began (plan 265: a recording whose session
    could not open). Never below nothing; a failure is logged, and costs
    the learner that much of the day."""
    try:
        conn = db_conn()
    except Exception:
        logger.exception("daily_usage: no connection to give back %s", feature)
        return
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT tz_offset_min FROM user_profiles WHERE user_id = %s", (user_id,))
            row = cur.fetchone()
            cur.execute(
                "UPDATE daily_usage SET count = GREATEST(0, count - %s) "
                "WHERE user_id = %s AND feature = %s AND day = %s",
                (amount, user_id, feature, local_today(row[0] if row else None)),
            )
        conn.commit()
    except Exception:
        logger.exception("daily_usage: give back failed for %s", feature)
    finally:
        conn.close()
