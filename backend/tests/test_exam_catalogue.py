# 模試の目録 -- the three fields GET /api/exams carries since plan 159,
# for the exam station filled on the desk: `minutes` (the paper's
# printed time limit, or the generator's own rule over the items a paper
# not yet generated is expected to hold), `mondai` (the blueprint's
# names for what the paper is made of) and `last` (this learner's newest
# sitting at the exam id, any revision). Papers are written straight
# into exam_papers under two real ids no other test file generates, and
# removed afterwards.
import json
from datetime import datetime, timezone

import pytest

from core.auth import DEV_USER_ID
from core.db import db_conn
from routes.exams import EXAM_GENERATORS, _KIND_META, _expected_question_count
from study import exam_grammar_gen, exam_listening_gen, exam_reading_gen, exam_vocab_gen
from study.exam_blueprint import LEVEL_BLUEPRINT
from tests.conftest import OTHER_USER, acting_as

GENERATED = "n1-listening-01"   # a paper this learner has not sat: served, with its limit
SAT = "n2-reading-01"           # a paper this learner has sat: the next is a generation


def _day(day: int) -> datetime:
    return datetime(2026, 9, day, 9, tzinfo=timezone.utc)


def _sql(sql: str, params: tuple = ()) -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.commit()
    finally:
        conn.close()


def _wipe() -> None:
    for exam_id in (GENERATED, SAT):
        _sql("DELETE FROM exam_attempts WHERE exam_id = %s", (exam_id,))
        _sql("DELETE FROM exam_papers WHERE exam_id = %s", (exam_id,))


def _paper(exam_id: str, level: str, minutes: int | None, questions: int) -> None:
    section = {
        "id": "s", "label": "S",
        "mondai": [{"id": "m1", "number": 1, "type": "t",
                    "questions": [{"id": f"q{i}"} for i in range(questions)]}],
    }
    if minutes is not None:
        section["timeLimitMin"] = minutes
    paper = {"level": level, "title": f"{level} Test", "titleJp": f"{level} テスト", "sections": [section]}
    _sql(
        "INSERT INTO exam_papers (exam_id, revision, level, seed, generator_version, paper, section_count, question_count)"
        " VALUES (%s, 1, %s, 1, %s, %s, 1, %s)",
        (exam_id, level, EXAM_GENERATORS[exam_id][0], json.dumps(paper), questions),
    )


def _attempt(user: str, exam_id: str, correct: int, total: int, day: int) -> None:
    _sql(
        "INSERT INTO exam_attempts (user_id, exam_id, revision, section_id, answers, review, per_section,"
        " correct, total, started_at, finished_at)"
        " VALUES (%s, %s, 1, 'all', '{}', '{}', '{}', %s, %s, %s, %s)",
        (user, exam_id, correct, total, _day(day), _day(day)),
    )


@pytest.fixture(autouse=True)
def clean():
    _wipe()
    yield
    _wipe()


def _catalogue(client) -> dict[str, dict]:
    res = client.get("/api/exams")
    assert res.status_code == 200
    return {e["id"]: e for e in res.json()}


def test_every_entry_carries_the_three_fields(client):
    with acting_as("exam-catalogue-fresh-learner"):
        catalogue = _catalogue(client)
    assert set(catalogue) == set(EXAM_GENERATORS)
    for entry in catalogue.values():
        assert isinstance(entry["minutes"], int) and entry["minutes"] > 0
        assert entry["mondai"]
        assert entry["last"] is None


def test_mondai_are_the_blueprint_s_names_for_the_kind_in_order(client):
    catalogue = _catalogue(client)
    assert catalogue["n5-vocab-01"]["mondai"] == ["漢字読み", "表記", "文脈規定", "言い換え類義"]
    assert catalogue["n1-reading-01"]["mondai"] == [
        "内容理解（短文）", "内容理解（中文）", "内容理解（長文）", "主張理解（長文）",
    ]
    # Only what the generator builds: 発話表現 and 即時応答 are skipped.
    assert catalogue["n5-listening-01"]["mondai"] == ["課題理解", "ポイント理解"]
    for exam_id, (_v, kind, level, _g) in EXAM_GENERATORS.items():
        types = _KIND_META[kind][2]
        names = [m["name_jp"] for s in LEVEL_BLUEPRINT[level]["sections"] for m in s["mondai"] if m["type"] in types]
        assert catalogue[exam_id]["mondai"] == names, exam_id


def test_a_paper_not_generated_is_timed_by_its_generator_s_rule(client):
    rules = {
        "vocab": exam_vocab_gen.time_limit_min,
        "reading": exam_reading_gen.time_limit_min,
        "grammar": exam_grammar_gen.time_limit_min,
        "listening": exam_listening_gen.time_limit_min,
    }
    with acting_as("exam-catalogue-fresh-learner"):
        catalogue = _catalogue(client)
    for exam_id, (_v, kind, level, _g) in EXAM_GENERATORS.items():
        entry = catalogue[exam_id]
        if entry["generated"]:
            continue
        items = _expected_question_count(level, kind)
        assert entry["minutes"] == rules[kind](level, items), exam_id
    # The rules themselves, as the generators print them.
    assert exam_grammar_gen.time_limit_min("N5", 17) == 26
    assert exam_reading_gen.time_limit_min("N5", 4) == 10
    assert exam_listening_gen.time_limit_min("N5", 20) == 15
    # The vocabulary paper takes its share of the real section's time.
    assert exam_vocab_gen.time_limit_min("N5", 21) == 20
    assert exam_vocab_gen.time_limit_min("N1", 25) == round(110 * 25 / 71)


def test_a_generated_paper_prints_its_own_limit(client):
    _paper(GENERATED, "N1", minutes=17, questions=3)
    entry = _catalogue(client)[GENERATED]
    assert entry["generated"] is True
    assert entry["questionCount"] == 3
    assert entry["minutes"] == 17


def test_a_paper_stored_without_a_limit_is_timed_by_the_rule_over_its_items(client):
    _paper(GENERATED, "N1", minutes=None, questions=30)
    entry = _catalogue(client)[GENERATED]
    assert entry["generated"] is True
    assert entry["minutes"] == exam_listening_gen.time_limit_min("N1", 30) == 22


def test_last_is_this_learner_s_newest_sitting(client):
    _paper(SAT, "N2", minutes=34, questions=40)
    _attempt(DEV_USER_ID, SAT, 20, 40, day=3)
    _attempt(DEV_USER_ID, SAT, 30, 40, day=8)
    _attempt(DEV_USER_ID, SAT, 25, 40, day=5)
    # Someone else's later sitting is not this learner's.
    _attempt(OTHER_USER, SAT, 40, 40, day=9)
    entry = _catalogue(client)[SAT]
    last = entry["last"]
    assert (last["correct"], last["total"]) == (30, 40)
    assert datetime.fromisoformat(last["at"]) == _day(8)
    # Every revision sat, so the next is a generation, timed by the rule.
    assert entry["generated"] is False
    assert entry["minutes"] == exam_reading_gen.time_limit_min("N2", _expected_question_count("N2", "reading"))
    with acting_as(OTHER_USER):
        assert _catalogue(client)[SAT]["last"]["correct"] == 40
