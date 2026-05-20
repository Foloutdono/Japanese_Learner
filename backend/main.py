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

app = FastAPI()

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