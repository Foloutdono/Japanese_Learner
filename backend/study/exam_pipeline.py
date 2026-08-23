# ── Shared paper-generation pipeline ─────────────────────────────
# The generate → flatten → validate → repair → retry skeleton every
# LLM-backed exam_*_gen.py module (grammar, vocabulary, listening,
# reading) re-implemented separately, down to repeating the same "an
# answer-position skew is a shuffle problem, not a content problem"
# comment four times. exam_kanji_gen.py isn't part of this family — it
# has no LLM call and no retry loop of its own; it's a deterministic
# mondai builder exam_vocab_gen.py calls into directly.
#
# What stays behind the seam, per generator, because it's REAL
# variation and not duplication:
#   - generate_once(level, seed) -> paper dict: the actual mondai/
#     passage generation, wildly different per section. May raise
#     GenerationFailed.
#   - flatten(mondai_list) -> list[dict]: paper shapes differ (grammar's
#     cloze blanks live under passages; reading's questions live under
#     nested passages; vocab/listening are flat mondai -> questions
#     already).
#   - check_duplicates: whether a repeated promptJp is a real defect.
#     True for vocab (promptJp IS the target word's identity); False
#     for grammar/listening/reading (promptJp is question/sentence text
#     the real JLPT itself reuses across items) — see
#     exam_validation.validate_content's own docstring.
#   - max_attempts: vocab defaults to more than the others because one
#     attempt assembles five heterogeneous mondai types (kanji-reading,
#     kanji-orthography, vocab-context, vocab-paraphrase, vocab-usage)
#     where the others assemble one or two — more chances a reshuffle-
#     and-retry recovers something. Left as an explicit argument at
#     each call site rather than a shared constant, so that reasoning
#     stays visible where it's made rather than buried here.
import random

from study.exam_gen_utils import GenerationFailed
from study.exam_validation import validate_content, repair_answer_balance


def generate_paper(generate_once, flatten, *, level: str, seed: int,
                    max_attempts: int, check_duplicates: bool, paper_label: str) -> dict:
    """Runs generate_once up to max_attempts times, re-seeding each
    attempt (seed + attempt) so a failed attempt doesn't just repeat
    the same failure. A paper that fails validate_content triggers a
    full retry (different content is needed); a paper whose only
    problem is validate_answer_balance's shuffle skew is repaired in
    place via repair_answer_balance instead — no LLM calls spent fixing
    a problem a reshuffle already fixes for free.

    generate_once(level, seed) -> paper dict, single top-level section
    at paper["sections"][0], may raise GenerationFailed.
    flatten(mondai_list) -> every question/blank in paper["sections"][0]
    ["mondai"], flattened to the shape exam_validation.py's checks
    expect.
    """
    last_errors: list[str] = []
    for attempt in range(max_attempts):
        try:
            paper = generate_once(level, seed + attempt)
        except GenerationFailed as e:
            last_errors = [str(e)]
            continue

        flat = flatten(paper["sections"][0]["mondai"])
        content_errors = validate_content(flat, check_duplicates=check_duplicates)
        if not content_errors and repair_answer_balance(flat, random.Random(seed + attempt)):
            return paper
        last_errors = content_errors or ["answer position skewed across the paper (could not repair by reshuffling)"]

    raise GenerationFailed(
        f"Could not generate a valid {level} {paper_label} paper after {max_attempts} attempts: {last_errors}"
    )
