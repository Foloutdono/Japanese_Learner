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

Spanish (plan 291, ADR 0023) is the same layer in a file of its own,
datas/vocab/jmdict_es.sqlite3, its three tables the same with an `es`
column for `fr`, built by the same script (`--lang es`), and holding
what the French one does: every lookup here takes the language. What
plan 280 folds is still decided by the French layer alone
(study/card_lookup), so a compound reads the same in every language.
"""
import os
import sqlite3
import threading

from content import example_fixes

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(_BASE_DIR, "datas", "vocab", "jmdict_fr.sqlite3")
DB_PATHS = {"fr": DB_PATH, "es": os.path.join(_BASE_DIR, "datas", "vocab", "jmdict_es.sqlite3")}
# The languages a layer exists for, and the only names a query's column
# is spelled from.
LANGS = tuple(DB_PATHS)

_local = threading.local()


def _conn(lang: str = "fr") -> sqlite3.Connection | None:
    conns = getattr(_local, "conns", None)
    if conns is None:
        conns = _local.conns = {}
    conn = conns.get(lang)
    if conn is None:
        path = DB_PATHS.get(lang)
        if path is None or not os.path.exists(path):
            return None
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True, check_same_thread=False)
        conns[lang] = conn
    return conn


def _one(sql: str, params: tuple, lang: str = "fr") -> str | None:
    conn = _conn(lang)
    if conn is None:
        return None
    row = conn.execute(sql, params).fetchone()
    return row[0] if row and row[0] else None


def _many(sql_head: str, keys: list, width: int = 1, lang: str = "fr") -> list[tuple]:
    """Rows for a bounded batch, 400 keys a query (SQLite's variable cap
    is far above that; the batches here are a page's worth)."""
    conn = _conn(lang)
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

def sense(glossary: str, lang: str = "fr") -> str | None:
    """A sense's French (or `lang`'s) glossary, from its English one ("a; b; c")."""
    if not glossary or lang not in LANGS:
        return None
    return _one(f"SELECT {lang} FROM sense WHERE en = ?", (glossary,), lang)


def senses(glossaries, lang: str = "fr") -> dict[str, str]:
    """{english glossary: its line in `lang`} for the ones that have one."""
    if lang not in LANGS:
        return {}
    keys = list(dict.fromkeys(g for g in glossaries if g))
    return {en: tr for en, tr in _many(f"SELECT en, {lang} FROM sense WHERE en", keys, lang=lang) if tr}


# ── Sentences ─────────────────────────────────────────────────

def example(jp: str, lang: str = "fr") -> str | None:
    """A Tatoeba sentence's French (or `lang`'s), or None. A sentence the
    course corrected or wrote (content/example_fixes.py, plan 227)
    answers its own."""
    if not jp or lang not in LANGS:
        return None
    return example_fixes.translated(jp, lang) or _one(f"SELECT {lang} FROM example WHERE jp = ?", (jp,), lang)


def examples(jps, lang: str = "fr") -> dict[str, str]:
    if lang not in LANGS:
        return {}
    keys = list(dict.fromkeys(j for j in jps if j))
    out = {jp: tr for jp, tr in _many(f"SELECT jp, {lang} FROM example WHERE jp", keys, lang=lang) if tr}
    for jp in keys:
        fixed = example_fixes.translated(jp, lang)
        if fixed:
            out[jp] = fixed
    return out


def translation(jp: str, en: str, lang: str) -> tuple[str, str]:
    """(text, its language) for a corpus sentence: the learner's
    language where a layer has the sentence, the English otherwise --
    the pair routes/reading._finish_phrase carries as translation /
    translation_lang."""
    own = example(jp, lang)
    if own:
        return own, lang
    return en, "en"


# ── Pool words ────────────────────────────────────────────────

def pool_line(kanji: str, kana: str, lang: str = "fr") -> str | None:
    """A JMdict pool word's French (or `lang`'s) line, or None."""
    if not (kanji or kana) or lang not in LANGS:
        return None
    return _one(f"SELECT {lang} FROM pool_line WHERE kanji = ? AND kana = ?", (kanji or "", kana or ""), lang)


def pool_lines(pairs, lang: str = "fr") -> dict[tuple[str, str], str]:
    if lang not in LANGS:
        return {}
    keys = list(dict.fromkeys((k or "", r or "") for k, r in pairs))
    return {(k, r): tr for k, r, tr in _many(f"SELECT kanji, kana, {lang} FROM pool_line WHERE", keys,
                                              width=2, lang=lang) if tr}


def pool_meaning(entry: dict, lang: str) -> str:
    """A pool word's gloss in `lang`: its line where the learner reads
    French or Spanish and the layer has one, JMdict's English otherwise.

    Never the course's VOCAB_FR: that map is keyed by written form, and
    would hand a pool word a deck homograph's French (殿 どの "Mr." read
    as 殿 しんがり's "arrière-garde") -- routes/decks._wrap_vocab's rule,
    now with a French of the pool's own to give instead."""
    english = entry.get("meaning", "")
    return pool_line(entry.get("kanji", ""), entry.get("kana", ""), lang) or english


def search_pool(q: str, limit: int = 2000, lang: str = "fr") -> list[tuple[str, str]]:
    """(kanji, kana) of the pool words whose French (or `lang`'s) line
    contains `q`, case-insensitively -- the French half of the
    dictionary's gloss search, which otherwise matched JMdict's English
    alone (« cheval » found one pool word where "horse" finds 335)."""
    conn = _conn(lang)
    if conn is None or not q:
        return []
    from study.search_match import fold
    return conn.execute(
        "SELECT kanji, kana FROM pool_line WHERE fold LIKE ? LIMIT ?", (f"%{fold(q)}%", limit),
    ).fetchall()


def counts(lang: str = "fr") -> dict[str, int]:
    """Rows per table -- for the tests and the build report."""
    conn = _conn(lang)
    if conn is None:
        return {"sense": 0, "example": 0, "pool_line": 0}
    return {t: conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
            for t in ("sense", "example", "pool_line")}
