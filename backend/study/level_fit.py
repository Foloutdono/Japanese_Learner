"""
Does the level fit? (plan 224)

A learner chooses their level at the boarding on their own word, and
nothing afterwards asked whether the word was right. The answers they
give already say it, and this module reads them two ways:

  - the CHECKS behind the level. The level rule marks every stop behind
    it known and asks each card once, its first check spread over six
    weeks (study/level_rule.py); review_log marks those answers
    (`assumed`). A stop whose checks mostly fail was not behind the
    learner: they board there.
  - the FIRST ANSWERS at the level. A vocab card is asked cold the
    first time -- a kanji is shown before it is drilled (its first
    sight, plan 216) and a grammar point read (plan 186b), so only
    words measure what the learner knew on arrival. When nearly every new word is answered at the best grade,
    the level is behind them already: they could try the next one.

A move down is never forced and never automatic: the verdict is a
suggestion, and the learner's level is theirs (ADR 0005). It is also
cheap to take since plan 224: a move down gives the assumptions back as
new cards and deletes no history.

verdict() is pure; level_fit() reads the two through the engine.
"""
from study.difficulty import LEVELS
from study.level_rule import primary_mode, stops_behind

# How far back the answers are read: the level rule's spread, so the
# whole first round of checks counts and a learner's month-old start
# does not argue with what they answer now.
WINDOW_DAYS = 42

# Down: a stop behind the level with at least this many checks answered
# and fewer than this share of them passed. Twelve, so one bad morning
# is not a verdict; under 60%, because a stop the learner really stands
# on loses a few words to forgetting, not half of them.
MIN_CHECKS = 12
DOWN_BELOW = 0.6

# Up: at least this many words first met at the level, and this share
# of them answered at the best grade the first time they were asked. The checks behind, where
# there are enough of them, must hold as well.
MIN_WORDS = 30
UP_FROM = 0.85
KNOWN_GRADE = 4        # the four- and two-button bars' best answer
PASS_GRADE = 3

WORD_SOURCE = "vocab"


def _share(passed: int, total: int) -> float:
    return passed / total if total else 0.0


def verdict(level: str, checks: dict[str, tuple[int, int]], words: tuple[int, int]) -> dict:
    """`checks`: stop -> (passed, answered) over the stops behind
    `level`; `words`: (known the first time asked, met) for the level's
    words.
    Returns {"suggest": "down" | "up" | None, "to": level or None}.

    Down wins over up, and the LOWEST failing stop wins: an N3 boarder
    whose N5 checks fail belongs at N5 whatever N4's say, and is told so
    at once rather than one stop at a time."""
    if level not in LEVELS:
        return {"suggest": None, "to": None}
    for stop in stops_behind(level):
        passed, total = checks.get(stop, (0, 0))
        if total >= MIN_CHECKS and _share(passed, total) < DOWN_BELOW:
            return {"suggest": "down", "to": stop}
    index = LEVELS.index(level)
    known, met = words
    behind_hold = all(
        _share(*checks[stop]) >= UP_FROM
        for stop in stops_behind(level)
        if stop in checks and checks[stop][1] >= MIN_CHECKS
    )
    if index + 1 < len(LEVELS) and met >= MIN_WORDS and _share(known, met) >= UP_FROM and behind_hold:
        return {"suggest": "up", "to": LEVELS[index + 1]}
    return {"suggest": None, "to": None}


def tally_checks(rows, level: str) -> dict[str, tuple[int, int]]:
    """(raw id, quality) rows -> stop -> (passed, answered), over the
    JLPT stops behind `level`. A check elsewhere -- a kana sign (the
    kana door), a stop at or above the level (the basics course's skip
    at N5, a level since moved) -- is no evidence about what lies behind
    it, and is left out."""
    behind = set(stops_behind(level)) if level in LEVELS else set()
    out: dict[str, list[int]] = {}
    for raw_id, quality in rows:
        parts = raw_id.split("_", 2)
        if len(parts) < 2 or parts[1] not in behind:
            continue
        tally = out.setdefault(parts[1], [0, 0])
        tally[1] += 1
        if quality >= PASS_GRADE:
            tally[0] += 1
    return {stop: (p, n) for stop, (p, n) in out.items()}


def level_fit(srs, user_id: str, level: str, modes=None) -> dict:
    """The verdict for one learner, with the evidence it stands on, in
    the shape GET /api/profile/level-fit answers. `modes` is the
    learner's (plan 273): the words are read in their main mode, the one
    the level rule marked them known in."""
    checks = tally_checks(srs.get_level_checks(user_id, WINDOW_DAYS), level) if level in LEVELS else {}
    grades = (
        srs.get_first_answers(user_id, primary_mode(WORD_SOURCE, modes), f"{WORD_SOURCE}_{level}_", WINDOW_DAYS)
        if level in LEVELS else []
    )
    words = (sum(1 for q in grades if q >= KNOWN_GRADE), len(grades))
    return {
        "level": level,
        **verdict(level, checks, words),
        "checks": [
            {"level": stop, "passed": checks[stop][0], "answered": checks[stop][1]}
            for stop in stops_behind(level) if stop in checks
        ] if level in LEVELS else [],
        "words": {"known": words[0], "met": words[1]},
    }
