"""
Loads the full-JMdict vocabulary pool — every JMdict term/reading pair
NOT already covered by the app's own curated JLPT deck (vocab_data.py)
— built offline by build_vocab_jmdict.py from the raw JMdict-yomitan
"JMdict_english_with_examples" term banks.

Source file sits next to vocab_deck.json under datas/vocab/:

    vocab_jmdict.json — flat list of {"kanji", "kana", "meaning", "seq"}
        Same shape as a vocab_deck.json entry (plus "seq", the term's
        JMdict sequence number, used below for a stable id) so it
        slots into every existing "entry" code path — QCM distractor
        generation, InfoRow display, etc. — with zero changes there.
        292,848 entries as of the 2026-07-30 JMdict release; ~117MB
        combined with its companion vocab_jmdict_meanings.json (see
        vocab_extras.py) and vocab_jmdict_frequency.json (see
        frequency_data.py) — sizable, but well within what a Python
        process comfortably holds resident.

This pool is deliberately NOT folded into VOCAB_BY_LEVEL / the JLPT
study flow — these words have no JLPT level, and mixing them into
N5-N1 decks would make "study N5" start pulling in obscure vocabulary
a beginner has no business seeing yet. Instead it's surfaced two other
ways:
  - dictionary.py, for lookup/browsing (category="jmdict")
  - frequency_data.py, for actual study — via its own dedicated
    "vocab_jmdict" frequency-tier domain, entirely separate from the
    "vocab" domain's JLPT-deck tiers, so a card reviewed here can never
    collide with (or get miscounted as) a JLPT deck card.
"""
import json
import os

_BASE_DIR = os.path.dirname(__file__)
_DATA_DIR = os.path.join(_BASE_DIR, "datas", "vocab")

with open(os.path.join(_DATA_DIR, "vocab_jmdict.json"), encoding="utf-8") as f:
    VOCAB_JMDICT: list[dict] = json.load(f)


def vocab_jmdict_key(entry: dict) -> str:
    """Same "<kanji>::<kana>" shape vocab_extras.py's _find_senses()
    already looks senses up by — keeps the two modules' notion of a
    vocab entry's identity in sync without either importing the other."""
    return f"{entry.get('kanji', '')}::{entry.get('kana', '')}"


def vocab_jmdict_to_id(entry: dict, _level: str | None = None) -> str:
    """Deliberately a different id *shape* from vocab_to_id's
    "vocab_{level}_{kanji}_{kana}" (this is "vocab_jmdict_{seq}") —
    guarantees no collision with any existing JLPT-deck card id, current
    or future, without having to cross-check against the deck at
    lookup time. Takes (and ignores) a `level` positional argument
    purely so it has the same call shape as kanji_to_id/vocab_to_id —
    frequency_data.py's _DOMAIN_TO_ID calls whichever id function
    uniformly as `fn(entry, level)`, and these entries simply have no
    level to pass.
    """
    return f"vocab_jmdict_{entry['seq']}"
