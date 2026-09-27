"""駅の頁 — one stop of one practice platform (plan 158).

/api/practice/stop/{platform}?stop=<key> is the grade page of the
Practice stations filled on the desk: the stop's record in /record's
figures, the sentences last missed there, and the grade's grammar the
learner has studied. The tests write rows into the five logs and read
them back: which rows a stop owns (a grade by `level`, mastery and a
tier by the label the run logs, a tier's size in it only off the
default), what a miss is (the LAST meeting went wrong), what the texts
list names, and what another learner's rows and an unknown key do.
"""
import json
import unittest
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from content import comprehension_seed, reading_sentences
from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, grammar_to_id
from core.auth import DEV_USER_ID
from core.db import db_conn
from main import app
from routes.reading import _source_label
from tests.conftest import acting_as

OTHER = "practice-stop-other-learner"
# The `known` tests' own learner: the suite's shared user may carry
# grammar cards an earlier file studied, and `known` would list them.
STUDENT = "practice-stop-grammar-learner"
LOGS = ("reading_log", "translation_log", "comprehension_log", "dictation_log", "composition_log")

N5 = reading_sentences.BY_LEVEL["N5"]


def _day(day: int, hour: int = 8) -> datetime:
    return datetime(2026, 9, day, hour, tzinfo=timezone.utc)


def _wipe() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for user in (DEV_USER_ID, OTHER, STUDENT):
                for table in LOGS:
                    cur.execute(f"DELETE FROM {table} WHERE user_id = %s", (user,))
            cur.execute("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{STUDENT}:%",))
            cur.execute("DELETE FROM cards WHERE id LIKE %s", (f"{STUDENT}:%",))
        conn.commit()
    finally:
        conn.close()


def _insert(sql: str, rows: list[tuple]) -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for row in rows:
                cur.execute(sql, row)
        conn.commit()
    finally:
        conn.close()


def _reading(rows: list[tuple]) -> None:
    """(phrase, correct, day[, level, phase, user]) per row."""
    full = []
    for phrase, correct, day, *rest in rows:
        level, phase, user = (rest + ["N5", None, DEV_USER_ID][len(rest):])
        full.append((user, level, phase or f"level:{level}", phrase, correct, _day(day)))
    _insert(
        "INSERT INTO reading_log (user_id, level, phase, phrase, romaji, answer, correct, created_at)"
        " VALUES (%s, %s, %s, %s, '', '', %s, %s)",
        full,
    )


def _iso(value: str) -> datetime:
    return datetime.fromisoformat(value)


class PracticeStopTests(unittest.TestCase):
    def setUp(self) -> None:
        _wipe()
        self.addCleanup(_wipe)
        self.client = TestClient(app)

    def stop(self, platform: str, stop: str) -> dict:
        res = self.client.get(f"/api/practice/stop/{platform}", params={"stop": stop, "lang": "fr"})
        self.assertEqual(res.status_code, 200, res.text)
        return res.json()

    # ── the keys ──

    def test_an_unknown_platform_is_a_404(self) -> None:
        for platform in ("exam", "kana", "listening"):
            res = self.client.get(f"/api/practice/stop/{platform}", params={"stop": "N5"})
            self.assertEqual(res.status_code, 404, platform)

    def test_a_stop_the_platform_never_logs_is_a_400(self) -> None:
        bad = {
            "reading": ["N6", "", "level:N5", "freq:kanji:3", "freq:vocab:0", "freq:vocab:x",
                        "freq:vocab:3:0", "freq:vocab:3:200:1", "freq:vocab"],
            # Only reading and translation start from a tier or mastery.
            "dictation": ["mastery", "freq:vocab:3"],
            "composition": ["mastery"],
            "comprehension": ["freq:vocab:1"],
        }
        for platform, stops in bad.items():
            for stop in stops:
                res = self.client.get(f"/api/practice/stop/{platform}", params={"stop": stop})
                self.assertEqual(res.status_code, 400, (platform, stop))

    def test_a_stop_with_nothing_logged_has_no_record(self) -> None:
        for platform in ("reading", "translation", "comprehension", "dictation", "composition"):
            body = self.stop(platform, "N4")
            self.assertEqual(body["stop"], "N4")
            self.assertIsNone(body["record"])
            self.assertEqual(body["misses"], [])

    # ── the record ──

    def test_a_grade_s_record_is_its_own_rows_with_the_newest_date(self) -> None:
        _reading([
            (N5[0]["jp"], True, 3),
            (N5[1]["jp"], False, 7),
            (N5[2]["jp"], True, 5),
            # Another grade, a tier run (logged with no grade) and
            # another learner are not this stop's.
            (N5[3]["jp"], True, 9, "N4"),
            (N5[4]["jp"], True, 10, "", "freq:vocab:1"),
            (N5[5]["jp"], False, 11, "N5", None, OTHER),
        ])
        body = self.stop("reading", "N5")
        record = body["record"]
        self.assertEqual({k: record[k] for k in ("done", "right", "of")}, {"done": 3, "right": 2, "of": 3})
        self.assertEqual(_iso(record["last"]), _day(7))
        self.assertEqual([m["jp"] for m in body["misses"]], [N5[1]["jp"]])

    def test_a_tier_s_label_carries_its_size_only_off_the_default(self) -> None:
        self.assertEqual(_source_label("frequency", None, "vocab", 3), "freq:vocab:3")
        self.assertEqual(_source_label("frequency", None, "vocab", 3, 200), "freq:vocab:3")
        self.assertEqual(_source_label("frequency", None, "vocab", 3, 500), "freq:vocab:3:500")
        _reading([
            # Logged before sizes were written: the default size.
            ("古い文。", True, 2, "", "freq:vocab:3"),
            ("古い文。", False, 4, "", "freq:vocab:3"),
            # Tier 3 at 500 a tier is another range of words.
            ("大きい段の文。", True, 6, "", "freq:vocab:3:500"),
            ("辞書の文。", True, 6, "", "freq:vocab_jmdict:3"),
        ])
        for key in ("freq:vocab:3", "freq:vocab:3:200", "freq:vocab:03"):
            body = self.stop("reading", key)
            self.assertEqual(body["stop"], "freq:vocab:3", key)
            self.assertEqual(body["record"]["done"], 2, key)
            self.assertEqual([m["jp"] for m in body["misses"]], ["古い文。"])
        wide = self.stop("reading", "freq:vocab:3:500")
        self.assertEqual(wide["stop"], "freq:vocab:3:500")
        self.assertEqual(wide["record"]["done"], 1)
        self.assertEqual(self.stop("reading", "freq:vocab_jmdict:3")["record"]["done"], 1)
        # A tier is not a grade: it lists no grammar.
        self.assertEqual(wide["known"], [])

    def test_mastery_reads_the_mastery_rows(self) -> None:
        _reading([
            (N5[0]["jp"], False, 2, "", "mastery"),
            (N5[1]["jp"], True, 3, "", "mastery"),
            (N5[2]["jp"], False, 4),
        ])
        body = self.stop("reading", "mastery")
        self.assertEqual(body["stop"], "mastery")
        self.assertEqual({k: body["record"][k] for k in ("done", "right", "of")}, {"done": 2, "right": 1, "of": 2})
        self.assertEqual([m["jp"] for m in body["misses"]], [N5[0]["jp"]])

    # ── the misses ──

    def test_a_miss_is_a_sentence_whose_last_meeting_went_wrong(self) -> None:
        extra = [f"作った文{i}です。" for i in range(5)]
        _reading([
            # Missed, then got right: learnt, not a miss.
            (N5[0]["jp"], False, 1),
            (N5[0]["jp"], True, 3),
            # Got right, then missed: a miss, dated by the miss.
            (N5[1]["jp"], True, 1),
            (N5[1]["jp"], False, 2),
            # Missed twice: one miss, not two.
            (N5[2]["jp"], False, 4),
            (N5[2]["jp"], False, 5),
            # Sentences the bank did not write: no grammar named.
            *[(jp, False, 10 + i) for i, jp in enumerate(extra)],
        ])
        misses = self.stop("reading", "N5")["misses"]
        # Newest first, five at the most.
        self.assertEqual([m["jp"] for m in misses], extra[::-1])
        self.assertTrue(all(m["sub"] is None and m["score"] is None for m in misses))
        self.assertEqual(_iso(misses[0]["at"]), _day(14))

        _wipe()
        _reading([(N5[0]["jp"], False, 1), (N5[0]["jp"], True, 3),
                  (N5[1]["jp"], True, 1), (N5[1]["jp"], False, 2),
                  (N5[2]["jp"], False, 4), (N5[2]["jp"], False, 5)])
        misses = self.stop("reading", "N5")["misses"]
        self.assertEqual([m["jp"] for m in misses], [N5[2]["jp"], N5[1]["jp"]])
        # The bank's grammar for its own sentences.
        self.assertEqual([m["sub"] for m in misses], [N5[2]["grammar"], N5[1]["grammar"]])
        self.assertEqual([_iso(m["at"]) for m in misses], [_day(5), _day(2)])

    def test_translation_and_dictation_read_their_own_logs(self) -> None:
        _insert(
            "INSERT INTO translation_log (user_id, level, phase, translation_prompt, phrase, romaji, answer, correct, created_at)"
            " VALUES (%s, 'N5', 'level:N5', %s, %s, '', '', %s, %s)",
            [(DEV_USER_ID, N5[0]["en"], N5[0]["jp"], False, _day(3)),
             (DEV_USER_ID, N5[1]["en"], N5[1]["jp"], True, _day(4))],
        )
        _insert(
            "INSERT INTO dictation_log (user_id, level, clip_id, phrase, answer, correct, accuracy, created_at)"
            " VALUES (%s, 'N5', 'clip', %s, '', %s, 50, %s)",
            [(DEV_USER_ID, "学校は九時からです。", False, _day(6))],
        )
        translation = self.stop("translation", "N5")
        self.assertEqual(translation["record"]["done"], 2)
        self.assertEqual(translation["misses"], [
            {"jp": N5[0]["jp"], "sub": N5[0]["grammar"], "score": None, "at": translation["misses"][0]["at"]},
        ])
        dictation = self.stop("dictation", "N5")
        self.assertEqual(dictation["record"]["done"], 1)
        self.assertEqual([m["jp"] for m in dictation["misses"]], ["学校は九時からです。"])
        # Nothing of the reading log reaches either.
        self.assertIsNone(self.stop("reading", "N5")["record"])

    def test_composition_lists_the_points_whose_sentence_missed(self) -> None:
        _insert(
            "INSERT INTO composition_log (user_id, level, raw_id, pattern, sentence, correct, quality, created_at)"
            " VALUES (%s, 'N4', %s, %s, %s, %s, %s, %s)",
            [(DEV_USER_ID, "grammar_N4_a", "〜たら", "雨なら行く。", False, 1, _day(2)),
             (DEV_USER_ID, "grammar_N4_b", "〜ば", "安ければ買う。", True, 5, _day(3)),
             (DEV_USER_ID, "grammar_N4_c", "〜なら", "君ならできる。", False, 2, _day(4)),
             (OTHER, "grammar_N4_d", "〜ので", "雨なので。", False, 0, _day(5))],
        )
        body = self.stop("composition", "N4")
        self.assertEqual({k: body["record"][k] for k in ("done", "right", "of")}, {"done": 3, "right": 1, "of": 3})
        self.assertEqual(
            [(m["jp"], m["sub"], m["score"]) for m in body["misses"]],
            [("〜なら", "君ならできる。", None), ("〜たら", "雨なら行く。", None)],
        )

    def test_comprehension_lists_the_texts_read_with_their_scores(self) -> None:
        seed = comprehension_seed.by_level()["N5"][0]
        generated = "むかしむかし、ある村に小さな男の子がすんでいました。"
        _insert(
            "INSERT INTO comprehension_log (user_id, level, text, translation, questions, answers, score, total, grammar, created_at)"
            " VALUES (%s, 'N5', %s, '', '[]', '[]', %s, %s, %s, %s)",
            [(DEV_USER_ID, seed["text"], 6, 8, None, _day(2)),
             (DEV_USER_ID, generated, 2, 8, json.dumps(["〜てから", "〜のが好きです"]), _day(5)),
             (DEV_USER_ID, "短い文。", 8, 8, None, _day(4)),
             (OTHER, seed["text"], 1, 8, None, _day(9))],
        )
        body = self.stop("comprehension", "N5")
        # A text is one done, its questions the share.
        self.assertEqual({k: body["record"][k] for k in ("done", "right", "of")}, {"done": 3, "right": 16, "of": 24})
        self.assertEqual(_iso(body["record"]["last"]), _day(5))
        self.assertEqual(body["misses"], [
            {"jp": generated[:12] + "…", "sub": "〜てから · 〜のが好きです", "score": [2, 8], "at": body["misses"][0]["at"]},
            {"jp": "短い文。", "sub": None, "score": [8, 8], "at": body["misses"][1]["at"]},
            # A seed is named by its title and its own grammar.
            {"jp": seed["title"], "sub": " · ".join(seed["grammar"]), "score": [6, 8], "at": body["misses"][2]["at"]},
        ])

    # ── what the learner knows ──

    def test_known_is_the_grade_s_points_studied_at_learn(self) -> None:
        points = GRAMMAR_POINTS_BY_LEVEL["N5"]
        studied, seen, untouched = points[3], points[1], points[0]
        rows = [
            # Reviewed in one graded mode: studied.
            (grammar_to_id(studied, "N5"), "grammar.fill_in", 2),
            (grammar_to_id(seen, "N5"), "grammar.flashcard.f2b", 1),
            # A row with no review behind it is still new.
            (grammar_to_id(untouched, "N5"), "grammar.flashcard.f2b", 0),
        ]
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                for raw_id, mode, reviews in rows:
                    full = f"{STUDENT}:{raw_id}"
                    cur.execute("INSERT INTO cards(id) VALUES (%s) ON CONFLICT DO NOTHING", (full,))
                    cur.execute(
                        """
                        INSERT INTO card_modes(card_id, mode, interval_days, next_review,
                                               total_reviews, correct_reviews, is_learning, learning_step)
                        VALUES (%s, %s, 1, NOW() + INTERVAL '1 day', %s, %s, TRUE, 0)
                        """,
                        (full, mode, reviews, reviews),
                    )
            conn.commit()
        finally:
            conn.close()

        with acting_as(STUDENT):
            # In catalogue order, on every platform that lists points.
            for platform in ("reading", "translation", "comprehension", "composition"):
                self.assertEqual(self.stop(platform, "N5")["known"], [seen["pattern"], studied["pattern"]], platform)
            # Dictation names no grammar; another grade and a non-grade
            # stop have none of these.
            self.assertEqual(self.stop("dictation", "N5")["known"], [])
            self.assertEqual(self.stop("reading", "N4")["known"], [])
            self.assertEqual(self.stop("reading", "mastery")["known"], [])
        # Another learner's cards are not this one's.
        with acting_as(OTHER):
            self.assertEqual(self.stop("reading", "N5")["known"], [])
