"""Which grammar points a sentence is shown to use.

The substring matcher this replaced answered a different question well
enough: the level gate only needs to know whether a sentence is too
hard, and may miss a point (the sentence merely goes through). A
breakdown is read by a learner. A point it misses is a rule left
untaught, and one it invents is a lesson about something that is not in
the sentence -- and it is a card they can press, a chip they can mine,
an explanation they will believe.

So the tests below are mostly about the false hits, which is where a
substring test over 541 patterns spends its time: 「気が」 is really
inside 天気が, 「ました」 is really inside every polite past sentence
whether or not もう is anywhere near it, and 「なり」 is really inside
になりました. The rest pin the things the catalogue's own lessons teach
the matcher (study/grammar_detect's rule 3), and the recall it is held
to over those lessons.
"""
import unittest

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
from study import grammar_detect, morphology


def patterns(sentence: str) -> list[str]:
    return [p for p, _lv, _s, _e, _k in grammar_detect.detect(sentence)]


def kinds(sentence: str) -> dict[str, str]:
    return {p: kind for p, _lv, _s, _e, kind in grammar_detect.detect(sentence)}


@unittest.skipUnless(
    morphology.MORPHOLOGY_AVAILABLE,
    "detection falls back to the substring rule without a tokenizer",
)
class WordBoundaryTests(unittest.TestCase):
    """Rule 1: a hit lands on words, not on characters."""

    def test_a_point_is_not_found_inside_a_noun(self) -> None:
        """天気が is one word and a particle. 〜気がする begins in the
        middle of the noun, which is not somewhere a grammar point
        begins."""
        self.assertNotIn("〜気がする", patterns("今日は天気がいいです。"))

    def test_a_point_may_begin_inside_a_word_that_conjugates(self) -> None:
        """大きく is one token, and 〜くて is the て on the end of it: a
        pattern attaches to an inflected stem, so a hit that starts
        mid-word is ordinary when the word is one that inflects."""
        self.assertIn("〜くて／〜で", patterns("この店は大きくて新しいです。"))

    def test_a_point_may_run_into_the_word_it_attaches_to(self) -> None:
        """なくしてしまいました conjugates しまう past where the
        catalogue writes it; the hit ends inside しまい."""
        self.assertIn("〜てしまう", patterns("大切な物をなくしてしまいました。"))

    def test_the_front_of_one_word_is_never_a_point(self) -> None:
        """です is not で followed by something. A hit that starts where
        a word starts and stops inside that same word is reading half a
        word."""
        self.assertNotIn("〜くて／〜で", patterns("今日は天気がいいです。"))

    def test_a_reading_that_spans_two_words_is_not_a_point(self) -> None:
        """The case test_difficulty_points has carried a note about
        since it was written: がくせい + です was reported as the N3
        〜せいで, せい|で straddling the two."""
        self.assertNotIn("〜せいで", patterns("わたしはがくせいです。"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class EveryPartTests(unittest.TestCase):
    """Rule 2: a pattern written in two parts needs both of them."""

    def test_a_two_part_point_needs_its_first_half(self) -> None:
        """もう〜ました fired on every ました in the catalogue -- 137 of
        them -- because the matcher kept the longest piece and dropped
        もう."""
        self.assertNotIn("もう〜ました", patterns("きのう映画を見ました。"))

    def test_a_two_part_point_is_found_when_both_halves_are_there(self) -> None:
        self.assertIn("もう〜ました", patterns("その本はもう読みました。"))

    def test_from_here_to_there_needs_both_ends(self) -> None:
        self.assertIn("から〜まで", patterns("学校から駅まで歩きます。"))
        self.assertNotIn("から〜まで", patterns("さむいから、家にいます。"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class ShapeFromTheLessonsTests(unittest.TestCase):
    """Rule 3: a point looks the way its own example sentences look."""

    def test_a_verb_is_not_a_particle_that_is_spelled_the_same(self) -> None:
        """〜なり (N1) is a particle. なり in 先生になりました is 成る,
        and every ...になりました in the app used to report it."""
        self.assertNotIn("〜なり", patterns("友だちは日本語の先生になりました。"))

    def test_the_word_in_front_tells_two_points_apart(self) -> None:
        """の after a noun is the possessive; の after a verb is the
        nominalizer. Same particle, and the catalogue's `structure` line
        says exactly this -- which is what its examples show."""
        self.assertIn("の", patterns("これはわたしのかさです。"))
        self.assertNotIn("〜の", patterns("これはわたしのかさです。"))

    def test_a_lesson_teaches_the_matcher_its_own_point(self) -> None:
        for level, points in GRAMMAR_POINTS_BY_LEVEL.items():
            for point in points:
                pattern = point.get("pattern", "")
                if pattern != "〜てください":
                    continue
                for example in point.get("examples", []):
                    with self.subTest(sentence=example["jp"]):
                        self.assertIn(pattern, patterns(example["jp"]))

    def test_half_a_word_is_not_a_point_that_stands_on_its_own(self) -> None:
        """〜し lists reasons and stands as its own word in every one of
        its lessons. The し inside なくして is a verb ending."""
        self.assertIn("〜し", patterns("安いし、近いし、この店にします。"))
        self.assertNotIn("〜し", patterns("大切な物をなくしてしまいました。"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class WhatIsReportedTests(unittest.TestCase):

    def test_a_point_inside_a_longer_one_is_that_ones_own(self) -> None:
        """The と of 食べようとした belongs to 〜ようとする, and is not
        the conditional 〜と; the ます inside ました is the ました."""
        found = patterns("食べようとしました")
        self.assertIn("〜ようとする", found)
        self.assertNotIn("〜と", found)
        self.assertIn("〜ました／〜ませんでした", found)
        self.assertNotIn("〜ます／〜ません", found)

    def test_a_multi_part_point_explains_nothing_it_encloses(self) -> None:
        """もう〜ました reaches from もう to the end of the sentence, and
        everything the learner is reading lies between the two."""
        found = patterns("外はもうくらくなりました。")
        self.assertIn("もう〜ました", found)
        self.assertIn("〜くなる／〜になる", found)

    def test_a_hit_says_which_pieces_it_is_written_on(self) -> None:
        """hits() beside detect(): the same list, each hit with the
        (start, end) pieces it is written on. One piece for a point in
        one piece; one per part for a two-part point, and the clause
        between the parts is in neither (plan 095)."""
        sentence = "駅から家まで歩きました。"
        full = grammar_detect.hits(sentence)
        self.assertEqual(
            [(h["pattern"], h["level"], h["start"], h["end"], h["kind"]) for h in full],
            grammar_detect.detect(sentence),
        )
        kara_made = next(h for h in full if h["pattern"] == "から〜まで")
        self.assertEqual(kara_made["segments"], [(1, 3), (4, 6)])
        mashita = next(h for h in full if h["pattern"] == "〜ました／〜ませんでした")
        self.assertEqual(mashita["segments"], [(mashita["start"], mashita["end"])])
        for h in full:
            with self.subTest(pattern=h["pattern"]):
                # The pieces are in order, do not overlap, and span
                # exactly the hit's own stretch.
                self.assertEqual(h["segments"][0][0], h["start"])
                self.assertEqual(h["segments"][-1][1], h["end"])
                for (_s1, e1), (s2, _e2) in zip(h["segments"], h["segments"][1:]):
                    self.assertLessEqual(e1, s2)

    def test_without_a_tokenizer_a_hit_is_still_written_on_one_piece(self) -> None:
        original = morphology.tokenize
        morphology.tokenize = lambda text: None
        try:
            for h in grammar_detect.hits("なくしてしまいました。"):
                with self.subTest(pattern=h["pattern"]):
                    self.assertEqual(h["segments"], [(h["start"], h["end"])])
        finally:
            morphology.tokenize = original

    def test_a_marker_is_told_from_a_construction(self) -> None:
        """A screen puts the two in different places: a marker on the
        row of the very particle it is, a construction in the chips over
        the sentence it shapes."""
        found = kinds("今日は学校へ行きません。")
        self.assertEqual(found.get("は"), "marker")
        self.assertEqual(found.get("へ"), "marker")
        self.assertEqual(found.get("〜ます／〜ません"), "pattern")

    def test_a_sense_the_text_cannot_show_is_not_claimed(self) -> None:
        """〜を（移動） is を with a verb of movement. Nothing in the
        surface says which を this is, and the catalogue's own
        parenthesis is what says so -- the plain point is reported and
        the qualified one is not guessed at."""
        found = patterns("公園を歩きます。")
        self.assertIn("を", found)
        self.assertNotIn("〜を（移動）", found)

    def test_an_occurrence_is_reported_once_per_place_it_happens(self) -> None:
        """A point's needles nest (ています, ていま), which is one
        occurrence and one card. Two real occurrences are two."""
        self.assertEqual(patterns("安いし、近いし、この店にします。").count("〜し"), 2)
        self.assertEqual(patterns("雨がふっています。").count("〜ています"), 1)

    def test_a_span_is_inside_the_sentence_and_not_empty(self) -> None:
        sentence = "子どもは野さいを食べようとしない。"
        for pattern, _level, start, end in grammar_detect.points_in(sentence):
            with self.subTest(pattern=pattern):
                self.assertLess(start, end)
                self.assertLessEqual(end, len(sentence))

    def test_nothing_in_a_bare_word(self) -> None:
        self.assertEqual(grammar_detect.detect("犬"), [])
        self.assertEqual(grammar_detect.detect(""), [])


class WithoutMorphologyTests(unittest.TestCase):
    """fugashi/unidic-lite is optional (morphology.MORPHOLOGY_AVAILABLE),
    and every rule above needs it. What must not happen is detection
    disappearing with it."""

    def test_it_falls_back_to_the_substring_rule(self) -> None:
        sentence = "この本を読んでください。"
        real = morphology.tokenize
        morphology.tokenize = lambda _text: None
        try:
            found = [p for p, _lv, _s, _e, _k in grammar_detect.detect(sentence)]
        finally:
            morphology.tokenize = real
        self.assertIn("〜てください", found)

    def test_a_hit_it_cannot_judge_is_still_a_hit_with_a_span(self) -> None:
        real = morphology.tokenize
        morphology.tokenize = lambda _text: None
        try:
            hits = grammar_detect.detect("この本を読んでください。")
        finally:
            morphology.tokenize = real
        for pattern, level, start, end, kind in hits:
            with self.subTest(pattern=pattern):
                self.assertLess(start, end)
                # Nothing can be called a marker without a tokenizer to
                # say what part of speech it landed on.
                self.assertEqual(kind, "pattern")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class TheCatalogueIsTheMeasureTests(unittest.TestCase):
    """The 2,169 hand-written example sentences are ground truth: each
    one was written to demonstrate exactly one point, and detection
    should find that point in it.

    A ratchet, not a target. The floors are below what the module scores
    today (90.4% of sentences, 510 of 541 points) so that ordinary
    catalogue edits do not fail the build, and far above what the
    substring matcher scored (77.6%) so that a regression to it does.
    """

    @classmethod
    def setUpClass(cls) -> None:
        cls.sentences = 0
        cls.found = 0
        cls.points = 0
        cls.points_found = 0
        for level, points in GRAMMAR_POINTS_BY_LEVEL.items():
            for point in points:
                pattern = point.get("pattern", "")
                examples = [ex["jp"] for ex in point.get("examples", []) if ex.get("jp")]
                if not pattern or not examples:
                    continue
                cls.points += 1
                hits = 0
                for sentence in examples:
                    cls.sentences += 1
                    if (pattern, level) in {
                        (p, lv) for p, lv, _s, _e, _k in grammar_detect.detect(sentence)
                    }:
                        cls.found += 1
                        hits += 1
                cls.points_found += bool(hits)

    def test_a_lesson_sentence_shows_its_own_point(self) -> None:
        share = self.found / self.sentences
        self.assertGreaterEqual(
            share, 0.86,
            f"detection found the point its own example was written for in "
            f"{self.found}/{self.sentences} sentences ({share:.1%})",
        )

    def test_nearly_every_point_is_visible_somewhere_in_its_own_lesson(self) -> None:
        share = self.points_found / self.points
        self.assertGreaterEqual(
            share, 0.90,
            f"{self.points_found}/{self.points} points were found in at least "
            f"one of their own examples ({share:.1%}) -- see the module "
            f"docstring for the four kinds that are refusals, not misses",
        )
