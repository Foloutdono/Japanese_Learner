# scripts/migrate_grammar_ids.py renames a learner's rows when the grammar
# catalogue moves a point (plan 087). It edits real progress in place, so
# the things pinned here are the ones that would quietly corrupt a history
# rather than fail loudly:
#
#   * a merge that overwrites instead of summing deletes reviews
#   * a merge that takes the furthest-along schedule re-inflates mastery
#   * a deck that already holds the target must not gain a duplicate row
#   * the log names PATTERNS, not ids, so a rename is rewritten there and
#     a pure level move is not
#   * a retired id, an unknown id, another user's rows are left alone
#   * --user scopes everything; without --yes nothing is written
#
# The moves are monkeypatched: the test does not depend on what
# content/grammar/renames.py says this week, only on what the script does
# with what it says.
import importlib.util
import json
from pathlib import Path

import pytest

from core.db import db_conn

_SPEC = importlib.util.spec_from_file_location(
    "migrate_grammar_ids",
    Path(__file__).resolve().parent.parent / "scripts" / "migrate_grammar_ids.py",
)
migrate = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(migrate)

USER = "grammar-migration-probe"
OTHER = "grammar-migration-other"

OLD_A = "grammar_N5_〜probeA"          # a level move: same pattern, N5 -> N4
NEW_A = "grammar_N4_〜probeA"
OLD_B = "grammar_N5_〜probeB"          # a rename/merge onto a point the learner already has
NEW_B = "grammar_N5_〜probeC"
GONE  = "grammar_N5_〜probeGone"       # retired
STRAY = "grammar_N5_〜probeStray"      # neither served nor mapped

MODE = "grammar.flashcard.f2b"
DECK_ID = 990087
DECK_ID_HOLDING_TARGET = 990088


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
        _exec("INSERT INTO decks(id, user_id, name, type) VALUES (%s,%s,%s,'grammar') "
              "ON CONFLICT (id) DO NOTHING", (deck_id, USER, "probe"))
    # (user, raw, mode, interval, total, correct, lapses)
    rows = [
        (USER, OLD_A, MODE, 5, 6, 5, 1),
        (USER, OLD_B, MODE, 2, 4, 2, 2),
        (USER, NEW_B, MODE, 9, 10, 9, 0),      # the target already studied
        (USER, GONE, MODE, 1, 1, 1, 0),
        (USER, STRAY, MODE, 1, 1, 1, 0),
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
    _exec("INSERT INTO deck_cards(deck_id, user_id, source, level, raw_id) VALUES (%s,%s,'grammar','N5',%s)",
          (DECK_ID, USER, OLD_A))
    _exec("INSERT INTO deck_cards(deck_id, user_id, source, level, raw_id) VALUES (%s,%s,'grammar','N5',%s)",
          (DECK_ID, USER, OLD_B))
    _exec("INSERT INTO deck_cards(deck_id, user_id, source, level, raw_id) VALUES (%s,%s,'grammar','N5',%s)",
          (DECK_ID_HOLDING_TARGET, USER, NEW_B))
    _exec("INSERT INTO deck_cards(deck_id, user_id, source, level, raw_id) VALUES (%s,%s,'grammar','N5',%s)",
          (DECK_ID_HOLDING_TARGET, USER, OLD_B))
    _exec("INSERT INTO comprehension_log(user_id, level, text, translation, questions, answers, score, total, grammar) "
          "VALUES (%s,'N5','x','y','[]'::jsonb,'[]'::jsonb,0,0,%s::jsonb)",
          (USER, json.dumps(["〜probeB", "は", "〜probeA"], ensure_ascii=False)))


def _wipe():
    for user in (USER, OTHER):
        _exec("DELETE FROM review_log WHERE card_id LIKE %s", (f"{user}:%",))
        _exec("DELETE FROM card_first_review WHERE card_id LIKE %s", (f"{user}:%",))
        _exec("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{user}:%",))
        _exec("DELETE FROM cards WHERE id LIKE %s", (f"{user}:%",))
        _exec("DELETE FROM comprehension_log WHERE user_id = %s", (user,))
        _exec("DELETE FROM decks WHERE user_id = %s", (user,))


@pytest.fixture(autouse=True)
def probe(monkeypatch):
    _wipe()
    monkeypatch.setattr(migrate, "MOVES", {OLD_A: NEW_A, OLD_B: NEW_B})
    monkeypatch.setattr(migrate, "RETIRED", frozenset({GONE}))
    monkeypatch.setattr(migrate, "pattern_renames", lambda: {"〜probeB": "〜probeC"})
    monkeypatch.setattr(migrate, "all_ids", lambda: frozenset({NEW_A, NEW_B}))
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


def test_a_dry_run_changes_nothing():
    assert migrate.main(["--user", USER]) == 0
    assert _ids(USER) == {OLD_A, OLD_B, NEW_B, GONE, STRAY}
    assert _modes(USER, OLD_A) and _modes(USER, OLD_B)


def test_moves_rename_merge_and_leave_what_they_should():
    assert migrate.main(["--yes", "--user", USER]) == 0

    # the level move: every table renamed, nothing lost
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

    # retired and unknown: left exactly as they were
    assert _modes(USER, GONE) == {MODE: (1, 1, 1, 0)}
    assert _modes(USER, STRAY) == {MODE: (1, 1, 1, 0)}

    # another learner, out of --user's scope
    assert _modes(OTHER, OLD_A) == {MODE: (3, 3, 3, 0)}
    assert _modes(OTHER, NEW_A) == {}

    # deck_cards: raw_id and level move; the deck already holding the
    # target keeps one row, not two
    rows = _exec("SELECT deck_id, level, raw_id FROM deck_cards WHERE user_id = %s ORDER BY deck_id, raw_id", (USER,))
    assert (DECK_ID, "N4", NEW_A) in rows
    assert (DECK_ID, "N5", NEW_B) in rows
    assert [r for r in rows if r[0] == DECK_ID_HOLDING_TARGET] == [(DECK_ID_HOLDING_TARGET, "N5", NEW_B)]
    assert not any(r[2] in (OLD_A, OLD_B) for r in rows)

    # the log names patterns: the rename is rewritten, the level move is not
    (grammar,) = _exec("SELECT grammar FROM comprehension_log WHERE user_id = %s", (USER,))[0]
    assert grammar == ["〜probeC", "は", "〜probeA"]


def test_a_second_run_is_a_no_op():
    assert migrate.main(["--yes", "--user", USER]) == 0
    before = (_ids(USER), _modes(USER, NEW_A), _modes(USER, NEW_B))
    assert migrate.main(["--yes", "--user", USER]) == 0
    assert (_ids(USER), _modes(USER, NEW_A), _modes(USER, NEW_B)) == before


def test_classification_names_every_fate():
    fates = migrate.classify(
        [f"{USER}:{NEW_A}", f"{USER}:{OLD_A}", f"{USER}:{GONE}", f"{USER}:{STRAY}"],
        frozenset({NEW_A, NEW_B}),
    )
    assert fates == {
        "served": [f"{USER}:{NEW_A}"], "moved": [f"{USER}:{OLD_A}"],
        "retired": [f"{USER}:{GONE}"], "unknown": [f"{USER}:{STRAY}"],
    }
