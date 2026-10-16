"""
回復運転 -- the day's share of the reviews owed (plan 216).

Pure functions, no database and no HTTP, beside study/daily_queue.py:
core/review_plan.py reads what they need and routes/today.py calls them.

── Why a ceiling ──────────────────────────────────────────────
The pace (core/pace.py) bounds the NEW cards a day brings; nothing
bounded the reviews. A learner back from ten days away met a gate of
four hundred cards, and since a day is cleared only on an empty gate
(plan 191) the stamp, the bonus and the ceremony stayed out of reach
for a week of runs that each ended "390 cards left". The wall, then a
partial finish every time: the learner the app most needs to keep is
the one it told, day after day, that they were behind.

A ceiling makes the gate count the day's SHARE. It is never a
rescheduling: no next_review is written, the scheduler is untouched,
and a card held back today is simply still due tomorrow, where the
share takes the next of them. Lifted, the gate is what it always was.

── What the share is ─────────────────────────────────────────
Spent: the (card, mode) pairs already reviewed today, each once -- a
card that lapsed and came back four times is one card of the share.
Exempt from the ceiling, always served:
  - a pair already reviewed today (it has spent its place; a lapse must
    come back in minutes, not tomorrow);
  - every mode of a card first met today (the pace's, not the
    ceiling's: its learning steps are the new card's own).
Of the rest, at most `cap - spent` are served, in the order rank()
gives -- the rows still in memory first.

── The order (rank) ──────────────────────────────────────────
Learning rows first: a step of minutes or hours is the most fragile
thing in the deck. Then the least overdue relative to the interval
(overdue days / interval days): a card due today on a 60-day interval
is nearly certainly still known and costs one review to keep, where a
card three weeks overdue on a 2-day interval is gone already and will
be learned again whenever it comes. Saving what can still be saved is
what makes a share of sixty worth more than sixty taken at random --
the order Anki's own backlog advice settles on ("relative
overdueness").
"""
from collections import OrderedDict
from datetime import datetime


def rank(row: dict, now: datetime) -> tuple:
    """The share's order for one due row (card_modes' next_review,
    interval_days, is_learning): learning first, then the least overdue
    for its interval."""
    if row.get("is_learning"):
        return (0, 0.0)
    overdue = max(0.0, (now - row["next_review"]).total_seconds() / 86400)
    return (1, overdue / max(1, row.get("interval_days") or 0))


def share(lanes, rows: dict, cap: int, spent: int, exempt: set, now: datetime):
    """
    The due lanes cut to the day's share. Returns (lanes, held): the
    lanes as they were, every exempt pair kept and at most `cap - spent`
    of the others, the best ranked; and how many were held back.

    `lanes` is lane key -> [raw_id] (study/daily_queue.lanes, the mode
    the key's last part); `rows` is (raw_id, mode) -> the due row it
    came from; `exempt` is the (raw_id, mode) pairs the ceiling never
    counts. Lane order and the order within a lane are kept: the share
    decides WHICH cards ride, interleave still decides in what order.
    A lane left empty is dropped, as daily_queue.drop_seen drops one.
    """
    candidates = []
    for key, ids in lanes.items():
        mode = key[-1]
        for raw_id in ids:
            pair = (raw_id, mode)
            if pair not in exempt:
                candidates.append(pair)
    left = max(0, cap - spent)
    if len(candidates) <= left:
        return lanes, 0
    far = (2, 0.0)
    candidates.sort(key=lambda pair: rank(rows[pair], now) if pair in rows else far)
    kept = set(candidates[:left])
    out: "OrderedDict[tuple, list[str]]" = OrderedDict()
    for key, ids in lanes.items():
        mode = key[-1]
        riding = [raw_id for raw_id in ids if (raw_id, mode) in exempt or (raw_id, mode) in kept]
        if riding:
            out[key] = riding
    return out, len(candidates) - left


def owed(lanes, exempt: set) -> int:
    """The reviews the ceiling would count, before it cuts: every due
    pair that is not exempt."""
    return sum(1 for key, ids in lanes.items() for raw_id in ids if (raw_id, key[-1]) not in exempt)


def spread_per_day(backlog: int, days: int, load: float, floor: int) -> int:
    """A catch-up's share: the backlog over `days`, plus a day's own load
    (what falls due each day anyway), never under `floor`."""
    return max(floor, -(-backlog // max(1, days)) + int(-(-load // 1)))
