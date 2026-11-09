"""
The course's own glosses of its two decks, by language (plan 302): the
maps translations.get_meaning reads a deck card's meaning from. English
is the deck entry's own `meaning` and has no map here.

French (plan 107, 215) covers every card. Spanish (plan 302) and
Indonesian (plan 312) are written beside it, and a card a map has no
line for reads English (translations.WRITTEN says which are whole).
"""
from content.kanji_meanings import KANJI_ES, KANJI_FR, KANJI_ID
from translations.es.vocab_es import VOCAB_ES
from translations.fr.vocab_fr import VOCAB_FR
from translations.id.vocab_id import VOCAB_ID

VOCAB_GLOSSES: dict[str, dict[str, str]] = {"fr": VOCAB_FR, "es": VOCAB_ES, "id": VOCAB_ID}
KANJI_GLOSSES: dict[str, dict[str, str]] = {"fr": KANJI_FR, "es": KANJI_ES, "id": KANJI_ID}
