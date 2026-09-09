"""The dictionary's kanji collection, over both of its pools.

The app's own JLPT deck (content/kanji_data.py) is 2,235 entries over
2,212 characters. KANJIDIC2, which this repo has shipped all along, has
13,108 — so 10,896 characters were reachable from nowhere in the app,
and looking one up and not finding it proved only that it was not one of
the ~2,200 the course teaches.

They are one collection now, in one order: the whole deck first, N5 →
N1, then the pool by sort_rank. These pin the three things that order has
to survive — the seam between the pools, paging across it, and the totals
a client scrolls against — plus the two things a kanji has that a word
does not: a radical index, and a stroke diagram that may not exist.
"""

import content.kanji_pool_data as kanji_db
from content.kanji_data import KANJI_BY_LEVEL, DECK_BY_CHAR

DECK_TOTAL = sum(len(entries) for entries in KANJI_BY_LEVEL.values())


def _page(client, **params):
    return client.get("/api/dictionary", params={"category": "kanji", **params}).json()


def _key(entry):
    return (entry["level"], entry["kanji"])


def test_the_collection_is_the_deck_and_the_pool_together():
    """The two halves are disjoint by construction — the pool is served
    as `in_deck = 0`, and in_deck is set from this very deck when the
    database is built — so the merged collection is exactly their sum
    with nothing counted twice. Guarding it here because a database
    rebuilt against a different deck would otherwise show a character on
    two rows and be noticed by nothing."""
    assert not any(kanji_db.get(char)["in_deck"] == 0 for char in DECK_BY_CHAR)
    pool, _ = kanji_db.search("", limit=13108, offset=0)
    assert not any(row["char"] in DECK_BY_CHAR for row in pool)
    assert len(pool) == kanji_db.count() - len(DECK_BY_CHAR)


def test_an_unfiltered_browse_totals_both_pools(client):
    body = _page(client, limit=5)
    assert body["total"] == DECK_TOTAL + kanji_db.count_matching("")
    assert body["has_more"] is True
    # The deck comes first, and it comes in deck order: N5 first.
    assert [r["level"] for r in body["results"]] == ["N5"] * 5


def test_the_deck_runs_out_before_the_pool_begins(client):
    """The seam. One page wide enough to straddle it: the last of the
    deck, then the pool — and the pool's first character is its
    commonest, not whatever sat at the front of the KANJIDIC2 dump."""
    limit = 20
    page = DECK_TOTAL // limit
    results = _page(client, limit=limit, page=page)["results"]

    levels = [r["level"] for r in results]
    deck_part = levels[:DECK_TOTAL % limit]
    pool_part = levels[DECK_TOTAL % limit:]
    assert deck_part and all(level is not None for level in deck_part)
    assert pool_part and all(level is None for level in pool_part)

    # A pool character carries no JLPT level but is otherwise a kanji
    # entry like any other — same type, same fields the catalogue reads.
    first_pool = results[len(deck_part)]
    assert first_pool["type"] == "kanji"
    # sort_rank orders the whole table, deck characters included, so the
    # pool's own first row is not rank 0 — it is whatever the pool's
    # lowest rank happens to be. Ask the pool rather than assume.
    assert first_pool["kanji"] == kanji_db.search("", limit=1, offset=0)[0][0]["char"]


def test_the_pool_half_is_ordered_by_sort_rank(client):
    ranks = [
        kanji_db.get(r["kanji"])["sort_rank"]
        for r in _page(client, limit=30, page=DECK_TOTAL // 30)["results"]
        if r["level"] is None
    ]
    assert ranks == sorted(ranks)


def test_paging_across_the_seam_neither_skips_nor_repeats(client):
    """The page a client actually scrolls onto is built from two sources
    with two different offsets — the deck sliced in Python, the pool
    offset in SQL. Walk the same span at several page sizes: an
    off-by-one in that arithmetic drops a character or serves one twice,
    and only a comparison like this would show it."""
    start = (DECK_TOTAL // 20) * 20          # a page boundary just before the seam
    span = 60

    runs = {}
    for limit in (2, 4, 5, 10, 20):
        first = start // limit
        runs[limit] = [
            _key(r)
            for p in range(first, first + span // limit)
            for r in _page(client, limit=limit, page=p)["results"]
        ]

    reference = runs[20]
    assert len(reference) == span
    assert len(set(reference)) == span           # nothing served twice
    assert all(run == reference for run in runs.values())  # same order at every size


def test_a_search_answers_from_the_deck_first_then_the_pool(client):
    """"dragon" is a deck meaning (竜) and a pool one (龍, 虬, 蛟).
    Both halves answer, and the levelled characters a course actually
    teaches come first."""
    body = _page(client, q="dragon", limit=60, lang="en")
    levels = [r["level"] for r in body["results"]]
    assert any(level is not None for level in levels)
    assert any(level is None for level in levels)
    # No deck character after the first pool one: the halves never interleave.
    assert levels == sorted(levels, key=lambda level: level is None)


def test_a_character_the_deck_never_taught_is_findable_at_all(client):
    """The whole point. 龍 is in KANJIDIC2 and not in the deck, so before
    the merge this query answered with nothing."""
    body = _page(client, q="龍", limit=5)
    assert [r["kanji"] for r in body["results"]] == ["龍"]
    entry = body["results"][0]
    assert entry["level"] is None
    assert entry["radical"] == 212
    assert entry["stroke_count"] == 16
    assert "dragon" in entry["meaning"]


def test_the_last_page_reports_no_more(client):
    total = _page(client, limit=1)["total"]
    last = _page(client, limit=50, page=(total - 1) // 50)
    assert last["has_more"] is False
    assert 0 < len(last["results"]) <= 50

    past_the_end = _page(client, limit=50, page=total // 50 + 5)
    assert past_the_end["results"] == []
    assert past_the_end["has_more"] is False


def test_the_cross_collection_browse_stays_curated(client):
    """category="all" merges its sources in memory before slicing, which
    the 13k-row pool cannot join without undoing the reason that pool
    lives in SQLite. So "all" keeps serving the curated deck alone —
    every kanji entry it returns is levelled."""
    body = client.get("/api/dictionary", params={"q": "dragon", "limit": 200, "lang": "en"}).json()
    kanji = [r for r in body["results"] if r["type"] == "kanji"]
    assert kanji
    assert all(r["level"] for r in kanji)


# ── What a kanji has that a word does not ─────────────────────

def test_every_radical_leads_somewhere_now(client):
    """The tiles were scoped to the deck, so 20 of the 214 classical
    radicals had no tile at all. Every one of them files a KANJIDIC2
    character, so every one of them is now offered."""
    groups = client.get("/api/dictionary/radicals").json()["groups"]
    tiles = [r for g in groups for r in g["radicals"]]
    assert len(tiles) == 214
    assert all(t["kanji_count"] > 0 for t in tiles)
    assert sum(t["kanji_count"] for t in tiles) == kanji_db.count()


def test_a_radical_browse_reaches_the_pool_in_stroke_order(client):
    """Radical browsing is filed the way a paper 漢和辞典 files it — by
    stroke count, deck and pool interleaved — not deck-first. It is also
    keyed by character, so the 23 kanji the deck teaches at two levels
    appear once here rather than twice."""
    body = client.get(
        "/api/dictionary", params={"radical": 75, "limit": 200}).json()
    strokes = [r["stroke_count"] for r in body["results"]]
    assert strokes == sorted(strokes)
    assert any(r["level"] is None for r in body["results"])   # the pool is reached
    assert any(r["level"] is not None for r in body["results"])
    chars = [r["kanji"] for r in body["results"]]
    assert len(chars) == len(set(chars))


def test_a_pool_character_with_no_stroke_diagram_serves_no_url(client):
    """KanjiVG covers 6,416 of the 13,108 — the deck at 100%, the pool at
    4,204 of 10,896 — so a missing sheet is a case the kanji branch never
    had to handle before. It takes the answer the kana branch already
    gives a digraph: svg_url null, and DictionaryDetail's `hasSheet`
    draws the plate without one."""
    body = _page(client, q="鑫", limit=5)
    entry = next(r for r in body["results"] if r["kanji"] == "鑫")
    assert entry["svg_url"] is None
    assert entry["stroke_count"] == 24            # the plate still has figures
    assert entry["radical"] == 167

    deck_entry = _page(client, q="日", limit=5)["results"][0]
    assert deck_entry["svg_url"] == "/kanjivg/065e5.svg"


def test_a_pool_character_carries_no_srs_card(client):
    """This merge adds no card ids: a pool character is lookupable, not
    studiable. `status` is null rather than a fabricated "not_started",
    and the catalogue tile reads that as no stage at all
    (DictionaryScreen's stageOf(entry.status?.status))."""
    pool = next(r for r in _page(client, q="龍", limit=5)["results"])
    assert pool["status"] is None

    deck = _page(client, q="日", limit=5)["results"][0]
    assert deck["status"]["status"] == "not_started"


def test_a_pool_character_still_files_its_deck_words(client):
    """322 pool characters appear inside deck VOCABULARY words. 繋 is one:
    its ledger is grouped under つな.ぐ from the readings the database row
    already carries, not left unfiled."""
    entry = next(r for r in _page(client, q="繋", limit=5)["results"] if r["kanji"] == "繋")
    filed = [r for r in entry["readings"] if r["words"]]
    assert filed and filed[0]["reading"] == "つな.ぐ"
    assert "繋ぐ" in [w["kanji"] for w in entry["vocab_examples"]]


# ── The tables that were reclaimed ────────────────────────────
# Six eager json.load()s became bounded queries (see kanji_pool_data's
# MEMORY NOTE). Each of these pins the property that made the swap safe:
# the table still answers for every character its callers ask about.

def test_the_french_map_still_covers_the_deck_it_always_covered():
    """KANJI_FR was a comprehension over all 10,384 characters with a
    French entry; it is the deck's 2,212 now, resolved in one query.
    Every caller passes it to translations.get_meaning() for a DECK
    entry, and routes/translations.py already built its ENGLISH
    counterpart from the deck alone — the French map was the odd one
    out. The 219 characters KANJIDIC2 has no French for are still
    absent, so get_meaning()'s fallback to English still fires."""
    from content.kanji_meanings import KANJI_FR

    assert set(KANJI_FR) <= set(DECK_BY_CHAR)
    missing = set(DECK_BY_CHAR) - set(KANJI_FR)
    assert len(missing) == 219
    assert "蒼" in missing                       # a documented gap
    assert KANJI_FR["土"] == "sol; terre; terrain; Turquie"


def test_the_radical_table_answers_for_characters_outside_the_deck():
    """KANJI_RADICALS is deck-scoped now, but radical_for() is the
    accessor and it falls through to the database — so a personal card
    written around an obscure character resolves its radical exactly as
    it did when all 13,108 rows were in memory."""
    from content.radical_data import KANJI_RADICALS, radical_for

    assert set(KANJI_RADICALS) == set(DECK_BY_CHAR)
    assert radical_for("語") == {"number": 149, "char": "言", "stroke_count": 7}
    assert radical_for("龍")["number"] == 212     # not in the deck
    assert radical_for("Z") is None
    assert radical_for("") is None


def test_the_exam_distractor_tables_still_cover_every_deck_character():
    """study/exam_kanji_gen.py loaded 3.8 MB of KANJIDIC2 to build two
    indexes it then restricted to the characters in the app's own vocab
    deck. Two bounded queries now. The property that makes that
    identical: every character either table can be asked about is one it
    has an answer for, or one KANJIDIC2 has no answer for either."""
    import study.exam_kanji_gen as gen

    resolvable = {c for c in gen._DECK_CHARS if kanji_db.get(c)}
    assert set(gen.KANJI_RADICALS) == {
        c for c in resolvable if kanji_db.get(c)["radical"]
    }
    assert set(gen.KANJI_READINGS) == resolvable
    assert gen.KANJI_READINGS["日"]["ja_on"] == ["ニチ", "ジツ"]
    # The distractor pool is keyed on radicals the deck actually uses.
    assert len(gen.RADICAL_INDEX) == 194


def test_the_pool_is_searched_on_the_meaning_it_shows(client):
    """The deck matches a query against get_meaning()'s output — French
    where KANJIDIC2 has one, English otherwise. The pool has to match the
    same string, not every column the database happens to store: 璽 is
    "emperor's seal" in English and "sceau impérial" in French, so
    "sceau" must answer in a French session and not in an English one.
    Searching both columns regardless of language would make a
    French-only term find pool characters and no deck ones — the exact
    half-answer merging the collections was meant to end."""
    fr = _page(client, q="sceau", lang="fr", limit=200)
    assert "璽" in [r["kanji"] for r in fr["results"]]
    # ...and it is in the POOL half: the deck answers "sceau" too (印, 判),
    # and those come first, which is the order the whole merge is about.
    assert next(r for r in fr["results"] if r["kanji"] == "璽")["level"] is None

    en = _page(client, q="sceau", lang="en", limit=200)
    assert "璽" not in [r["kanji"] for r in en["results"]]
    # A word that survives the fallback answers in both: 璽 has no French
    # for "seal", so the French session is shown the English and finds it.
    assert _page(client, q="dragon", lang="fr", limit=60)["total"] == \
           _page(client, q="dragon", lang="en", limit=60)["total"]
