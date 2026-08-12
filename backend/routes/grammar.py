import logging
import random
from fastapi import APIRouter, Depends
from auth import get_user_id, prefixed, unprefixed
from srs_instance import srs
from srs.batch_cache import ensure_initialized, key as batch_key, pick_ids
from grammar_data import GRAMMAR_BY_LEVEL, grammar_to_id
from quiz_modes import GRAMMAR_MODES
from mcq import pick_distractors
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_BATCH = 25
VALID_MODES = set(GRAMMAR_MODES)


class ReviewPayload(BaseModel):
    card_id:    str
    mode:       str
    quality:    int
    # The card's stage *before* this review, exactly as it was handed
    # back on the card payload (see _build_grammar_card's "stage" field
    # below) — sent back by the client instead of looked up again here.
    # Mirrors kana.py/vocab.py/kanji.py's own ReviewPayload.
    prev_stage: str | None = None


# Card stage promotions worth a visual "stamp" on the frontend (see
# CardStamp.jsx) — only the two forward crossings the SRS ladder can
# make in one review: new → learning, learning → mastered. Anything
# else (no change, or dropping back out of mastered on a lapsed
# review) is None, and the frontend simply doesn't stamp the card.
# Duplicated from kana.py rather than shared — see that file's own
# copy for the same rationale; grammar didn't have this concept at all
# before, so this brings it up to parity with kana/vocab/kanji.
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


def _build_review_preview(stage: str | None, preview: dict[int, dict] | None) -> dict | None:
    """Turns SRSEngine.preview_reviews_bulk()'s per-card output into
    the exact shape the frontend indexes by quality — xp/level as-is,
    plus stage_up/stage_down resolved against this card's *current*
    stage the same way post_grammar_review does after a real review
    (see _stage_promotion/_stage_demotion). None when no preview was
    computed."""
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


@router.get("/api/grammar/levels")
def get_grammar_levels():
    return {"levels": list(GRAMMAR_BY_LEVEL.keys())}


def _build_grammar_card(entry: dict, level: str, grammar_list: list[dict], mode: str,
                         stage: str | None = None, preview: dict[int, dict] | None = None) -> dict:
    # MCQ: choose 3 wrong meanings + 1 correct. The candidates already
    # *are* meanings here, hence the identity accessor.
    choices = pick_distractors(
        [g["meaning"] for g in grammar_list], lambda m: m, entry["meaning"],
    ) + [entry["meaning"]]
    random.shuffle(choices)

    # Fill-in: pick a random example and blank out the grammar point
    fill_example = None
    if entry["examples"] and mode == "fill":
        ex = random.choice(entry["examples"])
        blanked = ex["jp"].replace(
            entry["grammar"].split('・')[0],
            '＿＿＿'
        )
        fill_example = {
            "jp_blanked": blanked,
            "jp_full":    ex["jp"],
            "romaji":     ex["romaji"],
            "en":         ex["en"],
        }

    return {
        "card_id":      grammar_to_id(entry, level),
        "grammar":      entry["grammar"],
        "meaning":      entry["meaning"],
        "explanation":  entry["explanation"],
        "examples":     entry["examples"],
        "choices":      choices,
        "fill_example": fill_example,
        "mode":         mode,
        # Current SRS stage, so the client can hand it straight back
        # as ReviewPayload.prev_stage without another lookup.
        "stage":        stage,
        # Exact xp/level/stage-up outcome for every possible rating,
        # precomputed now so postReview on the frontend never has to
        # guess or wait on a round trip to know what just happened.
        "review_preview": _build_review_preview(stage, preview),
    }


def _select_cards(level: str, mode: str, count: int, exclude_ids: set[str], user_id: str):
    """
    Shared by /api/grammar/card and /api/grammar/cards: resolves the
    level, makes sure the cards/card_modes rows exist, picks up to
    `count` due/new card ids (excluding anything already sitting
    unreviewed in the caller's queue), and builds the full payload for
    each. Returns (grammar_list, cards) — grammar_list is None for an
    unknown level *or* an invalid mode (callers re-check which, to
    return the right error message — see get_grammar_card). Mirrors
    kanji.py's _select_cards.
    """
    grammar_list = GRAMMAR_BY_LEVEL.get(level)
    if not grammar_list or mode not in VALID_MODES:
        return None, None

    raw_ids   = [grammar_to_id(g, level) for g in grammar_list]
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
    # returned (at most MAX_BATCH), not the whole level — cheap, and it
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
        entry = next((g for g in grammar_list if grammar_to_id(g, level) == raw_id), None)
        if entry is not None:
            cards.append(_build_grammar_card(entry, level, grammar_list, mode, states.get(card_id), previews.get(card_id)))

    logger.info(
        "grammar study request level=%s mode=%s user_id=%s requested=%d due_count=%d picked=%d",
        level, mode, user_id, count, len(due), len(cards),
    )
    return grammar_list, cards


@router.get("/api/grammar/card")
def get_grammar_card(level: str, mode: str = "flashcard",
                     user_id: str = Depends(get_user_id)):
    grammar_list, cards = _select_cards(level, mode, count=1, exclude_ids=set(), user_id=user_id)
    if grammar_list is None:
        if level not in GRAMMAR_BY_LEVEL:
            return {"error": "Unknown level"}
        return {"error": "Invalid mode"}
    if not cards:
        logger.warning("grammar study exhausted level=%s mode=%s user_id=%s", level, mode, user_id)
        return {"done": True}
    return cards[0]


@router.get("/api/grammar/cards")
def get_grammar_cards(level: str, mode: str = "flashcard", count: int = 10, exclude: str = "",
                       user_id: str = Depends(get_user_id)):
    """
    Batch version of /api/grammar/card — returns up to `count` cards at
    once so the frontend can keep a session queue filled instead of
    fetching one card per answer (see useCardSession). `exclude` is a
    comma-separated list of raw (unprefixed) card ids the client
    already has queued but hasn't reviewed yet.
    """
    grammar_list, cards = _select_cards(
        level, mode,
        count=max(1, min(count, MAX_BATCH)),
        exclude_ids={f"{user_id}:{cid}" for cid in exclude.split(",") if cid},
        user_id=user_id,
    )
    if grammar_list is None:
        if level not in GRAMMAR_BY_LEVEL:
            return {"error": "Unknown level"}
        return {"error": "Invalid mode"}
    return {"cards": cards}


@router.get("/api/grammar/review-cards")
def get_grammar_review_cards(level: str, user_id: str = Depends(get_user_id)):
    """
    Every card in this level the user has already studied, in ANY mode
    (flashcard/mcq/fill) — not just due ones — for a self-paced,
    ungraded browse of "grammar points I already know" instead of an
    SRS-driven session. `stage` is the most advanced stage reached
    across those modes — see kana.py's own review-cards endpoint for
    the full rationale (mirrored here).
    """
    grammar_list = GRAMMAR_BY_LEVEL.get(level)
    if not grammar_list:
        return {"error": "Unknown level"}

    raw_ids  = [grammar_to_id(g, level) for g in grammar_list]
    card_ids = prefixed(raw_ids, user_id)
    per_mode_states = {m: srs.get_bulk_stats(card_ids, m) for m in GRAMMAR_MODES}

    cards = []
    for entry, card_id in zip(grammar_list, card_ids):
        stages = [per_mode_states[m].get(card_id, "new") for m in GRAMMAR_MODES]
        stage = "mastered" if "mastered" in stages else "learning" if "learning" in stages else "new"
        if stage == "new":
            continue
        cards.append({
            "card_id":     grammar_to_id(entry, level),
            "grammar":     entry["grammar"],
            "meaning":     entry["meaning"],
            "explanation": entry["explanation"],
            "stage":       stage,
        })

    logger.info(
        "grammar review request level=%s user_id=%s studied=%d/%d",
        level, user_id, len(cards), len(grammar_list),
    )
    return {"cards": cards}


@router.post("/api/grammar/review")
def post_grammar_review(payload: ReviewPayload,
                        user_id: str = Depends(get_user_id)):
    card_id = f"{user_id}:{payload.card_id}"
    s = srs.review(card_id, payload.mode, payload.quality)
    # xp_earned/leveled_up/new_level were already being computed by
    # srs.review() (same engine kana/vocab/kanji use) but previously
    # dropped on the floor here — grammar reviews were earning XP with
    # no way for the frontend to ever surface it. stage_up is resolved
    # the same way post_kana_review does, from the stage the client
    # already had on the card payload.
    return {
        "card_id":     payload.card_id,
        "interval":    s["interval"],
        "next_review": s["next_review"],
        "xp_earned":   s["xp_earned"],
        "leveled_up":  s["leveled_up"],
        "new_level":   s["new_level"],
        "stage_up":    _stage_promotion(payload.prev_stage, s["stage"]),
        "stage_down":  _stage_demotion(payload.prev_stage, s["stage"]),
    }


@router.get("/api/grammar/level-stats")
def get_grammar_level_stats(level: str, mode: str, user_id: str = Depends(get_user_id)):
    """
    Lightweight, per-level/mode progress (à apprendre / en cours /
    maîtrisé) — for GrammarScreen's DeckProgress bar. Unlike
    /api/grammar/stats below (which recomputes every level and every
    mode for the whole user at once), this only touches the card_ids
    for one level+mode, so it's cheap enough to call after every
    review — same shape and purpose as /api/kana/stats and
    /api/vocab/stats. Kept as a separate endpoint rather than
    repurposing /api/grammar/stats, since that one may already have
    other callers (e.g. a stats overview screen) expecting its
    all-levels shape.
    """
    grammar_list = GRAMMAR_BY_LEVEL.get(level)
    if not grammar_list:
        return {"error": "Unknown level"}
    if mode not in VALID_MODES:
        return {"error": "Invalid mode"}

    raw_ids  = [grammar_to_id(g, level) for g in grammar_list]
    card_ids = prefixed(raw_ids, user_id)

    states = srs.get_bulk_stats(card_ids, mode)
    due    = srs.get_due_cards(mode, limit=len(card_ids), card_ids=card_ids)

    return {
        "total":    len(card_ids),
        "new":      sum(1 for s in states.values() if s == "new"),
        "learning": sum(1 for s in states.values() if s == "learning"),
        "mastered": sum(1 for s in states.values() if s == "mastered"),
        "due_now":  len(due),
    }


@router.get("/api/grammar/stats")
def get_grammar_stats(user_id: str = Depends(get_user_id)):
    result = {}
    for level, grammar_list in GRAMMAR_BY_LEVEL.items():
        raw_ids = [grammar_to_id(g, level) for g in grammar_list]
        result[level] = {
            mode: {
                "total":    len(raw_ids),
                "new":      sum(1 for s in srs.get_bulk_stats(prefixed(raw_ids, user_id), mode).values() if s == "new"),
                "learning": sum(1 for s in srs.get_bulk_stats(prefixed(raw_ids, user_id), mode).values() if s == "learning"),
                "mastered": sum(1 for s in srs.get_bulk_stats(prefixed(raw_ids, user_id), mode).values() if s == "mastered"),
                "due_now":  sum(1 for cid in prefixed(raw_ids, user_id) if cid in set(srs.get_due_cards(mode))),
            }
            for mode in GRAMMAR_MODES
        }
    return result