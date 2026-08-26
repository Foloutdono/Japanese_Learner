import unittest

from study.captions import parse_track, parse_video_id, CaptionParseError


class ParseTrackTests(unittest.TestCase):
    """parse_track turns a subtitle file into a Track: an ordered list
    of Cues, each {start, end, text} in seconds. SRT, VTT and ASS all
    reduce to the same shape."""

    def test_srt_and_vtt_and_ass_parse_to_the_same_cues(self) -> None:
        srt = (
            "1\n00:00:01,000 --> 00:00:04,000\n私は学生です。\n\n"
            "2\n00:00:05,500 --> 00:00:08,000\n今日は暑い！\n"
        )
        vtt = (
            "WEBVTT\n\n"
            "00:00:01.000 --> 00:00:04.000\n私は学生です。\n\n"
            "00:00:05.500 --> 00:00:08.000\n今日は暑い！\n"
        )
        ass = (
            "[Script Info]\n\n"
            "[Events]\n"
            "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
            "Dialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,私は学生です。\n"
            "Dialogue: 0,0:00:05.50,0:00:08.00,Default,,0,0,0,,今日は暑い！\n"
        )
        expected = [
            {"start": 1.0, "end": 4.0, "text": "私は学生です。"},
            {"start": 5.5, "end": 8.0, "text": "今日は暑い！"},
        ]
        self.assertEqual(parse_track(srt, "t.srt"), expected)
        self.assertEqual(parse_track(vtt, "t.vtt"), expected)
        self.assertEqual(parse_track(ass, "t.ass"), expected)

    def test_html_and_positioning_markup_is_stripped(self) -> None:
        srt = "1\n00:00:01,000 --> 00:00:02,000\n{\\an8}<i>今日は</i>暑い！\n"
        result = parse_track(srt, "t.srt")
        self.assertEqual(result[0]["text"], "今日は暑い！")

    def test_ass_override_blocks_are_stripped(self) -> None:
        ass = (
            "[Events]\n"
            "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
            r"Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,私は{\i1}学生{\i0}です。" + "\n"
        )
        result = parse_track(ass, "t.ass")
        self.assertEqual(result[0]["text"], "私は学生です。")

    def test_duplicate_consecutive_rolling_window_cues_are_merged(self) -> None:
        # The exact shape YouTube auto-captions produce: each Cue is the
        # previous one plus a few more words.
        srt = (
            "1\n00:00:01,000 --> 00:00:02,000\n私は\n\n"
            "2\n00:00:02,000 --> 00:00:03,000\n私は学生\n\n"
            "3\n00:00:03,000 --> 00:00:04,000\n私は学生です\n"
        )
        result = parse_track(srt, "t.srt")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["text"], "私は学生です")
        self.assertEqual(result[0]["start"], 1.0)
        self.assertEqual(result[0]["end"], 4.0)

    def test_malformed_content_raises_caption_parse_error(self) -> None:
        with self.assertRaises(CaptionParseError):
            parse_track("this is not a subtitle file at all", "t.srt")

    def test_empty_cues_after_stripping_are_dropped(self) -> None:
        srt = (
            "1\n00:00:01,000 --> 00:00:02,000\n<i></i>\n\n"
            "2\n00:00:03,000 --> 00:00:04,000\n実際の文。\n"
        )
        result = parse_track(srt, "t.srt")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["text"], "実際の文。")

    def test_extensionless_content_is_sniffed(self) -> None:
        vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nテスト\n"
        result = parse_track(vtt, "upload")
        self.assertEqual(result[0]["text"], "テスト")


class ParseVideoIdTests(unittest.TestCase):
    """parse_video_id recognizes every YouTube URL shape we've seen and
    rejects everything else, without ever raising."""

    def test_watch_url(self) -> None:
        self.assertEqual(
            parse_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s"),
            "dQw4w9WgXcQ",
        )

    def test_short_url(self) -> None:
        self.assertEqual(parse_video_id("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ")

    def test_shorts_url(self) -> None:
        self.assertEqual(
            parse_video_id("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ"
        )

    def test_live_url(self) -> None:
        # Premieres and streams keep /live/ even after they end.
        self.assertEqual(
            parse_video_id("https://www.youtube.com/live/dQw4w9WgXcQ"), "dQw4w9WgXcQ"
        )

    def test_embed_url(self) -> None:
        # What a copied embed snippet contains.
        self.assertEqual(
            parse_video_id("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ"
        )

    def test_mobile_url(self) -> None:
        # Works via .search rather than its own pattern.
        self.assertEqual(
            parse_video_id("https://m.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ"
        )

    def test_share_link_with_si_suffix(self) -> None:
        # The shape YouTube's own Share button produces today.
        self.assertEqual(
            parse_video_id("https://youtu.be/dQw4w9WgXcQ?si=AbCdEfGhIjKl"), "dQw4w9WgXcQ"
        )

    def test_non_youtube_url_returns_none(self) -> None:
        self.assertIsNone(parse_video_id("https://example.com/watch?v=dQw4w9WgXcQ"))

    def test_garbage_returns_none_not_raise(self) -> None:
        self.assertIsNone(parse_video_id("not a url"))


if __name__ == "__main__":
    unittest.main()
