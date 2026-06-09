import random
import csv
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from auth import get_user_id
from db import db_conn
from srs_instance import srs
from vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from kanji_data import KANJI_BY_LEVEL, kanji_to_id
from translations import get_meaning
from translations.fr.vocab_fr import VOCAB_FR as VOCAB_FR_MAP
from translations.fr.kanji_fr import KANJI_FR as KANJI_FR_MAP
import psycopg2.extras

router = APIRouter()


class DeckPayload(BaseModel):
    name: str
    type: str


class CardPayload(BaseModel):
    front: str
    back:  str
    kana:  str = ""
    hint:  str = ""
    notes: str = ""


class ReviewPayload(BaseModel):
    card_id: str
    mode:    str
    quality: int


# ── DECK CRUD ─────────────────────────────────────────────

@router.get("/api/decks")
def get_decks(user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT d.id, d.name, d.type, d.created_at,
                       COUNT(c.id) AS card_count
                FROM decks d
                LEFT JOIN custom_cards c ON c.deck_id = d.id
                WHERE d.user_id = %s
                GROUP BY d.id
                ORDER BY d.created_at DESC
            """, (user_id,))
            decks = [dict(row) for row in cur.fetchall()]
        return {"decks": decks}
    finally:
        conn.close()


@router.post("/api/decks")
def create_deck(payload: DeckPayload, user_id: str = Depends(get_user_id)):
    if payload.type not in ("flashcard", "vocab", "kanji"):
        raise HTTPException(status_code=400, detail="Invalid deck type")
    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO decks (user_id, name, type)
                VALUES (%s, %s, %s)
                RETURNING id, name, type, created_at
            """, (user_id, payload.name, payload.type))
            deck = dict(cur.fetchone())
        conn.commit()
        return deck
    finally:
        conn.close()


@router.delete("/api/decks/{deck_id}")
def delete_deck(deck_id: str, user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM decks WHERE id = %s AND user_id = %s",
                (deck_id, user_id)
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Deck not found")
        conn.commit()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id FROM custom_cards WHERE deck_id = %s AND user_id = %s", (deck_id, user_id))
            keys = [f"{user_id}:custom_{deck_id}_{row['id']}" for row in cur.fetchall()]
        srs.delete_cards(keys)
        return {"ok": True}
    finally:
        conn.close()


# ── CARD CRUD ─────────────────────────────────────────────

@router.get("/api/decks/{deck_id}/cards")
def get_cards(deck_id: str, user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, front, back, kana, hint, notes, created_at
                FROM custom_cards
                WHERE deck_id = %s AND user_id = %s
                ORDER BY created_at ASC
            """, (deck_id, user_id))
            cards = [dict(row) for row in cur.fetchall()]
        return {"cards": cards}
    finally:
        conn.close()


@router.post("/api/decks/{deck_id}/cards")
def add_card(deck_id: str, payload: CardPayload, user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id FROM decks WHERE id = %s AND user_id = %s", (deck_id, user_id))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Deck not found")
            cur.execute("""
                INSERT INTO custom_cards (deck_id, user_id, front, back, kana, hint, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, front, back, kana, hint, notes, created_at
            """, (deck_id, user_id, payload.front, payload.back,
                  payload.kana, payload.hint, payload.notes))
            card = dict(cur.fetchone())
        conn.commit()
        return card
    finally:
        conn.close()


@router.put("/api/decks/{deck_id}/cards/{card_id}")
def update_card(deck_id: str, card_id: str, payload: CardPayload,
                user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                UPDATE custom_cards
                SET front = %s, back = %s, kana = %s, hint = %s, notes = %s
                WHERE id = %s AND deck_id = %s AND user_id = %s
                RETURNING id, front, back, kana, hint, notes
            """, (payload.front, payload.back, payload.kana, payload.hint,
                  payload.notes, card_id, deck_id, user_id))
            card = cur.fetchone()
            if not card:
                raise HTTPException(status_code=404, detail="Card not found")
        conn.commit()
        return dict(card)
    finally:
        conn.close()


@router.delete("/api/decks/{deck_id}/cards/{card_id}")
def delete_card(deck_id: str, card_id: str, user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                DELETE FROM custom_cards
                WHERE id = %s AND deck_id = %s AND user_id = %s
            """, (card_id, deck_id, user_id))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Card not found")
        conn.commit()
        key = f"{user_id}:custom_{deck_id}_{card_id}"
        srs.delete_cards([key])
        return {"ok": True}
    finally:
        conn.close()


# ── STUDY ─────────────────────────────────────────────────

@router.get("/api/decks/{deck_id}/study")
def get_study_card(deck_id: str, mode: str = "flashcard",
                   mix_levels: str = "", lang: str = "fr",
                   user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT type FROM decks WHERE id = %s AND user_id = %s",
                       (deck_id, user_id))
            deck = cur.fetchone()
            if not deck:
                raise HTTPException(status_code=404, detail="Deck not found")
            cur.execute("""
                SELECT id, front, back, kana, hint, notes
                FROM custom_cards WHERE deck_id = %s AND user_id = %s
            """, (deck_id, user_id))
            custom_cards = [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()

    deck_type = deck["type"]
    pool      = []

    for c in custom_cards:
        cid = f"{user_id}:custom_{deck_id}_{c['id']}"
        pool.append({"card_id": cid, "source": "custom", "data": c})

    if mix_levels:
        levels    = [l.strip() for l in mix_levels.split(",") if l.strip()]
        phase_key = {"flashcard": "kk-s", "phase1": "kk-s",
                     "phase2": "k-k", "phase3": "s-k"}.get(mode, "kk-s")

        if deck_type == "vocab":
            for level in levels:
                for w in VOCAB_BY_LEVEL.get(level, []):
                    cid = f"{user_id}:{vocab_to_id(w, level)}"
                    pool.append({"card_id": cid, "source": "builtin_vocab",
                                 "data": w, "level": level, "phase_key": phase_key})
        elif deck_type == "kanji":
            for level in levels:
                for k in KANJI_BY_LEVEL.get(level, []):
                    cid = f"{user_id}:{kanji_to_id(k, level)}"
                    pool.append({"card_id": cid, "source": "builtin_kanji",
                                 "data": k, "level": level, "phase_key": phase_key})

    if not pool:
        return {"done": True}

    all_ids = [p["card_id"] for p in pool]
    due = [cid for cid in srs.get_due_cards(mode) if cid in set(all_ids)]
    if due:
        card_id = random.choice(due)
    else:
        new = [cid for cid in srs.get_new_cards(mode, limit=1) if cid in set(all_ids)]
        if new:
            card_id = new[0]
        else:
            return {"done": True}

    entry = next(p for p in pool if p["card_id"] == card_id)
    d     = entry["data"]

    if entry["source"] == "custom":
        return {
            "card_id":   card_id, "source": "custom",
            "front":     d["front"], "back": d["back"],
            "kana":      d.get("kana", ""), "hint": d.get("hint", ""),
            "notes":     d.get("notes", ""), "mode": mode,
            "deck_type": deck_type,
        }

    elif entry["source"] == "builtin_vocab":
        meaning      = get_meaning(d, lang, VOCAB_FR_MAP)
        all_meanings = [
            get_meaning(w, lang, VOCAB_FR_MAP)
            for w in VOCAB_BY_LEVEL.get(entry["level"], [])
            if get_meaning(w, lang, VOCAB_FR_MAP) != meaning
        ]
        choices = random.sample(all_meanings, min(3, len(all_meanings))) + [meaning]
        random.shuffle(choices)
        return {
            "card_id":   card_id, "source": "builtin_vocab",
            "front":     d.get("kanji", ""), "back": meaning,
            "kana":      d.get("kana", ""), "choices": choices,
            "phase_key": entry["phase_key"], "mode": mode,
            "deck_type": deck_type,
        }

    elif entry["source"] == "builtin_kanji":
        meaning      = get_meaning(d, lang, KANJI_FR_MAP)
        all_meanings = [
            get_meaning(k, lang, KANJI_FR_MAP)
            for k in KANJI_BY_LEVEL.get(entry["level"], [])
            if get_meaning(k, lang, KANJI_FR_MAP) != meaning
        ]
        choices   = random.sample(all_meanings, min(3, len(all_meanings))) + [meaning]
        codepoint = hex(ord(d["kanji"]))[2:].zfill(5)
        random.shuffle(choices)
        return {
            "card_id":      card_id, "source": "builtin_kanji",
            "front":        d.get("kanji", ""), "back": meaning,
            "kana":         d.get("kana", ""), "choices": choices,
            "stroke_count": d.get("stroke_count", ""),
            "svg_url":      f"/kanjivg/{codepoint}.svg",
            "phase_key":    entry["phase_key"], "mode": mode,
            "deck_type":    deck_type,
        }


@router.post("/api/decks/{deck_id}/review")
def review_deck_card(deck_id: str, payload: ReviewPayload,
                     user_id: str = Depends(get_user_id)):
    s = srs.review(payload.card_id, payload.mode, payload.quality)
    return {"card_id": payload.card_id, "interval": s["interval"], "next_review": s["next_review"]}


@router.get("/api/decks/{deck_id}/stats")
def get_deck_stats(deck_id: str, mode: str = "flashcard",
                   user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id FROM custom_cards
                WHERE deck_id = %s AND user_id = %s
            """, (deck_id, user_id))
            card_ids = [f"{user_id}:custom_{deck_id}_{r['id']}" for r in cur.fetchall()]
    finally:
        conn.close()

    if not card_ids:
        return {"total": 0, "new": 0, "learning": 0, "mastered": 0, "due_now": 0}

    states  = srs.get_bulk_stats(card_ids, mode)
    due_now = sum(1 for cid in card_ids if cid in set(srs.get_due_cards(mode)))
    return {
        "total":    len(card_ids),
        "new":      sum(1 for s in states.values() if s == "new"),
        "learning": sum(1 for s in states.values() if s == "learning"),
        "mastered": sum(1 for s in states.values() if s == "mastered"),
        "due_now":  due_now,
    }


@router.post("/api/decks/{deck_id}/import")
async def import_cards(deck_id: str, file: UploadFile = File(...),
                       user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT type FROM decks WHERE id = %s AND user_id = %s",
                       (deck_id, user_id))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Deck not found")
    finally:
        conn.close()

    content = await file.read()
    try:
        text = content.decode('utf-8-sig')
    except UnicodeDecodeError:
        text = content.decode('latin-1')

    reader  = csv.DictReader(io.StringIO(text))
    headers = [h.strip().lower() for h in (reader.fieldnames or [])]

    if 'front' not in headers or 'back' not in headers:
        raise HTTPException(status_code=400, detail="CSV must contain 'front' and 'back' columns")

    inserted = 0
    errors   = []
    conn     = db_conn()
    try:
        with conn.cursor() as cur:
            for i, row in enumerate(reader, start=2):
                front = row.get('front', '').strip()
                back  = row.get('back',  '').strip()
                if not front or not back:
                    errors.append(f"Row {i}: missing front/back — skipped")
                    continue
                cur.execute("""
                    INSERT INTO custom_cards (deck_id, user_id, front, back, kana, hint, notes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (deck_id, user_id, front, back,
                      row.get('kana', '').strip(),
                      row.get('hint', '').strip(),
                      row.get('notes', '').strip()))
                inserted += 1
        conn.commit()
    finally:
        conn.close()

    return {"inserted": inserted, "errors": errors, "ok": True}