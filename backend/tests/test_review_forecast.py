# ── 予報 — the forecast on the card (plan 126) ─────────────────────────
# Every card a run serves already carried, per rating, the xp and the
# stage it would earn (preview_reviews_bulk). The desk's card panel
# prints each verdict as a tile with when the card comes back, so the
# preview now carries `due_in` per quality. Read off the same saved
# state, never persisted.
import pytest

from core.auth import get_user_id
from core.db import db_conn
from core.srs_instance import srs
from main import app
from srs.scheduler import BLACKOUT_WAIT, GRADUATING_DAYS, LEARNING_STEPS, learning_wait

USER = "forecast-test-learner"
MODE = "kanji.flashcard.f2b"
CARD = f"{USER}:kanji_N5_forecast"


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


def test_a_new_card_forecasts_its_learning_steps(clean):
    out = srs.preview_reviews_bulk([CARD], MODE, USER)[CARD]
    assert set(range(6)) == set(out)
    # A pass climbs one learning step; a fail keeps the first. Difficult
    # climbs it too, but comes back halfway to where Correct would.
    assert abs(out[4]["due_in"] - LEARNING_STEPS[1].total_seconds()) <= 2
    assert abs(out[3]["due_in"] - learning_wait(1, 3).total_seconds()) <= 2
    assert out[3]["due_in"] < out[4]["due_in"]
    assert abs(out[1]["due_in"] - LEARNING_STEPS[0].total_seconds()) <= 2
    # The six-button bar's ends: Perfect climbs two steps, Blackout
    # comes back sooner than the first.
    assert abs(out[5]["due_in"] - LEARNING_STEPS[2].total_seconds()) <= 2
    assert abs(out[0]["due_in"] - BLACKOUT_WAIT.total_seconds()) <= 2


def test_a_graduated_card_forecasts_review_and_relearning(clean):
    # Four passes walk the learning steps and graduate the card to a
    # two-day interval in review.
    for _ in range(4):
        srs.review(CARD, MODE, 4)
    out = srs.preview_reviews_bulk([CARD], MODE, USER)[CARD]
    # A pass stays in review, days away; a fail falls back into the steps.
    assert out[4]["due_in"] >= GRADUATING_DAYS * 86400 - 2
    # Each pass grade a day past the one below it, where rounding used
    # to print the same day on Difficult and Correct.
    assert out[3]["due_in"] + 86400 - 2 <= out[4]["due_in"]
    assert out[4]["due_in"] + 86400 - 2 <= out[5]["due_in"]
    assert abs(out[1]["due_in"] - LEARNING_STEPS[0].total_seconds()) <= 2
    assert abs(out[2]["due_in"] - LEARNING_STEPS[1].total_seconds()) <= 2


def test_the_batch_carries_the_forecast_on_every_card(client, clean):
    previous = app.dependency_overrides.get(get_user_id)
    app.dependency_overrides[get_user_id] = lambda: USER
    try:
        r = client.get("/api/kanji/cards?level=N5&mode=kanji.flashcard.f2b&count=2")
        assert r.status_code == 200, r.text
        cards = r.json()["cards"]
        assert cards
        for card in cards:
            preview = card["review_preview"]
            assert set(preview) == set("012345")
            for q in "012345":
                assert preview[q]["due_in"] > 0
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_user_id, None)
        else:
            app.dependency_overrides[get_user_id] = previous
