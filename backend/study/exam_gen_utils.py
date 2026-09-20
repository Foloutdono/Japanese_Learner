# ── Shared generator utilities ────────────────────────────────
# Small pieces every exam_*_gen.py module needs, factored out once a
# second generator (exam_vocab_gen.py) needed the same
# GenerationFailed/make_choices exam_kanji_gen.py already had.
import json
import random
import re

from study.llm_shared import allowed_kanji_for_level, chat


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


# ── Why the generators are not split for prompt caching ─────────
# Plan 092 split routes/reading.py's comprehension prompt in two -- a
# block stable per (level, lang) first, the per-call seeds after it --
# so a provider's prefix cache can hold the stable half. The same
# treatment was considered here and deliberately NOT applied.
#
# Both providers this app calls cache automatically and want a prefix
# of at least ~1,024 tokens before anything is cached at all. These
# prompts, measured whole with the kanji list interpolated:
#
#   _FILL_PROMPT_BATCH          1,033 chars
#   _CLOZE_PROMPT               1,111
#   _USAGE_PROMPT_BATCH         1,165
#   _PARAPHRASE_PROMPT_BATCH    1,166
#   _STAR_PROMPT_BATCH          1,356
#   _LISTENING_MCQ_PROMPT_BATCH 1,594
#   _PASSAGE_PROMPT             1,867
#
# Mostly English, so roughly 250-470 tokens each: every one of them is
# two to four times UNDER the threshold, and reordering a prompt that
# can never be cached is churn on text whose current wording was tuned
# against live failures. The comprehension prompt is 6,500 characters,
# which is why it was worth splitting and these are not.
#
# Note also that the kanji list is only sent in full at N5-N3 (see
# _FULL_LIST_LEVELS above): at N2-N1 it is a single sentence, so "the
# allowed-kanji list is what these prompts re-send" is true of at most
# 613 characters, never the 2,212 of the full N1 set.
#
# What would change this: a bigger batch (more items per call grows the
# volatile half, not the stable one, so it does not help), or a
# provider whose minimum is lower. Re-measure before reopening it.

# ── Shared LLM-JSON call ─────────────────────────────────────────
# One call → one JSON blob: strip the markdown fence a model sometimes
# wraps its answer in, parse it, and turn a parse failure into
# GenerationFailed rather than a raw JSONDecodeError, so every
# exam_*_gen.py builder and exam_pipeline.py's retry loop only ever
# have to catch the one exception. Was three byte-identical private
# copies (exam_grammar_gen.py, exam_vocab_gen.py, exam_listening_gen.py)
# plus a fourth near-copy inlined in exam_reading_gen.py's
# _call_llm_passage, despite this module's own reason for existing
# being exactly "factored out once a second generator needed the same
# piece" (see the header above).
def call_llm_json(prompt: str, user_message: str = "Generate the question.",
                  task: str = "exam") -> dict:
    content = chat([
        {"role": "system", "content": prompt},
        {"role": "user", "content": user_message},
    ], task=task)
    cleaned = re.sub(r"^```(?:json)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        raise GenerationFailed(f"LLM returned unparseable JSON: {content!r}")


# Room for one item in a batch response, plus a fixed allowance for the
# array's own scaffolding. Japanese tokenizes expensively (roughly a
# token per kana), and a listening item is a multi-turn dialogue plus a
# question plus four choices — chat()'s flat 3000 default is a batch of
# three away from truncating, which surfaces confusingly as "LLM
# returned unparseable JSON array" rather than as a length problem.
_TOKENS_PER_BATCH_ITEM = 900
_BATCH_TOKEN_OVERHEAD = 600


def call_llm_json_batch(prompt: str, user_message: str = "Generate the questions.",
                        expected_items: int | None = None, task: str = "exam") -> list:
    """Same contract as call_llm_json, but for a prompt that asks for N
    items back in one array. Batching amortizes the fixed cost every
    single-item call pays unconditionally (the kanji-gate list/
    instruction block — ~100-650 characters at N5-N3, see
    kanji_instruction above) over several items instead of paying it
    once per item.

    expected_items: how many items the prompt asks for, used to size the
    completion budget. Omit it to keep chat()'s own default — correct
    for a small batch, too tight once a batch grows.

    task: which mondai this batch is for, carried into the usage log so
    a paper's cost can be read per section rather than as one number
    (see llm_shared._log_usage). Defaults to the paper as a whole.

    reasoning=False: live-diagnosed 2026-08 on this shape (a handful of
    items asked for in one call) — with reasoning on, the model spends
    its whole completion budget on the reasoning trace and returns
    nothing usable for a multi-item array; off, the same prompt
    reliably returns real content at a fraction of the tokens.
    Single-item calls (call_llm_json) are unaffected and keep the
    default (reasoning on)."""
    kwargs = {}
    if expected_items:
        kwargs["max_tokens"] = _TOKENS_PER_BATCH_ITEM * expected_items + _BATCH_TOKEN_OVERHEAD
    content = chat([
        {"role": "system", "content": prompt},
        {"role": "user", "content": user_message},
    ], reasoning=False, task=task, **kwargs)
    cleaned = re.sub(r"^```(?:json)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        raise GenerationFailed(f"LLM returned unparseable JSON array: {content!r}")
    if not isinstance(data, list):
        raise GenerationFailed(f"expected a JSON array of items, got {type(data).__name__}")
    return data
