# ── The grade a review is logged under ───────────────────────
#
# Scheduler.review clamps onto the 0..5 scale, and tests/test_scheduler.py
# covers that. What it cannot see is the other half of a review:
# SRSEngine.review used to hand the scheduler a clamped grade and then
# _log_review the caller's original one, so the card and its review_log
# row could disagree about what was answered.
#
# review_log is not an audit log — lifetime XP, the level, total reviews
# and the streak are all folds over it (see CLAUDE.md) — so a grade that
# lands there wrong is wrong in the figures for good.
#
# Runs against synthetic user ids on the real DB and cleans up after
# itself; nothing here touches the shared DEV_USER_ID rows.
import uuid

import pytest

from core.db import db_conn
from core.srs_instance import srs
from routes.account import delete_user_rows

MODE = "vocab.flashcard.f2b"


@pytest.fixture
def learner():
    uid = f"grade-test-{uuid.uuid4()}"
    yield uid
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            delete_user_rows(cur, uid)
        conn.commit()
    finally:
        conn.close()


def _logged(uid):
    """(quality, xp_earned) per review_log row, oldest first."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT quality, xp_earned FROM review_log "
                "WHERE card_id LIKE %s ORDER BY id",
                (f"{uid}:%",),
            )
            return cur.fetchall()
    finally:
        conn.close()


def test_a_grade_past_the_smallint_is_logged_rather_than_raising(learner):
    # review_log.quality is a SMALLINT. An unclamped 99999 raised on the
    # INSERT — after _save_state had already rescheduled the card, so the
    # review moved the card, logged no row and paid no XP.
    result = srs.review(f"{learner}:vocab_N5_水_みず", MODE, 99_999)

    assert _logged(learner) == [(5, result["xp_earned"])]


def test_an_out_of_range_grade_is_logged_at_the_edge_of_the_scale(learner):
    # 99 fits the column, so it used to be stored verbatim — where
    # get_daily_quality counts it as good (quality >= 3) for good, and
    # compute_review_xp paid it a streak bonus on top of a base XP of 0,
    # its grade being in no BASE_XP_BY_QUALITY row.
    srs.review(f"{learner}:vocab_N5_水_みず", MODE, 99)
    srs.review(f"{learner}:vocab_N5_火_ひ", MODE, -3)

    assert [q for q, _ in _logged(learner)] == [5, 0]


def test_the_card_and_its_log_row_agree_on_what_was_answered(learner):
    result = srs.review(f"{learner}:vocab_N5_水_みず", MODE, 7)

    assert result["last_quality"] == _logged(learner)[0][0]


def test_a_grade_on_the_scale_is_untouched(learner):
    for quality in (0, 1, 2, 3, 4, 5):
        srs.review(f"{learner}:vocab_N5_水_みず_{quality}", MODE, quality)

    assert [q for q, _ in _logged(learner)] == [0, 1, 2, 3, 4, 5]
