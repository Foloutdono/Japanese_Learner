"""
Migrates vocab_meanings.json (curated deck's own JMdict senses — see
vocab_extras.py's docstring) out of process memory, the same move
vocab_jmdict_data.py already made for the much bigger JMdict pool.

vocab_meanings.json is "only" 3.5 MB on disk, but vocab_jmdict_data.py's
own docstring already flags why that understates the runtime cost:
once parsed into real Python dict/list/str objects (per-field overhead
on every key, every sense, every tag, every example sentence, for
~8,400 curated words), the in-memory structure runs several times
heavier than the file. vocab_extras.py then builds a second derived
structure (_MEANINGS_READING, via _build_meanings_readings()) by
iterating the whole thing again at import time — so today this is at
minimum two full in-memory copies of the same data, permanently
resident, on every worker process.

This script adds one more small table to the SAME sqlite database
frequency_data.py's vocab_jmdict domain and theme_data.py already
query (datas/vocab/vocab_jmdict.sqlite3) — no new file, no new
connection-pool code needed anywhere:

    curated_senses(key TEXT PRIMARY KEY, blob TEXT)

keyed exactly like vocab_meanings.json itself ("<kanji>::<kana>"), blob
being the same JSON-encoded sense list vocab_extras.py already parses
per lookup — so a callsite migration is a query instead of a dict
`.get()`, same shape swap vocab_jmdict_data.get_senses() already does
for the JMdict-pool half of vocab_extras.py. See
vocab_meanings_data.py for the drop-in accessor.

Run offline: `python build_curated_senses_db.py`. Safe to re-run.
"""
import json
import os
import sqlite3

# Same layout as build_theme_db.py / build_jmdict_db.py — this script
# lives in backend/scripts/, datas/ sits next to scripts/ under
# backend/, so this needs dirname() twice.
_BASE_DIR = os.path.dirname(os.path.dirname(__file__))
_VOCAB_DIR = os.path.join(_BASE_DIR, "datas", "vocab")
_DB_PATH = os.path.join(_VOCAB_DIR, "vocab_jmdict.sqlite3")
_MEANINGS_JSON = os.path.join(_VOCAB_DIR, "vocab_meanings.json")


def build():
    with open(_MEANINGS_JSON, encoding="utf-8") as f:
        meanings: dict[str, list[dict]] = json.load(f)

    conn = sqlite3.connect(_DB_PATH)
    conn.execute("DROP TABLE IF EXISTS curated_senses")
    conn.execute(
        "CREATE TABLE curated_senses ("
        " key TEXT PRIMARY KEY,"
        " blob TEXT NOT NULL,"
        " has_examples INTEGER NOT NULL DEFAULT 0"
        ")"
    )
    conn.executemany(
        "INSERT INTO curated_senses VALUES (?,?,?)",
        (
            (
                key,
                json.dumps(senses, ensure_ascii=False),
                int(any(s.get("examples") for s in senses)),
            )
            for key, senses in meanings.items()
        ),
    )
    # has_examples backs vocab_extras.py's has_examples()/
    # _build_deck_words_with_examples — precomputed here so that check
    # is an indexed lookup instead of decoding every sense blob at
    # import time just to test for a non-empty "examples" list.
    conn.execute("CREATE INDEX idx_curated_senses_has_examples ON curated_senses(has_examples)")
    conn.commit()
    conn.close()
    return len(meanings)


if __name__ == "__main__":
    n = build()
    print(f"curated_senses: {n} keys migrated")
