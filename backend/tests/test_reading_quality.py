# The reading screen grades with the app's six-segment rating bar, so a
# result carries the learner's own rating and not just pass/fail, and
# that rating is fed to the scheduler. These pin what could silently
# regress:
#
#   1. the rating survives the round trip and comes back on /history
#   2. `correct` stays independent of it, so every existing reader keeps
#      working and an older client posting only `correct` still does
#   3. the bound is enforced as a 422 the caller can read, not a 500
#   4. the rating reaches the scheduler unflattened, against the right
#      card, under a mode of its own
#
# Same shape as test_translation_quality.py -- the two screens grade the
# same curated sentence bank the same way, and a change to one that is
# not made to the other should show up as a failure here.

import pytest

from datetime import datetime, timezone

from core.auth import DEV_USER_ID
from core.db import db_conn
from core.srs_instance import srs
from routes.reading import SRS_MODE
from study import modes
from study.card_lookup import vocab_card_id_for_word


def _payload(**over):
    body = {
        "source": "level:N5",
        "level": "N5",
        "phrase": "五時に駅の前で会いましょう。",
        "romaji": "goji ni eki no mae de aimashou.",
        "answer": "goji ni eki no mae de aimashou",
        "correct": True,
    }
    body.update(over)
    return body


EKI = "vocab_N5_駅_えき"
MIZU = "vocab_N5_水_みず"


def _word(kanji):
    """A source_word exactly as the batch payload sends it -- kana empty."""
    return {"kanji": kanji, "kana": "", "level": "N5"}


def _modes_of(card_id):
    """Every mode the SRS holds for one card -> its (next_review, last_quality)."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT mode, next_review, last_quality FROM card_modes "
                "WHERE card_id = %s",
                (card_id,),
            )
            return {mode: (nr, q) for mode, nr, q in cur.fetchall()}
    finally:
        conn.close()


@pytest.fixture
def fresh(request):
    """Clear these cards so a review starts from a known state.

    Without this the assertions read whatever previous runs left in
    jp_test: the same rating schedules further out on every run, so a
    test that passed today could fail tomorrow for no reason in the code.
    """
    ids = [f"{DEV_USER_ID}:{c}" for c in request.param]
    srs.delete_cards(ids)
    return ids


# ── The log ──────────────────────────────────────────────────────────

def test_quality_round_trips(client):
    """The rating the learner gave comes back out of the log."""
    posted = client.post("/api/reading/result", json=_payload(quality=5))
    assert posted.status_code == 200, posted.text
    assert posted.json()["quality"] == 5

    history = client.get("/api/reading/history", params={"limit": 1})
    assert history.status_code == 200, history.text
    rows = history.json()
    assert rows, "the row just written should be the most recent"
    assert rows[0]["quality"] == 5


def test_quality_is_optional(client):
    """A client that posts only `correct` still works.

    Not hypothetical politeness: every row written before the column
    existed has no rating, and the endpoint has to keep accepting that
    shape rather than 422-ing an older build of the app.
    """
    posted = client.post("/api/reading/result", json=_payload())
    assert posted.status_code == 200, posted.text
    assert posted.json()["quality"] is None


def test_quality_is_independent_of_correct(client):
    """`correct` is not derived server-side, so the two can disagree.

    The client derives the pass/fail from the rating (q > 2) and posts
    both. Recomputing it here would silently overrule a caller that
    grades differently, so the endpoint stores what it is told.
    """
    posted = client.post("/api/reading/result", json=_payload(correct=False, quality=4))
    assert posted.status_code == 200, posted.text
    body = posted.json()
    assert body["correct"] is False
    assert body["quality"] == 4


@pytest.mark.parametrize("bad", [-1, 6, 99])
def test_quality_out_of_range_is_a_422(client, bad):
    """Out of 0..5 is a readable rejection, not a database error."""
    posted = client.post("/api/reading/result", json=_payload(quality=bad))
    assert posted.status_code == 422, posted.text


# ── Scheduling ───────────────────────────────────────────────────────
#
# A sentence has no card of its own; the thing scheduled is the
# vocabulary word it was chosen to practise, under its own mode.

@pytest.mark.parametrize("fresh", [[EKI]], indirect=True)
def test_rating_schedules_the_source_word(client, fresh):
    """The rating reaches the scheduler and moves the card."""
    posted = client.post("/api/reading/result", json=_payload(
        quality=5, source_word=_word("駅")))
    assert posted.status_code == 200, posted.text
    sched = posted.json()["scheduled"]
    assert sched is not None, "a resolvable word should have been scheduled"
    assert sched["mode"] == SRS_MODE
    assert sched["card_id"] == fresh[0]
    # The review lands in the future, which is the whole point. NOT
    # `interval_days >= 1`: a card's first passes are learning steps
    # measured in minutes and hours, so interval_days is legitimately 0
    # there and asserting otherwise tests the scheduler's step table
    # rather than this endpoint.
    assert datetime.fromisoformat(sched["next_review"]) > datetime.now(timezone.utc)
    assert sched["stage"]


@pytest.mark.parametrize("quality", [0, 1, 2, 3, 4, 5])
@pytest.mark.parametrize("fresh", [[EKI]], indirect=True)
def test_every_rating_reaches_the_scheduler_unflattened(client, fresh, quality):
    """All six ratings arrive as themselves, not as a pass/fail.

    Reading was a two-button pass/fail screen until now, so "derive the
    quality from `correct`" is the tempting shortcut and the most likely
    regression. Asserted on the stored last_quality rather than on the
    resulting interval, deliberately: the interval is the scheduler's
    policy and does not separate these six values everywhere -- inside
    the learning steps any quality >= 3 advances exactly one step -- so
    an interval assertion would pass under the very mutation it is meant
    to catch.
    """
    posted = client.post("/api/reading/result", json=_payload(
        quality=quality, source_word=_word("駅")))
    assert posted.status_code == 200, posted.text
    assert _modes_of(fresh[0])[SRS_MODE][1] == quality


@pytest.mark.parametrize("fresh", [[EKI, MIZU]], indirect=True)
def test_a_failed_rating_comes_back_sooner_than_a_pass(client, fresh):
    """And the rating changes the schedule, not only the record.

    Two fresh cards: one failed, one passed. The failure goes back to
    the first learning step and the pass moves on to the next, so the
    failed card is due first. This is the coarsest difference the
    scheduler makes, which is exactly why it is the one safe to assert
    from here.
    """
    failed = client.post("/api/reading/result", json=_payload(
        correct=False, quality=1, source_word=_word("駅")))
    passed = client.post("/api/reading/result", json=_payload(
        quality=5, source_word=_word("水")))
    assert failed.status_code == 200 and passed.status_code == 200
    f, p = failed.json()["scheduled"], passed.json()["scheduled"]
    assert f and p, "both words are in the N5 list"
    assert datetime.fromisoformat(f["next_review"]) < datetime.fromisoformat(p["next_review"]), (
        f"a failed rating should be due first -- got {f['next_review']} vs {p['next_review']}"
    )


@pytest.mark.parametrize("fresh", [[EKI]], indirect=True)
def test_reading_does_not_disturb_the_words_other_modes(client, fresh):
    """A reading session must not advance vocab's own schedule.

    card_modes is keyed (card_id, mode), and this is what that buys: the
    word's flashcard schedule is the vocab session's to move, and having
    read a sentence containing it is separate evidence. The mutation
    this catches is reusing an existing key -- `vocab.word_reading` reads
    temptingly right for a screen called reading, and would silently
    advance a schedule the vocab session owns.
    """
    card_id = fresh[0]
    # Every graded mode a vocab card can hold, not just one: seeding a
    # single mode would only catch a collision with THAT key, and the
    # tempting wrong key here is vocab.word_reading.
    seeded = sorted(modes.GRADED_FOR_SOURCE[modes.VOCAB])
    for mode in seeded:
        srs.review(card_id, mode, 4)
    before = _modes_of(card_id)
    assert set(seeded) <= set(before)

    posted = client.post("/api/reading/result", json=_payload(
        quality=0, source_word=_word("駅")))
    assert posted.status_code == 200, posted.text

    after = _modes_of(card_id)
    for mode in seeded:
        assert after[mode] == before[mode], (
            f"rating a sentence moved {mode}, which the vocab session owns"
        )
    assert SRS_MODE in after, "the reading rating wrote no schedule of its own"


def test_the_mode_is_deliberately_unregistered():
    """Registering it must be a deliberate act that breaks this test.

    The endpoint relies on card_index.locate() returning None for this
    key so daily_queue skips it (its `else: continue`) -- 読書 has no
    renderer in Today. Registering the key would give it a lane the
    client cannot draw, so it must not happen by accident.
    """
    assert SRS_MODE not in modes.SRS_MODES
    assert SRS_MODE not in modes.ALL_MODE_KEYS


@pytest.mark.parametrize("fresh", [[EKI]], indirect=True)
def test_reading_and_translation_keep_separate_schedules(client, fresh):
    """Two sentence screens, two tracks, one word.

    Reading and translation study the same curated bank and resolve to
    the same vocab card. Sharing a mode key would make a translation
    silently satisfy a reading review and vice versa; this pins that
    they are separate rows.
    """
    from routes.translation import SRS_MODE as TRANSLATION_MODE

    assert TRANSLATION_MODE != SRS_MODE
    card_id = fresh[0]

    read = client.post("/api/reading/result", json=_payload(
        quality=5, source_word=_word("駅")))
    trans = client.post("/api/translation/result", json={
        "source": "level:N5", "level": "N5",
        "translation_prompt": "Let's meet in front of the station at five.",
        "phrase": "五時に駅の前で会いましょう。",
        "romaji": "goji ni eki no mae de aimashou.",
        "answer": "x", "correct": False, "quality": 0,
        "source_word": _word("駅"),
    })
    assert read.status_code == 200 and trans.status_code == 200, trans.text

    held = _modes_of(card_id)
    assert SRS_MODE in held and TRANSLATION_MODE in held
    assert held[SRS_MODE][1] == 5
    assert held[TRANSLATION_MODE][1] == 0


def test_no_quality_schedules_nothing(client):
    """An older client posting only `correct` still logs, and no more."""
    posted = client.post("/api/reading/result", json=_payload(
        source_word=_word("駅")))
    assert posted.status_code == 200, posted.text
    assert posted.json()["scheduled"] is None


def test_unresolvable_word_still_logs(client):
    """The log is a fact about the learner; scheduling is best-effort."""
    posted = client.post("/api/reading/result", json=_payload(
        quality=4, source_word={"kanji": "無い言葉", "kana": "x", "level": "N5"}))
    assert posted.status_code == 200, posted.text
    assert posted.json()["scheduled"] is None
    assert posted.json()["quality"] == 4

    history = client.get("/api/reading/history", params={"limit": 1})
    assert history.json()[0]["quality"] == 4, "the rating was logged even so"


def test_the_resolver_is_the_shared_one():
    """Reading and translation must resolve a word identically.

    They serve the same sentences from the same bank; two copies of this
    lookup would drift, and the copy that drifted would schedule onto a
    card the other screen never touches.
    """
    import routes.reading as reading
    import routes.translation as translation

    assert reading.vocab_card_id_for_word is vocab_card_id_for_word
    assert translation.vocab_card_id_for_word is vocab_card_id_for_word


# ── Today must not promise what it cannot serve ──────────────────────

def test_an_unservable_schedule_is_not_advertised_as_next_due():
    """A sentence row must not become Today's "next review in ...".

    Today shows a countdown when nothing is due, taken from the soonest
    future row in card_modes. A sentence.reading row has no lane behind
    it -- daily_queue skips the mode -- so counting it would have the
    app promise a review at 10:15 and then present nothing at 10:15.

    The control is an engine constructed without a servable set, which
    is the behaviour before this was fixed; without it the assertion
    could pass merely because the row was never written. Run against a
    synthetic user so this is about THIS card and not about whatever
    else jp_test happens to hold.

    See tests/test_servable_modes.py for the rest of the aggregates this
    same filter corrects.
    """
    import os

    from srs.srs import SRSEngine

    user = "next-due-probe-user"
    card = f"{user}:{EKI}"
    unfiltered = SRSEngine(os.environ["DATABASE_URL"])
    srs.delete_cards([card])
    try:
        srs.review(card, SRS_MODE, 5)
        assert unfiltered.get_next_due_at(user) is not None, (
            "control: an engine counting every mode should see this row"
        )
        assert srs.get_next_due_at(user) is None, (
            "Today would have promised a review it cannot present"
        )

        # And the filter is not simply returning None for everything: a
        # real, servable schedule on the same card still comes back.
        srs.review(card, "vocab.flashcard.f2b", 5)
        assert srs.get_next_due_at(user) is not None
    finally:
        # delete_cards clears card_modes and cards but NOT review_log, and
        # jp_test is shared: left behind, these rows would sit under a
        # synthetic user forever, waiting for the first whole-table
        # aggregate anyone adds. conftest.py's header warns about exactly
        # this kind of leak.
        srs.delete_cards([card])
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (user + ":%",))
            conn.commit()
        finally:
            conn.close()
