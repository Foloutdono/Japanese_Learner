# ── 札の中身 — what a learner's flip cards show (plan 326) ──────────
# study/card_contents.py says what the fields mean; this reads the
# learner's choice off the account. A comfort like the modes: a failed
# read answers with today's card, nothing added, and never fails the
# screen that asked.
import logging

from study import card_contents

logger = logging.getLogger(__name__)


def read(user_id: str) -> dict[str, list[str]]:
    """The learner's fields, every line answered (card_contents.resolve)."""
    from core.db import db_conn

    try:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT card_contents FROM user_profiles WHERE user_id = %s", (user_id,))
                row = cur.fetchone()
        finally:
            conn.close()
    except Exception:
        logger.exception("card contents lookup failed")
        return card_contents.resolve(None)
    if not row:
        return card_contents.resolve(None)
    return card_contents.resolve(row.get("card_contents") if isinstance(row, dict) else row[0])
