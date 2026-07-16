import logging
import random
from fastapi import APIRouter, Depends
from kanji_data import KANJI_BY_LEVEL, kanji_to_id
from auth import get_user_id, prefixed, unprefixed
from srs_instance import srs
from srs.batch_cache import ensure_initialized, key as batch_key, take_next
from translations import get_meaning
from translations.fr.kanji_fr import KANJI_FR
from quiz_modes import QCM_FLASHCARD_MODES, KANJI_MODES
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

class ReviewPayload(BaseModel):
    card_id: str
    mode:    str
    quality: int

FR_MAP = KANJI_FR
VALID_MODES = set(KANJI_MODES)


@router.get("/api/kanji/card")
def get_kanji_card(level: str, mode: str, lang: str = "fr",
                   user_id: str = Depends(get_user_id)):
    kanji_list = KANJI_BY_LEVEL.get(level)
    if not kanji_list:
        return {"error": "Unknown level"}
    if mode not in VALID_MODES:
        return {"error": "Invalid mode"}

    raw_ids  = [kanji_to_id(k, level) for k in kanji_list]
    card_ids = prefixed(raw_ids, user_id)
    cache_key = batch_key("user", user_id, mode, level)
    ensure_initialized(cache_key, lambda: srs.ensure_cards(card_ids, mode))

    due = srs.get_due_cards(mode, limit=10, card_ids=card_ids)
    logger.info("kanji study request level=%s mode=%s user_id=%s candidate_count=%d due_count=%d due_ids=%s", level, mode, user_id, len(card_ids), len(due), due[:10])
    if due:
        card_id = random.choice(due)
        logger.info("kanji using due card", extra={"card_id": card_id, "due_count": len(due)})
    else:
        new = take_next(cache_key, lambda limit: srs.get_new_cards(mode, limit=limit, card_ids=card_ids), limit=10)
        logger.info("kanji fallback to new card new_count=%d new_ids=%s", 1 if new else 0, [new] if new else [])
        if new:
            card_id = new
            logger.info("kanji using new card", extra={"card_id": card_id})
        else:
            logger.warning("kanji study exhausted level=%s mode=%s user_id=%s", level, mode, user_id)
            return {"done": True}

    raw_id  = unprefixed(card_id, user_id)
    entry   = next((k for k in kanji_list if kanji_to_id(k, level) == raw_id), None)
    if entry is None:
        return {"done": True}
    meaning = get_meaning(entry, lang, FR_MAP)

    payload = {
        "card_id":      raw_id,
        "mode":         mode,
        "kanji":        entry.get("kanji", ""),
        "kana":         entry.get("kana", ""),
        "meaning":      meaning,
        "stroke_count": entry.get("stroke_count", ""),
    }

    if mode == "write":
        return payload

    fmt, direction = QCM_FLASHCARD_MODES[mode]
    payload["format"]    = fmt
    payload["direction"] = direction

    if fmt == "qcm":
        all_candidates = [k for k in kanji_list if get_meaning(k, lang, FR_MAP) != meaning]
        choice_entries = random.sample(all_candidates, min(3, len(all_candidates))) + [entry]
        random.shuffle(choice_entries)
        payload["choices"] = [
            {"kanji": c.get("kanji", ""), "meaning": get_meaning(c, lang, FR_MAP)}
            for c in choice_entries
        ]

    return payload


@router.post("/api/kanji/review")
def post_kanji_review(payload: ReviewPayload, user_id: str = Depends(get_user_id)):
    card_id = f"{user_id}:{payload.card_id}"
    s = srs.review(card_id, payload.mode, payload.quality)
    return {"card_id": payload.card_id, "interval": s["interval"], "next_review": s["next_review"]}


@router.get("/api/kanji/stats")
def get_kanji_stats(level: str, mode: str, user_id: str = Depends(get_user_id)):
    """
    Lightweight, per-level/mode progress (à apprendre / en cours / maîtrisé).
    Scoped to a single level+mode (unlike /api/stats, which recomputes
    every category for the whole user) so it's cheap enough to call after
    every review.
    """
    kanji_list = KANJI_BY_LEVEL.get(level)
    if not kanji_list:
        return {"error": "Unknown level"}
    if mode not in VALID_MODES:
        return {"error": "Invalid mode"}

    raw_ids  = [kanji_to_id(k, level) for k in kanji_list]
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