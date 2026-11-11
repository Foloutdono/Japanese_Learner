# ── scripts/recount_known_checks.py (plan 300) ──────────────────────
# The one-shot that takes the level rule's virtual check out of the rows
# answered before plan 300. Each row is written by hand, as the old
# review left it, on a second learner (conftest's other_user), so the
# shared DEV_USER_ID's own rows are never what is being counted.
from core.db import db_conn
from scripts.recount_known_checks import folded, over, recount

MODE = "kanji.flashcard.f2b"


def _card(user, name):
    return f"{user}:kanji_N5_{name}"


def _write(card, total, correct, repetitions, lapses=0, learning=False, log=(), assumed=False, fold=False):
    """A card_modes row, its logged answers (the first a check when
    `assumed`) and, when `fold`, a trace of history folded away."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO cards(id) VALUES (%s) ON CONFLICT DO NOTHING", (card,))
            cur.execute(
                """
                INSERT INTO card_modes(card_id, mode, interval_days, is_learning, learning_step, repetitions,
                                       lapses, total_reviews, correct_reviews, next_review)
                VALUES (%s, %s, 30, %s, 0, %s, %s, %s, %s, NOW() + interval '30 days')
                """,
                (card, MODE, learning, repetitions, lapses, total, correct),
            )
            for i, quality in enumerate(log):
                cur.execute("INSERT INTO review_log(card_id, mode, quality, assumed) VALUES (%s, %s, %s, %s)",
                            (card, MODE, quality, assumed and i == 0))
            if fold:
                cur.execute("INSERT INTO card_first_review(card_id, mode, first_at) VALUES (%s, %s, NOW())",
                            (card, MODE))
        conn.commit()
    finally:
        conn.close()


def _counts(card):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT total_reviews, correct_reviews FROM card_modes WHERE card_id = %s AND mode = %s",
                        (card, MODE))
            return cur.fetchone()
    finally:
        conn.close()


def test_the_virtual_check_leaves_the_rows_answered_before(other_user):
    u = other_user
    # A check passed before plan 300: one answer, two in the row.
    passed = _card(u, "passed")
    _write(passed, total=2, correct=2, repetitions=4, log=(4,), assumed=True)
    # Answered before the checks were marked (plan 224): a lapse on top
    # of the virtual check, 2 of 1 for one wrong answer.
    lapsed = _card(u, "lapsed")
    _write(lapsed, total=2, correct=1, repetitions=2, lapses=1, learning=True, log=(1,))
    # Already right: a check passed since plan 300 counts once.
    honest = _card(u, "honest")
    _write(honest, total=1, correct=1, repetitions=4, log=(4,), assumed=True)
    # History folded into the rollup: the log no longer says.
    folded_row = _card(u, "folded")
    _write(folded_row, total=3, correct=3, repetitions=5, log=(4, 4), fold=True)
    # Recounted, it would read untouched and be asked its check again.
    unmoved = _card(u, "unmoved")
    _write(unmoved, total=2, correct=2, repetitions=3, log=(4,))
    # An untouched assumption: its virtual check is what makes it known.
    untouched = _card(u, "untouched")
    _write(untouched, total=1, correct=1, repetitions=3)

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            assert {row[0] for row in over(cur, u)} == {passed, lapsed}
            assert folded(cur, u) == 1
            assert recount(cur, u) == 2
        conn.commit()
        assert _counts(passed) == (1, 1)
        assert _counts(lapsed) == (1, 0)
        for card, counts in ((honest, (1, 1)), (folded_row, (3, 3)), (unmoved, (2, 2)), (untouched, (1, 1))):
            assert _counts(card) == counts, card
        # Run twice, it moves nothing.
        with conn.cursor() as cur:
            assert over(cur, u) == []
            assert recount(cur, u) == 0
        conn.commit()
    finally:
        conn.close()
