"""お気に入り — the entries a learner keeps (plan 093).

A shelf of the learner's own in the dictionary: the ★ on an entry's
plate files it here, and the console's sixth chip reads the shelf back
as catalogue rows. It is a BOOKMARK and nothing more — not a deck, not
a card, not a review queue. A deck is what the ＋ beside the star
writes into (routes/decks.py), and it owes the scheduler cards; a
favourite owes nothing and is kept for the reader alone, which is why
the two are different controls on the same plate rather than one.

What is stored is a REFERENCE, never a copy of the entry: the kind of
collection and the key that collection files the entry under.

    kanji      the character            駅
    vocab      "{kanji}::{kana}"        電車::でんしゃ   (the deck key
               frequency_overrides.item_key already stores, so a word
               is named the same way everywhere a learner's row names
               one; a kana-only word is "::かな")
    grammar    the point's card id      grammar_N5_〜てから
    hiragana   the kana                 あ
    katakana   the kana                 ア

Reading the shelf back resolves each reference against the collection
it came from — the app's deck first, then the pool behind it for a
kanji or a word — with routes/dictionary.py's own row builders, so a
favourite is the same row the catalogue would serve, learner's record
and all. A reference that resolves to nothing (a deck correction, a
retired grammar point) is skipped rather than served broken and left
in place rather than deleted: content that moved may move back, and a
row nobody can see costs nothing.

No cascade from auth (ADR 0010): `user_id` is a bare column, and
DELETE /api/account and scripts/purge_orphans.py are what clear it.
"""

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from content.grammar_points_data import entry_by_id
from content.kana_data import get_syllabary
from content.kanji_data import DECK_BY_CHAR
import content.kanji_pool_data as kanji_db
from content.kanji_meanings import KANJI_FR
from core.auth import get_user_id
from core.db import db_conn
from core.srs_instance import srs
from routes.dictionary import (
    _deck_kanji_result, _exact_vocab, _grammar_result, _kana_result,
    _pool_kanji_result,
)
from translations import get_meaning

router = APIRouter()
logger = logging.getLogger(__name__)

KINDS = ("kanji", "vocab", "grammar", "hiragana", "katakana")
Kind = Literal["kanji", "vocab", "grammar", "hiragana", "katakana"]

# A shelf, not an archive. Five hundred is past what anyone reads back
# — the catalogue's own page is fifty — and a bound is what keeps one
# client in a loop from filling the table.
MAX_FAVORITES = 500
# The longest key is a grammar id, and those run to ~40 characters.
MAX_KEY = 200

VOCAB_SEP = "::"


def _ensure_schema() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS dictionary_favorites (
                    user_id  TEXT NOT NULL,
                    kind     TEXT NOT NULL,
                    key      TEXT NOT NULL,
                    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (user_id, kind, key)
                )
            """)
        conn.commit()
    finally:
        conn.close()


try:
    _ensure_schema()
except Exception:  # pragma: no cover - a missing DB must not stop import
    logger.exception("dictionary_favorites schema could not be initialised")


# ── Resolving a reference back to its row ─────────────────────

def _resolve(kind: str, key: str, lang: str, states: dict, user_id: str) -> dict | None:
    """The catalogue row a favourite names, or None if nothing does."""
    if kind == "kanji":
        deck_hit = DECK_BY_CHAR.get(key)
        if deck_hit is not None:
            level, entry = deck_hit
            return _deck_kanji_result(
                level, entry, get_meaning(entry, lang, KANJI_FR), lang, states, user_id,
            )
        row = kanji_db.get(key)
        return _pool_kanji_result(row, lang, states, user_id) if row else None

    if kind == "vocab":
        if VOCAB_SEP not in key:
            return None
        kanji, kana = key.split(VOCAB_SEP, 1)
        # _exact_vocab takes the surface a caller has in hand — kanji, or
        # the kana itself for a kana-only word — and the reading beside it.
        row = _exact_vocab(kanji or kana, kana, lang, states, user_id)
        if row is None and "/" in kana:
            # The key stores the deck's field as served, and a deck field
            # can pack several readings ("まいげつ/まいつき"); the exact
            # match wants one of them.
            first = kana.split("/", 1)[0]
            row = _exact_vocab(kanji or first, first, lang, states, user_id)
        return row

    if kind == "grammar":
        hit = entry_by_id(key)
        if hit is None:
            return None
        level, entry = hit
        return _grammar_result(entry, level, states, user_id, lang)

    # hiragana / katakana
    for entry in get_syllabary(kind):
        if entry["kana"] == key:
            return _kana_result(kind, entry, entry["romaji"], lang, states, user_id)
    return None


def _rows(user_id: str, cur) -> list[tuple[str, str]]:
    cur.execute(
        "SELECT kind, key FROM dictionary_favorites WHERE user_id = %s "
        "ORDER BY added_at DESC, kind, key",
        (user_id,),
    )
    return [(kind, key) for kind, key in cur.fetchall()]


# ── The routes ────────────────────────────────────────────────

@router.get("/api/dictionary/favorites/keys")
def list_favorite_keys(user_id: str = Depends(get_user_id)):
    """Every reference on the shelf, newest first, and nothing resolved:
    what the plate's ★ reads to know whether it is lit. One request on
    arrival, however many entries the learner opens after it."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            rows = _rows(user_id, cur)
    finally:
        conn.close()
    return {
        "favorites": [{"kind": kind, "key": key} for kind, key in rows],
        "total": len(rows),
    }


@router.get("/api/dictionary/favorites")
def list_favorites(page: int = 0, limit: int = Query(50, ge=1, le=200),
                   lang: str = "fr", user_id: str = Depends(get_user_id)):
    """One page of the shelf as catalogue rows, newest first — the same
    shape /api/dictionary answers with, so the screen draws it with the
    grid it already has. `total` counts references; a page can come
    back short of `limit` where one of them no longer resolves."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            rows = _rows(user_id, cur)
    finally:
        conn.close()

    total = len(rows)
    start = page * limit
    page_rows = rows[start:start + limit]
    states = srs.get_user_states(user_id) if page_rows else {}
    results = []
    for kind, key in page_rows:
        row = _resolve(kind, key, lang, states, user_id)
        if row is not None:
            results.append(row)
    return {
        "results":  results,
        "total":    total,
        "page":     page,
        "limit":    limit,
        "has_more": start + limit < total,
        "corrected": None,
    }


class FavoriteBody(BaseModel):
    kind: Kind
    key: str = Field(min_length=1, max_length=MAX_KEY)
    favorite: bool = True


@router.put("/api/dictionary/favorites")
def set_favorite(body: FavoriteBody, user_id: str = Depends(get_user_id)):
    """Keep an entry, or let it go. Idempotent both ways: keeping what
    is kept and dropping what is not are both the state asked for, and
    answer 200 with it. `total` is the shelf's size afterwards."""
    key = body.key.strip()
    if not key:
        raise HTTPException(status_code=422, detail="key is empty")
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            if body.favorite:
                cur.execute(
                    "SELECT COUNT(*) FROM dictionary_favorites WHERE user_id = %s",
                    (user_id,),
                )
                count = cur.fetchone()[0]
                cur.execute(
                    "SELECT 1 FROM dictionary_favorites "
                    "WHERE user_id = %s AND kind = %s AND key = %s",
                    (user_id, body.kind, key),
                )
                already = cur.fetchone() is not None
                if not already and count >= MAX_FAVORITES:
                    conn.rollback()
                    raise HTTPException(status_code=409, detail="favorites_full")
                cur.execute(
                    "INSERT INTO dictionary_favorites (user_id, kind, key) "
                    "VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                    (user_id, body.kind, key),
                )
            else:
                cur.execute(
                    "DELETE FROM dictionary_favorites "
                    "WHERE user_id = %s AND kind = %s AND key = %s",
                    (user_id, body.kind, key),
                )
            cur.execute(
                "SELECT COUNT(*) FROM dictionary_favorites WHERE user_id = %s",
                (user_id,),
            )
            total = cur.fetchone()[0]
        conn.commit()
    finally:
        conn.close()
    return {"kind": body.kind, "key": key, "favorite": body.favorite, "total": total}
