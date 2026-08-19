# ── Quality gates ─────────────────────────────────────────────
# Run before any generated paper is written to exam_papers. Checks
# here are the difference between "well-formed JSON" and "an item
# that's actually fair to grade" — a generator that always puts the
# right answer in position 3, or that tests the same word twice, is
# well-formed and still a bad exam. A paper that fails any of these
# should be regenerated (retry the failing mondai, not the whole
# paper — see exam_kanji_gen.py), never served as-is.
#
# One check here, validate_answer_balance, is different in kind from
# every other: it's a property of the whole set's SHUFFLE (which
# on-screen position the correct choice lands in across many
# questions), not of any individual question's content. Every other
# check can only be satisfied by generating different text — this one
# can be satisfied by re-shuffling text that's already fine. See
# repair_answer_balance below, which every generate_*_paper() retry
# loop now calls before paying for a full LLM regeneration.
import random

from study.llm_shared import sentence_kanji_ok

# A generator that always puts the correct answer in the same slot is
# a bug, even though it never emits an outright-wrong item; on a paper
# with only a handful of questions this can't be perfectly uniform, so
# this catches a real skew rather than expecting an exact 25/25/25/25 split.
MAX_ANSWER_POSITION_SHARE = 0.6
MIN_QUESTIONS_FOR_BALANCE_CHECK = 8


def validate_mcq_question(question: dict) -> list[str]:
    errors = []
    choices = question.get("choices") or []
    if len(choices) != 4:
        errors.append(f"{question.get('id')}: expected 4 choices, got {len(choices)}")
        return errors  # further checks assume 4 real choices

    texts = [c.get("textJp") for c in choices]
    if len(set(texts)) != len(texts):
        errors.append(f"{question.get('id')}: duplicate choice text {texts}")

    ids = {c.get("id") for c in choices}
    if question.get("answer") not in ids:
        errors.append(f"{question.get('id')}: answer {question.get('answer')!r} not among choice ids {ids}")

    return errors


def validate_sentence_order_question(question: dict) -> list[str]:
    # Sentence-order (文の文法2 / SentenceOrderBlock) questions have a
    # different shape entirely: {pieces, order, starIndex, answer} —
    # no "choices" field at all. validate_mcq_question would reject
    # every one of these as "0 choices, expected 4"; this is the
    # shape-correct equivalent.
    errors = []
    pieces = question.get("pieces") or []
    if len(pieces) != 4:
        errors.append(f"{question.get('id')}: expected 4 pieces, got {len(pieces)}")
        return errors

    texts = [p.get("textJp") for p in pieces]
    if len(set(texts)) != len(texts):
        errors.append(f"{question.get('id')}: duplicate piece text {texts}")

    ids = {p.get("id") for p in pieces}
    order = question.get("order") or []
    if set(order) != ids or len(order) != 4:
        errors.append(f"{question.get('id')}: order {order} doesn't match piece ids {ids}")

    star_index = question.get("starIndex")
    if not isinstance(star_index, int) or not (0 <= star_index < 4):
        errors.append(f"{question.get('id')}: invalid starIndex {star_index!r}")
    elif order and order[star_index] != question.get("answer"):
        errors.append(f"{question.get('id')}: answer {question.get('answer')!r} doesn't match order[starIndex]")

    if question.get("answer") not in ids:
        errors.append(f"{question.get('id')}: answer {question.get('answer')!r} not among piece ids {ids}")

    return errors


def _answer_position(question: dict) -> int | None:
    """0-3 index of the correct option within whichever list the
    question actually offers (choices, or pieces for sentence-order),
    or None if it can't be determined."""
    options = question.get("choices") or question.get("pieces") or []
    for i, o in enumerate(options):
        if o.get("id") == question.get("answer"):
            return i
    return None


def validate_answer_balance(questions: list[dict]) -> list[str]:
    if len(questions) < MIN_QUESTIONS_FOR_BALANCE_CHECK:
        return []

    positions: dict[str, int] = {}
    for q in questions:
        i = _answer_position(q)
        if i is not None:
            positions[str(i)] = positions.get(str(i), 0) + 1

    total = sum(positions.values())
    if total == 0:
        return []

    worst = max(positions.values())
    if worst / total > MAX_ANSWER_POSITION_SHARE:
        return [f"answer position skewed: {positions} over {total} questions"]
    return []


def validate_no_duplicate_targets(questions: list[dict]) -> list[str]:
    seen = set()
    errors = []
    for q in questions:
        key = q.get("promptJp")
        if key in seen:
            errors.append(f"{q.get('id')}: duplicate target {key!r} tested twice in one paper")
        seen.add(key)
    return errors


def validate_passage_length(text: str, target_chars: int, tolerance: float | None = None) -> list[str]:
    # A flat ±20% is unreasonably tight in absolute terms on a short
    # target (N5's 80-character 短文 gets only ±16 characters) even
    # though it's generous on a long one (N1's 1000-character passage
    # gets ±200) — live-diagnosed 2026-08 as part of the SAME
    # short-target overshoot exam_reading_gen.py's prompt now warns
    # about explicitly; this is the safety-net half of that fix, not a
    # replacement for prompting the model to actually aim shorter.
    if tolerance is None:
        tolerance = max(0.2, 40 / target_chars)
    length = len(text)
    lo, hi = target_chars * (1 - tolerance), target_chars * (1 + tolerance)
    if not (lo <= length <= hi):
        return [f"passage length {length} outside target {target_chars} ({lo:.0f}-{hi:.0f})"]
    return []


def validate_kanji_gate(text: str, level: str) -> list[str]:
    # LLM-generated text drifts from instructions often enough that this
    # is worth re-checking rather than trusting the prompt constraint —
    # same caution routes/reading.py's own comments already document.
    if not sentence_kanji_ok(text, level):
        return [f"text contains kanji outside {level}'s allowed set: {text[:60]!r}..."]
    return []


def validate_content(questions: list[dict], check_duplicates: bool = True) -> list[str]:
    """Every validate_questions check EXCEPT validate_answer_balance —
    i.e. every check that can only be satisfied by generating
    DIFFERENT content. Split out from validate_questions so a caller
    can tell apart "this paper needs new content" (worth spending more
    LLM calls on) from "this paper's content is fine, only the
    on-screen shuffle is skewed" (fixable for free — see
    repair_answer_balance). check_duplicates has the same meaning as
    on validate_questions."""
    errors = []
    for q in questions:
        # Shape-dispatch: sentence-order questions ({pieces, order,
        # starIndex}) have no "choices" field at all, so
        # validate_mcq_question would reject every one of them.
        if "pieces" in q:
            errors.extend(validate_sentence_order_question(q))
        else:
            errors.extend(validate_mcq_question(q))
    if check_duplicates:
        errors.extend(validate_no_duplicate_targets(questions))
    return errors


def validate_questions(questions: list[dict], check_duplicates: bool = True) -> list[str]:
    # check_duplicates=False for reading-comprehension and grammar
    # questions: their promptJp is the QUESTION/SENTENCE text, not a
    # test-item identity the way a vocab/kanji target word is — the
    # real JLPT itself reuses boilerplate phrasing across different
    # items, so flagging that as a duplicate would reject fine content.
    return validate_content(questions, check_duplicates) + validate_answer_balance(questions)


def _reshuffle_options(question: dict, rng: random.Random) -> None:
    """Re-randomizes ON-SCREEN POSITION only, in place — every option's
    text and which one is correct are unchanged, so this never affects
    validate_content's checks, only validate_answer_balance's.

    Sentence-order questions keep their correct sequence in "order" /
    "starIndex" / "answer" independent of display order, so reshuffling
    just their "pieces" display list is enough — nothing else needs
    updating. MCQ-shaped questions ("choices" + "answer") don't have
    that separation, so this rebuilds the choice list in a new random
    order and re-points "answer" at whichever id now holds the text
    that was previously correct."""
    if "pieces" in question:
        rng.shuffle(question["pieces"])
        return

    choices = question.get("choices")
    if not choices:
        return
    correct_text = next((c["textJp"] for c in choices if c["id"] == question.get("answer")), None)
    if correct_text is None:
        return  # already malformed — validate_content will catch it, nothing to repair here

    ids = [c["id"] for c in choices]  # canonical id order (e.g. c1..c4), positions are what we're re-randomizing
    texts = [c["textJp"] for c in choices]
    rng.shuffle(texts)
    question["choices"] = [{"id": i, "textJp": t} for i, t in zip(ids, texts)]
    question["answer"] = next(i for i, t in zip(ids, texts) if t == correct_text)


def repair_answer_balance(questions: list[dict], rng: random.Random, max_tries: int = 25) -> bool:
    """Tries to satisfy validate_answer_balance by re-shuffling each
    question's on-screen option order — no content changes, no LLM
    calls. Mutates `questions` in place (each item is a live reference
    into the paper dict a caller already built) and returns True the
    moment the balance check passes, leaving that fix applied. Returns
    False (having still tried, and left the LAST attempted shuffle in
    place) if max_tries is exhausted without reaching balance — at
    that point the caller should fall back to a real regeneration.

    This exists because validate_answer_balance is the one check a
    paper can fail for a reason that has nothing to do with any
    individual question's quality. Every generate_*_paper() used to
    throw away and re-generate EVERY question in a section — burning a
    full LLM call per question all over again — whenever this was the
    ONLY thing wrong, which is exactly the outcome of a model's own
    tendency to favor certain answer positions when writing
    correctIndex itself, not a sign of anything actually being poorly
    written."""
    if not validate_answer_balance(questions):
        return True
    for _ in range(max_tries):
        for q in questions:
            _reshuffle_options(q, rng)
        if not validate_answer_balance(questions):
            return True
    return False
