"""
Per-user overrides for the frequency-tier system (see frequency_data.py)
— lets a user pin a specific kanji/word to a different tier than its
standard frequency rank would put it in.

Database-backed, same conventions as srs/srs.py: a Storage-wrapped
connection pool, self-migrating _init_db() (CREATE TABLE/INDEX IF NOT
EXISTS, so no separate migration step to remember to run), %s-style
psycopg2 params, ON CONFLICT upserts. See data_structure.sql for the
reference schema (frequency_overrides table) — _init_db() below creates
the same thing at runtime, exactly the way SRSEngine._init_db() does
for cards/card_modes/review_log.
"""
import logging
from typing import Any

from .storage import Storage

logger = logging.getLogger(__name__)


class FrequencyOverrideStore:
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.storage = Storage(database_url)
        self._init_db()

    def _log_sql(self, label: str, sql: str, params: Any = None) -> None:
        # logger.info("FrequencyOverrideStore SQL %s sql=%s params=%r", label, sql, params)
        pass

    def _init_db(self) -> None:
        with self.storage.cursor() as cur:
            sql_table = """
                CREATE TABLE IF NOT EXISTS frequency_overrides (
                    user_id TEXT NOT NULL,
                    domain TEXT NOT NULL,
                    item_key TEXT NOT NULL,
                    tier INTEGER NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (user_id, domain, item_key)
                )
            """
            self._log_sql("create_frequency_overrides_table", sql_table)
            cur.execute(sql_table)

            sql_index = """
                CREATE INDEX IF NOT EXISTS idx_frequency_overrides_user_domain
                ON frequency_overrides(user_id, domain)
            """
            self._log_sql("create_frequency_overrides_index", sql_index)
            cur.execute(sql_index)

    def get_overrides(self, user_id: str, domain: str) -> dict[str, int]:
        with self.storage.cursor() as cur:
            sql = """
                SELECT item_key, tier FROM frequency_overrides
                WHERE user_id = %s AND domain = %s
            """
            self._log_sql("get_overrides", sql, (user_id, domain))
            cur.execute(sql, (user_id, domain))
            rows = cur.fetchall()
        return {row["item_key"]: row["tier"] for row in rows}

    def set_overrides(self, user_id: str, domain: str, updates: dict[str, int]) -> None:
        """Upserts `updates` into the user's existing overrides for this
        domain — matches the /customize endpoint's documented behavior
        of merging in just the items being changed, not replacing the
        whole set."""
        if not updates:
            return
        with self.storage.cursor() as cur:
            sql = """
                INSERT INTO frequency_overrides(user_id, domain, item_key, tier, updated_at)
                VALUES (%s, %s, %s, %s, NOW())
                ON CONFLICT(user_id, domain, item_key) DO UPDATE SET
                    tier = EXCLUDED.tier,
                    updated_at = EXCLUDED.updated_at
            """
            params = [(user_id, domain, key, tier) for key, tier in updates.items()]
            self._log_sql("set_overrides", sql, params)
            cur.executemany(sql, params)

    def clear_overrides(self, user_id: str, domain: str, keys: list[str] | None = None) -> int:
        """Clear specific keys, or every override for this user+domain
        if `keys` is None/empty. Returns how many rows were removed."""
        with self.storage.cursor() as cur:
            if not keys:
                sql = "DELETE FROM frequency_overrides WHERE user_id = %s AND domain = %s"
                self._log_sql("clear_all_overrides", sql, (user_id, domain))
                cur.execute(sql, (user_id, domain))
            else:
                sql = """
                    DELETE FROM frequency_overrides
                    WHERE user_id = %s AND domain = %s AND item_key = ANY(%s)
                """
                self._log_sql("clear_some_overrides", sql, (user_id, domain, keys))
                cur.execute(sql, (user_id, domain, keys))
            return cur.rowcount
