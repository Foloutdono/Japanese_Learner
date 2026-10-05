"""A practice sentence's words, each with its place (plan 185).

The practice card reads a learner's romaji against the sentence's word
by word; to underline a miss where the word stands in the Japanese and
name the word missed with its reading, it needs the words the romaji
was spaced from: study/romaji.sentence_words. Reading's batch, the
reading ride and 書取's reveal carry them as `words`.
"""
import unittest

from study import morphology
from study.romaji import sentence_romaji, sentence_words

SENTENCES = (
    "ここで少し休みましょう。",
    "百円の花を十本買いました。",
    "毎日、名前を書かなければなりません。",
    "駅でコーヒーを飲みます。",
    "「はい」と言った。",
    "月曜日に行きます。",
)


def _needs_tokenizer(test):
    def run(self):
        if morphology.tokenize("駅") is None:
            self.skipTest("the tokenizer is not installed")
        return test(self)
    return run


class SentenceWordsTests(unittest.TestCase):
    @_needs_tokenizer
    def test_words_spell_the_sentence_back(self) -> None:
        for jp in SENTENCES:
            with self.subTest(jp=jp):
                self.assertEqual("".join(w["text"] for w in sentence_words(jp)), jp)

    @_needs_tokenizer
    def test_the_romaji_is_sentence_romaji_spaced(self) -> None:
        # One reading, two shapes: the card's reference line and the
        # words it is placed by never disagree.
        for jp in SENTENCES:
            with self.subTest(jp=jp):
                self.assertEqual(" ".join(w["romaji"] for w in sentence_words(jp)), sentence_romaji(jp))

    @_needs_tokenizer
    def test_a_word_is_read_as_written(self) -> None:
        words = {w["text"].rstrip("。"): w for w in sentence_words("駅でコーヒーを飲みます。")}
        self.assertEqual(words["駅"]["kana"], "えき")
        # A word written in kana keeps its script; the particle is
        # written を and said o.
        self.assertEqual(words["コーヒー"]["kana"], "コーヒー")
        self.assertEqual((words["を"]["kana"], words["を"]["romaji"]), ("を", "o"))
        self.assertEqual(words["飲みます"]["kana"], "のみます。")
        topic = sentence_words("学校は九時からです。")[1]
        self.assertEqual((topic["text"], topic["kana"], topic["romaji"]), ("は", "は", "wa"))

    @_needs_tokenizer
    def test_a_mark_joins_the_word_before_it(self) -> None:
        words = sentence_words("毎日、名前を書かなければなりません。")
        self.assertEqual(words[0]["text"], "毎日、")
        self.assertEqual(words[0]["romaji"], "mainichi,")
        self.assertEqual(words[-1]["text"], "なりません。")

    def test_none_without_the_tokenizer(self) -> None:
        from unittest import mock
        with mock.patch.object(morphology, "tokenize", return_value=None):
            self.assertIsNone(sentence_words("駅で会いましょう。"))
            # sentence_romaji still answers, through kakasi alone.
            self.assertEqual(sentence_romaji("えき"), "eki")


class CarriedTests(unittest.TestCase):
    @_needs_tokenizer
    def test_reading_batch_carries_the_words(self) -> None:
        from routes.reading import _finish_phrase
        phrase = _finish_phrase("ここで少し休みましょう。", "Let's rest here a little.", "少し", "すこし", "N5", grammar="〜ましょう")
        self.assertEqual([w["text"] for w in phrase["words"]], ["ここ", "で", "少し", "休みましょう。"])
        self.assertEqual(phrase["words"][2]["kana"], "すこし")

    @_needs_tokenizer
    def test_dictation_reads_a_word_as_the_bank_does(self) -> None:
        # The tokenizer reads 明日 あす; the bank's line, and its clip,
        # say あした.
        from study.dictation import bank_words
        from study.furigana import align_deck
        jp, kana = "明日の朝、駅で待っています。", "あしたのあさ、えきでまっています。"
        words = bank_words(jp, align_deck(jp, kana))
        self.assertEqual("".join(w["text"] for w in words), jp)
        self.assertEqual(words[0]["kana"], "あした")


if __name__ == "__main__":
    unittest.main()
