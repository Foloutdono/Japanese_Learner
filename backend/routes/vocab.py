import logging
import random
from fastapi import APIRouter, Depends
from vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from auth import get_user_id, prefixed, unprefixed
from srs_instance import srs
from srs.batch_cache import ensure_initialized, key as batch_key, take_next
from translations import get_meaning, get_meanings
from translations.fr.vocab_fr import VOCAB_FR
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

class ReviewPayload(BaseModel):
    card_id: str
    mode:    str
    quality: int

FR_MAP = VOCAB_FR


@router.get("/api/vocab/card")
def get_vocab_card(level: str, phase: int, lang: str = "fr",
                   user_id: str = Depends(get_user_id)):
    vocab_list = VOCAB_BY_LEVEL.get(level)
    if not vocab_list:
        return {"error": "Unknown level"}

    phase_key = {1: "kk-s", 2: "k-k", 3: "s-k"}.get(phase)
    if not phase_key:
        return {"error": "Invalid phase"}

    raw_ids  = [vocab_to_id(w, level) for w in vocab_list]
    card_ids = prefixed(raw_ids, user_id)
    cache_key = batch_key("user", user_id, phase_key, level)
    ensure_initialized(cache_key, lambda: srs.ensure_cards(card_ids, phase_key))

    due = srs.get_due_cards(phase_key, limit=10, card_ids=card_ids)
    logger.info("vocab study request phase=%s level=%s mode=%s user_id=%s candidate_count=%d due_count=%d due_ids=%s", phase, level, phase_key, user_id, len(card_ids), len(due), due[:10])
    if due:
        card_id = random.choice(due)
        logger.info("vocab using due card", extra={"card_id": card_id, "due_count": len(due)})
    else:
        new = take_next(cache_key, lambda limit: srs.get_new_cards(phase_key, limit=limit, card_ids=card_ids), limit=10)
        logger.info("vocab fallback to new card new_count=%d new_ids=%s", 1 if new else 0, [new] if new else [])
        if new:
            card_id = new
            logger.info("vocab using new card", extra={"card_id": card_id})
        else:
            logger.warning("vocab study exhausted phase=%s level=%s mode=%s user_id=%s", phase, level, phase_key, user_id)
            return {"done": True}

    raw_id  = unprefixed(card_id, user_id)
    
    word = next((w for w in vocab_list if vocab_to_id(w, level) == raw_id), None)
    if word is None:
        return {"done": True}
    
    meaning = get_meaning(word, lang, FR_MAP)

    all_meanings = [
        get_meaning(w, lang, FR_MAP)
        for w in vocab_list
        if get_meaning(w, lang, FR_MAP) != meaning
    ]
    choices = random.sample(all_meanings, min(3, len(all_meanings))) + [meaning]
    random.shuffle(choices)

    return {
        "card_id":   raw_id,
        "phase":     phase,
        "phase_key": phase_key,
        "kanji":     word.get("kanji", ""),
        "kana":      word.get("kana", ""),
        "meaning":   meaning,
        "choices":   choices,
    }


@router.post("/api/vocab/review")
def post_vocab_review(payload: ReviewPayload, user_id: str = Depends(get_user_id)):
    card_id = f"{user_id}:{payload.card_id}"
    s = srs.review(card_id, payload.mode, payload.quality)
    return {"card_id": payload.card_id, "interval": s["interval"], "next_review": s["next_review"]}