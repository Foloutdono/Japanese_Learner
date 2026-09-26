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
    "友情とは、困った時に助け合うことだ。": {("〜とは", "とは"), ("た形 〜た", "た"), ("に", "に"),
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
    "何度も言った。": {("た形 〜た", "た")},
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
