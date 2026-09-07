"""
The level rule (plan 074; the canvas's "level-rule" note).

Choosing a level -- at the boarding or in Settings › Learning -- marks
every stop behind it KNOWN: those cards start mastered, with their first
check spread evenly over the coming six weeks so no single day is
flooded. Moving up does the same for the stops crossed; moving down
deletes nothing -- the cards above keep their history and rejoin the
run when the level rises again (routes/today.py holds their lanes back
meanwhile; see daily_queue.hold_above).

Pure arithmetic here: which stops, which cards, which mode. The rows
themselves are written by SRSEngine.seed_known, and the routes that
call it (routes/profile.py's PATCH and its preview, routes/onboarding.py's
complete) own the request.
"""
from study import card_index
from study.difficulty import LEVELS
from study.modes import KANJI, VOCAB, GRAMMAR, MODES_FOR_SOURCE

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


def stops_between(lower: str, upper: str) -> list[str]:
    """The stops strictly above `lower`, up to and including `upper` --
    what a move down from `upper` to `lower` sets aside."""
    return list(LEVELS[LEVELS.index(lower) + 1:LEVELS.index(upper) + 1])


def known_batches(stops) -> list[tuple[str, str, list[str]]]:
    """(source, mode, raw ids) per source over `stops`, in deck order --
    the units seed_known writes. An item the primary mode cannot serve
    (a kana-only word under word→meaning does not exist, but the filter
    is the registry's, not ours) is simply not a card."""
    out = []
    for source in JLPT_SOURCES:
        mode = primary_mode(source)
        ids: list[str] = []
        for stop in stops:
            ids.extend(card_index.raw_ids(source, stop, mode))
        # Once each: two kana-only words with the same reading share an
        # id (card_index's first-wins note), and to the scheduler they
        # are one card.
        ids = list(dict.fromkeys(ids))
        if ids:
            out.append((source, mode, ids))
    return out


def item_batches(stops) -> list[list[str]]:
    """Every item of every source over `stops`, once each -- the unit a
    set-aside count is in (a kanji you can read and write is one kanji)."""
    return [
        ids
        for source in JLPT_SOURCES
        for stop in stops
        if (ids := card_index.item_ids(source, stop))
    ]
