"""The subtitle formats plan 265 added to parse_track: TTML/DFXP (the
streaming services' and broadcasters' exports), SBV (YouTube Studio's)
and json3 (YouTube's own timed text as JSON). Each reads to the cues
the formats before it do."""
import json
import unittest

from study.captions import CaptionParseError, parse_track

EXPECTED = [
    {"start": 1.0, "end": 4.0, "text": "私は学生です。"},
    {"start": 5.5, "end": 8.0, "text": "今日は暑い！"},
]


class TtmlTests(unittest.TestCase):
    def test_a_ttml_reads_to_the_cues_an_srt_does(self) -> None:
        ttml = (
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<tt xmlns="http://www.w3.org/ns/ttml" xml:lang="ja"><body><div>'
            '<p begin="00:00:01.000" end="00:00:04.000">私は学生です。</p>'
            '<p begin="00:00:05.500" end="00:00:08.000">今日は<br/>暑い！</p>'
            '</div></body></tt>'
        )
        cues = parse_track(ttml, "a.ttml")
        self.assertEqual([c["text"] for c in cues], ["私は学生です。", "今日は 暑い！"])
        self.assertEqual([(c["start"], c["end"]) for c in cues], [(1.0, 4.0), (5.5, 8.0)])

    def test_ticks_frames_and_offsets_are_read_on_the_documents_clock(self) -> None:
        # Netflix's DFXP counts in ticks at ttp:tickRate.
        ttml = (
            '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter"'
            ' ttp:tickRate="10000000" ttp:frameRate="25"><body><div>'
            '<p begin="10000000t" end="40000000t">私は学生です。</p>'
            '<p begin="00:00:05:12" dur="2.5s">今日は暑い！</p>'
            '</div></body></tt>'
        )
        cues = parse_track(ttml, "a.dfxp")
        self.assertEqual((cues[0]["start"], cues[0]["end"]), (1.0, 4.0))
        self.assertEqual((cues[1]["start"], cues[1]["end"]), (5.48, 7.98))

    def test_a_divs_begin_moves_the_paragraphs_it_holds(self) -> None:
        ttml = (
            '<tt xmlns="http://www.w3.org/ns/ttml"><body><div begin="10s">'
            '<p begin="1s" end="4s">私は学生です。</p>'
            '</div></body></tt>'
        )
        [cue] = parse_track(ttml, "a.ttml")
        self.assertEqual((cue["start"], cue["end"]), (11.0, 14.0))

    def test_the_ruby_reading_is_dropped_and_its_base_kept(self) -> None:
        ttml = (
            '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">'
            '<body><div><p begin="1s" end="3s">'
            '<span tts:ruby="container"><span tts:ruby="base">学生</span>'
            '<span tts:ruby="textContainer"><span tts:ruby="text">がくせい</span></span></span>です'
            '</p></div></body></tt>'
        )
        [cue] = parse_track(ttml, "a.ttml")
        self.assertEqual(cue["text"], "学生です")

    def test_an_xml_file_is_sniffed_as_ttml(self) -> None:
        ttml = (
            '<tt xmlns="http://www.w3.org/2006/10/ttaf1"><body><div>'
            '<p begin="1s" end="4s">私は学生です。</p></div></body></tt>'
        )
        self.assertEqual(parse_track(ttml, "netflix.xml")[0]["text"], "私は学生です。")

    def test_a_document_with_a_dtd_is_refused(self) -> None:
        bomb = (
            '<?xml version="1.0"?><!DOCTYPE tt [<!ENTITY a "aaaaaaaaaa">]>'
            '<tt xmlns="http://www.w3.org/ns/ttml"><body><div>'
            '<p begin="1s" end="2s">&a;</p></div></body></tt>'
        )
        with self.assertRaises(CaptionParseError):
            parse_track(bomb, "a.ttml")


class RubyTests(unittest.TestCase):
    def test_a_vtt_cues_furigana_is_dropped_and_its_kanji_kept(self) -> None:
        vtt = (
            "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n"
            "<ruby>学生<rp>(</rp><rt>がくせい</rt><rp>)</rp></ruby>です\n"
        )
        [cue] = parse_track(vtt, "a.vtt")
        self.assertEqual(cue["text"], "学生です")


class SbvTests(unittest.TestCase):
    def test_an_sbv_reads_to_the_cues_an_srt_does(self) -> None:
        sbv = (
            "0:00:01.000,0:00:04.000\n私は学生です。\n\n"
            "0:00:05.500,0:00:08.000\n今日は暑い！\n"
        )
        self.assertEqual(parse_track(sbv, "a.sbv"), EXPECTED)
        self.assertEqual(parse_track(sbv, "noext"), EXPECTED)


class Json3Tests(unittest.TestCase):
    def test_a_json3_reads_to_the_cues_an_srt_does(self) -> None:
        track = {"events": [
            {"tStartMs": 0, "dDurationMs": 100000, "id": 1, "wpWinPosId": 1},
            {"tStartMs": 1000, "dDurationMs": 3000, "segs": [{"utf8": "私は学生です。"}]},
            {"tStartMs": 4000, "dDurationMs": 10, "aAppend": 1, "segs": [{"utf8": "\n"}]},
            {"tStartMs": 5500, "dDurationMs": 2500, "segs": [{"utf8": "今日は暑い！"}]},
        ]}
        self.assertEqual(parse_track(json.dumps(track, ensure_ascii=False), "a.json"), EXPECTED)

    def test_a_recognised_tracks_words_keep_their_times(self) -> None:
        track = {"events": [
            {"tStartMs": 1000, "dDurationMs": 5000, "segs": [
                {"utf8": "今日"}, {"utf8": "は", "tOffsetMs": 400}, {"utf8": "暑い", "tOffsetMs": 900},
            ]},
            {"tStartMs": 3000, "dDurationMs": 4000, "segs": [{"utf8": "ですね"}]},
        ]}
        cues = parse_track(json.dumps(track, ensure_ascii=False), "asr.json")
        self.assertEqual(cues[0]["text"], "今日は暑い")
        self.assertEqual(cues[0]["words"], [[0, 1.0], [2, 1.4], [3, 1.9]])
        # Cut where the next line starts, as an srv3's are.
        self.assertEqual(cues[0]["end"], 3.0)

    def test_json_that_is_no_track_is_refused(self) -> None:
        with self.assertRaises(CaptionParseError):
            parse_track('{"something": 1}', "a.json")


if __name__ == "__main__":
    unittest.main()
