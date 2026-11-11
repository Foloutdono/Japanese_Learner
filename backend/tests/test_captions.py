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

    def test_a_kangxi_radical_is_read_as_the_kanji_it_looks_like(self) -> None:
        # A lyric track seen on YouTube writes 自分 with ⾃ (U+2F83), which
        # the tokenizer cannot read: the word had no reading and no time.
        vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n\u2f83分<00:00:02.000>を信じて\n"
        [cue] = parse_track(vtt, "a.vtt")
        self.assertEqual(cue["text"], "自分を信じて")
        self.assertEqual(cue["words"], [[0, 1.0], [2, 2.0]])
        # A compatibility ideograph likewise; plain kanji are left alone.
        [cue] = parse_track("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n\uf9dc年と龍\n", "a.vtt")
        self.assertEqual(cue["text"], "\u9686年と龍")

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

    # ── A line said twice is two lines (2026-10-21) ──
    # The owner's report: a line sung twice in a row came back once, its
    # cue stretched over both, and the words were read out at half the
    # pace they were sung. A line shown again is said again, unless it is
    # the rolling window carrying it: shown too briefly to be said, or
    # while the first still is, with no word of its own timed.
    def test_a_line_sung_twice_in_a_row_stays_twice(self) -> None:
        srt = (
            "1\n00:00:10,000 --> 00:00:12,500\nルララ 宇宙の風に乗る\n\n"
            "2\n00:00:12,500 --> 00:00:15,000\nルララ 宇宙の風に乗る\n\n"
            "3\n00:00:15,000 --> 00:00:16,000\nルララ\n"
        )
        cues = parse_track(srt, "song.srt")
        self.assertEqual([(c["start"], c["end"], c["text"]) for c in cues], [
            (10.0, 12.5, "ルララ 宇宙の風に乗る"),
            (12.5, 15.0, "ルララ 宇宙の風に乗る"),
            # Inside the line before it, and sung on its own.
            (15.0, 16.0, "ルララ"),
        ])

    def test_each_time_a_line_is_sung_keeps_its_own_words(self) -> None:
        vtt = (
            "WEBVTT\n\n"
            "00:00:10.000 --> 00:00:12.000\nもう<00:00:11.000>一回\n\n"
            "00:00:12.000 --> 00:00:14.000\nもう<00:00:13.000>一回\n"
        )
        cues = parse_track(vtt, "a.vtt")
        self.assertEqual([c["words"] for c in cues], [[[0, 10.0], [2, 11.0]], [[0, 12.0], [2, 13.0]]])
        srv3 = (
            '<timedtext format="3"><body>'
            '<p t="10000" d="2000">もう一回</p><p t="12000" d="2000">もう一回</p>'
            '</body></timedtext>'
        )
        self.assertEqual([c["start"] for c in parse_track(srv3, "track.srv3")], [10.0, 12.0])

    def test_the_rolling_window_s_carried_line_is_still_folded(self) -> None:
        # yt-dlp's auto-captions: the finished line held for 10 ms, then
        # the window grows from it, then the line rolled up is held again.
        vtt = (
            "WEBVTT\n\n"
            "00:00:01.000 --> 00:00:03.000\n今日<00:00:01.500>は\n\n"
            "00:00:03.000 --> 00:00:03.010\n今日は\n\n"
            "00:00:03.010 --> 00:00:05.000\n今日は\nいい<00:00:03.500>天気\n\n"
            "00:00:05.000 --> 00:00:05.010\nいい天気\n"
        )
        [cue] = parse_track(vtt, "auto.vtt")
        self.assertEqual(cue["text"], "今日は いい天気")
        self.assertEqual((cue["start"], cue["end"]), (1.0, 5.01))
        # A copy shown while the first still is: the same line, once.
        srt = (
            "1\n00:00:01,000 --> 00:00:04,000\nはい、そうです\n\n"
            "2\n00:00:02,000 --> 00:00:05,000\nはい、そうです\n"
        )
        self.assertEqual([(c["start"], c["end"]) for c in parse_track(srt, "t.srt")], [(1.0, 5.0)])

    def test_malformed_content_raises_caption_parse_error(self) -> None:
        with self.assertRaises(CaptionParseError) as caught:
            parse_track("this is not a subtitle file at all", "t.srt")
        # The code is what the learner is told by (plan 215); the
        # English message beside it is for the logs.
        self.assertEqual(caught.exception.code, "parse_failed")

    def test_an_unknown_format_is_named_as_one(self) -> None:
        with self.assertRaises(CaptionParseError) as caught:
            parse_track("this is not a subtitle file at all", "notes.doc")
        self.assertEqual(caught.exception.code, "unknown_format")

    # ── Lyrics (plan 264) ──
    def test_a_text_file_is_a_line_each_in_order(self) -> None:
        cues = parse_track("君の名前を\n\n呼ぶよ\n呼ぶよ\n", "song.txt")
        self.assertEqual([c["text"] for c in cues], ["君の名前を", "呼ぶよ", "呼ぶよ"])
        self.assertEqual([c["start"] for c in cues], [0.0, 5.0, 10.0])

    def test_a_timed_track_saved_as_text_is_read_as_what_it_is(self) -> None:
        cues = parse_track("1\n00:00:01,000 --> 00:00:02,500\nこんにちは\n", "track.txt")
        self.assertEqual(cues, [{"start": 1.0, "end": 2.5, "text": "こんにちは"}])

    def test_an_lrc_is_read_by_its_times(self) -> None:
        lrc = (
            "[ti:夜に駆ける]\n[ar:YOASOBI]\n"
            "[00:12.50]沈むように\n"
            "[00:18.00][01:30.00]二人だけの空\n"
            "[00:24.10]\n"
            "[00:30.00]<00:30.00>さよ<00:31.20>なら\n"
        )
        cues = parse_track(lrc, "song.lrc")
        self.assertEqual([(c["start"], c["end"], c["text"]) for c in cues], [
            (12.5, 18.0, "沈むように"),
            # Ended by the bare time after it: an instrumental break.
            (18.0, 24.1, "二人だけの空"),
            (30.0, 90.0, "さよなら"),
            # A chorus line stamped twice is sung twice.
            (90.0, 95.0, "二人だけの空"),
        ])
        self.assertEqual(cues[2]["words"], [[0, 30.0], [2, 31.2]])

    def test_an_lrc_offset_moves_its_lines_and_words(self) -> None:
        cues = parse_track("[offset:+500]\n[00:10.00]<00:10.00>あ<00:11.00>い\n[00:12.00]う\n", "x.lrc")
        self.assertEqual([c["start"] for c in cues], [9.5, 11.5])
        self.assertEqual(cues[0]["words"], [[0, 9.5], [1, 10.5]])

    def test_an_lrc_is_found_without_its_extension(self) -> None:
        cues = parse_track("[00:01.00]あ\n[00:02.00]い\n", "lyrics")
        self.assertEqual([c["text"] for c in cues], ["あ", "い"])

    def test_a_lyric_sung_twice_in_a_row_stays_twice(self) -> None:
        cues = parse_track("[00:01.00]ラララ\n[00:02.00]ラララ\n", "x.lrc")
        self.assertEqual(len(cues), 2)

    def test_a_file_with_nothing_to_read_is_named_as_one(self) -> None:
        with self.assertRaises(CaptionParseError) as caught:
            parse_track("1\n00:00:01,000 --> 00:00:02,000\n<i></i>\n", "t.srt")
        self.assertEqual(caught.exception.code, "no_cues")

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


class WordTimeTests(unittest.TestCase):
    """A cue's `words`: [offset, seconds] where the file says when a word
    is said -- VTT's karaoke stamps and ASS's \\k tags -- taken out of the
    text and kept, the offset into the cue's clean text."""

    def test_vtt_stamps_become_anchors_and_leave_the_text(self) -> None:
        vtt = (
            "WEBVTT\n\n"
            "00:00:01.000 --> 00:00:04.000\n"
            "今日<00:00:01.500>は<00:00:02.000>いい<00:00:02.600>天気\n"
        )
        [cue] = parse_track(vtt, "a.vtt")
        self.assertEqual(cue["text"], "今日はいい天気")
        # The words before the first stamp are said from the cue's start.
        self.assertEqual(cue["words"], [[0, 1.0], [2, 1.5], [3, 2.0], [5, 2.6]])

    def test_a_stamp_before_a_spaced_word_anchors_the_word_not_the_space(self) -> None:
        # yt-dlp's auto-captions: <t><c> word</c>
        vtt = (
            "WEBVTT\n\n"
            "00:00:05.000 --> 00:00:07.000 align:start position:0%\n"
            "<c>雨</c><00:00:05.400><c> が</c><00:00:05.900><c> 降る</c>\n"
        )
        [cue] = parse_track(vtt, "a.vtt")
        self.assertEqual(cue["text"], "雨 が 降る")
        self.assertEqual(cue["words"], [[0, 5.0], [2, 5.4], [4, 5.9]])

    def test_a_cue_without_stamps_has_no_words(self) -> None:
        [cue] = parse_track("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n雨\n", "a.vtt")
        self.assertNotIn("words", cue)

    def test_a_stamp_is_never_left_in_an_srt_line(self) -> None:
        srt = "1\n00:00:01,000 --> 00:00:02,000\n雨<00:00:01.500>が\n"
        [cue] = parse_track(srt, "a.srt")
        self.assertEqual(cue["text"], "雨が")

    def test_ass_karaoke_tags_time_each_syllable(self) -> None:
        ass = (
            "[Events]\n"
            "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
            "Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,"
            "{\\k50}{\\k20}今{\\k30}日{\\an8\\kf40}は\n"
        )
        [cue] = parse_track(ass, "a.ass")
        self.assertEqual(cue["text"], "今日は")
        # 50cs of silence first: the first syllable starts at 1.5.
        self.assertEqual(cue["words"], [[0, 1.5], [1, 1.7], [2, 2.0]])

    def test_a_growing_rolling_window_keeps_both_halves_times(self) -> None:
        vtt = (
            "WEBVTT\n\n"
            "00:00:01.000 --> 00:00:02.000\n今日<00:00:01.500>は\n\n"
            "00:00:02.000 --> 00:00:03.000\n今日は いい<00:00:02.500>天気\n"
        )
        [cue] = parse_track(vtt, "a.vtt")
        self.assertEqual(cue["text"], "今日は いい天気")
        # The grown window's own start is when it appeared, not when 今日
        # was said: the first cue's times stand for the first half.
        self.assertEqual(cue["words"], [[0, 1.0], [2, 1.5], [6, 2.5]])

    def test_a_stamp_at_the_cue_s_first_word_wins_over_its_start(self) -> None:
        vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n<00:00:01.300>雨<00:00:01.800>が\n"
        [cue] = parse_track(vtt, "a.vtt")
        self.assertEqual(cue["words"], [[0, 1.3], [1, 1.8]])


# srv3, YouTube's own timed text (plan 221): the link fetch reads it
# here, the grab converts it to VTT in the browser. These are the
# fixtures of frontend/src/lib/captionGrab.test.js, and the VTT is what
# its transcriptXmlToVtt writes for them, so the two paths are held to
# the same cues.
SRV3_ASR = (
    '<?xml version="1.0" encoding="utf-8" ?><timedtext format="3"><body>'
    '<w t="0" id="1"/>'
    '<p t="1280" d="4799" w="1"><s ac="0">今日</s><s t="400" ac="0">は</s><s t="720" ac="0">いい</s></p>'
    '<p t="3690" d="2389" w="1" a="1">\n</p>'
    '<p t="3700" d="3000" w="1"><s ac="0">天気</s><s t="500" ac="0">です</s></p>'
    '</body></timedtext>'
)
SRV3_ASR_AS_THE_GRAB_SENDS_IT = (
    "WEBVTT\n\n00:00:01.280 --> 00:00:03.700\n今日<00:00:01.680>は<00:00:02.000>いい\n\n"
    "00:00:03.700 --> 00:00:06.700\n天気<00:00:04.200>です\n"
)
SRV3_MANUAL = '<timedtext format="3"><body><p t="1000" d="2000">雨が&amp;#39;<br/>降る</p></body></timedtext>'
SRV3_MANUAL_AS_THE_GRAB_SENDS_IT = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n雨が' 降る\n"


class Srv3Tests(unittest.TestCase):
    def test_a_recognised_track_reads_as_the_grab_s_vtt_does(self) -> None:
        cues = parse_track(SRV3_ASR, "track.srv3")
        self.assertEqual(cues, parse_track(SRV3_ASR_AS_THE_GRAB_SENDS_IT, "t.vtt"))
        self.assertEqual(cues[0], {
            "start": 1.28, "end": 3.7, "text": "今日はいい",
            "words": [[0, 1.28], [2, 1.68], [3, 2.0]],
        })

    def test_a_hand_written_track_reads_as_the_grab_s_vtt_does(self) -> None:
        cues = parse_track(SRV3_MANUAL, "track.srv3")
        self.assertEqual(cues, parse_track(SRV3_MANUAL_AS_THE_GRAB_SENDS_IT, "t.vtt"))
        self.assertEqual(cues, [{"start": 1.0, "end": 3.0, "text": "雨が' 降る"}])

    def test_srv3_is_sniffed_without_its_extension(self) -> None:
        self.assertEqual(parse_track(SRV3_ASR, "track"), parse_track(SRV3_ASR, "track.srv3"))


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
        self.assertEqual(caught.exception.code, "no_japanese_subtitles")

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

    def test_a_line_sung_twice_in_a_fetched_track_stays_twice(self) -> None:
        cues = self._fetch(manual=self._snippets(
            ("ルララ", 10.0, 2.0),
            ("ルララ", 12.0, 2.0),
        ))
        self.assertEqual([c["start"] for c in cues], [10.0, 12.0])

    def test_an_empty_track_is_an_error_rather_than_an_empty_session(self) -> None:
        with self.assertRaises(CaptionFetchError) as caught:
            self._fetch(manual=self._snippets(("   ", 0.0, 1.0)))
        self.assertEqual(caught.exception.code, "subtitles_empty")

    # ── srv3: when each word is said (plan 221) ──
    @staticmethod
    def _session(bodies):
        """The library's proxied session: srv3 for the URLs in `bodies`,
        refused for any other. Records what it was asked."""
        class _Session:
            asked = []

            def get(self, url, timeout=None):
                self.asked.append(url)
                if url not in bodies:
                    raise ConnectionError("refused")
                return SimpleNamespace(text=bodies[url], raise_for_status=lambda: None)
        return _Session()

    MANUAL_URL = "https://www.youtube.com/api/timedtext?v=vid&lang=ja"
    ASR_URL = "https://www.youtube.com/api/timedtext?v=vid&lang=ja&kind=asr"
    MANUAL_SRV3 = '<timedtext format="3"><body><p t="1000" d="3000">今日はいい天気です</p></body></timedtext>'
    ASR_SRV3 = (
        '<timedtext format="3"><body><p t="1100" d="3000" w="1">'
        '<s>今日</s><s t="500">は</s><s t="700">いい</s><s t="1200">天気</s><s t="1800">です</s>'
        '</p></body></timedtext>'
    )

    def _fetch_srv3(self, session, manual=None, generated=None):
        import youtube_transcript_api

        def track(url, snippets):
            return SimpleNamespace(fetch=lambda: snippets, _url=url, _http_client=session)

        class _TranscriptList:
            def find_manually_created_transcript(self, codes):
                if manual is None:
                    raise youtube_transcript_api.NoTranscriptFound("vid", list(codes), None)
                return track(FetchYouTubeTrackTests.MANUAL_URL, manual)

            def find_generated_transcript(self, codes):
                if generated is None:
                    raise youtube_transcript_api.NoTranscriptFound("vid", list(codes), None)
                return track(FetchYouTubeTrackTests.ASR_URL, generated)

        class _Api:
            def __init__(self, **kwargs):
                pass

            def list(self, video_id):
                return _TranscriptList()

        with mock.patch.dict("os.environ", self.PROXY_ENV, clear=False), \
             mock.patch.object(youtube_transcript_api, "YouTubeTranscriptApi", _Api):
            return fetch_youtube_track("dQw4w9WgXcQ")

    def test_a_hand_written_line_takes_the_recognised_track_s_word_times(self) -> None:
        """What the grab has done since 2026-09-27, and the link fetch
        never did: its sessions had every word lit on an estimate."""
        session = self._session({
            self.MANUAL_URL + "&fmt=srv3": self.MANUAL_SRV3,
            self.ASR_URL + "&fmt=srv3": self.ASR_SRV3,
        })
        cues = self._fetch_srv3(
            session,
            manual=self._snippets(("今日はいい天気です", 1.0, 3.0)),
            generated=self._snippets(("きょうはいいてんきです", 1.1, 3.0)),
        )
        self.assertEqual([c["text"] for c in cues], ["今日はいい天気です"])
        # 天気 starts at offset 5, when the recogniser heard it.
        self.assertIn([5, 2.3], cues[0]["words"])
        # Through the library's own session, so through the proxy.
        self.assertEqual(session.asked, [self.MANUAL_URL + "&fmt=srv3", self.ASR_URL + "&fmt=srv3"])

    def test_a_recognised_track_alone_keeps_its_own_word_times(self) -> None:
        session = self._session({self.ASR_URL + "&fmt=srv3": self.ASR_SRV3})
        cues = self._fetch_srv3(session, generated=self._snippets(("x", 0.0, 1.0)))
        self.assertEqual(cues, [{
            "start": 1.1, "end": 4.1, "text": "今日はいい天気です",
            "words": [[0, 1.1], [2, 1.6], [3, 1.8], [5, 2.3], [7, 2.9]],
        }])

    def test_a_track_that_will_not_come_as_srv3_is_read_as_before(self) -> None:
        """Best effort: the srv3 read costs the words their times, never
        the session."""
        cues = self._fetch_srv3(
            self._session({}),
            manual=self._snippets(("今日はいい天気です", 1.0, 3.0)),
            generated=self._snippets(("きょう", 1.1, 3.0)),
        )
        self.assertEqual(cues, [{"start": 1.0, "end": 4.0, "text": "今日はいい天気です"}])

    def test_unconfigured_is_the_shipped_state(self) -> None:
        """No proxy anywhere means the ingest is off, and says so."""
        cleared = {k: "" for k in (
            "WEBSHARE_PROXY_USERNAME", "WEBSHARE_PROXY_PASSWORD",
            "YOUTUBE_HTTP_PROXY",
        )}
        with mock.patch.dict("os.environ", cleared, clear=False):
            self.assertFalse(proxy_configured())
            with self.assertRaises(CaptionFetchError) as caught:
                fetch_youtube_track("dQw4w9WgXcQ")
            self.assertEqual(caught.exception.code, "link_fetch_disabled")


if __name__ == "__main__":
    unittest.main()
