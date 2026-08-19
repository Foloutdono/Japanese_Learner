# ── Shared generator utilities ────────────────────────────────
# Small pieces every exam_*_gen.py module needs, factored out once a
# second generator (exam_vocab_gen.py) needed the same
# GenerationFailed/make_choices exam_kanji_gen.py already had.
import random

from study.llm_shared import allowed_kanji_for_level


class GenerationFailed(Exception):
    """Raised when a generator can't produce a valid mondai/paper —
    caught in routes/exams.py and turned into a 503, never silently
    served as a smaller-than-requested or malformed paper."""


def make_choices(rng: random.Random, correct: str, distractors: list[str]) -> tuple[list[dict], str] | None:
    """Builds a shuffled 4-choice {id, textJp} list plus the answer id,
    from a correct answer and >=3 distractor candidates. Returns None
    if there aren't enough distractors — the caller skips this item
    rather than shipping a weak (fewer than 4-choice) question."""
    if len(distractors) < 3:
        return None
    picked = rng.sample(distractors, 3)
    options = [correct] + picked
    rng.shuffle(options)
    ids = ["c1", "c2", "c3", "c4"]
    choices = [{"id": ids[i], "textJp": text} for i, text in enumerate(options)]
    answer_id = ids[options.index(correct)]
    return choices, answer_id


# ── LLM token-spend control for the kanji-gate clause ───────────
# allowed_kanji_for_level(level) is interpolated into essentially
# every exam_*_gen.py LLM prompt (grammar-fill, sentence-order,
# cloze, paraphrase, usage, reading-passage, listening-mcq) — one
# full paper generation triggers dozens of separate LLM calls, and
# every one of them used to re-send this same block from scratch.
# At N5-N3 the cumulative allowed set is small (roughly 100-650
# characters) and genuinely load-bearing: without the literal list a
# model has no way to know which handful of kanji an N5 sentence may
# use. By N2-N1 the cumulative set is close to the full jōyō kanji
# set (~1000-2000+ characters) — spelling it out no longer does much
# real constraining work, it just costs real tokens on every single
# call. Below this, only N5-N3 get the literal list; N2-N1 get a
# short qualitative instruction instead.
#
# This does NOT relax the actual constraint: validate_kanji_gate /
# sentence_kanji_ok (study/exam_validation.py, study/llm_shared.py)
# still check every generated sentence against the real allowed set
# after the fact, exactly as before — this only changes what goes
# INTO the prompt asking the model to stay inside it. If N1/N2's
# kanji-gate failure/retry rate rises after this change, that's the
# signal to widen _FULL_LIST_LEVELS back out rather than trusting the
# qualitative instruction alone.
_FULL_LIST_LEVELS = {"N5", "N4", "N3"}

_N1N2_KANJI_INSTRUCTION = (
    "the standard jōyō (common-use) kanji set appropriate for an advanced "
    "learner -- avoid rare, archaic, dialectal, or highly specialized "
    "characters"
)


def kanji_instruction(level: str) -> str:
    """What a prompt should say about which kanji are allowed, scaled to
    how much real constraining work spelling out the full set still
    does at that level. Drop-in replacement for calling
    allowed_kanji_for_level(level) directly when building a prompt —
    every exam_*_gen.py LLM prompt template already reads naturally
    with either form substituted (".. MUST come from this list:\\n
    {allowed_kanji}\\n(use hiragana instead for anything else)")."""
    if level in _FULL_LIST_LEVELS:
        return allowed_kanji_for_level(level)
    return _N1N2_KANJI_INSTRUCTION
