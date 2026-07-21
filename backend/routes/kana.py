import logging
import random
from fastapi import APIRouter, Depends
from kana_data import KANA_SETS, kana_to_id
from auth import get_user_id, prefixed, unprefixed
from srs_instance import srs
from srs.batch_cache import ensure_initialized, key as batch_key, pick_ids
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_BATCH = 25


class ReviewPayload(BaseModel):
    card_id: str
    mode:    str
    quality: int


@router.get("/api/kana/sets")
def get_kana_sets():
    return {"sets": list(KANA_SETS.keys())}


def _build_kana_card(kana_entry: dict, kana_list: list[dict], mode: str) -> dict:
    all_romaji = [k["romaji"] for k in kana_list if k["romaji"] != kana_entry["romaji"]]
    choices    = random.sample(all_romaji, min(3, len(all_romaji))) + [kana_entry["romaji"]]
    random.shuffle(choices)
    return {
        "card_id": kana_to_id(kana_entry),
        "kana":    kana_entry["kana"],
        "romaji":  kana_entry["romaji"],
        "choices": choices,
        "mode":    mode,
    }


def _select_cards(set_name: str, mode: str, count: int, exclude_ids: set[str], user_id: str):
    """
    Shared by /api/kana/card and /api/kana/cards: resolves the set,
    makes sure the cards/card_modes rows exist, picks up to `count`
    due/new card ids (excluding anything already sitting unreviewed
    in the caller's queue), and builds the full payload for each.
    Returns (kana_list, cards) — kana_list is None for an unknown set.
    """
    kana_list = KANA_SETS.get(set_name)
    if not kana_list:
        return None, None

    raw_ids   = [kana_to_id(k) for k in kana_list]
    card_ids  = prefixed(raw_ids, user_id)
    cache_key = batch_key("user", user_id, mode, set_name)
    ensure_initialized(cache_key, lambda: srs.ensure_cards(card_ids, mode), version=card_ids)

    due = srs.get_due_cards(mode, card_ids=card_ids)
    picked = pick_ids(
        cache_key, due,
        lambda limit: srs.get_new_cards(mode, limit=limit, card_ids=card_ids),
        count, exclude_ids,
    )

    cards = []
    for card_id in picked:
        raw_id = unprefixed(card_id, user_id)
        kana_entry = next((k for k in kana_list if kana_to_id(k) == raw_id), None)
        if kana_entry is not None:
            cards.append(_build_kana_card(kana_entry, kana_list, mode))

    logger.info(
        "kana study request set_name=%s mode=%s user_id=%s requested=%d due_count=%d picked=%d",
        set_name, mode, user_id, count, len(due), len(cards),
    )
    return kana_list, cards


@router.get("/api/kana/card")
def get_kana_card(set_name: str, mode: str, user_id: str = Depends(get_user_id)):
    kana_list, cards = _select_cards(set_name, mode, count=1, exclude_ids=set(), user_id=user_id)
    if kana_list is None:
        print(f"Unknown set: {set_name}")
        return {"error": "Unknown set"}
    if not cards:
        logger.warning("kana study exhausted set_name=%s mode=%s user_id=%s", set_name, mode, user_id)
        return {"done": True}
    return cards[0]


@router.get("/api/kana/cards")
def get_kana_cards(set_name: str, mode: str, count: int = 10, exclude: str = "",
                    user_id: str = Depends(get_user_id)):
    """
    Batch version of /api/kana/card — returns up to `count` cards at
    once so the frontend can keep a session queue filled instead of
    fetching one card per answer. `exclude` is a comma-separated list
    of raw (unprefixed) card ids the client already has queued but
    hasn't reviewed yet.
    """
    kana_list, cards = _select_cards(
        set_name, mode,
        count=max(1, min(count, MAX_BATCH)),
        exclude_ids={f"{user_id}:{cid}" for cid in exclude.split(",") if cid},
        user_id=user_id,
    )
    if kana_list is None:
        return {"error": "Unknown set"}
    return {"cards": cards}


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
        "leveled_up": s["leveled_up"],
        "new_level": s["new_level"],
    }