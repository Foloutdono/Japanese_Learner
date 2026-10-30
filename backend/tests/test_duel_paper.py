"""対戦 — the sprint's questions (plan 279, study/duel_paper.py).

A choice is told apart by understanding, never by its look: the guards
the mock exam's seeds are held to (study/exam_tells.py,
study/exam_seed.py) hold over many sprint papers here.
"""
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from study.duel_paper import (CHOICES, ITEMS, LADDER, LEVELS, MIX_MIN, NOVICE, OWN_FLOOR, PAPER_REV, blend,
                              build_paper, level_of, mix_of, served, shares)
from study.exam_seed import LENGTH_TELL, LIKENESS_TELL, ROTATION_TELL
from study.exam_tells import centre, outlier

# A sprint asks three choices (plan 288): the exam's margins over a blind
# pick of four, held over a blind pick of three.
BLIND = 1 / CHOICES
LENGTH = (BLIND - (0.25 - LENGTH_TELL[0]), BLIND + (LENGTH_TELL[1] - 0.25))
LIKENESS = BLIND + (LIKENESS_TELL - 0.25)
ROTATION = BLIND + (ROTATION_TELL - 0.25)

BACKEND = Path(__file__).resolve().parent.parent
# Enough papers to measure a rate, few enough to stay quick.
SEEDS = {"N5": 16, "N4": 16, "N3": 16, "N2": 6, "N1": 6}


@pytest.fixture(scope="module")
def papers():
    return {level: [build_paper(seed, level) for seed in range(1, SEEDS[level] + 1)] for level in LEVELS}


def _texts(item, lang="fr"):
    return item["choices"][lang] if item["kind"] == "word" else item["choices"]


def test_a_paper_is_full_and_says_its_revision(papers):
    for level, built in papers.items():
        for paper in built:
            assert paper["rev"] == PAPER_REV and paper["level"] == level
            assert len(paper["items"]) == ITEMS, (level, paper["seed"])


def test_every_item_has_three_distinct_choices_and_one_key(papers):
    assert CHOICES == 3
    for built in papers.values():
        for paper in built:
            for item in paper["items"]:
                for lang in (("fr", "en") if item["kind"] == "word" else ("fr",)):
                    texts = _texts(item, lang)
                    assert len(texts) == 3 and len(set(texts)) == 3, item
                assert 0 <= item["answer"] < 3


def test_n1_asks_no_spelling():
    # The exam asks no 表記 at N1; an N1 paper's spellings are the lower levels'.
    assert all(item["kind"] != "writing" or item["level"] != "N1" for item in build_paper(3, "N1")["items"])


def test_the_kinds_alternate(papers):
    for paper in papers["N4"]:
        kinds = [item["kind"] for item in paper["items"]]
        assert kinds.count("word") >= ITEMS // 3
        assert kinds.count("reading") > 0 and kinds.count("writing") > 0
        # never three of the same kind in a row while the others last
        assert all(len({kinds[i], kinds[i + 1], kinds[i + 2]}) > 1 for i in range(0, 20))


def _look_rates(items):
    """How often the centre and the outlier of three kana or kanji
    choices, where one choice alone is it, is the key."""
    out = {}
    for name, role in (("centre", centre), ("outlier", outlier)):
        who = [(role(item["choices"]), item["answer"]) for item in items if item["kind"] != "word"]
        who = [(w, a) for w, a in who if w is not None]
        out[name] = (sum(w == a for w, a in who) / len(who), len(who)) if who else (BLIND, 0)
    return out


def test_no_japanese_choice_set_gives_its_key_away(papers):
    # Three choices always have a centre: the cut from the exam's four is
    # what keeps the key the centre, or the outlier, no more often than a
    # blind pick would find it (duel_paper._left_out).
    for level, built in papers.items():
        rates = _look_rates([item for paper in built for item in paper["items"]])
        rate, n = rates["centre"]
        assert n < 40 or 2 * BLIND - LIKENESS <= rate <= LIKENESS, (level, rates)
    every = [item for built in papers.values() for paper in built for item in paper["items"]]
    for name, (rate, n) in _look_rates(every).items():
        assert 2 * BLIND - LIKENESS <= rate <= LIKENESS, (name, rate, n)


def test_a_word_is_never_asked_against_a_meaning_it_shares_a_word_with(papers):
    from study.exam_vocab_gen import _content_words
    for paper in papers["N5"] + papers["N3"]:
        for item in paper["items"]:
            if item["kind"] != "word":
                continue
            right = _content_words(item["choices"]["en"][item["answer"]])
            for i, other in enumerate(item["choices"]["en"]):
                if i != item["answer"]:
                    assert not right & _content_words(other), item


def _rates(items, lang):
    longest = shortest = 0.0
    for item in items:
        sizes = [len(t) for t in _texts(item, lang)]
        size = sizes[item["answer"]]
        if size == max(sizes):
            longest += 1 / sizes.count(size)
        if size == min(sizes):
            shortest += 1 / sizes.count(size)
    return longest / len(items), shortest / len(items)


@pytest.mark.parametrize("level", ["N5", "N4", "N3"])
def test_length_says_nothing(papers, level):
    low, high = LENGTH
    items = [item for paper in papers[level] for item in paper["items"]]
    words = [item for item in items if item["kind"] == "word"]
    for lang in ("fr", "en"):
        longest, shortest = _rates(words, lang)
        assert low <= longest <= high and low <= shortest <= high, (level, lang, longest, shortest)
    kanji = [item for item in items if item["kind"] != "word"]
    longest, shortest = _rates(kanji, "fr")
    assert low <= longest <= high and low <= shortest <= high, (level, longest, shortest)


@pytest.mark.parametrize("level", ["N5", "N4", "N3"])
def test_the_keys_spread_over_the_slots_without_stepping(papers, level):
    slots = [0] * CHOICES
    steps = on = 0
    for paper in papers[level]:
        keys = [item["answer"] for item in paper["items"]]
        for k in keys:
            slots[k] += 1
        for a, b in zip(keys, keys[1:]):
            steps += 1
            on += b == (a + 1) % CHOICES
    total = sum(slots)
    assert all(BLIND - 0.07 <= n / total <= BLIND + 0.07 for n in slots), slots
    assert on / steps <= ROTATION


def test_a_served_question_carries_no_key():
    item = build_paper(5, "N5")["items"][0]
    shown = served(item, 0)
    assert "answer" not in shown and shown["n"] == 0 and shown["choices"] == item["choices"]


def test_the_same_seed_builds_the_same_paper():
    assert build_paper(42, "N4") == build_paper(42, "N4")
    assert build_paper(42, "N4") != build_paper(43, "N4")


def _digest_in_a_fresh_process(hash_seed: str) -> str:
    code = (
        "import json, hashlib\n"
        "from study.duel_paper import build_paper\n"
        "p = [build_paper(9, lv) for lv in ('N5', 'N3')]\n"
        "print(hashlib.sha256(json.dumps(p, ensure_ascii=False, sort_keys=True).encode()).hexdigest())\n"
    )
    env = {**os.environ, "PYTHONHASHSEED": hash_seed}
    out = subprocess.run([sys.executable, "-c", code], cwd=BACKEND, env=env,
                         capture_output=True, text=True, timeout=600, check=True)
    return out.stdout.strip().splitlines()[-1]


def test_the_paper_is_the_same_in_any_process():
    # The placement test's rule: anything built by iterating a set is
    # sorted before a seeded random touches it.
    assert _digest_in_a_fresh_process("1") == _digest_in_a_fresh_process("2")
    here = [build_paper(9, lv) for lv in ("N5", "N3")]
    digest = hashlib.sha256(json.dumps(here, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    assert digest == _digest_in_a_fresh_process("3")


# ── The mix (plan 286, the owner's B) ───────────────────────────────

MIXES = (9, 17, 26)


@pytest.fixture(scope="module")
def mixed():
    return {mix: [build_paper(seed, mix=mix) for seed in range(1, 11)] for mix in MIXES}


def test_an_elo_stands_between_two_levels():
    # Each level's starting Elo is the whole level; 200 points a level.
    assert [mix_of(e) for e in (500, 1000, 1180, 1340, 1400, 1720, 1800, 2400)] == [-10, 0, 9, 17, 20, 36, 40, 40]
    # The beginner's stop is a level under N5 (plan 289).
    assert [mix_of(e) for e in (800, 900)] == [-10, -5]
    assert blend(-10) == [(NOVICE, 1.0)] and blend(-3) == [(NOVICE, 0.3), ("N5", 0.7)]
    assert [level_of(m) for m in (-10, -6, -5, 0)] == [NOVICE, NOVICE, "N5", "N5"]
    assert blend(9) == [("N5", 0.1), ("N4", 0.9)]
    assert blend(20) == [("N3", 1.0)]
    assert blend(36) == [("N2", 0.4), ("N1", 0.6)]
    # A paper's level is where most of its questions are, the upper at half.
    assert [level_of(m) for m in (0, 4, 5, 9, 17, 36, 40)] == ["N5", "N5", "N4", "N4", "N3", "N1", "N1"]


def test_a_mix_asks_each_level_its_share(mixed):
    for mix, built in mixed.items():
        for paper in built:
            assert paper["rev"] == PAPER_REV and paper["mix"] == mix and paper["level"] == level_of(mix)
            assert len(paper["items"]) == ITEMS
            asked = {lv: sum(1 for item in paper["items"] if item["level"] == lv) for lv, _ in shares(mix)}
            for lv, share in shares(mix):
                assert abs(asked[lv] - share * ITEMS) <= 2, (mix, asked)
    # The levels are dealt in among each other, not one after the other.
    levels = [item["level"] for item in mixed[17][0]["items"]]
    assert all(lv in levels[:40] and lv in levels[-40:] for lv in ("N5", "N4", "N3"))
    assert build_paper(42, mix=17) == build_paper(42, mix=17) != build_paper(43, mix=17)
    # A whole level's mix is that level's paper.
    assert build_paper(5, mix=20) == build_paper(5, "N3")


def test_a_mixed_paper_keeps_the_guards(mixed):
    low, high = LENGTH
    items = [item for built in mixed.values() for paper in built for item in paper["items"]]
    assert all(len(_texts(item)) == CHOICES for item in items)
    for name, (rate, n) in _look_rates(items).items():
        assert 2 * BLIND - LIKENESS <= rate <= LIKENESS, (name, rate, n)
    words = [item for item in items if item["kind"] == "word"]
    for lang in ("fr", "en"):
        longest, shortest = _rates(words, lang)
        assert low <= longest <= high and low <= shortest <= high, (lang, longest, shortest)
    steps = on = 0
    for built in mixed.values():
        for paper in built:
            keys = [item["answer"] for item in paper["items"]]
            steps += len(keys) - 1
            on += sum(b == (a + 1) % CHOICES for a, b in zip(keys, keys[1:]))
    assert on / steps <= ROTATION


# ── The levels below, and a third kanji (plan 288) ──────────────────

def test_a_paper_brings_the_levels_below_its_own_and_keeps_its_level():
    # Each level brings the words of the levels below it, in their share
    # of the words from there down; the duel's level keeps OWN_FLOOR.
    assert shares(-10) == [(NOVICE, 1.0)]
    for mix in range(MIX_MIN, 41):
        parts = dict(shares(mix))
        assert abs(sum(parts.values()) - 1) < 1e-9, mix
        assert parts[level_of(mix)] >= OWN_FLOOR - 1e-9, (mix, parts)
        # every stop from the beginner's up to the blend's top is asked, nothing above
        top = LADDER.index(blend(mix)[-1][0])
        assert list(parts) == list(LADDER[: top + 1]), (mix, parts)
    assert OWN_FLOOR == 0.3
    for level in LADDER:
        built = build_paper(4, level)["items"]
        own = sum(1 for item in built if item["level"] == level)
        assert own >= OWN_FLOOR * ITEMS - 2, (level, own)


def test_a_third_of_a_paper_is_kanji(papers):
    for level in ("N5", "N4", "N3", "N2"):
        for paper in papers[level]:
            kanji = sum(1 for item in paper["items"] if item["kind"] != "word")
            assert ITEMS // 3 - 6 <= kanji <= ITEMS // 3, (level, paper["seed"], kanji)


# ── The beginner's stop (plan 289) ──────────────────────────────────

def test_the_beginners_paper_is_the_basics_words_in_kana_and_the_kana():
    import re
    from content.kana_data import HIRAGANA_BASIC, KATAKANA_BASIC
    from study.duel_paper import _basics_keys
    romaji = {e["kana"]: e["romaji"] for e in HIRAGANA_BASIC + KATAKANA_BASIC}
    kanji = re.compile(r"[\u4e00-\u9fff]")
    for seed in range(1, 6):
        paper = build_paper(seed, NOVICE)
        assert paper["level"] == NOVICE and paper["mix"] == MIX_MIN and len(paper["items"]) == ITEMS
        kinds = {item["kind"] for item in paper["items"]}
        assert kinds == {"word", "kana"}, kinds
        for item in paper["items"]:
            assert item["level"] == NOVICE
            assert not kanji.search(item["prompt"]), item
            if item["kind"] == "kana":
                assert item["choices"][item["answer"]] == romaji[item["prompt"]]
                # the wrong readings are as long as the right one
                assert len({len(c) for c in item["choices"]}) == 1, item
                assert len(set(item["choices"])) == CHOICES
    keys = _basics_keys()
    assert len(keys) > 150 and all("::" in k for k in keys)


def test_the_kana_say_nothing_by_their_look():
    items = [item for seed in range(1, 11) for item in build_paper(seed, NOVICE)["items"] if item["kind"] == "kana"]
    for name, (rate, n) in _look_rates(items).items():
        assert n < 40 or 2 * BLIND - LIKENESS <= rate <= LIKENESS, (name, rate, n)
    slots = [0] * CHOICES
    for item in items:
        slots[item["answer"]] += 1
    assert all(BLIND - 0.1 <= n / len(items) <= BLIND + 0.1 for n in slots), slots


def test_n5_brings_the_beginners_kana_below_it():
    parts = dict(shares(0))
    assert set(parts) == {NOVICE, "N5"} and parts["N5"] >= OWN_FLOOR
    kinds = {item["kind"] for item in build_paper(2, "N5")["items"] if item["level"] == NOVICE}
    assert "kana" in kinds
