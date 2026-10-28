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
from translations import fr_gloss


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
        """Six runs cover the six areas, always. Grammar's backlog is
        a year long and vocab's is longer; walking them in sequence would
        mean the sentence banks were never looked at."""
        for start in (audit.RESTART, audit.RESTART + 1, 17, 200):
            areas = {audit.slice_for(start + n)["area"] for n in range(len(audit.AREAS))}
            self.assertEqual(areas, set(audit.AREAS))

    def test_a_full_pass_of_an_area_reaches_every_one_of_its_slices(self) -> None:
        audited = audit._audited_before_restart()
        for offset, area in enumerate(audit.AREAS):
            pool = audit.slices(area)
            turns = len(pool) + sum(1 for s in pool if s["id"] in audited)
            seen = {audit.slice_for(audit.RESTART + offset + n * len(audit.AREAS))["id"]
                    for n in range(turns)}
            with self.subTest(area=area):
                self.assertEqual(seen, {s["id"] for s in pool})

    def test_the_runs_before_the_restart_name_what_they_were_dealt(self) -> None:
        """--on reproduces a past run: each of these is the slice its issue
        audited, or, for a run that filed none, the one it was dealt."""
        dealt = {
            "2026-09-18": "grammar-N5-1",                 # #124
            "2026-09-22": "vocab-1",                      # #154
            "2026-09-25": "reading-N5-1",                 # #184
            "2026-09-29": "placement-placed-above-1",     # #256
            "2026-10-02": "grammar-N5-2",                 # no issue
            "2026-10-06": "grammar-N5-2",                 # #309
            "2026-10-09": "vocab-2",                      # no issue
            "2026-10-13": "dictation-N5",                 # #334
            "2026-10-16": "placement-listed-not-here-1",  # #360
            "2026-10-20": "placement-listed-not-here-1",  # #439, which audited tours-N5-1
            "2026-10-23": "tours-N5-2",                   # no issue
            "2026-10-27": "conversation-N5-2",            # #485
        }
        for day, slice_id in dealt.items():
            with self.subTest(day=day):
                self.assertEqual(audit.slice_for(audit.run_index(dt.date.fromisoformat(day)))["id"],
                                 slice_id)

    def test_what_the_runs_before_the_restart_missed_comes_first(self) -> None:
        """#439: a slice dealt twice, three never. From RESTART each area
        deals what it was not audited on before it deals anything again."""
        audited = audit._audited_before_restart()
        for offset, area in enumerate(audit.AREAS):
            pool = audit.slices(area)
            missed = [s["id"] for s in pool if s["id"] not in audited]
            dealt = [audit.slice_for(audit.RESTART + offset + n * len(audit.AREAS))["id"]
                     for n in range(len(missed))]
            with self.subTest(area=area):
                self.assertEqual(dealt, missed)
        for slice_id in ("vocab-2", "tours-N5-2", "conversation-N5-1"):
            self.assertNotIn(slice_id, audited)

    def test_a_new_area_moves_no_run_before_it_joins(self) -> None:
        # A second grammar stands in for the area: only its date matters.
        start = audit.RESTART + 20
        before = [audit.slice_for(n)["id"] for n in range(start + 6)]
        joins, areas = audit.JOINS, audit.AREAS
        try:
            audit.JOINS = joins + (("grammar", audit.run_date(start)),)
            audit.AREAS = tuple(area for area, _ in audit.JOINS)
            audit._area_of.cache_clear()
            after = [audit.slice_for(n)["id"] for n in range(start + 6)]
        finally:
            audit.JOINS, audit.AREAS = joins, areas
            audit._area_of.cache_clear()
        self.assertEqual(after[:start], before[:start])
        self.assertNotEqual(after[start:], before[start:])

    def test_an_unfiled_run_is_dealt_again_at_its_areas_next_turn(self) -> None:
        missed = audit.RESTART + 8
        turn = len(audit.AREAS)
        unfiled = audit.UNFILED
        try:
            audit.UNFILED = unfiled | {missed}
            again = audit.slice_for(missed + turn)["id"]
            earlier = [audit.slice_for(n)["id"] for n in range(missed + 1)]
        finally:
            audit.UNFILED = unfiled
        self.assertEqual(again, audit.slice_for(missed)["id"])
        self.assertEqual(earlier, [audit.slice_for(n)["id"] for n in range(missed + 1)])


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
        # 7,965 cards since #360 folded five N1 spellings into their kana cards.
        self.assertGreater(len(self.entries), 7900)

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

    def test_the_french_is_the_one_the_card_serves(self) -> None:
        """Plan 107 gave a form taught under several readings one French
        line per card, "盛る::もる" beside the bare "盛る" (which is
        さかる's). Reading the bare key dumped another reading's gloss
        for 23 of the first run's 40 entries, and a run that trusted the
        dump would have filed each as a wrong translation (#155)."""
        french = audit._json(os.path.join(audit._VOCAB, "vocab_fr.json"))
        split = [e for e in self.entries
                 if e["kanji"] and french.get(f"{e['kanji']}::{e['kana']}")
                 and french[f"{e['kanji']}::{e['kana']}"] != french.get(e["kanji"])]
        self.assertTrue(split, "no card has a French line of its own to tell the keys apart")
        for entry in split:
            with self.subTest(card=f"{entry['kanji']}::{entry['kana']}"):
                self.assertEqual(entry["fr"], french[f"{entry['kanji']}::{entry['kana']}"])
        for entry in self.entries:
            self.assertEqual(entry["fr"], fr_gloss(entry, french))


class TourSliceTests(unittest.TestCase):
    """Plan 187g: the written tours are audited as an area of their own,
    since no gate reads a scene for whether a native speaker would say it."""

    def test_every_written_tour_is_in_a_slice_once(self) -> None:
        for level in audit.LEVELS:
            toured = [p["pattern"] for p in audit.grammar_points(level) if p.get("tour")]
            sliced = [e["pattern"] for s in audit.slices("tours") if s["level"] == level
                      for e in audit.entries_of(s)]
            self.assertEqual(sliced, toured, level)

    def test_a_tour_slice_hands_the_run_the_block_and_its_point(self) -> None:
        chosen = audit.slices("tours")[0]
        entries = audit.entries_of(chosen)
        self.assertLessEqual(len(entries), audit.CHUNK_TOURS)
        for entry in entries:
            self.assertIn("twists", entry["tour"])
            self.assertIn("scene", entry["tour"])
            self.assertIn("compare", entry)

    def test_a_toured_point_asked_from_its_own_questions_hands_them_over_too(self) -> None:
        # Plan 201: the questions a point carries (`choose`) are audited in
        # the grammar area, whose slices are whole entries, and here beside
        # the tour that teaches the point.
        by_pattern = {e["pattern"]: e for level in audit.LEVELS
                      for s in audit.slices("tours") if s["level"] == level for e in audit.entries_of(s)}
        owners = [p for level in audit.LEVELS for p in audit.grammar_points(level) if p.get("choose") and p.get("tour")]
        self.assertTrue(owners)
        for point in owners:
            self.assertEqual(by_pattern[point["pattern"]]["choose"], point["choose"])
        for level in audit.LEVELS:
            for s in audit.slices("grammar"):
                if s["level"] == level:
                    for e in audit.entries_of(s):
                        self.assertEqual("choose" in e, "choose" in next(
                            p for p in audit.grammar_points(level) if p["pattern"] == e["pattern"]))


class ConversationSliceTests(unittest.TestCase):
    """Plan 217: the 会話 bank is an area of its own, whole scenarios a
    run, since no gate can tell a wrong reply from a second right one."""

    def test_every_scenario_is_in_a_slice_once(self) -> None:
        for level in audit.LEVELS:
            banked = [s["id"] for s in audit.conversation_scenarios(level)]
            sliced = [e["id"] for s in audit.slices("conversation") if s["level"] == level
                      for e in audit.entries_of(s)]
            self.assertEqual(sliced, banked, level)

    def test_a_conversation_slice_hands_the_run_whole_scenarios(self) -> None:
        for chosen in audit.slices("conversation"):
            entries = audit.entries_of(chosen)
            self.assertLessEqual(len(entries), audit.CHUNK_CONVERSATION)
            for entry in entries:
                self.assertTrue(entry["turns"])
                for turn in entry["turns"]:
                    self.assertIn("me", turn)
                    self.assertEqual(len(turn["wrong"]), 2)


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
