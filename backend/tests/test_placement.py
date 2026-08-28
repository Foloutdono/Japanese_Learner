# ── Placement paper: determinism, validity, recommendation ────────
# The score endpoint regenerates the paper from the seed instead of
# storing it, so "same seed → byte-identical paper" is not a nicety —
# it is the whole correctness of scoring. Pure-module tests are
# unittest.TestCase per this suite's convention; the round-trip test at
# the bottom uses the `client` fixture like the other route tests.
import unittest

from study.difficulty import LEVELS
from study.exam_scoring import flatten_questions, score_attempt
from study.placement import (
    PLACEMENT_LADDER,
    build_placement_paper,
    recommend_level,
    strip_answers,
)

_EXPECTED_COUNT = sum(len(kinds) for _, kinds in PLACEMENT_LADDER)


class PaperDeterminismTests(unittest.TestCase):
    def test_same_seed_builds_the_identical_paper(self) -> None:
        self.assertEqual(build_placement_paper(1234), build_placement_paper(1234))

    def test_different_seeds_build_different_papers(self) -> None:
        # Not guaranteed in principle, but with 8k+ words a collision
        # means the shuffle isn't consuming the seed at all.
        a = flatten_questions(build_placement_paper(1))
        b = flatten_questions(build_placement_paper(2))
        self.assertNotEqual([q["promptJp"] for q in a], [q["promptJp"] for q in b])


class PaperValidityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.paper = build_placement_paper(99)
        self.questions = flatten_questions(self.paper)

    def test_twelve_questions_across_five_level_sections(self) -> None:
        self.assertEqual(len(self.questions), _EXPECTED_COUNT)
        self.assertEqual([s["id"] for s in self.paper["sections"]], list(LEVELS))

    def test_every_question_is_a_valid_four_choice_mcq(self) -> None:
        for q in self.questions:
            self.assertEqual(q["type"], "mcq-text")
            self.assertIn("kind", q, q["id"])
            self.assertTrue(q["promptJp"])
            self.assertEqual([c["id"] for c in q["choices"]], ["c1", "c2", "c3", "c4"])
            self.assertIn(q["answer"], {c["id"] for c in q["choices"]})
            # Four distinct texts — a duplicated choice is a broken item.
            self.assertEqual(len({c["textJp"] for c in q["choices"]}), 4, q["id"])

    def test_strip_answers_leaves_no_answer_key(self) -> None:
        for q in strip_answers(self.questions):
            self.assertNotIn("answer", q)


class RecommendLevelTests(unittest.TestCase):
    def _stats(self, correct, total):
        return {"correct": correct, "total": total, "pct": 0}

    def test_nothing_answered_recommends_n5(self) -> None:
        self.assertEqual(recommend_level({}), "N5")

    def test_all_cleared_recommends_n1(self) -> None:
        per = {lvl: self._stats(3, 3) for lvl in LEVELS}
        self.assertEqual(recommend_level(per), "N1")

    def test_boards_after_the_highest_consecutively_cleared_level(self) -> None:
        per = {
            "N5": self._stats(3, 3),
            "N4": self._stats(3, 3),
            "N3": self._stats(1, 2),
            "N2": self._stats(0, 2),
            "N1": self._stats(0, 2),
        }
        self.assertEqual(recommend_level(per), "N3")

    def test_a_gap_stops_the_ladder_even_if_a_higher_level_cleared(self) -> None:
        # N5 cleared, N4 failed, N3 cleared (lucky guesses happen): the
        # recommendation is N4 — a consecutive run, not a best level.
        per = {
            "N5": self._stats(3, 3),
            "N4": self._stats(1, 3),
            "N3": self._stats(2, 2),
        }
        self.assertEqual(recommend_level(per), "N4")

    def test_two_thirds_is_the_clearing_line(self) -> None:
        self.assertEqual(recommend_level({"N5": self._stats(2, 3)}), "N4")
        self.assertEqual(recommend_level({"N5": self._stats(1, 2)}), "N5")


def test_placement_round_trip_scores_full_marks(client):
    # The client-visible flow: fetch a paper, answer everything right
    # (by regenerating the same seed locally), submit, get 12/12 and N1.
    started = client.post("/api/onboarding/placement")
    assert started.status_code == 200
    body = started.json()
    assert len(body["questions"]) == _EXPECTED_COUNT
    assert all("answer" not in q for q in body["questions"])

    key = {q["id"]: q["answer"]
           for q in flatten_questions(build_placement_paper(body["seed"]))}
    scored = client.post("/api/onboarding/placement/score",
                         json={"seed": body["seed"], "answers": key})
    assert scored.status_code == 200
    result = scored.json()
    assert result["correct"] == result["total"] == _EXPECTED_COUNT
    assert result["recommendedLevel"] == "N1"
    assert set(result["perLevel"]) == set(LEVELS)


def test_placement_partial_submission_is_legal(client):
    started = client.post("/api/onboarding/placement").json()
    scored = client.post("/api/onboarding/placement/score",
                         json={"seed": started["seed"], "answers": {}})
    assert scored.status_code == 200
    assert scored.json()["recommendedLevel"] == "N5"


if __name__ == "__main__":
    unittest.main()
