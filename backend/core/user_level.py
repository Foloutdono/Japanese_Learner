# ── The learner's JLPT level ─────────────────────────────────────
# No such value exists yet. `user_profiles` (srs/data_structure.sql) holds
# only a username; `routes/profile.py`'s "level" is the XP/gamification
# level from srs/xp.py, which is a different concept entirely and must
# never be confused with this one. Every screen that needs a JLPT level
# today asks the learner to pick one for that session (reading practice's
# TierPicker, the exam catalog, the deck browser).
#
# It WILL exist: a future onboarding flow sets it, either by
# self-declaration or by a placement test. The trap is building against
# "no level exists" and then re-finding every assumption when it does, or
# building against a per-session picker and ending up with two competing
# notions of the learner's level.
#
# The fix is one resolver, not a column. Every level-dependent decision
# routes through resolve_level() below, and no caller reads a level from
# anywhere else or hardcodes a default. Its resolution order today is
# "explicit request, then a conservative default"; when onboarding lands,
# one step is inserted between them (the stored learner level) and no
# call site changes.
#
# Precedence is deliberate: an explicit choice beats the stored level. A
# learner reading above their level on purpose should not be
# second-guessed by their own profile.
#
# See docs/adr/0005-learner-level-behind-a-resolver.md for the full
# reasoning, including the alternatives this rejected.
from study.difficulty import LEVELS

DEFAULT_LEVEL = "N5"


def resolve_level(user_id: str, requested: str | None = None) -> str:
    """The JLPT level to treat `user_id` as, for one request.

    `user_id` is currently unused -- that is intentional, not an oversight.
    It is here so the stored-learner-level lookup onboarding adds later
    slots in without changing this function's signature or any of its
    call sites. Do not remove it as dead.

    `requested` is whatever a caller already has in hand (a session
    picker, a URL parameter). A value that isn't a real level is ignored
    rather than raised -- a bad query parameter must not 500 a study
    screen -- and resolution falls through to the next step exactly as if
    nothing had been requested.
    """
    if requested in LEVELS:
        return requested

    # Insertion point for onboarding: once user_profiles carries a
    # stored JLPT level, look it up here (keyed on user_id) and return
    # it before falling through to DEFAULT_LEVEL. Every existing caller
    # keeps working unchanged.

    return DEFAULT_LEVEL
