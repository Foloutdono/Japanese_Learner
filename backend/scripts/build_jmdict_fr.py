r"""
Builds datas/vocab/jmdict_fr.sqlite3 -- the French layer over JMdict
(content/jmdict_fr.py, plan 213) -- from three JSON files, and dumps it
back to them for editing.

    senses.json      {"<english glossary, 'a; b; c'>": "<french>"}
    examples.json    {"<Tatoeba sentence>": "<french>"}
    pool_lines.json  {"<kanji>::<kana>": "<french>"}

Same arrangement as build_jmdict_db.py: the built database is the shipped
asset and the JSON is the intermediate, kept out of git
(datas/vocab/fr_source/ is ignored). To correct a line, export, edit,
rebuild:

    cd backend
    python -m scripts.build_jmdict_fr --export     # -> datas/vocab/fr_source/
    # edit the JSON
    python -m scripts.build_jmdict_fr              # -> datas/vocab/jmdict_fr.sqlite3

`--seed-themes` adds the pool words datas/vocab/theme_words.json already
glosses in French (the theme cards' meaning_fr) to pool_lines.json before
building, without overwriting a line already there.

An empty line is dropped and reported; a line identical to its English
is kept (a cognate, a cross-reference) and counted.
"""
import argparse
import json
import os
import sqlite3
import sys

from study.search_match import fold

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_VOCAB_DIR = os.path.join(_BASE_DIR, "datas", "vocab")
_OUT_PATH = os.path.join(_VOCAB_DIR, "jmdict_fr.sqlite3")
_SRC_DIR = os.path.join(_VOCAB_DIR, "fr_source")

SCHEMA = """
CREATE TABLE sense (
  en TEXT PRIMARY KEY,
  fr TEXT NOT NULL
);
CREATE TABLE example (
  jp TEXT PRIMARY KEY,
  fr TEXT NOT NULL
);
-- `fold` is `fr` lowercased and accent-stripped (study/search_match.fold),
-- so the dictionary's French search over the pool is a plain LIKE that
-- still finds « épée » for "epee", without a Python call per row.
CREATE TABLE pool_line (
  kanji TEXT NOT NULL,
  kana  TEXT NOT NULL,
  fr    TEXT NOT NULL,
  fold  TEXT NOT NULL,
  PRIMARY KEY (kanji, kana)
);
"""

FILES = ("senses.json", "examples.json", "pool_lines.json")


def _read(src: str, name: str) -> dict:
    path = os.path.join(src, name)
    if not os.path.exists(path):
        print(f"  ! {name} missing -- that table will be empty")
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _write(dst: str, name: str, data: dict) -> None:
    with open(os.path.join(dst, name), "w", encoding="utf-8") as f:
        json.dump(dict(sorted(data.items())), f, ensure_ascii=False, indent=0)
        f.write("\n")


def _clean(table: dict, label: str, same_as_key: bool) -> dict:
    """Drop empty lines. A line identical to its English key is kept --
    "fabrication; fiction; invention" is French too, and a JMdict
    cross-reference ("⟶; 鶏肉") has nothing to translate -- but counted,
    so a batch handed back untranslated shows up in the report."""
    out, empty, same = {}, [], []
    for key, fr in table.items():
        fr = (fr or "").strip()
        if not fr:
            empty.append(key)
            continue
        if same_as_key and fr == key:
            same.append(key)
        out[key] = fr
    if empty:
        print(f"  ! {label}: {len(empty)} empty, dropped, e.g. {empty[:3]}")
    if same:
        print(f"  {label}: {len(same)} identical to their English (cognates, cross-references), e.g. {same[:3]}")
    return out


def seed_themes(src: str) -> int:
    """The theme cards' French for pool words, into pool_lines.json."""
    path = os.path.join(src, "pool_lines.json")
    lines = _read(src, "pool_lines.json")
    with open(os.path.join(_VOCAB_DIR, "theme_words.json"), encoding="utf-8") as f:
        themes = json.load(f)
    added = 0
    for words in themes.values():
        for w in words:
            if w.get("domain") != "vocab_jmdict" or not w.get("meaning_fr"):
                continue
            key = f"{w.get('kanji', '')}::{w.get('kana', '')}"
            if key not in lines:
                lines[key] = w["meaning_fr"]
                added += 1
    os.makedirs(src, exist_ok=True)
    _write(src, "pool_lines.json", lines)
    print(f"  {added} theme glosses seeded into {path}")
    return added


def build(src: str, out_path: str) -> None:
    senses = _clean(_read(src, "senses.json"), "senses", True)
    examples = _clean(_read(src, "examples.json"), "examples", False)
    pool = _clean(_read(src, "pool_lines.json"), "pool_lines", False)

    pool_rows = []
    for key, fr in pool.items():
        kanji, sep, kana = key.partition("::")
        if not sep:
            print(f"  ! pool_lines: bad key {key!r} (want kanji::kana)")
            continue
        pool_rows.append((kanji, kana, fr, fold(fr)))

    tmp = out_path + ".tmp"
    if os.path.exists(tmp):
        os.remove(tmp)
    conn = sqlite3.connect(tmp)
    conn.executescript(SCHEMA)
    conn.executemany("INSERT INTO sense VALUES (?, ?)", sorted(senses.items()))
    conn.executemany("INSERT INTO example VALUES (?, ?)", sorted(examples.items()))
    conn.executemany("INSERT INTO pool_line VALUES (?, ?, ?, ?)", sorted(pool_rows))
    conn.commit()
    conn.execute("VACUUM")
    conn.close()
    os.replace(tmp, out_path)
    size = os.path.getsize(out_path) / (1024 * 1024)
    print(f"Wrote {out_path} -- {len(senses)} senses, {len(examples)} sentences, "
          f"{len(pool_rows)} pool lines, {size:.1f} MB")


def export(db_path: str, dst: str) -> None:
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    os.makedirs(dst, exist_ok=True)
    _write(dst, "senses.json", dict(conn.execute("SELECT en, fr FROM sense")))
    _write(dst, "examples.json", dict(conn.execute("SELECT jp, fr FROM example")))
    _write(dst, "pool_lines.json",
           {f"{k}::{r}": fr for k, r, fr in conn.execute("SELECT kanji, kana, fr FROM pool_line")})
    conn.close()
    print(f"Exported {db_path} to {dst}/ ({', '.join(FILES)})")


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", default=_SRC_DIR, help="folder holding the three JSON files")
    ap.add_argument("--out", default=_OUT_PATH)
    ap.add_argument("--export", action="store_true", help="dump the database to --src instead of building")
    ap.add_argument("--seed-themes", action="store_true", help="add theme_words.json's pool French first")
    args = ap.parse_args(argv)
    if args.export:
        export(args.out, args.src)
        return
    if args.seed_themes:
        seed_themes(args.src)
    build(args.src, args.out)


if __name__ == "__main__":
    sys.exit(main())
