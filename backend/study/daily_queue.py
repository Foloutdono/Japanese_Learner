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
from study.difficulty import LEVELS

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


# ── Addressing a lane ─────────────────────────────────────────
# The learner can choose which lanes to run (see routes/today.py), so a
# lane needs a name the client can hand back. Composed rather than
# hashed: a request carrying `s~kanji~N5~kanji.write_kanji` says what it
# asked for in the server log, which an opaque digest would not.
#
# `~` separates because no component can contain one -- a source and a
# mode key come from the registry, a deck key is a JLPT level or a kana
# set slug, and a personal lane is addressed by its numeric deck id
# rather than by the deck's NAME, which the user is free to type
# anything into.
LANE_SEP = "~"


def lane_id(key: tuple) -> str:
    if key[0] == SECTION:
        _, source, deck_key, mode = key
        return LANE_SEP.join(("s", source, deck_key, mode))
    _, deck_id, _name, mode = key
    return LANE_SEP.join(("p", str(deck_id), mode))


def parse_lane_ids(raw: str) -> set:
    """"a,b,c" -> {a, b, c}. Empty means "no filter", which is the whole
    queue -- NOT "nothing", since a session started without a choice has
    to run everything."""
    return {part for part in raw.split(",") if part}


def keep_lanes(all_lanes, wanted: set):
    """Restrict to the chosen lanes. An empty `wanted` keeps everything.

    A wanted id matching no lane is ignored rather than an error: the
    lane may simply have been cleared since the picker was rendered, and
    failing the request over that would end a session the learner is
    halfway through.
    """
    if not wanted:
        return all_lanes
    kept = OrderedDict()
    for key, ids in all_lanes.items():
        if lane_id(key) in wanted:
            kept[key] = ids
    return kept


# ── 区間 — a run of a chosen length (plan 135) ──────────────────
# The gate can send a run of 20, 50 or 100 rather than the whole day.
# It splits the length over the chosen lanes the way interleave() deals
# (domain/lanes.js's splitTake, round-robin in the queue's order) and
# the run hands back, per batch, what each lane still owes it:
# `quota=<lane id>:<n>,...`, less what the run has already answered or
# holds. The server stays stateless -- it keeps those lanes and cuts
# each to its figure, so the run ends when the split is served.
def parse_quota(raw: str) -> dict:
    """"a:3,b:0" -> {"a": 3, "b": 0}. A malformed part is skipped: a lane
    id never contains ':', so the figure is what follows the last one."""
    out = {}
    for part in raw.split(","):
        lane, sep, n = part.rpartition(":")
        if not sep or not lane:
            continue
        try:
            out[lane] = max(0, int(n))
        except ValueError:
            continue
    return out


def keep_quota(all_lanes, quota: dict):
    """Keep the lanes the quota names, each cut to its figure, urgency
    order kept; a lane at zero drops out, and so does a lane the quota
    does not name."""
    kept = OrderedDict()
    for key, ids in all_lanes.items():
        n = quota.get(lane_id(key), 0)
        if n > 0 and ids:
            kept[key] = ids[:n]
    return kept


def keep_card(all_lanes, raw_id: str):
    """Restrict the queue to ONE card -- every lane it is due in, and
    nothing else.

    What the dictionary's "review this card" boards (routes/today.py's
    `only`). A card due under two modes stays two entries, because
    clearing it means answering both; a lane that does not hold it drops
    out entirely, and an id nothing holds yields an empty queue, which
    the run reports as "nothing due" rather than as an error.

    Deliberately NOT filtered by lane choice or by the level rule: those
    shape what a mixed day serves, and this is not a day -- it is the
    one card the learner is looking at. See routes/today.get_today_cards.
    """
    kept = OrderedDict()
    for key, ids in all_lanes.items():
        if raw_id in ids:
            kept[key] = [raw_id]
    return kept


def hold_above(all_lanes, level):
    """Hold back the section lanes of JLPT stops beyond the learner's
    level. A move down sets those cards aside rather than deleting them
    (the level rule, plan 074), and "set aside" means their reviews wait
    until the level rises again -- the run shrinks to the stops the
    learner stands on or behind. Kana sets, personal decks and a lane
    whose deck key is no level pass through; so does everything when the
    level is unknown (never onboarded), because holding back on a guess
    would hide a review that is genuinely due.

    The caller passes hold_line(level, goal), not the bare level: a stop
    on the way to the learner's goal is not set aside.
    """
    if level not in LEVELS:
        return all_lanes
    cut = LEVELS.index(level)
    kept: "OrderedDict[tuple, list[str]]" = OrderedDict()
    for key, ids in all_lanes.items():
        if key[0] == SECTION and key[2] in LEVELS and LEVELS.index(key[2]) > cut:
            continue
        kept[key] = ids
    return kept


def hold_line(level, goal):
    """The highest stop whose reviews the day serves: the learner's
    level, or their goal when it lies further up the line.

    The level alone was the line once, and it hid real work. The Learn
    gate marks the level as a landmark, never a lock (ADR 0005), so an
    N5 learner riding to N3 opens N4 kanji on purpose -- and their
    reviews then came due in the dictionary while Today held them back
    for as long as the level stayed N5. A stop between the level and
    the goal is on the learner's own route; only a stop past both is
    set aside. No goal ("just ride"), or the kana stop, leaves the
    level as the line.
    """
    if goal in LEVELS and level in LEVELS and LEVELS.index(goal) > LEVELS.index(level):
        return goal
    return level


def label(key: tuple) -> dict:
    """What the queue shows above a card so the learner knows which part
    of their study it came from. A section screen has a header for this;
    a mixed queue has to carry it per card."""
    if key[0] == SECTION:
        _, source, deck_key, mode = key
        return {"id": lane_id(key), "kind": SECTION, "source": source,
                "deck": deck_key, "mode": mode}
    _, deck_id, deck_name, mode = key
    return {"id": lane_id(key), "kind": PERSONAL, "deck_id": deck_id,
            "deck_name": deck_name, "mode": mode}


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


# ── 新規 — the day's ration of new cards (plan 098, owner-directed) ──
# The queue served reviews only, by its own documented design (see
# routes/today.py's header), which left a learner who had just boarded
# on an empty gate: nothing is due on day one, and nothing becomes due
# until a line is opened from 教材. The owner asked for the queue to
# carry the day's new cards too -- as many as the pace allows and no
# more, so the queue still ENDS (the objection the reviews-only rule
# was guarding against) and the pace is the thing that ends it.
#
# The ration is spent kana first: a learner who does not yet read a
# script is handed the signs before any word written in them, one set
# at a time in the syllabary's own order (the level rule calls the
# syllabaries the first stop of the run). What is left of the ration
# after the kana round-robins across the lines the learner chose to
# ride, so the first day at N4 is a word, a kanji, a rule, a word...
# rather than the whole ration from one deck.

# 基礎 (plan 186e): an N5 learner rides the basics course
# (study/basics.py) before the rest of the level. The basic hiragana come
# first and whole, since the course's words are read in them; then the
# course, unit by unit, with the other kana sets (the combinations and
# katakana, which a few loanwords need) dealt one card in every
# KANA_EVERY beside it rather than all before it -- 238 signs at ten a
# day was over three weeks without a word.
FIRST_KANA_SET = "hiragana_basic"
KANA_EVERY = 3

# 文法の日割り — the rules a day opens (plan 222). A rule never met opens
# on its tour (components/study/GrammarTour.jsx, plan 187): minutes of
# sentences, twists, a scene and a quiz where a new word takes seconds.
# The ration once dealt the basics' three first rules on a learner's
# first run, the first of them before anything else, and the learners
# who left on their third card left at the second lesson. So the ration
# opens at most GRAMMAR_PER_DAY rules a day, none until the learner has
# a day of study behind them (the rest of the app is met first, and the
# rules wait in the grammar line for anyone who goes looking), and its
# rules come after the other new cards, so no run opens on a lesson.
# The cap is the day's ration's, the queue that is dealt to the learner:
# a grammar run or a basics unit boarded on purpose is not held to it.
GRAMMAR = "grammar"
GRAMMAR_PER_DAY = 2
# The other cards a run deals before its first new rule, and between two
# (space_rules): a lesson, a few quick cards, the next lesson.
RULE_GAP = 3


def space_rules(order: list[tuple], new_rules: set) -> list[tuple]:
    """A batch's (lane key, raw id) order with its never-met rules
    (`new_rules`, raw ids) dealt one after every RULE_GAP other cards,
    the rest in their order; rules left over when the others run out
    close the batch. The same cards, in another order: the gate's count
    and the batch's membership are untouched. A rule that is due, a
    review, is not a lesson and keeps its place."""
    rules = [item for item in order if _is_rule(item[0]) and item[1] in new_rules]
    if not rules:
        return order
    others = [item for item in order if not (_is_rule(item[0]) and item[1] in new_rules)]
    out: list[tuple] = []
    for n, item in enumerate(others, start=1):
        out.append(item)
        if rules and n % RULE_GAP == 0:
            out.append(rules.pop(0))
    return out + rules


def grammar_allowance(studied_before: bool, opened_today: int) -> int:
    """How many never-met rules the ration may still open on a day:
    none on the learner's first day of study (`studied_before` false),
    else GRAMMAR_PER_DAY less the rules already met that day."""
    if not studied_before:
        return 0
    return max(0, GRAMMAR_PER_DAY - opened_today)


def _is_rule(key: tuple) -> bool:
    return key[0] == SECTION and key[1] == GRAMMAR


def _cap_rules(line_lanes, allowance: int | None) -> "OrderedDict[tuple, list[str]]":
    """The line lanes with at most `allowance` rules among them, the
    first ones in each grammar lane's order; a lane left empty drops."""
    if allowance is None:
        return line_lanes
    left = max(0, allowance)
    out: "OrderedDict[tuple, list[str]]" = OrderedDict()
    for key, ids in line_lanes.items():
        if _is_rule(key):
            ids = ids[:left]
            left -= len(ids)
        if ids:
            out[key] = ids
    return out


def _rules_last(lanes_out) -> "OrderedDict[tuple, list[str]]":
    """The ration's lanes with the grammar lanes moved after the others,
    so the round-robin (interleave) never deals a new rule first while
    anything else is new today."""
    return OrderedDict(
        [(key, ids) for key, ids in lanes_out.items() if not _is_rule(key)]
        + [(key, ids) for key, ids in lanes_out.items() if _is_rule(key)]
    )


def ration(kana_lanes, line_lanes, budget: int, course=None,
           grammar: int | None = None, extra=None) -> "OrderedDict[tuple, list[str]]":
    """
    kana lane -> new ids (set order), line lane -> new ids -> the lanes
    of new cards the run may introduce today, at most `budget` cards.
    Kana sequentially, then the lines in turn; a lane with nothing
    left simply drops out.

    `course`, for a learner riding the basics, is the course's cards
    not yet met as (lane key, raw id) in the order it deals them, and
    `line_lanes` must then hold none of them: the basic hiragana first,
    then the course with the other kana one in KANA_EVERY, then the
    lines in turn once both run dry.

    `grammar` is how many never-met rules may be among them
    (grammar_allowance; None for no cap). A rule past it is not dealt
    and its place goes to the next card; the rules dealt come in the
    lanes after every other (plan 222).

    `extra` is the lanes of the modes the learner added to Today (plan
    273), each the cards its line's main mode has taught. Each takes a
    turn beside the rest of the ration, as one more lane of a round
    robin (share_extras), so a course or a script being learned does not
    keep them off the day.
    """
    if extra:
        full = ration(kana_lanes, line_lanes, budget, course, grammar)
        main, extras = share_extras(sum(len(ids) for ids in full.values()), extra, budget)
        out = ration(kana_lanes, line_lanes, main, course, grammar)
        for key, ids in extras.items():
            out.setdefault(key, []).extend(ids)
        return _rules_last(out)
    if course is not None:
        return _rules_last(_ration_course(kana_lanes, line_lanes, budget, course, grammar))
    out: "OrderedDict[tuple, list[str]]" = OrderedDict()
    left = max(0, budget)
    for key, ids in kana_lanes.items():
        if left <= 0:
            break
        take = ids[:left]
        if take:
            out[key] = take
            left -= len(take)
    line_lanes = _cap_rules(line_lanes, grammar)
    if left > 0 and line_lanes:
        for key, raw_id in interleave(line_lanes, left):
            out.setdefault(key, []).append(raw_id)
    return _rules_last(out)


def share_extras(main: int, extra_lanes, budget: int) -> tuple[int, "OrderedDict[tuple, list[str]]"]:
    """`budget` dealt round-robin between the rest of the ration, as one
    lane of `main` cards, and the added modes' lanes (plan 273). Returns
    how many the rest keeps and the added lanes' cards. What the rest
    deals is a prefix of what it would deal alone (kana in order, the
    lines in their round robin, the course in its order), so a smaller
    budget keeps its first cards."""
    lanes = OrderedDict([(None, [None] * max(0, main))])
    lanes.update(extra_lanes)
    out: "OrderedDict[tuple, list[str]]" = OrderedDict()
    kept = 0
    for key, raw_id in interleave(lanes, max(0, budget)):
        if key is None:
            kept += 1
        else:
            out.setdefault(key, []).append(raw_id)
    return kept, out


def _ration_course(kana_lanes, line_lanes, budget: int, course,
                   grammar: int | None = None) -> "OrderedDict[tuple, list[str]]":
    out: "OrderedDict[tuple, list[str]]" = OrderedDict()
    left = max(0, budget)
    for key, ids in kana_lanes.items():
        if key[2] == FIRST_KANA_SET and left > 0:
            take = ids[:left]
            if take:
                out[key] = list(take)
                left -= len(take)
    if left <= 0:
        return out
    kana = [(key, raw_id) for key, ids in kana_lanes.items() if key[2] != FIRST_KANA_SET for raw_id in ids]
    # The course's rules past the day's allowance wait for a later day,
    # in their place; the unit's words and kanji go on being dealt.
    rules = None if grammar is None else max(0, grammar)
    queue = []
    for key, raw_id in course:
        if rules is not None and _is_rule(key):
            if rules <= 0:
                continue
            rules -= 1
        queue.append((key, raw_id))
    dealt = 0
    while left > 0 and (queue or kana):
        dealt += 1
        if kana and (dealt % KANA_EVERY == 0 or not queue):
            key, raw_id = kana.pop(0)
        else:
            key, raw_id = queue.pop(0)
        out.setdefault(key, []).append(raw_id)
        left -= 1
    if left > 0 and line_lanes:
        # What the course left of the allowance, for the line's own rules.
        spent = sum(len(ids) for key, ids in out.items() if _is_rule(key))
        line_lanes = _cap_rules(line_lanes, None if grammar is None else grammar - spent)
        for key, raw_id in interleave(line_lanes, left):
            out.setdefault(key, []).append(raw_id)
    return out


def merge_new(due_lanes, new_lanes):
    """
    The day's lanes with the ration added: a lane the learner already
    owes reviews in takes its new cards AFTER the due ones (urgency
    first, then the new), and a lane with nothing due is appended.
    Returns (lanes, new counts by lane key) so a label can print the
    two figures apart.
    """
    merged: "OrderedDict[tuple, list[str]]" = OrderedDict((k, list(v)) for k, v in due_lanes.items())
    counts: dict[tuple, int] = {}
    for key, ids in new_lanes.items():
        fresh = [rid for rid in ids if rid not in merged.get(key, ())]
        if not fresh:
            continue
        merged.setdefault(key, []).extend(fresh)
        counts[key] = len(fresh)
    return merged, counts
