import logging
import random
from fastapi import APIRouter, Depends
from kanji_data import KANJI_BY_LEVEL, kanji_to_id
from auth import get_user_id, prefixed, unprefixed
from srs_instance import srs
from translations import get_meaning
from translations.fr.kanji_fr import KANJI_FR
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

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

    phase_key = {1: "kk-s", 2: "k-k", 3: "s-k", 4: "k-d"}.get(phase)
    if not phase_key:
        return {"error": "Invalid phase"}

    raw_ids  = [kanji_to_id(k, level) for k in kanji_list]
    card_ids = prefixed(raw_ids, user_id)
    srs.ensure_cards(card_ids, phase_key)

    due = srs.get_due_cards(phase_key, card_ids=card_ids)
    logger.info("kanji study request level=%s phase=%s mode=%s user_id=%s candidate_count=%d due_count=%d due_ids=%s", level, phase, phase_key, user_id, len(card_ids), len(due), due[:10])
    if due:
        card_id = random.choice(due)
        logger.info("kanji using due card", extra={"card_id": card_id, "due_count": len(due)})
    else:
        new = srs.get_new_cards(phase_key, limit=1, card_ids=card_ids)
        logger.info("kanji fallback to new card new_count=%d new_ids=%s", len(new), new[:10])
        if new:
            card_id = new[0]
            logger.info("kanji using new card", extra={"card_id": card_id})
        else:
            logger.warning("kanji study exhausted level=%s phase=%s mode=%s user_id=%s", level, phase, phase_key, user_id)
            return {"done": True}

    raw_id  = unprefixed(card_id, user_id)
    entry   = next(k for k in kanji_list if kanji_to_id(k, level) == raw_id)
    meaning = get_meaning(entry, lang, FR_MAP)

    all_candidates = [
        k for k in kanji_list
        if get_meaning(k, lang, FR_MAP) != meaning
    ]
    choice_entries = random.sample(all_candidates, min(3, len(all_candidates))) + [entry]
    random.shuffle(choice_entries)

    choices = [
        {
            "kanji": c.get("kanji", ""),
            "meaning": get_meaning(c, lang, FR_MAP),
        }
        for c in choice_entries
    ]

    return {
        "card_id":      raw_id,
        "phase":        phase,
        "phase_key":    phase_key,
        "kanji":        entry.get("kanji", ""),
        "kana":         entry.get("kana", ""),
        "meaning":      meaning,
        "stroke_count": entry.get("stroke_count", ""),
        "choices":      choices,
    }


@router.post("/api/kanji/review")
def post_kanji_review(payload: ReviewPayload, user_id: str = Depends(get_user_id)):
    card_id = f"{user_id}:{payload.card_id}"
    s = srs.review(card_id, payload.mode, payload.quality)
    return {"card_id": payload.card_id, "interval": s["interval"], "next_review": s["next_review"]}