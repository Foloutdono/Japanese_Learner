# ── Which slot the correct answer lands in ───────────────────────
# A model asked to write four options and then say which one is right
# puts the right one first far more often than one time in four. It is
# not a content defect -- every option is plausible, every question is
# answerable, and no check that reads the text can see anything wrong
# -- but a learner who has noticed the habit can score without reading,
# and an exercise that can be passed without reading measures nothing.
#
# The exam side met this first: exam_validation.py's
# validate_answer_balance / repair_answer_balance, over the {choices,
# answer} shape a paper's questions carry. 理解 (routes/reading.py)
# carries the other shape -- {options: [...], correct: <index>} -- and
# had no such gate at all. Measured on the one body of its content that
# can be counted without a database, the hand-written seeds under
# content/comprehension/: 284 of 300 questions answered in slot A, 95%,
# and not one in D. The prompt's own schema example shows
# "correct": 0, and an author writes the true option before inventing
# the three false ones -- the two halves of the same habit.
#
# What lives here is the rule both halves measure by, in one copy, plus
# the repair for the comprehension shape. Two features each inventing
# their own threshold for "too skewed" is exactly the drift these
# numbers being in one place prevents.
import random

# A generator that always puts the correct answer in the same slot is a
# bug, even though it never emits an outright-wrong item; on a paper
# with only a handful of questions this can't be perfectly uniform, so
# this catches a real skew rather than expecting an exact 25/25/25/25
# split.
MAX_ANSWER_POSITION_SHARE = 0.6
MIN_QUESTIONS_FOR_BALANCE_CHECK = 8


def position_skew(positions: list[int]) -> str | None:
    """The measurement itself: the slot the correct answer falls in,
    counted over a whole paper. A sentence naming the skew, or None
    when the spread is acceptable -- including when there are too few
    questions for the spread to mean anything, since four slots over
    five questions cannot be even and a paper is not wrong for that."""
    if len(positions) < MIN_QUESTIONS_FOR_BALANCE_CHECK:
        return None
    counts: dict[str, int] = {}
    for i in positions:
        counts[str(i)] = counts.get(str(i), 0) + 1
    total = sum(counts.values())
    if not total:
        return None
    if max(counts.values()) / total > MAX_ANSWER_POSITION_SHARE:
        return f"answer position skewed: {counts} over {total} questions"
    return None


def _shufflable(question: object) -> bool:
    """A question this can move the answer around in without changing
    what it asks. Anything else is left exactly as it was: a malformed
    question is the parser's business, and silently rewriting one here
    would only hide it."""
    if not isinstance(question, dict):
        return False
    options = question.get("options")
    correct = question.get("correct")
    return (
        isinstance(options, list) and len(options) > 1
        and isinstance(correct, int) and not isinstance(correct, bool)
        and 0 <= correct < len(options)
    )


def _shuffle_options(question: dict, rng: random.Random) -> None:
    """One question's options re-ordered in place, `correct` following
    the option it pointed at. Position only: no option's text changes
    and the same one is still the right answer, so nothing that reads
    the content can tell this ran."""
    options = question["options"]
    order = list(range(len(options)))
    rng.shuffle(order)
    question["options"] = [options[i] for i in order]
    question["correct"] = order.index(question["correct"])


def balance_answers(questions: list[dict], rng: random.Random, max_tries: int = 25) -> bool:
    """Re-randomize which slot each correct option sits in, over the
    {options, correct} shape, in place. True when the spread came out
    acceptable.

    Unconditional, unlike the exam side's repair, and for a reason: a
    paper there arrives already shuffled by its own generator, so only
    a measured skew is worth undoing. Here the order IS the model's
    preference -- there is nothing in it to preserve -- so it is
    replaced every time and then measured, the measurement deciding
    only whether to try again.

    A False is worth logging and nothing more. A shuffled paper that
    happened to fail the spread check is still far better than the
    order it replaced, and refusing the exercise over shuffle luck
    would cost a learner a two-minute generation for nothing."""
    movable = [q for q in questions if _shufflable(q)]
    if not movable:
        return True
    for _ in range(max(1, max_tries)):
        for question in movable:
            _shuffle_options(question, rng)
        if position_skew([q["correct"] for q in movable]) is None:
            return True
    return False
