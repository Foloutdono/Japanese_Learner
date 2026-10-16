"""
初見 — a kana or a kanji met before it is drilled (plan 216).

A grammar point the learner has never met is asked before it is drilled
(study/grammar_tour.py, plan 187). A kana or a kanji had no such moment:
its first card was the same review card as its hundredth, a glyph to
rate before anyone had said what it reads, how it is written or where
it is met. This is that moment, as three stops in the tour's frame:

  read   what it reads -- a kana's romaji and its sound, a kanji's
         meaning and its readings, on'yomi and kun'yomi apart;
  write  its strokes, each traced from its start to its end, in order,
         on the writing board (the KanjiVG paths, below);
  use    a few simple words it is met in.

The payload rides on the card (`glyph_tour`), and only on a card whose
tutorial is still due (`mark_glyph_tours`): once per CHARACTER, never
per mode -- a kana met as a flashcard is not toured again when it opens
on the writing platform -- and never for a character the learner
reviewed on any of its line's tracks before the tour existed. The
terminus records the first tour in `glyph_tours`; the tour grades no
card, as grammar's does not (plan 187, Q1).

A combination (きゃ, ファ, えい) is two characters the learner has
already met one by one: it has no tour.
"""
import copy
import logging
import re
from functools import lru_cache
from pathlib import Path

from content.kana_data import KANA_SETS, kana_to_id, sound_of, twin
from content.kanji_data import DECK_BY_CHAR, kanji_to_id
from content.kanji_meanings import KANJI_FR
from core.auth import prefixed, unprefixed
from core.db import db_conn
from study.kana_words import kana_words
from study.kanji_words import kanji_words
from translations import get_meaning

logger = logging.getLogger(__name__)

KANJIVG_DIR = Path(__file__).resolve().parent.parent / "kanjivg"

# The words on the last stop: enough to show the glyph in more than one
# word, few enough to read on a phone without a scroll.
MAX_WORDS = 3

# The two lines a glyph tour belongs to, by the prefix of their card ids.
KANA, KANJI = "kana", "kanji"

_LEVEL_ORDER = {"N5": 0, "N4": 1, "N3": 2, "N2": 3, "N1": 4}

_PATH = re.compile(r'<path\b[^>]*?\bid="kvg:[0-9a-f]+-s(\d+)"[^>]*?\bd="([^"]+)"')


def _lang(lang: str | None) -> str:
    """The two languages a meaning is served in: French, else English.
    The payloads are cached by it, so nothing else may key them."""
    return "fr" if str(lang or "").lower().startswith("fr") else "en"


def _level_rank(level: str | None) -> int:
    return _LEVEL_ORDER.get(level or "", 99)


# Sized for what a process serves, not for the decks: a tour is built
# only for the few cards a learner meets for the first time, so the
# caches spare a repeat (two learners, one new kana) and nothing more.
@lru_cache(maxsize=1024)
def strokes(char: str) -> tuple[str, ...]:
    """The character's strokes as KanjiVG draws them, in the order they
    are written: one SVG path (`d`) each, in the file's 109-unit box.
    Empty when KanjiVG has no file for it. The order is the id's own
    number (-s1, -s2, ...), not the document's, which nests a kanji's
    parts in groups."""
    if len(char) != 1:
        return ()
    path = KANJIVG_DIR / f"{ord(char):05x}.svg"
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return ()
    found = sorted((int(n), d) for n, d in _PATH.findall(text))
    return tuple(d for _, d in found)


# ── The payloads ─────────────────────────────────────────────────

_KANA_BY_ID = {kana_to_id(k): k for kana_list in KANA_SETS.values() for k in kana_list}


def _script(char: str) -> str:
    return "katakana" if "゠" <= char <= "ヿ" else "hiragana"


def _kana_entry(raw_id: str) -> dict | None:
    """The kana a tour can be drawn for: one character, a combination
    being two already met."""
    entry = _KANA_BY_ID.get(raw_id)
    return entry if entry is not None and len(entry["kana"]) == 1 else None


@lru_cache(maxsize=512)
def _kana_tour(raw_id: str, lang: str) -> dict | None:
    entry = _kana_entry(raw_id)
    if entry is None:
        return None
    char = entry["kana"]
    return {
        "kind": KANA,
        "glyph": char,
        "romaji": entry["romaji"],
        "sound": sound_of(entry),
        "script": _script(char),
        # The same sound in the other script (あ ↔ ア), where the pairing
        # is one to one (content/kana_data.twin).
        "twin": twin(char),
        "strokes": list(strokes(char)),
        # A word is printed as it is READ -- a learner still working
        # through the syllabary cannot be shown 朝 for あ (kana_words).
        "words": [
            {"kana": w["kana"], "kanji": w["kanji"], "meaning": w["meaning"]}
            for w in kana_words(char, lang)[:MAX_WORDS]
        ],
    }


def _kanji_words(char: str, level: str, lang: str) -> list[dict]:
    """Up to MAX_WORDS simple words the kanji is read in: one a reading
    in the deck's order, each the first word of that reading at or under
    the kanji's own level -- 日 at N5 gives 日曜日, 火曜日 and 五日 (ニチ,
    び, か) rather than kanji_words' ledger, which reaches for 先日 and
    日付 at N3 to cover ジツ and ひ. Then the next words at the level,
    whatever their reading (本 has no もと word at N5: 本屋 before 本木),
    and the ledger last, where the level holds too few."""
    found = kanji_words(char, lang)
    ceiling = _level_rank(level)
    chosen: list[dict] = []
    seen: set[str] = set()

    def take(word: dict) -> None:
        # By what is written: 消耗 read しょうもう and しょうこう is one word.
        key = word.get("kanji") or word.get("kana", "")
        if key in seen or len(chosen) >= MAX_WORDS:
            return
        seen.add(key)
        chosen.append({
            "kanji": word.get("kanji", ""),
            "kana": word.get("kana", ""),
            "meaning": word.get("meaning", ""),
            "furigana": word.get("furigana") or [],
        })

    simple = [
        sorted((w for w in reading["words"] if _level_rank(w.get("level")) <= ceiling),
               key=lambda w: _level_rank(w.get("level")))
        for reading in found["readings"]
    ]
    for depth in range(max((len(words) for words in simple), default=0)):
        for words in simple:
            if depth < len(words):
                take(words[depth])
    for word in found["examples"]:
        take(word)
    return chosen


def _kanji_entry(raw_id: str) -> tuple[str, dict] | None:
    """(level, entry) for a deck kanji's card id, else None."""
    parts = raw_id.split("_", 2)
    if len(parts) != 3 or parts[0] != KANJI:
        return None
    _, level, char = parts
    found = DECK_BY_CHAR.get(char)
    if found is None or found[0] != level or kanji_to_id(found[1], level) != raw_id:
        return None
    return found


@lru_cache(maxsize=512)
def _kanji_tour(raw_id: str, lang: str) -> dict | None:
    found = _kanji_entry(raw_id)
    if found is None:
        return None
    level, entry = found
    char = entry["kanji"]
    return {
        "kind": KANJI,
        "glyph": char,
        "meaning": get_meaning(entry, lang, KANJI_FR),
        # The deck's packed field, as the card's reveal reads it
        # (Readings on the client splits on'yomi from kun'yomi).
        "readings": entry.get("kana", ""),
        "strokes": list(strokes(char)),
        "words": _kanji_words(char, level, lang),
    }


def tour_payload(raw_id: str, lang: str) -> dict | None:
    """The glyph's tour for a kana or kanji card id, or None where it has
    none (a combination, an id the decks do not know). A copy: a caller
    is free to change what it is handed."""
    lang = _lang(lang)
    if raw_id.startswith(f"{KANA}_"):
        tour = _kana_tour(raw_id, lang)
    elif raw_id.startswith(f"{KANJI}_"):
        tour = _kanji_tour(raw_id, lang)
    else:
        return None
    return copy.deepcopy(tour)


def known(raw_id: str) -> bool:
    """Whether `raw_id` is a card a glyph tour can be drawn and recorded
    for, without drawing it."""
    if raw_id.startswith(f"{KANA}_"):
        return _kana_entry(raw_id) is not None
    return _kanji_entry(raw_id) is not None


# ── Who is due one ───────────────────────────────────────────────

def _line(raw_id: str) -> str | None:
    if raw_id.startswith(f"{KANA}_"):
        return KANA
    if raw_id.startswith(f"{KANJI}_"):
        return KANJI
    return None


def mark_glyph_tours(cards: list[dict], user_id: str, lang: str) -> list[dict]:
    """Hand each kana or kanji card its tour while it is due: `tutorial`
    True and `glyph_tour` the payload. Due means never toured (no
    glyph_tours row) and never reviewed on any of its line's tracks (no
    card_modes row under kana.% or kanji.% with a review), so it is once
    per character, not per mode, and a character studied before the tour
    existed is never toured. Only a card new in its own mode is asked
    about: two queries a batch, for its new cards alone.

    A card another line marked (grammar's mark_tutorials) is left as it
    was."""
    pending = []
    for c in cards:
        raw_id = str(c.get("card_id", ""))
        if _line(raw_id) is None:
            continue
        c["tutorial"] = False
        if c.get("stage") in (None, "new") and known(raw_id):
            pending.append(c)
    if not pending:
        return cards
    raw_ids = sorted({c["card_id"] for c in pending})
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT card_id FROM glyph_tours WHERE user_id = %s AND card_id = ANY(%s)",
                        (user_id, raw_ids))
            toured = {row[0] for row in cur.fetchall()}
            cur.execute(
                "SELECT DISTINCT card_id FROM card_modes WHERE card_id = ANY(%s) "
                "AND (mode LIKE 'kana.%%' OR mode LIKE 'kanji.%%') AND total_reviews > 0",
                (prefixed(raw_ids, user_id),),
            )
            studied = {unprefixed(row[0], user_id) for row in cur.fetchall()}
    finally:
        conn.close()
    for c in pending:
        raw_id = c["card_id"]
        if raw_id in toured or raw_id in studied:
            continue
        c["tutorial"] = True
        c["glyph_tour"] = tour_payload(raw_id, lang)
    return cards


# ── The record ───────────────────────────────────────────────────
# One row per character a learner was toured through, the FIRST tour
# only: how many strokes the trace missed, and whether the board drew
# them for the learner. Nothing the scheduler reads. No cascade from
# auth (ADR 0010): DELETE /api/account and scripts/purge_orphans.py
# clear it.
def _ensure_schema() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS glyph_tours (
                    user_id  TEXT NOT NULL,
                    card_id  TEXT NOT NULL,
                    misses   SMALLINT NOT NULL,
                    shown    BOOLEAN NOT NULL,
                    done_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (user_id, card_id)
                )
            """)
        conn.commit()
    finally:
        conn.close()


try:
    _ensure_schema()
except Exception:  # pragma: no cover - a missing DB must not stop import
    logger.exception("glyph_tours schema could not be initialised")


def record(user_id: str, raw_id: str, misses: int, shown: bool) -> bool:
    """The terminus of a glyph's tour: True when it was the first."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO glyph_tours (user_id, card_id, misses, shown) VALUES (%s, %s, %s, %s) "
                "ON CONFLICT (user_id, card_id) DO NOTHING",
                (user_id, raw_id, misses, shown),
            )
            recorded = cur.rowcount == 1
        conn.commit()
    finally:
        conn.close()
    return recorded
