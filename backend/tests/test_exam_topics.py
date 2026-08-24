# -*- coding: utf-8 -*-
import random
import unittest

from study import exam_reading_gen as reading
from study.exam_topics import (
    LISTENING_TOPICS, OPINION_TOPICS, READING_TOPICS, pick_topics,
)
from study.exam_validation import passage_length_bounds, validate_passage_length


class PickTopicsTests(unittest.TestCase):
    """study/exam_topics.py is the fix for prompts that had nothing
    item-specific in them and so produced the same handful of subjects
    every time (see that module's header). These tests pin the two
    properties that fix depends on: a draw is varied, and it is driven
    by the seed rather than by chance."""

    def test_draw_is_distinct(self):
        picked = pick_topics(LISTENING_TOPICS, 7, random.Random(1))
        self.assertEqual(len(picked), 7)
        self.assertEqual(len(set(picked)), 7)
        self.assertTrue(all(t in LISTENING_TOPICS for t in picked))

    def test_different_seeds_draw_differently(self):
        # What makes two REVISIONS of one exam ask for different things
        # -- routes/exams.py seeds from (exam_id, revision).
        a = pick_topics(READING_TOPICS, 4, random.Random(1))
        b = pick_topics(READING_TOPICS, 4, random.Random(2))
        self.assertNotEqual(a, b)

    def test_same_seed_draws_identically(self):
        self.assertEqual(
            pick_topics(READING_TOPICS, 4, random.Random(7)),
            pick_topics(READING_TOPICS, 4, random.Random(7)),
        )

    def test_asking_for_more_than_the_pool_holds(self):
        # Repeats rather than raising: a repeated subject inside one very
        # long paper is a far smaller problem than a paper that fails to
        # generate at all.
        picked = pick_topics(OPINION_TOPICS, len(OPINION_TOPICS) + 3, random.Random(3))
        self.assertEqual(len(picked), len(OPINION_TOPICS) + 3)

    def test_zero(self):
        self.assertEqual(pick_topics(READING_TOPICS, 0, random.Random(1)), [])

    def test_pools_have_no_duplicates(self):
        for name, pool in (("READING", READING_TOPICS), ("OPINION", OPINION_TOPICS),
                           ("LISTENING", LISTENING_TOPICS)):
            with self.subTest(pool=name):
                self.assertEqual(len(pool), len(set(pool)))


class PassageLengthTests(unittest.TestCase):
    """The N5 reading paper failed to generate at all because the prompt
    described the length limit in its own words while the validator
    computed something else. passage_length_bounds is now the single
    source both read from."""

    def test_bounds_match_the_reported_window(self):
        # The exact case from the live failure: dokkai_5's 250-character
        # 中文 slot, whose passages kept coming back at ~120.
        self.assertEqual(passage_length_bounds(250), (200, 300))
        # Short targets get a wider relative window -- ±20% of 80 is only
        # ±16 characters, which no model hits reliably.
        self.assertEqual(passage_length_bounds(80), (40, 120))

    def test_validator_agrees_with_the_bounds_at_both_edges(self):
        for target in (80, 150, 250, 450, 1000):
            lo, hi = passage_length_bounds(target)
            with self.subTest(target=target):
                self.assertEqual(validate_passage_length("あ" * lo, target), [])
                self.assertEqual(validate_passage_length("あ" * hi, target), [])
                self.assertTrue(validate_passage_length("あ" * (lo - 1), target))
                self.assertTrue(validate_passage_length("あ" * (hi + 1), target))


class ReadingPromptTests(unittest.TestCase):
    """The length guidance used to push toward brevity unconditionally,
    including for the slots whose problem was passages that were far too
    SHORT."""

    def _prompt(self, chars: int, topic: str = "a note left on the fridge") -> str:
        captured = {}

        def fake_call(prompt, _user_message="x"):
            captured["prompt"] = prompt
            raise AssertionError("stop here -- only the prompt is under test")

        original = reading.call_llm_json
        reading.call_llm_json = fake_call
        try:
            reading._call_llm_passage("N5", "内容理解", chars, 2, "STYLE", topic)
        except AssertionError:
            pass
        finally:
            reading.call_llm_json = original
        return captured["prompt"]

    def test_short_target_is_told_to_write_less(self):
        prompt = self._prompt(80)
        self.assertIn("write LESS rather than more", prompt)
        self.assertNotIn("NOT a short text", prompt)

    def test_long_target_is_told_the_opposite(self):
        prompt = self._prompt(250)
        self.assertNotIn("write LESS rather than more", prompt)
        self.assertIn("NOT a short text", prompt)

    def test_prompt_states_the_bounds_the_validator_enforces(self):
        prompt = self._prompt(250)
        lo, hi = passage_length_bounds(250)
        self.assertIn(f"{lo} to {hi} characters", prompt)

    def test_prompt_carries_the_assigned_topic(self):
        prompt = self._prompt(80, topic="a library flyer")
        self.assertIn("a library flyer", prompt)


if __name__ == "__main__":
    unittest.main()
