"""
study/grammar_check.py is what stands between a lesson in the catalogue
and a learner who cannot tell it is wrong. Each rule is exercised with an
entry crafted to break it, so the gate cannot quietly stop checking
something (plan 087).
"""
import unittest

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, RICH_LEVELS
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
        # ... unless the detector finds it once in the sentence (plan 190):
        # the を of パンを食べます, but not one of two
        wo = next(e for e in GRAMMAR_POINTS_BY_LEVEL["N5"] if e["pattern"] == "を")
        once = {**wo, "examples": [{**wo["examples"][0], "contrast": True}] + wo["examples"][1:]}
        self.assertFalse(any("cannot be blanked" in p for p in check_entry("N5", once)))
        twice = {**wo, "examples": [{"jp": "パンを食べて、水を飲みます。", "en": "I eat bread and drink water.",
                                     "fr": "Je mange du pain et je bois de l'eau.", "contrast": True}]
                 + wo["examples"][1:]}
        self.assertTrue(any("cannot be blanked" in p for p in check_entry("N5", twice)))

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


# ── The tour's authored block (plan 187c) ──────────────────────────

def _tour(**over) -> dict:
    """The tour drawn on the canvas for 〜てください: the negative request
    as its twist (plan 189: the first of a list, named by its notion), a
    ticket window as the scene."""
    tour = {
        "twists": [{
            "notion": {"en": "Asking not to", "fr": "Demander de ne pas faire"},
            "jp": "ここでたばこをすわないでください。",
            "ask": {"en": "What is being asked?", "fr": "Que demande-t-on ?"},
            "choices": [
                {"en": "Not to smoke here, please.", "fr": "De ne pas fumer ici, s'il vous plaît."},
                {"en": "To smoke here, please.", "fr": "De fumer ici, s'il vous plaît."},
                {"en": "Whether one may smoke here.", "fr": "Si l'on peut fumer ici."},
            ],
            "why": {"en": "The ない-form and でください ask someone not to.", "fr": "La forme en ない et でください demandent de ne pas faire."},
            "pair": ["すってください", "すわないでください"],
        }],
        "scene": {
            "place": "窓口",
            "them": {"en": "Clerk", "fr": "Agent"},
            "lines": [
                {"who": "them", "jp": "いらっしゃいませ。", "en": "Good morning.", "fr": "Bonjour."},
                {"who": "them", "jp": "ここに名前を書いてください。", "en": "Please write your name here.", "fr": "Écrivez votre nom ici, s'il vous plaît."},
            ],
            "note": {"en": "A thing: をください. An action: てください.", "fr": "Une chose : をください. Une action : てください."},
            "ask": {
                "cue": {"who": "them", "jp": "三ばんせんです。", "en": "Platform three.", "fr": "Quai numéro trois."},
                "task": {"en": "You didn't hear. Ask him to say it again.", "fr": "Tu n'as pas entendu. Demande-lui de répéter."},
                "choices": ["もういちど言ってください。", "もういちど言わないでください。", "もういちど言いました。"],
                "why": {"en": "An action, asked politely: 言って and ください.", "fr": "Une action, demandée poliment : 言って et ください."},
            },
        },
    }
    for path, value in over.items():
        *keys, last = path.split(".")
        node = tour
        for key in keys:
            node = node[int(key)] if key.isdigit() else node[key]
        if value is DROP:
            del node[last]
        elif last.isdigit():
            node[int(last)] = value
        else:
            node[last] = value
    return tour


DROP = object()


class TourRuleTests(unittest.TestCase):
    def _problems(self, **over):
        entry = _good(tour=_tour(**over))
        return check_entry("N5", entry, _catalogue("N5", entry))

    def _says(self, fragment, **over):
        found = self._problems(**over)
        self.assertTrue(any(fragment in p for p in found), f"{fragment!r} not in {found}")

    def test_the_canvas_tour_is_clean(self) -> None:
        self.assertEqual(self._problems(), [])

    def test_a_tour_is_both_halves(self) -> None:
        self._says("tour must be {twists, scene}", scene=DROP)

    def test_the_twist(self) -> None:
        self._says("has 1 choices, needs 3", **{"twists.0.choices": [{"en": "Only one choice.", "fr": "Un seul choix."}]})
        self._says("twist 0 pair must be two Japanese forms", **{"twists.0.pair": ["smoke", "no smoke"]})
        self._says("twist 0 jp does not end in", **{"twists.0.jp": "ここでたばこをすわないでください"})
        self._says("twist 0 choices repeat", **{"twists.0.choices.2": {"en": "To smoke here, please.", "fr": "Fumer ici."}})

    def test_every_twist_names_its_notion(self) -> None:
        """Plan 189: a twist per notion, each named, none twice."""
        self._says("twist 0 must be {notion, jp, ask, choices, why[, pair]}", **{"twists.0.notion": DROP})
        self._says("twist 0 notion.fr is", **{"twists.0.notion": {"en": "Asking not to", "fr": "x" * 41}})
        one = _tour()["twists"][0]
        self._says("tour has 0 twists, needs 1–6", twists=[])
        self._says("tour has 7 twists, needs 1–6", twists=[dict(one, jp=f"{n}ばんでたばこをすわないでください。", notion={"en": f"Notion {n}", "fr": f"Notion {n}"}) for n in range(7)])
        self._says("tour twists repeat a sentence", twists=[one, dict(one, notion={"en": "Another notion", "fr": "Une autre notion"})])
        self._says("tour twists repeat a notion", twists=[one, dict(one, jp="ここでたべないでください。")])
        self.assertEqual(self._problems(twists=[one, dict(one, jp="ここでたべないでください。", notion={"en": "Not eating", "fr": "Ne pas manger"})]), [])

    def test_the_place_is_a_station_place(self) -> None:
        self._says("place 'カフェ' not in", **{"scene.place": "カフェ"})

    def test_the_lines(self) -> None:
        self._says("has 1 lines, needs 2–5", **{"scene.lines": [_tour()["scene"]["lines"][0]]})
        self._says("who 'clerk' not in", **{"scene.lines.0.who": "clerk"})
        self._says("uses kanji above N5: 京", **{"scene.lines.0.jp": "東京までのきっぷをください。"})
        self._says("en contains Japanese", **{"scene.lines.0.en": "Irasshaimase いらっしゃい."})
        self._says("them: fr is a copy of en", **{"scene.them": {"en": "Agent", "fr": "Agent"}})

    def test_the_scene_writes_the_point(self) -> None:
        self._says("no line writes the point", **{
            "scene.lines.1": {"who": "me", "jp": "とうきょうまでです。", "en": "To Tokyo.", "fr": "Pour Tokyo."},
        })

    def test_the_answer_writes_the_point_and_no_wrong_answer_does(self) -> None:
        self._says("does not write the point", **{
            "scene.ask.choices": ["もういちど言いました。", "もういちど言わないでください。", "もういちど言いません。"],
        })
        self._says("writes the point too", **{
            "scene.ask.choices": ["もういちど言ってください。", "ゆっくり話してください。", "もういちど言いました。"],
        })

    def test_a_point_of_alternatives_may_be_answered_wrong_with_another(self) -> None:
        # 〜つ／〜人／〜枚 is learned by choosing among its own counters: its
        # wrong answers are written with another of them, and that is allowed.
        from content.grammar_points_data import find
        from study.grammar_check import _carries
        level, entry = find("助数詞 〜つ／〜人／〜枚")
        wrong = entry["tour"]["scene"]["ask"]["choices"][1:]
        self.assertTrue(all(_carries(jp, entry["pattern"], level) is not False for jp in wrong))
        self.assertEqual(check_entry(level, entry), [])
