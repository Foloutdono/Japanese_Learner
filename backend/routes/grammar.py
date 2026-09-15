import logging
import random
from fastapi import APIRouter, Depends, HTTPException, Query
from core.auth import get_user_id, prefixed, unprefixed
from core import credits
from core.pace import new_card_limit, resolve_pace
from core.srs_instance import srs
from srs.batch_cache import key as batch_key, pick_ids
from content.grammar_points_data import (
    GRAMMAR_POINTS_BY_LEVEL, entry_by_id, gloss, grammar_to_id,
)
from content.grammar_sentences_data import get_sentences
from study import card_index
from study.card_lookup import GRAMMAR_STATUS_MODES, card_stats
from study.grammar_examples import example_payload
from study.grammar_lesson import contrast_payload, lesson_payload
from study.modes import (
    CONTRAST, GRAMMAR, GRADED_FOR_SOURCE, GRADED_ORDER_FOR_SOURCE, INDICE_CHOICES,
    INDICE_SENTENCES, Mode, require_mode,
)
from study.grammar_match import verifiable
from study.mcq import pick_distractors
from pydantic import BaseModel

# The grammar section runs on the project's own catalogue,
# content/grammar/*.json (plan 087) -- one file per level, each point
# carrying its bilingual gloss, its lesson, its rivals and its example
# sentences. content/grammar_data.py, the file scraped from
# jlptsensei.com, serves nothing and is only the corpus the provenance
# test holds our wording apart from.
#
# Every grammar card id is grammar_{level}_{pattern} (grammar_to_id), so
# the pattern text is the learner's progress: see content/grammar/
# renames.py for what happens when a point moves.
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


def _build_grammar_card(entry: dict, level: str, grammar_list: list[dict], m: Mode, lang: str,
                        stage: str | None = None, preview: dict[int, dict] | None = None) -> dict | None:
    """
    Takes a resolved Mode, matching kana/kanji/vocab. The flat `choices`
    list and the `format`-style mode string are gone: the options are a
    hint the learner switches on, not a property of the exercise.

    Everything a learner reads is in `lang` already -- the gloss, the
    sentences' translations, the lesson -- so the client never swaps a
    language in. A NEW card carries its `lesson` (plan 087): the run
    shows it before the card, and a round trip at that moment would
    stall the queue. Every card carries `raw_id`, the catalogue id the
    lesson door asks for even when a deck or the daily queue has
    overwritten `card_id`.

    None when the mode cannot be built for this point -- only contrast,
    when the point has no marked sentence, which the pool filter should
    already have ruled out. Callers skip a None.
    """
    pattern   = entry["pattern"]
    sentences = get_sentences(level, pattern)
    raw_id    = grammar_to_id(entry, level)

    payload = {
        "card_id":   raw_id,
        "raw_id":    raw_id,
        "mode":      m.key,
        # f2b: the pattern is shown, recall what it means.
        # b2f: the meaning is shown, recall the pattern.
        "direction": m.direction,
        "grammar":   pattern,
        "structure": entry["structure"],
        "meaning":   gloss(entry, lang),
        "register":  entry.get("register"),
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
                [gloss(g, lang) for g in grammar_list], lambda x: x, gloss(entry, lang),
            ) + [gloss(entry, lang)]
        random.shuffle(choices)
        payload["hints"][INDICE_CHOICES] = choices

    if INDICE_SENTENCES in m.hints and sentences:
        # The translation travels with the sentence but the CLIENT keeps it
        # hidden until asked for -- that is the whole shape of indice_2.
        # Sending it up front costs nothing and means revealing it is
        # instant rather than another request mid-card. Furigana and the
        # pattern's highlight ride along, the same shape the lesson prints.
        payload["hints"][INDICE_SENTENCES] = [example_payload(ex, pattern, lang) for ex in sentences]

    if m.base == "fill_in":
        # Shown INTACT. Blanking the rule out has no unique answer among
        # ALL rules -- 食べて＿＿＿ takes いる, から, もいい and はいけない
        # alike -- so the question is "which rule is at work here", which
        # always has exactly one right answer. (The contrast mode below
        # blanks it, because its choices are the point's own rivals.)
        #
        # Furigana so the question stays a grammar question: a learner who
        # cannot yet read 飲 is being asked the wrong thing otherwise. It
        # gives nothing away -- a reading names no rule.
        #
        # The translation travels with the sentence and the CLIENT holds it
        # back until the answer is out. It cannot be shown alongside the
        # question: "only" in "I drank only water" IS だけ, so the front
        # would print its own answer in English. `highlight` is stripped
        # for the same reason: the mark would point at the answer.
        first = example_payload(sentences[0], pattern, lang)
        payload["fill_sentence"] = {
            "jp": first["jp"],
            "tr": first["tr"],
            "furigana": [{k: v for k, v in part.items() if k != "highlight"} for part in first["furigana"]],
        }

    if m.base == CONTRAST:
        contrast = contrast_payload(level, entry, grammar_list, lang)
        if contrast is None:
            return None
        payload["contrast"] = contrast

    if stage == "new":
        payload["lesson"] = lesson_payload(level, entry, lang)

    return payload


def _select_cards(level: str, m: Mode, lang: str, count: int, exclude_ids: set[str], user_id: str,
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

    # fill_in needs a sentence that verifiably contains its rule, and
    # contrast a marked sentence and a rival; a point without is removed
    # from the POOL rather than skipped at build time -- an ineligible
    # entry left in the pool is still selectable and comes back as a
    # missing card the client reads as "deck exhausted". One rule, shared
    # with the stats denominator: card_index.eligible.
    pool = [g for g in grammar_list if card_index.eligible(GRAMMAR, level, mode, g)]
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
        found = entry_by_id(raw_id)
        if found is None or found[0] != level:
            continue
        card = _build_grammar_card(found[1], level, grammar_list, m, lang, states.get(card_id), previews.get(card_id))
        if card is not None:
            cards.append(card)

    logger.info(
        "grammar study request level=%s mode=%s user_id=%s requested=%d due_count=%d picked=%d",
        level, mode, user_id, count, len(due), len(cards),
    )
    return grammar_list, cards


@router.get("/api/grammar/card")
def get_grammar_card(level: str, lang: str = "fr", m: Mode = Depends(require_mode(GRAMMAR)),
                     user_id: str = Depends(get_user_id)):
    mode = m.key
    grammar_list, cards = _select_cards(level, m, lang, count=1, exclude_ids=set(), user_id=user_id)
    if grammar_list is None:
        return {"error": "Unknown level"}
    if not cards:
        logger.warning("grammar study exhausted level=%s mode=%s user_id=%s", level, mode, user_id)
        return {"done": True}
    return cards[0]


@router.get("/api/grammar/cards")
def get_grammar_cards(level: str, lang: str = "fr", count: int = Query(10, ge=1, le=100), exclude: str = "",
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
        level, m, lang,
        count=max(1, min(count, MAX_BATCH)),
        exclude_ids={f"{user_id}:{cid}" for cid in exclude.split(",") if cid},
        user_id=user_id,
        new_limit=new_card_limit(pace, beyond_target),
    )
    if grammar_list is None:
        return {"error": "Unknown level"}
    return {"cards": cards, "pace": pace.payload() if pace else None}


def _folded_stages(grammar_list: list[dict], level: str, user_id: str) -> dict[str, str]:
    """raw_id -> the most advanced stage reached across every graded mode,
    or "new" -- the reading the browse and the index both give a point."""
    raw_ids  = [grammar_to_id(g, level) for g in grammar_list]
    card_ids = prefixed(raw_ids, user_id)
    graded = sorted(GRADED_FOR_SOURCE[GRAMMAR])
    per_mode_states = {k: srs.get_bulk_stats(card_ids, k) for k in graded}
    out = {}
    for raw_id, card_id in zip(raw_ids, card_ids):
        stages = [per_mode_states[k].get(card_id, "new") for k in graded]
        out[raw_id] = "mastered" if "mastered" in stages else "learning" if "learning" in stages else "new"
    return out


@router.get("/api/grammar/review-cards")
def get_grammar_review_cards(level: str, lang: str = "fr", user_id: str = Depends(get_user_id)):
    """
    Every card in this level the user has already studied, in ANY mode
    (flashcard/mcq/fill/contrast) — not just due ones — for a self-paced,
    ungraded browse of "grammar points I already know" instead of an
    SRS-driven session. `stage` is the most advanced stage reached
    across those modes — see kana.py's own review-cards endpoint for
    the full rationale (mirrored here).
    """
    grammar_list = GRAMMAR_BY_LEVEL.get(level)
    if not grammar_list:
        return {"error": "Unknown level"}

    stages = _folded_stages(grammar_list, level, user_id)
    cards = []
    for entry in grammar_list:
        raw_id = grammar_to_id(entry, level)
        stage = stages[raw_id]
        if stage == "new":
            continue
        cards.append({
            "card_id":   raw_id,
            "raw_id":    raw_id,
            "grammar":   entry["pattern"],
            "structure": entry["structure"],
            "meaning":   gloss(entry, lang),
            "stage":     stage,
        })

    logger.info(
        "grammar review request level=%s user_id=%s studied=%d/%d",
        level, user_id, len(cards), len(grammar_list),
    )
    return {"cards": cards}


@router.get("/api/grammar/points")
def get_grammar_points(level: str, lang: str = "fr", user_id: str = Depends(get_user_id)):
    """
    The level's index (plan 087): every point with its gloss and the
    stage the learner has reached, plus the figures the station's door
    prints (learned over total, started while the two disagree) and how
    many cards each mode can serve here -- so a platform with nothing
    behind it (contrast, at a level whose lessons are not written yet)
    is not offered.
    """
    grammar_list = GRAMMAR_BY_LEVEL.get(level)
    if not grammar_list:
        raise HTTPException(status_code=404, detail=f"Unknown level: {level}")

    stages = _folded_stages(grammar_list, level, user_id)
    points = []
    for entry in grammar_list:
        raw_id = grammar_to_id(entry, level)
        points.append({
            "raw_id":  raw_id,
            "pattern": entry["pattern"],
            "meaning": gloss(entry, lang),
            "stage":   stages[raw_id],
            "rich":    bool(entry.get("steps")),
        })
    return {
        "level":   level,
        "points":  points,
        "learned": sum(1 for p in points if p["stage"] == "mastered"),
        "started": sum(1 for p in points if p["stage"] == "learning"),
        "total":   len(points),
        "totals":  {k: card_index.total(GRAMMAR, level, k) for k in GRADED_ORDER_FOR_SOURCE[GRAMMAR]},
    }


@router.get("/api/grammar/point")
def get_grammar_point(id: str, lang: str = "fr", user_id: str = Depends(get_user_id)):
    """
    One point as a lesson (plan 087): what the run's door, the station's
    sheet and a chip anywhere in the app open. `id` is the raw card id
    (grammar_{level}_{pattern}), as a query parameter and never a path
    segment because it embeds 〜 and ／.

    An unknown id is a 404, not a 200 carrying {"error": ...}: lib/api.js
    treats only a non-ok response as an error (routes/kanji.py's
    _require_radical documents the trap).
    """
    found = entry_by_id(id)
    if found is None:
        raise HTTPException(status_code=404, detail=f"Unknown grammar point: {id}")
    level, entry = found
    states = srs.get_user_states(user_id)
    return {
        "raw_id":    id,
        "level":     level,
        "pattern":   entry["pattern"],
        "structure": entry["structure"],
        "meaning":   gloss(entry, lang),
        **lesson_payload(level, entry, lang),
        "status":    card_stats(states, user_id, id, GRAMMAR_STATUS_MODES),
    }


@router.post("/api/grammar/review")
def post_grammar_review(payload: ReviewPayload,
                        user_id: str = Depends(get_user_id)):
    card_id = f"{user_id}:{payload.card_id}"
    s = srs.review(card_id, payload.mode, payload.quality)
    # The fare, charged only now that the scheduler has accepted the
    # review (plan 069): a rejected review is not a ride. Priced by
    # THIS router's source rather than by the client's mode key, so a
    # `kana.*` posted here still pays (core/credits.py, FREE_SOURCES).
    fare = credits.spend(user_id, credits.cost_of(GRAMMAR), card_id)
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
        "credits":     fare,
    }


def _mode_bucket(level: str, mode: str, user_id: str) -> dict:
    """The four figures of one level+mode, sized by the cards the mode
    can actually serve there (card_index), not by the whole level: a
    denominator counting cards fill_in or contrast can never reach reads
    as a learner stalled just short of 100%."""
    raw_ids  = card_index.raw_ids(GRAMMAR, level, mode)
    card_ids = prefixed(raw_ids, user_id)
    states = srs.get_bulk_stats(card_ids, mode) if card_ids else {}
    due    = srs.get_due_cards(mode, limit=len(card_ids), card_ids=card_ids) if card_ids else []
    return {
        "total":    len(card_ids),
        "new":      sum(1 for s in states.values() if s == "new"),
        "learning": sum(1 for s in states.values() if s == "learning"),
        "mastered": sum(1 for s in states.values() if s == "mastered"),
        "due_now":  len(due),
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
    if not GRAMMAR_BY_LEVEL.get(level):
        return {"error": "Unknown level"}
    if mode not in GRADED_FOR_SOURCE[GRAMMAR]:
        return {"error": "Invalid mode"}
    return _mode_bucket(level, mode, user_id)


@router.get("/api/grammar/stats")
def get_grammar_stats(user_id: str = Depends(get_user_id)):
    return {
        level: {mode: _mode_bucket(level, mode, user_id) for mode in sorted(GRADED_FOR_SOURCE[GRAMMAR])}
        for level in GRAMMAR_BY_LEVEL
    }
