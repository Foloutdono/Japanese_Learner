"""parse_pasted_transcript: the ingest that cannot be IP-blocked.

The panel format was CAPTURED, not guessed -- a real select-all-copy of
YouTube's "Show transcript" panel on 2026-08-26, committed verbatim as
tests/fixtures/youtube_transcript_panel_fr_ui.txt. It is nothing like
the obvious "timestamp then text": a screen-reader duration label sits
between the two with no separator on either side, and it is a localized
humanized duration, so no fixed pattern matches it across UI languages.
See study/captions.py's module comment.
"""
import unittest
from pathlib import Path

from study.captions import CaptionParseError, parse_pasted_transcript

FIXTURE = Path(__file__).parent / "fixtures" / "youtube_transcript_panel_fr_ui.txt"


class RealPanelPasteTests(unittest.TestCase):
    """Against the captured fixture. If YouTube restyles the panel, these
    are the tests that should fail -- capture a NEW fixture rather than
    loosening the parser until the old one passes."""

    def setUp(self) -> None:
        self.cues = parse_pasted_transcript(FIXTURE.read_text(encoding="utf-8"))

    def test_every_cue_is_parsed(self) -> None:
        self.assertEqual(len(self.cues), 10)

    def test_panel_header_is_dropped(self) -> None:
        joined = " ".join(c["text"] for c in self.cues)
        self.assertNotIn("Rechercher dans la transcription", joined)
        self.assertNotIn("Transcription", joined)

    def test_seconds_only_duration_label_is_stripped(self) -> None:
        # "0:1818 secondes♪ We're no strangers..."
        cue = next(c for c in self.cues if c["start"] == 18.0)
        self.assertEqual(
            cue["text"], "♪ We're no strangers to love ♪ ♪ You know the rules and so do I ♪"
        )

    def test_whole_minute_duration_label_is_stripped(self) -> None:
        # "1:001 minute♪ We've known each other..." -- the zero seconds
        # component is omitted by the panel, so the label is just "1 minute".
        cue = next(c for c in self.cues if c["start"] == 60.0)
        self.assertTrue(cue["text"].startswith("♪ We've known each other"))
        self.assertNotIn("minute", cue["text"])

    def test_compound_duration_label_is_stripped(self) -> None:
        # "1:091 minute et 9 secondes♪ Inside we both know..." -- two
        # components and a conjunction, the case a naive parser mangles.
        cue = next(c for c in self.cues if c["start"] == 69.0)
        self.assertTrue(cue["text"].startswith("♪ Inside we both know"))
        self.assertNotIn("secondes", cue["text"])

    def test_ends_chain_to_the_next_start(self) -> None:
        for earlier, later in zip(self.cues, self.cues[1:]):
            self.assertEqual(earlier["end"], later["start"])

    def test_last_cue_gets_a_bounded_end(self) -> None:
        last = self.cues[-1]
        self.assertGreater(last["end"], last["start"])
        self.assertLessEqual(last["end"] - last["start"], 10.0)


class LayoutTests(unittest.TestCase):
    def test_inline_and_split_line_layouts_agree(self) -> None:
        inline = parse_pasted_transcript("0:00 これはテストです。\n0:04 猫が公園を歩いています。")
        split = parse_pasted_transcript("0:00\nこれはテストです。\n0:04\n猫が公園を歩いています。")
        self.assertEqual(inline, split)

    def test_hour_timestamps_parse(self) -> None:
        cues = parse_pasted_transcript("1:02:03 テスト")
        self.assertEqual(cues[0]["start"], 3723.0)

    def test_japanese_ui_duration_label_is_stripped(self) -> None:
        # A Japanese YouTube UI renders the label with CJK units. The
        # strip rule is derived from the timestamp, so it works here too
        # without knowing the UI language.
        cues = parse_pasted_transcript("1:09" + "1分9秒" + "猫が公園を歩いています。")
        self.assertEqual(cues[0]["start"], 69.0)
        self.assertEqual(cues[0]["text"], "猫が公園を歩いています。")

    def test_caption_starting_with_the_same_number_is_not_eaten(self) -> None:
        # "0:18" + text "18歳です" and NO duration label. The digits match
        # the label's leading number, so a looser rule would strip them.
        # Requiring at least one unit character is what saves it.
        cues = parse_pasted_transcript("0:1818歳です。")
        self.assertEqual(cues[0]["text"], "18歳です。")

    def test_out_of_order_paste_is_sorted_not_rejected(self) -> None:
        cues = parse_pasted_transcript("0:10 あと\n0:00 さき")
        self.assertEqual([c["text"] for c in cues], ["さき", "あと"])

    def test_markup_is_stripped(self) -> None:
        cues = parse_pasted_transcript("0:00 <i>猫</i>{\\an8}が好き")
        self.assertEqual(cues[0]["text"], "猫が好き")

    def test_rolling_window_duplication_is_merged(self) -> None:
        # Auto-generated transcripts repeat most of each cue in the next.
        cues = parse_pasted_transcript(
            "0:00 猫が\n0:02 猫が公園を\n0:04 猫が公園を歩いています。"
        )
        self.assertLess(len(cues), 3)


class FailureTests(unittest.TestCase):
    def test_text_without_timestamps_raises(self) -> None:
        with self.assertRaises(CaptionParseError):
            parse_pasted_transcript("just some text\nno times here")

    def test_timestamps_without_text_raises(self) -> None:
        with self.assertRaises(CaptionParseError):
            parse_pasted_transcript("0:00\n0:04\n")

    def test_error_message_tells_the_learner_what_to_do(self) -> None:
        with self.assertRaises(CaptionParseError) as ctx:
            parse_pasted_transcript("nothing useful")
        self.assertIn("0:18", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
