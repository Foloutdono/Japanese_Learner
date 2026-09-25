import unittest

from study import morphology
from study.furigana import (
    align, align_deck, align_sentence, is_kanji, mark_spans, written_reading,
)


# A tiny stand-in deck, so the alignment rules are tested against known
# readings rather than against whatever the real deck happens to hold.
_FAKE = {
    "大": "ダイ・タイ・おお.きい",
    "学": "ガク・まな.ぶ",
    "校": "コウ",
    "食": "ショク・た.べる",
    "切": "セツ・き.る",
    "手": "シュ・て",
    "人": "ジン・ニン・ひと",
    "国": "コク・くに",
    "会": "カイ・エ・あ.う",
    "売": "バイ・う.る",
    "上": "ジョウ・うえ・あ.げる",
    "世": "セイ・セ・よ",
    "界": "カイ",
    "中": "チュウ・なか",
}


def _fake(char):
    return _FAKE.get(char)


def _flat(parts):
    return [(p["text"], p.get("reading")) for p in parts]


class AlignmentTests(unittest.TestCase):
    """
    A word stores one flat reading, and putting all of it over all of the
    word is wrong twice: it repeats kana the word already writes, and it
    gives one blanket label where a compound needs per-kanji furigana.
    """

    def test_a_compound_splits_per_kanji(self) -> None:
        self.assertEqual(
            _flat(align("大学", "だいがく", _fake)),
            [("大", "だい"), ("学", "がく")],
        )

    def test_okurigana_keeps_its_own_kana_bare(self) -> None:
        # べる is written in the word already; furigana over it would print
        # the same kana twice, once above and once below.
        self.assertEqual(
            _flat(align("食べる", "たべる", _fake)),
            [("食", "た"), ("べる", None)],
        )

    def test_gemination(self) -> None:
        # がく + こう is がっこう. Without this the run does not divide and
        # falls back to one blanket ruby.
        self.assertEqual(
            _flat(align("学校", "がっこう", _fake)),
            [("学", "がっ"), ("校", "こう")],
        )

    def test_an_inserted_geminate(self) -> None:
        # 切 (き) + 手 (て) is きって: the っ is added, not substituted.
        self.assertEqual(
            _flat(align("切手", "きって", _fake)),
            [("切", "きっ"), ("手", "て")],
        )

    def test_rendaku(self) -> None:
        self.assertEqual(
            _flat(align("国会", "こっかい", _fake)),
            [("国", "こっ"), ("会", "かい")],
        )

    def test_an_on_reading_matches_despite_being_stored_in_katakana(self) -> None:
        # The deck writes on-readings as ダイ; a word's reading says だい.
        self.assertEqual(_flat(align("大学", "だいがく", _fake))[0], ("大", "だい"))

    def test_a_word_that_will_not_divide_keeps_one_reading(self) -> None:
        # 日本語 is にほんご, but 日 contributes に by irregular contraction
        # and no rule here derives it. A COARSE furigana is fine; a wrong
        # one is not, because the learner cannot tell it is wrong.
        parts = _flat(align("大学", "でたらめ", _fake))
        self.assertEqual(parts, [("大学", "でたらめ")])

    def test_a_kana_only_word_gets_no_furigana(self) -> None:
        self.assertEqual(_flat(align("たべる", "たべる", _fake)), [("たべる", None)])

    def test_empty_input(self) -> None:
        self.assertEqual(align("", "x", _fake), [])
        self.assertEqual(_flat(align("大", "", _fake)), [("大", None)])

    def test_anchors_that_do_not_line_up_fall_back(self) -> None:
        # An irregular entry whose kana anchors are absent from the reading
        # must not be sliced at the wrong place.
        self.assertEqual(
            _flat(align("食べる", "しょくじ", _fake)),
            [("食べる", "しょくじ")],
        )

    def test_is_kanji(self) -> None:
        self.assertTrue(is_kanji("学"))
        self.assertFalse(is_kanji("が"))
        self.assertFalse(is_kanji("A"))
        # 々 belongs in a kanji run, but it is not a character anyone
        # looks up, and study/kanji_words.py indexes by is_kanji.
        self.assertFalse(is_kanji("々"))

    def test_the_iteration_mark_repeats_the_kanji_before_it(self) -> None:
        # 々 was a kana anchor that never appears in a reading, so every
        # word with one came back as one blanket ruby.
        self.assertEqual(
            _flat(align("人々", "ひとびと", _fake)),
            [("人", "ひと"), ("々", "びと")],
        )

    def test_a_packed_suru_is_not_furigana(self) -> None:
        # The deck wrote 練習 as れんしゅうする and 入学 as にゅうがく・する:
        # する is not written, so nothing is printed over it.
        for reading in ("だいがくする", "だいがく・する"):
            self.assertEqual(
                _flat(align("大学", reading, _fake)),
                [("大", "だい"), ("学", "がく")],
                reading,
            )

    def test_written_reading_drops_only_a_suru_the_text_does_not_spell(self) -> None:
        self.assertEqual(written_reading("練習", "れんしゅうする"), "れんしゅう")
        self.assertEqual(written_reading("入学", "にゅうがく・する"), "にゅうがく")
        # A word ending in kana spells its own ending: 為る IS する.
        self.assertEqual(written_reading("為る", "する"), "する")
        self.assertEqual(written_reading("擦る", "こする"), "こする")
        self.assertEqual(written_reading("大学", "だいがく"), "だいがく")

    def test_okurigana_taken_into_the_kanji(self) -> None:
        # 売上 writes neither う.る's る nor あ.げる's げる: the second pass
        # reads 売 as うり (連用形) and 上 as あげ.
        self.assertEqual(
            _flat(align("売上", "うりあげ", _fake)),
            [("売", "うり"), ("上", "あげ")],
        )

    def test_a_voiced_chi_written_ji(self) -> None:
        # 世界中 is せかいじゅう: rendaku gives ぢゅう, modern spelling じゅう.
        self.assertEqual(
            _flat(align("世界中", "せかいじゅう", _fake)),
            [("世", "せ"), ("界", "かい"), ("中", "じゅう")],
        )

    def test_the_second_pass_never_voices_a_word_initial_kanji(self) -> None:
        self.assertEqual(
            _flat(align("中界", "じゅうかい", _fake)),
            [("中界", "じゅうかい")],
        )


class DeckAlignmentTests(unittest.TestCase):
    """Against the real deck, which is what actually ships."""

    def test_known_words(self) -> None:
        for text, reading, expected in [
            ("大学", "だいがく", [("大", "だい"), ("学", "がく")]),
            ("新聞", "しんぶん", [("新", "しん"), ("聞", "ぶん")]),
            ("先生", "せんせい", [("先", "せん"), ("生", "せい")]),
            ("友達", "ともだち", [("友", "とも"), ("達", "だち")]),
            ("時々", "ときどき", [("時", "とき"), ("々", "どき")]),
            ("練習", "れんしゅうする", [("練", "れん"), ("習", "しゅう")]),
            ("戸締り", "とじまり", [("戸", "と"), ("締", "じま"), ("り", None)]),
        ]:
            self.assertEqual(_flat(align_deck(text, reading)), expected, text)

    def test_a_kanji_the_deck_does_not_teach_reads_from_kanjidic(self) -> None:
        # 身 and 的 are jōyō kanji the deck has no card for, and with no
        # readings to try every word containing one came back undivided.
        from content.kanji_data import KANJI_BY_LEVEL

        taught = {e["kanji"] for entries in KANJI_BY_LEVEL.values() for e in entries}
        self.assertNotIn("身", taught, "pick another untaught kanji for this test")
        self.assertEqual(_flat(align_deck("独身", "どくしん")), [("独", "どく"), ("身", "しん")])
        self.assertEqual(_flat(align_deck("目的", "もくてき")), [("目", "もく"), ("的", "てき")])

    def test_a_reading_that_belongs_to_the_whole_word_stays_whole(self) -> None:
        # 熟字訓: け is no reading of 今, and no rule may pretend it is.
        self.assertEqual(_flat(align_deck("今朝", "けさ")), [("今朝", "けさ")])
        self.assertEqual(_flat(align_deck("時計", "とけい")), [("時計", "とけい")])

    def test_the_deck_divides(self) -> None:
        # A ratchet, not a target: the deck's words in which some kanji
        # gets no furigana of its own. 391 before the pool fallback, 々,
        # the packed する and the second pass; what is left is mostly
        # 熟字訓 and 当て字, which must stay whole. Lower the bound when a
        # change lowers the figure; never raise it.
        from content.vocab_data import VOCAB_BY_LEVEL

        undivided = []
        for entries in VOCAB_BY_LEVEL.values():
            for e in entries:
                word = (e.get("kanji") or "").strip()
                kana = (e.get("kana") or "").split("/")[0].strip()
                if not word or not kana or not any(is_kanji(c) for c in word):
                    continue
                texts = {p["text"] for p in align_deck(word, kana)}
                if any(is_kanji(c) and c not in texts for c in word):
                    undivided.append(word)
        self.assertLessEqual(len(undivided), 155, undivided[:20])

    def test_a_reading_is_never_invented(self) -> None:
        # Whatever the split, concatenating the parts must reproduce the
        # word, and the readings must reproduce the reading. A rule that
        # dropped or duplicated a mora would be invisible otherwise.
        from content.vocab_data import VOCAB_BY_LEVEL

        checked = 0
        for entries in VOCAB_BY_LEVEL.values():
            for e in entries:
                word = (e.get("kanji") or "").strip()
                kana = (e.get("kana") or "").split("/")[0].strip()
                if not word or not kana or not any(is_kanji(c) for c in word):
                    continue
                parts = align_deck(word, kana)
                self.assertEqual("".join(p["text"] for p in parts), word, word)
                # Less a する a reading packs onto the word (練習
                # れんしゅうする), which the written form does not spell.
                rebuilt = "".join(p.get("reading") or p["text"] for p in parts)
                self.assertEqual(rebuilt, written_reading(word, kana), f"{word} / {kana} -> {parts}")
                checked += 1
        self.assertGreater(checked, 5000, "guard would pass vacuously")


class SentenceAlignmentTests(unittest.TestCase):
    """
    A sentence has no flat reading to align against, so align_sentence
    gets one per morpheme from the tokenizer and aligns each -- the only
    way a kanji's reading IN CONTEXT is right (see study/morphology.py).
    """

    @unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs fugashi/unidic-lite")
    def test_a_sentence_reads_per_kanji(self) -> None:
        self.assertEqual(
            _flat(align_sentence("水だけ飲みました。")),
            [("水", "みず"), ("だけ", None), ("飲", "の"), ("みました。", None)],
        )

    @unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs fugashi/unidic-lite")
    def test_readingless_parts_merge(self) -> None:
        # 少し だけ あり ます 。 is five morphemes and one text node: a
        # run of kana breaks where the browser would break it anyway,
        # and five spans give it nothing an unsplit one does not.
        parts = align_sentence("時間が少しだけあります。")
        self.assertEqual(
            _flat(parts),
            [("時", "じ"), ("間", "かん"), ("が", None), ("少", "すこ"), ("しだけあります。", None)],
        )

    @unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs fugashi/unidic-lite")
    def test_the_sentence_survives_intact(self) -> None:
        # The parts are what gets rendered, so anything dropped between
        # them is a sentence the learner never sees in full.
        for sentence in (
            "水だけ飲みました。",
            "あの人は日本語の先生です。",
            "ひらがなだけです。",
            "コーヒーを飲みませんか。",
        ):
            parts = align_sentence(sentence)
            self.assertEqual("".join(p["text"] for p in parts), sentence, sentence)

    @unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs fugashi/unidic-lite")
    def test_a_kana_only_sentence_gets_no_furigana(self) -> None:
        self.assertEqual(_flat(align_sentence("ひらがなだけです。")), [("ひらがなだけです。", None)])

    def test_empty_input(self) -> None:
        self.assertEqual(align_sentence(""), [])

    def test_without_a_tokenizer_the_sentence_comes_back_bare(self) -> None:
        # morphology.py's GRACEFUL DEGRADATION: a deploy without fugashi
        # renders the plain sentence, which is what every caller showed
        # before furigana. Never a crash, and never a guessed reading.
        original = morphology.tokenize
        morphology.tokenize = lambda text: None
        try:
            self.assertEqual(align_sentence("水だけ飲みました。"), [{"text": "水だけ飲みました。"}])
        finally:
            morphology.tokenize = original


class MarkSpansTests(unittest.TestCase):
    """
    A mark is placed by character offset into the sentence the parts
    spell out, and the parts do not divide where the offsets do. Two
    features point at a span of a sentence -- the grammar lesson at its
    pattern, the translation review at what it corrected -- and both
    get the ruling below.
    """

    def _marked(self, parts):
        return [(p["text"], p.get("highlight", False)) for p in parts]

    def test_a_readingless_run_is_cut_at_the_span(self) -> None:
        parts = [{"text": "わたしはがくせいです"}]
        self.assertEqual(
            self._marked(mark_spans(parts, [(4, 7)])),
            [("わたしは", False), ("がくせ", True), ("いです", False)],
        )

    def test_a_ruby_part_is_marked_whole_rather_than_split(self) -> None:
        # Half a reading over half a word is wrong furigana, and wrong
        # furigana is worse than a mark one character too wide.
        parts = [{"text": "大学", "reading": "だいがく"}, {"text": "です"}]
        self.assertEqual(
            self._marked(mark_spans(parts, [(1, 2)])),
            [("大学", True), ("です", False)],
        )

    def test_several_spans_at_once(self) -> None:
        parts = [{"text": "あ"}, {"text": "父", "reading": "ちち"}, {"text": "いうえお"}]
        self.assertEqual(
            self._marked(mark_spans(parts, [(0, 1), (3, 5)])),
            [("あ", True), ("父", False), ("い", False), ("うえ", True), ("お", False)],
        )

    def test_no_spans_changes_nothing(self) -> None:
        parts = [{"text": "水", "reading": "みず"}, {"text": "です"}]
        self.assertEqual(mark_spans(parts, []), parts)
        self.assertEqual(mark_spans([], [(0, 2)]), [])


if __name__ == "__main__":
    unittest.main()
