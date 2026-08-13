"""
Thematic vocab decks ("fruits", "vegetables", "body parts", "jobs", ...) —
a third axis for picking what to study, alongside JLPT level
(kanji_data.py/vocab_data.py) and frequency tier (frequency_data.py).

Like frequency tiers, a theme is just a different ORDERING/GROUPING over
words that already live in the app's own curated deck (vocab_data.py) or
the JMdict pool (vocab_jmdict_data.py) — never a second copy of either.
A word studied via "Fruits" and the same word studied via "N4" or "Top
200" is the SAME SRS card: card ids are computed with the exact same
vocab_to_id/vocab_jmdict_to_id functions frequency_data.py already uses,
via frequency_data.resolve()/to_id() (domain is always "vocab" or
"vocab_jmdict" here — themes don't cover kanji).

Membership itself is precomputed OFFLINE by build_theme_db.py (keyword
matching against glosses — see that script's docstring) into a small
`theme_words` table living in the same datas/vocab/vocab_jmdict.sqlite3
database frequency_data.py's DB-backed vocab_jmdict domain already uses
— no new file, no new in-memory structure. At ~7-8k rows total across
every theme this table barely registers next to the 292k-row entries
table (a handful of KB against ~65 MB) — nothing here reads the whole
table into memory at once, so this stays flat regardless of how many
themes get added, same reasoning as vocab_jmdict_data.py's own DB
migration.
"""
import os
import sqlite3
import threading

from content.frequency_data import resolve as _resolve, to_id as _to_id

# One level up: this module now lives in a package, and datas/
# is still at the backend root.
_BASE_DIR = os.path.dirname(os.path.dirname(__file__))
_DB_PATH = os.path.join(_BASE_DIR, "datas", "vocab", "vocab_jmdict.sqlite3")

_local = threading.local()


def _conn() -> sqlite3.Connection:
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(f"file:{_DB_PATH}?mode=ro", uri=True)
        _local.conn = conn
    return conn


def list_themes() -> list[dict]:
    """[{key, count}, ...] sorted alphabetically by key — the theme
    counterpart to /api/frequency/{domain}/tiers's tier list. Display
    labels are NOT here (same convention as LevelSelector's
    LEVEL_HINTS): the frontend maps `key` through the translation
    file, e.g. t.themeFruits, t.themeVegetables, so themes read
    correctly in whatever language the app is displaying — see
    ThemeSelector.jsx.
    """
    rows = _conn().execute(
        "SELECT theme, COUNT(*) FROM theme_words GROUP BY theme ORDER BY theme"
    ).fetchall()
    return [{"key": theme, "count": count} for theme, count in rows]


def theme_card_ids(theme: str) -> list[str]:
    """Every card id belonging to `theme`, in the build script's rank
    order (curated-deck matches first, then JMdict-pool matches by
    frequency) — the id list a caller threads into srs.ensure_cards()
    exactly like vocab.py's _select_cards does with vocab_to_id(...)
    for a level. Unresolvable rows (shouldn't happen — see
    frequency_data.resolve's own docstring for when a lookup can
    legitimately miss) are skipped rather than raising, same as
    frequency_data.to_id callers already tolerate.
    """
    rows = _conn().execute(
        "SELECT domain, kanji, kana FROM theme_words WHERE theme = ? ORDER BY rank",
        (theme,),
    ).fetchall()
    ids = []
    for domain, kanji, kana in rows:
        key = f"{kanji}::{kana}"
        card_id = _to_id(domain, key)
        if card_id is not None:
            ids.append(card_id)
    return ids


def theme_entries(theme: str) -> list[dict]:
    """Full display rows for `theme` — {card_id, domain, kanji, kana,
    meaning, level}. `level` is the native JLPT level for a "vocab"
    row, None for a "vocab_jmdict" row (mirrors dictionary.py's
    category="jmdict" branch, which also always returns level=None).
    Used by a /api/vocab/theme/{theme}/card(s) endpoint the same way
    _select_cards uses VOCAB_BY_LEVEL — see vocab.py.
    """
    rows = _conn().execute(
        "SELECT domain, kanji, kana, meaning FROM theme_words WHERE theme = ? ORDER BY rank",
        (theme,),
    ).fetchall()
    entries = []
    for domain, kanji, kana, meaning in rows:
        key = f"{kanji}::{kana}"
        card_id = _to_id(domain, key)
        if card_id is None:
            continue
        resolved = _resolve(domain, key)
        level = resolved[0] if resolved else None
        entries.append({
            "card_id": card_id,
            "domain":  domain,
            "kanji":   kanji,
            "kana":    kana,
            "meaning": meaning,
            "level":   level,
        })
    return entries
