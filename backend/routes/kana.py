import logging
import random
from fastapi import APIRouter, Depends
from kana_data import KANA_SETS, kana_to_id
from auth import get_user_id, prefixed, unprefixed
from srs_instance import srs
from srs.batch_cache import ensure_initialized, key as batch_key, take_next
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

class ReviewPayload(BaseModel):
    card_id: str
    mode:    str
    quality: int


@router.get("/api/kana/sets")
def get_kana_sets():
    return {"sets": list(KANA_SETS.keys())}


@router.get("/api/kana/card")
def get_kana_card(set_name: str, mode: str, user_id: str = Depends(get_user_id)):
    kana_list = KANA_SETS.get(set_name)
    if not kana_list:
        print(f"Unknown set: {set_name}")
        return {"error": "Unknown set"}

    raw_ids  = [kana_to_id(k) for k in kana_list]
    card_ids = prefixed(raw_ids, user_id)
    cache_key = batch_key("user", user_id, mode, set_name)
    ensure_initialized(cache_key, lambda: srs.ensure_cards(card_ids, mode), version=card_ids)

    due = srs.get_due_cards(mode, limit=10, card_ids=card_ids)
    logger.info("kana study request set_name=%s mode=%s user_id=%s candidate_count=%d due_count=%d due_ids=%s", set_name, mode, user_id, len(card_ids), len(due), due[:10])
    if due:
        card_id = random.choice(due)
        logger.info("kana using due card", extra={"card_id": card_id, "due_count": len(due)})
    else:
        new = take_next(cache_key, lambda limit: srs.get_new_cards(mode, limit=limit, card_ids=card_ids), limit=10)
        logger.info("kana fallback to new card new_count=%d new_ids=%s", 1 if new else 0, [new] if new else [])
        if new:
            card_id = new
            logger.info("kana using new card", extra={"card_id": card_id})
        else:
            logger.warning("kana study exhausted set_name=%s mode=%s user_id=%s", set_name, mode, user_id)
            return {"done": True}

    raw_id     = unprefixed(card_id, user_id)
    kana_entry = next((k for k in kana_list if kana_to_id(k) == raw_id), None)

    if kana_entry is None:
        return {"done": True}

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


@router.get("/api/kana/stats")
def get_kana_stats(set_name: str, mode: str, user_id: str = Depends(get_user_id)):
    """
    Lightweight, per-set/mode progress (à apprendre / en cours / maîtrisé).
    Unlike /api/stats (which recomputes every category for the whole user),
    this only touches the card_ids for this one set and does a single
    bulk-state lookup, so it's cheap enough to call after every review.
    """
    kana_list = KANA_SETS.get(set_name)
    if not kana_list:
        return {"error": "Unknown set"}

    raw_ids  = [kana_to_id(k) for k in kana_list]
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


@router.post("/api/kana/review")
def post_kana_review(payload: ReviewPayload, user_id: str = Depends(get_user_id)):
    card_id = f"{user_id}:{payload.card_id}"
    s = srs.review(card_id, payload.mode, payload.quality)
    return {
        "card_id": payload.card_id,
        "interval": s["interval"],
        "next_review": s["next_review"],
        "xp_earned": s["xp_earned"],
    }