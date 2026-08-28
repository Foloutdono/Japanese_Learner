# ── The daily pace — 種別, enforced ──────────────────────────────
# Onboarding stores a daily new-item target (user_profiles.
# daily_new_target: 各駅停車 5 / 快速 10 / 特急 20, or any integer via
# Settings). This module turns it into the budget the card-serving
# endpoints spend: each batch response tops up with new cards only up
# to what is left of today's target, so a study session naturally
# shifts from "new material" to "reviews only" as the day's quota
# fills — which is exactly the promise the onboarding projection's
# curve was drawn from.
#
# Three deliberate softnesses, in the spirit of docs/adr/0005's
# "an explicit choice beats the stored value":
#   - No stored target (NULL — an account that never onboarded) means
#     no cap at all. Nothing changes for anyone who never asked for a
#     pace.
#   - Every batch endpoint accepts beyond_target=1 — the 臨時列車, the
#     extra train the learner boards on purpose. The cap is a default,
#     never a lock.
#   - The count is of ITEMS INTRODUCED (first-ever review today, see
#     srs.get_new_items_today), not of cards served: cards handed out
#     but never answered are not spent. A client queue refilled just
#     before its last new cards were answered can therefore overshoot
#     by a few — bounded by the session's small refill window, and the
#     honest direction to err (slightly more learning, never silently
#     less).
#
# The pace never touches /api/today: that queue serves reviews only,
# by its own documented design, and reviews are never budgeted.
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Pace:
    target: int
    new_today: int

    @property
    def remaining(self) -> int:
        return max(0, self.target - self.new_today)

    def payload(self) -> dict:
        """What rides on card-batch and /api/today responses."""
        return {"target": self.target, "newToday": self.new_today, "remaining": self.remaining}


def resolve_pace(user_id: str) -> Pace | None:
    """
    The learner's pace for this request, or None when no target is
    stored (or the lookup fails — pacing is a comfort, and a DB hiccup
    here must degrade to "no cap", never 500 a study screen; the same
    contract core/user_level.py keeps for the stored level).
    """
    # Imported lazily for the same reason user_level.py does: this
    # module is importable without a DATABASE_URL until actually used.
    from core.db import db_conn
    from core.srs_instance import srs

    try:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT daily_new_target FROM user_profiles WHERE user_id = %s",
                    (user_id,),
                )
                row = cur.fetchone()
        finally:
            conn.close()
        target = row[0] if row else None
        if not target or target <= 0:
            return None
        return Pace(target=int(target), new_today=srs.get_new_items_today(user_id))
    except Exception:
        logger.exception("pace lookup failed")
        return None


def new_card_limit(pace: Pace | None, beyond_target: bool) -> int | None:
    """The `new_limit` a route hands to batch_cache.pick_ids: None means
    unlimited (no target, or the learner asked for the extra train)."""
    if pace is None or beyond_target:
        return None
    return pace.remaining
