"""
JMdict vocabulary pool — every JMdict term/reading pair NOT already
covered by the app's own curated JLPT deck (vocab_data.py).

MEMORY NOTE (2026-08): this used to eagerly load vocab_jmdict.json
(292,848 entries) into a Python list at import time. Once parsed into
real Python objects (dict + str overhead per field, per entry), that
list is several times heavier than the ~28 MB of JSON it comes from —
comfortably enough on its own to blow a 512 MB deploy's memory budget
once vocab_jmdict_meanings.json's senses were merged in on top of it.

Backed by datas/vocab/vocab_jmdict.sqlite3 instead (built offline by
build_jmdict_db.py). SQLite doesn't load the file into the process —
it reads only the pages a query touches, so RSS stays roughly constant
regardless of pool size. The trade-off is a query instead of a dict
lookup; at this table size (292k rows, indexed) that's sub-millisecond,
irrelevant next to the DB file's own disk I/O.

Public surface kept close to the old module so callers (dictionary.py,
frequency_data.py) don't need a rewrite, but note the two real changes:

  - VOCAB_JMDICT (the full in-memory list) is GONE. Nothing should hold
    the whole pool in memory at once — callers that used to do
    `for w in VOCAB_JMDICT: ...` need to become a `search()` call
    (indexed SQL, also just plain faster than a 292k-row Python scan).
  - vocab_jmdict_to_id keeps using entry["seq"] for backwards
    compatibility with any already-issued card ids, BUT: seq is NOT
    unique per kanji/kana pair (a headword with several readings
    shares one seq — 59,206 of 292,848 rows). Two different words can
    therefore collide onto the same SRS card id. Pre-existing issue,
    not introduced by this migration — flagging it here since it's
    easy to fix now that entries also carry a real unique `id`
    (row position in the source vocab_jmdict.json) if you want to
    switch vocab_jmdict_to_id to `entry["id"]` instead. Doing so
    changes card ids for every JMdict-pool card already in a user's
    SRS state, so it needs an explicit migration, not a silent swap.
"""
import os
import sqlite3
import threading

_BASE_DIR = os.path.dirname(__file__)
_DATA_DIR = os.path.join(_BASE_DIR, "datas", "vocab")
_DB_PATH = os.path.join(_DATA_DIR, "vocab_jmdict.sqlite3")

_COLUMNS = ("id", "seq", "kanji", "kana", "meaning", "freq_rank", "has_examples")


def _row_to_entry(row: tuple) -> dict:
    return dict(zip(_COLUMNS, row))


# One read-only connection per thread (sqlite3 connections aren't
# thread-safe to share). FastAPI/uvicorn workers are process-based, so
# this is a handful of connections per worker process, not per request.
_local = threading.local()


def _conn() -> sqlite3.Connection:
    conn = getattr(_local, "conn", None)
    if conn is None:
        # uri=True + mode=ro: never accidentally write to the shipped DB.
        conn = sqlite3.connect(f"file:{_DB_PATH}?mode=ro", uri=True)
        _local.conn = conn
    return conn


def vocab_jmdict_key(entry: dict) -> str:
    """Same "<kanji>::<kana>" shape vocab_extras.py's _find_senses()
    already looks senses up by."""
    return f"{entry.get('kanji', '')}::{entry.get('kana', '')}"


def vocab_jmdict_to_id(entry: dict, _level: str | None = None) -> str:
    """Unchanged id shape from before this migration — see the seq
    non-uniqueness caveat in the module docstring."""
    return f"vocab_jmdict_{entry['seq']}"


def get_by_id(entry_id: int) -> dict | None:
    row = _conn().execute(
        "SELECT id, seq, kanji, kana, meaning, freq_rank, has_examples FROM entries WHERE id = ?",
        (entry_id,),
    ).fetchone()
    return _row_to_entry(row) if row else None


def sample_rank_range_with_examples(start_rank: int, end_rank_inclusive: int, limit: int) -> list[dict]:
    """Random sample of up to `limit` entries in [start_rank,
    end_rank_inclusive] that have at least one example sentence — used
    by reading.py's frequency-tier sentence source. Uses the
    (has_examples, freq_rank) index: SQLite can narrow to the
    has_examples=1 rows within the range before the ORDER BY RANDOM(),
    so this stays cheap even though the tier itself may have very few
    example-bearing words (~11% of the pool overall)."""
    rows = _conn().execute(
        "SELECT id, seq, kanji, kana, meaning, freq_rank, has_examples FROM entries "
        "WHERE has_examples = 1 AND freq_rank BETWEEN ? AND ? "
        "ORDER BY RANDOM() LIMIT ?",
        (start_rank, end_rank_inclusive, limit),
    ).fetchall()
    return [_row_to_entry(r) for r in rows]


def get_by_key(kanji: str, kana: str) -> dict | None:
    row = _conn().execute(
        "SELECT id, seq, kanji, kana, meaning, freq_rank, has_examples FROM entries WHERE kanji = ? AND kana = ?",
        (kanji, kana),
    ).fetchone()
    return _row_to_entry(row) if row else None


def get_by_rank_range(start_rank: int, end_rank_inclusive: int) -> list[dict]:
    """Entries whose freq_rank falls in [start_rank, end_rank_inclusive]
    (0-indexed) — the DB-backed equivalent of slicing the old in-memory
    frequency-order list. Uses the freq_rank index, no table scan."""
    rows = _conn().execute(
        "SELECT id, seq, kanji, kana, meaning, freq_rank, has_examples FROM entries "
        "WHERE freq_rank BETWEEN ? AND ? ORDER BY freq_rank",
        (start_rank, end_rank_inclusive),
    ).fetchall()
    return [_row_to_entry(r) for r in rows]


def count() -> int:
    return _conn().execute("SELECT COUNT(*) FROM entries").fetchone()[0]


def search(q: str, limit: int, offset: int) -> tuple[list[dict], int]:
    """Substring search over kanji/kana/meaning, same semantics as the
    old `for w in VOCAB_JMDICT: if q in ... ` loop in dictionary.py, but
    as an indexed-where-possible SQL query instead of a 292k-row Python
    scan. Returns (page_of_entries, total_matches)."""
    if q == "":
        total = count()
        rows = _conn().execute(
            "SELECT id, seq, kanji, kana, meaning, freq_rank, has_examples FROM entries "
            "ORDER BY id LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
        return [_row_to_entry(r) for r in rows], total

    like = f"%{q}%"
    total = _conn().execute(
        "SELECT COUNT(*) FROM entries WHERE kanji LIKE ? OR kana LIKE ? OR meaning LIKE ?",
        (like, like, like),
    ).fetchone()[0]
    rows = _conn().execute(
        "SELECT id, seq, kanji, kana, meaning, freq_rank, has_examples FROM entries "
        "WHERE kanji LIKE ? OR kana LIKE ? OR meaning LIKE ? "
        "ORDER BY id LIMIT ? OFFSET ?",
        (like, like, like, limit, offset),
    ).fetchall()
    return [_row_to_entry(r) for r in rows], total


def get_senses(kanji: str, kana: str) -> list[dict] | None:
    """The per-word senses blob (tags/term_tags/glossary/examples) —
    used by vocab_extras.py's JMdict fallback layer. None if this word
    has no JMdict pool entry or no recorded senses."""
    import json
    row = _conn().execute(
        "SELECT senses.blob FROM senses JOIN entries ON entries.id = senses.id "
        "WHERE entries.kanji = ? AND entries.kana = ?",
        (kanji, kana),
    ).fetchone()
    return json.loads(row[0]) if row else None


def iter_kanji_kana_pairs():
    """Lightweight (kanji, kana) stream over every JMdict-pool entry —
    for vocab_extras.py's furigana reading table, which only ever needs
    these two columns, never the (much heavier) senses/examples data.
    A generator over a server-side cursor: never holds more than one
    page of rows in memory at a time."""
    cursor = _conn().execute("SELECT kanji, kana FROM entries WHERE kanji != ''")
    for kanji, kana in cursor:
        yield kanji, kana
