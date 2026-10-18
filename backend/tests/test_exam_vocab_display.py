# A vocabulary paper shows a word in kana when its kanji are above the
# paper's level (plan 254); the placement test, which builds its context
# items through the same primitive without a level, is left as it was.
import random

from content.vocab_data import VOCAB_BY_LEVEL
from study import exam_vocab_gen as gen
from study.llm_shared import is_kanji, kanji_set_for_level


def test_a_word_above_the_levels_kanji_is_shown_in_kana():
    word = {"kanji": "溺れる", "kana": "おぼれる"}
    assert gen._display(word, "N3") == "おぼれる"
    assert gen._display(word, "N1") == "溺れる"
    assert gen._display({"kanji": "学校", "kana": "がっこう"}, "N5") == "学校"


def test_without_a_level_the_kanji_stays():
    assert gen._display({"kanji": "溺れる", "kana": "おぼれる"}) == "溺れる"


def test_a_context_mondai_for_a_paper_prints_only_the_levels_kanji():
    level = "N3"
    allowed = kanji_set_for_level(level)
    rng = random.Random(5)
    pool = [w for w in VOCAB_BY_LEVEL[level] if "/" not in (w.get("kanji") or "")]
    rng.shuffle(pool)
    spec = {"id": "moji_3", "official_number": 3, "count": 8}
    mondai = gen.build_vocab_context_mondai(spec, pool, set(), set(), rng, level, kana_beyond_level=True)
    shown = [c["textJp"] for q in mondai["questions"] for c in q["choices"]]
    assert shown and all(not is_kanji(ch) or ch in allowed for text in shown for ch in text)
