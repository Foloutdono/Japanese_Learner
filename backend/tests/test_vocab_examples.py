# 例文 -- the course's example sentences, corrected (plan 227):
# datas/vocab/example_fixes.json, a layer over the Tatoeba sentences
# JMdict files under the deck's words (content/example_fixes.py).
import pytest

from content import example_fixes, jmdict_fr
from content.vocab_data import VOCAB_BY_LEVEL
from content.vocab_extras import get_vocab_extras
from scripts.vocab_examples import _originals, problems


@pytest.fixture(scope="module")
def originals():
    return _originals()


def test_every_correction_is_of_a_shown_sentence_and_keeps_its_words(originals):
    found = [p for orig, fix in example_fixes.fixes().items() for p in problems({"orig": orig, **fix}, originals)]
    assert not found, "\n".join(found[:40])


def _first_rewritten():
    for orig, fix in example_fixes.fixes().items():
        if fix["jp"] != orig:
            return orig, fix
    pytest.skip("no rewritten sentence yet")


def test_a_card_shows_the_corrected_sentence_and_its_french(originals):
    orig, fix = _first_rewritten()
    word = next(w for w in originals[orig]["words"] if w["shown"])
    shown = get_vocab_extras(word["kanji"], word["kana"], word["meaning"], "fr")["examples"]
    jps = [ex["jp"] for ex in shown]
    assert fix["jp"] in jps and orig not in jps
    ex = shown[jps.index(fix["jp"])]
    assert ex["en"] == fix["en"] and ex["tr"] == fix["fr"] and ex["tr_lang"] == "fr"
    # ...and the French layer answers it wherever a sentence is looked up.
    assert jmdict_fr.example(fix["jp"]) == fix["fr"]


def test_a_correction_never_reaches_a_word_its_sentence_lost():
    # A sentence filed under a pool word keeps its original there when
    # the correction no longer carries the word.
    orig = "元の文。"
    fixed = {"jp": "新しい文。", "en": "New.", "fr": "Nouveau.", "why": "test"}
    saved = example_fixes.fixes
    example_fixes.fixes = lambda: {orig: fixed}
    try:
        assert example_fixes.for_word({"jp": orig, "en": "Old."}, lambda s: False) == {"jp": orig, "en": "Old."}
        assert example_fixes.for_word({"jp": orig, "en": "Old."}, lambda s: True)["jp"] == "新しい文。"
    finally:
        example_fixes.fixes = saved


def test_every_sentence_a_card_shows_has_its_french():
    missing = []
    for level, words in VOCAB_BY_LEVEL.items():
        for w in words:
            for ex in get_vocab_extras(w.get("kanji") or "", w["kana"], w.get("meaning", ""), "fr")["examples"]:
                if ex.get("tr_lang") != "fr":
                    missing.append(f"{level} {w.get('kanji') or w['kana']}: {ex['jp']}")
    assert not missing, "\n".join(missing[:40])
