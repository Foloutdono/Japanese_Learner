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
# here is LLM-generated — see study/llm_shared.py's llm_configured()
# check for how this degrades (skips, doesn't fail the whole paper)
# when no key is configured.
import logging
import random

from study.exam_blueprint import LEVEL_BLUEPRINT
from study.exam_topics import OPINION_TOPICS, READING_TOPICS, pick_topics
from study.exam_validation import (
    passage_length_bounds, validate_passage_length, validate_kanji_gate,
)
from study.exam_gen_utils import GenerationFailed, kanji_instruction, call_llm_json
from study.exam_pipeline import generate_paper
from study.llm_shared import llm_configured, soften_kanji

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

The text should be about: {topic}.

Write a self-contained Japanese text of {lo} to {hi} characters, aiming for \
{chars}. This is a STRICT range, not a suggestion, and it is checked by \
counting characters: a text outside it is rejected outright. \
{length_guidance}

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
{feedback}"""

# ── Length guidance, scaled to the target ───────────────────────
# Live-diagnosed 2026-08, twice, in opposite directions.
#
# First: told only "approximately N characters", the model overshot
# short targets by 1.5-2x (N5's 80-character 短文 came back at 120-200
# every time, apparently defaulting toward a small narrative arc
# regardless of the stated limit). The fix was to push hard toward
# brevity and spell out roughly how many sentences the budget really is.
#
# Then that push was applied UNCONDITIONALLY, including to N5's
# 250-character 中文 slot -- "write LESS rather than more", "{chars}
# characters is short", "do not try to fit a full story" -- and the
# model dutifully wrote 114-141 characters for a slot whose accepted
# window starts at 200. Every single dokkai_5 passage failed, which took
# the whole mondai with it and then the whole paper ("no reading mondai
# could be generated at all").
#
# So the guidance now depends on which way the target actually errs. A
# short slot needs the brevity push; a long one needs the opposite, and
# telling it "this is short" is simply false.
_SHORT_TARGET_CHARS = 150

_SHORT_LENGTH_GUIDANCE = (
    "If you are unsure whether you are over, write LESS rather than more -- "
    "text that is too long is the most common way this task fails. {chars} "
    "characters is short: roughly {sentence_estimate}. Do not try to fit a "
    "full story with a beginning, middle, and end into that space -- a single "
    "moment, a short notice, or one small observation is enough."
)
_LONG_LENGTH_GUIDANCE = (
    "This is NOT a short text: {chars} characters is roughly "
    "{sentence_estimate}, so develop the subject properly rather than "
    "stopping after two or three lines -- a text that is too SHORT is the "
    "most common way this task fails. Keep writing until you have passed "
    "{lo} characters."
)

_READING_INSTRUCTIONS_JP = "つぎの　ぶんしょうを　よんで、しつもんに　こたえて　ください。"


def _call_llm_passage(level: str, mondai_name: str, chars: int, question_count: int,
                       style_guidance: str, topic: str, feedback: str = "") -> dict:
    # Spelling out roughly how many sentences the budget is gives the
    # model a concrete unit to count against instead of an abstract
    # character budget — it counts sentences far better than characters,
    # in both directions (see the guidance constants above).
    sentence_count = max(1, round(chars / 22))
    sentence_estimate = f"{sentence_count} short sentence" + ("s" if sentence_count != 1 else "")
    lo, hi = passage_length_bounds(chars)
    guidance = _SHORT_LENGTH_GUIDANCE if chars <= _SHORT_TARGET_CHARS else _LONG_LENGTH_GUIDANCE
    prompt = _PASSAGE_PROMPT.format(
        level=level, mondai_name=mondai_name, chars=chars, question_count=question_count,
        allowed_kanji=kanji_instruction(level), style_guidance=style_guidance,
        topic=topic, lo=lo, hi=hi, feedback=feedback,
        length_guidance=guidance.format(chars=chars, sentence_estimate=sentence_estimate, lo=lo),
    )
    return call_llm_json(prompt, "Generate the passage and questions.")


# One LLM call per passage was never retried: a passage that failed the
# length or kanji gate was logged and dropped, and once enough dropped
# the mondai -- and then the paper -- failed outright. The paper-level
# retry in exam_pipeline.py doesn't help here, because it re-runs the
# SAME prompt and the model has no idea what was wrong with the last
# one. Retrying here, with the failure fed back in, is the only loop
# that actually carries information from one attempt to the next.
_PASSAGE_ATTEMPTS = 3

_FEEDBACK_HEADER = (
    "\nYour previous attempt was REJECTED for the following reasons. "
    "Fix them exactly; everything else about it was fine.\n"
)


def _soften_best_effort(text: str, level: str) -> str:
    """Kana-ify out-of-level kanji if that can be done reliably, else
    leave the text alone. Used for question and choice text, which no
    gate has ever checked -- so an N5 answer choice could print 教室
    even though the passage above it could not. This is a strict
    improvement with no new failure mode: it never rejects anything."""
    return soften_kanji(text, level) or text


def _build_questions(questions_raw: list, level: str, passage_id: str, start_number: int) -> list[dict]:
    """Validated question objects, or GenerationFailed naming the first
    problem. Raises rather than returning errors because a malformed
    question list means the whole response is unusable — the caller
    turns that into another attempt just like a failed text gate."""
    questions = []
    for i, q in enumerate(questions_raw):
        prompt = q.get("promptJp") if isinstance(q, dict) else None
        choices_text = q.get("choices") if isinstance(q, dict) else None
        correct_index = q.get("correctIndex") if isinstance(q, dict) else None
        if not isinstance(prompt, str) or not prompt.strip():
            raise GenerationFailed(f"{passage_id} question {i}: missing promptJp")
        if not isinstance(choices_text, list) or len(choices_text) != 4:
            raise GenerationFailed(f"{passage_id} question {i}: expected 4 choices")
        if not all(isinstance(c, str) and c.strip() for c in choices_text) or len(set(choices_text)) != 4:
            raise GenerationFailed(f"{passage_id} question {i}: invalid or duplicate choices")
        if not isinstance(correct_index, int) or not (0 <= correct_index < 4):
            raise GenerationFailed(f"{passage_id} question {i}: invalid correctIndex")

        ids = ["c1", "c2", "c3", "c4"]
        softened = [_soften_best_effort(t, level) for t in choices_text]
        # Softening can collapse two distinct choices into the same kana
        # (診察 and 診察 written out are identical strings); keep the
        # originals in that case rather than shipping duplicate choices,
        # which validate_mcq_question would reject anyway.
        if len(set(softened)) != 4:
            softened = choices_text
        choices = [{"id": ids[j], "textJp": t} for j, t in enumerate(softened)]
        questions.append({
            "id": f"{passage_id}_q{i + 1}",
            # Continues across passages within the mondai (item 1 of
            # passage 2 is item 3 overall, if passage 1 had 2 items) —
            # matches how the real exam numbers a multi-passage mondai
            # continuously rather than restarting per passage. Restarting
            # per passage (an earlier version of this code did) made two
            # different questions both show as "Q1" on the result screen.
            "number": start_number + i,
            "promptJp": _soften_best_effort(prompt, level),
            "choices": choices,
            "answer": ids[correct_index],
        })
    return questions


def _build_one_passage(level: str, mondai_name: str, chars: int, question_count: int,
                        style_guidance: str, topic: str, passage_id: str, start_number: int) -> dict:
    feedback = ""
    last_errors: list[str] = []

    for attempt in range(_PASSAGE_ATTEMPTS):
        last_attempt = attempt == _PASSAGE_ATTEMPTS - 1
        data = _call_llm_passage(level, mondai_name, chars, question_count,
                                 style_guidance, topic, feedback)

        text = data.get("textJp")
        questions_raw = data.get("questions")

        # Kanji failures are kept apart from the rest because they are
        # the one kind that can be SALVAGED without another LLM call:
        # soften_kanji rewrites the offending words to their kana
        # reading, which is exactly what a real low-level JLPT passage
        # does with a word whose kanji the learner hasn't met yet. A
        # length or shape failure has no such repair.
        hard_errors: list[str] = []
        kanji_errors: list[str] = []
        if not isinstance(text, str) or not text.strip():
            hard_errors.append("missing textJp")
        else:
            hard_errors.extend(validate_passage_length(text, chars))
            kanji_errors.extend(validate_kanji_gate(text, level))
        if not isinstance(questions_raw, list) or len(questions_raw) != question_count:
            got = len(questions_raw) if isinstance(questions_raw, list) else "n/a"
            hard_errors.append(f"expected {question_count} questions, got {got}")

        if not hard_errors and kanji_errors and last_attempt:
            softened = soften_kanji(text, level)
            if softened is not None:
                logger.info("Passage %s: softened out-of-level kanji rather than dropping it", passage_id)
                text, kanji_errors = softened, []

        if not hard_errors and not kanji_errors:
            try:
                questions = _build_questions(questions_raw, level, passage_id, start_number)
            except GenerationFailed as e:
                last_errors = [str(e)]
                feedback = _FEEDBACK_HEADER + f"- {e}\n"
                continue
            return {"id": passage_id, "textJp": text, "questions": questions}

        last_errors = hard_errors + kanji_errors
        feedback = _FEEDBACK_HEADER + "".join(
            f"- {_as_feedback(e, text, chars)}\n" for e in last_errors
        )

    raise GenerationFailed("; ".join(last_errors))


def _as_feedback(error: str, text, chars: int) -> str:
    """Turns a validator message into an instruction. The validators
    describe what is wrong for a log reader; the model needs to be told
    what to DO, and in the kanji case the specific characters to replace
    (validate_kanji_gate already names them)."""
    if error.startswith("passage length"):
        lo, hi = passage_length_bounds(chars)
        direction = "too SHORT -- write more" if len(text) < lo else "too LONG -- write less"
        return (f"Your text was {len(text)} characters, which is {direction}. "
                f"It must be between {lo} and {hi} characters.")
    if "outside" in error and "allowed set" in error:
        return (f"{error} Rewrite those specific characters in hiragana, keeping the rest "
                f"of each word in kanji, and check every remaining character against the "
                f"allowed list before answering.")
    return error


def _passage_question_counts(total: int, questions_per_passage: int) -> list[int]:
    """Splits `total` questions across as many passages as
    questions_per_passage implies, as evenly as possible (e.g. total=9,
    qpp=3 -> [3,3,3]; total=5, qpp=1 -> [1,1,1,1,1])."""
    passage_count = max(1, round(total / questions_per_passage))
    base, remainder = divmod(total, passage_count)
    return [base + (1 if i < remainder else 0) for i in range(passage_count) if base + (1 if i < remainder else 0) > 0]


def build_reading_passage_mondai(spec: dict, level: str, rng: random.Random) -> dict:
    qpp = spec.get("questions_per_passage", 1)
    counts = _passage_question_counts(spec["count"], qpp)
    # The same 主張 test that picks the style guidance picks the topic
    # pool: an opinion passage needs something to hold an opinion ABOUT,
    # and "a note left on the fridge" gives it nothing to argue.
    is_opinion = "主張" in spec["name_jp"]
    style_guidance = _STYLE_OPINION if is_opinion else _STYLE_COMPREHENSION
    topics = pick_topics(OPINION_TOPICS if is_opinion else READING_TOPICS, len(counts), rng)

    passages = []
    next_number = 1
    for i, qc in enumerate(counts):
        passage_id = f"{spec['id']}_p{i + 1}"
        try:
            passage = _build_one_passage(level, spec["name_jp"], spec["passage_chars"], qc,
                                          style_guidance, topics[i], passage_id, next_number)
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
_MAX_GENERATION_ATTEMPTS = 3  # one LLM call per passage; a full retry re-authors every passage in the paper
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
    # `seed` drives TOPIC selection (study/exam_topics.py). It used to be
    # ignored entirely, on the reasoning that an LLM call is
    # non-deterministic anyway -- true, but it meant the prompt itself
    # was byte-identical for every paper at a level, and the model
    # answered a topic-less prompt with the same handful of subjects
    # every time. What the seed buys is not reproducibility (the DB
    # caching in routes/exams.py still provides that); it is that two
    # papers, or two revisions of one paper, are asked for DIFFERENT
    # things rather than being left to differ by chance.
    rng = random.Random(seed)
    specs = _reading_specs_for_level(level)

    mondai = []
    included_items = 0

    for spec in specs:
        if not llm_configured():
            logger.warning("Skipping %s (reading-passage): no LLM provider is configured", spec["id"])
            continue
        try:
            built = build_reading_passage_mondai(spec, level, rng)
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


def _flatten_reading_questions(mondai_list: list[dict]) -> list[dict]:
    return [q for m in mondai_list for p in m["passages"] for q in p["questions"]]


def generate_reading_paper(level: str, seed: int) -> dict:
    # check_duplicates=False: promptJp here is a question's own text
    # ("what does the author mean by X?"), not a test-item identity
    # like a vocab/kanji target word -- the real exam itself reuses
    # boilerplate question phrasing across different passages.
    return generate_paper(
        generate_once=_generate_reading_paper_once,
        flatten=_flatten_reading_questions,
        level=level, seed=seed,
        max_attempts=_MAX_GENERATION_ATTEMPTS,
        check_duplicates=False,
        paper_label="reading",
    )
