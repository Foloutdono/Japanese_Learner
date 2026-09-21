# scripts/migrate_pool_cards.py carries a learner's rows for a pool word the
# deck now teaches (plan 110b) onto the deck card. Like the vocab-id
# migration it edits real progress in place, so the things pinned here are
# the ones that would quietly corrupt a history:
#
#   * a plain move takes every table with it and leaves nothing behind
#   * a move onto a deck card the learner already studied MERGES: effort
#     summed, the least-advanced schedule kept, the earlier first review
#   * a frequency pin moves from the pool's domain and key to the deck's,
#     and a pin the learner already holds on the deck key wins
#   * a pool id still in the pool, and one in neither the pool nor the
#     record, are left exactly as they are; so are another user's rows
#   * --user scopes everything; without --yes nothing is written
#
# The moves are monkeypatched: the test does not depend on what
# datas/vocab/pool_moves.json says this week, only on what the script does
# with what it says.
import pytest

from core.db import db_conn
from scripts import migrate_pool_cards as migrate

USER = "pool-migration-probe"
OTHER = "pool-migration-other"

POOL_A = "vocab_jmdict_900001"          # a plain move
DECK_A = "vocab_N5_probeA_ぷろーぶ"
POOL_B = "vocab_jmdict_900002"          # a move onto a card already studied
DECK_B = "vocab_N4__ぷろーぶびー"
POOL_LIVE = "vocab_jmdict_1"            # a real pool row: stays
POOL_STRAY = "vocab_jmdict_999999999"   # in neither the pool nor the record

MODE = "vocab.flashcard.f2b"
KEY_A_POOL, KEY_A_DECK = "probeA::ぷろーぶ", "probeA::ぷろーぶ"
KEY_B_POOL, KEY_B_DECK = "::ぷろーぶびー", "::ぷろーぶびー"

MOVES = {
    "900001": {"card": DECK_A, "key": KEY_A_DECK},
    "900002": {"card": DECK_B, "key": KEY_B_DECK},
}


def _exec(sql, params=()):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall() if cur.description else None
        conn.commit()
        return rows
    finally:
        conn.close()


def _seed():
    rows = [
        (USER, POOL_A, 5, 6, 5, 1),
        (USER, POOL_B, 2, 4, 2, 2),
        (USER, DECK_B, 9, 10, 9, 0),        # the deck card already studied
        (USER, POOL_LIVE, 3, 3, 3, 0),
        (USER, POOL_STRAY, 1, 1, 1, 0),
        (OTHER, POOL_A, 3, 3, 3, 0),
    ]
    for user, raw, interval, total, correct, lapses in rows:
        card = f"{user}:{raw}"
        _exec("INSERT INTO cards(id) VALUES (%s) ON CONFLICT DO NOTHING", (card,))
        _exec(
            """
            INSERT INTO card_modes
                (card_id, mode, difficulty, stability, interval_days, repetitions, lapses,
                 learning_step, is_learning, next_review, total_reviews, correct_reviews, last_quality)
            VALUES (%s,%s,2.5,1.0,%s,1,%s,0,FALSE, NOW() + (%s || ' days')::interval, %s,%s,3)
            """,
            (card, MODE, interval, lapses, interval, total, correct),
        )
        _exec("INSERT INTO review_log(card_id, mode, quality, reviewed_at) VALUES (%s,%s,4,NOW())", (card, MODE))
        _exec("INSERT INTO card_first_review(card_id, mode, first_at) VALUES (%s,%s,NOW() - interval '10 days') "
              "ON CONFLICT DO NOTHING", (card, MODE))
    _exec("UPDATE card_first_review SET first_at = NOW() - interval '30 days' WHERE card_id = %s", (f"{USER}:{DECK_B}",))
    for user, domain, key, tier in ((USER, "vocab_jmdict", KEY_A_POOL, 3), (USER, "vocab_jmdict", KEY_B_POOL, 4),
                                    (USER, "vocab", KEY_B_DECK, 9), (OTHER, "vocab_jmdict", KEY_A_POOL, 5)):
        _exec("INSERT INTO frequency_overrides(user_id, domain, item_key, tier) VALUES (%s,%s,%s,%s) "
              "ON CONFLICT DO NOTHING", (user, domain, key, tier))


def _wipe():
    for user in (USER, OTHER):
        _exec("DELETE FROM review_log WHERE card_id LIKE %s", (f"{user}:%",))
        _exec("DELETE FROM card_first_review WHERE card_id LIKE %s", (f"{user}:%",))
        _exec("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{user}:%",))
        _exec("DELETE FROM cards WHERE id LIKE %s", (f"{user}:%",))
        _exec("DELETE FROM frequency_overrides WHERE user_id = %s", (user,))


@pytest.fixture(autouse=True)
def probe(monkeypatch):
    _wipe()
    monkeypatch.setattr(migrate, "load_moves", lambda: MOVES)
    _seed()
    yield
    _wipe()


def _modes(user, raw):
    rows = _exec("SELECT mode, interval_days, total_reviews, correct_reviews, lapses "
                 "FROM card_modes WHERE card_id = %s", (f"{user}:{raw}",))
    return {r[0]: r[1:] for r in rows}


def _ids(user):
    rows = _exec("SELECT id FROM cards WHERE id LIKE %s", (f"{user}:%",))
    return {r[0].split(":", 1)[1] for r in rows}


def _pins(user):
    rows = _exec("SELECT domain, item_key, tier FROM frequency_overrides WHERE user_id = %s", (user,))
    return {(d, k): t for d, k, t in rows}


def test_a_dry_run_changes_nothing():
    assert migrate.main(["--user", USER]) == 0
    assert _ids(USER) == {POOL_A, POOL_B, DECK_B, POOL_LIVE, POOL_STRAY}
    assert _pins(USER) == {("vocab_jmdict", KEY_A_POOL): 3, ("vocab_jmdict", KEY_B_POOL): 4, ("vocab", KEY_B_DECK): 9}


def test_moves_merge_and_leave_what_they_should():
    assert migrate.main(["--yes", "--user", USER]) == 0

    # the plain move: every table, nothing left behind
    assert POOL_A not in _ids(USER) and DECK_A in _ids(USER)
    assert _modes(USER, DECK_A) == {MODE: (5, 6, 5, 1)}
    assert _exec("SELECT count(*) FROM review_log WHERE card_id = %s", (f"{USER}:{DECK_A}",))[0][0] == 1
    assert _exec("SELECT count(*) FROM review_log WHERE card_id = %s", (f"{USER}:{POOL_A}",))[0][0] == 0
    assert _exec("SELECT count(*) FROM card_first_review WHERE card_id = %s", (f"{USER}:{DECK_A}",))[0][0] == 1

    # the merge: effort summed, the least-advanced schedule kept, the
    # earlier first review kept
    assert POOL_B not in _ids(USER)
    assert _modes(USER, DECK_B) == {MODE: (2, 14, 11, 2)}
    (first_at,) = _exec("SELECT first_at FROM card_first_review WHERE card_id = %s", (f"{USER}:{DECK_B}",))[0]
    (age_days,) = _exec("SELECT EXTRACT(day FROM NOW() - %s::timestamptz)", (first_at,))[0]
    assert int(age_days) >= 29
    assert _exec("SELECT count(*) FROM review_log WHERE card_id = %s", (f"{USER}:{DECK_B}",))[0][0] == 2

    # a live pool word and an unknown id: untouched
    assert _modes(USER, POOL_LIVE) == {MODE: (3, 3, 3, 0)}
    assert _modes(USER, POOL_STRAY) == {MODE: (1, 1, 1, 0)}

    # another learner, out of --user's scope
    assert _modes(OTHER, POOL_A) == {MODE: (3, 3, 3, 0)}
    assert _pins(OTHER) == {("vocab_jmdict", KEY_A_POOL): 5}

    # pins: A's moves to the deck's domain; B's collides with the pin the
    # learner already holds there, and that one wins
    assert _pins(USER) == {("vocab", KEY_A_DECK): 3, ("vocab", KEY_B_DECK): 9}


def test_a_second_run_is_a_no_op():
    assert migrate.main(["--yes", "--user", USER]) == 0
    before = (_ids(USER), _modes(USER, DECK_A), _modes(USER, DECK_B), _pins(USER))
    assert migrate.main(["--yes", "--user", USER]) == 0
    assert (_ids(USER), _modes(USER, DECK_A), _modes(USER, DECK_B), _pins(USER)) == before


def test_the_record_names_real_deck_cards():
    """The shipped pool_moves.json: every target is a card the deck
    serves, and every id it names is gone from the pool."""
    import json
    from content.vocab_data import VOCAB_BY_LEVEL, vocab_to_id
    from content import vocab_jmdict_data as jmdict_db
    served = {vocab_to_id(e, level) for level, es in VOCAB_BY_LEVEL.items() for e in es}
    # The file itself, not load_moves(), which the fixture above patches.
    with open(migrate.MOVES_PATH, encoding="utf-8") as f:
        moves = json.load(f)
    assert moves
    for pool_id, entry in moves.items():
        assert entry["card"] in served, entry
        assert jmdict_db.get_by_id(int(pool_id)) is None, pool_id
