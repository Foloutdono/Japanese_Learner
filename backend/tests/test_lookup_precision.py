"""No false meaning (plan 150).

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
        ):
            with self.subTest(word=word):
                self.assertEqual(matches(sentence)[word]["raw_id"], expected)
        # 一滴 is read いってき: the 滴 of a count, not 雫, "a drop" (plan 151).
        self.assertIn("counter", matches("私は頭に一滴の雨を感じた。")["滴"]["entry"]["meaning"])


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class ReadOtherwiseTests(unittest.TestCase):
    """Plan 151. A card whose reading is not the page's: 彼ら's ら took 等,
    "et cetera"; 入るなり's なり took 哉, "question mark"; 一社's 社 took
    社 read やしろ, "Shinto shrine". A reading is the word, so a token read
    otherwise has no card from it -- unless it is the same reading voiced
    (箱 in ゴミ箱 is はこ said ばこ), or a number read its own way."""

    def test_no_card_for_a_token_read_otherwise(self) -> None:
        for sentence, word, false_id in (
            ("悪い天気のもとで、彼らは働き続けた。", "ら", "vocab_N1_等_とう"),
            ("彼は部屋に入るなり、窓を大きく開けた。", "なり", "vocab_N1_哉_や"),
            ("花を三本ずつ買いました。", "ずつ", "vocab_N1_宛_あて"),
            ("問題は一社にとどまらず、業界全体のものだ。", "社", "vocab_N1_社_やしろ"),
            ("この漢字はおぼえにくいです。", "にくい", "vocab_N1_難い_かたい"),
            ("冬は病気になりがちだ。", "がち", "vocab_N3_勝ち_かち"),
            ("彼は悲しげな顔で立っていた。", "げ", "vocab_N4_気_き"),
        ):
            with self.subTest(word=word):
                found = matches(sentence).get(word)
                self.assertTrue(found is None or found["raw_id"] != false_id)
        self.assertIn("company", matches("問題は一社にとどまらず、業界全体のものだ。")["社"]["entry"]["meaning"])

    def test_the_same_reading_voiced_keeps_its_card(self) -> None:
        self.assertEqual(matches("本棚に本がある。")["本棚"]["raw_id"], "vocab_N5_本棚_ほんだな")
        self.assertEqual(matches("二人で行きました。")["二人"]["raw_id"], "vocab_N5_二人_ふたり")

    def test_a_counter_the_counters_point_lights_is_no_noun(self) -> None:
        """三本's 本 is no "book": the counters' point lights it. A card
        that is the counter itself (冊) stays."""
        self.assertNotIn("本", matches("花を三本ずつ買いました。"))
        self.assertEqual(matches("本を読む。")["本"]["raw_id"], "vocab_N5_本_ほん")
        self.assertIn("counter", matches("本を二冊買った。")["冊"]["entry"]["meaning"])


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class AffixTests(unittest.TestCase):
    """Plan 151. A suffix read as the page reads it is no longer glossed
    as the noun it is spelled like: 者 read しゃ is not 者 read もの."""

    def test_a_word_forming_suffix_folds_into_its_word(self) -> None:
        for sentence, word, meaning in (
            ("参加者は十人にすぎなかった。", "参加者", "participant"),
            ("その政治家は批判を口にしてはばからない。", "政治家", "politician"),
            ("彼女は化粧水をつけている。", "化粧水", "lotion"),
            ("伝染病が発生した。", "伝染病", "disease"),
            ("あなたの血液型は何ですか。", "血液型", "blood type"),
        ):
            with self.subTest(word=word):
                found = matches(sentence)[word]
                self.assertTrue(found["pool"])
                self.assertIn(meaning, found["entry"]["meaning"])

    def test_a_suffix_on_any_noun_folds_nothing(self) -> None:
        """人 + たち is 人 said of several: the N5 card stays."""
        self.assertEqual(matches("その人たちは崇高な心をもつべきだ。")["人"]["raw_id"], "vocab_N5_人_ひと")
        found = matches("この停戦が世界平和に役立つことを私達はみな望んでいる。")
        self.assertEqual(found["私"]["raw_id"], "vocab_N5_私_わたくし")
        self.assertIn("plural", found["達"]["entry"]["meaning"])

    def test_an_affix_carries_its_affix_sense_or_none(self) -> None:
        self.assertIn("assistant", matches("社長は来ないで代わりに副社長をよこした。")["副"]["entry"]["meaning"])
        # 一軒家's 家 follows a counter, read や: no "-ist" guessed at it.
        self.assertNotIn("家", matches("森の近くに一軒家がある。"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class PoolLineTests(unittest.TestCase):
    """Plan 151. A pool word's line is the first gloss of its first
    senses, so the sense the sentence uses is on it: あだ is "foe" first
    and "harm" in せっかくの苦労もあだになった."""

    def test_the_first_senses(self) -> None:
        meaning = matches("せっかくの苦労もあだになった。")["あだ"]["entry"]["meaning"]
        self.assertIn("foe", meaning)
        self.assertIn("harm", meaning)
        self.assertLessEqual(len(meaning), card_lookup._POOL_GLOSS_MAX)

    def test_an_affix_keeps_the_one_sense_it_was_chosen_for(self) -> None:
        self.assertEqual(card_lookup.pool_gloss({"affix": True, "meaning": "-ist, -er"}), "-ist, -er")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class CompoundParticleTests(unittest.TestCase):
    """Plan 152. The verb of a compound particle is the point's: について's
    つい took 着く, "to arrive at"; において's おい 置く, "to put"; にとって's
    とっ 取る, "to take"; にたいして, which the tokenizer reads as 大して,
    "(not) very". No card, so the row opens the point."""

    def test_no_card_for_the_verb_of_a_compound_particle(self) -> None:
        for sentence, word in (
            ("日本の文化について研究しています。", "つい"),
            ("会議は本社において行われます。", "おい"),
            ("この写真は私にとって大切な思い出です。", "とっ"),
            ("先生にたいして失礼なことを言った。", "たいして"),
            ("彼は医者として働いている。", "し"),
            ("本日を以て閉店いたします。", "以"),
        ):
            with self.subTest(word=word):
                self.assertNotIn(word, matches(sentence))

    def test_the_same_verb_as_a_verb_keeps_its_card(self) -> None:
        self.assertEqual(matches("手に取って見てください。")["取っ"]["raw_id"], "vocab_N5_取る_とる")
        self.assertEqual(matches("駅に着いてから電話する。")["着い"]["raw_id"], "vocab_N5_着く_つく")
        # A verb that is its point's predicate means itself (〜と思います).
        self.assertEqual(matches("明日は雨だと思います。")["思い"]["raw_id"], "vocab_N4_思う_おもう")


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


class EdgeInputTests(unittest.TestCase):
    """Whatever a learner pastes into the analyser: the tokens rebuild the
    text, and nothing that is not a Japanese word carries a card."""

    CASES = ("", " ", "\n", "hello world", "12345", "１２３", "😀🎌", "。。。", "え？",
             "iPhoneを買った。", "ズンドコベロンチョが来た。", "行って\n来ます。", "さらば！")

    def test_never_raises_and_the_tokens_are_the_text(self) -> None:
        for text in self.CASES:
            with self.subTest(text=text):
                tokens = analysis.analyze_local(text)["tokens"]
                for t in tokens:
                    self.assertEqual(text[t["start"]:t["end"]], t["surface"])
                for a, b in zip(tokens, tokens[1:]):
                    self.assertLessEqual(a["end"], b["start"])

    @unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
    def test_no_card_for_what_is_not_a_word(self) -> None:
        for text in ("hello world", "12345", "１２３", "😀🎌", "。。。", "え？"):
            with self.subTest(text=text):
                self.assertFalse(any(t.get("vocab_match") for t in analysis.analyze_local(text)["tokens"]))
        found = matches("iPhoneを買った。")
        self.assertNotIn("iPhone", found)
        # A word JMdict does not hold is no word of anyone's.
        self.assertNotIn("ズンドコベロンチョ", matches("ズンドコベロンチョが来た。"))

    @unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
    def test_a_pool_word_at_either_edge(self) -> None:
        for text in ("桃源郷", "桃源郷だ。", "ここは桃源郷"):
            with self.subTest(text=text):
                self.assertTrue(matches(text)["桃源郷"].get("pool"))
        self.assertTrue(matches("さらば！")["さらば"].get("pool"))

    @unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
    def test_a_word_in_kana_is_not_a_row_read_otherwise(self) -> None:
        # まじか ("seriously?") comes back from UniDic as 間近, read まぢか.
        self.assertNotIn("まじか", matches("まじか"))


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
