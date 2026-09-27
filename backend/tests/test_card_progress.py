# ── The card's bar, new to mastered (plan 147) ─────────────────────────
# A card "in progress" used to say only that. Every card a run serves now
# carries `progress`, 0.0 for a new card and 1.0 for a mastered one: the
# learning steps fill the first half, a graduated card's interval the
# second on a log scale up to MASTERED_DAYS. Each rating's preview
# carries where that rating leaves it, so the band moves as it presses.
import pytest

from core.auth import get_user_id
from core.db import db_conn
from core.srs_instance import srs
from main import app
from srs.scheduler import LEARNING_STEPS
from srs.srs import MASTERED_DAYS, SRSEngine

USER = "progress-test-learner"
MODE = "kanji.flashcard.f2b"
CARD = f"{USER}:kanji_N5_progress"
STEPS = len(LEARNING_STEPS)


def _wipe() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (f"{USER}:%",))
            cur.execute("DELETE FROM card_first_review WHERE card_id LIKE %s", (f"{USER}:%",))
            cur.execute("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{USER}:%",))
            cur.execute("DELETE FROM cards WHERE id LIKE %s", (f"{USER}:%",))
        conn.commit()
    finally:
        conn.close()


@pytest.fixture
def clean():
    _wipe()
    yield
    _wipe()


def test_the_ends_are_the_stages():
    assert SRSEngine._progress(0, 0, True, 0) == 0.0
    assert SRSEngine._progress(9, MASTERED_DAYS, False, STEPS) == 1.0
    # A mastered card relearning a lapse keeps its interval, so its
    # stage -- and its bar -- stay mastered.
    assert SRSEngine._progress(9, 40, True, 0) == 1.0


def test_the_steps_fill_the_first_half_and_the_days_the_second():
    steps = [SRSEngine._progress(3, 0, True, s) for s in range(STEPS + 1)]
    assert steps[0] == 0.0 and steps[-1] == 0.5
    assert steps == sorted(steps) and len(set(steps)) == len(steps)
    days = [SRSEngine._progress(9, d, False, STEPS) for d in range(1, MASTERED_DAYS)]
    assert days[0] == 0.5
    assert days == sorted(days) and len(set(days)) == len(days)
    assert days[-1] < 1.0


def test_reviews_move_the_bar_and_the_preview_says_where(clean):
    assert srs.get_bulk_progress([CARD], MODE) == {CARD: 0.0}
    seen = [0.0]
    for _ in range(STEPS + 2):
        before = srs.preview_reviews_bulk([CARD], MODE, USER)[CARD][4]["progress"]
        srs.review(CARD, MODE, 4)
        now = srs.get_bulk_progress([CARD], MODE)[CARD]
        assert now == before
        seen.append(now)
    assert seen == sorted(seen) and seen[-1] > 0.5
    # A miss sends a graduated card back into the steps' half.
    assert srs.preview_reviews_bulk([CARD], MODE, USER)[CARD][1]["progress"] < 0.5


def test_the_batch_carries_progress_on_every_card(client, clean):
    srs.review(CARD, MODE, 4)
    previous = app.dependency_overrides.get(get_user_id)
    app.dependency_overrides[get_user_id] = lambda: USER
    try:
        r = client.get(f"/api/kanji/cards?level=N5&mode={MODE}&count=3")
        assert r.status_code == 200, r.text
        cards = r.json()["cards"]
        assert cards
        for card in cards:
            assert 0.0 <= card["progress"] <= 1.0
            for q in "012345":
                assert 0.0 <= card["review_preview"][q]["progress"] <= 1.0
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_user_id, None)
        else:
            app.dependency_overrides[get_user_id] = previous


def test_the_dictionary_reads_the_same_bar(clean):
    # get_user_states feeds the dictionary's catalogue (card_lookup's
    # card_stats); its per-mode progress is the one the runs serve.
    for _ in range(2):
        srs.review(CARD, MODE, 4)
    state = srs.get_user_states(USER)[(CARD, MODE)]
    assert state["progress"] == srs.get_bulk_progress([CARD], MODE)[CARD]
    assert 0.0 < state["progress"] < 0.5
