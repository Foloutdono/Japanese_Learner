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
        # And before a card the deck holds: 副課長 is 副 and 課長 (plan 272),
        # where the dictionary has no 副課長 -- 副社長 it has, and that is one
        # word, "vice-president", 社長 kept as its part (plan 280).
        found = matches("課長は来ないで代わりに副課長をよこした。")
        self.assertIn("associate", found["副"]["entry"]["meaning"])
        self.assertEqual(found["課長"]["raw_id"], "vocab_N4_課長_かちょう")
        whole = token_of("社長は来ないで代わりに副社長をよこした。", "副社長")
        self.assertIn("vice-president", whole["vocab_match"]["entry"]["meaning"])
        self.assertEqual([p["surface"] for p in whole["parts"]], ["副", "社長"])
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

    def test_an_aside_leaves_room_for_the_next_sense(self) -> None:
        # (plan 272) 段差 at a station is a step, JMdict's second sense:
        # its first's "(e.g. in go, shoji, etc.)" is the entry's to give
        meaning = matches("段差があります。足元にご注意ください。")["段差"]["entry"]["meaning"]
        self.assertEqual(meaning, "difference in grades; difference in level")
        # ...and a word of one sense shows its second gloss where it fits
        meaning = matches("新しい勤怠システムは来月から導入される。")["勤怠"]["entry"]["meaning"]
        self.assertIn("attendance", meaning)
        self.assertLessEqual(len(meaning), card_lookup._POOL_GLOSS_MAX)


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
            ("かべにくぎをうった。", "うっ", "vocab_N4_打つ_うつ"),
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
        # 272): the verb's partner, the neighbours of a kana noun -- and
        # what a kana adjective is said of (plan 306).
        for sentence in _corpus()[::7]:
            morphemes = morphology.tokenize(sentence)
            for i, m in enumerate(morphemes):
                before = card_lookup._resolve_morpheme(morphemes, i)
                after = card_lookup.resolve_morpheme(morphemes, i)
                nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
                beside = card_lookup._by_neighbours(morphemes, i, before)
                noun = card_lookup._kana_noun(morphemes, i, beside)
                named = (card_lookup._by_partner(morphemes, i, card_lookup._deck_verbs_spelled(m, nxt)),
                         beside, noun, card_lookup._kana_adjective(morphemes, i, noun))
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
        # (n.º 3: 3.º or 3.ª would give the song a gender, plan 302)
        self.assertTrue(token["gloss"]["es"].startswith("n.º 3 · "))

    def test_a_number_and_its_counter_stay_two_words(self) -> None:
        tokens = [t["surface"] for t in analysis.analyze_local("この一回のテイクで")["tokens"]]
        self.assertEqual(tokens[1:3], ["一", "回"])

    def test_an_age_written_in_kana_is_no_hatachi(self) -> None:
        # 二十 + さい spells 二十歳's lemmas, but the page says さい: the
        # number and the counter, にじゅっさい, "20 years old" -- never
        # はたち over a さい the furigana then cannot say.
        for sentence in ("あには二十さいの大学生で、今は一人でおおさかにすんでいます。",
                         "あには大学生で、二十さいです。",
                         "来年、二十さいになります。",
                         "父は四十さいで、あには二十さいです。"):
            with self.subTest(sentence=sentence):
                tokens = analysis.analyze_local(sentence)["tokens"]
                self.assertNotIn("vocab_N5_二十歳_はたち", [(t.get("vocab_match") or {}).get("raw_id") for t in tokens])
                k = next(k for k, t in enumerate(tokens) if t["surface"] == "二十")
                self.assertEqual((tokens[k]["reading"], tokens[k]["number"]), ("にじゅっ", 20))
                self.assertEqual(tokens[k + 1]["surface"], "さい")
                self.assertEqual(tokens[k + 1]["vocab_match"]["raw_id"], "vocab_N5_歳_さい")
        # ...and where the page writes the word, it is the word.
        for sentence, word in (("あには二十歳です。", "二十歳"),
                               ("来年、二十歳になります。", "二十歳"),
                               ("二十才のお祝いをした。", "二十才"),
                               ("あにははたちです。", "はたち")):
            with self.subTest(sentence=sentence):
                self.assertEqual(matches(sentence)[word]["raw_id"], "vocab_N5_二十歳_はたち")
                self.assertEqual(token_of(sentence, word)["reading"], "はたち")

    def test_a_run_spelled_partly_in_kana_keeps_the_card_that_says_its_kana(self) -> None:
        # The kana a page writes inside a word are said: 日よう日 reads
        # its よう in にちようび, お母さん its お and さん; a form's own
        # ending is the form's, so 面倒くさがって's くさ, 臭い's stem, is
        # said by めんどうくさい.
        for sentence, word, raw_id in (
            ("日よう日に行きます。", "日よう日", "vocab_N5_日曜日_にちようび"),
            ("お母さんは先生です。", "お母さん", "vocab_N5_お母さん_おかあさん"),
            ("面倒くさがって、すぐに遊びに行ってしまった", "面倒くさ", "vocab_N2_面倒臭い_めんどうくさい"),
        ):
            with self.subTest(word=word):
                self.assertEqual(matches(sentence)[word]["raw_id"], raw_id)

    def test_the_kana_a_card_must_say(self) -> None:
        def run(text):
            return morphology.tokenize(text)
        hatachi = {"kanji": "二十歳", "kana": "はたち"}
        self.assertFalse(card_lookup.says_its_kana(run("二十さい"), hatachi))
        self.assertTrue(card_lookup.says_its_kana(run("二十歳"), hatachi))      # no kana to say
        self.assertTrue(card_lookup.says_its_kana(run("はたち"), hatachi))      # all kana, read as written
        self.assertTrue(card_lookup.says_its_kana(run("二十さい"), {"kanji": "二十歳", "kana": "はたち/にじゅっさい"}))
        # A mark is said by nothing: the catalogue's 一つ〜 is 一つ.
        self.assertTrue(card_lookup.says_its_kana(run("一つ〜"), {"kanji": "一つ", "kana": "ひとつ"}))


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
        # Latin-American Spanish's figure, as Intl's es-419 prints it: a
        # point before the decimals, a comma between thousands (plan 302).
        self.assertEqual(token_of("３．５キロ走った", "３．５")["gloss"]["es"], "3.5")
        self.assertEqual(token_of("1,500円です", "1,500")["gloss"]["es"], "1,500")
        self.assertEqual(token_of("12,000円です", "12,000")["gloss"]["es"], "12,000")

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
        self.assertEqual(token_of("20代の女性", "20代")["gloss"]["es"], "de 20 a 29 años")
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
        self.assertIn("like that", matches("ああすればいい")["ああ"]["entry"]["meaning"])
        # (ああいう before a noun is one word, "that sort of", plan 272)
        self.assertNotIn("ああ", matches("ああいう人"))

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
        # (since plan 272's held-out round, the classical あり is ある's card)
        self.assertEqual(token_of("猫に九生あり。", "あり")["vocab_match"]["entry"]["kana"], "ある")
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
                                         ("おやおや困ったものだ。", "おやおや", "")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kanji"], kanji)
        # おうち is the deck's うち, "one's home", said politely, as お店 is 店
        self.assertEqual(matches("おうちではどんな様子ですか。")["うち"]["raw_id"], "vocab_N4__うち")
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
        # No shop where noun + 屋 is no word: さくやの is 昨夜, "last night",
        # one word (plan 272).
        self.assertEqual(token_of("さくやのおさらは、まだあらっておりませんでした。", "さくや")["vocab_match"]["entry"]["kanji"],
                         "昨夜")

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
            ("努力が実を結んだ。", "実", "vocab_N3_実_み"),
            ("実を言うと、私は彼が好きでないのです。", "実", "vocab_N1_実_じつ"),
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["raw_id"], raw_id)
        self.assertEqual(token_of("四月一日に入学式がある。", "一日")["reading"], "ついたち")
        # 数日 is the dictionary's word whole, すうじつ "a few days" -- never
        # "sun", nor すう + にち (plan 272)
        self.assertEqual(token_of("数日その駅に置かれた。", "数日")["reading"], "すうじつ")
        self.assertIn("days", token_of("数日その駅に置かれた。", "数日")["vocab_match"]["entry"]["meaning"])

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

    def test_a_way_of_going_not_taken_asks_why(self) -> None:
        # No means is asked of a way of going said in the negative (plan
        # 299): 何で来なかったの？ is "why didn't you come?", where
        # 何で来ましたか asks "by what".
        for sentence in ("何で来なかったの？", "何で行かないの？", "何で行きませんか。", "何で食べないの？",
                         "何で連絡しなかったの？", "何で作ってないの？", "何で来ないで帰ったの？"):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, "何で")["vocab_match"]["raw_id"], "vocab_N3_何で_なんで")
        for sentence in ("何で行きますか。", "何で来ましたか。", "何で行ったらいいですか。", "何で書きますか。",
                         "何で払いますか。"):
            with self.subTest(sentence=sentence):
                self.assertIn("何", matches(sentence))
                self.assertNotIn("何で", matches(sentence))

    def test_the_gate_reads_what_the_breakdown_reads(self) -> None:
        # The segments a sentence is graded on and the breakdown read 何で
        # by one rule (_why, plan 299): where the one says "why", so does
        # the other, in kana too.
        sentences = ("何で泣いてるの？", "なんで泣いているの。", "は？五千円も？なんで急に上がるわけ？",
                     "何で来なかったの？", "何で連絡しなかったの？", "何で行きますか。", "何で来ましたか。",
                     "兄は何でも食べます。", "なんでもいいです。", "理由が何であれ、暴力は許されない。", "何でだろう。")
        for sentence in sentences:
            with self.subTest(sentence=sentence):
                breakdown = any((t.get("vocab_match") or {}).get("raw_id") == "vocab_N3_何で_なんで"
                                for t in analysis.analyze_local(sentence)["tokens"])
                gate = any(s.get("raw_id") == "vocab_N3_何で_なんで"
                           for s in card_lookup.find_segments_in_text(sentence))
                self.assertEqual(breakdown, gate)
        # Without a tokenizer the scan takes the longest word: 何でも is
        # the deck's "anything", never 何で inside it.
        legacy = {s["text"]: s.get("raw_id") for s in card_lookup._find_segments_legacy("兄は何でも食べます。")
                  if s.get("type") == "vocab"}
        self.assertEqual(legacy.get("何でも"), "vocab_N3_何でも_なんでも")
        self.assertNotIn("何で", legacy)

    def test_a_de_that_belongs_after_ends_no_word(self) -> None:
        # The segments a sentence is graded on (plan 299): 何 + で + も is
        # 何でも, "anything", and the copula's で ends no word -- never the
        # N3 何で, "why", which graded every 何でも N3, nor ところで.
        def segments(sentence: str) -> dict[str, str]:
            return {s["text"]: s.get("raw_id", "") for s in card_lookup.find_segments_in_text(sentence)
                    if s.get("type") == "vocab"}
        for sentence in ("兄は何でも食べます。", "なんでもいいです。", "何でもない。", "いくら何でも遅い。",
                         "何でも屋に頼んだ。", "恥でも何でもなかった。", "理由が何であれ、暴力は許されない。",
                         "これは何でございますか。", "何であろうと構わない。"):
            with self.subTest(sentence=sentence):
                found = segments(sentence)
                self.assertNotIn("何で", found)
                self.assertNotIn("vocab_N3_何で_なんで", found.values())
        self.assertEqual(segments("売り場は、エスカレーターを下りた所でございます。").get("所"), "vocab_N5_所_ところ")
        # "Why" is 何 + the particle で, the word ending there: the gate
        # still reads it, a negative after it too.
        for sentence in ("何で泣いてるの？", "何でだろう。", "何でって、好きだからだよ。",
                         "何でそんなことを言うの？", "何で来なかったの？"):
            with self.subTest(sentence=sentence):
                self.assertEqual(segments(sentence).get("何で"), "vocab_N3_何で_なんで")
        # And the level read off them is the point's, not the N3 card's.
        from study import difficulty
        self.assertEqual(difficulty.estimate_level("兄は何でも食べます。"), "N4")
        self.assertEqual(difficulty.estimate_level("何で泣いてるの？"), "N3")

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
        # Two cards in kanji the dictionary writes as one word are that word,
        # read as it reads it, its cards kept as its parts (plan 280): never
        # うで + とけい.
        for sentence, surface, reading, parts in (("祖父から腕時計をもらった。", "腕時計", "うでどけい", ["腕", "時計"]),
                                                  ("大相撲九月場所", "大相撲", "おおずもう", ["大", "相撲"]),
                                                  ("鉄道会社に勤める。", "鉄道会社", "てつどうがいしゃ", ["鉄道", "会社"])):
            with self.subTest(sentence=sentence):
                token = token_of(sentence, surface)
                self.assertEqual(token["reading"], reading)
                self.assertEqual([p["surface"] for p in token["parts"]], parts)
                self.assertTrue(all(p["vocab_match"] for p in token["parts"] if p["pos"] == "noun"))
        # ...and where it does not, they stay two, each its card.
        token = token_of("家具会社に勤める。", "会社")
        self.assertEqual(token["vocab_match"]["raw_id"], "vocab_N5_会社_かいしゃ")
        self.assertEqual(token_of("駅まで何分ですか。", "分")["reading"], "ぷん")
        # 見学生's 生 is a student, no "life"; 転校生 is the dictionary's word
        # over its cards (plan 280).
        gloss = token_of("あの見学生の名前", "生")["gloss"]
        self.assertTrue(gloss["en"].startswith("(suffix) student") and gloss["fr"])
        self.assertEqual(token_of("あの転校生の名前", "転校生")["reading"], "てんこうせい")
        # にございます is でございます said of old, glossed in both languages.
        gloss = token_of("殿、一大事にございます！", "に")["gloss"]
        self.assertTrue(gloss["en"].startswith("(with ござる)") and gloss["fr"].startswith("(avec ござる)"))
        # Two cards no dictionary word joins stay two; a count is no word:
        # 五分 is ごふん.
        for sentence, part in (("英語教室に通う。", "教室"), ("映画番組を見る。", "番組"),
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
        self.assertEqual(token_of("猫に九生あり。", "あり")["vocab_match"]["entry"]["kana"], "ある")  # never 蟻

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
        self.assertEqual(token["gloss"]["es"], "24 de octubre (mes/día)")
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
            ("てか、それって結局お前のせいじゃね？", "じゃね", "(slang) isn't it?"),
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
        # Before an ending it is no imperative: ベルを鳴らせない is 鳴らす's
        # potential, "can't ring" -- a bell made to ring is 鳴らす itself,
        # never 鳴る's causative (plan 306).
        token = token_of("ここではベルを鳴らせない。", "鳴らせ")
        self.assertEqual(token["vocab_match"]["entry"]["kanji"], "鳴らす")
        self.assertEqual({g["pattern"] for g in token["grammar"]}, {"可能形 〜(ら)れる"})

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
        # 亡き姉 is the pool's 亡き, "the late" (plan 306), never 無い.
        self.assertEqual(token_of("亡き姉の日記。", "亡き")["vocab_match"]["entry"]["kanji"], "亡き")
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
                         "I'm beaten; I give up")
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
                                         ("トマトはくし形切りにする。", "切り", "(suffix) cut into"),
                                         ("10連ガチャ回した。", "連", "(counter) in a row"),
                                         ("お箸は何膳おつけしましょうか。", "膳", "(counter) pairs of chopsticks")):
            with self.subTest(sentence=sentence):
                self.assertTrue(gloss_of(sentence, surface).startswith(start))
        # A number's 時 is o'clock, its 台 counts machines.
        self.assertEqual(card_of("三時に会う。", "時"), token_of("三時に会う。", "時")["vocab_match"]["raw_id"])
        self.assertIsNotNone(token_of("車が2台ある。", "台")["vocab_match"])

    def test_readings_in_context(self) -> None:
        for sentence, surface, reading in (("番号札十二番でお待ちのお客様", "番号札", "ばんごうふだ"),
                                           ("千円札を出した。", "札", "さつ"),
                                           ("鶏もも肉は一口大に切る。", "鶏", "とり"), ("みじん切りにする。", "みじん切り", "みじんぎり"),
                                           ("一国の努力だけでは足りない。", "一", "いっ"), ("第2子の保育料", "子", "し"),
                                           ("第一志望でした。", "第一", "だいいち"),
                                           ("興味深い話だ。", "深い", "ぶかい"), ("海は深い。", "深い", "ふかい")):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertEqual(token_of(sentence, surface)["reading"], reading)
        # (the word over its cards, 札 the N1 ふだ among them, plan 280)
        parts = token_of("番号札十二番でお待ちください。", "番号札")["parts"]
        self.assertEqual(parts[1]["vocab_match"]["raw_id"], "vocab_N1_札_ふだ")
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
        # 真に受ける is an idiom's に, not an adverb's: the pool reads it whole.
        self.assertEqual(token_of("真に受けちゃだめだよ。", "真に受け")["reading"], "まにうけ")


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
        self.assertTrue(gloss_of("首相の長演説に聴衆は疲れた。", "長").startswith("(prefix) long"))
        # ...where the dictionary has no word of them; 長時間 it has, "long
        # time", one word over its cards (plan 280).
        self.assertEqual([p["surface"] for p in token_of("長時間の話し合い。", "長時間")["parts"]], ["長", "時間"])
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
        # (連絡先 is the pool's word whole since plan 272's held-out round;
        # a 先 the pool has no word for keeps the suffix's line)
        self.assertEqual(token_of("連絡先を教えてください。", "連絡先")["vocab_match"]["entry"]["kanji"], "連絡先")
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
        # ...where two deck words say the pair, it is the dictionary's one word,
        # its two cards kept as its parts (チーズケーキ, 追体験, plan 280), as
        # 追 of 追注文, which the dictionary lacks, stays a prefix, glossed.
        cake = token_of("チーズケーキを食べた。", "チーズケーキ")
        self.assertEqual([p["surface"] for p in cake["parts"]], ["チーズ", "ケーキ"])
        self.assertEqual(token_of("他人の人生を追体験する。", "追体験")["reading"], "ついたいけん")
        self.assertTrue(gloss_of("追注文を受け付けた。", "追").startswith("(prefix) after"))
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
        # (必ずや, "surely", the dictionary's adverb whole, plan 272)
        self.assertEqual(token_of("必ずや果たしてみせようぞ。", "必ずや")["vocab_match"]["entry"]["kanji"], "必ずや")
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
        # ほんで stays the west's それで; 観光客 one word over its two cards.
        self.assertNotEqual((token_of("ほんで、どないしたん？", "ほんで").get("vocab_match") or {}).get("entry", {}).get("kanji"), "本")
        self.assertEqual([t["surface"] for t in analysis.analyze_local("観光客が多い。")["tokens"]][:2], ["観光客", "が"])
        # A four-kanji compound its cards say is the dictionary's word over
        # them: 自由貿易 is "free trade", libre-échange (plan 280).
        trade = token_of("自由貿易への障害になる。", "自由貿易")
        self.assertEqual([p["surface"] for p in trade["parts"]], ["自由", "貿易"])

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
                                         ("とどまるものではあるまい。", "で", "(with は, も or すら, then ある or ない) is"),
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
        # 立候補 is the dictionary's word, "candidacy", the deck's 候補 its
        # part (plan 280).
        whole = token_of("新人3人が立候補を表明した。", "立候補")
        self.assertIn("candidacy", whole["vocab_match"]["entry"]["meaning"])
        self.assertEqual(whole["parts"][1]["vocab_match"]["raw_id"], "vocab_N3_候補_こうほ")

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


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class KanaVerbByItsObjectTests(unittest.TestCase):
    """A graded text writes a verb in kana that several deck verbs spell;
    whether it takes を, or what its subject is, says which (plan 272) --
    and where nothing does, it stays without a card."""

    def test_the_object_or_the_subject_names_it(self) -> None:
        for sentence, surface, kanji in (("かばんを上のたなにおきました。", "おき", "置く"),
                                         ("あさ六時におきました。", "おき", "起きる"),
                                         ("日よう日のあさ、母にたまごやきをならいました。", "ならい", "習う"),
                                         ("先生のクラスでならったことばを、毎日つかっています。", "ならっ", "習う"),
                                         ("あさがおの花は、あさだけさきます。", "さき", "咲く"),
                                         ("月よう日に、スマホはなおりました。", "なおり", "直る"),
                                         ("かぜがなおりました。", "なおり", "治る")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kanji"], kanji)
        # (put down, or got up? nothing says)
        self.assertIsNone(token_of("ここにおきます。", "おき").get("vocab_match"))

    def test_every_written_in_kana(self) -> None:
        # 毎 + the kana a graded text writes for the kanji above its level
        for sentence, surface, kanji in (("「毎ばんうるさくて、すみません。」", "毎ばん", "毎晩"),
                                         ("毎しゅう、テニスをします。", "毎しゅう", "毎週"),
                                         ("毎とし、日本へ行きます。", "毎とし", "毎年"),
                                         ("毎あさ、さんぽします。", "毎あさ", "毎朝")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kanji"], kanji)


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class EighthReviewWordTests(unittest.TestCase):
    """What an eighth review of 160 lines found read wrong or silent
    (plan 272), each with the sentence it must leave alone."""

    def test_figures_read(self) -> None:
        for sentence, surface, reading in (("9時～12時は使えません。", "12", "じゅうに"),
                                           ("ダイヤ×300を受け取った。", "300", "さんびゃく"),
                                           ("TOEIC800点とる。", "800", "はっぴゃく")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["reading"], reading)
        # (a sum, a seat code and a model number stay as printed)
        self.assertEqual(token_of("3×4は12です。", "4")["reading"], "4")
        self.assertEqual(token_of("iPhone15を買った。", "15")["reading"], "15")

    def test_glosses(self) -> None:
        for sentence, surface, gloss in (("花粉の飛ぶ量は、非常に多いでしょう。", "の", "(in a clause before a noun)"),
                                         ("ついには親の預金にまで手をつけるしまつだ。", "まで", "even, as far as"),
                                         ("人の都合に合わせて育ってはくれない。", "は",
                                          "(between a て form and a negative)"),
                                         ("一円たりともむだにはできない。", "は", "(after a particle)")):
            with self.subTest(sentence=sentence):
                self.assertTrue(gloss_of(sentence, surface).startswith(gloss), gloss_of(sentence, surface))

    def test_beginner_words(self) -> None:
        for sentence, surface, kanji in (("はいしゃの先生は、とてもやさしい女の人でした。", "はいしゃ", "歯医者"),
                                         ("日よう日には、四人でちかくのこうえんへ行きます。", "ちかく", "近く"),
                                         ("母にたまごやきをならいました。", "たまごやき", "卵焼き"),
                                         ("やきそばとかきごおりを食べました。", "かきごおり", "かき氷")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kanji"], kanji)

    def test_cards_by_the_sentence(self) -> None:
        for sentence, surface, kanji in (("ひと息つく時間を持つ。", "つく", "吐く"),
                                         ("ため息ついた", "つい", "吐く"),
                                         ("草いきれが鼻をついた。", "つい", "突く"),
                                         ("いらっしゃい！今日は何を探す？", "いらっしゃい", ""),
                                         ("ひゃくねんも まえから", "ねん", "年"),
                                         ("一駅ぐらい歩いて帰る。", "ぐらい", ""),
                                         ("お手すきの際にご確認ください。", "手すき", "手透き"),
                                         ("そういう人", "そういう", "そう言う"),
                                         ("こいぬは ちょうちょを おいかけて", "ちょうちょ", "蝶々"),
                                         ("名神高速上り、京都東インターを先頭に", "上り", "上り"),
                                         ("本日付で手配が完了いたしました。", "付", "付け"),
                                         ("借りた本、週末に返しに行くね。", "返し", "返す"),
                                         ("私が彼の死を知らされたのは", "知らさ", "知らせる"),
                                         ("ペットの連れ込みはご遠慮ください", "連れ込み", "連れ込む"),
                                         ("ママー、みてみて！ダンゴムシ", "ダンゴムシ", "ダンゴ虫"),
                                         ("しょうぼうしさんになるんだ！", "しょうぼうし", "消防士"),
                                         ("範囲わかる人いる？？", "いる", "居る"),
                                         ("じゃん！ｗｗ もっかいやるわ。", "もっかい", "")):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kanji"], kanji)
        # ...where the same letters stay the word they are elsewhere
        for sentence, surface, kanji in (("駅についた。", "つい", "着く"),
                                         ("電気がついた", "つい", "点く"),
                                         ("うそをついた", "つい", "吐く"),
                                         ("時間がたった。", "たっ", "経つ"),
                                         ("大通りに行く", "大通り", "大通り"),
                                         ("山に上りました", "上り", "上る"),
                                         ("電車におくれた。", "おくれ", "遅れる"),
                                         ("お金要る？", "要る", "要る")):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kanji"], kanji)
        # a compound verb no dictionary holds, as the two verbs it is --
        # and the first alone where a point is the second (消えかけた)
        self.assertEqual(token_of("消えかけた街灯", "消え")["vocab_match"]["entry"]["kanji"], "消える")
        self.assertIsNone(token_of("消えかけた街灯", "かけ").get("vocab_match"))
        self.assertEqual(token_of("30分も待たされた", "待たさ")["vocab_match"]["entry"]["kanji"], "待つ")
        self.assertEqual(token_of("公人としてあるまじき行為だ。", "ある")["vocab_match"]["entry"]["kanji"], "")
        self.assertEqual(token_of("外はもうくらいみたいだ。", "くらい")["vocab_match"]["entry"]["kanji"], "暗い")
        self.assertEqual(token_of("駅まで十分くらいです。", "くらい")["vocab_match"]["entry"]["kana"], "ぐらい")
        self.assertEqual(token_of("グラウンドがぬかるんどる", "ぬかるん")["vocab_match"]["entry"]["kana"], "ぬかるむ")
        self.assertEqual(token_of("調味料を回し入れたら", "回し")["vocab_match"]["entry"]["kanji"], "回す")
        self.assertEqual(token_of("調味料を回し入れたら", "入れ")["vocab_match"]["entry"]["kanji"], "入れる")

    def test_readings_by_the_sentence(self) -> None:
        for sentence, surface, reading in (("生姜1かけ", "1", "ひと"),
                                           ("三日三晩降り続いた雨", "三", "み"),
                                           ("本日付で手配が完了", "付", "づけ"),
                                           ("私事で恐縮ですが", "私事", "わたくしごと"),
                                           ("消えかけた街灯の下で", "下", "した"),
                                           ("はよ来んと、バスが出る。", "来ん", "こん"),
                                           ("うわ、からっ！これ普通に辛いんだけど", "辛い", "からい")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["reading"], reading)
        self.assertEqual(token_of("先生の下で学んだ", "下")["reading"], "もと")
        self.assertEqual(token_of("一晩中", "一")["reading"], "ひと")
        self.assertEqual(token_of("3年2組は明日から学級閉鎖とします。", "2")["reading"], "に")   # a class, no pair
        self.assertEqual(token_of("二組の夫婦", "二")["reading"], "ふた")

    def test_speech_glossed(self) -> None:
        for sentence, surface, gloss in (("風よ 運んでおくれ", "よ", "(after a noun) calls out"),
                                         ("風よ 運んでおくれ", "おくれ", "(after 〜て, old or gentle)"),
                                         ("おや、旅の方かね。", "おや", "oh?"),
                                         ("ちっ、しゃあねえな。", "ちっ", "tch!"),
                                         ("むっとするような暑さ", "むっと", "(of heat or a smell)"),
                                         ("値段を考えれば十分アリだと思う。", "アリ", "(slang) acceptable"),
                                         ("生姜1かけ", "かけ", "(counter) a piece"),
                                         ("切り離しとなります。", "と", "(with なる) becomes"),
                                         ("何をお探しだい？", "い", "(after だ, with a question word)"),
                                         ("何度も確かめては ため息ついた", "は", "(after 〜て, then another doing)"),
                                         ("そんな運転をしていては、大けがをする。", "は", "(after a て form) if"),
                                         ("てめえ、今なんつった？", "つっ", "(rough) って言った"),
                                         ("老舗の鮮魚店までもが店を閉めた。", "まで", "even, as far as"),
                                         ("なんぼやと思う？", "や", "(Kansai) is"),
                                         ("千円やで、千円！", "で", "(Kansai, at the end)"),
                                         ("言うたかて、しゃあないやんか。", "かて", "(Kansai) even if"),
                                         ("言うたかて、しゃあないやんか。", "やんか", "(Kansai) isn't it!"),
                                         ("決まってもうたんやし。", "もうた", "(Kansai) = しまった"),
                                         ("ちゃうちゃう、犬ちゃうねん。", "ちゃう", "(Kansai) = 違う"),
                                         ("なにしよるん？", "よる", "(western Japan) is …ing"),
                                         ("んだんだ、おらもそう思うべ。", "んだんだ", "(Tōhoku) that's right"),
                                         ("んだんだ、おらもそう思うべ。", "べ", "(eastern and northern speech)"),
                                         ("なして黙ってたのっしゃ。", "なして", "(north, Hokkaido) why?"),
                                         ("なして黙ってたのっしゃ。", "っしゃ", "(Tōhoku)"),
                                         ("めんこい孫さ会えるの", "さ", "(Tōhoku) to, toward"),
                                         ("飲み物いらんレベル", "ん", "not"),
                                         ("くるりんと まわりました。", "くるりん", "a sound or manner word")):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertTrue(gloss_of(sentence, surface).startswith(gloss), gloss_of(sentence, surface))
        # (an adjective cut short reads as its own card since plan 272's
        # held-out round: からっ is 辛い, "spicy")
        self.assertEqual(token_of("うわ、からっ！", "からっ")["vocab_match"]["entry"]["kanji"], "辛い")
        # ...and never where the letters are the plain word
        self.assertEqual(token_of("電話をかけた", "かけ")["vocab_match"]["entry"]["kanji"], "掛ける")
        self.assertEqual(gloss_of("りんごやみかんを買った。", "や"), "")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class SenseReviewWordTests(unittest.TestCase):
    """What a review of the senses the app's sentences use found taking
    the wrong card or read wrong (plan 272), each beside the sentence
    where the same letters are the word they look like."""

    def card(self, sentence: str, surface: str) -> str:
        entry = (token_of(sentence, surface).get("vocab_match") or {}).get("entry") or {}
        return entry.get("kanji") or entry.get("kana", "")

    def test_cards_by_the_sentence(self) -> None:
        for sentence, surface, card, other_sentence, other_surface, other in (
            ("でしたら、来月の一日から入れますよ。", "入れ", "入る", "コーヒーに砂糖を入れます。", "入れ", "入れる"),
            ("この店は誰でも入れます。", "入れ", "入る", "箱に入れてください。", "入れ", "入れる"),
            ("レシートはいりますか。", "いり", "要る", "部屋にはいります。", "はいり", "入る"),
            ("会社を辞めることにした。", "辞める", "辞める", "たばこをやめる。", "やめる", "止める"),
            ("命をかけて守る。", "かけ", "賭ける", "壁に絵をかける。", "かける", "掛ける"),
            ("スーツにお金をかける。", "かける", "掛ける", "人生をかけた勝負", "かけ", "賭ける"),
            ("電車より車のほうがはやい。", "はやい", "速い", "朝はやく起きた。", "はやく", "早い"),
            ("はやく走る車", "はやく", "速い", "電車がはやく来た。", "はやく", "早い"),
            ("赤ちゃんがとつぜんなき出す。", "なき", "泣く", "先生に手紙をだした。", "だし", "出す"),
            ("妹は新しいかばんをほしがる。", "ほし", "欲しい", "布団をほした。", "ほし", "干す"),
            ("行き先が分からないので、知らせようがない。", "知らせ", "知らせる", "いい知らせがある。", "知らせ", "知らせ"),
            ("どちらの病院をお考えですか。", "考え", "考える", "いい考えだ。", "考え", "考え"),
            ("データに基づいて、正しく判断してください。", "正しく", "正しい", "まさしく彼だ。", "まさしく", "正しく"),
            ("ありがとうございます。あの、ゴミの日はいつですか。", "あの", "あのう", "あの人は先生です。", "あの", "あの"),
            ("うん、じゃあ、またあした。", "あした", "明日", "あしたまた来ます。", "あした", "明日"),
            ("バスは十分おきに来ます。", "十分", "十分", "時間は十分あります。", "十分", "十分"),
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(self.card(sentence, surface), card)
                self.assertEqual(self.card(other_sentence, other_surface), other)
        # 十分 is the minutes before おき, the N5 card; "enough" elsewhere
        self.assertEqual(token_of("バスは十分おきに来ます。", "十分")["vocab_match"]["entry"]["kana"], "じゅっぷん/じっぷん")
        self.assertEqual(token_of("時間は十分あります。", "十分")["vocab_match"]["entry"]["kana"], "じゅうぶん")

    def test_words_kept_whole(self) -> None:
        for sentence, surface, card in (("お名前と生年月日をお願いいたします。", "生年月日", "生年月日"),
                                        ("母は妹に野さいを食べさせました。", "野さい", "野菜"),
                                        ("週まつ、えいがでも見ませんか。", "週まつ", "週末"),
                                        ("人を見た目で判断してはならない。", "見た目", "見た目"),
                                        ("おくれる場合は、電話してください。", "おくれる", "遅れる"),
                                        ("はい、おつりはいりません。", "おつり", "おつり"),
                                        ("子供を幼稚園に送る。", "幼稚園", "幼稚園"),
                                        ("一生懸命努力した。", "一生懸命", "一生懸命")):
            with self.subTest(sentence=sentence):
                self.assertEqual(self.card(sentence, surface), card)
        # ...and cut where they are two: 休みだし is the noun, the copula and し
        self.assertEqual(self.card("今日は休みだし、映画でも見よう。", "休み"), "休み")
        self.assertEqual(token_of("今日は休みだし、映画でも見よう。", "し")["pos"], "particle")
        self.assertEqual(self.card("お休みです。", "お休み"), "お休み")
        self.assertEqual(self.card("静かな部屋", "静か"), "静か")

    def test_names_no_word(self) -> None:
        for sentence, surface in (("中央線は上下線とも運転を見合わせております。", "中央線"),
                                  ("はい、中央三丁目、五の八です。", "中央"),
                                  ("さくら旅館に泊まった。", "さくら"),
                                  ("さくらという店に行きました。", "さくら"),
                                  ("お電話ありがとうございます。さくらでございます。", "さくら"),
                                  ("みどりホテルまでお願いします。", "みどり"),
                                  ("ひまわり幼稚園に通っています。", "ひまわり")):
            with self.subTest(sentence=sentence):
                token = token_of(sentence, surface)
                self.assertIsNone(token["vocab_match"])
                self.assertIn("name", token["gloss"]["en"])
        # ...where the same letters are the word
        self.assertEqual(self.card("部屋の中央に机がある。", "中央"), "中央")
        self.assertEqual(self.card("さくらが咲いた。", "さくら"), "桜")
        self.assertEqual(self.card("さくらという花が好きです。", "さくら"), "桜")
        self.assertEqual(self.card("これでございます。", "これ"), "これ")

    def test_readings_by_the_sentence(self) -> None:
        for sentence, surface, reading, other_sentence, other in (
            ("でしたら、来月の一日から入れますよ。", "一日", "ついたち", "一日の終わりに日記を書く。", "いちにち"),
            ("毎月の一日に払います。", "一日", "ついたち", "月の一日分の食費", "いちにち"),
            ("彼は年のわりに若く見える。", "年", "とし", "年に一回旅行する。", "ねん"),
            ("バスは十分おきに来ます。", "十分", "じゅっぷん", "もう十分だ。", "じゅうぶん"),
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["reading"], reading)
                self.assertEqual(token_of(other_sentence, surface)["reading"], other)
        # 箱 alone is はこ; 道具箱 is the dictionary's word, どうぐばこ (plan 280).
        for sentence in ("その箱は重い。", "一箱にいくつ入っていますか。"):
            self.assertEqual(token_of(sentence, "箱")["reading"], "はこ")
        self.assertEqual(token_of("道具箱を開けた。", "道具箱")["reading"], "どうぐばこ")
        self.assertEqual(self.card("でしたら、来月の一日から入れますよ。", "一日"), "一日")
        self.assertEqual(token_of("でしたら、来月の一日から入れますよ。", "一日")["vocab_match"]["entry"]["kana"],
                         "ついたち")

    def test_idioms_beside_a_richer_card(self) -> None:
        # A card's sense written by the phrase it is read in (気's
        # "attention (as in 気にする)") yields to the pool's idiom, and a
        # light verb in a card's gloss says no idiom ("to take part" is
        # no 電話に出る)...
        for sentence, surface in (("何が起こっても僕は気にしない。", "気にし"),
                                  ("試合中は、一瞬たりとも気を抜くな。", "気を抜く"),
                                  ("休みなしに働き続けて、体を壊した。", "体を壊し"),
                                  ("夜七時からなら電話に出られます。", "電話に出"),
                                  ("出かけようとしたところに、電話がかかってきた。", "電話がかかっ"),
                                  ("職人としての確かな腕前は身につかない。", "身につか"),
                                  ("まず一歩を踏み出すべきだ。", "一歩を踏み出す"),
                                  ("その真実が明るみに出た。", "明るみに出"),
                                  ("地方の支店に顔を出すだけだ。", "顔を出す"),
                                  ("東京の大学で教鞭をとることが出来た。", "教鞭をとる")):
            with self.subTest(sentence=sentence):
                self.assertTrue(token_of(sentence, surface)["vocab_match"]["pool"])
        # ...where the cards still say all of it
        for sentence, surface, card in (("服を着る。", "着る", "着る"),
                                        ("病気になった。", "病気", "病気"),
                                        ("右に曲がる。", "曲がる", "曲がる"),
                                        ("歯をみがく。", "みがく", "磨く"),
                                        ("日本の文化に関心を持った。", "関心", "関心")):
            with self.subTest(sentence=sentence):
                self.assertEqual(self.card(sentence, surface), card)
        # お役に立てず is 役に立つ's potential, humbly: no 役に立てる "to make use of"
        self.assertEqual(token_of("お役に立てず、申し訳ございません。", "役に立て")["lemma"][:3], "役にた")
        self.assertNotEqual(token_of("お役に立てず、申し訳ございません。", "役に立て")["vocab_match"]["entry"]["kana"],
                            "やくにたてる")
        self.assertEqual(token_of("経験を仕事に役に立てる。", "役に立てる")["vocab_match"]["entry"]["kana"], "やくにたてる")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class NinthReviewWordTests(unittest.TestCase):
    """What a ninth review of 160 lines found cut, read or carded wrong,
    or silent (plan 272), each beside the sentence where the same letters
    are the word they look like."""

    def card(self, sentence: str, surface: str) -> str:
        entry = (token_of(sentence, surface).get("vocab_match") or {}).get("entry") or {}
        return entry.get("kanji") or entry.get("kana", "")

    def test_words_kept_whole(self) -> None:
        for sentence, surface, card in (("熱中症に注意してください。", "熱中症", "熱中症"),
                                        ("窓の外は一面の銀世界であった。", "銀世界", "銀世界"),
                                        ("十年ぶりに会ったのに、開口一番それ？", "開口一番", "開口一番"),
                                        ("水200mlに本品1袋を溶かして", "本品", "本品"),
                                        ("きょうね、ほいくえんで おえかき したの。", "ほいくえん", "保育園"),
                                        ("きょうね、ほいくえんで おえかき したの。", "おえかき", "お絵かき"),
                                        ("みずたまりを ぴちゃぴちゃ あるきました。", "みずたまり", "水たまり"),
                                        ("おにいちゃん、これなあに？", "おにいちゃん", "お兄ちゃん"),
                                        ("電源ボタンを3秒以上長押しすると", "長押し", "長押し"),
                                        ("2対2のままPK戦にもつれ込みました。", "もつれ込み", "もつれ込む"),
                                        ("この口座に振り込んでくださいね。", "振り込ん", "振り込む"),
                                        ("この程度で音を上げるとは情けない。", "音を上げる", "音を上げる"),
                                        ("住民票を取りに行く。", "住民票", "住民票"),
                                        ("泡立て器で混ぜる。", "泡立て器", "泡だて器")):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertEqual(self.card(sentence, surface), card)
        self.assertEqual(token_of("この程度で音を上げるとは情けない。", "音を上げる")["reading"], "ねをあげる")
        # ...where the deck's two words say it, the dictionary's word over them
        self.assertEqual(token_of("観光客が多い。", "観光客")["reading"], "かんこうきゃく")
        self.assertEqual(self.card("みずを のみずに はしった。", "はしっ"), "走る")
        self.assertEqual(self.card("住民が反対した。", "住民"), "住民")
        # a sound cut short, and its と (no 月 read がつ)
        self.assertIn("vigorously", token_of("おやつをガッと取った。", "ガッと")["vocab_match"]["entry"]["meaning"])
        self.assertEqual(self.card("月がきれいだ。", "月"), "月")

    def test_cards_by_the_sentence(self) -> None:
        for sentence, surface, card, other_sentence, other_surface, other in (
            ("きいろい ながぐつを はいて、あるいた。", "はい", "履く", "はい、わかりました。", "はい", "はい"),
            ("表面に焼き色がつくまで焼きます。", "つく", "付く", "駅につく。", "つく", "着く"),
            ("サラダとスープもつきますか。", "つき", "付く", "駅につきますか。", "つき", "着く"),
            ("かぜに のって くもまで とんで いきました。", "かぜ", "風", "かぜをひいて休んだ。", "かぜ", "風邪"),
            ("こたえが かえって きました。", "かえっ", "返る", "おとうさんが かえって きた。", "かえっ", "帰る"),
            ("かえって良くなった。", "かえって", "却って", "家にかえって寝た。", "かえっ", "帰る"),
            ("きんぎょ、3びき すくえたよ！おうちで かってもいい？", "かっ", "飼う", "スーパーでパンをかった。", "かっ", "買う"),
            ("きんぎょ、3びき すくえたよ！", "すくえ", "掬う", "試合にかった。", "かっ", "勝つ"),
            ("ねこをかっています。", "かっ", "飼う", "犬のえさをかってきた。", "かっ", "買う"),
            ("次に使うときは6時間以上あけてください。", "あけ", "空ける", "ドアをあけてください。", "あけ", "開ける"),
            ("夜があけた。", "あけ", "明ける", "窓をあけた。", "あけ", "開ける"),
            # (そういうもんだ is 〜ものだ's own もの since plan 306, no card)
            ("近頃の若いもんはせっかちだ。", "もん", "者", "いいもんを見つけた。", "もん", "物"),
            ("このたび担当が替わりました。", "替わり", "代わる", "天気が変わりました。", "変わり", "変わる"),
            ("待合室でおかけになってお待ちください。", "かけ", "掛ける", "賭けに勝った。", "賭け", "賭け"),
            ("電車より車のほうがはやい。", "はやい", "速い", "朝はやく起きた。", "はやく", "早い"),
        ):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertEqual(self.card(sentence, surface), card)
                self.assertEqual(self.card(other_sentence, other_surface), other)
        self.assertIn("キロメートル", token_of("震源の深さはおよそ10キロ", "キロ")["vocab_match"]["entry"]["kana"])
        self.assertNotIn("キロメートル", token_of("りんごを2キロ買った。", "キロ")["vocab_match"]["entry"]["kana"])
        # old spellings and loanwords in kanji take the deck's card in kana
        self.assertEqual(self.card("余は其の夜、独り洋燈の灯を見詰めて居た。", "其の"), "その")
        self.assertEqual(self.card("余は其の夜、独り洋燈の灯を見詰めて居た。", "洋燈"), "ランプ")
        self.assertEqual(self.card("このわたくしに勝とうだなんて。", "わたくし"), "私")
        self.assertEqual(self.card("お探しのページは見つかりませんでした。", "探し"), "探す")
        self.assertEqual(self.card("なくなり次第終了", "なくなり"), "無くなる")
        self.assertEqual(self.card("祖父がなくなった。", "なくなっ"), "亡くなる")

    def test_names_no_word(self) -> None:
        for sentence, surface, kind in (("制した上原あかりが優勝。", "あかり", "given name"),
                                        ("あおいが今日来れないって。", "あおい", "given name"),
                                        ("クロスに中島が頭で合わせ", "中島", "family name"),
                                        ("ぼくの名前は斎藤健です。", "健", "given name"),
                                        ("立て、ジン。", "ジン", "given name"),
                                        ("ねずみの チュウたは、", "チュウた", "given name"),
                                        ("株式会社みどり商事の花田でございます。", "みどり", "a name (of an inn"),
                                        ("サクラ航空412便、那覇行きは", "サクラ", "a name (of an inn"),
                                        ("駅前のパン屋こむぎ、土日は売り切れ", "こむぎ", "a name (of an inn"),
                                        ("この電車は、のぞみ号、博多行きです。", "のぞみ", "a name (of a train"),
                                        ("ハルノ企画の田中です。", "ハルノ", "a name (of an inn"),
                                        ("私は詩人、たとえば啄木が好きである。", "啄木", "given name")):
            with self.subTest(sentence=sentence):
                token = token_of(sentence, surface)
                self.assertIsNone(token["vocab_match"])
                self.assertTrue(token["gloss"]["en"].startswith(kind), token["gloss"])
        # ...and where the letters are the word
        for sentence, surface, card in (("北風は一日中吹き続けた。", "北風", "北風"),
                                        ("「鶴は千年生きるのよ」と言った。", "鶴", "鶴"),
                                        ("赤木キャプテンは練習中に", "キャプテン", "キャプテン"),
                                        ("白いさらは百円、くろいさらは四百円です。", "さら", "皿"),
                                        ("あおいそらがきれい。", "あおい", "青い"),
                                        ("コーヒー、ジン。", "ジン", "ジン"),
                                        ("パン屋さんに行く。", "パン屋", "パン屋"),
                                        ("ゲーム企画を立てる。", "ゲーム", "ゲーム")):
            with self.subTest(sentence=sentence):
                self.assertEqual(self.card(sentence, surface), card)

    def test_readings_by_the_sentence(self) -> None:
        for sentence, surface, reading in (("中央道下り、小仏トンネルを先頭に25キロの渋滞。", "下り", "くだり"),
                                           ("中央道下り、小仏トンネルを先頭に25キロの渋滞。", "中央道", "ちゅうおうどう"),
                                           ("1回表、先頭の近藤が", "表", "おもて"),
                                           ("芦ノ湖のゴールへ。", "芦ノ湖", "あしのこ"),
                                           ("打率3割1分2厘です。", "分", "ぶ"),
                                           ("熱は37度8分ありました。", "分", "ぶ"),
                                           ("2時間21分08秒で優勝。", "08", "はち"),
                                           ("大学の4年間、陸上部で", "4", "よ"),
                                           ("授業参観は3・4時間目です。", "3", "さん"),
                                           ("授業参観は3・4時間目です。", "4時間目", "よじかんめ"),
                                           ("海岸付近の方は、ただちに避難してください。", "方", "かた"),
                                           ("お持ちの方はお申し出ください。", "方", "かた"),
                                           ("液体物は100ml以下の容器に入れ", "物", "ぶつ"),
                                           ("洗濯物を干す。", "洗濯物", "せんたくもの"),
                                           ("添付ファイルが開けない場合は", "開け", "ひらけ"),
                                           ("焼き色がつくまで25〜30分焼きます。", "25", "にじゅうご"),
                                           ("牛乳1/2カップを加え", "1/2", "にぶんのいち"),
                                           ("その箱は重い。", "箱", "はこ")):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertEqual(token_of(sentence, surface)["reading"], reading)
        for sentence, surface, reading in (("山を下りました。", "下り", "おり"),
                                           ("表を見てください。", "表", "ひょう"),
                                           ("5分待った。", "分", "ふん"),
                                           ("007番の部屋", "007", "007"),
                                           ("駅の近くの方が便利です。", "方", "ほう"),
                                           ("ドアが開けない。", "開け", "あけ"),
                                           ("12/18に会おう。", "12/18", "じゅうにがつじゅうはちにち")):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertEqual(token_of(sentence, surface)["reading"], reading)
        self.assertEqual(self.card("添付ファイルが開けない場合は", "開け"), "開く")
        self.assertEqual(token_of("打率3割1分2厘です。", "分")["vocab_match"]["entry"]["kana"], "ぶ")

    def test_speech_glossed(self) -> None:
        for sentence, surface, gloss in (
            ("あんたのそういうとこ、昔っから大っ嫌いだったの！", "あんた", "you (from あなた"),
            ("あんたのそういうとこ、昔っから大っ嫌いだったの！", "っから", "from, since"),
            ("やっべ、終電もう出ちゃってんじゃん。", "やっべ", "(slang) oh no!"),
            ("近頃の若いもんはせっかちでいかんのう。", "いかん", "won't do"),
            ("ふぉっふぉっふぉ、近頃の若いもんは", "ふぉっふぉっふぉ", "a laugh"),
            ("おーっほっほ！このわたくしに", "おーっほっほ", "a haughty laugh"),
            ("うおおおっ！燃えてきたぜ！", "うおおおっ", "a roar"),
            ("まだまだ修行が足りんわい。", "わい", "(an old man's speech)"),
            ("まとめてかかってこいや！", "かかっ", "(with 来い) to come at someone"),
            ("まとめてかかってこいや！", "や", "(spoken, rough or Kansai)"),
            ("押し出しのフォアボールでサヨナラ！", "サヨナラ", "(baseball) a walk-off"),
            ("百年早くってよ。", "って", "(a lady's speech, of old)"),
            ("いつもそうやって、仕事仕事って。", "って", "quoting what someone keeps saying"),
            ("ジェネリック医薬品をご希望されますか？", "れ", "(honorific)"),
            ("これ、あーちゃんの！さわっちゃ だめ！", "ちゃ", "(spoken) = ては"),
            ("みずたまりを ぴちゃぴちゃ あるきました。", "ぴちゃぴちゃ", "a sound or manner word"),
            ("お、来たか。", "お", "oh!"),
            ("令和7年4月1日（火）より、営業時間を変更いたします。", "より", "(formal) from"),
            ("ワンチャン休講じゃね？", "じゃね", "(slang) isn't it?"),
            ("えらい上手にピアノ弾かはりますなあ。", "えらい", "(Kansai) very"),
            ("えらい上手にピアノ弾かはりますなあ。", "はり", "(Kyoto, Kansai) the respect"),
            ("毎日ようお稽古しはって。", "よう", "(Kansai) = よく"),
            ("ほな、おおきに。またおいでやす。", "やす", "(Kyoto) a polite request"),
            ("はよ教えてえや。", "てえ", "(Kansai) = て"),
            ("今日はもう帰って寝るで。", "で", "(Kansai, at the end) = よ"),
            ("おみゃーさんも食べてみやあ。", "おみゃーさん", "(Nagoya) you"),
            ("おみゃーさんも食べてみやあ。", "やあ", "(Nagoya) a gentle command"),
            ("今どこおると？", "おる", "(western speech) = いる"),
            ("今どこおると？", "と", "(Hakata) at the end of a question"),
            ("うちらもう店に着いとうよ。", "とう", "(Hakata, Kobe) = ている"),
            ("沖縄の夏はでーじ暑い。", "でーじ", "(Okinawa) very"),
            ("そったなごど言わねで、こっちさ来て", "そったなごど", "(Tōhoku) such things"),
            ("そったなごど言わねで、こっちさ来て", "さ", "(Tōhoku) to, toward"),
            ("雪かきさ行ってくっから、ストーブ見ででけろな。", "っから", "(spoken) = くるから"),
            ("雪かきさ行ってくっから、ストーブ見ででけろな。", "でけろ", "(Tōhoku) = てくれ"),
            ("一駅ぐらい歩いて帰ったろか。", "たろ", "(Kansai) = てやろう"),
            ("それ、安ないで。", "で", "(Kansai, at the end) = よ"),
        ):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertTrue(gloss_of(sentence, surface).startswith(gloss), gloss_of(sentence, surface))
        # ...and never where the letters are the plain word
        self.assertEqual(self.card("偉い人に会った。", "偉い"), "偉い")
        self.assertEqual(self.card("学校へ行く。", "行く"), "行く")
        self.assertEqual(self.card("まあ、案外悪くない。", "悪く"), "悪い")
        self.assertEqual(self.card("それ、安ないで。", "安"), "安い")         # the west's 安くない
        self.assertEqual(self.card("安全ではない。", "安全"), "安全")
        self.assertNotIn("Kansai", gloss_of("行かないで。", "で"))
        self.assertEqual(gloss_of("ほら、アイスって書いてあるでしょ。", "って")[:9], "(spoken) ")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class HeldOutWordTests(unittest.TestCase):
    """What outside text showed the breakdown leaving silent or cutting
    wrong (plan 272), each pinned on sentences written for the rule,
    beside the one where the same letters are something else."""

    def test_speech_glossed(self) -> None:
        for sentence, surface, gloss in (
            ("彼は親切にも道を教えてくれた。", "も", "(after an adverb) stresses it"),
            ("あまりにも暑い。", "も", "(after an adverb) stresses it"),
            ("この店は安くもない。", "も", "(between an adjective's く and ない)"),
            ("借金をしてでも行きたい。", "で", "(after a て form) even if it means"),
            ("電車に間に合おうと走った。", "と", "(after a volitional) trying to"),
            ("泳ぐには水着が要る。", "に", "(after a verb, before は) for, to"),
            ("ずいぶん寒いなぁ。", "なぁ", "(sentence end) feeling"),
            ("早く来いよぉ。", "よぉ", ""),
        ):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertTrue(gloss_of(sentence, surface).startswith(gloss), gloss_of(sentence, surface))
        # ...never where the letters are a plain particle
        self.assertFalse(gloss_of("私も行く。", "も").startswith("(after an adverb)"))
        self.assertFalse(gloss_of("行くには行くが、遅れる。", "に").startswith("(after a verb, before は)"))

    def test_words_kept_whole(self) -> None:
        # an adverb the dictionary holds with its や: もしや, 今や
        self.assertEqual(token_of("もしや、山田さんですか。", "もしや")["vocab_match"]["entry"]["kanji"], "若しや")
        self.assertEqual(token_of("今や誰でもスマホを持っている。", "今や")["vocab_match"]["entry"]["kanji"], "今や")
        # ...where や lists, or やる follows
        self.assertEqual(token_of("パンや牛乳を買った。", "や")["pos"], "particle")
        self.assertEqual(token_of("今やっているところだ。", "今")["vocab_match"]["entry"]["kanji"], "今")
        self.assertEqual(token_of("もしやるなら手伝う。", "もし")["vocab_match"]["entry"]["kana"], "もし")

    def test_a_word_drawn_out_never_breaks_the_reading(self) -> None:
        # (a run of marks dropped whole took a later mark's place with it)
        for sentence in ("うわわ〜〜〜っ", "きゃああ〜〜〜っ！", "すごーーーーい！", "えーっと〜〜〜"):
            with self.subTest(sentence=sentence):
                tokens = morphology.tokenize(sentence)
                self.assertEqual("".join(t.surface for t in tokens), sentence)

    def test_a_kana_noun_by_its_own_clause(self) -> None:
        # (the audit of the narrow rules, plan 272) a partner is read in
        # the noun's own clause, never across a comma, and a day is no
        # evidence: any sentence has one
        cards = [t["vocab_match"]["entry"]["kanji"] for t in analysis.analyze_local(
            "そとはかぜがつめたいけど、かぜはもうなおった。")["tokens"] if t["surface"] == "かぜ"]
        self.assertEqual(cards, ["風", "風邪"])
        self.assertEqual(token_of("あさってのえんそくに、あめを二つもっていく。", "あめ")["vocab_match"]["entry"]["kanji"], "飴")
        self.assertEqual(token_of("あめがふってきた。", "あめ")["vocab_match"]["entry"]["kanji"], "雨")
        # たび by what goes with it, 度 after a verb
        self.assertEqual(token_of("長いたびに出た。", "たび")["vocab_match"]["entry"]["kanji"], "旅")
        self.assertEqual(token_of("和服にはたびをはく。", "たび")["vocab_match"]["entry"]["kanji"], "足袋")
        self.assertEqual(token_of("和服にはたびをはく。", "はく")["vocab_match"]["entry"]["kanji"], "履く")
        self.assertEqual(token_of("旅行に行くたび、写真を撮る。", "たび")["vocab_match"]["entry"]["kanji"], "度")

    def test_home_and_speed_by_what_they_do(self) -> None:
        # an adjective's く-form says how one goes home
        self.assertEqual(token_of("はやくうちにもどりたい。", "うち")["vocab_match"]["entry"]["kanji"], "家")
        self.assertEqual(token_of("あかるいうちにもどりたい。", "うち")["vocab_match"]["entry"]["kana"], "うち")
        self.assertIn("〜うちに", grammar_detect_patterns("あかるいうちにもどりたい。"))
        self.assertNotIn("〜うちに", grammar_detect_patterns("遅くうちに着いた。"))
        # what moves is fast; a motion one goes to do is early
        self.assertEqual(token_of("選手たちはとてもはやい。", "はやい")["vocab_match"]["entry"]["kanji"], "速い")
        self.assertEqual(token_of("はやく走りに行こう。", "はやく")["vocab_match"]["entry"]["kanji"], "早い")

    def test_spoken_words_by_their_frame(self) -> None:
        for sentence, surface, gloss in (
            ("おはいりやす。", "やす", "(Kyoto) a polite request"),
            ("この服、アリかナシか教えて。", "アリ", "(slang) acceptable"),
            ("この服、アリかナシか教えて。", "ナシ", "(slang, beside アリ) not acceptable"),
            ("お客様がご到着されました。", "れ", "(honorific)"),
            ("いつ来ると？", "と", "(Hakata)"),
            ("この字、なんて読めばいい？", "て", "(spoken, = と) quotes"),
            ("あと一息で完成だ。", "で", "(after もう少し) almost"),
            ("読んだ本の数だけ世界が広がる。", "だけ", "(after 数) as many as"),
            ("星よ、光れ。", "よ", "(after a noun) calls out"),
            ("触っちゃやだ。", "ちゃ", "(spoken) = ては"),
            ("早く食べやあ。", "やあ", "(Nagoya) a gentle command"),
            ("えらい混んでるな。", "えらい", "(Kansai) very"),
            ("意味のない話はやめよう。", "の", "(in a clause before a noun)"),
        ):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertTrue(gloss_of(sentence, surface).startswith(gloss), gloss_of(sentence, surface))
        # ...never where the same letters are the plain word
        self.assertIn("〜やすい／〜にくい", grammar_detect_patterns("読みやすい本だ。"))
        self.assertEqual(token_of("台所にアリが出た。", "アリ")["vocab_match"]["entry"]["kanji"], "蟻")
        self.assertFalse(gloss_of("上司にご指摘された。", "れ").startswith("(honorific)"))
        self.assertFalse(gloss_of("ふたを開けると？", "と").startswith("(Hakata)"))
        self.assertEqual(token_of("なんて大きな家だろう。", "なんて")["surface"], "なんて")
        self.assertFalse(gloss_of("あと少しでいいよ。", "で").startswith("(after もう少し)"))
        self.assertFalse(gloss_of("数だけそろえても意味がない。", "だけ").startswith("(after 数)"))
        self.assertFalse(gloss_of("本当よ！", "よ").startswith("(after a noun)"))
        self.assertEqual(token_of("えらい先生が来た。", "えらい")["vocab_match"]["entry"]["kanji"], "偉い")
        self.assertFalse(gloss_of("日本の古い家。", "の").startswith("(in a clause before a noun)"))

    def test_words_whole_and_counted(self) -> None:
        for sentence, surface, kanji in (
            ("ペン、ノート、その他の文房具を買った。", "その他", "そのほか"),     # the deck's card, in kana
            ("築浅の物件を探している。", "築浅", "築浅"),
            ("出張先でけがをした。", "出張先", "出張先"),
            ("腰が低い店員だった。", "腰が低い", "腰が低い"),
            ("ワン、ツー、スリー！", "ツー", "２"),
            ("ワン、ツー、スリー！", "ワン", "１"),
            ("四つともこわれていた。", "とも", "共"),
            ("三人とも来なかった。", "とも", "共"),
        ):
            with self.subTest(sentence=sentence, surface=surface):
                entry = token_of(sentence, surface)["vocab_match"]["entry"]
                self.assertEqual(entry["kanji"] or entry["kana"], kanji)
        # ...where the parts are their own words
        self.assertEqual(token_of("この先は危ない。", "先")["vocab_match"]["entry"]["kanji"], "先")
        self.assertEqual(token_of("築十年の家に住む。", "築")["vocab_match"]["entry"]["kanji"], "築")
        self.assertEqual(token_of("彼は背が高い。", "高い")["vocab_match"]["entry"]["kanji"], "高い")
        self.assertEqual(token_of("犬がワンとほえた。", "ワン")["vocab_match"]["entry"]["meaning"].split(";")[0], "woof")
        self.assertEqual(token_of("友達とも遊んだ。", "と")["pos"], "particle")

    def test_readings_by_what_the_sentence_says(self) -> None:
        for sentence, surface, reading in (
            ("使い終わった方は元の場所に戻してください。", "方", "かた"),
            ("20歳未満の方はお断りします。", "方", "かた"),
            ("入院中の方はご遠慮ください。", "方", "かた"),
            ("安く買える方を探した。", "方", "ほう"),
            ("白と黒、ご希望の方をお選びください。", "方", "ほう"),
            ("何描いてるの？", "何", "なに"),
            ("何踊る？", "何", "なに"),
            ("何回も来た。", "何", "なん"),
            ("6回表に3点を入れた。", "表", "おもて"),
            ("あと1回表を確認して。", "表", "ひょう"),
            ("赤ちゃんの額をなでた。", "額", "ひたい"),
            ("請求額を確認した。", "請求額", "せいきゅうがく"),
            ("額に入れた写真を飾った。", "額", "がく"),
            ("数が足りない。", "数", "かず"),
        ):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertEqual(token_of(sentence, surface)["reading"], reading)

    def test_a_card_says_the_sense_its_sentences_use(self) -> None:
        self.assertIn("to be made (of)", token_of("この机は木でできている。", "でき")["vocab_match"]["entry"]["meaning"])
        self.assertIn("(slang) to exaggerate", token_of("写真を盛りすぎた。", "盛り")["vocab_match"]["entry"]["meaning"])


    def test_a_degree_is_a_noun(self) -> None:
        # (the dev review, plan 272) 高め, 低め before a mark: "on the high
        # side", the pool's noun -- 声を低めた is the verb
        self.assertEqual(token_of("内角高め、ボール。", "高め")["vocab_match"]["entry"]["kanji"], "高め")
        self.assertEqual(token_of("内角高め、ボール。", "高め")["pos"], "noun")
        self.assertEqual(token_of("声を低めた。", "低め")["vocab_match"]["entry"]["kanji"], "低める")
        # and a noun's の before ある is who has it, = が
        self.assertTrue(gloss_of("運転経験のある人を探している。", "の").startswith("(in a clause before a noun)"))


def grammar_detect_patterns(sentence: str) -> set[str]:
    return {g["pattern"] for g in analysis.analyze_local(sentence)["grammar"]}


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class SegmentationRoundWordTests(unittest.TestCase):
    """The senses, cards and words a round on segmentation and grammar
    found read wrongly (plan 272), each on sentences written for the
    rule, beside the one where the same letters are the other word."""

    def test_a_pool_word_by_its_sentence(self) -> None:
        # the field the sentence is in, or the word's use, picks the sense
        # its line opens on
        def meaning(sentence: str, surface: str) -> str:
            return token_of(sentence, surface)["vocab_match"]["entry"]["meaning"]
        self.assertTrue(meaning("ファイルを読み込んでいます。", "読み込ん").startswith("to load (data)"))
        self.assertTrue(meaning("小説を何度も読み込んだ。", "読み込ん").startswith("to read thoroughly"))
        self.assertTrue(meaning("契約に定めのある場合を除く。", "定め").startswith("provision"))
        self.assertFalse(meaning("それも運命の定めだ。", "定め").startswith("provision"))
        self.assertTrue(meaning("この服はあなたにぴったりだ。", "ぴったり").startswith("perfectly (suited)"))
        self.assertEqual(token_of("家族が社会の基礎をなす。", "なす")["vocab_match"]["entry"]["kanji"], "成す")
        self.assertEqual(token_of("悪事をなす者。", "なす")["vocab_match"]["entry"]["kanji"], "為す")

    def test_from_after_a_time(self) -> None:
        self.assertTrue(gloss_of("午前十時より説明会を行います。", "より").startswith("(formal) from"))
        self.assertTrue(gloss_of("日頃より本校の活動にご協力を賜り、感謝申し上げます。", "より").startswith("(formal) from"))
        # ...never where the clause compares
        self.assertEqual(token_of("去年より、雨が多い。", "より")["vocab_match"]["entry"]["kana"], "より")
        self.assertEqual(token_of("去年より増えた。", "より")["vocab_match"]["entry"]["kana"], "より")

    def test_a_stem_glued_to_a_noun_is_the_noun(self) -> None:
        self.assertEqual(token_of("年中無休、元日休み。", "休み")["vocab_match"]["entry"]["kanji"], "休み")
        self.assertEqual(token_of("学校を休みました。", "休み")["vocab_match"]["entry"]["kanji"], "休む")

    def test_the_spoken_senses_on_their_cards(self) -> None:
        self.assertIn("it doesn't count", token_of("ずるい、今のなしね！", "なし")["vocab_match"]["entry"]["meaning"])

    def test_a_compound_verb_is_one_word(self) -> None:
        # one verb the deck or the dictionary holds, which UniDic cut in two
        for sentence, surface, kanji in (("急に雨が降りだしたので、傘を買った。", "降りだし", "降り出す"),
                                         ("一日中歩いて疲れきった。", "疲れきっ", "疲れきる"),
                                         ("犬が庭をはね回っている。", "はね回っ", "跳ね回る")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kanji"], kanji)
        # ...where the sentence is in the dictionary word's field: 読み出す is
        # only "to read out (data)"
        self.assertEqual(token_of("サーバーからデータを読み出した。", "読み出し")["vocab_match"]["entry"]["kanji"],
                         "読み出す")
        self.assertEqual(token_of("妹は本を読み出した。", "読み")["vocab_match"]["entry"]["kanji"], "読む")

    def test_a_saying_whose_cards_cannot_say_it(self) -> None:
        for sentence, surface, kanji in (("発表の後、顔から火が出る思いだった。", "顔から火が出る", "顔から火が出る"),
                                         ("年末は猫の手も借りたいくらいだ。", "猫の手も借りたい", "猫の手も借りたい"),
                                         ("もう賽は投げられた。", "賽は投げられた", "賽は投げられた"),
                                         ("二人はあうんの呼吸で料理を作る。", "あうんの呼吸", "阿吽の呼吸"),
                                         ("最後まで手に汗を握る試合だった。", "手に汗を握る", "手に汗を握る")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kanji"], kanji)
        # ...never one its cards say (服を着る), one whose word says the
        # figure itself (遠吠え, "howling, backbiting": a dog heard), nor one
        # the catalogue teaches a point on (昼夜を問わず)
        for sentence, surface in (("毎朝自分で服を着る。", "服"), ("遠くで犬の遠吠えがする。", "犬"),
                                  ("工事は昼夜を問わず続いた。", "昼夜")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["surface"], surface)

    def test_a_first_sense_of_another_field_gives_way(self) -> None:
        def meaning(sentence: str) -> str:
            return token_of(sentence, "火の車")["vocab_match"]["entry"]["meaning"]
        self.assertTrue(meaning("うちの家計は火の車です。").startswith("desperate financial situation"))
        self.assertTrue(meaning("地獄の火の車に乗せられた罪人。").startswith("fiery chariot"))

    def test_a_demonstrative_opens_a_noun(self) -> None:
        self.assertEqual(token_of("このやろう、覚えてろ！", "やろう")["vocab_match"]["entry"]["kanji"], "野郎")
        self.assertEqual(token_of("みんなでやろう。", "やろう")["vocab_match"]["raw_id"], "vocab_N5__やる")
        self.assertEqual(token_of("よりによって試験の日に熱が出た。", "よりによって")["vocab_match"]["entry"]["kanji"],
                         "選りによって")
        self.assertEqual(token_of("子どもによって違う。", "よっ")["surface"], "よっ")

    def test_words_the_tokenizer_misread(self) -> None:
        def raw(sentence: str, surface: str) -> str:
            return token_of(sentence, surface)["vocab_match"]["raw_id"]
        self.assertEqual(raw("その箱、重そうだね。", "重"), "vocab_N5_重い_おもい")
        self.assertEqual(token_of("重曹で掃除する。", "重曹")["vocab_match"]["entry"]["kanji"], "重曹")
        self.assertEqual(raw("手袋を片方なくしてしまった。", "なくし"), "vocab_N5_無くす_なくす")
        self.assertEqual(token_of("ぶっちゃけ、つまらなかった。", "ぶっちゃけ")["vocab_match"]["entry"]["kana"], "ぶっちゃけ")
        self.assertEqual(token_of("秘密をぶっちゃけた。", "ぶっちゃけ")["vocab_match"]["entry"]["kana"], "ぶっちゃける")
        self.assertEqual(token_of("仕方なく歩いて帰った。", "仕方なく")["vocab_match"]["entry"]["kanji"], "仕方なく")
        self.assertEqual(token_of("もう遅いけん、はよ寝なさい。", "はよ")["vocab_match"]["entry"]["kanji"], "早よ")
        self.assertEqual(token_of("子どもは今にも泣き出さんばかりだった。", "泣き出さ")["vocab_match"]["entry"]["kanji"],
                         "泣き出す")
        self.assertEqual(token_of("三か国を旅した。", "か国")["vocab_match"]["entry"]["kanji"], "カ国")
        self.assertEqual(token_of("いくらなんでも遅すぎる。", "いくらなんでも")["vocab_match"]["entry"]["kanji"],
                         "いくら何でも")

    def test_a_kana_verb_by_what_it_does(self) -> None:
        def raw(sentence: str) -> str:
            return next(t for t in analysis.analyze_local(sentence)["tokens"]
                        if t["surface"] in ("しまっ", "かく", "つけ"))["vocab_match"]["raw_id"]
        # a thing done and left so takes the verb that does it (てある)
        self.assertEqual(raw("冬服は押し入れにしまってある。"), "vocab_N3__しまう")
        self.assertEqual(raw("店はもうしまっている。"), "vocab_N5_閉まる_しまる")
        self.assertEqual(raw("走ると汗をかく。"), "vocab_N2_掻く_かく")
        self.assertEqual(raw("毎晩日記をつけている。"), "vocab_N3_付ける_つける")

    def test_uchi_and_readings_by_their_neighbours(self) -> None:
        self.assertEqual(token_of("うちの母は料理が上手だ。", "うち")["vocab_match"]["raw_id"], "vocab_N4__うち")
        self.assertEqual(token_of("うちは駅から近い。", "うち")["vocab_match"]["entry"]["kanji"], "家")
        for sentence, surface, reading in (("今日本当に暑いね。", "今日", "きょう"), ("応募者数が増えた。", "数", "すう"),
                                           ("上の階がうるさい。", "階", "かい"), ("三階に行く。", "階", "がい"),
                                           ("数が足りない。", "数", "かず"), ("週末は筑波山に登る。", "山", "さん"),
                                           ("山に登る。", "山", "やま")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["reading"], reading)

    def test_glosses_of_this_round(self) -> None:
        self.assertTrue(gloss_of("何を言われようとも、気にしない。", "とも").startswith("(after the volitional)"))
        self.assertTrue(gloss_of("礼儀ってもんがある。", "って").startswith("(before a noun) = という"))

    def test_the_nominaliser_says_what_it_does(self) -> None:
        # (its gloss, where no point is written on it)
        from study import particle_glosses
        for sentence in ("本体が重いのが難点だ。", "来たのを知らなかった。"):
            with self.subTest(sentence=sentence):
                ms = morphology.tokenize(sentence)
                k = next(j for j, m in enumerate(ms) if m.surface == "の")
                self.assertTrue(particle_glosses.gloss(ms, k)["en"].startswith("(after an adjective or a verb)"))
        ms = morphology.tokenize("私の本です。")
        self.assertNotEqual((particle_glosses.gloss(ms, 1) or {}).get("en", "")[:8], "(after a")

    def test_a_deed_after_an_adverb(self) -> None:
        # an adverb says how a deed is done: よくねた is 寝る + た, no ねた
        self.assertEqual(token_of("昨日はよくねたよ。", "ね")["vocab_match"]["entry"]["kanji"], "寝る")
        self.assertEqual(token_of("いいねたを思いついた。", "ねた")["vocab_match"]["entry"]["kana"], "ねた")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class DeckNounCompoundTests(unittest.TestCase):
    """Plan 280, the owner's choice. A run of the deck's own nouns that
    the dictionary writes as one word is that word, read as it reads it,
    its cards kept as its parts -- where the French layer has the word, so
    a French learner never trades two cards in French for one in English."""

    def test_a_run_of_cards_is_the_dictionary_word(self) -> None:
        for sentence, surface, reading, parts in (
            ("観光客が多い。", "観光客", "かんこうきゃく", ["観光", "客"]),
            ("首相が記者会見を開いた。", "記者会見", "きしゃかいけん", ["記者", "会見"]),
            ("満員電車で通勤する。", "満員電車", "まんいんでんしゃ", ["満員", "電車"]),
            ("携帯電話を忘れた。", "携帯電話", "けいたいでんわ", ["携帯", "電話"]),
            ("学生時代の友達", "学生時代", "がくせいじだい", ["学生", "時代"]),
            # (the ordinal 第 with its number, where the pool holds the word)
            ("第三者に聞く。", "第三者", "だいさんしゃ", ["第", "三", "者"]),
            # (however rare the word: JMdict ranks both past 100,000)
            ("業務委託の契約を結んだ。", "業務委託", "ぎょうむいたく", ["業務", "委託"]),
            ("夏野菜のカレーを作った。", "夏野菜", "なつやさい", ["夏", "野菜"]),
        ):
            with self.subTest(sentence=sentence):
                token = token_of(sentence, surface)
                self.assertEqual(token["reading"], reading)
                self.assertTrue(token["vocab_match"]["pool"])
                self.assertTrue(token["vocab_match"]["entry"]["meaning_fr"])
                self.assertEqual([p["surface"] for p in token["parts"]], parts)

    def test_only_where_the_french_layer_has_it(self) -> None:
        # The word folds where the French layer gives it a line, and stays
        # its cards, which have theirs, where it gives none.
        from unittest import mock
        from content import jmdict_fr
        sentence = "電気料金が上がった。"
        self.assertEqual([t["surface"] for t in analysis.analyze_local(sentence)["tokens"]][:2], ["電気料金", "が"])
        real = jmdict_fr.pool_line
        with mock.patch.object(card_lookup.jmdict_fr, "pool_line",
                               lambda k, r: None if k == "電気料金" else real(k, r)):
            self.assertEqual([t["surface"] for t in analysis.analyze_local(sentence)["tokens"]][:2], ["電気", "料金"])

    def test_a_word_over_a_point_gives_way_to_a_shorter_one(self) -> None:
        # 〜まえに is written on 前, so 数年前 gives way to 数年 + 前; with no
        # point there, 数年前 is the word.
        self.assertEqual([t["surface"] for t in analysis.analyze_local("私は数年前にゴルフを始めた。")["tokens"]][2:4],
                         ["数年", "前"])
        self.assertEqual(analysis.analyze_local("数年前のことだ。")["tokens"][0]["surface"], "数年前")

    def test_its_cards_still_count(self) -> None:
        from study import level_mix
        ids = {w["raw_id"] for w in level_mix.words_at_level("電話番号を教えてください。", "N5")}
        self.assertTrue({"vocab_N5_電話_でんわ", "vocab_N5_番号_ばんごう"} <= ids)

    def test_where_it_stays_its_cards(self) -> None:
        for sentence, pieces in (
            # no such word in the dictionary
            ("英語教室に通う。", ["英語", "教室"]),
            # one whose English is not the word's, left without French on
            # purpose: JMdict's 国民銀行 is China's 人民銀行
            ("国民銀行に口座を開いた。", ["国民", "銀行"]),
            ("家具会社に勤める。", ["家具", "会社"]),
            ("子供部屋を片付ける。", ["子供", "部屋"]),
            ("世界大会で優勝した。", ["世界", "大会"]),
            ("仕事中に電話が来た。", ["仕事", "中"]),    # a point written on 中
            # a counter after its number or 何 is the count's
            ("五年後に会おう。", ["五", "年", "後"]),
            ("第三章を読む。", ["第", "三", "章"]),
            ("何時間待った？", ["何", "時間"]),
            ("何分の一を食べた", ["何", "分"]),
            # a person said of several, or politely, as any noun of one is
            ("子供たちが遊んでいる。", ["子供", "たち"]),
            ("あの人たちは誰？", ["人", "たち"]),
            ("私達は学生です。", ["私", "達"]),
            ("弟さんは元気？", ["弟", "さん"]),
            # spelled as the page writes it: 三社とも is no 社共
            ("三社とも来た。", ["社", "とも"]),
            # never cutting a commoner word its last noun makes with what
            # follows -- the commoner word kept either way
            ("委員会は最終報告書をまとめる。", ["最終", "報告書"]),
            ("原材料費も上がっております。", ["原材料", "費"]),
            ("彼はまったくの民主党員だ。", ["民主党", "員"]),
        ):
            with self.subTest(sentence=sentence):
                surfaces = [t["surface"] for t in analysis.analyze_local(sentence)["tokens"]]
                k = surfaces.index(pieces[0])
                self.assertEqual(surfaces[k:k + len(pieces)], pieces)


def cut(sentence: str) -> list[str]:
    return [t["surface"] for t in analysis.analyze_local(sentence)["tokens"]]


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class ParticleLetterWordTests(unittest.TestCase):
    """Plan 305. A word written in kana whose first letter is also a
    particle is read whole where no particle can stand, never cut into
    the particle and a shorter word: はいしゃ is no topic は + いしゃ, the
    doctor. Each on sentences written for the rule, beside the topic は
    that stands before a kana word and stays the topic."""

    def kanji(self, sentence: str, surface: str) -> str:
        return token_of(sentence, surface)["vocab_match"]["entry"]["kanji"]

    def test_a_kana_word_where_no_topic_can_stand(self) -> None:
        # after a comma or an adverb, and opening what is said: nothing a
        # は could mark (the kana lexicon's はいしゃ, which MeCab weighs)
        for sentence in ("子どものころから、はいしゃがこわかった。",
                         "やっとはいしゃへ行きました。",
                         "ちょっとはいしゃに行ってきます。",
                         "はいしゃの先生はやさしい。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(self.kanji(sentence, "はいしゃ"), "歯医者")
        # a は opening what is said begins the word MeCab reads next (はこ
        # + の, never は + この)
        for sentence in ("はこの中にはねこがいました。", "「はこの中を見て。」", "まず、はこのふたをあけた。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(self.kanji(sentence, "はこ"), "箱")
                self.assertNotIn("この", cut(sentence))

    def test_no_bare_child_after_the_topic(self) -> None:
        # a こ standing bare after は, read as 子 or as no word at all, is
        # the end of the word the は begins
        for sentence in ("二人ではこを運びました。", "へやではこをあけました。", "駅ではこを二つかいました。",
                         "ここではこがよくうれています。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(self.kanji(sentence, "はこ"), "箱")
                self.assertNotIn("は", cut(sentence))
        # ...and a child after what says whose or which stays a child
        self.assertEqual(self.kanji("いいこにしてね。", "こ"), "子")

    def test_the_topic_before_a_kana_word_stays_the_topic(self) -> None:
        for sentence, words in (("それはいしゃのかばんです。", ["は", "いしゃ"]),
                                ("父はいしゃです。", ["は", "いしゃ"]),
                                ("かれはいしゃになりたいです。", ["は", "いしゃ"]),
                                ("わたしはこの本が好きです。", ["は", "この"]),
                                ("母はこう言いました。", ["は", "こう"]),
                                ("今日はこない。", ["は", "こ", "ない"]),         # 来る
                                ("日本ではこめを食べます。", ["は", "こめ"]),
                                ("ここではこまります。", ["は", "こまり"]),
                                ("うちではこどもがねています。", ["は", "こども"]),
                                ("ではこれで。", ["では", "これ"]),
                                ("わたしはえをかきます。", ["は", "え"]),
                                ("わたしはぷらそにかがすきです。", ["は", "ぷらそにか"])):
            with self.subTest(sentence=sentence):
                tokens = cut(sentence)
                at = next((i for i in range(len(tokens)) if tokens[i:i + len(words)] == words), None)
                self.assertIsNotNone(at, tokens)
        self.assertEqual(self.kanji("それはいしゃのかばんです。", "いしゃ"), "医者")
        self.assertEqual(self.kanji("日本ではこめを食べます。", "こめ"), "米")

    def test_a_particle_letter_inside_a_verb_or_a_word(self) -> None:
        # ね, the particle, is no part of ねたかった or ねよう: 寝る's stem
        for sentence, surface in (("きのうは早くねたかったです。", "ね"), ("もうねようか。", "ねよう"),
                                  ("今日は早くねたい。", "ね")):
            with self.subTest(sentence=sentence):
                token = token_of(sentence, surface)
                self.assertEqual(token["pos"], "verb")
                self.assertEqual(token["lemma"], "寝る")
        self.assertEqual(self.kanji("でも、むずかしいのははつおんです。", "はつおん"), "発音")

    def test_only_the_topic_marker_opens_on_nothing(self) -> None:
        # The catalogue writes its patterns from their particle (にちがいない,
        # にしか), and a に after a comma may open on a longer word: MeCab's
        # next reading there is a shorter noun (にち, にし, にじ + か + ん),
        # so only a は's is taken.
        self.assertEqual([m.surface for m in morphology.tokenize("にちがいない")][:2], ["に", "ちがい"])
        self.assertEqual([m.surface for m in morphology.tokenize("にしか")], ["に", "しか"])
        self.assertNotIn("にじ", cut("だいたいまいばん、にじかんぐらいつづいています。"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class WhatTheSentenceSaysTests(unittest.TestCase):
    """Plan 306: readings and cards the hand-written answers of the
    conversation, dictation and comprehension banks disagreed with, each
    decided by what the sentence says and pinned beside the lookalike it
    must leave alone."""

    def card(self, sentence: str, surface: str) -> str:
        return token_of(sentence, surface)["vocab_match"]["entry"]["kanji"]

    def test_inside_is_entered_where_someone_can(self) -> None:
        # 入れる as 入る's potential, はいれる: no object, no place a thing
        # goes into, and the phrase says who can or when
        for sentence, surface in (("うん、日曜日なら入れる。", "入れる"),
                                  ("土曜日は入れますが、日曜日はどうしても都合がつかないんです。", "入れ"),
                                  ("週に何日ぐらい入れそうですか。", "入れ"),
                                  ("うん、きっぷを持っている人しか入れないよ。", "入れ"),
                                  ("四人では入れないから", "入れ"),
                                  ("でも、きっぷがないと入れないんじゃない？", "入れ"),
                                  ("待たずに入れるから", "入れる"),
                                  ("この店は誰でも入れます。", "入れ")):
            with self.subTest(sentence=sentence):
                token = token_of(sentence, surface)
                self.assertEqual(token["lemma"], "入る")
                self.assertTrue(token["reading"].startswith("はいれ"))
                self.assertEqual(self.card(sentence, surface), "入る")
        # ...and 入れる, to put in, wherever a thing is put somewhere
        for sentence, surface in (("ねぎは入れますか。", "入れ"), ("砂糖は毎日入れます。", "入れ"),
                                  ("冷蔵庫に入れる。", "入れる"), ("お茶を入れましょう。", "入れ"),
                                  ("えびの天ぷらも入れてください。", "入れ"), ("次からは入れないようにします。", "入れ"),
                                  ("いいえ、入れなくてもいいです。", "入れ"),
                                  ("前の日のえさが残っていたら、新しくは入れない。", "入れ"),
                                  ("このきっぷはここに入れますか。", "入れ"),
                                  ("父はそこにさとうもたくさん入れます。", "入れ")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["lemma"], "入れる")

    def test_a_person_said_politely(self) -> None:
        # 方 かた after a noun the dictionary calls a person, and before
        # には after what someone did
        for sentence in ("はい、学生の方は千五百円になります。", "社員の方の同意は必要ございません。",
                         "退職日までに資料をすべて整理し、後任の方に責任を持って引き継ぎます。",
                         "では、落とし主の方に、お名前をお伝えしてもよろしいですか。",
                         "わかりました。拾った方には、お礼を受け取る権利があります。",
                         "お留守中に男の方がお見えになりました。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, "方")["reading"], "かた")
        # ...never where the sentence compares, goes toward someone, or the
        # noun's first sense is no person (上 "above")
        for sentence in ("学生の方が多いです。", "先生より学生の方がたくさん来ました。", "先生の方を見た。",
                         "母の方へ歩いていった。", "本は上の方に置いてください。", "駅の近くの方が便利です。",
                         "大きく見える方を選んだ。", "食べた方がいいですよ。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, "方")["reading"], "ほう")

    def test_readings_by_the_period_the_amount_and_the_unit(self) -> None:
        for sentence, surface, reading in (("先月末をもちまして、退職させていただきました。", "末", "まつ"),
                                           ("翌月末にお支払いいただけますか。", "末", "まつ"),
                                           ("三月の末に引っ越します。", "末", "すえ"),
                                           ("悩んだ末に決めた。", "末", "すえ"),
                                           ("全量八パーセント引きでご検討ください。", "引き", "びき"),
                                           ("五百円引きのクーポン", "引き", "びき"),
                                           ("線を引きました。", "引き", "ひき"),
                                           ("今朝は三十七度八分ありました。", "分", "ぶ"),
                                           ("打率は三割一分です。", "分", "ぶ"),
                                           ("九時三十分に来た。", "分", "ぷん"),
                                           ("温度は二十度で、五分待った。", "分", "ふん")):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertEqual(token_of(sentence, surface)["reading"], reading)
        self.assertEqual(token_of("今朝は三十七度八分ありました。", "八")["reading"], "はち")

    def test_the_while_of_that(self) -> None:
        # その間 and この間 before a comma as before a particle: あいだ
        for sentence in ("二週間ですか。その間、このヘッドホンを使っていてもいいですか。", "この間、駅で先生に会いました。",
                         "その間に準備しておきます。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, "間")["reading"], "あいだ")
        # ...and a suffix before a comma stays the suffix
        self.assertEqual(token_of("今月中、ずっと忙しい。", "中")["reading"], "ちゅう")

    def test_a_pet_named_in_katakana(self) -> None:
        # a word in katakana, no loanword, as the subject of what only an
        # animal or a person does, or after an animal and its の, is a name
        for sentence, surface in (("ボールを見せると、ポチは急に元気になって、にわを走りはじめました。", "ポチ"),
                                  ("ポチは私によく会っているので、すぐになれると思っていました。", "ポチ"),
                                  ("となりの山本さんが旅行に行くので、犬のポチをあずかることになりました。", "ポチ"),
                                  ("つぎの朝、クロは妹のベッドの上でねていました。", "クロ"),
                                  ("タマが鳴いた。", "タマ")):
            with self.subTest(sentence=sentence):
                token = token_of(sentence, surface)
                self.assertIsNone(token.get("vocab_match"))
                self.assertIn("name", (token.get("gloss") or {}).get("en", ""))
        # ...never a colour said of nothing done, a loanword, an animal's food
        for sentence, surface, meaning in (("クロは好きな色です。", "クロ", "black"), ("ペンギンが泳ぐ。", "ペンギン", "penguin"),
                                           ("犬のエサを買った。", "エサ", "feed")):
            with self.subTest(sentence=sentence):
                self.assertTrue(token_of(sentence, surface)["vocab_match"]["entry"]["meaning"].startswith(meaning))

    def test_a_kana_homograph_by_what_it_is_said_of(self) -> None:
        # あつい, やさしい, せき and のる in kana: the card the clause says
        # (a comma after a topic ends no clause)
        for sentence, surface, kanji in (("ドイツのなつは、あまりあつくありません。", "あつく", "暑い"),
                                         ("今日はあつくてたまらない。", "あつく", "暑い"),
                                         ("おゆがとてもあつくて、わたしは五分だけ入りました。", "あつく", "熱い"),
                                         ("あついおふろが大すきです。", "あつい", "熱い"),
                                         ("あついじしょですね。", "あつい", "厚い"),
                                         ("ルーカスさんは、やさしい日本語が分かります。", "やさしい", "易しい"),
                                         ("予想に反して、試験はやさしかった。", "やさしかっ", "易しい"),
                                         ("やさしい先生です。", "やさしい", "優しい"),
                                         ("その店は少し高かったですが、八人のせきがありました。", "せき", "席"),
                                         ("せきはもういっぱいでした。", "せき", "席"),
                                         ("せきがでます。", "せき", "咳"),
                                         ("地図にのっていない小さな店にも入ってみた。", "のっ", "載る"),
                                         ("電車にのって学校へ行きます。", "のっ", "乗る")):
            with self.subTest(sentence=sentence):
                self.assertEqual(self.card(sentence, surface), kanji)
        # (plan 272's own: the wind, then a cold, across a comma after て)
        winds = [t for t in analysis.analyze_local("かぜがつよくて、かぜをひいた。")["tokens"] if t["surface"] == "かぜ"]
        self.assertEqual([t["vocab_match"]["entry"]["kanji"] for t in winds], ["風", "風邪"])

    def test_what_opens_of_itself(self) -> None:
        # 開く あく, "to open (by itself)", where nothing is opened
        for sentence, surface in (("何時まで開いていますか。", "開い"), ("ドアが開いた。", "開い"),
                                  ("風でドアが開きました。", "開き"), ("店が開くか開かないか見てきて。", "開く"),
                                  ("開く時刻は変わらず、閉まる時刻が二時間遅くなる。", "開く")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kana"], "あく")
                self.assertTrue(token_of(sentence, surface)["reading"].startswith("あ"))
        # ...and ひらく with an object, an event held, what opens out, a shop
        # founded on a date, and a bank at its hour, which is either (the
        # dictation bank reads it ひらきます)
        for sentence, surface in (("自分の店を開くつもりです。", "開く"), ("パーティーを開きます。", "開き"),
                                  ("本を開いてください。", "開い"), ("大会が開かれる。", "開か"),
                                  ("花が開いた。", "開い"), ("傘が開かない。", "開か"),
                                  ("この店は先月開いたばかりです。", "開い"),
                                  ("雨のばあいは、つぎの日曜日の十九日に開きます。", "開き"),
                                  ("銀行は何時に開きますか。", "開き")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kana"], "ひらく")

    def test_a_card_read_as_none_of_its_readings_gives_way(self) -> None:
        # a word that does not inflect is said as the page reads it: in
        # kana, the word the letters spell (ぶちょう, 部長, which MeCab heard
        # as 不調 voiced otherwise); in kanji, JMdict's row of that reading
        # where its sense is another (中 じゅう, "all through", 等 ら, the
        # plural), or the point that row is
        self.assertEqual(self.card("ぶちょうは何と言っていましたか。", "ぶちょう"), "部長")
        self.assertEqual(self.card("最近、体の調子が不調だ。", "不調"), "不調")
        for sentence in ("あの人は世界中を旅しています。", "明日は一日中雨だそうです。",
                         "一日中さいふを使いませんでした。", "その警備員は一晩中勤務だった。"):
            with self.subTest(sentence=sentence):
                token = token_of(sentence, "中")
                self.assertEqual((token["reading"], token["pos"]), ("じゅう", "suffix"))
                self.assertNotEqual(((token.get("vocab_match") or {}).get("entry") or {}).get("kana"), "ちゅう")
                self.assertIn("〜中", [g["pattern"] for g in token.get("grammar") or []])
        self.assertEqual(token_of("今は授業中です。", "中")["vocab_match"]["entry"]["kana"], "ちゅう")
        self.assertEqual(token_of("俺を奴等と一緒にするな。", "等")["vocab_match"]["entry"]["kana"], "ら")
        self.assertEqual(token_of("机の上に本、ノート等がある。", "等")["vocab_match"]["entry"]["kana"], "とう")
        self.assertEqual(token_of("来館された方に見どころを説明する。", "見どころ")["vocab_match"]["entry"]["kana"],
                         "みどころ")
        # ...and the card stands where the two readings are one word, and
        # for the voicing a compound's second half takes
        self.assertEqual(self.card("他人の悪口を言う前に、自分の欠点を直すべきだ。", "悪口"), "悪口")
        for sentence, surface, kanji in (("七時ごろ学校へ行きます。", "ごろ", "頃"), ("魚を三びき買った。", "びき", "匹"),
                                         ("最近は疲れ気味で食欲もない。", "気味", "気味"),
                                         ("大会は予定どおり行われました。", "どおり", "通り"),
                                         ("ほんと？うれしい！", "ほんと", ""), ("そうなんだ。バイトならしょうがないね。", "しょう", "仕様")):
            with self.subTest(sentence=sentence):
                self.assertEqual(self.card(sentence, surface), kanji)
        self.assertEqual(self.card("ジョーンは姉さんと同じように魅力がある。", "姉"), "姉")

    def test_all_of_them_before_a_noun(self) -> None:
        # 皆 cut off before a noun is みな, "all of them"; the prefix かい-
        # makes words UniDic reads whole
        for sentence in ("法学を学んでいる学生が皆法律家になれるというわけではない。", "有名選手は皆天国にいるのだ。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, "皆")["reading"], "みな")
        self.assertEqual(token_of("皆様、おはようございます。", "皆")["reading"], "みな")
        self.assertEqual(token_of("皆既日食を見た。", "皆既日食")["reading"], "かいきにっしょく")
        self.assertEqual(token_of("免許皆伝だ。", "免許皆伝")["reading"], "めんきょかいでん")

    def test_a_letter_left_alone_joins_its_word(self) -> None:
        # a page in kana where MeCab stranded a letter as an interjection
        for sentence, surface, kanji in (("あしたは、こうえんでともだちとテニスをします。", "こうえん", "公園"),
                                         ("このあかいふくはすこしたかいとおもいます。", "あかい", "赤い"),
                                         ("からいカレーはむずかしいから", "からい", "辛い"),
                                         ("まどのそとをみてください。", "まど", "窓"),
                                         ("弟はいつもまどのせきがほしいです。", "まど", "窓"),
                                         ("母とあねがきました。", "あね", "姉"),
                                         ("インターネットにはうそのじょうほうがある。", "うそ", ""),
                                         ("二人はあした何時にどこで会いますか。", "あした", "明日"),
                                         ("かさ、持ってきた？", "かさ", "傘")):
            with self.subTest(sentence=sentence):
                self.assertEqual(self.card(sentence, surface), kanji)
        # ...never a homophone the deck does not mean, a word cut that the
        # letter did not touch, nor an interjection with its comma
        self.assertNotIn("ふん", cut("じゃあ、ごふんまえにのりました。"))
        self.assertNotIn("むし", cut("この駅のじむしつ"))
        self.assertNotIn("なが", cut("とっきゅうで、ながのまでお願いします。"))
        for sentence, words in (("それは、あ、そうだ。", ["あ"]), ("では、また。", ["では"]),
                                ("でも、きっぷがない！", ["でも"]), ("はは、そうか。", ["はは"])):
            with self.subTest(sentence=sentence):
                self.assertTrue(set(words) <= set(cut(sentence)), cut(sentence))
        self.assertEqual(token_of("はは、そうか。", "はは")["pos"], "interjection")   # a laugh, never 母


class ParticleOrCopulaDeTests(unittest.TestCase):
    """Plan 306: で is the case particle or the copula's て form by what
    follows it. The particle where its noun is an argument of what goes
    on in its own clause (仕事で忙しい, 仕事ではメールしか, 窓口でのみ,
    教えあうことで, 一台置くだけで, 父と母と三人で); the copula where a topic,
    the noun said of it and a comma give way to a clause with a subject
    of its own (小さいじしょは千九百円で、ことばは少ない)."""

    def de(self, sentence: str, nth: int = 0) -> str:
        tokens = [t for t in analysis.analyze_local(sentence)["tokens"] if t["surface"] == "で"]
        return tokens[nth]["pos"]

    def test_the_case_particle(self) -> None:
        for sentence in ("疲れていると、仕事で単純な間違いをしがちだ。", "この仕事で大事なのは、丁寧なあいさつだ。",
                         "わたしも仕事ではメールしか使わないが、", "予約した本は、小さな窓口でのみ受け取れます。",
                         "若者は戦火というものを頭でしか知らない。", "クラスの仲間と教えあうことで、成績が上がった。",
                         "はんばい機なら一台置くだけで、二十四時間売り続けてくれる。", "黙ってレジに並ぶだけで、買い物が済む。",
                         "地元の人ならではの案内で、観光客が知らない店をいくつも回れた。",
                         "ふゆ休みに、父と母と三人で、おばあさんのうちへ行きました。", "母はしごとでいませんでした。",
                         "私たちは５時間の旅でぐったりしてしまった。", "会社は問い合わせでてんやわんやだった。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(self.de(sentence), "particle")
        self.assertIn("〜で（理由）", [g["pattern"] for t in analysis.analyze_local("母はしごとでいませんでした。")["tokens"]
                                       if t["surface"] == "で" for g in t.get("grammar") or []])

    def test_the_copula(self) -> None:
        for sentence in ("彼は単なる愚か者でしかない。", "よくあることで、問題ない。", "当然のことをしただけで、ほめるにはあたらない。",
                         "人口は３４１万人で、その７分の１はマオリ族です。", "元気で友人も多い人だ。", "みんなが元気でいられますように。",
                         "これが情熱でなくてなんだろう。", "魚は水中でなければ生きられない。", "窓を開けっぱなしで外出した。",
                         "彼は金持ちで、その上家柄がよい。", "小さいじしょは千九百円で、ことばは少ないですが、かるいです。",
                         "私もその一人で、ひまがあると、ついスマホばかり見がちだった。", "あさからいい天気で、空がとてもきれいでした。",
                         "針は止まったままで、ガラスには細かい傷がついている。", "今日から祭りで、今夜は川で花火大会もあるんです。",
                         "私は学生で、妹は大学で働いている。", "東京は大きいだけで、人はしんせつではありません。",
                         "五人で、一人は単品"):
            with self.subTest(sentence=sentence):
                self.assertEqual(self.de(sentence), "auxiliary")
        # ...and a place, a means or a medium stays the particle before a comma
        for sentence in ("私は駅で、友達に会った。", "彼は電話で、私が行くと言った。", "私はバスで、妹は電車で来た。",
                         "この店で、この本がいちばん高いです。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(self.de(sentence), "particle")
        self.assertEqual(self.de("今日から祭りで、今夜は川で花火大会もあるんです。", 1), "particle")


class AKanaWordCutTests(unittest.TestCase):
    """Plan 306: a word written in kana that MeCab cut into pieces, read
    whole where the cut is one no sentence can mean: a と before a case
    particle (きょうと + へ), a particle swallowed into a verb the deck
    has no card for (はかさない), いたい after a が, もったいない in all
    its forms, an adverb before a case particle (足 + もう + で + も)."""

    def card(self, sentence: str, surface: str) -> str:
        token = token_of(sentence, surface)
        entry = (token.get("vocab_match") or {}).get("entry") or {}
        return entry.get("kanji") or entry.get("kana") or ""

    def test_a_word_ending_on_to(self) -> None:
        for sentence, surface, kanji in (("一度、きょうとへ行ってみたいです。", "きょうと", "京都"),
                                         ("あ、まちがえました。きょうとではなく、おおさかです。", "きょうと", "京都"),
                                         ("せっかくきょうとまで来たんだから、古いおてらを見ていこう。", "きょうと", "京都"),
                                         ("あの先生は、せいとにやさしすぎます。", "せいと", "生徒")):
            with self.subTest(sentence=sentence):
                self.assertEqual(self.card(sentence, surface), kanji)
        # ...never the と of "and" or "with", nor before what is no particle
        self.assertIn("と", cut("今日と明日。"))
        self.assertIn("と", cut("友だちと行きます。"))

    def test_a_particle_read_back_out_of_a_verb(self) -> None:
        for sentence, surface, kanji in (("お金は、友だちにはかさないことにしている。", "かさ", "貸す"),
                                         ("あしたは大切なテストだから、今夜はねないといけない。", "ね", "寝る"),
                                         ("はい、どこにもとまらずに、東京駅まで行きます。", "とまら", "止まる"),
                                         ("夕方には足もうでもいたくなりました。", "うで", "腕")):
            with self.subTest(sentence=sentence):
                self.assertEqual(self.card(sentence, surface), kanji)
        # ...never a verb the deck teaches cut for a commoner one: もどる,
        # はさむ, はなれる, a はやる of what is popular
        for sentence, word in (("それで、家にもどったんですね。", "もどっ"), ("ドアにはさんだ指が、まだ痛い。", "はさん"),
                               ("犬を追いかけて、道からはなれてしまった。", "はなれ"), ("この歌は若者にはやっている。", "はやっ")):
            with self.subTest(sentence=sentence):
                self.assertIn(word, cut(sentence))

    def test_it_hurts_and_a_waste(self) -> None:
        self.assertEqual(self.card("あたらしいくつのせいか、足が少しいたい。", "いたい"), "痛い")
        self.assertEqual(token_of("夕方には足もうでもいたくなりました。", "いたく")["lemma"], "痛い")
        self.assertEqual(token_of("ここにいたい。", "い")["lemma"], "居る")
        self.assertEqual(token_of("彼はいたく感動した。", "いたく")["pos"], "adverb")
        for sentence, surface in (("費用はあまり変わらなかったが、もったいないとは思わない。", "もったいない"),
                                  ("新しい時計を買うのはもったいないから", "もったいない")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["lemma"], "勿体無い")


class NumbersAndCountersTests(unittest.TestCase):
    """Plan 306: a number takes the reading its counter asks for, in kanji
    or in kana (一割 いちわり, 二十箱 にじゅっぱこ, 一ぴき いっぴき); かい in
    kana is 回 unless something is or is done on the floor; a counter keeps
    its number and gives no common noun's card (一本も, no "book"); 十分の一
    is a tenth, 三割余り just over, 一駅前 a station before, 二、三日 a span."""

    def reading(self, sentence: str, surface: str) -> str:
        return token_of(sentence, surface)["reading"]

    def test_the_number_before_its_counter(self) -> None:
        for sentence, surface, said in (("まったく食べない生徒も一割いた。", "一", "いち"),
                                        ("段ボール箱は、二十箱ほどになると思います。", "二十", "にじゅっ"),
                                        ("店の人は、一ぴきずつ、ふくろに入れました。", "一", "いっ"),
                                        ("一かいの入り口に来てください。", "一", "いっ"),
                                        ("夏休みのあいだに、本を十さつ読んだ。", "十", "じゅっ"),
                                        ("わたしは三十さいです。", "三十", "さんじゅっ")):
            with self.subTest(sentence=sentence):
                self.assertEqual(self.reading(sentence, surface), said)
        self.assertEqual(token_of("段ボール箱は、二十箱ほどになると思います。", "二十")["end"], 9)
        self.assertEqual([t["reading"] for t in analysis.analyze_local("二十箱ほど。")["tokens"][:2]], ["にじゅっ", "ぱこ"])
        self.assertEqual(self.reading("一つください。", "一つ"), "ひとつ")
        self.assertEqual(self.reading("帰りは一駅前で降りる。", "一"), "ひと")

    def test_times_or_floor(self) -> None:
        for sentence, kanji in (("いもうとは三かいしましたが、だめでした。", "回"), ("かならず二かいかぞえます。", "回"),
                                ("会が二かいになって、うれしい。", "回"), ("くすりを一日三かい、ごはんの後に飲む。", "回"),
                                ("きんぎょすくいは一かい三百円です。", "回"), ("一かいの入り口に来てください。", "階"),
                                ("おてあらいは二かいでございます。", "階"), ("みどりビルの三かいで、クラスがあります。", "階"),
                                ("二かいには子どものへやがあります。", "階")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, "かい")["vocab_match"]["entry"]["kanji"], kanji)
        for sentence in ("何かい書いても、字が小さい。", "何かいれんしゅうしても、うまく言えません。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, "かい")["vocab_match"]["entry"]["kanji"], "回")
        self.assertIn("いい", cut("何かいいことあった？"))

    def test_a_counter_is_its_numbers(self) -> None:
        for sentence in ("たばこは一本も吸っていない。", "雨の日には何十本も集まるそうだ。"):
            with self.subTest(sentence=sentence):
                token = token_of(sentence, "本")
                self.assertIsNone(token.get("vocab_match"))
                self.assertIn("counter", token["gloss"]["en"])
        self.assertEqual(cut("十分の一ほどのにもつ。")[:2], ["十", "分"])
        self.assertEqual(token_of("時間は十分にある。", "十分")["reading"], "じゅうぶん")
        self.assertEqual(cut("帰りは一駅前で降りる。")[2:5], ["一", "駅", "前"])
        self.assertIn("駅前", cut("駅前で会いましょう。"))
        self.assertIn("just over", token_of("二十代の投票率は三割余りにとどまった。", "余り")["gloss"]["en"])
        self.assertEqual(token_of("あまりおいしくない。", "あまり")["vocab_match"]["entry"]["kana"], "あまり")
        span = analysis.analyze_local("では、二、三日中にご連絡しますね。")["tokens"]
        self.assertEqual([t["reading"] for t in span if t["surface"] in ("三", "日")], ["さん", "にち"])
        self.assertFalse([t for t in span if t["surface"] in ("三日", "日中")])
        self.assertEqual(self.reading("三日休みます。", "三日"), "みっか")
        self.assertIn("年生", cut("しかし、三年生になると、行きたくないと言った。"))


class AKanaVerbByWhatItTakesTests(unittest.TestCase):
    """Plan 306: a verb in kana another deck verb could be is read by what
    it takes in its own clause -- the subject (雨がふり出す, 実がなる,
    のどがかわく, 窓口はあく, あの子は、おこった), the object (手がはなせない,
    写真…とった), and a passive's object (うそをつかれた, no 疲れる)."""

    def card(self, sentence: str, surface: str) -> str:
        entry = (token_of(sentence, surface).get("vocab_match") or {}).get("entry") or {}
        return entry.get("kanji") or entry.get("kana") or ""

    def test_by_what_it_takes(self) -> None:
        for sentence, surface, kanji in (
                ("花から花へ飛んで、実がなるのを助けるむしもいるからだ。", "なる", "生る"),
                ("料理をしている最中にチャイムが鳴っても、手がはなせず、出られない。", "はなせ", "離す"),
                ("駅に着いたところで、雨がふり出した。", "ふり出し", "降り出す"),
                ("風が強くなると、雨がふり出す。", "ふり出す", "降り出す"),
                ("この写真は、母が子どものころにとったものに相違ない。", "とっ", "撮る"),
                ("あの子は、おこったかと思うと、すぐに笑い出した。", "おこっ", "怒る"),
                ("あの先生は、いつもおこっていて、こわい。", "おこっ", "怒る"),
                ("たとえ日曜日でも、駅の窓口はあいています。", "あい", "開く"),
                ("のどがかわきましたね。", "かわき", "渇く"),
                ("のどが、かわきましたか。", "かわき", "渇く"),
                ("となりのおじいさんが、きのうなくなりました。", "なくなり", "亡くなる")):
            with self.subTest(sentence=sentence):
                self.assertEqual(self.card(sentence, surface), kanji)
        # ...and the lookalikes it must leave alone
        for sentence, surface, kanji in (("トマトが赤くなるまで、ただ待つしかない。", "なる", "なる"),
                                         ("日本語がはなせない。", "はなせ", "話す"),
                                         ("せんたくものがかわいた。", "かわい", "乾く"),
                                         ("せきがあいていますか。", "あい", "空く")):
            with self.subTest(sentence=sentence):
                self.assertEqual(self.card(sentence, surface), kanji)

    def test_a_passive_with_its_object(self) -> None:
        self.assertEqual(cut("あの人を信じればこそ、うそをつかれた悲しみは大きかった。")[9:12], ["つか", "れ", "た"])
        self.assertEqual(self.card("あの人を信じればこそ、うそをつかれた悲しみは大きかった。", "つか"), "吐く")
        self.assertIn("つかれ", cut("つかれたので、休みます。"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class AKanaNounByItsClauseTests(unittest.TestCase):
    """Plan 306: a noun written in kana is the homophone its clause says
    -- where it is and whose it is (まどがわのせき, そのせきはわたしのです),
    what it is used for (このきかいの使い方), what draws or runs it (せんを
    引く, となりのせん), what comes before and after it (このへんに; へんな
    味), what it is the oil or the fat of, the colour it is uneven in, and
    who speaks of themselves as うち -- each beside the homophone it
    leaves alone."""

    def test_the_card_its_clause_names(self) -> None:
        for sentence, surface, card in (
                ("ふじさんを見るために、まどがわのせきをおねがいします。", "せき", "vocab_N4_席_せき"),
                ("ちょっと言いにくいんですが、そのせきはわたしのです。", "せき", "vocab_N4_席_せき"),
                ("こちらが、おきゃくさまのおせきです。", "せき", "vocab_N4_席_せき"),
                ("かぜでせきが出る。", "せき", "vocab_N3_咳_せき"),
                ("のどは痛いですが、せきはありません。", "せき", "vocab_N3_咳_せき"),
                ("それに、紙の本なら、読んでいる途中で気に入った文にせんを引いたり、ページの間にメモをはさんだりできる。",
                 "せん", "vocab_N4_線_せん"),
                ("あぶないから、白いせんの前に出るな。", "せん", "vocab_N4_線_せん"),
                ("あ、アナウンスだ。となりのせんの人が乗るまで、この電車は待つって。", "せん", "vocab_N4_線_せん"),
                ("せんえんです。", "せん", "vocab_N5_千_せん"),
                ("このきかいの使い方を教えてもらえませんか。", "きかい", "vocab_N3_機械_きかい"),
                ("きっぷは、あのきかいでも買えますよ。", "きかい", "vocab_N3_機械_きかい"),
                ("機会があれば行きたい。", "機会", "vocab_N4_機会_きかい"),
                ("すみません、このへんにコンビニがありますか。", "へん", "vocab_N5_辺_へん"),
                ("ここらへんで休もう。", "へん", "vocab_N5_辺_へん"),
                ("ちょっとへんだね。", "へん", "vocab_N4_変_へん"),
                ("このへんな人は誰？", "へん", "vocab_N4_変_へん"),
                ("このスープはへんな味がする。", "へん", "vocab_N4_変_へん"),
                ("くちへん", "へん", "vocab_N1_偏_へん"),
                ("少しあぶらが多かったですが、家族はおいしいと言って、ぜんぶ食べました。", "あぶら", "vocab_N3_油_あぶら"),
                ("チェーンにあぶらがないから", "あぶら", "vocab_N3_油_あぶら"),
                ("肉のあぶらが多い。", "あぶら", "vocab_N2_脂_あぶら"),
                ("山の中の小さいむらで、おばあさんと二人で住む。", "むら", "vocab_N5_村_むら"),
                ("では早速ですが、うちは今、週末と閉店までの時間に入れる方を探しているんです。", "うち",
                 "vocab_N4__うち"),
                ("うちに帰る。", "うち", jmdict.vocab_jmdict_to_id(jmdict.get_by_key("家", "うち"))),
                ("あまりのあつさに、ホームでたおれた人がいた。", "あつ", "vocab_N5_暑い_あつい"),
                ("本のあつさは三センチだ。", "あつ", "vocab_N5_厚い_あつい")):
            with self.subTest(sentence=sentence):
                self.assertEqual(card_of(sentence, surface), card)

    def test_unevenness_is_the_pools(self) -> None:
        self.assertEqual(card_of("わずかなゆがみや色のむらが、かえってその器にしかない表情となるからだ。", "むら"),
                         jmdict.vocab_jmdict_to_id(jmdict.get_by_key("斑", "むら")))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class TheAuditsSmallClassesTests(unittest.TestCase):
    """Plan 306: a conjunction where it opens its sentence and its pieces
    inside a clause; a point's piece without a homograph's card; a prefix
    read as its compound and a suffix voiced in it; 〜ようが〜まいが one
    verb said twice; an idiom whose verb the page writes in kana."""

    def test_one_word_or_its_pieces(self) -> None:
        for sentence, surface, card in (
                ("そこで母が「電気代が下がったら、おすしを食べに行こう」と言うと、弟はストーブを使わなくなりました。",
                 "そこで", "vocab_N3__そこで"),
                ("そこで、日曜日はスマホを家に置いて出かけることにしている。", "そこで", "vocab_N3__そこで"),
                ("そこである町は昨年、高齢者向けの予約制バスを走らせ始めた。", "そこで", "vocab_N3__そこで"),
                ("そこである町は昨年、高齢者向けの予約制バスを走らせ始めた。", "ある", "vocab_N3_或る_ある"),
                ("すると父が「車で二時間の山の町に、いいおんせんがあるよ」と言いました。", "すると", "vocab_N4__すると"),
                ("どうしてもお金がひつようなので、ここではたらかせてください。", "どうしても", "vocab_N3__どうしても"),
                ("七時に母がかえって、「おいしいですね。」と言いました。", "かえっ", "vocab_N5_帰る_かえる"),
                ("新しい薬を使ってみたところ、かえって頭が痛くなった。", "かえって", "vocab_N2_却って_かえって"),
                ("ですから、周りの目を気にすることはありません。", "ですから", "vocab_N3__ですから")):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertEqual(card_of(sentence, surface), card)
        self.assertEqual(cut("そこで待っていてください。")[:2], ["そこ", "で"])
        self.assertEqual(cut("すると言いました。")[:2], ["する", "と"])
        self.assertEqual(cut("先生は今、＿＿＿ですから、また後で来てください。")[7:9], ["です", "から"])
        self.assertIn("かもしれない", cut("いろいろな問題が＿＿＿＿かもしれない。"))
        self.assertEqual(cut("問題はそこである。")[2:5], ["そこ", "で", "ある"])

    def test_a_points_piece(self) -> None:
        for sentence, surface, card in (
                ("その静けさは、一日歩いた疲れと相まって、深く心にしみた。", "まっ", None),
                ("ええ。でも、みなさん食べきりますよ。", "きり", None),
                ("電車のドアに、かばんがはさまりかけた。", "かけ", None),
                ("親を亡くした彼の悲しみは、察するにかたくない。", "かたく", "vocab_N1_難い_かたい"),
                ("この紙をはさみで切ってください。", "切っ", "vocab_N5_切る_きる"),
                ("壁に絵を掛けた。", "掛け", "vocab_N4_掛ける_かける")):
            with self.subTest(sentence=sentence):
                self.assertEqual(card_of(sentence, surface), card)

    def test_a_prefix_or_a_suffix_in_its_compound(self) -> None:
        self.assertEqual(token_of("小さな事故でも大けがにつながりかねない。", "大けが")["reading"], "おおけが")
        self.assertEqual(token_of("彼は不器用ゆえに、損をすることが多い。", "不器用")["reading"], "ぶきよう")
        self.assertEqual(token_of("営業部では、資料作りはもとより、打ち合わせにも同席した。", "作り")["reading"], "づくり")
        self.assertEqual(token_of("ここは昔、「みなと通り」という名前がついた。", "通り")["reading"], "どおり")
        self.assertEqual(token_of("その通りです。", "その通り")["reading"], "そのとおり")   # (one word, plan 306)
        self.assertEqual(token_of("二通りの方法がある。", "通り")["reading"], "とおり")
        self.assertEqual(token_of("彼はしきりと一財産作りたがっている。", "作り")["reading"], "つくり")

    def test_one_verb_said_twice(self) -> None:
        self.assertEqual(cut("参加しようがしまいが、費用は同じだ。")[1:5], ["しよう", "が", "し", "まい"])
        self.assertIn("伏せよう", cut("名前を伏せようが伏せまいが、言葉が誰かに届く以上、その重みは変わらない。"))
        self.assertIn("〜ようが〜まいが", grammar_detect_patterns(
            "名前を伏せようが伏せまいが、言葉が誰かに届く以上、その重みは変わらない。"))
        self.assertEqual(card_of("あの人が会社をやめようがやめまいが、私の仕事は変わらない。", "やめ"),
                         "vocab_N3_辞める_やめる")
        self.assertEqual(cut("書きようがない。")[:3], ["書き", "よう", "が"])
        self.assertEqual(cut("しまいには泣いた。")[0], "しまい")

    def test_an_idiom_whose_verb_is_in_kana(self) -> None:
        self.assertEqual(card_of("百年も続いている店だけあって、細かいところまで気がきいている。", "気がきい"),
                         jmdict.vocab_jmdict_to_id(jmdict.get_by_key("気が利く", "きがきく")))
        self.assertEqual(card_of("かつて俗語として眉をひそめられたものが少なくない。", "ひそめ"),
                         jmdict.vocab_jmdict_to_id(jmdict.get_by_key("顰める", "ひそめる")))
        self.assertEqual(card_of("声をひそめて話した。", "ひそめ"),
                         jmdict.vocab_jmdict_to_id(jmdict.get_by_key("潜める", "ひそめる")))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class ARadicalsHenTests(unittest.TestCase):
    """Plan 306: a へん glued to a noun is a kanji's left-hand radical, 偏
    (いしへん, あしへん); the west's negative へん follows a verb."""

    def test_the_radical(self) -> None:
        for sentence in ("いしへん", "あしへん"):
            with self.subTest(sentence=sentence):
                self.assertEqual(card_of(sentence, "へん"), "vocab_N1_偏_へん")
        for sentence in ("今日は行かへん。", "そんなこと知らへん"):
            with self.subTest(sentence=sentence):
                self.assertIsNone(card_of(sentence, "へん"))


class TheWordThePageSpelledTests(unittest.TestCase):
    """Plan 306: the card is the word the page spelled -- in its own kanji
    where JMdict holds them as a word of their own (温かく, 架ける, 抑え),
    never where JMdict's one word is written two ways (充分, 眼); by what is
    warm in kana (あたたかいおでん 温かい, あたたかい部屋 暖かい); by the
    conjugation the page shows (信じれば is 信じる, 信ずる's is 信ずれば);
    by what is reached (数百万トンにのぼる 上る); by what is scooped
    (きんぎょすくい)."""

    def card(self, sentence: str, surface: str) -> str:
        entry = (token_of(sentence, surface).get("vocab_match") or {}).get("entry") or {}
        return entry.get("kanji") or entry.get("kana") or ""

    def test_the_card_is_the_word_spelled(self) -> None:
        for sentence, surface, kanji in (
                ("翻訳は、二つの言語の間に橋を架ける仕事だと言われる。", "架ける", "架ける"),
                ("日記には、後悔が、抑えた筆致でつづられている。", "抑え", "抑える"),
                ("この町は景色もさることながら、人が温かい。", "温かい", "温かい"),
                ("ばんごはんは、おばあさんのあたたかいおでんでした。", "あたたかい", "温かい"),
                ("家に帰ってからも、体はずっとあたたかかったです。", "あたたかかっ", "温かい"),
                ("皆様のあたたかいお言葉に、感激にたえません。", "あたたかい", "温かい"),
                ("捨てられる食品が、年間数百万トンにのぼるという。", "のぼる", "上る"),
                ("いもうとは、きんぎょすくいが下手です。", "すくい", "掬い"),
                ("あの話は、とても信じがたい。", "信じ", "信じる"),
                ("あの人を信じればこそ、悲しみは大きかった。", "信じれ", "信じる"),
                ("受けた恩に報いたくても、報いるすべがない。", "報い", "報いる")):
            with self.subTest(sentence=sentence):
                self.assertEqual(self.card(sentence, surface), kanji)
        # ...and the card stands for one word written two ways, the weather,
        # a mountain, help, the literary ずる where the page writes it
        for sentence, surface, kanji in (("水は充分に加熱すると沸騰する。", "充分", "十分"), ("眼は手を見極め得る。", "眼", "目"),
                                         ("もっと良い方法がある。", "良い", "いい/よい"),
                                         ("今日はあたたかいですね。", "あたたかい", "暖かい"),
                                         ("あたたかい部屋で休む。", "あたたかい", "暖かい"), ("山にのぼる。", "のぼる", "登る"),
                                         ("神のすくいを求める。", "すくい", "救い"), ("神を信ずる。", "信ずる", "信ずる"),
                                         ("この文章は意味を成さない。", "成さ", "為す")):
            with self.subTest(sentence=sentence):
                self.assertEqual(self.card(sentence, surface), kanji)


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class NamesAndCommonWordsTests(unittest.TestCase):
    """Plan 306: a name where the sentence names someone (a letter's
    addressee, its signature, two names joined), a common word where it
    says one (まえのせき is no 前野 Seki), a place's sense where one comes
    from it, and katakana letters MeCab read as marks one word."""

    def test_a_name_where_someone_is_named(self) -> None:
        for sentence, surface, gloss in (
                ("森様、いつもお世話になっております。", "森", "family name"),
                ("アナより", "アナ", "a person's name"),
                ("ゆいより", "ゆい", "given name"),
                ("ゆうたとけんたは友だちです。", "ゆうた", "given name"),
                ("ゆうたとけんたは友だちです。", "けんた", "given name"),
                ("たなかさんはどこですか。", "たなか", "family name")):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertEqual(gloss_of(sentence, surface), gloss)
                self.assertIsNone(card_of(sentence, surface))
        # ...and the common word where the sentence says one
        for sentence, surface, card in (
                ("大きな森の中を歩きました。", "森", "vocab_N4_森_もり"),
                ("皆様、こんにちは。", "皆", "vocab_N4_皆_みな"),
                ("コーヒーより", "コーヒー", "vocab_N5__コーヒー"),
                ("母より", "母", "vocab_N5_母_はは"),
                ("心より", "心", "vocab_N4_心_こころ"),
                ("まえのせきにすわってください。", "まえ", "vocab_N5_前_まえ"),
                ("まえのせきにすわってください。", "せき", "vocab_N4_席_せき"),
                ("高いへいがあります。", "へい", "vocab_N3_塀_へい")):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertEqual(card_of(sentence, surface), card)

    def test_a_common_word_by_its_clause(self) -> None:
        for sentence, card in (
                ("男の人は、どうしてはしのせきにすわりたいのですか。", "vocab_N3_端_はし"),
                ("黒ずくめの男が、ホームのはしに立っていた。", "vocab_N3_端_はし"),
                ("はしがうまく使えないので、フォークをください。", "vocab_N5__はし"),
                ("このはし＿＿＿わたって、右にまがってください。", "vocab_N5_橋_はし")):
            with self.subTest(sentence=sentence):
                self.assertEqual(card_of(sentence, "はし"), card)

    def test_a_place_one_comes_from(self) -> None:
        meaning = lambda sentence: token_of(sentence, "タイ")["vocab_match"]["entry"]
        self.assertTrue(meaning("私はタイから日本に来て、大学で勉強しています。")["meaning"].startswith("Thailand"))
        self.assertEqual(meaning("来年タイへ行きます。")["meaning_fr"], "Thaïlande")
        self.assertEqual(meaning("ネクタイの代わりにタイを締める。")["meaning"], "tie")

    def test_katakana_letters_read_as_marks(self) -> None:
        sentence = "十月に販売した電気ケトル「ミナモ」の約二千台に、ふたが閉まりにくい不具合が見つかりました。"
        self.assertIn("ミナモ", cut(sentence))
        self.assertEqual(cut("ミアです。")[0], "ミア")
        self.assertEqual(token_of(sentence, "ミナモ")["pos"], "noun")
        # (one letter alone stays the letter it is)
        self.assertEqual(cut("「ア」と書いてください。")[:3], ["「", "ア", "」"])


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class WhichVerbAnEStemIsTests(unittest.TestCase):
    """Plan 306: the verb an え-row stem belongs to, read off its clause:
    入る's potential where a person goes in, 慣れる where nothing is
    become, the ichidan verb a られる or a を shows, 思える and 気が引ける
    of themselves, a kana stem's godan verb by its object, and a す verb's
    potential where a thing is acted on."""

    def verb(self, sentence: str, surface: str) -> tuple[str | None, list[str]]:
        t = token_of(sentence, surface)
        return (t.get("vocab_match") or {}).get("raw_id"), [g["pattern"] for g in t.get("grammar") or []]

    def test_the_verb_its_clause_names(self) -> None:
        for sentence, surface, card, potential in (
                ("わかりました。着く前に、お風呂に入れますか。", "入れ", "vocab_N5_入る_はいる", True),
                ("実は、日曜日に入る予定だった田中さんが、急に来られなくなっちゃって。代わりに入れない？", "入れ",
                 "vocab_N5_入る_はいる", True),
                ("では早速ですが、うちは今、週末と閉店までの時間に入れる方を探しているんです。", "入れる",
                 "vocab_N5_入る_はいる", True),
                ("ポチは私によく会っているので、すぐになれると思っていました。", "なれる", "vocab_N4_慣れる_なれる", False),
                ("だんだんなれてきた。", "なれ", "vocab_N4_慣れる_なれる", False),
                ("制度を本来の目的に近づけられるかどうかは、これからのルール作り次第だ。", "近づけ",
                 "vocab_N2_近付ける_ちかづける", False),
                ("もうこれ以上、食費は減らせっこない", "減らせ", "vocab_N3_減らす_へらす", True),
                ("この車を動かせない。", "動かせ", "vocab_N3_動かす_うごかす", True),
                ("宿題を早く済ませた。", "済ませ", "vocab_N3_済ませる_すませる", False),
                ("わたしはピアノがひけない。", "ひけ", "vocab_N5_弾く_ひく", True),
                ("線をひけますか。", "ひけ", "vocab_N5_引く_ひく", True),
                ("てんじのへやでは、写真はとれません。", "とれ", "vocab_N5_撮る_とる", True)):
            with self.subTest(sentence=sentence):
                card_now, points = self.verb(sentence, surface)
                self.assertEqual(card_now, card)
                self.assertEqual("可能形 〜(ら)れる" in points, potential)
        # (a feeling one cannot help, an idiom: no "can")
        self.assertEqual(token_of("自分はこの仕事に向いていないのではないかと思えてならないのです。", "思え")["lemma"], "思える")
        self.assertNotIn("可能形 〜(ら)れる",
                         self.verb("自分はこの仕事に向いていないのではないかと思えてならないのです。", "思え")[1])
        self.assertEqual(token_of("今さら断るのはどうにも気が引ける。", "気が引ける")["lemma"], "気が引ける")

    def test_the_lookalikes_keep_theirs(self) -> None:
        for sentence, surface, card, potential in (
                ("お風呂にお湯を入れる。", "入れる", "vocab_N5_入れる_いれる", False),
                ("荷物は車に入れますか。", "入れ", "vocab_N5_入れる_いれる", False),
                ("砂糖は入れる方がいい。", "入れる", "vocab_N5_入れる_いれる", False),
                ("きっと医者になれる。", "なれる", "vocab_N5__なる", True),
                ("もう大人になれた。", "なれ", "vocab_N5__なる", False),
                ("目標に近づける。", "近づける", "vocab_N3_近付く_ちかづく", True),
                ("川で魚がとれる。", "とれる", "vocab_N3_取れる_とれる", False),
                ("ボタンがとれた。", "とれ", "vocab_N3_取れる_とれる", False),
                ("体重が減った。", "減っ", "vocab_N3_減る_へる", False),
                ("日本語が話せる。", "話せる", "vocab_N5_話す_はなす", True)):
            with self.subTest(sentence=sentence):
                card_now, points = self.verb(sentence, surface)
                self.assertEqual(card_now, card)
                self.assertEqual("可能形 〜(ら)れる" in points, potential)
        # (someone made to do it keeps the causative)
        for sentence in ("子どもを泣かせてしまった。", "母を待たせた。"):
            with self.subTest(sentence=sentence):
                self.assertIn("使役形 〜させる", [g["pattern"] for t in analysis.analyze_local(sentence)["tokens"]
                                                for g in t.get("grammar") or []])


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class ANounsNiOrAnAdverbsTests(unittest.TestCase):
    """Plan 306: だ's に after a word that may be a な-adjective is the case
    particle where the sentence makes the word a noun (modified by の, an
    adnominal or a clause); よう's に is never an adjective's; と after a
    word said "as" what is felt is no manner."""

    def ni(self, sentence: str, word: str) -> dict:
        tokens = analysis.analyze_local(sentence)["tokens"]
        k = next(k for k, t in enumerate(tokens) if t["surface"] == "に" and k and tokens[k - 1]["surface"] == word)
        return tokens[k]

    def test_a_nouns_ni(self) -> None:
        for sentence, word in (
                ("小さな誤解でも、命の危険につながることがあり得るのだ。", "危険"),
                ("治療の効果が実際より大きく見える危険にまで及ぶ。", "危険"),
                ("彼女は多くの困難に耐え、ついに夢を実現した。", "困難"),
                ("ホームの端は、お客様の安全に＿＿＿、黄色い線の内側までお下がりください。", "安全"),
                ("すみません、このへんにコンビニがありますか。", "へん"),
                ("春めく陽気に誘われて、近郊の丘陵まで足を延ばした。", "陽気")):
            with self.subTest(sentence=sentence):
                token = self.ni(sentence, word)
                self.assertEqual(token["pos"], "particle")
                self.assertNotIn("〜く／〜に（副詞形）", [g["pattern"] for g in token.get("grammar") or []])

    def test_an_adverbs_ni(self) -> None:
        for sentence, word, point in (("安全に運転してください。", "安全", False), ("元気に遊んでいる。", "元気", False),
                                      ("静かに話しましょう。", "静か", True), ("きれいに書いてください。", "きれい", True),
                                      ("とても静かに話す。", "静か", True)):
            with self.subTest(sentence=sentence):
                token = self.ni(sentence, word)
                self.assertEqual(token["pos"], "auxiliary")
                self.assertEqual("〜く／〜に（副詞形）" in [g["pattern"] for g in token.get("grammar") or []], point)
        # (...and the noun's own なる keeps its point: 迷惑になる)
        self.assertIn("〜くなる／〜になる", {g["pattern"] for g in analysis.analyze_local("人の迷惑になる。")["grammar"]})

    def test_its_own_ni_and_what_it_is_felt_as(self) -> None:
        # (はやく keeps its own: 早い said adverbially)
        self.assertNotIn("〜く／〜に（副詞形）",
                         [g["pattern"] for g in self.ni("あしたの朝、バスがはやく＿＿＿ように。", "よう").get("grammar") or []])
        self.assertIn("〜く／〜に（副詞形）",
                      [g["pattern"] for g in token_of("あしたの朝、バスがはやく＿＿＿ように。", "はやく").get("grammar") or []])
        for sentence in ("それを当然と感じられること自体が、証しなのだ。", "それを当然と思う。"):
            with self.subTest(sentence=sentence):
                self.assertTrue(token_of(sentence, "と")["gloss"]["en"].startswith("(before 感じる"))
        self.assertTrue(token_of("彼女は堂々と話した。", "と")["gloss"]["en"].startswith("(after an adverb)"))
        # ...and ように's, みたいに's に say what they are, in both languages
        for sentence, word in (("15番のバスと同じように、本町通りを走る。", "よう"), ("今日は春みたいにあたたかいですね。", "みたい")):
            with self.subTest(sentence=sentence):
                gloss = self.ni(sentence, word)["gloss"]
                self.assertTrue(gloss["en"].startswith("(after よう, みたい)") and gloss["fr"])
        self.assertEqual(cut("ように"), ["よう", "に"])


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class AVerbsStemOrANounTests(unittest.TestCase):
    """Plan 306: a verb's stem or a noun, by what follows it -- お〜になる
    and 〜つ〜つ take a stem, の, が, を and ある a noun, and a flower's
    さく is 咲く."""

    def test_the_word_its_neighbours_make_it(self) -> None:
        for sentence, surface, card, pos in (
                ("はい、そうです。つぎの電車におのりになりますか。", "のり", "vocab_N5_乗る_のる", "verb"),
                ("お客様の席は取ってありますので、お並びになるには＿＿＿。", "並び", "vocab_N5_並ぶ_ならぶ", "verb"),
                ("波が寄せ＿＿＿返しつ、砂浜の足あとを消していった。", "返し", "vocab_N5_返す_かえす", "verb"),
                ("この資料は、コピーを取ってもさしつかえありませんが、持ち出しはできません。", "さしつかえ",
                 "vocab_N2_差し支え_さしつかえ", "noun"),
                ("さくらも、もうすぐさくかな。", "さく", "vocab_N5_咲く_さく", "verb"),
                ("このやり方は、時間的にむりです。", "やり", "vocab_N5__やる", "verb"),
                ("ひっこしの日、友だちはだれもてつだってくれなかった。", "ひっこし", "vocab_N3_引越し_ひっこし", "noun")):
            with self.subTest(sentence=sentence):
                token = token_of(sentence, surface)
                self.assertEqual(((token.get("vocab_match") or {}).get("raw_id"), token["pos"]), (card, pos))
        self.assertIn("お〜になる／お〜する", {g["pattern"] for g in analysis.analyze_local(
            "はい、そうです。つぎの電車におのりになりますか。")["grammar"]})

    def test_the_lookalikes_keep_theirs(self) -> None:
        for sentence, surface, card in (("のりで紙をはる。", "のり", "vocab_N2_糊_のり"),
                                        ("書留で送ってください。", "書留", "vocab_N2_書留_かきとめ"),
                                        ("来月ひっこす。", "ひっこす", "vocab_N4_引っ越す_ひっこす"),
                                        ("庭のさくをなおした。", "さく", "vocab_N1_柵_さく"),
                                        ("帰りの電車に乗る。", "帰り", "vocab_N4_帰り_かえり"),
                                        ("いつもお世話になっております。", "世話", "vocab_N4_世話_せわ")):
            with self.subTest(sentence=sentence):
                self.assertEqual(card_of(sentence, surface), card)
        self.assertEqual(token_of("やりを投げる。", "やり")["vocab_match"]["entry"]["kanji"], "槍")
        # (おしまい, "the end", is a word of its own, no しまう said up)
        self.assertEqual(token_of("これでおしまいになります。", "おしまい")["vocab_match"]["entry"]["meaning"][:7], "the end")
        self.assertNotIn("お〜になる／お〜する", {g["pattern"] for g in analysis.analyze_local("これでおしまいになります。")["grammar"]})
        self.assertEqual(token_of("彼は食べもしないで帰った。", "食べ")["pos"], "verb")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class ToIiToIiTests(unittest.TestCase):
    """Plan 306: both いい of 〜といい〜といい are 言う, no 良い."""

    def test_both_are_said(self) -> None:
        tokens = analysis.analyze_local("重さといい手ざわりといい、これは本物ではなさそうだ。")["tokens"]
        said = [t for t in tokens if t["surface"] == "いい"]
        self.assertEqual([t["lemma"] for t in said], ["言う", "言う"])
        self.assertTrue(all(not t.get("vocab_match") or "良い" not in t["vocab_match"]["entry"].get("kanji", "")
                            for t in said))
        self.assertEqual(token_of("天気がいいといいですね。", "いい")["lemma"], "良い")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class APersonsKataBySentenceTests(unittest.TestCase):
    """Plan 306: 方 is かた, a person said politely, where its sentence
    says so -- before の and what only a person has, before what a person
    is asked or said up to do, after a description before an honorific
    request -- and ほう where it compares, goes toward or places a thing."""

    def readings(self, sentence: str) -> list[str]:
        return [t["reading"] for t in analysis.analyze_local(sentence)["tokens"] if t["surface"] == "方"]

    def test_a_person(self) -> None:
        for sentence, said in (
                ("その場合は、同意のない方の発話を、すでにすべて削除いたしました。", ["かた"]),
                ("その場合は、同意をいただいていない方の声を記録から消し、分析の対象から外します。", ["かた"]),
                ("三か月たっても落とし主が見つからなければ、財布は拾った方のものになります。", ["かた"]),
                ("では、お返事の際は、上の方にもお越しいただけますか。", ["かた"]),
                ("また、お年寄りや足の悪い方で、公園まで来るのが難しい方は、前の日までに町内会にお知らせください。",
                 ["かた", "かた"]),
                ("このエレベーターは、車いすの方に限らず、どなたでもご利用いただけます。", ["かた"])):
            with self.subTest(sentence=sentence):
                self.assertEqual(self.readings(sentence), said)

    def test_a_side(self) -> None:
        for sentence in ("こちらの方が安いです。", "駅の方へ歩いた。", "早く行った方がいい。", "上の方に置いてください。",
                         "拾った方が早い。", "安い方をください。", "上の方にお置きください。", "大きい方は、あとで食べます。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(self.readings(sentence), ["ほう"])


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class MadeGlossTests(unittest.TestCase):
    """Plan 306: まで's gloss by what it does -- "even" in its verb's
    object's place, no "until" before the copula of 〜までのことだ."""

    def test_its_gloss(self) -> None:
        self.assertTrue(gloss_of("畑で農薬を使い過ぎると、近くの井戸の水まで汚しかねない。", "まで").startswith("even"))
        self.assertNotEqual(gloss_of("駅員として、するべきことをしたまでです。", "まで"), "until (it happens)")
        self.assertEqual(gloss_of("子どもが大人になるまで見守る。", "まで"), "until (it happens)")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class AWordOfItsOwnCardTests(unittest.TestCase):
    """Plan 306: the words a point no longer owns say what they are."""

    def test_their_cards_and_glosses(self) -> None:
        self.assertEqual(card_of("駅からホテルまで、どうやって行く？", "行く"), "vocab_N5_行く_いく")
        self.assertEqual(card_of("まわりの人はみんな、見ないふりをして通りすぎていく。", "通りすぎ"),
                         "vocab_N3_通り過ぎる_とおりすぎる")
        gloss = token_of("しかし、あの二時間にはそれだけのお金を払う意味があると思う。", "だけ")["gloss"]
        self.assertTrue(gloss["en"].startswith("(after それ") and gloss["fr"])


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class AConstructionsPieceCardTests(unittest.TestCase):
    """Plan 306: だから of だからといって is no "so, therefore", and
    the 見る after a compound particle's て is the verb, no 〜てみる."""

    def test_its_card(self) -> None:
        surfaces = [t["surface"] for t in analysis.analyze_local("だからといって、数字を捨ててしまえばそれまでだ。")["tokens"]]
        self.assertNotIn("だから", surfaces)
        self.assertEqual(card_of("だから、行かない。", "だから"), "vocab_N4__だから")
        # (見られる after にわたって is "be seen", the verb's own card)
        for sentence in ("その習慣は、日本全国にわたって見られる。", "その習慣は、日本全国＿＿＿わたって見られる。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(card_of(sentence, "見"), "vocab_N5_見る_みる")
        self.assertIsNone(card_of("この問題について考えてみる。", "みる"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class ATeAtTheEndGlossTests(unittest.TestCase):
    """Plan 306: a て left at the end, ね or よ after it, trails off; one
    before a blank joins what the blank holds."""

    def test_its_gloss(self) -> None:
        trailing = token_of("この駅は小さいがゆえに、皆が顔見知りでしてね。", "て")["gloss"]["en"]
        self.assertTrue(trailing.startswith("(at the end)"))
        self.assertTrue(token_of("電車が遅れてね。", "て")["gloss"]["en"].startswith("(at the end)"))
        self.assertTrue(token_of("去年、会社を辞めてね。今はフリーランスなんだ。", "て")["gloss"]["en"]
                        .startswith("(at the end)"))
        self.assertTrue(token_of("社長、この手紙を読んで＿＿＿。", "で")["gloss"]["en"].startswith("the て form"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class AKanjiVerbByWhatGoesWithItTests(unittest.TestCase):
    """Plan 306: a kanji verb whose written form fits two verbs is read
    by what its sentence gives it -- what gets through 通る, a deed carried
    out 行う, おく after 放っ 放る, 開ける before 開く あく -- and keeps
    UniDic's reading where nothing says otherwise."""

    def test_its_reading(self) -> None:
        for sentence, surface, reading, raw_id in (
                ("大変申し訳ございません。確認しましたら、ご注文がキッチンに通っていなかったようです。", "通っ", "とおっ",
                 "vocab_N4_通る_とおる"),
                ("ある市は、三年前に行った調査をもとに制度を始めた。", "行っ", "おこなっ", "vocab_N4_行う_おこなう"),
                ("十年以上にわたって放っておかれる家も少なくない。", "放っ", "ほうっ", "vocab_N2_放る_ほうる"),
                ("そんなの放っとけばいい。", "放っ", "ほうっ", "vocab_N2_放る_ほうる"),
                ("まどを開けようとしたが、開かなかった。", "開か", "あか", "vocab_N5_開く_あく"),
                ("月末って、三十一日のこと？その日は開いてるの？", "開い", "あい", "vocab_N5_開く_あく"),
                ("すみません、十分前に頼んだパスタの注文、ちゃんと通っていますか。", "通っ", "とおっ", None),
                ("兄は三回目の挑戦で司法試験に通った。", "通っ", "とおっ", None),
                ("さっき車で通った橋の名前、覚えてる？", "通っ", "とおっ", None),
                ("山奥のこの村には、今も鉄道が通っていない。", "通っ", "とおっ", None),
                ("市が毎年春に行っている清掃活動に、今年も参加した。", "行っ", "おこなっ", None),
                ("前回の会議で行った説明に、一部誤りがありました。", "行っ", "おこなっ", None),
                ("ジャムの瓶のふたが固くて、どうしても開かない。", "開か", "あか", None),
                ("上司のあまりに勝手な言い分に、開いた口がふさがらなかった。", "開い", "あい", None),
                # (UniDic's, where the sentence says it)
                ("交渉は思ったよりうまく行った。", "行っ", "いっ", None),
                ("私が通っていた小学校は、去年廃校になった。", "通っ", "かよっ", None),
                ("言葉は分からなくても、二人の心は確かに通っていた。", "通っ", "かよっ", None),
                ("武将はあらかじめ敵の城に間者を放っておいたので、相手の動きをすべてつかんでいた。", "放っ", "はなっ", None),
                ("この店は先月開いたばかりです。", "開い", "ひらい", None),
                # (UniDic's reading where nothing says otherwise)
                ("毎日学校に通っている。", "通っ", "かよっ", None),
                ("人が毎日学校に通っている。", "通っ", "かよっ", None),
                ("三年前に行った国", "行っ", "いっ", None),
                ("本を開いてる。", "開い", "ひらい", None),
                ("花が開いてる。", "開い", "ひらい", None)):
            with self.subTest(sentence=sentence):
                token = token_of(sentence, surface)
                self.assertEqual(token["reading"], reading)
                if raw_id:
                    self.assertEqual(card_of(sentence, surface), raw_id)


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class AKuFormByWhatFollowsTests(unittest.TestCase):
    """Plan 306: a く form is the noun 近く／遠く before a case particle,
    the adverb 危うく "nearly" before its clause, and the adjective where
    it is denied (近くはない) or becomes so (危うくなった); and ほど before it
    is a particle of its own where no particle stands before (それほど
    とおくもない), 程遠い only after one (完成にはほどとおい)."""

    def test_its_word(self) -> None:
        for sentence, surface, pos, raw_id in (
                ("お母さんもお父さんも、ちかくにいませんでした。", "ちかく", "noun", None),
                ("もう少し近くまで来て。", "近く", "noun", None),
                ("凍った道で足を滑らせて、危うく自転車にぶつかるところだった。", "危うく", "adverb", None),
                ("近くはない。", "近く", "adjective", "vocab_N5_近い_ちかい"),
                ("駅から遠くもありません。", "遠く", "adjective", None),
                ("会社の経営が危うくなった。", "危うく", "adjective", None),
                ("駅に近くて便利だ。", "近く", "adjective", None),
                ("駅からそれほどとおくもありませんし。", "とおく", "adjective", "vocab_N5_遠い_とおい"),
                ("昔の友達を前ほどちかく感じなくなった。", "ちかく", "adjective", "vocab_N5_近い_ちかい"),
                ("夜ふかしは体によくはないと分かっている。", "よく", "adjective", None),
                ("よくはわからない。", "よく", "adverb", None)):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["pos"], pos)
                if raw_id:
                    self.assertEqual(card_of(sentence, surface), raw_id)

    def test_hodo_tooi_after_a_particle(self) -> None:
        self.assertEqual(token_of("完成にはほどとおい。", "ほどとおい")["pos"], "adjective")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class AnAdverbsSenseTests(unittest.TestCase):
    """Plan 306: an adverb's sense by what it says of -- ここ before a span
    of time "these past", まず before a denial the N3 先ず's "hardly", 別に
    before a verb with nothing denied 別 and に, "separately"."""

    def test_its_sense(self) -> None:
        for sentence in ("スマートフォンだけで代金を払える店が、ここ数年で急に増えた。", "ここ二、三日、雨が続いている。",
                         "ここ半年の売り上げを見れば、効果ははっきりしている。"):
            with self.subTest(sentence=sentence):
                token = token_of(sentence, "ここ")
                self.assertIsNone(token.get("vocab_match"))
                self.assertTrue(token["gloss"]["en"].startswith("(before a span of time)") and token["gloss"]["fr"])
        for sentence in ("ここに置いてください。", "ここで二日間も足止めされた。", "ここに引っ越してきて、もう三年になる。"):
            with self.subTest(sentence=sentence):
                self.assertIsNotNone(token_of(sentence, "ここ").get("vocab_match"))
        for sentence in ("初めての町でも道に迷うことはまずない。",
                         "街灯の少ない山奥ならいざ知らず、都市部で天の川を目にすることは、今ではまず不可能だ。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(card_of(sentence, "まず"), "vocab_N3_先ず_まず")
        for sentence in ("この程度の熱なら、まず大丈夫でしょう。", "あの部長が賛成することは、まずないと思う。",
                         "心配しなくていいよ。まずそんなことは起こらないから。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(card_of(sentence, "まず"), "vocab_N3_先ず_まず")
        for sentence in ("まず手を洗いましょう。", "まずご飯を食べない？", "契約する前に、まず条件をよく確認しないといけない。",
                         "何事もまずやってみないと分からないよ。", "引っ越しが決まったけど、まず何から始めればいいんだろう。",
                         "新しい職場では、まず焦らないことが大切だ。",
                         "私たちは写真家が子供をまず助け出さなかったといって非難した。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(card_of(sentence, "まず"), "vocab_N4__まず")
        for sentence in ("おべんとうとお茶は、別にはらいます。", "パスポートは別に保管してください。",
                         "それとは別に、もう一つお伝えしたい問題があります。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(card_of(sentence, "別"), "vocab_N4_別_べつ")
                self.assertIn("separately", token_of(sentence, "に")["gloss"]["en"])
        for sentence in ("別に何も言わなかった。", "別に、いいよ。", "別にいいよ。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(card_of(sentence, "別に"), "vocab_N3_別に_べつに")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class FromAFeelingGlossTests(unittest.TestCase):
    """Plan 306: a から of a cause says so -- 焦りから "out of", 心から
    "from the heart" -- where no point holds it."""

    def test_its_gloss(self) -> None:
        self.assertTrue(gloss_of("焦りから、簡単な計算をまちがえてしまった。", "から").startswith("out of"))
        self.assertTrue(gloss_of("皆さんあっての私です。心から感謝します。", "から").startswith("心から"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class MonoInItsConstructionTests(unittest.TestCase):
    """Plan 306: the もの of 〜ものの, 〜もので, 〜ものだ is the
    construction's, no 物 "thing"; a もの said of a thing keeps it."""

    def test_its_card(self) -> None:
        for sentence, surface in (("先週、ダイエットを＿＿＿ものの、三日でやめてしまった。", "もの"),
                                  ("ちょっと用があるもんで、先に帰るね。", "もん"),
                                  ("大学は出たものの、まだ仕事が見つからない。", "もの")):
            with self.subTest(sentence=sentence):
                self.assertIsNone(card_of(sentence, surface))
        self.assertIsNotNone(card_of("この箱の中のものを出して。", "もの"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class TheCopulaDeniedGlossTests(unittest.TestCase):
    """Plan 306: the copula's で before ない says "is not"."""

    def test_its_gloss(self) -> None:
        for sentence in ("これは本でない。", "彼は学生でなく、先生だ。", "町のものでないことは明らかだ。"):
            with self.subTest(sentence=sentence):
                self.assertTrue(gloss_of(sentence, "で").startswith("(the copula) で before ない"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class AnHonorificReruGlossTests(unittest.TestCase):
    """Plan 306: the honorific れ says so."""

    def test_its_gloss(self) -> None:
        for sentence in ("どうされますか。", "来館された方に説明する。", "先生が本を書かれた。"):
            with self.subTest(sentence=sentence):
                self.assertTrue(gloss_of(sentence, "れ").startswith("(honorific)"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class NaniInItsSetPhrasesTests(unittest.TestCase):
    """Plan 306: 何 is なに in 何にもまして and 何一つ; 何にも alone keeps
    なんにも."""

    def test_its_reading(self) -> None:
        for sentence, surface, reading in (("その時間が、何にもまして気楽なのだ。", "何", "なに"),   # (何 + 〜にもまして's に)
                                           ("急いで出てきたので、何一つ持ってこなかった。", "何", "なに"),
                                           ("何ひとつ分からない。", "何", "なに"), ("何にも知らない。", "何に", "なんに")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["reading"], reading)


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class NakiAndALoneKanjiTests(unittest.TestCase):
    """Plan 306: 亡き is "the late", なき出す 泣く's, 名もなき's 名 な, and
    園 alone えん (エデンの園 keeps その)."""

    def test_its_word(self) -> None:
        for sentence, surface, reading, raw_id in (
                ("都会に暮らす妹が亡き姉の日記をたどる形で描いている。", "亡き", "なき", None),
                ("その話を聞いたとたんに、母はなき出しました。", "なき", "なき", "vocab_N4_泣く_なく"),
                ("「名もなき家事」という言葉がある。", "名", "な", "vocab_N3_名_な"),
                ("しかし園は、のびのびと動く様子こそが自然の大切さを伝えると考えている。", "園", "えん", "vocab_N1_園_えん"),
                ("エデンの園", "園", "その", "vocab_N1_園_その"),
                ("三名の参加者。", "名", "めい", None)):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["reading"], reading)
                if raw_id:
                    self.assertEqual(card_of(sentence, surface), raw_id)
        self.assertEqual(token_of("都会に暮らす妹が亡き姉の日記をたどる形で描いている。", "亡き")["vocab_match"]["entry"]["kanji"],
                         "亡き")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class NoAfterAPredicateTests(unittest.TestCase):
    """Plan 306: どうの…どうのと is "this and that", no noun's の; わたしの
    keeps it, and so does 新しいのを, "the one" (the の point's own わたしの
    です, pinned by EighthReviewPointTests)."""

    def test_its_gloss(self) -> None:
        self.assertEqual([g["pattern"] for g in token_of("新しいのを買うしかないと思っていた。", "の").get("grammar") or []],
                         ["の"])
        self.assertTrue(gloss_of("猫がどうのと、話は尽きない。", "の").startswith("どうの"))
        self.assertEqual([g["pattern"] for g in token_of("わたしの本です。", "の").get("grammar") or []], ["の"])


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class YoriThanOrFromTests(unittest.TestCase):
    """Plan 306: より after a time before a quality compares (前より元気),
    and a letter's sender's より is "from" (アナより, 母より)."""

    def test_its_gloss(self) -> None:
        self.assertNotIn("(formal) from", gloss_of("今は前より元気で、仕事もがんばることができます。", "より"))
        for sentence in ("アナより", "母より"):
            with self.subTest(sentence=sentence):
                self.assertTrue(gloss_of(sentence, "より").startswith("(formal) from"))
        self.assertNotIn("(formal) from", gloss_of("母より背が高い。", "より"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class ACertainAruTests(unittest.TestCase):
    """Plan 306: ある after an age's, a time's or a place's の is 或る, "a
    certain"; after a thing one has (問題のある人) it is the verb."""

    def test_its_card(self) -> None:
        for sentence in ("七十代のある女性は話す。", "ある時代のある土地の習慣だ。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(card_of(sentence, "ある"), "vocab_N3_或る_ある")
        for sentence in ("問題のある人", "自信のある人は強い。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(card_of(sentence, "ある"), "vocab_N5__ある")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class AKanaWordReadsAsSpelledTests(unittest.TestCase):
    """Plan 306: a word in kana reads as it is spelled, づ and ぢ kept
    (つづら, 働きつづけ), never as the sound merges them (つずら)."""

    def test_its_reading(self) -> None:
        for sentence, surface, reading in (("秘密がつづられている。", "つづら", "つづら"),
                                           ("彼は働きつづけた。", "働きつづけ", "はたらきつづけ"),
                                           ("ツヅラを開けた。", "ツヅラ", "つづら"),
                                           ("気づいた。", "気づい", "きづい"),
                                           ("それは本だ。", "は", "わ")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, surface)["reading"], reading)


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class WhatElseIsItTests(unittest.TestCase):
    """Plan 306: 〜でなくてなんだろう's なん is 何, and 愛 there is the noun,
    no 愛でる ("admire"); 花を愛でなくて keeps the verb."""

    def test_its_words(self) -> None:
        self.assertEqual(token_of("これが私たちの誇りでなくてなんだろう。", "なん")["reading"], "なん")
        self.assertEqual(card_of("これが愛でなくてなんだろう。", "愛"), "vocab_N3_愛_あい")
        self.assertEqual(token_of("これが愛でなくてなんだろう。", "愛")["reading"], "あい")
        self.assertEqual(token_of("花を愛でなくて何をする。", "愛で")["reading"], "めで")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class WhatTheBatchsLookalikesReadTests(unittest.TestCase):
    """Plan 306, the stress set's lookalikes: ある after a season's or a
    district's の is 或る (夏のある夕方, 都内のある病院), after a thing one
    may have the verb (学校のある日); 一同より is a letter's "from"; the
    で before なき出す is the means particle; いったいなんだろう's なん is
    何."""

    def test_its_words(self) -> None:
        for sentence in ("去年の夏のある夕方、私は初めて彼に会った。", "都内のある病院で、新しい治療法が試されている。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(card_of(sentence, "ある"), "vocab_N3_或る_ある")
        self.assertEqual(card_of("学校のある日は早く起きる。", "ある"), "vocab_N5__ある")
        self.assertTrue(gloss_of("三年間、ありがとうございました。三年二組一同より", "より").startswith("(formal) from"))
        self.assertEqual(token_of("大きな声でなき出した。", "で")["pos"], "particle")
        self.assertEqual(token_of("あの白い建物は、いったいなんだろう。", "なん")["reading"], "なん")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class ABareDenialsCopulaTests(unittest.TestCase):
    """Plan 306: ではない said bare, as a lesson prints it, glosses its で
    as the copula's."""

    def test_its_gloss(self) -> None:
        for sentence in ("ではない", "ではないか"):    # (だけではない is 〜だけでなく's, plan 306)
            with self.subTest(sentence=sentence):
                self.assertTrue(gloss_of(sentence, "で").startswith("(the copula) で of ではない"))
        # (までもない said bare, cut ま + で by the tokenizer: no copula)
        self.assertFalse(gloss_of("までもない", "で").startswith("(the copula)"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class TheAuditsSingletonWordsTests(unittest.TestCase):
    """Plan 306, the audit's singletons: 幸多かれ is 幸 さち and 多い's old
    imperative; よる heading a sentence before its comma is 夜; 全部やった
    is やる (雨やった keeps the west's copula); 〜んがため's ん is む; 手
    after a verb's stem is the one who does it (手を洗った keeps the hand)."""

    def test_its_words(self) -> None:
        self.assertEqual(token_of("皆さんの前途に幸多かれと祈り、式辞といたします。", "幸")["reading"], "さち")
        self.assertEqual(token_of("皆さんの前途に幸多かれと祈り、式辞といたします。", "多かれ")["lemma"], "多い")
        self.assertEqual(token_of("よる、母がやさいのスープをつくりました。", "よる")["pos"], "noun")
        self.assertEqual(token_of("店によると、休みだそうだ。", "よる")["pos"], "verb")
        for sentence in ("やれることは全部やった。", "宿題やった？"):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, "やっ")["pos"], "verb")
        self.assertEqual(token_of("雨やった。", "やっ")["pos"], "auxiliary")
        self.assertEqual(token_of("母を助けんがため、働いた。", "ん")["lemma"], "む")
        self.assertTrue(gloss_of("引き受け手を見つけるのが難しい。", "手").startswith("(after a verb's stem)"))
        self.assertEqual(card_of("彼は手を洗った。", "手"), "vocab_N5_手_て")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class TheStressSetsOlderWordsTests(unittest.TestCase):
    """Plan 306, what the stress sentences found that predated them:
    なんのかんの, 多かれ少なかれ and なくてはならない read whole; やった、
    is "hooray"; the west's 泣き虫やった is the copula's past; 本屋によると
    is 寄る; よるにしか is 夜; 何にもまして's まして is 増す; 三年二組 にくみ;
    じしん by its clause; まめ is 忠実; 園 alone is the kindergarten too."""

    def test_its_words(self) -> None:
        for sentence, surface, kanji in (("弟はなんのかんのと言い訳をした。", "なんのかんの", "何のかんの"),
                                         ("多かれ少なかれ、誰でも緊張する。", "多かれ少なかれ", "多かれ少なかれ"),
                                         ("この地域ではなくてはならない交通手段だ。", "なくてはならない", "無くてはならない"),
                                         ("会社の帰りに駅前の本屋によると、画集が並んでいた。", "よる", "寄る"),
                                         ("新聞によると、雨だそうだ。", "よる", "因る"),
                                         ("おばけはよるにしか出てこない。", "よる", "夜"),
                                         ("子どもの安全は何にもまして優先される。", "まして", "増す"),
                                         ("夜中に大きなじしんがあって、皿が割れた。", "じしん", "地震"),
                                         ("じしんがない。", "じしん", "自信"),
                                         ("彼じしんの問題だ。", "じしん", "自身"),
                                         ("親への連絡をまめにする。", "まめ", "忠実")):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"]["kanji"], kanji)
        self.assertEqual(token_of("やった、ついに合格だ！", "やった")["pos"], "interjection")
        self.assertEqual(token_of("宿題やった？", "やっ")["pos"], "verb")
        self.assertEqual(token_of("行かなくてはならない。", "なら")["pos"], "verb")
        for sentence in ("子どもの頃は、ほんまに泣き虫やったんやで。", "明日が休みやったら、一緒に映画でも行かへん？"):
            with self.subTest(sentence=sentence):
                self.assertTrue(gloss_of(sentence, "やっ").startswith("(Kansai) was"))
        self.assertEqual(card_of("明日が休みやったら、一緒に映画でも行かへん？", "休み"), "vocab_N5_休み_やすみ")
        self.assertEqual(token_of("三年間ありがとうございました。三年二組一同より", "二")["reading"], "に")
        self.assertEqual(token_of("二組の手袋。", "二")["reading"], "ふた")
        self.assertTrue(gloss_of("部屋の片付けを適当にしたら、母に叱られた。", "に").startswith("makes an adverb"))
        self.assertIn("kindergarten", token_of("娘の通う園では体操をします。", "園")["vocab_match"]["entry"]["meaning"])


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class TheOlderFixesLookalikeWordsTests(unittest.TestCase):
    """Plan 306, the second stress set: 寄る in every form after a place
    (家によりました, よらないで, 神社によろうか -- no 鎧う), 店によらず and
    町による違い keep 因る; なんだかんだ, おおかれすくなかれ and その通り。
    read whole; かんちゃん is a name; まめをまいた is 豆; 適当に書いて is the
    adverb; 休みやったら is the noun and the west's copula even with no
    other word of the west; じしんがあったら、机の下に is 地震."""

    def test_its_words(self) -> None:
        for sentence, surface, kanji in (("友だちの家によりました。", "より", "寄る"),
                                         ("コンビニにはよらないで帰った。", "よら", "寄る"),
                                         ("神社によろうか。", "よろう", "寄る"),
                                         ("うちにもよってください。", "よっ", "寄る"),
                                         ("店によらず同じ値段だ。", "よら", "因る"),
                                         ("なんだかんだ言っても、実家がいい。", "なんだかんだ", ""),
                                         ("どこの家庭にも、おおかれすくなかれ問題はある。", "おおかれすくなかれ", "多かれ少なかれ"),
                                         ("「その通り。」", "その通り", "その通り"),
                                         ("鬼に向かってまめをまいた。", "まめ", "豆"),
                                         ("じしんがあったら、まず机の下に入りましょう。", "じしん", "地震")):
            with self.subTest(sentence=sentence, surface=surface):
                self.assertEqual(token_of(sentence, surface)["vocab_match"]["entry"].get("kanji") or "", kanji)
        # (町による違い: 〜によって's, whose verb is the point's, plan 152)
        self.assertEqual(token_of("町による違いがある。", "よる")["lemma"], "因る")
        self.assertEqual(token_of("その通りを渡った。", "通り")["surface"], "通り")
        self.assertEqual(gloss_of("なんだ、かんちゃんか。", "かん"), "given name")
        self.assertTrue(gloss_of("レポートを適当に書いて出した。", "に").startswith("makes an adverb"))
        self.assertTrue(gloss_of("あの店、休みやったら別のとこ行こか。", "やっ").startswith("(Kansai) was"))
        self.assertEqual(token_of("宿題やった？", "やっ")["pos"], "verb")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class ACompoundWithYaruTests(unittest.TestCase):
    """Plan 306, the judges' row: 追いやった is one verb, 追いやる, no
    west's copula after a verb's stem (休みやったら keeps it)."""

    def test_its_gloss(self) -> None:
        self.assertFalse(gloss_of("朝日が霧をおいやった。", "やっ").startswith("(Kansai)"))
        self.assertTrue(gloss_of("明日が休みやったら、行かへん？", "やっ").startswith("(Kansai) was"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class WordsReadByWhatTheySayOfTests(unittest.TestCase):
    """Plan 311: a reading the tokenizer takes from the wrong neighbour.
    一日中 is 一日 and 中, "all through", never 日中, "the daytime", and the
    雨 after it is あめ, no 雷雨's う; 空く is すく of a stomach or a train
    (お腹が空いた, 電車が空いていた), あく of a seat, a room or an hour; 角
    is a street's かど where it is turned at or pointed at, a horn つの on
    an animal, an angle かく in a figure."""

    def test_all_day(self) -> None:
        for sentence in ("一日中雨が降っていた。", "昨日は一日中家にいた。", "一日中雨で、少しさむかったです。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(card_of(sentence, "一日"), "vocab_N5_一日_いちにち")
                self.assertEqual(token_of(sentence, "中")["reading"], "じゅう")
        self.assertEqual(token_of("一日中雨が降っていた。", "雨")["reading"], "あめ")
        self.assertEqual(token_of("日中雨が降った。", "雨")["reading"], "あめ")
        self.assertEqual(token_of("日中雨が降った。", "日中")["reading"], "にっちゅう")
        self.assertEqual(token_of("暴風雨になった。", "暴風雨")["reading"], "ぼうふうう")

    def test_suku_and_aku(self) -> None:
        for sentence in ("お腹が空いた。", "おなかが空いた。", "お腹空いた。", "電車が空いていた。", "空いた電車に乗った。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, "空い")["reading"], "すい")
                self.assertEqual(card_of(sentence, "空い"), "vocab_N3_空く_すく")
        for sentence in ("席が空いている。", "部屋が空いている。", "空いた時間に本を読む。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, "空い")["reading"], "あい")

    def test_kado_tsuno_kaku(self) -> None:
        for sentence, said in (("あの角を右に曲がってください。", "かど"), ("次の角を左に曲がる。", "かど"),
                               ("角の店でパンを買った。", "かど"), ("牛の角は硬い。", "つの"), ("角が生えた。", "つの"),
                               ("三角形の角を測る。", "かく"), ("人形の角", "かど")):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, "角")["reading"], said)
        self.assertEqual(card_of("あの角を右に曲がってください。", "角"), "vocab_N5_角_かど")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class WordsCutOrJoinedWrongTests(unittest.TestCase):
    """Plan 311: 食どう is 食堂, its second kanji in kana, where a case
    particle follows (お茶どう？ asks "how about tea"); the で after a noun
    is the case particle, never a sentence's "and so" before a comma
    (会社のちかくで、) or a verb's voiced て (入り口のちかくでつくる), and
    one opening a sentence keeps its "so"; ようこそ is one word."""

    def test_its_words(self) -> None:
        self.assertEqual(card_of("学校の食どうでごはんを食べます。", "食どう"), "vocab_N5_食堂_しょくどう")
        self.assertEqual(token_of("お茶どう？", "どう")["pos"], "adverb")
        for sentence in ("会社のちかくで、パンも買ったよ。", "カードは入り口のちかくでつくることができます。",
                         "じゃあ、わたしはいえでまってるね。", "じゃあ、5ばんで行きます。"):
            with self.subTest(sentence=sentence):
                de = token_of(sentence, "で")
                self.assertEqual((de["pos"], de["lemma"]), ("particle", "で"))
                self.assertIn("で", [g["pattern"] for g in de.get("grammar") or []])
        self.assertNotEqual(token_of("で、どうしたの？", "で")["pos"], "particle")
        for sentence in ("山川旅館へようこそ。", "ようこそ、日本へ！"):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, "ようこそ")["pos"], "interjection")
        self.assertEqual(token_of("今度こそ合格したい。", "こそ")["pos"], "particle")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class WholeExpressionsTests(unittest.TestCase):
    """Plan 311: an expression the dictionary holds whole, read whole --
    生まれて初めて; お疲れさま, the 様 the dictionary writes for the
    page's さま (no "Mr. or Mrs."); 一期一会, a four-kanji saying none of
    its cards says (期's "time" is no word of "lifetime"); an idiom
    whose adjective carries an ending's point (都合が悪くて, 口が悪くて,
    具合が悪くなる), the point riding on it; the counter 番 written in
    kana after a number (5ばん, さんばん, the number three)."""

    def test_its_words(self) -> None:
        self.assertEqual(token_of("生まれて初めて海を見た。", "生まれて初めて")["vocab_match"]["entry"]["kana"],
                         "うまれてはじめて")
        for sentence in ("お疲れさまです。", "今日もお疲れさま。"):
            with self.subTest(sentence=sentence):
                self.assertIn("hard work", token_of(sentence, "お疲れさま")["vocab_match"]["entry"]["meaning"])
        yoji = token_of("一期一会を大切にしたい。", "一期一会")
        self.assertEqual(yoji["reading"], "いちごいちえ")
        for sentence, surface, meaning in (("すみません、今日はちょっと都合が悪くて。", "都合が悪く", "inconvenient"),
                                           ("彼は口が悪くて嫌われている。", "口が悪く", "sharp"),
                                           ("体の具合が悪くなります。", "具合が悪く", "unwell"),
                                           ("祖父は耳が遠くなり、人の話が聞こえにくかった。", "耳が遠く", "hearing")):
            with self.subTest(sentence=sentence):
                token = token_of(sentence, surface)
                self.assertIn(meaning, token["vocab_match"]["entry"]["meaning"])
                self.assertTrue(token.get("grammar"))
        self.assertEqual(card_of("じゃあ、5ばんで行きます。", "ばん"), "vocab_N5_番_ばん")
        self.assertEqual(card_of("そうですか。さんばんはここにきますか。", "さん"), "vocab_N5_三_さん")
        self.assertEqual(token_of("汗ばんでいる。", "で")["lemma"], "て")

    def test_who_is_there(self) -> None:
        for sentence in ("頭を下げる角度や秒数にまで作法があり、それを指南する専門家さえいるという。", "専門家もいる。",
                         "数字の背後にどんな人々がいるのかを想像する。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(card_of(sentence, "いる"), "vocab_N5_居る_いる")
        self.assertEqual(card_of("お金がいる。", "いる"), "vocab_N5_要る_いる")
        self.assertIn("lost", token_of("実家がなくなった。", "なくなっ")["vocab_match"]["entry"]["meaning"])


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class AMarketAndOutrageousTests(unittest.TestCase):
    """Plan 311: 市場 is いちば where goods are bought or sold there (市場で
    魚を買った, 毎朝市場へ行く, 魚市場), しじょう where it is the economy's
    (株式市場, 市場経済, 国内の市場は小さい); とんでもない is one adjective,
    the deck's card, never とんでも, "unthinkable", and its denial."""

    def test_ichiba_and_shijou(self) -> None:
        for sentence in ("市場で魚を買った。", "毎朝市場へ行く。", "父は毎朝早く起きて、市場へ花を買いに行く。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, "市場")["reading"], "いちば")
                self.assertEqual(card_of(sentence, "市場"), "vocab_N3_市場_いちば")
        self.assertEqual(token_of("国内の市場は小さい。", "市場")["reading"], "しじょう")
        self.assertEqual(token_of("株式市場が混乱した。", "株式市場")["reading"], "かぶしきしじょう")

    def test_tondemonai(self) -> None:
        for sentence, surface in (("とんでもないです。", "とんでもない"), ("とんでもない話だ。", "とんでもない"),
                                  ("とんでもなく高い。", "とんでもなく")):
            with self.subTest(sentence=sentence):
                self.assertEqual(card_of(sentence, surface), "vocab_N3__とんでもない")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class WhatSaidNothingTests(unittest.TestCase):
    """Plan 311: parts the gap report found silent -- a name in hiragana
    a speaker gives themselves (花やのたかはしです, たかはしと申します) or
    says alone in its quote (「まさと。」), never a common noun read so
    (かおりです); つつ, "while" in writing; the も of も同然; もの ending
    what is said, "because" (時間がなかったんだもの); and an adjective in
    ない the deck teaches whole, in any of its forms (つまらなそう,
    つまらなかった, つまらなさ) -- no 詰まる and no negative."""

    def test_names(self) -> None:
        for sentence, surface, said in (("わたしは、こうえんの前の花やのたかはしです。", "たかはし", "family name"),
                                        ("男の子は「まさと。」と言いました。", "まさと", "given name"),
                                        ("たかはしと申します。", "たかはし", "family name")):
            with self.subTest(sentence=sentence):
                self.assertEqual(gloss_of(sentence, surface), said)
        self.assertIsNotNone(token_of("かおりです。", "かおり").get("vocab_match"))

    def test_function_words(self) -> None:
        self.assertTrue(gloss_of("失われるものを知りつつ、言葉を探す。", "つつ").startswith("(written"))
        self.assertTrue(gloss_of("ここまで来れば、終わったも同然だ。", "も").startswith("(も同然)"))
        self.assertTrue(gloss_of("だって、時間がなかったんだもの。", "もの").startswith("(sentence end) because"))
        self.assertIsNotNone(token_of("これは私のものです。", "もの").get("vocab_match"))

    def test_an_adjective_in_nai(self) -> None:
        for sentence, surface in (("彼はつまらなそうな顔をしていた。", "つまらな"), ("この映画はつまらなかった。", "つまらなかっ"),
                                  ("この映画のつまらなさに驚いた。", "つまらな"), ("この映画はつまらない。", "つまらない")):
            with self.subTest(sentence=sentence):
                token = token_of(sentence, surface)
                self.assertEqual(token["vocab_match"]["entry"]["kana"], "つまらない")
                self.assertNotIn("ない形 〜ない", [g["pattern"] for g in token.get("grammar") or []])
        # (お金がたまらない: money that does not collect, the verb denied)
        self.assertNotEqual((token_of("お金がたまらない。", "たまら").get("vocab_match") or {}).get("entry", {}).get("kana"),
                            "たまらない")
        self.assertIn("ない形 〜ない", [g["pattern"] for g in token_of("お金がたまらない。", "ない").get("grammar") or []])
        self.assertIn("〜さ", [g["pattern"] for g in token_of("やり方には物足りなさもある。", "さ").get("grammar") or []])


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class SayouTests(unittest.TestCase):
    """Plan 311: さよう of さようでございます is the dictionary's 左様, "so",
    which UniDic files under 然様; さようなら keeps its own card."""

    def test_its_card(self) -> None:
        for sentence in ("さようでございますか。", "はい、さようでございます。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(token_of(sentence, "さよう")["vocab_match"]["entry"]["kanji"], "左様")
        self.assertIn("good-bye", token_of("さようなら。", "さようなら")["vocab_match"]["entry"]["meaning"])
        # (ふくさよう is 副作用 in kana: no "so")
        self.assertIsNone(token_of("ふくさようのしんぱいはありませんか。", "さよう").get("vocab_match"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class TakenOrComeOffTests(unittest.TestCase):
    """Plan 311: 取れる in kanji is 取る's potential where what one takes
    is named -- 休みが取れない, 連絡が取れない, 休みさえ取れない -- and
    取れる, "to come off, to be harvested", of a button, a stain, fatigue
    or a catch."""

    def test_its_verb(self) -> None:
        for sentence in ("休みが取れない。", "彼と連絡が取れない。", "時間が取れなかった。", "休みさえ取れない。"):
            with self.subTest(sentence=sentence):
                token = token_of(sentence, "取れ")
                self.assertEqual(token["vocab_match"]["raw_id"], "vocab_N5_取る_とる")
                self.assertIn("可能形 〜(ら)れる", [g["pattern"] for g in token.get("grammar") or []])
        for sentence in ("ボタンが取れた。", "汚れが取れない。", "疲れが取れない。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(card_of(sentence, "取れ"), "vocab_N3_取れる_とれる")
