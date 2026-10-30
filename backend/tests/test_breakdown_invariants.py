"""What holds of any breakdown, whatever sentence it is given (plan 272).

The precision tests pin a rule on the sentence it was written for. These
hold the breakdown to properties no sentence may break, read over lines
the app was never tuned on (Tatoeba's, which datas/vocab/jmdict_fr.sqlite3
carries) and over input no learner should be able to break it with: the
parts cover the text, a reading is kana, a mark at the end or a space
between phrases changes no card, the same line reads the same twice, and
every line the breakdown can print has its French.
"""
import logging
import random
import re
import sqlite3
import unittest
from pathlib import Path

from study import analysis, morphology, particle_glosses

_FR_DB = Path(__file__).resolve().parent.parent / "datas" / "vocab" / "jmdict_fr.sqlite3"
_KANJI = re.compile(r"[一-鿿々]")
_FIGURE = re.compile(r"^[0-9０-９,.，．/／%％:：~〜\-−]+$")


def _outside_lines(n: int) -> list[str]:
    """A fixed sample of the dictionary's own example sentences."""
    with sqlite3.connect(_FR_DB) as db:
        rows = [r[0] for r in db.execute("select jp from example order by jp")]
    return random.Random(272).sample(rows, n)


def _cards(result: dict) -> list[tuple[str, str]]:
    out = []
    for t in result["tokens"]:
        if t["pos"] == "symbol" or not t["surface"].strip():
            continue
        entry = (t.get("vocab_match") or {}).get("entry") or {}
        out.append((t["surface"], entry.get("kanji") or entry.get("kana") or ""))
    return out


def _bare(text: str) -> str:
    return re.sub(r"\s", "", text)


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class OutsideLinesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.lines = _outside_lines(80)
        cls.read = {s: analysis.analyze_local(s) for s in cls.lines}

    def test_the_parts_cover_the_text(self) -> None:
        for s, result in self.read.items():
            with self.subTest(sentence=s):
                self.assertEqual(_bare("".join(t["surface"] for t in result["tokens"])), _bare(s))

    def test_a_reading_is_kana(self) -> None:
        for s, result in self.read.items():
            for t in result["tokens"]:
                if t["pos"] == "symbol" or _FIGURE.match(t["surface"]):
                    continue
                with self.subTest(sentence=s, surface=t["surface"]):
                    self.assertIsNone(_KANJI.search(t.get("reading") or ""), t.get("reading"))

    def test_the_final_mark_changes_no_card(self) -> None:
        for s, result in self.read.items():
            if s.endswith("。"):
                with self.subTest(sentence=s):
                    self.assertEqual(_cards(analysis.analyze_local(s[:-1])), _cards(result))

    def test_half_width_marks_change_nothing(self) -> None:
        for s, result in self.read.items():
            if "！" in s or "？" in s:
                half = analysis.analyze_local(s.replace("！", "!").replace("？", "?"))
                with self.subTest(sentence=s):
                    self.assertEqual(_cards(half), _cards(result))
                    self.assertEqual(sorted(g["pattern"] for g in half["grammar"]),
                                     sorted(g["pattern"] for g in result["grammar"]))

    def test_a_subtitle_s_spaces_change_no_card(self) -> None:
        # (a video line is written with a space after each phrase)
        for s, result in self.read.items():
            tokens, spaced = result["tokens"], ""
            for i, t in enumerate(tokens):
                spaced += t["surface"]
                if t["pos"] == "particle" and i + 1 < len(tokens) \
                        and tokens[i + 1]["pos"] not in ("particle", "symbol", "auxiliary"):
                    spaced += " "
            with self.subTest(sentence=spaced):
                self.assertEqual(_cards(analysis.analyze_local(spaced)), _cards(result))

    def test_the_same_line_reads_the_same_twice(self) -> None:
        for s, result in list(self.read.items())[:20]:
            with self.subTest(sentence=s):
                self.assertEqual(analysis.analyze_local(s), result)


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs a tokenizer")
class OddInputTests(unittest.TestCase):
    """Nothing a learner pastes breaks the breakdown or loses a letter."""

    ODD = ("", " ", "。", "！？", "ｶﾀｶﾅで書いた", "ＡＢＣ１２３", "😀😀", "テスト\nです", "\t猫\t", "「", "」」」",
           "〜〜〜〜〜", "ーーー", "あ" * 300, "猫" * 200, "é", "a‍b", "１２３４５６７８９０円", "🇯🇵日本",
           "＃タグ", "@user こんにちは", "http://example.com を見て", "(笑)", "w" * 40, "ｗｗｗ", "・・・", "ゝゞヽヾ",
           "うわわ〜〜〜っ", "きゃああ〜〜〜っ！", "すごーーーーい！", "「おい」「え？・・・わっ、うわわ〜〜〜っ」")

    def test_odd_input_is_read_whole(self) -> None:
        for s in self.ODD:
            with self.subTest(text=s[:20]):
                result = analysis.analyze_local(s)
                self.assertEqual(_bare("".join(t["surface"] for t in result["tokens"])), _bare(s))

    def test_the_tokenizer_never_falls_back(self) -> None:
        # (morphology.tokenize logs and degrades on an exception of its own)
        for s in self.ODD + tuple(_outside_lines(40)):
            with self.subTest(text=s[:20]), self.assertNoLogs("study.morphology", level=logging.WARNING):
                morphology.tokenize(s)


class GlossTableTests(unittest.TestCase):
    """Every line the breakdown can print for a part, in every language."""

    def test_every_gloss_has_its_french_and_spanish(self) -> None:
        tables = {"particle_glosses": particle_glosses._GLOSSES, "prefix": analysis._PREFIX_GLOSSES,
                  "suffix": analysis._SUFFIX_GLOSSES, "affix": analysis._AFFIX_SENSES,
                  "span": analysis._SPAN_COUNTERS, "name": analysis._NAME_GLOSS,
                  "unknown": {"": analysis._UNKNOWN_GLOSS}, "which": {"": analysis._WHICH}}
        for name, table in tables.items():
            for key, gloss in table.items():
                with self.subTest(table=name, key=key):
                    for lang in ("en", "fr", "es"):
                        self.assertTrue((gloss.get(lang) or "").strip(), lang)

    def test_every_row_of_a_tuple_table_has_its_spanish(self) -> None:
        # (reading,) English, French, Spanish: the Spanish last (plan 291).
        from study.reading_context import LATIN_UNITS
        tables = {"units": (LATIN_UNITS, 4), "sizes": (analysis._SIZES, 4), "latin": (analysis._LATIN_WORDS, 4),
                  "adverbs": (particle_glosses._ADVERBS, 3), "ordinal": (analysis._ORDINAL_SENSE, 3)}
        for name, (table, width) in tables.items():
            for key, row in table.items():
                with self.subTest(table=name, key=key):
                    self.assertEqual(len(row), width)
                    self.assertEqual(bool(row[-1].strip()), bool(row[-3].strip()))

    def test_every_gloss_a_breakdown_prints_has_its_spanish(self) -> None:
        # The tables and the glosses made on the spot: a figure, a time,
        # a score, a fraction, an age, a date, an ordinal, a unit, a size,
        # a JLPT level, an adverb made with に (plan 291).
        made = ("九千三百五十円", "1,500円です", "１００万人", "３．５キロ走った", "19:30に会おう", "26-24でセットを取った",
                "大さじ1と1/2を入れる", "20代の女性", "10/24（土）の飲み会", "3曲目は新曲です", "何年目ですか",
                "600Wで温める", "普段はMですが、ワンサイズ上のLにした", "N3に合格した", "本当に楽しかった",
                "許さぬ", "行くぞ", "田中さんは今日、元気そうですね。")
        for s in made + tuple(_outside_lines(60)):
            for token in analysis.analyze_local(s)["tokens"]:
                if token.get("gloss"):
                    with self.subTest(text=s[:20], part=token["surface"]):
                        self.assertTrue((token["gloss"].get("es") or "").strip(), token["gloss"])

    def test_every_key_the_rules_name_is_in_the_table(self) -> None:
        source = Path(particle_glosses.__file__).read_text(encoding="utf-8")
        named = set(re.findall(r'\bkey = "([^"]+)"', source))
        self.assertGreater(len(named), 100)
        self.assertEqual(sorted(named - particle_glosses._GLOSSES.keys()), [])
