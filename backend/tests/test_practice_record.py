"""実践の記録 — the Practice gate's record by grade (plan 130).

Each platform's figure is read from its own log, and the tests below
write rows into all six and read them back: what counts as one done,
what counts as right, and what is left out (another learner's rows, a
run with no grade, a grade never practised).
"""
import json
import unittest

from fastapi.testclient import TestClient

from core.auth import DEV_USER_ID
from core.db import db_conn
from main import app

OTHER = "practice-record-other-learner"
PAPER = "practice-record-test-n4"


def _wipe() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for user in (DEV_USER_ID, OTHER):
                for table in ("reading_log", "comprehension_log", "translation_log",
                              "dictation_log", "composition_log", "exam_attempts"):
                    cur.execute(f"DELETE FROM {table} WHERE user_id = %s", (user,))
            cur.execute("DELETE FROM exam_attempts WHERE exam_id = %s", (PAPER,))
            cur.execute("DELETE FROM exam_papers WHERE exam_id = %s", (PAPER,))
        conn.commit()
    finally:
        conn.close()


def _seed() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            def reading(user, level, correct, phase="level"):
                cur.execute(
                    "INSERT INTO reading_log (user_id, level, phase, phrase, romaji, answer, correct)"
                    " VALUES (%s, %s, %s, '学校', 'gakkou', 'gakkou', %s)",
                    (user, level, phase, correct),
                )
            # Three N5 sentences, two right; one N4 wrong.
            reading(DEV_USER_ID, "N5", True)
            reading(DEV_USER_ID, "N5", True)
            reading(DEV_USER_ID, "N5", False)
            reading(DEV_USER_ID, "N4", False)
            # A frequency run: logged with no grade, behind no grade's row.
            reading(DEV_USER_ID, "", True, phase="tier")
            # Someone else's sentence is not this learner's record.
            reading(OTHER, "N5", True)

            # Two texts at N5: 3 of 4 questions, then 1 of 4.
            for score in (3, 1):
                cur.execute(
                    "INSERT INTO comprehension_log (user_id, level, text, translation, questions, answers, score, total)"
                    " VALUES (%s, 'N5', '本文', 'text', '[]', '[]', %s, 4)",
                    (DEV_USER_ID, score),
                )

            cur.execute(
                "INSERT INTO translation_log (user_id, level, phase, translation_prompt, phrase, romaji, answer, correct)"
                " VALUES (%s, 'N3', 'level', 'I go.', '行く', 'iku', '行く', TRUE)",
                (DEV_USER_ID,),
            )
            cur.execute(
                "INSERT INTO dictation_log (user_id, level, clip_id, phrase, answer, correct, accuracy)"
                " VALUES (%s, 'N5', 'clip', '学校', '学校', TRUE, 100)",
                (DEV_USER_ID,),
            )
            cur.execute(
                "INSERT INTO composition_log (user_id, level, raw_id, pattern, sentence, correct, quality)"
                " VALUES (%s, 'N4', 'grammar_N4_x', 'x', '文', FALSE, 1)",
                (DEV_USER_ID,),
            )

            # One N4 paper, sat twice: 30 of 40, then 34 of 40.
            cur.execute(
                "INSERT INTO exam_papers (exam_id, revision, level, seed, generator_version, paper, section_count, question_count)"
                " VALUES (%s, 1, 'N4', 1, 'test', %s, 1, 40)",
                (PAPER, json.dumps({"level": "N4", "sections": []})),
            )
            for correct in (30, 34):
                cur.execute(
                    "INSERT INTO exam_attempts (user_id, exam_id, revision, section_id, answers, review, per_section,"
                    " correct, total, started_at, finished_at)"
                    " VALUES (%s, %s, 1, 'all', '{}', '{}', '{}', %s, 40, NOW(), NOW())",
                    (DEV_USER_ID, PAPER, correct),
                )
        conn.commit()
    finally:
        conn.close()


class PracticeRecordTests(unittest.TestCase):
    def setUp(self) -> None:
        _wipe()
        self.addCleanup(_wipe)
        self.client = TestClient(app)

    def test_a_learner_with_no_practice_has_six_empty_platforms(self) -> None:
        res = self.client.get("/api/practice/record")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {
            "reading": {}, "comprehension": {}, "translation": {},
            "dictation": {}, "composition": {}, "exam": {},
        })

    def test_each_platform_counts_its_own_log_by_grade(self) -> None:
        _seed()
        record = self.client.get("/api/practice/record").json()
        # Sentences: one row is one done, `right` the rows passed.
        self.assertEqual(record["reading"], {
            "N5": {"done": 3, "right": 2, "of": 3},
            "N4": {"done": 1, "right": 0, "of": 1},
        })
        # Texts: a text is one done, its questions the share.
        self.assertEqual(record["comprehension"], {"N5": {"done": 2, "right": 4, "of": 8}})
        self.assertEqual(record["translation"], {"N3": {"done": 1, "right": 1, "of": 1}})
        self.assertEqual(record["dictation"], {"N5": {"done": 1, "right": 1, "of": 1}})
        self.assertEqual(record["composition"], {"N4": {"done": 1, "right": 0, "of": 1}})
        # Papers: the paper's grade, every sitting counted.
        self.assertEqual(record["exam"], {"N4": {"done": 2, "right": 64, "of": 80}})

    def test_a_run_with_no_grade_and_another_learner_are_left_out(self) -> None:
        _seed()
        reading = self.client.get("/api/practice/record").json()["reading"]
        self.assertEqual(set(reading), {"N5", "N4"})
        self.assertEqual(reading["N5"]["done"], 3)
