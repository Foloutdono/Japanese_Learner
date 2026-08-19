# ── 聴解 (listening) generator ────────────────────────────────────
# Same discipline as every other exam_*_gen.py: LLM writes the content
# (here, a short dialogue) against a level-appropriate kanji gate,
# strict schema validation, never trust the model's self-report where
# code can check the claim directly. The one genuinely new piece is
# study/exam_tts.py's synthesis step, which turns the generated script
# into the single question.audioSrc QuestionRenderer.jsx's existing
# ListeningBlock already expects (see that component's own AUDIO NOTE).
#
# This first pass covers ONLY 課題理解/ポイント理解 (blueprint type
# "listening-mcq") -- the two mondai types whose answer choices are
# PRINTED text, which the existing ListeningBlock/ChoiceList already
# render correctly with zero frontend changes. 発話表現/即時応答
# (audio-only choices) and 概要理解 (fully audio-only, no printed
# choices at all) need a ChoiceList audio-only branch that doesn't
# exist yet -- see the original plan's Frontend section. 統合理解
# (N1/N2 only) needs its own multi-passage generation shape on top of
# that. All four are deliberately NOT built here; _generate_listening_
# paper_once skips them with a loud log message, the same way
# exam_vocab_gen.py already skips 語形成 ("no generator yet").
import json
import logging
import random
import re

from study.exam_blueprint import LEVEL_BLUEPRINT
from study.exam_validation import validate_content, repair_answer_balance
from study.exam_gen_utils import GenerationFailed, kanji_instruction
from study.exam_tts import synthesize_dialogue, TTSFailed
from study.llm_shared import chat, sentence_kanji_ok, OPENROUTER_API_KEY

logger = logging.getLogger(__name__)


def _call_llm_json(prompt: str) -> dict:
    content = chat([
        {"role": "system", "content": prompt},
        {"role": "user", "content": "Generate the question."},
    ])
    cleaned = re.sub(r"^```(?:json)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        raise GenerationFailed(f"LLM returned unparseable JSON: {content!r}")


def _call_llm_json_batch(prompt: str) -> list:
    """Same contract as _call_llm_json, but for a prompt asking for N
    dialogues back in one array. Batching divides the fixed cost every
    single-item call used to pay unconditionally (the kanji-gate list/
    instructions, resent from scratch on every call) by the batch size.
    TTS synthesis still happens per question afterward -- that part
    isn't an LLM token cost and doesn't batch the same way.

    reasoning=False: same empirical finding as the other exam_*_gen.py
    batch helpers (see study/llm_shared.py's chat() docstring) -- with
    reasoning on, a multi-item array prompt burns its completion budget
    on the reasoning trace and returns nothing usable; off, the same
    prompt reliably returns real content for a fraction of the tokens."""
    content = chat([
        {"role": "system", "content": prompt},
        {"role": "user", "content": "Generate the questions."},
    ], reasoning=False)
    cleaned = re.sub(r"^```(?:json)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        raise GenerationFailed(f"LLM returned unparseable JSON array: {content!r}")
    if not isinstance(data, list):
        raise GenerationFailed(f"expected a JSON array of items, got {type(data).__name__}")
    return data


# ── 課題理解 / ポイント理解: listening-mcq ────────────────────────
_LISTENING_MCQ_BATCH_SIZE = 3

_LISTENING_MCQ_PROMPT_BATCH = """You are writing {n} separate JLPT {level} \
listening comprehension questions ({name_jp} style), each independent of \
the others. A learner will HEAR each as audio, not read it -- the \
dialogue and question are spoken aloud; only the 4 answer choices are \
shown printed on the page.

For EACH of the {n} questions, write a short, natural Japanese dialogue \
between two people (labeled "A" and "B") about a task, plan, or \
arrangement -- for example deciding what to buy, arranging when/where to \
meet, or working out what to do next -- such that after hearing it, a \
listener could answer a concrete question about what needs to be done, \
by whom, or when. Vary the topic across the {n} questions so they don't \
resemble each other. Any vocabulary you use should be appropriate for a \
JLPT {level} learner; kanji you use MUST come from this list:
{allowed_kanji}
(use hiragana instead for anything else).

Then write ONE spoken comprehension question about that dialogue, and \
exactly 4 short printed answer choices: one correct, three plausible- \
but-wrong.

Respond with ONLY JSON (no markdown fences, no commentary): a JSON array \
of exactly {n} objects, each matching:
{{"contextJp": "one short scene-setting line the narrator reads first, \
e.g. '女の人と男の人が話しています。'",
  "turns": [{{"speaker": "A", "textJp": "..."}}, {{"speaker": "B", "textJp": "..."}}, ...],
  "questionJp": "the spoken comprehension question",
  "choices": ["...", "...", "...", "..."], "correctIndex": 0}}
"""


def _validate_listening_mcq_item(item, q_id: str) -> tuple[str, list, str, list, int]:
    """Same validation _build_one_listening_mcq_question used to do
    inline (up through TTS), split out so it can be applied to each
    element of a batch response without re-issuing the LLM call.
    Returns (context, turns, question_jp, choices_text, correct_index)."""
    if not isinstance(item, dict):
        raise GenerationFailed(f"{q_id}: item is not an object")

    context = item.get("contextJp", "")
    turns_raw = item.get("turns")
    question_jp = item.get("questionJp")
    choices_text = item.get("choices")
    correct_index = item.get("correctIndex")

    if not isinstance(context, str):
        raise GenerationFailed(f"{q_id}: contextJp missing")
    if not isinstance(turns_raw, list) or len(turns_raw) < 2:
        raise GenerationFailed(f"{q_id}: expected at least 2 dialogue turns")
    turns = []
    for t in turns_raw:
        speaker, text = t.get("speaker"), t.get("textJp")
        if not isinstance(speaker, str) or not speaker.strip() or not isinstance(text, str) or not text.strip():
            raise GenerationFailed(f"{q_id}: malformed turn {t!r}")
        turns.append({"speaker": speaker.strip(), "textJp": text.strip()})
    if not isinstance(question_jp, str) or not question_jp.strip():
        raise GenerationFailed(f"{q_id}: questionJp missing")
    if not isinstance(choices_text, list) or len(choices_text) != 4:
        raise GenerationFailed(f"{q_id}: expected 4 choices")
    if not all(isinstance(c, str) and c.strip() for c in choices_text) or len(set(choices_text)) != 4:
        raise GenerationFailed(f"{q_id}: invalid or duplicate choices")
    if not isinstance(correct_index, int) or not (0 <= correct_index < 4):
        raise GenerationFailed(f"{q_id}: invalid correctIndex")

    return context, turns, question_jp, choices_text, correct_index


def _build_one_listening_mcq_question(item, level: str, q_id: str, number: int) -> dict:
    context, turns, question_jp, choices_text, correct_index = _validate_listening_mcq_item(item, q_id)

    full_text = context + "".join(t["textJp"] for t in turns) + question_jp
    if not sentence_kanji_ok(full_text, level):
        raise GenerationFailed(f"{q_id}: dialogue/question has kanji outside {level}'s allowed set")
    for c in choices_text:
        if not sentence_kanji_ok(c, level):
            raise GenerationFailed(f"{q_id}: a choice has kanji outside {level}'s allowed set")

    # Narrator reads the scene-setting line and the question; A/B read
    # the dialogue itself -- three distinct voices, matching how a real
    # JLPT listening track is actually performed (narration + two
    # participants), not a single flat voice for everything.
    script_turns = []
    if context:
        script_turns.append({"speaker": "narrator", "textJp": context})
    script_turns.extend(turns)
    script_turns.append({"speaker": "narrator", "textJp": question_jp})

    try:
        audio_src = synthesize_dialogue(script_turns)
    except TTSFailed as e:
        raise GenerationFailed(f"{q_id}: TTS synthesis failed: {e}")

    ids = ["c1", "c2", "c3", "c4"]
    choices = [{"id": ids[i], "textJp": t} for i, t in enumerate(choices_text)]
    return {
        "id": q_id,
        "number": number,
        "questionPromptJp": question_jp,
        "audioSrc": audio_src,
        "scriptJp": "\n".join(f"{t['speaker']}: {t['textJp']}" for t in script_turns),
        "choices": choices,
        "choiceType": "text",
        "answer": ids[correct_index],
    }


# A finite word/pattern catalog backs kanji/vocab/grammar items (a
# specific target word or grammar point); listening-mcq dialogues have
# no such catalog to draw candidates from -- each batch is an
# independent free generation, so the retry loop is a flat batch
# budget rather than "candidates remaining in a pool".
_ATTEMPTS_PER_ITEM = 3


def _build_listening_mcq_mondai(spec: dict, level: str) -> dict:
    questions = []
    attempts = 0
    max_attempts = spec["count"] * _ATTEMPTS_PER_ITEM
    while len(questions) < spec["count"] and attempts < max_attempts:
        batch_n = min(_LISTENING_MCQ_BATCH_SIZE, max_attempts - attempts)
        attempts += batch_n
        prompt = _LISTENING_MCQ_PROMPT_BATCH.format(
            n=batch_n, level=level, name_jp=spec["name_jp"], allowed_kanji=kanji_instruction(level),
        )
        try:
            items = _call_llm_json_batch(prompt)
        except (RuntimeError, GenerationFailed) as e:
            logger.warning("Listening-mcq batch of %d for %s failed: %s", batch_n, spec["id"], e)
            continue

        # TTS is still per-question here (unaffected by batching the LLM
        # call above) -- synthesize_dialogue is a free, content-keyed,
        # idempotent call per question, not part of the token budget.
        for item in items:
            if len(questions) >= spec["count"]:
                break
            q_id = f"{spec['id']}_q{len(questions) + 1}"
            try:
                q = _build_one_listening_mcq_question(item, level, q_id, len(questions) + 1)
            except (RuntimeError, GenerationFailed) as e:
                logger.warning("Listening-mcq item for %s failed: %s", spec["id"], e)
                continue
            questions.append(q)

    if len(questions) < spec["count"]:
        raise GenerationFailed(f"{spec['id']}: only found {len(questions)}/{spec['count']} valid listening-mcq items")

    return {
        "id": spec["id"], "number": spec["official_number"], "type": "listening-mcq",
        "instructionsJp": "もんだいようしに　なにも　いんさつされて　いません。まず　ぶんを　きいて　ください。それから、しつもんと　せんたくしを　きいて、1・2・3・4から　いちばん　いい　ものを　一つ　えらんで　ください。",
        "instructions": "Listen to the conversation, then choose the best answer from 1-4.",
        "questions": questions,
    }


# ── Section orchestrator ─────────────────────────────────────────
_MAX_GENERATION_ATTEMPTS = 3
_SECONDS_PER_ITEM = 45  # listening items run slower than any text mondai: dialogue + narration + question, all read aloud


def _listening_specs_for_level(level: str) -> list[dict]:
    specs = []
    for section in LEVEL_BLUEPRINT[level]["sections"]:
        for m in section["mondai"]:
            if m["type"].startswith("listening-"):
                specs.append(m)
    specs.sort(key=lambda m: m["official_number"])
    return specs


def _generate_listening_paper_once(level: str, seed: int) -> dict:
    # `seed` unused, same reasoning as exam_reading_gen.py/
    # exam_grammar_gen.py: an LLM call is non-deterministic regardless
    # of any local seed; reproducibility for what's actually SERVED
    # comes from routes/exams.py's materialize-once-in-DB caching.
    specs = _listening_specs_for_level(level)

    mondai = []
    included_items = 0

    for spec in specs:
        if spec["type"] != "listening-mcq":
            logger.info("Skipping %s (%s): no generator yet (needs a ChoiceList audio-only branch first)", spec["id"], spec["type"])
            continue
        if not OPENROUTER_API_KEY:
            logger.warning("Skipping %s (listening-mcq): OPENROUTER_API_KEY not configured", spec["id"])
            continue
        try:
            built = _build_listening_mcq_mondai(spec, level)
        except GenerationFailed as e:
            logger.warning("Skipping %s: %s", spec["id"], e)
            continue
        mondai.append(built)
        included_items += spec["count"]

    if not mondai:
        raise GenerationFailed(f"{level}: no listening mondai could be generated at all")

    return {
        "level": level,
        "title": f"{level} Listening Practice",
        "titleJp": f"{level} 聴解",
        "sections": [{
            "id": "listening",
            "label": "Listening",
            "labelJp": "聴解",
            "timeLimitMin": max(10, round(_SECONDS_PER_ITEM * included_items / 60)),
            "mondai": mondai,
        }],
    }


def generate_listening_paper(level: str, seed: int) -> dict:
    last_errors: list[str] = []
    for attempt in range(_MAX_GENERATION_ATTEMPTS):
        try:
            paper = _generate_listening_paper_once(level, seed + attempt)
        except GenerationFailed as e:
            last_errors = [str(e)]
            continue

        # check_duplicates=False: questionPromptJp here is the spoken
        # comprehension question's own text, not a test-item identity
        # the way a vocab/kanji target word is -- and this generator
        # doesn't even populate the field validate_no_duplicate_targets
        # actually reads (promptJp), so it would flag every item as a
        # duplicate of the first if left on. Same reasoning as
        # exam_reading_gen.py/exam_grammar_gen.py's own check_duplicates=False.
        flat_questions = [q for m in paper["sections"][0]["mondai"] for q in m["questions"]]
        content_errors = validate_content(flat_questions, check_duplicates=False)
        # Same reasoning as exam_vocab_gen.py's generate_vocabulary_paper:
        # an answer-position skew is a shuffle problem, not a content
        # problem — fix it by reshuffling in place rather than paying
        # for a full LLM + TTS re-generation (each item is one LLM call
        # AND one synthesize_dialogue call) just to fix a shuffle.
        if not content_errors and repair_answer_balance(flat_questions, random.Random(seed + attempt)):
            return paper
        last_errors = content_errors or ["answer position skewed across the paper (could not repair by reshuffling)"]

    raise GenerationFailed(
        f"Could not generate a valid {level} listening paper after {_MAX_GENERATION_ATTEMPTS} attempts: {last_errors}"
    )
