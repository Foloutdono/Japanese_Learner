import json
import unittest
from pathlib import Path

from content.grammar.renames import MOVES, RETIRED, pattern_renames
from content.grammar_points_data import (
    GRAMMAR_POINTS_BY_LEVEL,
    LEVELS,
    MIN_PER_LEVEL,
    all_ids,
    entry_by_id,
    find,
    get_grammar_points,
    gloss,
    grammar_to_id,
)
from study import grammar_check

# Every raw card id the catalogue served before plan 087 re-evaluated it.
# Dumped once, from the old loader, before the old files were deleted.
_IDS_BEFORE = Path(__file__).parent / "fixtures" / "grammar_ids_before_087.json"


def _norm(s: str) -> str:
    """Deliberately lenient: collapses whitespace, lowercases and drops a
    trailing period, so near-verbatim reuse is caught, not just exact."""
    return " ".join(s.split()).strip().lower().rstrip(".")


def _all_entries():
    for level in LEVELS:
        for entry in GRAMMAR_POINTS_BY_LEVEL[level]:
            yield level, entry


def _texts(entry: dict):
    """Every piece of prose an entry carries -- what the provenance test
    holds against the scraped corpus."""
    yield entry["structure"]
    for lang in ("en", "fr"):
        yield entry["meaning"][lang]
    for step in entry.get("steps", []):
        yield step["en"]
        yield step["fr"]
    for rival in entry.get("compare", []):
        yield rival["en"]
        yield rival["fr"]
    for ex in entry.get("examples", []):
        yield ex["en"]


class GrammarPointsShapeTests(unittest.TestCase):
    def test_every_level_is_present(self) -> None:
        self.assertEqual(sorted(GRAMMAR_POINTS_BY_LEVEL), sorted(LEVELS))

    def test_floors_and_monotonic(self) -> None:
        # A level with more to know lists more: the floors rise with the
        # level, and no level may be thinner than the one below it. The
        # old rule -- the same count at every level -- padded N5 with
        # conjugations filed as points and left N1 short of what is
        # examined (plan 087).
        counts = {level: len(GRAMMAR_POINTS_BY_LEVEL[level]) for level in LEVELS}
        for level in LEVELS:
            self.assertGreaterEqual(
                counts[level], MIN_PER_LEVEL[level],
                f"{level} has {counts[level]}, floor {MIN_PER_LEVEL[level]}",
            )
        ordered = [counts[level] for level in LEVELS]
        self.assertEqual(ordered, sorted(ordered), f"counts do not rise with the level: {counts}")

    def test_gate_is_clean(self) -> None:
        # The whole of content/grammar/README.md's contract, in one call:
        # shape, both languages, the sentence gate over every example, the
        # rivals resolving, the contrast marks meaning something.
        self.assertEqual(grammar_check.problems(), [])

    def test_get_grammar_points_answers_an_unknown_level_with_nothing(self) -> None:
        self.assertEqual(get_grammar_points("_meta"), [])
        self.assertEqual(get_grammar_points("N9"), [])

    def test_the_structure_names_its_own_pattern(self) -> None:
        # A structure describing a different pattern than the one it is
        # filed under is the kind of error nothing else here would catch,
        # and it would go straight into the exam generator's prompt as the
        # attachment rule for the wrong point.
        #
        # Two spellings both count as naming the pattern, because the
        # structures legitimately use both:
        #   1. the pattern's tail appears literally
        #      -- 〜に対して / "noun + に対して"
        #   2. the last "+" term is a tail of it, which is how a leading
        #      conjugation marker gets absorbed into the form's name
        #      -- 〜てください / "verb て-form + ください"
        # Entries whose structure is a whole-sentence schema rather than a
        # suffix rule (bare particles, the adjective classes, the
        # comparatives) name their pattern by construction; they are
        # listed rather than pattern-matched so that adding one is a
        # deliberate act.
        SCHEMA_SHAPED = {
            "は", "が", "を", "に", "で", "と", "も", "の", "へ", "や", "か", "ね", "よ",
            "です／だ", "から〜まで", "い形容詞／な形容詞", "〜くて／〜で",
            "〜くなる／〜になる", "〜より〜のほうが", "〜で〜がいちばん",
            "〜しか〜ない", "〜ば〜ほど", "自動詞／他動詞", "〜たり〜たり",
            "可能形 〜(ら)れる", "意向形 〜(よ)う", "受身形 〜られる", "使役形 〜させる",
            "使役受身形 〜させられる", "お〜になる／お〜する", "〜があります／います",
            "〜そうだ（伝聞）", "〜そうです",
        }
        for level, entry in _all_entries():
            pattern, structure = entry["pattern"], entry["structure"]
            if pattern in SCHEMA_SHAPED:
                continue
            tail = pattern.split("〜")[-1].split("／")[0].strip()
            last_term = structure.rsplit("+", 1)[-1].strip()
            named = tail in structure or any(
                tail.endswith(alt.strip())
                for alt in last_term.split("・")
                if alt.strip()
            )
            self.assertTrue(
                named,
                f"{level} {pattern!r}: structure {structure!r} never names "
                f"{tail!r}",
            )

    def test_gloss_falls_back_to_english(self) -> None:
        entry = {"pattern": "x", "meaning": {"en": "only english", "fr": ""}}
        self.assertEqual(gloss(entry, "fr"), "only english")
        self.assertEqual(gloss(entry, "en"), "only english")
        self.assertEqual(gloss({"pattern": "x", "meaning": "bare"}, "fr"), "bare")

    def test_find_and_entry_by_id_agree(self) -> None:
        for level, entry in _all_entries():
            self.assertEqual(find(entry["pattern"]), (level, entry))
            self.assertEqual(entry_by_id(grammar_to_id(entry, level)), (level, entry))
        self.assertIsNone(find("〜not a pattern"))
        self.assertIsNone(entry_by_id("grammar_N5_nope"))


class GrammarPointsProvenanceTests(unittest.TestCase):
    """
    content/grammar_data.py is scraped from jlptsensei.com and every entry
    in it carries a detail_url back to the page it came from. This
    catalogue is an independent curation that must stay that way: which
    patterns exist and roughly where they are taught are facts about the
    language, but the *wording* of a gloss, an attachment rule, a lesson
    or an example is someone's expression of it.

    So pattern names are allowed to coincide -- they name the same real
    thing -- while every piece of prose must not, verbatim or near-so.
    Without this test that boundary is a claim in a comment; with it, it
    fails the build.
    """

    @classmethod
    def setUpClass(cls) -> None:
        try:
            from content.grammar_data import GRAMMAR_BY_LEVEL
        except ImportError:  # pragma: no cover
            raise unittest.SkipTest("content/grammar_data.py not present")
        cls.scraped = {
            _norm(entry[field])
            for entries in GRAMMAR_BY_LEVEL.values()
            for entry in entries
            for field in ("meaning", "structure", "explanation")
            if entry.get(field)
        } | {
            _norm(ex[field])
            for entries in GRAMMAR_BY_LEVEL.values()
            for entry in entries
            for ex in entry.get("examples", [])
            for field in ("jp", "en")
            if ex.get(field)
        }

    def test_the_scraped_corpus_actually_loaded(self) -> None:
        # Guards against the disjointness test below passing vacuously
        # because the import silently yielded nothing to compare against.
        self.assertGreater(len(self.scraped), 300)

    def test_no_prose_is_reused_verbatim(self) -> None:
        collisions = [
            (level, entry["pattern"], text)
            for level, entry in _all_entries()
            for text in _texts(entry)
            if _norm(text) in self.scraped
        ]
        collisions += [
            (level, entry["pattern"], ex["jp"])
            for level, entry in _all_entries()
            for ex in entry.get("examples", [])
            if _norm(ex["jp"]) in self.scraped
        ]
        self.assertEqual(
            collisions, [],
            "these strings appear verbatim in the scraped grammar_data.py "
            f"and must be rewritten: {collisions}",
        )


class GrammarIdTests(unittest.TestCase):
    """
    grammar_to_id reads entry['pattern'] and scopes it by level. The
    pattern string is the learner's progress, which is why a revision of
    the catalogue keeps it verbatim for every point that survives -- see
    GrammarIdStabilityTests.
    """

    def test_id_is_level_scoped_and_uses_the_pattern_field(self) -> None:
        entry = {"pattern": "〜そうだ（伝聞）", "structure": "x", "meaning": {"en": "y", "fr": "y"}}
        self.assertEqual(grammar_to_id(entry, "N3"), "grammar_N3_〜そうだ（伝聞）")

    def test_every_catalogue_entry_yields_a_unique_id(self) -> None:
        ids = [grammar_to_id(entry, level) for level, entry in _all_entries()]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(set(ids), set(all_ids()))

    def test_mixing_the_two_catalogues_fails_loudly(self) -> None:
        # The scraped grammar_data.py names its field 'grammar'. Handing
        # one of its entries here must raise instead of quietly producing
        # an id like "grammar_N3_None" that would look valid, write a real
        # card_modes row, and never match anything again.
        with self.assertRaises(KeyError):
            grammar_to_id({"grammar": "〜わけだ"}, "N3")

    def test_no_id_contains_the_card_id_separator(self) -> None:
        # core.auth prefixes card ids as "{user_id}:{raw_id}" and splits on
        # the first ":", so a ":" inside a pattern would be absorbed
        # silently rather than breaking loudly.
        for level, entry in _all_entries():
            self.assertNotIn(":", grammar_to_id(entry, level))


class GrammarIdStabilityTests(unittest.TestCase):
    """
    A grammar card id embeds the pattern and the level, so re-evaluating
    the catalogue can orphan progress. Every id the catalogue served
    before plan 087 has exactly one fate: still served, moved (MOVES, and
    scripts/migrate_grammar_ids.py renames the rows), or retired
    (RETIRED, rows left and reported). A point cannot simply vanish.
    """

    @classmethod
    def setUpClass(cls) -> None:
        cls.before = set(json.loads(_IDS_BEFORE.read_text(encoding="utf-8")))
        cls.served = all_ids()

    def test_the_fixture_is_the_catalogue_that_shipped(self) -> None:
        self.assertEqual(len(self.before), 355)

    def test_every_old_id_has_a_fate(self) -> None:
        lost = sorted(
            raw for raw in self.before
            if raw not in self.served and raw not in MOVES and raw not in RETIRED
        )
        self.assertEqual(
            lost, [],
            "these ids are no longer served and content/grammar/renames.py "
            f"says nothing about them: {lost}",
        )

    def test_a_move_lands_on_a_served_id_in_one_hop(self) -> None:
        for old, new in MOVES.items():
            self.assertIn(new, self.served, f"{old} moves to {new}, which is not served")
            self.assertNotIn(new, MOVES, f"{old} -> {new} -> ... : moves do not chain")
            self.assertNotEqual(old, new)

    def test_a_moved_or_retired_id_is_not_also_served(self) -> None:
        self.assertEqual(sorted(set(MOVES) & self.served), [])
        self.assertEqual(sorted(RETIRED & self.served), [])
        self.assertEqual(sorted(set(MOVES) & RETIRED), [])

    def test_pattern_renames_follow_the_moves(self) -> None:
        for old_pattern, new_pattern in pattern_renames().items():
            self.assertNotEqual(old_pattern, new_pattern)
            self.assertIsNotNone(find(new_pattern))


if __name__ == "__main__":
    unittest.main()
