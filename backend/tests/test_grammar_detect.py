"""Which grammar points a sentence is shown to use.

The substring matcher this replaced answered a different question well
enough: the level gate only needs to know whether a sentence is too
hard, and may miss a point (the sentence merely goes through). A
breakdown is read by a learner. A point it misses is a rule left
untaught, and one it invents is a lesson about something that is not in
the sentence -- and it is a card they can press, a chip they can mine,
an explanation they will believe.

So the tests below are mostly about the false hits, which is where a
substring test over 541 patterns spends its time: 「気が」 is really
inside 天気が, 「ました」 is really inside every polite past sentence
whether or not もう is anywhere near it, and 「なり」 is really inside
になりました. The rest pin the things the catalogue's own lessons teach
the matcher (study/grammar_detect's rule 3), and the recall it is held
to over those lessons.
"""
import unittest

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
from study import grammar_detect, morphology


def patterns(sentence: str) -> list[str]:
    return [p for p, _lv, _s, _e, _k in grammar_detect.detect(sentence)]


def kinds(sentence: str) -> dict[str, str]:
    return {p: kind for p, _lv, _s, _e, kind in grammar_detect.detect(sentence)}


@unittest.skipUnless(
    morphology.MORPHOLOGY_AVAILABLE,
    "detection falls back to the substring rule without a tokenizer",
)
class WordBoundaryTests(unittest.TestCase):
    """Rule 1: a hit lands on words, not on characters."""

    def test_a_point_is_not_found_inside_a_noun(self) -> None:
        """天気が is one word and a particle. 〜気がする begins in the
        middle of the noun, which is not somewhere a grammar point
        begins."""
        self.assertNotIn("〜気がする", patterns("今日は天気がいいです。"))

    def test_a_point_may_begin_inside_a_word_that_conjugates(self) -> None:
        """大きく is one token, and 〜くて is the て on the end of it: a
        pattern attaches to an inflected stem, so a hit that starts
        mid-word is ordinary when the word is one that inflects."""
        self.assertIn("〜くて／〜で", patterns("この店は大きくて新しいです。"))

    def test_a_point_may_run_into_the_word_it_attaches_to(self) -> None:
        """なくしてしまいました conjugates しまう past where the
        catalogue writes it; the hit ends inside しまい."""
        self.assertIn("〜てしまう", patterns("大切な物をなくしてしまいました。"))

    def test_the_front_of_one_word_is_never_a_point(self) -> None:
        """です is not で followed by something. A hit that starts where
        a word starts and stops inside that same word is reading half a
        word."""
        self.assertNotIn("〜くて／〜で", patterns("今日は天気がいいです。"))

    def test_a_reading_that_spans_two_words_is_not_a_point(self) -> None:
        """The case test_difficulty_points has carried a note about
        since it was written: がくせい + です was reported as the N3
        〜せいで, せい|で straddling the two."""
        self.assertNotIn("〜せいで", patterns("わたしはがくせいです。"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class EveryPartTests(unittest.TestCase):
    """Rule 2: a pattern written in two parts needs both of them."""

    def test_a_two_part_point_needs_its_first_half(self) -> None:
        """もう〜ました fired on every ました in the catalogue -- 137 of
        them -- because the matcher kept the longest piece and dropped
        もう."""
        self.assertNotIn("もう〜ました", patterns("きのう映画を見ました。"))

    def test_a_two_part_point_is_found_when_both_halves_are_there(self) -> None:
        self.assertIn("もう〜ました", patterns("その本はもう読みました。"))

    def test_from_here_to_there_needs_both_ends(self) -> None:
        self.assertIn("から〜まで", patterns("学校から駅まで歩きます。"))
        self.assertNotIn("から〜まで", patterns("さむいから、家にいます。"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class ShapeFromTheLessonsTests(unittest.TestCase):
    """Rule 3: a point looks the way its own example sentences look."""

    def test_a_verb_is_not_a_particle_that_is_spelled_the_same(self) -> None:
        """〜なり (N1) is a particle. なり in 先生になりました is 成る,
        and every ...になりました in the app used to report it."""
        self.assertNotIn("〜なり", patterns("友だちは日本語の先生になりました。"))

    def test_the_word_in_front_tells_two_points_apart(self) -> None:
        """の after a noun is the possessive; の after a verb is the
        nominalizer. Same particle, and the catalogue's `structure` line
        says exactly this -- which is what its examples show."""
        self.assertIn("の", patterns("これはわたしのかさです。"))
        self.assertNotIn("〜の", patterns("これはわたしのかさです。"))

    def test_a_reading_a_lesson_shows_only_beside_the_real_one_is_a_coincidence(self) -> None:
        """安いし、近いし、この店にします。 shows 〜し as the particle it is
        twice, and once more as the し of します, a verb on a token of
        its own. Seen in no other lesson and never alone, the verb
        reading teaches nothing: 食べようとしました is not listing
        reasons, and neither is 宿題をしました."""
        self.assertNotIn("〜し", found_in("食べようとしました。"))
        self.assertNotIn("〜し", found_in("宿題をしました。"))
        self.assertEqual(patterns("安いし、近いし、この店にします。").count("〜し"), 2)
        self.assertIn("〜し", found_in("雨は強いし、風もあるし、出かけたくない。"))

    def test_a_lesson_teaches_the_matcher_its_own_point(self) -> None:
        for level, points in GRAMMAR_POINTS_BY_LEVEL.items():
            for point in points:
                pattern = point.get("pattern", "")
                if pattern != "〜てください":
                    continue
                for example in point.get("examples", []):
                    with self.subTest(sentence=example["jp"]):
                        self.assertIn(pattern, patterns(example["jp"]))

    def test_half_a_word_is_not_a_point_that_stands_on_its_own(self) -> None:
        """〜し lists reasons and stands as its own word in every one of
        its lessons. The し inside なくして is a verb ending."""
        self.assertIn("〜し", patterns("安いし、近いし、この店にします。"))
        self.assertNotIn("〜し", patterns("大切な物をなくしてしまいました。"))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class WhatIsReportedTests(unittest.TestCase):

    def test_a_point_inside_a_longer_one_is_that_ones_own(self) -> None:
        """The と of 食べようとした belongs to 〜ようとする, and is not
        the conditional 〜と; the ます inside ました is the ました."""
        found = patterns("食べようとしました")
        self.assertIn("〜ようとする", found)
        self.assertNotIn("〜と", found)
        self.assertIn("〜ました／〜ませんでした", found)
        self.assertNotIn("〜ます／〜ません", found)

    def test_a_marker_inside_a_construction_is_still_the_particle_it_is(self) -> None:
        """The が of ことができます is the subject が, and the row it
        stands on opens it; the construction is reported over it too."""
        found = found_in("日よう日に来ることができます。")
        self.assertIn("〜ことができます", found)
        self.assertEqual(found["が"], "が")
        kinds = {h["pattern"]: h["kind"] for h in grammar_detect.hits("日よう日に来ることができます。")}
        self.assertEqual(kinds["が"], "marker")

    def test_a_multi_part_point_explains_nothing_it_encloses(self) -> None:
        """もう〜ました reaches from もう to the end of the sentence, and
        everything the learner is reading lies between the two."""
        found = patterns("外はもうくらくなりました。")
        self.assertIn("もう〜ました", found)
        self.assertIn("〜くなる／〜になる", found)

    def test_a_hit_says_which_pieces_it_is_written_on(self) -> None:
        """hits() beside detect(): the same list, each hit with the
        (start, end) pieces it is written on. One piece for a point in
        one piece; one per part for a two-part point, and the clause
        between the parts is in neither (plan 095)."""
        sentence = "駅から家まで歩きました。"
        full = grammar_detect.hits(sentence)
        self.assertEqual(
            [(h["pattern"], h["level"], h["start"], h["end"], h["kind"]) for h in full],
            grammar_detect.detect(sentence),
        )
        kara_made = next(h for h in full if h["pattern"] == "から〜まで")
        self.assertEqual(kara_made["segments"], [(1, 3), (4, 6)])
        mashita = next(h for h in full if h["pattern"] == "〜ました／〜ませんでした")
        self.assertEqual(mashita["segments"], [(mashita["start"], mashita["end"])])
        for h in full:
            with self.subTest(pattern=h["pattern"]):
                # The pieces are in order, do not overlap, and span
                # exactly the hit's own stretch.
                self.assertEqual(h["segments"][0][0], h["start"])
                self.assertEqual(h["segments"][-1][1], h["end"])
                for (_s1, e1), (s2, _e2) in zip(h["segments"], h["segments"][1:]):
                    self.assertLessEqual(e1, s2)

    def test_without_a_tokenizer_a_hit_is_still_written_on_one_piece(self) -> None:
        original = morphology.tokenize
        morphology.tokenize = lambda text: None
        try:
            for h in grammar_detect.hits("なくしてしまいました。"):
                with self.subTest(pattern=h["pattern"]):
                    self.assertEqual(h["segments"], [(h["start"], h["end"])])
        finally:
            morphology.tokenize = original

    def test_a_marker_is_told_from_a_construction(self) -> None:
        """A screen puts the two in different places: a marker on the
        row of the very particle it is, a construction in the chips over
        the sentence it shapes."""
        found = kinds("今日は学校へ行きません。")
        self.assertEqual(found.get("は"), "marker")
        self.assertEqual(found.get("へ"), "marker")
        self.assertEqual(found.get("〜ます／〜ません"), "pattern")

    def test_a_sense_the_text_cannot_show_is_not_claimed(self) -> None:
        """〜を（移動） is を with a verb of movement. Nothing in the
        surface says which を this is, and the catalogue's own
        parenthesis is what says so -- the plain point is reported and
        the qualified one is not guessed at."""
        found = patterns("公園を歩きます。")
        self.assertIn("を", found)
        self.assertNotIn("〜を（移動）", found)

    def test_an_occurrence_is_reported_once_per_place_it_happens(self) -> None:
        """A point's needles nest (ています, ていま), which is one
        occurrence and one card. Two real occurrences are two."""
        self.assertEqual(patterns("安いし、近いし、この店にします。").count("〜し"), 2)
        self.assertEqual(patterns("雨がふっています。").count("〜ています"), 1)

    def test_a_span_is_inside_the_sentence_and_not_empty(self) -> None:
        sentence = "子どもは野さいを食べようとしない。"
        for pattern, _level, start, end in grammar_detect.points_in(sentence):
            with self.subTest(pattern=pattern):
                self.assertLess(start, end)
                self.assertLessEqual(end, len(sentence))

    def test_nothing_in_a_bare_word(self) -> None:
        self.assertEqual(grammar_detect.detect("犬"), [])
        self.assertEqual(grammar_detect.detect(""), [])


def found_in(sentence: str) -> dict[str, str]:
    """pattern -> the text it was found on."""
    return {p: sentence[a:b] for p, _lv, a, b, _k in grammar_detect.detect(sentence)}


class ByDictionaryFormTests(unittest.TestCase):
    """The second pass (plan 095): a tail found as the dictionary form of
    a token rather than as letters, so every conjugation of it is found
    at once, and the form points found as the form the tokenizer names.
    Each case pairs a hit with the sentence that must NOT be one."""

    def test_a_short_tail_is_found_on_a_stem_and_not_after_a_particle(self) -> None:
        self.assertEqual(found_in("食べすぎました。")["〜すぎる"], "すぎ")
        self.assertEqual(found_in("高すぎる。")["〜すぎる"], "すぎる")
        self.assertNotIn("〜すぎる", found_in("三時を過ぎました。"))

    def test_a_te_tail_is_found_by_its_verb_and_not_on_the_verb_alone(self) -> None:
        self.assertEqual(found_in("ちょっと見てみます。")["〜てみる"], "てみ")
        self.assertNotIn("〜てみる", found_in("映画を見ます。"))
        self.assertEqual(found_in("買っておきました。")["〜ておく"], "ておき")
        self.assertEqual(found_in("駅まで歩いていった。")["〜ていく／〜てくる"], "ていっ")
        self.assertEqual(found_in("食べていた。")["〜ています"], "てい")

    def test_a_conjugated_tail_is_the_same_tail(self) -> None:
        self.assertEqual(found_in("食べたかった。")["〜たいです"], "たかっ")
        self.assertEqual(found_in("食べやすいです。")["〜やすい／〜にくい"], "やすい")
        self.assertEqual(found_in("雨が降り始めた。")["〜はじめる／〜おわる／〜つづける"], "始め")

    def test_the_imperative_of_a_tail_is_its_own_point(self) -> None:
        """書いてください is 〜てください and never the honorific verb
        くださる behind 〜てくださる; 教えてくださいました is the verb."""
        request = found_in("書いてください。")
        self.assertIn("〜てください", request)
        self.assertNotIn("〜てくださる／〜ていただく", request)
        honorific = found_in("先生が教えてくださいました。")
        self.assertIn("〜てくださる／〜ていただく", honorific)
        # And the letters てください inside くださいました are not the
        # request: the first pass learned from 〜てください's lessons
        # that it ends in the imperative (rule 3, the form).
        self.assertNotIn("〜てください", honorific)

    def test_the_passive_and_the_potential(self) -> None:
        # A う-verb: れる is the passive and nothing else.
        polite = found_in("先生に名前をよばれました。")
        self.assertEqual(polite["受身形 〜られる"], "れ")
        self.assertNotIn("可能形 〜(ら)れる", polite)
        # A う-verb conjugating as 下一段 is the potential and nothing else.
        skill = found_in("私は漢字が書けます。")
        self.assertEqual(skill["可能形 〜(ら)れる"], "書け")
        self.assertNotIn("受身形 〜られる", skill)
        # A る-verb's られる is both, and both are said (module docstring).
        both = found_in("この魚は生で食べられます。")
        self.assertEqual(both["受身形 〜られる"], "られ")
        self.assertEqual(both["可能形 〜(ら)れる"], "られ")
        # 見える is in view, not able to look.
        self.assertNotIn("可能形 〜(ら)れる", found_in("山が見えます。"))

    def test_the_causative_and_its_passive(self) -> None:
        make = found_in("母は妹に野さいを食べさせました。")
        self.assertEqual(make["使役形 〜させる"], "させ")
        self.assertNotIn("受身形 〜られる", make)
        made = found_in("父にきらいな野さいを食べさせられました。")
        self.assertEqual(made["使役受身形 〜させられる"], "させられ")
        self.assertNotIn("使役形 〜させる", made)
        self.assertNotIn("受身形 〜られる", made)

    def test_the_volitional_is_the_verb_s_and_not_an_auxiliary_s(self) -> None:
        self.assertEqual(found_in("そろそろ帰ろう。")["意向形 〜(よ)う"], "帰ろう")
        self.assertEqual(found_in("行こうと思います。")["意向形 〜(よ)う"], "行こう")
        self.assertNotIn("意向形 〜(よ)う", found_in("雨でしょう。"))
        self.assertNotIn("意向形 〜(よ)う", found_in("行きましょう。"))

    def test_the_imperative_ends_its_clause_and_is_not_a_polite_request(self) -> None:
        self.assertEqual(found_in("早く起きろ。")["命令形 〜ろ／〜え"], "起きろ")
        self.assertEqual(found_in("駅で少し待てと言われました。")["命令形 〜ろ／〜え"], "待て")
        self.assertNotIn("命令形 〜ろ／〜え", found_in("書いてください。"))
        self.assertNotIn("命令形 〜ろ／〜え", found_in("食べなさい。"))

    def test_a_form_hit_is_one_piece_with_the_kind_of_a_construction(self) -> None:
        for h in grammar_detect.hits("食べすぎました。"):
            if h["pattern"] == "〜すぎる":
                self.assertEqual(h["segments"], [(h["start"], h["end"])])
                self.assertEqual(h["kind"], "pattern")
                break
        else:
            self.fail("〜すぎる not found")

    def test_every_form_rule_names_a_point_the_catalogue_files(self) -> None:
        """A rename in the catalogue is a rename here: a rule keyed on a
        pattern nobody files would be a rule that never fires."""
        from content.grammar_points_data import find
        for pattern in grammar_detect._CLASS_RULES:
            with self.subTest(pattern=pattern):
                self.assertIsNotNone(find(pattern))
                self.assertTrue(grammar_detect._confirmed(find(pattern)[0], pattern),
                                f"{pattern}'s own lessons do not show its rule working")

    def test_a_rule_is_held_to_its_own_lessons(self) -> None:
        """The stem rule for 〜すぎる is confirmed by 〜すぎる's examples;
        a point whose lessons never show its rule is not trusted."""
        self.assertTrue(grammar_detect._confirmed("N4", "〜すぎる"))
        self.assertFalse(grammar_detect._confirmed("N1", "〜すぎる"))  # not filed there

    def test_a_tail_is_read_on_a_stem(self) -> None:
        """たい on its own is the fish; on a stem it is the auxiliary."""
        core = grammar_detect._tail_core("たいです")
        self.assertEqual([(pos, reading) for pos, reading, _form in core], [("auxiliary", "たい")])
        self.assertIsNone(grammar_detect._tail_core("ます"), "a tail of politeness alone is no rule")
        self.assertIsNone(grammar_detect._tail_core("ませんでした"), "nor one of politeness and tense")
        self.assertIsNone(grammar_detect._tail_core("ことがある"), "a noun-first tail is the first pass's")
        # A form written on purpose is kept, and must be matched.
        self.assertEqual(grammar_detect._tail_core("ましょうか")[0][2], "意志推量形")

    def test_a_tail_s_form_is_part_of_the_tail(self) -> None:
        """食べますか is 〜ますか and not 〜ましょうか; 行きません is
        〜ます／〜ません and not 〜ました／〜ませんでした."""
        asks = found_in("いっしょに食べますか。")
        self.assertNotIn("〜ましょうか", asks)
        self.assertIn("〜ましょうか", found_in("いっしょに食べましょうか。"))
        negative = found_in("今日は学校へ行きません。")
        self.assertIn("〜ます／〜ません", negative)
        self.assertNotIn("〜ました／〜ませんでした", negative)

    def test_a_tail_written_in_a_form_is_that_form_and_a_dictionary_form_tail_is_any(self) -> None:
        """べき, べく and べからず are one word in three forms and three
        lessons; なきゃ is not every ない; and a tail in its dictionary
        form (〜ています) is found however it is conjugated."""
        should = found_in("学生は毎日勉強するべきだ。")
        self.assertIn("〜べきだ", should)
        self.assertNotIn("〜べく", should)
        self.assertNotIn("〜べからず", should)
        self.assertNotIn("〜なきゃ／〜なくちゃ", found_in("今日は食べない。"))
        self.assertIn("〜なきゃ／〜なくちゃ", found_in("早く食べなきゃ。"))
        for sentence in ("雨が降っている。", "雨が降っていた。", "雨が降っていて、寒い。"):
            with self.subTest(sentence=sentence):
                self.assertIn("〜ています", found_in(sentence))

    def test_a_rule_its_lessons_never_show_is_never_used(self) -> None:
        """〜があります／います would read as a stem rule on いる, and no
        example of the point puts いる on a stem -- so the rule is dead,
        and 食べている is not 〜があります／います."""
        self.assertFalse(grammar_detect._confirmed("N5", "〜があります／います"))


class WithoutMorphologyTests(unittest.TestCase):
    """fugashi/unidic-lite is optional (morphology.MORPHOLOGY_AVAILABLE),
    and every rule above needs it. What must not happen is detection
    disappearing with it."""

    def test_it_falls_back_to_the_substring_rule(self) -> None:
        sentence = "この本を読んでください。"
        real = morphology.tokenize
        morphology.tokenize = lambda _text: None
        try:
            found = [p for p, _lv, _s, _e, _k in grammar_detect.detect(sentence)]
        finally:
            morphology.tokenize = real
        self.assertIn("〜てください", found)

    def test_a_hit_it_cannot_judge_is_still_a_hit_with_a_span(self) -> None:
        real = morphology.tokenize
        morphology.tokenize = lambda _text: None
        try:
            hits = grammar_detect.detect("この本を読んでください。")
        finally:
            morphology.tokenize = real
        for pattern, level, start, end, kind in hits:
            with self.subTest(pattern=pattern):
                self.assertLess(start, end)
                # Nothing can be called a marker without a tokenizer to
                # say what part of speech it landed on.
                self.assertEqual(kind, "pattern")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class TheCatalogueIsTheMeasureTests(unittest.TestCase):
    """The 2,169 hand-written example sentences are ground truth: each
    one was written to demonstrate exactly one point, and detection
    should find that point in it.

    A ratchet, not a target. The floors are below what the module scores
    today (90.4% of sentences, 510 of 541 points) so that ordinary
    catalogue edits do not fail the build, and far above what the
    substring matcher scored (77.6%) so that a regression to it does.
    """

    @classmethod
    def setUpClass(cls) -> None:
        cls.sentences = 0
        cls.found = 0
        cls.points = 0
        cls.points_found = 0
        for level, points in GRAMMAR_POINTS_BY_LEVEL.items():
            for point in points:
                pattern = point.get("pattern", "")
                examples = [ex["jp"] for ex in point.get("examples", []) if ex.get("jp")]
                if not pattern or not examples:
                    continue
                cls.points += 1
                hits = 0
                for sentence in examples:
                    cls.sentences += 1
                    if (pattern, level) in {
                        (p, lv) for p, lv, _s, _e, _k in grammar_detect.detect(sentence)
                    }:
                        cls.found += 1
                        hits += 1
                cls.points_found += bool(hits)

    def test_a_lesson_sentence_shows_its_own_point(self) -> None:
        share = self.found / self.sentences
        self.assertGreaterEqual(
            share, 0.90,
            f"detection found the point its own example was written for in "
            f"{self.found}/{self.sentences} sentences ({share:.1%})",
        )

    def test_nearly_every_point_is_visible_somewhere_in_its_own_lesson(self) -> None:
        share = self.points_found / self.points
        self.assertGreaterEqual(
            share, 0.94,
            f"{self.points_found}/{self.points} points were found in at least "
            f"one of their own examples ({share:.1%}) -- see the module "
            f"docstring for the four kinds that are refusals, not misses",
        )


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class CanFindTests(unittest.TestCase):
    """Where the detector may say "not in this sentence" (plan 125):
    only on a point it finds in that point's own lesson. 作文 prints its
    found / not-found hint on those and holds its tongue on the rest."""

    def test_a_point_its_own_lesson_shows_is_trusted(self) -> None:
        self.assertTrue(grammar_detect.can_find("〜てください"))
        self.assertTrue(grammar_detect.can_find("〜ながら"))

    def test_a_point_no_rule_reads_is_not(self) -> None:
        for pattern in ("い形容詞／な形容詞", "〜しか〜ない", "〜上に"):
            self.assertFalse(grammar_detect.can_find(pattern), pattern)

    def test_an_unknown_pattern_is_not(self) -> None:
        self.assertFalse(grammar_detect.can_find("〜not a point"))

    def test_nearly_every_point_is_trusted(self) -> None:
        trusted = sum(
            grammar_detect.can_find(point["pattern"])
            for points in GRAMMAR_POINTS_BY_LEVEL.values()
            for point in points
        )
        # A ratchet: 517 of 541 when written. Lower it only when a plan
        # lowers the figure, never to make a build pass.
        self.assertGreaterEqual(trusted, 505, f"{trusted} points trusted")
