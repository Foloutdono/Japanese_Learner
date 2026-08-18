import unittest

from content.kanji_data import KANJI_BY_LEVEL
from content.kanji_readings import ON, KUN, display_reading, split_readings
from content.radical_data import (
    ALL_RADICALS, RADICAL_BY_NUMBER, radical_for, siblings_by_stroke,
)


def _all_entries():
    for level, entries in KANJI_BY_LEVEL.items():
        for entry in entries:
            yield level, entry


class SplitReadingsTests(unittest.TestCase):
    """
    The deck packs every reading of a kanji into one ・-separated string and
    the `readings` mode has to ask for them by type. The split is by script
    -- katakana is 音, hiragana is 訓 -- which is the convention in Japanese
    reference works, not a heuristic this file invented.
    """

    def test_splits_a_mixed_entry(self) -> None:
        self.assertEqual(
            split_readings("ド・ト・つち"),
            {ON: ["ド", "ト"], KUN: ["つち"]},
        )

    def test_keeps_the_okurigana_marker_in_the_stored_form(self) -> None:
        # ま.ず says ま is written inside the kanji and ず outside. Losing
        # that would make the stored reading a different claim.
        self.assertIn("ま.ず", split_readings("セン・さき・ま.ず")[KUN])

    def test_empty_and_missing_input(self) -> None:
        for value in (None, "", "・", "  "):
            self.assertEqual(split_readings(value), {ON: [], KUN: []})

    def test_every_deck_reading_is_classified(self) -> None:
        # A reading landing in neither bucket would silently disappear from
        # the card -- the learner would be marked wrong for producing it.
        dropped = []
        for level, entry in _all_entries():
            parts = [p.strip() for p in (entry.get("kana") or "").split("・") if p.strip()]
            split = split_readings(entry.get("kana"))
            if len(parts) != len(split[ON]) + len(split[KUN]):
                dropped.append((level, entry["kanji"], entry.get("kana")))
        self.assertEqual(dropped, [], f"{len(dropped)} entries lost a reading")

    def test_coverage_is_what_the_mode_assumes(self) -> None:
        # The mode seeds one row per group that exists. If on-readings were
        # rare this would be the wrong shape, so the assumption is pinned.
        total = has_on = has_kun = neither = 0
        for _level, entry in _all_entries():
            total += 1
            s = split_readings(entry.get("kana"))
            has_on += bool(s[ON])
            has_kun += bool(s[KUN])
            if not s[ON] and not s[KUN]:
                neither += 1
        self.assertGreater(has_on / total, 0.95)
        self.assertGreater(has_kun / total, 0.75)
        self.assertEqual(neither, 0, "a kanji with no readings has no answerable card")


class DisplayReadingTests(unittest.TestCase):
    def test_strips_every_marker(self) -> None:
        # "." okurigana boundary, "~" bound form. Neither is a sound, and a
        # learner who types the reading without them is not wrong.
        for stored, shown in [
            ("ま.ず", "まず"), ("~び", "び"), ("ほ~", "ほ"),
            ("~くだ.す", "くだす"), ("ボク", "ボク"),
        ]:
            self.assertEqual(display_reading(stored), shown)

    def test_no_display_form_keeps_a_marker(self) -> None:
        for _level, entry in _all_entries():
            for readings in split_readings(entry.get("kana")).values():
                for r in readings:
                    shown = display_reading(r)
                    self.assertNotRegex(shown, r"[.~-]", f"{r!r} -> {shown!r}")

    def test_display_is_never_empty_for_a_real_reading(self) -> None:
        for _level, entry in _all_entries():
            for readings in split_readings(entry.get("kana")).values():
                for r in readings:
                    self.assertTrue(display_reading(r), f"{r!r} displays as nothing")


class RadicalDataTests(unittest.TestCase):
    def test_the_full_kangxi_set_is_present(self) -> None:
        self.assertEqual(len(ALL_RADICALS), 214)
        self.assertEqual(len(RADICAL_BY_NUMBER), 214)

    def test_every_deck_kanji_resolves_to_a_radical(self) -> None:
        # study/modes.eligible_for drops a kanji with no radical from the
        # pool. That is the right behaviour, but if it ever fired in bulk
        # the mode would quietly shrink, so the coverage is pinned here.
        missing = [e["kanji"] for _l, e in _all_entries() if radical_for(e["kanji"]) is None]
        self.assertEqual(missing, [], f"{len(missing)} deck kanji have no radical")

    def test_radical_lookup_shape(self) -> None:
        rad = radical_for("語")
        self.assertEqual(rad, {"number": 149, "char": "言", "stroke_count": 7})

    def test_unknown_kanji_is_none_not_a_crash(self) -> None:
        self.assertIsNone(radical_for("Z"))
        self.assertIsNone(radical_for(""))

    def test_distractors_share_the_stroke_count_when_the_bucket_allows(self) -> None:
        # Drawn from all 214, a 1-stroke answer against three 12-stroke
        # options would be solvable by shape alone.
        for number in (1, 12, 149):
            r = RADICAL_BY_NUMBER[number]
            sibs = siblings_by_stroke(number)
            self.assertNotIn(number, sibs)
            self.assertGreaterEqual(len(sibs), 3)
            for n in sibs:
                self.assertEqual(RADICAL_BY_NUMBER[n]["stroke_count"], r["stroke_count"])

    def test_a_thin_bucket_widens_to_the_nearest_stroke_counts(self) -> None:
        # 齒 is the only 15-stroke radical, so a strict same-count rule
        # gives it no distractors at all and its grid would show one row.
        sibs = siblings_by_stroke(211)
        self.assertGreaterEqual(len(sibs), 3)
        self.assertNotIn(211, sibs)
        own = RADICAL_BY_NUMBER[211]["stroke_count"]
        # Still near in stroke count -- not scraped from the 1-stroke end.
        for n in sibs:
            self.assertLessEqual(abs(RADICAL_BY_NUMBER[n]["stroke_count"] - own), 4)

    def test_every_deck_radical_can_offer_three_distractors(self) -> None:
        # Fewer than three and the choice hint silently shows a short grid.
        thin = {
            radical_for(e["kanji"])["number"]
            for _l, e in _all_entries()
            if len(siblings_by_stroke(radical_for(e["kanji"])["number"])) < 3
        }
        self.assertEqual(thin, set(), f"radicals with <3 same-stroke siblings: {thin}")


if __name__ == "__main__":
    unittest.main()
