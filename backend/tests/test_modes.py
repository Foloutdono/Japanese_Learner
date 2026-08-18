import unittest

from study import modes


class ModeRegistryTests(unittest.TestCase):
    """
    Invariants of the study-mode registry. These exist because the old
    taxonomy failed silently in every direction: mode was a bare TEXT
    column with no constraint, an unknown key materialised SRS rows
    instead of erroring, and routes/decks.py decided eligibility with a
    substring test (`"flashcard" in mode`).
    """

    def test_expected_graded_key_count(self) -> None:
        # kana 4 + kanji 5 + vocab 3 + grammar 3 + standard 2.
        # A change here should be deliberate, not incidental.
        self.assertEqual(len(modes.SRS_MODES), 17)

    def test_every_key_is_namespaced_and_uses_the_dot_separator(self) -> None:
        for key in modes.SRS_MODES:
            source, _, rest = key.partition(".")
            self.assertIn(source, modes.SOURCES, f"{key} has no known source prefix")
            self.assertTrue(rest, f"{key} has no base segment")
            self.assertNotIn(":", key, f"{key} must not contain ':' — card ids use it structurally")

    def test_fast_review_is_ungraded_and_outside_the_srs_key_space(self) -> None:
        # An ungraded browse must never be able to write a card_modes row.
        self.assertNotIn(modes.FAST_REVIEW, modes.SRS_MODES)
        self.assertFalse(modes.MODES[modes.FAST_REVIEW].graded)

    def test_every_source_offers_fast_review_last(self) -> None:
        for source, keys in modes.MODES_FOR_SOURCE.items():
            self.assertEqual(keys[-1], modes.FAST_REVIEW, f"{source} should end on the browse")

    def test_no_hint_leaks_into_a_key(self) -> None:
        # Hints are payload data, never part of a mode's identity — if one
        # ever gets concatenated into a key it forks the SRS track, which
        # is exactly what this taxonomy exists to prevent.
        for key in modes.ALL_MODE_KEYS:
            for hint in modes.HINTS:
                self.assertNotIn(hint, key)

    def test_hints_are_all_known(self) -> None:
        for mode in modes.MODES.values():
            for hint in mode.hints:
                self.assertIn(hint, modes.HINTS, f"{mode.key} declares unknown hint {hint}")

    def test_spec_hint_availability(self) -> None:
        # Straight from the spec, so a later edit can't quietly drop one.
        self.assertEqual(modes.MODES["vocab.flashcard.f2b"].hints,
                         frozenset({modes.INDICE_CHOICES, modes.INDICE_FURIGANA}))
        self.assertEqual(modes.MODES["grammar.flashcard.b2f"].hints,
                         frozenset({modes.INDICE_CHOICES, modes.INDICE_SENTENCES}))
        self.assertEqual(modes.MODES["grammar.fill_in"].hints,
                         frozenset({modes.INDICE_CHOICES}))
        self.assertEqual(modes.MODES["kana.flashcard.f2b"].hints,
                         frozenset({modes.INDICE_CHOICES}))
        # The typed/drawn modes offer no hints at all.
        for key in ("kana.write_romaji", "kana.write_kana", "kanji.write_kanji",
                    "kanji.readings", "kanji.radical", "vocab.word_reading"):
            self.assertEqual(modes.MODES[key].hints, frozenset(), key)

    def test_resolve_rejects_unknown(self) -> None:
        with self.assertRaises(modes.UnknownMode):
            modes.resolve("banana")
        self.assertIsNone(modes.try_resolve("banana"))

    def test_resolve_for_source_rejects_another_sources_key(self) -> None:
        # The defect this closes: every router took `mode: str` and looked
        # it up in its own dict, so a key belonging to a different source
        # either KeyError'd (vocab.py) or silently created rows (kana.py).
        self.assertIsNotNone(modes.resolve_for_source("kanji", "kanji.readings"))
        self.assertIsNone(modes.resolve_for_source("vocab", "kanji.readings"))
        self.assertIsNone(modes.resolve_for_source("kana", "banana"))

    def test_resolve_for_source_rejects_fast_review(self) -> None:
        # Ungraded, so it must not pass validation on a card/review path.
        for source in modes.SOURCES:
            self.assertIsNone(modes.resolve_for_source(source, modes.FAST_REVIEW))

    def test_the_old_flat_key_space_is_rejected(self) -> None:
        """
        The retired keys must 400 now, not resolve.

        They were accepted through a LEGACY_ALIASES table while the
        frontend caught up. Keeping that table would have kept writing
        rows under the ambiguity it existed to retire -- 'flashcard' meant
        three different exercises depending on the section, which is the
        whole reason the keys are namespaced.
        """
        retired = {
            "kana": ["qcm", "flashcard", "write"],
            "kanji": ["qcm-kj-m", "qcm-m-kj", "flashcard-kj-m", "flashcard-m-kj", "write"],
            "vocab": ["qcm-kj-m", "qcm-m-kj", "flashcard-kj-m", "flashcard-m-kj"],
            "grammar": ["flashcard", "mcq", "fill"],
        }
        for source, keys in retired.items():
            for old in keys:
                self.assertIsNone(
                    modes.resolve_for_source(source, old),
                    f"{source}/{old!r} still resolves",
                )

    def test_no_alias_table_survives(self) -> None:
        self.assertFalse(hasattr(modes, "LEGACY_ALIASES"))
    def test_word_reading_excludes_kana_only_entries(self) -> None:
        # 1,097 of 8,405 vocab entries are kana-only; serving one would
        # show the same string as prompt and answer.
        mode = modes.MODES["vocab.word_reading"]
        self.assertTrue(modes.eligible_for(mode, {"kanji": "毎月", "kana": "まいげつ"}))
        self.assertFalse(modes.eligible_for(mode, {"kanji": "", "kana": "ドア"}))
        self.assertFalse(modes.eligible_for(mode, {"kana": "ドア"}))

    def test_radical_and_fill_in_eligibility(self) -> None:
        radical = modes.MODES["kanji.radical"]
        self.assertTrue(modes.eligible_for(radical, {"radical": 149}))
        self.assertFalse(modes.eligible_for(radical, {}))

        fill = modes.MODES["grammar.fill_in"]
        self.assertTrue(modes.eligible_for(fill, {"fill_ok": True}))
        self.assertFalse(modes.eligible_for(fill, {"fill_ok": False}))
        self.assertFalse(modes.eligible_for(fill, {}))

    def test_flashcards_are_eligible_unconditionally(self) -> None:
        mode = modes.MODES["vocab.flashcard.f2b"]
        self.assertTrue(modes.eligible_for(mode, {"kanji": "", "kana": "ドア"}))

    def test_status_modes_cover_every_source(self) -> None:
        for source in modes.SOURCES:
            self.assertIn(source, modes.STATUS_MODES)
            self.assertTrue(modes.STATUS_MODES[source])
            for key in modes.STATUS_MODES[source]:
                self.assertIn(key, modes.SRS_MODES)

    def test_describe_covers_every_key_once_per_source(self) -> None:
        rows = modes.describe()
        # fast_review appears once per source (it is offered by all of them).
        self.assertEqual(
            len(rows),
            len(modes.SRS_MODES) + len(modes.MODES_FOR_SOURCE),
        )
        for row in rows:
            self.assertIn(row["key"], modes.MODES)
            self.assertIn(row["renderer"], {
                modes.RENDER_FLASHCARD, modes.RENDER_TYPE, modes.RENDER_DRAW,
                modes.RENDER_FILL, modes.RENDER_BROWSE,
            })

    def test_directions_only_on_flashcards(self) -> None:
        for mode in modes.MODES.values():
            if mode.direction is not None:
                self.assertTrue(mode.is_flashcard, f"{mode.key} has a direction but isn't a flashcard")
                self.assertIn(mode.direction, (modes.F2B, modes.B2F))

    def test_both_directions_exist_for_every_flashcard_source(self) -> None:
        for source in modes.SOURCES:
            keys = modes.GRADED_FOR_SOURCE[source]
            self.assertIn(f"{source}.flashcard.f2b", keys)
            self.assertIn(f"{source}.flashcard.b2f", keys)


if __name__ == "__main__":
    unittest.main()
