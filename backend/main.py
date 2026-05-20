from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from kana_data import KANA_SETS, kana_to_id
from vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from kanji_data import KANJI_BY_LEVEL, kanji_to_id
from pydantic import BaseModel
import random
from datetime import datetime
from srs import SRSEngine

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://japanese-learner-seven.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.environ.get("DATABASE_URL")
srs = SRSEngine(DATABASE_URL)

@app.get("/")
def root():
    return {"status": "ok"}

# ── Kana ──────────────────────────────────────────────────

@app.get("/api/kana/sets")
def get_kana_sets():
    return {"sets": list(KANA_SETS.keys())}


@app.get("/api/kana/card")
def get_kana_card(set_name: str, mode: str):
    kana_list = KANA_SETS.get(set_name)
    if not kana_list:
        return {"error": "Unknown set"}

    card_ids = [kana_to_id(k) for k in kana_list]

    due = srs.get_due_cards(card_ids, mode)
    if due:
        card_id = random.choice(due)
    else:
        new = srs.get_new_cards(card_ids, mode, limit=1)
        if new:
            card_id = new[0]
        else:
            return {"done": True}

    kana_entry = next(k for k in kana_list if kana_to_id(k) == card_id)

    all_romaji = [k["romaji"] for k in kana_list if k["romaji"] != kana_entry["romaji"]]
    choices = random.sample(all_romaji, min(3, len(all_romaji))) + [kana_entry["romaji"]]
    random.shuffle(choices)

    return {
        "card_id": card_id,
        "kana": kana_entry["kana"],
        "romaji": kana_entry["romaji"],
        "choices": choices,
        "mode": mode,
    }


class ReviewPayload(BaseModel):
    card_id: str
    mode:    str
    quality: int


@app.post("/api/kana/review")
def post_kana_review(payload: ReviewPayload):
    s = srs.review(payload.card_id, payload.mode, payload.quality)
    return {"card_id": payload.card_id, "interval": s["interval"], "next_review": s["next_review"]}


# ── Vocab ──────────────────────────────────────────────────

@app.get("/api/vocab/card")
def get_vocab_card(level: str, phase: int):
    vocab_list = VOCAB_BY_LEVEL.get(level)
    if not vocab_list:
        return {"error": "Unknown level"}

    phase_key = {1: "kk-s", 2: "k-k", 3: "s-k"}.get(phase)
    if not phase_key:
        return {"error": "Invalid phase"}

    card_ids = [vocab_to_id(w, level) for w in vocab_list]

    due = srs.get_due_cards(card_ids, phase_key)
    if due:
        card_id = random.choice(due)
    else:
        new = srs.get_new_cards(card_ids, phase_key, limit=1)
        if new:
            card_id = new[0]
        else:
            return {"done": True}

    word = next(w for w in vocab_list if vocab_to_id(w, level) == card_id)

    all_meanings = [w["meaning"] for w in vocab_list if w["meaning"] != word["meaning"]]
    choices = random.sample(all_meanings, min(3, len(all_meanings))) + [word["meaning"]]
    random.shuffle(choices)

    return {
        "card_id": card_id,
        "phase":   phase,
        "phase_key": phase_key,
        "kanji":   word.get("kanji", ""),
        "kana":    word.get("kana", ""),
        "meaning": word["meaning"],
        "choices": choices,
    }


@app.post("/api/vocab/review")
def post_vocab_review(payload: ReviewPayload):
    s = srs.review(payload.card_id, payload.mode, payload.quality)
    return {"card_id": payload.card_id, "interval": s["interval"], "next_review": s["next_review"]}


# ── Kanji ──────────────────────────────────────────────────

@app.get("/api/kanji/card")
def get_kanji_card(level: str, phase: int):
    kanji_list = KANJI_BY_LEVEL.get(level)
    if not kanji_list:
        return {"error": "Unknown level"}

    phase_key = {1: "kk-s", 2: "k-k", 3: "s-k"}.get(phase)
    if not phase_key:
        return {"error": "Invalid phase"}

    card_ids = [kanji_to_id(k, level) for k in kanji_list]

    due = srs.get_due_cards(card_ids, phase_key)
    if due:
        card_id = random.choice(due)
    else:
        new = srs.get_new_cards(card_ids, phase_key, limit=1)
        if new:
            card_id = new[0]
        else:
            return {"done": True}

    entry = next(k for k in kanji_list if kanji_to_id(k, level) == card_id)

    all_meanings = [k["meaning"] for k in kanji_list if k["meaning"] != entry["meaning"]]
    choices = random.sample(all_meanings, min(3, len(all_meanings))) + [entry["meaning"]]
    random.shuffle(choices)

    return {
        "card_id":     card_id,
        "phase":       phase,
        "phase_key":   phase_key,
        "kanji":       entry.get("kanji", ""),
        "kana":        entry.get("kana", ""),
        "meaning":     entry.get("meaning", ""),
        "stroke_count": entry.get("stroke_count", ""),
        "choices":     choices,
    }


@app.post("/api/kanji/review")
def post_kanji_review(payload: ReviewPayload):
    s = srs.review(payload.card_id, payload.mode, payload.quality)
    return {"card_id": payload.card_id, "interval": s["interval"], "next_review": s["next_review"]}


# ── Stats ──────────────────────────────────────────────────

KANA_MODES  = ["mcq", "type"]
PHASES_KEYS = ["kk-s", "k-k", "s-k"]


def compute_stats(card_ids: list[str], mode: str) -> dict:
    states  = srs.get_bulk_stats(card_ids, mode)
    due_now = srs.get_due_count(card_ids, mode)
    new = sum(1 for s in states.values() if s == "new")
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
def get_stats():
    kana_stats = {
        set_name: {
            mode: compute_stats([kana_to_id(k) for k in kana_list], mode)
            for mode in KANA_MODES
        }
        for set_name, kana_list in KANA_SETS.items()
    }

    vocab_stats = {
        level: {
            key: compute_stats([vocab_to_id(w, level) for w in vocab_list], key)
            for key in PHASES_KEYS
        }
        for level, vocab_list in VOCAB_BY_LEVEL.items()
    }

    kanji_stats = {
        level: {
            key: compute_stats([kanji_to_id(k, level) for k in kanji_list], key)
            for key in PHASES_KEYS
        }
        for level, kanji_list in KANJI_BY_LEVEL.items()
    }

    return {"kana": kana_stats, "vocab": vocab_stats, "kanji": kanji_stats}


@app.delete("/api/stats/reset")
def reset_stats(card_ids: list[str] | None = None):
    if card_ids is None:
        srs.cards.clear()
        srs.delete_all_cards()
    else:
        for cid in card_ids:
            srs.cards.pop(cid, None)
        srs.delete_cards(card_ids)
    return {"ok": True}