"""
JMdict's own French for the pool's words (plan 162).

    python -m scripts.build_pool_fr path/to/JMdict.gz        # report: how many pool words it glosses
    python -m scripts.build_pool_fr path/to/JMdict.gz --yes  # write the fr_glosses table

Read-only without --yes. No database server, no .env: it adds one table
to datas/vocab/vocab_jmdict.sqlite3, the tracked file, which is
committed with it.

WHERE THE FRENCH COMES FROM
---------------------------
The pool was built from JMdict's English export (JMdict 2026-07-15,
vocab_meta.json), which carries no other language, so a word the deck
does not teach reached a French learner in English. JMdict's full
release carries French glosses too, from the same project under the
same licence (EDRDG, CC BY-SA 4.0: the credit the app already gives
JMdict covers them). Download `JMdict.gz` -- the full file, not
`JMdict_e.gz` -- from https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project
and point this script at it. The session that wrote this could not
reach edrdg.org, which is why it runs on the owner's machine.

WHY A TABLE OF ITS OWN, JOINED ON `seq`
---------------------------------------
A pool row's SRS card id is its `id`, its position in the export it was
built from (vocab_jmdict_data.py, CARD-ID SCHEME), so the pool is never
rebuilt from another edition. The French is joined on `seq`, the JMdict
sequence number, which an entry keeps from one edition to the next,
into fr_glosses(seq, gloss) beside the rows: entries and senses are not
touched, and a run is repeatable (the table is dropped and written
again). Every row of a multi-reading headword shares its seq, and so
its French.

WHAT A LINE IS
--------------
The breakdown's line for a pool word (study/card_lookup.pool_gloss): the
first gloss of each of the first senses, up to LINE_MAX characters. In
the full release the French glosses stand in senses of their own, so it
is the first French gloss of each of the first French senses.

JMdict's French covers far fewer entries than its English. A word it
does not gloss is translated once, on first sight, and cached for every
learner by study/pool_glosses.py; this table is what that never has to
buy.
"""
import argparse
import gzip
import os
import sqlite3
import sys
import xml.etree.ElementTree as ET

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(_BASE_DIR, "datas", "vocab", "vocab_jmdict.sqlite3")

# study/card_lookup._POOL_GLOSS_MAX and its sense count: the French line
# is cut where the English one is (tests/test_build_pool_fr.py holds them
# equal).
LINE_MAX = 60
SENSES = 3

_LANG = "{http://www.w3.org/XML/1998/namespace}lang"


def french_lines(stream) -> dict[int, str]:
    """{seq: French line} for every entry in the JMdict XML `stream` that
    carries a French gloss. Streamed: the full file is ~200 MB of XML."""
    lines: dict[int, str] = {}
    for _event, elem in ET.iterparse(stream, events=("end",)):
        if elem.tag != "entry":
            continue
        seq_text = elem.findtext("ent_seq")
        glosses: list[str] = []
        for sense in elem.findall("sense"):
            first = next((g.text.strip() for g in sense.findall("gloss")
                          if g.get(_LANG) == "fre" and g.text and g.text.strip()), None)
            if not first or first in glosses:
                continue
            if glosses and len("; ".join(glosses + [first])) > LINE_MAX:
                break
            glosses.append(first)
            if len(glosses) == SENSES:
                break
        if seq_text and glosses:
            lines[int(seq_text)] = "; ".join(glosses)
        elem.clear()
    return lines


def pool_seqs(conn: sqlite3.Connection) -> list[tuple[int, int]]:
    """(seq, best freq_rank) for every seq the pool holds."""
    return conn.execute("SELECT seq, MIN(freq_rank) FROM entries GROUP BY seq").fetchall()


def write_table(conn: sqlite3.Connection, lines: dict[int, str]) -> int:
    """fr_glosses written again for the pool's own seqs; returns the rows written."""
    held = {seq for seq, _rank in pool_seqs(conn)}
    rows = [(seq, gloss) for seq, gloss in lines.items() if seq in held]
    conn.execute("DROP TABLE IF EXISTS fr_glosses")
    conn.execute("CREATE TABLE fr_glosses (seq INTEGER PRIMARY KEY, gloss TEXT NOT NULL)")
    conn.executemany("INSERT INTO fr_glosses (seq, gloss) VALUES (?, ?)", sorted(rows))
    conn.commit()
    return len(rows)


def report(conn: sqlite3.Connection, lines: dict[int, str]) -> str:
    seqs = pool_seqs(conn)
    glossed = [rank for seq, rank in seqs if seq in lines]
    top = sorted(rank for _seq, rank in seqs)[:20000]
    cut = top[-1] if top else 0
    top_glossed = sum(1 for rank in glossed if rank <= cut)
    return "\n".join([
        f"JMdict entries with a French gloss: {len(lines):,}",
        f"pool headwords (seq): {len(seqs):,}, with French: {len(glossed):,}",
        f"of the 20,000 most frequent: {top_glossed:,}",
    ])


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("jmdict", help="JMdict.gz (or the unpacked XML): the full multilingual release")
    parser.add_argument("--yes", action="store_true", help="write the table; without it, report only")
    args = parser.parse_args(argv)

    opener = gzip.open if args.jmdict.endswith(".gz") else open
    with opener(args.jmdict, "rb") as stream:
        lines = french_lines(stream)

    conn = sqlite3.connect(DB_PATH)
    try:
        print(report(conn, lines))
        if not args.yes:
            print("\nReport only. Run again with --yes to write fr_glosses.")
            return 0
        written = write_table(conn, lines)
        print(f"\nfr_glosses written: {written:,} rows. Commit datas/vocab/vocab_jmdict.sqlite3.")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
