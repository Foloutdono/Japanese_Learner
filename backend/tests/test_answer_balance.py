# Which slot the correct answer lands in (study/answer_balance.py).
#
# The check and the repair the exam papers and 理解 share. Pure: no
# database, no model, no import of either caller.
import random

import pytest

from study.answer_balance import (
    MAX_ANSWER_POSITION_SHARE,
    MIN_QUESTIONS_FOR_BALANCE_CHECK,
    balance_answers,
    position_skew,
)


def _paper(n: int = 10, correct: int = 0) -> list[dict]:
    """n questions, every one of them answered in the same slot -- the
    shape a model actually returns, and the whole reason this exists."""
    return [
        {"type": "comprehension", "question": f"Q{i}?",
         "options": ["a", "b", "c", "d"], "correct": correct}
        for i in range(n)
    ]


# ── The measurement ──────────────────────────────────────────

def test_one_slot_taking_everything_is_a_skew():
    assert position_skew([0] * 10) is not None


def test_an_even_spread_is_not():
    assert position_skew([0, 1, 2, 3] * 3) is None


def test_a_paper_too_short_to_spread_is_never_a_skew():
    """Four slots over seven questions cannot be even, and a paper is
    not wrong for that -- the floor is what keeps this from being a
    complaint about arithmetic."""
    assert position_skew([0] * (MIN_QUESTIONS_FOR_BALANCE_CHECK - 1)) is None


def test_the_threshold_is_the_share_it_says_it_is():
    # 6 of 10 is exactly the limit and passes; 7 is over it.
    assert MAX_ANSWER_POSITION_SHARE == 0.6
    assert position_skew([0] * 6 + [1, 2, 3, 1]) is None
    assert position_skew([0] * 7 + [1, 2, 3]) is not None


# ── The repair ───────────────────────────────────────────────

def test_an_all_A_paper_comes_out_spread():
    questions = _paper(10)
    assert balance_answers(questions, random.Random(7))
    assert position_skew([q["correct"] for q in questions]) is None


def test_the_answer_is_still_the_same_option():
    """Position only. Every option's text survives and the one that was
    correct is still the correct one -- nothing that reads the content
    can tell this ran."""
    questions = _paper(10)
    balance_answers(questions, random.Random(7))
    for q in questions:
        assert sorted(q["options"]) == ["a", "b", "c", "d"]
        assert q["options"][q["correct"]] == "a"


def test_it_shuffles_even_when_the_paper_is_too_short_to_measure():
    """The floor silences the CHECK, not the shuffle: a six-question
    paper is under it and must still not be answered all-A, which is
    what makes this unconditional rather than a repair."""
    rng = random.Random(3)
    somewhere_else = False
    for _ in range(20):
        questions = _paper(6)
        balance_answers(questions, rng)
        somewhere_else |= any(q["correct"] != 0 for q in questions)
    assert somewhere_else


def test_a_question_it_cannot_move_is_left_exactly_as_it_was():
    """A `correct` that indexes nothing is the parser's business.
    Rewriting one here would only hide it."""
    broken = {"question": "?", "options": ["a", "b", "c", "d"], "correct": 9}
    no_options = {"question": "?", "correct": 0}
    questions = [dict(broken), dict(no_options)]
    assert balance_answers(questions, random.Random(1))
    assert questions == [broken, no_options]


def test_the_rng_decides_and_nothing_else():
    """Same seed, same paper: the shuffle is reproducible, which is
    what lets a caller hand in a seeded Random and get a stable result."""
    a, b = _paper(12), _paper(12)
    balance_answers(a, random.Random(42))
    balance_answers(b, random.Random(42))
    assert [q["correct"] for q in a] == [q["correct"] for q in b]


class _NeverMoves(random.Random):
    """An rng whose shuffles all come out as they went in -- the luck
    that leaves a paper skewed however many times it is re-rolled."""

    def shuffle(self, seq):
        return None


def test_a_paper_it_cannot_spread_is_reported_rather_than_refused():
    """max_tries exhausted returns False with the last shuffle left in
    place -- the caller logs it and serves the exercise anyway, which
    is why this returns a verdict instead of raising."""
    questions = _paper(10)
    assert balance_answers(questions, _NeverMoves(1), max_tries=3) is False
    assert all(q["options"][q["correct"]] == "a" for q in questions)


@pytest.mark.parametrize("n", range(8, 13))
def test_every_comprehension_paper_size_can_be_spread(n):
    """COMPREHENSION_SPECS runs 8 (N5) to 12 (N1). Each of those sizes,
    a hundred times over, must reach a spread inside max_tries."""
    rng = random.Random(n)
    for _ in range(100):
        questions = _paper(n)
        assert balance_answers(questions, rng), f"{n} questions could not be spread"
