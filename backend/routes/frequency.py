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
import random
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.auth import get_user_id, prefixed, unprefixed
from core.srs_instance import srs
from srs.batch_cache import ensure_initialized, key as batch_key, pick_ids
from translations import get_meaning
from content.kanji_meanings import KANJI_FR
from translations.fr.vocab_fr import VOCAB_FR
from study.quiz_modes import QCM_FLASHCARD_MODES, KANJI_MODES
from study.mcq import pick_distractors

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


def _valid_modes(domain: str) -> set[str]:
    return set(KANJI_MODES) if domain == "kanji" else set(QCM_FLASHCARD_MODES)


def _fr_map(domain: str) -> dict:
    return KANJI_FR if domain == "kanji" else VOCAB_FR


def _build_card(domain: str, raw_id: str, entry: dict, pool: list[dict], mode: str, lang: str,
                 stage: str | None, preview: dict | None) -> dict:
    fr_map = _fr_map(domain)
    meaning = get_meaning(entry, lang, fr_map)

    payload = {
        "card_id": raw_id,
        "mode": mode,
        "kanji": entry.get("kanji", ""),
        "kana": entry.get("kana", ""),
        "meaning": meaning,
        "stage": stage,
        "review_preview": _build_review_preview(stage, preview),
    }
    if domain == "kanji":
        payload["stroke_count"] = entry.get("stroke_count", "")
        if mode == "write":
            return payload

    fmt, direction = QCM_FLASHCARD_MODES[mode]
    payload["format"] = fmt
    payload["direction"] = direction

    if fmt == "qcm":
        choice_entries = pick_distractors(
            pool, lambda e: get_meaning(e, lang, fr_map), meaning,
        ) + [entry]
        random.shuffle(choice_entries)
        if domain == "kanji":
            payload["choices"] = [
                {"kanji": c.get("kanji", ""), "meaning": get_meaning(c, lang, fr_map)}
                for c in choice_entries
            ]
        else:
            payload["choices"] = [
                {"kanji": c.get("kanji", ""), "kana": c.get("kana", ""), "meaning": get_meaning(c, lang, fr_map)}
                for c in choice_entries
            ]

    return payload


def _select_cards(domain: str, tier: int, mode: str, lang: str, count: int, exclude_ids: set[str], user_id: str,
                   tier_size: int = freq.DEFAULT_TIER_SIZE):
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

    pool = [entry for _, (_, entry) in resolved]
    raw_ids = [freq.to_id(domain, key) for key, _ in resolved]
    by_raw_id = {freq.to_id(domain, key): entry for key, (_, entry) in resolved}

    card_ids = prefixed(raw_ids, user_id)
    cache_key = batch_key("user", user_id, mode, f"freq_{domain}_{tier}_{tier_size}")
    ensure_initialized(cache_key, lambda: srs.ensure_cards(card_ids, mode), version=card_ids)

    due = srs.get_due_cards(mode, card_ids=card_ids)
    picked = pick_ids(
        cache_key, due,
        lambda limit: srs.get_new_cards(mode, limit=limit, card_ids=card_ids),
        count, exclude_ids,
    )

    states = srs.get_bulk_stats(picked, mode)
    previews = srs.preview_reviews_bulk(picked, mode, user_id)

    cards = []
    for card_id in picked:
        raw_id = unprefixed(card_id, user_id)
        entry = by_raw_id.get(raw_id)
        if entry is not None:
            cards.append(_build_card(domain, raw_id, entry, pool, mode, lang, states.get(card_id), previews.get(card_id)))

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
    if mode not in _valid_modes(domain):
        return {"error": "Invalid mode"}

    pool, cards = _select_cards(domain, tier, mode, lang, count=1, exclude_ids=set(), user_id=user_id, tier_size=tier_size)
    if not pool:
        return {"error": "Empty tier"}
    if not cards:
        logger.warning("frequency study exhausted domain=%s tier=%d mode=%s user_id=%s", domain, tier, mode, user_id)
        return {"done": True}
    return cards[0]


@router.get("/api/frequency/{domain}/cards")
def get_frequency_cards(domain: str, tier: int, mode: str, lang: str = "fr", count: int = 10, exclude: str = "",
                        tier_size: int = freq.DEFAULT_TIER_SIZE, user_id: str = Depends(get_user_id)):
    _require_domain(domain)
    if mode not in _valid_modes(domain):
        return {"error": "Invalid mode"}

    pool, cards = _select_cards(
        domain, tier, mode, lang,
        count=max(1, min(count, MAX_BATCH)),
        exclude_ids={f"{user_id}:{cid}" for cid in exclude.split(",") if cid},
        user_id=user_id,
        tier_size=tier_size,
    )
    if not pool:
        return {"error": "Empty tier"}
    return {"cards": cards}


@router.get("/api/frequency/{domain}/stats")
def get_frequency_stats(domain: str, tier: int, mode: str, tier_size: int = freq.DEFAULT_TIER_SIZE,
                        user_id: str = Depends(get_user_id)):
    _require_domain(domain)
    if mode not in _valid_modes(domain):
        return {"error": "Invalid mode"}

    overrides = frequency_store.get_overrides(user_id, domain)
    keys = freq.tier_keys(domain, tier, tier_size=tier_size, overrides=overrides)
    raw_ids = [freq.to_id(domain, key) for key in keys]
    raw_ids = [rid for rid in raw_ids if rid is not None]
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