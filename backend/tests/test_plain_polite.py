"""
The same ending in the other register (plan 241): what Construire also
takes where its hole closes the sentence, and where it takes nothing
else -- each rule pinned with the sentence it reads both ways and the
one it must not.
"""
import pytest

from study.furigana import align_sentence
from study.grammar_ladder import _reading, _slice
from study.morphology import MORPHOLOGY_AVAILABLE
from study.plain_polite import PLAIN, POLITE, other_register

pytestmark = pytest.mark.skipif(not MORPHOLOGY_AVAILABLE, reason="needs the tokenizer")


def _other(jp: str, hole: str, pattern: str = "") -> tuple | None:
    """other_register for the first `hole` in `jp`, read as Construire
    reads it."""
    a = jp.index(hole)
    b = a + len(hole)
    return other_register(jp, a, b, _reading(_slice(align_sentence(jp), a, b)), pattern)


def _written(jp, hole, pattern=""):
    found = _other(jp, hole, pattern)
    return found and (found[0], [w for w, _ in found[1]])


@pytest.mark.parametrize("jp, hole, register, others", [
    # The copula, both ways: the screenshot's card first.
    ("あしたはテストだ。", "だ", PLAIN, ["です"]),
    ("わたしは学生です。", "です", POLITE, ["だ"]),
    ("きのうは休みでした。", "でした", POLITE, ["だった"]),
    ("あの日は休みだった。", "だった", PLAIN, ["でした"]),
    ("あしたは雨でしょう。", "でしょう", POLITE, ["だろう"]),
    ("あしたは雨だろう。", "だろう", PLAIN, ["でしょう"]),
    ("東京へ行くんです。", "んです", POLITE, ["んだ"]),
    ("そうですよ。", "ですよ", POLITE, ["だよ"]),
    # です after an adjective only adds politeness.
    ("日本へ行きたいです。", "たいです", POLITE, ["たい"]),
    ("この店のほうがいいです。", "ほうがいいです", POLITE, ["ほうがいい"]),
    ("このへやはしずかだ。", "しずかだ", PLAIN, ["しずかです"]),
    ("この本はおもしろくなかった。", "なかった", PLAIN, ["ありませんでした", "なかったです"]),
    ("あの人は学生じゃない。", "じゃない", PLAIN, ["じゃありません", "じゃないです"]),
    # The verbs, in the kanji the sentence writes them with.
    ("母は本を読んでいます。", "でいます", POLITE, ["でいる"]),
    ("日本語はおもしろいと思います。", "と思います", POLITE, ["と思う"]),
    ("時間がありません。", "ありません", POLITE, ["ない"]),
    ("きのうは学校へ行きませんでした。", "行きませんでした", POLITE, ["行かなかった"]),
    ("ともだちが来ます。", "来ます", POLITE, ["来る"]),
    ("その本はもう読んだ。", "読んだ", PLAIN, ["読みました"]),
    ("ともだちは来なかった。", "来なかった", PLAIN, ["来ませんでした", "来なかったです"]),
    ("ここから山が見える。", "が見える", PLAIN, ["が見えます"]),
    ("先生がいらっしゃる。", "いらっしゃる", PLAIN, ["いらっしゃいます"]),
    ("学生じゃないか。", "じゃないか", PLAIN, ["じゃありませんか", "じゃないですか"]),
    ("あしたは晴れるでしょうか。", "でしょうか", POLITE, ["だろうか"]),
])
def test_an_ending_that_closes_the_sentence_is_read_both_ways(jp, hole, register, others):
    assert _written(jp, hole) == (register, others)


@pytest.mark.parametrize("jp, hole, why", [
    ("学生だと思います。", "だ", "a clause inside the sentence stays plain"),
    ("あしたはテストだから、早くねます。", "だ", "nor before から"),
    ("このラーメンはおいしいです。", "です", "高いです has no だ, and the hole would be empty"),
    ("あしたは休みですか。", "です", "休みだか is not a question"),
    ("いっしょに行きませんか。", "ませんか", "an invitation is not asked by 行かないか"),
    ("はい、行きますか。", "行きます", "nor a question in a verb"),
    ("どうですか。", "です", "どうか is another word"),
    ("あしたはテストですが、行きたくないです。", "たくないです", "a sentence polite elsewhere stays polite"),
    ("山田と申します。", "と申します", "申す is only ever polite"),
    ("こちらでございます。", "でございます", "ござる is only ever polite"),
    ("ここにおります。", "おります", "nor おる"),
    ("毎日コーヒーを飲みます。", "ます", "the verb is outside the hole"),
    ("名前を書いてください。", "てください", "a request is not an ending"),
    ("あしたはテストだ」と言った。", "だ", "a quote is not the sentence's end"),
])
def test_nothing_else_is_read_the_other_way(jp, hole, why):
    assert _other(jp, hole) is None, why


def test_a_point_that_is_the_polite_ending_or_a_form_keeps_its_verb():
    # 〜ました is what the point asks: した does not show it.
    assert _other("きのう勉強しました。", "しました", "〜ました／〜ませんでした") is None
    assert _other("きのう勉強しました。", "しました") is not None
    # A form's point (た形) is the form: 行きました is not 行った.
    assert _other("きのう学校へ行った。", "行った", "た形 〜た") is None
    # The copula of the point です／だ names both registers.
    assert _written("あしたはテストだ。", "だ", "です／だ") == (PLAIN, ["です"])
    # An adjective's point is not a form's.
    assert _written("この本は高い。", "高い", "い形容詞／な形容詞") == (PLAIN, ["高いです"])


def test_each_other_reading_is_read_in_hiragana():
    register, forms = _other("日本語はおもしろいと思います。", "と思います")
    assert forms == (("と思う", "とおもう"),)
    register, forms = _other("ともだちは来なかった。", "来なかった")
    assert forms == (("来ませんでした", "きませんでした"), ("来なかったです", "こなかったです"))
