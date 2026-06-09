import logging
import random
from fastapi import APIRouter, Depends
from kana_data import KANA_SETS, kana_to_id
from auth import get_user_id, prefixed, unprefixed
from srs_instance import srs
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
    srs.ensure_cards(card_ids, mode)

    due = [cid for cid in srs.get_due_cards(mode) if cid in set(card_ids)]
    logger.info("kana study request", extra={"set_name": set_name, "mode": mode, "user_id": user_id, "candidate_count": len(card_ids), "due_count": len(due), "due_ids": due[:10]})
    if due:
        card_id = random.choice(due)
        logger.info("kana using due card", extra={"card_id": card_id, "due_count": len(due)})
    else:
        new = [cid for cid in srs.get_new_cards(mode, limit=1) if cid in set(card_ids)]
        logger.info("kana fallback to new card", extra={"new_count": len(new), "new_ids": new[:10]})
        if new:
            card_id = new[0]
            logger.info("kana using new card", extra={"card_id": card_id})
        else:
            logger.warning("kana study exhausted", extra={"set_name": set_name, "mode": mode, "user_id": user_id})
            return {"done": True}

    raw_id     = unprefixed(card_id, user_id)
    kana_entry = next(k for k in kana_list if kana_to_id(k) == raw_id)

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


@router.post("/api/kana/review")
def post_kana_review(payload: ReviewPayload, user_id: str = Depends(get_user_id)):
    card_id = f"{user_id}:{payload.card_id}"
    s = srs.review(card_id, payload.mode, payload.quality)
    return {"card_id": payload.card_id, "interval": s["interval"], "next_review": s["next_review"]}