import logging
import random
from fastapi import APIRouter, Depends
from kanji_data import KANJI_BY_LEVEL, kanji_to_id
from auth import get_user_id, prefixed, unprefixed
from srs_instance import srs
from srs.batch_cache import ensure_initialized, key as batch_key, pick_ids
from translations import get_meaning
from translations.fr.kanji_fr import KANJI_FR
from quiz_modes import QCM_FLASHCARD_MODES, KANJI_MODES
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

class ReviewPayload(BaseModel):
    card_id:    str
    mode:       str
    quality:    int
    # The card's stage *before* this review, exactly as it was handed
    # back on the card payload (see _build_kanji_card's "stage" field
    # below) — sent back by the client instead of looked up again here.
    # This used to be a second srs.get_bulk_stats() call made inline in
    # post_kanji_review, on top of the one needed for the post-review
    # stage: two blocking bulk-stats round trips on the same request
    # that answers every rating, which is exactly the "never blocks
    # card navigation" rule the rest of this file is careful about
    # everywhere else (see loadProgress on the frontend, or how /stats
    # is deliberately its own request). Reusing the value already
    # computed once per batch removes that whole extra call from the
    # critical path.
    prev_stage: str | None = None

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

FR_MAP = KANJI_FR
VALID_MODES = set(KANJI_MODES)
MAX_BATCH = 25


def _build_kanji_card(raw_id: str, entry: dict, kanji_list: list[dict], mode: str, lang: str, stage: str | None) -> dict:
    meaning = get_meaning(entry, lang, FR_MAP)
    payload = {
        "card_id":      raw_id,
        "mode":         mode,
        "kanji":        entry.get("kanji", ""),
        "kana":         entry.get("kana", ""),
        "meaning":      meaning,
        "stroke_count": entry.get("stroke_count", ""),
        # Current SRS stage, so the client can hand it straight back
        # as ReviewPayload.prev_stage without another lookup — see the
        # comment on that field for why that matters.
        "stage":        stage,
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


def _select_cards(level: str, mode: str, lang: str, count: int, exclude_ids: set[str], user_id: str):
    """
    Shared by /api/kanji/card and /api/kanji/cards. Returns
    (kanji_list, cards) — kanji_list is None for an unknown level or
    invalid mode (callers re-check which, to keep the exact original
    error messages).
    """
    kanji_list = KANJI_BY_LEVEL.get(level)
    if not kanji_list or mode not in VALID_MODES:
        return None, None

    raw_ids   = [kanji_to_id(k, level) for k in kanji_list]
    card_ids  = prefixed(raw_ids, user_id)
    cache_key = batch_key("user", user_id, mode, level)
    ensure_initialized(cache_key, lambda: srs.ensure_cards(card_ids, mode), version=card_ids)

    due = srs.get_due_cards(mode, card_ids=card_ids)
    picked = pick_ids(
        cache_key, due,
        lambda limit: srs.get_new_cards(mode, limit=limit, card_ids=card_ids),
        count, exclude_ids,
    )

    # One bulk-stats call for just the handful of cards actually being
    # returned (at most MAX_BATCH), not the whole deck — cheap, and it
    # means every card handed to the client already carries its own
    # stage, so reviewing it later needs no extra lookup to know what
    # it was before.
    states = srs.get_bulk_stats(picked, mode)

    cards = []
    for card_id in picked:
        raw_id = unprefixed(card_id, user_id)
        entry = next((k for k in kanji_list if kanji_to_id(k, level) == raw_id), None)
        if entry is not None:
            cards.append(_build_kanji_card(raw_id, entry, kanji_list, mode, lang, states.get(card_id)))

    logger.info(
        "kanji study request level=%s mode=%s user_id=%s requested=%d due_count=%d picked=%d",
        level, mode, user_id, count, len(due), len(cards),
    )
    return kanji_list, cards


@router.get("/api/kanji/card")
def get_kanji_card(level: str, mode: str, lang: str = "fr",
                   user_id: str = Depends(get_user_id)):
    kanji_list, cards = _select_cards(level, mode, lang, count=1, exclude_ids=set(), user_id=user_id)
    if kanji_list is None:
        if level not in KANJI_BY_LEVEL:
            return {"error": "Unknown level"}
        return {"error": "Invalid mode"}
    if not cards:
        logger.warning("kanji study exhausted level=%s mode=%s user_id=%s", level, mode, user_id)
        return {"done": True}
    return cards[0]


@router.get("/api/kanji/cards")
def get_kanji_cards(level: str, mode: str, lang: str = "fr", count: int = 10, exclude: str = "",
                    user_id: str = Depends(get_user_id)):
    """
    Batch version of /api/kanji/card — returns up to `count` cards at
    once so the frontend can keep a session queue filled instead of
    fetching one card per answer. `exclude` is a comma-separated list
    of raw (unprefixed) card ids the client already has queued but
    hasn't reviewed yet.
    """
    kanji_list, cards = _select_cards(
        level, mode, lang,
        count=max(1, min(count, MAX_BATCH)),
        exclude_ids={f"{user_id}:{cid}" for cid in exclude.split(",") if cid},
        user_id=user_id,
    )
    if kanji_list is None:
        if level not in KANJI_BY_LEVEL:
            return {"error": "Unknown level"}
        return {"error": "Invalid mode"}
    return {"cards": cards}


@router.post("/api/kanji/review")
def post_kanji_review(payload: ReviewPayload, user_id: str = Depends(get_user_id)):
    card_id = f"{user_id}:{payload.card_id}"
    s = srs.review(card_id, payload.mode, payload.quality)
    # Only one bulk-stats call now (the post-review stage) instead of
    # two — the pre-review stage comes from the client, which already
    # had it on the card payload (see _select_cards). This is the same
    # single-card get_bulk_stats /api/kanji/stats already calls at deck
    # scale, so the classification logic still only lives in one place.
    new_stage = srs.get_bulk_stats([card_id], payload.mode).get(card_id)
    return {
        "card_id": payload.card_id,
        "interval": s["interval"],
        "next_review": s["next_review"],
        "xp_earned": s["xp_earned"],
        "leveled_up": s["leveled_up"],
        "new_level": s["new_level"],
        "stage_up": _stage_promotion(payload.prev_stage, new_stage),
    }


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