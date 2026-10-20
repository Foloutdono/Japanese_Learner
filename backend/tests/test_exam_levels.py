# A paper shows only the kanji of its level (plan 257).
from study import exam_levels as L


def _paper(level, **question):
    return {"level": level, "sections": [{"id": "s", "mondai": [
        {"id": "m", "number": 1, "type": "mcq-text", "instructionsJp": "読み方として　最も　よい", "questions": [
            {"id": "q1", "number": 1, **question}]}]}]}


def test_a_kanji_the_level_has_not_been_taught_is_named():
    paper = _paper("N5", promptJp="曇る", choices=[{"id": "c1", "textJp": "くもる"}])
    assert L.kanji_outside(paper, "vocab") == [("q1 promptJp", "曇")]


def test_the_levels_own_kanji_pass():
    paper = _paper("N5", promptJp="学校", choices=[{"id": "c1", "textJp": "がっこう"}])
    assert L.kanji_outside(paper, "vocab") == []


def test_a_wrong_choice_is_held_to_the_level_too():
    paper = _paper("N5", promptJp="くる", choices=[{"id": "c1", "textJp": "来る"}, {"id": "c2", "textJp": "燵る"}])
    assert L.kanji_outside(paper, "vocab") == [("q1 choice c2", "燵")]


def test_the_instructions_are_not_read():
    # every mondai prints the same instruction, kanji or not
    assert L.paper_texts(_paper("N5", promptJp="あ", choices=[]))[0][1] == "あ"
    assert all("読み方" not in text for _, text in L.paper_texts(_paper("N5", promptJp="あ", choices=[])))


def test_a_grammar_papers_own_pattern_may_be_spelled_with_its_kanji():
    # に伴って is an N2 point and 伴 an N1 kanji
    paper = _paper("N2", promptJp="人口が増える＿＿＿＿", choices=[{"id": "c1", "textJp": "に伴って"}])
    assert L.kanji_outside(paper, "grammar") == []
    assert L.kanji_outside(paper, "vocab") == [("q1 choice c1", "伴")]


# ── Grammar above the level ────────────────────────────────────────────

def test_a_point_the_catalogue_files_above_the_level_is_found():
    assert ("〜そうだ（伝聞）", "N4") in L.grammar_above("あしたは雨がふるそうです。", "N5")
    assert ("〜んです／〜のです", "N4") in L.grammar_above("もっていきたいんです。", "N5")
    assert ("〜ざるを得ない", "N2") in L.grammar_above("彼は会議を延期せざるを得なかった。", "N3")


def test_the_same_point_at_its_own_level_is_not():
    assert L.grammar_above("あしたは雨がふるそうです。", "N4") == []
    assert L.grammar_above("あしたは雨がふると思います。", "N5") == []


def test_what_only_looks_like_a_point_is_not_counted():
    assert L.grammar_above("ふくをもってきてください。", "N5") == []       # 持って来る, not 〜ていく nor 〜をもって
    assert L.grammar_above("いらっしゃいませ。", "N5") == []                 # the shop's greeting
    assert L.grammar_above("どんな本が好きですか。", "N5") == []
    assert L.grammar_above("毎朝、コーヒーを飲みます。", "N5") == []         # 毎, not 〜まい


def _stem_paper(level, prompt, choices, answer=0):
    return {"level": level, "sections": [{"id": "s", "mondai": [{"id": "m", "number": 1, "type": "t", "questions": [
        {"id": "q1", "number": 1, "promptJp": prompt,
         "choices": [{"id": f"c{i + 1}", "textJp": c} for i, c in enumerate(choices)],
         "answer": f"c{answer + 1}"}]}]}]}


def test_a_sentence_is_read_with_its_blank_filled():
    paper = _stem_paper("N5", "あしたは　雨が　ふる＿＿＿＿です。", ["そう", "の"])
    # the spaces between phrases are the paper's own; the point is found through them
    assert [(w, lv) for w, _pattern, lv in L.paper_grammar_above(paper)] == [("q1", "N4")]


def test_the_spaces_between_phrases_are_not_read():
    # with one, ふると　おもいます is a conditional と (N4) and なければ　なりません a ば:
    # unspaced they are the N5 points 〜と思います and 〜なければなりません
    paper = _stem_paper("N5", "あしたは　雨が　ふる＿＿＿＿　おもいます。", ["と", "が"])
    assert L.paper_grammar_above(paper) == []
    paper = _stem_paper("N5", "A「この　へやで　くつを　ぬが＿＿＿＿　なりませんか。」", ["なければ", "ないで"])
    assert L.paper_grammar_above(paper) == []


def test_the_choices_of_a_blank_are_pieces_of_its_stem():
    # なくてもいいです alone is read as 〜ても; poured in, it is the N5 point
    paper = _stem_paper("N5", "あしたは　休みですから、早く　おき＿＿＿＿。", ["なくてもいいです", "ないでください", "なければなりません", "ません"])
    assert L.paper_grammar_above(paper) == []


def test_the_choices_of_a_question_without_a_blank_are_read_when_they_are_sentences():
    paper = _stem_paper("N5", "アナさんは　なぜ　日本語を　べんきょうしていますか。",
                        ["日本のアニメが大すきだから", "日本に行ったことがあるから", "日本語", "ともだち"])
    assert [(w, p) for w, p, _lv in L.paper_grammar_above(paper)] == [("q1 choice c2", "〜ことがある")]


def test_a_noun_before_と_is_no_condition():
    assert L.grammar_above("春になると、さくらがさきます。", "N5") == [("〜と", "N4")]
    assert L.grammar_above("メキシコのおかしと、アナさんがかいたえが入っていました。", "N5") == []   # おかし: おかしい
    assert L.grammar_above("アナさんのいぬと大きい木でした。", "N5") == []                          # いぬ: 往ぬ
    assert L.grammar_above("月よう日のよると、土よう日の午前があります。", "N5") == []              # よる: 因る


def test_the_の_that_nominalises_is_not_the_の_between_nouns():
    assert L.grammar_above("本を読むのは楽しいです。", "N5") == [("〜の", "N4")]
    assert L.grammar_above("ほんだなのいちばん上にじしょがあります。", "N5") == []
    assert L.grammar_above("水よう日はよるの7時からです。", "N5") == []


def test_choosing_that_one_is_not_a_connective():
    assert L.grammar_above("この店は安い。それに、おいしい。", "N5") == [("それに", "N4")]
    assert L.grammar_above("電車がおくれました。それで、ちこくしました。", "N5") == [("それで", "N4")]
    assert L.grammar_above("じゃ、それにします。", "N5") == []
    assert L.grammar_above("はい、それでおねがいします。", "N5") == []
    assert L.grammar_above("はい、それでお願いします。", "N5") == []
    assert L.grammar_above("それでは、また明日。", "N5") == []                           # well then


def test_ならぶ_is_not_a_condition_and_どうやって_is_not_ていく():
    assert L.grammar_above("旅行に行くなら、この本がやくに立ちます。", "N5") == [("〜なら", "N4")]
    assert L.grammar_above("人がたくさんならんでいますよ。", "N5") == []
    assert L.grammar_above("だんだん寒くなっていきます。", "N5") == [("〜ていく／〜てくる", "N4")]
    assert L.grammar_above("ゆいさんは、どうやって行きますか。", "N5") == []
    assert L.grammar_above("今日は休まないで来ました。", "N5") == []                      # without resting


def test_a_thing_there_is_is_not_ものがある():
    assert L.grammar_above("彼の歌には人をひきつけるものがある。", "N4") == [("〜ものがある", "N2")]
    assert L.grammar_above("ほしいものがあったら何でも言ってください。", "N4") == []
    assert L.grammar_above("ほしいものがあります。", "N5") == []                  # a thing wanted
    assert L.grammar_above("食べたいものがありますか。", "N5") == []


# ── What comprehension's texts met (plan 260) ─────────────────────────
# level_mix reads this gate for comprehension since plan 260, and diffed
# over every sentence the app teaches it named these readings of ordinary
# words. Each rule leaves the point's own lessons found (below).

def test_a_kana_noun_ending_in_ん_explains_nothing():
    # きっさてん is cut 喫さ + て(る) + ん, らいねん 払い + ね + ん
    assert L.grammar_above("あそこはきっさてんです。", "N5") == []
    assert L.grammar_above("あそこはこうさてんです。", "N5") == []
    assert L.grammar_above("しけんはらいねんです。", "N5") == []
    assert L.grammar_above("時間がないんです。", "N5") == [("〜んです／〜のです", "N4")]
    assert L.grammar_above("何してんですか。", "N5") == [("〜んです／〜のです", "N4")]       # してる, said short


def test_the_past_of_ところだ_is_not_nearly():
    assert L.grammar_above("私たちはちょうど家を出るところでした。", "N4") == []
    assert L.grammar_above("電話が鳴ったとき、ごはんを食べているところだった。", "N4") == []
    assert L.grammar_above("昨日の授業は、けっこう大事なところだったよ。", "N4") == []      # a part of it
    assert L.grammar_above("もう少しで、電車に乗り遅れるところだった。", "N4") == [("〜ところだった", "N2")]
    assert L.grammar_above("あぶない。転ぶところだった。", "N4") == [("〜ところだった", "N2")]


def test_n5_likes_doing_with_the_nominaliser_of_its_own_lesson():
    # 〜のが好きです: "the same の works with 上手, きらい"
    assert L.grammar_above("水の中であそぶのもすきです。", "N5") == []
    assert L.grammar_above("母は、うたうのが上手です。", "N5") == []
    assert L.grammar_above("車をうんてんするのがきらいです。", "N5") == []
    assert L.grammar_above("本を読むのは楽しいです。", "N5") == [("〜の", "N4")]


def test_せいで_blames_a_clause_or_a_noun_with_の():
    assert L.grammar_above("わたしはこうこうせいでした。", "N4") == []                     # 高校生
    assert L.grammar_above("雨のせいで、試合は中止になりました。", "N4") == [("〜せいで", "N3")]
    assert L.grammar_above("電車が遅れたせいで、会議に間に合わなかった。", "N4") == [("〜せいで", "N3")]


def test_うちに_after_a_clause_is_while_and_anywhere_else_home():
    assert L.grammar_above("六時にうちにかえります。", "N5") == []
    assert L.grammar_above("友だちのうちに行きました。", "N5") == []
    assert L.grammar_above("大きいうちにすみたいです。", "N5") == []                      # a house lived in
    assert L.grammar_above("油ならうちにあるから、今さしておくよ。", "N2") == []
    assert L.grammar_above("熱いうちに食べてください。", "N4") == [("〜うちに", "N3")]
    assert L.grammar_above("日本語で話しているうちに、上手になった。", "N4") == [("〜うちに", "N3")]
    assert L.grammar_above("忘れないうちに、メモしておこう。", "N4") == [("〜うちに", "N3")]


def test_をもって_counts_after_a_date_and_never_after_a_thing_carried():
    assert L.grammar_above("本日をもって、この店は閉店いたします。", "N3") == [("〜をもって", "N2")]
    assert L.grammar_above("三月三十一日をもって閉店します。", "N3") == [("〜をもって", "N2")]
    assert L.grammar_above("コートをもって出かけました。", "N5") == []
    assert L.grammar_above("かさをもって、学校へ行きました。", "N5") == []


def test_a_greeting_or_もう_is_not_the_point_it_spells():
    assert L.grammar_above("いいえ、どういたしまして。", "N5") == []
    assert L.grammar_above("しゅくだいは、もうしましたね？", "N5") == []                  # もう + しました
    assert L.grammar_above("田中ともうします。", "N5") == [("まいる／もうす／いたす", "N4")]
    assert L.grammar_above("そのお仕事は私がいたします。", "N5") == [("まいる／もうす／いたす", "N4")]
    assert L.grammar_above("じゃ、いってきます。", "N5") == []
    assert L.grammar_above("パンを買ってくる。", "N5") == [("〜ていく／〜てくる", "N4")]


def test_a_kana_word_keeps_its_letters():
    assert L.grammar_above("とりにくをかいました。", "N5") == []                          # 肉
    assert L.grammar_above("この漢字はおぼえにくいです。", "N5") == [("〜やすい／〜にくい", "N4")]
    assert L.grammar_above("きのう、どこかでかさをわすれました。", "N5") == []              # 傘
    assert L.grammar_above("この山の高さは三千メートルです。", "N5") == [("〜さ", "N4")]


def test_置いて_and_始める_are_verbs_of_their_own():
    assert L.grammar_above("かぎは、つくえの上においてください。", "N4") == []
    assert L.grammar_above("ここでは、にもつをおいてはいけません。", "N5") == []
    assert L.grammar_above("子どもを家においてきた。", "N4") == []                         # left behind
    assert L.grammar_above("病気の母をおいて行くわけにはいかない。", "N2") == []
    assert L.grammar_above("会議は大きな部屋において行われます。", "N4") == [("〜において", "N3")]
    assert L.grammar_above("会議において行った発表をまとめた。", "N4") == [("〜において", "N3")]   # 行った: held
    assert L.grammar_above("日本語のべんきょうをはじめました。", "N5") == []
    assert L.grammar_above("社長をはじめ、社員全員が式に出席した。", "N3") == [("〜をはじめ", "N2")]


def test_にしたら_and_ことに_said_plainly():
    assert L.grammar_above("こちらのきっぷにしたらいかがですか。", "N4") == []              # にする: how about
    assert L.grammar_above("毎日歩くようにしたら、元気になりました。", "N4") == []
    assert L.grammar_above("親にしたら、子どもの帰りが遅いのは心配だ。", "N3") == [("〜にしたら", "N2")]
    assert L.grammar_above("さいふをわすれたことに気がついた。", "N3") == []
    assert L.grammar_above("おどろいたことに、彼は一週間で日本語を覚えた。", "N3") == [("〜ことに", "N2")]


# The lessons no rule can keep: a lesson the gate leaves uncounted, by a
# reading it cannot tell from the ordinary word written alike
_LEFT_UNCOUNTED = {
    "駅まで歩いていきました。",               # 歩いて行く, a verb of its own (plan 257)
    "一日中、家で本を読んでいました。",         # 一日中, 世界中: words (plan 257)
    "この歌は世界中で歌われています。",
    "どんな音楽を聞きますか。",                # どんな〜ですか, an N5 question (plan 257)
    "彼は実力をもって、周囲を認めさせた。",     # spelled and cut like 持って
    "答えは書面をもってお知らせします。",
    "これをもって、本日の会議を終わります。",
}


def test_every_rule_leaves_its_points_lessons_found():
    """A lesson the detector finds its point in is caught a level below,
    for every point a rule names: an exemption never hides the thing
    itself. The rules are read off _is_not_the_point and its tables, so
    a rule added there is held here without being listed."""
    import inspect
    import re

    from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
    from study import difficulty, grammar_detect

    ruled = {pat for pat, _rx in L._NOT_THE_POINT + L._READ_BY_HAND}
    ruled |= set(re.findall(r'pattern == "([^"]+)"', inspect.getsource(L._is_not_the_point)))
    checked = 0
    for level, below in zip(L.LEVELS[1:], L.LEVELS):
        for point in GRAMMAR_POINTS_BY_LEVEL[level]:
            if point["pattern"] not in ruled or not grammar_detect.can_find(point["pattern"]):
                continue
            for example in point.get("examples", []):
                jp = example["jp"]
                if jp in _LEFT_UNCOUNTED or point["pattern"] not in {p for p, *_ in difficulty.points_in(jp)}:
                    continue
                checked += 1
                assert (point["pattern"], level) in L.grammar_above(jp, below), (point["pattern"], jp)
    assert checked >= 100


def test_the_two_sentences_read_by_hand():
    assert [p for p, _ in L.grammar_above("会議において、この問題を話し合った。", "N4")][0] == "〜において"
    assert L.grammar_above("スマホをへやの外においてねるようにしました。", "N4") == []   # 置いて
    assert L.grammar_above("子どものころは、よく川で泳いだものだ。", "N3") == [("〜ものだ", "N2")]
    assert L.grammar_above("この時計は父が買ってきたものだそうだ。", "N3") == []          # もの: a thing


def test_n1_has_nothing_above_it():
    assert L.paper_grammar_above({"level": "N1", "sections": []}) == []
