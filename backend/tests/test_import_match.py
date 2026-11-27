# ── The import dialog's match to the app's own cards (plan 337) ────
# A pasted row that means a card the app teaches is offered that card
# (study/import_match.py, POST /api/decks/{id}/import/match). Held here:
# what counts as the same card, what is only offered, that nothing is
# ever added by asking, and that the matcher reads the browse picker's
# table of sources.
import pytest

from content.vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from content.kanji_data import KANJI_BY_LEVEL, kanji_to_id
from core.db import db_conn
from main import app
from routes import decks as decks_routes
from routes.profile import get_user_id
from study import import_match
from study.import_match import candidates

MUID = "import-match-test-user"

WATER = vocab_to_id({"kanji": "水", "kana": "みず"}, "N5")
WATER_KANJI = kanji_to_id({"kanji": "水"}, "N5")


def ids(found):
    return [c.raw_id for c in found]


# ── the matcher ───────────────────────────────────────────────

def test_it_reads_the_browse_pickers_table_of_sources():
    for deck_type, sources in import_match.SOURCES_FOR_TYPE.items():
        assert set(sources) == decks_routes.SOURCE_FOR_TYPE[deck_type], deck_type
    assert set(import_match.SOURCES_FOR_TYPE) == set(decks_routes.SOURCE_FOR_TYPE)
    assert "standard" not in import_match.SOURCES_FOR_TYPE


def test_a_written_form_is_the_card_whose_face_it_is():
    found = candidates("vocab", {"word": "水", "meaning": "water"})
    assert ids(found) == [WATER]
    assert found[0].exact and found[0].via == "written"


def test_folding_width_case_and_spaces_changes_nothing():
    assert ids(candidates("vocab", {"word": " 水 ", "meaning": ""})) == [WATER]
    assert ids(candidates("kana", {"kana": "ａ", "romaji": "a"})) == []  # latin is no kana
    assert candidates("kana", {"kana": " あ ", "romaji": "a"})[0].raw_id == "kana_あ"


def test_a_word_typed_in_kana_is_offered_but_never_the_exact_one():
    # Many words read みず; a kanji card found by its sound is the learner's call.
    found = candidates("vocab", {"word": "みず", "meaning": "water"})
    assert WATER in ids(found)
    assert not any(c.exact for c in found)
    assert all(c.via == "reading" for c in found if c.raw_id == WATER)


def test_a_kana_only_card_is_matched_outright_by_its_kana():
    entry = next(e for e in VOCAB_BY_LEVEL["N5"] if not e["kanji"])
    found = candidates("vocab", {"word": entry["kana"], "meaning": ""})
    assert found[0].raw_id == vocab_to_id(entry, "N5")
    assert found[0].exact


def test_a_reading_the_row_gives_holds_the_card_to_it():
    agree = candidates("vocab", {"word": "水", "meaning": "water", "reading": "みず"})
    assert agree[0].raw_id == WATER and agree[0].exact
    # A card whose reading disagrees is still offered, never as the exact one.
    clash = candidates("vocab", {"word": "水", "meaning": "water", "reading": "すい"})
    assert clash[0].raw_id == WATER and not clash[0].exact


def test_the_meaning_ranks_and_never_matches_alone():
    assert candidates("vocab", {"word": "zzzz", "meaning": "water"}) == []
    assert candidates("vocab", {"word": "水", "meaning": "water"})[0].meaning_agrees
    assert not candidates("vocab", {"word": "水", "meaning": "fire"})[0].meaning_agrees


def test_two_cards_that_tie_are_both_offered_and_neither_is_exact():
    # 水 is a vocab word and a kanji of its own: a mixed deck holds both.
    found = candidates("mixed", {"front": "水", "back": ""})
    assert {c.source for c in found} == {"vocab", "kanji"}
    assert not any(c.exact for c in found)
    assert WATER_KANJI in ids(found)


def test_a_deck_only_looks_in_its_own_sources():
    assert {c.source for c in candidates("kanji", {"kanji": "水", "meaning": ""})} == {"kanji"}
    assert {c.source for c in candidates("vocab", {"word": "水", "meaning": ""})} == {"vocab"}


def test_a_kanji_and_a_kana_are_matched_exactly():
    char = KANJI_BY_LEVEL["N5"][0]["kanji"]
    found = candidates("kanji", {"kanji": char, "meaning": "", "readings": {}, "radical": 1})
    assert found[0].exact and found[0].raw_id.endswith(char)


def test_a_grammar_pattern_ignores_its_leading_tilde():
    for written in ("〜てください", "てください", "～てください", "~てください"):
        found = candidates("grammar", {"rule": written, "meaning": "please"})
        assert found and found[0].raw_id == "grammar_N5_〜てください", written
        assert found[0].exact, written


def test_a_plain_deck_and_an_empty_row_match_nothing():
    assert candidates("standard", {"front": "水", "back": "water"}) == []
    assert candidates("vocab", {"word": "", "meaning": "water"}) == []
    assert candidates("vocab", {}) == []
    # A line of lyrics is no card.
    assert candidates("lyrics", {"front": "夜に駆ける 星の夜", "back": "x"}) == []


def test_no_row_is_offered_more_than_the_cap():
    for deck_type, probe in (("vocab", "かかる"), ("mixed", "水")):
        key = "word" if deck_type == "vocab" else "front"
        assert len(candidates(deck_type, {key: probe, "meaning": ""})) <= import_match.MAX_CANDIDATES


# ── the route ─────────────────────────────────────────────────

def _wipe():
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM deck_cards WHERE user_id = %s", (MUID,))
            cur.execute("DELETE FROM custom_cards WHERE user_id = %s", (MUID,))
            cur.execute("DELETE FROM decks WHERE user_id = %s", (MUID,))
        conn.commit()
    finally:
        conn.close()


@pytest.fixture()
def mclient(client):
    _wipe()
    app.dependency_overrides[get_user_id] = lambda: MUID
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_user_id, None)
        _wipe()


def _deck(client, deck_type):
    r = client.post("/api/decks", json={"name": "match", "type": deck_type})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _match(client, deck_id, cards, lang="en"):
    return client.post(f"/api/decks/{deck_id}/import/match", json={"cards": cards, "lang": lang})


def _count(deck_id):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT (SELECT COUNT(*) FROM deck_cards WHERE deck_id = %s),"
                        " (SELECT COUNT(*) FROM custom_cards WHERE deck_id = %s)", (deck_id, deck_id))
            return cur.fetchone()
    finally:
        conn.close()


def test_the_route_answers_one_list_per_row_in_order(mclient):
    deck = _deck(mclient, "vocab")
    rows = [
        {"fields": {"word": "水", "meaning": "water"}},
        {"fields": {"word": "zzzz", "meaning": "nothing"}},
        {"fields": {"word": "毎月", "meaning": "every month"}},
    ]
    body = _match(mclient, deck, rows).json()
    assert body["available"] is True
    assert [len(r) for r in body["rows"]] == [1, 0, 1]
    first = body["rows"][0][0]
    assert first["raw_id"] == WATER and first["source"] == "vocab" and first["level"] == "N5"
    assert first["front"] == "水" and first["kana"] == "みず" and first["meaning"]
    assert first["exact"] is True and first["in_deck"] is False


def test_asking_adds_nothing(mclient):
    deck = _deck(mclient, "vocab")
    _match(mclient, deck, [{"fields": {"word": "水", "meaning": "water"}}])
    assert _count(deck) == (0, 0)


def test_a_card_the_deck_holds_is_marked(mclient):
    deck = _deck(mclient, "vocab")
    r = mclient.post(f"/api/decks/{deck}/cards/app",
                     json={"cards": [{"source": "vocab", "level": "N5", "raw_id": WATER}]})
    assert r.json()["added"] == 1
    row = _match(mclient, deck, [{"fields": {"word": "水", "meaning": "water"}}]).json()["rows"][0]
    assert row[0]["in_deck"] is True


def test_the_meaning_is_the_learners_language(mclient):
    deck = _deck(mclient, "vocab")
    cards = [{"fields": {"word": "水", "meaning": "eau"}}]
    fr = _match(mclient, deck, cards, lang="fr").json()["rows"][0][0]
    assert fr["meaning"].lower() == "eau" or "eau" in fr["meaning"].lower()
    assert fr["meaning_agrees"] is True


def test_a_plain_deck_has_nothing_to_match(mclient):
    deck = _deck(mclient, "standard")
    body = _match(mclient, deck, [{"front": "水", "back": "water"}]).json()
    assert body == {"available": False, "rows": [[]]}


def test_a_mixed_deck_matches_a_written_pair(mclient):
    deck = _deck(mclient, "mixed")
    body = _match(mclient, deck, [{"front": "水", "back": "water"}]).json()
    assert body["available"] is True
    assert {c["source"] for c in body["rows"][0]} == {"vocab", "kanji"}


def test_only_the_owner_may_ask(mclient):
    deck = _deck(mclient, "vocab")
    app.dependency_overrides[get_user_id] = lambda: "someone-else"
    r = _match(mclient, deck, [{"fields": {"word": "水", "meaning": "water"}}])
    assert r.status_code in (403, 404)


def test_a_paste_past_the_batch_is_refused(mclient):
    deck = _deck(mclient, "vocab")
    rows = [{"fields": {"word": "水", "meaning": ""}}] * (decks_routes.MAX_BATCH + 1)
    assert _match(mclient, deck, rows).status_code == 422


def test_a_language_the_app_does_not_speak_reads_english(mclient):
    deck = _deck(mclient, "vocab")
    cards = [{"fields": {"word": "水", "meaning": "water"}}]
    assert _match(mclient, deck, cards, lang="xx").json() == _match(mclient, deck, cards, lang="en").json()
