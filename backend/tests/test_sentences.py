import unittest

from study.sentences import split_sentences, MAX_SENTENCES


class SplitSentencesTests(unittest.TestCase):
    """split_sentences breaks a Passage into Sentences: split on
    。！？!? (kept with the Sentence they end) and newlines (a
    separator, dropped), never inside 「」/『』/（）, with offsets into
    the ORIGINAL text."""

    def test_splits_on_three_terminator_kinds(self) -> None:
        result = split_sentences("私は学生です。今日は暑い！明日は?")
        self.assertEqual(
            [s["text"] for s in result],
            ["私は学生です。", "今日は暑い！", "明日は?"],
        )

    def test_offset_invariant_holds_including_across_a_newline(self) -> None:
        texts = [
            "私は学生です。今日は暑い！",
            "一行目\n二行目。三行目",
            "「引用」の中の。文。外の文。",
        ]
        for text in texts:
            for s in split_sentences(text):
                self.assertEqual(text[s["start"]:s["end"]], s["text"], text)

    def test_no_split_inside_kagi_brackets(self) -> None:
        result = split_sentences("私は「明日、行く。」と言った。")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["text"], "私は「明日、行く。」と言った。")

    def test_no_split_inside_nijuu_kagi_brackets(self) -> None:
        result = split_sentences("彼は『始まりの終わり。』を読んだ。")
        self.assertEqual(len(result), 1)

    def test_no_split_inside_parentheses(self) -> None:
        result = split_sentences("これは例（本当に例。）です。")
        self.assertEqual(len(result), 1)

    def test_no_terminator_returns_one_sentence_spanning_the_text(self) -> None:
        result = split_sentences("これはテストです")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["text"], "これはテストです")
        self.assertEqual(result[0]["start"], 0)

    def test_empty_and_whitespace_only_input_return_empty_list(self) -> None:
        self.assertEqual(split_sentences(""), [])
        self.assertEqual(split_sentences("   "), [])
        self.assertEqual(split_sentences("\n\n"), [])

    def test_no_returned_text_starts_or_ends_with_whitespace(self) -> None:
        result = split_sentences("  一行目\n\n  二行目。  ")
        for s in result:
            self.assertFalse(s["text"][0].isspace(), s["text"])
            self.assertFalse(s["text"][-1].isspace(), s["text"])

    def test_passage_over_max_sentences_can_be_capped_to_exactly_max_sentences(self) -> None:
        # split_sentences itself returns the FULL uncapped list (see the
        # module docstring for why); MAX_SENTENCES is the shared cap a
        # caller applies. This is the pattern routes/phrase.py uses.
        text = "文。" * (MAX_SENTENCES + 10)
        full = split_sentences(text)
        self.assertGreater(len(full), MAX_SENTENCES)
        capped = full[:MAX_SENTENCES]
        self.assertEqual(len(capped), MAX_SENTENCES)


if __name__ == "__main__":
    unittest.main()
