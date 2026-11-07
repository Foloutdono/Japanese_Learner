# ── 主 — the modes a learner rides each line in (plan 273) ──────────
# study/main_modes.py says what the two choices mean; this reads them
# off the account. A comfort like the pace and the level: a failed
# read answers with the defaults, the modes the app always rode, and
# never fails the screen that asked.
import logging

from study import main_modes

logger = logging.getLogger(__name__)


def read(user_id: str) -> main_modes.Modes:
    """The learner's modes, every line answered (main_modes.resolve)."""
    from core.db import db_conn

    try:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT main_modes, extra_modes FROM user_profiles WHERE user_id = %s", (user_id,))
                row = cur.fetchone()
        finally:
            conn.close()
    except Exception:
        logger.exception("learner modes lookup failed")
        return main_modes.DEFAULT
    if not row:
        return main_modes.DEFAULT
    if isinstance(row, dict):
        return main_modes.resolve(row.get("main_modes"), row.get("extra_modes"))
    return main_modes.resolve(row[0], row[1])
