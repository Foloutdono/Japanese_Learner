"""書取 — the measurement, the picker, and the API's two rules.

The interesting half is the measurement. It is not a grade (the learner
rates their own answer — docs/adr/0013), which is exactly what lets it
be forgiving: the tests below are mostly about the spellings it has to
treat as the same sentence, because a figure that reads low for a right
answer teaches a learner to distrust an ear that was correct.
"""
import random
import unittest

from fastapi.testclient import TestClient

from content.listening_clips import BY_LEVEL
from core.auth import DEV_USER_ID
from core.db import db_conn
from main import app
from study import dictation

N5 = dict(BY_LEVEL["N5"][0], level="N5")   # 学校は九時からです。


class NormalizeTests(unittest.TestCase):
    def test_punctuation_and_spacing_are_not_part_of_the_answer(self) -> None:
        self.assertEqual(
            dictation.normalize("がっこうは、くじ から です。"),
            dictation.normalize("がっこうはくじからです"),
        )

    def test_katakana_and_hiragana_are_one_answer(self) -> None:
        self.assertEqual(dictation.normalize("テレビ"), dictation.normalize("てれび"))

    def test_a_long_vowel_is_a_mora_and_not_punctuation(self) -> None:
        """ー looks like a dash and is not one: dropping it would treat
        けき as ケーキ, which is precisely the mistake a listener makes."""
        self.assertNotEqual(dictation.normalize("ケーキ"), dictation.normalize("けき"))

    def test_nothing_normalizes_to_nothing(self) -> None:
        self.assertEqual(dictation.normalize(""), "")
        self.assertEqual(dictation.normalize(None), "")


class MeasureTests(unittest.TestCase):
    def test_every_way_of_writing_the_line_measures_full(self) -> None:
        """Kanji, kana and romaji are three spellings of one answer, and
        none of them is better hearing than the others."""
        for form in ("jp", "kana", "romaji"):
            with self.subTest(form=form):
                result = dictation.measure(N5[form], N5)
                self.assertEqual(result["accuracy"], 100)
        self.assertEqual(dictation.measure(N5["jp"], N5)["matched"], "written")
        self.assertEqual(dictation.measure(N5["kana"], N5)["matched"], "kana")
        self.assertEqual(dictation.measure(N5["romaji"], N5)["matched"], "romaji")

    def test_the_romanization_a_learner_actually_types(self) -> None:
        """Reported from a real session: every one of these is the
        sentence, written by someone who heard it correctly."""
        for answer in (
            "gakkou wa kuji kara desu",     # the reference
            "gakkouwakujikaradesu",         # no spaces
            "gakkou ha kuji kara desu",     # the particle as it is spelled
            "gakkô wa kuji kara desu",      # a circumflex
            "gakko wa kuji kara desu",      # the long vowel not heard
            "gakkou wa kuzi kara desu",     # kunrei
            "GAKKOU WA KUJI KARA DESU",     # shouting
        ):
            with self.subTest(answer=answer):
                self.assertEqual(dictation.measure(answer, N5)["accuracy"], 100)

    def test_a_dropped_geminate_still_costs(self) -> None:
        """きって and きて are different words and audibly different, so
        the fold must not forgive a missing っ."""
        self.assertLess(dictation.measure("gakou wa kuji kara desu", N5)["accuracy"], 100)

    def test_half_a_line_measures_around_half(self) -> None:
        result = dictation.measure("gakkou wa", N5)
        self.assertGreater(result["accuracy"], 20)
        self.assertLess(result["accuracy"], 80)

    def test_writing_nothing_measures_nothing(self) -> None:
        self.assertEqual(dictation.measure("", N5)["accuracy"], 0)

    def test_a_different_sentence_measures_low(self) -> None:
        self.assertLess(dictation.measure("きょうはあめがふっています", N5)["accuracy"], 50)


class RevealTests(unittest.TestCase):
    def test_the_reveal_carries_all_three_forms_and_the_gloss(self) -> None:
        revealed = dictation.reveal(N5)
        self.assertEqual(revealed["jp"], N5["jp"])
        self.assertEqual(revealed["kana"], N5["kana"])
        self.assertEqual(revealed["romaji"], N5["romaji"])
        self.assertEqual(revealed["translation"], N5["en"])
        self.assertEqual(revealed["translation_lang"], "en")

    def test_the_furigana_spells_the_line_and_reads_it_exactly(self) -> None:
        """Built from the bank's own kana, so the ruby over 九時 is くじ
        rather than pykakasi's guess. The parts must also reconstruct
        the sentence: a part dropped in alignment would show the learner
        a line that was never said."""
        parts = dictation.reveal(N5)["furigana"]
        self.assertEqual("".join(p["text"] for p in parts), N5["jp"])
        readings = {p["text"]: p.get("reading") for p in parts}
        self.assertEqual(readings.get("九"), "く")
        self.assertEqual(readings.get("時"), "じ")

    def test_every_line_in_the_bank_aligns(self) -> None:
        from content.listening_clips import all_clips
        for row in all_clips():
            with self.subTest(jp=row["jp"]):
                parts = dictation.reveal(row)["furigana"]
                self.assertEqual("".join(p["text"] for p in parts), row["jp"])


class ClipTests(unittest.TestCase):
    def test_the_speaking_rate_is_part_of_the_clip_name(self) -> None:
        """Two readings of one line at different speeds are different
        audio, so they must be different files — otherwise changing the
        rate serves the old clip forever."""
        from study.exam_tts import content_key
        turns = dictation.clip_turns(N5["jp"])
        self.assertEqual(dictation.clip_id(N5["jp"]), content_key(turns, dictation.RATE))
        self.assertNotEqual(content_key(turns), content_key(turns, dictation.RATE))

    def test_the_rate_is_a_slowing_one(self) -> None:
        self.assertTrue(dictation.RATE.startswith("-"), dictation.RATE)


class PickTests(unittest.TestCase):
    def test_a_batch_avoids_what_the_session_has_heard(self) -> None:
        rng = random.Random(0)
        first = dictation.pick("N5", 3, set(), rng)
        heard = {dictation.clip_id(row["jp"]) for row in first}
        second = dictation.pick("N5", 3, heard, rng)
        self.assertEqual(len(second), 3)
        self.assertFalse(heard & {dictation.clip_id(row["jp"]) for row in second})

    def test_a_finished_bank_repeats_rather_than_emptying(self) -> None:
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
    """Two rules: the sentence does not leave the server until the
    learner has written theirs down, and the grade in the log is the
    learner's own."""

    def setUp(self) -> None:
        self.client = TestClient(app)
        _clear_log()

    def tearDown(self) -> None:
        _clear_log()

    def test_a_batch_carries_audio_and_no_text(self) -> None:
        # The clips need a synthesizer this test has no business
        # calling, so the batch is served from a stubbed ensure_clip.
        # What is under test is the SHAPE of the response, which is
        # where the mode's first rule lives.
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
        # No field anywhere in the payload spells the sentence out, in
        # any of the three ways it can be spelled.
        for row in BY_LEVEL["N5"]:
            self.assertNotIn(row["jp"], r.text)
            self.assertNotIn(row["kana"], r.text)
            self.assertNotIn(row["romaji"], r.text)

    def test_an_unknown_level_is_refused(self) -> None:
        self.assertEqual(self.client.get("/api/dictation/batch?level=N9").status_code, 400)

    def test_checking_reveals_the_line_and_measures_it(self) -> None:
        r = self.client.post("/api/dictation/check",
                             json={"clip_id": dictation.clip_id(N5["jp"]),
                                   "answer": N5["romaji"]})
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["jp"], N5["jp"])
        self.assertEqual(body["romaji"], N5["romaji"])
        self.assertEqual(body["accuracy"], 100)
        self.assertEqual(body["level"], "N5")
        self.assertTrue(body["furigana"])

    def test_checking_writes_nothing(self) -> None:
        """The row belongs to /result. A learner who reads the reveal
        and leaves must not have an ungraded attempt logged for them."""
        self.client.post("/api/dictation/check",
                         json={"clip_id": dictation.clip_id(N5["jp"]), "answer": "あ"})
        self.assertEqual(self.client.get("/api/dictation/history").json()["entries"], [])

    def test_an_empty_answer_is_measured_rather_than_refused(self) -> None:
        r = self.client.post("/api/dictation/check",
                             json={"clip_id": dictation.clip_id(N5["jp"])})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["accuracy"], 0)

    def test_an_unknown_clip_is_a_404(self) -> None:
        for path in ("/api/dictation/check", "/api/dictation/result"):
            with self.subTest(path=path):
                r = self.client.post(path, json={"clip_id": "0" * 24, "answer": "a", "quality": 4})
                self.assertEqual(r.status_code, 404)

    def test_the_learners_rating_is_what_the_log_records(self) -> None:
        """A high accuracy the learner rated down stays rated down: the
        measurement is kept beside the grade, never instead of it."""
        r = self.client.post("/api/dictation/result",
                             json={"clip_id": dictation.clip_id(N5["jp"]),
                                   "answer": N5["romaji"], "quality": 1,
                                   "accuracy": 100, "plays": 2})
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["correct"])

        entries = self.client.get("/api/dictation/history?limit=5").json()["entries"]
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["phrase"], N5["jp"])
        self.assertEqual(entries[0]["quality"], 1)
        self.assertEqual(entries[0]["accuracy"], 100)
        self.assertEqual(entries[0]["plays"], 2)
        self.assertFalse(entries[0]["correct"])

    def test_a_pass_is_the_same_line_the_rating_bar_draws(self) -> None:
        """q > 2, the threshold RatingBar itself uses to choose between
        playCorrect and playWrong, and the one reading and translation
        practice record."""
        clip = dictation.clip_id(N5["jp"])
        for quality, expected in ((0, False), (2, False), (3, True), (5, True)):
            with self.subTest(quality=quality):
                r = self.client.post("/api/dictation/result",
                                     json={"clip_id": clip, "answer": "a", "quality": quality})
                self.assertEqual(r.json()["correct"], expected)

    def test_a_rating_off_the_scale_is_refused(self) -> None:
        r = self.client.post("/api/dictation/result",
                             json={"clip_id": dictation.clip_id(N5["jp"]),
                                   "answer": "a", "quality": 9})
        self.assertEqual(r.status_code, 422)


if __name__ == "__main__":
    unittest.main()
