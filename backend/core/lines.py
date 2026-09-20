# ── 路線 — the lines a learner rides ─────────────────────────────
# The boarding asks what the learner wants to learn: vocabulary, kanji,
# grammar, any of the three (the kana are not offered -- every ticket
# rides the kana line, it is the one the others are read through, and
# it is free). Stored on user_profiles.lines as the chosen subset, in
# this order; NULL is an account that boarded before the question
# existed, and reads as all three everywhere.
#
# What the choice steers:
#   - the plan's figures and the projection date (domain/boarding.js
#     planFigures, routes/journey.py's itemsTotal): only the chosen
#     lines are promised, so the ride is priced at what it covers;
#   - the ghost train (srs.get_journey_item_counts): only the chosen
#     lines move it, for the same reason;
#   - the Learn gate (screens/LearnScreen.jsx): the chosen lines hang
#     first, the others are marked off the route and stay reachable --
#     the choice is a default, never a lock, the same softness as the
#     pace (core/pace.py).
#
# Settings › Learning changes it later (PATCH /api/profile/learning).
LINES = ("vocab", "kanji", "grammar")


def clean_lines(value):
    """A client's list -> the stored subset, in LINES order and without
    repeats; None stays None (the field was not sent). Raises ValueError
    on anything that is not a non-empty subset of LINES, so both payloads
    can hand it straight to a validator."""
    if value is None:
        return None
    if not isinstance(value, (list, tuple)):
        raise ValueError("must be a list of lines")
    unknown = [v for v in value if v not in LINES]
    if unknown:
        raise ValueError(f"unknown line(s): {', '.join(map(str, unknown))}; must be among {', '.join(LINES)}")
    chosen = [line for line in LINES if line in value]
    if not chosen:
        raise ValueError("at least one line must be chosen")
    return chosen


def lines_or_all(stored) -> list[str]:
    """What a stored value means: NULL (never asked) is every line."""
    return list(stored) if stored else list(LINES)
