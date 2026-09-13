"""
Is this TEXT at this JLPT level, taken as a whole?

study/difficulty.py answers that for one sentence, and answers it with a
verdict: one word above the level and the sentence is not the level.
That is the right rule for the curated bank -- a sentence is picked or
it is not -- and the wrong one for a passage a model has just written
to order. A 250-character text holds thirty or forty content words, and
a single N3 word among them is not what makes it an N3 text; a dozen
would be. So this module grades the MIX: how much of the text's
vocabulary, and how many of its kanji, sit above the level asked for,
against a tolerance (MAX_RATIO -- one word in twenty, one kanji in
twenty).

The vocabulary count is difficulty.vocab_over_level's, deliberately.
Counting every token's own deck level instead reports a plain N5
paragraph as a THIRD over-level (measured, 2026-09-13): the tokenizer
cuts 七時, 日本語 and 図書館 into pieces the deck files at N3 and N4,
and する resolves to its kanji spelling 為る, which the deck files at
N3. vocab_over_level's exclusions -- a kana-only segment, a
one-character segment, a segment that splits into easier words, the
stem of an easier verb -- are exactly the guards the ratio needs, and
they are not re-implemented here. Words the deck does not know at all
are NOT counted (the deck is 8k words, not a language: difficulty.py's
own reasoning), but they are NAMED in the message, because the one
reader of these messages is the model that wrote the text, on its next
attempt.

The messages are written for that reader: an instruction naming the
offenders, in the shape study/exam_validation.py's validators use, so
exam_reading_gen's feedback loop can pass them through untouched. They
deliberately avoid the words "outside" and "allowed set", which route a
message into that loop's kanji branch (exam_reading_gen._as_feedback).
"""
import logging

from study import difficulty, morphology
from study.analysis import CONTENT_POS
from study.card_lookup import find_segments_in_text, resolve_lemma, resolve_kana
from study.llm_shared import is_kanji

logger = logging.getLogger(__name__)

# One in twenty. Stated as a ratio and compared as `ratio > MAX_RATIO`,
# which for an integer count over n items is the same rule as
# `count > floor(MAX_RATIO * n)` -- one hard word is tolerated from 20
# content words up, two from 40, three from 60.
MAX_RATIO = 0.05


def _empty(available: bool) -> dict:
    return {
        "available": available,
        "content_tokens": 0,
        "vocab_over": [], "vocab_over_count": 0, "vocab_ratio": 0.0,
        "kanji_total": 0, "kanji_over": [], "kanji_over_count": 0, "kanji_ratio": 0.0,
        "grammar_over": [],
        "off_deck": [],
    }


def level_mix(text: str, level: str, allow_kanji: str = "") -> dict:
    """How much of `text` sits above `level`, in words and in kanji.

    Returns {"available", "content_tokens", "vocab_over": [{word, level,
    count}], "vocab_over_count", "vocab_ratio", "kanji_total",
    "kanji_over": [{kanji, count}], "kanji_over_count", "kanji_ratio",
    "grammar_over": [(pattern, level)], "off_deck": [word]}.

    `available` is False when the tokenizer is not there, and then every
    count is 0 and no validator below reaches a verdict: a text cannot
    be rejected on evidence that was never gathered.

    `allow_kanji` exempts characters from the kanji count -- the same
    escape difficulty.report offers, for the same case: a text asked to
    demonstrate a grammar point has to contain that point, and a few
    are spelled with a kanji the deck files above the level that
    teaches them.

    Vocabulary is counted by OCCURRENCE over the content words (nouns,
    verbs, adjectives, adverbs -- study/analysis.py's CONTENT_POS), and
    kanji by occurrence over every kanji in the text. grammar_over is
    reported for a caller's feedback and is never part of a verdict:
    the substring matcher behind it has known false positives on
    generated text (see tests/test_difficulty_points.py).
    """
    morphemes = morphology.tokenize(text)
    if morphemes is None:
        logger.warning("level_mix: tokenizer unavailable, no verdict for %r", text[:40])
        return _empty(False)

    content = [m for m in morphemes if m.pos in CONTENT_POS]

    # -- Vocabulary --
    segments = find_segments_in_text(text)
    over = difficulty.vocab_over_level(text, level, segments)
    over_levels = dict(over)
    counts: dict[str, int] = {}
    for seg in segments:
        word = seg.get("text", "")
        if word in over_levels:
            counts[word] = counts.get(word, 0) + 1
    vocab_over = [{"word": w, "level": lvl, "count": counts.get(w, 1)} for w, lvl in over]
    vocab_over_count = sum(entry["count"] for entry in vocab_over)
    vocab_ratio = vocab_over_count / len(content) if content else 0.0

    # -- Kanji --
    allowed = difficulty.kanji_set(level)
    kanji_total = 0
    over_kanji: dict[str, int] = {}          # insertion order = first appearance
    for c in text:
        if not is_kanji(c):
            continue
        kanji_total += 1
        if c not in allowed and c not in allow_kanji:
            over_kanji[c] = over_kanji.get(c, 0) + 1
    kanji_over = [{"kanji": c, "count": n} for c, n in over_kanji.items()]
    kanji_over_count = sum(over_kanji.values())
    kanji_ratio = kanji_over_count / kanji_total if kanji_total else 0.0

    # -- Words the deck does not know --
    # Named, never counted. The resolvers are the analyzer's own
    # (study/analysis._token_dict), so "off-deck" here means the same
    # thing it means on the breakdown the learner will read.
    off_deck: list[str] = []
    seen: set[str] = set()
    for m in content:
        if len(m.surface) < 2 or m.surface in seen:
            continue
        seen.add(m.surface)
        known = (
            resolve_lemma(m.lemma, m.lemma_reading)
            or resolve_kana(m.lemma_reading, m.pos, m.auxiliary_use)
            or difficulty.word_level(m.surface)
            or difficulty.word_level(m.lemma)
        )
        if not known:
            off_deck.append(m.surface)

    return {
        "available": True,
        "content_tokens": len(content),
        "vocab_over": vocab_over,
        "vocab_over_count": vocab_over_count,
        "vocab_ratio": vocab_ratio,
        "kanji_total": kanji_total,
        "kanji_over": kanji_over,
        "kanji_over_count": kanji_over_count,
        "kanji_ratio": kanji_ratio,
        "grammar_over": difficulty.grammar_over_level(text, level),
        "off_deck": off_deck,
    }


def _pct(ratio: float) -> str:
    return f"{round(ratio * 100)}%"


def validate_vocab_mix(text: str, level: str, max_ratio: float = MAX_RATIO,
                       mix: dict | None = None) -> list[str]:
    """One instruction naming every over-level word, or [] when the text
    is within tolerance (or could not be measured). `mix` is level_mix's
    result when the caller already has it."""
    mix = mix if mix is not None else level_mix(text, level)
    if not mix["available"] or mix["vocab_ratio"] <= max_ratio:
        return []
    named = ", ".join(f"{e['word']} ({e['level']})" for e in mix["vocab_over"])
    message = (
        f"vocabulary above {level}: {named} -- {mix['vocab_over_count']} of "
        f"{mix['content_tokens']} content words ({_pct(mix['vocab_ratio'])}, the limit is "
        f"{_pct(max_ratio)}). Replace each of them with a word a JLPT {level} learner knows, "
        f"or rewrite the sentence around it."
    )
    if mix["off_deck"]:
        message += (
            " Words the deck does not know and were not counted: "
            + ", ".join(mix["off_deck"]) + "."
        )
    return [message]


def validate_kanji_mix(text: str, level: str, max_ratio: float = MAX_RATIO,
                       allow_kanji: str = "", mix: dict | None = None) -> list[str]:
    """One instruction naming every over-level kanji, or []."""
    mix = mix if mix is not None else level_mix(text, level, allow_kanji)
    if not mix["available"] or mix["kanji_ratio"] <= max_ratio:
        return []
    named = "".join(e["kanji"] for e in mix["kanji_over"])
    return [
        f"kanji above {level}: {named} -- {mix['kanji_over_count']} of {mix['kanji_total']} "
        f"kanji ({_pct(mix['kanji_ratio'])}, the limit is {_pct(max_ratio)}). Write each of "
        f"those characters in hiragana and keep the rest of the word in kanji."
    ]


def validate_level_mix(text: str, level: str, max_ratio: float = MAX_RATIO,
                       allow_kanji: str = "") -> list[str]:
    """Both gates over one measurement: vocabulary first, then kanji."""
    mix = level_mix(text, level, allow_kanji)
    return (validate_vocab_mix(text, level, max_ratio, mix)
            + validate_kanji_mix(text, level, max_ratio, allow_kanji, mix))
