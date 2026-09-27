# ── A written grammar card, taught like the catalogue's ──────────
# A grammar deck's card carries the catalogue's shape (study/structures.py):
# formation, register, the three lesson steps, translated sentences and
# rivals. These hold the API end: what a card saves, the lesson its study
# payload carries, fill_in's translation, the contrast drill it cannot be
# served, and the batch the import dialog posts.
import pytest

from core.db import db_conn
from main import app
from routes.profile import get_user_id

GUID = "grammar-cards-test-user"

CARD = {
    "rule": "〜せいで", "meaning": "à cause de", "structure": "nom + の + せいで",
    "register": "neutral", "explanation": "Une cause **négative**.",
    "usage": "- Reproches", "careful": "Pour une cause positive, おかげで.",
    "sentences": [{"jp": "雨のせいで中止になった。", "tr": "À cause de la pluie, c'est annulé."}],
    "compare": [{"pattern": "〜おかげで", "text": "cause heureuse"}],
}


def _wipe(user_id: str) -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM cards WHERE id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM custom_cards WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM decks WHERE user_id = %s", (user_id,))
        conn.commit()
    finally:
        conn.close()


@pytest.fixture()
def gclient(client):
    _wipe(GUID)
    app.dependency_overrides[get_user_id] = lambda: GUID
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_user_id, None)
        _wipe(GUID)


def _deck(client, deck_type="grammar"):
    r = client.post("/api/decks", json={"name": "文法", "type": deck_type})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _study(client, deck_id, mode):
    r = client.get(f"/api/decks/{deck_id}/study", params={"mode": mode, "count": 5})
    assert r.status_code == 200, r.text
    return r.json()["cards"]


def test_a_card_keeps_its_whole_lesson(gclient):
    deck_id = _deck(gclient)
    r = gclient.post(f"/api/decks/{deck_id}/cards", json={"fields": CARD, "notes": "n"})
    assert r.status_code == 200, r.text
    assert r.json()["fields"] == CARD

    (card,) = _study(gclient, deck_id, "grammar.flashcard.f2b")
    lesson = card["lesson"]
    assert (lesson["pattern"], lesson["structure"], lesson["register"]) == ("〜せいで", "nom + の + せいで", "neutral")
    assert [s["kind"] for s in lesson["steps"]] == ["rule", "use", "careful"]
    assert lesson["examples"][0]["tr"] == "À cause de la pluie, c'est annulé."
    assert lesson["compare"] == [{"pattern": "〜おかげで", "text": "cause heureuse"}]


def test_a_written_card_is_read_like_the_catalogues(gclient):
    """The rule and the formation carry furigana: a rule that is a
    catalogue point, its reading; the card and its lesson alike."""
    deck_id = _deck(gclient)
    fields = {"rule": "~の中で", "meaning": "among", "structure": "group + の中で"}
    assert gclient.post(f"/api/decks/{deck_id}/cards", json={"fields": fields}).status_code == 200
    (card,) = _study(gclient, deck_id, "grammar.flashcard.f2b")
    assert card["grammar_furigana"] == [{"text": "~の"}, {"text": "中", "reading": "なか"}, {"text": "で"}]
    assert card["lesson"]["pattern_furigana"] == card["grammar_furigana"]
    assert "".join(p["text"] for p in card["structure_furigana"]) == "group + の中で"
    assert card["lesson"]["structure_furigana"] == card["structure_furigana"]


def test_fill_in_carries_the_sentences_translation(gclient):
    deck_id = _deck(gclient)
    gclient.post(f"/api/decks/{deck_id}/cards", json={"fields": CARD})
    (card,) = _study(gclient, deck_id, "grammar.fill_in")
    assert card["fill_sentence"]["jp"] == "雨のせいで中止になった。"
    assert card["fill_sentence"]["tr"] == "À cause de la pluie, c'est annulé."


def test_a_card_from_before_translations_still_studies(gclient):
    deck_id = _deck(gclient)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM decks WHERE user_id = %s", (GUID,))
            (deck_pk,) = cur.fetchone()
            cur.execute("""
                INSERT INTO custom_cards (deck_id, user_id, structure, fields)
                VALUES (%s, %s, 'grammar', %s)
            """, (deck_pk, GUID, '{"rule": "〜せいで", "meaning": "m", "sentences": ["雨のせいで中止になった。"]}'))
        conn.commit()
    finally:
        conn.close()
    (card,) = _study(gclient, deck_id, "grammar.fill_in")
    assert card["fill_sentence"]["jp"] == "雨のせいで中止になった。"
    assert "tr" not in card["fill_sentence"]
    assert card["lesson"]["examples"][0]["tr"] == ""


def test_a_written_card_is_never_served_the_contrast_drill(gclient):
    deck_id = _deck(gclient)
    gclient.post(f"/api/decks/{deck_id}/cards", json={"fields": CARD})
    assert _study(gclient, deck_id, "grammar.contrast") == []


def test_the_batch_lands_what_is_whole_and_reports_the_rest(gclient):
    deck_id = _deck(gclient)
    r = gclient.post(f"/api/decks/{deck_id}/cards/batch", json={"cards": [
        {"fields": CARD, "notes": " kept "},
        {"fields": {"rule": "〜ために"}},
        {"fields": {"rule": "〜ながら", "meaning": "tout en", "sentences": ["歩きながら話す。"]}},
    ]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["inserted"] == 2
    assert body["errors"] == [{"index": 1, "missing": ["meaning"]}]
    assert [c["front"] for c in body["cards"]] == ["〜せいで", "〜ながら"]
    assert body["cards"][0]["notes"] == "kept"

    listed = gclient.get(f"/api/decks/{deck_id}/cards").json()["cards"]
    assert len(listed) == 2


def test_the_batch_takes_the_decks_structure(gclient):
    deck_id = _deck(gclient, "vocab")
    r = gclient.post(f"/api/decks/{deck_id}/cards/batch", json={"cards": [
        {"fields": {"word": "水", "meaning": "eau", "reading": "みず"}},
        {"front": "水", "back": "eau"},
    ]})
    body = r.json()
    assert body["inserted"] == 1
    assert body["errors"] == [{"index": 1, "missing": ["word", "meaning"]}]
