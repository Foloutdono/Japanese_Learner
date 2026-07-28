"""
Loads the French vocab-meaning map from JSON instead of hardcoding it
here. Mirrors kanji_fr.py's migration — but unlike kanji_fr.py, this one
is NOT being retired: the JMdict dump backing vocab_entries_*.json
(JMdict_english_with_examples) is English-only, so there's no
datas-equivalent French source to fall back to for vocab. This is
purely a data-format migration (hardcoded Python -> JSON), not a source
swap.

Source of truth is now vocab_fr.json, sitting next to vocab_deck.json /
kanji_fr's replacement (kanji_meanings.json) / etc. under
datas/vocab_data/:

    { "毎月": "chaque mois", ... }

Public API is unchanged — still just VOCAB_FR — so dictionary.py and
vocab.py don't need to change.
"""
import json
import os

# translations/fr/vocab_fr.py -> backend/ is two levels up, same as
# kanji_fr.py's old path.
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
_DATA_DIR = os.path.join(_BASE_DIR, "datas", "vocab_data")

with open(os.path.join(_DATA_DIR, "vocab_fr.json"), encoding="utf-8") as f:
    VOCAB_FR: dict[str, str] = json.load(f)
