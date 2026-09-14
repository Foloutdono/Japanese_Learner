"""
Every character KANJIDIC2 knows — all 13,108 — read from
datas/kanji/kanji.sqlite3 instead of held in memory.

MEMORY NOTE (2026-09): this replaces six eager json.load()s spread over
content/kanji_meanings.py, content/radical_data.py, routes/dictionary.py
and study/exam_kanji_gen.py, which between them parsed ~6.7 MB of
KANJIDIC2 into Python objects at import — kanji_radicals.json three
separate times, and kanji_readings.json + kanji_meanings.json only to
build indexes immediately restricted to the app's own 2,212-character
deck. Parsed into real objects (a dict plus strings per field, per row)
that is several times the JSON's own size, on a 512 MB deploy. SQLite
reads only the pages a query touches, so RSS stays roughly flat however
big the dump gets — the same trade content/vocab_jmdict_data.py made for
the JMdict pool, and the reason the dictionary can now serve the whole
of KANJIDIC2 rather than the deck alone.

THE TABLE HOLDS BOTH HALVES. `in_deck` marks the 2,212 characters the app
teaches; the other 10,896 are the pool. Keeping them in one table is what
lets radical browsing be a single indexed query in stroke order (the way
a paper 漢和辞典 files under a radical) instead of an in-memory merge of
two sources — see by_radical().

Built offline by scripts/build_kanji_db.py; the JSON it reads is an
untracked intermediate, exactly as vocab_jmdict.json is.
"""
import os
import sqlite3
import threading

_BASE_DIR = os.path.dirname(os.path.dirname(__file__))
_DB_PATH = os.path.join(_BASE_DIR, "datas", "kanji", "kanji.sqlite3")

_COLUMNS = (
    "char", "codepoint", "radical", "stroke_count", "grade", "freq", "jlpt",
    "on_readings", "kun_readings", "readings", "nanori",
    "meaning_en", "meaning_fr", "meaning_es", "meaning_pt",
    "in_deck", "has_svg", "sort_rank",
)
_SELECT = "SELECT " + ", ".join(_COLUMNS) + " FROM kanji"

# One read-only connection per thread (sqlite3 connections aren't
# thread-safe to share). Same shape as vocab_jmdict_data.py's.
_local = threading.local()


def _conn() -> sqlite3.Connection:
    conn = getattr(_local, "conn", None)
    if conn is None:
        # uri=True + mode=ro: never accidentally write to the shipped DB.
        conn = sqlite3.connect(f"file:{_DB_PATH}?mode=ro", uri=True)
        _local.conn = conn
    return conn


def _row(row: tuple) -> dict:
    return dict(zip(_COLUMNS, row))


def meaning_of(entry: dict, lang: str = "en") -> str:
    """The character's meaning in `lang`, falling back to English.

    Mirrors content/kanji_meanings.py's get_kanji_meaning() so a pool row
    and a deck row produce the same "a; b; c" string. KANJIDIC2's French
    coverage is thin outside the deck — 73 of 10,896 pool characters have
    one — so nearly every pool row falls back, which is the same caveat
    the deck already carries for its own 219.
    """
    return entry.get(f"meaning_{lang}") or entry.get("meaning_en") or ""


# ── The search predicate ──────────────────────────────────────
# Deliberately the same fields routes/dictionary.py already matches a
# DECK kanji on — the character, its readings, its meanings — so the two
# halves of one collection answer a query the same way and the seam
# between them is invisible.
#
# BOTH app languages, not the one being shown. It used to be the shown
# one alone (COALESCE(NULLIF(meaning_fr, ''), meaning_en), mirroring
# get_meaning's fallback), on the reasoning that a French-only term
# finding pool characters but no deck ones was a half-answer. The deck
# half answers in both languages now: a learner thinks vocabulary in
# whichever language taught it to them, and being made to guess which
# one the app filed a character under is a worse half-answer than the
# one that reasoning avoided. es/pt are not searched — the app has two
# string tables (frontend/src/locales), and those columns are data
# KANJIDIC shipped, not a language anybody reads the app in.
#
# `kana_forms` are the kana a ROMAJI query spells (search_match.to_kana
# gives both scripts, so "mizu" arrives as ("みず", "ミズ")) and are empty
# for every other query. Each form is matched only where it could
# possibly be: this table has zero rows with an ASCII letter in char or
# readings, and its glosses hold no CJK, so the other pairings buy a
# scan that cannot match.
#
# LIKE is case-insensitive for ASCII in SQLite, which is what
# `q.lower() in meaning.lower()` does in Python.
_MEANINGS = "(meaning_en LIKE ? OR meaning_fr LIKE ?)"
_JAPANESE = "(char = ? OR readings LIKE ?)"


def _match(q: str, kana_forms: tuple[str, ...] = ()) -> tuple[str, tuple]:
    """(SQL predicate, parameters) for one query in all its forms."""
    clauses, params = [], []
    if q:
        if q.isascii():
            clauses.append(_MEANINGS)
            params += [f"%{q}%", f"%{q}%"]
        else:
            clauses.append(_JAPANESE)
            params += [q, f"%{q}%"]
    for form in kana_forms:
        clauses.append(_JAPANESE)
        params += [form, f"%{form}%"]
    return " OR ".join(clauses), tuple(params)


def count_matching(q: str, lang: str = "en", kana_forms: tuple[str, ...] = ()) -> int:
    """How many POOL characters match, without paying for a page.

    The dictionary needs the pool's total on every request (it is most of
    the collection's count) but only needs pool ROWS once a page runs past
    the deck. `lang` is accepted and ignored — both languages are searched
    now — and kept so the call sites read the same either way.
    """
    where, params = _match(q, kana_forms)
    if not where:
        return _conn().execute(
            "SELECT COUNT(*) FROM kanji WHERE in_deck = 0").fetchone()[0]
    return _conn().execute(
        f"SELECT COUNT(*) FROM kanji WHERE in_deck = 0 AND ({where})", params,
    ).fetchone()[0]


def search(q: str, limit: int, offset: int, lang: str = "en",
           kana_forms: tuple[str, ...] = ()) -> tuple[list[dict], int]:
    """One page of the pool, ordered by sort_rank. Returns (rows, total).

    sort_rank is computed offline (see build_kanji_db.py's _sort_key): the
    characters KANJIDIC gives a newspaper frequency rank first, then
    jōyō/jinmeiyō by grade, then the rest by stroke count. Stored rather
    than computed so idx_kanji_pool_sort covers the ORDER BY and paging
    never sorts.
    """
    return (page(q, limit, offset, kana_forms),
            count_matching(q, lang, kana_forms))


def page(q: str, limit: int, offset: int,
         kana_forms: tuple[str, ...] = ()) -> list[dict]:
    """search()'s rows without its count — see vocab_jmdict_data.page."""
    where, params = _match(q, kana_forms)
    if not where:
        rows = _conn().execute(
            f"{_SELECT} WHERE in_deck = 0 ORDER BY sort_rank LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
    else:
        rows = _conn().execute(
            f"{_SELECT} WHERE in_deck = 0 AND ({where}) ORDER BY sort_rank LIMIT ? OFFSET ?",
            (*params, limit, offset),
        ).fetchall()
    return [_row(r) for r in rows]


def by_radical(radical: int, q: str, limit: int, offset: int,
               lang: str = "en",
               kana_forms: tuple[str, ...] = ()) -> tuple[list[dict], int]:
    """One page of EVERY character filed under `radical`, deck and pool
    together, in stroke order — the order a paper 漢和辞典 uses.

    The radical's own stroke count is a constant within a radical, so
    ordering by the character's total strokes is the same order as by the
    remaining strokes routes/dictionary.py used to sort on in Python.
    idx_kanji_radical(radical, stroke_count) covers it, so this never
    sorts and never materialises the pool.
    """
    where = "radical = ?"
    params: tuple = (radical,)
    match, match_params = _match(q, kana_forms)
    if match:
        where += f" AND ({match})"
        params += match_params
    total = _conn().execute(
        f"SELECT COUNT(*) FROM kanji WHERE {where}", params).fetchone()[0]
    rows = _conn().execute(
        f"{_SELECT} WHERE {where} ORDER BY stroke_count, sort_rank LIMIT ? OFFSET ?",
        (*params, limit, offset),
    ).fetchall()
    return [_row(r) for r in rows], total


def get(char: str) -> dict | None:
    row = _conn().execute(f"{_SELECT} WHERE char = ?", (char,)).fetchone()
    return _row(row) if row else None


def _fetch_map(chars, columns: str):
    """One indexed query for a bounded set of characters.

    The deck-scoped consumers (kanji_meanings.KANJI_FR, radical_data's
    lookup table, exam_kanji_gen's distractor indexes) each want a small
    dict over characters they already know. Asking for them in one
    statement is what replaces loading the whole dump to keep a tenth of
    it.
    """
    chars = list(chars)
    if not chars:
        return []
    out = []
    # SQLite's default parameter limit is 999; chunk well inside it.
    for i in range(0, len(chars), 500):
        chunk = chars[i:i + 500]
        marks = ",".join("?" * len(chunk))
        out.extend(_conn().execute(
            f"SELECT char, {columns} FROM kanji WHERE char IN ({marks})", chunk,
        ).fetchall())
    return out


def meanings_for(chars, lang: str = "fr") -> dict[str, str]:
    """{char: meaning} for a bounded set, in `lang`, omitting the ones
    that have no entry in that language — the shape KANJI_FR has always
    had, so translations.get_meaning()'s fallback still fires for them."""
    col = f"meaning_{lang}" if lang in ("en", "fr", "es", "pt") else "meaning_en"
    return {c: m for c, m in _fetch_map(chars, col) if m}


def radicals_for(chars) -> dict[str, dict]:
    """{char: {"radical": n, "stroke_count": n}} for a bounded set — the
    shape kanji_radicals.json had, so radical_data.py's callers don't
    change."""
    return {
        c: {"radical": r, "stroke_count": s}
        for c, r, s in _fetch_map(chars, "radical, stroke_count")
        if r is not None
    }


def readings_for(chars) -> dict[str, dict]:
    """{char: {"ja_on": [...], "ja_kun": [...]}} for a bounded set — the
    slice of kanji_readings.json that study/exam_kanji_gen.py reads."""
    return {
        c: {
            "ja_on":  [p for p in (on or "").split("・") if p],
            "ja_kun": [p for p in (kun or "").split("・") if p],
        }
        for c, on, kun in _fetch_map(chars, "on_readings, kun_readings")
    }


def packed_readings_for(chars) -> dict[str, str]:
    """{char: "ニチ・ジツ・ひ"} for a bounded set — the deck's own packed
    `kana` format, so study/kanji_words.py's reading_tokens() can treat a
    pool character exactly like a deck one."""
    return {c: r for c, r in _fetch_map(chars, "readings") if r}


def svg_chars(chars) -> set[str]:
    """The subset of a bounded set that has a KanjiVG stroke diagram.

    KanjiVG covers 6,416 of the 13,108 characters. The deck happens to be
    at 100%, which is why nothing in the app had ever had to draw a plate
    without a sheet before the pool arrived.
    """
    return {c for c, has in _fetch_map(chars, "has_svg") if has}


def count() -> int:
    return _conn().execute("SELECT COUNT(*) FROM kanji").fetchone()[0]
