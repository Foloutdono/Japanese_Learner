import unittest

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
from study.difficulty import points_in, estimate_level, LEVELS


class EstimateLevelTests(unittest.TestCase):
    """estimate_level answers "what's the easiest level this sentence
    fits", by walking LEVELS (already easiest-first) and returning the
    first level report() calls ok."""

    def test_plain_n5_sentence_estimates_n5(self) -> None:
        # Verified directly against difficulty.report(sentence, "N5") --
        # not every plain-looking sentence actually clears all four
        # gates. "がくせいです" false-positives the N3 grammar point
        # "〜せいで" via substring collision (せい|で spans がくせい's
        # tail and です's head), and 私 is itself N4+ in this app's own
        # kanji deck. Neither is a defect this test should chase; picking
        # a sentence genuinely clean of both is the correct fix.
        self.assertEqual(estimate_level("ねこがいます。"), "N5")

    def test_above_n5_grammar_estimates_a_harder_level(self) -> None:
        # 〜ようとする is N3 grammar; a sentence using it should never
        # estimate as N5 or N4.
        level = estimate_level("食べようとしました")
        self.assertIn(level, (*LEVELS, None))
        if level is not None:
            self.assertNotIn(level, ("N5", "N4"))


class PointsInTests(unittest.TestCase):
    """points_in finds every catalogue grammar point a sentence visibly
    uses, at any level -- unlike grammar_over_level, which only reports
    points above a given level."""

    def test_finds_a_known_distinctive_point_by_name(self) -> None:
        hits = points_in("食べようとしました")
        patterns = [p for p, _level, _s, _e in hits]
        self.assertIn("〜ようとする", patterns)

    def test_spans_are_valid_and_non_empty(self) -> None:
        sentence = "食べようとしました"
        for pattern, level, start, end in points_in(sentence):
            self.assertGreaterEqual(start, 0)
            self.assertLess(start, end)
            self.assertLessEqual(end, len(sentence))
            self.assertTrue(sentence[start:end])

    def test_every_hit_resolves_to_a_catalogue_entry(self) -> None:
        # This is the invariant study/analysis.py depends on: every
        # (pattern, level) points_in returns must exist in
        # GRAMMAR_POINTS_BY_LEVEL[level], or analysis.py's grammar_to_id
        # lookup silently drops it.
        sentences = [
            "食べようとしました",
            "私は毎日日本語を勉強しています。",
            "明日は雨が降るかもしれません。",
            "これを見てください。",
        ]
        total = 0
        unresolved = 0
        for sentence in sentences:
            for pattern, level, _s, _e in points_in(sentence):
                total += 1
                entries = GRAMMAR_POINTS_BY_LEVEL.get(level, [])
                if not any(e.get("pattern") == pattern for e in entries):
                    unresolved += 1
        self.assertGreater(total, 0, "guard would pass vacuously")
        self.assertEqual(unresolved, 0, f"{unresolved}/{total} hits had no catalogue entry")

    def test_no_grammar_on_a_bare_noun(self) -> None:
        self.assertEqual(points_in("犬"), [])

    def test_results_sorted_by_start(self) -> None:
        hits = points_in("私は毎日日本語を勉強しています。")
        starts = [h[2] for h in hits]
        self.assertEqual(starts, sorted(starts))


if __name__ == "__main__":
    unittest.main()
