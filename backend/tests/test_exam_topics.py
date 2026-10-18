# -*- coding: utf-8 -*-
import random
import unittest
from unittest import mock

from study import exam_grammar_gen as grammar
from study import exam_listening_gen as listening
from study import exam_reading_gen as reading
from study import exam_vocab_gen as vocab
from study.exam_gen_utils import GenerationFailed
from study.exam_topics import (
    LISTENING_TOPICS, OPINION_TOPICS, POOLS, READING_TOPICS, TopicDeck, dealt_order,
)
from study.exam_validation import passage_length_bounds, validate_passage_length

LEVELS = ["N5", "N4", "N3", "N2", "N1"]


class TopicDeckTests(unittest.TestCase):
    """study/exam_topics.py is the fix for prompts that had nothing
    item-specific in them and so produced the same handful of subjects
    every time (see that module's header); the deck is the fix for
    subjects drawn without memory of the rest of the paper or of the
    papers before it, which told one story many times (plan 247)."""

    def _paper(self, k, rng_seed=0, exam="listening:N4", draws=15):
        return TopicDeck(exam, k, random.Random(rng_seed), {"listening": draws}).deal("listening", draws)

    def test_a_paper_deals_no_subject_twice(self):
        deck = TopicDeck("listening:N4", 3, random.Random(1), {"listening": 15})
        picked = deck.deal("listening", 4) + deck.deal("listening", 4) + deck.deal("listening", 7)
        self.assertEqual(len(set(picked)), 15)
        self.assertTrue(all(t in LISTENING_TOPICS for t in picked))

    def test_ten_papers_in_a_row_deal_no_subject_twice(self):
        dealt = [t for k in range(1, 11) for t in self._paper(k)]
        self.assertEqual(len(dealt), len(set(dealt)))

    def test_a_paper_deals_by_its_place_not_by_its_seed(self):
        # A retry re-seeds the paper (exam_pipeline: seed + attempt) and
        # must still deal the paper's own share, not the next one's.
        self.assertEqual(self._paper(4, rng_seed=1), self._paper(4, rng_seed=99))
        self.assertNotEqual(self._paper(4), self._paper(5))

    def test_two_exams_walk_in_different_orders(self):
        self.assertNotEqual(self._paper(1, exam="listening:N4"), self._paper(1, exam="listening:N5"))

    def test_without_a_place_the_rng_decides(self):
        def draw(seed):
            return TopicDeck("reading:N3", None, random.Random(seed), {}).deal("reading", 4)
        self.assertEqual(draw(7), draw(7))
        self.assertNotEqual(draw(1), draw(2))
        self.assertEqual(len(set(draw(3))), 4)

    def test_asking_for_more_than_the_pool_holds(self):
        # Repeats rather than raising: a repeated subject inside one very
        # long paper is a far smaller problem than a paper that fails to
        # generate at all.
        deck = TopicDeck("reading:N1", 1, random.Random(3), {"opinion": 1})
        picked = deck.deal("opinion", len(OPINION_TOPICS) + 3)
        self.assertEqual(len(picked), len(OPINION_TOPICS) + 3)
        self.assertEqual(len(set(picked[:len(OPINION_TOPICS)])), len(OPINION_TOPICS))

    def test_zero(self):
        self.assertEqual(TopicDeck("reading:N5", 1, random.Random(1), {}).deal("reading", 0), [])

    def test_pools_have_no_duplicates(self):
        for name, pool in POOLS.items():
            with self.subTest(pool=name):
                self.assertEqual(len(pool), len(set(pool)))

    def test_every_pool_holds_ten_papers_of_the_exam_that_asks_most_of_it(self):
        asked = {name: 0 for name in POOLS}
        for level in LEVELS:
            for name, n in reading._topic_draws(reading._reading_specs_for_level(level)).items():
                asked[name] = max(asked[name], n)
            asked["listening"] = max(asked["listening"], sum(
                s["count"] for s in listening._listening_specs_for_level(level) if s["type"] == "listening-mcq"))
        for name, pool in POOLS.items():
            with self.subTest(pool=name):
                self.assertGreaterEqual(len(pool), 10 * asked[name])


class DealtOrderTests(unittest.TestCase):
    def test_every_item_once(self):
        items = list(range(110))
        for k in (1, 6, 7, 30):
            with self.subTest(paper=k):
                self.assertEqual(sorted(dealt_order(items, "grammar:N3", "points", k, 18, random.Random(0))), items)

    def test_each_point_is_asked_once_before_any_twice(self):
        # か何か was asked four times in ten N3 papers while twelve N3
        # points were never asked.
        items = list(range(110))
        shares = [dealt_order(items, "grammar:N3", "points", k, 18, random.Random(k))[:18] for k in range(1, 8)]
        asked = [i for share in shares for i in share]
        self.assertEqual(len(set(asked[:110])), 110)

    def test_papers_in_a_row_ask_different_items(self):
        items = list(range(700))
        shares = [set(dealt_order(items, "vocab:N5", "words", k, 42, random.Random(k))[:42]) for k in range(1, 11)]
        for a, b in zip(shares, shares[1:]):
            self.assertFalse(a & b)

    def test_without_a_place_the_rng_shuffles(self):
        items = list(range(50))
        self.assertEqual(dealt_order(items, "x", "y", None, 5, random.Random(3)),
                         dealt_order(items, "x", "y", None, 5, random.Random(3)))
        self.assertNotEqual(dealt_order(items, "x", "y", None, 5, random.Random(3)),
                            dealt_order(items, "x", "y", None, 5, random.Random(4)))


class PaperWiringTests(unittest.TestCase):
    """Each generator deals a paper's subjects from its place, and every
    part of the paper from the one deck."""

    def test_reading_passages_of_one_paper_and_the_next_never_share_a_subject(self):
        def topics_of(k):
            seen = []

            def fake_build(_level, _name, _chars, qc, _style, topic, passage_id, start):
                seen.append(topic)
                return {"id": passage_id, "textJp": "x",
                        "questions": [{"id": f"{passage_id}_q{i + 1}", "number": start + i, "promptJp": "q",
                                       "choices": [], "answer": "c1"} for i in range(qc)]}

            with mock.patch.object(reading, "_build_one_passage", side_effect=fake_build), \
                    mock.patch.object(reading, "llm_configured", return_value=True):
                reading._generate_reading_paper_once("N1", seed=k, paper=k)
            return seen

        one, two = topics_of(1), topics_of(2)
        self.assertEqual(len(set(one)), len(one))
        self.assertFalse(set(one) & set(two))

    def test_listening_mondai_deal_from_one_deck(self):
        def topics_of(k):
            seen = []

            def fake_build(spec, _level, _rng, deck):
                seen.extend(deck.deal("listening", spec["count"]))
                return {"id": spec["id"], "questions": [{"id": "q"}] * spec["count"]}

            with mock.patch.object(listening, "_build_listening_mcq_mondai", side_effect=fake_build), \
                    mock.patch.object(listening, "llm_configured", return_value=True), \
                    mock.patch.object(listening.voice_engine, "ready", return_value=True):
                listening._generate_listening_paper_once("N4", seed=k, paper=k)
            return seen

        one, two = topics_of(1), topics_of(2)
        self.assertEqual(len(one), 15)
        self.assertEqual(len(set(one)), 15)
        self.assertFalse(set(one) & set(two))

    def test_grammar_papers_in_a_row_ask_different_points(self):
        def points_of(k):
            asked = []

            def fake_mondai(spec, _level, points, used, _rng):
                fresh = [p["pattern"] for p in points if p["pattern"] not in used][:spec["count"]]
                used.update(fresh)
                asked.extend(fresh)
                return {"id": spec["id"], "questions": []}

            with mock.patch.object(grammar, "_build_grammar_fill_mondai", side_effect=fake_mondai), \
                    mock.patch.object(grammar, "_build_sentence_order_mondai", side_effect=fake_mondai), \
                    mock.patch.object(grammar, "_build_cloze_mondai", side_effect=GenerationFailed("no")), \
                    mock.patch.object(grammar, "llm_configured", return_value=True):
                grammar._generate_grammar_paper_once("N3", seed=k, paper=k)
            return asked

        one, two = points_of(1), points_of(2)
        self.assertEqual(len(one), 18)
        self.assertFalse(set(one) & set(two))

    def test_vocab_papers_in_a_row_ask_different_words(self):
        def words_of(k):
            paper = vocab._generate_vocabulary_paper_once("N3", seed=k, paper=k)
            return {q["promptJp"] for m in paper["sections"][0]["mondai"] for q in m["questions"]}

        with mock.patch.object(vocab, "llm_configured", return_value=False):
            one, two = words_of(1), words_of(2)
        self.assertTrue(one)
        self.assertFalse(one & two)


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

        def fake_call(prompt, _user_message="x", **_kwargs):
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
