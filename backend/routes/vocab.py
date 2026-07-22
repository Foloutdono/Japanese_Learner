import logging
import random
from fastapi import APIRouter, Depends
from vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from auth import get_user_id, prefixed, unprefixed
from srs_instance import srs
from srs.batch_cache import ensure_initialized, key as batch_key, pick_ids
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

# Card stage promotions worth a visual "stamp" on the frontend (see
# CardStamp.jsx) — only the two forward crossings the SRS ladder can
# make in one review: new → learning, learning → mastered. Anything
# else (no change, or dropping back out of mastered on a lapsed
# review) is None, and the frontend simply doesn't stamp the card.
STAGE_PROMOTIONS = {
    ("new", "learning"): "learning",
    ("learning", "mastered"): "mastered",
}


def _stage_promotion(prev_stage: str | None, new_stage: str | None) -> str | None:
    if not prev_stage or not new_stage:
        return None
    return STAGE_PROMOTIONS.get((prev_stage, new_stage))

FR_MAP = VOCAB_FR
MAX_BATCH = 25


def _build_vocab_card(raw_id: str, word: dict, vocab_list: list[dict], mode: str, lang: str) -> dict:
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


def _select_cards(level: str, mode: str, lang: str, count: int, exclude_ids: set[str], user_id: str):
    """
    Shared by /api/vocab/card and /api/vocab/cards. Returns
    (vocab_list, cards) — vocab_list is None for an unknown level or
    invalid mode (callers re-check which, to keep the exact original
    error messages).
    """
    vocab_list = VOCAB_BY_LEVEL.get(level)
    if not vocab_list or mode not in MODE_INFO:
        return None, None

    raw_ids   = [vocab_to_id(w, level) for w in vocab_list]
    card_ids  = prefixed(raw_ids, user_id)
    cache_key = batch_key("user", user_id, mode, level)
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
        word = next((w for w in vocab_list if vocab_to_id(w, level) == raw_id), None)
        if word is not None:
            cards.append(_build_vocab_card(raw_id, word, vocab_list, mode, lang))

    logger.info(
        "vocab study request level=%s mode=%s user_id=%s requested=%d due_count=%d picked=%d",
        level, mode, user_id, count, len(due), len(cards),
    )
    return vocab_list, cards


@router.get("/api/vocab/card")
def get_vocab_card(level: str, mode: str, lang: str = "fr",
                   user_id: str = Depends(get_user_id)):
    vocab_list, cards = _select_cards(level, mode, lang, count=1, exclude_ids=set(), user_id=user_id)
    if vocab_list is None:
        if level not in VOCAB_BY_LEVEL:
            return {"error": "Unknown level"}
        return {"error": "Invalid mode"}
    if not cards:
        logger.warning("vocab study exhausted level=%s mode=%s user_id=%s", level, mode, user_id)
        return {"done": True}
    return cards[0]


@router.get("/api/vocab/cards")
def get_vocab_cards(level: str, mode: str, lang: str = "fr", count: int = 10, exclude: str = "",
                    user_id: str = Depends(get_user_id)):
    """
    Batch version of /api/vocab/card — returns up to `count` cards at
    once so the frontend can keep a session queue filled instead of
    fetching one card per answer. `exclude` is a comma-separated list
    of raw (unprefixed) card ids the client already has queued but
    hasn't reviewed yet.
    """
    vocab_list, cards = _select_cards(
        level, mode, lang,
        count=max(1, min(count, MAX_BATCH)),
        exclude_ids={f"{user_id}:{cid}" for cid in exclude.split(",") if cid},
        user_id=user_id,
    )
    if vocab_list is None:
        if level not in VOCAB_BY_LEVEL:
            return {"error": "Unknown level"}
        return {"error": "Invalid mode"}
    return {"cards": cards}


@router.post("/api/vocab/review")
def post_vocab_review(payload: ReviewPayload, user_id: str = Depends(get_user_id)):
    card_id = f"{user_id}:{payload.card_id}"
    # Stage before and after the review — same get_bulk_stats used by
    # /api/vocab/stats, just scoped to this one card, so the "new /
    # learning / mastered" classification is never reimplemented here
    # and can't drift out of sync with the stats screen's own count.
    prev_stage = srs.get_bulk_stats([card_id], payload.mode).get(card_id)
    s = srs.review(card_id, payload.mode, payload.quality)
    new_stage = srs.get_bulk_stats([card_id], payload.mode).get(card_id)
    return {
        "card_id": payload.card_id,
        "interval": s["interval"],
        "next_review": s["next_review"],
        "xp_earned": s["xp_earned"],
        "leveled_up": s["leveled_up"],
        "new_level": s["new_level"],
        "stage_up": _stage_promotion(prev_stage, new_stage),
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