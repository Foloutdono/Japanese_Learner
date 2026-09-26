"""No false key (plan 150).

A breakdown is read by someone who cannot check it. A rule it misses is
a rule left untaught, which the learner can still look up; a rule it
invents is a lesson about something that is not in the sentence, and
they will learn it. Plan 149 went after the misses. This file holds the
other half: every key the detector lights must be the one the sentence
uses.

Four layers, from the narrowest to the widest:

- **Edge cases**, one rule each, every one paired with the sentence that
  must NOT have the key: でも, とは and とか are two particles each to
  the tokenizer wherever they stand, so it is the detector's own rules
  that tell 誰でも ("anyone") from お茶でも ("tea or something").
- **A gold set**: sentences whose keys were read one by one and are held
  EXACTLY -- a key added or a key lost both fail.
- **Invariants** over every sentence the app teaches from (the lessons,
  the reading and dictation banks) and a slice of JMdict's examples:
  spans inside the sentence, pieces in order, every point a real
  catalogue entry, no punctuation lit, no refused shape anywhere.
- **Hostile input**: empty, blank, Latin, digits, emoji, a newline, a
  very long text -- never an exception, never a span out of range.
"""
import json
import sqlite3
import unittest
from pathlib import Path

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, find
from study import grammar_detect, morphology


def found_in(sentence: str) -> dict[str, str]:
    """pattern -> the text it was found on (the first, if twice)."""
    out: dict[str, str] = {}
    for h in grammar_detect.hits(sentence):
        out.setdefault(h["pattern"], sentence[h["start"]:h["end"]])
    return out


def keys(sentence: str) -> set[tuple[str, str]]:
    return {(h["pattern"], sentence[h["start"]:h["end"]]) for h in grammar_detect.hits(sentence)}


ANY = "何でも／誰でも／いつでも／どこでも"
REQUEST = "〜て／〜ないで（依頼）"


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class QuestionWordDemoTests(unittest.TestCase):
    """でも after a question word is "any-" (the N4 point plan 150
    added); after a noun, an example offered or "even" (〜でも)."""

    def test_a_question_word_and_demo_is_any(self) -> None:
        for sentence, written in (("誰でも入れます。", "誰でも"), ("だれでも入れます。", "だれでも"),
                                  ("なんでも食べる。", "なんでも"), ("いつでも来てください。", "いつでも"),
                                  ("どこでも寝られる。", "どこでも"), ("どれでもいい。", "どれでも"),
                                  ("どちらでもいいです。", "どちらでも"), ("どうでもいい。", "どうでも"),
                                  ("いくらでもある。", "いくらでも"), ("何度でも言う。", "何度でも"),
                                  ("何人でも入れる。", "何人でも"), ("誰にでも分かる。", "誰にでも"),
                                  ("どこにでもある。", "どこにでも"), ("誰とでも話す。", "誰とでも")):
            with self.subTest(sentence=sentence):
                found = found_in(sentence)
                self.assertEqual(found.get(ANY), written)
                self.assertNotIn("〜でも", found)
                # its で is no particle of place, its も no "also"
                self.assertNotIn("で", found)
                self.assertNotIn("も", found)

    def test_nandemonai_is_the_copula_not_anything(self) -> None:
        # 何でもない, "it's nothing": the copula's でもない.
        for sentence in ("何でもない。", "何でもありません。"):
            with self.subTest(sentence=sentence):
                found = found_in(sentence)
                self.assertNotIn(ANY, found)
                self.assertNotIn("〜でも", found)
                self.assertIn("です／だ", found)

    def test_apparently_is_not_anything(self) -> None:
        found = found_in("何でも、彼は結婚したそうだ。")
        self.assertNotIn(ANY, found)
        self.assertNotIn("で", found)
        self.assertNotIn("も", found)

    def test_itsumademo_has_no_demo(self) -> None:
        # いつまでも, "for ever": まで + も, no で at all.
        self.assertNotIn(ANY, found_in("いつまでも待つ。"))

    def test_a_noun_and_demo_is_the_n5_point(self) -> None:
        for sentence in ("お茶でも飲みませんか。", "本でも読みましょう。", "子どもでも分かる。",
                         "今でも覚えている。", "休みの日でも、六時に起きます。"):
            with self.subTest(sentence=sentence):
                found = found_in(sentence)
                self.assertEqual(found.get("〜でも"), "でも")
                self.assertNotIn(ANY, found)

    def test_demo_that_is_not_the_n5_point(self) -> None:
        # で, then the first letter of もらった.
        self.assertNotIn("〜でも", found_in("学校でもらった本です。"))
        self.assertEqual(found_in("学校でもらった本です。").get("で"), "で")
        # A place + too: で of place, も "also".
        found = found_in("ここでも同じだ。")
        self.assertNotIn("〜でも", found)
        self.assertEqual((found.get("で"), found.get("も")), ("で", "も"))
        # The copula's で: "was a diplomat too", "is not a student either".
        for sentence, written in (("彼は外交官でもあった。", "でもあっ"), ("学生でもない。", "でもない")):
            with self.subTest(sentence=sentence):
                found = found_in(sentence)
                self.assertNotIn("〜でも", found)
                self.assertNotIn("で", found)
                self.assertEqual(found.get("です／だ"), written)
        # でも opening a sentence is "but", which the lesson says it is not.
        found = found_in("でも帰りは楽だよね。")
        self.assertFalse({"〜でも", "で", "も"} & found.keys())
        found = found_in("疲れた。でも楽しかった。")
        self.assertFalse({"〜でも", "で", "も"} & found.keys())


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class TowaTests(unittest.TestCase):
    """〜とは (N1): surprise after a clause, a definition after a noun.
    Everywhere else と + は is two particles."""

    def test_surprise(self) -> None:
        for sentence in ("彼が先生になるとは、思わなかった。", "まさか彼が犯人だとは。",
                         "一日でこんなに変わるとは。", "こんな所で会うとは、驚いた。",
                         "彼が来るとは思わなかった。", "彼が来るとは夢にも思わなかった。",
                         "彼が犯人だとは信じられない。", "彼が犯人だとは信じがたい。",
                         "あの彼が医者になるとは、思いもしなかった。",
                         "彼が優勝するとは、少しも想像できませんでした。", "三度も遅刻するとはね。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(found_in(sentence).get("〜とは"), "とは")

    def test_definition(self) -> None:
        for sentence in ("友情とは、困った時に助け合うことだ。", "愛とは何か。", "幸せとは何だろう。",
                         "幸せとはこういうことだ。", "日本語とは、日本人の言葉です。",
                         "北極圏とは北極周辺の地域の事である。", "人生とは、一抹の泡みたいなものだ。",
                         "教育とは、人を育てることにほかならない。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(found_in(sentence).get("〜とは"), "とは")

    def test_to_and_wa(self) -> None:
        for sentence in (
            "彼とは十年来の知り合いだ。",       # with him
            "私とは関係ない。",
            "東京とは違う。",                   # from Tokyo
            "田中さんとは何を話しましたか。",   # with Tanaka -- 何 asks something else
            "田中さんとは、昨日会いました。",
            "友達とは毎日会う。",
            "行くとは言っていない。",           # a quotation, and は contrasting it
            "勝ちたいとは思わない。",           # an opinion, in the present
            "彼が知っているとは知らない。",
            "うまくいくとは思えない。",
            "言うこととすることとは別問題だ。",  # A と B とは
            "毎日とは言わないまでも、週に一度は運動したい。",
        ):
            with self.subTest(sentence=sentence):
                self.assertNotIn("〜とは", found_in(sentence))

    def test_inside_a_longer_construction(self) -> None:
        # The とは of とはいえ and とは限らない is theirs to explain.
        self.assertIn("〜とはいえ", found_in("春とはいえ、朝晩はまだ冷える。"))
        self.assertNotIn("〜とは", found_in("春とはいえ、朝晩はまだ冷える。"))
        self.assertIn("〜とは限らない", found_in("高いものがいいとは限らない。"))
        self.assertNotIn("〜とは", found_in("食べ物で懐柔されるとは、限りませんからね。"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class TokaAndKaKaTests(unittest.TestCase):

    def test_toka_lists_and_quotes(self) -> None:
        for sentence in ("りんごとかバナナとかが好きだ。", "映画とか見る？", "田中さんは来ないとか言っていた。"):
            with self.subTest(sentence=sentence):
                self.assertEqual(found_in(sentence).get("〜とか"), "とか")

    def test_nantoka_is_a_word(self) -> None:
        # "somehow", "not at all": no list, no "and", no question.
        for sentence in ("何とか間に合った。", "なんとか間に合った。", "何とも言えない。"):
            with self.subTest(sentence=sentence):
                self.assertFalse({"〜とか", "と", "か", "も", "〜か〜か"} & found_in(sentence).keys())
        # But 誰とも is "with anyone": と and も are the particles.
        self.assertEqual(found_in("誰とも話さない。").get("と"), "と")

    def test_a_choice_of_two_is_its_own_two_ka(self) -> None:
        hit = next(h for h in grammar_detect.hits("コーヒーか紅茶か、どちらがいいですか。")
                   if h["pattern"] == "〜か〜か")
        # コーヒー[か]紅茶[か], not the first か and the question's.
        self.assertEqual(hit["segments"], [(4, 5), (7, 8)])
        self.assertIn("〜か〜か", found_in("行くか行かないか決めて。"))

    def test_ka_that_offers_no_choice(self) -> None:
        for sentence in (
            "りんごとかバナナとかが好きだ。",   # the か of とか
            "何か食べましょうか。",             # "something", then a question
            "だれかけしましたか。",
            "どこかへ行きましたか。",
            "先生がいつ来るか知っていますか。",  # an embedded question
            "だれがこのえをかいたか分かりますか。",
            "兄が来るかどうか分かりません。",    # 〜かどうか's
            "本当かもしれないが、本当ではないかもしれない。",
            "パンか何か買ってきて。",            # 〜か何か's
            "年のせいか、最近すぐつかれる。",    # the か of つかれる
        ):
            with self.subTest(sentence=sentence):
                self.assertNotIn("〜か〜か", found_in(sentence))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class MultiPartTests(unittest.TestCase):
    """A point in several parts: each part a word of its own, the
    tightest reading, one clause."""

    def test_wa_ga_is_topic_then_subject(self) -> None:
        for sentence in ("田中さんは背が高い。", "わたしは中国語を話すことができます。", "私は日本語が好きです。"):
            with self.subTest(sentence=sentence):
                self.assertIn("〜は〜が", found_in(sentence))
        for sentence in (
            "日本語は話せることは話せるが、上手ではない。",  # the "but" が
            "この店は高いですが、おいしいです。",
            "ここではさわがないでほしい。",                  # が, a letter of さわがない
            "彼の信念は何事にも揺るがなかった。",
            "彼女はいないし、女性に手が早い。",              # two clauses
        ):
            with self.subTest(sentence=sentence):
                self.assertNotIn("〜は〜が", found_in(sentence))

    def test_te_te_links_two_clauses(self) -> None:
        for sentence in (
            "説明書の通りに組み立ててください。",  # 立て + て
            "手をあらってから、食べてください。",  # 〜てから's
            "まどを開けておいてください。",        # 〜ておく's
            "この服を着てみてもいいですか。",      # 〜てみる's
            "輸入量についての交渉は暗礁に乗り上げてしまった。",
        ):
            with self.subTest(sentence=sentence):
                self.assertFalse(any(h["pattern"] == "〜て、〜て" and len(h["segments"]) > 1
                                     for h in grammar_detect.hits(sentence)))

    def test_a_point_opens_the_next_sentence_too(self) -> None:
        hits = [h for h in grammar_detect.hits("もう食べました。もう寝ました。") if h["pattern"] == "もう〜ました"]
        self.assertEqual(len(hits), 2)
        # ...but a conjunction its lessons show only after a 。 stays there.
        self.assertNotIn("それに", found_in("感覚的にそれに違和感を感じる。"))
        self.assertNotIn("それで", found_in("それでも行く。"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class FormTests(unittest.TestCase):

    def test_looks_like_and_hearsay(self) -> None:
        for sentence, written in (("雨が降りそうだ。", "そうだ"), ("おいしそうなケーキを買った。", "そうな"),
                                  ("元気そうですね。", "そうです"), ("よさそうだ。", "そうだ"),
                                  ("興味なさそうな顔をした。", "そうな")):
            with self.subTest(sentence=sentence):
                found = found_in(sentence)
                self.assertEqual(found.get("〜そうです"), written)
                self.assertNotIn("〜そうだ（伝聞）", found)
        # After a plain form it is hearsay, whatever the tokenizer tags.
        for sentence in ("雨が降るそうだ。", "駅の前に新しい店ができるそうだ。", "ビルは結局医大に行くそうだ。",
                         "おいしいそうです。", "そうです。"):
            with self.subTest(sentence=sentence):
                self.assertNotIn("〜そうです", found_in(sentence))
        self.assertIn("〜そうだ（伝聞）", found_in("雨が降るそうだ。"))

    def test_a_negative_ending_is_the_constructions(self) -> None:
        for sentence, pattern, written in (
            ("電車にまにあわないかもしれない。", "〜かもしれません", "かもしれない"),
            ("ここで撮ってはいけない。", "〜てはいけません", "てはいけない"),
            ("行かなければならない。", "〜なければなりません", "なければならない"),
        ):
            with self.subTest(sentence=sentence):
                hits = grammar_detect.hits(sentence)
                self.assertIn((pattern, written), {(h["pattern"], sentence[h["start"]:h["end"]]) for h in hits})
                # No plain negative of its own on the construction's ない.
                construction = next(h for h in hits if h["pattern"] == pattern)
                self.assertFalse(any(h["pattern"] == "ない形 〜ない" and h["start"] >= construction["start"]
                                     and h["end"] <= construction["end"] for h in hits))

    def test_mo_after_a_counter_is_no_also(self) -> None:
        for sentence in ("何度も言った。", "何人も来た。", "何年も争った。"):
            with self.subTest(sentence=sentence):
                self.assertNotIn("も", found_in(sentence))
        # 何も〜ない is in も's own lesson ("nothing at all").
        self.assertIn("何も／誰も〜ない", found_in("何も食べない。"))

    def test_the_request_and_what_is_not_one(self) -> None:
        for sentence, written in (("行かないで！", "ないで"), ("ちょっと待って。", "て"), ("忘れないでね。", "ないで"),
                                  ("見てよ。", "て"), ("足跡を辿って会いにきて", "て")):
            with self.subTest(sentence=sentence):
                self.assertEqual(found_in(sentence).get(REQUEST), written)
        # "without doing" needs a clause after it.
        self.assertNotIn("〜ないで", found_in("行かないで！"))
        for sentence in ("電車が遅れて。", "お腹が空いて…", "待って、すぐ行くから。", "食べて、寝た。"):
            with self.subTest(sentence=sentence):
                self.assertNotIn(REQUEST, found_in(sentence))
        # A link and a request in one line: only the last て asks.
        link = [h for h in grammar_detect.hits("足跡を辿って会いにきて") if h["pattern"] == "〜て、〜て"]
        self.assertEqual([(h["start"], h["end"]) for h in link], [(5, 6)])

    def test_a_copula_ni_after_a_noun_is_left_unlit(self) -> None:
        """平和に is "for peace" before 役立つ and "peacefully" before
        暮らす, and the tokenizer calls both the copula's に: nothing
        in the letters says which, so neither is taught (a miss,
        pinned here so it is never "fixed" into a guess)."""
        for sentence in ("世界平和に役立つ。", "平和に暮らす。"):
            with self.subTest(sentence=sentence):
                self.assertFalse({"に", "〜く／〜に（副詞形）"} & found_in(sentence).keys())
        # A 形状詞's に is the adverbial form.
        self.assertEqual(found_in("静かに歩く。").get("〜く／〜に（副詞形）"), "に")


# Plan 151: eight reviewers read 1,837 hits sampled over every point the
# detector lights, each against the point's own lesson, and flagged 213.
# Every class they found is here as the sentence that showed it, beside
# the sentence where the same point IS at work: (sentence, point, lit?).
REVIEWED = [
    ("しゅくだいをしなくちゃいけない。", "〜ちゃいけない／〜じゃいけない", False),
    ("しゅくだいをしなくちゃいけない。", "〜なきゃ／〜なくちゃ", True),
    ("しゅくだいをしなくちゃいけない。", "可能形 〜(ら)れる", False),
    ("君は、すぐ警察に出頭しなくてはならない。", "〜てはならない", False),
    ("君は、すぐ警察に出頭しなくてはならない。", "〜なくてはいけない", True),
    ("行かなければいけない。", "〜ば", False),
    ("行かなければいけない。", "可能形 〜(ら)れる", False),
    ("行かなければいけない。", "〜なくてはいけない", True),
    ("静かでなければいけない。", "〜なくてはいけない", True),
    ("こうした２国間の紛争は、国際法に従って解決されなければならない。", "〜なければなりません", True),
    ("分からなければ、先生に聞けばいい。", "〜ば", True),
    ("そんなことをしてはいけない。", "〜てはいけません", True),
    ("もう行かなくちゃ、時間がない。", "〜ないで", False),
    ("もう行かなくちゃ、時間がない。", "もう〜ない", False),
    ("もう食べたくない。", "もう〜ない", True),
    ("今日、雨がふらなくてよかったですね。", "〜なきゃ／〜なくちゃ", False),
    ("今日、雨がふらなくてよかったですね。", "〜なくて", True),
    ("つまり、今日は残業しなくていいということですね。", "〜なくて", False),
    ("つまり、今日は残業しなくていいということですね。", "〜ていく／〜てくる", False),
    ("家を出ようとしたとき、電話が鳴った。", "意向形 〜(よ)う", False),
    ("家を出ようとしたとき、電話が鳴った。", "〜ようとする", True),
    ("誰がなんと言おうと彼女は自説を曲げない。", "意向形 〜(よ)う", False),
    ("遅刻しようものなら、部長にひどく怒られる。", "意向形 〜(よ)う", False),
    ("そろそろ帰ろう。", "意向形 〜(よ)う", True),
    ("来週から運動しようと思います。", "意向形 〜(よ)う", True),
    ("きのうは十時間もねました。", "〜も（強調）", True),
    ("きのうは十時間もねました。", "も", False),
    ("パーティーにはだれ一人も来なかった。", "〜も（強調）", True),
    ("寝室が十二もあります。", "〜も（強調）", True),
    ("わたしも学生です。", "も", True),
    ("わたしも学生です。", "〜も（強調）", False),
    ("きのうは何も買いませんでした。", "も", True),
    ("きのうは何も買いませんでした。", "〜も（強調）", False),
    ("鞍馬は、力よりもバランス感覚が必要です。", "も", False),
    ("彼は家族も同然の友人だ。", "も", False),
    ("今から出かけるところだ。", "〜かける", False),
    ("かぜのときは、むりをしないことだ。", "〜ことだ", True),
    ("彼の強みは、あきらめないことだ。", "〜ことだ", False),
    ("その話が本当だとしたら、大変なことだ。", "〜ことだ", False),
    ("大切なのは毎日習うことだ。", "〜ことだ", False),
    ("ちょうど食事が終わったところです。", "〜たところ", False),
    ("先生に相談したところ、すぐに解決した。", "〜たところ", True),
    ("その本は読んだことは読んだが、よく覚えていない。", "〜ことは〜が", True),
    ("行かないことはないが、あまり行きたくない。", "〜ことは〜が", False),
    ("忠告を与えることは出来るが、行動を起こさせることはできない。", "〜ことは〜が", False),
    ("顔といわず手といわず、泥だらけだった。", "〜という", False),
    ("好きなように行き来していいですよ。", "〜ように", False),
    ("教官は私に毎日運動するように勧めた。", "〜ように", False),
    ("毎朝走ることにしました。", "〜にします", False),
    ("毎朝走ることにしました。", "〜ことにする", True),
    ("詳しい内容につきましては、担当者からご説明いたします。", "〜につき", False),
    ("道を間違えたばかりに、電車に乗り遅れた。", "〜たばかり", False),
    ("責任者たるもの、逃げてはならない。", "〜たるもの", True),
    ("適切な話題の最たるものは天気です。", "〜たるもの", False),
    ("この本は興味津々たるものがあって飽きない。", "〜たるもの", False),
    ("一日とて、彼を忘れたことはない。", "〜ことはない", False),
    ("そんなに心配することはない。", "〜ことはない", True),
    ("四人の中で、わたしがいちばん小さいです。", "〜の中で", True),
    ("かぞくの中で、だれがりょうりをしますか。", "〜の中で", True),
    ("電車の中でねてしまいました。", "〜の中で", False),
    ("寝不足はじこにつながりかねません。", "〜かねる", False),
    ("日本人がみんな漢字に強いとは限らない。", "助数詞 〜つ／〜人／〜枚", False),
    ("彼はいわゆる文化人である。", "助数詞 〜つ／〜人／〜枚", False),
    ("数人の子供が砂浜で遊んでいる。", "助数詞 〜つ／〜人／〜枚", True),
    ("学生が五人います。", "助数詞 〜つ／〜人／〜枚", True),
    ("今日は、雲ひとつない青空だ。", "助数詞 〜つ／〜人／〜枚", True),
    ("日本の文化について研究しています。", "に", False),
    ("日本の文化について研究しています。", "〜について", True),
    ("七時におきます。", "に", True),
    ("もう二度と、あの店には行くまい。", "と", False),
    ("二度と同じ失敗はするまいと決めた。", "〜と同じ", False),
    ("彼は医者として世界中で働いてきた。", "と", False),
    ("彼は医者として世界中で働いてきた。", "〜として", True),
    ("言うこととすることとは別問題だ。", "と", True),
    ("そのかさはわたしのです。", "〜んです／〜のです", False),
    ("つまり、あなたは反対なのですね。", "〜んです／〜のです", True),
    ("先生はもうお帰りになりました。", "お〜になる／お〜する", True),
    ("先生はもうお帰りになりました。", "〜くなる／〜になる", False),
    ("開店にあたって、多くの方にお世話になりました。", "〜くなる／〜になる", False),
    ("お金があれば幸せになるわけではない。", "お〜になる／お〜する", False),
    ("お名前の綴りを教えてください。", "お〜ください", False),
    ("本件についての率直なご意見をお聞かせください。", "お〜ください", True),
    ("ご来社の際に、受付にお声がけください。", "お〜ください", True),
    ("今日は春らしい、いい天気だ。", "〜らしい（典型）", True),
    ("あの茶色の犬はまだ子犬らしいです。", "〜らしい（典型）", False),
    ("兄は一時間も歌いつづけました。", "可能形 〜(ら)れる", False),
    ("片づけるそばから、子どもが部屋を散らかす。", "可能形 〜(ら)れる", False),
    ("日本語が少し話せます。", "可能形 〜(ら)れる", True),
    ("彼は大きな市立病院に勤務しておられます。", "受身形 〜られる", False),
    ("男女間に不均等が存在することは許されるべきではない。", "〜べきだ", True),
    ("子どもはないたかと思うと、もう笑っている。", "ない形 〜ない", False),
    ("朝は４脚、昼は２脚、そして夕は３脚で歩くものは何か。", "何か／誰か／どこか", False),
    ("それについては知る由もなかった。", "それに", False),
    ("花は今や真っ盛りです。", "や", False),
    ("ほかに質問はありませんか。", "〜ませんか", False),
    ("今日は少しさむけがする。", "〜がする", True),
    ("私はおばあちゃんがするのを見てウールの紡ぎ方を覚えました。", "〜がする", False),
    ("この文は二通りに解釈することができる。", "〜通りに", False),
    ("彼が外人客の接待にあたっている。", "〜にあたって", False),
    ("出発にあたって、家族に手紙を書いた。", "〜にあたって", True),
    ("かなり大勢の学生がアメリカの風物に興味をもっている。", "〜をもって", False),
    ("舞踊がみたいのですが情報をください。", "〜みたいだ", False),
    ("夏の山では目に見えるものはすべて緑一色です。", "〜に見える", False),
    ("彼女は野菜と玄米を常食としている。", "〜として", False),
    ("ドアを開けようとしたら、ドアの握りがとれた。", "〜としたら", False),
    ("あのツアー、キャンセル待ちの状態だって。", "〜だって", False),
    ("ところで、駅前に新しい店ができたそうですよ。", "〜ができます", True),
    ("母はフランス語ができます。", "〜ができます", True),
    ("新しい制度に関して、質問はありませんか。", "〜ませんか", False),
    ("兄が静かなのに対して、弟はよく話す。", "〜のに", False),
    ("目先の利益だけにとらわれてはいけない。", "〜だけに", False),
    # the tagger's "um" (あの、すみません) and its demonstrative (あの高い山)
    ("あの、すみません。", "この／その／あの／どの", False),
    ("あの高い山が見えますか。", "この／その／あの／どの", True),
    ("昨日、あの店に行った。", "この／その／あの／どの", True),
]


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class ReviewedTests(unittest.TestCase):

    def test_every_reviewed_case(self) -> None:
        for sentence, pattern, lit in REVIEWED:
            with self.subTest(sentence=sentence, pattern=pattern):
                self.assertEqual(pattern in found_in(sentence), lit)

    def test_a_refused_reading_takes_its_shorter_readings(self) -> None:
        """てはならな is てはならない cut short: when the whole reading is
        refused, no letter-shorter one of the same point stands at the
        same place."""
        for sentence, pattern in (("君は、すぐ警察に出頭しなくてはならない。", "〜てはならない"),
                                  ("毎朝走ることにしました。", "〜にします"),
                                  ("一日とて、彼を忘れたことはない。", "〜ことはない")):
            with self.subTest(sentence=sentence):
                self.assertNotIn(pattern, found_in(sentence))

    def test_the_counted_mo_is_its_own_point(self) -> None:
        self.assertTrue(grammar_detect.can_find("〜も（強調）"))
        self.assertEqual(found_in("駅まで一時間もかかりました。").get("〜も（強調）"), "一時間も")
        self.assertEqual(found_in("何年間も争った。").get("〜も（強調）"), "何年間も")

    def test_the_halves_the_must_lesson_names(self) -> None:
        for sentence, written in (("行かなくてはならない。", "なくてはならない"),
                                  ("行かなければいけません。", "なければいけません"),
                                  ("学生でなくてはならない。", "なくてはならない")):
            with self.subTest(sentence=sentence):
                self.assertEqual(found_in(sentence).get("〜なくてはいけない"), written)
        # なければならない stays 〜なければなりません's.
        self.assertNotIn("〜なくてはいけない", found_in("行かなければならない。"))

    def test_a_point_that_opens_a_sentence_opens_a_clause(self) -> None:
        self.assertEqual(found_in("もう二度と、あの店には行くまい。").get("この／その／あの／どの"), "あの")
        self.assertEqual(found_in("高くても、この本は買います。").get("この／その／あの／どの"), "この")

    def test_soretomo_is_or(self) -> None:
        hits = found_in("コーヒーにしますか、それとも紅茶にしますか。")
        self.assertFalse({"これ／それ／あれ／どれ", "と", "も"} & hits.keys())
        self.assertEqual(found_in("それも大切だ。").get("これ／それ／あれ／どれ"), "それ")

    def test_iku_has_no_i_onbin(self) -> None:
        """行って, never 行いて: ていい is て + いい, no 〜ていく."""
        self.assertNotIn("〜ていく／〜てくる", found_in("好きなように行き来していいですよ。"))
        self.assertIn("〜ていく／〜てくる", found_in("鳥が飛んでいった。"))


# Plan 152: what the detector could not see. Each point beside the
# sentence where it must stay unlit.
HEARSAY = [
    ("友だちの話では、あの店はおいしいそうです。", "〜そうだ（伝聞）", True),
    ("明日は一日中雨だそうです。", "〜そうだ（伝聞）", True),
    ("あの先生はとてもきびしいそうです。", "〜そうだ（伝聞）", True),
    ("田中さんは来月、国へ帰るそうだ。", "〜そうだ（伝聞）", True),
    ("行ったそうです。", "〜そうだ（伝聞）", True),
    ("行かないそうです。", "〜そうだ（伝聞）", True),
    ("静かだそうです。", "〜そうだ（伝聞）", True),
    ("行くそうでした。", "〜そうだ（伝聞）", True),
    ("できるそうです。", "〜そうだ（伝聞）", True),
    ("できるそうです。", "〜そうです", False),
    ("雨が降りそうです。", "〜そうだ（伝聞）", False),
    ("雨が降りそうです。", "〜そうです", True),
    ("この料理はおいしそうです。", "〜そうだ（伝聞）", False),
    ("おいしそうなケーキ。", "〜そうです", True),
    ("そうですね。", "〜そうだ（伝聞）", False),
    ("そうですね。", "〜そうです", False),
    ("そうだ、いい考えがある。", "〜そうだ（伝聞）", False),
    ("彼もそう思う。", "〜そうだ（伝聞）", False),
]

EMBEDDED = [
    ("先生がいつ来るか知っていますか。", "〜か（間接疑問）", True),
    ("何を買うか、まだ分かりません。", "〜か（間接疑問）", True),
    ("駅がどこにあるか教えてください。", "〜か（間接疑問）", True),
    ("だれがこのえをかいたか分かりますか。", "〜か（間接疑問）", True),
    ("何をしているのか分からない。", "〜か（間接疑問）", True),
    ("いつ来るかが問題だ。", "〜か（間接疑問）", True),
    ("どうなるか心配だ。", "〜か（間接疑問）", True),
    ("犯人は誰か分からない。", "〜か（間接疑問）", True),
    ("犯人は誰か分からない。", "何か／誰か／どこか", False),
    ("どちらがいいか決めてください。", "〜か（間接疑問）", True),
    ("先生がいつ来るか知っていますか。", "か", True),
    ("いつ来るか。", "〜か（間接疑問）", False),
    ("何か食べたい。", "〜か（間接疑問）", False),
    ("誰かが来た。", "〜か（間接疑問）", False),
    ("いつか行きたい。", "〜か（間接疑問）", False),
    ("どうかお願いします。", "〜か（間接疑問）", False),
    ("行くかどうか分からない。", "〜か（間接疑問）", False),
    ("行くかどうか分からない。", "〜かどうか", True),
    ("いつ来ますか知っていますか。", "〜か（間接疑問）", False),
    ("何が起こるかもしれない。", "〜か（間接疑問）", False),
    ("なんというか、変な人だ。", "〜か（間接疑問）", False),
    ("誰か知っていますか。", "〜か（間接疑問）", False),
    ("誰か知っていますか。", "何か／誰か／どこか", True),
    ("彼が来るか聞いた。", "〜か（間接疑問）", False),
    ("何だか変だ。", "か", False),
]

# A point in the other spelling (grammar_detect._SPELLINGS), and the
# same letters where they are another word: を持って is "holding", に渡って
# "crossing to", 時 read じ, 駅に止まらず a train not stopping.
SPELLED = [
    ("係員の指示に従って、外へ出てください。", "〜にしたがって", True),
    ("会議は三日間に渡って開かれた。", "〜にわたって", True),
    ("工事は長期に亘って続いた。", "〜にわたって", True),
    ("彼は若い頃アメリカに渡って暮らした。", "〜にわたって", False),
    ("開会に当たって、館長が挨拶をした。", "〜にあたって", True),
    ("ボールが頭に当たって、痛かった。", "〜にあたって", False),
    ("雨に当たって、風邪をひいた。", "〜にあたって", False),
    ("遺産を巡って、兄弟が争った。", "〜をめぐって", True),
    ("各地の名所を巡って、写真を撮った。", "〜をめぐって", False),
    ("本日を以て閉店いたします。", "〜をもって", True),
    ("カバンを持って出かけた。", "〜をもって", False),
    ("ファンの期待に応えて、彼は勝った。", "〜にこたえて", True),
    ("心を込めて手紙を書いた。", "〜をこめて", True),
    ("年齢に関わらず、だれでも参加できます。", "〜にかかわらず", True),
    ("雨にも関わらず、試合は行われた。", "〜にもかかわらず", True),
    ("被害は国内に留まらず、海外にも広がった。", "〜にとどまらず", True),
    ("兄が働き者なのに引き換え、弟は怠け者だ。", "〜にひきかえ", True),
    ("その光景は見るに堪えない。", "〜にたえない", True),
    ("年を取るに連れて、体力が落ちた。", "〜につれて", True),
    ("子供を公園に連れて行った。", "〜につれて", False),
    ("子供と雖も、規則は守らなければならない。", "〜といえども", True),
    ("日本語が話せると言っても、少しだけです。", "〜といっても", True),
    ("その暑さと言ったらない。", "〜といったらない", True),
    ("日本語を話す事が出来ます。", "〜ことができます", True),
    ("母はフランス語が出来ます。", "〜ができます", True),
    ("ここに名前を書いて下さい。", "〜てください", True),
    ("水を下さい。", "〜をください", True),
    ("こちらでお待ち下さい。", "お〜ください", True),
    ("彼が知らない訳がない。", "〜わけがない", True),
    ("彼はもう着いている筈です。", "〜はずです", True),
    ("健康の為に、毎日歩いている。", "〜ために", True),
    ("先生のお陰で、合格できました。", "〜おかげで", True),
    ("新しい車が欲しいです。", "〜がほしいです", True),
    ("もっと勉強して欲しい。", "〜てほしい", True),
    ("昨日は食べ過ぎた。", "〜すぎる", True),
    ("約束の時間が過ぎた。", "〜すぎる", False),
    ("それは言い訳に過ぎない。", "〜にすぎない", True),
    ("事実にそくして判断する。", "〜に即して", True),
    ("前回の反省をふまえて、計画を立てた。", "〜を踏まえて", True),
    ("早く行くにこしたことはない。", "〜に越したことはない", True),
    ("急いでいる時にかぎって、電車が遅れる。", "〜に限って", True),
    ("この問題は日本にかぎらず、世界中で起きている。", "〜に限らず", True),
    ("高いものがいいとはかぎらない。", "〜とは限らない", True),
    ("人口の増加にともなって、住宅が足りなくなった。", "〜に伴って", True),
    ("調査にもとづいて、計画を立て直した。", "〜に基づいて", True),
    ("年齢をとわず、だれでも応募できる。", "〜を問わず", True),
    ("収入におうじて、税金が決まる。", "〜に応じて", True),
    ("雨にくわえて、風も強くなった。", "〜に加えて", True),
    ("タバコを口にくわえて歩いていた。", "〜に加えて", False),
    ("開会にさきだって、選手の紹介があった。", "〜に先立って", True),
    ("予想にはんして、試合は負けた。", "〜に反して", True),
    ("友人をつうじて、その会社を知った。", "〜を通じて", True),
    ("出発にさいして、荷物を確認した。", "〜に際して", True),
    ("川にそって、道が続いている。", "〜に沿って", True),
    ("そんなのうそにきまっている。", "〜に決まっている", True),
    ("先生にたいして失礼なことを言った。", "〜に対して", True),
    ("この問題にかんして、意見を聞きたい。", "〜に関して", True),
    ("去年にくらべて、今年は暑い。", "〜に比べて", True),
    ("彼は年より若くみえる。", "〜に見える", False),
    ("彼女は学生にみえる。", "〜に見える", True),
    ("窓から山がみえる。", "〜が見える／〜が聞こえる", True),
    ("鳥の声がきこえる。", "〜が見える／〜が聞こえる", True),
    ("明日は雨だとおもいます。", "〜と思います", True),
    ("この本はとてもおもしろい。", "〜と思います", False),
    ("友だちと映画を見にいきます。", "〜に行きます", True),
    ("いきなり雨が降ってきた。", "〜に行きます", False),
    ("成功するかどうかは君の努力しだいだ。", "〜次第だ", True),
    ("予定どおりに出発した。", "〜通りに", True),
    ("子供の時、よく川で泳いだ。", "〜とき", True),
    ("七時に起きた。", "〜とき", False),
    ("時は金なり。", "〜とき", False),
    ("ちょうど出かける所だ。", "〜ところだ", True),
    ("この研究所で働いている。", "〜ところだ", False),
    ("ここは静かな所だ。", "〜ところだ", False),
    ("先生のお蔭で、合格できました。", "〜おかげで", True),
    ("心を籠めて手紙を書いた。", "〜をこめて", True),
    ("年齢に拘わらず、だれでも参加できます。", "〜にかかわらず", True),
    ("雨にも拘わらず、試合は行われた。", "〜にもかかわらず", True),
    ("その光景は見るに耐えない。", "〜にたえない", True),
    ("兄に引きかえ、弟は怠け者だ。", "〜にひきかえ", True),
    ("本日を以って閉店いたします。", "〜をもって", True),
    ("言われたとおりにした。", "〜通りに", True),
    ("この電車は小さな駅に止まらず、終点まで行く。", "〜にとどまらず", False),
]


def _kana(text: str) -> str:
    """A sentence's reading, blind to what spelling and speech disagree
    on: voicing (予定通り's どおり), づ／ず, and a long vowel written う or お."""
    reading = "".join(morphology.kata_to_hira(t.reading) for t in morphology.tokenize(text))
    reading = reading.translate(str.maketrans("づぢ", "ずじ"))
    reading = reading.translate(str.maketrans("がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ",
                                              "かきくけこさしすせそたちつてとはひふへほはひふへほ"))
    for a in "おこそとのほもよろ":
        reading = reading.replace(a + "う", a + "お")
    return reading


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class UnseenTests(unittest.TestCase):

    def test_hearsay_in_every_register(self) -> None:
        for sentence, pattern, lit in HEARSAY:
            with self.subTest(sentence=sentence, pattern=pattern):
                self.assertEqual(pattern in found_in(sentence), lit)

    def test_the_embedded_question(self) -> None:
        self.assertTrue(grammar_detect.can_find("〜か（間接疑問）"))
        for sentence, pattern, lit in EMBEDDED:
            with self.subTest(sentence=sentence, pattern=pattern):
                self.assertEqual(pattern in found_in(sentence), lit)
        # It is the か that closes the clause, and the last one still asks.
        hits = [h for h in grammar_detect.hits("先生がいつ来るか知っていますか。") if h["pattern"] in ("か", "〜か（間接疑問）")]
        self.assertEqual([(h["pattern"], h["start"]) for h in hits], [("〜か（間接疑問）", 7), ("か", 14)])

    def test_the_other_spelling(self) -> None:
        for sentence, pattern, lit in SPELLED:
            with self.subTest(sentence=sentence, pattern=pattern):
                self.assertEqual(pattern in found_in(sentence), lit)

    def test_every_spelling_reads_as_the_one_it_stands_for(self) -> None:
        """A spelling in the table is the same word read the same way:
        each is found in SPELLED, and the sentence read with the other
        spelling in its place reads alike."""
        pairs = {(segment, alt) for segment, alts in (*grammar_detect._SPELLINGS,
                                                      *(x for v in grammar_detect._POINT_SPELLINGS.values() for x in v))
                 for alt in alts}
        covered = set()
        for sentence, pattern, lit in SPELLED:
            hit = next((h for h in grammar_detect.hits(sentence) if h["pattern"] == pattern), None)
            if not lit or hit is None:
                continue
            text = sentence[hit["start"]:hit["end"]]
            for segment, alt in pairs:
                if alt in text and segment not in text:
                    covered.add((segment, alt))
                    other = sentence[:hit["start"]] + text.replace(alt, segment) + sentence[hit["end"]:]
                    with self.subTest(segment=segment, alt=alt):
                        self.assertEqual(_kana(sentence), _kana(other))
        self.assertEqual(pairs - covered, set())


# Read one key at a time and held exactly: a key added or lost fails.
GOLD = {
    "足跡を辿って会いにきて": {("を", "を"), ("〜て、〜て", "て"), (REQUEST, "て"), ("〜に行きます", "にき")},
    "さらば桃源郷真っさらになったんだ": {("〜くなる／〜になる", "になっ"), ("た形 〜た", "た"),
                                         ("〜んです／〜のです", "んだ"), ("です／だ", "だ")},
    "私は学生です。": {("は", "は"), ("です／だ", "です")},
    "昨日、友だちと映画を見ました。": {("と", "と"), ("を", "を"), ("〜ました／〜ませんでした", "ました")},
    "この本は高くないです。": {("この／その／あの／どの", "この"), ("は", "は"),
                               ("い形容詞／な形容詞", "高くない"), ("です／だ", "です")},
    "雨が降っているから、出かけません。": {("が", "が"), ("〜ています", "ている"), ("〜から", "から"),
                                           ("〜ます／〜ません", "ません")},
    "もう宿題をしましたか。": {("もう〜ました", "もう宿題をしました"), ("を", "を"),
                               ("〜ました／〜ませんでした", "ました"), ("か", "か")},
    "朝ごはんを食べてから、学校へ行きます。": {("を", "を"), ("〜てから", "てから"), ("へ", "へ"),
                                               ("〜ます／〜ません", "ます")},
    "ここで写真を撮ってはいけません。": {("で", "で"), ("を", "を"), ("〜てはいけません", "てはいけません")},
    "窓を開けてもいいですか。": {("を", "を"), ("〜てもいいです", "てもいいです"), ("です／だ", "です"), ("か", "か")},
    "もっとゆっくり話してください。": {("〜てください", "てください")},
    "日本語が少し話せます。": {("が", "が"), ("可能形 〜(ら)れる", "話せ"), ("〜ます／〜ません", "ます")},
    "田中さんは背が高い。": {("〜は〜が", "は背が"), ("は", "は"), ("が", "が")},
    "暑いので、窓を開けました。": {("〜ので", "ので"), ("を", "を"), ("〜ました／〜ませんでした", "ました")},
    "母に野菜を食べさせられた。": {("に", "に"), ("を", "を"), ("使役受身形 〜させられる", "させられ"),
                                   ("た形 〜た", "た")},
    "行かないで！": {(REQUEST, "ないで")},
    "ちょっと待って。": {(REQUEST, "て")},
    "電車が遅れて。": {("が", "が")},
    "これは何ですか。": {("これ／それ／あれ／どれ", "これ"), ("は", "は"), ("です／だ", "です"), ("か", "か")},
    "誰か来ましたよ。": {("何か／誰か／どこか", "誰か"), ("〜ました／〜ませんでした", "ました"), ("よ", "よ")},
    "だれでも入れます。": {(ANY, "だれでも"), ("〜ます／〜ません", "ます")},
    "いつでも来てください。": {(ANY, "いつでも"), ("〜てください", "てください")},
    "お茶でも飲みませんか。": {("〜でも", "でも"), ("〜ませんか", "ませんか"), ("か", "か")},
    "子どもでも分かる。": {("〜でも", "でも")},
    "学校でもらった本です。": {("で", "で"), ("た形 〜た", "た"), ("です／だ", "です")},
    "ここでも同じだ。": {("で", "で"), ("も", "も"), ("です／だ", "だ")},
    "彼とは十年来の知り合いだ。": {("と", "と"), ("は", "は"), ("の", "の"), ("です／だ", "だ")},
    "友情とは、困った時に助け合うことだ。": {("〜とは", "とは"), ("た形 〜た", "た"), ("〜とき", "時"), ("に", "に"),
                                             ("〜ことだ", "ことだ"), ("です／だ", "だ")},
    "まさか彼が犯人だとは。": {("が", "が"), ("です／だ", "だ"), ("〜とは", "とは")},
    "何とか間に合った。": {("た形 〜た", "た")},
    "りんごとかバナナとかが好きだ。": {("〜とか", "とか"), ("が", "が"), ("〜が好きです", "が好き"), ("です／だ", "だ")},
    "コーヒーか紅茶か、どちらがいいですか。": {("か", "か"), ("〜か〜か", "か紅茶か"), ("が", "が"), ("です／だ", "です")},
    "何か食べましょうか。": {("何か／誰か／どこか", "何か"), ("か", "か"), ("〜ましょうか", "ましょうか")},
    "世界平和に役立つ。": set(),
    "静かにしてください。": {("〜く／〜に（副詞形）", "に"), ("〜てください", "てください")},
    "彼は外交官でもあった。": {("は", "は"), ("です／だ", "でもあっ"), ("た形 〜た", "た")},
    "雨が降りそうだ。": {("が", "が"), ("〜そうです", "そうだ"), ("です／だ", "だ")},
    "雨が降るそうだ。": {("が", "が"), ("〜そうだ（伝聞）", "そうだ"), ("です／だ", "だ")},
    "電車にまにあわないかもしれない。": {("に", "に"), ("ない形 〜ない", "ない"), ("か", "か"),
                                         ("〜かもしれません", "かもしれない"), ("も", "も")},
    "ここで撮ってはいけない。": {("で", "で"), ("〜てはいけません", "てはいけない")},
    "行かなければならない。": {("〜なければなりません", "なければならない")},
    "もう食べました。もう寝ました。": {("もう〜ました", "もう食べました"), ("〜ました／〜ませんでした", "ました"),
                                       ("もう〜ました", "もう寝ました")},
    "何度も言った。": {("〜も（強調）", "何度も"), ("た形 〜た", "た")},
    "でも帰りは楽だよね。": {("は", "は"), ("です／だ", "だ"), ("よ", "よ"), ("ね", "ね")},
    "勝ちたいとは思わない。": {("〜たいです", "たい"), ("と", "と"), ("は", "は"), ("ない形 〜ない", "ない")},
    "彼が来るとは思わなかった。": {("が", "が"), ("〜とは", "とは"), ("ない形 〜ない", "なかっ"), ("た形 〜た", "た")},
    "何でもない。": {("です／だ", "でもない")},
    "いくらでもある。": {(ANY, "いくらでも")},
}


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class GoldSentenceTests(unittest.TestCase):

    def test_every_key_exactly(self) -> None:
        for sentence, expected in GOLD.items():
            with self.subTest(sentence=sentence):
                self.assertEqual(keys(sentence), expected)


def _corpus() -> list[str]:
    """Every sentence the app teaches from, and 300 of JMdict's examples
    (the first by frequency rank, so the slice never moves)."""
    out = [ex["jp"] for points in GRAMMAR_POINTS_BY_LEVEL.values() for p in points
           for ex in p.get("examples", []) if ex.get("jp")]
    import content.reading_sentences as reading
    out += [it["jp"] for items in reading.BY_LEVEL.values() for it in items
            if isinstance(it, dict) and it.get("jp")]
    try:
        import content.listening_clips as listening
        out += [it["jp"] for items in listening.BY_LEVEL.values() for it in items
                if isinstance(it, dict) and it.get("jp")]
    except ImportError:            # pykakasi absent: the rest still stands
        pass
    db = Path(__file__).resolve().parent.parent / "datas" / "vocab" / "vocab_jmdict.sqlite3"
    if db.exists():
        conn = sqlite3.connect(db)
        try:
            examples = []
            for (blob,) in conn.execute(
                    "SELECT s.blob FROM senses s JOIN entries e ON e.id = s.id "
                    "WHERE e.has_examples = 1 ORDER BY e.freq_rank LIMIT 400"):
                for sense in json.loads(blob):
                    examples += [e["jp"] for e in sense.get("examples", []) if e.get("jp")]
            out += examples[:300]
        finally:
            conn.close()
    return out


_PUNCT = frozenset("。、！？!?「」『』（）() 　…,，")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class InvariantTests(unittest.TestCase):
    """Properties every hit has, on every sentence the app teaches from."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.read = []
        for sentence in _corpus():
            tokens = morphology.tokenize(sentence)
            cls.read.append((sentence, tokens, grammar_detect.hits(sentence, tokens)))

    def test_there_is_a_corpus(self) -> None:
        self.assertGreater(len(self.read), 2500)

    def test_spans_and_pieces(self) -> None:
        for sentence, _tokens, hits in self.read:
            for h in hits:
                start, end, segments = h["start"], h["end"], h["segments"]
                with self.subTest(sentence=sentence, pattern=h["pattern"]):
                    self.assertTrue(0 <= start < end <= len(sentence))
                    self.assertTrue(segments)
                    self.assertEqual(segments[0][0], start)
                    self.assertEqual(segments[-1][1], end)
                    for (a, b), (c, _d) in zip(segments, segments[1:]):
                        self.assertLess(a, b)
                        self.assertLessEqual(b, c)
                    # No key lights a mark of punctuation.
                    for a, b in segments:
                        self.assertNotIn(sentence[a], _PUNCT)
                        self.assertNotIn(sentence[b - 1], _PUNCT)

    def test_a_piece_stands_on_words(self) -> None:
        """A piece starts and stops where a word does, or inside a word
        that conjugates (〜てしまう ends inside しまい): never inside a
        noun, a particle or a mark."""
        for sentence, tokens, hits in self.read:
            starts = {t.start for t in tokens}
            ends = {t.end for t in tokens}
            inside = {i: t.pos for t in tokens for i in range(t.start, t.end)}
            for h in hits:
                for a, b in h["segments"]:
                    with self.subTest(sentence=sentence, pattern=h["pattern"], piece=sentence[a:b]):
                        self.assertTrue(a in starts or inside.get(a) in ("verb", "adjective", "auxiliary"))
                        self.assertTrue(b in ends or inside.get(b) in ("verb", "adjective", "auxiliary"))

    def test_every_key_is_a_catalogue_point(self) -> None:
        for sentence, _tokens, hits in self.read:
            for h in hits:
                with self.subTest(sentence=sentence, pattern=h["pattern"]):
                    found = find(h["pattern"])
                    self.assertIsNotNone(found)
                    self.assertEqual(found[0], h["level"])
                    self.assertIn(h["kind"], ("marker", "pattern"))

    def test_no_key_twice_on_one_span(self) -> None:
        for sentence, _tokens, hits in self.read:
            spans = [(h["pattern"], h["start"], h["end"]) for h in hits]
            with self.subTest(sentence=sentence):
                self.assertEqual(len(spans), len(set(spans)))

    def test_the_same_answer_every_time(self) -> None:
        for sentence, tokens, hits in self.read[::25]:
            with self.subTest(sentence=sentence):
                self.assertEqual(grammar_detect.hits(sentence), hits)
                self.assertEqual(grammar_detect.hits(sentence, tokens), hits)

    def test_no_refused_shape_anywhere(self) -> None:
        """The plan-150 refusals, restated as properties of the whole
        corpus rather than of the sentences they were written for."""
        for sentence, tokens, hits in self.read:
            by_start = {t.start: i for i, t in enumerate(tokens)}
            for h in hits:
                i = by_start.get(h["start"])
                prev = tokens[i - 1] if i else None
                with self.subTest(sentence=sentence, pattern=h["pattern"]):
                    if h["pattern"] in ("〜でも", "〜とか") and prev is not None:
                        self.assertNotIn(prev.lemma, ("何", "誰", "何時", "何処", "何れ", "何方"))
                    if h["pattern"] == "〜でも":
                        self.assertIsNotNone(prev)          # never "but"
                    if h["pattern"] == "〜とは" and prev is not None:
                        self.assertNotEqual(prev.pos, "pronoun")
                    if h["pattern"] == "〜か〜か":
                        for a, _b in h["segments"]:
                            k = by_start.get(a)
                            self.assertIsNotNone(k)
                            self.assertFalse(k and tokens[k - 1].surface == "と")
                    if h["pattern"] == "〜は〜が":
                        last = by_start.get(h["segments"][-1][0])
                        self.assertFalse(tokens[last].conjunctive)
                    if h["pattern"] == "〜そうです" and prev is not None and prev.pos == "verb":
                        self.assertTrue(prev.cform.startswith("連用形"))


class HostileInputTests(unittest.TestCase):
    """Whatever a learner pastes: never an exception, never a span out of
    range. Runs with and without a tokenizer."""

    CASES = (
        "", " ", "　", "\n", "。", "。。。", "！？", "hello world", "ＡＢＣ", "12345", "１２３",
        "😀🎌", "ｱｲｳｴｵ", "カタカナだけ", "ひらがなだけ", "漢字", "〜", "〜て", "「」", "…",
        "行って\n来ます。", "a" * 50, "です" * 200, "私は学生です。" * 60,
    )

    def test_never_raises_and_stays_in_range(self) -> None:
        for text in self.CASES:
            with self.subTest(text=text[:20]):
                for h in grammar_detect.hits(text):
                    self.assertTrue(0 <= h["start"] < h["end"] <= len(text))
                    for a, b in h["segments"]:
                        self.assertTrue(h["start"] <= a < b <= h["end"])
                self.assertIsInstance(grammar_detect.detect(text), list)
                self.assertIsInstance(grammar_detect.points_in(text), list)

    def test_nothing_in_what_is_not_japanese(self) -> None:
        for text in ("", " ", "\n", "hello world", "12345", "😀🎌", "。", "…"):
            with self.subTest(text=text):
                self.assertEqual(grammar_detect.hits(text), [])


class WithoutMorphologyTests(unittest.TestCase):
    """The substring fallback (no tokenizer) never guesses at a point
    read by its rule alone: their letters are what the rules exist to
    tell apart."""

    def test_rule_only_points_are_never_guessed(self) -> None:
        from unittest import mock
        with mock.patch.object(morphology, "tokenize", return_value=[]):
            for sentence in ("何でもない。", "誰でも入れます。", "行かないで！", "食べた。", "食べない。"):
                with self.subTest(sentence=sentence):
                    found = {p for p, *_rest in grammar_detect.detect(sentence)}
                    self.assertFalse(found & grammar_detect._RULE_ONLY)


if __name__ == "__main__":
    unittest.main()
