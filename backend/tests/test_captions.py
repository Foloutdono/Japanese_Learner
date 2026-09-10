import unittest
from types import SimpleNamespace
from unittest import mock

from study.captions import (
    parse_track, parse_video_id, fetch_youtube_track, proxy_configured,
    CaptionParseError, CaptionFetchError,
)


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


class FetchYouTubeTrackTests(unittest.TestCase):
    """The link ingest. Every test here replaces the transcript API --
    nothing reaches YouTube, and nothing needs a proxy credential to
    prove the selection rules hold.

    The rule under test throughout is the one the pasted-transcript
    ingest died of (docs/adr/0003, 2026-09-01): learners kept getting
    ENGLISH for Japanese videos, because YouTube's own transcript panel
    defaults to a translation. A fetch that accepted "whatever track
    exists" would reintroduce that silently, so a video with no
    Japanese is an error naming the problem -- never a substitution.
    """

    PROXY_ENV = {
        "WEBSHARE_PROXY_USERNAME": "test-user",
        "WEBSHARE_PROXY_PASSWORD": "test-pass",
    }

    @staticmethod
    def _snippets(*triples):
        return [
            SimpleNamespace(text=text, start=start, duration=duration)
            for text, start, duration in triples
        ]

    def _api_returning(self, manual=None, generated=None):
        """A stand-in for YouTubeTranscriptApi offering only the tracks
        named. Absent tracks raise NoTranscriptFound, which is what the
        real TranscriptList does."""
        from youtube_transcript_api import NoTranscriptFound

        class _TranscriptList:
            def find_manually_created_transcript(self, codes):
                if manual is None:
                    raise NoTranscriptFound("vid", list(codes), None)
                return SimpleNamespace(fetch=lambda: manual)

            def find_generated_transcript(self, codes):
                if generated is None:
                    raise NoTranscriptFound("vid", list(codes), None)
                return SimpleNamespace(fetch=lambda: generated)

        class _Api:
            def __init__(self, **kwargs):
                pass

            def list(self, video_id):
                return _TranscriptList()

        return _Api

    def _fetch(self, **tracks):
        import youtube_transcript_api
        with mock.patch.dict("os.environ", self.PROXY_ENV, clear=False), \
             mock.patch.object(
                 youtube_transcript_api, "YouTubeTranscriptApi",
                 self._api_returning(**tracks)):
            return fetch_youtube_track("dQw4w9WgXcQ")

    def test_a_manual_track_becomes_cues_in_the_parse_track_shape(self) -> None:
        """Identical shape to an uploaded file's Track, which is what
        keeps everything downstream of Cue ignorant of this ingest."""
        cues = self._fetch(manual=self._snippets(
            ("私は学生です。", 1.0, 3.0),
            ("今日は暑い！", 5.0, 3.0),
        ))
        self.assertEqual(cues, [
            {"start": 1.0, "end": 4.0, "text": "私は学生です。"},
            {"start": 5.0, "end": 8.0, "text": "今日は暑い！"},
        ])

    def test_a_manual_track_wins_over_an_auto_generated_one(self) -> None:
        """A human-written track is punctuated and segmented by someone
        deciding what belongs on screen together -- exactly the unit
        cue_sentences.py turns into a Sentence."""
        cues = self._fetch(
            manual=self._snippets(("手書きです。", 0.0, 2.0)),
            generated=self._snippets(("じどうです", 0.0, 2.0)),
        )
        self.assertEqual([c["text"] for c in cues], ["手書きです。"])

    def test_an_auto_generated_track_is_used_when_there_is_no_manual_one(self) -> None:
        """Rougher, and still a usable study unit -- so it is the
        fallback, not a refusal."""
        cues = self._fetch(generated=self._snippets(("じどうです", 0.0, 2.0)))
        self.assertEqual([c["text"] for c in cues], ["じどうです"])

    def test_a_video_with_no_japanese_track_is_an_error_not_a_translation(self) -> None:
        """The one that matters. No Japanese means no lesson; handing
        back an English track would be the 2026-09-01 defect again."""
        with self.assertRaises(CaptionFetchError) as caught:
            self._fetch()
        self.assertIn("japanese", str(caught.exception).lower())

    def test_the_rolling_window_of_auto_captions_is_merged(self) -> None:
        """Auto-captions repeat most of each neighbour's text, one or
        two words advancing at a time. Un-merged, a video's actual
        vocabulary would be counted three or four times over."""
        cues = self._fetch(generated=self._snippets(
            ("これは", 0.0, 1.0),
            ("これはペン", 1.0, 1.0),
            ("これはペンです", 2.0, 1.0),
            ("ありがとう", 4.0, 1.0),
        ))
        self.assertEqual(
            [c["text"] for c in cues], ["これはペンです", "ありがとう"]
        )

    def test_an_empty_track_is_an_error_rather_than_an_empty_session(self) -> None:
        with self.assertRaises(CaptionFetchError):
            self._fetch(manual=self._snippets(("   ", 0.0, 1.0)))

    def test_unconfigured_is_the_shipped_state(self) -> None:
        """No proxy anywhere means the ingest is off, and says so."""
        cleared = {k: "" for k in (
            "WEBSHARE_PROXY_USERNAME", "WEBSHARE_PROXY_PASSWORD",
            "YOUTUBE_HTTP_PROXY",
        )}
        with mock.patch.dict("os.environ", cleared, clear=False):
            self.assertFalse(proxy_configured())
            with self.assertRaises(CaptionFetchError):
                fetch_youtube_track("dQw4w9WgXcQ")


if __name__ == "__main__":
    unittest.main()
