import logging
import random
from fastapi import APIRouter, Depends
from content.kana_data import KANA_SETS, kana_to_id
from core.auth import get_user_id, prefixed, unprefixed
from core.srs_instance import srs
from srs.batch_cache import ensure_initialized, key as batch_key, pick_ids
from study.quiz_modes import KANA_MODES
from study.modes import KANA, Mode, require_mode
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_BATCH = 25


class ReviewPayload(BaseModel):
    card_id:    str
    mode:       str
    quality:    int
    # The card's stage *before* this review, exactly as it was handed
    # back on the card payload (see _build_kana_card's "stage" field
    # below) — sent back by the client instead of looked up again here.
    # This used to be a second srs.get_bulk_stats() call made inline in
    # post_kana_review, on top of the one needed for the post-review
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

# See kanji.py's own copy of this pair for the full reasoning.
STAGE_DEMOTIONS = {
    ("mastered", "learning"): "learning",
}


def _stage_demotion(prev_stage: str | None, new_stage: str | None) -> str | None:
    if not prev_stage or not new_stage:
        return None
    return STAGE_DEMOTIONS.get((prev_stage, new_stage))


@router.get("/api/kana/sets")
def get_kana_sets():
    return {"sets": list(KANA_SETS.keys())}


def _build_review_preview(stage: str | None, preview: dict[int, dict] | None) -> dict | None:
    """Turns SRSEngine.preview_reviews_bulk()'s per-card output into
    the exact shape the frontend indexes by quality — xp/level as-is,
    plus stage_up/stage_down resolved against this card's *current*
    stage the same way post_*_review does after a real review (see
    _stage_promotion/_stage_demotion). None when no preview was
    computed (e.g. the legacy single-card endpoints below don't
    bother — see get_kana_card)."""
    if not preview:
        return None
    return {
        str(quality): {
            "xp_earned":  p["xp_earned"],
            "leveled_up": p["leveled_up"],
            "new_level":  p["new_level"],
            "stage_up":   _stage_promotion(stage, p["stage"]),
            "stage_down": _stage_demotion(stage, p["stage"]),
        }
        for quality, p in preview.items()
    }


def _build_kana_card(kana_entry: dict, kana_list: list[dict], mode: str, stage: str | None,
                      preview: dict[int, dict] | None = None) -> dict:
    all_romaji = [k["romaji"] for k in kana_list if k["romaji"] != kana_entry["romaji"]]
    choices    = random.sample(all_romaji, min(3, len(all_romaji))) + [kana_entry["romaji"]]
    random.shuffle(choices)
    return {
        "card_id": kana_to_id(kana_entry),
        "kana":    kana_entry["kana"],
        "romaji":  kana_entry["romaji"],
        "choices": choices,
        "mode":    mode,
        # Current SRS stage, so the client can hand it straight back
        # as ReviewPayload.prev_stage without another lookup — see the
        # comment on that field for why that matters.
        "stage":   stage,
        # Exact xp/level/stage-up outcome for every possible rating,
        # precomputed now so postReview on the frontend never has to
        # guess or wait on a round trip to know what just happened —
        # see preview_reviews_bulk's docstring for the full reasoning.
        "review_preview": _build_review_preview(stage, preview),
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

    # One bulk-stats call for just the handful of cards actually being
    # returned (at most MAX_BATCH), not the whole deck — cheap, and it
    # means every card handed to the client already carries its own
    # stage, so reviewing it later needs no extra lookup to know what
    # it was before.
    states = srs.get_bulk_stats(picked, mode)
    # Same idea, but for the full xp/level/stage outcome of every
    # possible rating (0-5) — see preview_reviews_bulk and
    # _build_review_preview above.
    previews = srs.preview_reviews_bulk(picked, mode, user_id)

    cards = []
    for card_id in picked:
        raw_id = unprefixed(card_id, user_id)
        kana_entry = next((k for k in kana_list if kana_to_id(k) == raw_id), None)
        if kana_entry is not None:
            cards.append(_build_kana_card(kana_entry, kana_list, mode, states.get(card_id), previews.get(card_id)))

    logger.info(
        "kana study request set_name=%s mode=%s user_id=%s requested=%d due_count=%d picked=%d",
        set_name, mode, user_id, count, len(due), len(cards),
    )
    return kana_list, cards


@router.get("/api/kana/card")
def get_kana_card(set_name: str, m: Mode = Depends(require_mode(KANA)),
                   user_id: str = Depends(get_user_id)):
    mode = m.key
    kana_list, cards = _select_cards(set_name, mode, count=1, exclude_ids=set(), user_id=user_id)
    if kana_list is None:
        print(f"Unknown set: {set_name}")
        return {"error": "Unknown set"}
    if not cards:
        logger.warning("kana study exhausted set_name=%s mode=%s user_id=%s", set_name, mode, user_id)
        return {"done": True}
    return cards[0]


@router.get("/api/kana/cards")
def get_kana_cards(set_name: str, count: int = 10, exclude: str = "",
                    m: Mode = Depends(require_mode(KANA)),
                    user_id: str = Depends(get_user_id)):
    """
    Batch version of /api/kana/card — returns up to `count` cards at
    once so the frontend can keep a session queue filled instead of
    fetching one card per answer. `exclude` is a comma-separated list
    of raw (unprefixed) card ids the client already has queued but
    hasn't reviewed yet.
    """
    mode = m.key
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
def get_kana_stats(set_name: str, m: Mode = Depends(require_mode(KANA)),
                    user_id: str = Depends(get_user_id)):
    """
    Lightweight, per-set/mode progress (à apprendre / en cours / maîtrisé).
    Unlike /api/stats (which recomputes every category for the whole user),
    this only touches the card_ids for this one set and does a single
    bulk-state lookup, so it's cheap enough to call after every review.
    """
    mode = m.key
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


@router.get("/api/kana/review-cards")
def get_kana_review_cards(set_name: str, user_id: str = Depends(get_user_id)):
    """
    Every card in this set the user has already studied, in ANY mode
    (qcm/flashcard/write) — not just due ones — for a self-paced,
    ungraded browse of "cards I already know" instead of an SRS-driven
    session. `stage` is the most advanced stage reached across those
    modes (mastered beats learning beats new): progress is tracked per
    (card, mode) pair, and someone browsing what they've learned
    shouldn't have to pick which specific drill type's progress to
    check first.
    """
    kana_list = KANA_SETS.get(set_name)
    if not kana_list:
        return {"error": "Unknown set"}

    raw_ids  = [kana_to_id(k) for k in kana_list]
    card_ids = prefixed(raw_ids, user_id)
    per_mode_states = {m: srs.get_bulk_stats(card_ids, m) for m in KANA_MODES}

    cards = []
    for kana_entry, card_id in zip(kana_list, card_ids):
        stages = [per_mode_states[m].get(card_id, "new") for m in KANA_MODES]
        stage = "mastered" if "mastered" in stages else "learning" if "learning" in stages else "new"
        if stage == "new":
            continue
        cards.append({
            "card_id": kana_to_id(kana_entry),
            "kana":    kana_entry["kana"],
            "romaji":  kana_entry["romaji"],
            "stage":   stage,
        })

    logger.info(
        "kana review request set_name=%s user_id=%s studied=%d/%d",
        set_name, user_id, len(cards), len(kana_list),
    )
    return {"cards": cards}


@router.post("/api/kana/review")
def post_kana_review(payload: ReviewPayload, user_id: str = Depends(get_user_id)):
    card_id = f"{user_id}:{payload.card_id}"
    s = srs.review(card_id, payload.mode, payload.quality)
    # No extra bulk-stats call needed at all now — review() returns
    # the post-review stage directly (it already has the updated
    # total_reviews/interval_days in hand from the save), and the
    # pre-review stage comes from the client, which already had it on
    # the card payload (see _select_cards). That's one full DB round
    # trip removed from the critical path of every single review.
    return {
        "card_id": payload.card_id,
        "interval": s["interval"],
        "next_review": s["next_review"],
        "xp_earned": s["xp_earned"],
        "leveled_up": s["leveled_up"],
        "new_level": s["new_level"],
        "stage_up": _stage_promotion(payload.prev_stage, s["stage"]),
        "stage_down": _stage_demotion(payload.prev_stage, s["stage"]),
    }