"""
The course's own glosses of its two decks, by language (plan 291): the
maps translations.get_meaning reads a deck card's meaning from. English
is the deck entry's own `meaning` and has no map here.

French (plan 107, 215) covers every card. Spanish is written beside it
and may be partial: a card it has no line for reads English.
"""
from content.kanji_meanings import KANJI_ES, KANJI_FR
from translations.es.vocab_es import VOCAB_ES
from translations.fr.vocab_fr import VOCAB_FR

VOCAB_GLOSSES: dict[str, dict[str, str]] = {"fr": VOCAB_FR, "es": VOCAB_ES}
KANJI_GLOSSES: dict[str, dict[str, str]] = {"fr": KANJI_FR, "es": KANJI_ES}
