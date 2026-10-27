"""対戦 — the sprint's questions (plan 276, study/duel_paper.py).

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

from study.duel_paper import ITEMS, LEVELS, PAPER_REV, build_paper, served
from study.exam_seed import LENGTH_TELL, LIKENESS_TELL, ROTATION_TELL
from study.exam_tells import centre, outlier, tell

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


def test_every_item_has_four_distinct_choices_and_one_key(papers):
    for built in papers.values():
        for paper in built:
            for item in paper["items"]:
                for lang in (("fr", "en") if item["kind"] == "word" else ("fr",)):
                    texts = _texts(item, lang)
                    assert len(texts) == 4 and len(set(texts)) == 4, item
                assert 0 <= item["answer"] < 4


def test_n1_asks_no_spelling():
    assert all(item["kind"] != "writing" for item in build_paper(3, "N1")["items"])


def test_the_kinds_alternate(papers):
    for paper in papers["N4"]:
        kinds = [item["kind"] for item in paper["items"]]
        assert kinds.count("word") >= ITEMS // 3
        assert kinds.count("reading") > 0 and kinds.count("writing") > 0
        # never three of the same kind in a row while the others last
        assert all(len({kinds[i], kinds[i + 1], kinds[i + 2]}) > 1 for i in range(0, 20))


def test_no_japanese_choice_set_gives_its_key_away(papers):
    for built in papers.values():
        for paper in built:
            for item in paper["items"]:
                if item["kind"] == "word":
                    continue
                choices = item["choices"]
                assert tell(choices) is None, item
                assert item["answer"] not in (centre(choices), outlier(choices)), item


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
    low, high = LENGTH_TELL
    items = [item for paper in papers[level] for item in paper["items"]]
    words = [item for item in items if item["kind"] == "word"]
    for lang in ("fr", "en"):
        longest, shortest = _rates(words, lang)
        assert low <= longest <= high and low <= shortest <= high, (level, lang, longest, shortest)
    kanji = [item for item in items if item["kind"] != "word"]
    longest, shortest = _rates(kanji, "fr")
    assert longest <= high and shortest <= high, (level, longest, shortest)


@pytest.mark.parametrize("level", ["N5", "N4", "N3"])
def test_likeness_says_nothing(papers, level):
    items = hits = 0
    for paper in papers[level]:
        for item in paper["items"]:
            if item["kind"] == "word":
                continue
            middle = centre(item["choices"])
            if middle is not None:
                items += 1
                hits += middle == item["answer"]
    assert items == 0 or hits / items <= LIKENESS_TELL


@pytest.mark.parametrize("level", ["N5", "N4", "N3"])
def test_the_keys_spread_over_the_slots_without_stepping(papers, level):
    slots = [0, 0, 0, 0]
    steps = on = 0
    for paper in papers[level]:
        keys = [item["answer"] for item in paper["items"]]
        for k in keys:
            slots[k] += 1
        for a, b in zip(keys, keys[1:]):
            steps += 1
            on += b == (a + 1) % 4
    total = sum(slots)
    assert all(0.18 <= n / total <= 0.32 for n in slots), slots
    assert on / steps <= ROTATION_TELL


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
