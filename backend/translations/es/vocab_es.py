"""
The Spanish glosses of the vocab deck (plan 291): datas/vocab/vocab_es.json,
one line per card under its own key, "{kanji}::{kana}" (the kana alone
for a kana-only word), the key translations.fr_gloss reads first.

Unlike vocab_fr.json it has no bare-form lines: they are what gave the
deck's homographs one shared French gloss (plan 107), and a map written
card by card has no need of them. A card with no line reads English
(translations.get_meaning), so the deck can be written a level at a time.
"""
import json
import os

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
_DATA_DIR = os.path.join(_BASE_DIR, "datas", "vocab")

with open(os.path.join(_DATA_DIR, "vocab_es.json"), encoding="utf-8") as f:
    VOCAB_ES: dict[str, str] = json.load(f)
