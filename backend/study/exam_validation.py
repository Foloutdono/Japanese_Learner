# ── Quality gates ─────────────────────────────────────────────
# Run before any generated paper is written to exam_papers. Checks
# here are the difference between "well-formed JSON" and "an item
# that's actually fair to grade" — a generator that always puts the
# right answer in position 3, or that tests the same word twice, is
# well-formed and still a bad exam. A paper that fails any of these
# should be regenerated (retry the failing mondai, not the whole
# paper — see exam_kanji_gen.py), never served as-is.
#
# Scoped to what today's generators actually produce (mcq-text
# questions, no passages, no LLM) — passage-length and kanji-gate
# re-verification land with the reading/grammar generators that need
# them.

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


def validate_answer_balance(questions: list[dict]) -> list[str]:
    if len(questions) < MIN_QUESTIONS_FOR_BALANCE_CHECK:
        return []

    positions: dict[str, int] = {}
    for q in questions:
        choices = q.get("choices") or []
        for i, c in enumerate(choices):
            if c.get("id") == q.get("answer"):
                positions[str(i)] = positions.get(str(i), 0) + 1
                break

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


def validate_questions(questions: list[dict]) -> list[str]:
    errors = []
    for q in questions:
        errors.extend(validate_mcq_question(q))
    errors.extend(validate_answer_balance(questions))
    errors.extend(validate_no_duplicate_targets(questions))
    return errors
