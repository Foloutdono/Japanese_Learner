# 例文の語義 -- a deck word's sentences filed under the sense they use
# (plan 296): datas/vocab/example_senses.json, a layer over the sense
# JMdict files each Tatoeba sentence under (content/example_fixes.py).
import pytest

from content import example_fixes
from content.vocab_extras import get_vocab_extras
from scripts.example_senses import items, problems


@pytest.fixture(scope="module")
def known():
    return items()


def test_every_move_is_of_a_sentence_the_word_nests_and_names_its_sense(known):
    """A move names a sentence its word nests under a sense, a sense the
    page lists, and that sense's English as it was when it was filed: a
    sense list that moves under it (a curated row reordered, a correction
    that rewrote the sentence) fails here rather than file a sentence
    under a gloss nobody read it against."""
    found = []
    for key, by in example_fixes.refiled_all().items():
        for jp, entry in by.items():
            move = {"key": key, "jp": jp, "why": entry.get("why")}
            move.update({k: entry[k] for k in ("sense", "drop") if k in entry})
            issues = problems(move, known)
            if not issues and entry.get("sense") is not None \
                    and known[key]["senses"][str(entry["sense"])] != entry.get("gloss"):
                issues = [f"{key}: {jp[:24]}: sense {entry['sense']} is no longer {entry.get('gloss')!r}"]
            found += issues
    assert not found, "\n".join(found[:40])


def _with(moves):
    saved = example_fixes.refiled_all
    example_fixes.refiled_all = lambda: moves
    return saved


def test_a_move_files_the_sentence_under_its_sense_the_primary_first():
    plain = get_vocab_extras("渡す", "わたす", "to hand over", "en")
    by_number = {s["number"]: s["glossary"] for s in plain["senses"]}
    jp = next(ex["jp"] for ex in plain["examples"] if ex["sense_number"] == 1)
    saved = _with({"渡す::わたす": {jp: {"sense": 3, "gloss": by_number[3], "why": "test"}}})
    try:
        moved = get_vocab_extras("渡す", "わたす", "to hand over", "en")
    finally:
        example_fixes.refiled_all = saved
    ex = next(ex for ex in moved["examples"] if ex["jp"] == jp)
    assert ex["sense_number"] == 3 and ex["sense_glossary"] == by_number[3]
    # Nothing else moves, and the primary sense's sentences still lead.
    assert sorted(e["jp"] for e in moved["examples"]) == sorted(e["jp"] for e in plain["examples"])
    primary = {s["number"] for s in moved["senses"] if s["primary"]}
    leads = [e["sense_number"] in primary for e in moved["examples"]]
    assert leads == sorted(leads, reverse=True)


def test_a_sentence_of_no_sense_is_the_words_and_another_words_is_not_shown():
    plain = get_vocab_extras("渡す", "わたす", "to hand over", "en")
    first, second = [ex["jp"] for ex in plain["examples"]][:2]
    saved = _with({"渡す::わたす": {first: {"sense": None, "why": "test"},
                                   second: {"drop": True, "why": "test"}}})
    try:
        moved = get_vocab_extras("渡す", "わたす", "to hand over", "en")
    finally:
        example_fixes.refiled_all = saved
    shown = {ex["jp"]: ex for ex in moved["examples"]}
    assert shown[first]["sense_number"] is None and shown[first]["sense_glossary"] == "to hand over"
    assert second not in shown


def test_a_sense_the_list_no_longer_has_leaves_jmdicts_filing():
    plain = get_vocab_extras("渡す", "わたす", "", "en")
    ex = plain["examples"][0]
    saved = _with({"渡す::わたす": {ex["jp"]: {"sense": 99, "gloss": "gone", "why": "test"}}})
    try:
        moved = get_vocab_extras("渡す", "わたす", "", "en")
    finally:
        example_fixes.refiled_all = saved
    assert next(e for e in moved["examples"] if e["jp"] == ex["jp"])["sense_number"] == ex["sense_number"]


def test_a_move_is_held_to_the_senses_and_sentences_of_its_word(known):
    item = known["渡す::わたす"]
    jp = item["examples"][0]["jp"]
    here = item["examples"][0]["sense"]
    other = next(int(n) for n in item["senses"] if int(n) != here)
    assert problems({"key": "渡す::わたす", "jp": jp, "sense": other, "why": "x"}, known) == []
    assert problems({"key": "渡す::わたす", "jp": jp, "sense": None, "why": "x"}, known) == []
    assert problems({"key": "渡す::わたす", "jp": jp, "drop": True, "why": "x"}, known) == []
    assert problems({"key": "渡す::わたす", "jp": jp, "sense": here, "why": "x"}, known)  # no move
    assert problems({"key": "渡す::わたす", "jp": jp, "sense": 42, "why": "x"}, known)  # no such sense
    assert problems({"key": "渡す::わたす", "jp": jp, "sense": other, "why": ""}, known)
    assert problems({"key": "渡す::わたす", "jp": "ない文。", "sense": other, "why": "x"}, known)
    assert problems({"key": "渡す::わたす", "jp": jp, "sense": other, "drop": True, "why": "x"}, known)
