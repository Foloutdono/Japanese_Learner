import copy
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from .models import CardState
from .scheduler import Scheduler
from .storage import Storage
from . import xp as xp_math

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

                self._log_sql("add_review_log_xp_earned", """
                    ALTER TABLE review_log
                    ADD COLUMN IF NOT EXISTS xp_earned INTEGER NOT NULL DEFAULT 0
                """)
                cur.execute("""
                    ALTER TABLE review_log
                    ADD COLUMN IF NOT EXISTS xp_earned INTEGER NOT NULL DEFAULT 0
                """)

                # XP that isn't a review. Until the daruma goals landed,
                # review_log.xp_earned *was* lifetime XP, so a goal
                # reward had nowhere to live except a fake review row —
                # which would have inflated review counts, streaks, and
                # the goals' own progress. A separate ledger keeps the
                # two kinds of XP apart at the source; the three places
                # that add them back up (get_lifetime_xp, get_leaderboard,
                # get_user_rank) union the tables explicitly.
                sql = """
                    CREATE TABLE IF NOT EXISTS xp_ledger (
                        id BIGSERIAL PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        source TEXT NOT NULL,
                        ref TEXT,
                        xp INTEGER NOT NULL,
                        awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """
                self._log_sql("create_xp_ledger_table", sql)
                cur.execute(sql)

                sql = "CREATE INDEX IF NOT EXISTS idx_xp_ledger_user ON xp_ledger(user_id)"
                self._log_sql("create_xp_ledger_index", sql)
                cur.execute(sql)

                # 七転び八起き — days bought back with a 起 token (see
                # routes/daruma.py). Kept here rather than alongside the
                # other daruma tables because get_streak has to read it:
                # a mended day counts as a studied day for streak
                # purposes and nothing else.
                sql = """
                    CREATE TABLE IF NOT EXISTS streak_mends (
                        user_id TEXT NOT NULL,
                        mend_day DATE NOT NULL,
                        mended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        PRIMARY KEY (user_id, mend_day)
                    )
                """
                self._log_sql("create_streak_mends_table", sql)
                cur.execute(sql)

    def _ensure_card(self, card_id: str) -> None:
        with self.storage.cursor() as cur:
            sql = "INSERT INTO cards(id) VALUES (%s) ON CONFLICT(id) DO NOTHING"
            self._log_sql("ensure_card", sql, (card_id,))
            cur.execute(sql, (card_id,))

    # ensure_cards(card_ids, mode) used to live here. It bulk-inserted a
    # `cards` row and a 13-column `card_modes` row per deck card per mode,
    # purely so get_new_cards' old `FROM cards` JOIN had rows to find —
    # 3,476 + 3,476 inserts to open N1 vocab and serve ten cards.
    #
    # Both halves are gone. get_new_cards now selects over the id list its
    # caller already has, so nothing needs materialising to be served, and
    # `_ensure_card` above covers the one row the FK genuinely requires,
    # on the review that creates the scheduler state. Removed rather than
    # kept unused: a bulk row-writer sitting on the engine with no callers
    # is an invitation to put the pre-write back.

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
        xp_info = self._log_review(card_id, mode, quality)
        result = self._to_dict(updated)
        result.update(xp_info)  # xp_earned, leveled_up, new_level
        # updated.total_reviews/interval_days are already in hand from
        # the save above, so the post-review stage (new/learning/
        # mastered — same classification get_bulk_stats uses) can be
        # included here for free. Callers that used to run a second
        # get_bulk_stats([card_id], mode) just to learn this — see
        # kana.py/kanji.py/vocab.py's post_*_review — can drop that
        # extra round trip entirely and read result["stage"] instead.
        result["stage"] = self._classify_stage(updated.total_reviews, updated.interval_days)
        return result

    @staticmethod
    def _classify_stage(total_reviews: int, interval_days: int) -> str:
        """Single source of truth for the new/learning/mastered split
        — used by both review() (above, from an in-memory CardState)
        and get_bulk_stats() (below, from a SQL row) so the two can
        never drift apart."""
        if total_reviews == 0:
            return "new"
        if interval_days >= 21:
            return "mastered"
        return "learning"

    def _log_review(self, card_id: str, mode: str, quality: int) -> dict[str, Any]:
        # card_id is always "{user_id}:{raw_id}" (see auth.prefixed) and
        # user_id itself is assumed colon-free everywhere else in this
        # codebase (e.g. _user_prefix_pattern's LIKE '{user_id}:%'), so
        # splitting on the first colon is safe.
        user_id = card_id.split(":", 1)[0]

        # Read lifetime XP *before* logging this review so the level
        # right before/after can be compared — this is the only way to
        # tell "just another review" apart from "that one crossed a
        # level threshold", which is the actual reward moment worth
        # calling out on the frontend (see XpToast's level-up variant).
        prior_xp = self.get_lifetime_xp(user_id)
        xp_earned = self._compute_review_xp(user_id, quality)

        with self.storage.cursor() as cur:
            sql = "INSERT INTO review_log(card_id, mode, quality, xp_earned) VALUES (%s, %s, %s, %s)"
            self._log_sql("log_review", sql, (card_id, mode, quality, xp_earned))
            cur.execute(sql, (card_id, mode, quality, xp_earned))

        prior_level = xp_math.level_from_xp(prior_xp)
        new_level = xp_math.level_from_xp(prior_xp + xp_earned)

        return {
            "xp_earned": xp_earned,
            "leveled_up": new_level != prior_level,
            "new_level": new_level,
        }

    def get_reviews_today(self, user_id: str) -> int:
        pattern = self._user_prefix_pattern(user_id)
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                sql = """
                    SELECT COUNT(*) FROM review_log
                    WHERE card_id LIKE %s
                      AND reviewed_at >= date_trunc('day', NOW())
                """
                self._log_sql("reviews_today", sql, (pattern,))
                cur.execute(sql, (pattern,))
                row = cur.fetchone()
        return int(row[0]) if row else 0

    def _compute_review_xp(self, user_id: str, quality: int) -> int:
        reviews_today = self.get_reviews_today(user_id)
        # The streak bonus only matters on the day's first review (see
        # xp_math.compute_review_xp), so skip the extra get_streak()
        # round trip entirely once that's no longer possible.
        streak_current = self.get_streak(user_id)["current"] if reviews_today == 0 else 0
        return xp_math.compute_review_xp(quality, reviews_today, streak_current)

    def get_lifetime_xp(self, user_id: str) -> int:
        pattern = self._user_prefix_pattern(user_id)
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                sql = """
                    SELECT
                        (SELECT COALESCE(SUM(xp_earned), 0) FROM review_log WHERE card_id LIKE %s)
                      + (SELECT COALESCE(SUM(xp), 0) FROM xp_ledger WHERE user_id = %s)
                """
                self._log_sql("get_lifetime_xp", sql, (pattern, user_id))
                cur.execute(sql, (pattern, user_id))
                row = cur.fetchone()
        return int(row[0]) if row else 0

    def award_xp(self, user_id: str, source: str, ref: str, xp: int) -> dict[str, Any]:
        """Grant XP that didn't come from answering a card (a claimed
        daruma, today). Returns the same {xp_earned, leveled_up,
        new_level} shape review() does, so a goal reward can drop
        straight into the frontend's existing XpToast level-up
        celebration with no second code path."""
        prior_xp = self.get_lifetime_xp(user_id)

        with self.storage.cursor() as cur:
            sql = "INSERT INTO xp_ledger(user_id, source, ref, xp) VALUES (%s, %s, %s, %s)"
            self._log_sql("award_xp", sql, (user_id, source, ref, xp))
            cur.execute(sql, (user_id, source, ref, xp))

        prior_level = xp_math.level_from_xp(prior_xp)
        new_level = xp_math.level_from_xp(prior_xp + xp)
        return {
            "xp_earned": xp,
            "leveled_up": new_level != prior_level,
            "new_level": new_level,
        }

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
        """
        Cards in this mode the user has never actually reviewed.

        When `card_ids` is given — which every production caller does, one
        per study endpoint — the caller's own deck list IS the universe, so
        this no longer reads the `cards` table at all. That matters because
        `FROM cards` was the ONLY reason the read path needed rows to exist
        up front: every study endpoint used to call
        `ensure_cards(card_ids, mode)` before selecting, writing one `cards`
        row and one 13-column `card_modes` row per deck card per mode purely
        so this JOIN would find something. Opening N1 vocab meant 3,476 +
        3,476 inserts for a single mode, on a request that then served ten
        cards. Selecting over the passed ids instead makes "new" a *negative*
        fact — no reviewed row exists — so nothing has to be materialised
        before a card can be served, and a row is written on first review
        instead (see review() -> _save_state).

        `total_reviews > 0` rather than `= 0` inside the NOT EXISTS: a row
        that exists but has never been reviewed still counts as new, which
        keeps the pre-existing rows in the database behaving exactly as they
        did before this change.

        The `card_ids is None` branch keeps the old whole-table scan. Its
        only callers are build_session and get_due_count, neither of which
        is reachable from a route today.
        """
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                if card_ids:
                    sql = """
                        SELECT ids.id
                        FROM unnest(%s::text[]) AS ids(id)
                        WHERE NOT EXISTS (
                            SELECT 1 FROM card_modes cm
                            WHERE cm.card_id = ids.id
                              AND cm.mode = %s
                              AND cm.total_reviews > 0
                        )
                        ORDER BY random()
                    """
                    params: list[Any] = [card_ids, mode]
                else:
                    sql = """
                        SELECT c.id
                        FROM cards c
                        LEFT JOIN card_modes cm
                          ON cm.card_id = c.id AND cm.mode = %s
                        WHERE (cm.card_id IS NULL OR cm.total_reviews = 0)
                        ORDER BY random()
                    """
                    params = [mode]
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
            if not row:
                result[card_id] = "new"
            else:
                result[card_id] = self._classify_stage(row[1], row[2])
        return result

    def _load_states_bulk(self, card_ids: list[str], mode: str) -> dict[str, CardState]:
        """Like _load_state, but for many cards in one query. An id with no
        row yet falls back to the same default CardState _load_state itself
        would hand back — which is now the COMMON case, not the exception:
        callers no longer pre-materialise the deck, so a card carries no
        card_modes row until its first review."""
        if not card_ids:
            return {}
        with self.storage.cursor() as cur:
            sql = """
                SELECT card_id, mode, difficulty, stability, interval_days,
                       repetitions, lapses, learning_step, is_learning,
                       next_review, total_reviews, correct_reviews, last_quality
                FROM card_modes
                WHERE mode = %s AND card_id = ANY(%s)
            """
            self._log_sql("load_states_bulk", sql, (mode, card_ids))
            cur.execute(sql, (mode, card_ids))
            rows = cur.fetchall()
        found = {row['card_id']: self._state_from_row(row) for row in rows}
        return {cid: found.get(cid, CardState(card_id=cid, mode=mode)) for cid in card_ids}

    def preview_reviews_bulk(
        self, card_ids: list[str], mode: str, user_id: str,
        qualities: list[int] | None = None,
    ) -> dict[str, dict[int, dict[str, Any]]]:
        """
        Dry-run review() for every card in `card_ids`, across each of
        `qualities` (default 0-5), against each card's *current* saved
        state — without persisting anything or touching review_log.
        Lets kana.py/kanji.py/vocab.py attach the exact xp/level/stage
        outcome of every possible rating directly onto each card's
        batch payload (see _build_*_card's "review_preview" field), so
        the frontend never has to guess at — or wait on a round trip
        for — what a rating is about to do. That guessing (an
        optimistic client-side XP estimate, reconciled once the real
        review POST resolved) is what was letting the XP toast finish
        and release its "safe to advance" gate well before a slow or
        cold-starting backend had actually confirmed a stage promotion
        — which is why the card stamp could silently never show. With
        the outcome known up front, nothing on screen has to wait on
        that request at all.

        prior_xp/reviews_today/streak are read once for the whole
        batch, not once per card — they're per-user, not per-card, and
        this is a hypothetical preview, so "reviewing" one card here
        never actually changes them for the next.

        One caveat worth knowing: because this is computed once at
        batch-fetch time, the *stage* prediction for a given card stays
        exactly correct however long it sits in the queue (it only
        depends on that card's own saved state), but the *xp_earned*
        figure can drift by a few points if the user racks up several
        other reviews — moving reviews_today/streak along — before
        finally rating this particular card. Same order of inaccuracy
        the old client-side guess had, just anchored to a real number
        instead of a blind estimate, and it no longer affects whether
        the stamp shows.
        """
        qualities = qualities if qualities is not None else [0, 1, 2, 3, 4, 5]
        states = self._load_states_bulk(card_ids, mode)

        prior_xp = self.get_lifetime_xp(user_id)
        reviews_today = self.get_reviews_today(user_id)
        streak_current = self.get_streak(user_id)["current"] if reviews_today == 0 else 0
        prior_level = xp_math.level_from_xp(prior_xp)

        result: dict[str, dict[int, dict[str, Any]]] = {}
        for card_id in card_ids:
            base_state = states[card_id]
            per_quality: dict[int, dict[str, Any]] = {}
            for quality in qualities:
                # A fresh copy per quality — every hypothetical rating
                # branches off the same saved state, never off the
                # previous quality's hypothetical outcome.
                updated = self.scheduler.review(copy.deepcopy(base_state), quality)
                xp_earned = xp_math.compute_review_xp(quality, reviews_today, streak_current)
                new_level = xp_math.level_from_xp(prior_xp + xp_earned)
                per_quality[quality] = {
                    "xp_earned": xp_earned,
                    "leveled_up": new_level != prior_level,
                    "new_level": new_level,
                    "stage": self._classify_stage(updated.total_reviews, updated.interval_days),
                }
            result[card_id] = per_quality
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

    def _studied_days(self, user_id: str) -> set:
        """Every day this user has a review on, plus every day they've
        bought back with a 起 token. Both count as "showed up" for
        streak purposes and for nothing else — mended days are
        deliberately invisible to review counts, XP, and goal
        progress."""
        pattern = self._user_prefix_pattern(user_id)
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                sql = """
                    SELECT DISTINCT date_trunc('day', reviewed_at)::date AS day
                    FROM review_log
                    WHERE card_id LIKE %s
                    UNION
                    SELECT mend_day FROM streak_mends WHERE user_id = %s
                """
                self._log_sql("studied_days", sql, (pattern, user_id))
                cur.execute(sql, (pattern, user_id))
                return {row[0] for row in cur.fetchall()}

    def get_streak(self, user_id: str) -> dict[str, int]:
        """Current and longest consecutive-day streak of having at least one review."""
        day_set = self._studied_days(user_id)

        if not day_set:
            return {"current": 0, "longest": 0}

        today = datetime.now(timezone.utc).date()

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

    def mendable_day(self, user_id: str):
        """The single missed day that a 起 token could buy back, or None.

        Deliberately narrow: only the gap immediately before the current
        run, and only if filling it actually reconnects to an earlier
        studied day. You can rescue the streak you just dropped — you
        can't retroactively invent a month you didn't study.

        Returns a `date`, or None when there's nothing worth mending
        (no history yet, or the day before the run was never studied
        either, so mending it would extend the streak by exactly one
        and stop).
        """
        day_set = self._studied_days(user_id)
        if not day_set:
            return None

        today = datetime.now(timezone.utc).date()
        # Walk back to the start of the current run the same way
        # get_streak does, then look one further.
        cursor = today if today in day_set else today - timedelta(days=1)
        if cursor not in day_set:
            # Two or more days missed — past saving with one token.
            return None
        while cursor in day_set:
            cursor -= timedelta(days=1)

        gap = cursor
        return gap if (gap - timedelta(days=1)) in day_set else None

    def mend_streak(self, user_id: str, day) -> None:
        with self.storage.cursor() as cur:
            sql = """
                INSERT INTO streak_mends(user_id, mend_day) VALUES (%s, %s)
                ON CONFLICT (user_id, mend_day) DO NOTHING
            """
            self._log_sql("mend_streak", sql, (user_id, day))
            cur.execute(sql, (user_id, day))

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

    def get_leaderboard(self, limit: int = 20) -> list[dict[str, Any]]:
        """Top users by lifetime XP. Returns raw user_id — profile.py
        joins this against user_profiles for display names."""
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                sql = """
                    SELECT user_id, SUM(xp) AS xp FROM (
                        SELECT split_part(card_id, ':', 1) AS user_id, xp_earned AS xp FROM review_log
                        UNION ALL
                        SELECT user_id, xp FROM xp_ledger
                    ) all_xp
                    GROUP BY user_id
                    ORDER BY xp DESC
                    LIMIT %s
                """
                self._log_sql("get_leaderboard", sql, (limit,))
                cur.execute(sql, (limit,))
                rows = cur.fetchall()
        return [{"user_id": user_id, "xp": int(xp)} for user_id, xp in rows]

    def get_user_rank(self, user_id: str) -> dict[str, Any]:
        """This user's lifetime XP and 1-based rank among everyone with
        at least one review — used so the leaderboard can show "you're
        #47" even when only the top N are listed."""
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                sql = """
                    WITH totals AS (
                        SELECT user_id, SUM(xp) AS xp FROM (
                            SELECT split_part(card_id, ':', 1) AS user_id, xp_earned AS xp FROM review_log
                            UNION ALL
                            SELECT user_id, xp FROM xp_ledger
                        ) all_xp
                        GROUP BY user_id
                    )
                    SELECT t1.xp, (SELECT COUNT(*) + 1 FROM totals t2 WHERE t2.xp > t1.xp)
                    FROM totals t1
                    WHERE t1.user_id = %s
                """
                self._log_sql("get_user_rank", sql, (user_id,))
                cur.execute(sql, (user_id,))
                row = cur.fetchone()
        if not row:
            return {"xp": 0, "rank": None}
        return {"xp": int(row[0]), "rank": int(row[1])}

    def get_total_reviews(self, user_id: str) -> int:
        pattern = self._user_prefix_pattern(user_id)
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                sql = "SELECT COUNT(*) FROM review_log WHERE card_id LIKE %s"
                self._log_sql("get_total_reviews", sql, (pattern,))
                cur.execute(sql, (pattern,))
                row = cur.fetchone()
        return int(row[0]) if row else 0

    def get_mastered_count(self, user_id: str) -> int:
        """Mastered (card, mode) pairs across every category — a
        simpler, unscoped version of the per-category counts /api/stats
        already computes, good enough for badge thresholds."""
        pattern = self._user_prefix_pattern(user_id)
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                sql = """
                    SELECT COUNT(*) FROM card_modes
                    WHERE card_id LIKE %s AND total_reviews > 0 AND interval_days >= 21
                """
                self._log_sql("get_mastered_count", sql, (pattern,))
                cur.execute(sql, (pattern,))
                row = cur.fetchone()
        return int(row[0]) if row else 0

    def get_best_quality_streak(self, user_id: str, min_quality: int = 4) -> int:
        """Longest run of consecutive reviews (by time, across all cards/
        modes) with quality >= min_quality — a classic gaps-and-islands
        query: the difference between two row-number sequences is
        constant within an unbroken run and changes at every break."""
        pattern = self._user_prefix_pattern(user_id)
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                sql = """
                    WITH ordered AS (
                        SELECT
                            quality,
                            ROW_NUMBER() OVER (ORDER BY reviewed_at) -
                            ROW_NUMBER() OVER (PARTITION BY (quality >= %s) ORDER BY reviewed_at) AS grp
                        FROM review_log
                        WHERE card_id LIKE %s
                    )
                    SELECT COALESCE(MAX(cnt), 0) FROM (
                        SELECT COUNT(*) AS cnt FROM ordered WHERE quality >= %s GROUP BY grp
                    ) runs
                """
                self._log_sql("get_best_quality_streak", sql, (min_quality, pattern, min_quality))
                cur.execute(sql, (min_quality, pattern, min_quality))
                row = cur.fetchone()
        return int(row[0]) if row else 0

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

    # ── Rhythm: how you study, not how much ───────────────────
    # Three aggregates the stats screen explores. All three read
    # something the app has always recorded and never shown: the clock
    # on review_log, the rating on review_log, and the interval the
    # scheduler landed on in card_modes.

    def get_review_hours(self, user_id: str, tz_offset: int = 0) -> list[int]:
        """Reviews per hour of the *local* day — 24 buckets, 0..23.

        `tz_offset` is minutes east of UTC, the same convention the
        daruma routes take (`-new Date().getTimezoneOffset()` on the
        client). reviewed_at is stored in UTC, so without the shift a
        Paris user's 21:00 session is filed under 19:00 and the whole
        chart is quietly wrong for everyone who isn't on UTC.
        """
        pattern = self._user_prefix_pattern(user_id)
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                sql = """
                    SELECT
                        EXTRACT(HOUR FROM reviewed_at + (%s || ' minutes')::interval)::int AS hour,
                        COUNT(*)
                    FROM review_log
                    WHERE card_id LIKE %s
                    GROUP BY 1
                """
                self._log_sql("get_review_hours", sql, (tz_offset, pattern))
                cur.execute(sql, (tz_offset, pattern))
                rows = cur.fetchall()

        hours = [0] * 24
        for hour, count in rows:
            hours[int(hour) % 24] = int(count)
        return hours

    def get_quality_mix(self, user_id: str) -> dict[str, int]:
        """How many times each rating has been given, all time."""
        pattern = self._user_prefix_pattern(user_id)
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                sql = """
                    SELECT quality, COUNT(*)
                    FROM review_log
                    WHERE card_id LIKE %s
                    GROUP BY 1
                    ORDER BY 1
                """
                self._log_sql("get_quality_mix", sql, (pattern,))
                cur.execute(sql, (pattern,))
                rows = cur.fetchall()
        return {str(int(quality)): int(count) for quality, count in rows}

    def get_interval_histogram(self, user_id: str) -> list[dict[str, int]]:
        """(interval, number of card-modes sitting at it) for every card
        that has been reviewed at least once.

        Returned raw rather than pre-bucketed: the buckets are a display
        choice, and keeping them on the client means the screen can
        re-cut them without a backend change.
        """
        pattern = self._user_prefix_pattern(user_id)
        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                sql = """
                    SELECT interval_days, COUNT(*)
                    FROM card_modes
                    WHERE card_id LIKE %s
                      AND total_reviews > 0
                    GROUP BY 1
                    ORDER BY 1
                """
                self._log_sql("get_interval_histogram", sql, (pattern,))
                cur.execute(sql, (pattern,))
                rows = cur.fetchall()
        return [{"days": int(days), "count": int(count)} for days, count in rows]

    # ── Daruma goal facts ─────────────────────────────────────
    # Everything srs/daruma.py's goal catalogue can be measured against,
    # in four round trips rather than one per goal — the pool is sampled
    # per user per day, so which metrics are needed isn't knowable ahead
    # of time and computing all of them is cheaper than being clever.
    #
    # A card's category is the first underscore-token of its raw id
    # (kana_..., vocab_N5_..., kanji_N5_..., grammar_N5_..., custom_...),
    # which is what makes "study three different categories today"
    # answerable without joining against the content tables.
    def _perfect_run(self, cur, pattern: str, window: str | None) -> int:
        """Longest unbroken run of quality>=4 reviews inside `window`
        ('day' | 'week' | None for lifetime). Same gaps-and-islands
        shape as get_best_quality_streak, just windowed — a run is
        recomputed within the window rather than clipped from a global
        one, so "ten flawless in a row today" means today."""
        clause = f" AND reviewed_at >= date_trunc('{window}', NOW())" if window else ""
        sql = f"""
            WITH ordered AS (
                SELECT quality,
                       ROW_NUMBER() OVER (ORDER BY reviewed_at) -
                       ROW_NUMBER() OVER (PARTITION BY (quality >= 4) ORDER BY reviewed_at) AS grp
                FROM review_log
                WHERE card_id LIKE %s{clause}
            )
            SELECT COALESCE(MAX(cnt), 0) FROM (
                SELECT COUNT(*) AS cnt FROM ordered WHERE quality >= 4 GROUP BY grp
            ) runs
        """
        cur.execute(sql, (pattern,))
        row = cur.fetchone()
        return int(row[0]) if row else 0

    def get_daruma_facts(self, user_id: str, tz_offset: int = 0) -> dict[str, Any]:
        """
        `tz_offset` is minutes east of UTC (the frontend sends
        `-new Date().getTimezoneOffset()`), and is used for exactly one
        thing: deciding whether a review happened at dawn or at night
        from the reviewer's point of view. Day and week boundaries stay
        UTC, matching get_reviews_today / get_streak / the stats screen
        — having "today" mean two different things in two parts of the
        same app would be worse than a dawn goal that's an hour off at
        the edges.
        """
        pattern = self._user_prefix_pattern(user_id)
        # Category = first token of the raw (unprefixed) card id.
        category = "split_part(split_part(card_id, ':', 2), '_', 1)"
        today = "date_trunc('day', NOW())"

        with self.storage.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT
                      COUNT(*) FILTER (WHERE reviewed_at >= {today}),
                      COALESCE(SUM(xp_earned) FILTER (WHERE reviewed_at >= {today}), 0),
                      COUNT(*) FILTER (WHERE reviewed_at >= {today} AND quality >= 3),
                      COUNT(DISTINCT {category}) FILTER (WHERE reviewed_at >= {today}),
                      MIN(reviewed_at) FILTER (WHERE reviewed_at >= {today}),
                      MAX(reviewed_at) FILTER (WHERE reviewed_at >= {today}),
                      COUNT(*),
                      COALESCE(SUM(xp_earned), 0),
                      COUNT(DISTINCT date_trunc('day', reviewed_at)::date),
                      COUNT(DISTINCT {category})
                    FROM review_log
                    WHERE card_id LIKE %s AND reviewed_at >= date_trunc('week', NOW())
                """, (pattern,))
                (reviews_today, xp_today, correct_today, cats_today, first_today,
                 last_today, reviews_week, xp_week, days_week, cats_week) = cur.fetchone()

                cur.execute("""
                    WITH firsts AS (
                        SELECT card_id, MIN(reviewed_at) AS first_at
                        FROM review_log WHERE card_id LIKE %s GROUP BY card_id
                    )
                    SELECT
                      COUNT(*) FILTER (WHERE first_at >= date_trunc('day', NOW())),
                      COUNT(*) FILTER (WHERE first_at >= date_trunc('week', NOW()))
                    FROM firsts
                """, (pattern,))
                new_today, new_week = cur.fetchone()

                cur.execute("""
                    SELECT
                      (SELECT COUNT(*) FROM review_log WHERE card_id LIKE %s),
                      (SELECT COUNT(*) FROM card_modes
                        WHERE card_id LIKE %s AND total_reviews > 0 AND interval_days >= 21),
                      (SELECT COUNT(*) FROM card_modes
                        WHERE card_id LIKE %s AND total_reviews > 0 AND next_review <= NOW()),
                      (SELECT COUNT(*) FROM streak_mends WHERE user_id = %s),
                      -- Best single day ever, for the 韋駄天 title
                      -- (see srs/cosmetics.py). A lifetime high-water
                      -- mark, not a rolling window: the point of the
                      -- title is that you did it once.
                      (SELECT COALESCE(MAX(cnt), 0) FROM (
                          SELECT COUNT(*) AS cnt FROM review_log
                          WHERE card_id LIKE %s
                          GROUP BY date_trunc('day', reviewed_at)
                       ) d)
                """, (pattern, pattern, pattern, user_id, pattern))
                reviews_total, mastered_total, due_now, rises_total, best_day = cur.fetchone()

                run_today = self._perfect_run(cur, pattern, "day")
                run_week = self._perfect_run(cur, pattern, "week")
                run_life = self._perfect_run(cur, pattern, None)

        def local_hour(ts):
            if ts is None:
                return None
            minutes = ts.hour * 60 + ts.minute + tz_offset
            return (minutes // 60) % 24

        streak = self.get_streak(user_id)
        reviews_today = int(reviews_today)
        dawn = local_hour(first_today)
        dusk = local_hour(last_today)

        return {
            "reviews_today": reviews_today,
            "xp_today": int(xp_today),
            "accuracy_today": round(correct_today / reviews_today * 100) if reviews_today else 0,
            "categories_today": int(cats_today),
            "new_cards_today": int(new_today),
            "perfect_run_today": run_today,
            # A cleared queue only counts as cleared if you cleared it —
            # otherwise every user who has never studied wakes up with
            # this goal already satisfied.
            "due_cleared": 1 if (due_now == 0 and reviews_today > 0) else 0,
            "dawn_today": 1 if (dawn is not None and dawn < 8) else 0,
            "night_today": 1 if (dusk is not None and dusk >= 22) else 0,

            "reviews_week": int(reviews_week),
            "xp_week": int(xp_week),
            "study_days_week": int(days_week),
            "categories_week": int(cats_week),
            "new_cards_week": int(new_week),
            "perfect_run_week": run_week,

            "reviews_total": int(reviews_total),
            "best_day_reviews": int(best_day),
            "mastered_total": int(mastered_total),
            "perfect_run_lifetime": run_life,
            "streak_current": streak["current"],
            "streak_longest": streak["longest"],
            "rises_total": int(rises_total),
            "due_now": int(due_now),
        }