import unittest

from content.reading_sentences import BY_LEVEL, patterns_for, problems
from study import difficulty as D


class SentenceBankTests(unittest.TestCase):
    """
    The whole point of the curated bank is that a level's sentences are
    actually at that level -- the thing the old kanji-only gate could not
    promise. If that stops being true the bank is worth less than the
    Tatoeba pool it replaced, because a learner trusts a hand-written
    sentence more than a scraped one.
    """

    def test_every_sentence_is_at_its_level(self) -> None:
        found = problems()
        self.assertEqual(found, [], "\n".join(found))

    def test_every_level_has_enough_to_practise_with(self) -> None:
        # A reading session serves batches of up to 10 and excludes what
        # it has already shown. Below about 30 the same sentences come
        # round within a single sitting.
        for level, rows in BY_LEVEL.items():
            with self.subTest(level=level):
                self.assertGreaterEqual(len(rows), 30)

    def test_no_duplicate_sentences(self) -> None:
        seen = {}
        for level, rows in BY_LEVEL.items():
            for row in rows:
                self.assertNotIn(
                    row["jp"], seen,
                    f"{row['jp']} appears in both {seen.get(row['jp'])} and {level}",
                )
                seen[row["jp"]] = level

    # The bank was written against a 205-point catalogue and covered
    # every checkable point in it. The catalogue has since grown to 355,
    # so full coverage is a target rather than an invariant -- but it must
    # never go BACKWARDS, which is what these numbers pin. They count
    # CHECKABLE points only, so they are lower than the number of points
    # the bank names: a sentence may legitimately claim 〜ば or a bare
    # particle, and neither can be confirmed present.
    #
    # Raise these as sentences are added for the new points.
    COVERAGE_FLOOR = {"N5": 26, "N4": 33, "N3": 40, "N2": 41, "N1": 41}

    def test_coverage_never_regresses(self) -> None:
        """Each level demonstrates at least as many of its own grammar
        points as it did when the bank was written.

        Unverifiable points are excluded rather than waived: a bare
        particle (は, が) and a conjugation-class label (意向形 〜(よ)う)
        cannot be confirmed present, so a sentence claiming one would be
        an unchecked claim. See grammar_match.verifiable.
        """
        from study.grammar_match import verifiable

        for level, rows in BY_LEVEL.items():
            with self.subTest(level=level):
                checkable = {p for p in patterns_for(level) if verifiable(p)}
                covered = checkable & {row["grammar"] for row in rows}
                self.assertGreaterEqual(len(covered), self.COVERAGE_FLOOR[level])

    def test_no_sentence_claims_a_point_that_does_not_exist(self) -> None:
        """The half of the old coverage test that IS still an invariant:
        a sentence may leave a point undemonstrated, but it may never
        name one its level does not teach."""
        for level, rows in BY_LEVEL.items():
            catalogue = patterns_for(level)
            for row in rows:
                with self.subTest(level=level, jp=row["jp"]):
                    self.assertIn(row["grammar"], catalogue)


class DifficultyGateTests(unittest.TestCase):
    """The grader itself. Each of these is a false positive or false
    negative it actually produced while the bank was being written."""

    def test_kanji_gate_is_cumulative(self) -> None:
        # 見 is N5; an N5 sentence containing it must pass. This failed
        # while kanji_set passed a bare "N5" to get_kanji_string, which
        # takes a SEQUENCE and so iterated the characters "N" and "5".
        self.assertEqual(D.kanji_over_level("少しテレビを見てもいいですか。", "N5"), [])

    def test_grammar_gate_ignores_a_point_nested_in_an_allowed_one(self) -> None:
        # 〜ても (N4) is a substring of 〜てもいいです (N5).
        self.assertEqual(D.grammar_over_level("少し休んでもいいですか。", "N5"), [])

    def test_grammar_gate_still_catches_a_real_one(self) -> None:
        found = D.grammar_over_level("ペットをあげようとしました。", "N5")
        self.assertIn("〜ようとする", [pattern for pattern, _ in found])

    def test_a_short_hiragana_stem_is_not_evidence(self) -> None:
        # 〜なり (N1, literary) reduces to なり, which is inside every
        # ...になりました an N5 sentence ends with.
        self.assertEqual(D.grammar_over_level("子どもは大きくなりました。", "N5"), [])

    def test_vocab_gate_ignores_a_kana_reading_of_a_harder_word(self) -> None:
        # から is also the reading of 殻 "husk" (N2) and 空 (N3).
        self.assertEqual(D.vocab_over_level("時間がないから、行きません。", "N5"), [])

    def test_vocab_gate_ignores_a_verb_stem(self) -> None:
        # The tokeniser splits 行きます into 行き + ます, and 行き on its
        # own is a deck noun ("a going", N3) -- but the verb is N5 行く.
        self.assertEqual(D.vocab_over_level("七時に学校へ行きます。", "N5"), [])

    def test_vocab_gate_ignores_a_phrase_that_splits_into_easier_words(self) -> None:
        # 今日は is a real deck entry: the N1 spelling of こんにちは.
        self.assertEqual(D.vocab_over_level("今日は何をしますか。", "N5"), [])

    def test_catches_constructions_the_catalogue_does_not_list(self) -> None:
        """205 points is a syllabus, not an inventory of the language.
        Each of these was served AS N5 by the shipped gate."""
        for sentence, marker in [
            ("先生、アソコがかゆいんです。", "んです"),
            ("お年をお聞きしてよろしいでしょうか。", "お聞きし"),
            ("４月５日か６日に会っていただけませんか。", "ていただけ"),
            ("それは１週間前、すなわち４月２日に行われた。", "行われ"),
        ]:
            with self.subTest(sentence=sentence):
                found = [pattern for pattern, _ in D.grammar_over_level(sentence, "N5")]
                self.assertIn(marker, found)
                self.assertFalse(D.fits_loosely(sentence, "N5"))

    def test_extra_markers_do_not_reject_ordinary_n5(self) -> None:
        for sentence in [
            "これはわたしの本です。",
            "今日はいい天気ですね。",
            "五時に駅の前で会いましょう。",
        ]:
            with self.subTest(sentence=sentence):
                self.assertTrue(D.fits_loosely(sentence, "N5"))

    def test_length_cap_rejects_a_wall_of_text_at_n5(self) -> None:
        long_one = "わたしは" + "たかい" * 12 + "です。"
        self.assertFalse(D.fits(long_one, "N5"))


if __name__ == "__main__":
    unittest.main()
