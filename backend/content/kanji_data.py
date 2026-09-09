"""
Loads the app's own JLPT-leveled kanji deck (as opposed to the full
~13k-character KANJIDIC2 dump under datas/kanji/) from JSON
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
# One level up: this module now lives in a package, and datas/
# is still at the backend root.
_BASE_DIR = os.path.dirname(os.path.dirname(__file__))
_DATA_DIR = os.path.join(_BASE_DIR, "datas", "kanji")

with open(os.path.join(_DATA_DIR, "kanji_deck.json"), encoding="utf-8") as f:
    KANJI_BY_LEVEL: dict[str, list[dict]] = json.load(f)


LEVELS = ("N5", "N4", "N3", "N2", "N1")


def _build_deck_by_char() -> dict[str, tuple[str, dict]]:
    """char -> (native level, entry), first occurrence wins, N5 -> N1.

    The deck lists 2,235 entries over 2,212 characters: 23 sit on two
    levels, and since kanji_to_id keys on the level those really are two
    SRS cards. Anywhere that wants ONE row per character -- radical
    browsing files a character once, not once per level it was taught at
    -- needs a single answer, and the lowest level is it. Same rule
    frequency_data.py's _build_kanji_resolution already applies for the
    tier path.
    """
    resolved: dict[str, tuple[str, dict]] = {}
    for level in LEVELS:
        for entry in KANJI_BY_LEVEL.get(level, []):
            resolved.setdefault(entry["kanji"], (level, entry))
    return resolved


DECK_BY_CHAR: dict[str, tuple[str, dict]] = _build_deck_by_char()


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