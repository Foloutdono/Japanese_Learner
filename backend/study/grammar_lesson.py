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
from study.grammar_examples import blanked_payload, example_payload
from study.grammar_match import contains_pattern, verifiable
from study.mcq import pick_distractors

logger = logging.getLogger(__name__)

# The choices a contrast card offers, the answer included.
CONTRAST_CHOICES = 4


def lesson_payload(level: str, entry: dict, lang: str) -> dict:
    """
    {register, steps: [{kind, text}], compare: [{pattern, raw_id, level,
    meaning, text}], examples: [example_payload...]}

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
            "raw_id": grammar_to_id(r_entry, r_level),
            "level": r_level,
            "meaning": gloss(r_entry, lang),
            "text": localise({"en": rival["en"], "fr": rival["fr"]}, lang),
        })
    return {
        "register": entry.get("register"),
        "steps": [
            {"kind": step["kind"], "text": localise({"en": step["en"], "fr": step["fr"]}, lang)}
            for step in entry.get("steps", [])
        ],
        "compare": compare,
        "examples": [example_payload(ex, pattern, lang) for ex in entry.get("examples", [])],
    }


def contrast_payload(level: str, entry: dict, grammar_list: list[dict], lang: str,
                     rng: random.Random | None = None) -> dict | None:
    """
    {jp, tr, furigana (one blank part), choices: [pattern...], answer}
    for one of the point's contrast examples, or None when it has none
    -- the pool filter (card_index.contrast_ok) should have kept such a
    point out, so None is defensive rather than expected.

    Choices are the rivals the lesson names, first; when fewer than
    CONTRAST_CHOICES - 1 of them exist, same-level verifiable patterns
    that do NOT also occur in the sentence fill the gap (the rule
    study/placement.py uses, so an item never has two right answers).
    """
    rng = rng or random
    pattern = entry["pattern"]
    pool = [ex for ex in entry.get("examples", []) if ex.get("contrast")]
    if not pool:
        return None
    example = rng.choice(pool)
    sentence = example["jp"]

    rivals = [
        r["pattern"] for r in entry.get("compare", [])
        if r["pattern"] != pattern and not (verifiable(r["pattern"]) and contains_pattern(sentence, r["pattern"]))
    ]
    choices = list(dict.fromkeys(rivals))[: CONTRAST_CHOICES - 1]
    if len(choices) < CONTRAST_CHOICES - 1:
        fillers = [
            g["pattern"] for g in grammar_list
            if g["pattern"] != pattern and g["pattern"] not in choices
            and verifiable(g["pattern"]) and not contains_pattern(sentence, g["pattern"])
        ]
        choices += pick_distractors(fillers, lambda p: p, pattern, CONTRAST_CHOICES - 1 - len(choices))
    choices.append(pattern)
    rng.shuffle(choices)

    return {**blanked_payload(example, pattern, lang), "choices": choices, "answer": pattern}
