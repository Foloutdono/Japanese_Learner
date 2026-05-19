"""
Spaced Repetition System (SRS) using the SM-2 algorithm.
Scientific basis: Ebbinghaus forgetting curve + SuperMemo SM-2.

Intra-session spacing: wrong answers are re-queued after N other cards,
not immediately — forcing genuine recall rather than short-term memory.

Storage: PostgreSQL via psycopg2 (Supabase-compatible).
"""

import json
import os
import random
import psycopg2
import psycopg2.extras
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from typing import Optional
from collections import deque


@dataclass
class CardState:
    card_id: str
    easiness: float = 2.5
    interval: int = 0
    repetitions: int = 0
    next_review: str = ""
    total_reviews: int = 0
    correct_reviews: int = 0
    last_quality: int = -1

    def __post_init__(self):
        if not self.next_review:
            self.next_review = datetime.now().isoformat()


class SRSEngine:
    """
    SM-2 algorithm + intra-session spacing queue.

    Quality scale:
        5 - Perfect response
        4 - Correct response after hesitation
        3 - Correct response with difficulty
        2 - Incorrect but remembered on seeing answer
        1 - Incorrect
        0 - Complete blackout
    """

    MIN_EASINESS = 1.3
    WRONG_REQUEUE_AFTER = 4

    def __init__(self, database_url: str):
        self.database_url = database_url
        self.cards: dict[str, CardState] = {}
        self._requeue: deque[tuple[str, int]] = deque()
        self._cards_shown_this_session = 0

        self._init_db()
        self.load()

    # =========================================================
    # DATABASE
    # =========================================================

    def _get_conn(self):
        return psycopg2.connect(self.database_url)

    def _init_db(self):
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS cards (
                        id TEXT PRIMARY KEY,
                        data JSONB NOT NULL
                    )
                """)
            conn.commit()

    # =========================================================
    # LOAD / SAVE
    # =========================================================

    def load(self):
        self.cards = {}
        with self._get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT id, data FROM cards")
                for row in cur.fetchall():
                    data = row["data"]
                    if isinstance(data, str):
                        data = json.loads(data)
                    self.cards[row["id"]] = CardState(**data)

    def save_all(self):
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                for key, card in self.cards.items():
                    cur.execute("""
                        INSERT INTO cards (id, data)
                        VALUES (%s, %s)
                        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
                    """, (key, json.dumps(asdict(card), ensure_ascii=False)))
            conn.commit()

    def save_card(self, card_id: str):
        card = self.cards[card_id]
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO cards (id, data)
                    VALUES (%s, %s)
                    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
                """, (card_id, json.dumps(asdict(card), ensure_ascii=False)))
            conn.commit()

    def delete_cards(self, card_ids: list[str]):
        if not card_ids:
            return
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM cards WHERE id = ANY(%s)",
                    (card_ids,)
                )
            conn.commit()

    def delete_all_cards(self):
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM cards")
            conn.commit()

    # =========================================================
    # CARD ACCESS
    # =========================================================

    def get_or_create(self, card_id: str) -> CardState:
        if card_id not in self.cards:
            self.cards[card_id] = CardState(card_id=card_id)
            self.save_card(card_id)
        return self.cards[card_id]

    # =========================================================
    # REVIEW LOGIC
    # =========================================================

    def review(self, card_id: str, quality: int) -> CardState:
        card = self.get_or_create(card_id)

        card.total_reviews += 1
        card.last_quality = quality
        self._cards_shown_this_session += 1

        if quality >= 3:
            card.correct_reviews += 1

            if card.repetitions == 0:
                card.interval = 1
            elif card.repetitions == 1:
                card.interval = 6
            else:
                card.interval = round(card.interval * card.easiness)

            card.repetitions += 1

        else:
            card.repetitions = 0
            card.interval = 1

            reshow_at = self._cards_shown_this_session + self.WRONG_REQUEUE_AFTER
            already = any(cid == card_id for cid, _ in self._requeue)
            if not already:
                self._requeue.append((card_id, reshow_at))

        card.easiness = max(
            self.MIN_EASINESS,
            card.easiness + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
        )

        next_date = datetime.now() + timedelta(days=card.interval)
        card.next_review = next_date.isoformat()

        self.save_card(card_id)
        return card

    # =========================================================
    # SESSION MANAGEMENT
    # =========================================================

    def pop_requeue(self) -> Optional[str]:
        if not self._requeue:
            return None
        card_id, show_at = self._requeue[0]
        if self._cards_shown_this_session >= show_at:
            self._requeue.popleft()
            return card_id
        return None

    def reset_session(self):
        self._requeue.clear()
        self._cards_shown_this_session = 0

    # =========================================================
    # QUERIES
    # =========================================================

    def is_due(self, card_id: str) -> bool:
        card = self.get_or_create(card_id)
        return datetime.now() >= datetime.fromisoformat(card.next_review)

    def get_due_cards(self, card_ids: list[str]) -> list[str]:
        due = []
        for cid in card_ids:
            card = self.get_or_create(cid)
            due_time = datetime.fromisoformat(card.next_review)
            if datetime.now() >= due_time:
                due.append((cid, due_time))
        due.sort(key=lambda x: x[1])
        return [cid for cid, _ in due]

    def get_new_cards(self, card_ids: list[str], limit: int = 10) -> list[str]:
        unseen = [
            cid for cid in card_ids
            if self.cards.get(cid, CardState(card_id=cid)).total_reviews == 0
        ]
        random.shuffle(unseen)
        return unseen[:limit]

    def get_stats(self, card_ids: list[str]) -> dict:
        total = len(card_ids)
        new = learning = mastered = 0

        for cid in card_ids:
            if cid not in self.cards or self.cards[cid].total_reviews == 0:
                new += 1
            elif self.cards[cid].interval >= 21:
                mastered += 1
            else:
                learning += 1

        due_now = len(self.get_due_cards(card_ids))
        return {
            "total": total,
            "new": new,
            "learning": learning,
            "mastered": mastered,
            "due_now": due_now,
        }

    # =========================================================
    # CLEANUP
    # =========================================================

    def close(self):
        pass  # connections are opened/closed per operation