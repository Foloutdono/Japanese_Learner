"""
Study endpoints for thematic decks ("fruits", "jobs", "body parts", ...) —
the theme counterpart to vocab.py's level-based /api/vocab/card|cards|stats,
and structurally identical to it on purpose: same SRS plumbing
(srs.ensure_cards / get_due_cards / get_new_cards / preview_reviews_bulk),
same MAX_BATCH, same review-preview/stage-promotion helpers. The only real
difference is where the word pool and card ids come from — theme_data.py's
DB-backed theme_entries()/theme_card_ids() instead of
VOCAB_BY_LEVEL/vocab_to_id.

A theme's card ids are the SAME ids vocab_to_id/vocab_jmdict_to_id would
produce for those words under their level/JMdict-pool card — see
theme_data.py's docstring — so a word already studied via its JLPT level
or a frequency tier shows up already-in-progress here too, not as a
duplicate "new" card, and vice versa.

Kept in its own file/router rather than folded into vocab.py so a level
request never has to import theme_data.py (and its sqlite connection) to
run, and so this can be dropped entirely if themes are ever pulled —
mirrors why frequency.py (tiers) isn't merged into vocab.py either.
"""
import logging
import random

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth import get_user_id, prefixed, unprefixed
from srs_instance import srs
from srs.batch_cache import ensure_initialized, key as batch_key, pick_ids
from translations import get_meaning
from translations.fr.vocab_fr import VOCAB_FR
from quiz_modes import QCM_FLASHCARD_MODES as MODE_INFO
import theme_data
from vocab import _stage_promotion, _build_review_preview, MAX_BATCH  # reuse, don't duplicate

router = APIRouter()
logger = logging.getLogger(__name__)

FR_MAP = VOCAB_FR


class ThemeReviewPayload(BaseModel):
    card_id:    str
    mode:       str
    quality:    int
    prev_stage: str | None = None


def _entry_meaning(entry: dict, lang: str) -> str:
    """Curated-deck ("vocab") entries have a hand-translated FR gloss
    via get_meaning/FR_MAP, same as vocab.py. JMdict-pool
    ("vocab_jmdict") entries don't — VOCAB_FR only covers the app's own
    deck — so those fall back to the raw JMdict meaning untranslated,
    exactly like dictionary.py's category="jmdict" branch already does
    for the same reason."""
    if entry["domain"] == "vocab":
        return get_meaning(entry, lang, FR_MAP)
    return entry["meaning"]


def _build_theme_card(card_id: str, entry: dict, pool: list[dict], mode: str, lang: str,
                       stage: str | None, preview: dict[int, dict] | None = None) -> dict:
    meaning = _entry_meaning(entry, lang)
    fmt, direction = MODE_INFO[mode]

    payload = {
        "card_id":   card_id,
        "mode":      mode,
        "format":    fmt,
        "direction": direction,
        "kanji":     entry["kanji"],
        "kana":      entry["kana"],
        "meaning":   meaning,
        "level":     entry["level"],  # native JLPT level, or None for a JMdict-pool word
        "stage":     stage,
        "review_preview": _build_review_preview(stage, preview),
    }

    if fmt == "qcm":
        all_candidates = [e for e in pool if _entry_meaning(e, lang) != meaning]
        choice_entries = random.sample(all_candidates, min(3, len(all_candidates))) + [entry]
        random.shuffle(choice_entries)
        payload["choices"] = [
            {"kanji": c["kanji"], "kana": c["kana"], "meaning": _entry_meaning(c, lang)}
            for c in choice_entries
        ]

    return payload


def _select_theme_cards(theme: str, mode: str, lang: str, count: int, exclude_ids: set[str], user_id: str):
    pool = theme_data.theme_entries(theme)
    if not pool or mode not in MODE_INFO:
        return None, None
    by_card_id = {e["card_id"]: e for e in pool}

    card_ids  = prefixed(list(by_card_id.keys()), user_id)
    cache_key = batch_key("user", user_id, mode, f"theme:{theme}")
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
        entry = by_card_id.get(raw_id)
        if entry is not None:
            cards.append(_build_theme_card(raw_id, entry, pool, mode, lang, states.get(card_id), previews.get(card_id)))

    logger.info(
        "theme study request theme=%s mode=%s user_id=%s requested=%d due_count=%d picked=%d",
        theme, mode, user_id, count, len(due), len(cards),
    )
    return pool, cards


@router.get("/api/themes")
def get_themes():
    """List of {key, count} for ThemeSelector.jsx — display labels are
    resolved client-side via the translation file (t.theme<Key>), same
    convention as LevelSelector's LEVEL_HINTS."""
    return {"themes": theme_data.list_themes()}


@router.get("/api/vocab/theme/{theme}/card")
def get_theme_card(theme: str, mode: str, lang: str = "fr", user_id: str = Depends(get_user_id)):
    pool, cards = _select_theme_cards(theme, mode, lang, count=1, exclude_ids=set(), user_id=user_id)
    if pool is None:
        if not theme_data.theme_entries(theme):
            return {"error": "Unknown theme"}
        return {"error": "Invalid mode"}
    if not cards:
        logger.warning("theme study exhausted theme=%s mode=%s user_id=%s", theme, mode, user_id)
        return {"done": True}
    return cards[0]


@router.get("/api/vocab/theme/{theme}/cards")
def get_theme_cards(theme: str, mode: str, lang: str = "fr", count: int = 10, exclude: str = "",
                    user_id: str = Depends(get_user_id)):
    pool, cards = _select_theme_cards(
        theme, mode, lang,
        count=max(1, min(count, MAX_BATCH)),
        exclude_ids={f"{user_id}:{cid}" for cid in exclude.split(",") if cid},
        user_id=user_id,
    )
    if pool is None:
        if not theme_data.theme_entries(theme):
            return {"error": "Unknown theme"}
        return {"error": "Invalid mode"}
    return {"cards": cards}


@router.post("/api/vocab/theme/review")
def post_theme_review(payload: ThemeReviewPayload, user_id: str = Depends(get_user_id)):
    card_id = f"{user_id}:{payload.card_id}"
    s = srs.review(card_id, payload.mode, payload.quality)
    return {
        "card_id": payload.card_id,
        "interval": s["interval"],
        "next_review": s["next_review"],
        "xp_earned": s["xp_earned"],
        "leveled_up": s["leveled_up"],
        "new_level": s["new_level"],
        "stage_up": _stage_promotion(payload.prev_stage, s["stage"]),
    }


@router.get("/api/vocab/theme/{theme}/stats")
def get_theme_stats(theme: str, mode: str, user_id: str = Depends(get_user_id)):
    pool = theme_data.theme_entries(theme)
    if not pool:
        return {"error": "Unknown theme"}
    if mode not in MODE_INFO:
        return {"error": "Invalid mode"}

    card_ids = prefixed([e["card_id"] for e in pool], user_id)
    states  = srs.get_bulk_stats(card_ids, mode)
    due     = srs.get_due_cards(mode, limit=len(card_ids), card_ids=card_ids)

    return {
        "total":    len(card_ids),
        "new":      sum(1 for s in states.values() if s == "new"),
        "learning": sum(1 for s in states.values() if s == "learning"),
        "mastered": sum(1 for s in states.values() if s == "mastered"),
        "due_now":  len(due),
    }
