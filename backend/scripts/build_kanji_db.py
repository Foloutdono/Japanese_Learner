r"""
Builds datas/kanji/kanji.sqlite3 — every character KANJIDIC2 knows, in one
page-read database — from the JSON assets under datas/kanji/.

WHY (the same argument build_jmdict_db.py makes for the vocabulary pool):
the problem was never the JSON on disk, it is that the backend parsed it
into Python objects at import. Six modules between them held ~6.7 MB of
KANJIDIC2 in RAM — kanji_radicals.json three separate times — and two of
those loads existed only to build an index immediately restricted to the
app's own deck. A SQLite file read on demand keeps the footprint roughly
constant however large the dump gets, which is what lets the dictionary
serve all 13,108 characters instead of the deck's 2,212.

The database holds EVERY character, not just the ones outside the deck.
in_deck marks the 2,212 the app teaches. Keeping both halves in one table
is what lets radical browsing be a single indexed query in a paper-漢和辞典
order (by stroke count) rather than an in-memory merge of two sources.

Inputs (datas/kanji/, the shipped KANJIDIC2 export):
    kanji_basic.json        grade / freq / jlpt / stroke_counts / codepoints
    kanji_radicals.json     classical radical number + whole-character strokes
    kanji_readings.json     ja_on / ja_kun / nanori (and pinyin/korean/vietnam)
    kanji_meanings.json     en / fr / es / pt
    kanji_dic_refs.json     Nelson, Halpern, Heisig, ... index numbers
    kanji_query_codes.json  SKIP, SH descriptor, four-corner, De Roo
    kanji_deck.json         the app's own JLPT deck, for in_deck
    ../../kanjivg/*.svg     which characters have a stroke diagram

Those inputs become untracked once this has run (backend/.gitignore),
exactly as vocab_jmdict.json is: the built .sqlite3 is the shipped asset
and the JSON is an intermediate. To refresh from a newer KANJIDIC2, restore
the export into datas/kanji/ and re-run this script.

Usage:
    cd backend && python -m scripts.build_kanji_db [--data-dir DIR] [--out PATH]
"""
import argparse
import glob
import json
import os
import sqlite3

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DATA_DIR = os.path.join(_BASE_DIR, "datas", "kanji")
_KANJIVG_DIR = os.path.join(_BASE_DIR, "kanjivg")
_OUT_PATH = os.path.join(_DATA_DIR, "kanji.sqlite3")

LEVELS = ("N5", "N4", "N3", "N2", "N1")

SCHEMA = """
CREATE TABLE kanji (
  char          TEXT PRIMARY KEY,
  codepoint     TEXT NOT NULL,
  radical       INTEGER,
  stroke_count  INTEGER,
  grade         INTEGER,
  freq          INTEGER,
  jlpt          INTEGER,
  on_readings   TEXT NOT NULL,
  kun_readings  TEXT NOT NULL,
  readings      TEXT NOT NULL,
  nanori        TEXT NOT NULL,
  meaning_en    TEXT NOT NULL,
  meaning_fr    TEXT NOT NULL,
  meaning_es    TEXT NOT NULL,
  meaning_pt    TEXT NOT NULL,
  in_deck       INTEGER NOT NULL,
  has_svg       INTEGER NOT NULL,
  sort_rank     INTEGER NOT NULL
);
-- The pool half of the dictionary's kanji collection pages on this:
-- WHERE in_deck = 0 ORDER BY sort_rank, so paging never sorts.
CREATE INDEX idx_kanji_pool_sort ON kanji(in_deck, sort_rank);
-- Radical browsing: WHERE radical = ? ORDER BY stroke_count. The radical's
-- own stroke count is a constant within a radical, so ordering by total
-- strokes is the same order as by REMAINING strokes -- which is the order a
-- paper 漢和辞典 files under a radical, and the one routes/dictionary.py
-- already sorted for in Python.
CREATE INDEX idx_kanji_radical ON kanji(radical, stroke_count);

-- Reference data no runtime module reads today. It stays because in SQLite
-- it costs nothing until queried, and it is exactly what a "look it up by
-- SKIP code / stroke count / Heisig number" browse would need -- deleting
-- the JSON without keeping this would throw that away for a saving the
-- database does not need to make.
CREATE TABLE kanji_refs (
  char       TEXT PRIMARY KEY,
  dic_refs   TEXT NOT NULL,
  query_codes TEXT NOT NULL
);
"""


def _load(data_dir: str, name: str, default):
    path = os.path.join(data_dir, name)
    if not os.path.exists(path):
        print(f"  ! {name} missing — continuing without it")
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _packed(parts) -> str:
    """The deck's own reading format: ・-separated, on-readings before kun.

    content/kanji_readings.py's split_readings() splits that string back
    apart BY SCRIPT (katakana = on, hiragana = kun), so a pool character
    packed this way is read by exactly the same code as a deck one.
    """
    return "・".join(p for p in (parts or []) if p)


def _sort_key(char: str, basic: dict, radicals: dict):
    """The browse order for the pool half of the collection.

    kanji_frequency.json cannot supply it: that list is the app's own deck
    (2,211 characters) and says nothing about the other 10,896. So the order
    is composite, in three tiers, and the tier index is part of the key:

      0. characters KANJIDIC gives a newspaper frequency rank -- 2,501 of
         13,108 -- by that rank. The commonest character a query matches is
         the one the reader almost certainly meant, the same argument that
         made the JMdict pool sort by freq_rank rather than dump order.
      1. then jōyō and jinmeiyō (grade 1-10) by grade, then strokes: taught
         characters before untaught ones.
      2. then everything else by stroke count, then codepoint, so the tail
         is at least in a stable, guessable order rather than dump order.
    """
    info = basic.get(char) or {}
    strokes = (radicals.get(char) or {}).get("stroke_count")
    if strokes is None:
        counts = info.get("stroke_counts") or []
        strokes = counts[0] if counts else 99
    freq = info.get("freq")
    grade = info.get("grade")
    if freq:
        return (0, freq, 0, ord(char))
    if grade:
        return (1, grade, strokes, ord(char))
    return (2, strokes, 0, ord(char))


def build(data_dir: str, out_path: str, kanjivg_dir: str) -> None:
    print(f"Reading {data_dir}")
    basic     = _load(data_dir, "kanji_basic.json", {})
    radicals  = _load(data_dir, "kanji_radicals.json", {})
    readings  = _load(data_dir, "kanji_readings.json", {})
    meanings  = _load(data_dir, "kanji_meanings.json", {})
    dic_refs  = _load(data_dir, "kanji_dic_refs.json", {})
    q_codes   = _load(data_dir, "kanji_query_codes.json", {})
    deck      = _load(data_dir, "kanji_deck.json", {})

    if not basic:
        raise SystemExit("kanji_basic.json is required and was not found")

    deck_chars = {e["kanji"] for level in LEVELS for e in deck.get(level, [])}
    print(f"  {len(basic)} characters, {len(deck_chars)} of them in the deck")

    # A character has a stroke diagram if KanjiVG shipped one. Only 6,702 of
    # the 13,108 do -- the deck happens to be at 100%, which is why nothing
    # in the app has ever had to handle a missing one. Recorded here so the
    # dictionary can serve svg_url: None instead of a URL that 404s; the
    # frontend's `hasSheet` already draws the plate without a sheet (that is
    # how kana digraphs like きゃ already behave).
    have_svg = {
        os.path.basename(p)[:-4].lower()
        for p in glob.glob(os.path.join(kanjivg_dir, "*.svg"))
    }
    print(f"  {len(have_svg)} stroke diagrams on disk")

    ordered = sorted(basic, key=lambda c: _sort_key(c, basic, radicals))

    if os.path.exists(out_path):
        os.remove(out_path)
    conn = sqlite3.connect(out_path)
    conn.executescript(SCHEMA)

    rows, ref_rows = [], []
    for rank, char in enumerate(ordered):
        info = basic.get(char) or {}
        rad  = radicals.get(char) or {}
        read = readings.get(char) or {}
        mean = meanings.get(char) or {}

        codepoint = hex(ord(char))[2:].zfill(5)
        strokes = rad.get("stroke_count")
        if strokes is None:
            counts = info.get("stroke_counts") or []
            strokes = counts[0] if counts else None

        on  = _packed(read.get("ja_on"))
        kun = _packed(read.get("ja_kun"))
        rows.append((
            char,
            codepoint,
            rad.get("radical") or (info.get("radicals") or {}).get("classical"),
            strokes,
            info.get("grade"),
            info.get("freq"),
            info.get("jlpt"),
            on,
            kun,
            # The deck's single packed field, on before kun, so a pool
            # character reads exactly like a deck one downstream.
            "・".join(p for p in (on, kun) if p),
            _packed(read.get("nanori")),
            "; ".join(mean.get("en") or []),
            "; ".join(mean.get("fr") or []),
            "; ".join(mean.get("es") or []),
            "; ".join(mean.get("pt") or []),
            1 if char in deck_chars else 0,
            1 if codepoint in have_svg else 0,
            rank,
        ))
        refs = dic_refs.get(char)
        codes = q_codes.get(char)
        if refs or codes:
            ref_rows.append((
                char,
                json.dumps(refs or {}, ensure_ascii=False, separators=(",", ":")),
                json.dumps(codes or {}, ensure_ascii=False, separators=(",", ":")),
            ))

    conn.executemany(
        "INSERT INTO kanji VALUES (" + ",".join("?" * 18) + ")", rows
    )
    conn.executemany("INSERT INTO kanji_refs VALUES (?,?,?)", ref_rows)
    conn.commit()
    conn.execute("VACUUM")
    conn.close()

    size = os.path.getsize(out_path) / (1024 * 1024)
    print(f"Wrote {out_path} — {len(rows)} kanji, {len(ref_rows)} ref rows, {size:.1f} MB")

    missing = deck_chars - set(basic)
    if missing:
        print(f"  ! {len(missing)} deck characters are not in KANJIDIC2: {''.join(sorted(missing))}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--data-dir", default=_DATA_DIR)
    p.add_argument("--out", default=_OUT_PATH)
    p.add_argument("--kanjivg-dir", default=_KANJIVG_DIR)
    a = p.parse_args()
    build(a.data_dir, a.out, a.kanjivg_dir)


if __name__ == "__main__":
    main()
