"""
Take the deck's words out of the JMdict pool, in place (plan 110).

    python -m scripts.prune_pool_overlap        # report: which pool rows the deck now serves
    python -m scripts.prune_pool_overlap --yes  # move their senses to curated_senses, delete the rows

Read-only without --yes. No database server, no .env: it edits
datas/vocab/vocab_jmdict.sqlite3, the tracked file, which is committed
with the deck change that made a word the deck's.

WHY IN PLACE, NOT A REBUILD
---------------------------
The pool is built as "every JMdict word NOT in the deck"
(build_jmdict_db.py), so every card the deck gains -- 母 and 父 in plan
102, the 24 of plan 105 -- sits on both sides until the pool is rebuilt,
and the dictionary shows the word on two rows. The review planned one
rebuild at the end of the wave. It cannot be done here, and should not
be done lightly anywhere: a pool row's SRS card id is its `id`, the
row's position in the export it was built from (vocab_jmdict_data.py,
CARD-ID SCHEME), so a rebuild from any other JMdict edition renumbers
every pool card a learner holds, and the export this pool came from
(JMdict 2026-07-15, vocab_meta.json) is gitignored and not on this
machine. Deleting the overlapping rows leaves every other id exactly
where it is.

WHAT MOVES WITH THE ROW
-----------------------
The deck's own words read their senses (glossary, tags, examples) from
`curated_senses`, keyed "{kanji}::{kana}" with the deck's packed kana
field, and fall back to the pool row's `senses` when there is no
curated row (vocab_extras._find_senses). A word added to the deck after
the build has no curated row and lives on that fallback: delete the
pool row alone and 母 loses its example sentences on the entry plate.
So each row's senses blob is copied to curated_senses under the deck's
key first (has_examples carried over), and only then are the entries
and senses rows deleted. `freq_rank` keeps its gaps: every reader
ranges over it with BETWEEN and counts what is there.

WHAT DOES NOT MOVE
------------------
A learner who studied the word from the pool before the deck taught it
holds a `vocab_jmdict_{id}` card that now resolves to nothing; the app
treats such a card as content that went away (routes/decks._linked_entry
returns None) rather than failing. Carrying that history onto the deck
card is a migration of its own (110b), the shape of
migrate_jmdict_card_ids.py, and is not done here.

THE THEME LISTS FOLLOW
----------------------
datas/vocab/theme_words.json names each word with the domain it lives
in, "vocab" (the deck) or "vocab_jmdict" (the pool), and content/
theme_data.py resolves a row through that domain -- a pool row whose
word the deck now teaches would resolve to nothing and vanish from its
theme (tests/test_theme_vocab.py counts the rows). So a theme row on a
pruned word is rewritten to the deck's domain in the same run, which
is also what a rebuild of the theme index would do (build_theme_db.py
puts a word in the deck's domain whenever the deck has it).

Idempotent: a second run finds nothing. tests/test_dictionary_vocab.py
holds the overlap at zero, so a deck addition that skips this script
fails there.
"""
import argparse
import json
import os
import sqlite3
import sys

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_VOCAB = os.path.join(_BASE_DIR, "datas", "vocab")
DB_PATH = os.path.join(_VOCAB, "vocab_jmdict.sqlite3")
DECK_PATH = os.path.join(_VOCAB, "vocab_deck.json")
THEME_PATH = os.path.join(_VOCAB, "theme_words.json")


def deck_readings() -> dict[tuple[str, str], str]:
    """(kanji, one reading) -> the deck's packed kana field, which is the
    curated_senses key's second half."""
    with open(DECK_PATH, encoding="utf-8") as f:
        deck = json.load(f)
    out: dict[tuple[str, str], str] = {}
    for entries in deck.values():
        for e in entries:
            kana = e.get("kana") or ""
            for reading in kana.replace(";", "/").split("/"):
                reading = reading.strip()
                if reading:
                    out.setdefault((e.get("kanji") or "", reading), kana)
    return out


def overlap(conn: sqlite3.Connection) -> list[dict]:
    """Every pool row whose (kanji, kana) the deck serves, with the
    curated key it will move to and whether that key already exists."""
    readings = deck_readings()
    rows = []
    for entry_id, kanji, kana, meaning, freq_rank, has_examples in conn.execute(
        "SELECT id, kanji, kana, meaning, freq_rank, has_examples FROM entries"
    ):
        packed = readings.get((kanji, kana))
        if packed is None:
            continue
        key = f"{kanji}::{packed}"
        curated = conn.execute("SELECT 1 FROM curated_senses WHERE key = ?", (key,)).fetchone() is not None
        rows.append({"id": entry_id, "kanji": kanji, "kana": kana, "meaning": meaning,
                     "freq_rank": freq_rank, "has_examples": has_examples,
                     "key": key, "curated": curated})
    rows.sort(key=lambda r: r["freq_rank"])
    return rows


def prune(conn: sqlite3.Connection, rows: list[dict]) -> tuple[int, int]:
    """Move, then delete. Returns (senses moved, rows deleted)."""
    moved = 0
    for r in rows:
        if not r["curated"]:
            blob = conn.execute("SELECT blob FROM senses WHERE id = ?", (r["id"],)).fetchone()
            if blob:
                conn.execute("INSERT INTO curated_senses(key, blob, has_examples) VALUES (?, ?, ?)",
                             (r["key"], blob[0], int(r["has_examples"])))
                moved += 1
        conn.execute("DELETE FROM senses WHERE id = ?", (r["id"],))
        conn.execute("DELETE FROM entries WHERE id = ?", (r["id"],))
    conn.commit()
    return moved, len(rows)


def theme_rows_to_retarget() -> list[tuple[str, dict]]:
    """(theme, row) for every theme row that names a word through the
    pool although the deck serves it."""
    readings = deck_readings()
    with open(THEME_PATH, encoding="utf-8") as f:
        themes = json.load(f)
    return [
        (theme, row)
        for theme, rows in themes.items()
        for row in rows
        if row.get("domain") == "vocab_jmdict" and (row.get("kanji") or "", row.get("kana") or "") in readings
    ]


def retarget_theme_rows() -> int:
    with open(THEME_PATH, encoding="utf-8") as f:
        themes = json.load(f)
    readings = deck_readings()
    changed = 0
    for rows in themes.values():
        for row in rows:
            if row.get("domain") == "vocab_jmdict" and (row.get("kanji") or "", row.get("kana") or "") in readings:
                row["domain"] = "vocab"
                changed += 1
    if changed:
        with open(THEME_PATH, "w", encoding="utf-8") as f:
            json.dump(themes, f, ensure_ascii=False, indent=1)
            f.write("\n")
    return changed


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--yes", action="store_true", help="apply; without it, report only")
    args = parser.parse_args(argv)
    conn = sqlite3.connect(DB_PATH)
    try:
        rows = overlap(conn)
        themed = theme_rows_to_retarget()
        if themed:
            print(f"{len(themed)} theme row(s) name a deck word through the pool:")
            for theme, row in themed:
                print(f"  {theme:16s} {row.get('kanji') or '-':8s} {row.get('kana', ''):12s} -> domain vocab")
            if args.yes:
                print(f"  {retarget_theme_rows()} rewritten")
        if not rows:
            print("the pool holds none of the deck's words; nothing to do" + ("" if args.yes or not themed else "; --yes to rewrite the theme rows"))
            return 0
        print(f"{len(rows)} pool row(s) the deck now serves:")
        for r in rows:
            fate = "senses already curated" if r["curated"] else ("senses move" if r["has_examples"] else "senses move (no examples)")
            print(f"  id {r['id']:>6}  rank {r['freq_rank']:>6}  {r['kanji'] or '-':8s} {r['kana']:12s} {r['meaning'][:32]:34s} -> {r['key']}  [{fate}]")
        if not args.yes:
            print("\nreport only; --yes to move their senses to curated_senses and delete the rows")
            return 0
        moved, deleted = prune(conn, rows)
        print(f"\n{moved} senses moved to curated_senses, {deleted} pool row(s) deleted")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
