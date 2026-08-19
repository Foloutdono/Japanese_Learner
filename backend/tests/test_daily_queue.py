import unittest

from study import card_index, daily_queue
from study.daily_queue import PERSONAL, SECTION

USER = "u1"


def row(raw_id: str, mode: str) -> dict:
    """A due row as srs.get_due_rows returns it -- card_id carries the
    "{user}:" prefix, which is what the lane builder has to strip."""
    return {"card_id": f"{USER}:{raw_id}", "mode": mode}


# Real ids, so a change to the id format or the eligibility filter breaks
# these rather than letting them pass against invented strings.
KANJI_A, KANJI_B = card_index.raw_ids("kanji", "N5", "kanji.flashcard.f2b")[:2]
KANJI_WRITE = card_index.raw_ids("kanji", "N5", "kanji.write_kanji")[0]
VOCAB_A = card_index.raw_ids("vocab", "N5", "vocab.flashcard.f2b")[0]
GRAMMAR_A = card_index.raw_ids("grammar", "N5", "grammar.flashcard.f2b")[0]

PERSONAL_CARD = {"deck_id": 7, "deck_name": "Mots du boulot", "structure": "vocab"}
PERSONAL_ID = "custom_7_31"


class LaneTests(unittest.TestCase):
    def test_rows_are_grouped_by_section_deck_and_mode(self) -> None:
        lanes = daily_queue.lanes(USER, [
            row(KANJI_A, "kanji.flashcard.f2b"),
            row(VOCAB_A, "vocab.flashcard.f2b"),
            row(KANJI_B, "kanji.flashcard.f2b"),
        ], {})
        self.assertEqual(list(lanes), [
            (SECTION, "kanji", "N5", "kanji.flashcard.f2b"),
            (SECTION, "vocab", "N5", "vocab.flashcard.f2b"),
        ])
        self.assertEqual(lanes[(SECTION, "kanji", "N5", "kanji.flashcard.f2b")],
                         [KANJI_A, KANJI_B])

    def test_lane_order_follows_the_rows_so_most_overdue_leads(self) -> None:
        # get_due_rows orders by next_review ASC, so whichever section
        # appears first in the rows is the one that has waited longest.
        lanes = daily_queue.lanes(USER, [
            row(GRAMMAR_A, "grammar.flashcard.f2b"),
            row(KANJI_A, "kanji.flashcard.f2b"),
        ], {})
        self.assertEqual(list(lanes)[0][1], "grammar")

    def test_the_same_card_in_two_modes_is_two_lanes(self) -> None:
        # Recognising a kanji and writing it are different skills on
        # different schedules; collapsing them would defer whichever one
        # was not served while the badge still counted it.
        lanes = daily_queue.lanes(USER, [
            row(KANJI_WRITE, "kanji.flashcard.f2b"),
            row(KANJI_WRITE, "kanji.write_kanji"),
        ], {})
        self.assertEqual(len(lanes), 2)

    def test_a_personal_card_gets_its_own_deck_lane(self) -> None:
        lanes = daily_queue.lanes(
            USER, [row(PERSONAL_ID, "vocab.flashcard.f2b")],
            {PERSONAL_ID: PERSONAL_CARD},
        )
        self.assertEqual(list(lanes), [
            (PERSONAL, 7, "Mots du boulot", "vocab.flashcard.f2b"),
        ])

    def test_a_row_naming_content_that_is_gone_is_dropped(self) -> None:
        # Not guessed at, not attributed to a section: it cannot be built,
        # so counting it would promise a card the queue cannot serve.
        lanes = daily_queue.lanes(USER, [
            row("kanji_N5_notakanji", "kanji.flashcard.f2b"),
            row(KANJI_A, "kanji.flashcard.f2b"),
        ], {})
        self.assertEqual(sum(len(v) for v in lanes.values()), 1)

    def test_a_row_under_a_retired_mode_is_dropped(self) -> None:
        lanes = daily_queue.lanes(USER, [row(KANJI_A, "qcm-kj-m")], {})
        self.assertEqual(lanes, {})


class ExcludeTests(unittest.TestCase):
    def test_exclude_is_mode_aware(self) -> None:
        """The bug this shape exists to prevent: excluding a card the
        learner answered as a flashcard must NOT also hide the writing
        drill for the same kanji, which they have not seen."""
        lanes = daily_queue.lanes(USER, [
            row(KANJI_WRITE, "kanji.flashcard.f2b"),
            row(KANJI_WRITE, "kanji.write_kanji"),
        ], {})
        kept = daily_queue.drop_seen(
            lanes, daily_queue.parse_exclude(f"{KANJI_WRITE}|kanji.flashcard.f2b"),
        )
        self.assertEqual(list(kept), [(SECTION, "kanji", "N5", "kanji.write_kanji")])

    def test_an_emptied_lane_disappears(self) -> None:
        lanes = daily_queue.lanes(USER, [row(KANJI_A, "kanji.flashcard.f2b")], {})
        kept = daily_queue.drop_seen(
            lanes, daily_queue.parse_exclude(f"{KANJI_A}|kanji.flashcard.f2b"),
        )
        self.assertEqual(kept, {})

    def test_an_empty_exclude_keeps_everything(self) -> None:
        lanes = daily_queue.lanes(USER, [row(KANJI_A, "kanji.flashcard.f2b")], {})
        self.assertEqual(daily_queue.drop_seen(lanes, daily_queue.parse_exclude("")), lanes)

    def test_parse_tolerates_a_token_with_no_mode(self) -> None:
        # A malformed token must not crash the session; it simply matches
        # nothing, because every real pair carries a mode.
        self.assertEqual(daily_queue.parse_exclude("abc"), {("abc", "")})


class InterleaveTests(unittest.TestCase):
    def _lanes(self, **spec):
        return {(SECTION, name, "N5", f"{name}.x"): list(ids) for name, ids in spec.items()}

    def test_it_alternates_between_lanes(self) -> None:
        picked = daily_queue.interleave(
            self._lanes(a=["a1", "a2", "a3"], b=["b1", "b2", "b3"]), 6,
        )
        self.assertEqual([rid for _, rid in picked],
                         ["a1", "b1", "a2", "b2", "a3", "b3"])

    def test_a_long_lane_is_not_starved_when_short_ones_run_out(self) -> None:
        picked = daily_queue.interleave(
            self._lanes(a=["a1", "a2", "a3", "a4"], b=["b1"]), 10,
        )
        self.assertEqual([rid for _, rid in picked], ["a1", "b1", "a2", "a3", "a4"])

    def test_it_stops_at_count(self) -> None:
        picked = daily_queue.interleave(self._lanes(a=["a1", "a2"], b=["b1", "b2"]), 3)
        self.assertEqual(len(picked), 3)

    def test_it_terminates_on_empty_lanes(self) -> None:
        # The loop breaks when a full pass adds nothing. Without that
        # guard, asking for more cards than exist spins forever.
        self.assertEqual(daily_queue.interleave({}, 10), [])
        self.assertEqual(daily_queue.interleave(self._lanes(a=[]), 10), [])

    def test_urgency_is_preserved_within_a_lane(self) -> None:
        picked = daily_queue.interleave(self._lanes(a=["oldest", "newer", "newest"]), 3)
        self.assertEqual([rid for _, rid in picked], ["oldest", "newer", "newest"])


class LabelTests(unittest.TestCase):
    def test_a_section_lane_names_its_source_deck_and_mode(self) -> None:
        self.assertEqual(
            daily_queue.label((SECTION, "kanji", "N4", "kanji.write_kanji")),
            {"kind": SECTION, "source": "kanji", "deck": "N4", "mode": "kanji.write_kanji"},
        )

    def test_a_personal_lane_names_its_deck(self) -> None:
        self.assertEqual(
            daily_queue.label((PERSONAL, 7, "Mots du boulot", "vocab.flashcard.f2b")),
            {"kind": PERSONAL, "deck_id": 7, "deck_name": "Mots du boulot",
             "mode": "vocab.flashcard.f2b"},
        )

    def test_the_mode_is_always_the_last_element_of_a_lane_key(self) -> None:
        # drop_seen reads key[-1] as the mode for BOTH lane kinds. If a
        # key ever gained a trailing element that assumption breaks
        # silently and exclude stops working.
        for key in [(SECTION, "kanji", "N4", "kanji.write_kanji"),
                    (PERSONAL, 7, "Mots du boulot", "vocab.flashcard.f2b")]:
            with self.subTest(key=key):
                self.assertEqual(key[-1], daily_queue.label(key)["mode"])


if __name__ == "__main__":
    unittest.main()
