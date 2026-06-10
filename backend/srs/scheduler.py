from datetime import datetime, timedelta, timezone

from .models import CardState

LEARNING_STEPS = [
    timedelta(minutes=3),
    timedelta(minutes=10),
    timedelta(hours=1),
    timedelta(days=1),
]

MIN_DIFFICULTY = 1.5
MAX_DIFFICULTY = 3.5


class Scheduler:

    def review(self, state: CardState, quality: int) -> CardState:

        now = datetime.now(timezone.utc)

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

            state.learning_step = 0
            state.next_review = now + LEARNING_STEPS[0]
            state.lapses += 1

            return state

        state.learning_step += 1

        if state.learning_step >= len(LEARNING_STEPS):

            state.is_learning = False
            state.interval_days = 1
            state.stability = 1.0
            state.next_review = now + timedelta(days=1)

            return state

        state.next_review = (
            now + LEARNING_STEPS[state.learning_step]
        )

        return state

    def _handle_review(
        self,
        state: CardState,
        quality: int,
        now: datetime
    ) -> CardState:

        if quality < 3:
            state.lapses += 1
            state.is_learning = True
            state.learning_step = 0
            state.interval_days = max(1, state.interval_days)
            state.repetitions = max(0, state.repetitions - 1)
            state.stability = max(0.1, state.stability * 0.7)
            state.next_review = now + LEARNING_STEPS[0]
            return state

        if quality >= 5:
            bonus = 1.15
            state.difficulty -= 0.05
        elif quality == 4:
            bonus = 1.05
        else:
            bonus = 1.00
            state.difficulty += 0.05

        state.difficulty = min(
            MAX_DIFFICULTY,
            max(MIN_DIFFICULTY, state.difficulty)
        )

        if state.interval_days == 0:
            state.interval_days = 1

        stability_factor = 1.0 + min(1.5, state.stability / 20.0)
        growth = max(1.0, state.difficulty * bonus * stability_factor)

        state.interval_days = max(
            1,
            round(state.interval_days * growth)
        )

        state.stability = max(1.0, state.stability + quality * 0.25)
        state.repetitions += 1

        state.next_review = (
            now + timedelta(days=state.interval_days)
        )

        return state