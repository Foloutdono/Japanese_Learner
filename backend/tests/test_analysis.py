import unittest

from study.analysis import analyze_local, attach_user_state
from study import morphology


class AnalyzeLocalTests(unittest.TestCase):
    """analyze_local is the local (no-LLM) analysis tier: pure,
    user-independent composition of morphology.tokenize, card_lookup's
    resolvers, furigana.align_deck and difficulty's grammar/level
    machinery."""

    def test_shape_has_every_documented_key(self) -> None:
        r = analyze_local("私は学生です。")
        for key in ("text", "tokens", "grammar", "level", "grade", "available"):
            self.assertIn(key, r)
        self.assertIsInstance(r["tokens"], list)
        self.assertIsInstance(r["grammar"], list)
        self.assertIsInstance(r["available"], bool)

    def test_token_offsets_are_contiguous_and_rebuild_the_sentence(self) -> None:
        # The single most valuable assertion in this file: four screens
        # (analyzer, reading practice, photo input, video subtitles) map
        # highlights, furigana and click targets through these offsets.
        # An off-by-one here is a silent, wide-reaching defect.
        sentence = "私は学生です。今日は暑い！"
        r = analyze_local(sentence)
        self.assertEqual("".join(t["surface"] for t in r["tokens"]), sentence)
        cursor = 0
        for t in r["tokens"]:
            self.assertEqual(t["start"], cursor)
            self.assertEqual(t["end"], cursor + len(t["surface"]))
            cursor = t["end"]
        self.assertEqual(cursor, len(sentence))

    def test_kanji_compound_gets_per_kanji_furigana(self) -> None:
        r = analyze_local("大学に行きます。")
        daigaku = next(t for t in r["tokens"] if t["surface"] == "大学")
        self.assertGreater(len(daigaku["furigana"]), 1)
        self.assertEqual([p["text"] for p in daigaku["furigana"]], ["大", "学"])
        self.assertEqual(daigaku["furigana"][0]["reading"], "だい")

    def test_common_word_resolves_to_a_vocab_match(self) -> None:
        r = analyze_local("大学に行きます。")
        daigaku = next(t for t in r["tokens"] if t["surface"] == "大学")
        self.assertIsNotNone(daigaku["vocab_match"])
        self.assertTrue(daigaku["vocab_match"]["raw_id"])

    def test_distinctive_grammar_point_produces_a_grammar_card_id(self) -> None:
        r = analyze_local("食べようとしました")
        patterns = [g["pattern"] for g in r["grammar"]]
        self.assertIn("〜ようとする", patterns)
        hit = next(g for g in r["grammar"] if g["pattern"] == "〜ようとする")
        self.assertTrue(hit["raw_id"].startswith("grammar_"))

    def test_purity_same_input_same_output(self) -> None:
        s = "私は学生です。"
        self.assertEqual(analyze_local(s), analyze_local(s))

    def test_attach_user_state_does_not_mutate_its_argument(self) -> None:
        r = analyze_local("大学に行きます。")
        attach_user_state(r, {}, "some-user")
        daigaku = next(t for t in r["tokens"] if t["surface"] == "大学")
        self.assertNotIn("stats", daigaku["vocab_match"])

    def test_unavailable_tokenizer_returns_well_formed_empty_result(self) -> None:
        original = morphology.tokenize
        morphology.tokenize = lambda text: None
        try:
            r = analyze_local("何でもいい")
        finally:
            morphology.tokenize = original
        self.assertFalse(r["available"])
        self.assertEqual(r["tokens"], [])
        self.assertEqual(r["text"], "何でもいい")


class AttachUserStateTests(unittest.TestCase):
    """attach_user_state adds per-learner SRS stats and the
    unknown/off-deck counts. Built against a hand-written states dict,
    same approach as test_furigana.py's fake deck -- known inputs, not
    whatever the real deck happens to hold."""

    def test_unavailable_analysis_passes_through_unchanged(self) -> None:
        r = analyze_local("")
        out = attach_user_state(r, {}, "u")
        self.assertFalse(out["available"])

    def test_off_deck_content_word_counts_as_off_deck_not_unknown(self) -> None:
        # ピカチュウ is a noun with no vocab_match and no kanji_matches --
        # not something the app's deck can teach, so it must never
        # inflate unknown_count.
        r = analyze_local("ピカチュウがいます。")
        pikachu = next(t for t in r["tokens"] if t["surface"] == "ピカチュウ")
        self.assertIsNone(pikachu["vocab_match"])
        self.assertEqual(pikachu["kanji_matches"], [])

        out = attach_user_state(r, {}, "u")
        self.assertEqual(out["off_deck_count"], 1)

    def test_unlearned_deck_word_counts_as_unknown(self) -> None:
        # "大学に行きます。" carries two content words with a vocab_match
        # (大学, 行き) and none are in `states` -> card_stats falls back
        # to "not_started" for both, so unknown_count is 2, not 1.
        r = analyze_local("大学に行きます。")
        out = attach_user_state(r, {}, "u")
        self.assertEqual(out["unknown_count"], 2)
        matched = next(t for t in out["tokens"] if t["surface"] == "大学")
        self.assertEqual(matched["vocab_match"]["stats"]["status"], "not_started")

    def test_particle_never_counts_toward_either_bucket(self) -> None:
        r = analyze_local("ピカチュウがいます。")
        out = attach_user_state(r, {}, "u")
        # が (particle) has no vocab_match/kanji_matches either, but must
        # not be counted as off-deck -- only content words are.
        ga = next(t for t in out["tokens"] if t["surface"] == "が")
        self.assertEqual(ga["pos"], "particle")
        # Only ピカチュウ should have contributed to off_deck_count.
        self.assertEqual(out["off_deck_count"], 1)


if __name__ == "__main__":
    unittest.main()
