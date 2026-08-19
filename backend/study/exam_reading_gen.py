# ── 読解 (reading comprehension) generator ────────────────────
# Extends routes/reading.py's own proven pattern (kanji-set-constrained
# prompt, multi-model fallback via study/llm_shared.chat(), validate-
# or-reject on the response) with the official blueprint's EXACT
# per-mondai character targets instead of reading.py's loose ranges,
# and question framing tailored to the specific official mondai
# (内容理解 vs 主張理解) rather than reading.py's generic mix.
#
# One LLM call per PASSAGE (not per paper, not multiple passages in
# one call) — same per-item discipline exam_vocab_gen.py's paraphrase/
# usage builders already use, and it's what keeps a single bad
# response's blast radius to one passage instead of a whole mondai.
#
# 情報検索 (table-reading) and 統合理解 (integrated-comparison, N1/N2
# only) have NO generator here yet. 情報検索 needs QuestionRenderer's
# hardcoded flyer schema generalized first (a real but bounded
# frontend change, not done in this pass); 統合理解 needs an entirely
# new renderer that doesn't exist at all. Both are skipped with a
# clear log line, same "loud, not silent" discipline as exam_vocab_gen
# skipping 語形成.
#
# Unlike exam_kanji_gen.py's 100%-owned-data techniques, everything
# here is LLM-generated — see study/llm_shared.py's OPENROUTER_API_KEY
# check for how this degrades (skips, doesn't fail the whole paper)
# when no key is configured.
import json
import logging
import random
import re

from study.exam_blueprint import LEVEL_BLUEPRINT
from study.exam_validation import validate_content, repair_answer_balance, validate_passage_length, validate_kanji_gate
from study.exam_gen_utils import GenerationFailed, kanji_instruction
from study.llm_shared import chat, OPENROUTER_API_KEY

logger = logging.getLogger(__name__)

_STYLE_COMPREHENSION = (
    "Each question should test understanding of what happened, the main "
    "idea of a specific part of the text, a concrete detail, or what a "
    "demonstrative word (この/それ/あれ/そう) refers to. Mix these across "
    "the questions rather than making them all about the same thing."
)
_STYLE_OPINION = (
    "The text should express the author's own opinion, argument, or "
    "conclusion about a topic (not just narrate events). Each question "
    "should test understanding of the author's claim, their reasoning, or "
    "what they conclude -- not simple plot/detail recall."
)

_PASSAGE_PROMPT = """You are writing one JLPT {level} reading-comprehension \
passage ({mondai_name} style), with its own questions.

Write a self-contained Japanese text of approximately {chars} characters. \
This is a STRICT limit, not a suggestion: count as you write, and if you \
are unsure whether you are over, write LESS rather than more -- text that \
is too long is the most common way this task fails. {chars} characters is \
short: roughly {sentence_estimate}. Do not try to fit a full story with a \
beginning, middle, and end into that space -- a single moment, a short \
notice, or one small observation is enough.

Use vocabulary and grammar appropriate for JLPT {level}. Any kanji you use \
MUST come from this list, with NO exceptions:
{allowed_kanji}
(use hiragana instead for anything else -- check every character, \
including in names). The text should read naturally -- a short story, \
notice, letter, article, or description, whichever suits the length and \
topic.

Every character matters, not just whole words: if an otherwise-common word \
has ONE kanji outside the allowed list, write just that one character in \
hiragana and keep the rest in kanji (e.g. if 達 is not allowed, write 友だち \
instead of 友達 rather than avoiding the word or picking a wrong kanji). \
This applies to names too: if you name a person, either spell the name \
entirely in hiragana/katakana (e.g. たなかさん, ゆき) or use only kanji from \
the allowed list -- do NOT default to a common textbook surname like 田中 \
or 山田 without checking every one of its characters (田 is a frequent \
culprit and is often NOT in the allowed list). When in doubt, prefer not \
naming anyone at all: わたし (I), 友だち (a friend), 先生 (the teacher), \
男の子/女の子 (a boy/girl) are always safe and need no name at all.

Then write exactly {question_count} multiple-choice questions about the \
text, each with exactly 4 Japanese answer choices.

{style_guidance}

Respond with ONLY JSON (no markdown fences, no commentary), matching \
exactly this schema:
{{"textJp": "...", "questions": [{{"promptJp": "...", "choices": ["...", "...", "...", "..."], "correctIndex": 0}}, ...]}}
"""

_READING_INSTRUCTIONS_JP = "つぎの　ぶんしょうを　よんで、しつもんに　こたえて　ください。"


def _call_llm_passage(level: str, mondai_name: str, chars: int, question_count: int, style_guidance: str) -> dict:
    # Live-diagnosed 2026-08: told only "approximately N characters",
    # the model consistently overshot short targets by 1.5-2x (N5's
    # 80-character 短文 came back at 120-200 characters every time,
    # apparently defaulting toward a small narrative arc regardless of
    # the stated limit) -- spelling out roughly how many sentences that
    # actually is gives it a concrete unit to count against instead of
    # an abstract character budget.
    sentence_count = max(1, round(chars / 22))
    sentence_estimate = f"{sentence_count} short sentence" + ("s" if sentence_count != 1 else "")
    prompt = _PASSAGE_PROMPT.format(
        level=level, mondai_name=mondai_name, chars=chars, question_count=question_count,
        allowed_kanji=kanji_instruction(level), style_guidance=style_guidance,
        sentence_estimate=sentence_estimate,
    )
    content = chat([
        {"role": "system", "content": prompt},
        {"role": "user", "content": "Generate the passage and questions."},
    ])
    cleaned = re.sub(r"^```(?:json)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        raise GenerationFailed(f"LLM returned unparseable JSON: {content!r}")


def _build_one_passage(level: str, mondai_name: str, chars: int, question_count: int,
                        style_guidance: str, passage_id: str, start_number: int) -> dict:
    data = _call_llm_passage(level, mondai_name, chars, question_count, style_guidance)

    text = data.get("textJp")
    questions_raw = data.get("questions")

    errors = []
    if not isinstance(text, str) or not text.strip():
        errors.append("missing textJp")
    else:
        errors.extend(validate_passage_length(text, chars))
        errors.extend(validate_kanji_gate(text, level))
    if not isinstance(questions_raw, list) or len(questions_raw) != question_count:
        got = len(questions_raw) if isinstance(questions_raw, list) else "n/a"
        errors.append(f"expected {question_count} questions, got {got}")
    if errors:
        raise GenerationFailed("; ".join(errors))

    questions = []
    for i, q in enumerate(questions_raw):
        prompt = q.get("promptJp")
        choices_text = q.get("choices")
        correct_index = q.get("correctIndex")
        if not isinstance(prompt, str) or not prompt.strip():
            raise GenerationFailed(f"{passage_id} question {i}: missing promptJp")
        if not isinstance(choices_text, list) or len(choices_text) != 4:
            raise GenerationFailed(f"{passage_id} question {i}: expected 4 choices")
        if not all(isinstance(c, str) and c.strip() for c in choices_text) or len(set(choices_text)) != 4:
            raise GenerationFailed(f"{passage_id} question {i}: invalid or duplicate choices")
        if not isinstance(correct_index, int) or not (0 <= correct_index < 4):
            raise GenerationFailed(f"{passage_id} question {i}: invalid correctIndex")

        ids = ["c1", "c2", "c3", "c4"]
        choices = [{"id": ids[j], "textJp": t} for j, t in enumerate(choices_text)]
        questions.append({
            "id": f"{passage_id}_q{i + 1}",
            # Continues across passages within the mondai (item 1 of
            # passage 2 is item 3 overall, if passage 1 had 2 items) —
            # matches how the real exam numbers a multi-passage mondai
            # continuously rather than restarting per passage. Restarting
            # per passage (an earlier version of this code did) made two
            # different questions both show as "Q1" on the result screen.
            "number": start_number + i,
            "promptJp": prompt,
            "choices": choices,
            "answer": ids[correct_index],
        })

    return {"id": passage_id, "textJp": text, "questions": questions}


def _passage_question_counts(total: int, questions_per_passage: int) -> list[int]:
    """Splits `total` questions across as many passages as
    questions_per_passage implies, as evenly as possible (e.g. total=9,
    qpp=3 -> [3,3,3]; total=5, qpp=1 -> [1,1,1,1,1])."""
    passage_count = max(1, round(total / questions_per_passage))
    base, remainder = divmod(total, passage_count)
    return [base + (1 if i < remainder else 0) for i in range(passage_count) if base + (1 if i < remainder else 0) > 0]


def build_reading_passage_mondai(spec: dict, level: str) -> dict:
    qpp = spec.get("questions_per_passage", 1)
    counts = _passage_question_counts(spec["count"], qpp)
    style_guidance = _STYLE_OPINION if "主張" in spec["name_jp"] else _STYLE_COMPREHENSION

    passages = []
    next_number = 1
    for i, qc in enumerate(counts):
        passage_id = f"{spec['id']}_p{i + 1}"
        try:
            passage = _build_one_passage(level, spec["name_jp"], spec["passage_chars"], qc,
                                          style_guidance, passage_id, next_number)
        except (RuntimeError, GenerationFailed) as e:
            logger.warning("Passage %s (%d/%d) for %s failed: %s", passage_id, i + 1, len(counts), spec["id"], e)
            continue
        passages.append(passage)
        next_number += qc

    built_questions = sum(len(p["questions"]) for p in passages)
    if built_questions < spec["count"]:
        raise GenerationFailed(f"{spec['id']}: only built {built_questions}/{spec['count']} reading-passage questions")

    return {
        "id": spec["id"],
        "number": spec["official_number"],
        "type": "reading-passage",
        "instructionsJp": _READING_INSTRUCTIONS_JP,
        "instructions": "Read the passage and answer the questions.",
        "passages": passages,
    }


# ── Section orchestrator ─────────────────────────────────────────
# Scans every blueprint section (not just one) for reading-passage
# mondai — they live in "grammar_reading" at N3-N5 and inside the
# combined "vocabulary_grammar_reading" section at N1/N2, alongside
# vocab/grammar mondai this generator doesn't build. Ships as its own
# paper at every level rather than being merged into
# exam_vocab_gen.py's vocabulary paper for N1/N2 -- a real
# simplification (the official exam presents them in one booklet for
# those two levels) accepted to keep this generator self-contained.
_MAX_GENERATION_ATTEMPTS = 3  # LLM calls are slow/costly -- fewer retries than the deterministic generators
_MINUTES_PER_QUESTION = 2  # reading items run slower than vocab/kanji ones; a simple, honest per-item estimate


def _reading_specs_for_level(level: str) -> list[dict]:
    specs = []
    for section in LEVEL_BLUEPRINT[level]["sections"]:
        for m in section["mondai"]:
            if m["type"] == "reading-passage":
                specs.append(m)
    specs.sort(key=lambda m: m["official_number"])
    return specs


def _generate_reading_paper_once(level: str, seed: int) -> dict:
    # `seed` is unused here on purpose: unlike exam_kanji_gen.py/
    # exam_vocab_gen.py's context mondai, nothing in this module locally
    # samples or shuffles anything -- the LLM authors the passage and
    # questions directly, and an LLM call is inherently non-deterministic
    # regardless of any local seed. Reproducibility for what actually
    # gets SERVED comes from routes/exams.py's materialize-once-in-DB
    # caching, not from this function being pure; kept as a parameter
    # only for interface symmetry with the other generators.
    specs = _reading_specs_for_level(level)

    mondai = []
    included_items = 0

    for spec in specs:
        if not OPENROUTER_API_KEY:
            logger.warning("Skipping %s (reading-passage): OPENROUTER_API_KEY not configured", spec["id"])
            continue
        try:
            built = build_reading_passage_mondai(spec, level)
        except GenerationFailed as e:
            logger.warning("Skipping %s: %s", spec["id"], e)
            continue
        mondai.append(built)
        included_items += spec["count"]

    if not mondai:
        raise GenerationFailed(f"{level}: no reading mondai could be generated at all")

    return {
        "level": level,
        "title": f"{level} Reading Practice",
        "titleJp": f"{level} 読解",
        "sections": [{
            "id": "reading",
            "label": "Reading",
            "labelJp": "読解",
            "timeLimitMin": max(10, round(_MINUTES_PER_QUESTION * included_items)),
            "mondai": mondai,
        }],
    }


def generate_reading_paper(level: str, seed: int) -> dict:
    last_errors: list[str] = []
    for attempt in range(_MAX_GENERATION_ATTEMPTS):
        try:
            paper = _generate_reading_paper_once(level, seed + attempt)
        except GenerationFailed as e:
            last_errors = [str(e)]
            continue

        # check_duplicates=False: promptJp here is a question's own text
        # ("what does the author mean by X?"), not a test-item identity
        # like a vocab/kanji target word -- the real exam itself reuses
        # boilerplate question phrasing across different passages.
        flat_questions = [q for m in paper["sections"][0]["mondai"] for p in m["passages"] for q in p["questions"]]
        content_errors = validate_content(flat_questions, check_duplicates=False)
        # Same reasoning as exam_vocab_gen.py's generate_vocabulary_paper:
        # an answer-position skew is a shuffle problem, not a content
        # problem — fix it by reshuffling in place rather than paying
        # for a full LLM re-generation (one call PER PASSAGE) just to
        # fix a shuffle.
        if not content_errors and repair_answer_balance(flat_questions, random.Random(seed + attempt)):
            return paper
        last_errors = content_errors or ["answer position skewed across the paper (could not repair by reshuffling)"]

    raise GenerationFailed(
        f"Could not generate a valid {level} reading paper after {_MAX_GENERATION_ATTEMPTS} attempts: {last_errors}"
    )
