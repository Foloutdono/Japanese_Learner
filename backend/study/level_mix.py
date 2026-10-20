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

The grammar above the level is the mock papers' reading of it
(study/exam_levels.grammar_above, plan 257), since plan 261: the points
the detector finds, less the misreadings exam_levels names. It used to
be difficulty.grammar_over_level, which matches the catalogue's patterns
as letters: 天気が was 〜気がする, ありがとうございます 〜でございます,
となりに 〜なりに, and the comprehension seeds were written around them.
"""
import logging

from study import difficulty, exam_levels, morphology
from study.analysis import CONTENT_POS, analyze_local
from study.card_lookup import find_segments_in_text, resolve_morpheme
from study.llm_shared import is_kanji

logger = logging.getLogger(__name__)

# One in twenty. Stated as a ratio and compared as `ratio > MAX_RATIO`,
# which for an integer count over n items is the same rule as
# `count > floor(MAX_RATIO * n)` -- one hard word is tolerated from 20
# content words up, two from 40, three from 60.
MAX_RATIO = 0.05

# The word classes words_at_level never counts as vocabulary: the
# grammar's words, and the pieces of a word -- the ご of ご協力 (filed
# under 御, N1), the 的 of 経済的, a counter's 冊.
_FUNCTION_POS = frozenset({"particle", "auxiliary", "conjunction", "symbol", "prefix", "suffix"})


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
    exam_levels.grammar_above's (see the module's doc), reported for a
    caller's feedback and never part of a verdict here.
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
    for i, m in enumerate(morphemes):
        if m.pos not in CONTENT_POS or len(m.surface) < 2 or m.surface in seen:
            continue
        seen.add(m.surface)
        known = (
            resolve_morpheme(morphemes, i)
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
        "grammar_over": exam_levels.grammar_above(text, level),
        "off_deck": off_deck,
    }


def words_at_level(text: str, level: str, pattern: str = "") -> list[dict]:
    """The deck words of exactly `level` that `text` uses, each once --
    the words the breakdown tags with that level's chip (plan 192).

    level_mix above counts what sits ABOVE a level and nothing else,
    which is all a generated passage needs. The curated reading bank
    needed the other half: an N2 sentence that passes every "nothing
    above N2" gate can still be an N5 sentence carrying one N2 point,
    and 92% of the N2 bank was exactly that. This counts what the
    learner reading the breakdown sees: study/analysis.analyze_local's
    tokens, each matched to a deck card (a pool word carries no level
    and is not counted).

    `pattern` is the grammar point the text was written for. A word the
    point is spelled with (つもり in 〜つもりです, 最中 in 〜最中に) is the
    point, not vocabulary the sentence brings, and is left out.

    [] without the tokenizer: nothing was measured, and a caller that
    enforces a floor must skip rather than fail (tests gate on
    morphology.MORPHOLOGY_AVAILABLE).

    Returns [{"raw_id", "kanji", "kana", "surface"}] in sentence order.
    """
    result = analyze_local(text)
    if not result.get("available"):
        return []
    point = pattern.replace("〜", "")
    out: list[dict] = []
    seen: set[str] = set()
    for tok in result["tokens"]:
        # A particle or a conjunction the lookup files under a kanji
        # card (くらい under 位, または's また under 又) is the grammar's,
        # not a word the sentence brings, and a prefix or a suffix is a
        # piece of one. Not CONTENT_POS: a な-adjective (豊か, UniDic's
        # 形状詞) comes through as "other" and is exactly the vocabulary
        # being counted.
        if tok.get("pos") in _FUNCTION_POS:
            continue
        match = tok.get("vocab_match") or {}
        if match.get("pool") or match.get("level") != level:
            continue
        raw_id = match.get("raw_id")
        if not raw_id or raw_id in seen:
            continue
        entry = match.get("entry") or {}
        forms = [tok.get("surface", ""), tok.get("lemma", ""), entry.get("kanji", "")]
        if point and any(form and form in point for form in forms):
            continue
        seen.add(raw_id)
        out.append({
            "raw_id": raw_id,
            "kanji": entry.get("kanji", ""),
            "kana": entry.get("kana", ""),
            "surface": tok.get("surface", ""),
        })
    return out


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
