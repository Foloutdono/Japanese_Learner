# ── The entry panel's rework (plan 089) ───────────────────────────
# The dictionary's detail panel gained three things it had no data for,
# and this is the data half of them:
#
#   * a ＋ that writes the entry into one of the learner's decks, on all
#     four kinds of entry rather than on a grammar point alone, and a
#     "review this card" beside the reader's own record. `app_card` is
#     the one field both read — never inferred from raw_id, which a pool
#     entry carries without having an app card behind it;
#   * the characters a word is written with, each with the reading it
#     takes in that word and its own gloss, so they can be ledger rows
#     rather than bare tiles;
#   * a kana's stroke count and its opposite-script twin, which is what
#     the form block was one figure short of;
#   * the radical as a glyph and a name rather than a filing number.
#
# Plus the queue the panel's "review this card" boards: /api/today/cards
# with `only`, one card and every mode it is due in.
#
# The deck type kana needed to be mined into at all is exercised end to
# end at the bottom: browse, add, study.
from datetime import datetime, timedelta, timezone

import pytest

from core.db import db_conn
from main import app
from routes.profile import get_user_id
from study import card_index

EUID = "entry-panel-test-user"


def _get(client, **params):
    r = client.get("/api/dictionary", params={"limit": 40, **params})
    assert r.status_code == 200
    return r.json()["results"]


def _one(client, term, category, pick=lambda e: True):
    rows = [e for e in _get(client, q=term, category=category) if pick(e)]
    assert rows, f"no {category} row for {term!r}"
    return rows[0]


# ── The ＋ ────────────────────────────────────────────────────────
def test_a_deck_word_carries_what_the_plus_needs(client):
    row = _one(client, "毎月", "vocab", lambda e: e["kanji"] == "毎月")
    assert row["app_card"] == {"source": "vocab", "level": row["level"], "raw_id": row["app_card"]["raw_id"]}
    assert row["level"] is not None
    # The ref must resolve to a real app entry, or the write adds nothing.
    assert card_index.entry_for("vocab", row["app_card"]["raw_id"]) is not None


def test_a_pool_word_carries_the_card_a_vocab_deck_takes(client):
    # Plan 147: a JMdict-only word is a card a vocab deck takes -- its
    # raw id, no level (the pool has none), and `pool`, which keeps
    # "review this card" off it (the queue serves it only through a deck
    # it is in). The ref must resolve, or the ＋ would add nothing.
    from routes.decks import _linked_entry

    pool = [e for e in _get(client, q="nostalgia", category="vocab") if e["level"] is None]
    assert pool, "expected at least one pool word"
    for e in pool:
        card = e["app_card"]
        assert card["source"] == "vocab" and card["level"] is None and card["pool"] is True
        assert card["raw_id"].startswith("vocab_jmdict_")
        entry = _linked_entry("vocab", None, card["raw_id"])
        assert (entry["kanji"], entry["kana"]) == (e["kanji"], e["kana"])


def test_a_deck_kanji_names_its_radical(client):
    row = _one(client, "土", "kanji", lambda e: e["kanji"] == "土")
    assert row["radical"] == 32
    # #32 is a filing code; 土 read つち is what a learner can use.
    assert row["radical_glyph"] == "土"
    assert row["radical_name"] == "つち"
    assert row["app_card"]["source"] == "kanji"


def test_a_pool_kanji_has_no_app_card(client):
    pool = [e for e in _get(client, category="kanji", q="lattice") if e["level"] is None]
    assert pool, "expected at least one pool character"
    for e in pool:
        assert e["app_card"] is None


def test_a_grammar_point_carries_an_app_card(client):
    row = _get(client, category="grammar", level="N5")[0]
    assert row["app_card"] == {"source": "grammar", "level": "N5", "raw_id": row["raw_id"]}


# ── The characters a word is written with ──────────────────────────
def test_a_word_names_the_kanji_it_is_written_with(client):
    row = _one(client, "毎月", "vocab", lambda e: e["kanji"] == "毎月")
    assert [(p["char"], p["reading"]) for p in row["kanji_parts"]] == [
        ("毎", "まい"), ("月", "げつ"),
    ]
    # A gloss each, or the row is a bare tile again.
    assert all(p["meaning"] for p in row["kanji_parts"])


def test_a_character_the_aligner_cannot_isolate_keeps_its_row(client):
    # 今朝 is read けさ as a whole (熟字訓): no slice of it is 今's, so
    # the aligner keeps it one run and neither half can be given a
    # reading. The row still prints -- the door it opens is the point --
    # with no reading rather than an invented one. (This was 生活 until
    # the aligner learned to drop the する the deck packed onto its
    # reading, せいかつ・する, which was the only thing stopping it; the
    # deck no longer packs it either.)
    row = _one(client, "今朝", "vocab", lambda e: e["kanji"] == "今朝")
    assert [p["char"] for p in row["kanji_parts"]] == ["今", "朝"]
    assert all(p["reading"] is None for p in row["kanji_parts"])


def test_a_reading_without_residue_lights_each_kanji(client):
    row = _one(client, "生活", "vocab", lambda e: e["kanji"] == "生活")
    assert [(p["char"], p["reading"]) for p in row["kanji_parts"]] == [("生", "せい"), ("活", "かつ")]


def test_a_kana_only_word_is_written_with_no_kanji(client):
    row = _one(client, "テレビ", "vocab", lambda e: e["kana"] == "テレビ")
    assert row["kanji_parts"] == []


def test_a_repeated_character_is_one_row(client):
    row = _one(client, "時時", "vocab", lambda e: e["kanji"] == "時時")
    assert [p["char"] for p in row["kanji_parts"]] == ["時"]


def test_the_iteration_mark_is_not_a_door(client):
    # 々 stands for the character before it and has no entry of its own,
    # so it is not one of the characters the word is written WITH.
    row = _one(client, "人々", "vocab", lambda e: e["kanji"] == "人々")
    assert [p["char"] for p in row["kanji_parts"]] == ["人"]


# ── The kana's own two facts ──────────────────────────────────────
def test_a_kana_carries_its_strokes_its_twin_and_its_set(client):
    row = _one(client, "ア", "katakana", lambda e: e["kana"] == "ア")
    assert row["stroke_count"] == 2
    assert row["twin"] == "あ"
    # The deck key is the set, never the "Katakana" label the catalogue
    # groups by: the card builder draws its distractors from the set.
    assert row["level"] == "Katakana"
    assert row["app_card"] == {"source": "kana", "level": "katakana_basic",
                           "raw_id": "kana_ア"}


def test_a_two_character_kana_has_no_sheet_and_no_count(client):
    # A stroke diagram is one character's, so きゃ gets neither — the
    # panel already draws that case, and the count has to agree with it.
    row = _one(client, "きゃ", "hiragana", lambda e: e["kana"] == "きゃ")
    assert row["svg_url"] is None
    assert row["stroke_count"] is None
    assert row["twin"] == "キャ"


def test_a_kana_with_no_one_to_one_twin_says_so(client):
    # えい is written エー in katakana, not えい + 0x60. A twin the panel
    # cannot vouch for is a door onto the wrong entry.
    row = _one(client, "えい", "hiragana", lambda e: e["kana"] == "えい")
    assert row["twin"] is None


# ── The deck a kana can now go into ───────────────────────────────
def _wipe(user_id: str) -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM cards WHERE id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM deck_cards WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM custom_cards WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM decks WHERE user_id = %s", (user_id,))
        conn.commit()
    finally:
        conn.close()


@pytest.fixture()
def eclient(client):
    _wipe(EUID)
    app.dependency_overrides[get_user_id] = lambda: EUID
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_user_id, None)
        _wipe(EUID)


def _deck(client, name, deck_type):
    r = client.post("/api/decks", json={"name": name, "type": deck_type})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_a_kana_deck_takes_an_app_kana_and_studies_it(eclient):
    deck_id = _deck(eclient, "かな", "kana")

    added = eclient.post(f"/api/decks/{deck_id}/cards/app", json={
        "cards": [{"source": "kana", "level": "katakana_basic", "raw_id": "kana_ア"}],
    })
    assert added.status_code == 200, added.text
    assert added.json()["added"] == 1

    listed = eclient.get(f"/api/decks/{deck_id}/cards").json()["cards"]
    assert [(c["origin"], c["front"], c["back"]) for c in listed] == [("app", "ア", "a")]

    modes = eclient.get(f"/api/decks/{deck_id}/modes").json()["modes"]
    assert set(modes) >= {"kana.flashcard.f2b", "kana.write_romaji"}

    cards = eclient.get(f"/api/decks/{deck_id}/study",
                        params={"mode": "kana.flashcard.f2b", "count": 5}).json()["cards"]
    # One card in the deck, so the batch is that card however long it is.
    assert {(c["kana"], c["romaji"]) for c in cards} == {("ア", "a")}


def test_a_kana_deck_takes_a_written_card_too(eclient):
    deck_id = _deck(eclient, "かな", "kana")
    r = eclient.post(f"/api/decks/{deck_id}/cards",
                     json={"fields": {"kana": "ヴ", "romaji": "vu"}})
    assert r.status_code == 200, r.text

    cards = eclient.get(f"/api/decks/{deck_id}/study",
                        params={"mode": "kana.flashcard.f2b", "count": 5}).json()["cards"]
    # A personal card's payload carries both halves where every kana
    # renderer reads them, not only as front/back.
    assert {(c["kana"], c["romaji"]) for c in cards} == {("ヴ", "vu")}


def test_a_kana_card_needs_both_halves(eclient):
    deck_id = _deck(eclient, "かな", "kana")
    r = eclient.post(f"/api/decks/{deck_id}/cards", json={"fields": {"kana": "ヴ"}})
    assert r.status_code == 400


# ── The queue "review this card" boards ───────────────────────────
def _make_due(user_id: str, raw_id: str, modes: tuple[str, ...]) -> None:
    """One card, due now, in each of `modes`."""
    past = datetime.now(timezone.utc) - timedelta(days=1)
    card_id = f"{user_id}:{raw_id}"
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO cards (id) VALUES (%s) ON CONFLICT DO NOTHING", (card_id,))
            for mode in modes:
                cur.execute("""
                    INSERT INTO card_modes (card_id, mode, interval_days, difficulty,
                                            stability, repetitions, is_learning,
                                            learning_step, total_reviews,
                                            correct_reviews, next_review)
                    VALUES (%s, %s, 10, 2.5, 10, 3, FALSE, 0, 3, 3, %s)
                    ON CONFLICT (card_id, mode) DO UPDATE SET next_review = EXCLUDED.next_review
                """, (card_id, mode, past))
        conn.commit()
    finally:
        conn.close()


def test_only_serves_one_card_in_every_mode_it_is_due_in(eclient):
    mine, other = card_index.raw_ids("kanji", "N5", "kanji.flashcard.f2b")[:2]
    _make_due(EUID, mine, ("kanji.flashcard.f2b", "kanji.write_kanji"))
    _make_due(EUID, other, ("kanji.flashcard.f2b",))

    whole = eclient.get("/api/today/cards", params={"count": 20}).json()["cards"]
    assert {c["card_id"] for c in whole} == {mine, other}

    one = eclient.get("/api/today/cards", params={"count": 20, "only": mine}).json()["cards"]
    assert {c["card_id"] for c in one} == {mine}
    # Clearing a card means answering it in every mode it is due in.
    assert sorted(c["mode"] for c in one) == ["kanji.flashcard.f2b", "kanji.write_kanji"]


def test_only_naming_nothing_due_serves_nothing(eclient):
    mine = card_index.raw_ids("kanji", "N5", "kanji.flashcard.f2b")[0]
    _make_due(EUID, mine, ("kanji.flashcard.f2b",))
    body = eclient.get("/api/today/cards", params={"only": "kanji_N5_notakanji"}).json()
    assert body["cards"] == []
