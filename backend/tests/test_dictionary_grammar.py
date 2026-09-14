"""The dictionary's grammar collection.

The 355 curated points (content/grammar_points.json) used to be
reachable only by studying them on the 文法 line; the dictionary now
serves them as a collection of their own — N5 → N1, searchable over
the pattern, the structure and the gloss, with the two hand-written
example sentences and the learner's record on each. These pin the
order, the paging, the `level` narrowing, and the `id` disambiguator
(the same "front of page 0, never a filter" contract `kana` has for a
word — see test_dictionary_vocab.py).
"""

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, grammar_to_id

LEVELS = ("N5", "N4", "N3", "N2", "N1")
TOTAL = sum(len(GRAMMAR_POINTS_BY_LEVEL[lvl]) for lvl in LEVELS)
FIELDS = {"type", "raw_id", "level", "pattern", "structure", "meaning", "examples", "status"}


def _page(client, **params):
    return client.get("/api/dictionary", params={"category": "grammar", **params}).json()


def test_an_unfiltered_browse_is_the_whole_catalogue_n5_first(client):
    body = _page(client, limit=5)
    assert body["total"] == TOTAL
    assert body["has_more"] is True
    assert [r["level"] for r in body["results"]] == ["N5"] * 5
    for r in body["results"]:
        assert r["type"] == "grammar"
        assert set(r) == FIELDS


def test_paging_walks_every_point_once_in_level_order(client):
    """Across the seams between levels: nothing skipped, nothing twice,
    and the levels never go backwards."""
    limit = 40
    seen, levels = [], []
    page = 0
    while True:
        body = _page(client, limit=limit, page=page)
        seen += [r["raw_id"] for r in body["results"]]
        levels += [r["level"] for r in body["results"]]
        if not body["has_more"]:
            break
        page += 1
    assert len(seen) == TOTAL
    assert len(set(seen)) == TOTAL
    ranks = [LEVELS.index(lvl) for lvl in levels]
    assert ranks == sorted(ranks)


def test_ids_are_the_lines_own_card_ids(client):
    """The id on a row is what the SRS keys the point by, so the record
    on the row and the record on the study card are one record. And it
    never carries a colon — core.auth splits the prefixed id on one."""
    results = _page(client, limit=200)["results"]
    expected = {grammar_to_id(e, "N5") for e in GRAMMAR_POINTS_BY_LEVEL["N5"]}
    assert {r["raw_id"] for r in results if r["level"] == "N5"} == expected
    assert not any(":" in r["raw_id"] for r in results)


def test_level_narrows_and_an_unknown_level_does_not(client):
    n3 = _page(client, level="N3", limit=200)
    assert n3["total"] == len(GRAMMAR_POINTS_BY_LEVEL["N3"])
    assert {r["level"] for r in n3["results"]} == {"N3"}
    # Narrowing to a level nobody has is not an empty page: it is the
    # whole catalogue, the way an unknown reading leaves a word page alone.
    assert _page(client, level="N9", limit=5)["total"] == TOTAL


def test_search_matches_the_pattern_as_typed_and_the_gloss_folded(client):
    hit = _page(client, q="です", limit=200)
    patterns = [r["pattern"] for r in hit["results"]]
    assert "です／だ" in patterns
    for r in hit["results"]:
        assert ("です" in r["pattern"]
                or "です" in r["structure"].lower()
                or "です" in r["meaning"].lower())

    folded = _page(client, q="COPULA", limit=200)
    assert "です／だ" in [r["pattern"] for r in folded["results"]]

    none = _page(client, q="zzzzqqq")
    assert none["results"] == [] and none["total"] == 0 and none["has_more"] is False


def test_every_point_carries_its_two_sentences_with_furigana(client):
    """Each example is the sentence over its translation, with the
    furigana parts whose text reads back to the sentence itself — the
    contract FuriganaParts renders against. Holds with or without the
    tokenizer installed: align_sentence degrades to one part."""
    results = _page(client, limit=50)["results"]
    for r in results:
        assert len(r["examples"]) == 2
        for ex in r["examples"]:
            assert ex["jp"] and ex["en"]
            assert "".join(p["text"] for p in ex["furigana"]) == ex["jp"]


def test_id_moves_the_point_to_the_front_of_page_0_and_filters_nothing(client):
    entry = GRAMMAR_POINTS_BY_LEVEL["N1"][5]
    raw_id = grammar_to_id(entry, "N1")

    body = _page(client, id=raw_id, limit=10)
    assert body["results"][0]["raw_id"] == raw_id
    assert body["results"][0]["pattern"] == entry["pattern"]
    assert body["total"] == TOTAL
    assert body["has_more"] is True
    assert [r["raw_id"] for r in body["results"]].count(raw_id) == 1
    assert len(body["results"]) == 10

    # Even when the page's own narrowing would never have shown it: the
    # caller has the exact entry in hand and gets it back.
    narrowed = _page(client, id=raw_id, level="N5", limit=10)
    assert narrowed["results"][0]["raw_id"] == raw_id
    assert narrowed["results"][1]["level"] == "N5"
    assert narrowed["total"] == len(GRAMMAR_POINTS_BY_LEVEL["N5"])


def test_id_touches_neither_later_pages_nor_the_page_for_an_unknown_id(client):
    entry = GRAMMAR_POINTS_BY_LEVEL["N1"][5]
    raw_id = grammar_to_id(entry, "N1")

    plain = _page(client, limit=10, page=1)
    with_id = _page(client, id=raw_id, limit=10, page=1)
    assert [r["raw_id"] for r in with_id["results"]] == [r["raw_id"] for r in plain["results"]]

    unknown = _page(client, id="grammar_N5_nope", limit=10)
    assert "error" not in unknown
    assert [r["raw_id"] for r in unknown["results"]] == [r["raw_id"] for r in _page(client, limit=10)["results"]]


def test_the_learners_record_rides_on_every_row(client):
    results = _page(client, limit=5)["results"]
    for r in results:
        status = r["status"]
        assert status["status"] in ("not_started", "new", "learning", "mastered", "due")
        assert "total_reviews" in status and "accuracy" in status


def test_the_all_browse_does_not_gain_grammar(client):
    """"all" stays the curated cross-collection browse it was — kanji,
    the JLPT deck, kana. Grammar is a collection you choose."""
    body = client.get("/api/dictionary", params={"q": "です", "limit": 200}).json()
    assert not any(r["type"] == "grammar" for r in body["results"])
