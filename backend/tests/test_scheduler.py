import copy
import unittest
from datetime import datetime, timedelta, timezone

from srs import scheduler as scheduler_mod
from srs.models import CardState
from srs.scheduler import Scheduler


class SchedulerTests(unittest.TestCase):
    def test_quality_three_progresses_forward(self) -> None:
        scheduler = Scheduler()
        state = CardState(card_id="x", mode="flashcard", interval_days=5, stability=1.0, is_learning=False)

        updated = scheduler.review(state, quality=3)

        self.assertGreaterEqual(updated.interval_days, 5)
        self.assertGreater(updated.next_review, datetime.now(timezone.utc))

    def test_failed_review_reenters_learning(self) -> None:
        scheduler = Scheduler()
        state = CardState(
            card_id="x",
            mode="flashcard",
            interval_days=10,
            repetitions=2,
            stability=2.0,
            is_learning=False,
        )

        updated = scheduler.review(state, quality=1)

        self.assertTrue(updated.is_learning)
        self.assertEqual(updated.learning_step, 0)
        self.assertGreater(updated.lapses, 0)


class FourButtonScaleTests(unittest.TestCase):
    """The four-button rating bar sends 1..4 — the canonical scale with
    its two extremes left off (frontend/src/domain/ratingScales.js). Every
    one of those four has to mean something different on its own, without
    0 and 5 to lean on."""

    def setUp(self) -> None:
        self.sched = Scheduler()

    def _graduated(self, **kw) -> CardState:
        state = CardState(card_id="c", mode="m", is_learning=False)
        state.interval_days = kw.pop("interval_days", 10)
        state.stability = kw.pop("stability", 4.0)
        for k, v in kw.items():
            setattr(state, k, v)
        return state

    def test_almost_is_a_lighter_miss_than_wrong(self) -> None:
        # Both used to run the same branch, so Wrong and Almost — half
        # the bar — were the same button with two names.
        almost = self.sched.review(self._graduated(), quality=2)
        wrong = self.sched.review(self._graduated(), quality=1)

        self.assertGreater(almost.learning_step, wrong.learning_step)
        self.assertGreater(almost.next_review, wrong.next_review)
        self.assertGreater(almost.stability, wrong.stability)
        self.assertLess(almost.difficulty, wrong.difficulty)

    def test_blackout_is_harsher_than_wrong(self) -> None:
        # The sixth button has to earn its place on the bar that keeps it.
        wrong = self.sched.review(self._graduated(), quality=1)
        blackout = self.sched.review(self._graduated(), quality=0)

        self.assertLess(blackout.stability, wrong.stability)
        self.assertGreater(blackout.difficulty, wrong.difficulty)

    def test_a_miss_in_learning_costs_steps_by_grade(self) -> None:
        # A near miss keeps a step; a wrong answer goes back to the start.
        almost = self.sched.review(
            CardState(card_id="c", mode="m", learning_step=2), quality=2)
        wrong = self.sched.review(
            CardState(card_id="c", mode="m", learning_step=2), quality=1)

        self.assertEqual(almost.learning_step, 1)
        self.assertEqual(wrong.learning_step, 0)

    def test_the_best_grade_of_the_four_can_make_a_card_easier(self) -> None:
        # The whole reason 4 now moves difficulty. Without this, nothing
        # the four-button bar can send lowers it while 3 raises it, so
        # every card ratchets to MAX_DIFFICULTY and stops growing.
        before = self._graduated(difficulty=2.5)
        after = self.sched.review(before, quality=4)
        self.assertLess(after.difficulty, 2.5)

    def test_the_four_pass_grades_are_ordered(self) -> None:
        # Difficult < Correct < Perfect, in what they do to the card.
        out = {
            q: self.sched.review(self._graduated(), quality=q)
            for q in (3, 4, 5)
        }
        self.assertLess(out[3].interval_days, out[4].interval_days)
        self.assertLess(out[4].interval_days, out[5].interval_days)
        self.assertGreater(out[3].difficulty, out[4].difficulty)
        self.assertGreater(out[4].difficulty, out[5].difficulty)

    def test_an_out_of_range_grade_is_clamped_rather_than_fatal(self) -> None:
        # The review payloads take quality as a plain int, and the grade
        # tables are keyed lookups now — an unclamped -1 would KeyError
        # the one endpoint the app exists to serve.
        low = self.sched.review(self._graduated(), quality=-3)
        high = self.sched.review(self._graduated(), quality=99)
        self.assertEqual(low.last_quality, 0)
        self.assertEqual(high.last_quality, 5)


class GradesApartTests(unittest.TestCase):
    """The desk's card panel prints, on each verdict's tile, when that
    rating brings the card back (plan 126), and what it printed was
    mostly pairs: Difficult and Correct gave the same wait on every
    learning step and on a card's first reviews after graduating, and a
    new card came back after a day twice running. On the six-button bar,
    Perfect waited what Correct did in the learning steps and Blackout
    what Wrong did on every miss. The tiles were right; the buttons
    really did the same thing."""

    STEPS = scheduler_mod.LEARNING_STEPS

    def setUp(self) -> None:
        self.sched = Scheduler()

    def _waits(self, state: CardState, qualities=(1, 2, 3, 4)) -> dict[int, timedelta]:
        """What each grade's tile would print: its wait from now."""
        now = datetime.now(timezone.utc)
        return {
            q: self.sched.review(copy.deepcopy(state), q).next_review - now
            for q in qualities
        }

    def assertSooner(self, a: timedelta, b: timedelta, msg=None) -> None:
        # By a minute at least: each dry run reads the clock afresh, so
        # two identical waits come out microseconds apart.
        self.assertGreaterEqual(b - a, timedelta(minutes=1), msg)

    def test_difficult_waits_short_of_correct_on_every_learning_step(self) -> None:
        for step in range(len(self.STEPS) - 1):
            state = CardState(card_id="c", mode="m", learning_step=step)
            waits = self._waits(state)
            self.assertSooner(self.STEPS[step], waits[3], step)
            self.assertSooner(waits[3], waits[4], step)
            # Still a pass: it climbs the step, it just comes back sooner.
            self.assertEqual(self.sched.review(state, 3).learning_step, step + 1)

    def test_a_new_card_never_waits_the_same_day_twice(self) -> None:
        state = CardState(card_id="c", mode="m")
        waits = []
        for _ in range(len(self.STEPS)):
            waits.append(self._waits(state, (4,))[4])
            state = self.sched.review(state, 4)
        self.assertFalse(state.is_learning)
        for a, b in zip(waits, waits[1:]):
            self.assertSooner(a, b, waits)
        self.assertEqual(state.interval_days, scheduler_mod.GRADUATING_DAYS)

    def test_difficult_graduates_a_day_short_of_correct(self) -> None:
        last = len(self.STEPS) - 1
        hard = self.sched.review(CardState(card_id="c", mode="m", learning_step=last), 3)
        good = self.sched.review(CardState(card_id="c", mode="m", learning_step=last), 4)
        self.assertFalse(hard.is_learning)
        self.assertEqual(hard.interval_days, scheduler_mod.GRADUATING_DAYS - 1)
        self.assertEqual(good.interval_days, scheduler_mod.GRADUATING_DAYS)

    def test_the_pass_grades_are_a_day_apart_at_every_interval(self) -> None:
        # Correct's 5% more growth than Difficult rounded away on every
        # short interval: 2 days and 2, then 4 and 4.
        for interval in range(1, 61):
            for difficulty in (1.5, 2.5, 3.5):
                for stability in (1.0, 4.0, 40.0):
                    state = CardState(card_id="c", mode="m", is_learning=False)
                    state.interval_days = interval
                    state.difficulty, state.stability = difficulty, stability
                    out = {q: self.sched.review(copy.deepcopy(state), q).interval_days
                           for q in (3, 4, 5)}
                    ctx = (interval, difficulty, stability, out)
                    self.assertLess(out[3], out[4], ctx)
                    self.assertLess(out[4], out[5], ctx)

    def test_perfect_climbs_two_steps(self) -> None:
        for step in range(len(self.STEPS) - 2):
            state = CardState(card_id="c", mode="m", learning_step=step)
            perfect = self.sched.review(copy.deepcopy(state), 5)
            self.assertTrue(perfect.is_learning)
            self.assertEqual(perfect.learning_step, step + 2)
            waits = self._waits(state, (4, 5))
            self.assertAlmostEqual(waits[5].total_seconds(),
                                   self.STEPS[step + 2].total_seconds(), delta=1)
            self.assertSooner(waits[4], waits[5], step)

    def test_perfect_graduates_a_day_past_correct(self) -> None:
        # From the step before the last, Correct waits the last step's
        # day and Perfect graduates; from the last, both graduate.
        last = len(self.STEPS) - 1
        for step, days in ((last - 1, scheduler_mod.GRADUATING_DAYS),
                           (last, scheduler_mod.GRADUATING_DAYS + 1)):
            state = CardState(card_id="c", mode="m", learning_step=step)
            perfect = self.sched.review(copy.deepcopy(state), 5)
            self.assertFalse(perfect.is_learning, step)
            self.assertEqual(perfect.interval_days, days, step)
            self.assertEqual(perfect.learning_step, len(self.STEPS), step)
            waits = self._waits(state, (4, 5))
            self.assertGreaterEqual(waits[5] - waits[4], timedelta(days=1) - timedelta(minutes=1), step)

    def test_blackout_comes_back_sooner_than_wrong(self) -> None:
        graduated = CardState(card_id="c", mode="m", is_learning=False)
        graduated.interval_days, graduated.stability = 30, 5.0
        states = [CardState(card_id="c", mode="m", learning_step=step)
                  for step in range(len(self.STEPS))] + [graduated]
        for state in states:
            waits = self._waits(state, (0, 1))
            self.assertAlmostEqual(waits[0].total_seconds(),
                                   scheduler_mod.BLACKOUT_WAIT.total_seconds(), delta=1)
            self.assertSooner(waits[0], waits[1], state)
            self.assertEqual(self.sched.review(copy.deepcopy(state), 0).learning_step, 0)

    def test_the_tiles_differ_but_where_there_is_no_step_to_fall_back_to(self) -> None:
        # A new card's whole ladder, answered Correct, with the six
        # tiles of the longest bar read at every card on it.
        state = CardState(card_id="c", mode="m")
        for _ in range(12):
            waits = self._waits(state, range(6))
            ctx = (state.is_learning, state.learning_step, state.interval_days, waits)
            self.assertSooner(waits[0], waits[1], ctx)
            self.assertSooner(waits[2], waits[3], ctx)
            self.assertSooner(waits[3], waits[4], ctx)
            self.assertSooner(waits[4], waits[5], ctx)
            if state.is_learning and state.learning_step <= 1:
                # One step back from the first two is the first.
                self.assertAlmostEqual(waits[1].total_seconds(), waits[2].total_seconds(), delta=1)
            else:
                self.assertSooner(waits[1], waits[2], ctx)
            state = self.sched.review(state, 4)


class GrowthTests(unittest.TestCase):
    """Interval growth used to be ease x bonus x an amplifier that itself
    reached 2.5, so one review could multiply an interval by ten and a
    card answered right a few times was never seen again."""

    def test_no_single_review_multiplies_an_interval_by_more_than_the_cap(self) -> None:
        sched = Scheduler()
        state = CardState(card_id="c", mode="m", is_learning=False)
        state.interval_days = 1
        worst = 0.0
        for _ in range(40):
            before = state.interval_days
            state = sched.review(state, 5)
            worst = max(worst, state.interval_days / before)
            if state.interval_days >= scheduler_mod.MAX_INTERVAL_DAYS:
                break
        # Rounding can nudge a small interval over by a hair (1 -> 4 is
        # 4.0 exactly at the cap), so allow the rounding, not a stride.
        self.assertLessEqual(worst, scheduler_mod.MAX_GROWTH + 0.5)

    def test_a_freshly_graduated_card_grows_more_slowly_than_a_settled_one(self) -> None:
        # The settling ramp: the uncertainty about a card is at the start
        # of its life, so that is where the caution belongs.
        sched = Scheduler()
        fresh = CardState(card_id="c", mode="m", is_learning=False)
        fresh.interval_days, fresh.stability = 20, 1.0
        settled = CardState(card_id="c", mode="m", is_learning=False)
        settled.interval_days, settled.stability = 20, 40.0

        self.assertLess(
            sched.review(fresh, 4).interval_days,
            sched.review(settled, 4).interval_days,
        )

    def test_the_first_handful_of_correct_answers_stay_inside_months(self) -> None:
        # Where the old amplifier did its damage. Five Correct answers on
        # a freshly graduated card used to put it 217 days out — the
        # learner sees a card five times and then not again for seven
        # months, which is why "in progress" fills up and nothing comes
        # back. The long tail is fine and is meant to be long; it is the
        # first few steps that have to stay in touch.
        sched = Scheduler()
        state = CardState(card_id="c", mode="m", is_learning=False)
        state.interval_days = 1
        for _ in range(5):
            state = sched.review(state, 4)
        self.assertLess(state.interval_days, 120)


class RelearningTests(unittest.TestCase):
    """What a lapse leaves a card has to survive the relearning steps.

    FAIL[grade].stability is the fraction a miss lets a card keep, and
    graduation used to set stability to 1.0 outright -- so on the
    correct answer that finished relearning, that fraction was thrown
    away. The tests beside FourButtonScaleTests only ever looked at the
    card right after the miss, which is why nobody saw it: the
    difference they check was real for three steps and then erased."""

    def setUp(self) -> None:
        self.sched = Scheduler()

    def _relearned(self, quality: int, stability: float = 6.0) -> CardState:
        """A mature card missed at `quality`, then answered Correct
        until it leaves the learning steps again."""
        state = CardState(card_id="c", mode="m", is_learning=False)
        state.interval_days, state.stability, state.difficulty = 81, stability, 2.25
        state = self.sched.review(state, quality)
        for _ in range(len(scheduler_mod.LEARNING_STEPS)):
            if not state.is_learning:
                break
            state = self.sched.review(state, 4)
        self.assertFalse(state.is_learning)
        return state

    def test_a_relearned_card_keeps_the_stability_its_lapse_left_it(self) -> None:
        state = self._relearned(quality=1, stability=6.0)
        self.assertAlmostEqual(state.stability, 6.0 * scheduler_mod.FAIL[1].stability)

    def test_almost_still_differs_from_wrong_once_relearned(self) -> None:
        almost = self._relearned(quality=2)
        wrong = self._relearned(quality=1)
        self.assertGreater(almost.stability, wrong.stability)

    def test_a_relearned_card_regrows_faster_than_a_new_one(self) -> None:
        # The symptom the learner saw: one slip on a word known for
        # months, and it came back on the same 2d, 5d, 13d ladder as a
        # word met last week.
        relearned = self._relearned(quality=1)
        new = CardState(card_id="n", mode="m")
        for _ in range(len(scheduler_mod.LEARNING_STEPS)):
            new = self.sched.review(new, 4)
        self.assertFalse(new.is_learning)
        new.difficulty = relearned.difficulty

        for _ in range(3):
            relearned = self.sched.review(relearned, 4)
            new = self.sched.review(new, 4)
        self.assertGreater(relearned.interval_days, new.interval_days)

    def test_a_new_card_still_graduates_at_the_floor(self) -> None:
        state = CardState(card_id="c", mode="m")
        for _ in range(len(scheduler_mod.LEARNING_STEPS)):
            state = self.sched.review(state, 4)
        self.assertFalse(state.is_learning)
        self.assertEqual(state.stability, 1.0)
        self.assertEqual(state.interval_days, scheduler_mod.GRADUATING_DAYS)

    def test_a_lapse_that_left_less_than_the_floor_graduates_at_it(self) -> None:
        # Blackout on a card that had only just graduated: 1.0 x 0.5.
        state = self._relearned(quality=0, stability=1.0)
        self.assertEqual(state.stability, 1.0)


class IntervalCeilingTests(unittest.TestCase):
    """
    Interval growth is multiplicative and was unbounded. `now +
    timedelta(days=n)` raises OverflowError past about 2.7 million days,
    so a card answered well enough for long enough made the review
    endpoint 500 -- on the one action the app exists to perform.
    """

    def test_a_long_run_of_perfect_reviews_never_overflows(self) -> None:
        sched = Scheduler()
        state = CardState(card_id="c", mode="m")
        state.is_learning = False
        state.interval_days = 1
        state.total_reviews = 1

        # Far more than the ~14 it used to take to overflow.
        for _ in range(80):
            state = sched.review(state, 5)

        self.assertLessEqual(state.interval_days, scheduler_mod.MAX_INTERVAL_DAYS)
        self.assertIsNotNone(state.next_review)

    def test_the_cap_is_clear_of_the_timedelta_limit(self) -> None:
        # With room for one more growth step on top, since the cap is
        # applied after the multiply.
        self.assertLess(scheduler_mod.MAX_INTERVAL_DAYS * 10, timedelta.max.days)


if __name__ == "__main__":
    unittest.main()
