"""書取 — the grader, the picker, and the API's one rule.

The grader is the interesting half. Every other sentence mode in this
app is self-assessed, so this is the only place where a machine decides
whether a learner got it right, and every threshold in it is a judgement
that shows up on a screen.
"""
import random
import unittest

from fastapi.testclient import TestClient

from content.listening_clips import BY_LEVEL
from core.auth import DEV_USER_ID
from core.db import db_conn
from main import app
from study import dictation

N5 = BY_LEVEL["N5"][0]          # 学校は九時からです。 / がっこうはくじからです。


class NormalizeTests(unittest.TestCase):
    def test_punctuation_and_spacing_are_not_part_of_the_answer(self) -> None:
        self.assertEqual(
            dictation.normalize("がっこうは、くじ から です。"),
            dictation.normalize("がっこうはくじからです"),
        )

    def test_katakana_and_hiragana_are_one_answer(self) -> None:
        self.assertEqual(dictation.normalize("テレビ"), dictation.normalize("てれび"))

    def test_a_long_vowel_is_a_mora_and_not_punctuation(self) -> None:
        """ー looks like a dash and is not one: dropping it would mark
        けき correct for ケーキ, which is precisely the mistake a
        listener makes."""
        self.assertNotEqual(dictation.normalize("ケーキ"), dictation.normalize("けき"))

    def test_a_full_width_keyboard_is_not_a_different_answer(self) -> None:
        self.assertEqual(dictation.normalize("１００えん"), dictation.normalize("100えん"))

    def test_nothing_normalizes_to_nothing(self) -> None:
        self.assertEqual(dictation.normalize(""), "")
        self.assertEqual(dictation.normalize(None), "")


class GradeTests(unittest.TestCase):
    def test_the_written_form_is_perfect(self) -> None:
        result = dictation.grade(N5["jp"], N5)
        self.assertEqual(result["accuracy"], 100)
        self.assertEqual(result["verdict"], "perfect")
        self.assertEqual(result["matched"], "written")
        self.assertTrue(result["correct"])

    def test_the_reading_is_equally_perfect(self) -> None:
        """The whole point: writing what you heard in kana is doing the
        exercise. Kanji is a different line of this app."""
        result = dictation.grade(N5["kana"], N5)
        self.assertEqual(result["accuracy"], 100)
        self.assertEqual(result["matched"], "kana")
        self.assertTrue(result["correct"])

    def test_one_mora_out_is_close_and_still_a_pass(self) -> None:
        result = dictation.grade("がっこうはくじがらです", N5)
        self.assertEqual(result["verdict"], "close")
        self.assertTrue(result["correct"])

    def test_half_the_line_is_partial_and_not_a_pass(self) -> None:
        result = dictation.grade("がっこうは", N5)
        self.assertEqual(result["verdict"], "partial")
        self.assertFalse(result["correct"])

    def test_a_different_sentence_is_missed(self) -> None:
        result = dictation.grade("きょうはあめがふっています", N5)
        self.assertEqual(result["verdict"], "missed")
        self.assertFalse(result["correct"])

    def test_writing_nothing_scores_nothing_rather_than_failing(self) -> None:
        result = dictation.grade("", N5)
        self.assertEqual(result["accuracy"], 0)
        self.assertEqual(result["verdict"], "missed")

    def test_the_diff_reconstructs_the_reference(self) -> None:
        """The screen prints the diff instead of the sentence, so the
        equal+missing runs have to BE the sentence -- a diff that drops
        a character shows the learner a line that was never said."""
        for answer in ("", N5["kana"], "がっこうはくじです", "ぜんぜんちがうこたえ"):
            with self.subTest(answer=answer):
                result = dictation.grade(answer, N5)
                reference = "".join(
                    run["text"] for run in result["diff"] if run["op"] in ("equal", "missing")
                )
                self.assertEqual(reference, result["target"])

    def test_the_diff_reconstructs_what_was_written(self) -> None:
        result = dictation.grade("がっこうはくじです", N5)
        written = "".join(
            run["text"] for run in result["diff"] if run["op"] in ("equal", "extra")
        )
        self.assertEqual(written, dictation.normalize("がっこうはくじです"))

    def test_adjacent_runs_are_merged(self) -> None:
        for answer in ("", N5["jp"], "がっこうはくじです", "あ"):
            with self.subTest(answer=answer):
                ops = [run["op"] for run in dictation.grade(answer, N5)["diff"]]
                self.assertEqual(len(ops), len({i for i in range(len(ops))
                                                if i == 0 or ops[i] != ops[i - 1]}))


class PickTests(unittest.TestCase):
    def test_a_batch_avoids_what_the_session_has_heard(self) -> None:
        rng = random.Random(0)
        first = dictation.pick("N5", 3, set(), rng)
        heard = {dictation.clip_id(row["jp"]) for row in first}
        second = dictation.pick("N5", 3, heard, rng)
        self.assertEqual(len(second), 3)
        self.assertFalse(heard & {dictation.clip_id(row["jp"]) for row in second})

    def test_a_finished_bank_repeats_rather_than_emptying(self) -> None:
        """The bank is finite. A learner who has worked through a level
        should be given it again, not an empty screen."""
        every = {dictation.clip_id(row["jp"]) for row in BY_LEVEL["N5"]}
        again = dictation.pick("N5", 3, every)
        self.assertEqual(len(again), 3)

    def test_an_unknown_level_picks_nothing(self) -> None:
        self.assertEqual(dictation.pick("N0", 3, set()), [])


def _clear_log():
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM dictation_log WHERE user_id = %s", (DEV_USER_ID,))
        conn.commit()
    finally:
        conn.close()


class ApiTests(unittest.TestCase):
    """The one rule the endpoints exist to keep: the sentence does not
    leave the server until the learner has written theirs down."""

    def setUp(self) -> None:
        self.client = TestClient(app)
        _clear_log()

    def tearDown(self) -> None:
        _clear_log()

    def test_a_batch_carries_audio_and_no_text(self) -> None:
        # The clips themselves need a synthesizer this test has no
        # business calling, so the batch is served from a stubbed
        # ensure_clip. What is under test is the SHAPE of the response,
        # which is where the mode's one rule lives.
        import routes.dictation as route

        original = route.dictation.ensure_clip
        route.dictation.ensure_clip = lambda jp: f"/exam-audio/{dictation.clip_id(jp)}.mp3"
        try:
            r = self.client.get("/api/dictation/batch?level=N5&count=3")
        finally:
            route.dictation.ensure_clip = original

        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["max_plays"], dictation.MAX_PLAYS)
        self.assertEqual(len(body["clips"]), 3)
        for clip in body["clips"]:
            self.assertEqual(set(clip), {"id", "level", "audioSrc"})
            self.assertTrue(clip["audioSrc"].startswith("/exam-audio/"))
        # Belt and braces: no field anywhere in the payload spells the
        # sentence out. A future field that did would defeat the mode.
        for row in BY_LEVEL["N5"]:
            self.assertNotIn(row["jp"], r.text)
            self.assertNotIn(row["kana"], r.text)

    def test_an_unknown_level_is_refused(self) -> None:
        self.assertEqual(self.client.get("/api/dictation/batch?level=N9").status_code, 400)

    def test_checking_reveals_the_line_and_grades_it(self) -> None:
        clip = dictation.clip_id(N5["jp"])
        r = self.client.post("/api/dictation/check",
                             json={"clip_id": clip, "answer": N5["kana"], "plays": 1})
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["jp"], N5["jp"])
        self.assertEqual(body["kana"], N5["kana"])
        self.assertEqual(body["translation"], N5["en"])
        self.assertEqual(body["translation_lang"], "en")
        self.assertEqual(body["accuracy"], 100)
        self.assertEqual(body["level"], "N5")

    def test_an_empty_answer_is_graded_rather_than_refused(self) -> None:
        r = self.client.post("/api/dictation/check",
                             json={"clip_id": dictation.clip_id(N5["jp"]), "plays": 2})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["accuracy"], 0)

    def test_an_unknown_clip_is_a_404(self) -> None:
        r = self.client.post("/api/dictation/check",
                             json={"clip_id": "0" * 24, "answer": "あ"})
        self.assertEqual(r.status_code, 404)

    def test_an_attempt_reaches_the_history_with_its_plays(self) -> None:
        self.client.post("/api/dictation/check",
                         json={"clip_id": dictation.clip_id(N5["jp"]),
                               "answer": N5["kana"], "plays": 2})
        r = self.client.get("/api/dictation/history?limit=5")
        self.assertEqual(r.status_code, 200)
        entries = r.json()["entries"]
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["phrase"], N5["jp"])
        self.assertEqual(entries[0]["accuracy"], 100)
        self.assertEqual(entries[0]["plays"], 2)
        self.assertTrue(entries[0]["correct"])


if __name__ == "__main__":
    unittest.main()
