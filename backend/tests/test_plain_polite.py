"""
The same ending in the other register (plan 241): what Construire also
takes where its hole closes the sentence, and where it takes nothing
else -- each rule pinned with the sentence it reads both ways and the
one it must not. Then では said in full or contracted (plan 295), the
same way. Then the register a whole line is said in (plan 329), which
the breakdown prints.
"""
import pytest

from study.furigana import align_sentence
from study.grammar_ladder import _reading, _slice
from study.morphology import MORPHOLOGY_AVAILABLE
from content.grammar_points_data import find
from study.analysis import analyze_local
from study.plain_polite import (
    CONTRACTED, FULL, KEIGO, KEIGO_POINTS, PLAIN, POLITE, contracted, other_register,
)

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


# ── では in full or contracted (plan 295) ──────────────────────

def _swap(jp: str, hole: str) -> tuple | None:
    """contracted for the first `hole` in `jp`, read as Construire reads
    it."""
    a = jp.index(hole)
    b = a + len(hole)
    return contracted(jp, a, b, _reading(_slice(align_sentence(jp), a, b)))


@pytest.mark.parametrize("jp, hole, said", [
    # The copula's negative, both ways: the screenshot's card first.
    ("これはわたしのかさではありません。", "ではありません", FULL),
    ("あの人は先生じゃありません。", "じゃ", CONTRACTED),
    ("あの人は先生じゃありません。", "じゃありません", CONTRACTED),
    ("学生ではない。", "ではない", FULL),
    ("学生じゃない。", "じゃない", CONTRACTED),
    ("このへやはしずかではありませんでした。", "ではありません", FULL),
    # The negative after it may be outside the hole.
    ("これはわたしのかさではありません。", "では", FULL),
    # Inside another point's words, and after a clause or an adjective.
    ("いつも家にいるわけではありません。", "わけではありません", FULL),
    ("旅行どころじゃないよ。", "どころじゃない", CONTRACTED),
    ("この料理、おいしいじゃないか。", "じゃないか", CONTRACTED),
    ("行くのは明日ではなく、明後日だ。", "ではなく", FULL),
])
def test_de_wa_before_a_negative_is_read_in_full_and_contracted(jp, hole, said):
    old, new = ("では", "じゃ") if said == FULL else ("じゃ", "では")
    assert _swap(jp, hole) == (said, old, new)


@pytest.mark.parametrize("jp, hole, why", [
    ("名前を読んではいけない。", "ではいけない", "the voiced ては of 読んでは is no では"),
    ("学校では話しません。", "では", "学校では is « at school »: no negative follows it"),
    ("じゃあ、またあした。", "じゃあ", "the じゃあ that opens a reply is no copula"),
    ("学生ではありません。", "学生", "the hole holds no では"),
    ("これは日本語ではありません。", "日本語", "nor here, though the sentence does"),
])
def test_no_other_de_wa_is_read_the_other_way(jp, hole, why):
    assert _swap(jp, hole) is None, why


# ── The register a line is said in (plan 329) ─────────────────

def _register(text: str) -> str | None:
    return analyze_local(text)["register"]


@pytest.mark.parametrize("text, register", [
    # The ending decides: です／ます anywhere in the closing run of
    # endings, however the sentence is shaped.
    ("私は学生です。", POLITE), ("私は学生だ。", PLAIN),
    ("毎日学校に行きます。", POLITE), ("毎日学校に行く。", PLAIN),
    ("きのうは雨でした。", POLITE), ("きのうは雨だった。", PLAIN),
    ("行きませんでした。", POLITE), ("行かなかった。", PLAIN),
    ("高くないです。", POLITE), ("高くない。", PLAIN),
    ("行きましょう。", POLITE), ("行こう。", PLAIN),
    ("早く行ってください。", POLITE),
    ("行かなきゃ。", PLAIN), ("食べなさい。", PLAIN),
    # A final particle, a question mark and a bare cut change nothing.
    ("いい天気ですね。", POLITE), ("いい天気だね。", PLAIN),
    ("本当ですか？", POLITE), ("本当？", None),
    ("行きますか", POLITE), ("行くの？", PLAIN),
    # A clause left open keeps the register of its predicate.
    ("行きますが", POLITE), ("行くけどね", PLAIN),
    # The main verb is the sentence's, not what a quote holds, and a
    # quote said alone is read as it is said.
    ("「行きます」と言った。", PLAIN), ("「行く」と言いました。", POLITE),
    ("「行きます。」", POLITE),
    ("先生が来たので、行く。", PLAIN), ("先生が来たので、行きます。", POLITE),
    # Set phrases that are polite by their ending.
    ("ありがとうございます。", POLITE), ("すみません。", POLITE), ("お願いします。", POLITE),
])
def test_a_line_is_polite_or_plain_by_how_it_closes(text, register):
    assert _register(text) == register


@pytest.mark.parametrize("text, why", [
    ("ありがとう。", "an interjection closes on no predicate"),
    ("おはよう", "a greeting is no register to teach"),
    ("学生", "a noun alone"),
    ("静か", "a な-adjective's stem, with no だ or です"),
    ("駅から", "から after a noun opens nothing"),
    ("行って", "a て-form is no finished predicate, polite or plain"),
    ("行くのが", "a clause cut short on a noun-ish が"),
    ("学生です。行く。", "two sentences, two registers"),
    ("", "nothing to read"),
])
def test_a_line_that_says_nothing_or_two_things_is_none(text, why):
    assert _register(text) is None, why


def test_a_line_polite_in_one_sentence_and_silent_in_another_is_polite():
    assert _register("学生です。ありがとう。") == POLITE
    assert _register("パンをください。それから、ぎゅうにゅうも。") == POLITE


@pytest.mark.parametrize("text", [
    "お客様がいらっしゃいます。", "先生にお会いしました。", "こちらでございます。",
    "私がまいります。", "本を読んでいただきました。", "お待ちください。",
    "このしょるいを見ていただけませんか。", "会議に出席させていただきます。",
    "先生は本を読んでいらっしゃいますか。", "先生がいらっしゃる。", "先生がお帰りになった。",
])
def test_a_line_that_closes_on_a_keigo_point_is_keigo(text):
    assert _register(text) == KEIGO


@pytest.mark.parametrize("text, register, why", [
    ("先生がいらっしゃるので、私は行きます。", POLITE, "the keigo point is in the clause before"),
    ("駅まで送ってくださって、ありがとうございます。", POLITE, "ございます is polite, and the point is a clause back"),
    ("ありがとうございます。", POLITE, "polite, not the keigo of the point"),
    ("町中がお祝いした。", PLAIN, "お祝い + した is no humble お〜する"),
    ("私がお持ちする。", PLAIN, "a plain ending lowers nobody"),
    ("少し待ってください。", POLITE, "ください is the polite request, not くださる"),
    ("その件については、お答えしかねます。", POLITE, "humble, but かね stands between the point and ます"),
])
def test_keigo_is_the_closing_predicates_alone(text, register, why):
    assert _register(text) == register, why


def test_every_keigo_point_is_in_the_catalogue():
    """A pattern is a card id: a rename that leaves the set behind would
    silently turn every keigo line polite."""
    assert [p for p in sorted(KEIGO_POINTS) if find(p) is None] == []


def test_an_unavailable_analysis_has_no_register():
    # The key is always there, so a screen never reads a missing one.
    assert "register" in analyze_local("")
