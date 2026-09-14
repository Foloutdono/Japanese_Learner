"""The fare for practice (2026-09): reading, translation, comprehension and
dictation answers pay XP through srs.award_practice — one xp_ledger row
per graded event at a card review's base rate, no daily or streak bonus
— and every grading endpoint reports it top-level, in review()'s own
{xp_earned, leveled_up, new_level} shape, so a run's level bar moves.

Needs the database, like test_profile_holder. The exam's fare is the
same call on the attempt (routes/exams.submit_attempt) and is covered
by the unit test on award_practice below rather than by generating a
paper, which needs the LLM.
"""
import pytest

from core.auth import DEV_USER_ID
from core.db import db_conn
from core.srs_instance import srs
from routes import dictation as dictation_route
from tests.test_comprehension import _reply, MASHITA


@pytest.fixture
def clean_ledger():
    yield
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM xp_ledger WHERE user_id = %s", (DEV_USER_ID,))
            cur.execute("DELETE FROM reading_log WHERE user_id = %s", (DEV_USER_ID,))
            cur.execute("DELETE FROM translation_log WHERE user_id = %s", (DEV_USER_ID,))
            cur.execute("DELETE FROM dictation_log WHERE user_id = %s", (DEV_USER_ID,))
            cur.execute("DELETE FROM comprehension_log WHERE user_id = %s", (DEV_USER_ID,))
        conn.commit()
    finally:
        conn.close()


def _lifetime(client):
    return client.get("/api/profile").json()["xp"]


def test_award_practice_pays_the_base_rate_per_quality(clean_ledger):
    before = srs.get_lifetime_xp(DEV_USER_ID)
    fare = srs.award_practice(DEV_USER_ID, "exam", "t", [4, 4, 1])
    # Two correct at 7, one wrong at 1 — xp.BASE_XP_BY_QUALITY, with no
    # daily multiplier: practice rows never enter review_log, so the
    # day's-first bonus would otherwise apply to every one of them.
    assert fare["xp_earned"] == 15
    assert set(fare) == {"xp_earned", "leveled_up", "new_level"}
    assert srs.get_lifetime_xp(DEV_USER_ID) == before + 15


def test_award_practice_with_nothing_gradable_writes_no_row(clean_ledger):
    before = srs.get_lifetime_xp(DEV_USER_ID)
    fare = srs.award_practice(DEV_USER_ID, "comprehension", "t", [])
    assert fare["xp_earned"] == 0
    assert fare["leveled_up"] is False
    assert srs.get_lifetime_xp(DEV_USER_ID) == before


def test_a_rated_reading_sentence_pays_its_fare(client, clean_ledger):
    before = _lifetime(client)
    r = client.post("/api/reading/result", json={
        "source": "mastery", "level": None, "phrase": "駅で会いました",
        "romaji": "eki de aimashita", "answer": "eki de aimashita",
        "correct": True, "quality": 4, "source_word": None,
    })
    assert r.status_code == 200, r.text
    body = r.json()
    # No card behind the sentence: nothing scheduled, the fare paid here.
    assert body["scheduled"] is None
    assert body["xp_earned"] == 7
    assert "leveled_up" in body and "new_level" in body
    assert _lifetime(client) == before + 7


def test_an_unrated_reading_answer_pays_by_correctness(client, clean_ledger):
    before = _lifetime(client)
    r = client.post("/api/reading/result", json={
        "source": "mastery", "level": None, "phrase": "駅", "romaji": "eki",
        "answer": "", "correct": False, "quality": None, "source_word": None,
    })
    assert r.status_code == 200, r.text
    assert r.json()["xp_earned"] == 1
    assert _lifetime(client) == before + 1


def test_a_rated_translation_pays_its_fare(client, clean_ledger):
    before = _lifetime(client)
    r = client.post("/api/translation/result", json={
        "source": "mastery", "level": None, "translation_prompt": "I met at the station",
        "phrase": "駅で会いました", "romaji": "eki de aimashita", "answer": "駅で会いました",
        "correct": True, "quality": 3, "source_word": None,
    })
    assert r.status_code == 200, r.text
    assert r.json()["xp_earned"] == 4
    assert _lifetime(client) == before + 4


def test_a_graded_dictation_clip_pays_its_fare(client, clean_ledger):
    clip_id = next(iter(dictation_route.dictation._index()))
    before = _lifetime(client)
    r = client.post("/api/dictation/result", json={
        "clip_id": clip_id, "answer": "", "quality": 5, "accuracy": 100, "plays": 1,
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["correct"] is True
    assert body["xp_earned"] == 10
    assert _lifetime(client) == before + 10


def test_a_submitted_comprehension_exercise_pays_per_question(client, clean_ledger, monkeypatch):
    from routes import reading
    monkeypatch.setattr(reading, "llm_configured", lambda: True)
    monkeypatch.setattr(reading, "_chat", lambda messages, *a, **kw: _reply())
    monkeypatch.setattr(reading, "_pick_grammar_seeds", lambda *a, **kw: [MASHITA])
    monkeypatch.setattr(reading, "_pick_word_seeds", lambda *a, **kw: [])
    exercise = client.get("/api/reading/comprehension?level=N5&lang=en").json()
    questions = exercise["questions"]
    # Every answer right but the first.
    answers = [q["correct"] for q in questions]
    answers[0] = (answers[0] + 1) % len(questions[0]["options"])

    before = _lifetime(client)
    r = client.post("/api/reading/comprehension/result", json={
        "level": "N5", "text": exercise["text"], "translation": exercise["translation"],
        "questions": questions, "answers": answers,
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["score"] == len(questions) - 1
    assert body["xp_earned"] == 7 * (len(questions) - 1) + 1
    assert _lifetime(client) == before + body["xp_earned"]
