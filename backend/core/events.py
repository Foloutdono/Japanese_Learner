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
    # `ms` is ENGAGED time on the step being left, not wall-clock: the
    # client stops counting while the tab is hidden
    # (frontend/src/lib/dwell.js), so a boarding left open over lunch
    # does not report an hour spent choosing a study rhythm. On
    # boarding_done it is the same measure across the whole line.
    "boarding_step":  frozenset({"step", "to", "index", "dir", "ms"}),
    # `lines` is the chosen subset of vocab/kanji/grammar as one
    # comma-joined string of those three names -- enum values, never
    # text the learner typed (core/lines.py).
    "boarding_done":  frozenset({"motive", "kana_known", "level", "pace", "notifications", "lines", "ms"}),
    # "Embarquer" mints an anonymous Supabase guest (lib/guest.js), so an
    # abandoned boarding leaves an auth user with no profile row. `from`
    # tells the two apart.
    "account_claimed": frozenset({"from"}),

    # ── 試乗 — the first ride (plan 097) ────────────────────────────
    # The two lessons after the boarding, measured the way the boarding
    # is: every transition is a ride_step through the same go()/mark()
    # pair, and abandonment is a ride_step with no ride_done after it.
    # `at` on ride_done is which ride it ended on ('cards' | 'reading')
    # and `skipped` whether the learner left through the head's Skip --
    # the one question this feature has to answer is whether anyone
    # sits through it. `step` and `to` are step names, `ms` is engaged
    # time (lib/dwell.js), never wall-clock.
    "ride_step":      frozenset({"step", "to", "dir", "ms"}),
    "ride_done":      frozenset({"skipped", "at", "ms"}),
    # 案内 — the guide over each gate. `gate` is one of the five ids,
    # `stop` the anchor's name from the registry (a string the app
    # wrote, never one the learner did), `index` its place in the tour,
    # `stops` how many were seen before Done or Skip.
    "guide_step":     frozenset({"gate", "stop", "index"}),
    "guide_done":     frozenset({"gate", "skipped", "stops", "ms"}),

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
    # ── 定期券 — the offer ───────────────────────────────────────
    # No longer dormant: the pass is SHOWN from five doors and sold from
    # none (frontend/src/domain/paywall.js's HAS_PAYWALL, which is
    # deliberately not HAS_STORE). `where` is which of the five doors
    # (frontend/src/domain/paywall.js's SOURCES -- the reading ride's
    # pass plate among them since plan 097; the profile, a door until
    # plan 143, reaches the offer through the balance sheet now, and
    # older rows still say `profile`).
    #
    # The three verbs are the whole point: a paywall nobody opens and a
    # paywall opened and refused are indistinguishable from
    # credit_ledger, and until a store exists offer_intent is the only
    # willingness-to-pay signal there is. `ms` is the gap between seeing
    # the pass and deciding — a door with a high intent rate and a
    # one-second median is a mis-tap, not demand.
    #
    # The offer is three screens since plan 172, each with its one pick:
    # Pro yearly's 7-day trial (the boarding, the balance, the ride, the
    # settings), Pro yearly against the week the credits stopped (a run
    # at zero, `where` 'runout'), and the step up to Max ('limit', a Pro
    # learner at one of the plan's ceilings; 'upgrade', from Settings).
    # `plan` and `billing` are the app's own two enums, the pick the
    # gate was pressed on -- what the pricing sheet's annual share will
    # be checked against. `all` is no longer sent: it was whether "See
    # all offers" was opened before the answer (plan 172 retired that
    # list); older rows carry it.
    "offer_view":     frozenset({"where"}),
    "offer_intent":   frozenset({"where", "ms", "plan", "billing", "all"}),
    "offer_dismiss":  frozenset({"where", "ms", "all"}),

    # ── The library ──────────────────────────────────────────────
    # Whether learners give each other decks at all, and whether a
    # follow survives contact with the deck.
    #
    # NOT A DECK NAME, and not a description: both are learner-typed,
    # which is the rule this whole module exists to keep. `structure` is
    # the deck's type (one of four), `cards` is a count, `where` is
    # which surface the follow came from (the shelf block or the library
    # screen), and `sort` is which ordering was showing. A deck id is
    # not carried either -- it would make the trail say who follows
    # whom, which is more than "is the library used" needs to know.
    "deck_publish":   frozenset({"structure", "cards"}),
    "deck_unpublish": frozenset({"structure", "followers"}),
    "deck_subscribe": frozenset({"structure", "cards", "where"}),
    "deck_detach":    frozenset({"structure", "cards", "withdrawn"}),
    # `filtered` is a BOOLEAN and deliberately so: it says whether the
    # library's console was narrowing the shelf, never what was typed
    # into it — a deck name or a search term is a learner's own words,
    # which is the rule this module exists to keep.
    "library_view":   frozenset({"sort", "results", "filtered"}),
    # ── お気に入り — the dictionary's shelf (plan 093) ────────────
    # The kind of entry and the direction, never the key: a key names
    # the word a learner looked up, which is theirs.
    "favorite_toggle": frozenset({"kind", "on"}),
    # ── 発車案内 — the app opened from outside it (plan 156) ──────
    # `via` is `notification` (the daily nudge or an agenda block's
    # reminder, plan 181) or `widget` (a home or
    # lock screen widget). Whether either brings anyone back is the one
    # question they have to answer.
    "nudge_opened":   frozenset({"via"}),
    # ── 基礎 — the basics course (plan 186f) ─────────────────────
    # `unit` is the course's own number, 1 to 14, never a card: whether
    # novices get through the course, and where they stop or skip it.
    "basics_unit_done": frozenset({"unit"}),
    "basics_skipped":   frozenset({"unit"}),

    # ── 発見 — a grammar point's tour (plan 187b) ────────────────
    # `level` is N5…N1, never the pattern: the funnel is read by level.
    # `stop` is look / guess / found / terminus; `outcome` first, retry
    # (a wrong guess) or helped (the rule given after two). The done
    # event carries the wrong guesses and whether the twist and scene
    # were the point's own (`authored`, plan 187c).
    "grammar_tour_step": frozenset({"level", "stop", "outcome"}),
    "grammar_tour_done": frozenset({"level", "tries", "helped", "authored"}),

    # ── 終着 — the day cleared (plan 191) ────────────────────────
    # Both written server-side: day_clear by POST /api/today/clear on
    # the day's first clear (`streak` the day of the streak it was,
    # `milestone` the milestone reached or null, `tier` day | ticket |
    # month, the ceremony it played), rest_day_used by the lazy bridge
    # (`days`, how many missed days a rest ticket covered). ticket_share
    # is the client's: a milestone ticket shared as an image, `days`
    # the ticket's milestone -- never the image, which is the learner's.
    "day_clear":      frozenset({"streak", "milestone", "tier"}),
    "rest_day_used":  frozenset({"days"}),
    "ticket_share":   frozenset({"days"}),

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
    # The ride and the guides are once per account, and "did the people
    # who skipped the ride come back" is a question about a whole
    # history. ride_step is not here: per-transition, like a run.
    "ride_done", "guide_done",
    "fare_blocked", "limit_reached", "offer_view", "offer_intent", "offer_dismiss",
    # Publishing is a once-or-twice-ever act, and "did the people who
    # published a deck keep doing it" is a question about a whole
    # account. deck_subscribe and library_view are not here: those are
    # per-visit and belong in the rollup.
    "deck_publish", "deck_detach",
    # Fourteen units at most, once each: "did the learners who finished
    # the basics stay" is a question about a whole account.
    "basics_unit_done", "basics_skipped",
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
            # The client's own id per event (routes/events.py), so a
            # batch sent twice is kept once. Partial: the server's own
            # rows and an older client's carry none, and NULLs must not
            # collide.
            cur.execute("ALTER TABLE event_log ADD COLUMN IF NOT EXISTS cid TEXT")
            cur.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_event_log_user_cid
                ON event_log(user_id, cid) WHERE cid IS NOT NULL
            """)
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


def write(cur, user_id: str, rows: list[tuple]) -> int:
    """Insert cleaned rows on a cursor the caller owns. Returns how many
    were KEPT: a row whose client id this learner already has is a batch
    sent twice (a flush the page never heard back about) and is dropped
    on the unique (user_id, cid). A row with no id -- the server's own,
    or an older client's -- is never deduplicated.

    rows: (name, props, at) or (name, props, at, cid)."""
    if not rows:
        return 0
    kept = 0
    for row in rows:
        name, props, at = row[0], row[1], row[2]
        cid = row[3] if len(row) > 3 else None
        cur.execute(
            "INSERT INTO event_log (user_id, name, props, at, cid) "
            "VALUES (%s, %s, %s::jsonb, %s, %s) "
            "ON CONFLICT (user_id, cid) WHERE cid IS NOT NULL DO NOTHING",
            (user_id, name, _json(props), at, cid),
        )
        kept += cur.rowcount
    return kept


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
