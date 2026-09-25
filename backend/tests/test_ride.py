# ── 試乗 — the first ride's seam (plan 097) ─────────────────────────
# Route tests on a user of their own, like test_onboarding_profile's
# kana door: boarding at N3 or N1 here runs the level rule, which seeds
# real card rows as mastered, and the shared DEV user's card state is
# what the dictionary tests elsewhere in the suite are served (a 日
# asserted not_started). Every row this user writes is wiped after each
# test, cards included.
import contextlib

import pytest

import core.user_level as user_level
from content.vocab_data import VOCAB_BY_LEVEL
from core.auth import get_user_id
from core.db import db_conn
from main import app
from routes.onboarding import (
    GUIDE_GATES, RIDE_KNOWN, RIDE_SENTENCE_JP, RIDE_UNKNOWN, RIDE_UNKNOWN_TOP, ride_unknown_level,
)

RIDE_USER = "ride-test-user"


def _wipe(user_id: str) -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM card_first_review WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM cards WHERE id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM credit_ledger WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM user_profiles WHERE user_id = %s", (user_id,))
        conn.commit()
    finally:
        conn.close()
    user_level._cache.pop(user_id, None)


@pytest.fixture()
def client(client):
    """The session client, acting as RIDE_USER for one test."""
    _wipe(RIDE_USER)
    previous = app.dependency_overrides.get(get_user_id)
    app.dependency_overrides[get_user_id] = lambda: RIDE_USER
    try:
        yield client
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_user_id, None)
        else:
            app.dependency_overrides[get_user_id] = previous
        _wipe(RIDE_USER)


@contextlib.contextmanager
def _clean(user_id: str):
    # Kept as the tests' own bracket so each reads as "this test's
    # state, then none"; the fixture above does the wiping.
    yield


def _board(client, level: str, kana: str):
    r = client.post("/api/onboarding/complete",
                    json={"jlptLevel": level, "dailyNewTarget": 10, "kanaKnown": kana})
    assert r.status_code == 200, r.text


# ── The content is the deck's ─────────────────────────────────────

def _in_deck(level, kanji, kana):
    return any(e.get("kanji", "") == kanji and e.get("kana", "") == kana
               for e in VOCAB_BY_LEVEL[level])


def test_every_ride_card_is_a_deck_entry_at_its_level():
    # A deck correction (plan 091) that touched one of these would
    # otherwise serve a card with no entry behind it. The module also
    # refuses to import in that case; this is the same promise, named.
    assert _in_deck(RIDE_KNOWN["level"], RIDE_KNOWN["kanji"], RIDE_KNOWN["kana"])
    for level, (kanji, kana) in RIDE_UNKNOWN.items():
        assert _in_deck(level, kanji, kana), (level, kanji)
    assert _in_deck("N1", *RIDE_UNKNOWN_TOP)
    assert set(RIDE_UNKNOWN) == set(user_level.LEVELS)


def test_the_sentence_is_in_the_curated_n5_bank():
    from content.reading_sentences import N5
    assert any(e["jp"] == RIDE_SENTENCE_JP for e in N5)


def test_the_known_card_spells_its_romaji_by_hand():
    # study/romaji reads the final は as a particle and prints
    # "konnichiha"; the card must not.
    assert RIDE_KNOWN["romaji"] == "konnichiwa"


# ── Which card the learner cannot know ────────────────────────────

@pytest.mark.parametrize("stored, kana, expected", [
    ("N5", "none", "N5"),       # the novice: N5 is ahead of them
    ("N5", "hiragana", "N5"),
    ("N5", None, "N5"),
    ("N5", "both", "N4"),       # a real N5: one stop up
    ("N4", "both", "N3"),
    ("N3", "both", "N2"),
    ("N2", "both", "N1"),
    ("N1", "both", "N1"),       # nothing above N1
    ("bogus", "both", "N4"),    # garbage in the column reads as the default
])
def test_unknown_level_is_one_stop_above_except_for_the_novice(stored, kana, expected):
    assert ride_unknown_level(stored, kana) == expected


# ── GET /api/onboarding/ride ──────────────────────────────────────

def test_ride_serves_the_known_card_then_the_unknown_one_in_the_vocab_shape(client):
    with _clean(RIDE_USER):
        _board(client, "N5", "none")
        body = client.get("/api/onboarding/ride?lang=en").json()
        known, unknown = body["cards"]
        assert known["kana"] == "こんにちは"
        assert known["romaji"] == "konnichiwa"
        assert known["mode"] == "vocab.flashcard.f2b"
        assert known["source"] == "vocab"      # the queue's own field, so CardPrompt knows the face
        assert known["direction"] == "f2b"
        # Never studied and never to be: no stage. The forecast is a new
        # card's (plan 131), for the desk's verdict tiles, and nothing else:
        # the ride earns no XP, so there is none to preview.
        assert known["stage"] is None
        forecast = known["review_preview"]
        assert sorted(forecast) == ["0", "1", "2", "3", "4", "5"]
        assert all(set(f) == {"due_in"} for f in forecast.values())
        # Wrong brings it back sooner than right: the lesson the ride teaches.
        assert forecast["0"]["due_in"] <= forecast["5"]["due_in"]
        assert unknown["card_id"] == "vocab_N5_駅_えき"
        assert unknown["level"] == "N5"
        assert unknown["meaning"] == "station"
        assert unknown["romaji"] == "eki"
        # The furigana hint rides on the kanji card as it does in a run.
        assert "indice_3" in unknown["hints"]


def test_ride_follows_the_stored_level(client):
    with _clean(RIDE_USER):
        _board(client, "N3", "both")
        unknown = client.get("/api/onboarding/ride").json()["cards"][1]
        assert unknown["level"] == "N2"
        assert unknown["kanji"] == RIDE_UNKNOWN["N2"][0]
        # ...and in the learner's language.
        assert unknown["meaning"] == "abonnement, carte de transport"


def test_ride_at_n1_serves_another_n1_word(client):
    with _clean(RIDE_USER):
        _board(client, "N1", "both")
        unknown = client.get("/api/onboarding/ride").json()["cards"][1]
        assert unknown["level"] == "N1"
        assert unknown["kanji"] == RIDE_UNKNOWN_TOP[0]


def test_ride_sentence_is_the_reading_batch_shape(client):
    with _clean(RIDE_USER):
        s = client.get("/api/onboarding/ride").json()["sentence"]
        assert s["phrase"] == RIDE_SENTENCE_JP
        assert s["translation_lang"] == "en"
        assert s["translation"]
        assert s["romaji"].startswith("eki de")
        assert s["display_seconds"] > 0
        assert s["grammar"] == "で"


# ── POST /api/onboarding/ride/check ───────────────────────────────

def test_check_measures_against_the_ride_sentence_only(client):
    full = client.post("/api/onboarding/ride/check", json={"answer": "eki de tomodachi ni aimasu"}).json()
    assert full["accuracy"] == 100
    assert full["matched"] == "romaji"
    # A phrase in the body is not a parameter: the measure is against
    # the ride's sentence whatever a client sends.
    other = client.post("/api/onboarding/ride/check",
                        json={"answer": "watashi wa gakusei desu", "phrase": "わたしは学生です。"}).json()
    assert other["accuracy"] < 50
    # Empty is an answer, and it measures 0 rather than being refused.
    assert client.post("/api/onboarding/ride/check", json={}).json()["accuracy"] == 0


# ── The stamps ────────────────────────────────────────────────────

def test_done_keeps_the_first_stamp_and_echoes_skipped(client):
    with _clean(RIDE_USER):
        assert client.get("/api/profile").json()["tutorialAt"] is None
        first = client.post("/api/onboarding/ride/done", json={"skipped": True}).json()
        assert first["skipped"] is True
        second = client.post("/api/onboarding/ride/done", json={}).json()
        assert second["skipped"] is False
        assert second["tutorialAt"] == first["tutorialAt"]
        assert client.get("/api/profile").json()["tutorialAt"] == first["tutorialAt"]
        # Settings' replay clears it.
        assert client.delete("/api/onboarding/ride/done").json() == {"tutorialAt": None}
        assert client.get("/api/profile").json()["tutorialAt"] is None


def test_done_seeds_the_profile_row_when_none_exists(client):
    # The fixture wiped the row; the first request is the stamp itself.
    with _clean(RIDE_USER):
        assert client.post("/api/onboarding/ride/done", json={}).status_code == 200
        assert client.get("/api/profile").json()["tutorialAt"] is not None


def test_guided_is_a_map_that_keeps_the_first_time_per_gate(client):
    with _clean(RIDE_USER):
        assert client.get("/api/profile").json()["guided"] == {}
        first = client.post("/api/onboarding/guided/today").json()["guided"]
        assert set(first) == {"today"}
        again = client.post("/api/onboarding/guided/today").json()["guided"]
        assert again == first
        both = client.post("/api/onboarding/guided/learn").json()["guided"]
        assert set(both) == {"today", "learn"}
        assert both["today"] == first["today"]
        assert client.get("/api/profile").json()["guided"] == both
        assert client.delete("/api/onboarding/guided").json() == {"guided": {}}
        assert client.get("/api/profile").json()["guided"] == {}


def test_guided_refuses_a_gate_it_does_not_know(client):
    with _clean(RIDE_USER):
        assert client.post("/api/onboarding/guided/settings").status_code == 422
        assert client.post("/api/onboarding/guided/%3Cscript%3E").status_code == 422
        assert client.get("/api/profile").json()["guided"] == {}


def test_the_gates_are_the_tab_bar():
    # config/tabs.js's TAB_IDS, in its order; a sixth gate is a change
    # on both sides.
    assert GUIDE_GATES == ("today", "learn", "practice", "dictionary", "profile")


def test_the_ride_writes_no_review(client):
    # The whole point: nothing here is a review. No card row, no
    # review_log row, no credit spent, whatever the ride is asked.
    with _clean(RIDE_USER):
        # Counts, not zeros: the boarding's level rule seeds card rows
        # for the stops behind the level (apply_level_rule), and earlier
        # tests in this process may have boarded at N3. What matters is
        # that the ride itself moves none of these figures.
        def figures():
            conn = db_conn()
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT COUNT(*) FROM review_log WHERE card_id LIKE %s", (f"{RIDE_USER}:%",))
                    reviews = cur.fetchone()[0]
                    cur.execute("SELECT COUNT(*) FROM cards WHERE id LIKE %s", (f"{RIDE_USER}:%",))
                    cards = cur.fetchone()[0]
                    cur.execute("SELECT COALESCE(SUM(delta), 0) FROM credit_ledger WHERE user_id = %s", (RIDE_USER,))
                    balance = cur.fetchone()[0]
                    return reviews, cards, balance
            finally:
                conn.close()
        before = figures()
        client.get("/api/onboarding/ride")
        client.post("/api/onboarding/ride/check", json={"answer": "eki"})
        client.post("/api/onboarding/ride/done", json={})
        client.post("/api/onboarding/guided/today")
        assert figures() == before
