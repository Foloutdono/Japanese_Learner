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
import logging

from study.exam_blueprint import LEVEL_BLUEPRINT
from study.exam_gen_utils import GenerationFailed, kanji_instruction, call_llm_json_batch
from study.exam_pipeline import generate_paper
from study.exam_tts import synthesize_dialogue, TTSFailed
from study.llm_shared import soften_kanji, OPENROUTER_API_KEY

logger = logging.getLogger(__name__)


# ── 課題理解 / ポイント理解: listening-mcq ────────────────────────
# 4, not 3: the per-call fixed cost (the N5-N3 kanji list, ~100-650
# characters, re-sent every call) amortizes better, and the completion
# budget now scales with the batch size (call_llm_json_batch's
# expected_items) instead of sharing one flat 3000-token cap, which is
# what made a larger batch risky before.
_LISTENING_MCQ_BATCH_SIZE = 4

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


def _soften_or_fail(text: str, level: str, q_id: str, what: str) -> str:
    softened = soften_kanji(text, level)
    if softened is None:
        raise GenerationFailed(f"{q_id}: {what} has kanji outside {level}'s allowed set that could not be read as kana")
    return softened


def _build_one_listening_mcq_question(item, level: str, q_id: str, number: int) -> dict:
    context, turns, question_jp, choices_text, correct_index = _validate_listening_mcq_item(item, q_id)

    # Out-of-level kanji is SOFTENED to kana here rather than rejected.
    # Every string below is either spoken aloud (context/turns/question)
    # or printed as a short N5-style choice, and in both cases the kana
    # spelling is what a real paper at this level would show anyway --
    # see soften_kanji's own docstring for why rejecting instead used to
    # kill every single generated item at N5.
    context = _soften_or_fail(context, level, q_id, "the scene-setting line") if context else context
    turns = [
        {"speaker": t["speaker"], "textJp": _soften_or_fail(t["textJp"], level, q_id, "a dialogue turn")}
        for t in turns
    ]
    question_jp = _soften_or_fail(question_jp, level, q_id, "the question")
    choices_text = [_soften_or_fail(c, level, q_id, "a choice") for c in choices_text]

    # Re-check what _validate_listening_mcq_item already checked on the
    # raw text: two choices that differed only in kanji spelling (時間 vs
    # 時かん) collapse into the same string once softened, which would
    # otherwise ship a question with a duplicate -- and, if the duplicate
    # includes the correct answer, two right answers.
    if len(set(choices_text)) != 4:
        raise GenerationFailed(f"{q_id}: choices collapsed into duplicates once softened to kana")

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
# independent free generation, so the budget is a flat cap on LLM CALLS
# rather than "candidates remaining in a pool".
#
# Counting calls, not items: the previous version added the requested
# batch size to an item budget of count*3, which meant a mondai wanting
# 7 items allowed 21 "attempts" that a hard-failing model consumed in 7
# calls -- a budget whose name and whose behaviour disagreed. One spare
# call past the minimum is the real intent: enough to re-ask for the
# handful of items a batch dropped, not enough to grind.
_SPARE_BATCH_CALLS = 1


def _build_listening_mcq_mondai(spec: dict, level: str) -> dict:
    questions = []
    calls = 0
    max_calls = -(-spec["count"] // _LISTENING_MCQ_BATCH_SIZE) + _SPARE_BATCH_CALLS
    while len(questions) < spec["count"] and calls < max_calls:
        batch_n = min(_LISTENING_MCQ_BATCH_SIZE, spec["count"] - len(questions))
        calls += 1
        prompt = _LISTENING_MCQ_PROMPT_BATCH.format(
            n=batch_n, level=level, name_jp=spec["name_jp"], allowed_kanji=kanji_instruction(level),
        )
        # LLMUnavailable deliberately NOT caught: no model could be
        # reached at all, which no amount of re-asking fixes. Letting it
        # fly past this loop, past _generate_listening_paper_once, and
        # past exam_pipeline's retry loop (which only catches
        # GenerationFailed) is what makes a provider outage cost one
        # request instead of the whole cascade.
        try:
            items = call_llm_json_batch(prompt, expected_items=batch_n)
        except GenerationFailed as e:
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
            except GenerationFailed as e:
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
# 2, not 3: an outer attempt re-runs EVERY mondai from scratch, so it
# multiplies the whole section's LLM spend, while the batch loop above
# already retries the thing that actually needed retrying. Two leaves a
# genuine second chance for the paper-level checks exam_pipeline runs
# (validate_content / answer-position balance) without a third full
# re-generation on top.
_MAX_GENERATION_ATTEMPTS = 2
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


def _flatten_listening_questions(mondai_list: list[dict]) -> list[dict]:
    return [q for m in mondai_list for q in m["questions"]]


def generate_listening_paper(level: str, seed: int) -> dict:
    # check_duplicates=False: questionPromptJp here is the spoken
    # comprehension question's own text, not a test-item identity the
    # way a vocab/kanji target word is -- and this generator doesn't
    # even populate the field validate_no_duplicate_targets actually
    # reads (promptJp), so it would flag every item as a duplicate of
    # the first if left on. Same reasoning as exam_reading_gen.py/
    # exam_grammar_gen.py's own check_duplicates=False.
    return generate_paper(
        generate_once=_generate_listening_paper_once,
        flatten=_flatten_listening_questions,
        level=level, seed=seed,
        max_attempts=_MAX_GENERATION_ATTEMPTS,
        check_duplicates=False,
        paper_label="listening",
    )
