"""
Frequency-tier study routes — the "Top 200 / 201-400 / ..." alternative
to picking a JLPT level, for both kanji and vocab.

Deliberately does NOT duplicate a full second SRS pipeline: card IDs are
generated exactly the way kanji.py/vocab.py already do
(kanji_to_id/vocab_to_id, keyed by the entry's native JLPT level), so a
card reviewed here and the same card reviewed via /api/kanji or
/api/vocab are the SAME card. That also means review submission reuses
the EXISTING endpoints unchanged:

    POST /api/kanji/review   (for domain="kanji")
    POST /api/vocab/review   (for domain="vocab")

Nothing new is needed there — this router only adds ways to select and
browse cards by frequency tier instead of by level, plus the
customization endpoints. See frequency_data.py for the ordering/tier
math and frequency_store_instance.py / srs/frequency_store.py for the
per-user override persistence.

Card-building logic below is a deliberate near-duplicate of
kanji.py's _build_kanji_card/vocab.py's _build_vocab_card rather than a
shared import, specifically so this file could be added without
touching (and re-risking) those already-working endpoints. Worth
consolidating into one shared module later if the three files drift.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from core.auth import get_user_id, prefixed, unprefixed
from core.pace import new_card_limit, resolve_pace
from core.srs_instance import srs
from srs.batch_cache import key as batch_key, pick_ids
from translations import get_meaning
from content.kanji_meanings import KANJI_FR
from translations.fr.vocab_fr import VOCAB_FR
from study.modes import KANJI, VOCAB, Mode, eligible_for, resolve_for_source
# The payload builders themselves, not copies of them. KanjiScreen and
# VocabScreen treat /api/frequency/{domain}/cards as a drop-in sibling
# of /api/{domain}/cards and render both with the same component, so
# two independent builders would be two things free to drift apart --
# which is exactly what happened: this module was still emitting the
# retired `format`/`choices` shape long after the sections moved to
# `hints.indice_1`.
from routes.kanji import _build_kanji_card, _radical_number
from routes.vocab import _build_vocab_card

import content.frequency_data as freq
from core.frequency_store_instance import frequency_store

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_BATCH = 25

# Card stage promotions worth a visual "stamp" on the frontend — same
# table as kanji.py/vocab.py.
STAGE_PROMOTIONS = {
    ("new", "learning"): "learning",
    ("learning", "mastered"): "mastered",
}


def _stage_promotion(prev_stage, new_stage):
    if not prev_stage or not new_stage:
        return None
    return STAGE_PROMOTIONS.get((prev_stage, new_stage))

# See kanji.py's own copy of this pair for the full reasoning.
STAGE_DEMOTIONS = {
    ("mastered", "learning"): "learning",
}


def _stage_demotion(prev_stage, new_stage):
    if not prev_stage or not new_stage:
        return None
    return STAGE_DEMOTIONS.get((prev_stage, new_stage))


def _build_review_preview(stage, preview):
    if not preview:
        return None
    return {
        str(quality): {
            "xp_earned": p["xp_earned"],
            "leveled_up": p["leveled_up"],
            "new_level": p["new_level"],
            "stage_up": _stage_promotion(stage, p["stage"]),
            "stage_down": _stage_demotion(stage, p["stage"]),
        }
        for quality, p in preview.items()
    }


def _require_domain(domain: str) -> None:
    if domain not in freq.VALID_DOMAINS:
        raise HTTPException(status_code=404, detail=f"Unknown domain: {domain!r}")


# domain is a PATH parameter here, so modes.require_mode() -- which is
# built per source at import time -- cannot be used as a dependency the
# way the section routers use it. Same contract, resolved per request.
_SOURCE_FOR_DOMAIN = {"kanji": KANJI, "vocab": VOCAB, "vocab_jmdict": VOCAB}


def _resolve_mode(domain: str, mode: str) -> Mode:
    """
    Raises 400 rather than returning {"error": ...} with a 200, which is
    what this did before. lib/api.js only treats a non-ok response as an
    error; a 200 carrying an error body reached the screens as
    `data.cards ?? []`, i.e. as "deck exhausted", and fired the
    completion fanfare instead. Every frequency-tier session did exactly
    that from the moment the mode registry landed, because every key the
    client sends ("kanji.flashcard.f2b") was outside the old table.
    """
    resolved = resolve_for_source(_SOURCE_FOR_DOMAIN[domain], mode)
    if resolved is None:
        raise HTTPException(
            status_code=400, detail=f"Invalid mode for {domain}: {mode!r}",
        )
    return resolved


def _augment(domain: str, entry: dict) -> dict:
    """The extra fact eligible_for() asks about for kanji.radical, which
    is not on the deck entry itself. Mirrors study/card_index._augment."""
    if domain == "kanji":
        return {**entry, "radical": _radical_number(entry)}
    return entry


def _fr_map(domain: str) -> dict:
    return KANJI_FR if domain == "kanji" else VOCAB_FR


def _build_card(domain: str, raw_id: str, entry: dict, pool: list[dict], m: Mode, lang: str,
                 stage: str | None, preview: dict | None) -> dict:
    """Delegates to the section's own builder so a frequency card and a
    level card are byte-for-byte the same shape. `pool` stands in for the
    level deck as the distractor source, which is the point of the tier:
    wrong answers drawn from words of comparable frequency."""
    if domain == "kanji":
        return _build_kanji_card(raw_id, entry, pool, m, lang, stage, preview)
    return _build_vocab_card(raw_id, entry, pool, m, lang, stage, preview)


def _select_cards(domain: str, tier: int, m: Mode, lang: str, count: int, exclude_ids: set[str], user_id: str,
                   tier_size: int = freq.DEFAULT_TIER_SIZE,
                   new_limit: int | None = None):
    """Mirrors kanji.py/vocab.py's _select_cards, but the candidate pool
    is a frequency tier (native_level, entry) list instead of a single
    KANJI_BY_LEVEL[level]/VOCAB_BY_LEVEL[level] slice. `tier` (together
    with `tier_size`, since the same tier number means a different
    rank range depending on it) is only used to build the batch-cache
    group key (via a synthetic "freq_{domain}_{tier}_{tier_size}" tag)
    — every card's real ID still comes from its own native level, so
    progress stays unified with normal JLPT-level study."""
    overrides = frequency_store.get_overrides(user_id, domain)
    keys = freq.tier_keys(domain, tier, tier_size=tier_size, overrides=overrides)
    resolved = [(key, freq.resolve(domain, key)) for key in keys]
    resolved = [(key, r) for key, r in resolved if r is not None]
    if not resolved:
        return [], []

    mode = m.key

    # Not every entry can be served in every mode -- vocab.word_reading
    # needs a kanji in the word, kanji.radical needs a radical number.
    # Filtering the POOL rather than skipping at build time matters: an
    # ineligible entry left in the pool is still selectable and comes
    # back as a silently missing card, which reads as "tier exhausted".
    # The section routers have always done this; this one never did.
    resolved = [
        (key, r) for key, r in resolved
        if eligible_for(m, _augment(domain, r[1]))
    ]
    if not resolved:
        return [], []

    pool = [entry for _, (_, entry) in resolved]
    raw_ids = [freq.to_id(domain, key) for key, _ in resolved]
    by_raw_id = {freq.to_id(domain, key): entry for key, (_, entry) in resolved}

    card_ids = prefixed(raw_ids, user_id)
    cache_key = batch_key("user", user_id, mode, f"freq_{domain}_{tier}_{tier_size}")
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

    states = srs.get_bulk_stats(picked, mode)
    previews = srs.preview_reviews_bulk(picked, mode, user_id)

    cards = []
    for card_id in picked:
        raw_id = unprefixed(card_id, user_id)
        entry = by_raw_id.get(raw_id)
        if entry is not None:
            cards.append(_build_card(domain, raw_id, entry, pool, m, lang, states.get(card_id), previews.get(card_id)))

    logger.info(
        "frequency study request domain=%s tier=%d tier_size=%d mode=%s user_id=%s requested=%d due_count=%d picked=%d",
        domain, tier, tier_size, mode, user_id, count, len(due), len(cards),
    )
    return pool, cards


@router.get("/api/frequency/{domain}/tiers")
def get_tiers(domain: str, tier_size: int = freq.DEFAULT_TIER_SIZE):
    _require_domain(domain)
    if tier_size < 1:
        return {"error": "tier_size must be a positive integer"}

    order = freq.standard_order(domain)
    total = len(order)
    n_tiers = freq.tier_count(domain, tier_size)

    tiers = []
    for t in range(1, n_tiers + 1):
        start, end = freq.tier_bounds(t, tier_size)
        count = max(0, min(end, total) - start + 1)
        tiers.append({"tier": t, "start_rank": start, "end_rank": min(end, total), "count": count})

    return {"domain": domain, "tier_size": tier_size, "total_items": total, "tiers": tiers}


@router.get("/api/frequency/{domain}/tier/{tier}/items")
def get_tier_items(domain: str, tier: int, lang: str = "fr", tier_size: int = freq.DEFAULT_TIER_SIZE,
                   user_id: str = Depends(get_user_id)):
    """Lightweight, non-SRS listing of what's in a tier — meant for a
    browse/manage UI (e.g. to let the user see and reorder items),
    not for studying (see /tier/{tier}/card(s) for that)."""
    _require_domain(domain)

    overrides = frequency_store.get_overrides(user_id, domain)
    keys = freq.tier_keys(domain, tier, tier_size=tier_size, overrides=overrides)
    fr_map = _fr_map(domain)

    items = []
    for key in keys:
        resolved = freq.resolve(domain, key)
        if resolved is None:
            continue
        level, entry = resolved
        items.append({
            "key": key,
            "kanji": entry.get("kanji", ""),
            "kana": entry.get("kana", ""),
            "meaning": get_meaning(entry, lang, fr_map),
            "level": level,
            "standard_tier": freq.standard_tier_of(domain, key, freq.DEFAULT_TIER_SIZE),
            "is_override": key in overrides,
        })

    return {"domain": domain, "tier": tier, "tier_size": tier_size, "items": items}


@router.get("/api/frequency/{domain}/card")
def get_frequency_card(domain: str, tier: int, mode: str, lang: str = "fr", tier_size: int = freq.DEFAULT_TIER_SIZE,
                       user_id: str = Depends(get_user_id)):
    _require_domain(domain)
    m = _resolve_mode(domain, mode)

    pool, cards = _select_cards(domain, tier, m, lang, count=1, exclude_ids=set(), user_id=user_id, tier_size=tier_size)
    if not pool:
        return {"error": "Empty tier"}
    if not cards:
        logger.warning("frequency study exhausted domain=%s tier=%d mode=%s user_id=%s", domain, tier, mode, user_id)
        return {"done": True}
    return cards[0]


@router.get("/api/frequency/{domain}/cards")
def get_frequency_cards(domain: str, tier: int, mode: str, lang: str = "fr", count: int = Query(10, ge=1, le=100), exclude: str = "",
                        tier_size: int = freq.DEFAULT_TIER_SIZE,
                        beyond_target: bool = Query(False),
                        user_id: str = Depends(get_user_id)):
    _require_domain(domain)
    m = _resolve_mode(domain, mode)

    pace = resolve_pace(user_id)
    pool, cards = _select_cards(
        domain, tier, m, lang,
        count=max(1, min(count, MAX_BATCH)),
        exclude_ids={f"{user_id}:{cid}" for cid in exclude.split(",") if cid},
        user_id=user_id,
        tier_size=tier_size,
        new_limit=new_card_limit(pace, beyond_target),
    )
    if not pool:
        return {"error": "Empty tier"}
    return {"cards": cards, "pace": pace.payload() if pace else None}


@router.get("/api/frequency/{domain}/stats")
def get_frequency_stats(domain: str, tier: int, mode: str, tier_size: int = freq.DEFAULT_TIER_SIZE,
                        user_id: str = Depends(get_user_id)):
    _require_domain(domain)
    m = _resolve_mode(domain, mode)

    overrides = frequency_store.get_overrides(user_id, domain)
    keys = freq.tier_keys(domain, tier, tier_size=tier_size, overrides=overrides)

    # Eligibility-filtered, so `total` is a number this mode can actually
    # finish. Counting the whole tier when word_reading can only serve
    # the kanji-bearing part of it puts a ceiling below 100% on the
    # progress bar and reads as a stalled learner. Same rule the card
    # pool above applies, and the same one study/card_index applies to
    # the level bars on the stats screen.
    raw_ids = []
    for key in keys:
        r = freq.resolve(domain, key)
        if r is None:
            continue
        if not eligible_for(m, _augment(domain, r[1])):
            continue
        rid = freq.to_id(domain, key)
        if rid is not None:
            raw_ids.append(rid)

    if not raw_ids:
        return {"error": "Empty tier"}

    card_ids = prefixed(raw_ids, user_id)
    states = srs.get_bulk_stats(card_ids, mode)
    due = srs.get_due_cards(mode, limit=len(card_ids), card_ids=card_ids)

    return {
        "total": len(card_ids),
        "new": sum(1 for s in states.values() if s == "new"),
        "learning": sum(1 for s in states.values() if s == "learning"),
        "mastered": sum(1 for s in states.values() if s == "mastered"),
        "due_now": len(due),
    }


class CustomizePayload(BaseModel):
    # key: kanji char for domain="kanji", "kanji::kana" for domain="vocab"
    # (same key shape returned by /tier/{tier}/items). tier is always
    # interpreted under frequency_data.DEFAULT_TIER_SIZE — see that
    # module's docstring.
    overrides: list[dict]


@router.post("/api/frequency/{domain}/customize")
def customize_tiers(domain: str, payload: CustomizePayload, user_id: str = Depends(get_user_id)):
    _require_domain(domain)

    updates = {}
    invalid_keys = []
    for item in payload.overrides:
        key, tier = item.get("key"), item.get("tier")
        if not key or not isinstance(tier, int) or tier < 1:
            return {"error": f"Invalid override entry: {item!r}"}
        if freq.resolve(domain, key) is None:
            invalid_keys.append(key)
            continue
        updates[key] = tier

    frequency_store.set_overrides(user_id, domain, updates)
    return {
        "domain": domain,
        "applied": len(updates),
        "skipped_unknown_keys": invalid_keys,
        "overrides": frequency_store.get_overrides(user_id, domain),
    }


class ResetPayload(BaseModel):
    # Omit or send an empty list to reset ALL overrides for this domain.
    keys: list[str] = []


@router.post("/api/frequency/{domain}/reset")
def reset_tiers(domain: str, payload: ResetPayload, user_id: str = Depends(get_user_id)):
    _require_domain(domain)
    removed = frequency_store.clear_overrides(user_id, domain, payload.keys or None)
    return {"domain": domain, "removed": removed}