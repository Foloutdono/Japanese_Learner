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
