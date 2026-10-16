"""The French layer over JMdict (content/jmdict_fr.py, plan 215).

What it promises a French learner: the dictionary entry of every word the
course teaches reads in French -- its senses and its sentences -- a word
outside the course is glossed from the pool's own French, never from a
deck homograph's, and a French gloss query finds pool words too."""
import unittest

from content import jmdict_fr
from content import vocab_extras as vx
from content.vocab_data import VOCAB_BY_LEVEL
import content.vocab_jmdict_data as jmdict_db
from translations import get_meaning
from translations.fr.vocab_fr import VOCAB_FR


def _deck_senses():
    """Every (glossary, examples) a deck word's dictionary entry shows."""
    for level in VOCAB_BY_LEVEL.values():
        for entry in level:
            for sense in (vx._find_senses(entry.get("kanji") or "", entry.get("kana") or "") or [])[:vx._MAX_SENSES]:
                yield "; ".join(sense.get("glossary", [])), sense.get("examples", [])


class FrenchLayerTests(unittest.TestCase):
    def test_the_layer_is_shipped(self) -> None:
        counts = jmdict_fr.counts()
        # Ratchets: lower a bound only when a plan lowers the figure.
        self.assertGreaterEqual(counts["sense"], 14_995)
        self.assertGreaterEqual(counts["example"], 8_091)
        self.assertGreaterEqual(counts["pool_line"], 20_000)

    def test_every_sense_the_deck_shows_has_french(self) -> None:
        glossaries = {g for g, _ in _deck_senses() if g}
        french = jmdict_fr.senses(glossaries)
        missing = sorted(glossaries - set(french))
        self.assertEqual(missing[:10], [], f"{len(missing)} deck senses without French")

    def test_every_sentence_the_deck_shows_has_french(self) -> None:
        sentences = {ex["jp"] for _, examples in _deck_senses() for ex in examples}
        french = jmdict_fr.examples(sentences)
        missing = sorted(sentences - set(french))
        self.assertEqual(missing[:10], [], f"{len(missing)} deck sentences without French")


class DictionaryEntryTests(unittest.TestCase):
    def test_a_french_entry_reads_in_french_and_says_so(self) -> None:
        fr = vx.get_vocab_extras("食べる", "たべる", "to eat", "fr")
        en = vx.get_vocab_extras("食べる", "たべる", "to eat", "en")
        self.assertTrue(fr["senses"] and fr["examples"])
        self.assertTrue(all(s["glossary_lang"] == "fr" for s in fr["senses"]))
        self.assertNotEqual(fr["senses"][0]["glossary"], en["senses"][0]["glossary"])
        self.assertTrue(all(ex.get("tr") and ex["tr_lang"] == "fr" for ex in fr["examples"]))
        # The English stays where the practice screens and the scoring read it.
        self.assertEqual([ex["en"] for ex in fr["examples"]], [ex["en"] for ex in en["examples"]])
        self.assertNotIn("glossary_lang", en["senses"][0])

    def test_a_chip_tooltip_is_french(self) -> None:
        self.assertEqual(vx._tooltip("v5k", {"notes": "Godan verb with 'ku' ending"}, "fr"), "verbe godan en -ku")
        self.assertEqual(vx._tooltip("v5k", {"notes": "Godan verb with 'ku' ending"}, "en"), "Godan verb with 'ku' ending")
        self.assertIn("2 000", vx._tooltip("news3k", {"notes": "x"}, "fr"))


class PoolWordTests(unittest.TestCase):
    def test_a_pool_word_never_takes_a_deck_homographs_french(self) -> None:
        """殿 read どの ("Mr.") and 殿 read しんがり share a written form,
        and VOCAB_FR is keyed by it: the pool row was served the deck
        word's "arrière-garde"."""
        row = jmdict_db.get_by_key("殿", "どの")
        self.assertIsNotNone(row)
        french = get_meaning(row, "fr", VOCAB_FR)
        self.assertNotEqual(french, VOCAB_FR.get("殿"))
        self.assertEqual(french, jmdict_fr.pool_line("殿", "どの"))
        self.assertEqual(get_meaning(row, "en", VOCAB_FR), row["meaning"])

    def test_a_pool_word_with_no_french_keeps_its_english(self) -> None:
        self.assertEqual(jmdict_fr.pool_meaning({"kanji": "", "kana": "ぬぬぬぬ", "meaning": "x"}, "fr"), "x")

    def test_a_french_query_finds_pool_words_in_either_session(self) -> None:
        """« cheval » found one pool word where "horse" finds hundreds;
        accents folded, so « epee » finds « épée »."""
        self.assertGreater(jmdict_db.count_matching("cheval"), 10)
        self.assertGreater(jmdict_db.count_matching("epee"), 0)
        self.assertEqual(jmdict_db.count_matching("épée"), jmdict_db.count_matching("epee"))
        keys = {(r["kanji"], r["kana"]) for r in jmdict_db.page("cochon", 50, 0)}
        self.assertIn(("豚", "ぶた"), keys)


class CorpusSentenceTests(unittest.TestCase):
    def test_a_corpus_sentence_is_translated_for_a_french_reader(self) -> None:
        jp = next(ex["jp"] for _, examples in _deck_senses() for ex in examples)
        self.assertEqual(jmdict_fr.translation(jp, "the english", "fr"), (jmdict_fr.example(jp), "fr"))
        self.assertEqual(jmdict_fr.translation(jp, "the english", "en"), ("the english", "en"))
        self.assertEqual(jmdict_fr.translation("存在しない文。", "x", "fr"), ("x", "en"))


if __name__ == "__main__":
    unittest.main()
