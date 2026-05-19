from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from kana_data import KANA_SETS, kana_to_id
from vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from kanji_data import KANJI_BY_LEVEL, kanji_to_id
from pydantic import BaseModel
import random

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


@app.get("/api/stats")
def get_stats():
    result = {
        "kana": get_kana_stats(),
        "vocab": get_vocab_stats(),
        "kanji": get_kanji_stats(),
    }
    return result


def get_kana_stats():
    all_ids = {
        set_name: {
            mode: [kana_to_id(k, mode) for k in kana_list]
            for mode in KANA_MODES
        }
        for set_name, kana_list in KANA_SETS.items()
    }

    # ONE CALL TOTAL
    flat_ids = [
        cid
        for modes in all_ids.values()
        for ids in modes.values()
        for cid in ids
    ]

    stats_map = srs.get_stats(flat_ids)

    # rebuild structure without extra DB calls
    return {
        set_name: {
            mode: extract_stats(stats_map, ids)
            for mode, ids in modes.items()
        }
        for set_name, modes in all_ids.items()
    }


def get_vocab_stats():
    all_ids = {
        level: {
            key: [vocab_to_id(w, level, key) for w in vocab_list]
            for key in PHASES_KEYS
        }
        for level, vocab_list in VOCAB_BY_LEVEL.items()
    }

    flat_ids = [
        cid
        for phases in all_ids.values()
        for ids in phases.values()
        for cid in ids
    ]

    stats_map = srs.get_stats(flat_ids)

    return {
        level: {
            key: extract_stats(stats_map, ids)
            for key, ids in phases.items()
        }
        for level, phases in all_ids.items()
    }


def get_kanji_stats():
    all_ids = {
        level: {
            key: [kanji_to_id(k, level, key) for k in kanji_list]
            for key in PHASES_KEYS
        }
        for level, kanji_list in KANJI_BY_LEVEL.items()
    }

    flat_ids = [
        cid
        for phases in all_ids.values()
        for ids in phases.values()
        for cid in ids
    ]

    stats_map = srs.get_stats(flat_ids)

    return {
        level: {
            key: extract_stats(stats_map, ids)
            for key, ids in phases.items()
        }
        for level, phases in all_ids.items()
    }

def extract_stats(stats_map: dict, card_ids: list[str]) -> dict:
    total = len(card_ids)
    new = stats_map.get("new", 0)
    learning = stats_map.get("learning", 0)
    mastered = stats_map.get("mastered", 0)
    due_now = stats_map.get("due_now", 0)

    return {
        "total": total,
        "new": new,
        "learning": learning,
        "mastered": mastered,
        "due_now": due_now,
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