import unittest

from content.grammar_points_data import (
    GRAMMAR_POINTS_BY_LEVEL,
    get_grammar_points,
    grammar_to_id,
)

LEVELS = ["N5", "N4", "N3", "N2", "N1"]
PER_LEVEL = 41
FIELDS = {"pattern", "structure", "meaning"}


def _norm(s: str) -> str:
    """Deliberately lenient: collapses whitespace, lowercases and drops a
    trailing period, so near-verbatim reuse is caught, not just exact."""
    return " ".join(s.split()).strip().lower().rstrip(".")


def _all_entries():
    for level in LEVELS:
        for entry in GRAMMAR_POINTS_BY_LEVEL[level]:
            yield level, entry


class GrammarPointsShapeTests(unittest.TestCase):
    def test_every_level_is_present_and_full(self) -> None:
        self.assertEqual(sorted(GRAMMAR_POINTS_BY_LEVEL), sorted(LEVELS))
        for level in LEVELS:
            self.assertEqual(
                len(GRAMMAR_POINTS_BY_LEVEL[level]), PER_LEVEL,
                f"{level} has {len(GRAMMAR_POINTS_BY_LEVEL[level])}, expected {PER_LEVEL}",
            )

    def test_meta_is_not_exposed_as_a_level(self) -> None:
        # grammar_points_data filters keys starting with "_". If that ever
        # breaks, "_meta" becomes a 205th "level" and the exam generator
        # iterates a string.
        self.assertNotIn("_meta", GRAMMAR_POINTS_BY_LEVEL)
        self.assertEqual(get_grammar_points("_meta"), [])

    def test_entries_carry_exactly_the_three_fields(self) -> None:
        for level, entry in _all_entries():
            self.assertEqual(
                set(entry), FIELDS,
                f"{level} {entry.get('pattern')!r} has fields {sorted(entry)}",
            )

    def test_no_field_is_blank_or_padded(self) -> None:
        for level, entry in _all_entries():
            for field in FIELDS:
                value = entry[field]
                self.assertIsInstance(value, str)
                self.assertTrue(value, f"{level} {entry['pattern']!r}: {field} is empty")
                self.assertEqual(
                    value, value.strip(),
                    f"{level} {entry['pattern']!r}: {field} has surrounding whitespace",
                )

    def test_patterns_are_unique_across_every_level(self) -> None:
        # A pattern in two levels would produce two different card ids for
        # the same point (grammar_{level}_{pattern}) and let a learner
        # "master" it twice, once per level.
        seen: dict[str, str] = {}
        for level, entry in _all_entries():
            pattern = entry["pattern"]
            self.assertNotIn(
                pattern, seen,
                f"{pattern!r} appears in both {seen.get(pattern)} and {level}",
            )
            seen[pattern] = level

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


class GrammarPointsProvenanceTests(unittest.TestCase):
    """
    content/grammar_data.py is scraped from jlptsensei.com and every entry
    in it carries a detail_url back to the page it came from. This
    catalogue is an independent curation that must stay that way: which
    patterns exist and roughly where they are taught are facts about the
    language, but the *wording* of a gloss or an attachment rule is
    someone's expression of it.

    So pattern names are allowed to coincide -- they name the same real
    thing -- while structure and meaning must not, verbatim or near-so.
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
        }

    def test_the_scraped_corpus_actually_loaded(self) -> None:
        # Guards against the disjointness test below passing vacuously
        # because the import silently yielded nothing to compare against.
        self.assertGreater(len(self.scraped), 300)

    def test_no_structure_or_meaning_is_reused_verbatim(self) -> None:
        collisions = [
            (level, entry["pattern"], field, entry[field])
            for level, entry in _all_entries()
            for field in ("structure", "meaning")
            if _norm(entry[field]) in self.scraped
        ]
        self.assertEqual(
            collisions, [],
            "these strings appear verbatim in the scraped grammar_data.py "
            f"and must be rewritten: {collisions}",
        )


class GrammarIdTests(unittest.TestCase):
    """
    grammar_to_id used to live in the scraped grammar_data.py, where it
    read entry['grammar'] -- the field name that file happens to use.
    This catalogue names that field 'pattern', so the function moved here
    with the data it formats. Every grammar card id changes as a result,
    which is one of the two reasons the SRS wipe is required.
    """

    def test_id_is_level_scoped_and_uses_the_pattern_field(self) -> None:
        entry = {"pattern": "〜そうだ（伝聞）", "structure": "x", "meaning": "y"}
        self.assertEqual(grammar_to_id(entry, "N3"), "grammar_N3_〜そうだ（伝聞）")

    def test_every_catalogue_entry_yields_a_unique_id(self) -> None:
        ids = [
            grammar_to_id(entry, level)
            for level, entry in _all_entries()
        ]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(len(ids), len(LEVELS) * PER_LEVEL)

    def test_mixing_the_two_catalogues_fails_loudly(self) -> None:
        # There are two grammar_to_id functions during the transition: this
        # one, and the scraped grammar_data.py's, which reads its own
        # 'grammar' field. routes/{grammar,stats,decks}.py still import
        # that one, because moving them onto this catalogue changes every
        # grammar card id and so has to land with the SRS wipe, not before.
        #
        # grammar_data.py cannot simply be edited to remove its copy:
        # scripts/scrape.py regenerates the whole file including that
        # function. So the two coexist, and the thing to guarantee is that
        # handing one an entry from the other raises instead of quietly
        # producing an id like "grammar_N3_None" that would look valid,
        # write a real card_modes row, and never match anything again.
        with self.assertRaises(KeyError):
            grammar_to_id({"grammar": "〜わけだ"}, "N3")

    def test_no_id_contains_the_card_id_separator(self) -> None:
        # core.auth prefixes card ids as "{user_id}:{raw_id}" and splits on
        # the first ":", so a ":" inside a pattern would be absorbed
        # silently rather than breaking loudly.
        for level, entry in _all_entries():
            self.assertNotIn(":", grammar_to_id(entry, level))


if __name__ == "__main__":
    unittest.main()
