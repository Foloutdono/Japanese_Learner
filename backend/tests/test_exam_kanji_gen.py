# The near-miss distractors of the 漢字読み items: what a candidate may
# and may not look like once it reaches a paper as a choice.
import random
import unittest

from content.vocab_data import VOCAB_BY_LEVEL
from study import exam_kanji_gen as gen


class KanjidicNotationTests(unittest.TestCase):
    def test_strip_okurigana_drops_the_prefix_and_suffix_hyphens(self):
        self.assertEqual(gen._strip_okurigana("-うえ"), "うえ")
        self.assertEqual(gen._strip_okurigana("うわ-"), "うわ")
        self.assertEqual(gen._strip_okurigana("-あ.げる"), "あ")

    def test_no_single_kanji_word_offers_a_hyphenated_choice(self):
        # 144 single-kanji deck words (上, 目, 水, 人...) carry a KANJIDIC
        # reading marked with a hyphen; none may surface as a choice.
        rng = random.Random(0)
        for entries in VOCAB_BY_LEVEL.values():
            for word in entries:
                kanji = word.get("kanji") or ""
                if len(kanji) != 1:
                    continue
                for candidate in gen.build_kanji_reading_distractors(word, rng):
                    self.assertNotIn("-", candidate, f"{kanji}: {candidate}")


class LongVowelTests(unittest.TestCase):
    def test_a_short_word_ending_in_u_is_left_alone(self):
        self.assertEqual(gen._toggle_long_vowel("あう"), [])

    def test_a_longer_word_ending_in_u_is_shortened(self):
        self.assertEqual(gen._toggle_long_vowel("せんしゅう"), ["せんしゅ"])

    def test_a_contracted_mora_is_lengthened(self):
        self.assertEqual(gen._toggle_long_vowel("せんしゅ"), ["せんしゅう"])
        self.assertEqual(gen._toggle_long_vowel("きょ"), ["きょう"])

    def test_a_plain_u_column_mora_is_not_lengthened(self):
        # らいげつう, だすう: no reading lengthens げつ or す (plan 247).
        self.assertEqual(gen._toggle_long_vowel("らいげつ"), [])
        self.assertEqual(gen._toggle_long_vowel("ちず"), [])
        self.assertEqual(gen._toggle_long_vowel("ごご"), ["ごごう"])


def _word(kanji: str, kana: str) -> list[str]:
    return gen.build_kanji_reading_distractors({"kanji": kanji, "kana": kana}, random.Random(0))


class ImpossibleChoiceTests(unittest.TestCase):
    """The choices the seed papers' audit struck by eye (plan 247)."""

    def test_the_printed_okurigana_is_kept(self):
        for kanji, kana in (("出す", "だす"), ("食べる", "たべる"), ("起きる", "おきる"), ("お兄さん", "おにいさん")):
            for choice in _word(kanji, kana):
                self.assertTrue(gen._fits_written(choice, kanji), f"{kanji}: {choice}")
        self.assertFalse(gen._fits_written("たべるう", "食べる"))
        self.assertTrue(gen._fits_written("いっかげつ", "一ヶ月"))

    def test_no_small_tsu_after_n_or_a_long_vowel(self):
        self.assertNotIn("だんっかい", _word("段階", "だんかい"))
        self.assertNotIn("かいっしゃ", _word("会社", "かいしゃ"))
        self.assertIn("いっかい", gen._toggle_geminate("いかい"))

    def test_no_voiced_consonant_after_a_small_tsu(self):
        self.assertNotIn("しっげ", _word("湿気", "しっけ"))
        self.assertNotIn("まっじろ", _word("真っ白", "まっしろ"))
        self.assertNotIn("しゅっぢょう", _word("出張", "しゅっちょう"))


class OtherReadingTests(unittest.TestCase):
    def test_a_reading_the_word_has_is_never_a_wrong_choice(self):
        # A bare prompt has no sentence to choose between them: 上 is
        # うわ (上着) and かみ too, 二 is ふた (二つ).
        for wrong in ("うわ", "かみ", "じょう"):
            self.assertNotIn(wrong, _word("上", "うえ"))
        self.assertNotIn("ふた", _word("二", "に"))

    def test_the_stem_of_a_reading_with_okurigana_is_not_offered(self):
        for fragment in ("あ", "のぼ", "たてまつ"):
            self.assertNotIn(fragment, _word("上", "うえ"))


class PoolTests(unittest.TestCase):
    def test_a_word_without_one_written_form_is_never_asked(self):
        # The placement draws from the whole level, kana-only words and
        # 丸い/円い among them; neither has a prompt to print.
        spec = {"id": "m", "official_number": 1, "count": 1}
        pool = [{"kanji": "", "kana": "おそらく"}, {"kanji": "丸い/円い", "kana": "まるい"},
                {"kanji": "先週", "kana": "せんしゅう"}]
        mondai = gen.build_reading_mondai(spec, pool, set(), set(), random.Random(0))
        self.assertEqual([q["promptJp"] for q in mondai["questions"]], ["先週"])


if __name__ == "__main__":
    unittest.main()
