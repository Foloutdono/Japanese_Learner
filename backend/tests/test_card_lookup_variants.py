import unittest

from content.vocab_extras import kana_spelling_variants, trailing_kana_variants
from study.card_lookup import resolve_lemma, _VOCAB_BY_LEMMA


class LemmaIndexVariantKeyTests(unittest.TestCase):
    """_index_vocab_by_lemma registers conventional kana spellings
    (御飯 -> ご飯) so resolve_lemma can match the spelling a page
    actually used. See that function's docstring for why the kanji
    filter and the second pass are both load-bearing."""

    def test_kana_spelled_variant_resolves_without_a_reading(self) -> None:
        # The gap this closes: resolve_lemma is called with a lemma and
        # often no reading, and the deck spells these with the kanji.
        for variant, expected in (
            ("ご飯", "vocab_N5_御飯_ごはん"),
            ("朝ご飯", "vocab_N5_朝御飯_あさごはん"),
            ("食べもの", "vocab_N5_食べ物_たべもの"),
            ("買いもの", "vocab_N5_買い物_かいもの"),
        ):
            with self.subTest(variant=variant):
                hit = resolve_lemma(variant, "")
                self.assertIsNotNone(hit, f"{variant} should resolve")
                self.assertEqual(hit[2], expected)

    def test_bare_kana_reductions_are_not_keys(self) -> None:
        # The safety property. kana_spelling_variants reduces a
        # one-character word to bare kana (事 -> こと, 物 -> もの), which
        # in running text is overwhelmingly the nominalizer, not the
        # noun. resolve_lemma runs before resolve_kana and is ungated,
        # so admitting these would bypass the POS/length/auxiliary_use
        # guards resolve_kana applies for exactly this reason.
        for bare in ("こと", "もの", "とき", "ところ", "ほう", "ため", "よう"):
            with self.subTest(bare=bare):
                self.assertNotIn(bare, _VOCAB_BY_LEMMA)
                self.assertIsNone(resolve_lemma(bare, ""))

    def test_variants_never_repoint_an_existing_key(self) -> None:
        # Variant keys are added in a second pass and skip keys the
        # first pass claimed, so a word the deck stores under BOTH
        # spellings at different levels (御馳走 N2 / ご馳走 N1) keeps
        # resolving to the entry it always did, rather than being
        # merged and handed to the lowest-level tie-break.
        for word, expected in (
            ("ご馳走", "vocab_N1_ご馳走_ごちそう"),
            ("ご無沙汰", "vocab_N1_ご無沙汰_ごぶさた"),
        ):
            with self.subTest(word=word):
                self.assertEqual(len(_VOCAB_BY_LEMMA[word]), 1)
                self.assertEqual(resolve_lemma(word, "")[2], expected)


class TrailingKanaVariantTests(unittest.TestCase):
    """vocab_extras.trailing_kana_variants writes a trailing kanji out
    as its own reading (子供 -> 子ども). Its whole viability rests on
    the attestation filter; see that function's docstring."""

    def test_reaches_words_kana_spelling_variants_cannot(self) -> None:
        # 供 and 達 are not in _KANA_CONVENTIONAL_SPELLING, so the
        # other generator produces nothing for these two.
        self.assertEqual(trailing_kana_variants("子供", "こども"), ["子ども"])
        self.assertEqual(trailing_kana_variants("友達", "ともだち"), ["友だち"])
        self.assertEqual(kana_spelling_variants("子供"), [])
        self.assertEqual(kana_spelling_variants("友達"), [])

    def test_unattested_spellings_are_rejected(self) -> None:
        # The filter is the difference between 108 usable variants and
        # 4,318 mostly-imaginary ones. On-reading compounds are the bulk
        # of what it throws away: nobody writes 大学 as 大がく.
        for kanji, kana in (("大学", "だいがく"), ("写真", "しゃしん"),
                            ("学生", "がくせい"), ("時間", "じかん")):
            with self.subTest(kanji=kanji):
                self.assertEqual(trailing_kana_variants(kanji, kana), [])

    def test_never_reduces_a_word_to_bare_kana(self) -> None:
        # Same guard as the lemma index's: a one-part word reduces to
        # its own reading, which in running text is grammatical far more
        # often than lexical.
        for kanji, kana in (("事", "こと"), ("物", "もの"), ("時", "とき")):
            with self.subTest(kanji=kanji):
                for v in trailing_kana_variants(kanji, kana):
                    self.assertTrue(any("一" <= c <= "鿿" for c in v), v)

    def test_the_variants_reach_the_lemma_index(self) -> None:
        for variant, expected in (
            ("子ども", "vocab_N5_子供_こども"),
            ("友だち", "vocab_N5_友達_ともだち"),
            ("先ほど", "vocab_N2_先程_さきほど"),
        ):
            with self.subTest(variant=variant):
                hit = resolve_lemma(variant, "")
                self.assertIsNotNone(hit, f"{variant} should resolve")
                self.assertEqual(hit[2], expected)


if __name__ == "__main__":
    unittest.main()
