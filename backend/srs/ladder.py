"""
The grammar ladder as a step machine (plan 194).

Plan 187e read a ladder card's exercise from its progress; the owner
asked for a fixed walk instead. After the tutorial a point climbs

    Choisir ×3        now, 10 min, 1 h          the point blanked, its rivals as choices
    Construire ×4     1 d, 2 d, 4 d, 8 d        the translation given, the point typed
    Maîtrisé          21 d, then growing        the flashcard and Construire in turn

A pass (quality ≥ 3) climbs one step; a miss keeps the step, asked again
in MISS_WAIT with another sentence. A miss once mastered is a relapse:
one Choisir, one Construire, and the point is mastered again.

The walk is kept in the card's own `card_modes` row, so nothing beside
it has to be read, written or erased: `learning_step` holds the step
(STEPS below), and `is_learning` / `interval_days` are set so that
`srs._progress` and `_classify_stage` read the walk the way they read
every other card -- the Choisir steps fill the first half of the bar,
Construire's waits the second, mastered at 21 days. One progress number
(CLAUDE.md): the bar is the scheduler's, never a second curve.

A row written before this plan (the progress ladder, or a row seeded from
another mode by scripts/migrate_grammar_ladder.py) is read onto the walk
by step_of from the same fields, so no migration is needed.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from .models import CardState
from .scheduler import MAX_INTERVAL_DAYS, Scheduler, clamp_quality

LADDER_MODE = "grammar.ladder"

# The steps, as `learning_step` stores them.
PICK = (0, 1, 2)            # Choisir 1–3
BUILD = (3, 4, 5, 6)        # Construire 1–4
MASTERED = 7
RELAPSE_PICK = 8            # Choisir, once, after a miss when mastered
RELAPSE_BUILD = 9           # then Construire, once

PASS_QUALITY = 3
MISS_WAIT = timedelta(minutes=10)
MASTERED_DAYS = 21

# The wait before each step, once the step before it is passed.
_WAIT = {
    1: timedelta(minutes=10),
    2: timedelta(hours=1),
    3: timedelta(days=1),
    4: timedelta(days=2),
    5: timedelta(days=4),
    6: timedelta(days=8),
    MASTERED: timedelta(days=MASTERED_DAYS),
    RELAPSE_BUILD: timedelta(days=1),
}

# The exercise kinds a step asks (study/grammar_ladder.py builds them).
CHOOSE, BUILD_KIND, FLASHCARD = "choose", "build", "flashcard"


def step_of(state: CardState) -> int:
    """Where on the walk a row stands, whoever wrote it."""
    if state.total_reviews == 0:
        return PICK[0]
    step = state.learning_step
    if step in (RELAPSE_PICK, RELAPSE_BUILD):
        return step
    if state.is_learning:
        # A lapse under the old scheduler kept a mastered interval.
        if state.interval_days >= MASTERED_DAYS:
            return RELAPSE_PICK
        return min(max(step, 0), PICK[-1])
    if state.interval_days >= MASTERED_DAYS:
        return MASTERED
    # Construire's step is its wait (1, 2, 4, 8 days), which a graduated
    # row of the old scheduler also reads onto: its learning_step is 4
    # whatever its interval, so the interval alone says how far.
    days = max(1, state.interval_days)
    return 3 if days < 2 else 4 if days < 4 else 5 if days < 8 else 6


def exercise_of(state: CardState) -> str:
    """The exercise the row's next review asks."""
    step = step_of(state)
    if step in PICK or step == RELAPSE_PICK:
        return CHOOSE
    if step == MASTERED:
        # Once mastered, the flashcard and Construire in turn.
        return FLASHCARD if state.repetitions % 2 == 0 else BUILD_KIND
    return BUILD_KIND


def position(state: CardState) -> dict:
    """The step as the client draws the point's line: which group, which
    step of it, how many it has, and whether this is the relapse."""
    step = step_of(state)
    if step in PICK:
        return {"step": step, "group": CHOOSE, "at": step + 1, "of": len(PICK), "relapse": False}
    if step in BUILD:
        return {"step": step, "group": BUILD_KIND, "at": step - BUILD[0] + 1, "of": len(BUILD), "relapse": False}
    if step == RELAPSE_PICK:
        return {"step": step, "group": CHOOSE, "at": 1, "of": 1, "relapse": True}
    if step == RELAPSE_BUILD:
        return {"step": step, "group": BUILD_KIND, "at": 1, "of": 1, "relapse": True}
    return {"step": step, "group": "mastered", "at": 1, "of": 1, "relapse": False}


def _place(state: CardState, step: int, now: datetime) -> CardState:
    """Set the row's fields for `step`, due after the step's wait."""
    state.learning_step = step
    if step in PICK or step == RELAPSE_PICK:
        state.is_learning = True
        state.interval_days = 0
        state.next_review = now + (_WAIT.get(step, timedelta(0)) if step in PICK else MISS_WAIT)
    elif step in BUILD or step == RELAPSE_BUILD:
        wait = _WAIT[step]
        state.is_learning = False
        # interval_days is what _progress reads; it is the wait itself.
        state.interval_days = max(1, wait.days)
        state.next_review = now + wait
    return state


def review(state: CardState, quality: int, now: datetime | None = None) -> CardState:
    """The row after a review at `quality`. Mutates and returns `state`,
    as Scheduler.review does."""
    now = now or datetime.now(timezone.utc)
    quality = clamp_quality(quality)
    step = step_of(state)
    passed = quality >= PASS_QUALITY

    state.total_reviews += 1
    state.last_quality = quality
    if passed:
        state.correct_reviews += 1

    if step == MASTERED:
        if passed:
            # Scheduler's own growth from the mastered interval; the step
            # stays, and repetitions turns the flashcard / Construire.
            state.is_learning = False
            state.interval_days = max(MASTERED_DAYS, state.interval_days)
            Scheduler._handle_review(Scheduler(), state, quality, now)
            state.learning_step = MASTERED
            return state
        state.lapses += 1
        state.repetitions = 0
        return _place(state, RELAPSE_PICK, now)

    if not passed:
        state.lapses += 1
        _place(state, step, now)
        # The same step, with another sentence, soon -- never the step's
        # own long wait.
        state.next_review = now + MISS_WAIT
        return state

    if step == RELAPSE_PICK:
        return _place(state, RELAPSE_BUILD, now)
    if step in (RELAPSE_BUILD, BUILD[-1]):
        state.learning_step = MASTERED
        state.is_learning = False
        state.interval_days = min(MAX_INTERVAL_DAYS, MASTERED_DAYS)
        state.repetitions = 0
        state.stability = max(1.0, state.stability)
        state.next_review = now + _WAIT[MASTERED]
        return state
    return _place(state, step + 1, now)
