import unittest

from study.cue_sentences import sentences_from_cues, _build_concatenation, UNPUNCTUATED_FALLBACK_CHAR_THRESHOLD


class SentencesFromCuesTests(unittest.TestCase):
    """sentences_from_cues reconstructs Sentences from Cues: punctuated
    input splits on real sentence boundaries (not Cue boundaries),
    unpunctuated input (the common auto-caption case) falls back to one
    Sentence per Cue, and every offset is checkable against the
    module's own single-space Cue join."""

    def test_punctuated_cues_split_on_sentence_boundaries_not_cue_boundaries(self) -> None:
        cues = [
            {"start": 0.0, "end": 1.0, "text": "私は"},
            {"start": 1.0, "end": 2.0, "text": "学生です。"},
            {"start": 2.0, "end": 3.0, "text": "今日は"},
            {"start": 3.0, "end": 4.0, "text": "暑い！"},
        ]
        result = sentences_from_cues(cues, 0.0, 10.0)
        # Two Sentences (one per terminator), not four (one per Cue).
        self.assertEqual(len(result), 2)
        self.assertTrue(result[0]["text"].endswith("。"))
        self.assertTrue(result[1]["text"].endswith("！"))

    def test_a_sentence_spanning_multiple_cues_gets_the_first_start_and_last_end(self) -> None:
        cues = [
            {"start": 0.0, "end": 1.0, "text": "これは"},
            {"start": 1.0, "end": 2.0, "text": "三つの"},
            {"start": 2.0, "end": 3.0, "text": "文です。"},
        ]
        result = sentences_from_cues(cues, 0.0, 10.0)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["cue_start"], 0.0)
        self.assertEqual(result[0]["cue_end"], 3.0)

    def test_unpunctuated_input_falls_back_to_one_sentence_per_cue(self) -> None:
        # Built long enough (concatenation > threshold) that the
        # single-giant-Sentence result from split_sentences is
        # abandoned. No 。！？ anywhere, matching real auto-captions.
        long_text_a = "あ" * 70
        long_text_b = "い" * 70
        cues = [
            {"start": 0.0, "end": 2.0, "text": long_text_a},
            {"start": 2.0, "end": 4.0, "text": long_text_b},
        ]
        concatenation, _ = _build_concatenation(cues)
        self.assertGreater(len(concatenation), UNPUNCTUATED_FALLBACK_CHAR_THRESHOLD)

        result = sentences_from_cues(cues, 0.0, 10.0)
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["text"], long_text_a)
        self.assertEqual(result[0]["cue_start"], 0.0)
        self.assertEqual(result[0]["cue_end"], 2.0)
        self.assertEqual(result[1]["text"], long_text_b)
        self.assertEqual(result[1]["cue_start"], 2.0)
        self.assertEqual(result[1]["cue_end"], 4.0)

    def test_window_selects_only_overlapping_cues(self) -> None:
        cues = [
            {"start": 0.0, "end": 1.0, "text": "早すぎる"},
            {"start": 5.0, "end": 6.0, "text": "範囲内"},
            {"start": 10.0, "end": 11.0, "text": "遅すぎる"},
        ]
        result = sentences_from_cues(cues, 4.0, 7.0)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["text"], "範囲内")

    def test_offsets_satisfy_the_slice_invariant_against_the_module_own_join(self) -> None:
        cues = [
            {"start": 0.0, "end": 1.0, "text": "一つ目。"},
            {"start": 1.0, "end": 2.0, "text": "二つ目。"},
            {"start": 2.0, "end": 3.0, "text": "三つ目。"},
        ]
        concatenation, _ = _build_concatenation(cues)
        result = sentences_from_cues(cues, 0.0, 10.0)
        for sentence in result:
            self.assertEqual(concatenation[sentence["start"]:sentence["end"]], sentence["text"])

    def test_no_overlapping_cues_returns_empty_list(self) -> None:
        cues = [{"start": 0.0, "end": 1.0, "text": "テスト"}]
        self.assertEqual(sentences_from_cues(cues, 5.0, 6.0), [])


if __name__ == "__main__":
    unittest.main()
