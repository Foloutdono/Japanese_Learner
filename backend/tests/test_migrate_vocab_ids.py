# scripts/migrate_vocab_ids.py renames a learner's rows when a vocab entry's
# surface fields are corrected (plan 091). It edits real progress in place,
# so the things pinned here are the ones that would quietly corrupt a
# history rather than fail loudly:
#
#   * a merge that overwrites instead of summing deletes reviews
#   * a merge that takes the furthest-along schedule re-inflates mastery
#   * a deck that already holds the target must not gain a duplicate row
#   * frequency_overrides keys the DECK KEY, not the card id, so a pin
#     moves with the entry -- and a learner who already pinned the target
#     key keeps that pin, because it is the one that still resolves
#   * vocab_jmdict_* is a different source with its own migration and must
#     not be swept up by the "vocab_%" scan
#   * an unknown id, another user's rows are left alone
#   * --user scopes everything; without --yes nothing is written
#
# The moves are monkeypatched: the test does not depend on what
# content/vocab_renames.py says this week, only on what the script does
# with what it says.
import importlib.util
from pathlib import Path

import pytest

from core.db import db_conn

_SPEC = importlib.util.spec_from_file_location(
    "migrate_vocab_ids",
    Path(__file__).resolve().parent.parent / "scripts" / "migrate_vocab_ids.py",
)
migrate = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(migrate)

USER = "vocab-migration-probe"
OTHER = "vocab-migration-other"

# A note dropped out of the reading, the shape 17 of the 34 entries had.
OLD_A = "vocab_N3_probeA_（感）"
NEW_A = "vocab_N3__probeA"
# The word duplicated into both fields, onto an entry the learner already
# studied -- the merge path.
OLD_B = "vocab_N3_probeB_probeB"
NEW_B = "vocab_N3__probeB"
# The same word at two levels, merged onto the lower (plan 106b) -- the
# one kind of move that changes a level, and deck_cards.level with it.
OLD_C = "vocab_N3__probeC"
NEW_C = "vocab_N5__probeC"
STRAY = "vocab_N3_probeStray_probeStray"   # neither served nor mapped
JMDICT = "vocab_jmdict_4242"               # a different source entirely

MODE = "vocab.flashcard.f2b"
DECK_ID = 990091
DECK_ID_HOLDING_TARGET = 990092

KEY_A_OLD, KEY_A_NEW = "probeA::（感）", "::probeA"
KEY_B_OLD, KEY_B_NEW = "probeB::probeB", "::probeB"


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
        _exec("INSERT INTO decks(id, user_id, name, type) VALUES (%s,%s,%s,'vocab') "
              "ON CONFLICT (id) DO NOTHING", (deck_id, USER, "probe"))
    # (user, raw, mode, interval, total, correct, lapses)
    rows = [
        (USER, OLD_A, MODE, 5, 6, 5, 1),
        (USER, OLD_B, MODE, 2, 4, 2, 2),
        (USER, NEW_B, MODE, 9, 10, 9, 0),      # the target already studied
        (USER, OLD_C, MODE, 4, 4, 4, 0),
        (USER, STRAY, MODE, 1, 1, 1, 0),
        (USER, JMDICT, MODE, 7, 7, 7, 0),      # the other source
        (OTHER, OLD_A, MODE, 3, 3, 3, 0),      # another learner, untouched under --user
    ]
    for user, raw, mode, interval, total, correct, lapses in rows:
        card = f"{user}:{raw}"
        _exec("INSERT INTO cards(id) VALUES (%s) ON CONFLICT DO NOTHING", (card,))
        _exec(
            """
            INSERT INTO card_modes
                (card_id, mode, difficulty, stability, interval_days, repetitions, lapses,
                 learning_step, is_learning, next_review, total_reviews, correct_reviews, last_quality)
            VALUES (%s,%s,2.5,1.0,%s,1,%s,0,FALSE, NOW() + (%s || ' days')::interval, %s,%s,3)
            """,
            (card, mode, interval, lapses, interval, total, correct),
        )
        _exec("INSERT INTO review_log(card_id, mode, quality, reviewed_at) VALUES (%s,%s,4,NOW())", (card, mode))
        _exec("INSERT INTO card_first_review(card_id, mode, first_at) VALUES (%s,%s,NOW() - interval '10 days') "
              "ON CONFLICT DO NOTHING", (card, mode))
    # an earlier first review on the target than on the merged-in source
    _exec("UPDATE card_first_review SET first_at = NOW() - interval '30 days' WHERE card_id = %s", (f"{USER}:{NEW_B}",))

    for deck_id, raw in ((DECK_ID, OLD_A), (DECK_ID, OLD_B), (DECK_ID, OLD_C),
                         (DECK_ID_HOLDING_TARGET, NEW_B), (DECK_ID_HOLDING_TARGET, OLD_B)):
        _exec("INSERT INTO deck_cards(deck_id, user_id, source, level, raw_id) VALUES (%s,%s,'vocab','N3',%s)",
              (deck_id, USER, raw))

    # A pin on each old key, plus one the learner already holds on B's
    # target -- the collision the 22 collapsing keys produce for real.
    for user, key, tier in ((USER, KEY_A_OLD, 3), (USER, KEY_B_OLD, 4),
                            (USER, KEY_B_NEW, 9), (OTHER, KEY_A_OLD, 5)):
        _exec("INSERT INTO frequency_overrides(user_id, domain, item_key, tier) VALUES (%s,'vocab',%s,%s) "
              "ON CONFLICT DO NOTHING", (user, key, tier))


def _wipe():
    for user in (USER, OTHER):
        _exec("DELETE FROM review_log WHERE card_id LIKE %s", (f"{user}:%",))
        _exec("DELETE FROM card_first_review WHERE card_id LIKE %s", (f"{user}:%",))
        _exec("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{user}:%",))
        _exec("DELETE FROM cards WHERE id LIKE %s", (f"{user}:%",))
        _exec("DELETE FROM frequency_overrides WHERE user_id = %s", (user,))
        _exec("DELETE FROM decks WHERE user_id = %s", (user,))


@pytest.fixture(autouse=True)
def probe(monkeypatch):
    _wipe()
    monkeypatch.setattr(migrate, "MOVES", {OLD_A: NEW_A, OLD_B: NEW_B, OLD_C: NEW_C})
    monkeypatch.setattr(migrate, "KEY_MOVES", {KEY_A_OLD: KEY_A_NEW, KEY_B_OLD: KEY_B_NEW})
    monkeypatch.setattr(migrate, "served_ids", lambda: frozenset({NEW_A, NEW_B, NEW_C}))
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
    rows = _exec("SELECT item_key, tier FROM frequency_overrides WHERE user_id = %s AND domain = 'vocab'", (user,))
    return dict(rows)


def test_a_dry_run_changes_nothing():
    assert migrate.main(["--user", USER]) == 0
    assert _ids(USER) == {OLD_A, OLD_B, NEW_B, OLD_C, STRAY, JMDICT}
    assert _modes(USER, OLD_A) and _modes(USER, OLD_B)
    assert _pins(USER) == {KEY_A_OLD: 3, KEY_B_OLD: 4, KEY_B_NEW: 9}


def test_moves_rename_merge_and_leave_what_they_should():
    assert migrate.main(["--yes", "--user", USER]) == 0

    # the plain rename: every table moved, nothing lost
    assert OLD_A not in _ids(USER) and NEW_A in _ids(USER)
    assert _modes(USER, NEW_A) == {MODE: (5, 6, 5, 1)}
    assert _exec("SELECT count(*) FROM review_log WHERE card_id = %s", (f"{USER}:{NEW_A}",))[0][0] == 1
    assert _exec("SELECT count(*) FROM review_log WHERE card_id = %s", (f"{USER}:{OLD_A}",))[0][0] == 0
    assert _exec("SELECT count(*) FROM card_first_review WHERE card_id = %s", (f"{USER}:{NEW_A}",))[0][0] == 1

    # the merge: effort summed, the least-advanced schedule kept, the
    # earlier first review kept, the old row gone
    assert OLD_B not in _ids(USER)
    assert _modes(USER, NEW_B) == {MODE: (2, 14, 11, 2)}
    (first_at,) = _exec("SELECT first_at FROM card_first_review WHERE card_id = %s", (f"{USER}:{NEW_B}",))[0]
    (age_days,) = _exec("SELECT EXTRACT(day FROM NOW() - %s::timestamptz)", (first_at,))[0]
    assert int(age_days) >= 29
    assert _exec("SELECT count(*) FROM review_log WHERE card_id = %s", (f"{USER}:{NEW_B}",))[0][0] == 2

    # unknown, and the other source: left exactly as they were
    assert _modes(USER, STRAY) == {MODE: (1, 1, 1, 0)}
    assert _modes(USER, JMDICT) == {MODE: (7, 7, 7, 0)}

    # another learner, out of --user's scope
    assert _modes(OTHER, OLD_A) == {MODE: (3, 3, 3, 0)}
    assert _modes(OTHER, NEW_A) == {}
    assert _pins(OTHER) == {KEY_A_OLD: 5}

    # the level move: the rows follow the id to N5
    assert OLD_C not in _ids(USER) and NEW_C in _ids(USER)
    assert _modes(USER, NEW_C) == {MODE: (4, 4, 4, 0)}

    # deck_cards: raw_id moves and level follows the target id (N3 stays
    # N3 for A and B, N3 becomes N5 for C); the deck already holding the
    # target keeps one row, not two
    rows = _exec("SELECT deck_id, level, raw_id FROM deck_cards WHERE user_id = %s ORDER BY deck_id, raw_id", (USER,))
    assert (DECK_ID, "N3", NEW_A) in rows
    assert (DECK_ID, "N3", NEW_B) in rows
    assert (DECK_ID, "N5", NEW_C) in rows
    assert [r for r in rows if r[0] == DECK_ID_HOLDING_TARGET] == [(DECK_ID_HOLDING_TARGET, "N3", NEW_B)]
    assert not any(r[2] in (OLD_A, OLD_B, OLD_C) for r in rows)

    # frequency pins: A's moves onto the corrected key; B's collides with
    # a pin the learner already holds, and the one that still resolves wins
    assert _pins(USER) == {KEY_A_NEW: 3, KEY_B_NEW: 9}


def test_a_second_run_is_a_no_op():
    assert migrate.main(["--yes", "--user", USER]) == 0
    before = (_ids(USER), _modes(USER, NEW_A), _modes(USER, NEW_B), _pins(USER))
    assert migrate.main(["--yes", "--user", USER]) == 0
    assert (_ids(USER), _modes(USER, NEW_A), _modes(USER, NEW_B), _pins(USER)) == before


def test_the_jmdict_pool_is_a_different_source_and_is_never_scanned():
    """vocab_jmdict_* ids start with "vocab_" too, and they belong to
    migrate_jmdict_card_ids.py. Sweeping them in here would classify
    every one of them as unknown -- harmless today, but the scan is what
    a future fate would act on."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            found = migrate.find_card_ids(cur, USER)
        conn.commit()
    finally:
        conn.close()
    assert f"{USER}:{JMDICT}" not in found
    assert f"{USER}:{OLD_A}" in found


def test_classification_names_every_fate():
    fates = migrate.classify(
        [f"{USER}:{NEW_A}", f"{USER}:{OLD_A}", f"{USER}:{STRAY}"],
        frozenset({NEW_A, NEW_B}),
    )
    assert fates == {
        "served": [f"{USER}:{NEW_A}"],
        "moved": [f"{USER}:{OLD_A}"],
        "unknown": [f"{USER}:{STRAY}"],
    }
