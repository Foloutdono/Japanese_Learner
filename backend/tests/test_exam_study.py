# 模試の復習 -- a sat question made something to study (the result
# screen's translation and breakdown), and the 言い換え item that gave
# its answer away by offering the underlined word as a choice.
import json

import pytest

from core.db import db_conn
from routes.exams import EXAM_GENERATORS, _select_paper
from core.auth import DEV_USER_ID
from study import exam_study
from study.exam_study import find_question, study_context, study_sentence
from study.exam_validation import offers_underlined_word, paper_gives_answer_away, validate_mcq_question
from study.exam_vocab_gen import choice_repeats_target

EXAM = "n5-vocab-01"


def _choices(*texts):
    return [{"id": f"c{i + 1}", "textJp": t} for i, t in enumerate(texts)]


GIVEAWAY = {
    "id": "m3_q1", "number": 1,
    "promptJp": "休みは三日だけあります。", "underlineJp": "三日",
    "choices": _choices("一日", "二日", "三日", "四日"), "answer": "c3",
}

PAPER = {
    "level": "N5", "title": "N5 Test", "titleJp": "N5 テスト",
    "sections": [{"id": "s", "label": "S", "mondai": [
        {"id": "m1", "number": 1, "type": "grammar-fill", "questions": [
            {"id": "fill", "promptJp": "駅＿＿＿＿行きます。", "choices": _choices("へ", "を", "が", "の"), "answer": "c1"},
        ]},
        {"id": "m2", "number": 2, "type": "sentence-order", "questions": [
            {"id": "order", "contextJp": "きのう、",
             "pieces": [{"id": "p2", "textJp": "パンを"}, {"id": "p1", "textJp": "わたしは"},
                        {"id": "p4", "textJp": "食べました。"}, {"id": "p3", "textJp": "たくさん"}],
             "order": ["p1", "p2", "p3", "p4"], "starIndex": 2, "answer": "p3"},
        ]},
        {"id": "m3", "number": 3, "type": "cloze-passage", "passages": [
            {"id": "p", "titleJp": "t", "textTemplateJp": "私は学生です。毎日学校【1】行きます。友だち【2】会います。",
             "blanks": [{"id": "b1", "number": 1, "choices": _choices("に", "を", "で", "が"), "answer": "c1"},
                        {"id": "b2", "number": 2, "choices": _choices("を", "に", "が", "の"), "answer": "c2"}]},
        ]},
        {"id": "m4", "number": 4, "type": "vocab-usage", "questions": [
            {"id": "usage", "promptJp": "ひらく", "choices": _choices("窓をひらく。", "水をひらく。", "本をひらく雨。", "空がひらく人。"), "answer": "c1"},
        ]},
        {"id": "m5", "number": 5, "type": "reading-passage", "passages": [
            {"id": "rp", "textJp": "きょうは雨です。", "questions": [
                {"id": "read", "promptJp": "天気はどうですか。", "choices": _choices("雨", "雪", "晴れ", "くもり"), "answer": "c1"},
            ]},
        ]},
    ]}],
}


# ── The giveaway ──────────────────────────────────────────────

def test_the_underlined_word_among_the_choices_is_caught():
    assert offers_underlined_word(GIVEAWAY)
    assert any("repeats the underlined word" in e for e in validate_mcq_question(GIVEAWAY))
    fair = {**GIVEAWAY, "choices": _choices("一日", "二日", "みっかかん", "四日")}
    assert not offers_underlined_word(fair)
    assert validate_mcq_question(fair) == []


def test_the_generator_drops_an_item_that_offers_its_own_word():
    word = {"kanji": "三日", "kana": "みっか", "meaning": "three days"}
    assert choice_repeats_target(["一日", "二日", "三日", "四日"], "三日", word)
    assert choice_repeats_target(["一日", "二日", "みっか", "四日"], "三日", word)
    assert choice_repeats_target(["一日", "二日", "三日間", "四日"], "三日", word)
    eat = {"kanji": "食べる", "kana": "たべる", "meaning": "to eat"}
    assert choice_repeats_target(["飲んだ", "食べる", "見た", "寝た"], "食べた", eat)
    assert not choice_repeats_target(["いただいた", "飲んだ", "見た", "寝た"], "食べた", eat)


def _sql(sql, params=()):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.commit()
    finally:
        conn.close()


@pytest.fixture
def papers():
    def wipe():
        _sql("DELETE FROM exam_attempts WHERE exam_id = %s", (EXAM,))
        _sql("DELETE FROM exam_papers WHERE exam_id = %s", (EXAM,))
    wipe()
    bad = {**PAPER, "sections": [{"id": "s", "label": "S", "mondai": [
        {"id": "m3", "number": 3, "type": "vocab-paraphrase", "questions": [GIVEAWAY]}]}]}
    for revision, paper in ((1, bad), (2, PAPER)):
        _sql(
            "INSERT INTO exam_papers (exam_id, revision, level, seed, generator_version, paper, section_count, question_count)"
            " VALUES (%s, %s, 'N5', 1, %s, %s, 1, 1)",
            (EXAM, revision, EXAM_GENERATORS[EXAM][0], json.dumps(paper)),
        )
    yield
    wipe()


def test_a_stored_paper_that_gives_an_answer_away_is_passed_over(papers):
    assert paper_gives_answer_away({"sections": [{"mondai": [{"questions": [GIVEAWAY]}]}]})
    assert not paper_gives_answer_away(PAPER)
    revision, _paper = _select_paper(EXAM, DEV_USER_ID)
    assert revision == 2


# ── The sentence a question is studied by ─────────────────────

def _sentence(qid):
    return study_sentence(*find_question(PAPER, qid))


def test_the_answer_goes_in_its_gap():
    assert _sentence("fill") == "駅へ行きます。"


def test_the_pieces_go_in_their_order():
    assert _sentence("order") == "きのう、わたしはパンをたくさん食べました。"


def test_a_cloze_blank_is_read_in_its_own_sentence_filled():
    assert _sentence("b1") == "毎日学校に行きます。"
    assert _sentence("b2") == "友だちに会います。"


def test_a_usage_item_is_read_in_its_right_sentence():
    assert _sentence("usage") == "窓をひらく。"


def test_a_reading_question_carries_its_passage():
    mondai, q, passage = find_question(PAPER, "read")
    assert study_sentence(mondai, q, passage) == "天気はどうですか。"
    assert study_context(mondai, q, passage) == "きょうは雨です。"
    assert study_context(*find_question(PAPER, "b1")) == ""


def test_no_question_by_that_id():
    assert find_question(PAPER, "nope") is None


# ── The endpoint ──────────────────────────────────────────────

def test_the_route_translates_from_the_stored_paper_and_caches(client, papers, monkeypatch):
    calls = []

    def fake_llm(prompt, user_message, task="exam"):
        calls.append(user_message)
        if "Choices:" in user_message:
            return {"sentence": "I go to the station.", "choices": ["to", "(object)", "(subject)", "of"]}
        return {"translation": "It is raining today."}

    monkeypatch.setattr(exam_study, "call_llm_json", fake_llm)
    _sql("DELETE FROM exam_translations")

    r = client.get(f"/api/exams/{EXAM}/revisions/2/questions/fill/study?lang=en")
    assert r.status_code == 200
    body = r.json()
    assert body["sentence"] == "駅へ行きます。"
    assert body["translation"] == "I go to the station."
    assert [c["id"] for c in body["choices"]] == ["c1", "c2", "c3", "c4"]
    assert body["choices"][0]["translation"] == "to"
    assert body["context"] == ""

    again = client.get(f"/api/exams/{EXAM}/revisions/2/questions/fill/study?lang=en")
    assert again.json() == body
    assert len(calls) == 1  # the second answer came from the cache

    read = client.get(f"/api/exams/{EXAM}/revisions/2/questions/read/study?lang=en").json()
    assert read["contextTranslation"] == "It is raining today."

    assert client.get(f"/api/exams/{EXAM}/revisions/2/questions/nope/study").status_code == 404
    assert client.get(f"/api/exams/{EXAM}/revisions/9/questions/fill/study").status_code == 404


def test_the_route_answers_503_when_no_model_can_translate(client, papers, monkeypatch):
    from study.llm_shared import LLMUnavailable

    def down(*_a, **_k):
        raise LLMUnavailable("none")

    monkeypatch.setattr(exam_study, "call_llm_json", down)
    _sql("DELETE FROM exam_translations")
    r = client.get(f"/api/exams/{EXAM}/revisions/2/questions/usage/study?lang=fr")
    assert r.status_code == 503
