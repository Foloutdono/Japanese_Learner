from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from kana_data import KANA_SETS, kana_to_id
from vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from kanji_data import KANJI_BY_LEVEL, kanji_to_id
from pydantic import BaseModel
import random
import datetime

from srs import SRSEngine

app = FastAPI()

# Allow requests from the React frontend later
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# One shared SRS engine (single-user for now)
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

    card_ids = [kana_to_id(k, mode) for k in kana_list]

    # First try due cards, then new cards
    due = srs.get_due_cards(card_ids)
    print(f"set={set_name!r}, cards={len(kana_list)}, due={len(due)}")
    if due:
        card_id = random.choice(due)
    else:
        new = srs.get_new_cards(card_ids, limit=1)
        if new:
            card_id = random.choice(new)
        else:
            return {"done": True}

    # Find the kana entry matching this card
    kana_entry = next(k for k in kana_list if kana_to_id(k, mode) == card_id)

    # Build MCQ choices (3 wrong + 1 correct)
    all_romaji = [k["romaji"] for k in kana_list if k["romaji"] != kana_entry["romaji"]]
    choices = random.sample(all_romaji, min(3, len(all_romaji))) + [kana_entry["romaji"]]
    random.shuffle(choices)

    return {
        "card_id": card_id,
        "kana": kana_entry["kana"],
        "romaji": kana_entry["romaji"],
        "choices": choices,   # for MCQ mode
        "mode": mode,
    }


class ReviewPayload(BaseModel):
    card_id: str
    quality: int  # 0–5


@app.post("/api/kana/review")
def post_kana_review(payload: ReviewPayload):
    card = srs.review(payload.card_id, payload.quality)
    return {
        "card_id": card.card_id,
        "interval": card.interval,
        "easiness": card.easiness,
        "next_review": card.next_review,
    }

# ── Vocab ──────────────────────────────────────────────────

@app.get("/api/vocab/levels")
def get_vocab_levels():
    return {"levels": list(VOCAB_BY_LEVEL.keys())}


@app.get("/api/vocab/card")
def get_vocab_card(level: str, phase: int):
    vocab_list = VOCAB_BY_LEVEL.get(level)
    if not vocab_list:
        return {"error": "Unknown level"}

    phase_key = {1: "kk-s", 2: "k-k", 3: "s-k"}.get(phase)
    if not phase_key:
        return {"error": "Invalid phase (1, 2 or 3)"}

    card_ids = [vocab_to_id(w, level, phase_key) for w in vocab_list]

    due = srs.get_due_cards(card_ids)
    if due:
        card_id = random.choice(due)
    else:
        new = srs.get_new_cards(card_ids, limit=1)
        if new:
            card_id = random.choice(new)
        else:
            return {"done": True}

    word = next(w for w in vocab_list if vocab_to_id(w, level, phase_key) == card_id)

    # MCQ choices (wrong meanings)
    all_meanings = [w["meaning"] for w in vocab_list if w["meaning"] != word["meaning"]]
    choices = random.sample(all_meanings, min(3, len(all_meanings))) + [word["meaning"]]
    random.shuffle(choices)

    return {
        "card_id": card_id,
        "phase": phase,
        "kanji": word.get("kanji", ""),
        "kana": word.get("kana", ""),
        "meaning": word["meaning"],
        "choices": choices,   # for phase 1 and 2 (MCQ)
    }


@app.post("/api/vocab/review")
def post_vocab_review(payload: ReviewPayload):
    card = srs.review(payload.card_id, payload.quality)
    return {
        "card_id": card.card_id,
        "interval": card.interval,
        "next_review": card.next_review,
    }

# ── Kanji ──────────────────────────────────────────────────

@app.get("/api/kanji/levels")
def get_kanji_levels():
    return {"levels": list(KANJI_BY_LEVEL.keys())}


@app.get("/api/kanji/card")
def get_kanji_card(level: str, phase: int):
    kanji_list = KANJI_BY_LEVEL.get(level)
    if not kanji_list:
        return {"error": "Unknown level"}

    phase_key = {1: "kk-s", 2: "k-k", 3: "s-k"}.get(phase)
    if not phase_key:
        return {"error": "Invalid phase (1, 2 or 3)"}

    card_ids = [kanji_to_id(k, level, phase_key) for k in kanji_list]

    due = srs.get_due_cards(card_ids)
    if due:
        card_id = random.choice(due)
    else:
        new = srs.get_new_cards(card_ids, limit=1)
        if new:
            card_id = random.choice(new)
        else:
            return {"done": True}

    entry = next(k for k in kanji_list if kanji_to_id(k, level, phase_key) == card_id)

    all_meanings = [k["meaning"] for k in kanji_list if k["meaning"] != entry["meaning"]]
    choices = random.sample(all_meanings, min(3, len(all_meanings))) + [entry["meaning"]]
    random.shuffle(choices)

    return {
        "card_id": card_id,
        "phase": phase,
        "kanji": entry.get("kanji", ""),
        "kana": entry.get("kana", ""),
        "meaning": entry.get("meaning", ""),
        "stroke_count": entry.get("stroke_count", ""),
        "choices": choices,
    }


@app.post("/api/kanji/review")
def post_kanji_review(payload: ReviewPayload):
    card = srs.review(payload.card_id, payload.quality)
    return {
        "card_id": card.card_id,
        "interval": card.interval,
        "next_review": card.next_review,
    }

# ── Stats ──────────────────────────────────────────────────

KANA_MODES  = ["mcq", "type"]
PHASES_KEYS = ["kk-s", "k-k", "s-k"]


def compute_stats(card_states: dict, card_ids: list[str]) -> dict:
    new = learning = mastered = due_now = 0
    now = datetime.now()

    for cid in card_ids:
        state = card_states.get(cid, "new")
        if state == "new":
            new += 1
        elif state == "mastered":
            mastered += 1
        else:
            learning += 1

        # use in-memory card, no DB call
        card = srs.cards.get(cid)
        if card and card.total_reviews > 0:
            if now >= datetime.fromisoformat(card.next_review):
                due_now += 1

    return {
        "total": len(card_ids),
        "new": new,
        "learning": learning,
        "mastered": mastered,
        "due_now": due_now,
    }


def get_kana_stats(card_states: dict):
    return {
        set_name: {
            mode: compute_stats(card_states, [kana_to_id(k, mode) for k in kana_list])
            for mode in KANA_MODES
        }
        for set_name, kana_list in KANA_SETS.items()
    }


def get_vocab_stats(card_states: dict):
    return {
        level: {
            key: compute_stats(card_states, [vocab_to_id(w, level, key) for w in vocab_list])
            for key in PHASES_KEYS
        }
        for level, vocab_list in VOCAB_BY_LEVEL.items()
    }


def get_kanji_stats(card_states: dict):
    return {
        level: {
            key: compute_stats(card_states, [kanji_to_id(k, level, key) for k in kanji_list])
            for key in PHASES_KEYS
        }
        for level, kanji_list in KANJI_BY_LEVEL.items()
    }


@app.get("/api/stats")
def get_stats():
    # Build all card IDs across everything
    all_ids = []
    for kana_list in KANA_SETS.values():
        for mode in KANA_MODES:
            all_ids += [kana_to_id(k, mode) for k in kana_list]
    for level, vocab_list in VOCAB_BY_LEVEL.items():
        for key in PHASES_KEYS:
            all_ids += [vocab_to_id(w, level, key) for w in vocab_list]
    for level, kanji_list in KANJI_BY_LEVEL.items():
        for key in PHASES_KEYS:
            all_ids += [kanji_to_id(k, level, key) for k in kanji_list]

    # ONE call to load all states
    card_states = srs.get_bulk_stats(all_ids)

    return {
        "kana":  get_kana_stats(card_states),
        "vocab": get_vocab_stats(card_states),
        "kanji": get_kanji_stats(card_states),
    }


@app.delete("/api/stats/reset")
def reset_stats(card_ids: list[str] | None = None):
    if card_ids is None:
        srs.cards.clear()
        srs.delete_all_cards()
    else:
        for cid in card_ids:
            if cid in srs.cards:
                del srs.cards[cid]
        srs.delete_cards(card_ids)
    return {"ok": True}