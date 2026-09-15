"""
The 文法 line's own endpoints after plan 087: the language rides on every
card, a new card carries its lesson, the contrast drill blanks the
pattern and offers its rivals, and the two lesson endpoints serve the
station's index and the door on every card.

Content-independent where it can be: the tests read what the catalogue
says rather than pinning a point, and monkeypatch a contrast sentence
onto a point when no level is rich yet, so the drill's shape is tested
whatever wave the content is at.
"""
import pytest

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, RICH_LEVELS, gloss, grammar_to_id
from study import card_index
from study.grammar_examples import BLANK, highlight_span, parts_with_span
from study.grammar_lesson import contrast_payload, lesson_payload


@pytest.fixture(scope="module", autouse=True)
def _fresh_grammar_progress():
    """The pool tests below expect the probe learner to have N5 grammar
    cards still to serve. test_level_rule.py seeds every card up to a
    claimed level as mastered and leaves the rows, so on a database that
    has already run the whole suite once nothing would be due here."""
    from core.auth import DEV_USER_ID
    from core.db import db_conn
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            like = f"{DEV_USER_ID}:grammar\\_%"
            for table in ("review_log", "card_first_review", "card_modes"):
                cur.execute(f"DELETE FROM {table} WHERE card_id LIKE %s", (like,))
            cur.execute("DELETE FROM cards WHERE id LIKE %s", (like,))
        conn.commit()
    finally:
        conn.close()
    yield


def _cards(client, level, mode, **params):
    return client.get("/api/grammar/cards", params={"level": level, "mode": mode, "count": 5, **params}).json()


def test_cards_speak_the_learners_language_and_carry_their_lesson_when_new(client):
    fr = _cards(client, "N5", "grammar.flashcard.f2b", lang="fr")["cards"]
    assert fr
    for card in fr:
        entry = next(e for e in GRAMMAR_POINTS_BY_LEVEL["N5"] if e["pattern"] == card["grammar"])
        assert card["meaning"] == gloss(entry, "fr")
        assert card["raw_id"] == grammar_to_id(entry, "N5") == card["card_id"]
        # indice_2: the sentences ride with furigana and a translation in
        # the learner's language, never a bare `en`.
        for ex in card["hints"]["indice_2"]:
            assert set(ex) >= {"jp", "tr", "furigana"}
            assert "en" not in ex
        # A card the learner has never met carries its lesson; one they
        # have does not (see the gate in GrammarRun).
        assert ("lesson" in card) == (card["stage"] == "new")
        if "lesson" in card:
            assert set(card["lesson"]) == {"register", "steps", "compare", "examples"}


def test_fill_in_hides_the_answer_from_its_own_sentence(client):
    body = _cards(client, "N3", "grammar.fill_in", lang="en")
    for card in body["cards"]:
        sentence = card["fill_sentence"]
        assert set(sentence) == {"jp", "tr", "furigana"}
        assert not any(p.get("highlight") for p in sentence["furigana"]), "the mark would point at the answer"
        assert "".join(p["text"] for p in sentence["furigana"]) == sentence["jp"]


def test_contrast_at_a_level_with_no_lessons_is_an_empty_pool_not_a_500(client):
    plain = [lvl for lvl in ("N1", "N2", "N3", "N4", "N5") if lvl not in RICH_LEVELS]
    if not plain:
        pytest.skip("every level is rich")
    body = _cards(client, plain[0], "grammar.contrast")
    if card_index.total("grammar", plain[0], "grammar.contrast") == 0:
        assert body == {"cards": [], "pace": body["pace"]}


def test_contrast_payload_blanks_the_pattern_and_offers_its_rivals():
    level = "N3"
    entry = {
        "pattern": "〜べきだ",
        "structure": "verb dictionary form + べきだ",
        "meaning": {"en": "should", "fr": "devrait"},
        "steps": [],
        "compare": [{"pattern": "〜はずだ", "en": "expectation, not duty", "fr": "attente, pas devoir"}],
        "examples": [
            {"jp": "約束は守るべきです。", "en": "You should keep a promise.", "fr": "Il faut tenir ses promesses.", "contrast": True},
        ],
    }
    grammar_list = GRAMMAR_POINTS_BY_LEVEL[level]
    payload = contrast_payload(level, entry, grammar_list, "en")
    assert payload["answer"] == "〜べきだ"
    assert "〜べきだ" in payload["choices"] and "〜はずだ" in payload["choices"]
    assert len(payload["choices"]) == 4 and len(set(payload["choices"])) == 4
    blanks = [p for p in payload["furigana"] if p.get("blank")]
    assert len(blanks) == 1 and blanks[0]["text"] == BLANK
    # The blank replaces exactly the pattern's surface: the rest of the
    # sentence reads back around it.
    around = "".join(p["text"] for p in payload["furigana"] if not p.get("blank"))
    assert around.startswith("約束は守る") and around.endswith("です。")
    assert payload["tr"] == "You should keep a promise."


def test_contrast_payload_is_none_without_a_marked_sentence():
    entry = dict(GRAMMAR_POINTS_BY_LEVEL["N3"][0])
    entry = {**entry, "examples": [{**ex, "contrast": False} for ex in entry["examples"]]}
    assert contrast_payload("N3", entry, GRAMMAR_POINTS_BY_LEVEL["N3"], "en") is None


def test_highlight_never_splits_a_ruby_part():
    # 読んでください: the te-form voices, and 読 carries a reading. The
    # span covers んでください; the part 読|よ stays whole either way.
    jp = "この本を読んでください。"
    span = highlight_span(jp, "〜てください")
    assert span is not None and jp[span[0]:span[1]] in ("でください", "んでください", "ください")
    parts = parts_with_span(jp, span, "highlight")
    assert "".join(p["text"] for p in parts) == jp
    for p in parts:
        if p.get("reading") is not None:
            # a ruby part is marked whole or not at all
            assert set(p) <= {"text", "reading", "highlight"}
    marked = "".join(p["text"] for p in parts if p.get("highlight"))
    assert "ください" in marked
    # 〜に違いない carries a kanji of its own: the mark reaches it.
    jp2 = "彼は来るに違いない。"
    span2 = highlight_span(jp2, "〜に違いない")
    marked2 = "".join(p["text"] for p in parts_with_span(jp2, span2, "highlight") if p.get("highlight"))
    assert "違" in marked2
    # an unverifiable pattern gets no span and the parts come back plain
    assert highlight_span("今日は天気がいいです。", "は") is None
    plain = parts_with_span("今日は天気がいいです。", None, "blank")
    assert not any(p.get("blank") for p in plain)


def test_the_point_endpoint_serves_the_lesson_and_404s_an_unknown_id(client):
    entry = GRAMMAR_POINTS_BY_LEVEL["N4"][3]
    raw_id = grammar_to_id(entry, "N4")
    body = client.get("/api/grammar/point", params={"id": raw_id, "lang": "fr"}).json()
    assert body["raw_id"] == raw_id and body["level"] == "N4" and body["pattern"] == entry["pattern"]
    assert body["meaning"] == gloss(entry, "fr")
    assert body["steps"] == lesson_payload("N4", entry, "fr")["steps"]
    assert [ex["jp"] for ex in body["examples"]] == [ex["jp"] for ex in entry["examples"]]
    assert body["status"]["status"] in ("not_started", "new", "learning", "mastered", "due")
    for rival in body["compare"]:
        assert set(rival) == {"pattern", "raw_id", "level", "meaning", "text"}
    assert client.get("/api/grammar/point", params={"id": "grammar_N4_nope"}).status_code == 404


def test_the_points_endpoint_is_the_levels_index(client):
    body = client.get("/api/grammar/points", params={"level": "N2", "lang": "en"}).json()
    assert body["level"] == "N2"
    assert body["total"] == len(GRAMMAR_POINTS_BY_LEVEL["N2"]) == len(body["points"])
    assert body["learned"] + body["started"] <= body["total"]
    for point, entry in zip(body["points"], GRAMMAR_POINTS_BY_LEVEL["N2"]):
        assert point["raw_id"] == grammar_to_id(entry, "N2")
        assert point["meaning"] == gloss(entry, "en")
        assert point["stage"] in ("new", "learning", "mastered")
        assert point["rich"] == bool(entry.get("steps"))
    # the platforms' pools, so the station can hide an empty one
    for mode, total in body["totals"].items():
        assert total == card_index.total("grammar", "N2", mode)
    assert client.get("/api/grammar/points", params={"level": "N9"}).status_code == 404


def test_level_stats_are_sized_by_the_modes_own_pool(client):
    for mode in ("grammar.flashcard.f2b", "grammar.fill_in", "grammar.contrast"):
        body = client.get("/api/grammar/level-stats", params={"level": "N5", "mode": mode}).json()
        assert body["total"] == card_index.total("grammar", "N5", mode), mode
        assert body["new"] + body["learning"] + body["mastered"] == body["total"]
