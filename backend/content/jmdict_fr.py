"""
The French layer over JMdict (plan 215).

JMdict, as this app ships it (JMdict_english_with_examples), is English
only, and so was everything drawn from it: the numbered senses of a
dictionary entry, the Tatoeba sentences under them and in reading and
translation practice, and the one-line gloss of every word outside the
course -- the analyser's rows, the dictionary's search tiles, a kanji's
word list, the frequency line's JMdict tiers. A French learner read the
card in French and everything around it in English.

This is the French for those three things, in datas/vocab/jmdict_fr.sqlite3:

    sense     en TEXT PRIMARY KEY, fr TEXT
              a sense's glossary as vocab_extras prints it ("a; b; c")
              -> the same sense in French. Keyed by the English line
              rather than by entry: an identical glossary is the same
              sense wherever it is filed, and the deck's 8,050 words
              share many.
    example   jp TEXT PRIMARY KEY, fr TEXT
              a Tatoeba sentence -> its French, translated from the
              Japanese (the English is a loose second-hand reference).
    pool_line kanji TEXT, kana TEXT, fr TEXT, fold TEXT,
              PRIMARY KEY (kanji, kana)
              a JMdict pool word -> its one French line, the pool's
              counterpart of vocab_fr.json's deck glosses (`fold`, the
              line lowercased and accent-stripped, is what search reads).

It is a separate file, not three tables inside vocab_jmdict.sqlite3, on
purpose: that one is 76 MB, a pool card's id is its row's position in it
(CLAUDE.md -- never rebuild it), and every correction to a French line
would otherwise re-commit all of it. scripts/build_jmdict_fr.py builds
this one from JSON drafts and dumps it back to JSON for editing, as
build_jmdict_db.py does for the pool.

Every lookup answers None where there is no French, and the caller keeps
the English it already had, labelled by its language: a missing line is a
gap, never a blank. The file being absent altogether (a checkout without
it) is the same case, everywhere.

Text drafted with an AI model, from the Japanese, and audited like the
rest of the taught content (docs/content-audit/PLAYBOOK.md).
"""
import os
import sqlite3
import threading

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(_BASE_DIR, "datas", "vocab", "jmdict_fr.sqlite3")

_local = threading.local()


def _conn() -> sqlite3.Connection | None:
    conn = getattr(_local, "conn", None)
    if conn is None:
        if not os.path.exists(DB_PATH):
            return None
        conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, check_same_thread=False)
        _local.conn = conn
    return conn


def _one(sql: str, params: tuple) -> str | None:
    conn = _conn()
    if conn is None:
        return None
    row = conn.execute(sql, params).fetchone()
    return row[0] if row and row[0] else None


def _many(sql_head: str, keys: list, width: int = 1) -> list[tuple]:
    """Rows for a bounded batch, 400 keys a query (SQLite's variable cap
    is far above that; the batches here are a page's worth)."""
    conn = _conn()
    if conn is None or not keys:
        return []
    out = []
    for i in range(0, len(keys), 400):
        chunk = keys[i:i + 400]
        if width == 1:
            marks = ",".join("?" * len(chunk))
            out += conn.execute(f"{sql_head} IN ({marks})", tuple(chunk)).fetchall()
        else:
            marks = " OR ".join("(kanji = ? AND kana = ?)" for _ in chunk)
            flat = tuple(v for pair in chunk for v in pair)
            out += conn.execute(f"{sql_head} {marks}", flat).fetchall()
    return out


# ── Senses ────────────────────────────────────────────────────

def sense(glossary: str) -> str | None:
    """A sense's French glossary, from its English one ("a; b; c")."""
    return _one("SELECT fr FROM sense WHERE en = ?", (glossary,)) if glossary else None


def senses(glossaries) -> dict[str, str]:
    """{english glossary: french} for the ones that have French."""
    keys = list(dict.fromkeys(g for g in glossaries if g))
    return {en: fr for en, fr in _many("SELECT en, fr FROM sense WHERE en", keys) if fr}


# ── Sentences ─────────────────────────────────────────────────

def example(jp: str) -> str | None:
    """A Tatoeba sentence's French, or None."""
    return _one("SELECT fr FROM example WHERE jp = ?", (jp,)) if jp else None


def examples(jps) -> dict[str, str]:
    keys = list(dict.fromkeys(j for j in jps if j))
    return {jp: fr for jp, fr in _many("SELECT jp, fr FROM example WHERE jp", keys) if fr}


def translation(jp: str, en: str, lang: str) -> tuple[str, str]:
    """(text, its language) for a corpus sentence: the French where the
    learner reads French and it exists, the English otherwise -- the
    pair routes/reading._finish_phrase carries as translation /
    translation_lang."""
    if lang == "fr":
        fr = example(jp)
        if fr:
            return fr, "fr"
    return en, "en"


# ── Pool words ────────────────────────────────────────────────

def pool_line(kanji: str, kana: str) -> str | None:
    """A JMdict pool word's French line, or None."""
    if not (kanji or kana):
        return None
    return _one("SELECT fr FROM pool_line WHERE kanji = ? AND kana = ?", (kanji or "", kana or ""))


def pool_lines(pairs) -> dict[tuple[str, str], str]:
    keys = list(dict.fromkeys((k or "", r or "") for k, r in pairs))
    return {(k, r): fr for k, r, fr in _many("SELECT kanji, kana, fr FROM pool_line WHERE", keys, width=2) if fr}


def pool_meaning(entry: dict, lang: str) -> str:
    """A pool word's gloss in `lang`: its French line where the learner
    reads French and the layer has one, JMdict's English otherwise.

    Never the course's VOCAB_FR: that map is keyed by written form, and
    would hand a pool word a deck homograph's French (殿 どの "Mr." read
    as 殿 しんがり's "arrière-garde") -- routes/decks._wrap_vocab's rule,
    now with a French of the pool's own to give instead."""
    english = entry.get("meaning", "")
    if lang == "fr":
        return pool_line(entry.get("kanji", ""), entry.get("kana", "")) or english
    return english


def search_pool(q: str, limit: int = 2000) -> list[tuple[str, str]]:
    """(kanji, kana) of the pool words whose French line contains `q`,
    case-insensitively -- the French half of the dictionary's gloss
    search, which otherwise matched JMdict's English alone (« cheval »
    found one pool word where "horse" finds 335)."""
    conn = _conn()
    if conn is None or not q:
        return []
    from study.search_match import fold
    return conn.execute(
        "SELECT kanji, kana FROM pool_line WHERE fold LIKE ? LIMIT ?", (f"%{fold(q)}%", limit),
    ).fetchall()


def counts() -> dict[str, int]:
    """Rows per table -- for the tests and the build report."""
    conn = _conn()
    if conn is None:
        return {"sense": 0, "example": 0, "pool_line": 0}
    return {t: conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
            for t in ("sense", "example", "pool_line")}
