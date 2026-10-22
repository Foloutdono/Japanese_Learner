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
from content import vocab_extras, vocab_jmdict_data as jmdict


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
            # The N1 お蔭 folded into the N4 おかげ, its word (plan 227).
            ("競り合ったお陰で、彼が勝った。", "お陰", "vocab_N4__おかげ"),
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
class TheCardsPutRightTests(unittest.TestCase):
    """Plan 153. What plan 151's word reviewers found wrong in the cards
    themselves, pinned in a sentence that uses each word: a card read as
    the page reads it, and the gloss the sentence means."""

    def test_the_word_the_page_reads_has_its_card(self) -> None:
        for sentence, word, raw_id in (
            ("七時に学校へ行きます。", "時", "vocab_N5_時_じ"),
            ("小さいとき、山によく行きました。", "とき", "vocab_N5_時_とき"),
            ("その件については、お答えしかねます。", "件", "vocab_N3_件_けん"),
            ("若さゆえに、彼は大きな失敗をした。", "ゆえ", "vocab_N1_故_ゆえ"),
            ("この店は値段のわりに味がいい。", "わり", "vocab_N1_割_わり"),
            ("家族とともに新しい町へ引っ越しました。", "とも", "vocab_N1_共_とも"),
            ("銀行でお金を下ろした。", "下ろし", "vocab_N3_下ろす_おろす"),
            ("日本に来てから、三年になります。", "年", "vocab_N5_年_ねん"),
            # Plan 186c: a month is a card of its own now, written in
            # kanji or digits, and 日本 one card read both ways.
            ("四月ごろ、日本へ行きます。", "四月", "vocab_N5_四月_しがつ"),
            ("4月ごろ、日本へ行きます。", "4月", "vocab_N5_四月_しがつ"),
            ("四月ごろ、日本へ行きます。", "日本", "vocab_N5_日本_にほん/にっぽん"),
            ("十二月に日本語を勉強します。", "日本語", "vocab_N5_日本語_にほんご"),
            # 一月 is the month until what follows measures it: then it
            # is ひとつき, "one month" (reading_context's span rule).
            ("一月に日本へ行きます。", "一月", "vocab_N5_一月_いちがつ"),
            ("一月かかりました。", "一月", "vocab_N5_一月_ひとつき"),
            ("一月前に来ました。", "一月", "vocab_N5_一月_ひとつき"),
            ("一月も会っていません。", "一月", "vocab_N5_一月_ひとつき"),
            ("一月も連絡が来ない。", "一月", "vocab_N5_一月_ひとつき"),
            ("一月も寒くない。", "一月", "vocab_N5_一月_いちがつ"),
            ("一月も勉強しました。", "一月", "vocab_N5_一月_ひとつき"),
            ("一月も日本にいました。", "一月", "vocab_N5_一月_ひとつき"),
            ("一月も終わりました。", "一月", "vocab_N5_一月_いちがつ"),
            ("一月も雪が降った。", "一月", "vocab_N5_一月_いちがつ"),
            ("十一月に行きます。", "十一月", "vocab_N5_十一月_じゅういちがつ"),
            ("今、何時ですか。", "何時", "vocab_N5_何時_なんじ"),
            ("今日は何曜日ですか。", "何曜日", "vocab_N5_何曜日_なんようび"),
            ("五分待ってください。", "分", "vocab_N5_分_ふん"),
            ("その料理の辛いのなんのって、水を三杯も飲んだ。", "杯", "vocab_N5_杯_はい"),
            ("今日は少しさむけがする。", "さむけ", "vocab_N4_寒気_さむけ"),
            ("先生のもとで、三年間研究を続けた。", "もと", "vocab_N2_下_もと"),
            ("問題は一社にとどまらず、業界全体のものだ。", "社", "vocab_N2_社_しゃ"),
            ("目下、調査中です。", "目下", "vocab_N1_目下_もっか"),
            # UniDic reads a lone 盛り as もり, a serving; the peak is put
            # right in context (study/reading_context.py).
            ("桜の花は４月が盛りだ。", "盛り", "vocab_N3_盛り_さかり"),
        ):
            with self.subTest(word=word):
                self.assertEqual(matches(sentence)[word]["raw_id"], raw_id)

    def test_a_reading_the_card_does_not_have_is_not_its_card(self) -> None:
        # 下す is くだす, "to hand down (a verdict)", which no JLPT list
        # has and the pool glosses; 〜はおろか's おろか and 〜や否や's いな
        # are the points'; ご飯の盛り is a serving, もり, never the peak.
        found = matches("裁判所が判決を下した。").get("下し")
        self.assertTrue(found is None or found["raw_id"] != "vocab_N3_下ろす_おろす")
        self.assertIn("decision", found["entry"]["meaning"])
        self.assertNotIn("おろか", matches("彼は漢字はおろか、ひらがなも書けない。"))
        found = matches("彼は席に着くや否や、話し始めた。").get("否")
        self.assertTrue(found is None or found["raw_id"] != "vocab_N3_否_いや")
        found = matches("ご飯の盛りが少ない。").get("盛り")
        self.assertTrue(found is None or found["raw_id"] != "vocab_N3_盛り_さかり")

    def test_a_kana_sentence_is_cut_into_the_words_it_says(self) -> None:
        """りゅうがく took 流, "current", and がく nothing; しゅくだい took
        対 "versus" or 砕く "to smash"; ほうがせが held がせ, "fake". The
        sentences now say what they meant in words the tokenizer reads,
        at their level's kanji."""
        for sentence, false_ids in (
            ("来年、日本の大学で勉強することにしました。", {"vocab_N1_流_りゅう"}),
            ("今日は勉強しなくちゃいけない。", {"vocab_N3_対_たい"}),
            ("しごとはまだおわっていません。", {"vocab_N2_砕く_くだく"}),
            ("わたしよりあにのほうが、せが高いです。", set()),
        ):
            with self.subTest(sentence=sentence):
                found = matches(sentence)
                self.assertFalse({m["raw_id"] for m in found.values()} & false_ids)
                self.assertNotIn("がせ", found)
        self.assertEqual(matches("しごとはまだおわっていません。")["しごと"]["raw_id"], "vocab_N5_仕事_しごと")
        self.assertEqual(matches("わたしよりあにのほうが、せが高いです。")["せ"]["raw_id"], "vocab_N5_背_せ")

    def test_the_gloss_is_the_senses_of_the_cards_own_reading(self) -> None:
        for sentence, word, meaning in (
            ("仕事は半分終わったといったところだ。", "半分", "half"),
            ("彼女は歌が上手で、みんなに人気があります。", "人気", "popularity"),
            ("相手がだれであれ、礼儀は忘れてはならない。", "相手", "the other party"),
            ("財布に千円札が入っている。", "札", "banknote"),
            ("鳥の羽が落ちていた。", "羽", "feather"),
        ):
            with self.subTest(word=word):
                self.assertIn(meaning, matches(sentence)[word]["entry"]["meaning"])
        self.assertNotIn("minute", matches("仕事は半分終わったといったところだ。")["半分"]["entry"]["meaning"])


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
        self.assertEqual(found["私"]["raw_id"], "vocab_N5_私_わたし")
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
class NoGoodVerbTests(unittest.TestCase):
    """Plan 160. The negated verb of a "must" or a "must not" is the
    point's: 〜てはいけません's いけ took 行く, so いけません read "to go"
    under a sentence that forbids talking. No card, so the row is the
    point's."""

    def test_no_card_for_the_verb_of_a_must_or_a_must_not(self) -> None:
        for sentence, word in (
            ("ここで話してはいけません。", "いけ"),
            ("早く寝なくてはいけない。", "いけ"),
            ("宿題をしなければなりません。", "なり"),
            ("明日までに行かなければならない。", "なら"),
            ("そういうわけにはいかない。", "いか"),
        ):
            with self.subTest(sentence=sentence):
                self.assertNotIn(word, matches(sentence))

    def test_the_same_verbs_as_verbs_keep_their_cards(self) -> None:
        # 行く going and なる becoming, beside the very points that take
        # the card off their negated twins.
        self.assertEqual(matches("学校に行ってはいけない。")["行っ"]["raw_id"], "vocab_N5_行く_いく")
        self.assertEqual(matches("明日までに行かなければならない。")["行か"]["raw_id"], "vocab_N5_行く_いく")
        self.assertEqual(matches("先生になってはいけない。")["なっ"]["raw_id"], "vocab_N5__なる")

    def test_the_points_are_read_off_the_catalogue(self) -> None:
        from study.grammar_detect import no_good_points
        points = no_good_points()
        for pattern in ("〜てはいけません", "〜ないといけない", "〜なければなりません", "〜てはならない"):
            self.assertIn(pattern, points)
        # なる that means "to become" is never one of them.
        self.assertNotIn("〜くなる／〜になる", points)


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
        """たとえ, "even if", tokenizes as 仮令. The N3 kana card たとえ
        carried 例え's gloss, "simile", until plan 227 gave it the list's
        word and folded the N1 仮令 into it; 例え, "simile", stays a card
        of its own and never answers for the adverb."""
        self.assertEqual(matches("たとえ雨が降っても、試合は行う。")["たとえ"]["raw_id"], "vocab_N3__たとえ")
        self.assertEqual(matches("上手な例えだ。")["例え"]["raw_id"], "vocab_N1_例え_たとえ")

    def test_a_corrected_gloss_makes_a_true_twin(self) -> None:
        """The N3 kana cards なお and そば carried another word's gloss
        (直 "straight, mischief"; 側 "third person") and stood apart from
        their own word. Corrected, they share a gloss with it and the
        lower card is the one a sentence shows."""
        self.assertEqual(matches("百歳にして、なお創作を続けている。")["なお"]["raw_id"], "vocab_N3__なお")
        self.assertEqual(matches("毎あさ、この川のそばをはしります。")["そば"]["raw_id"], "vocab_N5__そば")
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


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class KanaStemTests(unittest.TestCase):
    """Plan 213. A verb in hiragana says nothing of which verb it is
    where two deck verbs are spelled alike in its form: 書取's 毎日、六時
    におきます ("I get up at six") was glossed 置く, "poser", since UniDic
    reads おき as 置く. The deck's own N5 kana sentences had 明日ははれる as
    腫れる "to swell" and 雨がふりました as 振る "to wave". No card, and
    no pool card in its place: the gap is visible, the error is learned."""

    def test_a_stem_two_deck_verbs_share_has_no_card(self) -> None:
        # Nothing beside it says which (plan 272 reads the partner below).
        for sentence, word in (
            ("それをはいた。", "はい"),                  # 履く, 吐く or 掃く
            ("それをきる。", "きる"),                    # 切る or 着る
            ("ちょっとおきます。", "おき"),              # 起きる or 置く
        ):
            with self.subTest(sentence=sentence):
                self.assertNotIn(word, matches(sentence))

    def test_the_word_it_takes_says_which_verb(self) -> None:
        # Plan 272: the particle before a kana verb and the noun it marks
        # (_PARTNERS), and a sound change no rival takes.
        for sentence, word, raw_id in (
            ("毎日、六時におきます。", "おき", "vocab_N5_起きる_おきる"),        # 時に
            ("あさおきて、ごはんを食べて、学校へ行きます。", "おき", "vocab_N5_起きる_おきる"),  # 置く is おいて
            ("きのうは雨がふりませんでした。", "ふり", "vocab_N5_降る_ふる"),     # 雨が
            ("明日ははれるかな。", "はれる", "vocab_N5_晴れる_はれる"),         # 明日は
            ("子どもに早くねるように言いました。", "ねる", "vocab_N5_寝る_ねる"),
            ("つぎの駅で電車をおります。", "おり", "vocab_N5_降りる_おりる"),
            ("春になると、さくらがさきます。", "さき", "vocab_N5_咲く_さく"),
            ("すみませんけど、まどをしめてください。", "しめ", "vocab_N5_閉める_しめる"),
            ("この薬はちっともきかない。", "きか", "vocab_N3_効く_きく"),      # past ちっとも
            ("おしろにすんでいました。", "すん", "vocab_N5_住む_すむ"),        # never 済む
            ("用事がすんだ。", "すん", "vocab_N4_済む_すむ"),
            ("みずうみへいってみる。", "いっ", "vocab_N5_行く_いく"),
            ("先生にいって。", "いっ", "vocab_N5_言う_いう"),
            ("うそをついてしまった。", "つい", "vocab_N1_吐く_つく"),          # never 着く
            ("電気をつけたままねてしまいました。", "つけ", "vocab_N5__つける"),  # "to turn on"
            ("てがみをかいて。", "かい", "vocab_N5_書く_かく"),               # never 掻く
            ("しゃしんをとる。", "とる", "vocab_N5_撮る_とる"),
            # What a quotation's と stands after says nothing of it.
            ("給与が高いからといって、幸せとは限らない。", "いっ", "vocab_N5_言う_いう"),
            ("彼は天才だといっても過言ではない。", "いっ", "vocab_N5_言う_いう"),
            ("二十分ぐらいたって、彼が来た。", "たっ", "vocab_N3_経つ_たつ"),    # a time passes
            ("会議はいつまでたっても終わらない。", "たっ", "vocab_N3_経つ_たつ"),
            ("この地名がついた。", "つい", "vocab_N4_付く_つく"),             # never 着く
            ("強い風がふいた。", "ふい", "vocab_N5_吹く_ふく"),
            ("父の例にならった。", "ならっ", "vocab_N2_倣う_ならう"),          # never 習う
            ("争いに終止符をうった。", "うっ", "vocab_N4_打つ_うつ"),          # 終止 + 符
            ("地図をかべにはってあります。", "はっ", "vocab_N5_貼る_はる"),
            ("ねこをかいたがっていました。", "かい", "vocab_N3_飼う_かう"),    # UniDic: 掻く
            ("駅のちかくにすんでいます。", "すん", "vocab_N5_住む_すむ"),      # 近く, a place
            ("うまくいった。", "いっ", "vocab_N5_行く_いく"),
            ("かみをきる。", "きる", "vocab_N5_切る_きる"),            # 髪 or 紙, both cut
            ("ふくをきる。", "きる", "vocab_N5_着る_きる"),
            ("かみにかく。", "かく", "vocab_N5_書く_かく"),
            ("はながさいた。", "さい", "vocab_N5_咲く_さく"),          # UniDic: 裂く
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(matches(sentence)[word]["raw_id"], raw_id)
        # A particle after a verb is no partner: 済む, never 住む.
        self.assertNotEqual((matches("謝らずにはすまない。").get("すま") or {}).get("raw_id"), "vocab_N5_住む_すむ")
        # Nor is a word no place: 本当にすみません is no "to live".
        self.assertNotEqual((matches("本当にすみ。").get("すみ") or {}).get("raw_id"), "vocab_N5_住む_すむ")

    def test_a_kana_noun_two_cards_share_by_the_words_beside_it(self) -> None:
        # Plan 272: the noun's own partners (_NOUN_PARTNERS), a verb in
        # kana counted as every deck verb it may be.
        for sentence, word, raw_id in (
            ("あしたはあめです。", "あめ", "vocab_N5_雨_あめ"),            # UniDic: 飴
            ("あめをなめる。", "あめ", "vocab_N5_飴_あめ"),
            ("このせきはあいているでしょうか。", "せき", "vocab_N4_席_せき"),  # UniDic: 咳
            ("せきが出る。", "せき", "vocab_N3_咳_せき"),
            ("毎日、かんじを三つずつおぼえます。", "かんじ", "vocab_N5_漢字_かんじ"),  # UniDic: 感じ
            ("いいかんじだね。", "かんじ", "vocab_N3_感じ_かんじ"),
            ("かぜがつよい。", "かぜ", "vocab_N5_風_かぜ"),
            ("かぜをひいた。", "かぜ", "vocab_N5_風邪_かぜ"),
            ("はしをわたる。", "はし", "vocab_N5_橋_はし"),
            ("はながさいた。", "はな", "vocab_N5_花_はな"),
            ("かみをきる。", "かみ", "vocab_N4_髪_かみ"),
            ("かみにかく。", "かみ", "vocab_N5_紙_かみ"),
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(matches(sentence)[word]["raw_id"], raw_id)

    def test_a_kana_word_takes_the_card_spelled_as_the_page(self) -> None:
        for sentence, word, raw_id in (
            ("みんなで出かけよう。", "みんな", "vocab_N5__みんな"),          # never 皆 read みな
            ("どっちがいい？", "どっち", "vocab_N5__どっち"),                # never どちら
            ("早くこっちへ逃げろ。", "こっち", "vocab_N5__こっち"),
            ("祝いの席は、ごちそうずくめだった。", "ごちそう", "vocab_N4__ごちそう"),  # the plainer card, not 御馳走
            ("はじめからやり直す。", "はじめ", "vocab_N5_初め_はじめ"),       # not the N1 始め
            ("おかしを食べてはいけません。", "おかし", "vocab_N5_お菓子_おかし"),  # お + かし, never 樫
            ("ごちそうさまでした。", "ごちそうさま", "vocab_N2__ごちそうさま"),
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(matches(sentence)[word]["raw_id"], raw_id)

    def test_a_form_only_one_deck_verb_spells_keeps_its_card(self) -> None:
        for sentence, word, raw_id in (
            # おきない: a godan verb's stem before ない is おか, so 起きる.
            ("七時におきない。", "おき", "vocab_N5_起きる_おきる"),
            # The kanji tells them apart.
            ("毎朝六時に起きます。", "起き", "vocab_N5_起きる_おきる"),
            ("机の上に本を置きます。", "置き", "vocab_N5_置く_おく"),
            # A sound-changed stem is a godan verb's alone: すいて is すく,
            # never 吸う (すいます), はいた 履く, never 這う (はいます).
            ("朝から何も食べていなくて、おなかがすいてたまらない。", "すい", "vocab_N4__すく"),
            ("くつをはいたまま、家に入らないでください。", "はい", "vocab_N3_履く_はく"),
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(matches(sentence)[word]["raw_id"], raw_id)

    def test_a_rarer_rival_leaves_the_card(self) -> None:
        for sentence, word, raw_id in (
            ("あした、とうきょうへかえります。", "かえり", "vocab_N5_帰る_かえる"),  # not the N2 反る
            ("ねるまえに、本を読みます。", "ねる", "vocab_N5_寝る_ねる"),            # not the N1 練る
            ("駅まであるいて、電車にのります。", "のり", "vocab_N5_乗る_のる"),      # not the N2 載る
            ("まどをあけましょうか。", "あけ", "vocab_N5_開ける_あける"),            # not the N3 明ける
            ("めがねをかけたあの男性は、まじめな公務員に見える。", "かけ", "vocab_N4_掛ける_かける"),  # not the N3 欠ける
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(matches(sentence)[word]["raw_id"], raw_id)

    def test_a_kana_card_the_page_spells_keeps_it(self) -> None:
        for sentence, word, raw_id in (
            ("子どもは大きくなりました。", "なり", "vocab_N5__なる"),        # not 鳴る
            ("しゅうまつは何をするつもりですか。", "する", "vocab_N5__する"),  # not 刷る
            ("駅まで五分ぐらいかかります。", "かかり", "vocab_N5__かかる"),    # not 罹る
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(matches(sentence)[word]["raw_id"], raw_id)

    def test_the_refusal_never_trades_one_card_for_another(self) -> None:
        # Only what stands beside the word may name another card (plan
        # 272): the verb's partner, the neighbours of a kana noun.
        for sentence in _corpus()[::7]:
            morphemes = morphology.tokenize(sentence)
            for i, m in enumerate(morphemes):
                before = card_lookup._resolve_morpheme(morphemes, i)
                after = card_lookup.resolve_morpheme(morphemes, i)
                nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
                beside = card_lookup._by_neighbours(morphemes, i, before)
                named = (card_lookup._by_partner(morphemes, i, card_lookup._deck_verbs_spelled(m, nxt)),
                         beside, card_lookup._kana_noun(morphemes, i, beside))
                with self.subTest(sentence=sentence, word=m.surface):
                    self.assertIn(after, (before, None, *named))


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

    def test_no_katakana_card_for_a_native_word_in_hiragana(self) -> None:
        # Plan 193: まま is no ママ.
        for sentence, morphemes, hits in self.read:
            for m, hit in zip(morphemes, hits):
                if hit is None or m.goshu not in ("和", "漢") or card_lookup._katakana_written(m.surface):
                    continue
                entry = hit[1]
                with self.subTest(sentence=sentence, word=m.surface):
                    self.assertFalse(not entry.get("kanji")
                                     and card_lookup._katakana_written(entry.get("kana") or ""))

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


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class GreetingTests(unittest.TestCase):
    """Plan 186d: the greetings a first lesson teaches are kana cards
    UniDic files under kanji the deck does not write (御早う, 有り難う),
    so an interjection reaches a kana-only card by its reading, as an
    adverb does; and a set phrase cut into a verb and its endings is one
    word where it stands as a clause (すみません is no 済む "to finish")."""

    def test_an_interjection_reaches_its_kana_card(self) -> None:
        for sentence, word, raw_id in (
            ("おはよう。", "おはよう", "vocab_N5__おはよう"),
            ("さようなら。", "さようなら", "vocab_N5__さようなら"),
            ("ありがとう。", "ありがとう", "vocab_N5__ありがとう"),
            ("こんにちは。", "こんにちは", "vocab_N5__こんにちは"),
            ("いいえ、学生です。", "いいえ", "vocab_N5__いいえ"),
        ):
            with self.subTest(word=word):
                self.assertEqual(matches(sentence)[word]["raw_id"], raw_id)

    def test_a_set_phrase_standing_as_a_clause_is_one_word(self) -> None:
        # (and before the が that joins the next clause, plan 266)
        for sentence in ("すみません。", "すみません、駅はどこですか。", "すみませんが、駅はどこですか。"):
            with self.subTest(sentence=sentence):
                found = matches(sentence)
                self.assertEqual(found["すみません"]["raw_id"], "vocab_N5__すみません")
                self.assertNotIn("すみ", found)

    def test_a_phrase_inside_a_clause_is_left_to_its_words(self) -> None:
        # しまった after a て is 〜てしまう's, でも after a noun the particles'.
        self.assertNotIn("しまった", matches("ケーキを食べてしまった。"))
        self.assertNotIn("でも", {k for k, v in matches("学校でも勉強します。").items()
                                  if v["raw_id"] == "vocab_N5__でも"})


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class EveryPartTests(unittest.TestCase):
    """Plan 266: the words that hold a sentence together reach the cards
    the deck already holds for them, in the breakdown alone -- and never
    a card the token is not."""

    def test_a_function_word_reaches_its_kana_card(self) -> None:
        for sentence, word, raw_id in (
            ("たなかさんは学生ですか。", "さん", "vocab_N5__さん"),
            ("もうその本を読みました。", "その", "vocab_N5__その"),
            ("田中さんがそんなことを言うはずがない。", "そんな", "vocab_N4__そんな"),
            ("二週間ほど入院が必要らしい。", "ほど", "vocab_N4__ほど"),
            ("いつもより一本早い電車に乗った。", "より", "vocab_N3__より"),
            ("じゃあ、何がおいしいですか。", "じゃあ", "vocab_N5__じゃ/じゃあ"),
        ):
            with self.subTest(word=word):
                self.assertEqual(matches(sentence)[word]["raw_id"], raw_id)

    def test_a_function_word_takes_no_card_it_is_not(self) -> None:
        # ある研究's ある is 或る, "a certain": no ある "to be".
        self.assertEqual(matches("ある研究によると、その原因は分からない。")["ある"]["raw_id"], "vocab_N3_或る_ある")
        # A marker is its point's, even where the point was refused: the
        # ね of ゆっくりねます is 寝る misread, no "isn't it?".
        self.assertNotIn("ね", matches("あしたは休みだから、ゆっくりねます。"))
        # A conjunction opens its clause: no さて "well, now" in a café.
        self.assertNotIn("さて", matches("あのきっさてんでコーヒーを飲みましょう。"))

    def test_the_level_is_graded_without_them(self) -> None:
        # より is an N3 card: an N5 comparison is not made N3 by it.
        from study import difficulty
        self.assertEqual(difficulty.estimate_level("電車より車のほうがはやいです。"), "N5")

    def test_a_conjunction_cut_into_particles_opens_a_sentence(self) -> None:
        for sentence, word, raw_id in (
            ("楽しい。でも、ちょっと難しい。", "でも", "vocab_N5__でも"),
            ("では、始めましょう。", "では", "vocab_N5__では"),
        ):
            with self.subTest(sentence=sentence):
                r = analysis.analyze_local(sentence)
                tok = next(t for t in r["tokens"] if t["surface"] == word)
                self.assertEqual(tok["vocab_match"]["raw_id"], raw_id)
                # The で and the は of では are no place and no topic.
                self.assertFalse({"で", "は"} & {g["pattern"] for g in r["grammar"]})
        # Inside a clause they are the particles: 学校でも, 日本ではない.
        self.assertNotIn("でも", matches("学校でも勉強します。"))
        self.assertNotIn("では", matches("ここは日本ではない。"))

    def test_a_set_phrase_said_alone_is_one_word(self) -> None:
        for sentence, word, meaning in (
            ("はじめまして。", "はじめまして", "How do you do"),
            ("いいえ、どういたしまして。", "どういたしまして", "welcome"),
            ("いらっしゃいませ。", "いらっしゃいませ", "welcome"),
            ("はい、いってらっしゃい。", "いってらっしゃい", "have a good day"),
        ):
            with self.subTest(sentence=sentence):
                self.assertIn(meaning, matches(sentence)[word]["entry"]["meaning"])
        # A clause its words explain is left to them, and a greeting the
        # course teaches keeps its card.
        self.assertNotIn("雨が降る", matches("大事な日に限って、雨が降る。"))
        self.assertNotIn("そうですね", matches("そうですね。"))
        self.assertNotIn("申し訳ありません", matches("申し訳ありません。"))   # 申し訳, ある, ません
        self.assertEqual(matches("ありがとうございます。")["ありがとう"]["raw_id"], "vocab_N5__ありがとう")

    def test_an_idiom_and_a_word_the_tokenizer_cut(self) -> None:
        for sentence, word, raw_id in (
            ("健康に気をつけている。", "気をつけ", "vocab_N2_気を付ける_きをつける"),
            ("この本は役に立った。", "役に立っ", "vocab_N4_役に立つ_やくにたつ"),
            ("住所を会社に知らせてください。", "知らせ", "vocab_N4_知らせる_しらせる"),
            ("彼は思わず叫んでしまった。", "思わず", "vocab_N3_思わず_おもわず"),
            ("すぐに作り直します。", "すぐに", "vocab_N5__すぐ/すぐに"),
        ):
            with self.subTest(word=word):
                self.assertEqual(matches(sentence)[word]["raw_id"], raw_id)
        # A causative the deck does not teach as a word stays a verb, and
        # an ending a point is written on is the point's.
        self.assertIn("書か", matches("子どもに字を書かせた。"))
        self.assertNotIn("思わず", matches("そう思わずにはいられない。"))

    def test_a_kana_word_read_as_written(self) -> None:
        # UniDic files しお under 潮, whose card is the N1 うしお: the N5
        # 塩 read しお answers, not the pool's "tide".
        self.assertEqual(matches("じゃあ、しおをお願いします。")["しお"]["raw_id"], "vocab_N5_塩_しお")
        # Only for a plainer card than the one refused, never a verb's:
        # けつあつ cut in two is no 傑 "the best", ゆうがた's ゆう no 言う.
        self.assertNotEqual((matches("けつあつが高い。").get("けつ") or {}).get("raw_id"), "vocab_N1_傑_けつ")
        self.assertNotEqual((matches("ゆうがた、雨がふった。").get("ゆう") or {}).get("raw_id"), "vocab_N3_言う_ゆう")

    def test_a_name_is_no_word_read_the_same(self) -> None:
        for sentence, word in (("ゆきさん、こんにちは。", "ゆき"), ("トムさんへ。", "トム"),
                               ("アンナより", "アンナ"), ("けんたさんが来た。", "けんた")):
            with self.subTest(word=word):
                self.assertNotIn(word, matches(sentence))
        # Snow is still snow.
        self.assertEqual(matches("ゆきがふりました。")["ゆき"]["raw_id"], "vocab_N5_雪_ゆき")

    def test_iru_after_a_place_is_to_be(self) -> None:
        for sentence in ("いつも家にいるわけではありません。", "犯人はこの中にいるに違いない。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(matches(sentence)["いる"]["raw_id"], "vocab_N5_居る_いる")
        # After が it may be 要る, "to need": still no card.
        self.assertNotIn("いる", matches("お金がいる。"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class WhatTheBankMetTests(unittest.TestCase):
    """Plan 193: what the reading bank's drafters met (plan 192)."""

    def test_mama_is_no_mum_and_no_occasionally(self) -> None:
        # まま is 儘, "as it is": not ママ, "mum", nor 間々, "occasionally",
        # the two cards read まま. The row opens 〜まま, or the pool's まま.
        for sentence in ("服を着たまま寝てしまった。", "そのまま食べてください。", "思ったままを話す。"):
            with self.subTest(sentence=sentence):
                found = matches(sentence).get("まま")
                self.assertTrue(found is None or found["raw_id"] not in ("vocab_N3__ママ", "vocab_N1_間々_まま"))
        self.assertEqual(matches("ママが来た。")["ママ"]["raw_id"], "vocab_N3__ママ")

    def test_a_kana_word_whose_lemma_is_a_guess_keeps_its_card(self) -> None:
        # UniDic files かさ under 嵩 and さかな under 肴; JMdict holds no
        # common kana word read so, and the card stands. さぼる is 混.
        for sentence, word, raw_id in (
            ("かさを持たずに出て、雨にぬれました。", "かさ", "vocab_N5_傘_かさ"),
            ("わたしはさかなを食べない。", "さかな", "vocab_N5_魚_さかな"),
            ("授業をさぼった。", "さぼっ", "vocab_N1__サボる"),
        ):
            with self.subTest(word=word):
                self.assertEqual(matches(sentence)[word]["raw_id"], raw_id)

    def test_the_first_lessons_words_are_their_lower_cards(self) -> None:
        for sentence, word, raw_id in (
            ("すぐ来てください。", "すぐ", "vocab_N5__すぐ/すぐに"),
            # (written すぐに, one word of the card's own spelling: plan 266)
            ("すぐに行きます。", "すぐに", "vocab_N5__すぐ/すぐに"),
            ("ゆっくり話してください。", "ゆっくり", "vocab_N5__ゆっくり/ゆっくりと"),
            ("良い天気ですね。", "良い", "vocab_N5__いい/よい"),
            ("赤ちゃんが泣いている。", "赤ちゃん", "vocab_N4_赤ちゃん_あかちゃん"),
            ("あかちゃんが泣いている。", "あかちゃん", "vocab_N4_赤ちゃん_あかちゃん"),
            ("世論は大きく変わった。", "世論", "vocab_N1_世論_よろん/せろん"),
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(matches(sentence)[word]["raw_id"], raw_id)


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class QuotationTests(unittest.TestCase):
    """Plan 236. UniDic spells some words half in kana (と博 for 賭博,
    "gambling"), and after a quotation MeCab took the quotative と for
    the first kana of one: 「…緊張するよ」と博がいいます came back と博, so
    緊張's example put ばく over the name 博 (Hiroshi) and its breakdown
    glossed it as gambling. Read again as と and the name, the name still
    took the pool's 博 read はく, "doctor": JMdict files almost no names,
    so the commonest row of a name's spelling is another word, and a name
    takes a row read as it is read or none. A course card is no guess and
    stays where UniDic takes its word for a name."""

    SENTENCE = "「僕、飛行機に乗るのはこれが初めてなんだ。緊張するよ」と博がいいます。"

    def test_the_quotations_to_is_the_particle_and_the_name_its_own(self) -> None:
        tokens = morphology.tokenize(self.SENTENCE)
        at = next(i for i, m in enumerate(tokens) if m.surface == "博")
        self.assertEqual((tokens[at - 1].surface, tokens[at - 1].pos), ("と", "particle"))
        self.assertEqual(tokens[at].reading, "ひろし")
        self.assertNotIn("賭博", [m.lemma for m in tokens])
        # Cut and tagged again, the tokens are still the text, offsets and all.
        self.assertEqual([self.SENTENCE[m.start:m.end] for m in tokens], [m.surface for m in tokens])
        self.assertEqual("".join(m.surface for m in tokens), self.SENTENCE)

    def test_the_example_reads_the_name(self) -> None:
        examples = vocab_extras.get_vocab_extras("緊張", "きんちょう")["examples"]
        segments = next(ex["segments"] for ex in examples if ex["jp"] == self.SENTENCE)
        self.assertIn({"text": "博", "reading": "ひろし"},
                      [{"text": p["text"], "reading": p.get("reading")} for p in segments])

    def test_a_mixed_spelling_anywhere_else_stays_one_word(self) -> None:
        for sentence, surface, lemma in (
            ("違法なと博に手を出した。", "と博", "賭博"),
            ("スーパーでとり肉を買いました。", "とり肉", "鳥肉"),
        ):
            with self.subTest(sentence=sentence):
                self.assertIn((surface, lemma), [(m.surface, m.lemma) for m in morphology.tokenize(sentence)])

    def test_a_quotations_to_before_a_word_is_left_as_it_was(self) -> None:
        self.assertEqual(matches("「おはよう」と先生が言った。")["先生"]["raw_id"], "vocab_N5_先生_せんせい")

    def test_a_name_takes_no_row_read_otherwise(self) -> None:
        for sentence, name in (
            (self.SENTENCE, "博"),
            ("「博、君の気持ちは分かるよ」とマイクが言います。", "博"),  # はく, "doctor"
            ("博が来た。", "博"),
            ("こんにちは、山下さん。お出かけですか。", "山下"),  # さんか, "foot of a mountain"
            ("週末、上野の国立博物館に行った。", "上野"),  # こうずけ, a former province
        ):
            with self.subTest(sentence=sentence):
                self.assertNotIn(name, matches(sentence))

    def test_a_name_read_as_its_row_keeps_it(self) -> None:
        for sentence, word, meaning in (
            ("彼は九州へ旅立った。", "九州", "Ky"),
            ("東京に住んでいます。", "東京", "Tokyo"),
            ("「行こう」と太郎が言った。", "太郎", "son"),
            ("その汽船は香港に立ち寄った。", "香港", "Hong Kong"),  # the row is read ホンコン
        ):
            with self.subTest(word=word):
                self.assertIn(meaning, matches(sentence)[word]["entry"]["meaning"])

    def test_a_course_word_taken_for_a_name_keeps_its_card(self) -> None:
        for sentence, word, raw_id in (
            ("池に大きな蓮の葉が浮かんでいる。", "蓮", "vocab_N1_蓮_はす"),  # read れん, Ren
            ("師匠は少年の利根を見込んで、弟子に取った。", "利根", "vocab_N1_利根_りこん"),  # とね, the river
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(matches(sentence)[word]["raw_id"], raw_id)


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class UnknownLettersTests(unittest.TestCase):
    """Letters no dictionary has a word for, read as the one word they are
    (plan 272): MeCab cut a name written in hiragana into marks, stray
    particles and fillers, and the breakdown lit the particles' points."""

    def _tokens(self, sentence: str) -> list[dict]:
        return analysis.analyze_local(sentence)["tokens"]

    def test_a_name_in_kana_is_one_word_and_lends_no_particle(self) -> None:
        for sentence, name in (
            ("ぷらそにかの合唱のみなさんが", "ぷらそにか"),
            ("ゆるりんずのみのりと", "ゆるりんず"),
            ("ずとまよのライブ", "ずとまよ"),
            ("あいみょんの新曲", "あいみょん"),
            ("わたしはぷらそにかがすき", "ぷらそにか"),
            ("ぷらそにかには行かない", "ぷらそにか"),
        ):
            with self.subTest(name=name):
                tokens = self._tokens(sentence)
                token = next(t for t in tokens if t["surface"] == name)
                self.assertIsNone(token["vocab_match"])
                self.assertFalse(token.get("grammar"))
                self.assertEqual(token["gloss"]["en"], "not in the dictionary (a name?)")
                self.assertTrue(token["gloss"]["fr"])
                # The particle after it is the sentence's.
                after = tokens[tokens.index(token) + 1]
                self.assertEqual(after["pos"], "particle")

    def test_letters_the_dictionary_knows_take_their_card(self) -> None:
        for sentence, word, written in (
            ("あにはせが高いです。", "あに", "兄"),
            ("おゆに入る。", "おゆ", "お湯"),
            ("「ふるさとのうぜい」は制度だ。", "のうぜい", "納税"),
        ):
            with self.subTest(word=word):
                token = next(t for t in self._tokens(sentence) if t["surface"] == word)
                self.assertEqual(token["vocab_match"]["entry"]["kanji"], written)
        # あに is the brother and は + せ + が stay what they are.
        self.assertEqual([t["surface"] for t in self._tokens("あにはせが高いです。")][:4], ["あに", "は", "せ", "が"])

    def test_real_words_are_left_alone(self) -> None:
        for sentence, words in (
            ("「ぷ」っていう字", ["ぷ"]),                  # a kana quoted alone
            ("あのー、すみません", ["ませ", "ん"]),         # the ん of ません
            ("へー、そうなんだ", ["な", "ん", "だ"]),       # the ん of なんだ
            ("ぴえんって感じ", ["って"]),                   # って begins with っ
            ("電気をつけたままねてしまいました", ["た"]),   # a stray filler alone
            ("すごいぃ", ["すごい"]),                       # a small vowel lengthens it
            ("失敗したのは私のせいです", ["せい"]),         # one token UniDic reads as a mark
        ):
            with self.subTest(sentence=sentence):
                read = morphology.tokenize(sentence)
                for word in words:
                    self.assertIn(word, [m.surface for m in read])
                self.assertFalse(any(m.unknown for m in read))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class ConjunctionTests(unittest.TestCase):
    """A conjunction the tokenizer cut into a pronoun and particles is one
    word with its card (plan 272): それでは, "well then", was the point
    それで and a topic's は; それでも, "even so", それ and 〜でも."""

    def _tokens(self, sentence: str) -> list[dict]:
        return analysis.analyze_local(sentence)["tokens"]

    def test_a_conjunction_that_opens_a_clause_is_one_word(self) -> None:
        for sentence, word, raw_id in (
            ("それでは行きますか。", "それでは", "vocab_N5__それでは"),
            ("それでは、始めましょう。", "それでは", "vocab_N5__それでは"),
            ("ありがとうそれでは聞いてください", "それでは", "vocab_N5__それでは"),
            ("それでも行きたい。", "それでも", "vocab_N3__それでも"),
        ):
            with self.subTest(sentence=sentence):
                token = next(t for t in self._tokens(sentence) if t["surface"] == word)
                self.assertEqual(token["pos"], "conjunction")
                self.assertEqual(token["vocab_match"]["raw_id"], raw_id)
                self.assertFalse(token.get("grammar"))

    def test_before_an_evaluation_it_is_that_and_its_particle(self) -> None:
        for sentence in ("それでいいよ。", "それではだめだ。", "それでもいいよ。", "これではだめだ。"):
            with self.subTest(sentence=sentence):
                first = self._tokens(sentence)[0]
                self.assertEqual(first["surface"], sentence[:2])
                self.assertEqual(first["pos"], "pronoun")

    def test_a_one_word_conjunction_keeps_its_card_after_a_particle(self) -> None:
        # A subtitle writes what is said: no comma after と.
        token = next(t for t in self._tokens("バンドメンバーとそして") if t["surface"] == "そして")
        self.assertEqual(token["vocab_match"]["raw_id"], "vocab_N5__そして")
        # Cut out of letters, it is no conjunction: きっさてん is 喫茶店.
        self.assertNotIn("さて", [t["surface"] for t in self._tokens("あのきっさてんでコーヒーを飲みましょう。")])


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class WentTests(unittest.TestCase):
    """行った is 行く's form and 行う's (plan 272): 行う takes what is
    carried out with を, and without one it is "went"."""

    def test_went_or_carried_out(self) -> None:
        for sentence, raw_id in (
            ("2人で行った", "vocab_N5_行く_いく"),
            ("外国はおろか、隣の町へも行ったことがない。", "vocab_N5_行く_いく"),
            ("日本語を勉強しに行った。", "vocab_N5_行く_いく"),
            ("アンケートを行った。", "vocab_N4_行う_おこなう"),
            ("会議を東京で行った。", "vocab_N4_行う_おこなう"),
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(matches(sentence)["行っ"]["raw_id"], raw_id)


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class CountedTests(unittest.TestCase):
    """A number and its counter are two words, each with its card (plans
    151, 266), except where the page writes the deck's word in digits or
    UniDic reads an ordinal as another word (plan 272)."""

    def test_digits_for_the_decks_word(self) -> None:
        for sentence, word, raw_id in (
            ("りんごを１つください", "１つ", "vocab_N5_一つ_ひとつ"),
            ("2人で行った", "2人", "vocab_N5_二人_ふたり"),
            ("3日に会おう", "3日", "vocab_N5_三日_みっか"),
        ):
            with self.subTest(word=word):
                self.assertEqual(matches(sentence)[word]["raw_id"], raw_id)

    def test_an_ordinal_is_no_programme(self) -> None:
        token = next(t for t in analysis.analyze_local("3曲目は新曲です")["tokens"] if t["surface"] == "3曲目")
        self.assertEqual(token["reading"], "さんきょくめ")
        self.assertIsNone(token["vocab_match"])
        self.assertTrue(token["gloss"]["en"].startswith("3rd · "))
        self.assertTrue(token["gloss"]["fr"].startswith("3e · "))

    def test_a_number_and_its_counter_stay_two_words(self) -> None:
        tokens = [t["surface"] for t in analysis.analyze_local("この一回のテイクで")["tokens"]]
        self.assertEqual(tokens[1:3], ["一", "回"])


def token_of(sentence: str, surface: str) -> dict:
    return next(t for t in analysis.analyze_local(sentence)["tokens"] if t["surface"] == surface)


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class PrintedNumberTests(unittest.TestCase):
    """A number printed in digits is read as it is said and glossed with
    its figure, and the counter after it takes the card it is there
    (plan 272)."""

    def test_a_figure_is_read_in_japanese(self) -> None:
        for sentence, number, reading, figure in (
            ("１０時までに来ます。", "１０", "じゅう", "10"),         # never てん, "ten"
            ("４０日まで生きられる", "４０", "よんじゅう", "40"),      # never ふぉーてぃ
            ("30分並んでやっと入れました", "30", "さんじゅっ", "30"),
            ("1,500円です", "1,500", "せんごひゃく", "1,500"),
            ("３．５キロ走った", "３．５", "さんてんご", "3.5"),
        ):
            with self.subTest(number=number):
                token = token_of(sentence, number)
                self.assertEqual(token["reading"], reading)
                self.assertEqual(token["gloss"]["en"], figure)
                self.assertEqual(token["furigana"], [{"text": number, "reading": reading}])
        self.assertEqual(token_of("３．５キロ走った", "３．５")["gloss"]["fr"], "3,5")

    def test_what_is_no_quantity_is_left_bare(self) -> None:
        # A time, a code and a telephone's number are not read as one.
        self.assertEqual(token_of("10:30に会おう", "10")["reading"], "10")
        self.assertEqual(token_of("007番の部屋", "007")["reading"], "007")

    def test_a_counter_takes_the_card_it_is_after_a_number(self) -> None:
        for sentence, counter, raw_id in (
            ("30分並んでやっと入れました", "分", "vocab_N5_分_ふん"),  # never ぶん, "portion"
            ("あと5ふんくらいでつくとおもう", "ふん", "vocab_N5_分_ふん"),  # never 糞
            ("おい、何分待たせる気だよ。", "分", "vocab_N5_分_ふん"),  # never 何分 なにぶん
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(matches(sentence)[counter]["raw_id"], raw_id)
        self.assertNotIn("何分", matches("おい、何分待たせる気だよ。"))
        # ...where the adverb 何分, "anyway", stays the word it is.
        self.assertEqual(matches("何分よろしくお願いします。")["何分"]["raw_id"], "vocab_N2_何分_なにぶん")
        self.assertNotIn("何分", matches("何分の一を食べた"))
        self.assertEqual(token_of("30分並んでやっと入れました", "分")["reading"], "ぷん")
        # A share is no minute: 三分の一 is さんぶんのいち.
        self.assertEqual(token_of("三分の一を食べた", "分")["reading"], "ぶん")
        self.assertNotEqual(matches("三分の一を食べた")["分"]["raw_id"], "vocab_N5_分_ふん")

    def test_four_o_clock_is_yoji(self) -> None:
        # 四時 alone is しじ, "the four seasons", to UniDic.
        self.assertEqual(token_of("午後四時に変更してもらえますか。", "四")["reading"], "よ")

    def test_an_ordinal_is_one_word(self) -> None:
        for sentence, surface, reading, english in (
            ("次の信号を右に曲がって、3つ目の角です", "3つ目", "みっつめ", "3rd"),
            ("それで日本に住んで何年目だっけ", "何年目", "なんねんめ", "which (in order) · year"),
            ("これで何回目だよ", "何回目", "なんかいめ", "which (in order) · time"),
            ("三度目の挑戦で合格した", "三度目", "さんどめ", "3rd · time"),  # no "degree"
        ):
            with self.subTest(surface=surface):
                token = token_of(sentence, surface)
                self.assertEqual(token["reading"], reading)
                self.assertEqual(token["gloss"]["en"], english)
                self.assertIsNone(token["vocab_match"])   # no 目, "eye"

    def test_an_age_bracket_and_a_span(self) -> None:
        token = token_of("１０代の友だち同士が徹夜でおしゃべりした。", "１０代")
        self.assertEqual((token["reading"], token["gloss"]["en"]), ("じゅうだい", "teens (10-19)"))
        self.assertEqual(token_of("20代の女性", "20代")["gloss"]["fr"], "de 20 à 29 ans")
        # ７日間 is seven days, never the pool's 日間, "daytime".
        span = token_of("水がないと７日間しか生きられない。", "日間")
        self.assertIsNone(span["vocab_match"])
        self.assertEqual(span["gloss"]["en"], "days (how long)")
        self.assertEqual(token_of("水がないと７日間しか生きられない。", "７")["reading"], "なの")


def gloss_of(sentence: str, surface: str) -> str:
    return (token_of(sentence, surface).get("gloss") or {}).get("en", "")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class SpokenWordTests(unittest.TestCase):
    """Plan 272: the words of speech the course has no lesson and no card
    for say what they do (study/particle_glosses.py), an exclamation is
    read as the word it draws out, and a filler is no demonstrative."""

    def test_a_particle_of_speech_says_what_it_does(self) -> None:
        for sentence, surface, start in (
            ("行くぞ！", "ぞ", "(sentence end) a strong assertion"),
            ("もうこんな時間かしら", "かしら", "I wonder"),
            ("これは並ぶ価値あるわ", "わ", "(sentence end) adds feeling"),
            ("まだ間に合うさ", "さ", "(sentence end) a light assertion"),
            ("止まっちゃってさ、遅れた", "さ", "(spoken) a filler"),
            ("寝なよ", "な", "(spoken) do it: the short form of 〜なさい"),
            ("今ね、駅前のカフェに来てる", "ね", "(mid-sentence) holds the listener"),
            ("ねえ、ちょっと", "ねえ", "hey, say"),
        ):
            with self.subTest(sentence=sentence):
                self.assertTrue(gloss_of(sentence, surface).startswith(start), gloss_of(sentence, surface))

    def test_a_particle_with_a_point_is_the_point_s(self) -> None:
        # 行くな is "don't go": the prohibition's, never a sigh.
        self.assertEqual(gloss_of("行くな！", "な"), "")
        # A sentence-final ね is the ね lesson's.
        self.assertEqual(gloss_of("いい天気ですね", "ね"), "")

    def test_the_three_tte(self) -> None:
        self.assertTrue(gloss_of("食べ放題って言っても", "って").startswith("(spoken) quotes"))
        self.assertTrue(gloss_of("あれって本当に", "って").startswith("(spoken) as for"))
        self.assertTrue(gloss_of("彼氏できたんだって", "って").startswith("(sentence end) they say"))
        token = token_of("分かったってば", "ってば")      # one word, never って and a conditional ば
        self.assertTrue(token["gloss"]["en"].startswith("(sentence end) I told you"))

    def test_a_negative_is_never_silent(self) -> None:
        for sentence, surface in (("知らん", "ん"), ("決して許さぬ", "ぬ"), ("届かず", "ず"), ("間に合わへん", "へん")):
            with self.subTest(sentence=sentence):
                self.assertIn("not", gloss_of(sentence, surface))
        # The ん of ません is the polite negative's lesson.
        self.assertEqual(gloss_of("ありません", "ん"), "")

    def test_mon_that_gives_a_reason_is_no_thing(self) -> None:
        token = token_of("言わないもん", "もん")
        self.assertIsNone(token["vocab_match"])
        self.assertTrue(token["gloss"]["en"].startswith("(sentence end) because"))
        # そんなもん is "such a thing".
        self.assertIn("thing", matches("そんなもん知らない")["もん"]["entry"]["meaning"])

    def test_an_exclamation_is_the_word_it_draws_out(self) -> None:
        for sentence, surface, meaning in (
            ("あのー健太くん", "あのー", "um"),                # never あの, "that over there"
            ("えーっと、それは", "えーっと", "let me see"),
            ("あー死んじゃった", "あー", "Ah!"),                # never ああ, "like that"
            ("いやー天気いいね", "いやー", "oh"),
            ("うわっ、すごい", "うわっ", "yikes"),
            ("えーっ！", "えーっ", "huh?"),                    # never ええ, "yes"
            ("おはよー", "おはよー", "good morning"),
            ("ただいまー！", "ただいまー", "I'm home"),
        ):
            with self.subTest(sentence=sentence):
                self.assertIn(meaning, token_of(sentence, surface)["vocab_match"]["entry"]["meaning"])
        # ...where the plain words keep their cards.
        self.assertIn("yes", matches("ええ、そうです")["ええ"]["entry"]["meaning"])
        self.assertIn("like that", matches("ああいう人")["ああ"]["entry"]["meaning"])

    def test_a_sound_word_and_its_to_are_one_word(self) -> None:
        for sentence, surface, meaning in (
            ("ガシッとつかんだ。", "ガシッと", "firmly"),     # the pool's
            ("どさっと落とした。", "どさっと", "thud"),
            ("彼はさっと立った。", "さっと", "quickly"),     # the deck's N1 card
            ("ゆっくりと歩く。", "ゆっくりと", "slowly"),    # the card's own spelling
        ):
            with self.subTest(sentence=sentence):
                self.assertIn(meaning, token_of(sentence, surface)["vocab_match"]["entry"]["meaning"])
        # A sound word cut short is no word spelled without its っ.
        self.assertIsNone(token_of("すかっとした。", "すかっ")["vocab_match"])

    def test_a_set_phrase_keeps_what_rounds_it_off(self) -> None:
        for sentence, surface in (("本当にすみませんでした。", "すみません"),
                                  ("すいません、遅れました。", "すいません"),
                                  ("すみませんね。", "すみません")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["raw_id"], "vocab_N5__すみません")
        # ...never a clause that ends in a phrase's letters.
        self.assertNotIn("しまった", matches("食べてしまった。"))

    def test_a_word_the_tokenizer_wrote_with_its_particles_is_one_word(self) -> None:
        for sentence, surface, raw_id in (
            ("いつも人が多いです。", "いつも", "vocab_N5__いつも"),           # never いつ + も, "when, also"
            ("どうもありがとう。", "どうも", "vocab_N5__どうも"),
            ("実は、よくわからないんです。", "実は", "vocab_N3_実は_じつは"),
            ("急に寒くなった。", "急に", "vocab_N3_急に_きゅうに"),
            ("今にも雨がふりそうです。", "今にも", "vocab_N3_今にも_いまにも"),
            ("昔と少しも変わっていなかった。", "少しも", "vocab_N3_少しも_すこしも"),
            ("非常に賢い鳥だ。", "非常に", "vocab_N4_非常に_ひじょうに"),
            ("いつか日本へ行きたいです。", "いつか", "vocab_N3__いつか"),    # never 五日
            ("どうか助けてください。", "どうか", "vocab_N3__どうか"),
            ("いつまでも待っています。", "いつまでも", "vocab_N3__いつまでも"),
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(matches(sentence)[surface]["raw_id"], raw_id)

    def test_letters_that_spell_a_whole_word_and_mean_another(self) -> None:
        for sentence, surface in (
            ("いつか分からない。", "いつか"),          # "when", asked
            ("行くかどうか分からない。", "どうか"),     # 〜かどうか
            ("友達とともに行く。", "ともに"),           # 〜とともに
            ("たばこをやめることにした。", "ことに"),   # こと + に, never 殊に
            ("先にかえってもいいですか。", "先に"),     # 先, the N5 card, and its に
            ("木が実になる。", "実に"),                # 実 + に + なる
            ("これは日本語で何と言いますか。", "何と"),  # "what", and the quotation's と
        ):
            with self.subTest(sentence=sentence):
                self.assertNotIn(surface, matches(sentence))

    def test_a_small_vowel_written_full_is_the_same_word(self) -> None:
        self.assertEqual(token_of("ウィルスに感染した。", "ウィルス")["vocab_match"]["entry"]["kana"], "ウイルス")

    def test_a_word_in_kana_reads_as_written(self) -> None:
        # UniDic's sound drew the long vowel as the row's usual one.
        for sentence, surface in (("おおきなこえでよんだ。", "おおきな"), ("ねえ、ちょっと。", "ねえ"),
                                  ("へえ、すごい。", "へえ"), ("山田という人", "いう")):
            with self.subTest(surface=surface):
                self.assertEqual(token_of(sentence, surface)["reading"], surface)
        self.assertEqual(token_of("こんにちは。", "こんにちは")["reading"], "こんにちわ")
