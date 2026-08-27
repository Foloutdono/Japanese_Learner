import unittest

from study.cue_sentences import sentences_from_cues


class SentencesFromCuesTests(unittest.TestCase):
    """sentences_from_cues turns each Cue into one or more Sentences.

    A Cue is a Sentence: it is a line somebody chose to put on screen
    together, which is the unit a learner studies. It splits FURTHER on
    its own punctuation, and never merges with its neighbours. Cues with
    no Japanese in them are dropped.

    This is the reverse of the original contract (concatenate the whole
    Window, split on punctuation) -- see the module docstring and
    docs/adr/0003's 2026-08-27 amendment for why it was reversed.
    """

    def test_each_cue_becomes_its_own_sentence(self) -> None:
        cues = [
            {"start": 0.0, "end": 1.0, "text": "私は"},
            {"start": 1.0, "end": 2.0, "text": "学生です。"},
            {"start": 2.0, "end": 3.0, "text": "今日は"},
            {"start": 3.0, "end": 4.0, "text": "暑い！"},
        ]
        result = sentences_from_cues(cues, 0.0, 10.0)
        self.assertEqual([s["text"] for s in result],
                         ["私は", "学生です。", "今日は", "暑い！"])
        self.assertEqual(result[0]["cue_start"], 0.0)
        self.assertEqual(result[0]["cue_end"], 1.0)

    def test_a_cue_never_merges_with_its_neighbours(self) -> None:
        # The reported bug: authored lyric lines carry a little
        # punctuation, which used to put the Track between the "split on
        # terminators" path and the "one per Cue" fallback and produce
        # 200-character blocks spanning a dozen unrelated lines.
        cues = [
            {"start": 0.0, "end": 1.0, "text": "今日はいい天気ですね"},
            {"start": 1.0, "end": 2.0, "text": "駅前に喫茶店ができた"},
            {"start": 2.0, "end": 3.0, "text": "コーヒーが美味しいらしい"},
            {"start": 3.0, "end": 4.0, "text": "行きましょうか？"},
        ]
        result = sentences_from_cues(cues, 0.0, 10.0)
        self.assertEqual(len(result), 4)
        self.assertTrue(all(len(s["text"]) < 20 for s in result))

    def test_a_cue_is_never_split_either(self) -> None:
        """A subtitle line is what is on screen. Splitting it on an
        internal ？ produced two stops that no longer matched the file
        and shared a timestamp with each other."""
        cues = [{"start": 0.0, "end": 1.0, "text": "もしもし、（なに？）聞こえてる？"}]
        result = sentences_from_cues(cues, 0.0, 10.0)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["text"], "もしもし、（なに？）聞こえてる？")

    def test_unpunctuated_cues_stay_one_sentence_each(self) -> None:
        # The auto-caption case: no 。！？ anywhere. Still one Sentence
        # per Cue, which is what it always should have produced.
        cues = [
            {"start": 0.0, "end": 2.0, "text": "あ" * 70},
            {"start": 2.0, "end": 4.0, "text": "い" * 70},
        ]
        result = sentences_from_cues(cues, 0.0, 10.0)
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["text"], "あ" * 70)
        self.assertEqual(result[1]["cue_end"], 4.0)

    def test_cues_with_no_japanese_are_kept_and_flagged(self) -> None:
        """NOT dropped. A Korean verse or an English ad-lib is part of
        the track the learner is reading along with; removing it means a
        line they can see on screen is missing from the list. It is
        flagged instead, and the caller skips the breakdown for it."""
        cues = [
            {"start": 0.0, "end": 1.0, "text": "こんにちは"},
            {"start": 1.0, "end": 2.0, "text": "여보세요"},
            {"start": 2.0, "end": 3.0, "text": "I miss you"},
            {"start": 3.0, "end": 4.0, "text": "4season"},
            {"start": 4.0, "end": 5.0, "text": "また明日"},
        ]
        result = sentences_from_cues(cues, 0.0, 10.0)
        self.assertEqual(len(result), 5, "every Cue must survive")
        self.assertEqual([r["japanese"] for r in result],
                         [True, False, False, False, True])

    def test_window_selects_only_overlapping_cues(self) -> None:
        cues = [
            {"start": 0.0, "end": 1.0, "text": "早すぎる"},
            {"start": 5.0, "end": 6.0, "text": "範囲内"},
            {"start": 10.0, "end": 11.0, "text": "遅すぎる"},
        ]
        result = sentences_from_cues(cues, 4.0, 7.0)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["text"], "範囲内")

    def test_no_overlapping_cues_returns_empty_list(self) -> None:
        cues = [{"start": 0.0, "end": 1.0, "text": "テスト"}]
        self.assertEqual(sentences_from_cues(cues, 5.0, 6.0), [])


if __name__ == "__main__":
    unittest.main()
