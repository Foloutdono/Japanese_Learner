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
    CLIMB,
    PER_LEVEL,
    PLACEMENT_LADDER,
    build_placement_paper,
    judge,
    level_block,
    recommend_level,
    strip_answers,
    walk,
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

    def test_no_seed_prints_an_empty_prompt(self) -> None:
        """A word the deck writes in kana, put on a reading item, printed
        no prompt at all over its four spellings -- on one paper in four
        (80 of the first 300 seeds). Seed 99 missed it until plan 260
        moved cards between levels and reshuffled the pools."""
        for seed in range(30):
            for q in flatten_questions(build_placement_paper(seed)):
                self.assertTrue(q["promptJp"], (seed, q["id"]))

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


# ── The climb (plan 224) ──────────────────────────────────────────
# Asked at N5 and going up while the learner clears each level: three
# right in a row or four right clears it, a second miss does not, and
# the learner boards at the first level not cleared.
R, W = True, False


class JudgeTests(unittest.TestCase):
    def test_three_straight_or_four_right_clears_and_two_misses_end_it(self) -> None:
        self.assertEqual(judge([R, R, R]), "cleared")
        self.assertEqual(judge([R, W, R, R, R]), "cleared")
        self.assertEqual(judge([W, R, R, R, R]), "cleared")
        self.assertEqual(judge([R, W, W]), "failed")
        self.assertEqual(judge([W, W]), "failed")
        self.assertEqual(judge([R, R, W, R, W]), "failed")
        for undecided in ([], [R], [R, R], [W], [R, W], [W, R, R, R], [R, R, W, R]):
            self.assertIsNone(judge(undecided), undecided)

    def test_five_answers_always_settle_a_level(self) -> None:
        from itertools import product
        for results in product((R, W), repeat=PER_LEVEL):
            settled = [judge(list(results[:n])) for n in range(1, PER_LEVEL + 1)]
            self.assertTrue(any(settled), results)


def _key(seed, level):
    return [(q["id"], q["answer"]) for q in level_block(seed, level)]


def _wrong(q_answer):
    return "c1" if q_answer != "c1" else "c2"


class ClimbTests(unittest.TestCase):
    SEED = 2026

    def test_each_level_is_five_questions_of_its_own_and_reproducible(self) -> None:
        seen_ids, seen_prompts = set(), set()
        for level in LEVELS:
            block = level_block(self.SEED, level)
            self.assertEqual(len(block), PER_LEVEL)
            self.assertEqual(block, level_block(self.SEED, level))
            for q in block:
                self.assertEqual(q["sectionId"], level)
                self.assertEqual([c["id"] for c in q["choices"]], ["c1", "c2", "c3", "c4"])
                self.assertEqual(len({c["textJp"] for c in q["choices"]}), 4, q["id"])
                self.assertNotIn(q["id"], seen_ids)
                self.assertNotIn(q["promptJp"], seen_prompts, q["id"])
                seen_ids.add(q["id"])
                seen_prompts.add(q["promptJp"])
            # The first three settle most levels: three kinds.
            self.assertEqual(len(set(CLIMB[level][:3])), 3)
        self.assertNotEqual(
            [q["promptJp"] for q in level_block(1, "N5")],
            [q["promptJp"] for q in level_block(2, "N5")],
        )

    def test_nothing_answered_asks_the_first_n5_question_without_its_answer(self) -> None:
        step = walk(self.SEED, {})
        self.assertFalse(step["done"])
        self.assertEqual(step["level"], "N5")
        self.assertEqual(step["question"]["id"], level_block(self.SEED, "N5")[0]["id"])
        self.assertNotIn("answer", step["question"])

    def test_a_learner_who_knows_everything_climbs_to_n1_in_three_a_level(self) -> None:
        answers = {qid: ans for level in LEVELS for qid, ans in _key(self.SEED, level)[:3]}
        verdict = walk(self.SEED, answers)
        self.assertTrue(verdict["done"])
        self.assertEqual(verdict["recommendedLevel"], "N1")
        self.assertEqual((verdict["correct"], verdict["total"]), (15, 15))
        self.assertTrue(all(t["cleared"] for t in verdict["perLevel"].values()))

    def test_the_learner_boards_at_the_first_level_not_cleared(self) -> None:
        n5, n4 = _key(self.SEED, "N5"), _key(self.SEED, "N4")
        answers = dict(n5[:3])
        answers[n4[0][0]] = n4[0][1]
        answers[n4[1][0]] = _wrong(n4[1][1])
        # Undecided at R, W: the climb asks N4's third question.
        step = walk(self.SEED, answers)
        self.assertEqual((step["done"], step["level"], step["question"]["id"]), (False, "N4", n4[2][0]))
        self.assertEqual(step["perLevel"]["N4"], {"correct": 1, "total": 2, "cleared": None})
        answers[n4[2][0]] = _wrong(n4[2][1])
        verdict = walk(self.SEED, answers)
        self.assertEqual(verdict["recommendedLevel"], "N4")
        self.assertEqual(verdict["perLevel"], {
            "N5": {"correct": 3, "total": 3, "cleared": True},
            "N4": {"correct": 1, "total": 3, "cleared": False},
        })
        # An answer to a level never reached changes nothing.
        answers.update(dict(_key(self.SEED, "N3")))
        self.assertEqual(walk(self.SEED, answers), verdict)

    def test_one_slip_takes_five_questions_and_still_clears(self) -> None:
        n5 = _key(self.SEED, "N5")
        answers = {qid: ans for qid, ans in n5}
        answers[n5[1][0]] = _wrong(n5[1][1])
        step = walk(self.SEED, answers)
        self.assertEqual(step["level"], "N4")
        self.assertEqual(step["perLevel"]["N5"], {"correct": 4, "total": 5, "cleared": True})

    def test_stop_boards_at_the_level_being_asked(self) -> None:
        verdict = walk(self.SEED, dict(_key(self.SEED, "N5")[:3]), stop=True)
        self.assertEqual(verdict["recommendedLevel"], "N4")
        self.assertEqual(verdict["perLevel"]["N4"], {"correct": 0, "total": 0, "cleared": False})
        self.assertEqual(walk(self.SEED, {}, stop=True)["recommendedLevel"], "N5")


def test_the_climb_is_the_same_paper_in_another_process():
    # The seed is all the server keeps between two answers, so a restart
    # between them (a deploy) must rebuild the same questions -- string
    # hashing differs from one process to the next, and a set's order
    # with it.
    import json
    import os
    import subprocess
    import sys
    from pathlib import Path

    code = (
        "import json; from study.placement import level_block; "
        "print(json.dumps([[q['id'], q['promptJp'], q['answer'], [c['textJp'] for c in q['choices']]] "
        "for s in range(6) for l in ('N5', 'N4', 'N3', 'N2', 'N1') for q in level_block(s, l)], ensure_ascii=False))"
    )
    backend = Path(__file__).resolve().parent.parent
    runs = []
    for hash_seed in ("1", "2"):
        env = {**os.environ, "PYTHONHASHSEED": hash_seed}
        out = subprocess.run([sys.executable, "-c", code], cwd=backend, env=env,
                             capture_output=True, text=True, check=True).stdout
        runs.append(json.loads(out.strip().splitlines()[-1]))
    assert runs[0] == runs[1]


def test_the_climb_round_trip(client):
    started = client.post("/api/onboarding/placement/start")
    assert started.status_code == 200
    body = started.json()
    seed, answers, asked = body["seed"], {}, 0
    while not body["done"]:
        q = body["question"]
        assert "answer" not in q and q["sectionId"] == body["level"]
        key = dict(_key(seed, body["level"]))
        # Right through N4, wrong from N3: the learner boards at N3.
        answers[q["id"]] = key[q["id"]] if body["level"] in ("N5", "N4") else _wrong(key[q["id"]])
        body = client.post("/api/onboarding/placement/answer", json={"seed": seed, "answers": answers}).json()
        asked += 1
    assert body["recommendedLevel"] == "N3"
    assert asked == 8 and body["total"] == 8
    assert body["perLevel"]["N3"] == {"correct": 0, "total": 2, "cleared": False}


def test_the_climb_refuses_more_answers_than_it_can_ask(client):
    too_many = {f"pl_N5_reading_{i}_q1": "c1" for i in range(len(LEVELS) * PER_LEVEL + 1)}
    r = client.post("/api/onboarding/placement/answer", json={"seed": 1, "answers": too_many})
    assert r.status_code == 422
    r = client.post("/api/onboarding/placement/answer", json={"seed": 1, "answers": {"x" * 41: "c1"}})
    assert r.status_code == 422


if __name__ == "__main__":
    unittest.main()
