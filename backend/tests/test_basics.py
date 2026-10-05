# ── 基礎 — the basics course as data (plan 186d) ─────────────────
# Fourteen units of N5 cards, dealt before the rest of N5. What makes it a
# course rather than a list is closure: every sentence a unit shows uses
# only the words and points of that unit and the units before it, so a
# novice is never handed a word or a rule they have not met. The
# breakdown's own reading (study/analysis.analyze_local) is the judge,
# the same one a learner sees when they open a sentence.
import json
import unittest

from content.kanji_data import KANJI_BY_LEVEL
from content.reading_sentences import N5 as READING_N5
from study import basics, card_index, morphology
from study.level_rule import primary_mode
from study.modes import GRAMMAR, KANJI, VOCAB

def _raw_units() -> list[dict]:
    with open(basics.COURSE_PATH, encoding="utf-8") as f:
        return json.load(f)["units"]


def test_every_name_is_an_n5_card_the_line_serves():
    # units() raises on a name that is no N5 card; served is the stronger
    # claim -- the day's ration can only hand out what the line's primary
    # mode serves.
    for source in basics.SOURCES:
        served = set(card_index.raw_ids(source, basics.LEVEL, primary_mode(source)))
        missing = [raw_id for raw_id in basics.course_ids(source) if raw_id not in served]
        assert not missing, (source, missing)


def test_no_card_is_taught_twice():
    seen: dict[str, str] = {}
    for unit in basics.units():
        for source in basics.SOURCES:
            for raw_id in unit["cards"][source]:
                assert raw_id not in seen, f"{raw_id} in {seen.get(raw_id)} and {unit['id']}"
                seen[raw_id] = unit["id"]


def test_every_unit_is_named_in_both_languages_and_teaches_words():
    ids = [u["id"] for u in _raw_units()]
    assert len(ids) == len(set(ids)) == 14
    for unit in basics.units():
        assert unit["jp"] and unit["title"]["en"] and unit["title"]["fr"], unit["id"]
        assert unit["cards"][VOCAB], unit["id"]
        assert unit["sentences"], unit["id"]


def test_the_first_unit_is_the_first_lesson():
    first = basics.units()[0]
    assert first["grammar"] == ["です／だ", "は", "か"]
    assert {"::こんにちは", "::ありがとう", "::すみません", "私::わたし"} <= set(first["vocab"])


def test_a_kanji_comes_after_a_word_that_writes_it():
    n5 = {e["kanji"] for e in KANJI_BY_LEVEL["N5"]}
    written = ""
    for unit in basics.units():
        written += "".join(key.split("::")[0] for key in unit["vocab"])
        for char in unit["kanji"]:
            assert char in n5
            assert char in written, f"{char} in {unit['id']} before any word that writes it"


def test_the_sequence_deals_a_unit_whole_before_the_next():
    seq = basics.sequence()
    assert [n for _, _, n in seq] == sorted(n for _, _, n in seq)
    # Within a unit: its rules, then its words, then its kanji.
    for n in range(len(basics.units())):
        sources = [src for src, _, m in seq if m == n]
        order = [basics.SOURCES.index(src) for src in sources]
        assert order == sorted(order)
    assert seq[0] == (GRAMMAR, "grammar_N5_です／だ", 0)
    assert basics.unit_of("vocab_N5_駅_えき") == 7
    assert basics.unit_of("vocab_N5_郵便局_ゆうびんきょく") == 7
    assert basics.unit_of("vocab_N5_丈夫_じょうぶ") is None
    assert basics.course_ids(KANJI)[:3] == ["kanji_N5_人", "kanji_N5_日", "kanji_N5_本"]


def test_every_sentence_is_in_the_n5_reading_bank():
    # ADR 0017: a lesson is fed from the bank the real thing draws on, so
    # each sentence passes every check the reading platform's do
    # (tests/test_reading_sentences.py).
    bank = {row["jp"] for row in READING_N5}
    for unit in basics.units():
        for sentence in unit["sentences"]:
            assert sentence in bank, f"{sentence} ({unit['id']}) is not in the N5 reading bank"


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class ClosureTests(unittest.TestCase):

    def test_every_sentence_uses_only_what_its_unit_and_the_ones_before_teach(self) -> None:
        for n, unit in enumerate(basics.units()):
            words, points = basics.taught_through(n)
            for sentence in unit["sentences"]:
                with self.subTest(unit=unit["id"], sentence=sentence):
                    self.assertEqual(basics.strays(sentence, words, points), [])

    def test_the_judge_is_not_blind(self) -> None:
        # A unit-1 learner meets は and です, not を or 郵便局.
        words, points = basics.taught_through(0)
        self.assertEqual(basics.strays("わたしは学生です。", words, points), [])
        self.assertIn("point を", basics.strays("水を飲みます。", words, points))
        self.assertTrue(any("郵便局" in s for s in basics.strays("郵便局です。", words, points)))


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class LessonReportTests(unittest.TestCase):
    """scripts/basics_report: every course point's lesson examples, each
    with what it asks that the learner has not met by its unit. A report,
    not a gate -- the lessons were written for the whole of N5."""

    def test_it_reads_every_example_of_every_course_point(self) -> None:
        from scripts.basics_report import report
        rows = report()
        points = [p for unit in basics.units() for p in unit["grammar"]]
        self.assertEqual({r["point"] for r in rows}, set(points))
        self.assertTrue(all(isinstance(r["strays"], list) for r in rows))
        # The first lesson's own example is met by the first unit.
        self.assertIn([], [r["strays"] for r in rows if r["point"] == "です／だ"])
