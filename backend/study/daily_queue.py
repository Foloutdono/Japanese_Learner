"""
Turning a flat list of due scheduler rows into the day's session.

Pure functions, no database and no HTTP -- routes/today.py owns those.
The split is not ceremony: the ordering rules below are the difference
between a queue that feels like the day's work and one that feels like a
section session with extra steps, and they need to be testable without a
Postgres instance.
"""
from collections import OrderedDict

from study import card_index

# A lane is one (section, deck, mode) triple -- "N4 kanji writing" -- or
# one (personal deck, mode) pair. It is the unit the learner recognises
# as a thing they were studying, and the unit the round-robin below
# alternates between.
SECTION = "section"
PERSONAL = "personal"


def lanes(user_id: str, due_rows: list[dict], personal: dict) -> "OrderedDict[tuple, list[str]]":
    """
    due rows (most overdue first) -> lane key -> [raw_id, ...].

    Insertion order is preserved both ways, so the most overdue lane
    comes first and, within a lane, the most overdue card does.

    A row whose card belongs to neither the app decks nor this user's
    personal cards is DROPPED rather than guessed at: it names content
    removed since it was reviewed, and leaving it out of the count is
    honest in a way that serving a card which cannot be built is not.
    """
    out: "OrderedDict[tuple, list[str]]" = OrderedDict()
    prefix_len = len(user_id) + 1

    for row in due_rows:
        raw_id = row["card_id"][prefix_len:]
        mode = row["mode"]

        loc = card_index.locate(raw_id, mode)
        if loc is not None:
            source, deck_key = loc
            key = (SECTION, source, deck_key, mode)
        elif raw_id in personal:
            card = personal[raw_id]
            key = (PERSONAL, card["deck_id"], card["deck_name"], mode)
        else:
            continue

        out.setdefault(key, []).append(raw_id)

    return out


def drop_seen(all_lanes, skip: set) -> "OrderedDict[tuple, list[str]]":
    """
    Remove (raw_id, mode) pairs the client already holds, and any lane
    left empty by that.

    The mode is half the key on purpose. A section session has one mode
    for its whole life, so a bare id identifies a card there; this queue
    can hold the same card under two modes -- 土 as a flashcard and 土 as
    a writing prompt -- and excluding by bare id would silently drop the
    one the learner has NOT seen along with the one they have.
    """
    kept: "OrderedDict[tuple, list[str]]" = OrderedDict()
    for key, ids in all_lanes.items():
        mode = key[-1]
        remaining = [rid for rid in ids if (rid, mode) not in skip]
        if remaining:
            kept[key] = remaining
    return kept


def interleave(all_lanes, count: int) -> list[tuple]:
    """
    Round-robin across lanes, urgency-first within each. Returns
    [(lane key, raw_id), ...] of at most `count`.

    Straight next_review order would be correct and unpleasant: a session
    finished yesterday comes due as one block, so the queue would be
    forty consecutive N4 kanji writes followed by twenty vocab. Taking
    one from each lane in turn keeps the most overdue lane first while
    making the session feel like the day rather than one section of it.
    """
    out: list[tuple] = []
    cursors = {key: 0 for key in all_lanes}
    while len(out) < count:
        progressed = False
        for key, ids in all_lanes.items():
            i = cursors[key]
            if i < len(ids):
                out.append((key, ids[i]))
                cursors[key] = i + 1
                progressed = True
                if len(out) >= count:
                    break
        if not progressed:
            break
    return out


def label(key: tuple) -> dict:
    """What the queue shows above a card so the learner knows which part
    of their study it came from. A section screen has a header for this;
    a mixed queue has to carry it per card."""
    if key[0] == SECTION:
        _, source, deck_key, mode = key
        return {"kind": SECTION, "source": source, "deck": deck_key, "mode": mode}
    _, deck_id, deck_name, mode = key
    return {"kind": PERSONAL, "deck_id": deck_id, "deck_name": deck_name, "mode": mode}


def parse_exclude(exclude: str) -> set:
    """"rawid|mode,rawid|mode" -> {(rawid, mode), ...}.

    `|` separates because neither a card id nor a registry mode key can
    contain one -- ids use `_` and `:` and modes use `.`."""
    skip = set()
    for token in exclude.split(","):
        if not token:
            continue
        raw, _, mode = token.partition("|")
        skip.add((raw, mode))
    return skip
