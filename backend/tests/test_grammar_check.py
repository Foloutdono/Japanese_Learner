"""
study/grammar_check.py is what stands between a hand-written lesson and
a learner who cannot tell it is wrong. Each rule is exercised with an
entry crafted to break it, so the gate cannot quietly stop checking
something (plan 087).
"""
import unittest

from content.grammar_points_data import RICH_LEVELS
from study import grammar_check
from study.grammar_check import check_entry, problems, report


def _good(**over) -> dict:
    entry = {
        "pattern": "〜てください",
        "structure": "verb て-form + ください",
        "meaning": {"en": "please do", "fr": "veuillez faire"},
        "register": "polite",
        "steps": [
            {"kind": "rule", "en": "A polite request.", "fr": "Une demande polie."},
            {"kind": "use", "en": "- asking a favour\n- giving instructions", "fr": "- demander un service\n- donner une consigne"},
        ],
        "compare": [
            {"pattern": "〜ないでください", "en": "the negative request", "fr": "la demande négative"},
        ],
        "examples": [
            {"jp": "ここに名前を書いてください。", "en": "Please write your name here.", "fr": "Écrivez votre nom ici, s'il vous plaît.", "contrast": True},
            {"jp": "ちょっとまってください。", "en": "Please wait a moment.", "fr": "Attendez un instant, s'il vous plaît."},
            {"jp": "この本を読んでください。", "en": "Please read this book.", "fr": "Lisez ce livre, s'il vous plaît."},
        ],
    }
    entry.update(over)
    return entry


RIVAL = {
    "pattern": "〜ないでください",
    "structure": "verb ない-form + でください",
    "meaning": {"en": "please do not", "fr": "veuillez ne pas"},
    "steps": [], "compare": [],
    "examples": [
        {"jp": "ここで写真をとらないでください。", "en": "Please do not take photos here.", "fr": "Ne prenez pas de photos ici."},
        {"jp": "まだ食べないでください。", "en": "Please do not eat yet.", "fr": "Ne mangez pas encore."},
    ],
}


def _catalogue(level: str, entry: dict) -> dict:
    """A catalogue holding the crafted entry at `level` and its rival at
    N5, without depending on what the real files say today."""
    cat = {lvl: [] for lvl in ("N5", "N4", "N3", "N2", "N1")}
    cat["N5"].append(RIVAL)
    cat[level].append(entry)
    return cat


# The plain-level catalogue most tests use.
CATALOGUE = _catalogue("N5", _good())


class GateRuleTests(unittest.TestCase):
    def _problems(self, level="N5", **over):
        entry = _good(**over)
        return check_entry(level, entry, _catalogue(level, entry))

    def test_a_good_entry_is_clean_at_a_rich_and_a_plain_level(self) -> None:
        # The crafted entry meets the rich bar, so it passes whichever
        # bar its level is held to.
        self.assertEqual(self._problems("N5"), [])
        self.assertEqual(self._problems("N1"), [])

    def test_rich_levels_are_the_loader_s_set(self) -> None:
        # Documents what the other tests below assume when they force a
        # level rich: the gate reads RICH_LEVELS, not a copy.
        self.assertIs(grammar_check.RICH_LEVELS, RICH_LEVELS)

    def test_unknown_and_missing_keys(self) -> None:
        self.assertTrue(any("unknown keys" in p for p in self._problems(slug="x")))
        entry = _good()
        del entry["examples"]
        self.assertTrue(any("missing keys" in p for p in check_entry("N5", entry, CATALOGUE)))

    def test_pattern_rules(self) -> None:
        self.assertTrue(any("contains ':'" in p for p in self._problems(pattern="a:b")))
        self.assertTrue(any("is empty" in p for p in self._problems(structure="  ")))
        doubled = {**CATALOGUE, "N4": [_good()]}
        self.assertTrue(any("also filed under" in p for p in check_entry("N5", _good(), doubled)))

    def test_meaning_needs_both_languages(self) -> None:
        self.assertTrue(any("meaning.fr is empty" in p for p in self._problems(meaning={"en": "x y z", "fr": ""})))
        self.assertTrue(any("expected {en, fr}" in p for p in self._problems(meaning="bare")))

    def test_register_is_a_closed_set(self) -> None:
        self.assertTrue(any("register" in p for p in self._problems(register="shouty")))

    def test_step_rules(self) -> None:
        self.assertTrue(any("kind" in p for p in self._problems(steps=[{"kind": "tip", "en": "abc", "fr": "def"}])))
        self.assertTrue(any("unbalanced **" in p for p in self._problems(
            steps=[{"kind": "rule", "en": "**bold", "fr": "gras"}])))
        self.assertTrue(any("bullet line" in p for p in self._problems(
            steps=[{"kind": "rule", "en": "-no space", "fr": "-sans espace"}])))
        self.assertTrue(any("appears twice" in p for p in self._problems(
            steps=[{"kind": "rule", "en": "abc", "fr": "def"}, {"kind": "rule", "en": "ghi", "fr": "jkl"}])))
        long = "word " * 100
        self.assertTrue(any("cap" in p for p in self._problems(steps=[{"kind": "rule", "en": long, "fr": long}])))

    def test_compare_rules(self) -> None:
        self.assertTrue(any("compares itself" in p for p in self._problems(
            compare=[{"pattern": "〜てください", "en": "abc", "fr": "def"}])))
        self.assertTrue(any("names no catalogue point" in p for p in self._problems(
            compare=[{"pattern": "〜nope", "en": "abc", "fr": "def"}])))
        rival = {"pattern": "〜ないでください", "en": "abc", "fr": "def"}
        self.assertTrue(any("listed twice" in p for p in self._problems(compare=[rival, rival])))

    def test_example_rules(self) -> None:
        good = _good()["examples"]
        # the generator's gate, over the French too
        bad_fr = [{**good[0], "fr": ""}] + good[1:]
        self.assertTrue(any("(fr) empty" in p for p in self._problems(examples=bad_fr)))
        # no Japanese in a translation
        leak = [{**good[0], "en": "Please write 名前 here."}] + good[1:]
        self.assertTrue(any("contains Japanese" in p for p in self._problems(examples=leak)))
        # a repeated sentence
        self.assertTrue(any("repeats" in p for p in self._problems(examples=[good[0], good[0], good[2]])))
        # a sentence that does not use the pattern
        off = [{"jp": "今日はいい天気です。", "en": "Nice weather today.", "fr": "Il fait beau aujourd'hui."}] + good[1:]
        self.assertTrue(any("does not contain" in p for p in self._problems(examples=off)))

    def test_contrast_rules(self) -> None:
        good = _good()["examples"]
        # a contrast example on a point that compares nothing
        self.assertTrue(any("compares nothing" in p for p in check_entry(
            "N1", _good(compare=[]), CATALOGUE)))
        # a contrast example that also contains the rival: two right answers
        both = [{"jp": "書かないでください、書いてください。", "en": "Do not write, please write.",
                 "fr": "N'écrivez pas, écrivez.", "contrast": True}] + good[1:]
        self.assertTrue(any("two answers" in p for p in self._problems(examples=both)))
        # a pattern the drill cannot blank
        particle = {
            **_good(pattern="は", structure="topic + は", compare=[{"pattern": "〜ないでください", "en": "abc", "fr": "def"}]),
            "examples": [{"jp": "今日は天気がいいです。", "en": "The weather is good today.",
                          "fr": "Il fait beau aujourd'hui.", "contrast": True}] + good[1:],
        }
        self.assertTrue(any("cannot be blanked" in p for p in check_entry("N1", particle, CATALOGUE)))

    def test_the_rich_bar(self) -> None:
        # Force the bar on, whatever RICH_LEVELS says today.
        old = grammar_check.RICH_LEVELS
        grammar_check.RICH_LEVELS = frozenset({"N5"})
        try:
            self.assertEqual(self._problems("N5"), [])
            self.assertTrue(any("opens with a 'rule'" in p for p in self._problems("N5", steps=[])))
            self.assertTrue(any("at least one neighbour" in p for p in self._problems("N5", compare=[])))
            self.assertTrue(any("copy of en" in p for p in self._problems(
                "N5", meaning={"en": "please do", "fr": "please do"})))
            self.assertTrue(any("needs 3" in p for p in self._problems("N5", examples=_good()["examples"][:2])))
            no_mark = [{k: v for k, v in ex.items() if k != "contrast"} for ex in _good()["examples"]]
            self.assertTrue(any("marks no contrast" in p for p in self._problems("N5", examples=no_mark)))
            # ...and the same entry is fine at a level held to the plain bar
            self.assertEqual(self._problems("N1", steps=[], compare=[], examples=no_mark[:2]), [])
        finally:
            grammar_check.RICH_LEVELS = old


class CatalogueTests(unittest.TestCase):
    def test_problems_and_report_cover_every_level(self) -> None:
        self.assertEqual(problems(), [])
        rows = report()
        self.assertEqual(set(rows), {"N5", "N4", "N3", "N2", "N1"})
        for row in rows.values():
            self.assertGreater(row["points"], 0)
            self.assertGreaterEqual(row["examples_min"], 2)
            self.assertLessEqual(row["contrast_ok"], row["with_compare"])


if __name__ == "__main__":
    unittest.main()
