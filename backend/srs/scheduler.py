from datetime import datetime, timedelta, timezone
from typing import NamedTuple

from .models import CardState

LEARNING_STEPS = [
    timedelta(minutes=3),
    timedelta(minutes=10),
    timedelta(hours=1),
    timedelta(days=1),
]

MIN_DIFFICULTY = 1.5
MAX_DIFFICULTY = 3.5

# ── What each grade does ─────────────────────────────────────
# 0..5 is the canonical scale and stays that way whichever rating bar
# the learner is using. The four-button bar is this same scale with its
# two extremes left off (see frontend/src/domain/ratingScales.js), so a
# stored quality means exactly what it always meant and a learner can
# switch bars without their own history changing under them.
#
# PASS — 3 and up. `bonus` multiplies the interval's growth; `difficulty`
# is the card's long-run record of how it has gone, and it is what makes
# the next interval bigger or smaller (see `ease` in _handle_review).
#
# 4 easing the card is the change the four-button bar needed. It is the
# best answer that bar can send, and it used to leave difficulty alone
# while 3 raised it — so with nothing able to lower it, every card
# ratcheted toward MAX_DIFFICULTY and its intervals stopped growing.
# That was already the lived experience of anyone who never pressed the
# six-button bar's Perfect. The top grade of whichever bar is in use has
# to be able to say "this one is getting easier".
PASS = {
    #   bonus, difficulty
    5: (1.15, -0.10),
    4: (1.05, -0.05),
    3: (1.00, +0.05),
}

QUALITY_MIN = 0
QUALITY_MAX = 5


def clamp_quality(quality: int) -> int:
    """A grade onto the canonical scale. The review payloads take
    quality as a plain int, so this is what stands between a client and
    every table keyed by a grade."""
    return max(QUALITY_MIN, min(QUALITY_MAX, quality))


class Lapse(NamedTuple):
    """What a failed answer costs, by grade."""
    relearn_step: int  # where a graduated card restarts in LEARNING_STEPS
    steps_lost: int    # what a card still in learning gives back
    stability: float   # the fraction of its stability that survives
    difficulty: float  # how much harder the card is rated from now on


# FAIL — under 3. These used to be a single branch: 0, 1 and 2 all reset
# to the first learning step and kept 70% of their stability, so Wrong
# and Almost — half of the four-button bar — did precisely the same
# thing, and Blackout was no worse than Wrong on the six-button one. A
# near miss is now treated as one: it keeps a step of progress, comes
# back at ten minutes rather than three, and takes a lighter cut.
FAIL = {
    2: Lapse(relearn_step=1, steps_lost=1, stability=0.85, difficulty=0.10),
    1: Lapse(relearn_step=0, steps_lost=len(LEARNING_STEPS), stability=0.70, difficulty=0.15),
    0: Lapse(relearn_step=0, steps_lost=len(LEARNING_STEPS), stability=0.50, difficulty=0.20),
}

# ── Keeping the grades apart ─────────────────────────────────
# The desk's card panel prints, on each verdict's tile, when that rating
# brings the card back (plan 126), and what it printed was mostly pairs:
# Difficult and Correct gave the same wait on every learning step, and
# again on a card's first reviews after it graduated, where Correct's 5%
# of extra growth rounds away. Nothing on screen was wrong -- the two
# buttons really did the same thing. The six-button bar's two ends did
# it as well: Perfect waited what Correct did on every learning step,
# and Blackout what Wrong did on every miss. These rules keep them apart.
#
# In the learning steps, Difficult still climbs a step, since a pass
# keeps its progress, but it waits halfway between the step it leaves
# and the one Correct would wait (learning_wait below): 7 minutes where
# Correct says 10, 35 where Correct says an hour. Perfect climbs two
# steps: an hour where Correct says ten minutes, a day where it says an
# hour.
#
# Leaving the steps, a clean pass waits GRADUATING_DAYS. The last step
# is already a day, and graduating used to set a day again, so every new
# card came back after a day twice running. Difficult on that step
# graduates a day short of it, which is the day the card used to get,
# and Perfect a day past it. Perfect on the step before graduates too,
# at GRADUATING_DAYS, where Correct would wait the last step's day.
#
# After graduation, each pass grade lands at least a day past the one
# below it (_handle_review). Where the growth rule already separates
# them, which is every interval past a week or so, this does nothing.
#
# Blackout sends a card back to the first step as Wrong does, but waits
# BLACKOUT_WAIT there, a minute where Wrong waits three.
#
# Almost and Wrong still match on the first two steps: one step back
# from there is the first step, and there is nothing before it.
GRADUATING_DAYS = 2
BLACKOUT_WAIT = timedelta(minutes=1)


def learning_wait(step: int, quality: int) -> timedelta:
    """How long a card waits at learning `step`, `quality` having sent
    it there. Difficult (3) climbed to it from the step below and waits
    halfway between the two; Blackout (0) sent it to the first step and
    waits BLACKOUT_WAIT; any other grade waits the step itself."""
    if quality == 0:
        return BLACKOUT_WAIT
    wait = LEARNING_STEPS[step]
    if quality == 3 and step > 0:
        wait = (LEARNING_STEPS[step - 1] + wait) / 2
    return wait


# ── Settling: what stability is for ──────────────────────────
# Growth is ease x the grade's bonus x this, and this used to be
# `1 + min(1.5, stability / 20)` — a second ease, stacked on the first,
# that AMPLIFIED a card the longer it had been known. Ease already
# reaches 3.5 and the bonus 1.15, so with the amplifier on top a single
# review could multiply an interval by 10.06. Measured, replaying the
# old rule on a card that has just graduated and is then answered
# Correct every time: 3, 8, 23, 69, 217, 712, 2430, 8611 days. Eight
# correct answers and the card is twenty-three years away — retired,
# not scheduled. Nobody chose that; it fell out of multiplying three
# numbers that were each above 1.
#
# The same card under this rule: 2, 4, 9, 23, 66, 194, 581, 1769.
#
# It ramps rather than amplifies now: a card that has only just left the
# learning steps grows at 70% of what its grade would otherwise give it,
# reaching full weight about four reviews later. Same term, opposite
# sign — the uncertainty is at the START of a card's life, not the end,
# so that is where the caution belongs. Mature cards (stability >= 4)
# are unaffected by it and are scheduled by ease and grade alone.
SETTLING_FLOOR = 0.6
SETTLING_PER = 10.0

# A backstop, not the mechanism. With the settling ramp above, growth
# tops out at ease 3.5 x bonus 1.15 = 4.03 — a card rated as easy as the
# range allows, answered Perfect — so this binds almost never. It exists
# so that no future tuning of the three terms can quietly reintroduce an
# order-of-magnitude jump.
MAX_GROWTH = 4.0

# The ceiling on how far ahead a card can be pushed.
#
# Growth here is multiplicative and was unbounded, so a card answered
# well enough for long enough overflowed: `now + timedelta(days=...)`
# raises OverflowError past roughly 2.7 million days, which is a 500 on
# the review endpoint -- the single action the whole app is built
# around. Reached in about fourteen consecutive strong reviews of one
# card, which is a normal thing for a learner to do, not an exotic one.
#
# 100 years is the conventional cap and is well clear of the overflow
# with room for the largest growth step. It is not a compromise on the
# scheduling either: past a few years "due" has stopped being a
# meaningful claim about a human being's memory.
MAX_INTERVAL_DAYS = 36500


class Scheduler:

    def review(self, state: CardState, quality: int) -> CardState:

        now = datetime.now(timezone.utc)

        # The review payloads take quality as a plain int, and the two
        # tables below are keyed lookups rather than the chain of
        # comparisons they replaced — so an out-of-range grade would now
        # KeyError the one endpoint the whole app is built around. Clamp
        # here, once, rather than trusting six call sites: the stored
        # last_quality and the correct_reviews count then agree with what
        # was actually scheduled. SRSEngine.review clamps before calling
        # this, so that the review_log row and the XP agree with it too;
        # this stays for the callers that reach the scheduler directly.
        quality = clamp_quality(quality)

        state.total_reviews += 1
        state.last_quality = quality

        if quality >= 3:
            state.correct_reviews += 1

        if state.is_learning:
            return self._handle_learning(state, quality, now)

        return self._handle_review(state, quality, now)

    def _handle_learning(
        self,
        state: CardState,
        quality: int,
        now: datetime
    ) -> CardState:

        if quality < 3:

            # Difficulty is deliberately NOT touched here. Missing a card
            # you have not learned yet is what learning looks like, and
            # marking it harder for good on that basis would leave every
            # new card permanently penalised for being new. A lapse from
            # a graduated card is a different claim, and _handle_review
            # does score it.
            lapse = FAIL[quality]
            state.learning_step = max(0, state.learning_step - lapse.steps_lost)
            state.next_review = now + learning_wait(state.learning_step, quality)
            state.lapses += 1

            return state

        # Perfect climbs two steps (see GRADUATING_DAYS).
        state.learning_step += 2 if quality == 5 else 1

        if state.learning_step >= len(LEARNING_STEPS):

            state.is_learning = False
            # See GRADUATING_DAYS: Difficult leaves on a day, a clean
            # pass on two, never a second day after the last step's,
            # and each step Perfect climbs past the last is a day more.
            past = state.learning_step - len(LEARNING_STEPS)
            state.interval_days = GRADUATING_DAYS + past - (1 if quality == 3 else 0)
            state.learning_step = len(LEARNING_STEPS)
            # A floor, not a reset. A new card arrives here with the
            # stability it was created with (0) and leaves with 1.0, as
            # it always did. A card relearning after a lapse arrives
            # with what FAIL[grade].stability let it keep — and this
            # used to be `= 1.0`, which threw that away on the correct
            # answer that finished relearning. So the FAIL table's
            # stability column did nothing past the relearning steps:
            # Almost and Wrong left a card in the same state, and a word
            # known for months regrew from one slip exactly as slowly as
            # a word met last week (2d, 5d, 13d rather than 3d, 9d, 26d).
            state.stability = max(1.0, state.stability)
            state.next_review = now + timedelta(days=state.interval_days)

            return state

        state.next_review = (
            now + learning_wait(state.learning_step, quality)
        )

        return state

    def _handle_review(
        self,
        state: CardState,
        quality: int,
        now: datetime
    ) -> CardState:

        if quality < 3:
            lapse = FAIL[quality]
            state.lapses += 1
            state.is_learning = True
            state.learning_step = lapse.relearn_step
            state.interval_days = max(1, state.interval_days)
            state.repetitions = max(0, state.repetitions - 1)
            state.stability = max(0.1, state.stability * lapse.stability)
            state.difficulty = min(MAX_DIFFICULTY, state.difficulty + lapse.difficulty)
            state.next_review = now + learning_wait(lapse.relearn_step, quality)
            return state

        # Each pass grade lands at least a day past the one below it
        # (see GRADUATING_DAYS), so the grades under this one are grown
        # from the same state first. The day added can take a one-day
        # interval past MAX_GROWTH; a day is not the jump that cap is for.
        interval = 0
        for grade in range(3, quality + 1):
            grown, difficulty = self._grow(state, grade)
            interval = max(grown, interval + 1)

        state.difficulty = difficulty
        state.interval_days = min(MAX_INTERVAL_DAYS, interval)

        state.stability = max(1.0, state.stability + quality * 0.25)
        state.repetitions += 1

        state.next_review = (
            now + timedelta(days=state.interval_days)
        )

        return state

    @staticmethod
    def _grow(state: CardState, quality: int) -> tuple[int, float]:
        """The interval and difficulty a pass at `quality` would give
        `state`, which is left as it is."""
        bonus, difficulty_delta = PASS[quality]
        difficulty = min(
            MAX_DIFFICULTY,
            max(MIN_DIFFICULTY, state.difficulty + difficulty_delta)
        )

        settling = min(1.0, SETTLING_FLOOR + state.stability / SETTLING_PER)
        # Reflect difficulty around the midpoint of its own range before
        # using it as the growth multiplier. difficulty rises for weak
        # answers and falls for strong ones (see above), so used directly
        # as a multiplier it made hard cards grow their interval *faster*
        # (reviewed less often) and easy cards grow it *slower* (reviewed
        # more often) — exactly backwards. Reflecting it inverts that:
        # a hard card (difficulty near MAX_DIFFICULTY) now yields a small
        # ease (near MIN_DIFFICULTY) and thus small growth/short interval,
        # while an easy card (difficulty near MIN_DIFFICULTY) yields a
        # large ease and long interval.
        ease = MIN_DIFFICULTY + MAX_DIFFICULTY - difficulty
        growth = min(MAX_GROWTH, max(1.0, ease * bonus * settling))

        interval = min(
            MAX_INTERVAL_DAYS,
            max(1, round(max(1, state.interval_days) * growth)),
        )
        return interval, difficulty