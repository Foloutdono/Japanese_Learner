from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class CardState:
    card_id: str
    mode: str

    difficulty: float = 2.5
    stability: float = 0.0

    interval_days: int = 0

    repetitions: int = 0
    lapses: int = 0

    learning_step: int = 0
    is_learning: bool = True

    next_review: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    total_reviews: int = 0
    correct_reviews: int = 0

    last_quality: int = -1