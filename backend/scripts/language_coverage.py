"""
How much of what the app teaches reads a language (plans 302, 312).

English is the course's source; every other language is written beside it
a part at a time, and whatever is not written yet reads English (the
learner is never shown a blank, nor French). This counts, per part of the
course, the texts that carry the language and the ones still to write, so
each wave of translation starts from the figures rather than a guess.
Spanish was counted so from its first wave (plan 302, then
scripts/spanish_coverage.py); any language is since plan 312.

A text is counted where the content writes it in two languages: a dict
with an "en" and a "fr" (a gloss pair, a sentence row), or a field with
its "_fr" twin (structure / structure_fr). A deck card is counted by its
own line in datas/vocab/vocab_{lang}.json, its written form's line as a
fallback (French's map keys by both, plan 107). The Tatoeba sentences are
counted by layer, as are a dictionary entry's senses and the pool's
one-line glosses: the rows of jmdict_{lang}.sqlite3 against the French
layer's. The interface's string table (frontend/src/locales/{lang}) is
not here: locales.test.js holds it whole.

What each part is held whole in by the tests is translations.WRITTEN; a
part shows here as whole before it joins it, in the commit that does.

Read-only, no database, no network: JSON is read as JSON and the Python
content modules are parsed with `ast`, never imported.

    cd backend && python -m scripts.language_coverage --lang es          # the table
    cd backend && python -m scripts.language_coverage --lang id --json   # the figures
"""
import argparse
import ast
import json
import os
import sqlite3
import sys

_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_FRONTEND = os.path.join(os.path.dirname(_BACKEND), "frontend")
LEVELS = ("N5", "N4", "N3", "N2", "N1")
NAMES = {"en": "English", "fr": "French", "es": "Spanish", "id": "Indonesian"}


def _path(*parts: str) -> str:
    return os.path.join(_BACKEND, *parts)


def _load(*parts: str):
    with open(_path(*parts), encoding="utf-8") as f:
        return json.load(f)


def _written(text) -> bool:
    return isinstance(text, str) and bool(text.strip())


def _pairs(node, lang: str, out: list[int]) -> list[int]:
    """[written, of] over every bilingual text under a JSON value."""
    if isinstance(node, dict):
        if isinstance(node.get("en"), str) and isinstance(node.get("fr"), str):
            out[1] += 1
            out[0] += _written(node.get(lang))
        for key, value in node.items():
            if key.endswith("_fr") and isinstance(value, str) and isinstance(node.get(key[:-3]), str):
                out[1] += 1
                out[0] += _written(node.get(f"{key[:-3]}_{lang}"))
            _pairs(value, lang, out)
    elif isinstance(node, list):
        for value in node:
            _pairs(value, lang, out)
    return out


def _module_pairs(lang: str, *parts: str) -> list[int]:
    """The same count over a Python content module's literals."""
    with open(_path(*parts), encoding="utf-8") as f:
        tree = ast.parse(f.read())
    out = [0, 0]
    for node in ast.walk(tree):
        if not isinstance(node, ast.Dict):
            continue
        keys = {k.value for k in node.keys if isinstance(k, ast.Constant) and isinstance(k.value, str)}
        if {"en", "fr"} <= keys:
            out[1] += 1
            out[0] += lang in keys
    return out


def vocab(lang: str) -> dict[str, list[int]]:
    deck = _load("datas", "vocab", "vocab_deck.json")
    path = _path("datas", "vocab", f"vocab_{lang}.json")
    lines = _load("datas", "vocab", f"vocab_{lang}.json") if os.path.exists(path) else {}
    out = {}
    for level in LEVELS:
        entries = deck.get(level, [])
        own = [lines.get(f"{e['kanji']}::{e['kana']}" if e["kanji"] else e["kana"])
               or lines.get(e["kanji"] or e["kana"]) for e in entries]
        out[level] = [sum(bool(line) for line in own), len(entries)]
    return out


def kanji(lang: str) -> dict[str, list[int]]:
    deck = _load("datas", "kanji", "kanji_deck.json")
    conn = sqlite3.connect(f"file:{_path('datas', 'kanji', 'kanji.sqlite3')}?mode=ro", uri=True)
    try:
        columns = {row[1] for row in conn.execute("PRAGMA table_info(kanji)")}
        written = ({c for (c,) in conn.execute(f"SELECT char FROM kanji WHERE meaning_{lang} != ''")}
                   if f"meaning_{lang}" in columns else set())
    finally:
        conn.close()
    return {level: [sum(e["kanji"] in written for e in deck.get(level, [])), len(deck.get(level, []))]
            for level in LEVELS}


def grammar(lang: str) -> dict[str, dict[str, list[int]]]:
    """Per level: the gloss and formation line, the lesson (steps,
    compare, examples), and the drills (choose, tour)."""
    out = {}
    for level in LEVELS:
        points = _load("content", "grammar", f"{level}.json")
        row = {"gloss": [0, 0], "lesson": [0, 0], "drills": [0, 0]}
        for p in points:
            _pairs({"meaning": p.get("meaning"), "structure": p.get("structure"),
                    "structure_fr": p.get("structure_fr"), f"structure_{lang}": p.get(f"structure_{lang}")},
                   lang, row["gloss"])
            _pairs([p.get("steps"), p.get("compare"), p.get("examples")], lang, row["lesson"])
            _pairs([p.get("choose"), p.get("tour")], lang, row["drills"])
        out[level] = row
    return out


def _rows(name: str, table: str) -> int:
    """A layer's rows in `table` (content/jmdict_fr.py), 0 without the file."""
    path = _path("datas", "vocab", name)
    if not os.path.exists(path):
        return 0
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        return conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    finally:
        conn.close()


def _theme_words(lang: str) -> list[int]:
    """Every theme word, in the sense it has in its theme: a pool word has
    no other gloss, and a deck card's gloss may be another sense."""
    rows = [r for rows in _load("datas", "vocab", "theme_words.json").values() for r in rows]
    return [sum(_written(r.get(f"meaning_{lang}")) for r in rows), len(rows)]


def _radicals(lang: str) -> list[int]:
    """The 214 radicals' meanings (content/radical_info.py): French is
    RADICAL_INFO's second column, a later language a table of its own
    (RADICAL_ES, ...)."""
    with open(_path("content", "radical_info.py"), encoding="utf-8") as f:
        tree = ast.parse(f.read())
    tables = {getattr(node.target, "id", ""): node.value for node in tree.body if isinstance(node, ast.AnnAssign)}
    if lang == "fr":
        rows = tables["RADICAL_INFO"].values
        return [sum(isinstance(r, ast.Tuple) and _written(getattr(r.elts[1], "value", None)) for r in rows), 214]
    table = tables.get(f"RADICAL_{lang.upper()}")
    return [len(table.keys) if table is not None else 0, 214]


def banks(lang: str) -> dict[str, list[int]]:
    """The other written content, each as one figure."""
    layer = f"jmdict_{lang}.sqlite3"
    out = {
        "basics course": _pairs(_load("content", "basics.json"), lang, [0, 0]),
        "reading bank": _module_pairs(lang, "content", "reading_sentences.py"),
        "dictation bank": _module_pairs(lang, "content", "listening_clips.py"),
        "example sentences (fixed)": _pairs(_load("datas", "vocab", "example_fixes.json"), lang, [0, 0]),
        "example sentences (added)": _pairs(_load("datas", "vocab", "example_added.json"), lang, [0, 0]),
        "Tatoeba sentences": [_rows(layer, "example"), _rows("jmdict_fr.sqlite3", "example")],
        "dictionary senses": [_rows(layer, "sense"), _rows("jmdict_fr.sqlite3", "sense")],
        "pool words": [_rows(layer, "pool_line"), _rows("jmdict_fr.sqlite3", "pool_line")],
        "breakdown glosses": [a + b for a, b in zip(_module_pairs(lang, "study", "particle_glosses.py"),
                                                    _module_pairs(lang, "study", "analysis.py"))],
        "theme words": _theme_words(lang),
        "radicals": _radicals(lang),
    }
    for name, folder in (("comprehension seeds", "comprehension"), ("conversation bank", "conversation")):
        total = [0, 0]
        for level in LEVELS:
            if os.path.exists(_path("content", folder, f"{level}.json")):
                _pairs(_load("content", folder, f"{level}.json"), lang, total)
        out[name] = total
    return out


def interface(lang: str) -> bool:
    """Whether the interface has a string table in `lang` (locales.test.js
    holds a table whole: every key of the English one)."""
    return os.path.exists(os.path.join(_FRONTEND, "src", "locales", lang, "index.js"))


def report(lang: str) -> dict:
    return {"lang": lang, "interface": interface(lang), "vocab": vocab(lang), "kanji": kanji(lang),
            "grammar": grammar(lang), "banks": banks(lang)}


def _pct(written: int, of: int) -> str:
    return f"{written:>6} / {of:<6} {100 * written / of:5.1f}%" if of else f"{written:>6} / {of:<6}    --"


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--lang", required=True, help="the language to count (es, id, ...)")
    p.add_argument("--json", action="store_true", help="the figures, as JSON")
    a = p.parse_args()
    lang = a.lang.strip().lower()
    figures = report(lang)
    if a.json:
        json.dump(figures, sys.stdout, ensure_ascii=False, indent=2)
        print()
        return
    print(f"{NAMES.get(lang, lang)}, written / to write. Anything not written reads English.\n")
    print(f"Interface (frontend/src/locales/{lang}): "
          + ("whole, held by locales.test.js\n" if figures["interface"] else "not written\n"))
    for deck in ("vocab", "kanji"):
        print(f"{deck} deck glosses")
        for level, (w, n) in figures[deck].items():
            print(f"  {level}  {_pct(w, n)}")
    print("\ngrammar catalogue        gloss + formation      lesson                 drills")
    for level, row in figures["grammar"].items():
        print(f"  {level}  " + "  ".join(f"{_pct(*row[k]):<22}" for k in ("gloss", "lesson", "drills")))
    print("\nother content")
    for name, (w, n) in figures["banks"].items():
        print(f"  {name:<28}{_pct(w, n)}")


if __name__ == "__main__":
    main()
