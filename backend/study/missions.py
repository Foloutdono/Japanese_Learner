"""
任務 — missions, discoveries and achievements (plan 328).

What they are for (docs/business/strategie-monetisation.md, "Missions,
quêtes et succès"): to make the Free plan hold (a learner who does them has
about 125 credits a day, the refill giving 90 and the missions the other
35), to push the learner a little past their own habit, and to show them
the app. The figures below ARE that sizing: tests/test_missions.py pins
them, and a change to one is a change to the plan.

-- Three kinds, one table each way ----------------------------------
  missions       a row per learner and period: the day's three, the week's
                 three and the day's bonus. Assigned lazily by the first
                 read of the period, from the learner's own history, and
                 FROZEN: the goal, the credits and the XP are written on
                 the row, so studying earlier in the day never raises
                 today's goal and a change of the figures here never
                 touches a mission already assigned.
  mission_marks  a row per learner and key: a discovery (a feature seen
                 once) or an achievement (a milestone), once, ever.

Progress is never stored (the ladder's rule: do not keep beside a row what
the logs already say). It is read again from review_log, day_clears and
the practice logs on every read; only `done_at` is stamped, so that a
compaction of the logs cannot undo a mission that was done.

-- What a reward is -------------------------------------------------
Credits through the ledger (core/credits.award, reason `mission`) and XP
through srs.award_xp (source `mission`), both in the transaction that
stamps `paid_at`: the conditional UPDATE is the lock, so two requests at
once pay once. A learner on the pass (unlimited) has no use for credits:
they are paid as the same number of XP instead (the strategy's "Max gets
XP and cosmetics"). Nothing is paid to an account that has not studied
(`srs.first_studied_day`): a reward is for study.

-- The anti-farming rules, in one place ------------------------------
  * a goal that asks the learner to beat themselves is computed from their
    own history and capped (NEW_MAX, ACCURACY_MAX, VOLUME_MAX_GAIN);
  * the XP the repeatable ones pay counts on the 番付 only up to
    XP_DAY_CAP a local day (written clipped, as duels' XP_CAP is);
    discoveries and achievements are bounded by the catalogue itself;
  * `mission` is neither a day studied nor a practice answer
    (srs.NOT_STUDY_SOURCES);
  * nothing is random: the choice of the day's missions is a rotation of
    the local date;
  * no mission rewards a post on a network.

-- What this module does not do --------------------------------------
It does not price the practice modes: they cost no credit today. What
exists is the seam, `waives()`, that the practice fare will read.
"""
from __future__ import annotations

import logging
import math
import time
from datetime import date, datetime, timedelta, timezone

from core import credits as credits_mod
from core import events
from core.db import db_conn
from core.rls import enable_rls

logger = logging.getLogger(__name__)

# ── The figures ───────────────────────────────────────────────────────
DAY_CREDITS, DAY_XP = 8, 5
BONUS_CREDITS, BONUS_XP = 6, 5
WEEK_CREDITS, WEEK_XP = 12, 15
DAYS_PER_DAY = 3
PER_WEEK = 3
DISCOVERY_XP = 10
XP_DAY_CAP = 100

# The pinned sizing: what a free learner who does them all earns a day.
DAILY_INCOME = DAYS_PER_DAY * DAY_CREDITS + BONUS_CREDITS            # 30
WEEKLY_INCOME = PER_WEEK * WEEK_CREDITS                              # 36

NEW_MAX = 30           # the most new cards a day a mission asks
NEW_MIN = 3
NEW_UPLIFT = 1.1       # their own seven-day average, plus a tenth
ACCURACY_WINDOW = 28   # days the average is taken over
ACCURACY_MIN_ANSWERS = 200
ACCURACY_ANSWERS = 20  # answers a session needs for its accuracy to count
ACCURACY_GAIN = 3      # points over their average
ACCURACY_MAX = 95
DUE_MIN = 10           # reviews due for "finish them" to be offered
VOLUME_MIN_PREV = 40
VOLUME_UPLIFT = 1.1
VOLUME_MAX_GAIN = 150
DAYS_TARGET = 5
WRITE_TARGET = 10
DUELS_TARGET = 5

DAILY = ("due", "new", "practice", "accuracy", "write")
WEEKLY = ("days5", "volume", "new_mode", "exam_section", "duels5", "write10")
BONUS = "all3"

# A discovery's credits (its XP is DISCOVERY_XP). Seen once; the first
# seven are read off the tables from SINCE on, the last three are noted at
# the act (note()) because nothing durable says they happened.
DISCOVERIES = {
    "first_dictation": 10, "first_photo": 15, "first_conversation": 15,
    "first_exam": 15, "first_deck": 20, "first_friend": 10, "first_duel": 10,
    "arrival_date": 10, "first_import": 20, "first_video": 15,
}
NOTED = frozenset({"first_photo", "arrival_date", "first_import"})
# Whatever was done before this instant is not a "first": a discovery is
# told to whoever meets the app after it (a learner who dictated last
# month has seen dictation).
SINCE = datetime(2026, 11, 23, tzinfo=timezone.utc)

# An achievement's (credits, xp).
ACHIEVEMENTS = {
    "kana_done": (5, 60),
    "words_100": (3, 40), "words_500": (6, 100), "words_1000": (10, 200),
    "grammar_n5": (5, 100),
    "days_7": (3, 30), "days_30": (6, 100), "days_100": (12, 300),
    "exam_passed": (5, 80),
    "ranked_win": (5, 80),
}
WORD_MARKS = {"words_100": 100, "words_500": 500, "words_1000": 1000}
DAY_MARKS = {"days_7": 7, "days_30": 30, "days_100": 100}
EXAM_PASS = 0.6

# The practice platforms a mission may ask: their log and its clock. The
# table names are literals here, never parameters (SQL cannot bind one).
# Dictation and composition are 写's own (`write`).
PLATFORMS = {
    "reading": "reading_log",
    "comprehension": "comprehension_log",
    "translation": "translation_log",
    "conversation": "conversation_log",
}
LEVELS = ("N5", "N4", "N3", "N2", "N1")

SCOPES = ("day", "week", "bonus", "mark")
KINDS = frozenset(DAILY) | frozenset(WEEKLY) | {BONUS} | frozenset(DISCOVERIES) | frozenset(ACHIEVEMENTS)


# ── Tables ────────────────────────────────────────────────────────────
def _init_missions() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS missions (
                    user_id  TEXT NOT NULL,
                    scope    TEXT NOT NULL,
                    period   DATE NOT NULL,
                    kind     TEXT NOT NULL,
                    slot     SMALLINT NOT NULL,
                    target   INTEGER NOT NULL,
                    baseline INTEGER,
                    credits  SMALLINT NOT NULL,
                    xp       SMALLINT NOT NULL,
                    platform TEXT,
                    done_at  TIMESTAMPTZ,
                    paid_at  TIMESTAMPTZ,
                    PRIMARY KEY (user_id, scope, period, kind)
                )
                """
            )
            enable_rls(cur, "missions")
        conn.commit()
    finally:
        conn.close()


def _init_marks() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS mission_marks (
                    user_id    TEXT NOT NULL,
                    key        TEXT NOT NULL,
                    class      TEXT NOT NULL,
                    credits    SMALLINT NOT NULL,
                    xp         SMALLINT NOT NULL,
                    reached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    paid_at    TIMESTAMPTZ,
                    PRIMARY KEY (user_id, key)
                )
                """
            )
            enable_rls(cur, "mission_marks")
        conn.commit()
    finally:
        conn.close()


for _init in (_init_missions, _init_marks):
    try:
        _init()
    except Exception:  # pragma: no cover - a missing DB must not stop import
        logger.exception("missions: %s failed", _init.__name__)


# ── Time ──────────────────────────────────────────────────────────────
def day_window(tz: int | None, now: datetime) -> tuple[date, datetime, datetime]:
    day = credits_mod.local_today(tz, now)
    start = credits_mod._midnight_starting(day, tz)
    return day, start, start + timedelta(days=1)


def week_window(tz: int | None, now: datetime) -> tuple[date, datetime, datetime]:
    """The learner's calendar week, Monday to Sunday."""
    today = credits_mod.local_today(tz, now)
    monday = today - timedelta(days=today.weekday())
    start = credits_mod._midnight_starting(monday, tz)
    return monday, start, start + timedelta(days=7)


def _local_day(col: str) -> str:
    return f"((({col}) AT TIME ZONE 'UTC') + make_interval(mins => %s))::date"


# ── Safe reads ────────────────────────────────────────────────────────
# A table another module owns may not exist yet (the duels' tables are
# made when their module is imported): a read of one is a savepoint, so a
# missing table is a zero and never an aborted transaction.
def _rows(cur, sql: str, params: tuple = ()) -> list:
    cur.execute("SAVEPOINT m_read")
    try:
        cur.execute(sql, params)
        out = cur.fetchall()
        cur.execute("RELEASE SAVEPOINT m_read")
        return out
    except Exception:
        cur.execute("ROLLBACK TO SAVEPOINT m_read")
        logger.exception("missions: read failed")
        return []


def _one(cur, sql: str, params: tuple = (), default=0):
    rows = _rows(cur, sql, params)
    return rows[0][0] if rows and rows[0][0] is not None else default


# ── Facts about the learner ───────────────────────────────────────────
def _pattern(user_id: str) -> str:
    from core.srs_instance import srs
    return srs._user_prefix_pattern(user_id)


def reviews_between(cur, user_id: str, start: datetime, end: datetime) -> tuple[int, int]:
    """(answers, good answers) in [start, end): the reviews a learner
    gave, a check the level rule only assumed left out as everywhere
    else a first sighting is counted."""
    from srs.srs import _NOT_A_KEPT_CHECK
    rows = _rows(
        cur,
        "SELECT COUNT(*), COUNT(*) FILTER (WHERE quality >= 3) FROM review_log "
        f"WHERE card_id LIKE %s AND reviewed_at >= %s AND reviewed_at < %s{_NOT_A_KEPT_CHECK}",
        (_pattern(user_id), start, end),
    )
    return (int(rows[0][0]), int(rows[0][1])) if rows else (0, 0)


def new_by_day(cur, user_id: str, tz: int | None, start: datetime, end: datetime) -> dict[date, int]:
    """Items first met on each local day in [start, end), counted as the
    pace counts them (srs.get_new_items_today): a card once, on the day
    it was first reviewed in a mode a deck serves."""
    from core.srs_instance import srs
    from srs.srs import _NOT_A_KEPT_CHECK
    mode_sql, mode_params = srs._servable_filter()
    pattern = _pattern(user_id)
    sql = f"""
        WITH events AS (
            SELECT card_id, reviewed_at AS at FROM review_log
            WHERE card_id LIKE %s{mode_sql}{_NOT_A_KEPT_CHECK}
            UNION ALL
            SELECT card_id, first_at AS at FROM card_first_review
            WHERE card_id LIKE %s{mode_sql}
        ), firsts AS (SELECT card_id, MIN(at) AS f FROM events GROUP BY card_id)
        SELECT {_local_day('f')} AS d, COUNT(*) FROM firsts
        WHERE f >= %s AND f < %s GROUP BY d
    """
    rows = _rows(cur, sql, (pattern, *mode_params, pattern, *mode_params, tz or 0, start, end))
    return {d: int(n) for d, n in rows}


def studied_days_between(cur, user_id: str, tz: int | None, start: datetime, end: datetime) -> int:
    """The local days in [start, end) the learner showed up on: a review
    or a graded practice answer, as the streak counts them (a bonus is no
    day, srs.NOT_STUDY_SOURCES)."""
    from srs.srs import NOT_STUDY_SOURCES
    sql = f"""
        SELECT COUNT(*) FROM (
            SELECT {_local_day('reviewed_at')} AS d FROM review_log
            WHERE card_id LIKE %s AND reviewed_at >= %s AND reviewed_at < %s
            UNION
            SELECT {_local_day('awarded_at')} FROM xp_ledger
            WHERE user_id = %s AND source <> ALL(%s) AND awarded_at >= %s AND awarded_at < %s
        ) x
    """
    return int(_one(cur, sql, (tz or 0, _pattern(user_id), start, end,
                               tz or 0, user_id, NOT_STUDY_SOURCES, start, end)))


def platform_count(cur, user_id: str, platform: str, start: datetime, end: datetime) -> int:
    table = PLATFORMS[platform]
    return int(_one(cur, f"SELECT COUNT(*) FROM {table} WHERE user_id = %s AND created_at >= %s AND created_at < %s",
                    (user_id, start, end)))


def write_count(cur, user_id: str, start: datetime, end: datetime) -> tuple[int, int]:
    """(dictations, composition sentences) in [start, end)."""
    d = int(_one(cur, "SELECT COUNT(*) FROM dictation_log WHERE user_id = %s AND created_at >= %s AND created_at < %s",
                 (user_id, start, end)))
    c = int(_one(cur, "SELECT COUNT(*) FROM composition_log WHERE user_id = %s AND created_at >= %s AND created_at < %s",
                 (user_id, start, end)))
    return d, c


def exam_sections(cur, user_id: str, start: datetime, end: datetime) -> int:
    return int(_one(cur, "SELECT COUNT(*) FROM exam_attempts WHERE user_id = %s AND finished_at >= %s AND finished_at < %s",
                    (user_id, start, end)))


def duels_played(cur, user_id: str, start: datetime, end: datetime) -> int:
    """Duels run to their end: a sprint started and finished with an
    answer in it, so an empty run is no duel."""
    return int(_one(
        cur,
        "SELECT COUNT(*) FROM pvp_entries WHERE user_id = %s AND finished_at >= %s AND finished_at < %s "
        "AND jsonb_array_length(answers) >= 1",
        (user_id, start, end),
    ))


def day_cleared(cur, user_id: str, start: datetime, end: datetime) -> bool:
    return bool(_one(cur, "SELECT COUNT(*) FROM day_clears WHERE user_id = %s AND cleared_at >= %s AND cleared_at < %s",
                     (user_id, start, end)))


def _level_rank(level: str) -> int:
    return LEVELS.index(level) if level in LEVELS else -1


def new_mode_done(cur, user_id: str, start: datetime, end: datetime) -> bool:
    """A mode never used, or the level above in one the learner knows: a
    platform's first answer ever fell in the week, or a level of it was
    first answered in the week and is higher than every one the platform
    had before."""
    for platform, table in PLATFORMS.items():
        rows = _rows(cur, f"SELECT level, MIN(created_at) FROM {table} WHERE user_id = %s GROUP BY level", (user_id,))
        firsts = [(lvl, at) for lvl, at in rows if at is not None]
        if not firsts:
            continue
        earliest = min(at for _, at in firsts)
        if start <= earliest < end:
            return True
        before = [_level_rank(lvl) for lvl, at in firsts if at < start]
        if not before:
            continue
        top = max(before)
        for lvl, at in firsts:
            if start <= at < end and _level_rank(lvl) > top:
                return True
    return False


def last_platform_use(cur, user_id: str) -> dict[str, datetime | None]:
    return {p: _one(cur, f"SELECT MAX(created_at) FROM {t} WHERE user_id = %s", (user_id,), None)
            for p, t in PLATFORMS.items()}


def has_met_duels(cur, user_id: str) -> bool:
    return bool(_one(cur, "SELECT COUNT(*) FROM pvp_entries WHERE user_id = %s", (user_id,))
                or _one(cur, "SELECT COUNT(*) FROM pvp_friends WHERE user_id = %s", (user_id,)))


# ── Choosing (pure) ───────────────────────────────────────────────────
def pick_day(eligible: dict[str, bool], ordinal: int) -> list[str]:
    """The day's three: `due` first (else `new`), then two of the rest by
    a rotation of the date. Nothing random: two learners of one profile
    get the same missions the same day."""
    first = "due" if eligible.get("due") else "new"
    rest = [k for k in DAILY if k != first and eligible.get(k)]
    if rest:
        turn = ordinal % len(rest)
        rest = rest[turn:] + rest[:turn]
    return [first, *rest][:DAYS_PER_DAY]


def pick_week(eligible: dict[str, bool], ordinal: int) -> list[str]:
    """The week's three: `days5` always, then two of the rest by the
    week's number."""
    rest = [k for k in WEEKLY if k != "days5" and eligible.get(k)]
    if rest:
        turn = ordinal % len(rest)
        rest = rest[turn:] + rest[:turn]
    return ["days5", *rest][:PER_WEEK]


def _tenth_more(n: float, uplift: float) -> int:
    """ceil(n * uplift), the float's dust rounded off first: 100 * 1.1 is
    110.00000000000001, and a goal of 111 would be one more than asked."""
    return math.ceil(round(n * uplift, 6))


def new_goal(avg_week: float, cap: int | None) -> int:
    """N new cards: their own seven-day average plus a tenth, at least
    NEW_MIN and never past the day's ration nor NEW_MAX."""
    ceiling = min(NEW_MAX, cap) if cap else NEW_MAX
    return max(min(NEW_MIN, ceiling), min(ceiling, _tenth_more(avg_week, NEW_UPLIFT)))


def accuracy_goal(avg_pct: float) -> int:
    return min(ACCURACY_MAX, round(avg_pct) + ACCURACY_GAIN)


def volume_goal(prev: int) -> int:
    return min(_tenth_more(prev, VOLUME_UPLIFT), prev + VOLUME_MAX_GAIN)


def practice_platform(last_use: dict[str, datetime | None], yesterday: str | None) -> str:
    """The platform the learner practised least recently (never first),
    not the one yesterday's mission named, ties in the platforms' order."""
    order = list(PLATFORMS)
    floor = datetime.min.replace(tzinfo=timezone.utc)
    choices = [p for p in order if p != yesterday] or order
    return min(choices, key=lambda p: (last_use.get(p) or floor, order.index(p)))


# ── Assigning ─────────────────────────────────────────────────────────
def _profile(cur, user_id: str) -> tuple[int | None, bool]:
    cur.execute("SELECT tz_offset_min FROM user_profiles WHERE user_id = %s", (user_id,))
    row = cur.fetchone()
    return (row[0] if row else None), credits_mod.unlimited_on(cur, user_id)


def _insert_mission(cur, user_id, scope, period, kind, slot, target, baseline, credits, xp, platform=None) -> None:
    cur.execute(
        "INSERT INTO missions (user_id, scope, period, kind, slot, target, baseline, credits, xp, platform) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING",
        (user_id, scope, period, kind, slot, target, baseline, credits, xp, platform),
    )


def ensure_day(cur, user_id: str, tz: int | None, now: datetime) -> date:
    """The day's missions, written the first time the day is read."""
    from core import pace
    from core.srs_instance import srs
    day, start, end = day_window(tz, now)
    cur.execute("SELECT COUNT(*) FROM missions WHERE user_id = %s AND scope = 'day' AND period = %s", (user_id, day))
    if cur.fetchone()[0]:
        return day

    due = len(srs.get_due_rows(user_id))
    p = pace.resolve_pace(user_id)
    cap = p.target if p else None
    week_ago = start - timedelta(days=7)
    by_day = new_by_day(cur, user_id, tz, week_ago, start)
    avg_week = sum(by_day.values()) / 7
    answers, good = reviews_between(cur, user_id, start - timedelta(days=ACCURACY_WINDOW), start)
    eligible = {
        "due": due >= DUE_MIN, "new": True, "practice": True, "write": True,
        "accuracy": answers >= ACCURACY_MIN_ANSWERS,
    }
    kinds = pick_day(eligible, day.toordinal())
    cur.execute("SELECT platform FROM missions WHERE user_id = %s AND scope = 'day' AND kind = 'practice' "
                "AND period = %s", (user_id, day - timedelta(days=1)))
    row = cur.fetchone()
    yesterday = row[0] if row else None
    for slot, kind in enumerate(kinds):
        target, baseline, platform = 1, None, None
        if kind == "due":
            target, baseline = max(1, due), due
        elif kind == "new":
            target, baseline = new_goal(avg_week, cap), round(avg_week)
        elif kind == "accuracy":
            avg_pct = 100 * good / answers if answers else 0
            target, baseline = accuracy_goal(avg_pct), round(avg_pct)
        elif kind == "practice":
            platform = practice_platform(last_platform_use(cur, user_id), yesterday)
        _insert_mission(cur, user_id, "day", day, kind, slot, target, baseline, DAY_CREDITS, DAY_XP, platform)
    _insert_mission(cur, user_id, "bonus", day, BONUS, DAYS_PER_DAY, DAYS_PER_DAY, None, BONUS_CREDITS, BONUS_XP)
    return day


def ensure_week(cur, user_id: str, tz: int | None, now: datetime) -> date:
    monday, start, end = week_window(tz, now)
    cur.execute("SELECT COUNT(*) FROM missions WHERE user_id = %s AND scope = 'week' AND period = %s", (user_id, monday))
    if cur.fetchone()[0]:
        return monday
    prev_start = start - timedelta(days=7)
    prev, _ = reviews_between(cur, user_id, prev_start, start)
    eligible = {
        "volume": prev >= VOLUME_MIN_PREV, "new_mode": True, "exam_section": True,
        "write10": True, "duels5": has_met_duels(cur, user_id),
    }
    for slot, kind in enumerate(pick_week(eligible, monday.isocalendar()[1])):
        target = {"days5": DAYS_TARGET, "volume": volume_goal(prev), "new_mode": 1, "exam_section": 1,
                  "duels5": DUELS_TARGET, "write10": WRITE_TARGET}[kind]
        _insert_mission(cur, user_id, "week", monday, kind, slot, target, prev if kind == "volume" else None,
                        WEEK_CREDITS, WEEK_XP)
    return monday


# ── Reading progress ──────────────────────────────────────────────────
def progress(cur, user_id: str, tz: int | None, row: dict, window: tuple[datetime, datetime]) -> dict:
    """{have, of, done, ...} for one mission, from the logs, now."""
    start, end = window
    kind, target = row["kind"], row["target"]
    out = {"have": 0, "of": target, "done": False}
    if kind == "due":
        n, _ = reviews_between(cur, user_id, start, end)
        out.update(have=min(n, target), done=day_cleared(cur, user_id, start, end))
    elif kind == "new":
        n = sum(new_by_day(cur, user_id, tz, start, end).values())
        out.update(have=min(n, target), done=n >= target)
    elif kind == "practice":
        n = platform_count(cur, user_id, row["platform"], start, end)
        out.update(of=1, have=min(n, 1), done=n >= 1)
    elif kind == "accuracy":
        n, good = reviews_between(cur, user_id, start, end)
        pct = round(100 * good / n) if n else 0
        out.update(of=ACCURACY_ANSWERS, have=min(n, ACCURACY_ANSWERS), pct=pct, goal=target,
                   done=n >= ACCURACY_ANSWERS and pct >= target)
    elif kind == "write":
        d, c = write_count(cur, user_id, start, end)
        out.update(of=1, have=min(d + c, 1), done=d + c >= 1)
    elif kind == "days5":
        n = studied_days_between(cur, user_id, tz, start, end)
        out.update(have=min(n, target), done=n >= target)
    elif kind == "volume":
        n, _ = reviews_between(cur, user_id, start, end)
        out.update(have=min(n, target), done=n >= target)
    elif kind == "new_mode":
        ok = new_mode_done(cur, user_id, start, end)
        out.update(of=1, have=int(ok), done=ok)
    elif kind == "exam_section":
        n = exam_sections(cur, user_id, start, end)
        out.update(of=1, have=min(n, 1), done=n >= 1)
    elif kind == "duels5":
        n = duels_played(cur, user_id, start, end)
        out.update(have=min(n, target), done=n >= target)
    elif kind == "write10":
        d, c = write_count(cur, user_id, start, end)
        out.update(have=min(c, target), done=c >= target)
    return out


def _stamp_done(cur, user_id: str, scope: str, period: date, kind: str) -> bool:
    cur.execute(
        "UPDATE missions SET done_at = NOW() WHERE user_id = %s AND scope = %s AND period = %s AND kind = %s "
        "AND done_at IS NULL", (user_id, scope, period, kind))
    if cur.rowcount == 1:
        events.record(user_id, "mission_done", {"scope": scope, "kind": kind}, cur=cur)
        return True
    return False


def _read_rows(cur, user_id: str, scope: str, period: date) -> list[dict]:
    cur.execute(
        "SELECT kind, slot, target, baseline, credits, xp, platform, done_at, paid_at FROM missions "
        "WHERE user_id = %s AND scope = %s AND period = %s ORDER BY slot", (user_id, scope, period))
    return [dict(zip(("kind", "slot", "target", "baseline", "credits", "xp", "platform", "done_at", "paid_at"), r))
            for r in cur.fetchall()]


def _evaluate(cur, user_id, tz, scope, period, window, rows) -> list[dict]:
    """Read every unfinished mission's progress and stamp what is done;
    the day's bonus is done when its three are."""
    out = []
    for row in rows:
        if row["kind"] == BONUS:
            continue
        prog = progress(cur, user_id, tz, row, window) if not row["done_at"] else {"have": row["target"], "of": row["target"], "done": True}
        if prog["done"] and not row["done_at"]:
            _stamp_done(cur, user_id, scope, period, row["kind"])
            row["done_at"] = datetime.now(timezone.utc)
        out.append({**row, **prog, "done": bool(row["done_at"])})
    if scope == "day":
        bonus = next((r for r in rows if r["kind"] == BONUS), None)
        if bonus is not None:
            if not bonus["done_at"] and out and len(out) == DAYS_PER_DAY and all(m["done"] for m in out):
                _stamp_done(cur, user_id, "bonus", period, BONUS)
                bonus["done_at"] = datetime.now(timezone.utc)
            out.append({**bonus, "have": sum(1 for m in out if m["done"]), "of": DAYS_PER_DAY, "done": bool(bonus["done_at"])})
    return out


# ── Marks ─────────────────────────────────────────────────────────────
_swept: dict[str, float] = {}
_SWEEP_TTL_S = 120.0


def _put_mark(cur, user_id: str, key: str, klass: str, credits: int, xp: int, at: datetime | None = None) -> bool:
    cur.execute(
        "INSERT INTO mission_marks (user_id, key, class, credits, xp, reached_at) VALUES (%s,%s,%s,%s,%s,COALESCE(%s, NOW())) "
        "ON CONFLICT DO NOTHING", (user_id, key, klass, credits, xp, at))
    if cur.rowcount == 1:
        events.record(user_id, "mission_done", {"scope": klass, "kind": key}, cur=cur)
        return True
    return False


def note(user_id: str, key: str) -> None:
    """A discovery noted at the act, for the ones nothing durable records
    (a photo analysed, an arrival date set, an import). Never raises: the
    exercise it follows must not fail for it."""
    if key not in NOTED:
        return
    try:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                _put_mark(cur, user_id, key, "discovery", DISCOVERIES[key], DISCOVERY_XP)
            conn.commit()
        finally:
            conn.close()
        _swept.pop(user_id, None)
    except Exception:
        logger.exception("missions: note %s failed", key)


def _known_counts(cur, user_id: str) -> dict[str, int]:
    """Cards the learner has really taken through the learning steps, by
    line: a graduated mode with more than the level rule's one assumed
    check behind it. {'vocab': n, 'kana': {ids}, 'grammar_n5': {ids}}."""
    pattern = _pattern(user_id)
    rows = _rows(
        cur,
        "SELECT DISTINCT card_id FROM card_modes WHERE card_id LIKE %s AND NOT is_learning AND total_reviews >= 2",
        (pattern,),
    )
    prefix = pattern[:-1]
    ids = {cid[len(prefix):] if cid.startswith(prefix) else cid.split(":", 1)[-1] for (cid,) in rows}
    return {"vocab": sum(1 for i in ids if i.startswith("vocab_")), "ids": ids}


def _sweep_marks(cur, user_id: str) -> None:
    """Write the discoveries and achievements the tables say are reached
    now. Idempotent (a key is written once), and kept to one pass every
    couple of minutes a learner: the word count is the dear one."""
    from core.srs_instance import srs
    from study import card_index as ci
    now = time.monotonic()
    if _swept.get(user_id, 0) > now:
        return
    q = {
        "first_dictation": "SELECT MIN(created_at) FROM dictation_log WHERE user_id = %s AND created_at >= %s",
        "first_conversation": "SELECT MIN(created_at) FROM conversation_log WHERE user_id = %s AND created_at >= %s",
        "first_exam": "SELECT MIN(finished_at) FROM exam_attempts WHERE user_id = %s AND finished_at >= %s",
        "first_deck": "SELECT MIN(published_at) FROM decks WHERE user_id = %s AND visibility = 'public' AND published_at >= %s",
        "first_friend": "SELECT MIN(since) FROM pvp_friends WHERE user_id = %s AND since >= %s",
        "first_duel": "SELECT MIN(finished_at) FROM pvp_entries WHERE user_id = %s AND finished_at >= %s",
        "first_video": "SELECT MIN(created_at) FROM video_sessions WHERE user_id = %s AND created_at >= %s",
    }
    for key, sql in q.items():
        at = _one(cur, sql, (user_id, SINCE), None)
        if at is not None:
            _put_mark(cur, user_id, key, "discovery", DISCOVERIES[key], DISCOVERY_XP, at)

    known = _known_counts(cur, user_id)
    for key, n in WORD_MARKS.items():
        if known["vocab"] >= n:
            _put_mark(cur, user_id, key, "achievement", *ACHIEVEMENTS[key])
    kana_ids = {i for k in ci.deck_keys("kana") for i in ci.item_ids("kana", k)}
    if kana_ids and kana_ids <= known["ids"]:
        _put_mark(cur, user_id, "kana_done", "achievement", *ACHIEVEMENTS["kana_done"])
    n5 = set(ci.item_ids("grammar", "N5"))
    if n5 and n5 <= known["ids"]:
        _put_mark(cur, user_id, "grammar_n5", "achievement", *ACHIEVEMENTS["grammar_n5"])
    studied = len(srs._studied_days(user_id))
    for key, n in DAY_MARKS.items():
        if studied >= n:
            _put_mark(cur, user_id, key, "achievement", *ACHIEVEMENTS[key])
    if _one(cur, "SELECT COUNT(*) FROM exam_attempts WHERE user_id = %s AND total > 0 AND correct >= %s * total",
            (user_id, EXAM_PASS)):
        _put_mark(cur, user_id, "exam_passed", "achievement", *ACHIEVEMENTS["exam_passed"])
    if _one(cur, "SELECT COUNT(*) FROM pvp_entries e JOIN pvp_duels d ON d.id = e.duel_id "
                 "WHERE e.user_id = %s AND d.kind = 'ranked' AND e.result >= 1", (user_id,)):
        _put_mark(cur, user_id, "ranked_win", "achievement", *ACHIEVEMENTS["ranked_win"])
    _swept[user_id] = now + _SWEEP_TTL_S


# ── Paying ────────────────────────────────────────────────────────────
def _xp_today(cur, user_id: str, start: datetime, end: datetime) -> int:
    return int(_one(cur, "SELECT COALESCE(SUM(xp), 0) FROM xp_ledger WHERE user_id = %s AND source = 'mission' "
                         "AND awarded_at >= %s AND awarded_at < %s", (user_id, start, end)))


def reward_of(credits: int, xp: int, unlimited: bool) -> dict:
    """What a learner is given for `credits` and `xp` of the table: the
    credits themselves, or on the pass the same number as XP."""
    return {"credits": 0, "xp": xp + credits} if unlimited else {"credits": credits, "xp": xp}


def _pay(cur, user_id: str, ref: str, credits: int, xp: int, unlimited: bool, capped: bool,
         window: tuple[datetime, datetime]) -> dict:
    """Write the reward, in the caller's transaction: the ledger row, the
    XP row (clipped to the day's cap when `capped`)."""
    from core.srs_instance import srs
    gift = reward_of(credits, xp, unlimited)
    if gift["credits"]:
        credits_mod.award(user_id, gift["credits"], "mission", ref, cur=cur)
    granted, fare = 0, None
    if gift["xp"]:
        granted = gift["xp"]
        if capped:
            granted = max(0, min(granted, XP_DAY_CAP - _xp_today(cur, user_id, *window)))
        if granted:
            fare = srs.award_xp(user_id, "mission", ref, granted, cur=cur)
    return {"credits": gift["credits"], "xp": granted, "level": fare}


def _studied(user_id: str) -> bool:
    from core.srs_instance import srs
    return srs.first_studied_day(user_id) is not None


def claim(user_id: str, scope: str, kind: str, now: datetime | None = None) -> dict | None:
    """Collect what a finished mission pays: the reward, or None when
    there is nothing to collect (not done, not studied, collected before
    -- or by another request a moment ago)."""
    from core.srs_instance import srs
    now = now or datetime.now(timezone.utc)
    if scope not in SCOPES or kind not in KINDS:
        return None
    if not _studied(user_id):
        return None
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            tz, unlimited = _profile(cur, user_id)
            _, d_start, d_end = day_window(tz, now)
            if scope == "mark":
                cur.execute(
                    "UPDATE mission_marks SET paid_at = NOW() WHERE user_id = %s AND key = %s AND paid_at IS NULL "
                    "RETURNING credits, xp, class", (user_id, kind))
                got = cur.fetchone()
                if got is None:
                    conn.rollback()
                    return None
                paid = _pay(cur, user_id, f"mark:{kind}", got[0], got[1], unlimited, False, (d_start, d_end))
                klass = got[2]
            else:
                cur.execute(
                    "UPDATE missions SET paid_at = NOW() WHERE ctid = (SELECT ctid FROM missions WHERE user_id = %s "
                    "AND scope = %s AND kind = %s AND done_at IS NOT NULL AND paid_at IS NULL "
                    "ORDER BY period DESC LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING credits, xp, period",
                    (user_id, scope, kind))
                got = cur.fetchone()
                if got is None:
                    conn.rollback()
                    return None
                paid = _pay(cur, user_id, f"{scope}:{got[2].isoformat()}:{kind}", got[0], got[1], unlimited, True,
                            (d_start, d_end))
                klass = scope
            events.record(user_id, "mission_claimed", {"scope": scope, "kind": kind}, cur=cur)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    credits_mod.forget(user_id)
    srs.forget_history(user_id)
    return {**paid, "scope": klass, "kind": kind, "unit": "xp" if unlimited else "credits"}


def settle_past(cur, user_id: str, tz: int | None, unlimited: bool, now: datetime) -> int:
    """Pay what earlier periods finished and nobody collected: nothing a
    learner earned is lost by not opening the app that evening. Returns
    the rewards paid."""
    _, d_start, d_end = day_window(tz, now)
    day = credits_mod.local_today(tz, now)
    monday = day - timedelta(days=day.weekday())
    cur.execute(
        "SELECT scope, period, kind, credits, xp FROM missions WHERE user_id = %s AND done_at IS NOT NULL "
        "AND paid_at IS NULL AND ((scope IN ('day','bonus') AND period < %s) OR (scope = 'week' AND period < %s)) "
        "FOR UPDATE", (user_id, day, monday))
    rows = cur.fetchall()
    n = 0
    for scope, period, kind, c, x in rows:
        cur.execute("UPDATE missions SET paid_at = NOW() WHERE user_id = %s AND scope = %s AND period = %s AND kind = %s "
                    "AND paid_at IS NULL", (user_id, scope, period, kind))
        if cur.rowcount == 1:
            _pay(cur, user_id, f"{scope}:{period.isoformat()}:{kind}", c, x, unlimited, True, (d_start, d_end))
            n += 1
    return n


# ── The surface ───────────────────────────────────────────────────────
def _shape(row: dict, unlimited: bool) -> dict:
    gift = reward_of(row["credits"], row["xp"], unlimited)
    out = {"kind": row["kind"], "have": row["have"], "of": row["of"], "done": row["done"],
           "paid": row["paid_at"] is not None, **gift}
    for key in ("pct", "goal"):
        if key in row:
            out[key] = row[key]
    if row.get("platform"):
        out["platform"] = row["platform"]
    return out


def view(user_id: str, now: datetime | None = None) -> dict:
    """GET /api/missions: the day (three missions and the bonus), the
    week (three), and how many are waiting to be collected."""
    from core.srs_instance import srs
    now = now or datetime.now(timezone.utc)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            tz, unlimited = _profile(cur, user_id)
            day, d_start, d_end = day_window(tz, now)
            monday, w_start, w_end = week_window(tz, now)
            settled = settle_past(cur, user_id, tz, unlimited, now) if _studied(user_id) else 0
            ensure_day(cur, user_id, tz, now)
            ensure_week(cur, user_id, tz, now)
            days = _evaluate(cur, user_id, tz, "day", day, (d_start, d_end), _read_rows(cur, user_id, "day", day)
                             + _read_rows(cur, user_id, "bonus", day))
            week = _evaluate(cur, user_id, tz, "week", monday, (w_start, w_end), _read_rows(cur, user_id, "week", monday))
            _sweep_marks(cur, user_id)
            cur.execute("SELECT COUNT(*) FROM mission_marks WHERE user_id = %s AND paid_at IS NULL", (user_id,))
            marks_waiting = cur.fetchone()[0]
            xp_today = _xp_today(cur, user_id, d_start, d_end)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    missions = [m for m in days if m["kind"] != BONUS]
    bonus = next((m for m in days if m["kind"] == BONUS), None)
    waiting = sum(1 for m in [*missions, *week, *([bonus] if bonus else [])] if m["done"] and not m["paid_at"]) + marks_waiting
    if settled:
        credits_mod.forget(user_id)
        srs.forget_history(user_id)    # what was settled wrote credits and XP
    return {
        "day": {"date": day.isoformat(), "missions": [_shape(m, unlimited) for m in missions],
                "bonus": _shape(bonus, unlimited) if bonus else None},
        "week": {"start": monday.isoformat(), "missions": [_shape(m, unlimited) for m in week]},
        "waiting": waiting,
        "unit": "xp" if unlimited else "credits",
        "xp": {"today": xp_today, "cap": XP_DAY_CAP},
    }


def book(user_id: str) -> dict:
    """GET /api/missions/book: the discoveries and the achievements, each
    with what it pays and whether it is reached and collected; and, for
    those not reached, how far (a count or a share)."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            _, unlimited = _profile(cur, user_id)
            _sweep_marks(cur, user_id)
            cur.execute("SELECT key, reached_at, paid_at FROM mission_marks WHERE user_id = %s", (user_id,))
            have = {k: (r, p) for k, r, p in cur.fetchall()}
            known = _known_counts(cur, user_id)
        conn.commit()
    finally:
        conn.close()
    from core.srs_instance import srs
    from study import card_index as ci
    studied = len(srs._studied_days(user_id))
    kana_ids = {i for k in ci.deck_keys("kana") for i in ci.item_ids("kana", k)}
    n5 = set(ci.item_ids("grammar", "N5"))
    far = {
        "kana_done": (len(kana_ids & known["ids"]), len(kana_ids)),
        "grammar_n5": (len(n5 & known["ids"]), len(n5)),
        **{k: (min(known["vocab"], n), n) for k, n in WORD_MARKS.items()},
        **{k: (min(studied, n), n) for k, n in DAY_MARKS.items()},
    }

    def item(key, credits, xp, klass):
        reached, paid = have.get(key, (None, None))
        out = {"key": key, "class": klass, "reached": reached is not None, "paid": paid is not None,
               **reward_of(credits, xp, unlimited)}
        if key in far and reached is None:
            out["have"], out["of"] = far[key]
        return out

    return {
        "discoveries": [item(k, c, DISCOVERY_XP, "discovery") for k, c in DISCOVERIES.items()],
        "achievements": [item(k, c, x, "achievement") for k, (c, x) in ACHIEVEMENTS.items()],
        "unit": "xp" if unlimited else "credits",
    }


def waives(user_id: str, platform: str, now: datetime | None = None) -> bool:
    """Whether the next graded exercise on `platform` is one the day's
    mission asks, and so costs no credit. The seam the practice fare will
    read when practice is priced (it costs nothing today, so nothing
    calls this yet): true while today's `practice` mission names the
    platform and is not yet done."""
    now = now or datetime.now(timezone.utc)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            tz, _ = _profile(cur, user_id)
            day, _, _ = day_window(tz, now)
            cur.execute("SELECT 1 FROM missions WHERE user_id = %s AND scope = 'day' AND period = %s "
                        "AND kind = 'practice' AND platform = %s AND done_at IS NULL", (user_id, day, platform))
            return cur.fetchone() is not None
    finally:
        conn.close()

