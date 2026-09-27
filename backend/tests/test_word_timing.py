import unittest

from study import morphology
from study.word_timing import align_cues


def _times(cue):
    return dict((o, t) for o, t in cue.get("words") or [])


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs the tokenizer")
class AlignCuesTests(unittest.TestCase):
    """A hand-written line takes the times of the recognised words it
    shares, compared as kana (study/word_timing.py)."""

    RECOGNISED = [
        # The recogniser writes 今日 in kana and hears the line a little
        # later than the subtitle shows it.
        {"start": 10.3, "end": 13.0, "text": "きょうはいい天気ですね",
         "words": [[3, 10.8], [4, 11.1], [6, 11.7]]},
    ]

    def test_a_written_word_takes_the_time_the_recogniser_heard_it(self) -> None:
        [cue] = align_cues([{"start": 10.0, "end": 14.0, "text": "今日はいい天気ですね"}], self.RECOGNISED)
        times = _times(cue)
        # 今日 (きょう) at the recognised line's start, は and 天気 at theirs.
        self.assertEqual(times[0], 10.3)
        self.assertEqual(times[2], 10.8)
        self.assertEqual(times[5], 11.7)
        # And where the speech ends, at the line's length.
        self.assertIn(len("今日はいい天気ですね"), times)
        offsets = [o for o, _ in cue["words"]]
        seconds = [t for _, t in cue["words"]]
        self.assertEqual(offsets, sorted(offsets))
        self.assertEqual(seconds, sorted(seconds))

    def test_a_chorus_takes_the_times_of_its_own_occurrence(self) -> None:
        chorus = "さよならまた明日"
        recognised = [
            {"start": 5.0, "end": 7.0, "text": chorus},
            {"start": 60.0, "end": 62.0, "text": chorus},
        ]
        cues = [{"start": 4.8, "end": 7.2, "text": chorus}, {"start": 59.9, "end": 62.2, "text": chorus}]
        first, second = align_cues(cues, recognised)
        self.assertAlmostEqual(_times(first)[0], 5.0)
        self.assertAlmostEqual(_times(second)[0], 60.0)

    def test_a_line_the_recogniser_missed_is_left_to_the_estimate(self) -> None:
        [cue] = align_cues([{"start": 30.0, "end": 32.0, "text": "誰もいない"}], self.RECOGNISED)
        self.assertNotIn("words", cue)

    def test_a_line_with_its_own_times_keeps_them(self) -> None:
        own = {"start": 10.0, "end": 14.0, "text": "今日はいい天気ですね", "words": [[2, 12.0]]}
        [cue] = align_cues([own], self.RECOGNISED)
        self.assertEqual(cue["words"], [[2, 12.0]])

    def test_a_word_misheard_kana_for_kana_keeps_the_time_it_was_said(self) -> None:
        # 天気 (てんき) recognised as 電気 (でんき): the two lines agree on
        # either side of it, and on its length.
        recognised = [{"start": 10.0, "end": 13.0, "text": "今日はいい電気ですね",
                       "words": [[0, 10.0], [3, 10.5], [5, 11.2], [7, 11.9]]}]
        [cue] = align_cues([{"start": 9.8, "end": 13.5, "text": "今日はいい天気ですね"}], recognised)
        self.assertEqual(_times(cue)[5], 11.2)

    def test_a_number_in_digits_meets_the_same_number_in_kanji(self) -> None:
        # The recogniser writes 二人 as 2人: read as に and にん, it never
        # met ふたり, and the word went without its time.
        recognised = [{"start": 10.0, "end": 13.0, "text": "2人だけの世界",
                       "words": [[0, 10.0], [2, 10.6], [4, 11.0], [5, 11.2]]}]
        [cue] = align_cues([{"start": 9.8, "end": 13.5, "text": "二人だけの世界"}], recognised)
        times = _times(cue)
        self.assertEqual(times[0], 10.0)
        self.assertEqual(times[2], 10.6)

    def test_a_word_the_recogniser_missed_is_left_to_the_estimate(self) -> None:
        # いい not heard at all: its kana are not crowded into the time of
        # the words around it.
        recognised = [{"start": 10.0, "end": 13.0, "text": "今日は天気ですね",
                       "words": [[0, 10.0], [3, 10.6], [5, 11.4]]}]
        [cue] = align_cues([{"start": 9.8, "end": 13.5, "text": "今日はいい天気ですね"}], recognised)
        times = _times(cue)
        self.assertNotIn(3, times)
        self.assertEqual(times[5], 10.6)

    def test_a_pause_after_the_last_word_is_not_the_line_s_speech(self) -> None:
        # The recognised line's last word, then eight seconds before the
        # next: its kana are said at the track's pace, not spread over
        # the pause, and so is where the hand-written line's speech ends.
        recognised = [
            {"start": 10.0, "end": 20.0, "text": "夢を見ていた",
             "words": [[0, 10.0], [1, 10.4], [2, 10.6], [3, 10.8], [4, 11.2]]},
            {"start": 20.0, "end": 22.0, "text": "朝が来た", "words": [[0, 20.0], [1, 20.4], [2, 20.6]]},
        ]
        [cue] = align_cues([{"start": 9.9, "end": 19.9, "text": "夢を見ていた"}], recognised)
        end = _times(cue)[len("夢を見ていた")]
        self.assertLess(end, 12.5)

    def test_every_time_stays_inside_the_line(self) -> None:
        early = [{"start": 9.0, "end": 12.0, "text": "今日はいい天気ですね"}]
        [cue] = align_cues([{"start": 10.0, "end": 11.0, "text": "今日はいい天気ですね"}], early)
        for _, t in cue.get("words") or []:
            self.assertGreaterEqual(t, 10.0)
            self.assertLessEqual(t, 11.0)
