"""
Spaced Repetition System (SRS) using the SM-2 algorithm.
One DB row per card, multiple modes stored inside data JSONB.

data structure:
{
  "modes": {
    "mcq":  { "easiness": 2.5, "interval": 0, "repetitions": 0,
              "next_review": "...", "total_reviews": 0,
              "correct_reviews": 0, "last_quality": -1 },
    "type": { ... }
  }
}
"""

import json
import random
import psycopg2
import psycopg2.extras
from datetime import datetime, timedelta
from typing import Optional
from collections import deque
from psycopg2.pool import SimpleConnectionPool


def _default_mode_state() -> dict:
    return {
        "easiness":       2.5,
        "interval":       0,
        "repetitions":    0,
        "next_review":    datetime.now().isoformat(),
        "total_reviews":  0,
        "correct_reviews": 0,
        "last_quality":   -1,
    }


class SRSEngine:
    MIN_EASINESS       = 1.3
    WRONG_REQUEUE_AFTER = 4

    def __init__(self, database_url: str):
        self.database_url = database_url
        # cards[card_id] = { "modes": { mode: state_dict } }
        self.cards: dict[str, dict] = {}
        self._requeue: deque[tuple[str, str, int]] = deque()  # (card_id, mode, show_at)
        self._cards_shown_this_session = 0

        self.conn_pool = SimpleConnectionPool(1, 10, self.database_url)
        self._init_db()
        self.load()

    # =========================================================
    # DATABASE
    # =========================================================

    def _get_conn(self):
        return self.conn_pool.getconn()

    def _init_db(self):
        conn = self._get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS cards (
                        id   TEXT PRIMARY KEY,
                        data JSONB NOT NULL
                    )
                """)
            conn.commit()
        finally:
            self.conn_pool.putconn(conn)

    # =========================================================
    # LOAD / SAVE
    # =========================================================

    def load(self):
        self.cards = {}
        conn = self._get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT id, data FROM cards")
                for row in cur.fetchall():
                    data = row["data"]
                    if isinstance(data, str):
                        data = json.loads(data)
                    self.cards[row["id"]] = data
        finally:
            self.conn_pool.putconn(conn)

    def _save_card(self, card_id: str):
        conn = self._get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO cards (id, data)
                    VALUES (%s, %s)
                    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
                """, (card_id, json.dumps(self.cards[card_id], ensure_ascii=False)))
            conn.commit()
        finally:
            self.conn_pool.putconn(conn)

    def delete_cards(self, card_ids: list[str]):
        if not card_ids:
            return
        conn = self._get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM cards WHERE id = ANY(%s)", (card_ids,))
            conn.commit()
        finally:
            self.conn_pool.putconn(conn)

    def delete_all_cards(self):
        conn = self._get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM cards")
            conn.commit()
        finally:
            self.conn_pool.putconn(conn)

    # =========================================================
    # CARD / MODE ACCESS
    # =========================================================

    def _get_or_create_mode(self, card_id: str, mode: str) -> dict:
        if card_id not in self.cards:
            self.cards[card_id] = {"modes": {}}
        if mode not in self.cards[card_id]["modes"]:
            self.cards[card_id]["modes"][mode] = _default_mode_state()
            self._save_card(card_id)
        return self.cards[card_id]["modes"][mode]

    def _get_mode(self, card_id: str, mode: str) -> Optional[dict]:
        return self.cards.get(card_id, {}).get("modes", {}).get(mode)

    # =========================================================
    # REVIEW LOGIC
    # =========================================================

    def review(self, card_id: str, mode: str, quality: int) -> dict:
        s = self._get_or_create_mode(card_id, mode)

        s["total_reviews"]  += 1
        s["last_quality"]    = quality
        self._cards_shown_this_session += 1

        if quality >= 3:
            s["correct_reviews"] += 1
            if s["repetitions"] == 0:
                s["interval"] = 1
            elif s["repetitions"] == 1:
                s["interval"] = 6
            else:
                s["interval"] = round(s["interval"] * s["easiness"])
            s["repetitions"] += 1
        else:
            s["repetitions"] = 0
            s["interval"]    = 1
            reshow_at = self._cards_shown_this_session + self.WRONG_REQUEUE_AFTER
            already = any(cid == card_id and m == mode for cid, m, _ in self._requeue)
            if not already:
                self._requeue.append((card_id, mode, reshow_at))

        s["easiness"] = max(
            self.MIN_EASINESS,
            s["easiness"] + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
        )
        s["next_review"] = (datetime.now() + timedelta(days=s["interval"])).isoformat()

        self._save_card(card_id)
        return s

    # =========================================================
    # SESSION MANAGEMENT
    # =========================================================

    def pop_requeue(self) -> Optional[tuple[str, str]]:
        if not self._requeue:
            return None
        card_id, mode, show_at = self._requeue[0]
        if self._cards_shown_this_session >= show_at:
            self._requeue.popleft()
            return card_id, mode
        return None

    def reset_session(self):
        self._requeue.clear()
        self._cards_shown_this_session = 0

    # =========================================================
    # QUERIES
    # =========================================================

    def get_due_cards(self, card_ids: list[str], mode: str) -> list[str]:
        due = []
        now = datetime.now()
        for cid in card_ids:
            s = self._get_mode(cid, mode)
            if s and s["total_reviews"] > 0:
                if now >= datetime.fromisoformat(s["next_review"]):
                    due.append((cid, datetime.fromisoformat(s["next_review"])))
        due.sort(key=lambda x: x[1])
        return [cid for cid, _ in due]

    def get_new_cards(self, card_ids: list[str], mode: str, limit: int = 10) -> list[str]:
        unseen = [
            cid for cid in card_ids
            if not self._get_mode(cid, mode)
            or self._get_mode(cid, mode)["total_reviews"] == 0
        ]
        random.shuffle(unseen)
        return unseen[:limit]

    def get_bulk_stats(self, card_ids: list[str], mode: str) -> dict:
        result = {}
        for cid in card_ids:
            s = self._get_mode(cid, mode)
            if not s or s["total_reviews"] == 0:
                result[cid] = "new"
            elif s["interval"] >= 21:
                result[cid] = "mastered"
            else:
                result[cid] = "learning"
        return result

    def get_due_count(self, card_ids: list[str], mode: str) -> int:
        now = datetime.now()
        count = 0
        for cid in card_ids:
            s = self._get_mode(cid, mode)
            if s and s["total_reviews"] > 0:
                if now >= datetime.fromisoformat(s["next_review"]):
                    count += 1
        return count

    # =========================================================
    # CLEANUP
    # =========================================================

    def close(self):
        self.conn_pool.closeall()