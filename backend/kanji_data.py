"""
Loads the app's own JLPT-leveled kanji deck (as opposed to the full
~13k-character KANJIDIC2 dump under kanjidic2/kanji_data/) from JSON
instead of hardcoding it here.

Source of truth is now kanji_deck.json, sitting next to radicals.json /
kanji_radicals.json:

    { "N5": [{"kanji": "土", "kana": "ド・ト・つち", "meaning": "soil; earth; ..."}, ...],
      "N4": [...], "N3": [...], "N2": [...], "N1": [...] }

Public API is unchanged on purpose — KANJI_BY_LEVEL, kanji_to_id,
get_kanji_string, and get_kanji all keep their old names/signatures so
card_lookup.py, dictionary.py, kanji.py, and translations.py don't need
to change at all.

The individual KANJI_N5 / KANJI_N4 / ... module-level lists from the old
hardcoded version are intentionally not recreated here — nothing outside
this module imported them directly (everything went through
KANJI_BY_LEVEL). If something elsewhere does still `from kanji_data
import KANJI_N5`, grab it as `KANJI_BY_LEVEL["N5"]` instead.
"""
import json
import os

# kanji_data.py is imported as a top-level module ("from kanji_data
# import ..."), so — unlike dictionary.py, which lives one package
# deeper and uses dirname(dirname(__file__)) — this file sits directly
# in backend/ and only needs a single dirname() to reach it.
_BASE_DIR = os.path.dirname(__file__)
_DATA_DIR = os.path.join(_BASE_DIR, "kanjidic2", "kanji_data")

with open(os.path.join(_DATA_DIR, "kanji_deck.json"), encoding="utf-8") as f:
    KANJI_BY_LEVEL: dict[str, list[dict]] = json.load(f)


def get_kanji_string(levels=("N5", "N4", "N3", "N2", "N1")) -> str:
    seen = set()
    result = []

    for level in levels:
        for entry in KANJI_BY_LEVEL.get(level, []):
            kanji = entry["kanji"]
            if kanji not in seen:
                seen.add(kanji)
                result.append(kanji)

    return "".join(result)


def kanji_to_id(kanji_entry: dict, level: str) -> str:
    return f"kanji_{level}_{kanji_entry['kanji']}"


def get_kanji(level: str) -> list[dict]:
    return KANJI_BY_LEVEL.get(level, [])