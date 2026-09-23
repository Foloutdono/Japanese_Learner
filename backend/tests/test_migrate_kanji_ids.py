# scripts/migrate_kanji_ids.py moves a learner's rows off the kanji ids
# the deck stopped serving twice (plan 112: 会 at N5 and N4, and 22 more).
# It runs the vocab migration's merge on kanji ids, so what is pinned
# here is what would quietly corrupt a history rather than fail loudly:
#
#   * a learner who studied both copies keeps the effort of both and the
#     least-advanced schedule, not whichever row was written last
#   * deck_cards follows the id to its level, and a deck holding both
#     copies keeps one row
#   * an unknown id, another user's rows, and the vocab ids are left alone
#   * --user scopes everything; without --yes nothing is written
#
# The moves are monkeypatched, as in test_migrate_vocab_ids.py.
import importlib.util
from pathlib import Path

import pytest

from content.kanji_data import DECK_BY_CHAR, KANJI_BY_LEVEL, kanji_to_id
from content.kanji_renames import MOVES
from core.db import db_conn

_SPEC = importlib.util.spec_from_file_location(
    "migrate_kanji_ids",
    Path(__file__).resolve().parent.parent / "scripts" / "migrate_kanji_ids.py",
)
migrate = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(migrate)

USER = "kanji-migration-probe"
OTHER = "kanji-migration-other"

OLD_A = "kanji_N4_probeA"      # studied only at N4
NEW_A = "kanji_N5_probeA"
OLD_B = "kanji_N4_probeB"      # studied at both levels -- the merge path
NEW_B = "kanji_N5_probeB"
STRAY = "kanji_N4_probeStray"  # neither served nor mapped
VOCAB = "vocab_N4__probeA"     # a different source entirely

MODE = "kanji.meaning"
DECK_ID = 990112
DECK_ID_HOLDING_TARGET = 990113


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
    for deck_id in (DECK_ID, DECK_ID_HOLDING_TARGET):
        _exec("INSERT INTO decks(id, user_id, name, type) VALUES (%s,%s,%s,'kanji') "
              "ON CONFLICT (id) DO NOTHING", (deck_id, USER, "probe"))
    # (user, raw, interval, total, correct, lapses)
    rows = [
        (USER, OLD_A, 5, 6, 5, 1),
        (USER, OLD_B, 2, 4, 2, 2),
        (USER, NEW_B, 9, 10, 9, 0),
        (USER, STRAY, 1, 1, 1, 0),
        (USER, VOCAB, 7, 7, 7, 0),
        (OTHER, OLD_A, 3, 3, 3, 0),
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
    _exec("UPDATE card_first_review SET first_at = NOW() - interval '30 days' WHERE card_id = %s", (f"{USER}:{NEW_B}",))
    for deck_id, level, raw in ((DECK_ID, "N4", OLD_A), (DECK_ID_HOLDING_TARGET, "N5", NEW_B),
                                (DECK_ID_HOLDING_TARGET, "N4", OLD_B)):
        _exec("INSERT INTO deck_cards(deck_id, user_id, source, level, raw_id) VALUES (%s,%s,'kanji',%s,%s)",
              (deck_id, USER, level, raw))


def _wipe():
    for user in (USER, OTHER):
        _exec("DELETE FROM review_log WHERE card_id LIKE %s", (f"{user}:%",))
        _exec("DELETE FROM card_first_review WHERE card_id LIKE %s", (f"{user}:%",))
        _exec("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{user}:%",))
        _exec("DELETE FROM cards WHERE id LIKE %s", (f"{user}:%",))
        _exec("DELETE FROM decks WHERE user_id = %s", (user,))


@pytest.fixture
def probe(monkeypatch):
    _wipe()
    monkeypatch.setattr(migrate, "MOVES", {OLD_A: NEW_A, OLD_B: NEW_B})
    monkeypatch.setattr(migrate, "served_ids", lambda: frozenset({NEW_A, NEW_B}))
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


def test_a_dry_run_changes_nothing(probe):
    assert migrate.main(["--user", USER]) == 0
    assert _ids(USER) == {OLD_A, OLD_B, NEW_B, STRAY, VOCAB}


def test_moves_rename_merge_and_leave_what_they_should(probe):
    assert migrate.main(["--yes", "--user", USER]) == 0

    assert OLD_A not in _ids(USER) and NEW_A in _ids(USER)
    assert _modes(USER, NEW_A) == {MODE: (5, 6, 5, 1)}
    assert _exec("SELECT count(*) FROM review_log WHERE card_id = %s", (f"{USER}:{NEW_A}",))[0][0] == 1

    # both copies studied: effort summed, the least-advanced schedule kept
    assert OLD_B not in _ids(USER)
    assert _modes(USER, NEW_B) == {MODE: (2, 14, 11, 2)}
    assert _exec("SELECT count(*) FROM review_log WHERE card_id = %s", (f"{USER}:{NEW_B}",))[0][0] == 2
    (first_at,) = _exec("SELECT first_at FROM card_first_review WHERE card_id = %s", (f"{USER}:{NEW_B}",))[0]
    (age_days,) = _exec("SELECT EXTRACT(day FROM NOW() - %s::timestamptz)", (first_at,))[0]
    assert int(age_days) >= 29

    assert _modes(USER, STRAY) == {MODE: (1, 1, 1, 0)}
    assert _modes(USER, VOCAB) == {MODE: (7, 7, 7, 0)}
    assert _modes(OTHER, OLD_A) == {MODE: (3, 3, 3, 0)}

    rows = _exec("SELECT deck_id, level, raw_id FROM deck_cards WHERE user_id = %s ORDER BY deck_id, raw_id", (USER,))
    assert rows == [(DECK_ID, "N5", NEW_A), (DECK_ID_HOLDING_TARGET, "N5", NEW_B)]


def test_a_second_run_is_a_no_op(probe):
    assert migrate.main(["--yes", "--user", USER]) == 0
    before = (_ids(USER), _modes(USER, NEW_A), _modes(USER, NEW_B))
    assert migrate.main(["--yes", "--user", USER]) == 0
    assert (_ids(USER), _modes(USER, NEW_A), _modes(USER, NEW_B)) == before


# ── The table itself ──────────────────────────────────────────


def _served():
    return {kanji_to_id(entry, level) for level, entries in KANJI_BY_LEVEL.items() for entry in entries}


def test_every_character_is_taught_once():
    """Plan 112: 23 characters sat at two levels and forked a learner's
    progress in two. A character is one card, at its lowest level."""
    chars = [entry["kanji"] for entries in KANJI_BY_LEVEL.values() for entry in entries]
    assert len(chars) == len(set(chars)) == len(DECK_BY_CHAR)


def test_every_move_lands_on_a_served_card_at_a_lower_level_in_one_hop():
    served = _served()
    order = ("N5", "N4", "N3", "N2", "N1")
    assert {new for new in MOVES.values() if new not in served} == set()
    assert {old for old in MOVES if old in served} == set()
    assert set(MOVES.values()) & set(MOVES) == set()
    for old, new in MOVES.items():
        assert old.split("_", 2)[2] == new.split("_", 2)[2], "a move keeps its character"
        assert order.index(new.split("_")[1]) < order.index(old.split("_")[1])
