# ── Exam scoring ──────────────────────────────────────────────
# Server-authoritative port of frontend/src/exam/examService.js's
# flattenQuestions/scoreAttempt (pure functions, no I/O there either)
# so an attempt is graded against the paper actually stored in
# exam_papers rather than whatever the client happened to hold.
#
# Deliberately drops the old client-side `scorePct` field entirely
# rather than fixing its formula: it divided one section's correct
# count by the WHOLE paper's question count (examService.js:124), so a
# perfect single-section run displayed 37%. Every consumer now reads
# perSection[sectionId]["pct"] instead — a real, section-scoped
# percentage. This is still a stand-in for the official per-level
# sectional pass thresholds (see the JLPT blueprint plan) — a fixed 60%
# cutoff, not yet the real basis points per scoring section — that
# lands with backend/study/exam_blueprint.py.


def flatten_questions(exam: dict) -> list[dict]:
    out = []
    for section in exam["sections"]:
        for mondai in section["mondai"]:
            _push_mondai_questions(section, mondai, out)

    # Renumber continuously per section, overriding whatever "number" a
    # generator set on each question (every generator numbers its own
    # mondai's items starting at 1, since a mondai is built in
    # isolation from its neighbors — matching the real exam's own
    # numbering, which runs continuously through a whole section and
    # only resets between different sections, needs a pass over the
    # complete flattened list). Two Q1s and a Q2 on one result screen,
    # from three different mondai that each restarted at 1, was the
    # bug this fixes.
    next_number: dict[str, int] = {}
    for q in out:
        sid = q["sectionId"]
        next_number[sid] = next_number.get(sid, 0) + 1
        q["number"] = next_number[sid]

    return out


def _push_mondai_questions(section: dict, mondai: dict, out: list[dict]) -> None:
    common = {
        "sectionId": section["id"],
        "sectionLabel": section.get("label"),
        "mondaiId": mondai["id"],
        "mondaiNumber": mondai["number"],
        "type": mondai["type"],
        # Mondai-level extras some renderers need alongside the
        # question itself (table-reading's flyer is the only one so
        # far) — only added when present, mirroring the JS original.
        **({"flyer": mondai["flyer"]} if mondai.get("flyer") else {}),
    }
    for q in mondai.get("questions") or []:
        out.append({**common, **q})
    for passage in mondai.get("passages") or []:
        for q in passage.get("questions") or []:
            out.append({**common, "passage": passage, **q})
        for q in passage.get("blanks") or []:
            out.append({**common, "passage": passage, **q})


def score_attempt(exam: dict, answers: dict) -> dict:
    questions = flatten_questions(exam)
    per_section: dict[str, dict] = {}
    review = []
    correct = 0

    for q in questions:
        given = answers.get(q["id"])
        is_correct = given is not None and given == q["answer"]
        if is_correct:
            correct += 1

        section_stats = per_section.setdefault(q["sectionId"], {"correct": 0, "total": 0})
        section_stats["total"] += 1
        if is_correct:
            section_stats["correct"] += 1

        review.append({
            "id": q["id"],
            "sectionId": q["sectionId"],
            "mondaiId": q["mondaiId"],
            "given": given,
            "answer": q["answer"],
            "isCorrect": is_correct,
        })

    for stats in per_section.values():
        stats["pct"] = round(100 * stats["correct"] / stats["total"]) if stats["total"] else 0

    return {
        "total": len(questions),
        "correct": correct,
        "perSection": per_section,
        "review": review,
    }
