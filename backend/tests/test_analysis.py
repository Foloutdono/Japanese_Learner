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

    @unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
    def test_token_offsets_count_the_spaces_between_phrases(self) -> None:
        # A subtitle line is phrases with spaces between them, and MeCab
        # drops a half-width space rather than making it a token. The
        # offsets are into the text as written all the same: uncounted,
        # every one after a space was short, the grammar detector (which
        # matches the text) lost every particle past the first space,
        # and a cloze blanked the wrong letters.
        sentence = "SHAKE 白々しく光る  街の灯りに\t照らされ"
        r = analyze_local(sentence)
        for t in r["tokens"]:
            self.assertEqual(sentence[t["start"]:t["end"]], t["surface"])
        by_pattern = {g["pattern"]: g for g in r["grammar"]}
        for pattern, surface in (("の", "の"), ("に", "に"), ("受身形 〜られる", "れ")):
            with self.subTest(pattern=pattern):
                self.assertIn(pattern, by_pattern)
                g = by_pattern[pattern]
                self.assertEqual(sentence[g["start"]:g["end"]], surface)
                covering = [t for t in r["tokens"] if pattern in {p["pattern"] for p in t["grammar"]}]
                self.assertEqual([t["surface"] for t in covering], [surface])

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

    def test_a_deck_compound_is_one_token(self) -> None:
        """Plan 102. UniDic's short unit cuts 日曜日 into 日曜 + 日, and
        per-morpheme lookup then showed Sunday at N3 beside day at N4
        under a sentence written to teach the N5 word. The run folds
        into the one token the deck teaches, with the ENTRY's reading:
        the morphemes' joined (にちよう + ひ) misreads the rendaku."""
        r = analyze_local("日曜日に会いました。")
        tok = next(t for t in r["tokens"] if t["surface"] == "日曜日")
        self.assertEqual(tok["vocab_match"]["raw_id"], "vocab_N5_日曜日_にちようび")
        self.assertEqual(tok["reading"], "にちようび")
        self.assertEqual((tok["start"], tok["end"]), (0, 3))
        self.assertEqual([p["text"] for p in tok["furigana"]], ["日", "曜", "日"])
        self.assertFalse(any(t["surface"] == "日曜" for t in r["tokens"]))

    def test_a_compound_spelled_with_kana_folds_by_its_lemmas(self) -> None:
        """A curated N5 sentence writes 曜 out as kana because the kanji
        is above the level (content/reading_sentences.py), so the
        surfaces joined spell nothing the deck holds and only the
        lemmas (日曜 + 日) still do. The sentence still rebuilds from
        the tokens, offsets intact."""
        sentence = "母は日よう日に買いものをします。"
        r = analyze_local(sentence)
        tok = next(t for t in r["tokens"] if t["surface"] == "日よう日")
        self.assertEqual(tok["vocab_match"]["raw_id"], "vocab_N5_日曜日_にちようび")
        self.assertEqual(tok["reading"], "にちようび")
        self.assertEqual("".join(t["surface"] for t in r["tokens"]), sentence)
        # And 母 is a card of its own now, not a fragment of お母さん.
        haha = next(t for t in r["tokens"] if t["surface"] == "母")
        self.assertEqual(haha["vocab_match"]["raw_id"], "vocab_N5_母_はは")

    def test_a_three_morpheme_compound_and_a_counter_fold_too(self) -> None:
        # お + 母 + さん, longest run first; 二 + 日 with the counter's
        # own reading rather than ふた + か.
        r = analyze_local("お母さんは二日に来ます。")
        by_surface = {t["surface"]: t for t in r["tokens"]}
        self.assertEqual(by_surface["お母さん"]["vocab_match"]["raw_id"], "vocab_N5_お母さん_おかあさん")
        self.assertEqual(by_surface["お母さん"]["reading"], "おかあさん")
        self.assertEqual(by_surface["二日"]["reading"], "ふつか")
        self.assertNotIn("母", by_surface)

    def test_a_compound_with_two_readings_folds_to_the_one_read(self) -> None:
        # Plan 106: 一日 is ついたち and いちにち, two N5 cards; 一日中 read
        # いちにち folds to that one and shows its reading.
        r = analyze_local("一日中寝た。")
        tok = next(t for t in r["tokens"] if t["surface"] == "一日")
        self.assertEqual(tok["vocab_match"]["raw_id"], "vocab_N5_一日_いちにち")
        self.assertEqual(tok["reading"], "いちにち")

    def test_a_particle_is_never_folded_into_a_compound(self) -> None:
        # 今日 + は is two words whatever the deck holds (こんにちは is
        # an N3 entry): a run never crosses a particle.
        r = analyze_local("今日は雨です。")
        surfaces = [t["surface"] for t in r["tokens"]]
        self.assertEqual(surfaces[:2], ["今日", "は"])
        self.assertEqual(r["tokens"][1]["grammar"][0]["pattern"], "は")

    def test_a_present_card_the_lookups_used_to_miss_now_badges(self) -> None:
        """Plan 104. パン is an N5 card stored in katakana, もう an N5
        adverb, できる an N5 verb UniDic tags 非自立可能: all three were
        in the deck and none badged, in 296 occurrences across the
        taught sentences (scripts/audit_vocab_deck.py)."""
        r = analyze_local("もうパンを買うことができます。")
        by_surface = {t["surface"]: t for t in r["tokens"]}
        self.assertEqual(by_surface["もう"]["vocab_match"]["raw_id"], "vocab_N5__もう")
        self.assertEqual(by_surface["パン"]["vocab_match"]["raw_id"], "vocab_N5__パン")
        self.assertEqual(by_surface["でき"]["vocab_match"]["raw_id"], "vocab_N5__できる")

    @unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
    def test_a_word_past_the_course_carries_its_pool_card(self) -> None:
        """Plan 148. A subtitle's words the deck does not teach: さらば
        (an interjection), 真っさら (a 形状詞) and 桃源郷, which UniDic
        cuts into 桃源 + 郷 and the pool holds as one word. Each carries
        its meaning and its pool card, with no level, and the deck still
        answers first (なる is the deck's)."""
        r = analyze_local("さらば桃源郷真っさらになったんだ")
        by_surface = {t["surface"]: t for t in r["tokens"]}
        self.assertNotIn("桃源", by_surface)
        for surface, meaning in (("さらば", "farewell"), ("桃源郷", "earthly paradise"),
                                 ("真っさら", "brand new")):
            with self.subTest(surface=surface):
                match = by_surface[surface]["vocab_match"]
                self.assertTrue(match["pool"])
                self.assertIsNone(match["level"])
                self.assertTrue(match["raw_id"].startswith("vocab_jmdict_"))
                # (the first gloss of each of its first senses, plan 151)
                self.assertEqual(match["entry"]["meaning"].split("; ")[0], meaning)
        self.assertEqual(by_surface["桃源郷"]["reading"], "とうげんきょう")
        self.assertFalse(by_surface["なっ"]["vocab_match"].get("pool"))
        self.assertEqual("".join(t["surface"] for t in r["tokens"]), r["text"])

    @unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
    def test_every_grammatical_word_of_a_subtitle_has_its_key(self) -> None:
        """Plan 149, on the two lines the owner showed: the に of 真っさらに
        and the なっ of なった are 〜になる, the た the plain past, the ん
        and だ the explanatory のだ; 会いにきて is 〜に行きます (its lesson
        names 来ます), and the て of 辿って links the two clauses."""
        r = analyze_local("さらば桃源郷真っさらになったんだ")
        by_pattern = {g["pattern"]: r["text"][g["start"]:g["end"]] for g in r["grammar"]}
        self.assertEqual(by_pattern["〜くなる／〜になる"], "になっ")
        self.assertEqual(by_pattern["た形 〜た"], "た")
        self.assertEqual(by_pattern["〜んです／〜のです"], "んだ")
        r = analyze_local("足跡を辿って会いにきて")
        by_pattern = {g["pattern"]: r["text"][g["start"]:g["end"]] for g in r["grammar"]}
        self.assertEqual(by_pattern["〜に行きます"], "にき")
        self.assertIn("〜て、〜て", by_pattern)
        ni = next(t for t in r["tokens"] if t["surface"] == "に")
        self.assertIn("〜に行きます", [g["pattern"] for g in ni["grammar"]])

    @unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
    def test_the_pool_is_never_asked_for_a_word_a_point_is_written_on(self) -> None:
        # The しれ of かもしれません is 知れる in the pool; a row with no
        # word in it opens its grammar point, and a gloss would take that
        # door away.
        r = analyze_local("雨がふるかもしれません。")
        shire = next(t for t in r["tokens"] if t["surface"] == "しれ")
        self.assertTrue(shire["grammar"])
        self.assertIsNone(shire["vocab_match"])

    @unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
    def test_a_word_written_in_kana_is_never_matched_to_a_homophone(self) -> None:
        # The pool is JMdict less the deck: its one row read その is 苑,
        # "garden", and its one row read あんな the Anna era. まじか is
        # slang UniDic reads as 間近 (まぢか), "near".
        for sentence, surface in (("その本をください。", "その"), ("あんな人はいない。", "あんな"),
                                  ("まじかよ", None)):
            with self.subTest(sentence=sentence):
                r = analyze_local(sentence)
                pooled = [t["surface"] for t in r["tokens"] if (t["vocab_match"] or {}).get("pool")]
                self.assertEqual(pooled, [])
                if surface:
                    self.assertIn(surface, [t["surface"] for t in r["tokens"]])

    @unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
    def test_deck_words_are_never_folded_into_a_pool_compound(self) -> None:
        # 電話 + 番号 are two N5 cards; the pool's 電話番号 does not take
        # them. A number is the deck's to read, never the pool's: 二十
        # read にじゅう shares a kanji and a reading with 二重, "double".
        r = analyze_local("電話番号と三千円と二十人")
        surfaces = [t["surface"] for t in r["tokens"]]
        self.assertEqual(surfaces[:2], ["電話", "番号"])
        for t in r["tokens"]:
            self.assertFalse((t["vocab_match"] or {}).get("pool"), t["surface"])

    def test_distinctive_grammar_point_produces_a_grammar_card_id(self) -> None:
        r = analyze_local("食べようとしました")
        patterns = [g["pattern"] for g in r["grammar"]]
        self.assertIn("〜ようとする", patterns)
        hit = next(g for g in r["grammar"] if g["pattern"] == "〜ようとする")
        self.assertTrue(hit["raw_id"].startswith("grammar_"))

    def test_a_point_rides_the_tokens_it_covers(self) -> None:
        """What makes a rule reachable the way a word is: the rows under
        a sentence are the learner's map of it, and a particle row used
        to be the one row that went nowhere -- no deck entry, no card,
        nothing to press -- while the rule it is an instance of sat in a
        chip below, unattached to the word demonstrating it."""
        r = analyze_local("今日は学校へ行きません。")
        by_surface = {t["surface"]: [g["pattern"] for g in t["grammar"]] for t in r["tokens"]}
        self.assertEqual(by_surface["は"], ["は"])
        self.assertEqual(by_surface["へ"], ["へ"])
        self.assertEqual(by_surface["ませ"], ["〜ます／〜ません"])
        # A word the point does not cover carries none of it.
        self.assertEqual(by_surface["学校"], [])
        # Every point a token carries is one the sentence reports, with
        # the card id the chip would open.
        ids = {g["raw_id"] for g in r["grammar"]}
        for token in r["tokens"]:
            for point in token["grammar"]:
                self.assertIn(point["raw_id"], ids)
                self.assertIn(point["kind"], ("marker", "pattern"))

    def test_a_point_carries_its_gloss_in_both_languages(self) -> None:
        """Plan 095: a chip says what its rule does without the sheet
        being opened. The gloss is the catalogue's {en, fr} pair rather
        than one language, because this result is pure and shared across
        every learner -- the screen picks the language (frontend
        grammarGloss.js), and the copy a token carries is the same one,
        so a particle's row can print it too."""
        r = analyze_local("今日は学校へ行きません。")
        wa = next(g for g in r["grammar"] if g["pattern"] == "は")
        self.assertEqual(set(wa["meaning"]), {"en", "fr"})
        self.assertTrue(wa["meaning"]["en"] and wa["meaning"]["fr"])
        self.assertTrue(wa["structure"])
        on_token = next(g for t in r["tokens"] for g in t["grammar"] if g["raw_id"] == wa["raw_id"])
        self.assertEqual(on_token["meaning"], wa["meaning"])
        self.assertEqual(on_token["structure"], wa["structure"])
        # Kept through the per-user half, on the sentence and the token.
        with_state = attach_user_state(r, {}, "some-user")
        self.assertEqual(next(g for g in with_state["grammar"] if g["pattern"] == "は")["meaning"], wa["meaning"])
        self.assertEqual(
            next(g for t in with_state["tokens"] for g in t["grammar"] if g["raw_id"] == wa["raw_id"])["meaning"],
            wa["meaning"],
        )

    def test_a_point_says_where_it_is_written(self) -> None:
        """Plan 095: `segments` is the pieces of the sentence the point is
        written on. One piece for a point written in one piece, and for
        から〜まで the two words and not the clause between them -- which
        is what a screen lights, and what decides which tokens carry
        the point (a stage card for 家 must not list から〜まで)."""
        r = analyze_local("駅から家まで歩きました。")
        kara_made = next(g for g in r["grammar"] if g["pattern"] == "から〜まで")
        self.assertEqual(kara_made["segments"], [[1, 3], [4, 6]])
        self.assertEqual((kara_made["start"], kara_made["end"]), (1, 6))
        mashita = next(g for g in r["grammar"] if g["pattern"] == "〜ました／〜ませんでした")
        self.assertEqual(mashita["segments"], [[mashita["start"], mashita["end"]]])
        by_surface = {t["surface"]: [g["pattern"] for g in t["grammar"]] for t in r["tokens"]}
        self.assertIn("から〜まで", by_surface["から"])
        self.assertIn("から〜まで", by_surface["まで"])
        self.assertEqual(by_surface["家"], [])
        # The token's copy keeps the occurrence's offsets, and keeps
        # them through the per-user half, where only the stats join.
        kara = next(t for t in r["tokens"] if t["surface"] == "から")
        on_token = next(g for g in kara["grammar"] if g["pattern"] == "から〜まで")
        self.assertEqual((on_token["start"], on_token["end"], on_token["segments"]), (1, 6, [[1, 3], [4, 6]]))
        with_state = attach_user_state(r, {}, "some-user")
        kara = next(t for t in with_state["tokens"] if t["surface"] == "から")
        on_token = next(g for g in kara["grammar"] if g["pattern"] == "から〜まで")
        self.assertEqual(on_token["segments"], [[1, 3], [4, 6]])
        self.assertIn("stats", on_token)

    def test_a_note_lands_on_the_point_it_names_and_nowhere_else(self) -> None:
        """Plan 095: the deep tier's line per point, on the entry and on
        each token's copy; a note for a pattern the sentence does not
        use is dropped, and the local result is left untouched."""
        r = analyze_local("日本に行ったことがあります。")
        merged = merge_deep(r, [], "An experience.", [
            {"pattern": " 〜ことがある ", "note": " has been there before "},
            {"pattern": "〜てしまう", "note": "not here"},
            {"pattern": "に"},  # no note: ignored
            "garbage",
        ])
        koto = next(g for g in merged["grammar"] if g["pattern"] == "〜ことがある")
        self.assertEqual(koto["note"], "has been there before")
        self.assertFalse(any(g.get("note") == "not here" for g in merged["grammar"]))
        self.assertFalse(any("note" in g for g in merged["grammar"] if g["pattern"] != "〜ことがある"))
        on_token = next(g for t in merged["tokens"] for g in t["grammar"] if g["pattern"] == "〜ことがある")
        self.assertEqual(on_token["note"], "has been there before")
        self.assertFalse(any("note" in g for g in r["grammar"]))
        self.assertFalse(any("note" in g for t in r["tokens"] for g in t["grammar"]))
        # Without notes, the grammar is the local tier's, note-free.
        self.assertFalse(any("note" in g for g in merge_deep(r, [], "x")["grammar"]))

    def test_the_gloss_is_a_copy_and_never_the_catalogue_s_own(self) -> None:
        """The result is cached and handed around; editing it must not
        reach the catalogue every later analysis reads from."""
        from content.grammar_points_data import find
        r = analyze_local("今日は学校へ行きません。")
        wa = next(g for g in r["grammar"] if g["pattern"] == "は")
        self.assertIsNot(wa["meaning"], find("は")[1]["meaning"])

    def test_a_marker_is_told_from_a_construction(self) -> None:
        """The screens put the two in different places -- a marker on
        the row of the particle it is, a construction in the chips over
        the sentence (frontend rows.js, GrammarChips.jsx)."""
        r = analyze_local("今日は学校へ行きません。")
        kinds = {g["pattern"]: g["kind"] for g in r["grammar"]}
        self.assertEqual(kinds["は"], "marker")
        self.assertEqual(kinds["〜ます／〜ません"], "pattern")

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
        # ピカチュウ is a noun no deck card and no kanji card is behind --
        # not something the course teaches, so it must never inflate
        # unknown_count. JMdict has it (plan 148), so it carries the pool
        # card a learner may take up; untaken, it is off-deck as before.
        r = analyze_local("ピカチュウがいます。")
        pikachu = next(t for t in r["tokens"] if t["surface"] == "ピカチュウ")
        self.assertTrue(pikachu["vocab_match"]["pool"])
        self.assertEqual(pikachu["kanji_matches"], [])

        out = attach_user_state(r, {}, "u")
        self.assertEqual(out["off_deck_count"], 1)
        # いる is the one unknown: an N5 card, not started.
        self.assertEqual(out["unknown_count"], 1)

    def test_a_pool_word_the_learner_took_up_counts_as_theirs(self) -> None:
        # In the learner's SRS, a pool word is a word of theirs: new is
        # unknown, like a deck word's; learning counts in neither bucket.
        r = analyze_local("ピカチュウがいます。")
        raw_id = next(t for t in r["tokens"] if t["surface"] == "ピカチュウ")["vocab_match"]["raw_id"]

        def states(state):
            return {("u:" + raw_id, "vocab.flashcard.f2b"): {
                "state": state, "total_reviews": 0, "correct_reviews": 0,
                "due": False, "interval_days": None, "next_review": None,
            }}

        # Against いる, the sentence's one unknown deck word.
        out = attach_user_state(r, states("new"), "u")
        self.assertEqual((out["unknown_count"], out["off_deck_count"]), (2, 0))
        out = attach_user_state(r, states("learning"), "u")
        self.assertEqual((out["unknown_count"], out["off_deck_count"]), (1, 0))

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

    @unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
    def test_a_word_a_construction_owns_is_not_off_deck(self) -> None:
        # Plan 159: 〜てはいけません's いけ has no card (it is no 行く), and
        # it is the construction's, not a word the app cannot teach. 話し
        # is the sentence's one unknown content word (ここ is a pronoun).
        out = attach_user_state(analyze_local("ここで話してはいけません。"), {}, "u")
        self.assertEqual((out["unknown_count"], out["off_deck_count"]), (1, 0))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class FrenchGlossTests(unittest.TestCase):
    """Plan 159: a deck card carries its French gloss beside its English
    one, so the breakdown reads in one language -- the particle's line
    was French (the grammar catalogue) and every word's English."""

    def test_a_deck_card_carries_its_french(self) -> None:
        entries = {t["surface"]: t["vocab_match"]["entry"]
                   for t in analyze_local("ここで話してはいけません。")["tokens"] if t.get("vocab_match")}
        self.assertEqual((entries["ここ"]["meaning"], entries["ここ"]["meaning_fr"]), ("here", "ici"))
        self.assertEqual(entries["話し"]["meaning_fr"], "parler")

    def test_a_pool_word_has_no_french_to_carry(self) -> None:
        pikachu = next(t for t in analyze_local("ピカチュウがいます。")["tokens"] if t["surface"] == "ピカチュウ")
        self.assertNotIn("meaning_fr", pikachu["vocab_match"]["entry"])


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
