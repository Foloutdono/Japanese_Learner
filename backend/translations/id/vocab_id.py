"""
The Indonesian glosses of the vocab deck (plan 312b): datas/vocab/vocab_id.json,
one line per card under its own key, "{kanji}::{kana}" (the kana alone
for a kana-only word), the key translations.fr_gloss reads first, as
vocab_es.json is (plan 302).

Never imported as a bare `id` (plan 312, the owner's pick D2): the
language's code is a key here, the module's name says what it holds.
A card with no line reads English (translations.get_meaning).
"""
import json
import os

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
_DATA_DIR = os.path.join(_BASE_DIR, "datas", "vocab")

with open(os.path.join(_DATA_DIR, "vocab_id.json"), encoding="utf-8") as f:
    VOCAB_ID: dict[str, str] = json.load(f)
