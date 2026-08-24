# -*- coding: utf-8 -*-
import unittest
from unittest import mock

from study import exam_reading_gen as reading
from study.exam_gen_utils import GenerationFailed


def _response(text: str, question_count: int = 1) -> dict:
    return {
        "textJp": text,
        "questions": [
            {"promptJp": f"しつもん{i}", "choices": [f"え{i}", f"い{i}", f"う{i}", f"お{i}"],
             "correctIndex": 0}
            for i in range(question_count)
        ],
    }


# 40-120 characters and N5-clean: 80 kana.
_GOOD = "あ" * 80
# Same length, but 色 and 教室 are outside N5's 103-kanji set.
_BAD_KANJI = "色教室" + "あ" * 77


class PassageRetryTests(unittest.TestCase):
    """A passage that failed a gate used to be dropped after ONE call,
    with no feedback to the model about what was wrong. Enough drops took
    the mondai, and then the whole paper, with them -- live-diagnosed as
    "no reading mondai could be generated at all" for every N5 reading
    paper."""

    def _build(self, responses):
        calls = []

        def fake_call(prompt, _user_message="x"):
            calls.append(prompt)
            return responses[min(len(calls) - 1, len(responses) - 1)]

        with mock.patch.object(reading, "call_llm_json", side_effect=fake_call):
            try:
                passage = reading._build_one_passage(
                    "N5", "内容理解", 80, 1, "STYLE", "a library flyer", "p1", 1)
            except GenerationFailed as e:
                return None, calls, str(e)
        return passage, calls, None

    def test_a_good_first_answer_costs_one_call(self):
        passage, calls, err = self._build([_response(_GOOD)])
        self.assertIsNone(err)
        self.assertEqual(len(calls), 1)
        self.assertEqual(passage["textJp"], _GOOD)
        self.assertEqual(passage["questions"][0]["id"], "p1_q1")

    def test_a_failed_passage_is_retried_with_the_failure_fed_back(self):
        # Too short first, then fine.
        passage, calls, err = self._build([_response("みじかい"), _response(_GOOD)])
        self.assertIsNone(err)
        self.assertEqual(len(calls), 2)
        self.assertEqual(passage["textJp"], _GOOD)
        # The retry must carry what was wrong, in actionable form --
        # a re-send of the identical prompt is what the paper-level
        # retry in exam_pipeline.py already does, and it never helped.
        self.assertIn("REJECTED", calls[1])
        self.assertIn("too SHORT", calls[1])
        self.assertIn("40 and 120 characters", calls[1])

    def test_kanji_feedback_names_the_offending_characters(self):
        _passage, calls, _err = self._build([_response(_BAD_KANJI), _response(_GOOD)])
        self.assertIn("色", calls[1])
        self.assertIn("教室", calls[1])
        self.assertIn("hiragana", calls[1])

    def test_a_kanji_only_failure_is_softened_rather_than_dropped(self):
        # Every attempt leaks kanji. Rather than losing the passage --
        # and with it, likely the whole paper -- the last attempt is
        # kana-ified, which is what a real N5 passage does with a word
        # whose kanji the learner has not met.
        passage, calls, err = self._build([_response(_BAD_KANJI)])
        self.assertIsNone(err, msg="a salvageable passage must not be dropped")
        self.assertEqual(len(calls), reading._PASSAGE_ATTEMPTS)
        self.assertNotIn("色", passage["textJp"])
        self.assertNotIn("教室", passage["textJp"])

    def test_a_length_failure_is_not_salvaged(self):
        # soften_kanji cannot make a text longer; only a new generation
        # can. Three attempts, then give up on this passage.
        passage, calls, err = self._build([_response("みじかい")])
        self.assertIsNone(passage)
        self.assertEqual(len(calls), reading._PASSAGE_ATTEMPTS)
        self.assertIn("passage length", err)

    def test_out_of_level_kanji_in_choices_is_softened(self):
        data = _response(_GOOD)
        data["questions"][0]["choices"] = ["色", "あ", "い", "う"]
        passage, _calls, err = self._build([data])
        self.assertIsNone(err)
        self.assertNotIn("色", [c["textJp"] for c in passage["questions"][0]["choices"]])


class TopicAssignmentTests(unittest.TestCase):
    def test_each_passage_in_a_mondai_gets_its_own_topic(self):
        import random
        topics = []

        def fake_build(_level, _name, _chars, qc, _style, topic, passage_id, start):
            topics.append(topic)
            return {"id": passage_id, "textJp": _GOOD,
                    "questions": [{"id": f"{passage_id}_q{i+1}", "number": start + i,
                                   "promptJp": "q", "choices": [], "answer": "c1"}
                                  for i in range(qc)]}

        spec = {"id": "dokkai_5", "official_number": 5, "name_jp": "内容理解（中文）",
                "type": "reading-passage", "count": 2, "passage_chars": 250,
                "questions_per_passage": 1}
        with mock.patch.object(reading, "_build_one_passage", side_effect=fake_build):
            reading.build_reading_passage_mondai(spec, "N5", random.Random(4))
        self.assertEqual(len(topics), 2)
        self.assertEqual(len(set(topics)), 2)

    def test_opinion_mondai_draws_from_the_opinion_pool(self):
        import random
        from study.exam_topics import OPINION_TOPICS
        seen = []

        def fake_build(_level, _name, _chars, qc, _style, topic, passage_id, start):
            seen.append(topic)
            raise GenerationFailed("stop")

        spec = {"id": "dokkai_12", "official_number": 12, "name_jp": "主張理解（長文）",
                "type": "reading-passage", "count": 1, "passage_chars": 1000,
                "questions_per_passage": 1}
        with mock.patch.object(reading, "_build_one_passage", side_effect=fake_build):
            with self.assertRaises(GenerationFailed):
                reading.build_reading_passage_mondai(spec, "N1", random.Random(4))
        self.assertIn(seen[0], OPINION_TOPICS)


if __name__ == "__main__":
    unittest.main()
