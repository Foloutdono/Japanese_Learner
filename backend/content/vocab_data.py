"""
Loads the app's own JLPT-leveled vocab deck from JSON instead of
hardcoding it here. Mirrors kanji_data.py's migration exactly.

Source of truth is now vocab_deck.json, sitting next to kanji_deck.json /
radicals.json / kanji_radicals.json under datas/kanji/:

    { "N5": [{"kanji": "毎月", "kana": "まいげつ/まいつき",
               "meaning": "every month"}, ...],
      "N4": [...], "N3": [...], "N2": [...], "N1": [...] }

Public API is unchanged on purpose — VOCAB_BY_LEVEL, vocab_to_id, and
get_vocab all keep their old names/signatures so card_lookup.py,
dictionary.py, and vocab.py don't need to change at all.

NOTE: some entries' "kana" field packs multiple readings separated by
"/" (e.g. "まいげつ/まいつき"), while card_lookup.py's own
_reading_variants() splits on ";" instead. That mismatch predates this
migration — flagging here rather than silently "fixing" it, since it's
not this script's call whether to normalize the deck data or the
splitting logic.
"""
import json
import os

# vocab_data.py is imported as a top-level module ("from vocab_data
# import ..."), same as kanji_data.py — sits directly in backend/, one
# dirname() to reach it.
# One level up: this module now lives in a package, and datas/
# is still at the backend root.
_BASE_DIR = os.path.dirname(os.path.dirname(__file__))
_DATA_DIR = os.path.join(_BASE_DIR, "datas", "vocab")

with open(os.path.join(_DATA_DIR, "vocab_deck.json"), encoding="utf-8") as f:
    VOCAB_BY_LEVEL: dict[str, list[dict]] = json.load(f)


def vocab_to_id(vocab_entry: dict, level: str) -> str:
    return f"vocab_{level}_{vocab_entry['kanji']}_{vocab_entry['kana']}"


def get_vocab(level: str) -> list[dict]:
    return VOCAB_BY_LEVEL.get(level, [])