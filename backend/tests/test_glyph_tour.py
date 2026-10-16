"""
初見 (plan 216): a kana or a kanji met before it is drilled -- what it
reads, its strokes to trace and a few words it is met in, once per
character.
"""
from content.kana_data import KANA_SETS, kana_to_id
from content.kanji_data import DECK_BY_CHAR, KANJI_BY_LEVEL, kanji_to_id
from core.auth import DEV_USER_ID
from core.db import db_conn
from study.glyph_tour import KANJIVG_DIR, MAX_WORDS, known, strokes, tour_payload


# ── The strokes ───────────────────────────────────────────────

def test_the_strokes_are_kanjivg_s_in_writing_order():
    assert len(strokes("あ")) == 3
    assert len(strokes("日")) == 4
    # Dakuten are strokes of their own.
    assert len(strokes("が")) == 5
    # 語 nests its parts in groups; the order is the strokes' own numbers.
    assert len(strokes("語")) == 14
    assert all(d.startswith("M") for d in strokes("語"))
    # 日's first stroke is its left side, drawn down from the top.
    assert strokes("日")[0].startswith("M31.5,24.5")


def test_a_character_kanjivg_lacks_has_no_strokes():
    assert strokes("☃") == ()
    assert strokes("きゃ") == ()


# ── The payloads ──────────────────────────────────────────────

def test_a_kana_tour_reads_writes_and_uses_it():
    tour = tour_payload("kana_あ", "fr")
    assert tour["kind"] == "kana" and tour["glyph"] == "あ"
    assert (tour["romaji"], tour["sound"], tour["script"], tour["twin"]) == ("a", "a", "hiragana", "ア")
    assert len(tour["strokes"]) == 3
    assert 0 < len(tour["words"]) <= MAX_WORDS
    # A word is printed as it is read: its kana hold the glyph.
    assert all("あ" in w["kana"] and w["meaning"] for w in tour["words"])
    assert tour_payload("kana_ア", "fr")["script"] == "katakana"


def test_a_combination_has_no_tour():
    assert tour_payload("kana_きゃ", "fr") is None
    assert tour_payload("kana_ファ", "fr") is None


def test_a_kanji_tour_reads_writes_and_uses_it():
    fr = tour_payload("kanji_N5_日", "fr")
    en = tour_payload("kanji_N5_日", "en")
    assert fr["kind"] == "kanji" and fr["glyph"] == "日"
    assert fr["readings"] == DECK_BY_CHAR["日"][1]["kana"]
    assert en["meaning"].startswith("day") and fr["meaning"] != en["meaning"]
    assert len(fr["strokes"]) == 4
    # Simple words first: each at the kanji's own level where the level
    # has one, one reading each before a reading's second word.
    words = fr["words"]
    assert [w["kanji"] for w in words] == ["日曜日", "火曜日", "五日"]
    assert all("日" in w["kanji"] and w["furigana"] for w in words)


def test_a_kanji_s_words_are_distinct_as_written():
    level, _ = DECK_BY_CHAR["耗"]
    written = [w["kanji"] or w["kana"] for w in tour_payload(f"kanji_{level}_耗", "en")["words"]]
    assert len(written) == len(set(written))


def test_an_id_the_decks_do_not_know_has_no_tour():
    assert known("kana_あ") and known("kanji_N5_日")
    assert not known("kana_きゃ") and not known("kanji_N4_日") and not known("vocab_N5_日_ひ")
    assert tour_payload("kanji_N4_日", "fr") is None
    assert tour_payload("kanji_N5_nope", "fr") is None
    assert tour_payload("grammar_N5_は", "fr") is None
    assert tour_payload("vocab_N5_日_ひ", "fr") is None


def test_every_single_kana_and_every_deck_kanji_can_be_traced():
    for kana_list in KANA_SETS.values():
        for entry in kana_list:
            tour = tour_payload(kana_to_id(entry), "en")
            assert (tour is None) == (len(entry["kana"]) != 1), entry["kana"]
            if tour is not None:
                assert tour["strokes"], entry["kana"]
    for level, entries in KANJI_BY_LEVEL.items():
        for entry in entries:
            tour = tour_payload(kanji_to_id(entry, level), "en")
            assert tour is not None and tour["strokes"], entry["kanji"]
            assert len(tour["words"]) <= MAX_WORDS
            # Every stroke the file draws, none lost to the reading.
            svg = (KANJIVG_DIR / f"{ord(entry['kanji']):05x}.svg").read_text(encoding="utf-8")
            assert len(tour["strokes"]) == svg.count("<path"), entry["kanji"]


def test_a_payload_is_a_copy():
    tour = tour_payload("kana_あ", "en")
    tour["strokes"].clear()
    tour["words"][0]["kana"] = "x"
    again = tour_payload("kana_あ", "en")
    assert len(again["strokes"]) == 3 and again["words"][0]["kana"] != "x"


# ── The record ────────────────────────────────────────────────

def _wipe(*raw_ids):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for raw_id in raw_ids:
                card_id = f"{DEV_USER_ID}:{raw_id}"
                cur.execute("DELETE FROM glyph_tours WHERE user_id = %s AND card_id = %s", (DEV_USER_ID, raw_id))
                cur.execute("DELETE FROM card_modes WHERE card_id = %s", (card_id,))
                cur.execute("DELETE FROM review_log WHERE card_id = %s", (card_id,))
        conn.commit()
    finally:
        conn.close()


def test_the_terminus_records_the_first_tour_only(client):
    _wipe("kana_い")
    try:
        first = client.post("/api/glyph/tour", json={"raw_id": "kana_い", "misses": 3, "shown": True})
        assert first.status_code == 200 and first.json() == {"recorded": True}
        again = client.post("/api/glyph/tour", json={"raw_id": "kana_い", "misses": 0})
        assert again.json() == {"recorded": False}
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT misses, shown FROM glyph_tours WHERE user_id = %s AND card_id = %s",
                            (DEV_USER_ID, "kana_い"))
                assert cur.fetchall() == [(3, True)]
        finally:
            conn.close()
    finally:
        _wipe("kana_い")


def test_the_record_refuses_what_has_no_tour(client):
    assert client.post("/api/glyph/tour", json={"raw_id": "kana_きゃ", "misses": 0}).status_code == 404
    assert client.post("/api/glyph/tour", json={"raw_id": "grammar_N5_は", "misses": 0}).status_code == 404
    assert client.post("/api/glyph/tour", json={"raw_id": "kana_あ", "misses": -1}).status_code == 422
    assert client.post("/api/glyph/tour", json={"raw_id": "kana_あ", "misses": 1000}).status_code == 422
    assert client.post("/api/glyph/tour", json={"raw_id": "x" * 41, "misses": 0}).status_code == 422


# ── Who is due one ────────────────────────────────────────────

def _kana_card(client, mode, raw_id):
    cards = client.get(f"/api/kana/cards?set_name=hiragana_basic&mode={mode}&lang=fr&count=25"
                       f"&beyond_target=true").json()["cards"]
    return next((c for c in cards if c["card_id"] == raw_id), None)


def test_the_tutorial_is_due_once_per_kana_not_per_mode(client):
    _wipe("kana_あ")
    try:
        card = _kana_card(client, "kana.flashcard.f2b", "kana_あ")
        assert card is not None and card["tutorial"] is True
        assert card["glyph_tour"]["glyph"] == "あ" and len(card["glyph_tour"]["strokes"]) == 3
        assert client.post("/api/glyph/tour", json={"raw_id": "kana_あ", "misses": 0}).json() == {"recorded": True}
        # New on another platform, but toured: no tutorial, no payload.
        other = _kana_card(client, "kana.flashcard.b2f", "kana_あ")
        assert other is not None and other["stage"] == "new" and other["tutorial"] is False
        assert "glyph_tour" not in other
    finally:
        _wipe("kana_あ")


def test_a_kana_studied_before_the_tour_is_never_toured(client):
    _wipe("kana_あ")
    try:
        client.post("/api/kana/review", json={"card_id": "kana_あ", "mode": "kana.flashcard.b2f", "quality": 4})
        card = _kana_card(client, "kana.flashcard.f2b", "kana_あ")
        assert card is not None and card["stage"] == "new" and card["tutorial"] is False
    finally:
        _wipe("kana_あ")


def test_a_kanji_never_met_carries_its_tour_in_the_learner_s_language(client):
    first = client.get("/api/kanji/cards?level=N5&mode=kanji.flashcard.f2b&lang=en&count=25"
                       "&beyond_target=true").json()["cards"]
    new = [c for c in first if c["stage"] == "new"]
    assert new
    raw_id = new[0]["card_id"]
    _wipe(raw_id)
    try:
        cards = client.get("/api/kanji/cards?level=N5&mode=kanji.flashcard.f2b&lang=en&count=25"
                           "&beyond_target=true").json()["cards"]
        card = next(c for c in cards if c["card_id"] == raw_id)
        assert card["tutorial"] is True
        assert card["glyph_tour"] == tour_payload(raw_id, "en")
    finally:
        _wipe(raw_id)


def test_the_tour_is_erased_with_the_account():
    from routes.account import PLAN
    assert any(table == "glyph_tours" for table, _clause, _why in PLAN)


def test_the_frontend_s_fixture_is_the_payload_served():
    """frontend/src/testing/glyphTour.json is what the tour's browser
    tests draw: あ and 日 as this module serves them, in English."""
    import json
    from pathlib import Path
    fixture = Path(__file__).resolve().parents[2] / "frontend" / "src" / "testing" / "glyphTour.json"
    data = json.loads(fixture.read_text(encoding="utf-8"))
    assert data == {"kana": tour_payload("kana_あ", "en"), "kanji": tour_payload("kanji_N5_日", "en")}
