"""The syllabary the app knows, and what can be looked up of it.

きゃ and えい are kana a learner meets in their first week — the yōon in
every ordinary word, the long vowels in せんせい and とうきょう — and
neither could be looked up in the dictionary at all: its two kana loops
walked the basic set and nothing else, so the catalogue was the gojūon
and the search found nothing for "kya". The long vowels did not exist
anywhere: not in the dictionary, not as a deck.

These pin the three halves of the fix — the registry, the decks it
serves, and the dictionary reading the whole syllabary through it.
"""

from content.kana_data import KANA_SETS, SYLLABARY_SETS, get_syllabary


def test_a_syllabary_is_its_gojuon_its_yoon_and_its_long_vowels():
    for script in ("hiragana", "katakana"):
        sets = SYLLABARY_SETS[script]
        assert sets == (f"{script}_basic", f"{script}_combos", f"{script}_long")
        # get_syllabary is those three, in that order, and nothing else.
        assert get_syllabary(script) == [
            entry for key in sets for entry in KANA_SETS[key]
        ]
    assert get_syllabary("klingon") == []


def test_the_long_vowels_are_pairs_a_reader_meets():
    hira = {e["kana"]: e["romaji"] for e in KANA_SETS["hiragana_long"]}
    # The five doubled vowels, the two long spellings that change kana,
    # and the two -i diphthongs every adjective ends in.
    assert hira == {
        "ああ": "aa", "あい": "ai", "いい": "ii", "うう": "uu",
        "えい": "ei", "ええ": "ee", "おい": "oi", "おう": "ou", "おお": "oo",
    }
    # Katakana spells them all with the one bar instead.
    assert {e["kana"] for e in KANA_SETS["katakana_long"]} == {"アー", "イー", "ウー", "エー", "オー"}
    # The romaji is the spelling, and its last letter is the column the
    # chart lays the pair in (frontend: vowelOf).
    for entry in KANA_SETS["hiragana_long"] + KANA_SETS["katakana_long"]:
        assert len(entry["romaji"]) == 2
        assert entry["romaji"][-1] in "aiueo"


def test_the_borrowed_sounds_are_one_row_per_base_kana():
    """外来音 grouped by base kana, not all together in one bucket."""
    rows = {}
    for entry in KANA_SETS["katakana_combos"]:
        if entry["group"].endswith("_foreign"):
            rows.setdefault(entry["group"], []).append(entry["kana"])
    assert rows == {
        "f_foreign":  ["ファ", "フィ", "フェ", "フォ"],
        "ti_foreign": ["ティ"],
        "tu_foreign": ["トゥ"],
        "di_foreign": ["ディ"],
        "du_foreign": ["ドゥ"],
        "w_foreign":  ["ウィ", "ウェ", "ウォ"],
        "v_foreign":  ["ヴァ", "ヴィ", "ヴ", "ヴェ", "ヴォ"],
    }
    # Every cell in a row starts with the same full-size kana, which is
    # what the chart heads the row with.
    for cells in rows.values():
        assert len({cell[0] for cell in cells}) == 1


def test_no_two_kana_of_a_group_want_the_same_column():
    """The invariant the chart is built on.

    A group is a row and the romaji's last letter is the column, so two
    entries of one group ending in the same vowel means one of them is
    dropped on the floor — silently, with no error anywhere. That is
    exactly what the single "foreign" group did: ファ took the a column
    and ヴァ never appeared.
    """
    for name, entries in KANA_SETS.items():
        by_group: dict[str, list[str]] = {}
        for entry in entries:
            by_group.setdefault(entry["group"], []).append(entry["romaji"])
        for group, romaji in by_group.items():
            # ん is the one kana that belongs to no column; the chart
            # gives it a 撥音 row of its own.
            columns = [r[-1] for r in romaji if r[-1] in "aiueo"]
            assert len(columns) == len(set(columns)), f"{name}/{group}: {romaji}"
            assert len(columns) == len(romaji) or group == "n_solo"


def test_every_set_is_a_deck_the_kana_route_serves(client):
    served = client.get("/api/kana/sets").json()["sets"]
    assert served == list(KANA_SETS)
    for key in ("hiragana_long", "katakana_long"):
        cards = client.get(f"/api/kana/cards?set_name={key}&mode=kana.flashcard.f2b")
        assert cards.status_code == 200, cards.text


def test_the_dictionary_holds_the_whole_syllabary(client):
    body = client.get("/api/dictionary", params={"category": "hiragana", "limit": 200}).json()
    kana = {r["kana"] for r in body["results"]}
    assert {"あ", "きゃ", "えい", "おう"} <= kana
    assert len(kana) == len(get_syllabary("hiragana"))

    # And each is findable by its romaji, which is how a learner who has
    # just read せんせい would come looking for it.
    for term, expected in (("kya", "きゃ"), ("ei", "えい")):
        found = client.get("/api/dictionary", params={"q": term, "category": "hiragana"}).json()
        assert expected in {r["kana"] for r in found["results"]}


def test_a_pair_gets_no_stroke_sheet_and_a_single_kana_still_does(client):
    body = client.get("/api/dictionary", params={"category": "hiragana", "limit": 200}).json()
    by_kana = {r["kana"]: r for r in body["results"]}
    # One character, one stroke file; two characters, none — rather than
    # an arbitrary half of one (routes/dictionary.py).
    assert by_kana["あ"]["svg_url"] == "/kanjivg/03042.svg"
    assert by_kana["えい"]["svg_url"] is None
    assert by_kana["きゃ"]["svg_url"] is None
