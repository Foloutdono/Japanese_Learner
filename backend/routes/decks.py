import logging
import csv
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from core.auth import get_user_id, prefixed, unprefixed
from core.db import db_conn
from core.srs_instance import srs
from srs.batch_cache import key as batch_key, pick_ids
from content.vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from content.kanji_data import KANJI_BY_LEVEL, kanji_to_id
from content.grammar_points_data import (
    GRAMMAR_POINTS_BY_LEVEL as GRAMMAR_BY_LEVEL, grammar_to_id,
)
from translations import get_meaning
from translations.fr.vocab_fr import VOCAB_FR
from content.kanji_meanings import KANJI_FR

# Reuse the exact same MCQ/choice-building + review-preview logic the
# Kanji/Vocab/Grammar screens use, instead of a second copy living
# here that could drift out of sync. Each _build_*_card already knows
# how to shape one card payload (choices, fill-in blanks, review
# previews, ...) for its own mode set — decks.py just needs to route
# to the right one per card. See SOURCES below.
from routes.kanji import VALID_MODES as KANJI_VALID_MODES, _build_kanji_card
from routes.vocab import MODE_INFO as VOCAB_MODE_INFO, _build_vocab_card
from routes.grammar import _build_grammar_card
from study.modes import (
    MODES,
    FLASHCARD as BASE_FLASHCARD,
    GRAMMAR as MODE_GRAMMAR,
    STANDARD as MODE_STANDARD,
    KANJI as MODE_KANJI,
    VOCAB as MODE_VOCAB,
    GRADED_FOR_SOURCE,
    resolve_for_source,
)
import psycopg2.extras

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_BATCH = 25


# ── Source registry ──────────────────────────────────────────
# One entry per kind of card a deck can pull in from the rest of the
# app, on top of the user's own custom_cards. Browsing, adding,
# removing, computing a deck's available study modes, and building
# study-session cards ALL key off this dict — so wiring in a new
# source (kana, or a fuller dictionary-backed vocab search once those
# files are in) is just adding an entry here, not touching every
# endpoint below.
#
#   by_level:    {level: [entry, ...]} — same shape as
#                KANJI_BY_LEVEL/VOCAB_BY_LEVEL/GRAMMAR_BY_LEVEL
#   to_id:       entry, level -> raw id string (kanji_to_id-style)
#   valid_modes: study modes this source's cards support
#   build:       (raw_id, entry, level, level_list, mode, lang,
#                 stage, preview) -> full card payload for the
#                 frontend, in the uniform shape decks.py needs
#                 regardless of the underlying router's own signature
#
# NOT registered yet, on purpose — the natural next additions:
#   - "kana":  kana_data.py exists but there's no kana.py router to
#     borrow a _build_kana_card from yet, and kana-only quiz modes are
#     being reworked elsewhere in the app right now. Add it here once
#     that lands.
#   - a real dictionary-backed "vocab" search: today's browse only
#     searches the JLPT-leveled VOCAB_BY_LEVEL deck, not the full
#     dictionary. Once the fuller dictionary files are in, either
#     extend this "vocab" entry's by_level/to_id or add a sibling
#     source (e.g. "dictionary") reusing _build_vocab_card the same
#     way.

# The kanji/vocab builders take a resolved Mode now rather than a mode
# string (see _build_kanji_card's docstring for why `format` went away).
# A deck's session still arrives carrying whatever key get_deck_modes
# advertised, so resolve it here against the source it belongs to —
# which also means a legacy key keeps working through LEGACY_ALIASES
# while the frontend catches up. Restructuring decks.py's own mode
# handling is the deck-structures phase, not this one.
def _wrap_kanji(raw_id, entry, level, level_list, mode, lang, stage, preview):
    m = resolve_for_source(MODE_KANJI, mode)
    if m is None:
        raise HTTPException(status_code=400, detail=f"Invalid kanji mode: {mode!r}")
    return _build_kanji_card(raw_id, entry, level_list, m, lang, stage, preview)


def _wrap_vocab(raw_id, entry, level, level_list, mode, lang, stage, preview):
    m = resolve_for_source(MODE_VOCAB, mode)
    if m is None:
        raise HTTPException(status_code=400, detail=f"Invalid vocab mode: {mode!r}")
    return _build_vocab_card(raw_id, entry, level_list, m, lang, stage, preview)


def _wrap_grammar(raw_id, entry, level, level_list, mode, lang, stage, preview):
    m = resolve_for_source(MODE_GRAMMAR, mode)
    if m is None:
        raise HTTPException(status_code=400, detail=f"Invalid grammar mode: {mode!r}")
    card = _build_grammar_card(entry, level, level_list, m, stage, preview)
    card["card_id"] = raw_id
    return card


SOURCES = {
    "kanji": {
        "by_level":    KANJI_BY_LEVEL,
        "to_id":       kanji_to_id,
        "valid_modes": KANJI_VALID_MODES,
        "build":       _wrap_kanji,
    },
    "vocab": {
        "by_level":    VOCAB_BY_LEVEL,
        "to_id":       vocab_to_id,
        "valid_modes": set(VOCAB_MODE_INFO.keys()),
        "build":       _wrap_vocab,
    },
    "grammar": {
        "by_level":    GRAMMAR_BY_LEVEL,
        "to_id":       grammar_to_id,
        "valid_modes": set(GRADED_FOR_SOURCE[MODE_GRAMMAR]),
        "build":       _wrap_grammar,
    },
}

# ── A deck has ONE STRUCTURE ──────────────────────────────────
# `type` is the deck's structure, and it decides everything: which app
# cards can be browsed in, which personal cards can be written, and which
# study modes the deck offers. There is no 'mixed' any more.
#
# Mixed decks were dropped because they made every other question harder
# for no gain. A deck holding kanji and grammar had to union two sources'
# modes, and then answer what a mode means for a card from the other
# source -- which is how a hand-written pair ended up eligible for a
# grammar session (see _eligible). One structure per deck makes the deck's
# modes simply the structure's modes.
#
# The old model also had this exactly backwards for personal cards: a
# kanji-typed deck accepted app kanji and NO hand-written cards at all,
# so a kanji deck was the one place a personal kanji card could not go.
# Now every structure accepts personal cards OF ITS OWN STRUCTURE, which
# is what makes "write your own kanji card" a thing that exists.
STRUCTURES = ("standard", "kanji", "vocab", "grammar")

# Structure -> the one app source it browses in. `standard` is a plain
# front/back pair with no app source behind it.
SOURCE_FOR_TYPE = {
    "kanji":   {"kanji"},
    "vocab":   {"vocab"},
    "grammar": {"grammar"},
}

# Structure -> the registry source its cards study under. A personal
# kanji-structure card gets kanji's modes, which is the whole point of
# giving personal cards a structure.
REGISTRY_SOURCE_FOR_TYPE = {
    "standard": MODE_STANDARD,
    "kanji":    MODE_KANJI,
    "vocab":    MODE_VOCAB,
    "grammar":  MODE_GRAMMAR,
}


def _allowed_sources(deck_type: str) -> set[str]:
    """App sources this structure browses in; empty for `standard`."""
    return SOURCE_FOR_TYPE.get(deck_type, set())


def _allows_custom(deck_type: str) -> bool:
    """
    Every structure accepts hand-written cards -- of its own structure.

    This used to return False for kanji/vocab/grammar, hiding "Add card"
    on exactly the decks where a personal card of that kind belongs.
    """
    return deck_type in REGISTRY_SOURCE_FOR_TYPE


def _registry_source(deck_type: str) -> str:
    """The study-mode source for a deck, falling back to `standard`."""
    return REGISTRY_SOURCE_FOR_TYPE.get(deck_type, MODE_STANDARD)


# Card stage promotions worth a visual "stamp" on the frontend — same
# rule as kana.py/kanji.py/vocab.py/grammar.py's own copy.
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
    """Same shape as kanji.py/vocab.py/grammar.py's own helper — kept
    as a local copy here (rather than imported) because, unlike the
    MCQ/choice-building logic, this one has nothing source-specific in
    it and custom cards need it too (see get_deck_study_cards)."""
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


def _meaning_preview(source: str, entry: dict, lang: str) -> dict:
    """Front/kana/meaning fields for browsing + the deck card list —
    lighter than a full study-card payload (no choices, no SRS state),
    just enough to show what an entry is before/after it's added."""
    if source == "grammar":
        # The owned catalogue names this field `pattern`; the scraped
        # one said `grammar`. Both are read so a deck row written
        # before the switch still renders instead of showing a blank
        # front until the wipe clears it.
        return {"front": entry.get("pattern") or entry.get("grammar", ""),
                "kana": "", "meaning": entry.get("meaning", "")}
    fr_map  = KANJI_FR if source == "kanji" else VOCAB_FR
    meaning = get_meaning(entry, lang, fr_map)
    return {"front": entry.get("kanji") or entry.get("kana", ""), "kana": entry.get("kana", ""), "meaning": meaning}


def _ensure_deck_schema() -> None:
    """
    Self-migrating, same pattern SRSEngine._init_db uses. This used to
    only create deck_cards, on the assumption `decks` and
    `custom_cards` already existed somewhere else in the schema — they
    didn't (UndefinedTable: relation "decks" does not exist), so the
    whole deck feature was 500ing on first request. All three tables
    are created here now, in dependency order, so decks.py is fully
    self-contained the same way srs.py is for its own tables.
    """
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS decks (
                    id BIGSERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL DEFAULT 'standard',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_decks_user
                ON decks(user_id)
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS custom_cards (
                    id BIGSERIAL PRIMARY KEY,
                    deck_id BIGINT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
                    user_id TEXT NOT NULL,
                    front TEXT NOT NULL,
                    back TEXT NOT NULL,
                    kana TEXT NOT NULL DEFAULT '',
                    hint TEXT NOT NULL DEFAULT '',
                    notes TEXT NOT NULL DEFAULT '',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_custom_cards_deck
                ON custom_cards(deck_id, user_id)
            """)
            # decks now exists before this runs (same transaction,
            # created just above), so this can safely FK to it — no
            # more "may import before decks exists" concern.
            cur.execute("""
                CREATE TABLE IF NOT EXISTS deck_cards (
                    deck_id BIGINT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
                    user_id TEXT NOT NULL,
                    source TEXT NOT NULL,
                    level TEXT NOT NULL,
                    raw_id TEXT NOT NULL,
                    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (deck_id, source, raw_id)
                )
            """)
            # A previous deploy created deck_cards before `decks`
            # existed, with deck_id as TEXT and no FK (see the comment
            # above _ensure_deck_schema) — CREATE TABLE IF NOT EXISTS
            # above is a no-op against that already-existing table, so
            # the stale TEXT column survives untouched and now mismatches
            # decks.id (BIGINT), breaking any join between them
            # (UndefinedFunction: operator does not exist: text = bigint).
            # This brings an existing deck_cards up to the same shape a
            # fresh one gets from the CREATE TABLE above. Safe to rerun
            # every startup: the ALTER is a no-op once the column is
            # already BIGINT, and the constraint is only added if it's
            # not already there. deck_cards was never reachable while
            # `decks` didn't exist (every endpoint that writes to it
            # checks the deck exists first), so there's no real data at
            # risk in the ::bigint cast.
            cur.execute("""
                ALTER TABLE deck_cards
                ALTER COLUMN deck_id TYPE BIGINT USING deck_id::bigint
            """)
            cur.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'deck_cards_deck_id_fkey'
                    ) THEN
                        ALTER TABLE deck_cards
                        ADD CONSTRAINT deck_cards_deck_id_fkey
                        FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE;
                    END IF;
                END $$;
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_deck_cards_deck
                ON deck_cards(deck_id, user_id)
            """)
        conn.commit()
    finally:
        conn.close()


_ensure_deck_schema()


class DeckPayload(BaseModel):
    name: str
    # The deck's STRUCTURE, which decides what it can hold and which
    # modes it offers (see STRUCTURES). `standard` -- a plain front/back
    # pair -- is the default, being the only one that needs nothing.
    type: str = "standard"


class CardPayload(BaseModel):
    front: str
    back:  str
    kana:  str = ""
    hint:  str = ""
    notes: str = ""


class ReviewPayload(BaseModel):
    card_id:    str
    mode:       str
    quality:    int
    # Mirrors kanji.py/vocab.py/grammar.py's ReviewPayload.prev_stage
    # — sent back by the client from the card payload it was handed,
    # instead of looked up again here.
    prev_stage: str | None = None


class AppCardRef(BaseModel):
    source: str
    level:  str
    raw_id: str


class AddAppCardsPayload(BaseModel):
    cards: list[AppCardRef]


# One structure per deck. 'mixed' and 'flashcard' are gone: 'mixed' was
# dropped outright, and 'flashcard' is now called 'standard' to match the
# study-mode registry's name for the same thing.
DECK_TYPES = STRUCTURES


# ── DECK CRUD ─────────────────────────────────────────────

@router.get("/api/decks")
def get_decks(user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT d.id, d.name, d.type, d.created_at,
                       COUNT(DISTINCT c.id) AS custom_count,
                       COUNT(DISTINCT dc.raw_id) AS app_count
                FROM decks d
                LEFT JOIN custom_cards c  ON c.deck_id  = d.id
                LEFT JOIN deck_cards   dc ON dc.deck_id = d.id AND dc.user_id = d.user_id
                WHERE d.user_id = %s
                GROUP BY d.id
                ORDER BY d.created_at DESC
            """, (user_id,))
            decks = [dict(row) for row in cur.fetchall()]
        for d in decks:
            d["card_count"] = d.pop("custom_count") + d.pop("app_count")
        return {"decks": decks}
    finally:
        conn.close()


@router.get("/api/decks/{deck_id}")
def get_deck(deck_id: str, user_id: str = Depends(get_user_id)):
    """
    Single-deck lookup — mainly so DeckDetailScreen/StudyScreen can
    reliably know a deck's `type` (needed now that type actually
    restricts what can be added to it — see SOURCE_FOR_TYPE) even when
    they're opened without the router `state` that normally carries
    the deck object (a page refresh, a direct link, ...), instead of
    silently falling back to "no restriction" in that case.
    """
    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT d.id, d.name, d.type, d.created_at,
                       COUNT(DISTINCT c.id) AS custom_count,
                       COUNT(DISTINCT dc.raw_id) AS app_count
                FROM decks d
                LEFT JOIN custom_cards c  ON c.deck_id  = d.id
                LEFT JOIN deck_cards   dc ON dc.deck_id = d.id AND dc.user_id = d.user_id
                WHERE d.id = %s AND d.user_id = %s
                GROUP BY d.id
            """, (deck_id, user_id))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Deck not found")
            deck = dict(row)
        deck["card_count"] = deck.pop("custom_count") + deck.pop("app_count")
        return deck
    finally:
        conn.close()


@router.post("/api/decks")
def create_deck(payload: DeckPayload, user_id: str = Depends(get_user_id)):
    if payload.type not in DECK_TYPES:
        raise HTTPException(status_code=400, detail="Invalid deck type")
    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO decks (user_id, name, type)
                VALUES (%s, %s, %s)
                RETURNING id, name, type, created_at
            """, (user_id, payload.name, payload.type))
            deck = dict(cur.fetchone())
        conn.commit()
        deck["card_count"] = 0
        return deck
    finally:
        conn.close()


@router.delete("/api/decks/{deck_id}")
def delete_deck(deck_id: str, user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id FROM custom_cards WHERE deck_id = %s AND user_id = %s", (deck_id, user_id))
            custom_keys = [f"{user_id}:custom_{deck_id}_{row['id']}" for row in cur.fetchall()]

        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM decks WHERE id = %s AND user_id = %s",
                (deck_id, user_id)
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Deck not found")
            # custom_cards and deck_cards both FK to decks(id) ON DELETE
            # CASCADE now, so this DELETE already removed them — the
            # explicit deck_cards delete below is just a harmless no-op
            # safety net (kept in case that FK is ever loosened). Their
            # SRS *progress*, however, is handled separately on purpose:
            # custom cards are deck-scoped, so their srs state is
            # deleted below via custom_keys; app-sourced cards
            # (kanji/vocab/grammar) are NOT deck-scoped (see SOURCES /
            # _build_pool), so deleting this deck must never touch
            # their SRS state — that's shared with the Kanji/Vocab/
            # Grammar screens and any other deck referencing the same
            # card.
            cur.execute("DELETE FROM deck_cards WHERE deck_id = %s AND user_id = %s", (deck_id, user_id))
        conn.commit()
        srs.delete_cards(custom_keys)
        return {"ok": True}
    finally:
        conn.close()


# ── CARD CRUD (custom cards) ──────────────────────────────

@router.get("/api/decks/{deck_id}/cards")
def get_cards(deck_id: str, lang: str = "fr", user_id: str = Depends(get_user_id)):
    """Combined listing for DeckDetailScreen: the user's own custom
    cards plus every app-sourced card (kanji/vocab/grammar) that's
    been added via /browse + /cards/app, tagged with `origin` so the
    frontend can tell an editable custom card apart from a linked one
    (which has no front/back to edit — just a remove action)."""
    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, front, back, kana, hint, notes, created_at
                FROM custom_cards
                WHERE deck_id = %s AND user_id = %s
                ORDER BY created_at ASC
            """, (deck_id, user_id))
            custom = [dict(row) for row in cur.fetchall()]
            cur.execute("""
                SELECT source, level, raw_id, added_at
                FROM deck_cards
                WHERE deck_id = %s AND user_id = %s
                ORDER BY added_at ASC
            """, (deck_id, user_id))
            app_links = [dict(row) for row in cur.fetchall()]
        cards = [{"origin": "custom", **c} for c in custom]

        for link in app_links:
            cfg = SOURCES.get(link["source"])
            if not cfg:
                continue
            entry = next(
                (e for e in cfg["by_level"].get(link["level"], [])
                 if cfg["to_id"](e, link["level"]) == link["raw_id"]),
                None,
            )
            if entry is None:
                continue
            fields = _meaning_preview(link["source"], entry, lang)
            cards.append({
                "origin": "app", "source": link["source"], "level": link["level"],
                "raw_id": link["raw_id"], "added_at": link["added_at"],
                "front": fields["front"], "back": fields["meaning"], "kana": fields["kana"],
            })

        return {"cards": cards}
    finally:
        conn.close()


@router.post("/api/decks/{deck_id}/cards")
def add_card(deck_id: str, payload: CardPayload, user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id, type FROM decks WHERE id = %s AND user_id = %s", (deck_id, user_id))
            deck = cur.fetchone()
            if not deck:
                raise HTTPException(status_code=404, detail="Deck not found")
            if not _allows_custom(deck["type"]):
                raise HTTPException(
                    status_code=400,
                    detail=f"This deck only accepts {deck['type']} cards — browse and add some instead",
                )
            cur.execute("""
                INSERT INTO custom_cards (deck_id, user_id, front, back, kana, hint, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, front, back, kana, hint, notes, created_at
            """, (deck_id, user_id, payload.front, payload.back,
                  payload.kana, payload.hint, payload.notes))
            card = dict(cur.fetchone())
        conn.commit()
        card["origin"] = "custom"
        return card
    finally:
        conn.close()


@router.delete("/api/decks/{deck_id}/cards/app")
def remove_app_card(deck_id: str, source: str, raw_id: str, user_id: str = Depends(get_user_id)):
    # raw_id (not level) is enough to identify the row — it's the
    # deck_cards primary key together with deck_id/source. Taken as a
    # query param rather than a path segment because some raw ids
    # embed a "/" (multi-reading vocab kana, e.g. "まいげつ/まいつき"),
    # which would otherwise split across path segments.
    #
    # Declared here — BEFORE the generic PUT/DELETE .../cards/{card_id}
    # routes just below — very much on purpose. FastAPI/Starlette
    # matches routes in declaration order, not by specificity: with
    # this route declared *after* the generic one, a request to
    # DELETE /cards/app was matching {card_id}="app" on the generic
    # route first, crashing there instead (custom_cards.id is bigint,
    # and casting the literal string "app" to it throws) — which is
    # what the frontend was seeing as an opaque CORS-looking fetch
    # failure, since the crash never made it to a clean JSON response.
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                DELETE FROM deck_cards
                WHERE deck_id = %s AND user_id = %s AND source = %s AND raw_id = %s
            """, (deck_id, user_id, source, raw_id))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Card not found in deck")
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.put("/api/decks/{deck_id}/cards/{card_id}")
def update_card(deck_id: str, card_id: str, payload: CardPayload,
                user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                UPDATE custom_cards
                SET front = %s, back = %s, kana = %s, hint = %s, notes = %s
                WHERE id = %s AND deck_id = %s AND user_id = %s
                RETURNING id, front, back, kana, hint, notes
            """, (payload.front, payload.back, payload.kana, payload.hint,
                  payload.notes, card_id, deck_id, user_id))
            card = cur.fetchone()
            if not card:
                raise HTTPException(status_code=404, detail="Card not found")
        conn.commit()
        return dict(card)
    finally:
        conn.close()


@router.delete("/api/decks/{deck_id}/cards/{card_id}")
def delete_card(deck_id: str, card_id: str, user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                DELETE FROM custom_cards
                WHERE id = %s AND deck_id = %s AND user_id = %s
            """, (card_id, deck_id, user_id))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Card not found")
        conn.commit()
        key = f"{user_id}:custom_{deck_id}_{card_id}"
        srs.delete_cards([key])
        return {"ok": True}
    finally:
        conn.close()


# ── APP-SOURCED CARDS (browse & add existing kanji/vocab/grammar) ──

@router.get("/api/decks/{deck_id}/browse")
def browse_app_cards(deck_id: str, source: str, level: str = "", query: str = "",
                     limit: int = 40, lang: str = "fr",
                     user_id: str = Depends(get_user_id)):
    """
    Search the app's own built-in decks for cards to pull into a
    custom deck — backs the "browse existing cards" picker. Matching
    today is a plain substring check over each entry's own fields and
    is scoped to the JLPT-leveled decks (KANJI_BY_LEVEL/
    VOCAB_BY_LEVEL/GRAMMAR_BY_LEVEL) — good enough to try a level or a
    known word/kanji, not a real dictionary search yet. See SOURCES'
    docstring for where a fuller dictionary-backed source plugs in
    once those files are available.
    """
    cfg = SOURCES.get(source)
    if not cfg:
        raise HTTPException(status_code=400, detail="Unknown source")

    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id, type FROM decks WHERE id = %s AND user_id = %s", (deck_id, user_id))
            deck = cur.fetchone()
            if not deck:
                raise HTTPException(status_code=404, detail="Deck not found")
            if source not in _allowed_sources(deck["type"]):
                raise HTTPException(
                    status_code=400,
                    detail=f"This deck only accepts {deck['type']} cards",
                )
            cur.execute("""
                SELECT raw_id FROM deck_cards
                WHERE deck_id = %s AND user_id = %s AND source = %s
            """, (deck_id, user_id, source))
            already = {row["raw_id"] for row in cur.fetchall()}
    finally:
        conn.close()

    levels = [level] if level else list(cfg["by_level"].keys())
    q = query.strip().lower()

    results = []
    for lvl in levels:
        for entry in cfg["by_level"].get(lvl, []):
            if q:
                haystack = " ".join(str(v) for v in entry.values()).lower()
                if q not in haystack:
                    continue
            raw_id = cfg["to_id"](entry, lvl)
            fields = _meaning_preview(source, entry, lang)
            results.append({
                "source": source, "level": lvl, "raw_id": raw_id,
                "front": fields["front"], "kana": fields["kana"], "meaning": fields["meaning"],
                "in_deck": raw_id in already,
            })
            if len(results) >= limit:
                break
        if len(results) >= limit:
            break

    return {"results": results}


@router.post("/api/decks/{deck_id}/cards/app")
def add_app_cards(deck_id: str, payload: AddAppCardsPayload, user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id, type FROM decks WHERE id = %s AND user_id = %s", (deck_id, user_id))
            deck = cur.fetchone()
            if not deck:
                raise HTTPException(status_code=404, detail="Deck not found")
            allowed = _allowed_sources(deck["type"])

            added = 0
            with conn.cursor() as write_cur:
                for c in payload.cards:
                    if c.source not in allowed:
                        # Same leniency as the "doesn't resolve to a
                        # real entry" case below — a stale browse
                        # result (e.g. the deck's type changed since
                        # the picker was opened) shouldn't 500 out the
                        # rest of an otherwise-valid batch.
                        continue
                    cfg = SOURCES.get(c.source)
                    if not cfg:
                        continue
                    level_list = cfg["by_level"].get(c.level, [])
                    # Ignore refs that don't resolve to a real entry
                    # instead of 500ing — a stale browse result (deck
                    # data changed under it) shouldn't break the rest
                    # of the batch.
                    if not any(cfg["to_id"](e, c.level) == c.raw_id for e in level_list):
                        continue
                    write_cur.execute("""
                        INSERT INTO deck_cards (deck_id, user_id, source, level, raw_id)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (deck_id, source, raw_id) DO NOTHING
                    """, (deck_id, user_id, c.source, c.level, c.raw_id))
                    added += write_cur.rowcount
        conn.commit()
        return {"added": added}
    finally:
        conn.close()


@router.get("/api/decks/{deck_id}/modes")
def get_deck_modes(deck_id: str, user_id: str = Depends(get_user_id)):
    """
    The study modes this deck offers: its STRUCTURE's modes, from the
    registry, provided it has at least one card.

    This used to union the modes of every source present in the deck,
    which is what made mixed decks expensive. Two sources meant two mode
    sets, and then a question the union could not answer -- what a
    kanji-only mode should do with a grammar card sitting in the same
    deck. One structure per deck removes the question rather than
    answering it.

    `composition` is still returned because the write-practice toggle and
    the empty-deck copy read it, but it no longer decides anything.
    """
    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT type FROM decks WHERE id = %s AND user_id = %s", (deck_id, user_id))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Deck not found")
            deck_type = row["type"]
            cur.execute(
                "SELECT COUNT(*) AS n FROM custom_cards WHERE deck_id = %s AND user_id = %s",
                (deck_id, user_id),
            )
            custom_count = cur.fetchone()["n"]
            cur.execute("""
                SELECT source, COUNT(*) AS n FROM deck_cards
                WHERE deck_id = %s AND user_id = %s
                GROUP BY source
            """, (deck_id, user_id))
            source_counts = {row["source"]: row["n"] for row in cur.fetchall()}
    finally:
        conn.close()

    total = custom_count + sum(source_counts.values())
    modes = sorted(GRADED_FOR_SOURCE[_registry_source(deck_type)]) if total else []

    return {
        "modes": modes,
        "structure": deck_type,
        "composition": {"custom": custom_count, **source_counts},
    }


# ── STUDY ─────────────────────────────────────────────────

def _build_pool(deck_id: str, user_id: str) -> list[dict]:
    """Every card belonging to this deck — custom and app-sourced
    alike — as a flat pool ready to be filtered/picked from. App-
    sourced raw ids are NOT deck-scoped (they're the same
    kanji_to_id/vocab_to_id/grammar_to_id used by the Kanji/Vocab/
    Grammar screens themselves), so studying a card here and studying
    it from its own screen share one SRS progress — same behaviour the
    old mix_levels parameter used to give, now backed by persisted
    membership instead of "whole JLPT level, recomputed every time"."""
    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, front, back, kana, hint, notes
                FROM custom_cards WHERE deck_id = %s AND user_id = %s
            """, (deck_id, user_id))
            custom = [dict(row) for row in cur.fetchall()]
            cur.execute("""
                SELECT source, level, raw_id FROM deck_cards
                WHERE deck_id = %s AND user_id = %s
            """, (deck_id, user_id))
            app_links = [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()

    pool = []
    for c in custom:
        pool.append({
            "raw_id": f"custom_{deck_id}_{c['id']}",
            "source": "custom", "level": None, "entry": c,
        })

    for link in app_links:
        cfg = SOURCES.get(link["source"])
        if not cfg:
            continue
        entry = next(
            (e for e in cfg["by_level"].get(link["level"], [])
             if cfg["to_id"](e, link["level"]) == link["raw_id"]),
            None,
        )
        if entry is None:
            continue
        pool.append({
            "raw_id": link["raw_id"], "source": link["source"],
            "level": link["level"], "entry": entry,
        })

    return pool


def _deck_type(deck_id: str, user_id: str) -> str | None:
    """The deck's structure, or None when it is not this user's deck."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT type FROM decks WHERE id = %s AND user_id = %s",
                        (deck_id, user_id))
            row = cur.fetchone()
            return row[0] if row else None
    finally:
        conn.close()


def _eligible(pool_entry: dict, mode: str, deck_type: str) -> bool:
    """
    Whether this card can be served in this mode, for a deck of this
    structure.

    One rule now, because a deck has one structure: the mode must belong
    to that structure's registry source, and the card must be either a
    hand-written card (of that structure) or an app card from the source
    the structure browses in.

    What this replaces was `return "flashcard" in mode` for custom cards
    -- a substring test that namespacing quietly broke, since
    'grammar.flashcard.f2b' contains "flashcard" too, so a front/back pair
    could be handed to the branch that renders a rule and its example
    sentences.
    """
    if mode not in GRADED_FOR_SOURCE[_registry_source(deck_type)]:
        return False

    if pool_entry["source"] == "custom":
        # A personal card is front/back today, so it can only answer the
        # mode that asks front/back. Its structure's other modes need
        # fields custom_cards does not have -- a kanji deck offers
        # kanji.readings and kanji.radical, and serving a hand-written
        # pair into those gives a card with nothing to answer, which reads
        # as a broken deck rather than a missing feature.
        #
        # Keyed on BASE, not renderer: kanji.radical renders as a flashcard
        # but asks which radical the kanji is filed under, which a
        # front/back pair cannot answer either. What the mode ASKS is the
        # axis; how it draws is not.
        # TODO(structures): once custom_cards carries the structured
        # fields (readings, radical number, ...), check the CARD for what
        # the mode needs rather than restricting by base.
        return MODES[mode].base == BASE_FLASHCARD

    return pool_entry["source"] in _allowed_sources(deck_type)


@router.get("/api/decks/{deck_id}/study")
def get_deck_study_cards(deck_id: str, mode: str = "standard.flashcard.f2b", lang: str = "fr",
                         count: int = 10, exclude: str = "",
                         user_id: str = Depends(get_user_id)):
    """
    Batched session endpoint — same shape (`{"cards": [...]}`, `count`
    + `exclude`) as /api/kanji/cards, /api/vocab/cards and
    /api/grammar/cards, so useCardSession can keep a deck's queue
    filled the same way it does for the built-in decks instead of
    fetching one card at a time.
    """
    deck_type = _deck_type(deck_id, user_id)
    if deck_type is None:
        raise HTTPException(status_code=404, detail="Deck not found")

    pool = [p for p in _build_pool(deck_id, user_id) if _eligible(p, mode, deck_type)]
    if not pool:
        return {"cards": []}

    by_raw    = {p["raw_id"]: p for p in pool}
    raw_ids   = list(by_raw.keys())
    card_ids  = prefixed(raw_ids, user_id)
    cache_key = batch_key("user", user_id, "deck", deck_id, mode)
    # No pre-materialisation. get_new_cards selects over the ids passed
    # here rather than joining `cards`, so nothing has to exist in
    # card_modes before a card can be served — a scheduler row is written
    # on first review instead. This call used to write one row per deck
    # card per mode (3,476 of them for N1 vocab) on the first request.

    due = srs.get_due_cards(mode, card_ids=card_ids)
    exclude_ids = {f"{user_id}:{rid}" for rid in exclude.split(",") if rid}
    picked = pick_ids(
        cache_key, due,
        lambda limit: srs.get_new_cards(mode, limit=limit, card_ids=card_ids),
        max(1, min(count, MAX_BATCH)), exclude_ids,
    )

    if not picked:
        return {"cards": []}

    states   = srs.get_bulk_stats(picked, mode)
    previews = srs.preview_reviews_bulk(picked, mode, user_id)

    cards = []
    for card_id in picked:
        raw_id = unprefixed(card_id, user_id)
        p = by_raw.get(raw_id)
        if p is None:
            continue
        stage   = states.get(card_id)
        preview = previews.get(card_id)

        if p["source"] == "custom":
            c = p["entry"]
            m = resolve_for_source(MODE_STANDARD, mode)
            cards.append({
                "card_id": raw_id, "source": "custom",
                "front": c["front"], "back": c["back"],
                "kana": c.get("kana", ""), "hint": c.get("hint", ""),
                "notes": c.get("notes", ""), "mode": mode,
                # f2b shows the front and asks for the back; b2f is the
                # other way up. Every other source's payload carries this,
                # and the renderer reads it rather than the mode string.
                "direction": m.direction if m else None,
                # No hints: a hand-written pair has nothing to build
                # distractors from, and HintBar renders from what is
                # actually present, so the control simply does not appear.
                "hints": {},
                "stage": stage,
                "review_preview": _build_review_preview(stage, preview),
            })
        else:
            cfg = SOURCES[p["source"]]
            level_list = cfg["by_level"].get(p["level"], [])
            card = cfg["build"](raw_id, p["entry"], p["level"], level_list, mode, lang, stage, preview)
            card["card_id"] = raw_id
            card["source"]  = f"builtin_{p['source']}"

            # No counterpart lookup any more: the builders attach the
            # distractors themselves as hints.indice_1 whenever the mode
            # offers that hint (see _build_kanji_card), so the flip to
            # multiple choice needs nothing extra here. The QCM_COUNTERPART
            # table existed only because `format` used to decide whether
            # choices were built at all.
            cards.append(card)

    logger.info(
        "deck study request deck_id=%s mode=%s user_id=%s pool=%d due=%d picked=%d",
        deck_id, mode, user_id, len(pool), len(due), len(cards),
    )
    return {"cards": cards}


@router.post("/api/decks/{deck_id}/review")
def review_deck_card(deck_id: str, payload: ReviewPayload,
                     user_id: str = Depends(get_user_id)):
    card_id = f"{user_id}:{payload.card_id}"
    s = srs.review(card_id, payload.mode, payload.quality)
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


@router.get("/api/decks/{deck_id}/stats")
def get_deck_stats(deck_id: str, mode: str = "standard.flashcard.f2b",
                   user_id: str = Depends(get_user_id)):
    deck_type = _deck_type(deck_id, user_id)
    if deck_type is None:
        raise HTTPException(status_code=404, detail="Deck not found")
    pool     = [p for p in _build_pool(deck_id, user_id) if _eligible(p, mode, deck_type)]
    card_ids = prefixed([p["raw_id"] for p in pool], user_id)

    if not card_ids:
        return {"total": 0, "new": 0, "learning": 0, "mastered": 0, "due_now": 0}

    states  = srs.get_bulk_stats(card_ids, mode)
    due_now = len(srs.get_due_cards(mode, card_ids=card_ids))
    return {
        "total":    len(card_ids),
        "new":      sum(1 for s in states.values() if s == "new"),
        "learning": sum(1 for s in states.values() if s == "learning"),
        "mastered": sum(1 for s in states.values() if s == "mastered"),
        "due_now":  due_now,
    }


@router.post("/api/decks/{deck_id}/import")
async def import_cards(deck_id: str, file: UploadFile = File(...),
                       user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT type FROM decks WHERE id = %s AND user_id = %s",
                       (deck_id, user_id))
            deck = cur.fetchone()
            if not deck:
                raise HTTPException(status_code=404, detail="Deck not found")
            if not _allows_custom(deck["type"]):
                raise HTTPException(
                    status_code=400,
                    detail=f"This deck only accepts {deck['type']} cards — browse and add some instead",
                )
    finally:
        conn.close()

    content = await file.read()
    try:
        text = content.decode('utf-8-sig')
    except UnicodeDecodeError:
        text = content.decode('latin-1')

    reader  = csv.DictReader(io.StringIO(text))
    headers = [h.strip().lower() for h in (reader.fieldnames or [])]

    if 'front' not in headers or 'back' not in headers:
        raise HTTPException(status_code=400, detail="CSV must contain 'front' and 'back' columns")

    inserted = 0
    errors   = []
    conn     = db_conn()
    try:
        with conn.cursor() as cur:
            for i, row in enumerate(reader, start=2):
                front = row.get('front', '').strip()
                back  = row.get('back',  '').strip()
                if not front or not back:
                    errors.append(f"Row {i}: missing front/back — skipped")
                    continue
                cur.execute("""
                    INSERT INTO custom_cards (deck_id, user_id, front, back, kana, hint, notes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (deck_id, user_id, front, back,
                      row.get('kana', '').strip(),
                      row.get('hint', '').strip(),
                      row.get('notes', '').strip()))
                inserted += 1
        conn.commit()
    finally:
        conn.close()

    return {"inserted": inserted, "errors": errors, "ok": True}