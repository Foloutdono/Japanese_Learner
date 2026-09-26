# ── The station's samples and the tiers' met counts (plan 136) ─────
# The desk's station split prints, on each stop, the first things it
# teaches, and on each platform the card it will ask. Both come from
# /api/station/{source}/samples, and the things worth pinning are the
# ones that would print something untrue on the screen rather than
# fail:
#
#   * a sample is the stop's own content, in the order a learner meets
#     it (frequency for vocab and kanji, the catalogue for grammar, the
#     chart for kana) -- never another level's words
#   * a specimen is a card the platforms can actually ask: a vocab word
#     with a kanji (the reading platform serves no other), a grammar
#     point with a sentence and a contrast blank whose choices hold it
#   * a gloss is in the language asked for
#
# And /api/frequency/{domain}/tiers/started counts a tier's met cards
# the way /api/stats counts a level's: reviewed in any mode, once.
import pytest

from content import frequency_data as freq
from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
from content.kana_data import KANA_SETS
from content.vocab_data import VOCAB_BY_LEVEL
from core.db import db_conn
from tests.conftest import acting_as

LEVELS = ["N5", "N4", "N3", "N2", "N1"]


def _stops(client, source, lang="fr"):
    r = client.get(f"/api/station/{source}/samples?lang={lang}")
    assert r.status_code == 200
    return r.json()["stops"]


def test_every_line_answers_every_stop(client):
    assert list(_stops(client, "kana")) == list(KANA_SETS)
    for source in ("kanji", "vocab", "grammar"):
        assert list(_stops(client, source)) == LEVELS
    for source in ("kana", "kanji", "vocab", "grammar"):
        for stop in _stops(client, source).values():
            assert stop["sample"], source
            assert stop["card"]["jp"], source


def test_an_unknown_line_is_a_404_and_an_unknown_language_is_french(client):
    assert client.get("/api/station/radicals/samples").status_code == 404
    assert _stops(client, "vocab", lang="xx") == _stops(client, "vocab", lang="fr")


def test_a_vocab_sample_is_the_level_s_own_words_in_frequency_order(client):
    stops = _stops(client, "vocab")
    for level in LEVELS:
        own = {e.get("kanji") or e.get("kana") for e in VOCAB_BY_LEVEL[level]}
        assert set(stops[level]["sample"]) <= own, level
    first = next(
        k for k in freq.standard_order("vocab")
        if (freq.resolve("vocab", k) or (None,))[0] == "N5"
    )
    kanji, _, kana = first.partition("::")
    assert stops["N5"]["sample"][0] == (kanji or kana)


def test_a_vocab_specimen_is_a_word_every_platform_can_ask(client):
    for level, stop in _stops(client, "vocab").items():
        card = stop["card"]
        entry = next(e for e in VOCAB_BY_LEVEL[level] if e.get("kanji") == card["jp"])
        assert card["reading"] == entry["kana"].split("/")[0].strip()
        assert card["meaning"]


def test_the_gloss_is_in_the_language_asked_for(client):
    fr = _stops(client, "vocab", "fr")["N5"]["card"]["meaning"]
    en = _stops(client, "vocab", "en")["N5"]["card"]["meaning"]
    assert fr and en and fr != en


def test_a_grammar_specimen_carries_its_sentence_and_its_blank(client):
    for level, stop in _stops(client, "grammar").items():
        patterns = [p["pattern"] for p in GRAMMAR_POINTS_BY_LEVEL[level]]
        assert stop["sample"] == patterns[: len(stop["sample"])]
        card = stop["card"]
        assert card["jp"] in patterns
        if "blank" in card:
            assert card["sentence"]
            assert card["blank"]["choices"][-1] == card["jp"]
            assert len(card["blank"]["choices"]) >= 2
            assert card["blank"]["before"] or card["blank"]["after"]
            # The lesson's own rivals, so the specimen is the same on
            # every process rather than drawn with random fillers.
            entry = next(p for p in GRAMMAR_POINTS_BY_LEVEL[level] if p["pattern"] == card["jp"])
            named = {r["pattern"] for r in entry.get("compare", [])}
            if named - {card["jp"]}:
                assert set(card["blank"]["choices"][:-1]) <= named


def test_a_kana_specimen_is_the_set_s_first_kana(client):
    for slug, stop in _stops(client, "kana").items():
        assert stop["card"] == {"jp": KANA_SETS[slug][0]["kana"], "romaji": KANA_SETS[slug][0]["romaji"]}


# ── the tiers' met counts ──
# A learner of their own: the suite's shared user carries whatever
# earlier files reviewed, and a count over every tier would read it.
LEARNER = "tiers-started-learner"


@pytest.fixture
def seeded():
    """The words at ranks 1 and 201 met (the first in two modes, still
    one card), and the word at rank 2 with a row but no review behind
    it."""
    order = freq.standard_order("vocab")
    ids = [freq.to_id("vocab", order[rank]) for rank in (0, 200, 1)]
    rows = [
        (ids[0], "vocab.flashcard.f2b", 2),
        (ids[0], "vocab.flashcard.b2f", 1),
        (ids[1], "vocab.flashcard.f2b", 1),
        (ids[2], "vocab.flashcard.f2b", 0),
    ]
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for raw_id, mode, reviews in rows:
                full = f"{LEARNER}:{raw_id}"
                cur.execute("INSERT INTO cards(id) VALUES (%s) ON CONFLICT DO NOTHING", (full,))
                cur.execute(
                    """
                    INSERT INTO card_modes(card_id, mode, interval_days, next_review,
                                           total_reviews, correct_reviews, is_learning, learning_step)
                    VALUES (%s, %s, 1, NOW() + INTERVAL '1 day', %s, %s, FALSE, 0)
                    ON CONFLICT (card_id, mode) DO UPDATE SET total_reviews = EXCLUDED.total_reviews
                    """,
                    (full, mode, reviews, reviews),
                )
        conn.commit()
        yield
    finally:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{LEARNER}:%",))
            cur.execute("DELETE FROM cards WHERE id LIKE %s", (f"{LEARNER}:%",))
        conn.commit()
        conn.close()


def test_a_tier_counts_its_met_cards_once_each(client, seeded):
    with acting_as(LEARNER):
        body = client.get("/api/frequency/vocab/tiers/started?tier_size=200").json()
    assert body["started"] == {"1": 1, "2": 1}


def test_another_size_regroups_the_same_cards(client, seeded):
    with acting_as(LEARNER):
        body = client.get("/api/frequency/vocab/tiers/started?tier_size=500").json()
    assert body["started"] == {"1": 2}


def test_the_jmdict_pool_answers_no_figures(client, seeded):
    with acting_as(LEARNER):
        body = client.get("/api/frequency/vocab_jmdict/tiers/started").json()
    assert body["started"] == {}


def test_a_learner_with_nothing_met_answers_an_empty_map(client):
    with acting_as("tiers-started-nobody"):
        assert client.get("/api/frequency/kanji/tiers/started").json()["started"] == {}
