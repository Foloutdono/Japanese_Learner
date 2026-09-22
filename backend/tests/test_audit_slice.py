"""The content audit's rotation, held to the promises the playbook makes.

docs/content-audit/PLAYBOOK.md tells a twice-weekly session that the
slice is a pure function of the date, that the areas advance in
parallel, and that every entry in the banks is eventually audited. Those
are three properties of scripts/audit_slice.py, and a content wave that
renames a bank or adds a level can quietly break any of them -- a slice
that resolves to nothing produces a run that reports nothing, which
looks exactly like a clean run.

The script reads the content files with ast rather than importing them,
so this suite needs nothing installed beyond the repo itself.
"""
import datetime as dt
import os
import unittest

from scripts import audit_slice as audit


class RotationTests(unittest.TestCase):
    def test_every_slice_id_is_unique(self) -> None:
        """An id is how a finding names what it looked at, and how --slice
        reproduces a past run. Two slices answering to one id makes both."""
        ids = [s["id"] for area in audit.AREAS for s in audit.slices(area)]
        self.assertEqual(len(ids), len(set(ids)))

    def test_every_slice_resolves_and_holds_entries(self) -> None:
        for area in audit.AREAS:
            for candidate in audit.slices(area):
                with self.subTest(slice=candidate["id"]):
                    self.assertEqual(audit.find_slice(candidate["id"])["id"], candidate["id"])
                    self.assertGreater(len(audit.entries_of(candidate)), 0)

    def test_every_area_has_its_questions(self) -> None:
        for area in audit.AREAS:
            self.assertIn(area, audit.CHECKS)
            self.assertTrue(audit.CHECKS[area])

    def test_the_areas_advance_in_parallel(self) -> None:
        """Four runs cover the four areas, always. Grammar's backlog is
        a year long and vocab's is longer; walking them in sequence would
        mean the sentence banks were never looked at."""
        for start in (0, 1, 17, 200):
            areas = {audit.slice_for(start + n)["area"] for n in range(len(audit.AREAS))}
            self.assertEqual(areas, set(audit.AREAS))

    def test_a_full_pass_of_an_area_reaches_every_one_of_its_slices(self) -> None:
        for offset, area in enumerate(audit.AREAS):
            pool = audit.slices(area)
            seen = {audit.slice_for(offset + n * len(audit.AREAS))["id"] for n in range(len(pool))}
            with self.subTest(area=area):
                self.assertEqual(seen, {s["id"] for s in pool})


class CalendarTests(unittest.TestCase):
    def test_runs_fall_on_the_scheduled_weekdays(self) -> None:
        for index in range(60):
            self.assertIn(audit.run_date(index).weekday(), audit.RUN_WEEKDAYS)

    def test_run_index_inverts_run_date(self) -> None:
        for index in range(60):
            self.assertEqual(audit.run_index(audit.run_date(index)), index)

    def test_a_date_between_runs_describes_the_run_before_it(self) -> None:
        """Asking on a Wednesday should describe Tuesday's run rather than
        invent a run that never happened."""
        tuesday = audit.run_date(4)
        for days in range(1, 3):
            self.assertEqual(audit.run_index(tuesday + dt.timedelta(days=days)), 4)

    def test_a_date_before_the_first_run_is_the_first_run(self) -> None:
        self.assertEqual(audit.run_index(audit.ANCHOR - dt.timedelta(days=30)), 0)

    def test_the_slice_is_a_function_of_the_date_alone(self) -> None:
        """The playbook promises a run can be reproduced with --on, which
        is only true while nothing about the choice is stateful."""
        for index in (0, 5, 31):
            first, second = audit.slice_for(index), audit.slice_for(index)
            self.assertEqual(first["id"], second["id"])
            self.assertEqual(first["date"], audit.run_date(index).isoformat())


class VocabRankingTests(unittest.TestCase):
    """Vocab is the one bank too big to walk exhaustively, so the order
    IS the coverage: what sorts to the top is what gets audited at all."""

    def setUp(self) -> None:
        self.entries = audit.vocab_entries()

    def test_the_whole_deck_is_ranked(self) -> None:
        """Every card, not a floor under the count: the deck shrinks when
        a plan merges one word's cards (8,404 to 7,993 over plan 112), and
        a ranking that dropped cards would audit less than the deck serves."""
        deck = audit._json(os.path.join(audit._VOCAB, "vocab_deck.json"))
        self.assertEqual(len(self.entries), sum(len(cards) for cards in deck.values()))

    def test_risk_never_rises_down_the_list(self) -> None:
        risks = [entry["risk"] for entry in self.entries]
        self.assertEqual(risks, sorted(risks, reverse=True))

    def test_a_missing_cross_reference_is_free_for_a_kana_only_word(self) -> None:
        """curated_senses is keyed "kanji::kana", so a word with no kanji
        cannot be in it. Charging that absence to the word floated all of
        them above the real gloss disagreements."""
        for entry in self.entries:
            if "kana_only" in entry["flags"] and "no_jmdict_senses" in entry["flags"]:
                with self.subTest(kana=entry["kana"]):
                    others = [f for f in entry["flags"]
                              if f not in ("kana_only", "no_jmdict_senses")]
                    self.assertEqual(entry["risk"], sum(audit.WEIGHTS[f] for f in others))

    def test_every_flag_carries_a_weight(self) -> None:
        for entry in self.entries[:500]:
            for flag in entry["flags"]:
                self.assertIn(flag, audit.WEIGHTS)


class DumpTests(unittest.TestCase):
    def test_the_payload_is_what_the_playbook_tells_a_run_to_read(self) -> None:
        payload = audit.payload(audit.slice_for(0))
        for key in ("id", "area", "title", "source", "checks", "count", "entries"):
            self.assertIn(key, payload)
        self.assertEqual(payload["count"], len(payload["entries"]))

    def test_the_cli_reports_a_slice_it_does_not_know(self) -> None:
        self.assertEqual(audit.main(["--slice", "no-such-slice"]), 1)

    def test_the_cli_runs(self) -> None:
        self.assertEqual(audit.main([]), 0)
        self.assertEqual(audit.main(["--schedule", "3"]), 0)


if __name__ == "__main__":
    unittest.main()
