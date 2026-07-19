import logging
import random
from fastapi import APIRouter, Depends
from vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from auth import get_user_id, prefixed, unprefixed
from srs_instance import srs
from srs.batch_cache import ensure_initialized, key as batch_key, take_next
from translations import get_meaning
from translations.fr.vocab_fr import VOCAB_FR
from quiz_modes import QCM_FLASHCARD_MODES as MODE_INFO
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

class ReviewPayload(BaseModel):
    card_id: str
    mode:    str
    quality: int

FR_MAP = VOCAB_FR


@router.get("/api/vocab/card")
def get_vocab_card(level: str, mode: str, lang: str = "fr",
                   user_id: str = Depends(get_user_id)):
    vocab_list = VOCAB_BY_LEVEL.get(level)
    if not vocab_list:
        return {"error": "Unknown level"}
    if mode not in MODE_INFO:
        return {"error": "Invalid mode"}

    raw_ids  = [vocab_to_id(w, level) for w in vocab_list]
    card_ids = prefixed(raw_ids, user_id)
    cache_key = batch_key("user", user_id, mode, level)
    ensure_initialized(cache_key, lambda: srs.ensure_cards(card_ids, mode), version=card_ids)

    due = srs.get_due_cards(mode, limit=10, card_ids=card_ids)
    logger.info("vocab study request mode=%s level=%s user_id=%s candidate_count=%d due_count=%d due_ids=%s", mode, level, user_id, len(card_ids), len(due), due[:10])
    if due:
        card_id = random.choice(due)
        logger.info("vocab using due card", extra={"card_id": card_id, "due_count": len(due)})
    else:
        new = take_next(cache_key, lambda limit: srs.get_new_cards(mode, limit=limit, card_ids=card_ids), limit=10)
        logger.info("vocab fallback to new card new_count=%d new_ids=%s", 1 if new else 0, [new] if new else [])
        if new:
            card_id = new
            logger.info("vocab using new card", extra={"card_id": card_id})
        else:
            logger.warning("vocab study exhausted mode=%s level=%s user_id=%s", mode, level, user_id)
            return {"done": True}

    raw_id = unprefixed(card_id, user_id)

    word = next((w for w in vocab_list if vocab_to_id(w, level) == raw_id), None)
    if word is None:
        return {"done": True}

    meaning = get_meaning(word, lang, FR_MAP)
    fmt, direction = MODE_INFO[mode]

    payload = {
        "card_id":   raw_id,
        "mode":      mode,
        "format":    fmt,
        "direction": direction,
        "kanji":     word.get("kanji", ""),
        "kana":      word.get("kana", ""),
        "meaning":   meaning,
    }

    if fmt == "qcm":
        all_candidates = [w for w in vocab_list if get_meaning(w, lang, FR_MAP) != meaning]
        choice_entries = random.sample(all_candidates, min(3, len(all_candidates))) + [word]
        random.shuffle(choice_entries)
        payload["choices"] = [
            {
                "kanji":   c.get("kanji", ""),
                "kana":    c.get("kana", ""),
                "meaning": get_meaning(c, lang, FR_MAP),
            }
            for c in choice_entries
        ]

    return payload


@router.post("/api/vocab/review")
def post_vocab_review(payload: ReviewPayload, user_id: str = Depends(get_user_id)):
    card_id = f"{user_id}:{payload.card_id}"
    s = srs.review(card_id, payload.mode, payload.quality)
    return {
        "card_id": payload.card_id,
        "interval": s["interval"],
        "next_review": s["next_review"],
        "xp_earned": s["xp_earned"],
        "leveled_up": s["leveled_up"],
        "new_level": s["new_level"],
    }


@router.get("/api/vocab/stats")
def get_vocab_stats(level: str, mode: str, user_id: str = Depends(get_user_id)):
    """
    Lightweight, per-level/mode progress (à apprendre / en cours / maîtrisé).
    Scoped to a single level+mode (unlike /api/stats, which recomputes
    every category for the whole user) so it's cheap enough to call after
    every review.
    """
    vocab_list = VOCAB_BY_LEVEL.get(level)
    if not vocab_list:
        return {"error": "Unknown level"}
    if mode not in MODE_INFO:
        return {"error": "Invalid mode"}

    raw_ids  = [vocab_to_id(w, level) for w in vocab_list]
    card_ids = prefixed(raw_ids, user_id)

    states  = srs.get_bulk_stats(card_ids, mode)
    due     = srs.get_due_cards(mode, limit=len(card_ids), card_ids=card_ids)

    return {
        "total":    len(card_ids),
        "new":      sum(1 for s in states.values() if s == "new"),
        "learning": sum(1 for s in states.values() if s == "learning"),
        "mastered": sum(1 for s in states.values() if s == "mastered"),
        "due_now":  len(due),
    }