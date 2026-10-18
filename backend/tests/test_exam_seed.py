# 模試の種 -- the exam pool's seed papers (plan 228): content/exam_seed/,
# built by scripts/exam_seed.py through the generators themselves and
# stored into exam_papers by study/exam_seed.py when routes/exams.py is
# imported. The first test is the owner's floor, PER_EXAM sound papers
# per kind and level; the rest hold the loader, on an exam id no other
# test file writes papers under, wiped before and after.
import copy
import json

import pytest

from core.auth import DEV_USER_ID
from core.db import db_conn
from routes.exams import EXAM_GENERATORS, _load_paper, _select_paper
from study import exam_seed
from tests.conftest import OTHER_USER


@pytest.mark.parametrize("exam_id", list(EXAM_GENERATORS))
def test_every_exam_id_holds_its_seed_papers(exam_id):
    found = exam_seed.exam_problems(exam_id)
    assert not found, "\n".join(found[:40])


# ── The checks themselves ─────────────────────────────────────

def _first(exam_id: str) -> dict:
    data = exam_seed.load(exam_id)
    if not data:
        pytest.skip(f"{exam_id} has no seed papers yet")
    return copy.deepcopy(data["papers"][0]["paper"])


def test_a_paper_short_of_a_question_is_not_a_seed():
    paper = _first("n4-grammar-01")
    paper["sections"][0]["mondai"][0]["questions"].pop()
    assert any(p.startswith("parts ") for p in exam_seed.problems("n4-grammar-01", paper))


def test_a_listening_clip_must_be_the_clip_of_its_script():
    paper = _first("n4-listening-01")
    question = paper["sections"][0]["mondai"][0]["questions"][0]
    question["scriptJp"] += "。"
    assert any("audioSrc" in p for p in exam_seed.problems("n4-listening-01", paper))


def test_a_star_on_the_last_piece_is_answered_by_its_full_stop():
    paper = _first("n4-grammar-01")
    order_mondai = next(m for m in paper["sections"][0]["mondai"] if m["type"] == "sentence-order")
    q = order_mondai["questions"][0]
    q["starIndex"], q["answer"] = 3, q["order"][3]
    assert any("★" in p for p in exam_seed.problems("n4-grammar-01", paper))


def test_the_generator_never_puts_the_star_at_either_end():
    from study.exam_grammar_gen import star_slot
    assert [star_slot(i) for i in range(4)] == [1, 1, 2, 2]


def _mcq(sizes: list[int], right: int) -> dict:
    ids = ["c1", "c2", "c3", "c4"]
    return {"id": "q", "choices": [{"id": i, "textJp": "あ" * n} for i, n in zip(ids, sizes)],
            "answer": ids[right]}


def _paper_of(questions: list[dict]) -> dict:
    return {"sections": [{"id": "s", "mondai": [{"id": "m", "number": 1, "type": "t", "questions": questions}]}]}


def test_length_must_not_answer():
    always_longest = _paper_of([_mcq([3, 4, 5, 9], 3) for _ in range(20)])
    assert any("the longest" in t for t in exam_seed.length_tells([always_longest]))
    rotating = _paper_of([_mcq([3, 4, 5, 9], i % 4) for i in range(20)])
    assert exam_seed.length_tells([rotating]) == []


def _passage_paper(text: str, questions: list[tuple[list[str], int]]) -> dict:
    ids = ["c1", "c2", "c3", "c4"]
    qs = [{"id": f"q{n}", "choices": [{"id": i, "textJp": c} for i, c in zip(ids, choices)], "answer": ids[right]}
          for n, (choices, right) in enumerate(questions)]
    return {"sections": [{"id": "reading", "mondai": [{"id": "m", "number": 1, "type": "reading-passage",
                                                        "passages": [{"id": "p", "textJp": text, "questions": qs}]}]}]}


def test_the_passages_wording_must_not_answer():
    # Plan 247: the keys copied the passage, the wrong choices did not.
    text = "毎朝、駅前のパン屋で焼きたてのパンを買ってから会社へ行きます。"
    copied = (["駅前のパン屋で焼きたてのパンを買う", "会社の食堂で食べる", "家で作る", "何も食べない"], 0)
    assert any("copies the most" in t for t in exam_seed.echo_tells([_passage_paper(text, [copied] * 8)]))
    reworded = (["店で朝ごはんを用意する", "駅前のパン屋で焼きたてのパンを食べる", "家で作る", "何も食べない"], 0)
    mixed = [copied] * 2 + [reworded] * 6
    assert exam_seed.echo_tells([_passage_paper(text, mixed)]) == []


def _dialogue(n: int, lines: list[str]) -> dict:
    script = "\n".join(["narrator: 二人が話しています。"] + [f"{'AB'[i % 2]}: {line}" for i, line in enumerate(lines)])
    return {"n": n, "paper": {"sections": [{"id": "listening", "mondai": [
        {"id": "m", "type": "listening-mcq", "questions": [{"id": "choukai_1_q1", "scriptJp": script}]}]}]}}


def test_a_story_told_twice_is_found():
    seats = ["映画のせきはどこがいいですか。", "まえのほうがいいです。", "じゃあ、まんなかのせきにしましょう。"]
    retold = ["映画のせきは、どこにしますか。", "まえのほうがいいですね。", "では、まんなかのせきを買いましょう。"]
    other = ["あしたのテスト、何時からですか。", "九時からですよ。", "早く起きなければなりませんね。"]
    found = exam_seed.retold_stories([_dialogue(1, seats), _dialogue(2, retold), _dialogue(3, other)])
    assert len(found) == 1 and found[0].startswith("#2 choukai_1_q1 retells #1 choukai_1_q1")
    # The narrator's frame is the same in every item and is not the story.
    assert exam_seed.retold_stories([_dialogue(1, seats), _dialogue(3, other)]) == []


def test_a_word_tested_twice_is_found():
    def entry(n, prompt, right):
        q = {"id": "moji_1_q1", "promptJp": prompt, "answer": "c1",
             "choices": [{"id": "c1", "textJp": right}, {"id": "c2", "textJp": "x"}]}
        return {"n": n, "paper": {"sections": [{"id": "vocabulary", "mondai": [{"id": "moji_1", "questions": [q]}]}]}}

    found = exam_seed.retested_words("N2", [entry(1, "両側", "りょうがわ"), entry(2, "洗剤", "せんざい"),
                                            entry(3, "両側", "りょうがわ")])
    assert found == ["#3 moji_1_q1 tests 両側 again (#1 moji_1_q1)"]


def test_a_word_is_one_word_in_kana_and_in_any_form():
    # By the deck entry it names, read in its sentence: 水曜日 and すいようび
    # are one word, 言う and 言いました one, but セーターをきました is 着る,
    # which the tokenizer alone reads 来る.
    def item(n, mondai, prompt, right, underline=None):
        q = {"id": f"{mondai}_q1", "promptJp": prompt, "answer": "c1",
             "choices": [{"id": "c1", "textJp": right}, {"id": "c2", "textJp": "x"}]}
        if underline:
            q["underlineJp"] = underline
        return {"n": n, "paper": {"sections": [{"id": "vocabulary", "mondai": [{"id": mondai, "questions": [q]}]}]}}

    found = exam_seed.retested_words("N5", [
        item(1, "moji_1", "水曜日", "すいようび"),
        item(2, "moji_4", "すいようびに行きます。", "もくようび", underline="すいようび"),
        item(3, "moji_2", "くる", "来る"),
        item(4, "moji_3", "さむいので、セーターを＿＿＿＿。", "きました"),
        item(5, "moji_1", "言う", "いう"),
        item(6, "moji_3", "先生に「ありがとう」と＿＿＿＿。", "言いました"),
    ])
    assert found == ["#2 moji_4_q1 tests すいようび again (#1 moji_1_q1)",
                     "#6 moji_3_q1 tests 言いました again (#5 moji_1_q1)"]


# ── The loader ────────────────────────────────────────────────

EXAM = "n3-reading-01"
VERSION = EXAM_GENERATORS[EXAM][0]


def _sql(query: str, params: tuple = (), fetch: bool = False):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall() if fetch else None
        conn.commit()
        return rows
    finally:
        conn.close()


def _wipe() -> None:
    _sql("DELETE FROM exam_attempts WHERE exam_id = %s", (EXAM,))
    _sql("DELETE FROM exam_papers WHERE exam_id = %s", (EXAM,))


@pytest.fixture(autouse=True)
def clean():
    _wipe()
    yield
    _wipe()


def _toy(title: str) -> dict:
    return {"level": "N3", "title": title, "titleJp": title,
            "sections": [{"id": "reading", "mondai": [{"id": "m", "number": 1, "type": "reading-passage",
                                                        "passages": [{"id": "p", "questions": [_mcq([2, 2, 2, 2], 0)]}]}]}]}


@pytest.fixture
def seeds(monkeypatch):
    """Two seed papers for EXAM, in place of the shipped files: the dict
    is the set study/exam_seed.rows yields, edited by each test."""
    papers = {1: _toy("one"), 2: _toy("two")}
    monkeypatch.setattr(exam_seed, "rows", lambda: [
        (EXAM, VERSION, n, 100 + n, paper) for n, paper in sorted(papers.items())
    ])
    return papers


def _rows():
    return _sql("SELECT revision, generator_version, seed_key, paper->>'title' FROM exam_papers"
                " WHERE exam_id = %s ORDER BY revision", (EXAM,), fetch=True)


def _sit(user: str, revision: int) -> None:
    _sql("INSERT INTO exam_attempts (user_id, exam_id, revision, section_id, answers, review, per_section,"
         " correct, total, started_at, finished_at)"
         " VALUES (%s, %s, %s, 'reading', '{}', '{}', '{}', 1, 1, NOW(), NOW())",
         (user, EXAM, revision))


def test_seeds_are_stored_after_the_papers_already_there(seeds):
    _sql("INSERT INTO exam_papers (exam_id, revision, level, seed, generator_version, paper, section_count, question_count)"
         " VALUES (%s, 1, 'N3', 1, %s, %s, 1, 1)", (EXAM, VERSION, json.dumps(_toy("generated"))))
    assert exam_seed.seed_exam_papers() == 2
    rows = _rows()
    assert [(r[0], r[1], r[3]) for r in rows] == [(1, VERSION, "generated"), (2, VERSION, "one"), (3, VERSION, "two")]
    assert rows[0][2] is None and rows[1][2].startswith(f"{EXAM}#1@") and rows[2][2].startswith(f"{EXAM}#2@")
    # A warm pool writes nothing.
    assert exam_seed.seed_exam_papers() == 0


def test_a_seed_is_served_like_any_paper(seeds):
    exam_seed.seed_exam_papers()
    assert _select_paper(EXAM, DEV_USER_ID)[1]["title"] == "one"
    _sit(DEV_USER_ID, 1)
    assert _select_paper(EXAM, DEV_USER_ID)[1]["title"] == "two"


def test_a_changed_seed_nobody_sat_is_rewritten_in_place(seeds):
    exam_seed.seed_exam_papers()
    seeds[1] = _toy("one, corrected")
    assert exam_seed.seed_exam_papers() == 1
    assert [(r[0], r[3]) for r in _rows()] == [(1, "one, corrected"), (2, "two")]


def test_a_changed_seed_somebody_sat_retires_the_revision_they_sat(seeds):
    exam_seed.seed_exam_papers()
    _sit(OTHER_USER, 1)
    seeds[1] = _toy("one, corrected")
    assert exam_seed.seed_exam_papers() == 1
    rows = _rows()
    assert [(r[0], r[1], r[3]) for r in rows] == [
        (1, exam_seed.RETIRED_PREFIX + VERSION, "one"), (2, VERSION, "two"), (3, VERSION, "one, corrected"),
    ]
    assert rows[0][2] is None
    # Never served again, still there for the result screen of whoever sat it.
    assert _select_paper(EXAM, DEV_USER_ID)[1]["title"] == "two"
    assert _load_paper(EXAM, 1)["title"] == "one"
    assert exam_seed.seed_exam_papers() == 0


def test_a_seed_file_another_generator_made_is_skipped(monkeypatch, tmp_path):
    monkeypatch.setattr(exam_seed, "SEED_DIR", tmp_path)
    entry = {"n": 1, "seed": exam_seed.seed_for(EXAM, 1), "paper": _toy("one")}
    path = tmp_path / f"{EXAM}.json"
    path.write_text(json.dumps({"examId": EXAM, "generatorVersion": "reading-gen-0", "papers": [entry]}))
    assert list(exam_seed.rows()) == []
    path.write_text(json.dumps({"examId": EXAM, "generatorVersion": VERSION, "papers": [entry]}))
    assert [(r[0], r[2]) for r in exam_seed.rows()] == [(EXAM, 1)]
