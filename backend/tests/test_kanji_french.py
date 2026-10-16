"""Every kanji the course teaches has a French meaning (plan 210).

KANJIDIC2's French stopped short of 219 deck characters, and a French
learner read their cards, their choices and their dictionary plates in
English. datas/kanji/kanji_meanings_fr.json is the app's own French for
them, folded into kanji.sqlite3 by scripts/build_kanji_db.py; this holds
the database and the file to each other and to the deck."""
import json
import os
import sqlite3
import unittest

from content.kanji_data import KANJI_BY_LEVEL
from content.kanji_meanings import KANJI_FR

_BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_FILE = os.path.join(_BASE, "datas", "kanji", "kanji_meanings_fr.json")
_DB = os.path.join(_BASE, "datas", "kanji", "kanji.sqlite3")


class KanjiFrenchTests(unittest.TestCase):
    def test_every_deck_kanji_has_a_french_meaning(self) -> None:
        missing = [e["kanji"] for level in KANJI_BY_LEVEL.values() for e in level
                   if not KANJI_FR.get(e["kanji"])]
        self.assertEqual(missing, [], f"deck kanji with no French: {''.join(missing)}")

    def test_the_database_carries_the_supplement(self) -> None:
        """The file is applied: a supplement edited without re-running
        `python -m scripts.build_kanji_db --french-only` would ship
        nothing."""
        with open(_FILE, encoding="utf-8") as f:
            supplement = json.load(f)
        conn = sqlite3.connect(f"file:{_DB}?mode=ro", uri=True)
        try:
            stale = [c for c, fr in supplement.items()
                     if conn.execute("SELECT meaning_fr FROM kanji WHERE char = ?", (c,)).fetchone()[0] != fr]
        finally:
            conn.close()
        self.assertEqual(stale, [], "re-run python -m scripts.build_kanji_db --french-only")

    def test_the_supplement_is_french_and_deck_only(self) -> None:
        with open(_FILE, encoding="utf-8") as f:
            supplement = json.load(f)
        deck = {e["kanji"] for level in KANJI_BY_LEVEL.values() for e in level}
        self.assertEqual([c for c in supplement if c not in deck], [])
        self.assertTrue(all(v.strip() for v in supplement.values()))


if __name__ == "__main__":
    unittest.main()
