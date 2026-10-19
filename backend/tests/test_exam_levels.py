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


def test_ならぶ_is_not_a_condition_and_どうやって_is_not_ていく():
    assert L.grammar_above("旅行に行くなら、この本がやくに立ちます。", "N5") == [("〜なら", "N4")]
    assert L.grammar_above("人がたくさんならんでいますよ。", "N5") == []
    assert L.grammar_above("だんだん寒くなっていきます。", "N5") == [("〜ていく／〜てくる", "N4")]
    assert L.grammar_above("ゆいさんは、どうやって行きますか。", "N5") == []


def test_a_thing_there_is_is_not_ものがある():
    assert L.grammar_above("彼の歌には人をひきつけるものがある。", "N4") == [("〜ものがある", "N2")]
    assert L.grammar_above("ほしいものがあったら何でも言ってください。", "N4") == []


def test_the_two_sentences_read_by_hand():
    assert [p for p, _ in L.grammar_above("会議において、この問題を話し合った。", "N4")][0] == "〜において"
    assert L.grammar_above("スマホをへやの外においてねるようにしました。", "N4") == []   # 置いて
    assert L.grammar_above("子どものころは、よく川で泳いだものだ。", "N3") == [("〜ものだ", "N2")]
    assert L.grammar_above("この時計は父が買ってきたものだそうだ。", "N3") == []          # もの: a thing


def test_n1_has_nothing_above_it():
    assert L.paper_grammar_above({"level": "N1", "sections": []}) == []
