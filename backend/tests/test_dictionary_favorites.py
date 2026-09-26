"""お気に入り — the dictionary's shelf of kept entries (routes/favorites.py,
plan 093).

A favourite is a REFERENCE (a kind and the key its collection files the
entry under), resolved back into the catalogue's own row when the shelf
is read. These pin the four things that has to survive: every kind of
entry the catalogue serves round-trips through the shelf as the same
entry; the shelf is one learner's and nobody else's; keeping and
dropping are idempotent; and a reference nothing answers any more is
skipped rather than served broken.
"""

import pytest

from content.kanji_data import KANJI_BY_LEVEL
from content.vocab_data import VOCAB_BY_LEVEL
from core.auth import DEV_USER_ID
from core.db import db_conn
from routes import favorites
from tests.conftest import OTHER_USER, acting_as

DECK_KANJI_TOTAL = sum(len(rows) for rows in KANJI_BY_LEVEL.values())
DECK_VOCAB_TOTAL = sum(len(rows) for rows in VOCAB_BY_LEVEL.values())


def _wipe(*users):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for user in users:
                cur.execute("DELETE FROM dictionary_favorites WHERE user_id = %s", (user,))
        conn.commit()
    finally:
        conn.close()


@pytest.fixture(autouse=True)
def clean_shelf():
    _wipe(DEV_USER_ID, OTHER_USER)
    yield
    _wipe(DEV_USER_ID, OTHER_USER)


def _keep(client, kind, key, favorite=True):
    return client.put("/api/dictionary/favorites",
                      json={"kind": kind, "key": key, "favorite": favorite})


def _keys(client):
    body = client.get("/api/dictionary/favorites/keys").json()
    return [(f["kind"], f["key"]) for f in body["favorites"]]


def _shelf(client, **params):
    return client.get("/api/dictionary/favorites", params=params).json()


def _catalogue(client, **params):
    return client.get("/api/dictionary", params=params).json()["results"]


# ── The rows the catalogue serves, one of each kind ───────────

def _first_past_deck(client, category, deck_total, limit=50):
    """The first POOL row of a collection — a kanji or a word the deck
    does not teach, which the catalogue serves after the deck with no
    level. Read through the endpoint so the test knows nothing about
    how the pool is stored."""
    page = deck_total // limit
    while True:
        rows = _catalogue(client, category=category, page=page, limit=limit, lang="en")
        assert rows, f"ran out of {category} rows looking for the pool"
        for row in rows:
            if row["level"] is None:
                return row
        page += 1


def test_shelf_starts_empty(client):
    assert _keys(client) == []
    body = _shelf(client)
    assert body["results"] == [] and body["total"] == 0 and body["has_more"] is False


def test_keep_and_drop_are_idempotent(client):
    r = _keep(client, "kanji", "駅")
    assert r.status_code == 200
    assert r.json() == {"kind": "kanji", "key": "駅", "favorite": True, "total": 1}
    # Keeping what is kept is the state asked for, not an error.
    assert _keep(client, "kanji", "駅").json()["total"] == 1
    assert _keys(client) == [("kanji", "駅")]

    r = _keep(client, "kanji", "駅", favorite=False)
    assert r.json() == {"kind": "kanji", "key": "駅", "favorite": False, "total": 0}
    assert _keep(client, "kanji", "駅", favorite=False).json()["total"] == 0
    assert _keys(client) == []


def test_keys_come_newest_first(client):
    _keep(client, "hiragana", "あ")
    _keep(client, "katakana", "ア")
    _keep(client, "kanji", "駅")
    assert _keys(client) == [("kanji", "駅"), ("katakana", "ア"), ("hiragana", "あ")]


def test_every_kind_round_trips_as_the_catalogue_row(client):
    deck_kanji = _catalogue(client, category="kanji", level="N5", lang="en")[0]
    pool_kanji = _first_past_deck(client, "kanji", DECK_KANJI_TOTAL)
    deck_word = _catalogue(client, category="vocab", level="N5", lang="en")[0]
    pool_word = _first_past_deck(client, "vocab", DECK_VOCAB_TOTAL)
    point = _catalogue(client, category="grammar", lang="en")[0]

    # The key the frontend derives from a served row (domain/favorites.js).
    refs = [
        ("kanji", deck_kanji["kanji"], deck_kanji),
        ("kanji", pool_kanji["kanji"], pool_kanji),
        ("vocab", f"{deck_word['kanji']}::{deck_word['kana']}", deck_word),
        ("vocab", f"{pool_word['kanji']}::{pool_word['kana']}", pool_word),
        ("grammar", point["raw_id"], point),
        ("hiragana", "あ", None),
        ("katakana", "ア", None),
    ]
    for kind, key, _row in refs:
        assert _keep(client, kind, key).status_code == 200

    body = _shelf(client, lang="en")
    assert body["total"] == len(refs)
    assert len(body["results"]) == len(refs)

    # Newest first, so the list reads back reversed — and each row is
    # the catalogue's own: same identity, same shape.
    served = list(reversed(body["results"]))
    for (kind, key, row), got in zip(refs, served):
        assert got["type"] == kind
        if kind in ("hiragana", "katakana"):
            assert got["kana"] == key
            assert got["romaji"] == "a"
            assert got["app_card"]["source"] == "kana"
            continue
        assert got["kanji" if kind != "grammar" else "raw_id"] == row["kanji" if kind != "grammar" else "raw_id"]
        assert got["level"] == row["level"]
        assert got["meaning"] == row["meaning"]
        assert (got["app_card"] is None) == (row["app_card"] is None)

    # The pool halves are served as the catalogue serves them: a pool
    # character has no card behind it, and a pool word has the one a
    # vocab deck takes since plan 144 -- its id, no level, `pool`.
    pool_rows = {r["type"]: r for r in body["results"] if r["level"] is None}
    assert set(pool_rows) == {"kanji", "vocab"}
    assert pool_rows["kanji"]["app_card"] is None
    assert pool_rows["vocab"]["app_card"]["pool"] is True
    assert pool_rows["vocab"]["app_card"]["level"] is None


def test_a_packed_deck_reading_still_resolves(client):
    """A deck word can list several readings in one field
    ("まいげつ/まいつき"); the key stores the field as served, and the
    shelf reads it back to the same word."""
    packed = next(
        (w for rows in VOCAB_BY_LEVEL.values() for w in rows if "/" in w.get("kana", "")),
        None,
    )
    if packed is None:
        pytest.skip("no packed reading in the deck")
    _keep(client, "vocab", f"{packed.get('kanji', '')}::{packed['kana']}")
    rows = _shelf(client, lang="en")["results"]
    assert len(rows) == 1
    assert rows[0]["kanji"] == packed.get("kanji", "")
    assert rows[0]["kana"] == packed["kana"]


def test_a_kana_only_word_is_keyed_on_its_reading_alone(client):
    word = next(
        w for rows in VOCAB_BY_LEVEL.values() for w in rows
        if not w.get("kanji") and "/" not in w.get("kana", "")
    )
    _keep(client, "vocab", f"::{word['kana']}")
    rows = _shelf(client, lang="en")["results"]
    assert len(rows) == 1
    assert rows[0]["kanji"] == "" and rows[0]["kana"] == word["kana"]


def test_a_reference_nothing_answers_is_skipped_and_kept(client):
    _keep(client, "kanji", "駅")
    _keep(client, "grammar", "grammar_N9_〜retired")
    _keep(client, "vocab", "not-a-vocab-key")
    _keep(client, "hiragana", "駅")
    body = _shelf(client, lang="en")
    # `total` counts the references; the rows are only what resolves.
    assert body["total"] == 4
    assert [r["kanji"] for r in body["results"]] == ["駅"]
    # Left in place: a deck correction may bring the entry back, and a
    # row nobody sees costs nothing.
    assert len(_keys(client)) == 4


def test_pages_walk_the_shelf_newest_first(client):
    for kana in "あいう":
        _keep(client, "hiragana", kana)
    first = _shelf(client, limit=2, page=0, lang="en")
    second = _shelf(client, limit=2, page=1, lang="en")
    assert [r["kana"] for r in first["results"]] == ["う", "い"]
    assert first["has_more"] is True and first["total"] == 3
    assert [r["kana"] for r in second["results"]] == ["あ"]
    assert second["has_more"] is False


def test_bad_references_are_refused(client):
    assert _keep(client, "radical", "水").status_code == 422
    assert _keep(client, "kanji", "").status_code == 422
    assert _keep(client, "kanji", "   ").status_code == 422
    assert _keep(client, "kanji", "駅" * (favorites.MAX_KEY + 1)).status_code == 422
    assert _keys(client) == []


def test_the_shelf_is_full_at_the_cap(client, monkeypatch):
    monkeypatch.setattr(favorites, "MAX_FAVORITES", 2)
    assert _keep(client, "hiragana", "あ").status_code == 200
    assert _keep(client, "hiragana", "い").status_code == 200
    r = _keep(client, "hiragana", "う")
    assert r.status_code == 409
    assert r.json()["detail"] == "favorites_full"
    # What is already kept stays keepable at the cap, and dropping
    # always works.
    assert _keep(client, "hiragana", "あ").status_code == 200
    assert _keep(client, "hiragana", "あ", favorite=False).json()["total"] == 1
    assert _keep(client, "hiragana", "う").status_code == 200


def test_the_shelf_is_one_learners_own(client):
    _keep(client, "kanji", "駅")
    with acting_as(OTHER_USER):
        assert _keys(client) == []
        _keep(client, "hiragana", "あ")
        assert _keys(client) == [("hiragana", "あ")]
        # Dropping a reference the other learner holds is a no-op here.
        assert _keep(client, "kanji", "駅", favorite=False).json()["total"] == 1
    assert _keys(client) == [("kanji", "駅")]
