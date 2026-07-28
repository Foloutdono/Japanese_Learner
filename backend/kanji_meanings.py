"""
Retires translations/fr/kanji_fr.py and kanji_fr.json entirely.

Kanji meanings (all languages KANJIDIC2 carries — en, fr, es, pt) now
come straight from kanji_meanings.json (kanjidic2/kanji_data/), the same
KANJIDIC2 dump already backing kanji_data.py's radical lookups, instead
of a separately hand-maintained French list. One source of truth instead
of two datasets that can drift out of sync.

    kanji_meanings.json shape:
      { "土": {"en": ["earth", "soil", "ground", "Turkey"], "fr": [...]},
        ... }

KANJI_FR below is a drop-in replacement for the old hardcoded
translations/fr/kanji_fr.py's KANJI_FR: same shape (kanji -> single
semicolon-joined string, matching the format kanji_data.py's own
"meaning" field already uses), just computed from KANJIDIC2 instead of
duplicated by hand. dictionary.py, kanji.py, and translations.py only
need their import line changed, nothing else — get_meaning() in
translations/__init__.py is untouched.

CAVEAT (see get_meaning()'s fallback-to-English behavior): KANJIDIC2's
French coverage is thinner than the old kanji_fr.json was. 220 of the
app's 2211 deck kanji (mostly obscure/name-use characters like 蒼, 聡,
鴻, 蓮, 那, 也) have no "fr" entries in KANJIDIC2 at all, vs. 25 missing
under the old hand-maintained list — so more cards will silently render
their English meaning instead of French now. English coverage is
complete (KANJIDIC2's primary field), so this only affects lang="fr".
"""
import json
import os

_BASE_DIR = os.path.dirname(__file__)
_DATA_DIR = os.path.join(_BASE_DIR, "kanjidic2", "kanji_data")

with open(os.path.join(_DATA_DIR, "kanji_meanings.json"), encoding="utf-8") as f:
    KANJI_MEANINGS: dict[str, dict[str, list[str]]] = json.load(f)


def get_kanji_meaning(kanji: str, lang: str = "en") -> str:
    """
    Semicolon-joined meaning string for one kanji + language, e.g.
    "earth; soil; ground; Turkey" — matching the format kanji_data.py's
    own "meaning" field already uses.

    Falls back to English if the requested language has no entries for
    this kanji (see the module docstring's coverage caveat for French),
    then to "" if the kanji isn't in KANJIDIC2 at all — shouldn't happen
    for anything in the app's own deck (checked: 0 missing), but nothing
    else in this codebase guesses when data's absent, so this doesn't
    either.
    """
    langs = KANJI_MEANINGS.get(kanji, {})
    meanings = langs.get(lang) or langs.get("en") or []
    return "; ".join(meanings)


KANJI_FR: dict[str, str] = {
    char: "; ".join(langs["fr"])
    for char, langs in KANJI_MEANINGS.items()
    if langs.get("fr")
}
