import unittest

from study.structures import (
    ALL_KEYS,
    STRUCTURES,
    describe,
    missing_required,
    normalise,
    structure_for,
    usable_sentences,
)
from study.modes import GRADED_FOR_SOURCE, SOURCES


class StructureSpecTests(unittest.TestCase):
    """
    A deck holds one structure, and a personal card written into it takes
    that shape. This is the single definition both the API and the
    generated add-card form read, so what it says has to stay true.
    """

    def test_every_structure_names_a_real_registry_source(self) -> None:
        # The whole point of a structure is that its cards study under
        # that source's modes. A source the registry does not know would
        # produce a deck offering nothing.
        for key, spec in STRUCTURES.items():
            self.assertIn(spec.source, SOURCES, key)
            self.assertTrue(GRADED_FOR_SOURCE[spec.source], key)

    def test_front_and_back_name_real_fields(self) -> None:
        # The card builder derives front/back from these, so a typo would
        # render an empty card rather than erroring.
        for key, spec in STRUCTURES.items():
            names = {f.key for f in spec.fields}
            self.assertIn(spec.front_key, names, key)
            self.assertIn(spec.back_key, names, key)

    def test_the_spec_matches_the_users_stated_shapes(self) -> None:
        required = {
            k: sorted(f.key for f in s.fields if f.required)
            for k, s in STRUCTURES.items()
        }
        self.assertEqual(required["standard"], ["back", "front"])
        self.assertEqual(required["kanji"], ["kanji", "meaning", "radical", "readings"])
        self.assertEqual(required["vocab"], ["meaning", "word"])
        self.assertEqual(required["grammar"], ["meaning", "rule"])
        # Optional by design: a kana-only word is its own reading, and a
        # grammar point is still a card without example sentences.
        self.assertFalse(next(f for f in STRUCTURES["vocab"].fields if f.key == "reading").required)
        self.assertFalse(next(f for f in STRUCTURES["grammar"].fields if f.key == "sentences").required)

    def test_hint_is_gone_everywhere(self) -> None:
        # `hint` was shown DURING a quiz, which makes it help the learner
        # never asked for -- the thing HintBar exists to make opt-in.
        for key, spec in STRUCTURES.items():
            self.assertNotIn("hint", {f.key for f in spec.fields}, key)


class NormaliseTests(unittest.TestCase):
    def test_unknown_keys_are_dropped(self) -> None:
        # A card is read back by the same spec that wrote it, so an extra
        # key would be storage nobody ever renders.
        out = normalise("standard", {"front": "a", "back": "b", "sneaky": "x"})
        self.assertEqual(sorted(out), ["back", "front"])

    def test_text_is_trimmed(self) -> None:
        self.assertEqual(normalise("standard", {"front": "  a  ", "back": "b"})["front"], "a")

    def test_lines_accept_a_list_or_a_single_value(self) -> None:
        spec = {"rule": "x", "meaning": "y"}
        self.assertEqual(normalise("grammar", {**spec, "sentences": ["a", " ", "b"]})["sentences"], ["a", "b"])
        self.assertEqual(normalise("grammar", {**spec, "sentences": "a"})["sentences"], ["a"])
        self.assertEqual(normalise("grammar", spec)["sentences"], [])

    def test_a_number_that_is_not_one_becomes_none(self) -> None:
        # Rather than raising: missing_required reports it as missing,
        # which is the message the learner can act on.
        self.assertIsNone(normalise("kanji", {"radical": "not a number"})["radical"])
        self.assertEqual(normalise("kanji", {"radical": "173"})["radical"], 173)

    def test_an_unknown_structure_falls_back_to_standard(self) -> None:
        self.assertEqual(structure_for("nonsense").key, "standard")


class MissingRequiredTests(unittest.TestCase):
    def test_reports_every_missing_field(self) -> None:
        got = missing_required("kanji", normalise("kanji", {"kanji": "雨"}))
        self.assertEqual(sorted(got), ["meaning", "radical", "readings"])

    def test_a_complete_card_is_valid(self) -> None:
        fields = normalise("kanji", {
            "kanji": "雨", "meaning": "rain", "readings": "ウ・あめ", "radical": 173,
        })
        self.assertEqual(missing_required("kanji", fields), [])

    def test_radical_zero_is_not_treated_as_missing(self) -> None:
        # There is no radical 0, but a falsy-but-present number must not be
        # mistaken for absence -- that class of bug outlives the data.
        self.assertEqual(missing_required("kanji", {
            "kanji": "x", "meaning": "y", "readings": "z", "radical": 0,
        }), [])


class UsableSentenceTests(unittest.TestCase):
    """
    fill_in shows a sentence and asks which rule is at work. A sentence
    that does not contain its own rule makes that unanswerable, so the
    card is excluded rather than served a question with no answer.
    """

    def test_a_sentence_containing_its_rule_is_usable(self) -> None:
        self.assertEqual(
            usable_sentences({"rule": "〜せいで", "sentences": ["雨のせいで中止になった。"]}),
            ["雨のせいで中止になった。"],
        )

    def test_a_sentence_without_its_rule_is_not(self) -> None:
        self.assertEqual(
            usable_sentences({"rule": "〜わけだ", "sentences": ["今日は暑いです。"]}), [],
        )

    def test_an_unverifiable_rule_yields_nothing(self) -> None:
        # A bare particle occurs in almost every sentence, so "does this
        # sentence show を?" has no honest answer. grammar_match.verifiable
        # already draws that line.
        self.assertEqual(usable_sentences({"rule": "を", "sentences": ["パンを食べます。"]}), [])

    def test_no_sentences_is_not_an_error(self) -> None:
        self.assertEqual(usable_sentences({"rule": "〜せいで"}), [])


class DescribeTests(unittest.TestCase):
    def test_describe_covers_every_structure(self) -> None:
        # The add-card form is generated from this, so a structure missing
        # here is one nobody can write a card for.
        described = {s["key"] for s in describe()}
        self.assertEqual(described, set(ALL_KEYS))

    def test_describe_is_json_safe(self) -> None:
        import json
        json.dumps(describe())

    def test_every_described_field_carries_what_a_form_needs(self) -> None:
        for s in describe():
            for f in s["fields"]:
                self.assertIn("key", f)
                self.assertIn(f["kind"], ("text", "number", "lines"), f)
                self.assertIsInstance(f["required"], bool)


if __name__ == "__main__":
    unittest.main()
