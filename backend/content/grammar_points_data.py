"""
Loads the exam generator's own grammar-point catalog from
grammar_points.json (same directory) — an original curation, NOT
derived from grammar_data.py's scraped jlptsensei.com content. See
that JSON file's own "_meta" field for the full reasoning.

Shape:
    { "N5": [{"pattern": "...", "structure": "...", "meaning": "..."}, ...],
      "N4": [...], "N3": [...], "N2": [...], "N1": [...] }

Public API mirrors kanji_data.py/vocab_data.py's own conventions
(KANJI_BY_LEVEL, get_kanji, ...) for consistency across content/.
"""
import json
import os

_BASE_DIR = os.path.dirname(__file__)

with open(os.path.join(_BASE_DIR, "grammar_points.json"), encoding="utf-8") as f:
    _RAW: dict = json.load(f)

GRAMMAR_POINTS_BY_LEVEL: dict[str, list[dict]] = {
    level: entries for level, entries in _RAW.items() if not level.startswith("_")
}


def get_grammar_points(level: str) -> list[dict]:
    return GRAMMAR_POINTS_BY_LEVEL.get(level, [])
