# ── /api/stats' `items` block: the wall map's unit ────────────────
# The map and the profile ledger count CARDS; the per-mode buckets
# beside them count drills, and both shapes ship in the same payload.
# The things worth pinning are the ones that would quietly put a wrong
# number on the home screen rather than fail:
#
#   * a card is scored by its BEST mode and counted once, so a kanji
#     you can read but not write is one kanji and not two fifths of one
#   * the score is continuous in how far the card has come toward the
#     21-day mastery mark — the old three buckets put a whole deck
#     reviewed once at exactly half, and it crawled from there
#   * a deck's denominator is its cards counted once, never the sum of
#     its modes' pools
#   * the per-mode buckets are UNTOUCHED, because the stats screen is
#     still drawn from them
import pytest

from core.auth import DEV_USER_ID
from core.db import db_conn
from routes.stats import MASTERED_DAYS
from study import card_index

SOURCE, DECK = "kanji", "N5"
READ, WRITE = "kanji.flashcard.f2b", "kanji.write_kanji"


def _seed(rows):
    """(raw_id, mode, interval_days, reviews) written straight into
    card_modes — the point is a specific spread of intervals, which
    srs.review() cannot be asked for."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for raw_id, mode, interval, reviews in rows:
                full = f"{DEV_USER_ID}:{raw_id}"
                cur.execute("INSERT INTO cards(id) VALUES (%s) ON CONFLICT DO NOTHING", (full,))
                cur.execute(
                    """
                    INSERT INTO card_modes(card_id, mode, interval_days, next_review,
                                           total_reviews, correct_reviews, is_learning)
                    VALUES (%s, %s, %s, NOW() + make_interval(days => %s), %s, %s, FALSE)
                    ON CONFLICT (card_id, mode) DO UPDATE
                    SET interval_days = EXCLUDED.interval_days,
                        total_reviews = EXCLUDED.total_reviews
                    """,
                    (full, mode, interval, interval, reviews, reviews),
                )
        conn.commit()
    finally:
        conn.close()


@pytest.fixture(autouse=True)
def _clean():
    yield
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{DEV_USER_ID}:%",))
            cur.execute("DELETE FROM cards WHERE id LIKE %s", (f"{DEV_USER_ID}:%",))
        conn.commit()
    finally:
        conn.close()


def _items(client, source=SOURCE, deck=DECK):
    return client.get("/api/stats").json()["items"][source][deck]


def test_a_deck_is_denominated_in_cards_not_in_drills(client):
    # kanji N5 is 103 kanji across five modes = 515 drills. The map's
    # denominator is 103; anything near 515 means it went back to
    # counting the modes.
    assert _items(client)["total"] == card_index.item_total(SOURCE, DECK) == 103


def test_a_card_is_scored_by_its_best_mode_and_counted_once(client):
    # Mastered for reading, barely started for writing. That is one
    # learned kanji, not one fifth of one.
    kanji = card_index.item_ids(SOURCE, DECK)[0]
    _seed([(kanji, READ, 40, 6), (kanji, WRITE, 1, 1)])

    got = _items(client)
    assert got["learned"] == 1
    assert got["score"] == pytest.approx(1 / 103, abs=1e-4)


def test_the_score_is_continuous_rather_than_three_buckets(client):
    # Under the old rule every unmastered card counted exactly one half,
    # so a whole deck reviewed once scored 50% and then crawled. The
    # intervals here are deliberately chosen NOT to sum to a multiple of
    # the threshold: 3 and 18 would have made the continuous answer and
    # the flat-half answer numerically identical, and the test would
    # have passed against the rule it exists to rule out.
    a, b = card_index.item_ids(SOURCE, DECK)[:2]
    _seed([(a, READ, 3, 2), (b, READ, 7, 4)])

    expected = (3 / MASTERED_DAYS + 7 / MASTERED_DAYS) / 103
    assert _items(client)["score"] == pytest.approx(expected, abs=1e-4)
    assert _items(client)["learned"] == 0
    # And the flat rule those two cards used to get.
    assert expected != pytest.approx((0.5 + 0.5) / 103, abs=1e-4)


def test_a_card_nearer_the_threshold_scores_higher_than_one_further(client):
    # The property the continuity is FOR: progress inside a deck shows
    # up before anything is mastered.
    a, b = card_index.item_ids(SOURCE, DECK)[:2]
    _seed([(a, READ, 2, 1)])
    early = _items(client)["score"]
    _seed([(a, READ, 16, 5)])
    later = _items(client)["score"]
    assert later > early > 0


def test_a_card_past_the_threshold_counts_once_and_no_more(client):
    # A card 400 days out is still one card.
    a = card_index.item_ids(SOURCE, DECK)[0]
    _seed([(a, READ, 400, 20)])
    assert _items(client)["score"] == pytest.approx(1 / 103, abs=1e-4)
    assert _items(client)["learned"] == 1


def test_a_row_with_no_reviews_behind_it_is_not_progress(client):
    a = card_index.item_ids(SOURCE, DECK)[0]
    _seed([(a, READ, 30, 0)])
    got = _items(client)
    assert (got["learned"], got["score"]) == (0, 0.0)


def test_an_untouched_deck_scores_zero_without_dividing_by_nothing(client):
    got = _items(client)
    assert got["learned"] == 0
    assert got["score"] == 0.0
    assert got["total"] > 0


def test_every_section_and_deck_is_present_even_when_never_studied(client):
    # The line's length is the section's real extent, not the part the
    # learner has data for — the map draws all five stops regardless.
    items = client.get("/api/stats").json()["items"]
    assert set(items) == {"kana", "vocab", "kanji", "grammar"}
    for source, decks in items.items():
        assert list(decks) == card_index.deck_keys(source)


def test_the_per_mode_buckets_are_left_alone(client):
    # The stats screen is still drawn from them, in their own unit.
    kanji = card_index.item_ids(SOURCE, DECK)[0]
    _seed([(kanji, READ, 40, 6)])

    payload = client.get("/api/stats").json()
    bucket = payload[SOURCE][DECK][READ]
    assert bucket["total"] == card_index.total(SOURCE, DECK, READ) == 103
    assert (bucket["mastered"], bucket["learning"]) == (1, 0)
    assert bucket["new"] == 102
