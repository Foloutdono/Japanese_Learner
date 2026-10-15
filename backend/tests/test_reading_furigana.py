"""The reading over a practice sentence's kanji (plan 185).

Reading and translation (which serves reading's batch) hand the card the
sentence's furigana beside its romaji, so the card the answer is read
against can lead with the sentence a learner can read: 少し over すこ.
The parts are study/furigana.align_sentence's, the same 書取's reveal
and the grammar examples carry.
"""
import unittest

from routes.reading import _finish_phrase


class PhraseFuriganaTests(unittest.TestCase):
    def _phrase(self, jp: str) -> dict:
        return _finish_phrase(jp, "Let's rest here a little.", "少し", "すこし", "N5", grammar="〜ましょう")

    def test_parts_spell_the_sentence(self) -> None:
        # Whatever the tokenizer makes of it -- or a single bare part when
        # it is not installed -- the parts read back as the sentence.
        for jp in ("ここで少し休みましょう。", "百円の花を十本買いました。", "ありがとう。"):
            with self.subTest(jp=jp):
                parts = self._phrase(jp)["furigana"]
                self.assertEqual("".join(p["text"] for p in parts), jp)

    def test_kanji_carry_their_reading(self) -> None:
        parts = self._phrase("ここで少し休みましょう。")["furigana"]
        readings = {p["text"]: p.get("reading") for p in parts if p.get("reading")}
        if not readings:
            self.skipTest("the tokenizer is not installed")
        self.assertEqual(readings.get("少"), "すこ")
        self.assertEqual(readings.get("休"), "やす")
        # Kana carry none.
        self.assertTrue(all(p.get("reading") is None for p in parts if p["text"] in ("ここで", "ましょう。")))


if __name__ == "__main__":
    unittest.main()


class PhrasePointTests(unittest.TestCase):
    """Plan 210: a bank sentence carries its point's card id, which the
    practice card's tag opens the lesson by; a corpus sentence, which
    names no point, carries neither."""

    def test_a_bank_sentence_carries_its_points_id(self) -> None:
        phrase = _finish_phrase("ここで少し休みましょう。", "", "少し", "すこし", "N5", grammar="〜ましょう")
        self.assertEqual(phrase["grammar_id"], "grammar_N5_〜ましょう")

    def test_a_corpus_sentence_names_no_point(self) -> None:
        phrase = _finish_phrase("ここで少し休みましょう。", "", "少し", "すこし", "N5")
        self.assertNotIn("grammar", phrase)
        self.assertNotIn("grammar_id", phrase)
