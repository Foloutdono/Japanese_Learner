# ── Shared generator utilities ────────────────────────────────
# Small pieces every exam_*_gen.py module needs, factored out once a
# second generator (exam_vocab_gen.py) needed the same
# GenerationFailed/make_choices exam_kanji_gen.py already had.
import random


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
