"""
Study endpoints for thematic decks ("fruits", "jobs", "body parts", ...) —
the theme counterpart to vocab.py's level-based /api/vocab/card|cards|stats,
and structurally identical to it on purpose: same SRS plumbing
(srs.get_due_cards / get_new_cards / preview_reviews_bulk),
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

from fastapi import APIRouter, Depends, Query

from core.auth import get_user_id, prefixed, unprefixed
from core.pace import new_card_limit, resolve_pace
from core.srs_instance import srs
from srs.batch_cache import key as batch_key, pick_ids
from translations import get_meaning
from translations.fr.vocab_fr import VOCAB_FR
from study.modes import VOCAB, Mode, eligible_for, require_mode
from content import theme_data
# reuse, don't duplicate -- a theme card and a level card are rendered by
# the same component, so they are built by the same function.
from routes.vocab import _build_vocab_card, MAX_BATCH

router = APIRouter()
logger = logging.getLogger(__name__)

FR_MAP = VOCAB_FR

# No ThemeReviewPayload / POST /api/vocab/theme/review here — reviews
# are posted to vocab.py's existing POST /api/vocab/review instead.
# That endpoint is already domain-agnostic (card_id + mode + quality,
# nothing level/tier/theme-specific), and a theme card's card_id is
# the exact same id vocab_to_id/vocab_jmdict_to_id already produced
# for it under its level or frequency tier — see theme_data.py's
# docstring — so there's nothing a theme-specific review endpoint
# would do differently. Duplicating it would just be one more place
# for the stage-promotion logic to drift out of sync.


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


def _build_theme_card(card_id: str, entry: dict, pool: list[dict], m: Mode, lang: str,
                       stage: str | None, preview: dict[int, dict] | None = None) -> dict:
    """
    vocab.py's builder plus the one field a theme card has that a level
    card does not: the word's NATIVE JLPT level (None for a word that
    only exists in the JMdict pool), which the theme UI shows as a badge.

    This was a third independent copy of the vocab payload, and it was
    still emitting the retired `format`/`choices` shape -- so every theme
    card arrived without the `hints` key the client reads, on top of
    MODE_INFO[mode] raising KeyError for every current mode key.
    """
    payload = _build_vocab_card(
        card_id, entry, pool, m, lang, stage, preview,
        meaning_of=lambda e: _entry_meaning(e, lang),
    )
    payload["level"] = entry["level"]
    return payload


def _select_theme_cards(theme: str, m: Mode, lang: str, count: int, exclude_ids: set[str], user_id: str,
                        new_limit: int | None = None):
    pool = theme_data.theme_entries(theme)
    if not pool:
        return None, None

    mode = m.key
    # vocab.word_reading cannot serve a kana-only word -- the prompt
    # would be the answer. See modes.eligible_for.
    pool = [e for e in pool if eligible_for(m, e)]
    if not pool:
        return None, None
    by_card_id = {e["card_id"]: e for e in pool}

    card_ids  = prefixed(list(by_card_id.keys()), user_id)
    cache_key = batch_key("user", user_id, mode, f"theme:{theme}")
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
        entry = by_card_id.get(raw_id)
        if entry is not None:
            cards.append(_build_theme_card(raw_id, entry, pool, m, lang, states.get(card_id), previews.get(card_id)))

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
def get_theme_card(theme: str, lang: str = "fr",
                   m: Mode = Depends(require_mode(VOCAB)),
                   user_id: str = Depends(get_user_id)):
    mode = m.key
    pool, cards = _select_theme_cards(theme, m, lang, count=1, exclude_ids=set(), user_id=user_id)
    if pool is None:
        return {"error": "Unknown theme"}
    if not cards:
        logger.warning("theme study exhausted theme=%s mode=%s user_id=%s", theme, mode, user_id)
        return {"done": True}
    return cards[0]


@router.get("/api/vocab/theme/{theme}/cards")
def get_theme_cards(theme: str, lang: str = "fr", count: int = Query(10, ge=1, le=100), exclude: str = "",
                    beyond_target: bool = Query(False),
                    m: Mode = Depends(require_mode(VOCAB)),
                    user_id: str = Depends(get_user_id)):
    pace = resolve_pace(user_id)
    pool, cards = _select_theme_cards(
        theme, m, lang,
        count=max(1, min(count, MAX_BATCH)),
        exclude_ids={f"{user_id}:{cid}" for cid in exclude.split(",") if cid},
        user_id=user_id,
        new_limit=new_card_limit(pace, beyond_target),
    )
    if pool is None:
        return {"error": "Unknown theme"}
    return {"cards": cards, "pace": pace.payload() if pace else None}


@router.get("/api/vocab/theme/{theme}/stats")
def get_theme_stats(theme: str,
                    m: Mode = Depends(require_mode(VOCAB)),
                    user_id: str = Depends(get_user_id)):
    mode = m.key
    pool = theme_data.theme_entries(theme)
    if not pool:
        return {"error": "Unknown theme"}

    # Eligibility-filtered so `total` is reachable -- see the same note
    # on routes/frequency.py's stats endpoint.
    pool = [e for e in pool if eligible_for(m, e)]
    if not pool:
        return {"error": "Unknown theme"}

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
