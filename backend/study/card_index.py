"""
Which section and level a stored (card_id, mode) row belongs to.

`card_modes` is a flat table: one row per (card id, mode key), with no
column saying "this is N4 kanji". Every screen that reports on progress
has to reconstruct that, and until now exactly one place did --
routes/stats.py, privately, against `study/quiz_modes.py`.

That private copy is why /api/stats reported nothing. The mode registry
moved to study/modes.py and every writer moved with it, so the database
fills with `kanji.flashcard.f2b` while the index was still keyed on
`qcm-kj-m`; the lookup missed on every single row and stats.py's
`if loc is None: continue` dropped the lot. Every bucket read
`new == total, reviews == 0` no matter how much had been studied. The
index lives here now, built from the registry itself, so a mode added to
study/modes.py is indexed rather than silently unreportable.

── Totals are REACHABLE totals ───────────────────────────────
Three modes can only draw from part of their source's deck (see
modes.eligible_for): `vocab.word_reading` skips kana-only entries
because the prompt would equal the answer, `kanji.radical` needs a
radical number, `grammar.fill_in` needs a sentence that points at its
rule uniquely. The pool filter has to be applied to the totals too, not
just to what gets served -- score word_reading out of all 8,405 vocab
when only 7,308 can ever appear and its mastery bar can never reach
100%, which reads as a stalled learner rather than a miscounted
denominator.
"""
from content.kana_data import KANA_SETS, kana_to_id
from content.vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from content.kanji_data import KANJI_BY_LEVEL, kanji_to_id
from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, grammar_to_id
from content.grammar_sentences_data import get_sentences
from content.radical_data import radical_for

from study.grammar_match import verifiable
from study.modes import (
    KANA, KANJI, VOCAB, GRAMMAR,
    GRADED_FOR_SOURCE, MODES, eligible_for,
)


def fill_ok(level: str, pattern: str) -> bool:
    """
    Whether `grammar.fill_in` can ask "which rule is at work here?" about
    this point and have exactly one right answer.

    Needs a sentence, obviously. But it also needs a pattern a sentence
    can point at UNIQUELY, and a bare particle is not one:
    「毎あさパンを食べます。」 demonstrates を, and also ます, and also the
    absence of 〜ています -- asking which rule it shows has several
    defensible answers. Same ambiguity that ruled out blanking the rule
    out of the sentence, arriving from the other direction.

    grammar_match.verifiable() already draws exactly this line for
    exactly this reason, so it is reused rather than restated.

    Lives here rather than in routes/grammar.py because the card pool and
    the stats denominator have to agree about it, and those are two
    different modules. It was defined privately in the router, so the
    index had no way to ask.
    """
    return verifiable(pattern) and bool(get_sentences(level, pattern))


def _augment(source: str, key: str, entry: dict) -> dict:
    """
    The extra facts eligible_for() asks about, which live outside the
    deck entry itself. Kept beside the index rather than in each router
    so that "can this mode serve this card" has one answer everywhere.
    """
    if source == KANJI:
        rad = radical_for(entry.get("kanji", ""))
        return {**entry, "radical": rad["number"] if rad else None}
    if source == GRAMMAR:
        return {**entry, "fill_ok": fill_ok(key, entry["pattern"])}
    return entry


# (source, deck-key, entries, id function) -- "deck key" is a set name
# for kana and a JLPT level everywhere else, which is why it is not
# called `level`.
_DECKS = (
    (KANA,    KANA_SETS,                lambda e, k: kana_to_id(e)),
    (VOCAB,   VOCAB_BY_LEVEL,           vocab_to_id),
    (KANJI,   KANJI_BY_LEVEL,           kanji_to_id),
    (GRAMMAR, GRAMMAR_POINTS_BY_LEVEL,  grammar_to_id),
)


def _build():
    """
    Computed once at import: the content universe is static, and every
    consumer wants the whole thing rather than one lookup.

    Returns:
        index:   (raw_id, mode key) -> (source, deck key)
        totals:  (source, deck key, mode key) -> reachable card count
        ids:     (source, deck key, mode key) -> [raw_id, ...] in deck order
        entries: (source, raw_id) -> the deck entry itself
    """
    index: dict[tuple[str, str], tuple[str, str]] = {}
    totals: dict[tuple[str, str, str], int] = {}
    ids: dict[tuple[str, str, str], list[str]] = {}
    entries: dict[tuple[str, str], dict] = {}

    for source, decks, to_id in _DECKS:
        for mode_key in sorted(GRADED_FOR_SOURCE[source]):
            mode = MODES[mode_key]
            for deck_key, deck_entries in decks.items():
                pool = [
                    to_id(entry, deck_key)
                    for entry in deck_entries
                    if eligible_for(mode, _augment(source, deck_key, entry))
                ]
                totals[(source, deck_key, mode_key)] = len(pool)
                ids[(source, deck_key, mode_key)] = pool
                for raw_id in pool:
                    index[(raw_id, mode_key)] = (source, deck_key)

        # The entries themselves, so a caller holding only a stored
        # card_id can rebuild the card without rescanning the deck. Stored
        # by reference, not copied.
        for deck_key, deck_entries in decks.items():
            for entry in deck_entries:
                entries[(source, to_id(entry, deck_key))] = entry

    return index, totals, ids, entries


_INDEX, _TOTALS, _IDS, _ENTRIES = _build()


def locate(raw_id: str, mode_key: str) -> tuple[str, str] | None:
    """(source, deck key) for a stored row, or None if it belongs to
    neither -- a personal card, or content removed since it was
    reviewed. Callers must handle None rather than assume."""
    return _INDEX.get((raw_id, mode_key))


def total(source: str, deck_key: str, mode_key: str) -> int:
    """How many cards this mode can ever serve from this deck."""
    return _TOTALS.get((source, deck_key, mode_key), 0)


def raw_ids(source: str, deck_key: str, mode_key: str) -> list[str]:
    """Every card this mode can serve from this deck, in deck order."""
    return _IDS.get((source, deck_key, mode_key), [])


def deck_keys(source: str) -> list[str]:
    """The levels (or kana set names) this source is divided into."""
    for src, decks, _ in _DECKS:
        if src == source:
            return list(decks)
    return []


def entry_for(source: str, raw_id: str) -> dict | None:
    """The deck entry a stored card id refers to, or None if the content
    it named is gone. Saves every caller a linear scan of the level."""
    return _ENTRIES.get((source, raw_id))
