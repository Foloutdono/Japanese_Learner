"""The placement report and the frequency order it derives (plan 109).

scripts/placement_report.py turns the subtitle list under
datas/vocab/sources into a ranking of words and reads the community JLPT
lists beside it; vocab_frequency.json is the deck's keys in that
ranking's order. Held here: the sources parse and stay attributed, the
ranking is a ranking of words rather than of subtitle surfaces, a
homophone never inherits another word's rank, and the order file cannot
drift from what the script would write.

Everything needs the tokenizer, which CI installs; skipped, not
failed, without it.
"""
import json
import os
import unittest

from scripts import placement_report as report
from study import morphology


class SourceTests(unittest.TestCase):
    def test_the_sources_are_present_and_attributed(self) -> None:
        for path in (report.FREQUENCY_SOURCE, report.JLPT_SOURCE):
            self.assertTrue(os.path.exists(path), path)
        readme = open(os.path.join(report._SOURCES, "README.md"), encoding="utf-8").read()
        # Both licences require attribution; the README is where it lives.
        self.assertIn("CC BY-SA", readme)
        self.assertIn("tanos", readme)
        self.assertIn("OpenSubtitles", readme)

    def test_the_jlpt_lists_have_every_level(self) -> None:
        lists = json.load(open(report.JLPT_SOURCE, encoding="utf-8"))
        self.assertEqual(set(lists), set(report.LEVELS))
        for level, rows in lists.items():
            with self.subTest(level=level):
                self.assertGreater(len(rows), 500)
                self.assertTrue(all(len(r) == 2 for r in rows))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "fugashi/unidic-lite not installed")
class RankingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.rank = report.ranking()
        cls.lookups = report._lookups(cls.rank)

    def _rank(self, kanji, kana):
        return report.card_rank({"kanji": kanji, "kana": kana}, self.rank, self.lookups)

    def test_it_ranks_words_and_the_closed_classes_the_deck_teaches(self) -> None:
        # Inflected surfaces (言っ, 知ら) credit their dictionary form;
        # a bare stem the subtitles count as a token (言) cannot be
        # lemmatised out of context and ranks as the noun it also is,
        # a limit the script's docstring records. Pronouns, conjunctions
        # and adnominals are cards too, and rank.
        self.assertLess(self.rank[("言う", "いう")], 500)
        self.assertLess(self.rank[("知る", "しる")], 1000)
        for key in (("貴方", "あなた"), ("此の", "この"), ("然し", "しかし")):
            with self.subTest(key=key):
                self.assertIn(key, self.rank)

    def test_a_stem_the_subtitles_cut_off_credits_its_own_word(self) -> None:
        """Plan 152: the subtitles cut ください and もらう before their
        endings, and くださ, 下さ and もら alone are 下す and 盛る to
        UniDic -- every "please" ranked 下す "to hand down a verdict"
        92nd, and a frequent word the deck lacked. FRAGMENTS credits
        them to the words they are."""
        self.assertLess(self.rank[("下さる", "くださる")], 200)
        self.assertLess(self.rank[("貰う", "もらう")], 200)
        self.assertGreater(self.rank.get(("下す", "くだす"), 10**6), report.FREQUENT_BAND)

    def test_the_common_words_rank_where_a_learner_would_expect(self) -> None:
        self.assertLess(self._rank("事", "こと"), 20)
        self.assertLess(self._rank("見る", "みる"), 100)
        self.assertLess(self._rank("", "あなた"), 100)
        self.assertLess(self._rank("学校", "がっこう"), 1500)

    def test_a_homophone_never_inherits_a_rank(self) -> None:
        # 琴 is not こと's rank 1, 刷る not する's rank 2, 銅 not どう's.
        # (The deck's kana-only し, "10^24", does take the conjunction
        # し's rank: same spelling, no kanji to tell them apart -- a
        # card for the audit's list, not a rule for this one.)
        koto = self._rank("事", "こと")
        for kanji, kana in (("琴", "こと"), ("刷る", "する"), ("銅", "どう")):
            with self.subTest(word=kanji or kana):
                r = self._rank(kanji, kana)
                self.assertTrue(r is None or r > 200, (kanji, kana, r))
        self.assertLess(koto, 20)

    def test_coverage_holds_per_level(self) -> None:
        # Around 70-88% of each level ranks; a source swap that ranks
        # far less would order the deck by accident (2026-09-21 figures).
        for level in report.LEVELS:
            cards = report.deck()[level]
            ranked = sum(1 for e in cards if report.card_rank(e, self.rank, self.lookups))
            with self.subTest(level=level):
                self.assertGreaterEqual(ranked / len(cards), 0.65)

    def test_the_order_file_is_what_the_script_would_write(self) -> None:
        """vocab_frequency.json is derived; a deck change that forgets
        `--rebuild-order` lands here, as does a hand edit."""
        current = json.load(open(report.ORDER_FILE, encoding="utf-8"))
        self.assertEqual(current, report.ordered_keys(self.rank))

    def test_the_lists_file_is_what_the_script_would_write(self) -> None:
        """placement_lists.json feeds the audit's rotation without a
        tokenizer; a deck change that forgets `--write-lists` lands here."""
        current = json.load(open(report.LISTS_FILE, encoding="utf-8"))
        self.assertEqual(current, report.candidate_lists())

    def test_the_lists_are_candidates_with_the_shape_the_audit_reads(self) -> None:
        lookups = self.lookups
        above = report.placed_above(self.rank, lookups)
        self.assertTrue(all(report._RANK[i["lists_say"]] < report._RANK[i["level"]] for i in above))
        # A kanji card is matched with its reading: 来る read きたる is
        # not the N5 来る (くる), and 人 read じん not 人 (ひと).
        keys = {i["key"] for i in above}
        self.assertNotIn("来る::きたる", keys)
        self.assertNotIn("人::じん", keys)
        missing = report.listed_not_here(self.rank, lookups)
        self.assertTrue(all(not report._is_pattern(i["expression"]) for i in missing))
        # A list word the deck holds in kana is present.
        self.assertNotIn("丁度", {i["expression"] for i in missing})
        frequent = report.frequent_not_here(self.rank)
        self.assertTrue(all(i["rank"] <= report.FREQUENT_BAND for i in frequent))
        self.assertTrue(all(i["meaning"] for i in frequent))
