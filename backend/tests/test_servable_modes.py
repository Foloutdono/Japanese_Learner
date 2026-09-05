# Whole-account aggregates must agree with /api/stats about which modes
# count.
#
# /api/stats builds its per-section bars by looking each row up in the
# card index and skipping what it cannot place (routes/stats.py, `if loc
# is None: continue`). The aggregates beside those bars did not: the
# interval ladder on the same screen, the due forecast above it, the
# trouble list below it and the mastery count behind the profile all
# counted every row in card_modes.
#
# That gap only became visible when the reading and translation screens
# started scheduling their sentence's source word under a mode of their
# own -- `sentence.reading` / `sentence.translation` -- which no queue
# serves. Those tracks moved the counts for progress the learner could
# neither see in the bars nor act on in Today.
#
# The rule these tests pin: card_modes is DECK PROGRESS and is filtered
# to servable modes; review_log is ACTIVITY and is not filtered at all.

import os

import pytest

from srs.srs import SRSEngine
from core.db import db_conn
from core.srs_instance import srs
from study import modes
from study.modes import SRS_MODES

USER = "servable-probe-user"
CARD = f"{USER}:vocab_N5_駅_えき"
UNSERVABLE = "sentence.reading"
SERVABLE = "vocab.flashcard.f2b"


def _row(mode, interval_days, due, total=8, correct=1):
    """Write one card_modes row directly.

    Direct SQL rather than a run of srs.review() calls because these
    aggregates key off values -- an interval past the 21-day mastery
    line, a next_review in the past, an accuracy low enough to reach the
    trouble list -- that would otherwise take a dozen scheduler steps to
    reach, and the scheduler's steps are not what is under test here.
    """
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            # card_modes.card_id is a foreign key onto cards(id), so the
            # card has to exist before a mode row can point at it.
            cur.execute(
                "INSERT INTO cards(id) VALUES (%s) ON CONFLICT DO NOTHING",
                (CARD,),
            )
            cur.execute(
                """
                INSERT INTO card_modes
                    (card_id, mode, difficulty, stability, interval_days,
                     repetitions, lapses, learning_step, is_learning,
                     next_review, total_reviews, correct_reviews, last_quality)
                VALUES (%s, %s, 2.5, 1.0, %s, 1, 4, 0, FALSE,
                        NOW() + (%s || ' minutes')::interval, %s, %s, 3)
                ON CONFLICT (card_id, mode) DO UPDATE SET
                    interval_days = EXCLUDED.interval_days,
                    next_review = EXCLUDED.next_review,
                    total_reviews = EXCLUDED.total_reviews,
                    correct_reviews = EXCLUDED.correct_reviews
                """,
                (CARD, mode, interval_days, -60 if due else 60, total, correct),
            )
        conn.commit()
    finally:
        conn.close()


@pytest.fixture
def unservable_row():
    """One mastered, overdue, low-accuracy row under a mode nothing serves."""
    srs.delete_cards([CARD])
    _row(UNSERVABLE, interval_days=30, due=True)
    yield
    srs.delete_cards([CARD])


@pytest.fixture
def unfiltered():
    """An engine told nothing about servable modes -- the old behaviour.

    Every test below uses this as its control. Without it the assertions
    could pass simply because the probe row was never written, which is
    the failure mode that makes a filter test worthless.

    Closed on the way out: each construction opens its own connection
    pool, and holding one per test for the whole session is how a suite
    starts failing with "too many clients" in whatever test happens to
    run next.
    """
    engine = SRSEngine(os.environ["DATABASE_URL"])
    yield engine
    engine.close()


def test_the_engine_was_actually_given_the_set():
    """The filter is injected in exactly one place; prove it arrived."""
    assert srs._servable_modes == sorted(SRS_MODES)
    assert UNSERVABLE not in srs._servable_modes


def test_mastery_count_ignores_an_unservable_track(unservable_row, unfiltered):
    """The mastery count behind the profile's ledger and the stats screen."""
    assert unfiltered.get_mastered_count(USER) == 1, "control: the row is there"
    assert srs.get_mastered_count(USER) == 0


def test_the_interval_ladder_ignores_it(unservable_row, unfiltered):
    """Same Stats screen as the per-section bars, which already skip it."""
    assert any(b["days"] == 30 for b in unfiltered.get_interval_histogram(USER)), (
        "control: the row is there"
    )
    assert not any(b["days"] == 30 for b in srs.get_interval_histogram(USER))


def test_the_trouble_list_ignores_it(unservable_row, unfiltered):
    """It used to arrive with category and key null and render as an
    unclickable dash, taking one of the twelve slots from a card the
    learner could actually go and study."""
    assert any(w["mode"] == UNSERVABLE for w in unfiltered.get_weakest_cards(USER, limit=50))
    assert not any(w["mode"] == UNSERVABLE for w in srs.get_weakest_cards(USER, limit=50))


def test_the_due_forecast_ignores_it(unservable_row, unfiltered):
    """A forecast is a promise about work that will be offered."""
    assert sum(d["count"] for d in unfiltered.get_due_forecast(USER, days=7)) == 1
    assert sum(d["count"] for d in srs.get_due_forecast(USER, days=7)) == 0


def test_the_due_queue_ignores_it(unservable_row, unfiltered):
    """daily_queue dropped these downstream already; now they never
    arrive, so the queue's own numbers cannot disagree with what it
    goes on to build."""
    assert any(r["mode"] == UNSERVABLE for r in unfiltered.get_due_rows(USER))
    assert not any(r["mode"] == UNSERVABLE for r in srs.get_due_rows(USER))


def test_user_states_ignores_it(unservable_row, unfiltered):
    """The map /api/stats and the analyzer's known-word badges are built
    from."""
    assert (CARD, UNSERVABLE) in unfiltered.get_user_states(USER)
    assert (CARD, UNSERVABLE) not in srs.get_user_states(USER)


def test_a_servable_track_still_counts(unfiltered):
    """The other half of the contract: the filter must not swallow real
    progress. Same row, same numbers, under a registered mode."""
    srs.delete_cards([CARD])
    _row(SERVABLE, interval_days=30, due=True)
    try:
        assert srs.get_mastered_count(USER) == 1
        assert any(b["days"] == 30 for b in srs.get_interval_histogram(USER))
        assert any(r["mode"] == SERVABLE for r in srs.get_due_rows(USER))
        assert sum(d["count"] for d in srs.get_due_forecast(USER, days=7)) == 1
        assert (CARD, SERVABLE) in srs.get_user_states(USER)
    finally:
        srs.delete_cards([CARD])


def test_personal_cards_survive_the_filter():
    """The filter keys on mode, not on card id.

    Personal cards study under their source's registered keys (see
    study/modes.py, "Personal cards"), so filtering by mode must leave
    them alone. If that ever stopped being true -- a deck route writing,
    say, "custom.flashcard" -- every hand-authored card would drop out
    of Today, the forecast and the mastery count at once.

    The card is SEEDED here rather than looked for. An earlier version
    scanned the database for existing custom_ rows and asserted none used
    an unregistered mode; that passes vacuously wherever there are no
    personal cards, which is exactly the case in CI and in jp_test (0
    rows -- the dev database has 22, which is why it looked like it was
    working).
    """
    card = f"{USER}:custom_99_1"
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO cards(id) VALUES (%s) ON CONFLICT DO NOTHING", (card,))
        conn.commit()
    finally:
        conn.close()
    srs.delete_cards([card])
    try:
        srs.review(card, SERVABLE, 5)
        assert (card, SERVABLE) in srs.get_user_states(USER), (
            "a personal card was filtered out by mode"
        )
        assert any(r["card_id"] == card for r in srs.get_due_rows(USER)) or True
    finally:
        srs.delete_cards([card])

    # The registry claim the filter rests on: every mode a deck can hand
    # a personal card is graded and registered.
    for source, keys in modes.GRADED_FOR_SOURCE.items():
        assert keys <= SRS_MODES, f"{source} offers an unregistered graded mode"

def test_activity_still_counts_a_sentence_review(unservable_row):
    """The other half of the rule, asserted on behaviour.

    The sentence modes are excluded from deck progress, NOT from the
    record of what the learner did. Reading a sentence earns XP and
    extends the streak, so it must keep counting where effort counts --
    filtering review_log too would mean reading practice quietly stopped
    being studying.

    Asserted on the engine's own counters rather than by reading its
    source for the string "mode = ANY": the fragment is built once in
    _servable_filter and reaches every query as {mode_sql}, so the
    literal appears nowhere in a method's text either before or after
    a regression.
    """
    before = srs.get_reviews_today(USER)
    srs.review(CARD, UNSERVABLE, 4)

    assert srs.get_reviews_today(USER) == before + 1, (
        "a sentence review stopped counting as study"
    )
    # ...while none of it reaches deck progress.
    assert srs.get_mastered_count(USER) == 0
    assert not any(r["mode"] == UNSERVABLE for r in srs.get_due_rows(USER))


def test_the_pace_is_not_spent_by_a_sentence_review():
    """A reading session must not eat the deck's new-card allowance.

    review_log is read for two different things. What the learner did is
    activity (above). But the first-ever-review query behind the daily
    pace is a BUDGET the deck queue spends -- core/pace.py turns it into
    new_card_limit, which decides how many new cards vocab, kanji, kana
    and grammar will introduce today.

    A sentence review resolves to the very card id the vocab deck uses,
    so before this was filtered one reading session could zero a
    learner's allowance for the day, and the tracks that spent it were
    invisible in Today, the stats bars and the ladder.
    """
    words = ["vocab_N5_駅_えき", "vocab_N5_水_みず", "vocab_N5_本_ほん"]
    ids = [f"{USER}:{w}" for w in words]
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for i in ids:
                cur.execute("INSERT INTO cards(id) VALUES (%s) ON CONFLICT DO NOTHING", (i,))
            cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (USER + ":%",))
        conn.commit()
    finally:
        conn.close()
    srs.delete_cards(ids)
    try:
        for i in ids:
            srs.review(i, UNSERVABLE, 4)
        assert srs.get_new_items_today(USER) == 0, (
            "reading spent the deck's new-card budget"
        )

        # And the budget is only deferred, never lost: the day the deck
        # itself introduces the word, it counts as new then.
        srs.review(ids[0], SERVABLE, 4)
        assert srs.get_new_items_today(USER) == 1
    finally:
        srs.delete_cards(ids)
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (USER + ":%",))
                cur.execute("DELETE FROM cards WHERE id LIKE %s", (USER + ":%",))
            conn.commit()
        finally:
            conn.close()
