"""
Study endpoints for thematic decks ("fruits", "jobs", "body parts", ...) —
the theme counterpart to vocab.py's level-based /api/vocab/card|cards|stats,
and structurally identical to it on purpose: same SRS plumbing
(srs.get_due_cards / get_new_cards / preview_reviews_bulk),
same MAX_BATCH, same review-preview/stage-promotion helpers. The only real
difference is where the word pool and card ids come from —
theme_data.theme_entries() instead of VOCAB_BY_LEVEL/vocab_to_id.

A theme is further split into four levels — basic/medium/advanced/expert,
cut by frequency, see theme_data.py. The level travels as an OPTIONAL
query param rather than a path segment, matching how frequency.py carries
`tier` on its own card/cards/stats endpoints; omitting it studies the
whole theme, which is what every pre-level client does.

A theme's card ids are the SAME ids vocab_to_id/vocab_jmdict_to_id would
produce for those words under their level/JMdict-pool card — see
theme_data.py's docstring — so a word already studied via its JLPT level
or a frequency tier shows up already-in-progress here too, not as a
duplicate "new" card, and vice versa.

Kept in its own file/router rather than folded into vocab.py so a level
request never has to import theme_data.py (and its theme table) to run,
and so this can be dropped entirely if themes are ever pulled —
mirrors why frequency.py (tiers) isn't merged into vocab.py either.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query

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
    payload["theme_level"] = entry["theme_level"]
    return payload


def _select_theme_cards(theme: str, level: str | None, m: Mode, lang: str, count: int,
                        exclude_ids: set[str], user_id: str, new_limit: int | None = None):
    pool = theme_data.theme_entries(theme, level)
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
    # The level belongs in the key: without it the in-process new-card
    # batch built for 基本 keeps being served after the learner walks up
    # to 上級.
    cache_key = batch_key("user", user_id, mode, f"theme:{theme}:{level or 'all'}")
    # No pre-materialisation. get_new_cards selects over the ids passed
    # here rather than joining `cards`, so nothing has to exist in
    # card_modes before a card can be served — a scheduler row is written
    # on first review instead. This call used to write one row per deck
    # card per mode (3,476 of them for N1 vocab) on the first request.

    due = srs.get_due_cards(mode, card_ids=card_ids)
    picked = pick_ids(
        cache_key, due,
        # ordered=True: the pool is already commonest-first and that is
        # the whole point of the levels — see theme_data.py.
        lambda limit: srs.get_new_cards(mode, limit=limit, card_ids=card_ids, ordered=True),
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
        "theme study request theme=%s level=%s mode=%s user_id=%s requested=%d due_count=%d picked=%d",
        theme, level or "all", mode, user_id, count, len(due), len(cards),
    )
    return pool, cards


def _require_level(level: str) -> str | None:
    """"" (absent) means the whole theme; anything else must be one of
    theme_data.LEVELS."""
    if not level:
        return None
    if level not in theme_data.LEVELS:
        raise HTTPException(status_code=400, detail=f"Unknown level: {level}")
    return level


def _require_theme(theme: str) -> None:
    """A missing theme is a 404, not a 200 carrying {"error": ...}.

    lib/api.js only treats a non-ok RESPONSE as an error, so a 200 with an
    error body reached the run screen as `data.cards ?? []` — i.e. "deck
    exhausted" — and fired the completion fanfare for a typo'd theme. Same
    trap frequency.py's _resolve_mode docstring documents.

    Checked against theme_data.has_theme rather than against an empty
    pool: an existing band CAN legitimately come back empty once the mode
    filter runs (vocab.word_reading cannot serve a kana-only word), and
    that is an exhausted session, not a bad URL."""
    if not theme_data.has_theme(theme):
        raise HTTPException(status_code=404, detail=f"Unknown theme: {theme}")


@router.get("/api/themes")
def get_themes():
    """List of {key, count, levels:[{level, count} x4]} for
    ThemeSelector.jsx and ThemeLevelSelector.jsx — display labels are
    resolved client-side via the translation file (t.theme<Key>), same
    convention as LevelSelector's LEVEL_HINTS."""
    return {"themes": theme_data.list_themes()}


@router.get("/api/vocab/theme/{theme}/card")
def get_theme_card(theme: str, level: str = "", lang: str = "fr",
                   m: Mode = Depends(require_mode(VOCAB)),
                   user_id: str = Depends(get_user_id)):
    mode = m.key
    _require_theme(theme)
    lvl = _require_level(level)
    _pool, cards = _select_theme_cards(theme, lvl, m, lang, count=1, exclude_ids=set(), user_id=user_id)
    if not cards:
        logger.warning("theme study exhausted theme=%s level=%s mode=%s user_id=%s",
                       theme, lvl or "all", mode, user_id)
        return {"done": True}
    return cards[0]


@router.get("/api/vocab/theme/{theme}/cards")
def get_theme_cards(theme: str, level: str = "", lang: str = "fr",
                    count: int = Query(10, ge=1, le=100), exclude: str = "",
                    beyond_target: bool = Query(False),
                    m: Mode = Depends(require_mode(VOCAB)),
                    user_id: str = Depends(get_user_id)):
    _require_theme(theme)
    pace = resolve_pace(user_id)
    _pool, cards = _select_theme_cards(
        theme, _require_level(level), m, lang,
        count=max(1, min(count, MAX_BATCH)),
        exclude_ids={f"{user_id}:{cid}" for cid in exclude.split(",") if cid},
        user_id=user_id,
        new_limit=new_card_limit(pace, beyond_target),
    )
    return {"cards": cards or [], "pace": pace.payload() if pace else None}


@router.get("/api/vocab/theme/{theme}/stats")
def get_theme_stats(theme: str, level: str = "",
                    m: Mode = Depends(require_mode(VOCAB)),
                    user_id: str = Depends(get_user_id)):
    mode = m.key
    _require_theme(theme)
    pool = theme_data.theme_entries(theme, _require_level(level))

    # Eligibility-filtered so `total` is reachable -- see the same note
    # on routes/frequency.py's stats endpoint. An empty result here is a
    # real, reachable state (a band of kana-only words under
    # vocab.word_reading), not a bad theme, so it reports zeroes rather
    # than 404-ing.
    pool = [e for e in pool if eligible_for(m, e)]
    if not pool:
        return {"total": 0, "new": 0, "learning": 0, "mastered": 0, "due_now": 0}

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
