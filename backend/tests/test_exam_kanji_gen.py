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


if __name__ == "__main__":
    unittest.main()
