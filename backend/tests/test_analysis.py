import unittest

from study.analysis import analyze_local, attach_user_state, merge_deep, analyze_with_glosses
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


class MergeDeepTests(unittest.TestCase):
    """merge_deep folds a model's per-word glosses onto the local tier's
    Tokens. The tokenizer stays the authority on segmentation; a gloss
    may bind to a RUN of Tokens whose surfaces concatenate to the
    model's word, because a model cuts words the way a dictionary does
    (会いました) and MeCab cuts morphemes (会い / まし / た)."""

    def test_a_single_token_word_binds_as_before(self) -> None:
        r = analyze_local("駅で会いました。")
        out = merge_deep(r, [{"surface": "駅", "meaning": "station"}], "x")
        eki = next(t for t in out["tokens"] if t["surface"] == "駅")
        self.assertEqual(eki["meaning"], "station")
        self.assertNotIn("span_end", eki)
        self.assertEqual(out["deep_dropped"], 0)
        self.assertEqual(out["explanation"], "x")

    def test_a_dictionary_word_binds_to_the_run_of_its_morphemes(self) -> None:
        r = analyze_local("駅で会いました。")
        surfaces = [t["surface"] for t in r["tokens"]]
        self.assertEqual(surfaces[2:5], ["会い", "まし", "た"])
        out = merge_deep(r, [{"surface": "会いました", "meaning": "met"}], "")
        head = out["tokens"][2]
        self.assertEqual(head["meaning"], "met")
        self.assertEqual(head["span_end"], 4)
        self.assertNotIn("meaning", out["tokens"][3])
        self.assertEqual(out["deep_dropped"], 0)

    def test_a_word_matching_nothing_is_dropped_and_counted(self) -> None:
        r = analyze_local("駅で会いました。")
        before = [dict(t) for t in r["tokens"]]
        out = merge_deep(r, [{"surface": "図書館", "meaning": "library"}], "")
        self.assertEqual(out["deep_dropped"], 1)
        self.assertEqual(r["tokens"], before)          # the input is never mutated
        self.assertFalse(any("meaning" in t for t in out["tokens"]))

    def test_repeated_words_bind_in_order(self) -> None:
        r = analyze_local("私は学生です。彼は先生です。")
        out = merge_deep(r, [
            {"surface": "は", "meaning": "topic 1"},
            {"surface": "は", "meaning": "topic 2"},
        ], "")
        glossed = [t["meaning"] for t in out["tokens"] if t["surface"] == "は"]
        self.assertEqual(glossed, ["topic 1", "topic 2"])

    def test_analyze_with_glosses_is_the_local_tier_plus_meanings(self) -> None:
        out = analyze_with_glosses("駅で会いました。", [{"surface": "駅", "meaning": "station"}], "N5")
        self.assertTrue(out["available"])
        self.assertEqual(out["explanation"], "")
        eki = next(t for t in out["tokens"] if t["surface"] == "駅")
        self.assertEqual(eki["meaning"], "station")
        self.assertEqual(eki["furigana"][0]["reading"], "えき")
        # No words at all is a plain local analysis.
        bare = analyze_with_glosses("駅で会いました。", None)
        self.assertEqual(bare["deep_dropped"], 0)


if __name__ == "__main__":
    unittest.main()
