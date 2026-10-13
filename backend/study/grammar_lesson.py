"""
A grammar point as a lesson, and as a contrast drill (plan 087).

lesson_payload() is what every reading surface shows -- the run's gate
before a new card, the door on every card, the station's lesson sheet,
the dictionary's plate: the steps, the neighbours, the examples, all in
the learner's language. contrast_payload() is the drill that asks the
"why not the other one" the lesson explains: one of the point's
contrast examples with the pattern blanked, and the rivals as the
choices.
"""
import logging
import random

from content.grammar_points_data import find, gloss, grammar_to_id, localise
from study.grammar_choose import choose_items, choose_payload
from study.grammar_examples import (
    blank_span, blanked_payload, example_payload, pattern_furigana, structure_furigana,
)
from study.grammar_match import contains_pattern, verifiable
from study.mcq import pick_distractors

logger = logging.getLogger(__name__)

# The choices a contrast card offers, the answer included.
CONTRAST_CHOICES = 4


def lesson_payload(level: str, entry: dict, lang: str) -> dict:
    """
    {pattern_furigana, structure_furigana, register, steps: [{kind, text}],
    compare: [{pattern, furigana, raw_id, level, meaning, text}],
    examples: [example_payload...]}

    `pattern_furigana` and `structure_furigana` are the plate's headword
    and formation as ruby, and a rival's `furigana` its pattern's (the
    catalogue's own readings, study/grammar_examples); every caller
    already puts the pattern and the formation beside the lesson.

    A rival the catalogue no longer holds is dropped with a warning
    rather than shipped as a door onto nothing. The gate makes that
    impossible on a committed catalogue; this is for the moment between
    an edit and its test.
    """
    pattern = entry["pattern"]
    compare = []
    for rival in entry.get("compare", []):
        found = find(rival["pattern"])
        if found is None:
            logger.warning("%s %s compares %r, which is not in the catalogue", level, pattern, rival["pattern"])
            continue
        r_level, r_entry = found
        compare.append({
            "pattern": r_entry["pattern"],
            "furigana": pattern_furigana(r_entry["pattern"], r_entry.get("reading")),
            "raw_id": grammar_to_id(r_entry, r_level),
            "level": r_level,
            "meaning": gloss(r_entry, lang),
            "text": localise({"en": rival["en"], "fr": rival["fr"]}, lang),
        })
    return {
        "pattern_furigana": pattern_furigana(pattern, entry.get("reading")),
        "structure_furigana": structure_furigana(entry),
        "register": entry.get("register"),
        "steps": [
            {"kind": step["kind"], "text": localise({"en": step["en"], "fr": step["fr"]}, lang)}
            for step in entry.get("steps", [])
        ],
        "compare": compare,
        "examples": [example_payload(ex, pattern, lang) for ex in entry.get("examples", [])],
    }


def contrast_payload(level: str, entry: dict, grammar_list: list[dict], lang: str,
                     rng: random.Random | None = None, turn: int | None = None,
                     example: dict | None = None, offer: str | None = None,
                     authored: bool = True) -> dict | None:
    """
    {jp, tr, furigana (one blank part), choices: [pattern...], answer}
    `turn` picks the sentence deterministically where given (the
    ladder's review count). `example` is the sentence itself, one of the
    point's contrast examples, where the caller has chosen it (the tour's
    quiz, which asks each sentence once, plan 195); `offer` is a rival
    that must stand among the choices, for a question asked from its
    side: the sentence is the rival's, the point the wrong answer to it.
    for one of the point's contrast examples, or None when it has none
    -- the pool filter (card_index.contrast_ok) should have kept such a
    point out, so None is defensive rather than expected.

    The pool is the point's marked sentences and, where it has them, its
    own `choose` questions (plan 200, study/grammar_choose.py), which are
    drawn the same way and answered by their own fillings rather than by
    patterns. `authored=False` leaves those out, for the one caller that
    draws a specimen from the marked sentence beside it (routes/station).

    Choices are the rivals the lesson names, first; when fewer than
    CONTRAST_CHOICES - 1 of them exist, same-level verifiable patterns
    that do NOT also occur in the sentence fill the gap (the rule
    study/placement.py uses, so an item never has two right answers).

    A point the stems cannot point at (a bare particle, plan 190) is
    drawn only on a sentence the detector blanks (blank_span), and is
    offered its named rivals alone: a particle's gap takes too many
    other particles -- パン＿食べます takes だけ, まで and から as well
    as を -- for a filler to be certainly wrong, and its author marked
    the sentence against the rivals only.
    """
    rng = rng or random
    pattern = entry["pattern"]
    checkable = verifiable(pattern)
    if example is None:
        pool = [ex for ex in entry.get("examples", []) if ex.get("contrast")]
        if not checkable:
            pool = [ex for ex in pool if blank_span(ex["jp"], pattern, level)]
        if authored:
            pool += choose_items(entry)
        if not pool:
            return None
        if turn is None:
            example = rng.choice(pool)
        else:
            # The ladder's Choisir asks another sentence each review (plan
            # 194): the pool in a fixed order per point, walked by the turn.
            order = list(pool)
            random.Random(f"contrast:{level}:{pattern}").shuffle(order)
            example = order[turn % len(order)]
        if "choices" in example:
            return choose_payload(level, entry, example, lang, rng)
    sentence = example["jp"]

    rivals = [
        r["pattern"] for r in entry.get("compare", [])
        if r["pattern"] != pattern and not (verifiable(r["pattern"]) and contains_pattern(sentence, r["pattern"]))
    ]
    if offer in rivals:
        rivals.remove(offer)
        rivals.insert(0, offer)
    choices = list(dict.fromkeys(rivals))[: CONTRAST_CHOICES - 1]
    if checkable and len(choices) < CONTRAST_CHOICES - 1:
        fillers = [
            g["pattern"] for g in grammar_list
            if g["pattern"] != pattern and g["pattern"] not in choices
            and verifiable(g["pattern"]) and not contains_pattern(sentence, g["pattern"])
        ]
        choices += pick_distractors(fillers, lambda p: p, pattern, CONTRAST_CHOICES - 1 - len(choices))
    if not choices:
        return None
    choices.append(pattern)
    rng.shuffle(choices)

    # What each named rival is not (plan 194): the lesson's own line on it,
    # said when that rival is the choice taken -- the trap explained.
    why = {
        r["pattern"]: localise({"en": r["en"], "fr": r["fr"]}, lang)
        for r in entry.get("compare", []) if r["pattern"] in choices
    }
    return {**blanked_payload(example, pattern, lang, level), "choices": choices, "answer": pattern, "why": why}
