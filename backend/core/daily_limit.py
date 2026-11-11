"""
One counter for every daily ceiling (plan 125).

routes/ocr.py and routes/reading.py each grew a table of their own --
ocr_usage, comprehension_usage, the same three columns -- and each said
so: two counters is a coincidence, three is a pattern, and the third
would be the moment to generalise. 作文's tutor review was the third,
and it counted here, in daily_usage keyed by (learner, feature, local
day). Plan 320 moved the two older ones in ("ocr", "comprehension"):
scripts/migrate_daily_usage.py folds their rows into this table and
drops them. Every model call's ceiling counts here now.

The rules are the two routes' own, kept:

  - the day is the LEARNER's (user_profiles.tz_offset_min through
    core.credits.local_today), so an allowance comes back at their
    midnight and the screen's "tomorrow" is true;
  - the slot is claimed BEFORE the model call, so two requests at once
    cannot both slip under the ceiling, and a call a model was paid for
    costs one even when its reply is then refused or unreadable;
  - a call that failed with no model paid (llm_shared.LLMUnavailable
    and nothing on the meter) gives its slot back (refund_unbilled,
    the owner's rule of 2026-11-11): a provider outage must not spend a
    learner's allowance. A retry in an outage then costs nothing,
    because it reaches nothing;
  - a database failure fails OPEN (0, under any cap): comprehension's
    choice rather than OCR's, because a hiccup must not refuse a run
    that works without the model.

claim() only counts, and release() only gives back. The route decides what over the cap means -- a 429
naming core.credits.resets_at, or a repeat served from a pool -- and
says it in its own words.
"""
import logging
from contextlib import contextmanager

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



def release(user_id: str, feature: str) -> None:
    """Give back one of today's `feature` slots for `user_id`: the one
    claim() took for a call no model was paid for. Never below 0, and a
    day with no row is left without one.

    The day is the learner's today, as claim() reads it: a call that
    straddled their midnight gives back today's slot rather than
    yesterday's, which can only leave them one more, never one fewer.

    Fails quietly, as claim() fails open: a refund that could not be
    written costs the learner the slot, which is today's behaviour."""
    try:
        conn = db_conn()
    except Exception:
        logger.exception("daily_usage: no connection; %s slot not given back", feature)
        return
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT tz_offset_min FROM user_profiles WHERE user_id = %s",
                (user_id,),
            )
            row = cur.fetchone()
            cur.execute(
                """
                UPDATE daily_usage SET count = count - 1
                 WHERE user_id = %s AND feature = %s AND day = %s AND count > 0
                RETURNING count
                """,
                (user_id, feature, local_today(row[0] if row else None)),
            )
            given = cur.fetchone()
        conn.commit()
    except Exception:
        logger.exception("daily_usage: refund failed; %s slot not given back", feature)
        return
    finally:
        conn.close()
    if given is None:
        return
    # 足跡: ai_use counted the claim when it was taken; this says it was
    # given back, so the dashboard's calls are the claims less these.
    from core import events
    events.record(user_id, "ai_refund", {"feature": feature})


def _unavailable(exc: BaseException) -> bool:
    """Whether `exc` is, or was raised while handling, an LLMUnavailable:
    the routes turn it into an HTTPException(503) inside their except."""
    from study.llm_shared import LLMUnavailable
    seen = set()
    while exc is not None and id(exc) not in seen:
        if isinstance(exc, LLMUnavailable):
            return True
        seen.add(id(exc))
        exc = exc.__cause__ or exc.__context__
    return False


@contextmanager
def refund_unbilled(user_id: str, feature: str):
    """Around the model calls a claimed slot pays for: the slot is given
    back if the block fails with LLMUnavailable (raised, or the cause of
    what was raised) and no call inside it was billed (llm_shared's
    meter). A success, a billed reply refused or unreadable, a timeout
    mid-answer or any other error keeps it. The exception goes on as it
    was."""
    from study.llm_shared import metered
    with metered() as meter:
        try:
            yield
        except BaseException as e:
            if not meter.billed and _unavailable(e):
                release(user_id, feature)
            raise
