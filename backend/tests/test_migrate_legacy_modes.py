# scripts/migrate_legacy_modes.py rewrites SRS rows still keyed under the
# pre-2026-08 quiz-mode names onto the current registry.
#
# It edits a learner's actual progress, in place, and there is no undo --
# so the things worth pinning are the ones that would quietly corrupt a
# history rather than fail loudly:
#
#   * the same old key means different things per source ("write" is
#     kana's or kanji's), so a source mix-up moves progress onto the
#     wrong track
#   * two old keys collapse onto one new one, so a merge that overwrites
#     instead of summing silently deletes reviews
#   * a merge that takes the furthest-along schedule re-inflates the very
#     mastery counts the surrounding change exists to make honest
#   * `sentence.*` is unregistered ON PURPOSE and current -- rewriting it
#     would corrupt live data, and it looks exactly like legacy data to a
#     naive "not in SRS_MODES" test
#   * anything ambiguous must be left alone, not guessed

import importlib.util
import os
from pathlib import Path

import pytest

from core.db import db_conn
from core.srs_instance import srs

_SPEC = importlib.util.spec_from_file_location(
    "migrate_legacy_modes",
    Path(__file__).resolve().parent.parent / "scripts" / "migrate_legacy_modes.py",
)
migrate = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(migrate)

USER = "legacy-migration-probe"


def _seed(rows, decks=()):
    """Write card_modes rows directly, under whatever mode is asked for.

    Direct SQL because the point is to reproduce rows the current code
    can no longer write -- srs.review() would reject nothing, but it
    would also not let us set an interval or a next_review, and both
    decide what the merge picks.
    """
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for deck_id, structure in decks:
                cur.execute(
                    "INSERT INTO decks(id, user_id, name, type) VALUES (%s,%s,%s,%s) "
                    "ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type",
                    (deck_id, USER, "probe", structure),
                )
            for raw_id, mode, interval, total, correct, lapses in rows:
                card = f"{USER}:{raw_id}"
                cur.execute("INSERT INTO cards(id) VALUES (%s) ON CONFLICT DO NOTHING", (card,))
                cur.execute(
                    """
                    INSERT INTO card_modes
                        (card_id, mode, difficulty, stability, interval_days,
                         repetitions, lapses, learning_step, is_learning,
                         next_review, total_reviews, correct_reviews, last_quality)
                    VALUES (%s,%s,2.5,1.0,%s,1,%s,0,FALSE,
                            NOW() + (%s || ' days')::interval,%s,%s,3)
                    ON CONFLICT (card_id, mode) DO UPDATE SET
                        interval_days = EXCLUDED.interval_days,
                        total_reviews = EXCLUDED.total_reviews,
                        correct_reviews = EXCLUDED.correct_reviews,
                        lapses = EXCLUDED.lapses,
                        next_review = EXCLUDED.next_review
                    """,
                    (card, mode, interval, lapses, interval, total, correct),
                )
                cur.execute(
                    "INSERT INTO review_log(card_id, mode, quality, reviewed_at) "
                    "VALUES (%s,%s,4,NOW())",
                    (card, mode),
                )
        conn.commit()
    finally:
        conn.close()


def _modes(raw_id):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT mode, interval_days, total_reviews, correct_reviews, lapses "
                "FROM card_modes WHERE card_id = %s",
                (f"{USER}:{raw_id}",),
            )
            return {r[0]: r[1:] for r in cur.fetchall()}
    finally:
        conn.close()


def _log_modes(raw_id):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT mode, count(*) FROM review_log WHERE card_id = %s GROUP BY mode",
                (f"{USER}:{raw_id}",),
            )
            return dict(cur.fetchall())
    finally:
        conn.close()


def _run(apply=True):
    """Run the migration over this probe user only."""
    import sys
    argv = sys.argv
    sys.argv = ["migrate_legacy_modes", "--user", USER] + (["--apply"] if apply else [])
    try:
        return migrate.main()
    finally:
        sys.argv = argv


@pytest.fixture(autouse=True)
def clean():
    _wipe()
    yield
    _wipe()


def _wipe():
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (f"{USER}:%",))
            cur.execute("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{USER}:%",))
            cur.execute("DELETE FROM cards WHERE id LIKE %s", (f"{USER}:%",))
            cur.execute("DELETE FROM decks WHERE user_id = %s", (USER,))
        conn.commit()
    finally:
        conn.close()


# ── The mapping ──────────────────────────────────────────────────────

def test_a_legacy_key_is_rewritten():
    _seed([("kana_あ", "qcm", 5, 8, 6, 1)])
    assert _run() == 0
    assert set(_modes("kana_あ")) == {"kana.flashcard.f2b"}


def test_the_same_old_key_resolves_by_source():
    """'write' is kana's or kanji's, and only the card id says which.

    This is the defect that would be invisible: both rewrites "work",
    and the wrong one moves a learner's kana progress onto a kanji
    drawing schedule.
    """
    _seed([("kana_さ", "write", 3, 4, 4, 0), ("kanji_N5_山", "write", 3, 4, 4, 0)])
    assert _run() == 0
    assert set(_modes("kana_さ")) == {"kana.write_kana"}
    assert set(_modes("kanji_N5_山")) == {"kanji.write_kanji"}


def test_a_personal_card_resolves_through_its_deck():
    """A custom card's source is its deck's structure, not its id."""
    _seed(
        [("custom_9001_1", "flashcard", 2, 3, 3, 0),
         ("custom_9002_1", "flashcard", 2, 3, 3, 0)],
        decks=[(9001, "standard"), (9002, "grammar")],
    )
    assert _run() == 0
    assert set(_modes("custom_9001_1")) == {"standard.flashcard.f2b"}
    assert set(_modes("custom_9002_1")) == {"grammar.flashcard.f2b"}


# ── Merging ──────────────────────────────────────────────────────────

def test_two_old_keys_merge_into_one_track():
    """qcm-kj-m and flashcard-kj-m were one exercise at two help levels.

    Effort sums because all of it happened; the schedule takes the LEAST
    advanced row, so a card mastered only in the easier MCQ variant does
    not arrive already mastered.
    """
    _seed([
        ("vocab_N5_駅_えき", "qcm-kj-m", 30, 10, 9, 1),        # far ahead
        ("vocab_N5_駅_えき", "flashcard-kj-m", 2, 4, 1, 3),    # struggling
    ])
    assert _run() == 0
    held = _modes("vocab_N5_駅_えき")
    assert set(held) == {"vocab.flashcard.f2b"}
    interval, total, correct, lapses = held["vocab.flashcard.f2b"]
    assert interval == 2, "the merge took the furthest-along schedule"
    assert (total, correct, lapses) == (14, 10, 4), "effort was not summed"


def test_a_merge_absorbs_progress_made_after_the_rework():
    """The target row can already exist -- the learner kept studying."""
    _seed([
        ("vocab_N5_水_みず", "qcm-kj-m", 20, 6, 6, 0),
        ("vocab_N5_水_みず", "vocab.flashcard.f2b", 4, 5, 4, 2),
    ])
    assert _run() == 0
    held = _modes("vocab_N5_水_みず")
    assert set(held) == {"vocab.flashcard.f2b"}
    interval, total, correct, lapses = held["vocab.flashcard.f2b"]
    assert interval == 4
    assert (total, correct, lapses) == (11, 10, 2), "the existing row was overwritten"


def test_a_card_studied_in_both_directions_keeps_both_tracks():
    """Two old keys on one card mapping to two DIFFERENT new keys.

    The rewrite deletes and re-inserts per target mode, and the delete
    list is every old mode on the card -- so the second target's source
    rows are already gone from the table by the time its turn comes. It
    works because the merge reads values captured before any delete; if
    it ever started re-reading from the database, this is the test that
    would notice, and the symptom would be a silently vanished track.
    """
    _seed([
        ("vocab_N5_空_そら", "qcm-kj-m", 6, 5, 5, 0),      # -> f2b
        ("vocab_N5_空_そら", "flashcard-m-kj", 9, 7, 6, 1),  # -> b2f
    ])
    assert _run() == 0
    held = _modes("vocab_N5_空_そら")
    assert set(held) == {"vocab.flashcard.f2b", "vocab.flashcard.b2f"}
    assert held["vocab.flashcard.f2b"] == (6, 5, 5, 0)
    assert held["vocab.flashcard.b2f"] == (9, 7, 6, 1)


def test_the_history_moves_with_the_schedule():
    """review_log carries a mode too, and accuracy trends plus the
    daily-new budget both read it."""
    _seed([("kanji_N5_日", "qcm-m-kj", 3, 2, 2, 0)])
    assert _log_modes("kanji_N5_日") == {"qcm-m-kj": 1}
    assert _run() == 0
    assert _log_modes("kanji_N5_日") == {"kanji.flashcard.b2f": 1}


# ── What must NOT be touched ─────────────────────────────────────────

def test_the_sentence_modes_are_left_alone():
    """They are current and unregistered ON PURPOSE.

    This is the one row in the table that looks exactly like legacy data
    to a naive "not in SRS_MODES" scan, and rewriting it would corrupt
    live scheduling.

    Asserted on the CLASSIFICATION, not only on the row surviving. The
    row survives either way today -- with the guard removed it falls
    through to "no alias for (vocab, sentence.reading)" and is skipped
    for the wrong reason -- so an assertion on the row alone passes with
    the guard deleted, which I checked. What the guard actually buys is
    that the protection does not depend on nobody ever adding an alias
    entry that happens to match.
    """
    _seed([("vocab_N5_本_ほん", "sentence.reading", 3, 2, 2, 0)])
    rows = [{"card_id": f"{USER}:vocab_N5_本_ほん", "mode": "sentence.reading"}]
    targets, skipped = migrate._plan(rows, {})
    assert not targets, "a live sentence track was scheduled for rewriting"
    assert skipped == [(f"{USER}:vocab_N5_本_ほん", "sentence.reading",
                        "current, deliberately unregistered")], (
        "the sentence modes must be recognised as current, not merely fail "
        "to find an alias"
    )

    assert _run() == 0
    assert set(_modes("vocab_N5_本_ほん")) == {"sentence.reading"}


def test_an_unmapped_key_is_reported_not_guessed():
    _seed([("vocab_N5_山_やま", "some-mode-nobody-remembers", 3, 2, 2, 0)])
    assert _run() == 0
    assert set(_modes("vocab_N5_山_やま")) == {"some-mode-nobody-remembers"}


def test_a_personal_card_with_no_deck_is_left_alone():
    """'flashcard' is ambiguous between standard and grammar, and with
    the deck gone there is nothing to resolve it with."""
    _seed([("custom_9999_1", "flashcard", 2, 3, 3, 0)])
    assert _run() == 0
    assert set(_modes("custom_9999_1")) == {"flashcard"}


def test_a_mixed_deck_is_left_alone():
    """'mixed' is the legacy deck type that could hold several sources,
    so its personal cards are exactly the ambiguous case."""
    _seed([("custom_9003_1", "flashcard", 2, 3, 3, 0)], decks=[(9003, "mixed")])
    assert _run() == 0
    assert set(_modes("custom_9003_1")) == {"flashcard"}


# ── Operational contract ─────────────────────────────────────────────

def test_a_dry_run_writes_nothing():
    _seed([("kana_い", "qcm", 5, 8, 6, 1)])
    assert _run(apply=False) == 0
    assert set(_modes("kana_い")) == {"qcm"}


def test_running_twice_changes_nothing_the_second_time():
    _seed([
        ("vocab_N5_駅_えき", "qcm-kj-m", 30, 10, 9, 1),
        ("vocab_N5_駅_えき", "flashcard-kj-m", 2, 4, 1, 3),
    ])
    assert _run() == 0
    once = _modes("vocab_N5_駅_えき")
    assert _run() == 0
    assert _modes("vocab_N5_駅_えき") == once, (
        "a second run moved something -- effort would double on every run"
    )


def test_the_rewritten_rows_are_visible_to_the_engine_again():
    """The whole point: progress that counted nowhere counts again.

    The surrounding change filters every whole-account aggregate to
    registered modes, so a legacy row contributes to nothing until it is
    migrated. This is that end-to-end, through the real engine.
    """
    _seed([("vocab_N5_駅_えき", "qcm-kj-m", 30, 10, 9, 1)])
    assert srs.get_mastered_count(USER) == 0, "a legacy row should count for nothing"
    assert _run() == 0
    assert srs.get_mastered_count(USER) == 1, "migrated progress did not come back"
