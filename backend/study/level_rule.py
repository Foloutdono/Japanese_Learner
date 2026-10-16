"""
The level rule (plan 074; the canvas's "level-rule" note).

Choosing a level -- at the boarding or in Settings › Learning -- marks
every stop behind it KNOWN: those cards start mastered, with their first
check spread evenly over the coming six weeks so no single day is
flooded. Moving up does the same for the stops crossed; moving down
deletes no history -- the cards above keep theirs and rejoin the run
when the level rises again (routes/today.py holds their lanes back
meanwhile; see daily_queue.hold_above). A stop on the way to the
learner's goal is never held: the line is the goal when it lies above
the level (daily_queue.hold_line).

An assumption is not history (plan 221). A card marked known that the
learner has never been asked about is the app's guess, and a move down
says the guess was wrong: from the new level up, those rows are given
back (SRSEngine.forget_assumed) and the cards are new again. Kept, they
stood mastered in the very deck the learner moved down to learn, and
the day's ration, which deals only cards with no row, had nothing left
to deal -- Today was empty. A check the learner misses is a new card
too, not a lapse (SRSEngine.review).

Pure arithmetic here: which stops, which cards, which mode. The rows
themselves are written by SRSEngine.seed_known, and the routes that
call it (routes/profile.py's PATCH and its preview, routes/onboarding.py's
complete) own the request.
"""
from itertools import zip_longest

from study import card_index
from study.difficulty import LEVELS
from study.modes import KANA, KANJI, VOCAB, GRAMMAR, MODES_FOR_SOURCE
from content.kana_data import SYLLABARY_SETS

# The stops a level stands behind are JLPT stops. Kana is a different
# door (the boarding's kana check, plan 075) and personal decks are
# nobody's level.
JLPT_SOURCES = (VOCAB, KANJI, GRAMMAR)

SPREAD_DAYS = 42
SPREAD_WEEKS = SPREAD_DAYS // 7


def primary_mode(source: str) -> str:
    """The mode a known card is checked in: the source's first graded
    mode (kanji → meaning, word → meaning, rule → meaning). One row per
    item, not one per drill, so a level change never floods the run with
    five kinds of check for the same word."""
    return MODES_FOR_SOURCE[source][0]


def stops_behind(level: str) -> list[str]:
    """The JLPT stops before `level`, in line order (N5 first)."""
    return list(LEVELS[:LEVELS.index(level)])


def stops_from(level: str) -> list[str]:
    """`level` and every stop above it, in line order -- where a move
    down to `level` gives the untouched assumptions back (plan 221)."""
    return list(LEVELS[LEVELS.index(level):])


def stops_between(lower: str, upper: str) -> list[str]:
    """The stops strictly above `lower`, up to and including `upper` --
    what a move down from `upper` to `lower` sets aside."""
    return list(LEVELS[LEVELS.index(lower) + 1:LEVELS.index(upper) + 1])


def known_batches(stops) -> list[tuple[str, str, list[str]]]:
    """(source, mode, raw ids) per source over `stops` -- the units
    seed_known writes, whose first checks fall in this order. An item
    the primary mode cannot serve (a kana-only word under word→meaning
    does not exist, but the filter is the registry's, not ours) is
    simply not a card.

    The stops are dealt in turn, each in deck order (plan 221): one card
    from each, then the next from each. Stop after stop, an N3 boarder's
    first three weeks of checks were all N5 and the stop they were
    likeliest to have misjudged, N4, was not asked before the fourth;
    in turn, every stop behind the level is checked from the first day,
    and study/level_fit can tell which one the learner stands on."""
    out = []
    for source in JLPT_SOURCES:
        mode = primary_mode(source)
        decks = [card_index.raw_ids(source, stop, mode) for stop in stops]
        ids = [raw for dealt in zip_longest(*decks) for raw in dealt if raw is not None]
        # Once each: two kana-only words with the same reading share an
        # id (card_index's first-wins note), and to the scheduler they
        # are one card.
        ids = list(dict.fromkeys(ids))
        if ids:
            out.append((source, mode, ids))
    return out


# ── The kana door (plan 075) ──────────────────────────────────────
# The boarding's kana check is the one question about a script rather
# than a stop: a learner who already reads hiragana, katakana or both
# has those sets marked known the same way a level marks the stops
# behind it -- one row per sign in the kana line's primary mode, first
# checks spread over the same six weeks. 'none' marks nothing; the
# syllabaries are then the first stop of the run.
KANA_KNOWN = ("hiragana", "katakana", "both", "none")

# Every set of the syllabary the answer names, kana_data's own order —
# read from that registry rather than restated here, so a set added
# there is marked known too rather than being the one page of the
# script a "yes, I read hiragana" leaves untouched.
_KANA_SETS_FOR = {
    "hiragana": SYLLABARY_SETS["hiragana"],
    "katakana": SYLLABARY_SETS["katakana"],
}
_KANA_SETS_FOR["both"] = _KANA_SETS_FOR["hiragana"] + _KANA_SETS_FOR["katakana"]
_KANA_SETS_FOR["none"] = ()


def kana_sets_for(known: str | None) -> tuple[str, ...]:
    """The kana sets a boarding answer marks known, in line order."""
    return _KANA_SETS_FOR.get(known or "none", ())


def kana_batch(known: str | None) -> tuple[str, list[str]]:
    """(mode, raw ids) for the signs `known` covers -- the unit
    seed_known writes, like known_batches above. Empty for 'none'."""
    mode = primary_mode(KANA)
    ids: list[str] = []
    for set_name in kana_sets_for(known):
        ids.extend(card_index.raw_ids(KANA, set_name, mode))
    return mode, list(dict.fromkeys(ids))


def item_batches(stops) -> list[list[str]]:
    """Every item of every source over `stops`, once each -- the unit a
    set-aside count is in (a kanji you can read and write is one kanji)."""
    return [
        ids
        for source in JLPT_SOURCES
        for stop in stops
        if (ids := card_index.item_ids(source, stop))
    ]
