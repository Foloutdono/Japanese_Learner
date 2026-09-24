import unittest

from content.vocab_extras import kana_spelling_variants, trailing_kana_variants
from study import morphology
from study.card_lookup import resolve_lemma, resolve_kana, resolve_morpheme, _reading_variants, _VOCAB_BY_LEMMA


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
        # first pass claimed, so a word stored under BOTH spellings at
        # different levels keeps resolving to the entry it always did,
        # rather than being merged and handed to the lowest-level
        # tie-break. The deck held three such pairs (御馳走 N2 / ご馳走
        # N1, 御無沙汰, 御手洗い) until plan 112 merged them, so the
        # guard is held on a two-card stand-in.
        from unittest import mock
        from study import card_lookup
        n2 = {"kanji": "御馳走", "kana": "ごちそう", "meaning": "feast"}
        n1 = {"kanji": "ご馳走", "kana": "ごちそう", "meaning": "feast"}
        # FOLDED_FORMS off too: the stand-in's ids are the real cards',
        # and the fold is the fourth pass, not the variants' second.
        with mock.patch.object(card_lookup, "VOCAB_BY_LEVEL", {"N2": [n2], "N1": [n1]}), \
                mock.patch.object(card_lookup, "FOLDED_FORMS", {}):
            index = card_lookup._index_vocab_by_lemma()
        self.assertEqual(index["ご馳走"], [("N1", n1)])
        self.assertEqual(index["御馳走"], [("N2", n2)])

    def test_a_merged_spelling_reaches_the_one_card(self) -> None:
        # ...and in the deck as it is, the ご spelling is a variant key
        # of the one card that holds the word.
        for word, expected in (
            ("ご馳走", "vocab_N2_御馳走_ごちそう"),
            ("ご無沙汰", "vocab_N2_御無沙汰_ごぶさた"),
        ):
            with self.subTest(word=word):
                self.assertEqual(len(_VOCAB_BY_LEMMA[word]), 1)
                self.assertEqual(resolve_lemma(word, "")[2], expected)

    def test_a_folded_spelling_badges_the_card_that_took_it_in(self) -> None:
        # vocab_renames.FOLDED_FORMS, the fourth pass: a page that writes
        # the spelling that left the deck badges the card that stayed,
        # not nothing -- and not, as before plan 112, an N1 copy of an
        # N5 word. 身体 keeps both of its readings apart.
        for word, reading, expected in (
            ("美味しい", "おいしい", "vocab_N5__おいしい"),
            ("此れ", "これ", "vocab_N5__これ"),
            ("終る", "おわる", "vocab_N5_終わる_おわる"),
            ("身体", "からだ", "vocab_N5_体_からだ"),
            ("身体", "しんたい", "vocab_N3_身体_しんたい"),
        ):
            with self.subTest(word=word, reading=reading):
                self.assertEqual(resolve_lemma(word, reading)[2], expected)


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


class ReadingLookupRepairTests(unittest.TestCase):
    """Plan 104: the three ways a card the deck HAS looked absent, each
    measured by scripts/audit_vocab_deck.py before the repair -- 36
    katakana words, 15 adverbs and できる, 296 occurrences in the
    taught sentences badging nothing."""

    def test_a_katakana_word_resolves_by_its_folded_reading(self) -> None:
        # The tokenizer's reading arrives folded to hiragana; the deck
        # stores パン as written. Both keys now reach the same entry.
        # The fold is morphology.kata_to_hira's, long vowels included:
        # コーヒー arrives as こうひい, which is what the index must hold.
        for reading, expected in (("ぱん", "vocab_N5__パン"), ("パン", "vocab_N5__パン"),
                                  ("こうひい", "vocab_N5__コーヒー"), ("どあ", "vocab_N5__ドア")):
            with self.subTest(reading=reading):
                hit = resolve_kana(reading, "noun", False)
                self.assertIsNotNone(hit)
                self.assertEqual(hit[2], expected)

    def test_an_adverb_resolves_only_to_a_kana_only_entry(self) -> None:
        for reading, expected in (("もう", "vocab_N5__もう"), ("どう", "vocab_N5__どう"),
                                  ("もっと", "vocab_N5__もっと"), ("こう", "vocab_N4__こう")):
            with self.subTest(reading=reading):
                self.assertEqual(resolve_kana(reading, "adverb", False)[2], expected)
        # A reading whose only entries are kanji words is not an adverb
        # the deck teaches: 漢字 and 感じ are nouns, and a kanji noun is
        # never handed to an adverb.
        self.assertIsNone(resolve_kana("かんじ", "adverb", False))

    def test_an_auxiliary_use_token_is_admitted_off_a_conjunctive_and_unambiguous(self) -> None:
        # できる: one N5 entry, admitted when nothing conjunctive precedes.
        self.assertEqual(resolve_kana("できる", "verb", True, after_conjunctive=False)[2], "vocab_N5__できる")
        # Behind て it is the gate's own case, and stays refused.
        self.assertIsNone(resolve_kana("できる", "verb", True, after_conjunctive=True))
        # いる has 居る and 要る both at N5: ambiguous, refused either way.
        self.assertIsNone(resolve_kana("いる", "verb", True, after_conjunctive=False))
        # A caller without the context keeps the old gate.
        self.assertIsNone(resolve_kana("できる", "verb", True))

    def test_a_kana_field_splits_on_the_separator_the_deck_uses(self) -> None:
        self.assertEqual(_reading_variants("まいげつ/まいつき"), ["まいげつ", "まいつき"])
        self.assertEqual(_reading_variants("a;b"), ["a", "b"])

    @unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "fugashi/unidic-lite not installed")
    def test_resolve_morpheme_reads_the_neighbour(self) -> None:
        main = morphology.tokenize("買い物ができます。")
        deki = next(i for i, m in enumerate(main) if m.lemma == "出来る")
        self.assertEqual(resolve_morpheme(main, deki)[2], "vocab_N5__できる")
        # 出来る behind て is the gated position -- and with no kanji
        # lemma in the deck, nothing else answers for it.
        after_te = morphology.tokenize("勉強してできる。")
        deki = next(i for i, m in enumerate(after_te) if m.lemma == "出来る")
        self.assertIsNone(resolve_morpheme(after_te, deki))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "fugashi/unidic-lite not installed")
class LemmaSpellingTests(unittest.TestCase):
    """Plan 106. UniDic's lemma is an orthographic base, not the deck's
    spelling: 213 deck words lemmatise to something else, 55 of them to
    a form that is a HIGHER-level card (帰る -> 返る N1). The lemma index
    files each entry under its own lemma too, and the surface tells the
    two apart."""

    def _resolve(self, sentence: str, surface_start: str) -> str | None:
        morphemes = morphology.tokenize(sentence)
        i = next(i for i, m in enumerate(morphemes) if m.surface.startswith(surface_start))
        hit = resolve_morpheme(morphemes, i)
        return hit and hit[2]

    def test_a_word_resolves_to_its_own_card_not_its_lemma_homograph(self) -> None:
        self.assertEqual(self._resolve("うちに帰ります。", "帰"), "vocab_N5_帰る_かえる")
        self.assertEqual(self._resolve("駅で降りる。", "降"), "vocab_N5_降りる_おりる")
        self.assertEqual(self._resolve("山に登る。", "登"), "vocab_N5_登る_のぼる")

    def test_the_lemma_homograph_keeps_its_own_card(self) -> None:
        # 返る is a deck word too; a token written 返っ is that one.
        self.assertEqual(self._resolve("手紙が返ってきた。", "返"), "vocab_N1_返る_かえる")

    def test_an_auxiliary_behind_te_is_the_points_not_a_words(self) -> None:
        # 食べてしまった badged the N1 仕舞う card through the lemma path;
        # てしまう is a catalogue point and the row opens it instead.
        self.assertIsNone(self._resolve("食べてしまった。", "しま"))
        self.assertIsNone(self._resolve("食べている。", "いる"))

    def test_a_compound_picks_the_entry_its_reading_names(self) -> None:
        # 一日 is two N5 cards, ついたち and いちにち; the tokenizer's joined
        # reading decides which one 一日中 folds into.
        from study.card_lookup import resolve_compound
        morphemes = morphology.tokenize("一日中寝た。")
        level, entry, raw_id, n = resolve_compound(morphemes, 0)
        self.assertEqual(raw_id, "vocab_N5_一日_いちにち")
        self.assertEqual(n, 2)


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "fugashi/unidic-lite not installed")
class FoldedSpellingReadingTests(unittest.TestCase):
    """A spelling plan 112 folded into another card (vocab_renames
    .FOLDED_FORMS) is that word READ AS FOLDED. The same written form
    is often another word read another way, and the lowest-level
    candidate used to win regardless: 彼の badged あの ("that") in 44 of
    the app's own sentences where it is 彼 + の ("his"), 今日は badged
    こんにちは in 49, 何時 read なんじ "what time" badged いつ "when"."""

    def _badges(self, sentence: str) -> dict[str, str]:
        from study.card_lookup import find_segments_in_text
        return {s["text"]: s["raw_id"] for s in find_segments_in_text(sentence) if s["type"] == "vocab"}

    def test_his_opinion_is_not_that_opinion(self) -> None:
        from study.analysis import analyze_local
        sentence = "私は彼の意見に賛成です。"
        badges = self._badges(sentence)
        self.assertEqual(badges.get("彼"), "vocab_N4_彼_かれ")
        self.assertNotIn("vocab_N5__あの", badges.values())
        tokens = analyze_local(sentence)["tokens"]
        kare = next(t for t in tokens if t["surface"] == "彼")
        self.assertEqual(kare["vocab_match"]["raw_id"], "vocab_N4_彼_かれ")
        self.assertNotIn("vocab_N5__あの", {(t["vocab_match"] or {}).get("raw_id") for t in tokens})

    def test_a_fold_answers_only_for_its_own_reading(self) -> None:
        for word, other, card in (
            ("何時", "なんじ", "vocab_N5__いつ"),
            ("二十", "にじゅう", "vocab_N5_二十歳_はたち"),
            # UniDic's lemma for the いかん of 〜いかんによらず is 如何.
            ("如何", "いかん", "vocab_N5__いかが"),
        ):
            with self.subTest(word=word):
                hit = resolve_lemma(word, other)
                self.assertNotEqual(hit and hit[2], card)
                self.assertEqual(resolve_lemma(word, card.rsplit("_", 1)[1])[2], card)
        # No reading, nothing to vouch for the fold.
        self.assertIsNone(resolve_lemma("彼の", ""))

    def test_the_scanner_merges_no_fold_across_a_particle(self) -> None:
        # こんな所で is "in a place like this": ところ + で reads the same
        # as the conjunction ところで, so the reading cannot refuse it --
        # the particle does, as resolve_compound's never crosses one.
        self.assertEqual(self._badges("今日は雨です。").get("今日"), "vocab_N5_今日_きょう")
        badges = self._badges("こんな所で会うとは、驚いた。")
        self.assertEqual(badges.get("所"), "vocab_N5_所_ところ")
        self.assertNotIn("所で", badges)

    def test_the_scanner_merges_a_fold_read_as_folded(self) -> None:
        # 再来 + 年 read さらいねん is the card さ来年 took in, and the
        # joined reading picks between the cards one form holds, as
        # resolve_compound's does: 一日おきに is いちにち, not ついたち.
        self.assertEqual(self._badges("再来年日本に行きます。").get("再来年"), "vocab_N5_さ来年_さらいねん")
        self.assertEqual(self._badges("一日おきに走っています。").get("一日"), "vocab_N5_一日_いちにち")
