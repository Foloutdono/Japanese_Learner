"""
Kanji meanings, in every language KANJIDIC2 carries (en, fr, es, pt).

Retired translations/fr/kanji_fr.py and kanji_fr.json: one source of
truth instead of two datasets that can drift out of sync.

MEMORY NOTE (2026-09): this module used to json.load the whole of
kanji_meanings.json — 10,384 characters × four languages — into
KANJI_MEANINGS at import, and then build KANJI_FR as a comprehension over
all of it. Both are gone. The data lives in datas/kanji/kanji.sqlite3
(content/kanji_pool_data.py) and is read on demand; KANJI_FR is now
resolved for the app's own deck alone, in one bounded query.

That scoping is not a loss, it is a correction. Every one of KANJI_FR's
callers passes it to translations.get_meaning() for a DECK entry
(routes/kanji.py, decks.py, frequency.py, dictionary.py's deck branch),
and routes/translations.py — which ships the map to the client — already
built its ENGLISH counterpart from KANJI_BY_LEVEL alone. The French map
was the odd one out at four times the size, for characters the client had
no way to ask about. The dictionary's pool half gets its French straight
from the database row instead (kanji_pool_data.meaning_of).

CAVEAT (see get_meaning()'s fallback-to-English behaviour): KANJIDIC2's
French coverage is thinner than the old hand-maintained kanji_fr.json
was. 219 of the deck's 2,212 characters (mostly obscure/name-use ones
like 蒼, 聡, 鴻, 蓮, 那, 也) have no "fr" entry at all, vs. 25 missing
under the old list — so those cards render their English meaning. English
coverage is KANJIDIC2's primary field. Outside the deck it is thinner
still: 73 of the 10,896 pool characters have a French meaning.
"""
import content.kanji_pool_data as _db
from content.kanji_data import DECK_BY_CHAR


def get_kanji_meaning(kanji: str, lang: str = "en") -> str:
    """
    Semicolon-joined meaning string for one kanji + language, e.g.
    "earth; soil; ground; Turkey" — matching the format kanji_data.py's
    own "meaning" field already uses.

    Falls back to English if the requested language has no entries for
    this kanji, then to "" if the kanji isn't in KANJIDIC2 at all —
    shouldn't happen for anything in the app's own deck (checked: 0
    missing), but nothing else in this codebase guesses when data's
    absent, so this doesn't either.
    """
    row = _db.get(kanji)
    return _db.meaning_of(row, lang) if row else ""


# The deck's French meanings, one query at import. Same shape the old
# comprehension produced — {char: "a; b; c"}, absent where KANJIDIC2 has
# no French — so translations.get_meaning()'s fallback still fires for
# the 219 gaps exactly as before.
KANJI_FR: dict[str, str] = _db.meanings_for(DECK_BY_CHAR, "fr")
