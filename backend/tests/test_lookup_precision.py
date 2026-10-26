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
            ("それは彼一人の功ではない。", "功", "vocab_N4__こう", "merit"),
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
        self.assertIn("assistant", matches("副店長が来た。")["副"]["entry"]["meaning"])
        # And before a card the deck holds: 副社長 is 副 and 社長 (plan 272).
        found = matches("社長は来ないで代わりに副社長をよこした。")
        self.assertIn("associate", found["副"]["entry"]["meaning"])
        self.assertEqual(found["社長"]["raw_id"], "vocab_N4_社長_しゃちょう")
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
        # (A name JMdict writes in full-width letters is its row since plan
        # 272: iPhone ｉＰｈｏｎｅ, read アイフォーン.)
        found = matches("iPhoneを買った。")
        self.assertEqual(found["iPhone"]["entry"]["kanji"], "ｉＰｈｏｎｅ")
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
            ("体を壊す若い人もいる。", "いる", "vocab_N5_居る_いる"),      # a person is
            ("お金がいる。", "いる", "vocab_N5_要る_いる"),                 # money is needed
            ("祖父が去年なくなりました。", "なくなり", "vocab_N4_亡くなる_なくなる"),  # past 去年
            ("終電がなくなり、タクシーで帰った。", "なくなり", "vocab_N4_無くなる_なくなる"),
            ("帰る時に、雨にふられました。", "ふら", "vocab_N5_降る_ふる"),
            ("小さい子が耳をすましています。", "すまし", "vocab_N1_澄ます_すます"),
            ("家で見るより高くつく。", "つく", "vocab_N4_付く_つく"),        # 高くつく, "to cost a lot"
            # The sentence names it where no particle does.
            ("今ははれていますが、これからくもるでしょう。", "はれ", "vocab_N5_晴れる_はれる"),
            ("あさっては、あさからはれて、あたたかいでしょう。", "はれ", "vocab_N5_晴れる_はれる"),
            ("目がはれている。", "はれ", "vocab_N1_腫れる_はれる"),
            ("何回押しても、つかないんです。", "つか", "vocab_N4_点く_つく"),
            # One deck verb spelled so, where UniDic named one the deck lacks.
            ("二つ目のかどを右にまがってください。", "まがっ", "vocab_N5_曲がる_まがる"),   # UniDic: 紛う
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
        # ね of ゆっくりねます is 寝る misread, no "isn't it?" -- and since
        # plan 272 read as 寝る (morphology._sleep).
        self.assertEqual(matches("あしたは休みだから、ゆっくりねます。")["ね"]["raw_id"], "vocab_N5_寝る_ねる")
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
        # After が it may be 要る, "to need": the word before it says which
        # (plan 272), and where none does, still no card.
        self.assertEqual(matches("お金がいる。")["いる"]["raw_id"], "vocab_N5_要る_いる")
        self.assertNotIn("いる", matches("それがいる。"))


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
        # A code and a telephone's number are not read as one; a time of
        # day is read as the time it is (plan 272).
        self.assertEqual(token_of("10:30に会おう", "10:30")["reading"], "じゅうじさんじゅっぷん")
        self.assertEqual(token_of("10:30に会おう", "10:30")["gloss"]["en"], "10:30 (a time of day)")
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

    def test_the_ni_of_an_adverb_and_the_written_naru(self) -> None:
        self.assertEqual(gloss_of("本当においしい。", "に"), "makes an adverb of 本当: 本当に, really, truly")
        self.assertEqual(gloss_of("先に帰ります。", "に"), "makes an adverb of 先: 先に, first, ahead")
        self.assertEqual(gloss_of("駅の先に公園がある。", "に"), "")              # the place's に, a point
        self.assertTrue(gloss_of("評判となり、姿を消した。", "と").startswith("(with なる) becomes"))
        self.assertEqual(gloss_of("祖父は亡くなるまで、日記を書いた。", "まで"), "until (it happens)")
        self.assertTrue(gloss_of("授業中に居眠りしちゃって。", "て").startswith("(at the end) leaves"))
        self.assertEqual(gloss_of("ちょっと待って。", "て"), "")                  # the request, a point

    def test_the_three_tte(self) -> None:
        self.assertTrue(gloss_of("食べ放題って言っても", "って").startswith("(spoken) quotes"))
        self.assertTrue(gloss_of("あれって本当に", "って").startswith("(spoken) as for"))
        self.assertTrue(gloss_of("彼氏できたんだって", "って").startswith("(sentence end) they say"))
        token = token_of("分かったってば", "ってば")      # one word, never って and a conditional ば
        self.assertTrue(token["gloss"]["en"].startswith("(sentence end) I told you"))

    def test_a_negative_is_never_silent(self) -> None:
        # The written ず and ぬ and the spoken ん are the negative's lesson
        # (plan 272), an ending the row shows by its point; へん, the
        # Kansai one, says "not" in its gloss.
        for sentence, surface in (("知らん", "ん"), ("決して許さぬ", "ぬ"), ("届かず", "ず"), ("働かざる者", "ざる"),
                                  ("作らねば", "ね")):
            with self.subTest(sentence=sentence):
                self.assertIn("ない形 〜ない", [g["pattern"] for g in token_of(sentence, surface).get("grammar") or []])
        self.assertIn("not", gloss_of("間に合わへん", "へん"))
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

    def test_a_kana_noun_the_pool_alone_reads_so(self) -> None:
        # UniDic files the word under a spelling JMdict lists second; the
        # one common row read so is the word (plan 272).
        for sentence, surface, kanji in (
            ("すみません、えびのアレルギーがあるんです。", "えび", "海老"),      # UniDic's 蝦
            ("「ふるさと」というのは、生まれた町のことだ。", "ふるさと", "故郷"),  # 古里
            ("遅刻を重ねたあげく、だまって休む。", "あげく", "挙句"),
            ("そうですか。いつごろ動きそうですか。", "いつごろ", "いつ頃"),
            ("ばんごはんは、やさいのぎょうざでした。", "ぎょうざ", "餃子"),      # UniDic's ギョーザ
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kanji"], kanji)
        # ...never a row UniDic's word is not: 有り is no 蟻, "ant"; ふわ no
        # 不和, "discord".
        self.assertIsNone(token_of("猫に九生あり。", "あり")["vocab_match"])
        self.assertIsNone(token_of("うわふわっふわ", "ふわ")["vocab_match"])

    def test_the_polite_prefix_and_a_stem_make_a_noun(self) -> None:
        # The deck's verb where the noun is its noun said politely (お迎え
        # is 迎える's, the card a learner studies), else the pool's noun.
        for sentence, surface, kanji in (("まだです。おすすめは何ですか。", "おすすめ", "勧める"),
                                         ("あしたの朝、駅前までお迎えにまいります。", "お迎え", "迎える"),
                                         ("またのお越しをお待ちしております。", "お越し", "お越し")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kanji"], kanji)
        # ...read as the page says it, never the verb's dictionary form.
        token = token_of("あしたの朝、駅前までお迎えにまいります。", "お迎え")
        self.assertEqual(token["reading"], "おむかえ")
        self.assertEqual(token["furigana"][1], {"text": "迎", "reading": "むか"})
        # おすすめします is お〜する, the point's.
        self.assertNotIn("おすすめ", matches("このワインをおすすめします。"))

    def test_the_polite_prefix_and_a_kana_noun(self) -> None:
        for sentence, surface, kanji in (("おばけきのこがあらわれた！", "おばけ", "お化け"),
                                         ("おうちではどんな様子ですか。", "おうち", "お家"),
                                         ("おやおや困ったものだ。", "おやおや", "")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kanji"], kanji)
        # おつもり's one row is お積り, "the last cup": the page's is つもり.
        self.assertEqual(matches("どういう対策を取るおつもりですか。")["つもり"]["raw_id"], "vocab_N4__つもり")
        self.assertEqual(matches("お店に行く。")["店"]["raw_id"], "vocab_N5_店_みせ")

    def test_a_greeting_cut_into_pieces_is_one_word(self) -> None:
        for sentence, surface, meaning in (("ようこそいらっしゃいました。", "ようこそ", "welcome"),
                                           ("ようこそ日本へ！", "ようこそ", "welcome"),
                                           ("ばいばい！", "ばいばい", "bye-bye"),
                                           ("もしかして、田中さんですか。", "もしかして", "perhaps")):
            with self.subTest(sentence=sentence):
                self.assertIn(meaning, token_of(sentence, surface)["vocab_match"]["entry"]["meaning"])
        # そうして。 is "do so!", the request: no "and then".
        self.assertNotIn("そうして", matches("そうして。次のシフトは土曜日だけど。"))
        self.assertEqual(token_of("おいそがしいところすみませんが、見てください。", "すみません")["vocab_match"]["raw_id"],
                         "vocab_N5__すみません")

    def test_a_word_the_tokenizer_misread_as_a_form(self) -> None:
        # できる + だけ is できるだけ; きっ + て before を is 切手; え after この
        # or before を is 絵.
        self.assertEqual(matches("休暇の予定をできるだけ早く伝えた。")["できるだけ"]["raw_id"], "vocab_N4__できるだけ")
        self.assertEqual(matches("ここできってを買うことができますか。")["きって"]["raw_id"], "vocab_N5_切手_きって")
        self.assertEqual(matches("だれがこのえをかいたか分かりますか。")["え"]["raw_id"], "vocab_N5_絵_え")
        self.assertEqual(matches("だれがこのえをかいたか分かりますか。")["かい"]["raw_id"], "vocab_N3_描く_かく")
        # 〜きっての is the point's; え、 opens a reply.
        self.assertNotIn("きって", matches("県きっての名医だ。"))
        self.assertIsNone(token_of("え、本当？", "え")["vocab_match"])

    def test_a_function_word_keeps_its_card_beside_its_point(self) -> None:
        token = token_of("もうその本を読みました。", "その")
        self.assertEqual(token["vocab_match"]["raw_id"], "vocab_N5__その")
        self.assertIn("この／その／あの／どの", {g["pattern"] for g in token["grammar"]})

    def test_a_small_vowel_written_full_is_the_same_word(self) -> None:
        self.assertEqual(token_of("ウィルスに感染した。", "ウィルス")["vocab_match"]["entry"]["kana"], "ウイルス")

    def test_a_word_in_kana_reads_as_written(self) -> None:
        # UniDic's sound drew the long vowel as the row's usual one.
        for sentence, surface in (("おおきなこえでよんだ。", "おおきな"), ("ねえ、ちょっと。", "ねえ"),
                                  ("へえ、すごい。", "へえ"), ("山田という人", "いう")):
            with self.subTest(surface=surface):
                self.assertEqual(token_of(sentence, surface)["reading"], surface)
        self.assertEqual(token_of("こんにちは。", "こんにちは")["reading"], "こんにちわ")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class KanaPageTests(unittest.TestCase):
    """Plan 272: a first-year page in kana, where UniDic cuts what it does
    not know into what cannot stand there -- a particle that takes a
    verb's ending, a mark before が, a verb that ends in an honorific."""

    def test_neru_written_in_kana(self) -> None:
        for sentence, surface in (("早くねます。", "ね"), ("それで、早くねた。", "ね"), ("今日は早くねよう。", "ねよう"),
                                  ("はやくねなさい。", "ね"), ("あの子はよくねる。", "ねる")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["raw_id"], "vocab_N5_寝る_ねる")
        # The particle stays the particle.
        self.assertIsNone(token_of("そうだね。", "ね")["vocab_match"])

    def test_naku_written_in_kana(self) -> None:
        # ない's own forms are なくて and なかった: ないて is 泣いて, or 鳴いて,
        # by who cries.
        for sentence, kanji in (("こどもがないている。", "泣く"), ("あかちゃんがないた。", "泣く"),
                                ("とりがないている。", "鳴く")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, "ない")["vocab_match"]["entry"]["kanji"], kanji)
        self.assertEqual(token_of("お金がない。", "ない")["pos"], "adjective")
        # The one who cries may stand further back in the clause...
        self.assertEqual(token_of("女の子が一人でないていた。", "ない")["vocab_match"]["entry"]["kanji"], "泣く")
        self.assertEqual(token_of("子供が三人いるので、お弁当を作る。", "いる")["vocab_match"]["entry"]["kanji"], "居る")
        # ...but never what is taken: 犬は匂いをかいだ is 嗅いだ, and かい
        # before だ is no form of 飼う -- a voiced だ after い is a ぐ verb's
        # (plan 272).
        self.assertEqual(token_of("犬は人の匂いをかいだ。", "かい")["vocab_match"]["entry"]["kanji"], "嗅ぐ")

    def test_itai_after_a_part_of_the_body(self) -> None:
        self.assertEqual(token_of("きのうはあたまがいたかった。", "いたかっ")["vocab_match"]["entry"]["kanji"], "痛い")
        self.assertEqual(token_of("ここにいたい。", "い")["vocab_match"]["entry"]["kanji"], "居る")

    def test_a_noun_of_one_kana(self) -> None:
        for sentence, surface, kanji in (
            ("はがいたいです。", "は", "歯"), ("めがいたい。", "め", "目"), ("てをあらう。", "て", "手"),
            ("きのしたで休む。", "き", "木"), ("ひがくれる。", "ひ", "日"), ("ひをけしてください。", "ひ", "火"),
            ("あかいはがおちた。", "は", "葉"), ("ともだちがいえにきた。", "いえ", "家"),
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kanji"], kanji)
        self.assertEqual(token_of("ひをけしてください。", "けし")["vocab_match"]["entry"]["kanji"], "消す")
        self.assertEqual(token_of("ともだちがいえにきた。", "き")["vocab_match"]["entry"]["kanji"], "来る")
        self.assertEqual(token_of("きをつけてください。", "きをつけ")["vocab_match"]["entry"]["kanji"], "気を付ける")
        self.assertEqual(token_of("きがつかなかった。", "き")["vocab_match"]["entry"]["kanji"], "気")   # never 飢餓
        # A particle where a particle stands; いえ, "no", that opens a reply.
        for sentence, surface in (("行くのはたのしい。", "の"), ("食べてはいけない。", "て"), ("いえ、ちがいます。", "いえ")):
            with self.subTest(sentence=sentence):
                self.assertNotEqual(token_of(sentence, surface)["pos"], "noun")

    def test_a_shop_in_kana(self) -> None:
        # パンや and くつや are the shops パン屋 and 靴屋 read in kanji, where
        # a particle, さん or the copula follows (plan 274)...
        for sentence, surface, kanji in (
            ("小さいパンやがあります。", "パンや", "パン屋"), ("駅の前のくつやへ行きました。", "くつや", "靴屋"),
            ("大きい本やがあります。", "本や", "本屋"), ("パンやさんで買いました。", "パンや", "パン屋"),
            ("あそこはパンやです。", "パンや", "パン屋"),
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kanji"], kanji)
        # ...and the list's や, "and", before the next noun or a comma.
        for sentence in ("パンやケーキを買いました。", "店には花や、かばんや、とけいがありました。",
                         "ふゆのふくやくつなどが入っています。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, "や")["pos"], "particle")
        # No shop where noun + 屋 is no word: さくやの is 昨夜, "last night".
        self.assertNotEqual(token_of("さくやのおさらは、まだあらっておりませんでした。", "や")["pos"], "suffix")

    def test_a_name_in_kana_is_no_word_it_was_cut_into(self) -> None:
        token = token_of("こんたくんがきた。", "こんた")                 # never こん + たくん, 巧む
        self.assertIsNone(token["vocab_match"])
        self.assertEqual(token["gloss"]["en"], "a person's name")
        self.assertEqual(token_of("こんたくんがきた。", "くん")["vocab_match"]["raw_id"], "vocab_N4_君_くん")
        self.assertEqual(token_of("こんたくんがきた。", "き")["vocab_match"]["entry"]["kanji"], "来る")
        self.assertIsNone(token_of("そうたはげんきです。", "そうた")["vocab_match"])   # never そう + た
        self.assertIsNone(token_of("ゆうしゃ　たろうは　もりに　いった", "たろう")["vocab_match"])  # no ending
        for sentence, surface in (("たくさんある。", "たくさん"), ("おかあさんがきた。", "おかあさん"),
                                  ("みなさん、こんにちは。", "みなさん")):
            with self.subTest(sentence=sentence):
                self.assertIsNotNone(token_of(sentence, surface)["vocab_match"])


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class WordsTheTokenizerCutTests(unittest.TestCase):
    """A word read as the page says it, and a word UniDic cut in pieces
    read whole, from a reviewer's pass over real lines (plan 272)."""

    def test_the_card_read_as_the_page_says(self) -> None:
        for sentence, surface, raw_id in (
            ("明日までに出さなくてはいけない。", "明日", "vocab_N5_明日_あした"),   # never the N4 あす
            ("一日でこの本を読める。", "一日", "vocab_N5_一日_いちにち"),           # never "the 1st"
            ("四月一日に入学式がある。", "一日", "vocab_N5_一日_ついたち"),
            ("はい。何分ぐらいかかりますか。", "分", "vocab_N5_分_ふん"),           # never "portion"
            ("数日その駅に置かれた。", "日", "vocab_N4_日_にち"),                  # never "sun"
            ("努力が実を結んだ。", "実", "vocab_N3_実_み"),
            ("実を言うと、私は彼が好きでないのです。", "実", "vocab_N1_実_じつ"),
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["raw_id"], raw_id)
        self.assertEqual(token_of("四月一日に入学式がある。", "一日")["reading"], "ついたち")

    def test_a_conjunction_cut_in_two_is_its_card(self) -> None:
        for sentence, surface in (("この部屋は駅から近いし、それに家賃も安い。", "それに"),
                                  ("晴れると思った。ところが、雨が降り出した。", "ところが"),
                                  ("祈りは届かず　それでも叫べ", "それでも")):
            with self.subTest(sentence=sentence):
                token = token_of(sentence, surface)
                self.assertEqual(token["pos"], "conjunction")
                self.assertEqual(token["vocab_match"]["entry"]["kana"], surface)
        # それにします, "I'll have that one": それ and the particle.
        self.assertEqual(matches("では、それにします。")["それ"]["raw_id"], "vocab_N5__それ")
        self.assertIn("それ", matches("それで　いいです"))

    def test_a_word_what_opens(self) -> None:
        self.assertEqual(token_of("なんで私ばっかりこんな目に遭うの。", "なんで")["vocab_match"]["entry"]["kana"],
                         "なんで")
        self.assertEqual(token_of("なんとなく取った資格が役に立った。", "なんとなく")["vocab_match"]["level"], "N2")
        self.assertEqual(token_of("それでも　なぜか笑えたんだ", "なぜか")["vocab_match"]["entry"]["kanji"], "何故か")
        self.assertEqual(token_of("なんか先週ずっと雨だった。", "なんか")["vocab_match"]["entry"]["kanji"], "何か")
        self.assertEqual(token_of("二度と来ない。", "二度と")["vocab_match"]["entry"]["kana"], "にどと")
        # 何で行きますか asks "by what"; なぜか分からない "why"; 二度とも, "both times".
        self.assertIn("何", matches("何で行きますか。"))
        self.assertIn("なぜ", matches("なぜか分からない。"))
        self.assertIn("二", matches("二度とも失敗した。"))

    def test_a_polite_set_phrase(self) -> None:
        for sentence, surface in (("今日はお先に失礼します。", "お先に"), ("お大事に。", "お大事に"),
                                  ("おかげさまで、元気です。", "おかげさまで")):
            with self.subTest(sentence=sentence):
                self.assertIn(surface, matches(sentence))
        self.assertEqual(matches("お店で買った。")["店"]["raw_id"], "vocab_N5_店_みせ")

    def test_a_compound_its_parts_misread(self) -> None:
        # A loanword cut in two, or joined to a native word, is the word.
        for sentence, surface, reading in (
            ("その段ボール、そこに置いとけ。", "段ボール", "だんボール"),
            ("新型スマートフォンを発売する。", "スマートフォン", "スマートフォン"),
            ("ボールペンを三本ください。", "ボールペン", "ボールペン"),
            ("いく日もいく日も編んだ。", "いく日", "いくにち"),
            ("みそラーメンをください。", "みそラーメン", "みそラーメン"),
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kana"], reading)
        # Two cards in kanji stay two, the second read with the word's
        # sound change: never うで + とけい.
        for sentence, surface, reading in (("祖父から腕時計をもらった。", "時計", "どけい"),
                                           ("大相撲九月場所", "相撲", "ずもう"),
                                           ("鉄道会社に勤める。", "会社", "がいしゃ")):
            with self.subTest(sentence=sentence):
                token = token_of(sentence, surface)
                self.assertEqual(token["reading"], reading)
                self.assertIsNotNone(token["vocab_match"])
        self.assertEqual(token_of("駅まで何分ですか。", "分")["reading"], "ぷん")
        # 転校生's 生 is a student, no "life".
        gloss = token_of("あの転校生の名前", "生")["gloss"]
        self.assertTrue(gloss["en"].startswith("(suffix) student") and gloss["fr"])
        # にございます is でございます said of old, glossed in both languages.
        gloss = token_of("殿、一大事にございます！", "に")["gloss"]
        self.assertTrue(gloss["en"].startswith("(with ござる)") and gloss["fr"].startswith("(avec ござる)"))
        # Two cards to study stay two; a count is no word: 五分 is ごふん.
        for sentence, part in (("電話番号を教えてください。", "番号"), ("テレビ番組を見る。", "番組"),
                               ("駅まで五分ぐらいかかります。", "分"), ("うちも、七八一二ですよ。", "二")):
            with self.subTest(sentence=sentence):
                self.assertIn(part, matches(sentence))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class SpokenAndSilentWordTests(unittest.TestCase):
    """Words a breakdown left saying nothing on real lines, and what
    the parts of speech UniDic misread are (plan 272)."""

    def test_a_kana_word_jmdict_writes_so(self) -> None:
        for sentence, surface, kana in (("ありったけの声で叫べ", "ありったけ", "ありったけ"),   # never 有り丈 ありたけ
                                        ("いじめに関する調査", "いじめ", "いじめ"),
                                        ("今日めっちゃ暑くない？", "めっちゃ", "めっちゃ"),
                                        ("わしの目の黒いうちは許さんぞ。", "わし", "わし"),     # I, never "eagle"
                                        ("しっ、静かに！", "しっ", "しっ")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kana"], kana)
        self.assertEqual(token_of("わしの目の黒いうちは許さんぞ。", "わし")["vocab_match"]["entry"]["kanji"], "儂")
        self.assertIsNone(token_of("猫に九生あり。", "あり")["vocab_match"])            # never 蟻

    def test_the_place_de_unidic_took_for_the_copula(self) -> None:
        for sentence in ("うみで、きれいなかいがらをひろいました。", "この一回のテイクで"):
            with self.subTest(sentence=sentence):
                token = token_of(sentence, "で")
                self.assertEqual(token["pos"], "particle")
                self.assertEqual([g["pattern"] for g in token["grammar"]], ["で"])
        # The copula's own て form says what it is: 急なお願いで、すみません.
        for sentence in ("急なお願いで、すみません。", "残業続きで、最近ほとんど自炊できてない。"):
            with self.subTest(sentence=sentence):
                self.assertTrue(token_of(sentence, "で")["gloss"]["en"].startswith("is ..., and"))

    def test_the_no_and_the_ttebaa_that_close_what_is_said(self) -> None:
        gloss = token_of("私、ずっと前から好きだったの。気づいてなかったでしょ？", "の")["gloss"]
        self.assertTrue(gloss["en"].startswith("(at the end) explains") and gloss["fr"])
        token = token_of("もう、分かったってば！何回言えば気が済むの？", "ってば")
        self.assertEqual(token["pos"], "particle")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class RealLineWordTests(unittest.TestCase):
    """Words a reviewer's pass over real lines found wrong or silent, the
    second round (plan 272)."""

    def test_a_kana_verb_by_what_it_takes(self) -> None:
        self.assertEqual(token_of("大事なところに印をつけた。", "つけ")["vocab_match"]["entry"]["kanji"], "付ける")
        self.assertEqual(token_of("あと5ふんくらいでつくとおもう", "つく")["vocab_match"]["entry"]["kanji"], "着く")
        # やる after て has no point of its own: the deck's やる.
        self.assertEqual(token_of("今日こそ決着をつけてやる！", "やる")["vocab_match"]["entry"]["kana"], "やる")

    def test_the_verb_a_point_is_the_word_of(self) -> None:
        self.assertIsNone(token_of("手を洗ってきなさい。", "なさい")["vocab_match"])     # 〜なさい, no "to do"
        self.assertIsNone(token_of("我が名はアルベルト。騎士団の団長である。", "ある")["vocab_match"])
        self.assertIsNotNone(token_of("机の上に本がある。", "ある")["vocab_match"])

    def test_kana_the_sentence_reads(self) -> None:
        self.assertEqual(token_of("うちは おおさかの ちかくに あります。", "ちかく")["vocab_match"]["entry"]["kanji"],
                         "近く")
        self.assertEqual(token_of("……ま、嫌いじゃねえけど。", "ま")["pos"], "interjection")
        self.assertEqual(token_of("またねー", "またねー")["vocab_match"]["entry"]["kana"], "またね")  # no ない
        self.assertEqual(token_of("まじか……財布を忘れた。", "まじ")["vocab_match"]["entry"]["kana"], "まじ")
        from study import romaji
        self.assertEqual(romaji.sentence_romaji("まじか！"), "maji ka!")
        self.assertEqual(token_of("ちょっとエモくないですか", "エモく")["vocab_match"]["entry"]["kana"], "エモい")
        # 金がねえ is ない, "there isn't".
        self.assertEqual(token_of("金がねえ。", "ねえ")["pos"], "adjective")

    def test_an_expression_the_pool_holds(self) -> None:
        for sentence, surface, kana in (
            ("ずっと気になって、仕事に集中できない。", "気になっ", "きになる"),
            ("今日こそ決着をつけてやる！", "決着をつけ", "けっちゃくをつける"),
            ("夜中まで騒がれて、腹が立ってしかたがない。", "腹が立っ", "はらがたつ"),
            ("急いで食べないと元を取れない。", "元を取れ", "もとをとる"),
            ("解決策が功を奏した。", "功を奏し", "こうをそうする"),
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kana"], kana)
        # Its verb's own form is the form's still: 本題に入ろう.
        self.assertEqual(token_of("そろそろ本題に入ろう。", "本題に入ろう")["vocab_match"]["entry"]["kana"],
                         "ほんだいにはいる")
        # It is still the deck's words, which a sentence of the bank counts.
        parts = token_of("明け方から並んで、新製品を手に入れた。", "手に入れ")["parts"]
        self.assertEqual([p["vocab_match"]["raw_id"] for p in parts], ["vocab_N5_手_て", "vocab_N5_入れる_いれる"])

    def test_a_phrase_its_cards_say(self) -> None:
        # JMdict files these as expressions too; their cards say them.
        for sentence, word in (("子どもが一人で服を着るようになった。", "服"),
                               ("角を右に曲がってください。", "右"),
                               ("夜には雨が降るだろう。", "雨"),
                               ("日よう日に来ることができます。", "でき"),
                               ("なんでこんな目に遭わなきゃいけないの。", "遭わ"),   # "to encounter (something unpleasant)"
                               ("努力が実を結んだ。", "実"),
                               ("冬は病気になりがちだ。", "病気")):
            with self.subTest(sentence=sentence):
                self.assertIn(word, matches(sentence))
        # Nor where the page means its letters: JMdict's 山が見える is also
        # "(literally) to see the mountains", its 顔が見える "identifiable"
        # said of a noun, its 話がわかる "down to earth", its 茶にする "to
        # make fun of" before "to take a tea break", and 物 is a formal noun.
        for sentence, word in (("高い山が見えます。", "山"), ("相手の顔が見えないまま話す。", "顔"),
                               ("先生の話が分かりました。", "話"), ("お茶にする。", "お茶"),
                               ("中に入っていた物を言えば、受け取れる。", "物")):
            with self.subTest(sentence=sentence):
                self.assertIn(word, matches(sentence))

    def test_a_conjunction_opening_a_sentence(self) -> None:
        for sentence, surface in (("毎日勉強してる。なのに、成績が上がらない。", "なのに"),
                                  ("疲れてるんでしょ？だったら、早く寝なよ。", "だったら")):
            with self.subTest(sentence=sentence):
                token = token_of(sentence, surface)
                self.assertEqual(token["pos"], "conjunction")
                self.assertEqual(token["vocab_match"]["entry"]["kana"], surface)
        self.assertNotIn("だったら", matches("雨だったら行かない。"))
        # A pronoun and its particle are the pronoun's but before a comma:
        # それを読んでから, "after reading it"; それより遅く, "later than that".
        self.assertEqual(token_of("いいのよ。それより、早く行こう。", "それより")["pos"], "conjunction")
        for sentence in ("助かります。それを読んでから書きますね。", "それより遅くなる場合は、電話してください。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(matches(sentence)["それ"]["raw_id"], "vocab_N5__それ")

    def test_a_date_and_a_rate(self) -> None:
        token = token_of("10/24（土）の飲み会", "10/24")
        self.assertEqual(token["reading"], "じゅうがつにじゅうよっか")
        self.assertEqual(token["gloss"]["en"], "October 24 (month/day)")
        self.assertEqual(token["gloss"]["fr"], "24 octobre (mois/jour)")
        self.assertEqual(token_of("4/1から始まる。", "4/1")["reading"], "しがつついたち")
        self.assertFalse(any(t["surface"] == "10/24" for t in analysis.analyze_local("2024/10/24")["tokens"]))
        # A fraction, or a day no month has, is no date; a weekday makes one.
        for sentence in ("全体の1/3が水です。", "ケーキを1/2食べた。", "2/31に会おう。"):
            with self.subTest(sentence=sentence):
                self.assertFalse(any("gloss" in t and "month/day" in t["gloss"]["en"]
                                     for t in analysis.analyze_local(sentence)["tokens"]))
        self.assertEqual(token_of("1/3（金）に会議", "1/3")["reading"], "いちがつみっか")
        self.assertEqual(token_of("1ドル＝158円台まで値下がりした。", "158")["reading"], "ひゃくごじゅうはち")

    def test_a_word_drawn_out(self) -> None:
        self.assertEqual(token_of("どうもーゲーム実況です", "どうもー")["vocab_match"]["entry"]["kana"], "どうも")
        self.assertEqual(token_of("またねーばいばーい", "ばいばーい")["vocab_match"]["entry"]["kana"], "バイバイ")

    def test_what_a_particle_says_where_no_point_is(self) -> None:
        for sentence, surface, start in (("儚き夢よ　いずこへゆかん", "よ", "(after a noun) calls out"),
                                         ("誰にも止められはしない", "は", "(between a verb's stem and しない)"),
                                         ("怖くなんかないもん。ちょっとびっくりしただけだし。", "もん", "")):
            with self.subTest(sentence=sentence):
                gloss = token_of(sentence, surface)["gloss"]
                self.assertTrue(gloss["en"].startswith(start) and gloss["fr"])


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class ChatAndStreamWordTests(unittest.TestCase):
    """Spoken words a reviewer's pass over chats and streams found
    silent or misread, the third round (plan 272)."""

    def test_a_spoken_word_jmdict_lacks(self) -> None:
        for sentence, surface, start in (
            ("今日の練習、マジできつかったっすね。", "マジで", "(casual) seriously"),
            ("てか、それって結局お前のせいじゃね？", "てか", "(casual) I mean"),
            ("それはさすがに草www", "www", "(net slang) laughter"),
            ("それはさすがに草www", "草", "(net slang) lol"),
            ("見りゃ分かるだろうが！", "が", "(after だろう, at the end) insists"),
            ("てか、それって結局お前のせいじゃね？", "じゃ", "(spoken) では said short"),
        ):
            with self.subTest(sentence=sentence, surface=surface):
                token = token_of(sentence, surface)
                self.assertIsNone(token["vocab_match"])
                self.assertTrue(token["gloss"]["en"].startswith(start) and token["gloss"]["fr"])
        # The grass of a garden is grass; なんでマジでやばい's まじ is one word.
        self.assertEqual(token_of("庭の草を取る。", "草")["vocab_match"]["entry"]["kanji"], "草")
        self.assertNotIn("〜くて／〜で", {g["pattern"] for g in analysis.analyze_local("マジできつかった。")["grammar"]})
        # じゃあ opening a clause is "well then", after それ too.
        self.assertIsNotNone(token_of("じゃあ、行こうか。", "じゃあ")["vocab_match"])
        self.assertIsNotNone(token_of("それじゃあこのメモを渡してください。", "じゃあ")["vocab_match"])
        # だろうが before a full stop is "though", no insisting.
        self.assertNotIn("gloss", token_of("おおっぴらには普通言わないだろうが。", "が"))

    def test_an_imperative_read_as_a_causative(self) -> None:
        token = token_of("Yeah　鳴らせ　鳴らせ　そのギターを", "鳴らせ")
        self.assertEqual(token["vocab_match"]["entry"]["kanji"], "鳴らす")
        self.assertIn("命令形 〜ろ／〜え", {g["pattern"] for g in token["grammar"]})
        # Before an ending it is the causative still: 鳴らせない.
        self.assertNotIn("鳴らせ", matches("ここではベルを鳴らせない。"))

    def test_a_name_a_speaker_gives(self) -> None:
        token = token_of("どうもーゲーム実況のカイトです", "カイト")
        self.assertIsNone(token["vocab_match"])                       # no "kite"
        self.assertEqual(token_of("カイトと申します。", "カイト")["vocab_match"], None)
        # A word the deck teaches is the word: a student, an engineer.
        self.assertIsNotNone(token_of("どうも、エンジニアです。", "エンジニア")["vocab_match"])
        self.assertIsNotNone(token_of("このおもちゃはカイトです。", "カイト")["vocab_match"])

    def test_a_katakana_word_tagged_a_name_says_both(self) -> None:
        # ジャック is Jack or "jack", ヒューズ Hughes or "fuse": nothing on the
        # page says which, so the line names both. JMdict's own row for a
        # person (Mozart) is the person.
        for sentence, surface in (("ジャック、よく来てくれたね。", "ジャック"), ("ヒューズが飛んだ。", "ヒューズ")):
            with self.subTest(sentence=sentence):
                self.assertTrue(token_of(sentence, surface)["vocab_match"]["entry"]["meaning"]
                                .startswith("a person's name, or: "))
        self.assertEqual(token_of("モーツァルトがこの世を去った。", "モーツァルト")["vocab_match"]["entry"]["meaning"],
                         "Mozart")

    def test_a_compound_no_dictionary_holds(self) -> None:
        r = analysis.analyze_local("サッカーの選手が、右ひざのけがのため欠場する。")
        parts = {t["surface"]: t["vocab_match"]["raw_id"] for t in r["tokens"] if t["vocab_match"]}
        self.assertEqual((parts["右"], parts["ひざ"]), ("vocab_N5_右_みぎ", "vocab_N3_膝_ひざ"))
        # Two kanji the dictionary lacks are as often a name: 中山 stays whole.
        self.assertIn("中山", [t["surface"] for t in analysis.analyze_local("みどり町の中山まで電話をください。")["tokens"]])
        # A ノ between kanji is a name's: the wrestler 霧ノ海.
        token = token_of("大関・霧ノ海が初優勝を果たしました。", "霧ノ海")
        self.assertEqual(token["reading"], "きりのうみ")
        self.assertEqual(token["gloss"]["en"], "a name")

    def test_a_name_is_the_name_wherever_its_window_names_it(self) -> None:
        r = analysis.analyze_local("たろうの　こうげき！　おばけきのこを　やっつけた！",
                                   before="ゆうしゃ　たろうは　もりの　どうくつに　はいった")
        taro = next(t for t in r["tokens"] if t["surface"] == "たろう")
        self.assertIsNone(taro["vocab_match"])                        # no "first son"


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class SilentWordTests(unittest.TestCase):
    """Words the gap report (scripts/breakdown_gaps) found cut or saying
    nothing in the app's own sentences (plan 272)."""

    def test_a_kana_word_cut_into_a_particle(self) -> None:
        # No か opens what is said: かおいろ is 顔色, never か + お + いろ.
        token = token_of("どうしたんですか。かおいろが悪いですよ。", "かおいろ")
        self.assertEqual(token["vocab_match"]["entry"]["kanji"], "顔色")

    def test_an_adverb_said_with_its_to(self) -> None:
        for sentence, surface, kana in (("しっかりと勉強しなさい。", "しっかりと", "しっかり"),
                                        ("乗客が次々と列車に乗りこむ。", "次々と", "つぎつぎ")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kana"], kana)
        # One no dictionary has keeps its と, which says what it is.
        self.assertTrue(token_of("雨がざあざあと降っている。", "と")["gloss"]["en"].startswith("(after an adverb)"))
        # そう's と quotes, as one before a verb of saying or thinking does.
        self.assertIn("そう", [t["surface"] for t in analysis.analyze_local("そうとは限らない。")["tokens"]])
        self.assertIn("当然", [t["surface"] for t in analysis.analyze_local("それを当然と感じられることが証しだ。")["tokens"]])
        # A kanji adverb's する is its own: 堂々とした, 依然として; a word
        # said twice that the tokenizer cut is one: もうもうと.
        for sentence, surface in (("堂々とした既存のビル", "堂々とした"), ("価格は依然として高い。", "依然として"),
                                  ("車は砂ぼこりをもうもうとあげて走っていた。", "もうもうと")):
            with self.subTest(sentence=sentence):
                self.assertIsNotNone(token_of(sentence, surface)["vocab_match"])

    def test_kana_the_tokenizer_misread_in_a_page_of_kana(self) -> None:
        # 豈 is classical: あに is 兄. ねよう is 寝る's volitional, no よう "well".
        self.assertEqual(token_of("父と母と、あにといもうとがいます。", "あに")["vocab_match"]["entry"]["kanji"], "兄")
        self.assertEqual(token_of("早くねようという運動も始めた。", "ねよう")["vocab_match"]["entry"]["kanji"], "寝る")


def card_of(sentence: str, surface: str) -> str | None:
    vm = token_of(sentence, surface).get("vocab_match")
    return vm["raw_id"] if vm else None


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class ThirdReviewWordTests(unittest.TestCase):
    """What a third review of 150 fresh lines -- chats, streams, news,
    recipes, signs, business mail, stories -- and the gap report found
    read wrong, cut or silent (plan 272)."""

    def test_a_kana_verb_by_what_it_takes(self) -> None:
        for sentence, surface, raw_id in (
                ("じゃがいもは皮をむいて、水にさらす。", "むい", "vocab_N2_剥く_むく"),
                ("上をむいて歩こう。", "むい", "vocab_N3_向く_むく"),
                ("酒と醤油で下味をつけます。", "つけ", "vocab_N3_付ける_つける"),
                ("お箸は何膳おつけしましょうか。", "つけ", "vocab_N3_付ける_つける"),
                ("おばあさんにおりがみをならいました。", "ならい", "vocab_N5_習う_ならう"),
                ("店長の大西さんはおこらないで、と言った。", "おこら", "vocab_N4_怒る_おこる"),
                ("つくえにはっておいた。", "はっ", "vocab_N5_貼る_はる"),
                ("人をやとうよりずっと安くすむ。", "すむ", "vocab_N4_済む_すむ"),
                ("彼は歌も歌えば、絵もかく。", "かく", "vocab_N3_描く_かく"),
                ("しおの多い食事をへらすことをすすめられた。", "すすめ", "vocab_N3_勧める_すすめる")):
            with self.subTest(sentence=sentence):
                self.assertEqual(card_of(sentence, surface), raw_id)
        # How much fell is no subject: the snow is, back past も.
        self.assertEqual(card_of("ゆきが三十センチもふったのです。", "ふっ"), "vocab_N5_降る_ふる")

    def test_a_kana_verb_by_how_it_is_said(self) -> None:
        # おります with nothing taken or left is the humble いる; 電車を
        # おります gets off.
        self.assertEqual(card_of("はい、おります。", "おり"), "vocab_N3_居る_おる")
        self.assertEqual(card_of("電車をおります。", "おり"), "vocab_N5_降りる_おりる")
        # A thing that comes down is no one who is there.
        self.assertNotEqual(card_of("これで肩の荷がおりました。", "おり"), "vocab_N3_居る_おる")
        # ...and after て it is 〜ています's, said humbly: no card.
        self.assertIsNone(card_of("お待ちしております。", "おり"))
        # なく with no animal in the sentence weeps.
        self.assertEqual(card_of("ないてはいられない。", "ない"), "vocab_N4_泣く_なく")
        self.assertEqual(card_of("とりがないている。", "ない"), "vocab_N5_鳴く_なく")
        # いってきます goes; said whole it is the pool's set phrase.
        self.assertEqual(card_of("はい、今からいってきます。", "いっ"), "vocab_N5_行く_いく")
        self.assertEqual(token_of("うん、いってきます！", "いってきます")["vocab_match"]["entry"]["kanji"], "行ってきます")
        # みせる after て has no point to be: 見せる.
        self.assertEqual(card_of("今度こそ、うまくやってみせる。", "みせる"), "vocab_N5_見せる_みせる")

    def test_the_page_spells_the_verb(self) -> None:
        # UniDic files 突っ込み under 突き込む, read つきこむ; the page writes
        # 突っ込む, the card. Never another form: 聞き取れず is 聞き取る's
        # potential, no 聞き取り card.
        self.assertEqual(card_of("通学路に車突っ込み、児童2人けが", "突っ込み"), "vocab_N2_突っ込む_つっこむ")
        self.assertEqual(token_of("卵を溶きほぐし、混ぜる。", "溶きほぐし")["vocab_match"]["entry"]["kanji"], "溶きほぐす")
        self.assertNotEqual(card_of("名前が聞き取れず、聞き返した。", "聞き取れ"), "vocab_N1_聞き取り_ききとり")
        self.assertEqual(token_of("亡き姉の日記。", "亡き")["vocab_match"]["entry"]["kanji"], "亡い")
        # A lemma's row read as the page reads it stands: 生まれつき, "by
        # nature", the noun.
        self.assertEqual(token_of("誰にも生まれつきそなわっている。", "生まれつき")["vocab_match"]["entry"]["kanji"],
                         "生まれ付き")

    def test_an_apology_after_what_it_is_for(self) -> None:
        for sentence in ("遅れてすみません。", "突然すみません、下の部屋の者です。", "いつもすみません。",
                         "お手数をおかけしてすみません。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(card_of(sentence, "すみません"), "vocab_N5__すみません")
        # おかけして is お + 掛ける + して, never 置く and 決して.
        self.assertEqual(card_of("ご迷惑をおかけして申し訳ありません。", "かけ"), "vocab_N4_掛ける_かける")

    def test_words_of_chat_and_slang(self) -> None:
        self.assertEqual(token_of("推しが尊すぎる", "推し")["vocab_match"]["entry"]["meaning"], "being a fan of")
        self.assertEqual(token_of("推しが尊すぎる", "推し")["pos"], "noun")
        self.assertEqual(card_of("今のエイムえぐくね？", "ね"), "vocab_N5__ない")
        self.assertEqual(token_of("それな〜わかりみが深い", "わかりみ")["vocab_match"]["entry"]["kanji"], "分かりみ")
        self.assertEqual(token_of("それな〜わかりみが深い", "深い")["reading"], "ふかい")
        self.assertEqual(token_of("それな〜わかりみが深い", "それな〜")["vocab_match"]["entry"]["kana"], "それな")
        # The same join makes no name of a word: しゅう + まつ is 週末.
        self.assertEqual(token_of("しゅうまつは何をしたいですか。", "しゅうまつ")["vocab_match"]["entry"]["kanji"], "週末")
        self.assertEqual(token_of("ガチでうますぎて優勝した", "ガチで")["vocab_match"]["entry"]["kana"], "ガチで")
        self.assertEqual(token_of("待って、ラグい！", "ラグい")["vocab_match"]["entry"]["kana"], "ラグい")
        self.assertTrue(gloss_of("あざす！", "あざす").startswith("(slang) thanks"))
        self.assertEqual(token_of("てへっ、バレちゃった？", "てへっ")["vocab_match"]["entry"]["kana"], "てへ")
        self.assertTrue(gloss_of("喉死んだｗ", "ｗ").startswith("(net slang) laughter"))
        # 参ったな said alone is "I'm beaten".
        self.assertEqual(token_of("参ったな、こりゃ一本取られたわ。", "参った")["vocab_match"]["entry"]["meaning"],
                         "I'm beaten")
        for sentence in ("参ったな、こりゃ一本取られたわ。", "まあな。", "ちょっとな。"):
            with self.subTest(sentence=sentence):
                self.assertTrue(gloss_of(sentence, "な").startswith("(sentence end) feeling"))

    def test_a_sound_word(self) -> None:
        for sentence, surface in (("バキッ！", "バキッ"), ("ガシャーン！窓ガラスが割れた。", "ガシャーン"),
                                  ("ゴゴゴゴゴ……", "ゴゴゴゴゴ"), ("ペコリと頭を下げる。", "ペコリ")):
            with self.subTest(sentence=sentence):
                self.assertTrue(gloss_of(sentence, surface).startswith("a sound or manner word"))
        self.assertEqual(token_of("バキッ！", "バキッ")["reading"], "ばきっ")
        # A loanword UniDic calls a noun is no sound: マシーン, "machine".
        self.assertFalse(gloss_of("新しいマシーンを持っている。", "マシーン").startswith("a sound"))
        # (タイムマシーン is the pool's one word since plan 272.)
        self.assertEqual(token_of("タイムマシーンを持っている。", "タイムマシーン")["vocab_match"]["entry"]["kana"],
                         "タイムマシン")

    def test_names_by_what_follows_them(self) -> None:
        self.assertEqual(gloss_of("湊くんってさ、優しいとこあるよね。", "湊"), "given name")
        self.assertTrue(token_of("今日は朝から築地で食べ歩きしていきたい。", "築地")["vocab_match"]["entry"]["meaning"]
                        .startswith("a place name, or: "))

    def test_a_word_that_ends_in_its_negative(self) -> None:
        self.assertEqual(token_of("右上の親知らずが痛みます。", "親知らず")["vocab_match"]["entry"]["kanji"], "親知らず")
        self.assertIsNotNone(token_of("相変わらず元気だ。", "相変わらず")["vocab_match"])
        self.assertIsNotNone(token_of("見知らぬ町を歩いた。", "見知らぬ")["vocab_match"])
        # 〜ずにはいられない keeps its ず, 〜にかかわらず its verb, and a pair
        # joins only as an adverb or a word before a noun: 知らず of いざ
        # 知らず and せず of せずして are their points'.
        for sentence, surface in (("そう思わずにはいられない。", "思わ"), ("子どもならいざ知らず、", "知ら"),
                                  ("努力せずして成功した。", "せ")):
            with self.subTest(sentence=sentence):
                self.assertIn(surface, [t["surface"] for t in analysis.analyze_local(sentence)["tokens"]])

    def test_words_the_tokenizer_cut(self) -> None:
        self.assertEqual(card_of("まもなく閉館のお時間となります。", "まもなく"), "vocab_N2_間も無く_まもなく")
        self.assertIn("間", [t["surface"] for t in analysis.analyze_local("休む間もなく働いた。")["tokens"]])
        self.assertEqual(token_of("クマの出没相次ぐ", "相次ぐ")["vocab_match"]["entry"]["kanji"], "相次ぐ")
        self.assertEqual(token_of("川が相次いで氾濫した。", "相次いで")["pos"], "adverb")
        self.assertEqual(token_of("被害が相次いでいる。", "相次い")["pos"], "verb")
        self.assertEqual(token_of("一見もっともらしいが", "もっともらしい")["vocab_match"]["entry"]["kanji"], "尤もらしい")
        self.assertEqual(token_of("お嬢様はもうお休みです。", "お嬢様")["vocab_match"]["entry"]["kanji"], "お嬢様")
        self.assertEqual(token_of("こうした状況を踏まえ、", "こうした")["vocab_match"]["entry"]["kanji"], "斯うした")
        self.assertTrue(gloss_of("本日はどういったご用件でしょうか。", "どういった").startswith("what kind of"))
        self.assertIn("どう", [t["surface"] for t in analysis.analyze_local("で、どうしたら改善できると思う？")["tokens"]])
        # After an amount, a pair ending in ず is its word: 足らず, "a little under".
        self.assertEqual(token_of("１００ドル足らずしか持っていない。", "足らず")["vocab_match"]["entry"]["kanji"], "足らず")
        self.assertEqual(token_of("意外と優しい。", "意外と")["vocab_match"]["entry"]["kanji"], "意外")
        # 名誉ある賞's ある has: the verb, where ある日 is "a certain".
        self.assertEqual(token_of("名誉ある賞を賜った。", "ある")["pos"], "verb")
        self.assertEqual(token_of("ある日、山へ行った。", "ある")["vocab_match"]["entry"]["kanji"], "或る")

    def test_a_suffix_or_counter_in_its_sense_there(self) -> None:
        for sentence, surface, start in (("混雑時には電源をお切りください。", "時", "(suffix) at the time of"),
                                         ("一時1ドル160円台", "台", "(suffix) the … range"),
                                         ("玉ねぎはみじん切りにする。", "切り", "(suffix) cut into"),
                                         ("10連ガチャ回した。", "連", "(counter) in a row"),
                                         ("お箸は何膳おつけしましょうか。", "膳", "(counter) pairs of chopsticks")):
            with self.subTest(sentence=sentence):
                self.assertTrue(gloss_of(sentence, surface).startswith(start))
        # A number's 時 is o'clock, its 台 counts machines.
        self.assertEqual(card_of("三時に会う。", "時"), token_of("三時に会う。", "時")["vocab_match"]["raw_id"])
        self.assertIsNotNone(token_of("車が2台ある。", "台")["vocab_match"])

    def test_readings_in_context(self) -> None:
        for sentence, surface, reading in (("番号札十二番でお待ちのお客様", "札", "ふだ"), ("千円札を出した。", "札", "さつ"),
                                           ("鶏もも肉は一口大に切る。", "鶏", "とり"), ("みじん切りにする。", "切り", "ぎり"),
                                           ("一国の努力だけでは足りない。", "一", "いっ"), ("第2子の保育料", "子", "し"),
                                           ("第一志望でした。", "第一", "だいいち"),
                                           ("興味深い話だ。", "深い", "ぶかい"), ("海は深い。", "深い", "ふかい")):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertEqual(token_of(sentence, surface)["reading"], reading)
        self.assertEqual(card_of("番号札十二番でお待ちください。", "札"), "vocab_N1_札_ふだ")
        # 何時ごろ is the N5 何時 and ごろ, as the course reads it.
        r = analysis.analyze_local("先生は何時ごろお戻りになりますか。")
        self.assertEqual([t["surface"] for t in r["tokens"]][2:4], ["何時", "ごろ"])
        self.assertEqual(r["tokens"][2]["reading"], "なんじ")

    def test_exclamations_and_old_speech(self) -> None:
        for sentence, surface, start in (("へえ、私も映画が好きです。", "へえ", "(surprise, interest)"),
                                         ("え、もう帰る？", "え", "(surprise) eh?"),
                                         ("は？五千円も？", "は", "(surprise or doubt)"),
                                         ("ええい、者ども、出合え！", "ええい", "(exasperation)"),
                                         ("曲者じゃ！", "じゃ", "(old or regional speech) is"),
                                         ("おぬし、なかなかやるのう。", "のう", "(old-fashioned)")):
            with self.subTest(sentence=sentence):
                self.assertTrue(gloss_of(sentence, surface).startswith(start))
        # A え UniDic cut from a page of kana (いまえきついたよ, 駅) says
        # nothing, and 呼んじゃ's じゃ is では said short, no old copula.
        self.assertEqual(gloss_of("いまえきついたよー", "え"), "")
        self.assertFalse(gloss_of("下の名前で呼んじゃ。", "じゃ").startswith("(old"))

    def test_a_time_of_day(self) -> None:
        for sentence, surface, reading in (("営業時間　10:00〜19:00", "10:00", "じゅうじ"),
                                           ("営業時間　10:00〜19:00", "19:00", "じゅうくじ"),
                                           ("会議は9：30から始まる。", "9：30", "くじさんじゅっぷん")):
            with self.subTest(surface=surface):
                token = token_of(sentence, surface)
                self.assertEqual(token["reading"], reading)
                self.assertTrue(token["gloss"]["en"].endswith("(a time of day)"))
        # A ratio is no time: its minutes are no two figures.
        self.assertNotIn("3:2", [t["surface"] for t in analysis.analyze_local("比率は3:2だ。")["tokens"]])

    def test_go_ahead_and(self) -> None:
        # がいい at the end is "go ahead and", and the いい is the word.
        self.assertTrue(gloss_of("ふん、せいぜい足掻くがいい。", "が").startswith("(before いい"))
        self.assertEqual(card_of("ふん、せいぜい足掻くがいい。", "いい"), "vocab_N5__いい/よい")
        self.assertEqual(token_of("楓、こっちにおいで。", "楓")["reading"], "かえで")

    def test_a_noun_that_makes_an_adverb_with_ni(self) -> None:
        self.assertTrue(gloss_of("絶対に負けない。", "に").startswith("makes an adverb of 絶対"))
        self.assertTrue(gloss_of("誠にありがとうございます。", "に").startswith("makes an adverb of 誠"))
        # 真に受ける is an idiom's に, not an adverb's.
        self.assertFalse(gloss_of("真に受けちゃだめだよ。", "に").startswith("makes an adverb"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class LastGapsWordTests(unittest.TestCase):
    """What the gap report still found saying nothing or wrong after the
    third review (plan 272), each with the sentence it must leave alone."""

    def test_a_verb_after_te_that_is_no_te_grammar(self) -> None:
        # UniDic files 出す, 切れる, 渡る as possible auxiliaries; after a て
        # they are the verbs themselves.
        for sentence, surface, raw_id in (("じゃあ、来週までにまとめて出しとくね。", "出し", "vocab_N5_出す_だす"),
                                          ("音を立てて切れた。", "切れ", "vocab_N3_切れる_きれる"),
                                          ("石橋をたたいて渡れ。", "渡れ", "vocab_N5_渡る_わたる")):
            with self.subTest(sentence=sentence):
                self.assertEqual(card_of(sentence, surface), raw_id)
        # ...where 〜てしまう's しまう and 〜てみる's みる stay the points'.
        self.assertIsNone(card_of("食べてしまった。", "しまっ"))
        self.assertIsNone(card_of("見てみる。", "みる"))

    def test_went_and_came_back(self) -> None:
        self.assertEqual(card_of("いってきました。", "いっ"), "vocab_N5_行く_いく")
        self.assertEqual(token_of("いってきます！", "いってきます")["pos"], "interjection")

    def test_such_before_an_adjective(self) -> None:
        self.assertEqual(card_of("あんなひどいことを言った。", "あんな"), "vocab_N4__あんな")

    def test_a_word_the_pool_spells_otherwise(self) -> None:
        for sentence, surface, kanji in (("気合いを入れて頑張れ。", "気合い", "気合"),
                                         ("カラスは、ごみ袋の色を覚える。", "ごみ袋", "ゴミ袋"),
                                         ("私はなまけ者だ。", "なまけ者", "怠け者"),
                                         ("多めに並べる。", "多め", "多目"),
                                         ("膝に青痣ができた。", "青痣", "青あざ")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kanji"], kanji)
        # Other kanji are another word as far as the letters can tell.
        self.assertIsNone(token_of("髪型がくずれる。", "髪型").get("vocab_match"))

    def test_the_senses_of_a_suffix_with_no_row(self) -> None:
        self.assertTrue(gloss_of("十二個入りと二十個入りがございます。", "入り").startswith("(suffix) holding"))
        self.assertTrue(gloss_of("自転車屋なら、この先にありますよ。", "屋").startswith("(suffix) the shop"))
        self.assertTrue(gloss_of("作業員たちは泥まみれになった。", "たち").startswith("(suffix) plural"))
        self.assertTrue(gloss_of("胆のうごと取る。", "ごと").startswith("(suffix) … and all"))
        self.assertTrue(gloss_of("長時間の話し合い。", "長").startswith("(prefix) long"))
        # ...where a card answers already: 子どもたち's 達, 地域ごと's 毎.
        self.assertEqual(token_of("子どもたちは外であそんでいます。", "たち")["vocab_match"]["entry"]["kanji"], "達")
        self.assertEqual(card_of("地域ごとの言葉の違い。", "ごと"), "vocab_N2_毎_ごと")

    def test_so_opening_a_sentence(self) -> None:
        self.assertTrue(gloss_of("一日ならいいよ。で、その日の仕事はどうする？", "で").startswith("(spoken, opening"))

    def test_words_cut_or_joined_against_the_sentence(self) -> None:
        self.assertEqual(card_of("再来月の頭に発売します。", "再来月"), "vocab_N4_さ来月_さらいげつ")
        self.assertEqual(token_of("今週のおしらせです。", "おしらせ")["vocab_match"]["entry"]["kanji"], "お知らせ")
        self.assertIn("お", {t["surface"] for t in analysis.analyze_local("おしらせします。")["tokens"]})
        self.assertEqual(card_of("るすばんをするのをいやがる。", "いやがる"), "vocab_N2_嫌がる_いやがる")
        self.assertEqual(card_of("思いがけない路地に出会った。", "思いがけない"), "vocab_N2_思い掛けない_おもいがけない")
        self.assertEqual(card_of("貧しい家の子が行く所。", "家"), "vocab_N5_家_いえ")
        self.assertEqual(card_of("来月の初めごろに引っ越したい。", "初め"), "vocab_N5_初め_はじめ")
        self.assertEqual(card_of("何線の電車ですか。", "線"), "vocab_N4_線_せん")
        self.assertEqual(card_of("きのうは三時間しかねられなかった。", "ね"), "vocab_N5_寝る_ねる")
        self.assertEqual(card_of("どうしてですか。", "どうして"), "vocab_N5__どうして")
        # A word of ごろ the dictionary holds stays one (見頃, 今頃), and
        # どうしていいか is どう + して.
        self.assertEqual(token_of("桜が見ごろだ。", "見ごろ")["vocab_match"]["entry"]["kanji"], "見頃")
        self.assertEqual(token_of("どうしていいか分からない。", "どう")["pos"], "adverb")
        # A word of ず before its noun after a particle (至らぬ点), never a
        # point's (してはならぬ, 年齢に拘わらず).
        self.assertEqual(token_of("運営に至らぬ点もあった。", "至らぬ")["vocab_match"]["entry"]["kanji"], "至らぬ")
        self.assertNotIn("ならぬ", {t["surface"] for t in analysis.analyze_local("信用してはならぬ。")["tokens"]})

    def test_a_verb_made_a_noun_or_a_form(self) -> None:
        self.assertEqual(card_of("何かお探しですか。", "お探し"), "vocab_N4_探す_さがす")
        self.assertEqual(card_of("葉が川に浮きつ沈みつ流れていった。", "沈み"), "vocab_N3_沈む_しずむ")
        self.assertEqual(card_of("毎日ピアノを習わせられた。", "習わ"), "vocab_N5_習う_ならう")
        self.assertEqual(token_of("この悪循環を断ち切れないものか。", "断ち切れ")["vocab_match"]["entry"]["kanji"], "断ち切る")
        # お休み is the deck's noun.
        self.assertEqual(token_of("お休みですか。", "お休み")["vocab_match"]["entry"]["kanji"], "お休み")

    def test_white_written_in_kana(self) -> None:
        # しろ opening a phrase before a particle is 白; 早くしろ the order.
        for sentence in ("はい。しろとあおがあります。", "すみません。Lは、あおはありません。しろだけです。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(card_of(sentence, "しろ"), "vocab_N5_白_しろ")
        self.assertEqual(token_of("早くしろ。", "しろ")["pos"], "verb")

    def test_never_again_before_a_written_negative(self) -> None:
        for sentence in ("もう二度と、あの店には行くまい。", "あんな店に、二度と行くものか。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, "二度と")["vocab_match"]["entry"]["kanji"], "二度と")

    def test_names_and_partners(self) -> None:
        self.assertEqual(gloss_of("大家の山田に言ってください。", "山田"), "family name")
        self.assertEqual(card_of("車にひかれるところだった。", "ひか"), "vocab_N3_轢く_ひく")
        self.assertEqual(card_of("親としてうそはつけない。", "つけ"), "vocab_N1_吐く_つく")
        self.assertEqual(card_of("じゃあ、赤をはいてもいいですか。", "はい"), "vocab_N3_履く_はく")
        # テレビをつけない is つける.
        self.assertNotEqual(card_of("テレビをつけない。", "つけ"), "vocab_N1_吐く_つく")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class FourthReviewWordTests(unittest.TestCase):
    """What a fourth review of 160 fresh lines -- notices, chats, Kansai
    speech, sport, news, stories -- found read wrong, cut or silent (plan
    272), each with the sentence it must leave alone."""

    def test_a_dates_weekday_and_figures(self) -> None:
        token = token_of("10月15日（木）は休みです。", "木")
        self.assertEqual((token["reading"], card_of("10月15日（木）は休みです。", "木")),
                         ("もく", "vocab_N5_木曜日_もくようび"))
        self.assertEqual(card_of("木の下で休む。", "木"), "vocab_N5_木_き")
        for sentence, surface, reading in (("17日に会おう。", "17", "じゅうしち"),
                                           ("19日です。", "19", "じゅうく"),
                                           ("27日は雨です。", "27", "にじゅうしち"),
                                           ("11日です。", "11", "じゅういち"),
                                           ("4球目を打った。", "4球目", "よんきゅうめ"),
                                           ("何しやがる！", "何", "なに"),
                                           ("フォロワー1000人を超えた。", "1000", "せん")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["reading"], reading)

    def test_words_the_tokenizer_cuts(self) -> None:
        for sentence, surface, kanji in (("父上、お元気ですか。", "父上", "父上"),
                                         ("機会そのものがない。", "そのもの", "その物"),
                                         ("こっちにおいで。", "おいで", "お出で"),
                                         ("はっぱが落ちた。", "はっぱ", "葉っぱ"),
                                         ("通行止めです。", "通行止め", "通行止め"),
                                         ("はよ帰りたい。", "はよ", "早よ"),
                                         ("そんなのありえん。", "ありえん", "あり得ない"),
                                         ("ありえへん！", "ありえへん", "あり得ない")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kanji"], kanji)
        self.assertEqual(token_of("いいプレーだった。", "プレー")["vocab_match"]["entry"]["kana"], "プレイ")
        self.assertEqual(token_of("それとも行かない？", "それとも")["pos"], "conjunction")
        self.assertEqual(card_of("上下線とも運転を見合わせています。", "とも"), "vocab_N1_共_とも")
        self.assertEqual(token_of("ｗｗｗ草生える", "草")["reading"], "くさ")
        # A verb before て is the verb (外出して, 勇気づけて); おいでください
        # keeps お〜ください's お; a name's long vowel and a clipped word are
        # no other loanword (グレース, ホラゲー's ゲー).
        self.assertEqual(card_of("外出してもさしつかえありません。", "外出"), "vocab_N3_外出_がいしゅつ")
        self.assertIsNone(next((t for t in analysis.analyze_local("勇気づけてやれば話すでしょう。")["tokens"]
                                if t["surface"] == "勇気づけ"), None))
        self.assertEqual(token_of("火曜日においでください。", "お")["pos"], "prefix")
        self.assertEqual(gloss_of("グレースは電話のところへ行く。", "グレース"), "a person's name")
        self.assertIsNone(token_of("今日はホラゲーやってくんですけど", "ゲー").get("vocab_match"))
        self.assertEqual(token_of("正直にやっていると割に合わない。", "割に合わ")["vocab_match"]["entry"]["kanji"], "割に合う")
        # 両親とも話した is と and も, "with my parents too".
        self.assertIn("と", {t["surface"] for t in analysis.analyze_local("両親とも話した。")["tokens"]})

    def test_kansai_speech(self) -> None:
        for sentence, surface in (("それはあかん。", "あかん"), ("あかんで。", "あかん"), ("まじつらたん。", "つらたん")):
            with self.subTest(sentence=sentence):
                self.assertIsNotNone(token_of(sentence, surface).get("vocab_match"))
        self.assertTrue(gloss_of("美味しいやん。", "やん").startswith("(Kansai) isn't it"))
        self.assertTrue(gloss_of("なんでやねん。", "や").startswith("(Kansai) is"))
        self.assertTrue(gloss_of("なんでやねん。", "ねん").startswith("(Kansai) explains"))
        self.assertEqual(gloss_of("祖父はいつも何やかやぶつぶつ不平を言っていた。", "や"), "")
        self.assertEqual(token_of("聞いてへん。", "へん")["pos"], "auxiliary")
        # A door that will not open takes が; the rain that stopped is 止む.
        self.assertEqual(card_of("ドアがあかん。", "あか"), "vocab_N5_開く_あく")
        self.assertEqual(card_of("雨がやんだ。", "やん"), "vocab_N4_止む_やむ")

    def test_names_and_notices(self) -> None:
        self.assertEqual(gloss_of("高尾行きの電車です。", "高尾"), "place name")
        self.assertTrue(gloss_of("料金は口座より引き落とされます。", "より").startswith("(formal) from"))
        self.assertTrue(gloss_of("本日より、営業時間が変わります。", "より").startswith("(formal) from"))
        self.assertEqual(gloss_of("東京より大阪のほうが好きだ。", "より"), "")
        self.assertTrue(gloss_of("田中より折り返しお電話をさしあげます。", "より").startswith("(formal) from"))
        self.assertTrue(gloss_of("心よりおわび申し上げます。", "より").startswith("(formal) from"))
        # ...and "than" after a year or a verb, whatever follows.
        for sentence in ("ボーナスは去年より増えるだろう。", "運転するより作るほうがおもしろい。", "機会が前より増えた。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(gloss_of(sentence, "より"), "")
        self.assertTrue(gloss_of("体育館にて行います。", "にて").startswith("(formal) at"))
        self.assertTrue(gloss_of("誠に勝手ながら、休業とさせていただきます。", "ながら").startswith("(after a quality)"))
        self.assertTrue(gloss_of("誠に勝手ながら、休業とさせていただきます。", "と").startswith("(before する"))
        self.assertTrue(gloss_of("何しやがる！", "やがる").startswith("(rude)"))
        self.assertTrue(gloss_of("もう少しで勝てた。", "で").startswith("(after もう少し)"))
        self.assertTrue(gloss_of("お忙しいところすみません。", "ところ").startswith("(set phrase)"))
        self.assertIsNone(card_of("お忙しいところすみません。", "ところ"))
        self.assertEqual(card_of("静かなところに住みたい。", "ところ"), "vocab_N5_所_ところ")

    def test_affixes(self) -> None:
        self.assertTrue(gloss_of("500円超の商品は送料無料です。", "超").startswith("(after a number) over"))
        self.assertTrue(gloss_of("連絡先を教えてください。", "先").startswith("(suffix) where or to whom"))
        self.assertEqual(card_of("この先は危ない。", "先"), "vocab_N5_先_さき")
        # 十年先, 一ヶ月先: ahead in time, the card's.
        self.assertEqual(card_of("十年先は見通せない。", "先"), "vocab_N5_先_さき")
        self.assertEqual(card_of("１ヶ月先まで満席です。", "先"), "vocab_N5_先_さき")

    def test_a_kana_verb_by_who_or_what(self) -> None:
        self.assertEqual(card_of("昔、おばあさんがすんでいました。", "すん"), "vocab_N5_住む_すむ")
        self.assertEqual(card_of("油をひいて焼きます。", "ひい"), "vocab_N5_引く_ひく")
        self.assertNotEqual(card_of("ピアノをひいて歌う。", "ひい"), "vocab_N5_引く_ひく")

    def test_spoken_endings(self) -> None:
        self.assertTrue(gloss_of("なんぼするん？", "ん").startswith("(spoken) の said short"))
        self.assertTrue(gloss_of("行かん。", "ん").startswith("not"))
        self.assertTrue(gloss_of("何と言われようが、私は行く。", "が").startswith("(after the volitional)"))
        self.assertFalse(gloss_of("見りゃ分かるだろうが！", "が").startswith("(after the volitional)"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class FifthReviewWordTests(unittest.TestCase):
    """What a fifth review of 160 fresh lines -- chats, comments, notices,
    recipes, sport, samurai and dialect speech -- found read wrong, cut
    or silent (plan 272), each with the sentence it must leave alone."""

    def test_latin_letters_and_units(self) -> None:
        for sentence, surface, reading, kanji in (("SNS上でやりとりされる。", "SNS", "えすえぬえす", "ＳＮＳ"),
                                                  ("AIが下書きを書く。", "AI", "えいあい", "ＡＩ"),
                                                  ("BGMのセンスが良い。", "BGM", "びいじいえむ", "ＢＧＭ"),
                                                  ("青いTシャツを着た。", "Tシャツ", None, "Ｔシャツ"),
                                                  ("Uターンラッシュは15日がピークです。", "Uターンラッシュ", None, "Ｕターンラッシュ")):
            with self.subTest(sentence=sentence):
                token = token_of(sentence, surface)
                self.assertEqual(token["vocab_match"]["entry"]["kanji"], kanji)
                if reading:
                    self.assertEqual(token["reading"], reading)
        for sentence, surface, reading, gloss in (("電子レンジ（600W）で2分加熱する。", "W", "わっと", "watt"),
                                                  ("だし汁400mlに加えます。", "ml", "みりりっとる", "millilitre"),
                                                  ("身長158cmです。", "cm", "せんち", "centimetre"),
                                                  ("上限（25MB）を超えている。", "MB", "めがばいと", "megabyte"),
                                                  ("普段はMですが、ワンサイズ上のLにした。", "M", "えむ", "size M"),
                                                  ("この動画のおかげでN3に受かりました！", "N3", "えぬさん", "the JLPT's level N3")):
            with self.subTest(sentence=sentence):
                token = token_of(sentence, surface)
                self.assertEqual(token["reading"], reading)
                self.assertTrue(token["gloss"]["en"].startswith(gloss))
        self.assertEqual(token_of("電子レンジ（600W）で加熱する。", "600")["reading"], "ろっぴゃく")
        # One letter alone is no word; laughter typed as w is no name.
        self.assertIsNone(token_of("Aランチを注文した。", "A").get("vocab_match"))
        self.assertNotEqual(gloss_of("ウケるwww てかなんで", "www"), "a person's name")

    def test_scores_fractions_and_figures(self) -> None:
        self.assertEqual(token_of("第2セットは26-24で奪った。", "26-24")["reading"], "にじゅうろくたいにじゅうよん")
        self.assertEqual(token_of("薄口しょうゆ大さじ1と1/2を加える。", "1/2")["reading"], "にぶんのいち")
        # A date and a phone number are neither.
        self.assertTrue(gloss_of("12/18（金）に提出。", "12/18").startswith("December 18"))
        self.assertNotIn("03-1234", {t["surface"] for t in analysis.analyze_local("電話は03-1234-5678です。")["tokens"]})
        for sentence, surface, reading in (("目薬は1回1滴です。", "1", "いっ"),
                                           ("提出期限：12月18日です。", "12", "じゅうに"),
                                           ("第2・第4水曜です。", "2", "に"),
                                           ("今季10勝目を挙げました。", "10勝目", "じゅっしょうめ")):
            with self.subTest(sentence=sentence):
                self.assertEqual([t["reading"] for t in analysis.analyze_local(sentence)["tokens"]
                                  if t["surface"] == surface][-1], reading)

    def test_a_card_by_what_the_sentence_says(self) -> None:
        self.assertIn("キロメートル", token_of("8キロの渋滞です。", "キロ")["vocab_match"]["entry"]["kana"])
        self.assertIn("キログラム", token_of("体重が3キロ増えた。", "キロ")["vocab_match"]["entry"]["kana"])
        self.assertEqual(gloss_of("大井から有明まで渋滞です。", "大井"), "place name")
        for sentence, surface, kanji in (("あおい そらを とぶ。", "そら", "空"),
                                         ("うさぎと かめの きょうそう。", "かめ", "亀"),
                                         ("約束どおり昼メシおごれよな。", "おごれ", "奢る"),
                                         ("いっぺん食べてみらんね。", "いっぺん", "一遍"),
                                         ("しかと聞き届けた。", "しかと", "確と"),
                                         ("サビの部分が好き。", "サビ", ""),
                                         ("「あした、はれると いいなあ」", "はれる", "晴れる"),
                                         ("またテレビつけっぱなしで寝てる。", "つけ", "付ける"),
                                         ("セールで30％オフです。", "オフ", "ＯＦＦ")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kanji"], kanji)
        # A katakana word reaches a kanji card only as its own lemma.
        self.assertEqual(card_of("オレの勝ちだ。", "オレ"), "vocab_N1_俺_おれ")
        self.assertNotEqual(card_of("犬がワンと鳴いた。", "ワン"), "vocab_N3_湾_わん")
        self.assertEqual(card_of("錆びた鉄、サビがひどい。", "サビ"), "vocab_N2_錆_さび")

    def test_readings_by_context(self) -> None:
        for sentence, surface, reading in (("東北道下りは渋滞しています。", "道", "どう"),
                                           ("東北道下りは渋滞しています。", "下り", "くだり"),
                                           ("米2合を研ぐ。", "米", "こめ"),
                                           ("行き先は風に聞けばいい", "風", "かぜ"),
                                           ("ワンサイズ上のLにした。", "上", "うえ"),
                                           ("家老殿に叱られる。", "殿", "どの"),
                                           ("なんで知ってんの笑", "笑", "わら")):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertEqual(token_of(sentence, surface)["reading"], reading)
        self.assertEqual(token_of("坂道を下りて駅へ行く。", "下り")["reading"], "おり")
        self.assertEqual(token_of("日米の首脳が会談した。", "日米")["reading"], "にちべい")

    def test_words_cut_apart(self) -> None:
        for sentence, surface, kanji in (("先ほどお送りしたメール。", "先ほど", "先程"),
                                         ("何ら問題はない。", "何ら", "何ら"),
                                         ("てるてるぼうずが つぶやきました。", "てるてるぼうず", "てるてる坊主"),
                                         ("ゆきだるまの はなし。", "ゆきだるま", "雪だるま"),
                                         ("今宵の月は、ことのほか美しい。", "ことのほか", "殊の外"),
                                         ("御社のご発展をお祈りいたします。", "御社", "御社"),
                                         ("上様のご命令とあらば。", "上様", "上様"),
                                         ("例の店、今日行かない？", "例の", "例の"),
                                         ("くつしたの かたっぽが ないて いました。", "かたっぽ", "片っぽ")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kanji"], kanji)
        self.assertEqual(token_of("ツーアウト満塁から。", "ツーアウト")["vocab_match"]["entry"]["kana"], "ツーアウト")
        self.assertEqual(token_of("本日はタイムサービスを行います。", "タイムサービス")["vocab_match"]["entry"]["kana"],
                         "タイムサービス")
        # ...where two deck words say the pair, they stay two (チーズ, ケーキ), as
        # 追 of 追体験 stays a prefix, glossed, before the deck's 体験.
        self.assertIn("ケーキ", {t["surface"] for t in analysis.analyze_local("チーズケーキを食べた。")["tokens"]})
        self.assertTrue(gloss_of("他人の人生を追体験する。", "追").startswith("(prefix) after"))
        self.assertEqual(gloss_of("ゆきおくんは、はるが すき。", "ゆきお"), "given name")
        self.assertEqual(card_of("ゆきおくんは、はるが すき。", "はる"), "vocab_N5_春_はる")
        # 何らか is "some"; そのことのほかに is こと, の and ほか.
        self.assertNotIn("何ら", {t["surface"] for t in analysis.analyze_local("何らかの理由で遅れた。")["tokens"]})
        self.assertNotIn("ことのほか", {t["surface"] for t in analysis.analyze_local("そのことのほかに問題がある。")["tokens"]})

    def test_net_slang_and_speech(self) -> None:
        for sentence, surface, kana in (("寝坊した…おわた", "おわた", "オワタ"),
                                        ("おけまる〜！じゃ7時に", "おけまる〜", "おけまる"),
                                        ("即ポチりました。", "ポチり", "ポチる"),
                                        ("いいね押してってくれ", "いいね", "いいね"),
                                        ("りょ！駅着いたら", "りょ", "りょ")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kana"], kana)
        self.assertIn("〜ておく", {g["pattern"] for t in analysis.analyze_local("今のうちに取り込んどこうか。")["tokens"]
                                  if t["surface"] == "どこう" for g in t.get("grammar") or []})
        for sentence, surface, gloss in (("なーんだ、そういうことか。", "なーんだ", "(spoken) oh, is that all"),
                                         ("それマジ？ウケるwww", "ウケる", "(slang) that's hilarious"),
                                         ("なんで知ってんの笑", "笑", "(net slang) lol"),
                                         ("2:15で後ろの猫があくびしてて草", "草", "(net slang) lol"),
                                         ("お留守だったんで、ポストに入れました。", "んで", "(spoken) ので said short")):
            with self.subTest(sentence=sentence):
                self.assertTrue(gloss_of(sentence, surface).startswith(gloss), gloss_of(sentence, surface))
        self.assertEqual(token_of("眠すぎてしぬ", "しぬ")["vocab_match"]["entry"]["kanji"], "死ぬ")
        self.assertEqual(token_of("それマジ？ウケるwww てかなんで", "てか")["pos"], "conjunction")
        # 庭の草 is grass.
        self.assertEqual(card_of("庭の草", "草"), "vocab_N4_草_くさ")

    def test_old_speech_and_dialect(self) -> None:
        for sentence, surface, gloss in (("美しゅうござるな。", "ござる", "(old speech) to be"),
                                         ("それがしがお供つかまつる。", "それがし", "(old speech) I, me"),
                                         ("必ずや果たしてみせようぞ。", "や", "(old, emphatic)"),
                                         ("まずは飯じゃ、飯！", "じゃ", "(old or regional speech) is"),
                                         ("家老殿に叱られる。", "殿", "(after a name or a title"),
                                         ("わしゃもう知らんけえね。", "けえ", "(Hiroshima, Okayama) so"),
                                         ("ほいじゃけえ、言うたじゃろうが。", "ほいじゃけえ", "(Hiroshima) so"),
                                         ("ばりうまかけん、食べてみ。", "けん", "(western Japan, Kyūshū) so"),
                                         ("先生にどえりゃあ怒られる。", "どえりゃあ", "(Nagoya) terribly"),
                                         ("怒られてまうがね。", "がね", "(Nagoya)"),
                                         ("いぎなりうめえっちゃ。", "いぎなり", "(Sendai) very"),
                                         ("もう一個食べっぺ。", "っぺ", "(Kantō, Tōhoku)"),
                                         ("おばんです。", "おばんです", "(Tōhoku, Hokkaidō) good evening")):
            with self.subTest(sentence=sentence):
                self.assertTrue(gloss_of(sentence, surface).startswith(gloss), gloss_of(sentence, surface))
        self.assertEqual(token_of("必ずや果たしてみせようぞ。", "果たし")["vocab_match"]["entry"]["kanji"], "果たす")
        self.assertEqual(token_of("果たして本当だろうか。", "果たして")["pos"], "adverb")
        self.assertEqual(token_of("今年は寒い。", "今年")["reading"], "ことし")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class SixthReviewWordTests(unittest.TestCase):
    """What a sixth review of 160 mainstream lines found read wrong, cut
    or silent (plan 272), each with the sentence it must leave alone."""

    def test_a_card_by_what_the_sentence_says(self) -> None:
        for sentence, surface, kanji in (("ほんをよむのがすきです。", "ほん", "本"),
                                         ("昨日のラーメンのせいってことにしとく笑", "せい", "所為"),
                                         ("全員、配置につけ！", "つけ", "就く"),
                                         ("事業に優先順位をつけざるを得ない。", "つけ", "付ける"),
                                         ("最終バスの窓に 額をつけて", "つけ", "付ける"),
                                         ("待って #猫のいる暮らし", "いる", "居る"),
                                         ("もうちょっとおってや。", "おっ", "居る"),
                                         ("「はやく ぬいて」と いって いる", "ぬい", "抜く"),
                                         ("くつを ぬいで ください。", "ぬい", "脱ぐ"),
                                         ("田中ともうします。", "もうし", "申す"),
                                         ("まだ三日坊主になってない。", "三日坊主", "三日坊主"),
                                         ("一石二鳥だね。", "一石二鳥", "一石二鳥"),
                                         ("不登校だった小中学生は多い。", "小中学生", "小中学生"),
                                         ("11月3日（火・祝）は休みます。", "火", "火曜日")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kanji"], kanji)
        # インコ is the row JMdict keeps in hiragana.
        self.assertEqual(token_of("迷子のインコを探しています。", "インコ")["vocab_match"]["entry"]["kana"], "いんこ")
        # 宿題やんなよ is やる; ええやん the west's いい and its "isn't it!".
        self.assertEqual(token_of("宿題やんなよ。", "やん")["vocab_match"]["entry"]["kana"], "やる")
        self.assertEqual(token_of("まだええやん、もうちょっとおってや。", "ええ")["pos"], "adjective")
        self.assertTrue(gloss_of("まだええやん、もうちょっとおってや。", "やん").startswith("(Kansai) isn't it!"))
        # ほんで stays the west's それで; 観光客 its two deck words.
        self.assertNotEqual((token_of("ほんで、どないしたん？", "ほんで").get("vocab_match") or {}).get("entry", {}).get("kanji"), "本")
        self.assertEqual([t["surface"] for t in analysis.analyze_local("観光客が多い。")["tokens"]][:2], ["観光", "客"])
        # A four-kanji compound its cards say stays its cards: 自由貿易 is
        # "free trade".
        self.assertIn("貿易", [t["surface"] for t in analysis.analyze_local("自由貿易への障害になる。")["tokens"]])

    def test_readings(self) -> None:
        for sentence, surface, reading in (("すいません、これ、試着してもいいですか？", "すいません", "すいません"),
                                           ("何言っても「うざい」しか返ってこないの。", "何", "なに"),
                                           ("おじいちゃんの七回忌だから空けといてね。", "七", "しち"),
                                           ("いつの間に変わったんだろう。", "間", "ま"),
                                           ("以下の候補日からお知らせください。", "日", "び"),
                                           ("雨の日は家にいる。", "日", "ひ"),
                                           ("最終バスの窓に 額をつけて", "額", "ひたい"),
                                           ("額に入れて飾る。", "額", "がく"),
                                           ("目黒区周辺で見かけた方はDMください", "方", "かた"),
                                           ("早く寝た方がいい。", "方", "ほう"),
                                           ("11月3日（火・祝）は休みます。", "火", "か"),
                                           ("何と言った？", "何", "なん")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["reading"], reading)
        # A number's reading stays on it when a compound before it is cut:
        # 約35万人's reading is 35万's, the comma's none.
        tokens = analysis.analyze_local("小中学生は約35万人で、11年連続で過去最多となりました。")["tokens"]
        self.assertEqual(next(t for t in tokens if t["surface"] == "35万")["reading"], "さんじゅうごまん")
        self.assertEqual(next(t for t in tokens if t["surface"] == "11")["reading"], "じゅういち")
        self.assertEqual(next(t for t in tokens if t["surface"] == "、")["reading"], "、")

    def test_glosses(self) -> None:
        for sentence, surface, gloss in (("ふっふっふ、よくぞここまで。", "ふっふっふ", "(a laugh)"),
                                         ("おう、リン！", "おう", "(rough, mostly men) hey!"),
                                         ("お会計、別々でもいいですか？…あ、じゃあカードで。", "あ", "ah!, oh!"),
                                         ("はわわ、ど、どうしましょう", "ど", "(a stammer)"),
                                         ("遠慮なくお申し付けくださいませ。", "ませ", "(after ください"),
                                         ("なんていうか…言いにくい。", "て", "(spoken, = と) quotes"),
                                         ("盗んだとして、少年を逮捕しました。", "て", "(と + して, after a clause)"),
                                         ("うちの子、最近反抗期でさ、何言っても。", "で", "is ..., and"),
                                         ("それって、つまり。", "って", "(spoken) as for"),
                                         ("ほんで、どないしたん？", "ん", "(at the end) explains"),
                                         ("それは聞き捨てならんな。", "ん", "not: the negative")):
            with self.subTest(sentence=sentence):
                self.assertTrue(gloss_of(sentence, surface).startswith(gloss), gloss_of(sentence, surface))
        for sentence, surface, gloss in (("お前一人で進むしかないと。", "と", "(at the end) the rest left unsaid"),
                                         ("とどまるものではあるまい。", "で", "(with は or も, then ある or ない) is"),
                                         ("とどまるものではあるまい。", "は", "(between で and ある or ない)"),
                                         ("信頼を取り戻すには、行動で示すほかない。", "に", "(after a verb, before は) for, to"),
                                         ("言葉を尽くすよりも行動で示す。", "も", "(after より) stresses"),
                                         ("もうちょっとおってや。", "や", "(Kansai, at the end) = よ"),
                                         ("この MV、何回見ても泣く。", "MV", "a music video"),
                                         ("最新バージョン（ver.3.2）です。", "ver", "version")):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertTrue(gloss_of(sentence, surface).startswith(gloss), gloss_of(sentence, surface))
        # An ending said short is no name: なってんの's てん.
        self.assertNotIn("name", gloss_of("この猫ちゃんの寝相どうなってんのｗｗ", "てん"))

    def test_words_put_together_and_apart(self) -> None:
        for sentence, surface, kanji in (("いやー、久しぶりだね。", "久しぶり", "久しぶり"),
                                         ("朝活はじめて1週間。", "朝活", "朝活"),
                                         ("無料Wi-Fiのパスワード。", "Wi-Fi", "Ｗｉ-Ｆｉ"),
                                         ("みんな変わってなさすぎてエモかった。", "エモかっ", "")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kanji"], kanji)
        self.assertEqual(token_of("無料Wi-Fiのパスワード。", "Wi-Fi")["reading"], "わいふぁい")
        # 背伸びた is 背 and 伸びる; 背伸びして, "on tiptoe", one word.
        self.assertEqual(token_of("ちょっと見ないうちに背伸びたんじゃねえか？", "伸び")["vocab_match"]["entry"]["kanji"], "伸びる")
        self.assertEqual(token_of("子供が背伸びして棚を見る。", "背伸び")["vocab_match"]["entry"]["kanji"], "背伸び")
        # なさすぎ is ない's stem, no 為す.
        self.assertEqual(token_of("やることがなさすぎて暇だ。", "なさ")["vocab_match"]["entry"]["kana"], "ない")
        # A picture book's animal is named, with an honorific or none; its
        # nose is its nose.
        for sentence, surface in (("いぬの ぽちが しっぽを ふって", "ぽち"), ("ねこの みいちゃんは ねて いる", "みい"),
                                  ("ふくろうの ほうほうさんが めを さます", "ほうほう")):
            with self.subTest(sentence=sentence):
                self.assertEqual(gloss_of(sentence, surface), "given name")
        self.assertEqual(token_of("いぬの はなが いい。", "はな")["vocab_match"]["entry"]["kanji"], "鼻")
        # Words the tokenizer cut in two, and the same letters where they
        # are two.
        for sentence, surface, kana in (("この前はおすそ分けありがとう。", "この前", "このまえ"),
                                        ("お兄ちゃん、ゲームばっかしてないで。", "お兄ちゃん", "おにいちゃん"),
                                        ("宝箱を開けた！なんと、剣を手に入れた！", "なんと", "なんと"),
                                        ("よくぞここまでたどり着いたな。", "よくぞ", "よくぞ"),
                                        ("編集どんだけ時間かかってんの？", "どんだけ", "どんだけ"),
                                        ("暮らし方そのものが変わった。", "そのもの", "そのもの"),
                                        ("約200品目を値上げする。", "品目", "ひんもく")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kana"], kana)
        self.assertEqual([t["surface"] for t in analysis.analyze_local("この前に立つ。")["tokens"]][:2], ["この", "前"])
        self.assertIn("よく", [t["surface"] for t in analysis.analyze_local("よく寝たぞ。")["tokens"]])
        self.assertEqual(token_of("ありさんたちは ならんで", "あり")["vocab_match"]["entry"]["kanji"], "蟻")
        self.assertEqual(token_of("今度なんかおごらしてな。", "おごら")["vocab_match"]["entry"]["kanji"], "奢る")
        self.assertTrue(gloss_of("早く願い事しろって！", "って").startswith("(after an order, at the end)"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class SeventhReviewWordTests(unittest.TestCase):
    """What a seventh review of 160 lines, most as a textbook writes them,
    found read wrong, cut or silent (plan 272), each with the sentence it
    must leave alone."""

    def test_cards_and_readings(self) -> None:
        for sentence, surface, reading in (("電池は＋と－の向きを確かめて、正しく入れてください。", "正しく", "ただしく"),
                                           ("電池は＋と－の向きを確かめて", "－", "まいなす"),
                                           ("私は辛い食べ物があまり好きじゃありません。", "辛い", "からい"),
                                           ("別れは辛い。", "辛い", "つらい"),
                                           ("財布家に忘れてきちゃった。", "家", "いえ"),
                                           ("一日の歩数が200歩とかで震える", "歩", "ぽ"),
                                           ("一日の歩数が200歩とかで震える", "200", "にひゃっ")):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertEqual(token_of(sentence, surface)["reading"], reading)
        self.assertEqual(token_of("これはまさしく彼の字だ。", "まさしく")["reading"], "まさしく")
        self.assertEqual(token_of("3－2で勝った。", "3－2")["reading"], "さんたいに")
        self.assertEqual(card_of("私は辛い食べ物があまり好きじゃありません。", "辛い"), "vocab_N5_辛い_からい")
        for sentence, surface, kanji in (("ちょっとお金貸してくんない？", "お金", "お金"),
                                         ("ちょっとお金貸してくんない？", "貸し", "貸す"),
                                         ("新人3人が立候補を表明した。", "候補", "候補"),
                                         # (the noun 家 only where noun + 家 is no word)
                                         ("６人の女性芸術家について議論している。", "芸術家", "芸術家"),
                                         ("作家になりたい。", "作家", "作家"),
                                         ("#推し活", "推し活", "推し活"),
                                         ("時間があっという間に過ぎます。", "あっという間", "あっという間"),
                                         ("時間が早く感じられるようになった。", "感じ", "感じる"),
                                         ("気ぃつけて帰りや。", "つけ", "付ける"),
                                         ("気ぃつけて帰りや。", "帰り", "帰る"),
                                         ("このオレには傷一つつけられないぜ。", "つけ", "付ける"),
                                         ("ご住所とお電話番号を伺っても", "お", "御")):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kanji"], kanji)
        # The hearsay's そう and the look's are the point's, no "like that";
        # そうですね is "that's right".
        self.assertIsNone(token_of("味がずいぶん違うそうです。", "そう").get("vocab_match"))
        self.assertIsNone(token_of("雨が降りそうだ。", "そう").get("vocab_match"))
        self.assertIsNotNone(token_of("そうですね。", "そう").get("vocab_match"))
        self.assertEqual(token_of("音楽家になりたい。", "音楽家")["vocab_match"]["entry"]["kanji"], "音楽家")
        # 立 of 立候補 stays a prefix, glossed, before the deck's 候補.
        self.assertTrue(token_of("新人3人が立候補を表明した。", "立")["gloss"]["en"].startswith("(prefix) standing"))

    def test_glosses(self) -> None:
        for sentence, surface, gloss in (("あれ、今日って何曜日だっけ？", "あれ", "huh?"),
                                         ("健二のやつ、また寝坊したんだって。ほんと懲りないよね。", "って", "(sentence end) they say"),
                                         ("その傘、あんたのとちゃうやろ？", "やろ", "(Kansai) = だろう"),
                                         ("気ぃつけて帰りや。", "や", "(Kansai, after a verb's stem)"),
                                         ("なんでやねん、そんなん聞いてへんわ。", "そんなん", "(Kansai, casual) = そんなの"),
                                         ("なんでやねん、そんなん聞いてへんわ。", "て", "(before へん) = ている"),
                                         ("あかん、もう歩かれへん。", "れ", "(the west, before へん) can"),
                                         ("ほんまに？それめっちゃおもろいやん。", "ほんまに", "(Kansai) really"),
                                         ("満員電車で足を踏まれたのに、相手は謝りもしなかった。", "も",
                                          "(between a verb's stem and しない) not even")):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertTrue(gloss_of(sentence, surface).startswith(gloss), gloss_of(sentence, surface))
        self.assertIsNotNone(token_of("あれは何ですか。", "あれ").get("vocab_match"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class SeventhReviewLeftWordTests(unittest.TestCase):
    """What the seventh review found that its first batch left read
    wrong (plan 272), each with the sentence it must leave alone."""

    def test_cards(self) -> None:
        self.assertEqual(token_of("先日お借りした資料を、本日お返しに参りました。", "お返し")["vocab_match"]["entry"]["kanji"],
                         "返す")
        self.assertNotEqual(token_of("お返しにクッキーをもらった。", "お返し")["vocab_match"]["entry"]["kanji"], "返す")
        # ケンタ called to may be Kenta: both are named, never a guess.
        self.assertTrue(token_of("安心しろ、ケンタ。", "ケンタ")["vocab_match"]["entry"]["meaning"].startswith(
            "a person's name, or:"))
        self.assertFalse(token_of("ケンタで食べた。", "ケンタ")["vocab_match"]["entry"]["meaning"].startswith(
            "a person's name"))

    def test_glosses(self) -> None:
        for sentence, surface, gloss in (("論文に間に合うかどうか、正直なところ自信がない。", "ところ",
                                          "(set phrase) the truth of it"),
                                         ("実のところ、知らない。", "ところ", "(set phrase) the truth of it"),
                                         ("泣きたい夜は 空を見上げて 星の数だけ 君を呼ぶよ", "だけ", "(after 数) as many as"),
                                         ("「タケシ、まだ起きてる？」「ああ、なんか眠れなくてさ。」", "ああ", "(answering) yeah")):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertTrue(gloss_of(sentence, surface).startswith(gloss), gloss_of(sentence, surface))
                self.assertIsNone(token_of(sentence, surface).get("vocab_match"))
        # ああ exclaimed keeps its card; ところ of a place, its own.
        self.assertIsNotNone(token_of("ああ、美しい。", "ああ").get("vocab_match"))
        self.assertIsNotNone(token_of("静かなところに住みたい。", "ところ").get("vocab_match"))
