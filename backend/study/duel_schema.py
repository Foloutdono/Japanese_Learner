"""
対戦 — the duels' tables (plan 279).

Seven tables, each created here at import, each closed to the Data API
in the transaction that creates it (core/rls.py), each in its own
transaction so a failing ALTER never rolls back another's, each
declared in srs/data_structure.sql and erased with the account
(routes/account.py).

  pvp_friends    a friendship, one row per direction: "my friends" is
                 WHERE user_id = me
  pvp_requests   a request waiting, or refused (refused_at: the 30 days
                 before the same learner may ask again)
  pvp_blocks     who blocked whom
  pvp_reports    a profile reported, for a closed reason; read by a
                 person (scripts/read_reports.py), never by a dashboard
  pvp_duels      a duel: its paper (the sprint's questions and keys,
                 stored, because an asynchronous duel outlives a
                 release) and its state; no learner id -- the players
                 are its pvp_entries rows
  pvp_entries    a player in a duel: the question served and when, the
                 answers as the server timed them, the score, the Elo
                 before and after, what it paid
  pvp_ratings    a learner's Elo, apart from the 番付's XP
"""
import logging

from core.db import db_conn
from core.rls import enable_rls

logger = logging.getLogger(__name__)

TABLES = {
    "pvp_friends": """
        CREATE TABLE IF NOT EXISTS pvp_friends (
            user_id   TEXT NOT NULL,
            friend_id TEXT NOT NULL,
            since     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (user_id, friend_id)
        )
    """,
    "pvp_requests": """
        CREATE TABLE IF NOT EXISTS pvp_requests (
            user_id    TEXT NOT NULL,
            target_id  TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            refused_at TIMESTAMPTZ,
            PRIMARY KEY (user_id, target_id)
        )
    """,
    "pvp_blocks": """
        CREATE TABLE IF NOT EXISTS pvp_blocks (
            user_id    TEXT NOT NULL,
            blocked_id TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (user_id, blocked_id)
        )
    """,
    "pvp_reports": """
        CREATE TABLE IF NOT EXISTS pvp_reports (
            id          BIGSERIAL PRIMARY KEY,
            user_id     TEXT NOT NULL,
            reported_id TEXT NOT NULL,
            reason      TEXT NOT NULL,
            duel_id     BIGINT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (user_id, reported_id)
        )
    """,
    "pvp_duels": """
        CREATE TABLE IF NOT EXISTS pvp_duels (
            id          BIGSERIAL PRIMARY KEY,
            kind        TEXT NOT NULL,
            mode        TEXT NOT NULL,
            level       TEXT NOT NULL,
            seed        BIGINT NOT NULL,
            paper_rev   TEXT NOT NULL,
            paper       JSONB NOT NULL,
            status      TEXT NOT NULL,
            ghost       BOOLEAN NOT NULL DEFAULT FALSE,
            live_start  TIMESTAMPTZ,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at  TIMESTAMPTZ NOT NULL,
            resolved_at TIMESTAMPTZ
        )
    """,
    "pvp_entries": """
        CREATE TABLE IF NOT EXISTS pvp_entries (
            duel_id         BIGINT NOT NULL REFERENCES pvp_duels(id) ON DELETE CASCADE,
            user_id         TEXT NOT NULL,
            role            TEXT NOT NULL,
            answers         JSONB NOT NULL DEFAULT '[]',
            served_q        SMALLINT,
            served_at       TIMESTAMPTZ,
            score           INTEGER,
            rights          SMALLINT,
            started_at      TIMESTAMPTZ,
            finished_at     TIMESTAMPTZ,
            rating_before   INTEGER,
            rating_after    INTEGER,
            opponent_rating INTEGER,
            result          REAL,
            paid            SMALLINT NOT NULL DEFAULT 0,
            reviewed        BOOLEAN NOT NULL DEFAULT FALSE,
            xp              INTEGER NOT NULL DEFAULT 0,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (duel_id, user_id)
        )
    """,
    "pvp_ratings": """
        CREATE TABLE IF NOT EXISTS pvp_ratings (
            user_id      TEXT PRIMARY KEY,
            rating       INTEGER NOT NULL,
            games        INTEGER NOT NULL DEFAULT 0,
            wins         INTEGER NOT NULL DEFAULT 0,
            draws        INTEGER NOT NULL DEFAULT 0,
            losses       INTEGER NOT NULL DEFAULT 0,
            peak         INTEGER NOT NULL,
            placed_level TEXT NOT NULL,
            placed_at    TIMESTAMPTZ NOT NULL,
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """,
}

INDEXES = {
    "pvp_friends": ["CREATE INDEX IF NOT EXISTS pvp_friends_friend ON pvp_friends (friend_id)"],
    "pvp_requests": ["CREATE INDEX IF NOT EXISTS pvp_requests_target ON pvp_requests (target_id)"],
    "pvp_blocks": ["CREATE INDEX IF NOT EXISTS pvp_blocks_blocked ON pvp_blocks (blocked_id)"],
    "pvp_reports": ["CREATE INDEX IF NOT EXISTS pvp_reports_reported ON pvp_reports (reported_id)"],
    "pvp_duels": ["CREATE INDEX IF NOT EXISTS pvp_duels_seek ON pvp_duels (status, kind, level)"],
    "pvp_entries": [
        "CREATE INDEX IF NOT EXISTS pvp_entries_user ON pvp_entries (user_id, finished_at)",
        # One player meets a duel's first: two seekers can never both
        # take one run's seat (study/duels._seek).
        "CREATE UNIQUE INDEX IF NOT EXISTS pvp_entries_one_opponent ON pvp_entries (duel_id) WHERE role = 'opponent'",
    ],
    "pvp_ratings": ["CREATE INDEX IF NOT EXISTS pvp_ratings_rating ON pvp_ratings (rating DESC, user_id)"],
}


# Each table closed by name, in the transaction that creates it.
CLOSERS = {
    "pvp_friends": lambda cur: enable_rls(cur, "pvp_friends"),
    "pvp_requests": lambda cur: enable_rls(cur, "pvp_requests"),
    "pvp_blocks": lambda cur: enable_rls(cur, "pvp_blocks"),
    "pvp_reports": lambda cur: enable_rls(cur, "pvp_reports"),
    "pvp_duels": lambda cur: enable_rls(cur, "pvp_duels"),
    "pvp_entries": lambda cur: enable_rls(cur, "pvp_entries"),
    "pvp_ratings": lambda cur: enable_rls(cur, "pvp_ratings"),
}


def ensure_schema() -> None:
    """Create the seven tables, one transaction each, in FK order."""
    for table, ddl in TABLES.items():
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(ddl)
                CLOSERS[table](cur)
                for index in INDEXES.get(table, ()):
                    cur.execute(index)
            conn.commit()
        except Exception:
            conn.rollback()
            logger.exception("duels: %s could not be initialised", table)
        finally:
            conn.close()


try:
    ensure_schema()
except Exception:  # pragma: no cover - a missing DB must not stop import
    logger.exception("duels schema could not be initialised")
