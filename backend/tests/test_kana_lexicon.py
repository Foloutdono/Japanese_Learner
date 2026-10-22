"""The deck's words as a beginner's page writes them (plan 272).

study/kana_lexicon.py gives MeCab the deck's kana spellings as a user
dictionary: としょかん, which UniDic alone cut into と + しょ + かん, is
図書館 read whole. Every rule is pinned here with the sentence it must
read and the one it must leave alone, and one property is held over the
sentences the app teaches: the dictionary only ever re-cuts a stretch of
hiragana.
"""
import random
import unittest

from study import kana_lexicon, morphology


def cut(text: str, plain: bool = False) -> list[str]:
    return [m.surface for m in morphology.tokenize(text, plain=plain)]


def lemma_of(text: str, surface: str) -> str:
    return next(m.lemma for m in morphology.tokenize(text) if m.surface == surface)


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class KanaLexiconTests(unittest.TestCase):

    def test_the_lexicon_is_in_use(self) -> None:
        self.assertIsNot(morphology._tagger, morphology._plain_tagger)

    def test_a_deck_word_in_kana_is_read_whole(self) -> None:
        for sentence, word, lemma in (
            ("午後はとしょかんでべんきょうします。", "としょかん", "図書館"),
            ("あのきっさてんでコーヒーを飲みましょう。", "きっさてん", "喫茶店"),
            ("小さいじしょは千九百円です。", "じしょ", "辞書"),
            ("わたしは毎ばんここで日本語のしゅくだいをします。", "しゅくだい", "宿題"),
            ("ゆうびんきょくは左にあります。", "ゆうびんきょく", "郵便局"),
            ("まず、れいぞうこを見ました。", "れいぞうこ", "冷蔵庫"),
            ("去年、けつあつが高いと言われた。", "けつあつ", "血圧"),
            ("でも、むずかしいのははつおんです。", "はつおん", "発音"),
        ):
            with self.subTest(word=word):
                self.assertIn(word, cut(sentence))
                self.assertEqual(lemma_of(sentence, word), lemma)
                # ...where UniDic alone came apart on it.
                self.assertNotIn(word, cut(sentence, plain=True))

    def test_real_words_side_by_side_are_left_alone(self) -> None:
        # The letters of an entry spelled by real words: a noun and a
        # particle, an adverb and a particle, a verb and its ending.
        for sentence, words in (
            ("年齢のせいか、少し疲れた。", ["せい", "か"]),           # never 成果
            ("口の右のおくがいたくなる。", ["おく", "が", "いたく"]),   # never 屋外
            ("よくねたほうがいいですよ。", ["ほう", "が"]),            # never 他方
            ("ボタンを押すだけで出窓はあく。", ["は", "あく"]),        # never 把握
            ("そうさ、ぼくらはまだ若い。", ["そう", "さ"]),            # never 操作
            ("えんぴつやほんやノートを買った。", ["ほん", "や"]),       # never 本屋
            ("このみちをまっすぐいって。", ["この", "みち"]),
            ("いつかよい選手になるでしょう。", ["いつ", "か"]),         # never 五日
            ("だれもいない。", ["い", "ない"]),                        # never 以内
            ("ドアがあいている。", ["あい", "て"]),                    # never 相手
        ):
            with self.subTest(sentence=sentence):
                tokens = cut(sentence)
                for i in range(len(tokens) - len(words) + 1):
                    if tokens[i:i + len(words)] == words:
                        break
                else:
                    self.fail(f"{words} not cut in {tokens}")

    def test_a_spelling_another_word_shares_is_not_entered(self) -> None:
        # The page may well mean the other word: no card beats a wrong one.
        entered = {row[0] for row in kana_lexicon.rows(morphology._plain_tagger)}
        for kana in ("がっき", "じしん", "ふくしゅう", "せんとう", "かんじ", "ひろう", "じゅうじ",
                     "いつか", "ようか", "いない", "あいて", "きって"):
            with self.subTest(kana=kana):
                self.assertNotIn(kana, entered)
        for kana in ("としょかん", "きっさてん", "しょうひん", "かいがら", "みなさん"):
            with self.subTest(kana=kana):
                self.assertIn(kana, entered)

    def test_entries_are_the_decks_and_priced_by_length(self) -> None:
        from content.vocab_data import VOCAB_BY_LEVEL

        level_of = {}
        for level, entries in VOCAB_BY_LEVEL.items():
            for entry in entries:
                level_of.setdefault(entry.get("kanji") or "", level)
        rows = kana_lexicon.rows(morphology._plain_tagger)
        self.assertGreater(len(rows), 500)
        for row in rows:
            kana, cost, lemma = row[0], int(row[3]), row[4 + 7]
            with self.subTest(kana=kana):
                self.assertTrue(kana_lexicon._hiragana(kana))
                self.assertGreaterEqual(len(kana), 3)
                self.assertIn(lemma, level_of)
                self.assertNotIn(lemma[0], kana_lexicon._NUMERALS)
                if level_of[lemma] in ("N2", "N1"):
                    self.assertGreaterEqual(len(kana), 4)
                self.assertGreaterEqual(cost, 10000)

    def test_only_a_stretch_of_hiragana_is_ever_cut_otherwise(self) -> None:
        from scripts.breakdown_gaps import sentences

        taught = [s for _, s, _ in sentences()]
        random.seed(272)
        for sentence in random.sample(taught, 1500):
            plain = morphology.tokenize(sentence, plain=True)
            read = morphology.tokenize(sentence)
            bounds = {m.start for m in plain} | {m.end for m in plain}
            for m in read:
                for edge in (m.start, m.end):
                    if edge in bounds:
                        continue
                    # A new edge stands between two hiragana letters.
                    with self.subTest(sentence=sentence, word=m.surface):
                        self.assertTrue("ぁ" <= sentence[edge - 1] <= "ゟ"
                                        and "ぁ" <= sentence[edge] <= "ゟ")


if __name__ == "__main__":
    unittest.main()
