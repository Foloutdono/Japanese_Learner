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


# ── The sentences written where JMdict gives a word none ─────


@pytest.fixture(scope="module")
def gap_cards():
    from scripts.vocab_examples import _gap_cards
    return _gap_cards()


def test_every_written_sentence_shows_its_word_at_its_level(gap_cards):
    from scripts.vocab_examples import PER_WORD, _added_found, _taken
    entries = [{"key": key, "level": level, **ex}
               for (level, key) in gap_cards
               for ex in example_fixes.written().get(key, [])]
    found = _added_found(entries, gap_cards, _taken())
    assert not found, "\n".join(found[:40])
    stray = set(example_fixes.written()) - {key for _, key in gap_cards}
    assert not stray, f"written sentences for words JMdict now gives some: {sorted(stray)[:20]}"
    assert all(PER_WORD[0] <= len(exs) <= PER_WORD[1] for exs in example_fixes.written().values())


def test_a_word_jmdict_gives_no_sentence_shows_the_written_ones_in_french():
    written = example_fixes.written()
    if not written:
        pytest.skip("no written sentence yet")
    for level, words in VOCAB_BY_LEVEL.items():
        for w in words:
            key = f"{w.get('kanji') or ''}::{w['kana']}"
            if key in written:
                shown = get_vocab_extras(w.get("kanji") or "", w["kana"], w.get("meaning", ""), "fr")["examples"]
                assert [ex["jp"] for ex in shown] == [ex["jp"] for ex in written[key]]
                assert [ex["tr"] for ex in shown] == [ex["fr"] for ex in written[key]]
                assert jmdict_fr.example(written[key][0]["jp"]) == written[key][0]["fr"]
                return


def test_every_deck_word_shows_a_sentence(gap_cards):
    """Plan 227 wrote two for each of the 1,128 words JMdict gave none.
    Ratchet: lower the bound as words gain sentences, never raise it."""
    without = sorted(key for _, key in gap_cards if key not in example_fixes.written())
    assert len(without) <= 1128, without[:20]
