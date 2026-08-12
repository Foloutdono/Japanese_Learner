"""
Shared multiple-choice distractor selection.

Every QCM card builder (kanji.py, vocab.py, frequency.py, grammar.py,
theme_vocab.py) needs the same thing: three wrong answers to sit
alongside the right one. They each used to do it inline as

    all_candidates = [w for w in pool if meaning_of(w) != correct]
    random.sample(all_candidates, 3)

which compares meanings as exact strings, and that turns out not to be
enough for the decks this app actually ships. vocab_deck.json contains
case-inconsistent duplicates — both "four" and "Four" exist as separate
N5 entries, likewise "three"/"Three", "black"/"Black",
"please"/"Please" — so a card whose answer was "four" could legitimately
offer "Four" as one of its three distractors. Two options with the same
meaning, one of them graded wrong.

Comparing on a normalised key (case-folded, whitespace-collapsed) fixes
that, and deduplicating the candidate pool by the same key additionally
stops two *distractors* from duplicating each other. The pool shrinks
only where such duplicates exist, so answer variety is unaffected in
every other case.

This is deliberately about what a *question* may offer, not about how a
meaning is displayed — the frontend normalises gloss text separately
(see components/gloss.jsx), and it's that normalisation which made the
duplicates render as byte-identical rows rather than merely near-identical
ones.
"""
import random


def meaning_key(meaning: str) -> str:
    """Normalised identity of a meaning, for "are these the same answer?".
    Case-folded and whitespace-collapsed; deliberately does NOT touch
    punctuation, since "to go, to leave" and "to go" are genuinely
    different answers."""
    return " ".join((meaning or "").split()).casefold()


def pick_distractors(candidates, meaning_of, correct_meaning: str, count: int = 3) -> list:
    """Up to `count` entries from `candidates` whose meaning differs from
    `correct_meaning` and from each other, compared via meaning_key.

    `meaning_of` maps a candidate to its meaning string (identity when the
    candidates already *are* meanings, as in grammar.py). Order within the
    returned list is random, same as the random.sample it replaces; the
    caller still appends the correct answer and shuffles.
    """
    seen = {meaning_key(correct_meaning)}
    pool = []
    for candidate in candidates:
        key = meaning_key(meaning_of(candidate))
        if key in seen:
            continue
        seen.add(key)
        pool.append(candidate)
    return random.sample(pool, min(count, len(pool)))
