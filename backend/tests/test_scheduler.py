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
