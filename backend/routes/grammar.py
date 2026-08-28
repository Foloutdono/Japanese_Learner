import logging
import random
from fastapi import APIRouter, Depends, Query
from core.auth import get_user_id, prefixed, unprefixed
from core.pace import new_card_limit, resolve_pace
from core.srs_instance import srs
from srs.batch_cache import key as batch_key, pick_ids
from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, grammar_to_id
from content.grammar_sentences_data import get_sentences
from study.modes import (
    GRAMMAR, GRADED_FOR_SOURCE, INDICE_CHOICES, INDICE_SENTENCES,
    Mode, eligible_for, require_mode,
)
from study.grammar_match import verifiable
from study.mcq import pick_distractors
from pydantic import BaseModel

# The grammar section now runs on content/grammar_points.json -- the
# project's own 205-point catalogue -- rather than content/grammar_data.py,
# which is scraped from jlptsensei.com and carries a detail_url back to
# every page it came from. Example sentences come from the hand-written
# content/grammar_sentences.json beside it.
#
# This is the switch every grammar card id depends on: the owned catalogue
# names its field `pattern` where the scraped one said `grammar`, so
# grammar_to_id now formats grammar_{level}_{pattern}. Every pre-existing
# grammar row in card_modes is therefore orphaned, which is one of the two
# reasons the SRS wipe has to follow this commit.
GRAMMAR_BY_LEVEL = GRAMMAR_POINTS_BY_LEVEL

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_BATCH = 25


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


def _fill_ok(level: str, pattern: str) -> bool:
    """
    Whether fill_in can ask "which rule is at work here?" about this point
    and have exactly one right answer.

    Needs a sentence, obviously. But it also needs a pattern that a
    sentence can point at UNIQUELY, and a bare particle is not one:
    「毎あさパンを食べます。」 demonstrates を, and also ます, and also
    〜ています' absence -- asking which rule it shows has several defensible
    answers. That is the same ambiguity that ruled out blanking the rule
    out of the sentence, arriving from the other direction.

    grammar_match.verifiable() already draws exactly this line for exactly
    this reason, so it is reused rather than restated.
    """
    return verifiable(pattern) and bool(get_sentences(level, pattern))


def _build_grammar_card(entry: dict, level: str, grammar_list: list[dict], m: Mode,
                         stage: str | None = None, preview: dict[int, dict] | None = None) -> dict:
    """
    Takes a resolved Mode, matching kana/kanji/vocab. The flat `choices`
    list and the `format`-style mode string are gone: the options are a
    hint the learner switches on, not a property of the exercise.

    `explanation` and the scraped `examples` are gone with the source
    switch. The owned catalogue holds pattern / structure / gloss, and the
    sentences come from grammar_sentences.json.
    """
    pattern   = entry["pattern"]
    sentences = get_sentences(level, pattern)

    payload = {
        "card_id":   grammar_to_id(entry, level),
        "mode":      m.key,
        # f2b: the pattern is shown, recall what it means.
        # b2f: the meaning is shown, recall the pattern.
        "direction": m.direction,
        "grammar":   pattern,
        "structure": entry["structure"],
        "meaning":   entry["meaning"],
        # Current SRS stage, so the client can hand it straight back as
        # ReviewPayload.prev_stage without another lookup.
        "stage":     stage,
        # Exact xp/level/stage-up outcome for every possible rating, so
        # postReview never has to guess or wait on a round trip.
        "review_preview": _build_review_preview(stage, preview),
        "hints": {},
    }

    if INDICE_CHOICES in m.hints:
        # Built unconditionally for a hint-capable mode: the learner can
        # ask for the options mid-card, and a round trip at that moment
        # would stall the card.
        #
        # fill_in shows the sentence and asks WHICH RULE is at work, so its
        # options are patterns; the flashcards ask what a rule means, so
        # theirs are meanings.
        if m.base == "fill_in":
            choices = pick_distractors(
                [g["pattern"] for g in grammar_list if verifiable(g["pattern"])],
                lambda p: p, pattern,
            ) + [pattern]
        else:
            choices = pick_distractors(
                [g["meaning"] for g in grammar_list], lambda x: x, entry["meaning"],
            ) + [entry["meaning"]]
        random.shuffle(choices)
        payload["hints"][INDICE_CHOICES] = choices

    if INDICE_SENTENCES in m.hints and sentences:
        # The translation travels with the sentence but the CLIENT keeps it
        # hidden until asked for -- that is the whole shape of indice_2.
        # Sending it up front costs nothing and means revealing it is
        # instant rather than another request mid-card.
        payload["hints"][INDICE_SENTENCES] = sentences

    if m.base == "fill_in":
        # Shown INTACT, with no translation. Blanking the rule out has no
        # unique answer -- 食べて＿＿＿ takes いる, から, もいい and はいけない
        # alike -- so the question is "which rule is at work here", which
        # always has exactly one right answer.
        payload["fill_sentence"] = {"jp": sentences[0]["jp"], "en": sentences[0]["en"]}

    return payload


def _select_cards(level: str, m: Mode, count: int, exclude_ids: set[str], user_id: str,
                  new_limit: int | None = None):
    """
    Shared by /api/grammar/card and /api/grammar/cards: resolves the
    level, picks up to
    `count` due/new card ids (excluding anything already sitting
    unreviewed in the caller's queue), and builds the full payload for
    each. Returns (grammar_list, cards) — grammar_list is None for an
    unknown level *or* an invalid mode (callers re-check which, to
    return the right error message — see get_grammar_card). Mirrors
    kanji.py's _select_cards.
    """
    grammar_list = GRAMMAR_BY_LEVEL.get(level)
    if not grammar_list:
        return None, None
    # Mode validity is settled upstream by require_mode; an unknown level
    # is the only failure left here.
    mode = m.key

    # fill_in needs a sentence that verifiably contains its rule, so a
    # point with none is removed from the POOL rather than skipped at build
    # time -- an ineligible entry left in the pool is still selectable and
    # comes back as a missing card the client reads as "deck exhausted".
    pool = [
        g for g in grammar_list
        if eligible_for(m, {**g, "fill_ok": _fill_ok(level, g["pattern"])})
    ]
    if not pool:
        return grammar_list, []

    raw_ids   = [grammar_to_id(g, level) for g in pool]
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
        count, exclude_ids, new_limit=new_limit,
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
        entry = next((g for g in pool if grammar_to_id(g, level) == raw_id), None)
        if entry is not None:
            cards.append(_build_grammar_card(entry, level, grammar_list, m, states.get(card_id), previews.get(card_id)))

    logger.info(
        "grammar study request level=%s mode=%s user_id=%s requested=%d due_count=%d picked=%d",
        level, mode, user_id, count, len(due), len(cards),
    )
    return grammar_list, cards


@router.get("/api/grammar/card")
def get_grammar_card(level: str, m: Mode = Depends(require_mode(GRAMMAR)),
                     user_id: str = Depends(get_user_id)):
    mode = m.key
    grammar_list, cards = _select_cards(level, m, count=1, exclude_ids=set(), user_id=user_id)
    if grammar_list is None:
        return {"error": "Unknown level"}
    if not cards:
        logger.warning("grammar study exhausted level=%s mode=%s user_id=%s", level, mode, user_id)
        return {"done": True}
    return cards[0]


@router.get("/api/grammar/cards")
def get_grammar_cards(level: str, count: int = Query(10, ge=1, le=100), exclude: str = "",
                       beyond_target: bool = Query(False),
                       m: Mode = Depends(require_mode(GRAMMAR)),
                       user_id: str = Depends(get_user_id)):
    """
    Batch version of /api/grammar/card — returns up to `count` cards at
    once so the frontend can keep a session queue filled instead of
    fetching one card per answer (see useCardSession). `exclude` is a
    comma-separated list of raw (unprefixed) card ids the client
    already has queued but hasn't reviewed yet. `beyond_target` is the
    臨時列車: new cards past today's pace, on request (core/pace.py).
    """
    pace = resolve_pace(user_id)
    grammar_list, cards = _select_cards(
        level, m,
        count=max(1, min(count, MAX_BATCH)),
        exclude_ids={f"{user_id}:{cid}" for cid in exclude.split(",") if cid},
        user_id=user_id,
        new_limit=new_card_limit(pace, beyond_target),
    )
    if grammar_list is None:
        return {"error": "Unknown level"}
    return {"cards": cards, "pace": pace.payload() if pace else None}


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
    graded = sorted(GRADED_FOR_SOURCE[GRAMMAR])
    per_mode_states = {k: srs.get_bulk_stats(card_ids, k) for k in graded}

    cards = []
    for entry, card_id in zip(grammar_list, card_ids):
        stages = [per_mode_states[k].get(card_id, "new") for k in graded]
        stage = "mastered" if "mastered" in stages else "learning" if "learning" in stages else "new"
        if stage == "new":
            continue
        cards.append({
            "card_id":   grammar_to_id(entry, level),
            "grammar":   entry["pattern"],
            "structure": entry["structure"],
            "meaning":   entry["meaning"],
            "stage":     stage,
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
    if mode not in GRADED_FOR_SOURCE[GRAMMAR]:
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
            for mode in sorted(GRADED_FOR_SOURCE[GRAMMAR])
        }
    return result