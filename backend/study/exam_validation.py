# ── Quality gates ─────────────────────────────────────────────
# Run before any generated paper is written to exam_papers. Checks
# here are the difference between "well-formed JSON" and "an item
# that's actually fair to grade" — a generator that always puts the
# right answer in position 3, or that tests the same word twice, is
# well-formed and still a bad exam. A paper that fails any of these
# should be regenerated (retry the failing mondai, not the whole
# paper — see exam_kanji_gen.py), never served as-is.
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


def validate_passage_length(text: str, target_chars: int, tolerance: float = 0.2) -> list[str]:
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


def validate_questions(questions: list[dict], check_duplicates: bool = True) -> list[str]:
    # check_duplicates=False for reading-comprehension and grammar
    # questions: their promptJp is the QUESTION/SENTENCE text, not a
    # test-item identity the way a vocab/kanji target word is — the
    # real JLPT itself reuses boilerplate phrasing across different
    # items, so flagging that as a duplicate would reject fine content.
    errors = []
    for q in questions:
        # Shape-dispatch: sentence-order questions ({pieces, order,
        # starIndex}) have no "choices" field at all, so
        # validate_mcq_question would reject every one of them.
        if "pieces" in q:
            errors.extend(validate_sentence_order_question(q))
        else:
            errors.extend(validate_mcq_question(q))
    errors.extend(validate_answer_balance(questions))
    if check_duplicates:
        errors.extend(validate_no_duplicate_targets(questions))
    return errors
