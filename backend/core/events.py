"""足跡 — the trail of screens a learner walked, and nothing more.

Owns `event_log` (raw, thirty days) and `event_daily` (the rolled-up
half, kept). The split is `review_log` / `review_daily`'s, for the same
reason: `screen_view` is the volume driver and the database it lands in
is shared with the review history. Order questions ("which boarding step
came before the drop-off") need the raw rows; rate questions ("did they
come back on day 7") only need the counts, so only the counts are kept.

THE RULE THIS MODULE EXISTS TO ENFORCE: no text a learner typed ever
becomes an event. Not a dictation answer, not an analysed sentence, not
a custom card, not a deck or theme name. That is a promise the published
privacy policy makes on the app's behalf, so it is not left to the call
sites to remember -- EVENTS below is a closed set of names, each with a
closed set of property keys, and `clean` drops everything else on the
way in. The client is not trusted with this: `routes/events.py` runs the
same `clean` over whatever a browser posts.

Route paths are the sharp edge. `/learn/vocab/theme/animaux/level/N4`
carries a theme name; the frontend normalises paths to patterns
(`lib/routePattern.js`) before they are tracked, and a path that arrives
here with a segment that is not a pattern is dropped rather than stored.
"""

import logging
from datetime import datetime, timedelta, timezone

from core.db import db_conn

logger = logging.getLogger(__name__)

# The closed set: name -> the property keys that name may carry.
#
# Adding a name here is the whole of adding an event, on both sides --
# the frontend's EVENTS map (lib/track.js) is checked against this one
# by tests/test_events.py, so the two cannot drift into a state where
# the client sends something the server silently discards.
EVENTS: dict[str, frozenset[str]] = {
    # ── Boot, and what it costs ──────────────────────────────────
    # boot_ms is why render.yaml carries `plan: starter`; it is the
    # before/after of that line.
    "app_open":       frozenset({"boot_ms", "cold", "platform", "standalone"}),
    "boot_timeout":   frozenset({"waited_ms"}),

    # ── Where people go ──────────────────────────────────────────
    "screen_view":    frozenset({"route", "tab"}),

    # ── みどりの窓口 — the boarding flow ─────────────────────────
    # Emitted from go()/back() in BoardingFlow.jsx, which is every
    # transition there is. Abandonment is the absence of boarding_done
    # after a boarding_step, so neither needs an "abandoned" event.
    "boarding_step":  frozenset({"step", "to", "index", "dir"}),
    "boarding_done":  frozenset({"motive", "kana_known", "level", "pace", "notifications"}),
    # "Embarquer" mints an anonymous Supabase guest (lib/guest.js), so an
    # abandoned boarding leaves an auth user with no profile row. `from`
    # tells the two apart.
    "account_claimed": frozenset({"from"}),

    # ── Study runs ───────────────────────────────────────────────
    "run_start":      frozenset({"kind", "mode", "level"}),
    "run_complete":   frozenset({"kind", "mode", "level", "items", "secs"}),
    "run_abandon":    frozenset({"kind", "mode", "level", "done"}),

    # ── The fare gate ────────────────────────────────────────────
    # fare_blocked is written server-side by core/credits.py, from the
    # shadow-mode branch that until now only reached stdout. It is the
    # willingness-to-pay signal: a learner who would have been stopped
    # is a learner who wanted more than the free allowance gives.
    "fare_blocked":   frozenset({"balance", "fare", "kind"}),
    "limit_reached":  frozenset({"kind", "at"}),
    # Dormant until HAS_STORE flips (frontend/src/domain/credits.js).
    "offer_view":     frozenset({"where"}),

    # ── Friction ─────────────────────────────────────────────────
    # `path` is a route pattern, never a URL with ids in it, and no
    # response body is ever carried.
    "api_error":      frozenset({"path", "status"}),
    "install_prompt": frozenset({"outcome"}),
}

# Names that survive the thirty-day cut in scripts/compact_events.py.
# Each is at most a handful of rows per learner for the life of the
# account, and each answers a question that is about a person's whole
# history rather than this month's -- "did the people who abandoned at
# the level step ever come back" cannot be asked of a rollup.
KEEP_LONG = frozenset({
    "boarding_step", "boarding_done", "account_claimed",
    "fare_blocked", "limit_reached", "offer_view",
})

# A property value is a scalar or it is dropped. Strings are cut at 64
# characters: every legitimate value here is an enum, a route pattern or
# a number, and 64 is comfortably past the longest route pattern the app
# has while being far short of anything a learner could have typed.
MAX_STR = 64
MAX_PROPS = 12
# A batch bound, so one client cannot post a megabyte. The frontend
# flushes at 20 (lib/track.js); 50 leaves room for a backlog that built
# up offline without letting it arrive all at once.
MAX_BATCH = 50
# How far back a client-supplied timestamp may reach. The queue is
# persisted across reloads, so an event really can be days old and its
# own time is the true one -- but a wrong or hostile clock must not be
# able to write into the far past or the future.
MAX_BACKDATE = timedelta(days=7)


def clean(name, props) -> dict | None:
    """The name and its properties, or None if the name is not ours.

    Never raises: a bad event is dropped, never a reason to fail the
    request that carried it. Analytics that can break a study session is
    worse than no analytics.
    """
    allowed = EVENTS.get(name) if isinstance(name, str) else None
    if allowed is None:
        return None
    if not isinstance(props, dict):
        return {}
    out: dict = {}
    for key, value in props.items():
        if key not in allowed:
            continue
        if isinstance(value, bool) or value is None:
            out[key] = value
        elif isinstance(value, (int, float)):
            # NaN/inf survive json.loads and then break psycopg2's JSONB
            # adaptation, taking the whole batch with them.
            out[key] = value if -1e12 < value < 1e12 else None
        elif isinstance(value, str):
            out[key] = value[:MAX_STR]
        else:
            # A dict or a list is the shape free text would arrive in.
            continue
        if len(out) >= MAX_PROPS:
            break
    return out


def clean_at(raw, now: datetime) -> datetime:
    """A client timestamp, clamped to a window it cannot lie its way out of."""
    if not isinstance(raw, str):
        return now
    try:
        # Javascript's toISOString() ends in Z, which fromisoformat only
        # learned to read in 3.11; this backend runs 3.12, but the
        # replace costs nothing and says so.
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return now
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    if parsed > now:
        return now
    floor = now - MAX_BACKDATE
    return parsed if parsed > floor else floor


def _ensure_events_schema() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS event_log (
                    id      BIGSERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    name    TEXT NOT NULL,
                    props   JSONB NOT NULL DEFAULT '{}'::jsonb,
                    at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            # (user_id, at) for one learner's trail in order; (name, at)
            # for the digest's per-name counts across everyone.
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_event_log_user_at
                ON event_log(user_id, at)
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_event_log_name_at
                ON event_log(name, at)
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS event_daily (
                    user_id TEXT NOT NULL,
                    day     DATE NOT NULL,
                    name    TEXT NOT NULL,
                    n       INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (user_id, day, name)
                )
            """)
        conn.commit()
    finally:
        conn.close()


try:
    _ensure_events_schema()
except Exception:  # pragma: no cover - a missing DB must not stop import
    logger.exception("events schema could not be initialised")


def write(cur, user_id: str, rows: list[tuple[str, dict, datetime]]) -> int:
    """Insert cleaned rows on a cursor the caller owns. Returns the count."""
    if not rows:
        return 0
    cur.executemany(
        "INSERT INTO event_log (user_id, name, props, at) "
        "VALUES (%s, %s, %s::jsonb, %s)",
        [(user_id, name, _json(props), at) for name, props, at in rows],
    )
    return len(rows)


def _json(props: dict) -> str:
    import json
    return json.dumps(props, separators=(",", ":"))


def record(user_id: str, name: str, props: dict | None = None, cur=None) -> None:
    """One event, from the server.

    Pass `cur` to join a transaction the caller already has open -- that
    is how core/credits.py records a blocked fare without opening a
    second connection inside its own. Without it this opens and commits
    its own.

    Swallows everything. A route must never fail because its bookkeeping
    did; the caller's own work is the thing that matters.
    """
    cleaned = clean(name, props or {})
    if cleaned is None:
        logger.warning("events: unknown name %r dropped", name)
        return
    row = [(name, cleaned, datetime.now(timezone.utc))]
    try:
        if cur is not None:
            write(cur, user_id, row)
            return
        conn = db_conn()
        try:
            with conn.cursor() as c:
                write(c, user_id, row)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    except Exception:
        logger.exception("events: %s could not be recorded", name)
