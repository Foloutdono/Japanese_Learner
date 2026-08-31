import unittest

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


if __name__ == "__main__":
    unittest.main()
