"""No false meaning (plan 149).

A word row in the breakdown carries a card: a meaning, a level, a way
into a deck. A card for another word read the same way is a meaning the
learner will memorise for the wrong word -- and the lookups had two
ways of handing one out:

- **by reading alone** (resolve_kana), when the lemma found nothing: 郷
  read ごう took 号, "number, issue"; 開店 took 回転, "rotation"; 刑期
  took ケーキ, "cake"; センス, a loanword, 扇子, "folding fan";
- **by UniDic's lemma**, which files some spellings under another word's
  kanji: 推す under 押す ("to push"), 冒す under 犯す ("to commit").

And one way of badging the right word at the wrong level: the N5 する,
なる and いい are kana-only cards, UniDic's lemmas for them are 為る, 成る
and 良い, and under those keys stood only the N3 and N1 cards -- every
する in every sentence badged N3.

Each rule is pinned here with its counter-case, and two properties are
held over every sentence the app teaches from.
"""
import unittest

from study import analysis, card_lookup, morphology
from content import vocab_jmdict_data as jmdict


def matches(sentence: str) -> dict[str, dict]:
    """surface -> vocab_match (the first, if twice)."""
    out: dict[str, dict] = {}
    for t in analysis.analyze_local(sentence)["tokens"]:
        if t.get("vocab_match"):
            out.setdefault(t["surface"], t["vocab_match"])
    return out


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class ReadingIsNotAWordTests(unittest.TestCase):

    def test_a_kanji_spelling_never_takes_another_spellings_card(self) -> None:
        for sentence, word, false_id, meaning in (
            ("郷に入っては郷に従え。", "郷", "vocab_N1_号_ごう", "village"),
            ("開店にあたって、多くの方にお世話になりました。", "開店", "vocab_N2_回転_かいてん", "shop"),
            ("前回の反省を踏まえて、準備を進めた。", "前回", "vocab_N1_全快_ぜんかい", "previous"),
            ("鹿やムースを狩る。", "鹿", "vocab_N1_歯科_しか", "deer"),
            ("彼は生涯独身のままだった。", "生涯", "vocab_N3_障害_しょうがい", "life"),
            ("今後とも、貴社と緊密なおつきあいをいただけますよう希望しております。", "貴社", "vocab_N4_汽車_きしゃ", "company"),
            ("問題は、この必要な隔たりを埋めるのが知覚であるという点にある。", "知覚", "vocab_N5_近く_ちかく", "perception"),
            ("彼は九州へ旅立った。", "九州", "vocab_N3_吸収_きゅうしゅう", "Ky"),
            ("どちらの王子が正統な王位継承者か。", "正統", "vocab_N1_正当_せいとう", "legitimate"),
            ("重荷で机がまた軋んだ。", "重荷", "vocab_N3_主に_おもに", "load"),
            ("イギリス人は自国の詩人を誇りにしている。", "自国", "vocab_N3_時刻_じこく", "country"),
        ):
            with self.subTest(word=word):
                found = matches(sentence)[word]
                self.assertNotEqual(found["raw_id"], false_id)
                self.assertIn(meaning, found["entry"]["meaning"])

    def test_a_kanji_spelling_never_takes_a_katakana_card(self) -> None:
        for sentence, word, false_id, meaning in (
            ("彼は１０年の刑期を務めた。", "刑期", "vocab_N4__ケーキ", "prison"),
            ("暴徒は広場から強制的に排除された。", "暴徒", "vocab_N3__ボート", "riot"),
            ("私は店舗の二階に住んでいる。", "店舗", "vocab_N2__テンポ", "shop"),
            ("じゃがいもは中南米高地が原産地である。", "高地", "vocab_N3__コーチ", "high"),
            ("チェッカー盤の黒と白の枡は交互に並んでいる。", "盤", "vocab_N3__バン", "board"),
            ("その省は内政問題の行政をつかさどる。", "省", "vocab_N1__ショー", "ministry"),
        ):
            with self.subTest(word=word):
                found = matches(sentence)[word]
                self.assertNotEqual(found["raw_id"], false_id)
                self.assertIn(meaning, found["entry"]["meaning"])

    def test_a_loanword_never_takes_a_native_card(self) -> None:
        for sentence, word, false_id in (
            ("センスがいい。", "センス", "vocab_N2_扇子_せんす"),
            ("そのショーで観客は大喜びだった。", "ショー", "vocab_N3_章_しょう"),
            ("ホールは千人収容できた。", "ホール", "vocab_N2_放る_ほうる"),
            ("サンキュー、また来るね。", "サンキュー", "vocab_N1_産休_さんきゅう"),
            ("彼は毎日ジムに行く。", "ジム", "vocab_N3_事務_じむ"),
        ):
            with self.subTest(word=word):
                self.assertNotEqual(matches(sentence)[word]["raw_id"], false_id)
        self.assertIn("gym", matches("彼は毎日ジムに行く。")["ジム"]["entry"]["meaning"])

    def test_a_native_word_in_katakana_keeps_its_card(self) -> None:
        # ダメ, キレイ, ウソ are 混, 漢, 和 to UniDic, not 外; タバコ is a
        # loanword whose card is written in kana.
        for sentence, word, expected in (
            ("ダメだよ。", "ダメ", "vocab_N4__だめ"),
            ("キレイな花だ。", "キレイ", "vocab_N5__きれい"),
            ("ウソをつくな。", "ウソ", "vocab_N4__うそ"),
            ("タバコを吸う。", "タバコ", "vocab_N5__たばこ"),
        ):
            with self.subTest(word=word):
                self.assertEqual(matches(sentence)[word]["raw_id"], expected)

    def test_a_kana_card_still_answers_for_its_kanji_spelling(self) -> None:
        self.assertEqual(matches("沢山食べた。")["沢山"]["raw_id"], "vocab_N5__たくさん")
        self.assertEqual(matches("出来る。")["出来る"]["raw_id"], "vocab_N5__できる")

    def test_but_not_for_a_word_that_only_sounds_like_it(self) -> None:
        for sentence, word, false_id, meaning in (
            ("二日酔いが全くない。", "酔い", "vocab_N5__いい/よい", "drunk"),
            ("地層の層が見える。", "層", "vocab_N4__そう", "layer"),
            ("この企画はもう一度想を練り直せ。", "想", "vocab_N4__そう", "conception"),
            ("解決策が功を奏した。", "功", "vocab_N4__こう", "merit"),
            ("彼は欲の少ない人だ。", "欲", "vocab_N5__よく", "greed"),
            ("ある程度は新しい環境に同化しなくてはなりません。", "同化", "vocab_N3__どうか", "assimilation"),
        ):
            with self.subTest(word=word):
                found = matches(sentence)[word]
                self.assertNotEqual(found["raw_id"], false_id)
                self.assertIn(meaning, found["entry"]["meaning"])


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class ThePagesSpellingTests(unittest.TestCase):
    """UniDic files some spellings under another word's kanji; the page
    wrote its own, and JMdict holds it as a word of its own."""

    def test_another_word_filed_under_the_same_lemma(self) -> None:
        for sentence, word, false_id, meaning in (
            ("彼を会長に推す。", "推す", "vocab_N5_押す_おす", "recommend"),
            ("喫煙が彼の肺を冒した。", "冒し", "vocab_N1_犯す_おかす", "brave"),
            ("その詩は無名の著者が詠んだ。", "詠ん", "vocab_N5_読む_よむ", "compose"),
        ):
            with self.subTest(word=word):
                found = matches(sentence)[word]
                self.assertNotEqual(found["raw_id"], false_id)
                self.assertIn(meaning, found["entry"]["meaning"])

    def test_the_same_word_in_another_spelling_keeps_its_card(self) -> None:
        # The glosses meet: one word, two spellings.
        for sentence, word, expected in (
            ("眼が痛い。", "眼", "vocab_N5_目_め"),
            ("競り合ったお陰で、彼が勝った。", "お陰", "vocab_N1_お蔭_おかげ"),
            ("私は頭に一滴の雨を感じた。", "滴", "vocab_N1_雫_しずく"),
        ):
            with self.subTest(word=word):
                self.assertEqual(matches(sentence)[word]["raw_id"], expected)


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class TheLowerTwinTests(unittest.TestCase):

    def test_suru_naru_ii_are_the_n5_cards_in_every_form(self) -> None:
        for sentence, word, expected in (
            ("勉強する。", "する", "vocab_N5__する"), ("何をしたいですか。", "し", "vocab_N5__する"),
            ("勉強しよう。", "しよう", "vocab_N5__する"), ("勉強すれば分かる。", "すれ", "vocab_N5__する"),
            ("仕事をさせてください。", "さ", "vocab_N5__する"),
            ("先生になる。", "なる", "vocab_N5__なる"), ("先生になった。", "なっ", "vocab_N5__なる"),
            ("天気がいい。", "いい", "vocab_N5__いい/よい"), ("天気がよかった。", "よかっ", "vocab_N5__いい/よい"),
            ("花がきれいです。", "きれい", "vocab_N5__きれい"),
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(matches(sentence)[word]["raw_id"], expected)

    def test_the_kanji_spelling_still_reaches_the_kanji_card(self) -> None:
        self.assertTrue(matches("為る")["為る"]["raw_id"].startswith("vocab_N3_為る_"))

    def test_a_homograph_is_not_a_twin(self) -> None:
        """たとえ, "even if", tokenizes as 仮令, and the N3 kana card たとえ
        is "simile": no gloss in common, so it never stands beside it."""
        self.assertEqual(matches("たとえ雨が降っても、試合は行う。")["たとえ"]["raw_id"], "vocab_N1_仮令_たとえ")
        self.assertEqual(matches("百歳にして、なお創作を続けている。")["なお"]["raw_id"], "vocab_N1_尚_なお")
        # いかん is not いかが, whatever lemma they share.
        found = matches("理由のいかんによらず、遅刻は認められない。").get("いかん")
        self.assertTrue(found is None or found["raw_id"] != "vocab_N5__いかが")

    def test_a_twin_answers_only_for_its_own_reading(self) -> None:
        for (lemma, raw_id), readings in card_lookup._KANA_BESIDE.items():
            with self.subTest(lemma=lemma, card=raw_id):
                self.assertTrue(readings)
                # Never the only card under its key: it stands BESIDE one.
                self.assertGreater(len(card_lookup._VOCAB_BY_LEMMA[lemma]), 1)


def _corpus() -> list[str]:
    from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
    import content.reading_sentences as reading
    out = [ex["jp"] for points in GRAMMAR_POINTS_BY_LEVEL.values() for p in points
           for ex in p.get("examples", []) if ex.get("jp")]
    out += [it["jp"] for items in reading.BY_LEVEL.values() for it in items
            if isinstance(it, dict) and it.get("jp")]
    return out


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class InvariantTests(unittest.TestCase):

    @classmethod
    def setUpClass(cls) -> None:
        cls.read = []
        for sentence in _corpus():
            morphemes = morphology.tokenize(sentence)
            cls.read.append((sentence, morphemes, [card_lookup.resolve_morpheme(morphemes, i)
                                                   for i in range(len(morphemes))]))

    def test_no_katakana_card_for_a_kanji_spelling(self) -> None:
        for sentence, morphemes, hits in self.read:
            for m, hit in zip(morphemes, hits):
                if hit is None or not any(card_lookup.is_kanji(c) for c in m.surface):
                    continue
                entry = hit[1]
                with self.subTest(sentence=sentence, word=m.surface):
                    self.assertFalse(not entry.get("kanji")
                                     and card_lookup._katakana_written(entry.get("kana") or ""))

    def test_no_native_card_for_a_loanword(self) -> None:
        for sentence, morphemes, hits in self.read:
            for m, hit in zip(morphemes, hits):
                if hit is None or m.goshu != "外":
                    continue
                kanji = hit[1].get("kanji") or ""
                with self.subTest(sentence=sentence, word=m.surface):
                    self.assertTrue(not kanji or card_lookup._katakana_written(kanji))

    def test_every_pool_card_the_breakdown_hands_out_exists(self) -> None:
        for sentence, _morphemes, _hits in self.read[::10]:
            for t in analysis.analyze_local(sentence)["tokens"]:
                vm = t.get("vocab_match")
                if not vm or not vm.get("pool"):
                    continue
                with self.subTest(sentence=sentence, word=t["surface"]):
                    self.assertIsNone(vm["level"])
                    self.assertIsNotNone(jmdict.entry_for_raw_id(vm["raw_id"]))
                    self.assertTrue(vm["entry"]["meaning"])


if __name__ == "__main__":
    unittest.main()
