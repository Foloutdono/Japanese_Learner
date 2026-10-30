"""
How much of what the app teaches reads Spanish (plan 291).

Spanish is the app's third language, written beside English and French a
part at a time; whatever has no Spanish yet reads English (the learner is
never shown a blank). This counts, per part of the course, the texts that
carry their Spanish and the ones still to write, so each wave of
translation starts from the figures rather than a guess.

A text is counted where the content writes it in two languages: a dict
with an "en" and a "fr" (a gloss pair, a sentence row), or a field with
its "_fr" twin (structure / structure_fr). The Tatoeba sentences are
counted by layer: the rows of jmdict_es.sqlite3 against the French
layer's, the deck's own and the pool's together (tests/test_spanish.py
holds every one a deck card shows). The interface's string table
(frontend/src/locales/es) is not here: locales.test.js holds it whole.

Read-only, no database, no network: JSON is read as JSON and the Python
content modules are parsed with `ast`, never imported.

    cd backend && python -m scripts.spanish_coverage          # the table
    cd backend && python -m scripts.spanish_coverage --json   # the figures
"""
import argparse
import ast
import json
import os
import sqlite3
import sys

_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEVELS = ("N5", "N4", "N3", "N2", "N1")


def _path(*parts: str) -> str:
    return os.path.join(_BACKEND, *parts)


def _load(*parts: str):
    with open(_path(*parts), encoding="utf-8") as f:
        return json.load(f)


def _pairs(node, out: list[int]) -> list[int]:
    """[written, of] over every bilingual text under a JSON value."""
    if isinstance(node, dict):
        if isinstance(node.get("en"), str) and isinstance(node.get("fr"), str):
            out[1] += 1
            out[0] += bool(isinstance(node.get("es"), str) and node["es"].strip())
        for key, value in node.items():
            if key.endswith("_fr") and isinstance(value, str) and isinstance(node.get(key[:-3]), str):
                out[1] += 1
                twin = node.get(key[:-3] + "_es")
                out[0] += bool(isinstance(twin, str) and twin.strip())
            _pairs(value, out)
    elif isinstance(node, list):
        for value in node:
            _pairs(value, out)
    return out


def _module_pairs(*parts: str) -> list[int]:
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
            out[0] += "es" in keys
    return out


def vocab() -> dict[str, list[int]]:
    deck = _load("datas", "vocab", "vocab_deck.json")
    spanish = _load("datas", "vocab", "vocab_es.json")
    out = {}
    for level in LEVELS:
        keys = [f"{e['kanji']}::{e['kana']}" if e["kanji"] else e["kana"] for e in deck.get(level, [])]
        out[level] = [sum(bool(spanish.get(k)) for k in keys), len(keys)]
    return out


def kanji() -> dict[str, list[int]]:
    deck = _load("datas", "kanji", "kanji_deck.json")
    conn = sqlite3.connect(f"file:{_path('datas', 'kanji', 'kanji.sqlite3')}?mode=ro", uri=True)
    try:
        spanish = {c for (c,) in conn.execute("SELECT char FROM kanji WHERE meaning_es != ''")}
    finally:
        conn.close()
    return {level: [sum(e["kanji"] in spanish for e in deck.get(level, [])), len(deck.get(level, []))]
            for level in LEVELS}


def grammar() -> dict[str, dict[str, list[int]]]:
    """Per level: the gloss and formation line, the lesson (steps,
    compare, examples), and the drills (choose, tour)."""
    out = {}
    for level in LEVELS:
        points = _load("content", "grammar", f"{level}.json")
        row = {"gloss": [0, 0], "lesson": [0, 0], "drills": [0, 0]}
        for p in points:
            _pairs({"meaning": p.get("meaning"), "structure": p.get("structure"),
                    "structure_fr": p.get("structure_fr"), "structure_es": p.get("structure_es")}, row["gloss"])
            _pairs([p.get("steps"), p.get("compare"), p.get("examples")], row["lesson"])
            _pairs([p.get("choose"), p.get("tour")], row["drills"])
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


def _theme_pool() -> list[int]:
    """The theme words the deck has no card for: the theme's own Spanish
    is all they have (a deck word reads the deck's)."""
    rows = [r for rows in _load("datas", "vocab", "theme_words.json").values() for r in rows
            if r.get("domain") == "vocab_jmdict"]
    return [sum(bool(r.get("meaning_es")) for r in rows), len(rows)]


def _radicals() -> list[int]:
    """The 214 radicals' meanings (content/radical_info.py's RADICAL_ES)."""
    with open(_path("content", "radical_info.py"), encoding="utf-8") as f:
        tree = ast.parse(f.read())
    spanish = next((node.value for node in tree.body if isinstance(node, ast.AnnAssign)
                    and getattr(node.target, "id", "") == "RADICAL_ES"), None)
    return [len(spanish.keys) if spanish is not None else 0, 214]


def banks() -> dict[str, list[int]]:
    """The other written content, each as one figure."""
    out = {
        "basics course": _pairs(_load("content", "basics.json"), [0, 0]),
        "reading bank": _module_pairs("content", "reading_sentences.py"),
        "dictation bank": _module_pairs("content", "listening_clips.py"),
        "example sentences (fixed)": _pairs(_load("datas", "vocab", "example_fixes.json"), [0, 0]),
        "example sentences (added)": _pairs(_load("datas", "vocab", "example_added.json"), [0, 0]),
        "Tatoeba sentences": [_rows("jmdict_es.sqlite3", "example"), _rows("jmdict_fr.sqlite3", "example")],
        "breakdown glosses": [a + b for a, b in zip(_module_pairs("study", "particle_glosses.py"),
                                                    _module_pairs("study", "analysis.py"))],
        "theme words (pool)": _theme_pool(),
        "radicals": _radicals(),
    }
    for name, folder in (("comprehension seeds", "comprehension"), ("conversation bank", "conversation")):
        total = [0, 0]
        for level in LEVELS:
            if os.path.exists(_path("content", folder, f"{level}.json")):
                _pairs(_load("content", folder, f"{level}.json"), total)
        out[name] = total
    return out


def report() -> dict:
    return {"vocab": vocab(), "kanji": kanji(), "grammar": grammar(), "banks": banks()}


def _pct(written: int, of: int) -> str:
    return f"{written:>6} / {of:<6} {100 * written / of:5.1f}%" if of else f"{written:>6} / {of:<6}    --"


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--json", action="store_true", help="the figures, as JSON")
    a = p.parse_args()
    figures = report()
    if a.json:
        json.dump(figures, sys.stdout, ensure_ascii=False, indent=2)
        print()
        return
    print("Spanish, written / to write (plan 291). Anything not written reads English.\n")
    print("Interface (frontend/src/locales/es): whole, held by locales.test.js\n")
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
