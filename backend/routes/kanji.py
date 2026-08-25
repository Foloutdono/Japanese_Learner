import logging
import random
from fastapi import APIRouter, Depends, Query
from content.kanji_data import KANJI_BY_LEVEL, kanji_to_id
from core.auth import get_user_id, prefixed, unprefixed
from core.srs_instance import srs
from srs.batch_cache import key as batch_key, pick_ids
from translations import get_meaning
from content.kanji_meanings import KANJI_FR
from study.modes import (
    KANJI, GRADED_FOR_SOURCE, INDICE_CHOICES, RADICAL, READINGS,
    Mode, eligible_for, require_mode,
)
from study.mcq import pick_distractors
from content.kanji_readings import split_readings, display_reading
from content.radical_data import radical_for, siblings_by_stroke, RADICAL_BY_NUMBER
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

# The one demotion worth its own "burn away, then reappear" animation
# on the frontend (see CardStamp.jsx's `demoted` prop) — a lapsed
# review dropping a mastered card back down to learning. new/learning
# have no reachable "down" transition of their own: a review always
# leaves total_reviews > 0, so the post-review stage can never be
# "new" again.
STAGE_DEMOTIONS = {
    ("mastered", "learning"): "learning",
}


def _stage_demotion(prev_stage: str | None, new_stage: str | None) -> str | None:
    if not prev_stage or not new_stage:
        return None
    return STAGE_DEMOTIONS.get((prev_stage, new_stage))

FR_MAP = KANJI_FR
MAX_BATCH = 25


def _build_review_preview(stage: str | None, preview: dict[int, dict] | None) -> dict | None:
    """Turns SRSEngine.preview_reviews_bulk()'s per-card output into
    the exact shape the frontend indexes by quality — xp/level as-is,
    plus stage_up resolved against this card's *current* stage the
    same way post_kanji_review does after a real review (see
    _stage_promotion)."""
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


def _radical_number(entry: dict) -> int | None:
    """The radical number for eligible_for; None when uncovered."""
    rad = radical_for(entry.get("kanji", ""))
    return None if rad is None else rad["number"]


def _build_kanji_card(raw_id: str, entry: dict, kanji_list: list[dict], m: Mode, lang: str, stage: str | None,
                       preview: dict[int, dict] | None = None) -> dict:
    """
    Takes a resolved Mode, not a mode string.

    The old `format` field ('qcm' | 'flashcard') is gone. It encoded "are
    the choices on screen", which is not a property of the exercise — it
    is how much help the learner wants on the card in front of them. So
    the choices now ride in `hints.indice_1` whenever the mode offers that
    hint, and the client decides whether to show them. That also removes
    the `QCM_FLASHCARD_MODES[mode]` lookup that would KeyError on any key
    outside that dict.
    """
    meaning = get_meaning(entry, lang, FR_MAP)
    payload = {
        "card_id":      raw_id,
        "mode":         m.key,
        # f2b: the kanji is shown, recall the meaning.
        # b2f: the meaning is shown, recall the kanji.
        "direction":    m.direction,
        "kanji":        entry.get("kanji", ""),
        "kana":         entry.get("kana", ""),
        "meaning":      meaning,
        "stroke_count": entry.get("stroke_count", ""),
        # Current SRS stage, so the client can hand it straight back
        # as ReviewPayload.prev_stage without another lookup — see the
        # comment on that field for why that matters.
        "stage":        stage,
        # Exact xp/level/stage-up outcome for every possible rating,
        # precomputed now so postReview on the frontend never has to
        # guess or wait on a round trip to know what just happened —
        # see preview_reviews_bulk's docstring for the full reasoning.
        "review_preview": _build_review_preview(stage, preview),
        "hints": {},
    }

    if INDICE_CHOICES in m.hints:
        # Built unconditionally for a hint-capable mode, because the
        # learner can ask for them mid-card and a second round trip at
        # that moment would stall the card.
        choice_entries = pick_distractors(
            kanji_list, lambda k: get_meaning(k, lang, FR_MAP), meaning,
        ) + [entry]
        random.shuffle(choice_entries)
        payload["hints"][INDICE_CHOICES] = [
            {"kanji": c.get("kanji", ""), "meaning": get_meaning(c, lang, FR_MAP)}
            for c in choice_entries
        ]

    if m.base == READINGS:
        # The deck packs every reading into one ・-separated string; the
        # mode asks for them by type, so they are split here rather than
        # on the client. See content/kanji_readings.py for why splitting
        # by script is the convention and not a guess.
        #
        # Both the stored and the display form travel: "ま.ず" marks where
        # the okurigana starts, which matters for showing the answer, but
        # a learner typing "まず" has not made a mistake, so the comparison
        # needs the dotless form too.
        split = split_readings(entry.get("kana"))
        payload["readings"] = {
            kind: [{"reading": r, "display": display_reading(r)} for r in readings]
            for kind, readings in split.items()
        }

    if m.base == RADICAL:
        # Distractors come from the SAME stroke-count bucket. Drawn from
        # all 214 the mode would be trivial by accident -- a 1-stroke
        # radical against three 12-stroke ones is a shape-recognition
        # task, not a radical one.
        rad = radical_for(entry.get("kanji", ""))
        if rad is not None:
            payload["radical"] = rad
            pool = siblings_by_stroke(rad["number"])
            picks = random.sample(pool, min(3, len(pool)))
            options = [RADICAL_BY_NUMBER[n] for n in picks] + [RADICAL_BY_NUMBER[rad["number"]]]
            random.shuffle(options)
            payload["hints"][INDICE_CHOICES] = [
                {"number": o["number"], "char": o["char"], "stroke_count": o["stroke_count"]}
                for o in options
            ]

    return payload


def _select_cards(level: str, m: Mode, lang: str, count: int, exclude_ids: set[str], user_id: str):
    """
    Shared by /api/kanji/card and /api/kanji/cards. Returns
    (kanji_list, cards) — kanji_list is None for an unknown level or
    invalid mode (callers re-check which, to keep the exact original
    error messages).
    """
    kanji_list = KANJI_BY_LEVEL.get(level)
    if not kanji_list:
        return None, None
    # Mode validity is settled upstream by require_mode, so the only
    # remaining failure here is an unknown level.
    mode = m.key

    # Not every entry can be served in every mode -- `radical` needs a
    # radical number, which the KANJIDIC2 dump happens to have for 100% of
    # this deck but is not guaranteed to. Filtering the POOL rather than
    # skipping at build time matters: an ineligible entry left in the pool
    # is still selectable, still counts toward the deck total, and comes
    # back as a silently missing card that reads as "deck exhausted".
    pool = [k for k in kanji_list if eligible_for(m, {**k, "radical": _radical_number(k)})]
    if not pool:
        return kanji_list, []

    raw_ids   = [kanji_to_id(k, level) for k in pool]
    card_ids  = prefixed(raw_ids, user_id)
    cache_key = batch_key("user", user_id, mode, level)
    # No pre-materialisation. get_new_cards selects over the ids passed
    # here rather than joining `cards`, so nothing has to exist in
    # card_modes before a card can be served — a scheduler row is written
    # on first review instead. This call used to write one row per deck
    # card per mode (3,476 of them for N1 vocab) on the first request.

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
        entry = next((k for k in pool if kanji_to_id(k, level) == raw_id), None)
        if entry is not None:
            cards.append(_build_kanji_card(raw_id, entry, kanji_list, m, lang, states.get(card_id), previews.get(card_id)))

    logger.info(
        "kanji study request level=%s mode=%s user_id=%s requested=%d due_count=%d picked=%d",
        level, mode, user_id, count, len(due), len(cards),
    )
    return kanji_list, cards


@router.get("/api/kanji/card")
def get_kanji_card(level: str, lang: str = "fr",
                   m: Mode = Depends(require_mode(KANJI)),
                   user_id: str = Depends(get_user_id)):
    mode = m.key
    kanji_list, cards = _select_cards(level, m, lang, count=1, exclude_ids=set(), user_id=user_id)
    if kanji_list is None:
        return {"error": "Unknown level"}
    if not cards:
        logger.warning("kanji study exhausted level=%s mode=%s user_id=%s", level, mode, user_id)
        return {"done": True}
    return cards[0]


@router.get("/api/kanji/cards")
def get_kanji_cards(level: str, lang: str = "fr", count: int = Query(10, ge=1, le=100), exclude: str = "",
                    m: Mode = Depends(require_mode(KANJI)),
                    user_id: str = Depends(get_user_id)):
    """
    Batch version of /api/kanji/card — returns up to `count` cards at
    once so the frontend can keep a session queue filled instead of
    fetching one card per answer. `exclude` is a comma-separated list
    of raw (unprefixed) card ids the client already has queued but
    hasn't reviewed yet.
    """
    kanji_list, cards = _select_cards(
        level, m, lang,
        count=max(1, min(count, MAX_BATCH)),
        exclude_ids={f"{user_id}:{cid}" for cid in exclude.split(",") if cid},
        user_id=user_id,
    )
    if kanji_list is None:
        return {"error": "Unknown level"}
    return {"cards": cards}


@router.get("/api/kanji/review-cards")
def get_kanji_review_cards(level: str, lang: str = "fr", user_id: str = Depends(get_user_id)):
    """
    Every card in this level the user has already studied, in ANY mode
    (qcm/flashcard either direction, or write) — not just due ones —
    for a self-paced, ungraded browse of "kanji I already know"
    instead of an SRS-driven session. `stage` is the most advanced
    stage reached across those modes — see kana.py's own review-cards
    endpoint for the full rationale (mirrored here).
    """
    kanji_list = KANJI_BY_LEVEL.get(level)
    if not kanji_list:
        return {"error": "Unknown level"}

    raw_ids  = [kanji_to_id(k, level) for k in kanji_list]
    card_ids = prefixed(raw_ids, user_id)
    graded = sorted(GRADED_FOR_SOURCE[KANJI])
    per_mode_states = {m: srs.get_bulk_stats(card_ids, m) for m in graded}

    cards = []
    for entry, card_id in zip(kanji_list, card_ids):
        stages = [per_mode_states[m].get(card_id, "new") for m in graded]
        stage = "mastered" if "mastered" in stages else "learning" if "learning" in stages else "new"
        if stage == "new":
            continue
        cards.append({
            "card_id":      kanji_to_id(entry, level),
            "kanji":        entry.get("kanji", ""),
            "kana":         entry.get("kana", ""),
            "meaning":      get_meaning(entry, lang, FR_MAP),
            "stroke_count": entry.get("stroke_count", ""),
            "stage":        stage,
        })

    logger.info(
        "kanji review request level=%s user_id=%s studied=%d/%d",
        level, user_id, len(cards), len(kanji_list),
    )
    return {"cards": cards}


@router.post("/api/kanji/review")
def post_kanji_review(payload: ReviewPayload, user_id: str = Depends(get_user_id)):
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


@router.get("/api/kanji/stats")
def get_kanji_stats(level: str, m: Mode = Depends(require_mode(KANJI)),
                     user_id: str = Depends(get_user_id)):
    """
    Lightweight, per-level/mode progress (à apprendre / en cours / maîtrisé).
    Scoped to a single level+mode (unlike /api/stats, which recomputes
    every category for the whole user) so it's cheap enough to call after
    every review.
    """
    kanji_list = KANJI_BY_LEVEL.get(level)
    if not kanji_list:
        return {"error": "Unknown level"}
    mode = m.key

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