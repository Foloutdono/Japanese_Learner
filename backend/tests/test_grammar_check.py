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
from study.grammar_examples import _as_written, furigana_by_pattern, pattern_furigana, written_furigana


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

    def test_a_pattern_with_kanji_carries_a_reading_that_spells_it(self) -> None:
        def reading_problems(**over):
            return [p for p in self._problems(**over) if "reading" in p]
        # the one a card prints over 中
        self.assertEqual(reading_problems(pattern="〜の中で", reading="〜のなかで"), [])
        self.assertTrue(any("carries its reading" in p for p in reading_problems(pattern="〜の中で")))
        self.assertTrue(any("no kanji" in p for p in reading_problems(reading="〜てください")))
        # a reading that is not the pattern with its kanji in kana
        self.assertTrue(any("does not spell" in p for p in reading_problems(pattern="〜の中で", reading="〜のなかに")))
        self.assertTrue(any("does not spell" in p for p in reading_problems(pattern="〜の中で", reading="〜の中で")))
        self.assertTrue(any("not kana" in p for p in reading_problems(pattern="〜の中で", reading="〜のnakaで")))
        self.assertTrue(any("whitespace" in p for p in reading_problems(pattern="〜の中で", reading=" 〜のなかで")))

    def test_a_structure_with_kanji_carries_a_reading_that_spells_it(self) -> None:
        def structure_problems(**over):
            return [p for p in self._problems(**over) if "structure_reading" in p]
        # English between the Japanese, spelled as written
        self.assertEqual(structure_problems(structure="group + の中で", structure_reading="group + のなかで"), [])
        self.assertTrue(any("carries its structure_reading" in p for p in structure_problems(structure="group + の中で")))
        self.assertTrue(any("no kanji" in p for p in structure_problems(structure_reading="verb て-form + ください")))
        self.assertTrue(any("does not spell" in p for p in structure_problems(
            structure="group + の中で", structure_reading="noun + のなかで")))
        self.assertTrue(any("not kana" in p for p in structure_problems(
            structure="group + の中で", structure_reading="group + のnakaで")))

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


class PatternFuriganaTests(unittest.TestCase):
    """What a grammar card prints over its pattern
    (study/grammar_examples.pattern_furigana)."""

    def test_the_reading_goes_over_the_kanji_and_nothing_else(self) -> None:
        self.assertEqual(pattern_furigana("〜の中で", "〜のなかで"),
                         [{"text": "〜の"}, {"text": "中", "reading": "なか"}, {"text": "で"}])
        # per kanji where the run divides; brackets and 〜 as written
        self.assertEqual(pattern_furigana("〜が（逆接）", "〜が（ぎゃくせつ）"), [
            {"text": "〜が（"}, {"text": "逆", "reading": "ぎゃく"}, {"text": "接", "reading": "せつ"}, {"text": "）"},
        ])

    def test_no_reading_is_the_pattern_as_text(self) -> None:
        self.assertEqual(pattern_furigana("〜てから", None), [{"text": "〜てから"}])
        # a written card's own rule: kanji, but nothing to read it by
        self.assertEqual(pattern_furigana("〜の中で", None), [{"text": "〜の中で"}])
        # a reading that does not spell the pattern puts nothing over 〜
        self.assertEqual(pattern_furigana("〜の中で", "〜のなかに"), [{"text": "〜の中で"}])

    def test_every_catalogue_pattern_and_formation_with_kanji_is_read(self) -> None:
        for level, entries in grammar_check.GRAMMAR_POINTS_BY_LEVEL.items():
            for entry in entries:
                for text, key in ((entry["pattern"], "reading"), (entry["structure"], "structure_reading")):
                    parts = pattern_furigana(text, entry.get(key))
                    with self.subTest(level=level, text=text):
                        self.assertEqual("".join(p["text"] for p in parts), text)
                        self.assertEqual(any(p.get("reading") for p in parts), key in entry)

    def test_options_are_read_by_the_catalogue(self) -> None:
        self.assertEqual(furigana_by_pattern(["〜の中で", "〜てから", "not a point"]), {
            "〜の中で": [{"text": "〜の"}, {"text": "中", "reading": "なか"}, {"text": "で"}],
        })


class WrittenFuriganaTests(unittest.TestCase):
    """A card the learner wrote: the catalogue's reading when its rule is
    a catalogue point, the tokenizer's otherwise, always its own text."""

    def test_a_catalogue_point_is_read_as_the_catalogue_reads_it(self) -> None:
        self.assertEqual(written_furigana("〜中"), [{"text": "〜"}, {"text": "中", "reading": "ちゅう・じゅう"}])
        # a typed tilde is still the point, and still the learner's tilde
        self.assertEqual(written_furigana("~の中で"), [{"text": "~の"}, {"text": "中", "reading": "なか"}, {"text": "で"}])
        self.assertEqual(written_furigana("～の中で")[0], {"text": "～の"})

    def test_no_kanji_is_the_text(self) -> None:
        self.assertEqual(written_furigana("〜てから"), [{"text": "〜てから"}])
        self.assertEqual(written_furigana(""), [])

    def test_the_tokenizers_parts_keep_the_spaces_it_drops(self) -> None:
        # align_sentence's parts for "verb て-form + 見る": MeCab drops the
        # spaces, and a formation is English between its Japanese.
        parts = [{"text": "verbて-form+"}, {"text": "見", "reading": "み", "word": 4}, {"text": "る"}]
        self.assertEqual(_as_written("verb て-form + 見る", parts), [
            {"text": "verb て-form + "}, {"text": "見", "reading": "み"}, {"text": "る"},
        ])
        self.assertEqual(_as_written(" 方 ", [{"text": "方", "reading": "かた"}]),
                         [{"text": " "}, {"text": "方", "reading": "かた"}, {"text": " "}])
        # parts that spell something else are no furigana at all
        self.assertEqual(_as_written("見る", [{"text": "観", "reading": "み"}, {"text": "る"}]), [{"text": "見る"}])

    def test_the_learners_reading_comes_first_where_it_spells_the_rule(self) -> None:
        # over the catalogue's own (〜方 is かた there) ...
        self.assertEqual(written_furigana("〜方", "ほう"), [{"text": "〜"}, {"text": "方", "reading": "ほう"}])
        # ... leniently: the 〜 left out, a typed tilde, katakana for hiragana
        nakade = [{"text": "〜の"}, {"text": "中", "reading": "なか"}, {"text": "で"}]
        self.assertEqual(written_furigana("〜の中で", "のなかで"), nakade)
        self.assertEqual(written_furigana("〜の中で", "~のなかで"), nakade)
        self.assertEqual(written_furigana("〜の中で", "ノナカデ"), nakade)
        # and not at all where it does not spell it: the catalogue reads it
        self.assertEqual(written_furigana("〜の中で", "なか"), nakade)
        self.assertEqual(written_furigana("〜の中で", "〜のnakaで"), nakade)

    def test_a_formation_is_read_as_its_rule_is(self) -> None:
        rule = written_furigana("〜方", "かた")
        self.assertEqual(written_furigana("verb stem + 方", known=rule),
                         [{"text": "verb stem + "}, {"text": "方", "reading": "かた"}])
        # a kanji the rule does not hold is left to the tokenizer (or to
        # nothing without one), and never re-reads one the rule does
        parts = written_furigana("verb stem + 方 ／ 前", known=rule)
        self.assertEqual("".join(p["text"] for p in parts), "verb stem + 方 ／ 前")
        self.assertIn({"text": "方", "reading": "かた"}, parts)

    def test_anything_else_is_read_by_the_tokenizer(self) -> None:
        from study import morphology
        if morphology.tokenize("見る") is None:
            self.skipTest("no tokenizer installed")
        parts = written_furigana("〜に行く前に")
        self.assertEqual("".join(p["text"] for p in parts), "〜に行く前に")
        self.assertEqual([(p["text"], p["reading"]) for p in parts if p.get("reading")], [("行", "い"), ("前", "まえ")])
