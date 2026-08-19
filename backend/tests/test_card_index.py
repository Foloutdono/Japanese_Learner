import ast
import re
import unittest
from pathlib import Path

from study import card_index
from study.card_lookup import card_stats
from study.modes import (
    KANA, KANJI, VOCAB, GRAMMAR, GRADED_FOR_SOURCE, SRS_MODES,
)

BACKEND = Path(__file__).resolve().parents[1]
SECTIONS = (KANA, VOCAB, KANJI, GRAMMAR)


class CardIndexParityTests(unittest.TestCase):
    """
    card_modes.mode is a bare string. Anything that reports on progress
    has to map that string back to a section, and if its idea of the key
    space drifts from the registry's, the lookup misses on EVERY row and
    the failure is silent -- the screen renders, the numbers are just all
    zero.

    That is exactly what shipped: routes/stats.py kept a private index
    keyed on study/quiz_modes.py's retired strings ("qcm-kj-m",
    "flashcard", "write") while every writer had moved to study/modes.py's
    ("kanji.flashcard.f2b"). Nothing failed, nothing logged; /api/stats
    just reported an untouched deck forever, and the dictionary's "known"
    badges and reading.py's known-word filter went with it.

    These tests are the thing that makes "the index is built from the
    registry" checkable rather than a claim in a docstring.
    """

    def test_every_indexed_mode_is_a_mode_the_srs_writes(self) -> None:
        indexed = {mode for _, mode in card_index._INDEX}
        self.assertTrue(
            indexed <= SRS_MODES,
            f"indexed under keys nothing writes: {sorted(indexed - SRS_MODES)}",
        )

    def test_every_graded_mode_of_every_section_is_indexed(self) -> None:
        indexed = {mode for _, mode in card_index._INDEX}
        for source in SECTIONS:
            for mode in GRADED_FOR_SOURCE[source]:
                with self.subTest(mode=mode):
                    self.assertIn(
                        mode, indexed,
                        f"{mode} indexes no card, so every review of it "
                        f"would be dropped from /api/stats",
                    )

    def test_every_section_has_decks_and_every_deck_has_cards(self) -> None:
        for source in SECTIONS:
            keys = card_index.deck_keys(source)
            self.assertTrue(keys, f"{source} has no decks")
            for deck_key in keys:
                for mode in GRADED_FOR_SOURCE[source]:
                    with self.subTest(source=source, deck=deck_key, mode=mode):
                        self.assertGreater(
                            card_index.total(source, deck_key, mode), 0,
                            "a mode that can serve nothing would render as a "
                            "0/0 bar rather than being hidden",
                        )

    def test_locate_round_trips_a_real_card(self) -> None:
        for source in SECTIONS:
            deck_key = card_index.deck_keys(source)[0]
            for mode in sorted(GRADED_FOR_SOURCE[source]):
                raw_id = card_index.raw_ids(source, deck_key, mode)[0]
                with self.subTest(mode=mode, raw_id=raw_id):
                    self.assertEqual(
                        card_index.locate(raw_id, mode), (source, deck_key),
                    )

    def test_an_unknown_id_or_mode_locates_to_nothing(self) -> None:
        # Personal cards (custom_...) and retired keys must both come back
        # None so callers can skip them, never raise or mis-attribute.
        self.assertIsNone(card_index.locate("custom_12_34", "kanji.flashcard.f2b"))
        self.assertIsNone(card_index.locate("kanji_N5_人", "qcm-kj-m"))


class ReachableTotalTests(unittest.TestCase):
    """
    Three modes draw from only part of their source's deck. If the totals
    are not filtered the same way the card pool is, the mastery bar's
    denominator counts cards the mode can never serve and 100% becomes
    unreachable -- which reads as a learner who has stalled just short.
    """

    def test_word_reading_excludes_kana_only_vocab(self) -> None:
        for level in card_index.deck_keys(VOCAB):
            with self.subTest(level=level):
                self.assertLess(
                    card_index.total(VOCAB, level, "vocab.word_reading"),
                    card_index.total(VOCAB, level, "vocab.flashcard.f2b"),
                )

    def test_fill_in_excludes_points_no_sentence_can_pin(self) -> None:
        # Per level this is <=, not <: N2's points are all multi-character
        # and all have sentences, so every one of them is fill-able. The
        # filter still has to bite SOMEWHERE, or it is not running at all
        # -- hence the strict comparison on the total.
        fill = flash = 0
        for level in card_index.deck_keys(GRAMMAR):
            a = card_index.total(GRAMMAR, level, "grammar.fill_in")
            b = card_index.total(GRAMMAR, level, "grammar.flashcard.f2b")
            with self.subTest(level=level):
                self.assertLessEqual(a, b)
            fill += a
            flash += b
        self.assertLess(fill, flash)

    def test_the_reachable_ids_are_exactly_as_many_as_the_total(self) -> None:
        for source in SECTIONS:
            for deck_key in card_index.deck_keys(source):
                for mode in GRADED_FOR_SOURCE[source]:
                    with self.subTest(source=source, deck=deck_key, mode=mode):
                        self.assertEqual(
                            len(card_index.raw_ids(source, deck_key, mode)),
                            card_index.total(source, deck_key, mode),
                        )


class LegacyRegistryTests(unittest.TestCase):
    def test_the_retired_registry_is_gone(self) -> None:
        self.assertFalse(
            (BACKEND / "study" / "quiz_modes.py").exists(),
            "study/quiz_modes.py is back; it is the second key space that "
            "made /api/stats silently empty",
        )

    def test_nothing_imports_the_retired_registry(self) -> None:
        offenders = []
        for path in BACKEND.rglob("*.py"):
            if "__pycache__" in path.parts or path.name == "test_card_index.py":
                continue
            src = path.read_text(encoding="utf-8")
            if re.search(r"^\s*(from|import)\s+study\.quiz_modes", src, re.MULTILINE):
                offenders.append(str(path.relative_to(BACKEND)))
        self.assertEqual(offenders, [])

    # Distinctive enough to search for, and any surviving USE of one is a
    # lookup that silently matches nothing.
    RETIRED = {"qcm-kj-m", "qcm-m-kj", "flashcard-kj-m", "flashcard-m-kj"}

    def test_no_module_still_uses_a_retired_mode_string(self) -> None:
        """Parsed rather than grepped, so the several files that
        legitimately NAME the retired keys while explaining why they were
        retired -- this module's own docstrings, modes.py's, the wipe
        script's -- are not mistaken for code that still uses one."""
        offenders = []
        for path in BACKEND.rglob("*.py"):
            if "__pycache__" in path.parts or path.name.startswith("test_"):
                continue
            tree = ast.parse(path.read_text(encoding="utf-8"))

            docstrings = set()
            for node in ast.walk(tree):
                if isinstance(node, (ast.Module, ast.ClassDef,
                                     ast.FunctionDef, ast.AsyncFunctionDef)):
                    body = getattr(node, "body", None)
                    if (body and isinstance(body[0], ast.Expr)
                            and isinstance(body[0].value, ast.Constant)
                            and isinstance(body[0].value.value, str)):
                        docstrings.add(id(body[0].value))

            for node in ast.walk(tree):
                if (isinstance(node, ast.Constant) and isinstance(node.value, str)
                        and id(node) not in docstrings
                        and node.value in self.RETIRED):
                    offenders.append(
                        f"{path.relative_to(BACKEND)}:{node.lineno}: {node.value}"
                    )
        self.assertEqual(offenders, [])


class CardStatsMergeTests(unittest.TestCase):
    """
    "Do I know this word" is asked across every graded mode of its source
    now, because the single canonical mode it used to ask about
    ("qcm-kj-m") no longer exists. The merge rules are not symmetric --
    due is an any, next_review is a min, interval is a max -- so they are
    pinned here rather than left to read like an implementation detail.
    """

    USER = "u1"
    RAW = "vocab_N5_水_みず"

    def _states(self, **by_mode):
        return {(f"{self.USER}:{self.RAW}", mode): item for mode, item in by_mode.items()}

    def _item(self, state, total, correct, due, interval, nxt):
        return {
            "state": state, "total_reviews": total, "correct_reviews": correct,
            "due": due, "interval_days": interval, "next_review": nxt,
        }

    def test_nothing_studied_reads_as_not_started(self) -> None:
        got = card_stats({}, self.USER, self.RAW, ("vocab.flashcard.f2b",))
        self.assertEqual(got["status"], "not_started")
        self.assertIsNone(got["accuracy"])
        self.assertFalse(got["due"])

    def test_the_best_stage_across_modes_wins(self) -> None:
        states = self._states(
            **{
                "vocab.flashcard.f2b": self._item("learning", 4, 2, False, 1, "2026-01-02"),
                "vocab.flashcard.b2f": self._item("mastered", 6, 6, False, 30, "2026-02-01"),
            }
        )
        got = card_stats(states, self.USER, self.RAW,
                         ("vocab.flashcard.f2b", "vocab.flashcard.b2f"))
        self.assertEqual(got["status"], "mastered")

    def test_accuracy_comes_from_summed_counts_not_averaged_percentages(self) -> None:
        # 1/1 = 100% and 1/9 = 11%. Averaging the percentages gives ~56%;
        # the honest answer over 10 reviews is 20%.
        states = self._states(
            **{
                "vocab.flashcard.f2b": self._item("learning", 1, 1, False, 1, "2026-01-02"),
                "vocab.flashcard.b2f": self._item("learning", 9, 1, False, 1, "2026-01-03"),
            }
        )
        got = card_stats(states, self.USER, self.RAW,
                         ("vocab.flashcard.f2b", "vocab.flashcard.b2f"))
        self.assertEqual(got["total_reviews"], 10)
        self.assertEqual(got["accuracy"], 20.0)

    def test_due_is_an_any_and_next_review_is_the_earliest(self) -> None:
        states = self._states(
            **{
                "vocab.flashcard.f2b": self._item("mastered", 8, 8, False, 30, "2026-03-01"),
                "vocab.word_reading":  self._item("learning", 2, 1, True, 1, "2026-01-05"),
            }
        )
        got = card_stats(states, self.USER, self.RAW,
                         ("vocab.flashcard.f2b", "vocab.word_reading"))
        self.assertTrue(got["due"], "a card due in ANY mode is due")
        self.assertEqual(got["next_review"], "2026-01-05")
        self.assertEqual(got["interval_days"], 30)

    def test_a_bare_string_is_still_accepted(self) -> None:
        states = self._states(
            **{"vocab.flashcard.f2b": self._item("learning", 3, 2, False, 1, "2026-01-02")}
        )
        got = card_stats(states, self.USER, self.RAW, "vocab.flashcard.f2b")
        self.assertEqual(got["status"], "learning")
        self.assertEqual(got["total_reviews"], 3)


if __name__ == "__main__":
    unittest.main()
