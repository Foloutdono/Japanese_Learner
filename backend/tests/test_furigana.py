import unittest

from study.furigana import align, align_deck, is_kanji


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


class DeckAlignmentTests(unittest.TestCase):
    """Against the real deck, which is what actually ships."""

    def test_known_words(self) -> None:
        for text, reading, expected in [
            ("大学", "だいがく", [("大", "だい"), ("学", "がく")]),
            ("新聞", "しんぶん", [("新", "しん"), ("聞", "ぶん")]),
            ("先生", "せんせい", [("先", "せん"), ("生", "せい")]),
            ("友達", "ともだち", [("友", "とも"), ("達", "だち")]),
        ]:
            self.assertEqual(_flat(align_deck(text, reading)), expected, text)

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
                rebuilt = "".join(p.get("reading") or p["text"] for p in parts)
                self.assertEqual(rebuilt, kana, f"{word} / {kana} -> {parts}")
                checked += 1
        self.assertGreater(checked, 5000, "guard would pass vacuously")


if __name__ == "__main__":
    unittest.main()
