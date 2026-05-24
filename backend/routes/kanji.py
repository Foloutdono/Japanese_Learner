import random
from fastapi import APIRouter, Depends
from kanji_data import KANJI_BY_LEVEL, kanji_to_id
from auth import get_user_id, prefixed, unprefixed
from srs_instance import srs
from translations import get_meaning
from translations.fr.kanji_fr import KANJI_FR
from pydantic import BaseModel

router = APIRouter()

class ReviewPayload(BaseModel):
    card_id: str
    mode:    str
    quality: int

FR_MAP = KANJI_FR


@router.get("/api/kanji/card")
def get_kanji_card(level: str, phase: int, lang: str = "fr",
                   user_id: str = Depends(get_user_id)):
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

    raw_id  = unprefixed(card_id, user_id)
    entry   = next(k for k in kanji_list if kanji_to_id(k, level) == raw_id)
    meaning = get_meaning(entry, lang, FR_MAP)

    all_meanings = [
        get_meaning(k, lang, FR_MAP)
        for k in kanji_list
        if get_meaning(k, lang, FR_MAP) != meaning
    ]
    choices = random.sample(all_meanings, min(3, len(all_meanings))) + [meaning]
    random.shuffle(choices)

    choices_kanji = [
        k.get("kanji", "") 
        for k in kanji_list 
        if get_meaning(k, "en", {}) != entry.get("meaning")  
    ][:3] + [entry.get("kanji", "")]

    return {
        "card_id":      raw_id,
        "phase":        phase,
        "phase_key":    phase_key,
        "kanji":        entry.get("kanji", ""),
        "kana":         entry.get("kana", ""),
        "meaning":      meaning,
        "stroke_count": entry.get("stroke_count", ""),
        "choices":      choices,
        "choices_kanji": choices_kanji,
    }


@router.post("/api/kanji/review")
def post_kanji_review(payload: ReviewPayload, user_id: str = Depends(get_user_id)):
    card_id = f"{user_id}:{payload.card_id}"
    s = srs.review(card_id, payload.mode, payload.quality)
    return {"card_id": payload.card_id, "interval": s["interval"], "next_review": s["next_review"]}