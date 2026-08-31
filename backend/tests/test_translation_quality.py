# The translation screen grades with the app's six-segment rating bar, so
# a result carries the learner's own rating and not just pass/fail. These
# pin the three things that could silently regress:
#
#   1. the rating survives the round trip and comes back on /history
#   2. `correct` stays independent of it, so every existing reader keeps
#      working and an older client posting only `correct` still does
#   3. the bound is enforced as a 422 the caller can read, not a 500 from
#      the driver
#
# Plain pytest functions, same style as test_deck_export.py.

import pytest


def _payload(**over):
    body = {
        "source": "level:N5",
        "level": "N5",
        "translation_prompt": "Let's meet in front of the station at five.",
        "phrase": "五時に駅の前で会いましょう。",
        "romaji": "goji ni eki no mae de aimashou.",
        "answer": "五時に駅の前に会いましょう",
        "correct": True,
    }
    body.update(over)
    return body


def test_quality_round_trips(client):
    """The rating the learner gave comes back out of the log."""
    posted = client.post("/api/translation/result", json=_payload(quality=5))
    assert posted.status_code == 200, posted.text
    assert posted.json()["quality"] == 5

    history = client.get("/api/translation/history", params={"limit": 1})
    assert history.status_code == 200, history.text
    rows = history.json()
    assert rows, "the row just written should be the most recent"
    assert rows[0]["quality"] == 5


def test_quality_is_optional(client):
    """A client that posts only `correct` still works.

    This is not hypothetical politeness: every row written before the
    column existed has no rating, and the endpoint has to keep accepting
    that shape rather than 422-ing an older build of the app.
    """
    posted = client.post("/api/translation/result", json=_payload())
    assert posted.status_code == 200, posted.text
    assert posted.json()["quality"] is None


def test_quality_is_independent_of_correct(client):
    """`correct` is not derived server-side, so the two can disagree.

    The client derives the pass/fail from the rating (q > 2) and posts
    both. Recomputing it here would silently overrule a caller that
    grades differently, so the endpoint stores what it is told -- and
    this test is what would notice if someone "helpfully" made the server
    infer one from the other.
    """
    posted = client.post("/api/translation/result", json=_payload(correct=False, quality=4))
    assert posted.status_code == 200, posted.text
    body = posted.json()
    assert body["correct"] is False
    assert body["quality"] == 4


@pytest.mark.parametrize("bad", [-1, 6, 99])
def test_quality_out_of_range_is_a_422(client, bad):
    """Out of 0..5 is a readable rejection, not a database error."""
    posted = client.post("/api/translation/result", json=_payload(quality=bad))
    assert posted.status_code == 422, posted.text


# ── Scheduling ───────────────────────────────────────────────────────
#
# A sentence has no card of its own; the thing scheduled is the vocabulary
# word it was chosen to practise, under its own mode.

from datetime import datetime, timezone

from core.auth import DEV_USER_ID
from core.db import db_conn
from core.srs_instance import srs
from routes.translation import SRS_MODE
from study.card_lookup import vocab_card_id_for_word as _vocab_card_id


def test_card_id_is_resolved_not_built():
    """The canonical id wins over the payload's own fields.

    This is the whole reason _vocab_card_id exists. A batch item reports
    kana as "" for many entries, so building the id straight from the
    payload gives `vocab_N5_駅_` while every vocab session uses
    `vocab_N5_駅_えき`. Getting this wrong mints a phantom card beside
    the real one and schedules onto something nothing else reads.
    """
    got = _vocab_card_id({"kanji": "駅", "kana": "", "level": "N5"}, "u1")
    assert got == "u1:vocab_N5_駅_えき"


@pytest.mark.parametrize("word", [
    None,
    {},
    {"level": "N5"},                                    # no word
    {"kanji": "無い言葉", "kana": "ないことば", "level": "N5"},  # in no deck
])
def test_unresolvable_words_schedule_nothing(word):
    """None rather than a guess, so nothing phantom is ever created."""
    assert _vocab_card_id(word, "u1") is None


def test_the_words_own_level_beats_the_sentences():
    """A curated sentence's level is the SENTENCE's, not the word's.

    本 is the focus of an N4 sentence and an N5 word, so the card is
    vocab_N5_本_ほん. Searching only the declared level is what this
    guards against: it left N4 resolving 3 sentences out of 45, which
    looked like a working feature because N5 -- the level anyone tests
    by hand -- happened to resolve nearly all of its own.
    """
    assert _vocab_card_id({"kanji": "本", "kana": "", "level": "N4"}, "u1")         == "u1:vocab_N5_本_ほん"


def test_a_word_with_no_level_still_resolves():
    """Not every source carries a JLPT level; the word is enough."""
    assert _vocab_card_id({"kanji": "駅"}, "u1") == "u1:vocab_N5_駅_えき"


def test_most_of_the_curated_bank_resolves():
    """A floor on coverage, because the failure mode here is silent.

    An unresolvable word still logs and still returns 200 -- it just
    schedules nothing -- so a resolver that quietly stopped matching
    would look exactly like a working one. 203 of 223 resolve today;
    the ~20 that do not are orthographic variants (子ども vs 子供).
    """
    from content import reading_sentences

    total = resolved = 0
    for level, rows in reading_sentences.BY_LEVEL.items():
        for row in rows:
            total += 1
            if _vocab_card_id({"kanji": row["focus"], "kana": "", "level": level}, "u1"):
                resolved += 1
    assert total > 0
    assert resolved / total >= 0.85, f"only {resolved}/{total} curated sentences resolve"


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


@pytest.mark.parametrize("fresh", [[EKI]], indirect=True)
def test_rating_schedules_the_source_word(client, fresh):
    """The rating reaches the scheduler and moves the card."""
    posted = client.post("/api/translation/result", json=_payload(
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

    Asserted on the stored last_quality rather than on the resulting
    interval, deliberately. The interval is the scheduler's policy and
    it does not separate these six values everywhere: inside the
    learning steps any quality >= 3 advances exactly one step, and on a
    freshly graduated card the growth rounding puts a 3 and a 5 on the
    same day. Asserting an interval here would therefore be testing
    test_scheduler.py's subject, and would fail the day that policy is
    tuned -- while still not noticing the thing this endpoint could
    actually get wrong, which is collapsing the rating on the way in.
    """
    posted = client.post("/api/translation/result", json=_payload(
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
    failed = client.post("/api/translation/result", json=_payload(
        correct=False, quality=1, source_word=_word("駅")))
    passed = client.post("/api/translation/result", json=_payload(
        quality=5, source_word=_word("水")))
    assert failed.status_code == 200 and passed.status_code == 200
    f, p = failed.json()["scheduled"], passed.json()["scheduled"]
    assert f and p, "both words are in the N5 list"
    assert datetime.fromisoformat(f["next_review"]) < datetime.fromisoformat(p["next_review"]), (
        f"a failed rating should be due first -- got {f['next_review']} vs {p['next_review']}"
    )


@pytest.mark.parametrize("fresh", [[EKI]], indirect=True)
def test_translation_does_not_disturb_the_words_other_modes(client, fresh):
    """A translation session must not advance vocab's own schedule.

    card_modes is keyed (card_id, mode), so this is what that buys: the
    word's flashcard schedule is the vocab session's to move, and being
    translated is separate evidence. If SRS_MODE were ever changed to
    reuse an existing mode key, this is what would notice.
    """
    card_id = fresh[0]
    srs.review(card_id, "flashcard", 4)
    before = _modes_of(card_id)
    assert "flashcard" in before

    posted = client.post("/api/translation/result", json=_payload(
        quality=0, source_word=_word("駅")))
    assert posted.status_code == 200, posted.text

    after = _modes_of(card_id)
    assert after["flashcard"] == before["flashcard"], (
        "the flashcard schedule moved when a translation was rated"
    )
    assert SRS_MODE in after, "the translation rating wrote no schedule of its own"


def test_no_quality_schedules_nothing(client):
    """An older client posting only `correct` still logs, and no more."""
    posted = client.post("/api/translation/result", json=_payload(
        source_word=_word("駅")))
    assert posted.status_code == 200, posted.text
    assert posted.json()["scheduled"] is None


def test_unresolvable_word_still_logs(client):
    """The log is a fact about the learner; scheduling is best-effort."""
    posted = client.post("/api/translation/result", json=_payload(
        quality=4, source_word={"kanji": "無い言葉", "kana": "x", "level": "N5"}))
    assert posted.status_code == 200, posted.text
    assert posted.json()["scheduled"] is None
    assert posted.json()["quality"] == 4
