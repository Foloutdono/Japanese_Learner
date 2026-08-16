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
import re

from study.exam_blueprint import LEVEL_BLUEPRINT
from study.exam_validation import validate_questions
from study.exam_gen_utils import GenerationFailed
from study.exam_tts import synthesize_dialogue, TTSFailed
from study.llm_shared import chat, allowed_kanji_for_level, sentence_kanji_ok, OPENROUTER_API_KEY

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


# ── 課題理解 / ポイント理解: listening-mcq ────────────────────────
_LISTENING_MCQ_PROMPT = """You are writing one JLPT {level} listening \
comprehension question ({name_jp} style). A learner will HEAR this as \
audio, not read it -- the dialogue and question are spoken aloud; only \
the 4 answer choices are shown printed on the page.

Write a short, natural Japanese dialogue between two people (labeled \
"A" and "B") about a task, plan, or arrangement -- for example deciding \
what to buy, arranging when/where to meet, or working out what to do \
next -- such that after hearing it, a listener could answer a concrete \
question about what needs to be done, by whom, or when. Any vocabulary \
you use should be appropriate for a JLPT {level} learner; kanji you use \
MUST come from this list:
{allowed_kanji}
(use hiragana instead for anything else).

Then write ONE spoken comprehension question about the dialogue, and \
exactly 4 short printed answer choices: one correct, three plausible- \
but-wrong.

Respond with ONLY JSON (no markdown fences, no commentary), matching \
exactly this schema:
{{"contextJp": "one short scene-setting line the narrator reads first, \
e.g. '女の人と男の人が話しています。'",
  "turns": [{{"speaker": "A", "textJp": "..."}}, {{"speaker": "B", "textJp": "..."}}, ...],
  "questionJp": "the spoken comprehension question",
  "choices": ["...", "...", "...", "..."], "correctIndex": 0}}
"""


def _build_one_listening_mcq_question(level: str, name_jp: str, q_id: str, number: int) -> dict:
    prompt = _LISTENING_MCQ_PROMPT.format(level=level, name_jp=name_jp, allowed_kanji=allowed_kanji_for_level(level))
    data = _call_llm_json(prompt)

    context = data.get("contextJp", "")
    turns_raw = data.get("turns")
    question_jp = data.get("questionJp")
    choices_text = data.get("choices")
    correct_index = data.get("correctIndex")

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
# no such catalog to draw candidates from -- each attempt is an
# independent free generation, so the retry loop is a flat attempt
# budget rather than "candidates remaining in a pool".
_ATTEMPTS_PER_ITEM = 3


def _build_listening_mcq_mondai(spec: dict, level: str) -> dict:
    questions = []
    attempts = 0
    max_attempts = spec["count"] * _ATTEMPTS_PER_ITEM
    while len(questions) < spec["count"] and attempts < max_attempts:
        attempts += 1
        q_id = f"{spec['id']}_q{len(questions) + 1}"
        try:
            q = _build_one_listening_mcq_question(level, spec["name_jp"], q_id, len(questions) + 1)
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
        errors = validate_questions(flat_questions, check_duplicates=False)
        if not errors:
            return paper
        last_errors = errors

    raise GenerationFailed(
        f"Could not generate a valid {level} listening paper after {_MAX_GENERATION_ATTEMPTS} attempts: {last_errors}"
    )
