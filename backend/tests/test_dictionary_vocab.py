"""The dictionary's vocabulary collection, over both of its pools.

The curated JLPT deck (content/vocab_data.py) and the rest of JMdict
(content/vocab_jmdict_data.py) used to be two collections side by side:
"vocab" and "jmdict". Searching the first and finding nothing proved
only that you had looked in the smaller one — 8,405 words against
212,460 — so a learner had to already know the second collection
existed before they could conclude a word was not in the app at all.

They are one collection now, in one order: the whole deck first, N5 →
N1, then the pool by frequency rank. These pin the three things that
order has to survive — the seam between the pools, paging across it,
and the totals a client scrolls against.
"""

import content.vocab_jmdict_data as jmdict_db
from content.vocab_data import VOCAB_BY_LEVEL

DECK_TOTAL = sum(len(words) for words in VOCAB_BY_LEVEL.values())


def _page(client, **params):
    return client.get("/api/dictionary", params={"category": "vocab", **params}).json()


def _key(entry):
    return (entry["level"], entry["kanji"], entry["kana"])


def test_the_collection_is_the_deck_and_the_pool_together():
    """The two pools are disjoint by construction — the JMdict one is
    built as "every term/reading pair NOT already in the deck" — so the
    merged collection is exactly their sum, with nothing counted twice.
    Guarding it here because a pool rebuilt without that exclusion would
    otherwise show a word on two rows and be noticed by nothing."""
    deck_keys = {
        (w.get("kanji", ""), w.get("kana", ""))
        for words in VOCAB_BY_LEVEL.values() for w in words
    }
    assert not any(jmdict_db.get_by_key(k, r) for k, r in deck_keys)


def test_an_unfiltered_browse_totals_both_pools(client):
    body = _page(client, limit=5)
    assert body["total"] == DECK_TOTAL + jmdict_db.count()
    assert body["has_more"] is True
    # The deck comes first, and it comes in deck order: N5 first.
    assert [r["level"] for r in body["results"]] == ["N5"] * 5


def test_the_deck_runs_out_before_the_pool_begins(client):
    """The seam. One page wide enough to straddle it: the last of the
    deck, then the pool — and the pool's first word is its commonest,
    not whatever sat at the front of the JMdict dump."""
    limit = 20
    page = DECK_TOTAL // limit
    results = _page(client, limit=limit, page=page)["results"]

    levels = [r["level"] for r in results]
    deck_part = levels[:DECK_TOTAL % limit]
    pool_part = levels[DECK_TOTAL % limit:]
    assert deck_part and all(level is not None for level in deck_part)
    assert pool_part and all(level is None for level in pool_part)

    # A pool word carries no JLPT level but is otherwise a vocab entry
    # like any other — same type, same fields the catalogue reads.
    first_pool = results[len(deck_part)]
    assert first_pool["type"] == "vocab"
    assert jmdict_db.get_by_key(first_pool["kanji"], first_pool["kana"])["freq_rank"] == 0


def test_the_pool_half_is_ordered_by_frequency(client):
    ranks = [
        jmdict_db.get_by_key(r["kanji"], r["kana"])["freq_rank"]
        for r in _page(client, limit=30, page=DECK_TOTAL // 30)["results"]
        if r["level"] is None
    ]
    assert ranks == sorted(ranks)


def test_paging_across_the_seam_neither_skips_nor_repeats(client):
    """The page a client actually scrolls onto is built from two
    sources with two different offsets — the deck sliced in Python, the
    pool offset in SQL. Walk the same span at several page sizes: an
    off-by-one in that arithmetic drops a word or serves one twice, and
    only a comparison like this would show it."""
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
    """水 is in the deck (水, 水曜日, ...) and all over the pool. Both
    halves answer, and the levelled words a course actually teaches
    come first."""
    body = _page(client, q="水", limit=60)
    levels = [r["level"] for r in body["results"]]
    assert any(level is not None for level in levels)
    assert any(level is None for level in levels)
    # No deck word after the first pool word: the two halves never interleave.
    assert levels == sorted(levels, key=lambda level: level is None)
    assert body["total"] > len(body["results"])


def test_the_last_page_reports_no_more(client):
    total = _page(client, limit=1)["total"]
    last = _page(client, limit=50, page=(total - 1) // 50)
    assert last["has_more"] is False
    assert 0 < len(last["results"]) <= 50

    past_the_end = _page(client, limit=50, page=total // 50 + 5)
    assert past_the_end["results"] == []
    assert past_the_end["has_more"] is False


def test_jmdict_is_still_accepted_as_a_name_for_the_collection(client):
    """It named a collection of its own until the two merged. A client
    still holding the old console — or a bookmarked URL — should land on
    the merged list rather than on an empty one."""
    assert _page(client, q="水", limit=5) == client.get(
        "/api/dictionary", params={"category": "jmdict", "q": "水", "limit": 5}
    ).json()


def test_the_cross_collection_browse_stays_curated(client):
    """category="all" merges its sources in memory before slicing, which
    the 212k-row pool cannot join without undoing the reason that pool
    lives in SQLite. So "all" keeps serving the curated deck alone —
    every vocab entry it returns is levelled."""
    body = client.get("/api/dictionary", params={"q": "水", "limit": 200}).json()
    vocab = [r for r in body["results"] if r["type"] == "vocab"]
    assert vocab
    assert all(r["level"] for r in vocab)
