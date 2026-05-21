from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import jwt
from kana_data import KANA_SETS, kana_to_id
from vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from kanji_data import KANJI_BY_LEVEL, kanji_to_id
from pydantic import BaseModel
import random
from datetime import datetime
from srs import SRSEngine
import httpx
from fastapi.staticfiles import StaticFiles
import uuid
import psycopg2.extras

app = FastAPI()

app.mount("/kanjivg", StaticFiles(directory="kanjivg"), name="kanjivg")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://japanese-learner-seven.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL         = os.environ.get("DATABASE_URL")
SUPABASE_URL         = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

srs = SRSEngine(DATABASE_URL)

# ── Auth ──────────────────────────────────────────────────

security = HTTPBearer()

def get_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    token = credentials.credentials
    try:
        # Ask Supabase to validate the token
        response = httpx.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_SERVICE_KEY,
            }
        )
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = response.json().get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except httpx.RequestError:
        raise HTTPException(status_code=401, detail="Auth service unavailable")

def prefixed(card_ids: list[str], user_id: str) -> list[str]:
    return [f"{user_id}:{cid}" for cid in card_ids]

def unprefixed(card_id: str, user_id: str) -> str:
    """Strip user prefix before sending back to frontend."""
    prefix = f"{user_id}:"
    return card_id[len(prefix):] if card_id.startswith(prefix) else card_id

@app.get("/")
def root():
    return {"status": "ok"}

# ── Kana ──────────────────────────────────────────────────

@app.get("/api/kana/sets")
def get_kana_sets():
    return {"sets": list(KANA_SETS.keys())}


@app.get("/api/kana/card")
def get_kana_card(set_name: str, mode: str, user_id: str = Depends(get_user_id)):
    kana_list = KANA_SETS.get(set_name)
    if not kana_list:
        return {"error": "Unknown set"}

    raw_ids  = [kana_to_id(k) for k in kana_list]
    card_ids = prefixed(raw_ids, user_id)

    due = srs.get_due_cards(card_ids, mode)
    if due:
        card_id = random.choice(due)
    else:
        new = srs.get_new_cards(card_ids, mode, limit=1)
        if new:
            card_id = new[0]
        else:
            return {"done": True}

    raw_id      = unprefixed(card_id, user_id)
    kana_entry  = next(k for k in kana_list if kana_to_id(k) == raw_id)

    all_romaji = [k["romaji"] for k in kana_list if k["romaji"] != kana_entry["romaji"]]
    choices    = random.sample(all_romaji, min(3, len(all_romaji))) + [kana_entry["romaji"]]
    random.shuffle(choices)

    return {
        "card_id": raw_id,
        "kana":    kana_entry["kana"],
        "romaji":  kana_entry["romaji"],
        "choices": choices,
        "mode":    mode,
    }


class ReviewPayload(BaseModel):
    card_id: str
    mode:    str
    quality: int


@app.post("/api/kana/review")
def post_kana_review(payload: ReviewPayload, user_id: str = Depends(get_user_id)):
    card_id = f"{user_id}:{payload.card_id}"
    s = srs.review(card_id, payload.mode, payload.quality)
    return {"card_id": payload.card_id, "interval": s["interval"], "next_review": s["next_review"]}


# ── Vocab ──────────────────────────────────────────────────

@app.get("/api/vocab/card")
def get_vocab_card(level: str, phase: int, user_id: str = Depends(get_user_id)):
    vocab_list = VOCAB_BY_LEVEL.get(level)
    if not vocab_list:
        return {"error": "Unknown level"}

    phase_key = {1: "kk-s", 2: "k-k", 3: "s-k"}.get(phase)
    if not phase_key:
        return {"error": "Invalid phase"}

    raw_ids  = [vocab_to_id(w, level) for w in vocab_list]
    card_ids = prefixed(raw_ids, user_id)

    due = srs.get_due_cards(card_ids, phase_key)
    if due:
        card_id = random.choice(due)
    else:
        new = srs.get_new_cards(card_ids, phase_key, limit=1)
        if new:
            card_id = new[0]
        else:
            return {"done": True}

    raw_id = unprefixed(card_id, user_id)
    word   = next(w for w in vocab_list if vocab_to_id(w, level) == raw_id)

    all_meanings = [w["meaning"] for w in vocab_list if w["meaning"] != word["meaning"]]
    choices      = random.sample(all_meanings, min(3, len(all_meanings))) + [word["meaning"]]
    random.shuffle(choices)

    return {
        "card_id":   raw_id,
        "phase":     phase,
        "phase_key": phase_key,
        "kanji":     word.get("kanji", ""),
        "kana":      word.get("kana", ""),
        "meaning":   word["meaning"],
        "choices":   choices,
    }


@app.post("/api/vocab/review")
def post_vocab_review(payload: ReviewPayload, user_id: str = Depends(get_user_id)):
    card_id = f"{user_id}:{payload.card_id}"
    s = srs.review(card_id, payload.mode, payload.quality)
    return {"card_id": payload.card_id, "interval": s["interval"], "next_review": s["next_review"]}


# ── Kanji ──────────────────────────────────────────────────

@app.get("/api/kanji/card")
def get_kanji_card(level: str, phase: int, user_id: str = Depends(get_user_id)):
    kanji_list = KANJI_BY_LEVEL.get(level)
    if not kanji_list:
        return {"error": "Unknown level"}

    phase_key = {1: "kk-s", 2: "k-k", 3: "s-k"}.get(phase)
    if not phase_key:
        return {"error": "Invalid phase"}

    raw_ids  = [kanji_to_id(k, level) for k in kanji_list]
    card_ids = prefixed(raw_ids, user_id)

    due = srs.get_due_cards(card_ids, phase_key)
    if due:
        card_id = random.choice(due)
    else:
        new = srs.get_new_cards(card_ids, phase_key, limit=1)
        if new:
            card_id = new[0]
        else:
            return {"done": True}

    raw_id = unprefixed(card_id, user_id)
    entry  = next(k for k in kanji_list if kanji_to_id(k, level) == raw_id)

    all_meanings = [k["meaning"] for k in kanji_list if k["meaning"] != entry["meaning"]]
    choices      = random.sample(all_meanings, min(3, len(all_meanings))) + [entry["meaning"]]
    random.shuffle(choices)

    return {
        "card_id":      raw_id,
        "phase":        phase,
        "phase_key":    phase_key,
        "kanji":        entry.get("kanji", ""),
        "kana":         entry.get("kana", ""),
        "meaning":      entry.get("meaning", ""),
        "stroke_count": entry.get("stroke_count", ""),
        "choices":      choices,
    }


@app.post("/api/kanji/review")
def post_kanji_review(payload: ReviewPayload, user_id: str = Depends(get_user_id)):
    card_id = f"{user_id}:{payload.card_id}"
    s = srs.review(card_id, payload.mode, payload.quality)
    return {"card_id": payload.card_id, "interval": s["interval"], "next_review": s["next_review"]}


# ── Stats ──────────────────────────────────────────────────

KANA_MODES  = ["mcq", "type"]
PHASES_KEYS = ["kk-s", "k-k", "s-k"]


def compute_stats(raw_ids: list[str], mode: str, user_id: str) -> dict:
    card_ids = prefixed(raw_ids, user_id)
    states   = srs.get_bulk_stats(card_ids, mode)
    due_now  = srs.get_due_count(card_ids, mode)
    new      = sum(1 for s in states.values() if s == "new")
    mastered = sum(1 for s in states.values() if s == "mastered")
    learning = sum(1 for s in states.values() if s == "learning")
    return {
        "total":    len(card_ids),
        "new":      new,
        "learning": learning,
        "mastered": mastered,
        "due_now":  due_now,
    }


@app.get("/api/stats")
def get_stats(user_id: str = Depends(get_user_id)):
    kana_stats = {
        set_name: {
            mode: compute_stats([kana_to_id(k) for k in kana_list], mode, user_id)
            for mode in KANA_MODES
        }
        for set_name, kana_list in KANA_SETS.items()
    }
    vocab_stats = {
        level: {
            key: compute_stats([vocab_to_id(w, level) for w in vocab_list], key, user_id)
            for key in PHASES_KEYS
        }
        for level, vocab_list in VOCAB_BY_LEVEL.items()
    }
    kanji_stats = {
        level: {
            key: compute_stats([kanji_to_id(k, level) for k in kanji_list], key, user_id)
            for key in PHASES_KEYS
        }
        for level, kanji_list in KANJI_BY_LEVEL.items()
    }
    return {"kana": kana_stats, "vocab": vocab_stats, "kanji": kanji_stats}


@app.delete("/api/stats/reset")
def reset_stats(user_id: str = Depends(get_user_id), card_ids: list[str] | None = None):
    if card_ids is None:
        keys_to_delete = [k for k in srs.cards if k.startswith(f"{user_id}:")]
        for k in keys_to_delete:
            del srs.cards[k]
        srs.delete_cards(keys_to_delete)
    else:
        prefixed_ids = prefixed(card_ids, user_id)
        for cid in prefixed_ids:
            srs.cards.pop(cid, None)
        srs.delete_cards(prefixed_ids)
    return {"ok": True}

# ── Dictionnary ──────────────────────────────────────────────────

@app.get("/api/dictionary")
def get_dictionary(q: str = "", page: int = 0, limit: int = 50):
    all_results = []
    for level, kanji_list in KANJI_BY_LEVEL.items():
        for k in kanji_list:
            if q == "" or (
                q in k.get("kanji", "") or
                q in k.get("kana", "") or
                q.lower() in k.get("meaning", "").lower()
            ):
                codepoint = hex(ord(k["kanji"]))[2:].zfill(5)
                all_results.append({
                    "kanji":        k["kanji"],
                    "kana":         k.get("kana", ""),
                    "meaning":      k.get("meaning", ""),
                    "stroke_count": k.get("stroke_count", ""),
                    "level":        level,
                    "svg_url":      f"/kanjivg/{codepoint}.svg",
                })

    total   = len(all_results)
    start   = page * limit
    end     = start + limit
    page_results = all_results[start:end]

    return {
        "results": page_results,
        "total":   total,
        "page":    page,
        "limit":   limit,
        "has_more": end < total,
    }

# ── Decks ──────────────────────────────────────────────────

class DeckPayload(BaseModel):
    name: str
    type: str  # flashcard | vocab | kanji

class CardPayload(BaseModel):
    front: str
    back:  str
    kana:  str = ""
    hint:  str = ""
    notes: str = ""

class MixPayload(BaseModel):
    jlpt_levels: list[str] = []  # e.g. ["N5", "N4"]


def db_conn():
    import psycopg2
    import psycopg2.extras
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    return conn


# ── DECK CRUD ─────────────────────────────────────────────

@app.get("/api/decks")
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


@app.post("/api/decks")
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


@app.delete("/api/decks/{deck_id}")
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
        # Also clean up SRS data for this deck
        keys = [k for k in srs.cards if f"custom_{deck_id}" in k]
        for k in keys:
            del srs.cards[k]
        srs.delete_cards(keys)
        return {"ok": True}
    finally:
        conn.close()


# ── CARD CRUD ─────────────────────────────────────────────

@app.get("/api/decks/{deck_id}/cards")
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


@app.post("/api/decks/{deck_id}/cards")
def add_card(deck_id: str, payload: CardPayload, user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Verify deck belongs to user
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


@app.put("/api/decks/{deck_id}/cards/{card_id}")
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


@app.delete("/api/decks/{deck_id}/cards/{card_id}")
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
        # Clean up SRS data for this card
        key = f"{user_id}:custom_{deck_id}_{card_id}"
        srs.cards.pop(key, None)
        srs.delete_cards([key])
        return {"ok": True}
    finally:
        conn.close()


# ── STUDY ─────────────────────────────────────────────────

@app.get("/api/decks/{deck_id}/study")
def get_study_card(deck_id: str, mode: str = "flashcard",
                   mix_levels: str = "",
                   user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Get deck type
            cur.execute("SELECT type FROM decks WHERE id = %s AND user_id = %s",
                       (deck_id, user_id))
            deck = cur.fetchone()
            if not deck:
                raise HTTPException(status_code=404, detail="Deck not found")

            # Get custom cards
            cur.execute("""
                SELECT id, front, back, kana, hint, notes
                FROM custom_cards WHERE deck_id = %s AND user_id = %s
            """, (deck_id, user_id))
            custom_cards = [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()

    deck_type = deck["type"]

    # Build card pool
    pool = []

    # Custom cards
    for c in custom_cards:
        cid = f"{user_id}:custom_{deck_id}_{c['id']}"
        pool.append({"card_id": cid, "source": "custom", "data": c})

    # Mix with built-in if requested
    if mix_levels:
        levels = [l.strip() for l in mix_levels.split(",") if l.strip()]
        if deck_type == "vocab":
            for level in levels:
                vocab_list = VOCAB_BY_LEVEL.get(level, [])
                phase_key  = {
                    "flashcard": "kk-s", "phase1": "kk-s",
                    "phase2": "k-k",     "phase3": "s-k"
                }.get(mode, "kk-s")
                for w in vocab_list:
                    cid = f"{user_id}:{vocab_to_id(w, level)}"
                    pool.append({"card_id": cid, "source": "builtin_vocab",
                                 "data": w, "level": level, "phase_key": phase_key})
        elif deck_type == "kanji":
            for level in levels:
                kanji_list = KANJI_BY_LEVEL.get(level, [])
                phase_key  = {
                    "flashcard": "kk-s", "phase1": "kk-s",
                    "phase2": "k-k",     "phase3": "s-k"
                }.get(mode, "kk-s")
                for k in kanji_list:
                    cid = f"{user_id}:{kanji_to_id(k, level)}"
                    pool.append({"card_id": cid, "source": "builtin_kanji",
                                 "data": k, "level": level, "phase_key": phase_key})

    if not pool:
        return {"done": True}

    # Pick next card via SRS
    all_ids  = [p["card_id"] for p in pool]
    srs_mode = mode

    due = srs.get_due_cards(all_ids, srs_mode)
    if due:
        card_id = random.choice(due)
    else:
        new = srs.get_new_cards(all_ids, srs_mode, limit=1)
        if new:
            card_id = new[0]
        else:
            return {"done": True}

    entry = next(p for p in pool if p["card_id"] == card_id)
    d     = entry["data"]

    # Build response based on source
    if entry["source"] == "custom":
        return {
            "card_id":  card_id,
            "source":   "custom",
            "front":    d["front"],
            "back":     d["back"],
            "kana":     d.get("kana", ""),
            "hint":     d.get("hint", ""),
            "notes":    d.get("notes", ""),
            "mode":     srs_mode,
            "deck_type": deck_type,
        }
    elif entry["source"] == "builtin_vocab":
        all_meanings = [w["meaning"] for w in VOCAB_BY_LEVEL.get(entry["level"], [])
                        if w["meaning"] != d["meaning"]]
        choices = random.sample(all_meanings, min(3, len(all_meanings))) + [d["meaning"]]
        random.shuffle(choices)
        return {
            "card_id":   card_id,
            "source":    "builtin_vocab",
            "front":     d.get("kanji", ""),
            "back":      d["meaning"],
            "kana":      d.get("kana", ""),
            "choices":   choices,
            "phase_key": entry["phase_key"],
            "mode":      srs_mode,
            "deck_type": deck_type,
        }
    elif entry["source"] == "builtin_kanji":
        all_meanings = [k["meaning"] for k in KANJI_BY_LEVEL.get(entry["level"], [])
                        if k["meaning"] != d["meaning"]]
        choices = random.sample(all_meanings, min(3, len(all_meanings))) + [d["meaning"]]
        random.shuffle(choices)
        codepoint = hex(ord(d["kanji"]))[2:].zfill(5)
        return {
            "card_id":     card_id,
            "source":      "builtin_kanji",
            "front":       d.get("kanji", ""),
            "back":        d["meaning"],
            "kana":        d.get("kana", ""),
            "choices":     choices,
            "stroke_count": d.get("stroke_count", ""),
            "svg_url":     f"/kanjivg/{codepoint}.svg",
            "phase_key":   entry["phase_key"],
            "mode":        srs_mode,
            "deck_type":   deck_type,
        }


@app.post("/api/decks/{deck_id}/review")
def review_deck_card(deck_id: str, payload: ReviewPayload,
                     user_id: str = Depends(get_user_id)):
    s = srs.review(payload.card_id, payload.mode, payload.quality)
    return {"card_id": payload.card_id, "interval": s["interval"], "next_review": s["next_review"]}


@app.get("/api/decks/{deck_id}/stats")
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
    due_now = srs.get_due_count(card_ids, mode)
    return {
        "total":    len(card_ids),
        "new":      sum(1 for s in states.values() if s == "new"),
        "learning": sum(1 for s in states.values() if s == "learning"),
        "mastered": sum(1 for s in states.values() if s == "mastered"),
        "due_now":  due_now,
    }