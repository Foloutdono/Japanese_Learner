import unittest

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
from study.grammar_match import (
    alternatives, contains_pattern, stems, verifiable,
)
from study.grammar_sentence_gen import _parse, build_prompt, check_sentence


class PatternMatchTests(unittest.TestCase):
    """
    A sentence that does not contain its target pattern is worse than no
    sentence: indice_2 would show an example of something else, and
    fill_in would ask which rule is at work about a sentence where it
    isn't. This is the check that stops that.
    """

    def test_alternatives_keeps_all_of_them(self) -> None:
        # The exam generator's older _pattern_core kept only the first, so
        # a valid generation using either of the other two was discarded.
        self.assertEqual(
            alternatives("〜てあげる／てくれる／てもらう"),
            ["てあげる", "てくれる", "てもらう"],
        )

    def test_a_japanese_label_is_stripped(self) -> None:
        self.assertEqual(alternatives("使役形 〜させる"), ["させる"])

    def test_matches_across_conjugation(self) -> None:
        for sentence, pattern in [
            ("手伝ってくれた。", "〜てあげる／てくれる／てもらう"),
            ("食べるべきです。", "〜べきだ"),
            ("子供に野菜を食べさせた。", "使役形 〜させる"),
            ("行かざるを得なかった。", "〜ざるを得ない"),
            ("雨が降っている。", "〜ています"),
            ("言わずにはいられなかった。", "〜ずにはいられない"),
        ]:
            self.assertTrue(contains_pattern(sentence, pattern), f"{sentence} / {pattern}")

    def test_does_not_match_an_unrelated_sentence(self) -> None:
        for sentence, pattern in [
            ("本を読んだ。", "〜べきだ"),
            ("猫が好きだ。", "〜ざるを得ない"),
            ("電車を逃すようで、走っています。", "〜ようとする"),
        ]:
            self.assertFalse(contains_pattern(sentence, pattern), f"{sentence} / {pattern}")

    def test_bare_particles_are_unverifiable_not_true(self) -> None:
        # は occurs in almost every sentence, so a substring test proves
        # nothing. Reporting that honestly lets the caller decide, instead
        # of handing back a True that was never really checked.
        for pattern in ("は", "が", "を", "に", "です／だ"):
            self.assertFalse(verifiable(pattern), pattern)

    def test_real_patterns_are_verifiable(self) -> None:
        for pattern in ("〜べきだ", "〜ざるを得ない", "〜ものの", "〜まみれ"):
            self.assertTrue(verifiable(pattern), pattern)

    def test_no_stem_is_short_enough_to_match_anything(self) -> None:
        for level, entries in GRAMMAR_POINTS_BY_LEVEL.items():
            for entry in entries:
                for stem in stems(entry["pattern"]):
                    self.assertGreaterEqual(
                        len(stem), 2, f"{level} {entry['pattern']}: stem {stem!r}",
                    )

    def test_most_of_the_catalogue_is_checkable(self) -> None:
        total = sum(len(v) for v in GRAMMAR_POINTS_BY_LEVEL.values())
        ok = sum(
            verifiable(e["pattern"])
            for entries in GRAMMAR_POINTS_BY_LEVEL.values() for e in entries
        )
        # The unverifiable remainder is exactly the bare particles and the
        # two "pick a form" entries; if this drops, the matcher regressed.
        self.assertGreaterEqual(ok / total, 0.88)


class ParseTests(unittest.TestCase):
    GOOD = '[[["あ","a"],["い","i"]],[["う","u"],["え","e"]]]'

    def test_plain_and_fenced(self) -> None:
        for text in (self.GOOD, f"```json\n{self.GOOD}\n```"):
            self.assertEqual(len(_parse(text)), 2)

    def test_truncated_response_keeps_its_complete_prefix(self) -> None:
        # A failed parse costs 100% of the call's tokens whether it broke
        # on the first group or the last, so the prefix is salvaged.
        self.assertEqual(_parse('[[["あ","a"],["い","i"]],[["う",'), [[["あ", "a"], ["い", "i"]]])

    def test_a_bad_group_becomes_a_hole_not_a_gap(self) -> None:
        # THE correctness case: the caller zips these against the points it
        # asked about, so dropping a middle group would slide every later
        # sentence onto the wrong grammar point.
        got = _parse('[[["あ","a"]],[BROKEN],[["う","u"]]]')
        self.assertEqual(len(got), 3)
        self.assertIsNone(got[1])
        self.assertEqual(got[2], [["う", "u"]])

    def test_garbage_is_none(self) -> None:
        self.assertIsNone(_parse("sorry, I can't help with that"))


class CheckSentenceTests(unittest.TestCase):
    def test_accepts_a_good_pair(self) -> None:
        self.assertIsNone(
            check_sentence("雨のせいで試合が中止になった。", "Because of the rain, the match was cancelled.",
                           "〜せいで", "N3"),
        )

    def test_rejects_the_prompts_own_placeholders(self) -> None:
        # Observed live: with reasoning enabled the model returned the
        # output example verbatim instead of writing anything.
        for jp in ("文1a", "文2b", "..."):
            self.assertEqual(check_sentence(jp, "en", "〜せいで", "N3"), "placeholder echoed back")

    def test_rejects_a_fragment(self) -> None:
        # 血まみれ contains its pattern and is within level, but shows the
        # grammar doing nothing -- it is a noun phrase, not an example.
        self.assertIsNotNone(check_sentence("血まみれ", "covered in blood", "〜まみれ", "N1"))

    def test_rejects_a_sentence_that_does_not_use_the_pattern(self) -> None:
        reason = check_sentence("今日はいい天気です。", "Nice weather today.", "〜せいで", "N3")
        self.assertIsNotNone(reason)
        self.assertIn("does not contain", reason)

    def test_rejects_kanji_above_the_level_and_names_them(self) -> None:
        reason = check_sentence("彼は先生として振る舞うべきです。", "x", "〜として", "N3")
        self.assertIsNotNone(reason)
        self.assertIn("振", reason)

    def test_rejects_empty(self) -> None:
        self.assertEqual(check_sentence("", "en", "〜せいで", "N3"), "empty")
        self.assertEqual(check_sentence("雨のせいで中止。", "", "〜せいで", "N3"), "empty")


class PromptTests(unittest.TestCase):
    def test_the_prompt_does_not_embed_the_kanji_list(self) -> None:
        # The whole economy argument: the existing exam prompts paste 2,212
        # characters of allowed kanji into every call to state a constraint
        # that sentence_kanji_ok() already checks in code afterwards.
        points = GRAMMAR_POINTS_BY_LEVEL["N1"][:8]
        prompt = build_prompt(points, "N1")
        self.assertLess(len(prompt), 1400, "prompt has grown a large embedded list")
        for point in points:
            self.assertIn(point["pattern"], prompt)

    def test_the_prompt_states_the_count_everywhere_it_matters(self) -> None:
        # Being explicit about the count in all three places is what made
        # the response parseable at all; looser wording returned output the
        # parser could not read, at full token cost.
        prompt = build_prompt(GRAMMAR_POINTS_BY_LEVEL["N3"][:8], "N3")
        self.assertIn("EXACTLY", prompt)
        self.assertIn("8", prompt)


if __name__ == "__main__":
    unittest.main()


class AuthoredSentenceTests(unittest.TestCase):
    """
    content/grammar_sentences.json is hand-written, which means it is
    hand-breakable. This runs the generator's own gate over every entry,
    so an edit that introduces a kanji above its level, drops the pattern
    out of its own example, or leaves a fragment fails the build rather
    than reaching a learner who by definition cannot spot the error --
    they are reading the example because they do not know the pattern yet.
    """

    @classmethod
    def setUpClass(cls) -> None:
        from content.grammar_sentences_data import SENTENCES_BY_LEVEL
        cls.data = SENTENCES_BY_LEVEL

    def test_every_catalogue_point_has_sentences(self) -> None:
        for level, entries in GRAMMAR_POINTS_BY_LEVEL.items():
            have = self.data.get(level, {})
            missing = [e["pattern"] for e in entries if not have.get(e["pattern"])]
            self.assertEqual(missing, [], f"{level} missing: {missing}")

    def test_no_orphan_patterns(self) -> None:
        # A sentence filed under a pattern the catalogue dropped would sit
        # there unreachable and unnoticed.
        for level, entries in GRAMMAR_POINTS_BY_LEVEL.items():
            catalogue = {e["pattern"] for e in entries}
            orphans = sorted(set(self.data.get(level, {})) - catalogue)
            self.assertEqual(orphans, [], f"{level} orphans: {orphans}")

    def test_two_sentences_each(self) -> None:
        for level, points in self.data.items():
            for pattern, sentences in points.items():
                self.assertEqual(len(sentences), 2, f"{level} {pattern}")

    def test_every_sentence_passes_the_generator_gate(self) -> None:
        failures = []
        for level, points in self.data.items():
            for pattern, sentences in points.items():
                for s in sentences:
                    why = check_sentence(s["jp"], s["en"], pattern, level)
                    if why:
                        failures.append((level, pattern, s["jp"], why))
        self.assertEqual(failures, [], f"{len(failures)} bad sentence(s): {failures[:5]}")

    def test_the_two_sentences_differ(self) -> None:
        for level, points in self.data.items():
            for pattern, sentences in points.items():
                self.assertNotEqual(sentences[0]["jp"], sentences[1]["jp"], f"{level} {pattern}")

    def test_translations_are_english_not_placeholders(self) -> None:
        for level, points in self.data.items():
            for pattern, sentences in points.items():
                for s in sentences:
                    self.assertRegex(s["en"], r"[A-Za-z]{3}", f"{level} {pattern}: {s['en']!r}")
                    self.assertGreater(len(s["en"]), 8, f"{level} {pattern}: {s['en']!r}")

    def test_no_cjk_leaks_into_a_translation(self) -> None:
        for level, points in self.data.items():
            for pattern, sentences in points.items():
                for s in sentences:
                    stray = [c for c in s["en"] if "\u3040" <= c <= "\u9fff"]
                    self.assertEqual(stray, [], f"{level} {pattern}: {s['en']!r}")
