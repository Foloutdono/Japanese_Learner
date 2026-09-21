"""The vocab deck's measurements, held where the review left them.

docs/vocab-deck-review.md (plans 102-110) opens with figures measured
by scripts/audit_vocab_deck.py and plans seven changes against them.
Each plan lowers some of them; nothing should raise any. So the figures
that are already zero are held at zero, and the rest are ratchets --
"no more than the review found" -- lowered by hand as each plan lands,
the way frontend/README.md's design-conformance baselines are.

The deck half needs nothing installed beyond the repo. The corpus half
needs the tokenizer, which CI installs (requirements.txt); it is
skipped, not failed, where it is missing, since a report that cannot
measure says so itself.
"""
import unittest

from scripts import audit_vocab_deck as audit
from study import morphology


class DeckMeasurementTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.report = audit.measure(skip_corpus=True)

    def test_every_deck_key_is_in_the_frequency_order_and_nothing_stale(self) -> None:
        """A key left out of vocab_frequency.json is a card no 頻度 tier
        can reach; a key left in after its card went is a tier slot
        that resolves to nothing. Plan 102 inserted its two beside their
        honorifics; an addition that forgets to lands here."""
        f = self.report["frequency"]
        self.assertEqual(f["missing_from_order"], [])
        self.assertEqual(f["stale_in_order"], [])

    def test_no_kana_field_uses_the_separator_the_lookup_splits_on(self) -> None:
        """card_lookup._reading_variants splits on ';' and the deck joins
        with '/' (18 entries) -- the mismatch vocab_data.py's docstring
        flags. Plan 104 settles it on '/'; until then no entry may
        introduce the third convention."""
        self.assertEqual(self.report["readings"]["semicolon_fields"], [])

    def test_no_gloss_is_empty(self) -> None:
        self.assertEqual(self.report["glosses"]["empty"], [])

    def test_a_gloss_separates_its_senses_with_a_comma_and_a_space(self) -> None:
        """Plan 108: 2,629 glosses read "to fly,to hop", the spreadsheet's
        own comma; all of them are ", " now, and a new entry follows."""
        self.assertEqual(self.report["glosses"]["unspaced_commas"], 0)

    def test_every_card_has_french_and_none_borrows_another_senses(self) -> None:
        """Plan 107: a card reads its own French line, or the form's when
        every card of that form means the same thing. 38 had none and
        334 read another sense's; both lists are empty and stay so."""
        self.assertEqual(self.report["glosses"]["no_french"], [])
        self.assertEqual(self.report["glosses"]["shared_french"], [])

    def test_ratchets_never_rise(self) -> None:
        """The review's figures (2026-09-21). Lower a bound when the plan
        that lowers the figure lands; never raise one."""
        r = self.report
        # A "/" reading field is the deck's convention since plan 104
        # settled the splitter on it (十 joined its two with a space
        # until 106), so it is measured but not bounded.
        # 26 exact pairs: 108's mojibake fix made the N2 対立 the same
        # (form, reading) as the N1 one -- 106b's list, one longer.
        bounds = {}
        for (section, key), bound in bounds.items():
            with self.subTest(figure=f"{section}.{key}"):
                self.assertLessEqual(r[section][key], bound)

    def test_no_word_is_served_at_two_levels(self) -> None:
        """Plan 106b: 26 (form, reading) pairs sat at two levels and a
        learner met each once more as "new". One card each now, at the
        lower level; a new pair lands here."""
        self.assertEqual(self.report["duplicates"]["exact_pairs"], [])

    def test_every_focus_word_resolves_to_a_card(self) -> None:
        """A curated sentence is chosen to practise its focus word, and a
        focus word with no card schedules nothing (routes/reading.py).
        Eleven could not until plan 105 gave them cards; a new sentence
        whose focus word the deck lacks lands here."""
        self.assertEqual(self.report["focus"]["unresolved"], [])

    def test_the_report_renders_without_the_corpus(self) -> None:
        text = audit.render(self.report)
        self.assertIn("The deck", text)
        self.assertIn("The curated focus words", text)
        self.assertNotIn("The taught sentences", text)


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "fugashi/unidic-lite not installed")
class CorpusMeasurementTests(unittest.TestCase):
    """The partition is the point: a present card the lookups miss must
    never be counted as a deck gap, or plan 105 adds a second パン."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.corpus = audit.corpus(audit.taught_sentences())

    def _kind_of(self, lemma: str) -> str | None:
        for kind in ("katakana", "adverb", "gated", "name", "numeral", "absent"):
            if any(item["lemma"] == lemma for item in self.corpus[kind]):
                return kind
        return None

    def test_the_lookups_plan_104_repaired_leave_nothing_behind(self) -> None:
        """パン was "katakana", もう "adverb" and 出来る "gated" until plan
        104; each now resolves and is no kind at all. The two kinds it
        emptied stay empty -- a katakana word or an adverb that the deck
        holds and the screen misses is a regression here, not a gap."""
        for lemma in ("パン", "もう", "出来る"):
            with self.subTest(lemma=lemma):
                self.assertIsNone(self._kind_of(lemma))
        self.assertEqual(self.corpus["katakana"], [])
        self.assertEqual(self.corpus["adverb"], [])
        # A token behind a conjunctive て/で is the point's and is not
        # measured at all (plan 106); what is left for the gate to refuse
        # is a reading ambiguous at its best level, and none is today.
        self.assertEqual(self.corpus["gated"], [])

    def test_a_name_is_not_a_gap(self) -> None:
        self.assertEqual(self._kind_of("タナカ"), "name")

    def test_a_word_no_deck_holds_is_a_gap(self) -> None:
        # 限り, the 〜限り points' own word, is an N3/N1 gap left for the
        # next slice of plan 105; 無い was the top of this list (210
        # occurrences) until that plan gave it an N5 card.
        self.assertEqual(self._kind_of("限り"), "absent")
        self.assertIsNone(self._kind_of("無い"))

    def test_grammar_and_numerals_are_not_gaps(self) -> None:
        # ございます is the polite copula, かもしれない a catalogue point,
        # and 三十 composes from the digit cards: none is a card to add.
        self.assertIsNone(self._kind_of("御座る"))
        self.assertIsNone(self._kind_of("知れる"))
        self.assertEqual(self._kind_of("三十"), "numeral")

    def test_the_words_plan_102_added_are_no_longer_gaps(self) -> None:
        self.assertIsNone(self._kind_of("母"))
        self.assertIsNone(self._kind_of("父"))

    def test_ratchets_never_rise(self) -> None:
        c = self.corpus
        self.assertLessEqual(c["kinds"]["absent"]["lemmas"], 153)
        self.assertLessEqual(c["unmatched_lemmas"], 166)
