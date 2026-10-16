"""The learner's history aggregates are kept until a write moves them
(plan 212, SRSEngine._remembered): lifetime XP, the total of reviews,
the days studied and the best run are read once, and every write
through the engine -- a review, a practice answer, a cleared day -- and
every erasure (the stats reset) is seen on the next read."""
from datetime import datetime, timezone

from core.db import db_conn
from core.srs_instance import srs
from srs.xp import BASE_XP_BY_QUALITY
from tests.conftest import acting_as

LEARNER = "history-memo-learner"
CARD = f"{LEARNER}:vocab_N5_水_みず"
MODE = "vocab.flashcard.f2b"


def _wipe() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM xp_ledger WHERE user_id = %s", (LEARNER,))
            cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (f"{LEARNER}:%",))
            cur.execute("DELETE FROM day_clears WHERE user_id = %s", (LEARNER,))
            cur.execute("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{LEARNER}:%",))
            cur.execute("DELETE FROM cards WHERE id LIKE %s", (f"{LEARNER}:%",))
        conn.commit()
    finally:
        conn.close()
    srs.forget_history(LEARNER)


def setup_function(_):
    _wipe()


def teardown_function(_):
    _wipe()


def _sql_count(sql: str) -> int:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, (f"{LEARNER}:%",))
            return int(cur.fetchone()[0])
    finally:
        conn.close()


def test_a_kept_figure_is_served_without_asking_again():
    assert srs.get_lifetime_xp(LEARNER) == 0
    # Written behind the engine's back: a kept figure does not see it,
    # which is what proves it was kept rather than read again.
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO xp_ledger(user_id, source, ref, xp) VALUES (%s, 'reading', 'x', 7)", (LEARNER,))
        conn.commit()
    finally:
        conn.close()
    assert srs.get_lifetime_xp(LEARNER) == 0
    srs.forget_history(LEARNER)
    assert srs.get_lifetime_xp(LEARNER) == 7


def test_a_review_moves_every_figure():
    assert (srs.get_lifetime_xp(LEARNER), srs.get_total_reviews(LEARNER)) == (0, 0)
    assert srs._studied_days(LEARNER) == set()
    srs.review(CARD, MODE, 5)
    assert srs.get_total_reviews(LEARNER) == 1 == _sql_count("SELECT COUNT(*) FROM review_log WHERE card_id LIKE %s")
    assert srs.get_lifetime_xp(LEARNER) > 0
    assert srs._studied_days(LEARNER) == {datetime.now(timezone.utc).date()}
    assert srs.get_best_quality_streak(LEARNER) == 1


def test_a_practice_answer_moves_the_xp_and_the_days():
    assert srs.get_lifetime_xp(LEARNER) == 0
    srs.award_practice(LEARNER, "reading", "level:N5", [5])
    assert srs.get_lifetime_xp(LEARNER) == BASE_XP_BY_QUALITY[5]
    assert srs._studied_days(LEARNER) == {datetime.now(timezone.utc).date()}


def test_a_cleared_day_moves_the_xp():
    before = srs.get_lifetime_xp(LEARNER)
    day = datetime.now(timezone.utc).date()
    assert srs.record_day_clear(LEARNER, day, 1, 10, 0, None) is not None
    assert srs.get_lifetime_xp(LEARNER) == before + 10


def test_the_stats_reset_is_seen(client):
    srs.review(CARD, MODE, 5)
    assert srs.get_total_reviews(LEARNER) == 1
    with acting_as(LEARNER):
        assert client.delete("/api/stats/reset").status_code == 200
    assert srs.get_total_reviews(LEARNER) == 0
    assert srs.get_lifetime_xp(LEARNER) == 0
    assert srs._studied_days(LEARNER) == set()


def test_a_caller_cannot_change_the_kept_days():
    srs.award_practice(LEARNER, "reading", "level:N5", [5])
    days = srs._studied_days(LEARNER)
    days.add(datetime(2000, 1, 1).date())
    assert srs._studied_days(LEARNER) == {datetime.now(timezone.utc).date()}
