"""
DB-backed replacement for vocab_extras.py's `_VOCAB_MEANINGS` dict —
see build_curated_senses_db.py's docstring for why (two full in-memory
copies of ~8,400 words' senses, permanently resident per worker).

Query surface mirrors what vocab_extras.py actually does with the old
dict (`.get(key)`, `.get(key, default)`, `key in ...`-style existence
checks, and a full iteration to build _MEANINGS_READING) rather than
handing back a real dict, so the migration at each callsite is a
small, mechanical swap — see the three call sites noted below.
"""
import json
import os
import sqlite3
import threading

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


def get(key: str, default=None):
    """Drop-in for `_VOCAB_MEANINGS.get(key)` — vocab_extras.py lines
    339 and 345 (`_VOCAB_MEANINGS.get(f"{kanji}::{kana}")` and the
    reading-fallback lookup) both become `vocab_meanings_data.get(...)`
    with no other change needed at either call site."""
    row = _conn().execute("SELECT blob FROM curated_senses WHERE key = ?", (key,)).fetchone()
    return json.loads(row[0]) if row else default


def iter_keys():
    """Drop-in for `for key in _VOCAB_MEANINGS:` (vocab_extras.py line
    563, inside _build_meanings_readings) — swap the loop header to
    `for key in vocab_meanings_data.iter_keys():`. A generator over a
    server-side cursor, so this never holds more than the DB's own
    page cache in memory, unlike the derived _MEANINGS_READING
    structure it currently helps build."""
    cursor = _conn().execute("SELECT key FROM curated_senses")
    for (key,) in cursor:
        yield key


def iter_items():
    """Drop-in for `for key, senses in _VOCAB_MEANINGS.items():`."""
    cursor = _conn().execute("SELECT key, blob FROM curated_senses")
    for key, blob in cursor:
        yield key, json.loads(blob)


def keys_with_examples() -> set[str]:
    """Replacement for vocab_extras.py's `_build_deck_words_with_examples()`
    — that function used to decode every sense blob in
    `_VOCAB_MEANINGS` just to test `any(s.get("examples") for s in
    senses)`. has_examples is now precomputed per key at build time
    (see build_curated_senses_db.py), so this is one indexed query and
    no JSON decoding at all. Still returns a real in-memory set, same
    as before — it's a set of short strings (~8k keys, not senses), so
    keeping it resident for O(1) `in` checks costs nothing worth
    optimizing further."""
    rows = _conn().execute("SELECT key FROM curated_senses WHERE has_examples = 1").fetchall()
    return {key for (key,) in rows}
