# scripts/rescale_intervals.py pulls back cards the old growth rule
# pushed years out, by replaying each card's own review history through
# the current scheduler.
#
# It edits a learner's actual progress in place and there is no undo, so
# the things worth pinning are the ones that would quietly corrupt a
# schedule rather than fail loudly:
#
#   * a replay must reproduce the CURRENT rule, not merely a smaller
#     number -- a cap dressed up as a replay would clump every card onto
#     one date
#   * the new due date must be anchored to the card's last real review,
#     not to now, or every rescaled card is silently granted a fresh
#     full interval on top of the time it has already waited
#   * a card whose review log is not its whole history must be LEFT
#     ALONE; replaying a partial log yields a short interval and floods
#     the queue with cards that are not due
#   * a card inside the horizon must not be touched at all -- this is a
#     repair for one breakage, not a re-scheduling of the whole deck
#   * without --apply nothing may be written

import importlib.util
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from core.db import db_conn
from srs.scheduler import LEARNING_STEPS, Scheduler

_SPEC = importlib.util.spec_from_file_location(
    "rescale_intervals",
    Path(__file__).resolve().parent.parent / "scripts" / "rescale_intervals.py",
)
rescale = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(rescale)

USER = "rescale-probe"
MODE = "kanji.flashcard.f2b"


def _seed(card_id, *, qualities, next_review, interval_days,
          logged=None, last_reviewed_at=None):
    """A card_modes row plus the review_log rows that explain it.

    Direct SQL because the whole point is a row the current code can no
    longer produce: srs.review() would never write a next_review in 2049.
    `logged` writes fewer log rows than the card claims reviews, which is
    the incomplete-history case.
    """
    full = f"{USER}:{card_id}"
    last = last_reviewed_at or datetime.now(timezone.utc) - timedelta(days=30)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO cards(id) VALUES (%s) ON CONFLICT DO NOTHING", (full,))
            cur.execute(
                """
                INSERT INTO card_modes(card_id, mode, interval_days, next_review,
                                       total_reviews, correct_reviews, is_learning)
                VALUES (%s, %s, %s, %s, %s, %s, FALSE)
                ON CONFLICT (card_id, mode) DO UPDATE
                SET interval_days = EXCLUDED.interval_days,
                    next_review = EXCLUDED.next_review,
                    total_reviews = EXCLUDED.total_reviews,
                    is_learning = FALSE
                """,
                (full, MODE, interval_days, next_review, len(qualities),
                 sum(1 for q in qualities if q >= 3)),
            )
            n = len(qualities) if logged is None else logged
            for i, quality in enumerate(qualities[:n]):
                # Spaced so the ORDER BY reviewed_at replays them in order,
                # with the last one landing on `last`.
                at = last - timedelta(minutes=(n - 1 - i))
                cur.execute(
                    "INSERT INTO review_log(card_id, mode, quality, reviewed_at) "
                    "VALUES (%s, %s, %s, %s)",
                    (full, MODE, quality, at),
                )
        conn.commit()
    finally:
        conn.close()
    return full


def _row(card_id):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT interval_days, next_review, is_learning, difficulty "
                "FROM card_modes WHERE card_id = %s AND mode = %s",
                (card_id, MODE),
            )
            return cur.fetchone()
    finally:
        conn.close()


@pytest.fixture(autouse=True)
def _clean():
    yield
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (f"{USER}:%",))
            cur.execute("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{USER}:%",))
            cur.execute("DELETE FROM cards WHERE id LIKE %s", (f"{USER}:%",))
        conn.commit()
    finally:
        conn.close()


def _run(tmp_path=None, **kw):
    """The script's own main(), with argv assembled the way a shell would.

    --apply always gets a --restore-file under tmp_path: left to its
    default the script writes the dump into the working directory, which
    during a test run is the repository.
    """
    if kw.get("apply") and "restore_file" not in kw:
        kw["restore_file"] = tmp_path / "restore.csv"
    argv = ["--user", USER]
    for k, v in kw.items():
        argv.append(f"--{k.replace('_', '-')}")
        if v is not True:
            argv.append(str(v))
    import sys
    old = sys.argv
    sys.argv = ["rescale_intervals", *argv]
    try:
        return rescale.main()
    finally:
        sys.argv = old


# ── The replay itself, no database involved ──────────────────
def test_the_replay_is_the_current_rule_and_not_a_cap():
    # Two histories of different lengths must come out at different
    # intervals — a cap would put them both on the same date, which is
    # the failure mode that looks like it worked.
    short = rescale.replay([4] * 6)
    long = rescale.replay([4] * 9)
    assert short.interval_days < long.interval_days

    # And it must agree, exactly, with what the scheduler does live.
    sched = Scheduler()
    from srs.models import CardState
    state = CardState(card_id="c", mode="m")
    for _ in range(9):
        state = sched.review(state, 4)
    assert long.interval_days == state.interval_days
    assert long.difficulty == pytest.approx(state.difficulty)


def test_the_new_due_date_is_anchored_to_the_last_real_review():
    # Not to now. A card reviewed six months ago that should have come
    # back in three is overdue, and must not be handed a fresh interval.
    state = rescale.replay([4] * 7)
    last = datetime.now(timezone.utc) - timedelta(days=400)
    assert rescale.due_after(state, last) == last + timedelta(days=state.interval_days)
    assert rescale.due_after(state, last) < datetime.now(timezone.utc)


def test_a_card_left_mid_relearning_waits_a_learning_step_not_an_interval():
    # Ending on a miss puts the card back in the learning steps, where
    # interval_days is stale and the step is what actually schedules it.
    state = rescale.replay([4, 4, 4, 4, 4, 4, 4, 1])
    assert state.is_learning
    last = datetime.now(timezone.utc) - timedelta(days=10)
    assert rescale.due_after(state, last) == last + LEARNING_STEPS[state.learning_step]


# ── End to end, against the database ─────────────────────────
def test_a_card_stuck_in_the_far_future_is_pulled_back(client, tmp_path):
    far = datetime.now(timezone.utc) + timedelta(days=8611)
    last = datetime.now(timezone.utc) - timedelta(days=200)
    card = _seed("kanji_1", qualities=[4] * 8, next_review=far,
                 interval_days=8611, last_reviewed_at=last)

    assert _run(tmp_path, apply=True) == 0

    interval, due, is_learning, _ = _row(card)
    # The replay's own answer, not a rounded-down guess.
    assert interval == rescale.replay([4] * 8).interval_days
    assert interval < 8611
    # Anchored to the last REAL review, not to now: the 200 days this
    # card has already waited count against its new interval. Measured
    # at the call site, because `due_after` being right is no use if the
    # migration hands it the wrong moment.
    assert due == last + timedelta(days=interval)


def test_reporting_alone_changes_nothing(client):
    far = datetime.now(timezone.utc) + timedelta(days=8611)
    card = _seed("kanji_2", qualities=[4] * 8, next_review=far, interval_days=8611)

    assert _run() == 0

    interval, due, _, _ = _row(card)
    assert interval == 8611
    assert due == far


def test_a_card_inside_the_horizon_is_left_alone(client, tmp_path):
    near = datetime.now(timezone.utc) + timedelta(days=60)
    card = _seed("kanji_3", qualities=[4] * 8, next_review=near, interval_days=60)

    assert _run(tmp_path, apply=True) == 0

    interval, due, _, _ = _row(card)
    assert (interval, due) == (60, near)


def test_a_card_whose_log_is_incomplete_is_skipped(client, tmp_path):
    # Claims eight reviews, logs three. Replaying those three would put
    # it days out and pretend that was its history.
    far = datetime.now(timezone.utc) + timedelta(days=8611)
    card = _seed("kanji_4", qualities=[4] * 8, next_review=far,
                 interval_days=8611, logged=3)

    assert _run(tmp_path, apply=True) == 0

    interval, due, _, _ = _row(card)
    assert (interval, due) == (8611, far), "a partial history must not reschedule a card"


def test_applying_writes_a_restore_file_with_the_rows_as_they_were(client, tmp_path):
    far = datetime.now(timezone.utc) + timedelta(days=8611)
    card = _seed("kanji_5", qualities=[4] * 8, next_review=far, interval_days=8611)
    restore = tmp_path / "restore.csv"

    assert _run(tmp_path, apply=True, restore_file=restore) == 0

    import csv
    written = list(csv.DictReader(restore.open(encoding="utf-8")))
    assert len(written) == 1
    assert written[0]["card_id"] == card
    # The state going IN, so the change can be undone from this file.
    assert written[0]["interval_days"] == "8611"
