# ── The local analysis tier ───────────────────────────────────────
# Everything a Sentence breakdown needs that a language model is NOT
# required for: segmentation, readings, furigana, deck matches, SRS
# status, grammar points, JLPT grading. All of it is composed from
# modules that already existed -- morphology.tokenize (MeCab/UniDic),
# card_lookup's resolvers, furigana.align_deck, difficulty's grammar and
# level machinery -- none of which the phrase analyzer used before this.
#
# The one thing genuinely missing here is the contextual gloss ("what
# does this word mean IN THIS SENTENCE") and the prose explanation --
# both need a model, and both stay out of this module on purpose. See
# docs/adr/0001-two-tier-sentence-analysis.md for the split this module
# is one half of.
#
# analyze_local MUST stay pure: no database, no user_id, no imports from
# core/. That purity is what lets one Sentence's analysis be computed
# once and shared across every learner who asks about it -- attach_user_state
# is the separate, per-user half.
import logging

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, grammar_to_id
from study import morphology
from study.card_lookup import (
    resolve_lemma, resolve_kana, find_kanji_matches, card_stats,
    serializable_entry, VOCAB_STATUS_MODES, KANJI_STATUS_MODES,
    GRAMMAR_STATUS_MODES,
)
from study.furigana import align_deck
from study import difficulty

logger = logging.getLogger(__name__)

# Content-word part-of-speech classes, per morphology.py's _POS_MAP. Used
# to decide what counts toward unknown_count / off_deck_count below --
# particles and auxiliaries are grammar scaffolding, not vocabulary a
# learner is expected to have "learned" as a card.
_CONTENT_POS = frozenset({"noun", "verb", "adjective", "adverb"})


def _grammar_entries(sentence: str) -> list[dict]:
    """difficulty.points_in's (pattern, level, start, end) hits, resolved
    to a real catalogue entry and a card id. A hit that can't be
    resolved is dropped (logged, not raised) rather than shipped as a
    chip with nothing behind it -- never hand-construct the id string,
    since grammar_to_id's format is the one place that's allowed to
    know it."""
    out = []
    for pattern, level, start, end in difficulty.points_in(sentence):
        entry = next(
            (e for e in GRAMMAR_POINTS_BY_LEVEL.get(level, []) if e.get("pattern") == pattern),
            None,
        )
        if entry is None:
            logger.debug("points_in hit %r/%s has no catalogue entry; dropped", pattern, level)
            continue
        out.append({
            "pattern": pattern,
            "level": level,
            "start": start,
            "end": end,
            "raw_id": grammar_to_id(entry, level),
        })
    return out


def _token_dict(m: morphology.Morpheme) -> dict:
    vocab_match = None
    hit = resolve_lemma(m.lemma, m.lemma_reading) or resolve_kana(m.lemma_reading, m.pos, m.auxiliary_use)
    if hit:
        level, entry, raw_id = hit
        vocab_match = {"level": level, "raw_id": raw_id, "entry": serializable_entry(entry)}

    kanji_matches = [
        {"kanji": char, "level": level, "raw_id": raw_id, "entry": serializable_entry(entry)}
        for char, level, entry, raw_id in find_kanji_matches(m.surface)
    ]

    # Furigana goes over the surface AS WRITTEN, so it uses `reading`
    # (the inflected reading) -- not `lemma_reading`, which is the
    # dictionary form's reading and can differ from what's on the page.
    furigana = align_deck(m.surface, m.reading)

    return {
        "surface": m.surface, "start": m.start, "end": m.end,
        "lemma": m.lemma, "reading": m.reading, "pos": m.pos,
        "furigana": furigana,
        "vocab_match": vocab_match,
        "kanji_matches": kanji_matches,
    }


def analyze_local(text: str, level: str | None = None) -> dict:
    """Everything about a Sentence that needs no language model. Pure and
    user-independent, therefore cacheable and shareable across learners.

    `level` is the level to grade against; when omitted, grading uses the
    sentence's own estimated level (falling back to N5 if the sentence
    fits no level at all -- report() needs *some* level to grade against
    even for a sentence that fits nothing).
    """
    morphemes = morphology.tokenize(text)
    if morphemes is None:
        # No fallback to a worse analysis here -- see the module
        # docstring. A caller renders "analysis unavailable", not a
        # silently degraded one.
        return {
            "text": text, "tokens": [], "grammar": [],
            "level": None, "grade": None, "available": False,
        }

    tokens = [_token_dict(m) for m in morphemes]
    grammar = _grammar_entries(text)
    estimated = difficulty.estimate_level(text)
    grade_level = level or estimated or "N5"

    return {
        "text": text,
        "tokens": tokens,
        "grammar": grammar,
        "level": estimated,
        "grade": difficulty.report(text, grade_level),
        "available": True,
    }


def attach_user_state(analysis: dict, states: dict, user_id: str) -> dict:
    """Add per-learner SRS stats to an analyze_local result. Returns a
    NEW dict -- analyze_local's result is cacheable and shared, so this
    must never mutate its argument."""
    if not analysis.get("available"):
        return dict(analysis)

    tokens = []
    unknown_count = 0
    off_deck_count = 0

    for tok in analysis["tokens"]:
        new_tok = dict(tok)
        vocab_match = tok.get("vocab_match")
        kanji_matches = tok.get("kanji_matches") or []
        is_content_word = tok.get("pos") in _CONTENT_POS

        if vocab_match:
            new_tok["vocab_match"] = {
                **vocab_match,
                "stats": card_stats(states, user_id, vocab_match["raw_id"], VOCAB_STATUS_MODES),
            }
        if kanji_matches:
            new_tok["kanji_matches"] = [
                {**k, "stats": card_stats(states, user_id, k["raw_id"], KANJI_STATUS_MODES)}
                for k in kanji_matches
            ]

        # Off-deck (no card anywhere) vs. unknown (a card that isn't
        # learned yet) are counted separately and are NEVER the same
        # bucket: an off-deck word is something the app cannot teach,
        # not something the learner failed to learn. Merging the two
        # would make every real-world sentence -- every OCR'd photo,
        # every video caption -- look impossible, and would make the
        # i+1 signal (exactly one unknown word) permanently false on
        # exactly the input this feature exists to handle.
        if is_content_word:
            if vocab_match:
                status = new_tok["vocab_match"]["stats"]["status"]
                if status in ("not_started", "new"):
                    unknown_count += 1
            elif not kanji_matches:
                off_deck_count += 1

        tokens.append(new_tok)

    grammar = [
        {**g, "stats": card_stats(states, user_id, g["raw_id"], GRAMMAR_STATUS_MODES)}
        for g in analysis["grammar"]
    ]

    return {
        **analysis,
        "tokens": tokens,
        "grammar": grammar,
        "unknown_count": unknown_count,
        "off_deck_count": off_deck_count,
    }
