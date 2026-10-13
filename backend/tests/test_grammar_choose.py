"""
Choisir on every point (plan 200).

The ladder's Choisir steps ask the contrast drill, and 41 points had none
to ask: a particle their rivals share every sentence with, a form whose
letters are every verb's, a cause the detector cannot tell from a sequence.
Their Choisir steps quietly fell back to the flashcard. Each now carries a
`choose` list of questions written by hand (study/grammar_choose.py), and
the gate holds that none is left without: this file holds the other half,
that the questions are served, drawn and answered as the run expects.
"""
import copy
import random
import unittest

import pytest

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, find
from routes import grammar as grammar_route
from routes import station
from srs import ladder
from srs.models import CardState
from study import card_index, grammar_check
from study.grammar_check import check_entry
from study.grammar_choose import CHOICES, MIN_ITEMS, choose_items, choose_payload, cut
from study.grammar_examples import BLANK
from study.grammar_lesson import contrast_payload
from study.modes import MODES

ALL = [(level, entry) for level, entries in GRAMMAR_POINTS_BY_LEVEL.items() for entry in entries]
CHOOSING = [(level, entry) for level, entry in ALL if entry.get("choose")]
LADDER = MODES["grammar.ladder"]


def _ids(pairs):
    return [f"{level} {entry['pattern']}" for level, entry in pairs]


def _blanks(parts):
    return [p for p in parts if p.get("blank")]


# ── Every point is asked in Choisir ──────────────────────────────

@pytest.mark.parametrize("lang", ["en", "fr"])
def test_every_point_is_asked_a_real_contrast_on_every_step(lang):
    """No point of the catalogue is left to fall back to fill_in or the
    flashcard on Choisir: each is served a sentence with one hole and a
    choice that holds exactly one answer, whatever the turn."""
    for level, entry in ALL:
        assert card_index.contrast_ok(level, entry["pattern"]), f"{level} {entry['pattern']} is asked nothing on Choisir"
        for turn in range(6):
            drill = contrast_payload(level, entry, GRAMMAR_POINTS_BY_LEVEL[level], lang, random.Random(turn), turn=turn)
            where = f"{level} {entry['pattern']} turn {turn}"
            assert drill is not None, where
            assert len(_blanks(drill["furigana"])) == 1, where
            assert drill["answer"] in drill["choices"], where
            assert len(set(drill["choices"])) == len(drill["choices"]) >= 2, where
            assert drill["tr"], where


def test_the_ladder_serves_every_choisir_step_on_the_contrast_drill():
    """The route builds the ladder card at each Choisir step -- the three
    steps and the relapse -- on `grammar.contrast`, for every point."""
    for level, entry in ALL:
        for step, total in ((0, 0), (1, 1), (2, 2), (ladder.RELAPSE_PICK, 9)):
            state = CardState(card_id="u:x", mode=LADDER.key, total_reviews=total, is_learning=True,
                              learning_step=step, interval_days=0)
            if step == ladder.RELAPSE_PICK:
                state.interval_days = 21
            card = grammar_route._build_ladder_card(entry, level, GRAMMAR_POINTS_BY_LEVEL[level], LADDER, "en",
                                                    "learning", None, state)
            where = f"{level} {entry['pattern']} step {step}"
            assert card is not None and card["exercise"] == "grammar.contrast", where
            assert card["asked"] == "choose", where


def test_the_points_without_a_construire_are_asked_the_contrast_there_too():
    """Six points cannot be typed (no sentence where the detector can blank
    them once). Their Construire steps fall a rung, to the contrast drill --
    which now exists for them -- rather than to a flashcard."""
    from study import grammar_ladder
    for level, entry in ALL:
        if grammar_ladder.build_ok(level, entry["pattern"]):
            continue
        state = CardState(card_id="u:x", mode=LADDER.key, total_reviews=4, is_learning=False,
                          learning_step=4, interval_days=2)
        card = grammar_route._build_ladder_card(entry, level, GRAMMAR_POINTS_BY_LEVEL[level], LADDER, "en",
                                                "learning", None, state)
        assert card["exercise"] == "grammar.contrast", f"{level} {entry['pattern']}"


# ── The questions a point carries ────────────────────────────────

def test_a_point_with_questions_of_its_own_carries_enough_of_them():
    assert CHOOSING, "no point carries a `choose` list"
    for level, entry in CHOOSING:
        assert len(choose_items(entry)) >= MIN_ITEMS, f"{level} {entry['pattern']}"


@pytest.mark.parametrize("lang", ["en", "fr"])
def test_an_authored_question_is_drawn_as_the_run_expects(lang):
    for level, entry in CHOOSING:
        for n, item in enumerate(choose_items(entry)):
            where = f"{level} {entry['pattern']} choose {n}"
            drill = choose_payload(level, entry, item, lang, random.Random(n))
            right, wrong = item["choices"][0], item["choices"][1:]
            assert drill["answer"] == right, where
            assert sorted(drill["choices"]) == sorted(item["choices"]), where
            # the whole sentence, the right filling in its hole
            assert drill["jp"] == item["jp"].replace(BLANK, right), where
            assert len(_blanks(drill["furigana"])) == 1, where
            # what the card turns to is what stood in the hole
            assert "".join(p["text"] for p in drill["fill"]) == right, where
            sentence = "".join(
                "".join(p["text"] for p in drill["fill"]) if p.get("blank") else p["text"]
                for p in drill["furigana"]
            )
            assert sentence == drill["jp"], where
            # a wrong tile is answered, and only a wrong tile
            assert set(drill["why"]) == set(wrong), where
            assert all(drill["why"][w] for w in wrong), where
            # ruby only for a filling that has kanji, and spelling it
            assert set(drill["readings"]) <= set(item["choices"]), where
            for filling, parts in drill["readings"].items():
                assert "".join(p["text"] for p in parts) == filling, where
                assert any(p.get("reading") for p in parts), where
            assert drill["tr"] == item["tr"][lang], where


def test_the_turn_walks_a_points_questions_and_comes_round():
    level, entry = next((l, e) for l, e in CHOOSING if len(choose_items(e)) >= 4)
    seen = []
    for turn in range(len(choose_items(entry)) * 2):
        drill = contrast_payload(level, entry, GRAMMAR_POINTS_BY_LEVEL[level], "en", random.Random(0), turn=turn)
        seen.append(drill["jp"])
    n = len(choose_items(entry))
    assert len(set(seen[:n])) == n
    assert seen[:n] == seen[n:]


def test_the_choices_are_shuffled_but_the_answer_is_the_item_s_first():
    level, entry = CHOOSING[0]
    item = choose_items(entry)[0]
    orders = {tuple(choose_payload(level, entry, item, "en", random.Random(seed))["choices"]) for seed in range(20)}
    assert len(orders) > 1
    assert all(choose_payload(level, entry, item, "en", random.Random(seed))["answer"] == item["choices"][0]
               for seed in range(5))


def test_a_payload_is_its_own_copy():
    level, entry = CHOOSING[0]
    item = choose_items(entry)[0]
    first = choose_payload(level, entry, item, "en", random.Random(1))
    first["furigana"].append({"text": "x"})
    first["fill"].clear()
    first["readings"]["x"] = []
    second = choose_payload(level, entry, item, "en", random.Random(1))
    assert second["fill"] and "x" not in second["readings"] and second["furigana"][-1]["text"] != "x"


def test_the_card_carries_its_own_fillings_ruby_not_the_catalogues():
    """routes/grammar sends an authored question's readings as the card's
    choices_furigana; a contrast on patterns still reads them off the catalogue."""
    level, entry = next((l, e) for l, e in CHOOSING if e["pattern"] == "可能形 〜(ら)れる")
    state = CardState(card_id="u:x", mode=LADDER.key, total_reviews=0, is_learning=True, learning_step=0)
    card = grammar_route._build_ladder_card(entry, level, GRAMMAR_POINTS_BY_LEVEL[level], LADDER, "en",
                                            "learning", None, state)
    assert "readings" not in card["contrast"]
    assert set(card["choices_furigana"]) <= set(card["contrast"]["choices"])
    assert card["choices_furigana"], "a question whose fillings have kanji carries their ruby"

    level, entry = next((l, e) for l, e in ALL if e["pattern"] == "を")
    card = grammar_route._build_ladder_card(entry, level, GRAMMAR_POINTS_BY_LEVEL[level], LADDER, "en",
                                            "learning", None, state)
    assert set(card["contrast"]["choices"]) == {"を", "が", "に"}


def test_the_station_specimen_is_still_drawn_from_the_marked_sentence():
    """The landing page's specimen pairs a point's blank with its first
    example: an authored question is not that sentence, so it never stands in."""
    level, entry = next((l, e) for l, e in ALL if e["pattern"] == "です／だ")
    assert contrast_payload(level, entry, GRAMMAR_POINTS_BY_LEVEL[level], "en", random.Random(0), authored=False) is None
    assert station._grammar_line("en")["N5"]["card"]["jp"] == "が"


def test_a_filling_that_would_cut_a_word_s_reading_is_refused():
    # A ruby part is never cut: 今日 is read きょう as one word, so a hole
    # holding only 今 would blank 日 as well, and the card would say so.
    assert cut("＿＿＿日は、いい天気です。", "今") is None
    parts, fill = cut("＿＿＿は、いい天気です。", "今日")
    assert [(p["text"], p["reading"]) for p in fill] == [("今日", "きょう")]
    assert [p["text"] for p in parts if p.get("blank")] == [BLANK]


# ── The gate ─────────────────────────────────────────────────────

def _entry(pattern="は", level="N5"):
    found = find(pattern)
    assert found is not None and found[0] == level
    return copy.deepcopy(found[1])


class GateTests(unittest.TestCase):
    def _problems(self, entry, level="N5"):
        return [p for p in check_entry(level, entry) if "choose" in p or "Choisir" in p]

    def _says(self, entry, fragment, level="N5"):
        found = self._problems(entry, level)
        self.assertTrue(any(fragment in p for p in found), f"{fragment!r} not in {found}")

    def test_the_catalogue_s_questions_are_clean(self):
        self.assertEqual(grammar_check.problems(), [])

    def test_a_point_nothing_asks_in_choisir_fails_the_gate(self):
        entry = _entry("は")
        del entry["choose"]
        self._says(entry, "nothing asks it in Choisir")
        # ... and a point the matcher can read is held to a marked sentence as before
        verifiable = _entry("〜てください", "N5") if find("〜てください") else None
        if verifiable:
            self.assertFalse(any("nothing asks it" in p for p in check_entry("N5", verifiable)))

    def test_a_point_carries_a_question_for_each_step(self):
        entry = _entry("は")
        entry["choose"] = entry["choose"][:2]
        self._says(entry, "needs at least 3")

    def test_an_item_is_its_four_keys(self):
        entry = _entry("は")
        entry["choose"][0] = {"jp": entry["choose"][0]["jp"]}
        self._says(entry, "choose 0 must be")
        entry = _entry("は")
        entry["choose"][0]["extra"] = 1
        self._says(entry, "choose 0 must be")

    def test_the_hole_is_there_once_and_the_sentence_has_no_space(self):
        for jp, fragment in (
            ("テニスはしますが、ゴルフしません。", "must hold the blank"),
            ("テニス＿＿＿しますが、ゴルフ＿＿＿しません。", "must hold the blank"),
            ("テニスは しますが、ゴルフ＿＿＿しません。", "holds a space"),
        ):
            entry = _entry("は")
            entry["choose"][0]["jp"] = jp
            self._says(entry, fragment)

    def test_three_or_four_fillings_each_a_distinct_japanese_form(self):
        entry = _entry("は")
        entry["choose"][0]["choices"] = ["は", "が"]
        self._says(entry, "has 2 choices")
        entry = _entry("は")
        entry["choose"][0]["choices"] = ["は", "が", "も", "を", "に"]
        self._says(entry, "has 5 choices")
        entry = _entry("は")
        entry["choose"][0]["choices"] = ["は", "が", "が"]
        self._says(entry, "choices repeat")
        entry = _entry("は")
        entry["choose"][0]["choices"] = ["は", "ga", "も"]
        self._says(entry, "Japanese fillings")

    def test_both_languages_and_no_japanese_in_a_translation(self):
        entry = _entry("は")
        entry["choose"][0]["tr"] = {"en": "I play tennis, but I don't play golf.", "fr": ""}
        self._says(entry, "tr.fr is empty")
        entry = _entry("は")
        entry["choose"][0]["tr"]["en"] = "I play テニス, but not golf."
        self._says(entry, "tr holds Japanese")
        entry = _entry("は")
        entry["choose"][0]["why"]["fr"] = ""
        self._says(entry, "why.fr is empty")

    def test_the_level_s_kanji(self):
        entry = _entry("は")
        entry["choose"][0]["jp"] = "憂鬱はしますが、ゴルフ＿＿＿しません。"
        self._says(entry, "kanji above N5")

    def test_a_sentence_the_lesson_already_shows_is_refused(self):
        entry = _entry("は")
        entry["choose"][0] = {**entry["choose"][0], "jp": "今日＿＿＿天気がいいです。"}
        self._says(entry, "already shows")

    def test_the_same_question_is_not_asked_twice(self):
        entry = _entry("は")
        entry["choose"][1] = copy.deepcopy(entry["choose"][0])
        self._says(entry, "asks the sentence of choose 0 again")

    def test_the_right_filling_writes_the_point_where_the_hole_is(self):
        # は beside が and も: the first filling of a question about は must be は
        entry = _entry("は")
        entry["choose"][0]["choices"] = ["が", "は", "も"]
        self._says(entry, "does not write the point")

    def test_a_wrong_filling_that_writes_the_point_too_is_a_second_answer(self):
        # なかった is a ない-form as ない is: nothing in "I am someone who
        # doesn't eat fish" says the tense but the translation, so it must
        # be declared a slip by an author who vouches for it, never passed.
        entry = _entry("ない形 〜ない")
        entry["choose"][0]["jp"] = "わたしは、さかなを食べ＿＿＿人です。"
        entry["choose"][0]["choices"] = ["ない", "なかった", "ません"]
        entry["choose"][0].pop("slips", None)
        self._says(entry, "writes the point too")
        entry["choose"][0]["slips"] = ["なかった"]
        self.assertFalse(any("writes the point too" in p for p in self._problems(entry)))

    def test_a_slip_is_a_wrong_choice_named_once(self):
        entry = _entry("た形 〜た")
        entry["choose"][1]["slips"] = ["まった"]          # the right one
        self._says(entry, "slips must be wrong choices")
        entry = _entry("た形 〜た")
        entry["choose"][1]["slips"] = ["まちた", "まちた"]
        self._says(entry, "slips must be wrong choices")

    def test_a_point_of_alternatives_may_be_answered_wrong_with_another_of_its_forms(self):
        # 〜つ／〜人／〜枚 is learned by choosing among them
        entry = _entry("助数詞 〜つ／〜人／〜枚")
        self.assertEqual(self._problems(entry), [])


class DetectorPositionTests(unittest.TestCase):
    def test_written_in_reads_the_detector_at_the_hole(self):
        w = grammar_check._written_in
        jp = "テニスはしますが、ゴルフはしません。"
        self.assertTrue(w(jp, (3, 4), "は", "N5"))      # the first は
        self.assertTrue(w(jp, (12, 13), "は", "N5"))    # the second は
        self.assertFalse(w(jp, (0, 3), "は", "N5"))     # テニス
        # a point the detector cannot be trusted on says nothing
        self.assertIsNone(w("あしたはいそがしかったです。", (3, 6), "〜て（理由）", "N5"))


if __name__ == "__main__":
    unittest.main()
