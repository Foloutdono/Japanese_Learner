import unittest

from study.exam_gen_utils import GenerationFailed
from study.exam_pipeline import generate_paper


def _mcq(qid: str, prompt: str, answer_id: str = "c1") -> dict:
    return {
        "id": qid,
        "promptJp": prompt,
        "choices": [{"id": f"c{i}", "textJp": f"choice-{qid}-{i}"} for i in range(1, 5)],
        "answer": answer_id,
    }


def _paper(questions: list[dict]) -> dict:
    return {"sections": [{"mondai": [{"questions": questions}]}]}


def _flatten(mondai_list: list[dict]) -> list[dict]:
    return [q for m in mondai_list for q in m["questions"]]


class GeneratePaperTests(unittest.TestCase):
    """
    generate_paper is the retry/validate/repair skeleton every LLM-backed
    exam_*_gen.py module (grammar, vocab, listening, reading) shares
    instead of re-implementing. Exercised here with a fake generate_once
    -- no live LLM calls -- since nothing in backend/tests touched this
    pipeline before it was one shared function.
    """

    def test_succeeds_on_a_valid_first_attempt(self) -> None:
        calls = []

        def generate_once(level, seed):
            calls.append(seed)
            return _paper([_mcq("q1", "a"), _mcq("q2", "b")])

        paper = generate_paper(
            generate_once=generate_once, flatten=_flatten,
            level="N5", seed=42, max_attempts=3, check_duplicates=True, paper_label="test",
        )
        self.assertEqual(calls, [42])  # no retry needed
        self.assertEqual(len(paper["sections"][0]["mondai"][0]["questions"]), 2)

    def test_retries_past_a_generation_failure_then_succeeds(self) -> None:
        attempts = []

        def generate_once(level, seed):
            attempts.append(seed)
            if len(attempts) < 2:
                raise GenerationFailed("simulated failure")
            return _paper([_mcq("q1", "a")])

        paper = generate_paper(
            generate_once=generate_once, flatten=_flatten,
            level="N5", seed=10, max_attempts=3, check_duplicates=True, paper_label="test",
        )
        self.assertEqual(attempts, [10, 11])  # seed + attempt each retry
        self.assertEqual(paper["sections"][0]["mondai"][0]["questions"][0]["id"], "q1")

    def test_exhausts_attempts_and_raises_with_level_and_label(self) -> None:
        def generate_once(level, seed):
            raise GenerationFailed(f"no content at seed {seed}")

        with self.assertRaises(GenerationFailed) as ctx:
            generate_paper(
                generate_once=generate_once, flatten=_flatten,
                level="N4", seed=0, max_attempts=3, check_duplicates=True, paper_label="grammar",
            )
        message = str(ctx.exception)
        self.assertIn("N4", message)
        self.assertIn("grammar", message)
        self.assertIn("3 attempts", message)

    def test_check_duplicates_is_per_call_not_hardcoded(self) -> None:
        # Two questions sharing a promptJp: a real defect when
        # check_duplicates=True (vocab: promptJp IS the target word's
        # identity), not when False (grammar/listening/reading: promptJp
        # is question/sentence text the real JLPT itself reuses).
        def generate_once(level, seed):
            return _paper([_mcq("q1", "same-word"), _mcq("q2", "same-word")])

        with self.assertRaises(GenerationFailed):
            generate_paper(
                generate_once=generate_once, flatten=_flatten,
                level="N5", seed=0, max_attempts=1, check_duplicates=True, paper_label="test",
            )

        paper = generate_paper(
            generate_once=generate_once, flatten=_flatten,
            level="N5", seed=0, max_attempts=1, check_duplicates=False, paper_label="test",
        )
        self.assertEqual(len(paper["sections"][0]["mondai"][0]["questions"]), 2)

    def test_repairs_an_answer_skew_without_another_generate_once_call(self) -> None:
        # >= MIN_QUESTIONS_FOR_BALANCE_CHECK (8) questions, every correct
        # answer in the same slot -- a real skew, not noise. If repair
        # works (a pure reshuffle), generate_once is called exactly once
        # despite the skew.
        calls = []

        def generate_once(level, seed):
            calls.append(seed)
            return _paper([_mcq(f"q{i}", f"prompt{i}") for i in range(8)])

        generate_paper(
            generate_once=generate_once, flatten=_flatten,
            level="N5", seed=5, max_attempts=3, check_duplicates=True, paper_label="test",
        )
        self.assertEqual(len(calls), 1)


if __name__ == "__main__":
    unittest.main()
