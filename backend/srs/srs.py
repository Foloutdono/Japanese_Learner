import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from .models import CardState
from .scheduler import Scheduler
from .storage import Storage

logger = logging.getLogger(__name__)


class SRSEngine:
    """Database-backed SRS engine that uses the scheduler and storage helpers."""

    def __init__(self, database_url: str):
        self.database_url = database_url
        self.storage = Storage(database_url)
        self.scheduler = Scheduler()
        self._init_db()

    def _log_sql(self, label: str, sql: str, params: Any = None) -> None:
        # logger.info("SRS SQL %s sql=%s params=%r", label, sql, params)
        pass

    @staticmethod
    def _user_prefix_pattern(user_id: str) -> str:
        """Build a safe LIKE pattern matching '{user_id}:%' (escapes %, _, \\)."""
        safe_user_id = user_id.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")
        return f"{safe_user_id}:%"

    def _init_db(self) -> None:
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                self._log_sql("create_cards_table", """
                    CREATE TABLE IF NOT EXISTS cards (
                        id TEXT PRIMARY KEY
                    )
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS cards (
                        id TEXT PRIMARY KEY
                    )
                """)

                self._log_sql("drop_stale_data_col", "ALTER TABLE cards DROP COLUMN IF EXISTS data")
                cur.execute("ALTER TABLE cards DROP COLUMN IF EXISTS data")

                self._log_sql("create_card_modes_table", """
                    CREATE TABLE IF NOT EXISTS card_modes (
                        card_id TEXT NOT NULL,
                        mode TEXT NOT NULL,
                        difficulty REAL NOT NULL DEFAULT 2.5,
                        stability REAL NOT NULL DEFAULT 0,
                        interval_days INTEGER NOT NULL DEFAULT 0,
                        repetitions INTEGER NOT NULL DEFAULT 0,
                        lapses INTEGER NOT NULL DEFAULT 0,
                        learning_step INTEGER NOT NULL DEFAULT 0,
                        is_learning BOOLEAN NOT NULL DEFAULT TRUE,
                        next_review TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        total_reviews INTEGER NOT NULL DEFAULT 0,
                        correct_reviews INTEGER NOT NULL DEFAULT 0,
                        last_quality SMALLINT NOT NULL DEFAULT -1,
                        PRIMARY KEY(card_id, mode),
                        FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE
                    )
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS card_modes (
                        card_id TEXT NOT NULL,
                        mode TEXT NOT NULL,
                        difficulty REAL NOT NULL DEFAULT 2.5,
                        stability REAL NOT NULL DEFAULT 0,
                        interval_days INTEGER NOT NULL DEFAULT 0,
                        repetitions INTEGER NOT NULL DEFAULT 0,
                        lapses INTEGER NOT NULL DEFAULT 0,
                        learning_step INTEGER NOT NULL DEFAULT 0,
                        is_learning BOOLEAN NOT NULL DEFAULT TRUE,
                        next_review TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        total_reviews INTEGER NOT NULL DEFAULT 0,
                        correct_reviews INTEGER NOT NULL DEFAULT 0,
                        last_quality SMALLINT NOT NULL DEFAULT -1,
                        PRIMARY KEY(card_id, mode),
                        FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE
                    )
                """)

                self._log_sql("create_due_index", """
                    CREATE INDEX IF NOT EXISTS idx_due_reviews
                    ON card_modes(mode, next_review)
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_due_reviews
                    ON card_modes(mode, next_review)
                """)
                self._log_sql("create_due_lookup_index", """
                    CREATE INDEX IF NOT EXISTS idx_due_lookup
                    ON card_modes(mode, total_reviews, next_review)
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_due_lookup
                    ON card_modes(mode, total_reviews, next_review)
                """)

                self._log_sql("create_review_log_table", """
                    CREATE TABLE IF NOT EXISTS review_log (
                        id BIGSERIAL PRIMARY KEY,
                        card_id TEXT NOT NULL,
                        mode TEXT NOT NULL,
                        quality SMALLINT NOT NULL,
                        reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS review_log (
                        id BIGSERIAL PRIMARY KEY,
                        card_id TEXT NOT NULL,
                        mode TEXT NOT NULL,
                        quality SMALLINT NOT NULL,
                        reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)

                self._log_sql("create_review_log_card_index", """
                    CREATE INDEX IF NOT EXISTS idx_review_log_card_id
                    ON review_log(card_id, reviewed_at)
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_review_log_card_id
                    ON review_log(card_id, reviewed_at)
                """)

    def _ensure_card(self, card_id: str) -> None:
        with self.storage.cursor() as cur:
            sql = "INSERT INTO cards(id) VALUES (%s) ON CONFLICT(id) DO NOTHING"
            self._log_sql("ensure_card", sql, (card_id,))
            cur.execute(sql, (card_id,))

    def ensure_cards(self, card_ids: list[str], mode: str | None = None) -> None:
        if not card_ids:
            return
        with self.storage.cursor() as cur:
            sql_cards = "INSERT INTO cards(id) VALUES (%s) ON CONFLICT(id) DO NOTHING"
            self._log_sql("ensure_cards_bulk", sql_cards, [(card_id,) for card_id in card_ids])
            cur.executemany(sql_cards, [(card_id,) for card_id in card_ids])
            if mode:
                sql_modes = """
                        INSERT INTO card_modes(
                            card_id, mode, difficulty, stability, interval_days,
                            repetitions, lapses, learning_step, is_learning,
                            next_review, total_reviews, correct_reviews, last_quality
                        )
                        SELECT c.id, %s, 2.5, 0.0, 0, 0, 0, 0, TRUE, NOW(), 0, 0, -1
                        FROM cards c
                        WHERE c.id = ANY(%s)
                        ON CONFLICT(card_id, mode) DO NOTHING
                    """
                self._log_sql("ensure_cards_modes", sql_modes, (mode, card_ids))
                cur.execute(sql_modes, (mode, card_ids))

    def _state_from_row(self, row: Any) -> CardState:
        return CardState(
            card_id=row['card_id'],
            mode=row['mode'],
            difficulty=float(row['difficulty'] or 2.5),
            stability=float(row['stability'] or 0.0),
            interval_days=int(row['interval_days'] or 0),
            repetitions=int(row['repetitions'] or 0),
            lapses=int(row['lapses'] or 0),
            learning_step=int(row['learning_step'] or 0),
            is_learning=bool(row['is_learning']),
            next_review=row['next_review'] or datetime.now(timezone.utc),
            total_reviews=int(row['total_reviews'] or 0),
            correct_reviews=int(row['correct_reviews'] or 0),
            last_quality=int(row['last_quality'] or -1),
        )

    def _load_state(self, card_id: str, mode: str) -> CardState:
        self._ensure_card(card_id)
        with self.storage.cursor() as cur:
            sql = """
                SELECT card_id, mode, difficulty, stability, interval_days,
                       repetitions, lapses, learning_step, is_learning,
                       next_review, total_reviews, correct_reviews, last_quality
                FROM card_modes
                WHERE card_id = %s AND mode = %s
            """
            self._log_sql("load_state", sql, (card_id, mode))
            cur.execute(sql, (card_id, mode))
            row = cur.fetchone()
        if row is None:
            return CardState(card_id=card_id, mode=mode)
        return self._state_from_row(row)

    def _save_state(self, state: CardState) -> None:
        self._ensure_card(state.card_id)
        with self.storage.cursor() as cur:
            sql = """
                INSERT INTO card_modes(
                        card_id, mode, difficulty, stability, interval_days,
                        repetitions, lapses, learning_step, is_learning,
                        next_review, total_reviews, correct_reviews, last_quality
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT(card_id, mode) DO UPDATE SET
                        difficulty = EXCLUDED.difficulty,
                        stability = EXCLUDED.stability,
                        interval_days = EXCLUDED.interval_days,
                        repetitions = EXCLUDED.repetitions,
                        lapses = EXCLUDED.lapses,
                        learning_step = EXCLUDED.learning_step,
                        is_learning = EXCLUDED.is_learning,
                        next_review = EXCLUDED.next_review,
                        total_reviews = EXCLUDED.total_reviews,
                        correct_reviews = EXCLUDED.correct_reviews,
                        last_quality = EXCLUDED.last_quality
                """
            params = (
                state.card_id,
                state.mode,
                state.difficulty,
                state.stability,
                state.interval_days,
                state.repetitions,
                state.lapses,
                state.learning_step,
                state.is_learning,
                state.next_review or datetime.now(timezone.utc),
                state.total_reviews,
                state.correct_reviews,
                state.last_quality,
            )
            self._log_sql("save_state", sql, params)
            cur.execute(sql, params)

    def _to_dict(self, state: CardState) -> dict[str, Any]:
        return {
            "card_id": state.card_id,
            "mode": state.mode,
            "difficulty": state.difficulty,
            "stability": state.stability,
            "interval": state.interval_days,
            "interval_days": state.interval_days,
            "repetitions": state.repetitions,
            "lapses": state.lapses,
            "learning_step": state.learning_step,
            "is_learning": state.is_learning,
            "next_review": state.next_review.isoformat() if state.next_review else None,
            "total_reviews": state.total_reviews,
            "correct_reviews": state.correct_reviews,
            "last_quality": state.last_quality,
        }

    def review(self, card_id: str, mode: str, quality: int) -> dict[str, Any]:
        state = self._load_state(card_id, mode)
        updated = self.scheduler.review(state, quality)
        self._save_state(updated)
        self._log_review(card_id, mode, quality)
        return self._to_dict(updated)

    def _log_review(self, card_id: str, mode: str, quality: int) -> None:
        with self.storage.cursor() as cur:
            sql = "INSERT INTO review_log(card_id, mode, quality) VALUES (%s, %s, %s)"
            self._log_sql("log_review", sql, (card_id, mode, quality))
            cur.execute(sql, (card_id, mode, quality))

    def get_due_cards(self, mode: str, limit: int | None = None, card_ids: list[str] | None = None) -> list[str]:
        now = datetime.now(timezone.utc)
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                sql = """
                    SELECT card_id
                    FROM card_modes
                    WHERE mode = %s
                      AND total_reviews > 0
                      AND next_review <= %s
                """
                params: list[Any] = [mode, now]
                if card_ids:
                    sql += " AND card_id = ANY(%s)"
                    params.append(card_ids)
                sql += " ORDER BY next_review ASC"
                if limit is not None:
                    sql += " LIMIT %s"
                    params.append(limit)
                self._log_sql("get_due_cards", sql, tuple(params))
                cur.execute(sql, tuple(params))
                rows = cur.fetchall()
        return [row[0] for row in rows]

    def get_new_cards(self, mode: str, limit: int = 20, card_ids: list[str] | None = None) -> list[str]:
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                sql = """
                    SELECT c.id
                    FROM cards c
                    LEFT JOIN card_modes cm
                      ON cm.card_id = c.id AND cm.mode = %s
                    WHERE (cm.card_id IS NULL OR cm.total_reviews = 0)
                """
                params: list[Any] = [mode]
                if card_ids:
                    sql += " AND c.id = ANY(%s)"
                    params.append(card_ids)
                sql += " ORDER BY random()"
                if limit is not None:
                    sql += " LIMIT %s"
                    params.append(limit)
                self._log_sql("get_new_cards", sql, tuple(params))
                cur.execute(sql, tuple(params))
                rows = cur.fetchall()
        return [row[0] for row in rows]

    def get_due_count(self, mode: str) -> int:
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                sql = """
                    SELECT COUNT(*)
                    FROM card_modes
                    WHERE mode = %s
                      AND total_reviews > 0
                      AND next_review <= NOW()
                """
                self._log_sql("get_due_count", sql, (mode,))
                cur.execute(sql, (mode,))
                row = cur.fetchone()
        return int(row[0]) if row else 0

    def delete_cards(self, card_ids: list[str]) -> None:
        if not card_ids:
            return
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                sql_modes = "DELETE FROM card_modes WHERE card_id = ANY(%s)"
                self._log_sql("delete_cards_modes", sql_modes, (card_ids,))
                cur.execute(sql_modes, (card_ids,))
                sql_cards = "DELETE FROM cards WHERE id = ANY(%s)"
                self._log_sql("delete_cards_rows", sql_cards, (card_ids,))
                cur.execute(sql_cards, (card_ids,))

    def get_card_stats(self, card_id: str, mode: str) -> dict[str, Any]:
        state = self._load_state(card_id, mode)
        return {
            "card_id": card_id,
            "mode": mode,
            "total_reviews": state.total_reviews,
            "correct_reviews": state.correct_reviews,
            "interval": state.interval_days,
            "next_review": state.next_review.isoformat() if state.next_review else None,
            "is_learning": state.is_learning,
            "learning_step": state.learning_step,
            "lapses": state.lapses,
            "repetitions": state.repetitions,
            "difficulty": state.difficulty,
            "stability": state.stability,
            "last_quality": state.last_quality,
        }

    def get_deck_stats(self, mode: str) -> dict[str, Any]:
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                sql = """
                    SELECT
                        COUNT(*) AS total,
                        COUNT(*) FILTER (WHERE cm.card_id IS NULL OR cm.total_reviews = 0) AS new,
                        COUNT(*) FILTER (WHERE cm.card_id IS NOT NULL AND cm.total_reviews > 0 AND cm.interval_days < 21) AS learning,
                        COUNT(*) FILTER (WHERE cm.card_id IS NOT NULL AND cm.total_reviews > 0 AND cm.interval_days >= 21) AS mastered,
                        COUNT(*) FILTER (WHERE cm.card_id IS NOT NULL AND cm.total_reviews > 0 AND cm.next_review <= NOW()) AS due_now
                    FROM cards c
                    LEFT JOIN card_modes cm
                      ON cm.card_id = c.id AND cm.mode = %s
                """
                self._log_sql("get_deck_stats", sql, (mode,))
                cur.execute(sql, (mode,))
                row = cur.fetchone()
        if not row:
            return {"total": 0, "new": 0, "learning": 0, "mastered": 0, "due_now": 0}
        return {
            "total": int(row[0] or 0),
            "new": int(row[1] or 0),
            "learning": int(row[2] or 0),
            "mastered": int(row[3] or 0),
            "due_now": int(row[4] or 0),
        }

    def build_session(self, mode: str, new_limit: int = 10, review_limit: int = 100) -> list[str]:
        due = self.get_due_cards(mode, limit=review_limit)
        if len(due) < review_limit:
            new = self.get_new_cards(mode, limit=max(0, new_limit))
        else:
            new = []
        session = due + new
        return session[: review_limit + new_limit]

    def get_bulk_stats(self, card_ids: list[str], mode: str) -> dict[str, str]:
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                sql = """
                    SELECT cm.card_id, cm.total_reviews, cm.interval_days
                    FROM card_modes cm
                    WHERE cm.mode = %s AND cm.card_id = ANY(%s)
                """
                self._log_sql("get_bulk_stats", sql, (mode, card_ids))
                cur.execute(sql, (mode, card_ids))
                rows = {row[0]: row for row in cur.fetchall()}
        result: dict[str, str] = {}
        for card_id in card_ids:
            row = rows.get(card_id)
            if not row or row[1] == 0:
                result[card_id] = "new"
            elif row[2] >= 21:
                result[card_id] = "mastered"
            else:
                result[card_id] = "learning"
        return result

    def close(self) -> None:
        self.storage.close()


    def get_user_states(self, user_id: str) -> dict[tuple[str, str], str]:
        """
        Returns:
            {
                (card_id, mode): "new" | "learning" | "mastered"
            }
        """

        with self.storage.connection() as conn:
            with conn.cursor() as cur:

                sql = """
                    SELECT
                        card_id,
                        mode,
                        total_reviews,
                        interval_days,
                        next_review,
                        correct_reviews
                    FROM card_modes
                    WHERE card_id LIKE %s
                """

                pattern = self._user_prefix_pattern(user_id)

                self._log_sql(
                    "get_user_states",
                    sql,
                    (pattern,)
                )

                cur.execute(sql, (pattern,))

                rows = cur.fetchall()

        result = {}

        for card_id, mode, total_reviews, interval_days, next_review, correct_reviews in rows:

            if total_reviews == 0:
                state = "new"

            elif interval_days >= 21:
                state = "mastered"

            else:
                state = "learning"

            result[(card_id, mode)] = {
                "state": state,
                "due": total_reviews > 0 and next_review is not None and next_review <= datetime.now(timezone.utc),
                "total_reviews": total_reviews,
                "correct_reviews": correct_reviews,
                "interval_days": interval_days,
                "next_review": next_review.isoformat() if next_review else None,
            }

        return result

    def get_daily_review_counts(self, user_id: str, days: int = 30) -> list[dict[str, Any]]:
        """Reviews per day for the last `days` days (oldest first), for streak/trend charts."""
        pattern = self._user_prefix_pattern(user_id)
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                sql = """
                    SELECT date_trunc('day', reviewed_at)::date AS day, COUNT(*)
                    FROM review_log
                    WHERE card_id LIKE %s
                      AND reviewed_at >= NOW() - (%s || ' days')::interval
                    GROUP BY day
                    ORDER BY day ASC
                """
                self._log_sql("get_daily_review_counts", sql, (pattern, days))
                cur.execute(sql, (pattern, days))
                rows = cur.fetchall()
        return [{"date": day.isoformat(), "count": int(count)} for day, count in rows]

    def get_streak(self, user_id: str) -> dict[str, int]:
        """Current and longest consecutive-day streak of having at least one review."""
        pattern = self._user_prefix_pattern(user_id)
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                sql = """
                    SELECT DISTINCT date_trunc('day', reviewed_at)::date AS day
                    FROM review_log
                    WHERE card_id LIKE %s
                    ORDER BY day DESC
                """
                self._log_sql("get_streak", sql, (pattern,))
                cur.execute(sql, (pattern,))
                days = [row[0] for row in cur.fetchall()]

        if not days:
            return {"current": 0, "longest": 0}

        today = datetime.now(timezone.utc).date()
        day_set = set(days)

        # Current streak: walk back from today (or yesterday, if nothing logged yet today).
        current = 0
        cursor = today if today in day_set else today - timedelta(days=1)
        while cursor in day_set:
            current += 1
            cursor -= timedelta(days=1)

        # Longest streak: walk the sorted distinct days once.
        longest = 1
        run = 1
        ordered = sorted(day_set)
        for prev, curr in zip(ordered, ordered[1:]):
            if (curr - prev).days == 1:
                run += 1
            else:
                run = 1
            longest = max(longest, run)

        return {"current": current, "longest": longest}

    def get_due_forecast(self, user_id: str, days: int = 7) -> list[dict[str, Any]]:
        """
        Cards due per day for the next `days` days, today first.

        Overdue cards (next_review in the past) are folded into "today" rather
        than appearing under their original due date, and every day in the
        range is included (zero-filled) so the result is always exactly
        `days` entries in chronological order.
        """
        pattern = self._user_prefix_pattern(user_id)
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                sql = """
                    WITH day_range AS (
                        SELECT generate_series(0, %s - 1) AS day_offset
                    ),
                    due AS (
                        SELECT
                            (GREATEST(next_review, NOW())::date - CURRENT_DATE) AS day_offset,
                            COUNT(*) AS cnt
                        FROM card_modes
                        WHERE card_id LIKE %s
                          AND total_reviews > 0
                          AND next_review <= NOW() + (%s || ' days')::interval
                        GROUP BY 1
                    )
                    SELECT day_range.day_offset, COALESCE(due.cnt, 0)
                    FROM day_range
                    LEFT JOIN due ON due.day_offset = day_range.day_offset
                    ORDER BY day_range.day_offset ASC
                """
                self._log_sql("get_due_forecast", sql, (days, pattern, days))
                cur.execute(sql, (days, pattern, days))
                rows = cur.fetchall()

        today = datetime.now(timezone.utc).date()
        return [
            {"date": (today + timedelta(days=offset)).isoformat(), "count": int(count)}
            for offset, count in rows
        ]

    def get_weakest_cards(self, user_id: str, limit: int = 10) -> list[dict[str, Any]]:
        """Reviewed cards with the lowest accuracy (ties broken by most lapses)."""
        pattern = self._user_prefix_pattern(user_id)
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                sql = """
                    SELECT card_id, mode, total_reviews, correct_reviews, lapses
                    FROM card_modes
                    WHERE card_id LIKE %s
                      AND total_reviews > 0
                    ORDER BY (correct_reviews::float / total_reviews) ASC, lapses DESC
                    LIMIT %s
                """
                self._log_sql("get_weakest_cards", sql, (pattern, limit))
                cur.execute(sql, (pattern, limit))
                rows = cur.fetchall()
        return [
            {
                "card_id": card_id,
                "mode": mode,
                "total_reviews": total_reviews,
                "correct_reviews": correct_reviews,
                "accuracy": round(correct_reviews / total_reviews * 100, 1),
                "lapses": lapses,
            }
            for card_id, mode, total_reviews, correct_reviews, lapses in rows
        ]