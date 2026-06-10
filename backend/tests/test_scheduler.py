import unittest
from datetime import datetime, timezone

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


if __name__ == "__main__":
    unittest.main()
