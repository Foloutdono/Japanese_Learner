# -*- coding: utf-8 -*-
"""
The dictionary answers what a beginner actually types.

Before study/search_match.py the predicate was, in five places:

    q in entry["kanji"] or q in entry["kana"] or q.lower() in meaning.lower()

which answers for a reader who can type Japanese, spells with the
accents, thinks vocabulary in whichever language the session is set to,
and never makes a mistake. This file is the four things that were not
true of a beginner, and the level filter that came with them.

The unit half (`to_kana`, `fold`, `corrections`) is here rather than in
a module of its own because it exists for this endpoint, and the only
way to tell the transliterator is right is to look up a word with it.
"""
import pytest

from content.kanji_data import KANJI_BY_LEVEL
from content.vocab_data import VOCAB_BY_LEVEL
from study.search_match import corrections, fold, lexicon, parse, to_kana


def _page(client, **params):
    r = client.get("/api/dictionary", params=params)
    assert r.status_code == 200
    return r.json()


def _surfaces(body):
    return [e.get("kanji") or e.get("kana") or e.get("pattern") for e in body["results"]]


# ── The transliterator ────────────────────────────────────────


@pytest.mark.parametrize("romaji, kana", [
    ("mizu", "みず"),
    ("nihongo", "にほんご"),
    ("terebi", "てれび"),          # …and テレビ, which is what finds the word
    ("gakkou", "がっこう"),         # 促音 from the doubled consonant
    ("kitte", "きって"),
    ("kanji", "かんじ"),            # ん before a consonant
    ("sannen", "さんねん"),         # …and the second n starting a syllable
    ("shinbun", "しんぶん"),
    ("ryokou", "りょこう"),         # 拗音
    ("chiisai", "ちいさい"),
    ("tiisai", "ちいさい"),         # kunrei, which is a spelling and not an error
    ("tsukue", "つくえ"),
    ("tukue", "つくえ"),
    ("huben", "ふべん"),
    ("fuben", "ふべん"),
])
def test_romaji_becomes_the_kana_it_spells(romaji, kana):
    hira, kata = to_kana(romaji)
    assert hira == kana
    # Both scripts, always: nothing in the letters says which one the
    # word is written in, and テレビ is only findable as the second.
    assert len(kata) == len(hira)
    assert kata != hira


@pytest.mark.parametrize("not_romaji", [
    "水",        # already Japanese
    "a",         # one letter — every "a" in a gloss would become あ
    "",
    "xyzq",      # letters the table cannot finish reading
    "mizu1",
    "hello world",
])
def test_what_is_not_romaji_stays_out_of_it(not_romaji):
    assert to_kana(not_romaji) == ()


def test_folding_is_case_and_accents():
    assert fold("ÉLÈVE") == fold("eleve") == "eleve"
    assert fold("  Water ") == "water"


# ── The typo ──────────────────────────────────────────────────


def test_a_correction_is_one_edit_away_and_is_a_real_word():
    lex = lexicon(["water; hot water", "montagne", "receive", "eat"])
    # A transposition is ONE typo, which is why the distance is Damerau
    # and not plain Levenshtein — at a tolerance of 1, the commonest
    # mistake there is would otherwise be the one kind never corrected.
    assert corrections("watre", lex) == ["water"]
    assert corrections("recieve", lex) == ["receive"]
    assert corrections("montagen", lex) == ["montagne"]
    # Nothing near enough, and nothing short enough to guess at: "eat"
    # is three letters, where one edit reaches a different word.
    assert corrections("eta", lex) == []
    assert corrections("zzzzzz", lex) == []


def test_a_correction_is_never_to_a_word_the_catalogue_lacks():
    # The lexicon is the collection's own glosses, not a spell-checker's
    # word list: a correction to a word this catalogue does not hold
    # sends the learner to a second empty page.
    assert corrections("wayer", lexicon(["montagne", "receive"])) == []


# ── Romaji, end to end ────────────────────────────────────────


def test_romaji_finds_the_word_it_spells(client):
    water = _page(client, category="vocab", q="mizu", lang="fr", limit=50)
    assert water["total"] > 0
    assert "水" in _surfaces(water)
    # The curated deck sorts first, so the word a course teaches is the
    # first answer and not the 400th.
    assert water["results"][0]["kanji"] == "水"

    # A katakana word is only reachable through the second script.
    tv = _page(client, category="vocab", q="terebi", lang="fr", limit=50)
    assert "テレビ" in _surfaces(tv)


def test_romaji_finds_a_kanji_by_its_reading(client):
    body = _page(client, category="kanji", q="yama", lang="fr", limit=50)
    assert "山" in _surfaces(body)


def test_a_japanese_query_is_untouched(client):
    body = _page(client, category="kanji", q="水", lang="fr", limit=50)
    assert _surfaces(body) == ["水"]
    assert body["corrected"] is None


def test_a_kanji_query_still_reaches_the_pool_it_is_written_with(client):
    """The regression the romaji work shipped and this caught.

    The kana a romaji query spells are READINGS and belong against a
    reading column; the raw query may be a KANJI and belongs against a
    kanji column too. Folding the two together searched 水 in the kana
    column alone, and every JMdict word written with that character —
    the pool half of the collection — vanished from the answer while
    the deck half went on looking correct.
    """
    body = _page(client, category="vocab", q="水", lang="fr", limit=60)
    levels = [e["level"] for e in body["results"]]
    assert any(lv is not None for lv in levels), "the deck half answers"
    assert any(lv is None for lv in levels), "and so does the pool half"


# ── Both languages ────────────────────────────────────────────


def test_a_term_answers_in_either_language(client):
    """The gloss on screen follows the session; which entries there are
    does not. A learner thinks vocabulary in whichever language taught
    it to them, and the app has two."""
    for lang in ("fr", "en"):
        by_en = _page(client, category="vocab", q="water", lang=lang, limit=50)
        by_fr = _page(client, category="vocab", q="eau", lang=lang, limit=50)
        assert "水" in _surfaces(by_en), lang
        assert "水" in _surfaces(by_fr), lang

    # Same query, same collection, whichever language is displayed.
    assert _page(client, category="vocab", q="eau", lang="fr", limit=5)["total"] == \
           _page(client, category="vocab", q="eau", lang="en", limit=5)["total"]


# ── Accents ───────────────────────────────────────────────────


def test_an_accent_is_not_required_to_find_an_accented_gloss(client):
    """é is two keys away on most keyboards and absent from some. The
    curated decks are filtered in Python, which is where the app's own
    French lives, so this is where folding can apply."""
    bare = _page(client, category="vocab", q="eleve", lang="fr", limit=50)
    assert "生徒" in _surfaces(bare)
    assert set(_surfaces(_page(client, category="vocab", q="élève", lang="fr", limit=50))) \
        <= set(_surfaces(bare))


# ── Typos, end to end ─────────────────────────────────────────


def test_a_typo_is_answered_and_said_so(client):
    typed = _page(client, category="vocab", q="watre", lang="en", limit=50)
    assert typed["total"] > 0
    assert "水" in _surfaces(typed)
    # And the screen is told which question it got an answer to. A page
    # of results for a word nobody typed, with nothing to explain it, is
    # a dictionary that looks like it cannot spell.
    assert typed["corrected"] == "water"
    # The correction is the whole query from there: the count is the
    # corrected word's, not a blend of the two.
    assert typed["total"] == _page(client, category="vocab", q="water", lang="en", limit=50)["total"]


def test_a_query_that_finds_something_is_never_corrected(client):
    """A correction that fires while there are real results is not a
    kindness — it is the search quietly answering a different
    question."""
    for category, q in [("vocab", "water"), ("kanji", "mountain"), ("grammar", "the")]:
        body = _page(client, category=category, q=q, limit=20)
        assert body["total"] > 0, (category, q)
        assert body["corrected"] is None, (category, q)


def test_a_query_beyond_correcting_stays_empty(client):
    body = _page(client, category="vocab", q="zzqqzzqq", lang="fr", limit=20)
    assert body["total"] == 0
    assert body["corrected"] is None


def test_the_kanji_and_grammar_collections_correct_too(client):
    kanji = _page(client, category="kanji", q="montagen", lang="fr", limit=20)
    assert kanji["corrected"] == "montagne"
    assert "山" in _surfaces(kanji)


# ── The level ─────────────────────────────────────────────────


@pytest.mark.parametrize("category, by_level", [
    ("kanji", KANJI_BY_LEVEL),
    ("vocab", VOCAB_BY_LEVEL),
])
def test_a_level_narrows_to_the_deck_it_names(client, category, by_level):
    """A JLPT level is a fact about the course. The KANJIDIC and JMdict
    pools behind these two collections carry none — that is why their
    tiles draw no badge — so a levelled request is a DECK request and
    the pool is not asked at all."""
    everything = _page(client, category=category, q="", lang="fr", limit=20)
    n5 = _page(client, category=category, q="", lang="fr", limit=20, level="N5")

    # The count is the deck's own at that level, exactly.
    assert n5["total"] == len(by_level["N5"])
    assert n5["total"] < everything["total"]
    assert [e["level"] for e in n5["results"]] == ["N5"] * len(n5["results"])
    assert n5["results"], "a level with no page is not a filter, it is a wall"


def test_a_level_and_a_query_narrow_together(client):
    narrowed = _page(client, category="vocab", q="eau", lang="fr", limit=50, level="N5")
    wide = _page(client, category="vocab", q="eau", lang="fr", limit=50)
    assert 0 < narrowed["total"] < wide["total"]
    assert all(e["level"] == "N5" for e in narrowed["results"])
    assert "水" in _surfaces(narrowed)


def test_a_level_narrows_a_romaji_query_too(client):
    body = _page(client, category="vocab", q="mizu", lang="fr", limit=50, level="N5")
    assert "水" in _surfaces(body)
    assert all(e["level"] == "N5" for e in body["results"])


def test_an_unknown_level_is_every_level(client):
    """The client narrowed; it did not ask a trick question. Same rule
    the grammar collection has always taken."""
    for category in ("kanji", "vocab", "grammar"):
        assert _page(client, category=category, q="", limit=5, level="N9")["total"] == \
               _page(client, category=category, q="", limit=5)["total"], category


def test_the_level_does_not_reach_the_radical_index(client):
    """The radical index is served whole, deck and pool in stroke order
    the way a paper 漢和辞典 files it (routes/dictionary.py). A level
    would have to cut the pool half out of a list whose whole point is
    that it is the complete one; the console hides the chips there for
    the same reason."""
    assert _page(client, category="kanji", q="", limit=20, radical=85, level="N5")["total"] == \
           _page(client, category="kanji", q="", limit=20, radical=85)["total"]


# ── The empty query, which is the browse and must not move ────


def test_browsing_is_what_it_was(client):
    for category in ("kanji", "vocab", "grammar", "hiragana", "katakana"):
        body = _page(client, category=category, q="", lang="fr", limit=10)
        assert body["results"], category
        assert body["corrected"] is None, category
        assert parse("").empty
