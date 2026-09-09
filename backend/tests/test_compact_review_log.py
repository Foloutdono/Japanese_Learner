# ── scripts/compact_review_log.py — the rollup keeps the figures ──
#
# The whole point of the rollup is that compaction is INVISIBLE: XP, the
# level that follows it, total reviews, the streak, the calendar, the
# 番付 standing, the rating mix, the hour chart and the daily-new budget
# must all read exactly the same before and after. So the tests here are
# mostly one shape — snapshot every reader, compact, snapshot again,
# assert equality — which is the property that actually matters and the
# one a future change to any of those queries would break.
#
# Runs against synthetic user ids on the real DB, with a second user as
# the control, and cleans up after itself; nothing here touches the
# shared DEV_USER_ID rows other tests rely on.
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from core.db import db_conn
from core.srs_instance import srs
from routes.account import delete_user_rows, prefix_pattern
from scripts.compact_review_log import (
    DEFAULT_MIN_QUALITY,
    MIN_RETENTION_DAYS,
    compact,
    _scope,
    survey,
)

# A mode the decks actually serve: get_new_items_today and
# get_journey_item_counts filter to study.modes.SRS_MODES before taking
# each card's first sighting, so a made-up mode would make those two
# assertions vacuous.
MODE = "vocab.flashcard.f2b"


def _uid():
    return f"compact-test-{uuid.uuid4()}"


def _seed(uid, rows):
    """rows: (card, days_ago, hour, quality, xp). Written straight to
    review_log so the timestamps can be historical -- srs.review() always
    stamps NOW()."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for card, days_ago, hour, quality, xp in rows:
                at = (datetime.now(timezone.utc) - timedelta(days=days_ago)).replace(
                    hour=hour, minute=30, second=0, microsecond=0
                )
                cur.execute("INSERT INTO cards(id) VALUES (%s) ON CONFLICT DO NOTHING",
                            (f"{uid}:{card}",))
                cur.execute(
                    "INSERT INTO review_log(card_id, mode, quality, xp_earned, reviewed_at) "
                    "VALUES (%s, %s, %s, %s, %s)",
                    (f"{uid}:{card}", MODE, quality, xp, at),
                )
        conn.commit()
    finally:
        conn.close()


def _snapshot(uid):
    """Every reader that touches review_log, in one dict."""
    return {
        "lifetime_xp": srs.get_lifetime_xp(uid),
        "total_reviews": srs.get_total_reviews(uid),
        "streak": srs.get_streak(uid),
        "calendar": srs.get_daily_review_counts(uid, days=35),
        "hours_utc": srs.get_review_hours(uid, tz_offset=0),
        "hours_paris": srs.get_review_hours(uid, tz_offset=120),
        "quality_mix": srs.get_quality_mix(uid),
        "best_run": srs.get_best_quality_streak(uid, min_quality=DEFAULT_MIN_QUALITY),
        "new_today": srs.get_new_items_today(uid),
        "rank": srs.get_user_rank(uid),
    }


def _compact(uid, days=MIN_RETENTION_DAYS, min_quality=DEFAULT_MIN_QUALITY):
    scope, params = _scope(uid)
    params["days"] = days
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            deleted = compact(cur, scope, params, min_quality)
        conn.commit()
        return deleted
    finally:
        conn.close()


def _rows_left(uid):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM review_log WHERE card_id LIKE %s",
                        (prefix_pattern(uid),))
            return cur.fetchone()[0]
    finally:
        conn.close()


def _cleanup(*uids):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for uid in uids:
                delete_user_rows(cur, uid)
        conn.commit()
    finally:
        conn.close()


@pytest.fixture
def learner():
    """A year of history: old rows either side of the retention floor,
    several ratings, several hours, and a card met long ago that is also
    reviewed today."""
    uid = _uid()
    old = MIN_RETENTION_DAYS + 30
    _seed(uid, [
        # ── well inside the compactable range ──
        ("vocab_N5_a", old + 300, 9, 5, 12),
        ("vocab_N5_a", old + 300, 9, 4, 10),
        ("vocab_N5_b", old + 200, 21, 3, 6),
        ("vocab_N5_b", old + 200, 21, 5, 12),
        ("vocab_N5_c", old + 100, 14, 0, 1),
        ("vocab_N5_c", old + 100, 14, 4, 10),
        ("kanji_N5_d", old + 60, 23, 5, 12),
        ("kanji_N5_d", old, 7, 2, 4),
        # ── inside the window, must survive untouched ──
        ("vocab_N5_a", 3, 8, 5, 12),
        ("vocab_N5_e", 1, 19, 4, 10),
        # ── today: vocab_N5_a was FIRST met a year ago, so it is not
        #    new; vocab_N5_f is genuinely new today ──
        ("vocab_N5_a", 0, 10, 5, 12),
        ("vocab_N5_f", 0, 10, 4, 10),
    ])
    yield uid
    _cleanup(uid)


# ── The property that matters ────────────────────────────────────

def test_compaction_changes_no_figure_the_learner_can_see(learner):
    before = _snapshot(learner)
    assert before["total_reviews"] == 12, "fixture did not land"

    deleted = _compact(learner)
    assert deleted == 8, "the eight rows past the floor should have gone"

    assert _snapshot(learner) == before


def test_the_rows_really_went(learner):
    _compact(learner)
    # Four survivors: the two inside the window and the two from today.
    assert _rows_left(learner) == 4


def test_a_card_met_long_ago_is_not_new_again_after_its_rows_go(learner):
    # The daily-new budget is MIN(reviewed_at) per card. vocab_N5_a was
    # first met a year ago and reviewed again today: without
    # card_first_review its oldest surviving row would be today's, and
    # the queue would hand the learner an allowance they already spent.
    assert srs.get_new_items_today(learner) == 1  # only vocab_N5_f
    _compact(learner)
    assert srs.get_new_items_today(learner) == 1


def test_first_sightings_are_kept_for_every_compacted_card(learner):
    _compact(learner)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM card_first_review WHERE card_id LIKE %s",
                (prefix_pattern(learner),),
            )
            assert cur.fetchone()[0] == 4  # a, b, c, d
    finally:
        conn.close()


def test_running_it_twice_is_a_no_op(learner):
    _compact(learner)
    after_one = _snapshot(learner)
    assert _compact(learner) == 0
    assert _snapshot(learner) == after_one


def test_compaction_is_scoped_to_the_learner_it_names():
    mine, theirs = _uid(), _uid()
    old = MIN_RETENTION_DAYS + 10
    _seed(mine, [("vocab_N5_a", old, 9, 5, 12)])
    _seed(theirs, [("vocab_N5_a", old, 9, 5, 12)])
    try:
        control = _snapshot(theirs)
        _compact(mine)
        assert _rows_left(mine) == 0
        assert _rows_left(theirs) == 1
        assert _snapshot(theirs) == control
    finally:
        _cleanup(mine, theirs)


# ── The rollup's own shape ───────────────────────────────────────

def test_the_rollup_is_much_smaller_than_the_rows_it_replaces():
    uid = _uid()
    old = MIN_RETENTION_DAYS + 5
    # 40 reviews inside one hour of one day: one bucket.
    _seed(uid, [(f"vocab_N5_{i}", old, 9, 4, 10) for i in range(40)])
    try:
        _compact(uid)
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*), SUM(reviews), SUM(xp) FROM review_daily "
                            "WHERE user_id = %s", (uid,))
                buckets, reviews, xp = cur.fetchone()
        finally:
            conn.close()
        assert (buckets, reviews, xp) == (1, 40, 400)
        assert srs.get_total_reviews(uid) == 40
        assert srs.get_lifetime_xp(uid) == 400
    finally:
        _cleanup(uid)


def test_ratings_survive_as_the_six_counters():
    uid = _uid()
    old = MIN_RETENTION_DAYS + 5
    _seed(uid, [("vocab_N5_a", old, 9, q, 1) for q in (0, 1, 2, 3, 4, 5, 5, 5)])
    try:
        before = srs.get_quality_mix(uid)
        assert before == {"0": 1, "1": 1, "2": 1, "3": 1, "4": 1, "5": 3}
        _compact(uid)
        assert srs.get_quality_mix(uid) == before
    finally:
        _cleanup(uid)


def test_a_day_is_never_half_compacted():
    # The cutoff is date_trunc'd, so the studied-day set behind the
    # streak is exact on both sides of it: a day is wholly rows or
    # wholly rollup, never counted twice and never dropped.
    uid = _uid()
    _seed(uid, [("vocab_N5_a", MIN_RETENTION_DAYS + 1, h, 4, 10) for h in (0, 8, 23)])
    try:
        before = srs.get_streak(uid)
        _compact(uid)
        assert srs.get_streak(uid) == before
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(DISTINCT day) FROM review_daily WHERE user_id = %s",
                            (uid,))
                assert cur.fetchone()[0] == 1
        finally:
            conn.close()
    finally:
        _cleanup(uid)


# ── The documented loss, pinned so it stays the only one ─────────

def test_a_run_wholly_inside_the_compacted_range_is_remembered():
    uid = _uid()
    old = MIN_RETENTION_DAYS + 5
    _seed(uid, [("vocab_N5_a", old, 9, q, 10) for q in (5, 5, 5, 5, 5, 1)])
    try:
        assert srs.get_best_quality_streak(uid, min_quality=4) == 5
        _compact(uid)
        assert srs.get_best_quality_streak(uid, min_quality=4) == 5
    finally:
        _cleanup(uid)


def test_the_mark_is_ignored_at_a_threshold_it_was_not_measured_at():
    uid = _uid()
    old = MIN_RETENTION_DAYS + 5
    _seed(uid, [("vocab_N5_a", old, 9, 3, 10) for _ in range(6)])
    try:
        # Measured at 4, a run of 3s is no run at all; the stored mark
        # must not then be handed back as an answer about 2s.
        _compact(uid, min_quality=4)
        assert srs.get_best_quality_streak(uid, min_quality=4) == 0
        assert srs.get_best_quality_streak(uid, min_quality=2) == 0
    finally:
        _cleanup(uid)


# ── The floor ────────────────────────────────────────────────────

def test_the_retention_floor_is_refused_not_clamped():
    from scripts.compact_review_log import main
    import sys
    argv = sys.argv
    sys.argv = ["compact_review_log", "--yes", "--days", str(MIN_RETENTION_DAYS - 1)]
    try:
        assert main() == 2
    finally:
        sys.argv = argv


def test_survey_reports_without_changing_anything(learner):
    before = _snapshot(learner)
    scope, params = _scope(learner)
    params["days"] = MIN_RETENTION_DAYS
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            found = survey(cur, scope, params)
        conn.commit()
    finally:
        conn.close()
    assert found["rows"] == 8
    assert found["users"] == 1
    assert _snapshot(learner) == before
