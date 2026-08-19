# ── 文法 (grammar) generator ──────────────────────────────────
# 文の文法1 (grammar-fill), 文の文法2 (star/sentence-order), and
# 文章の文法 (cloze passage) — all LLM-generated, same discipline as
# exam_vocab_gen.py's paraphrase/usage and exam_reading_gen.py's
# passages: kanji-gated prompt via study/llm_shared, strict schema
# validation, never trust the model's self-report where code can check
# the claim directly instead.
#
# 文の文法1/2 draw their TARGET grammar point from
# content/grammar_points_data.py — an original ~96-point catalog
# (pattern/structure/short gloss only, cross-checked against multiple
# independent sources), never from content/grammar_data.py (the
# scraped-from-jlptsensei.com file this project is specifically
# avoiding — see grammar_points.json's own "_meta" field). The LLM
# still writes every actual sentence and distractor; the catalog only
# supplies WHICH pattern a given item tests, the same way
# exam_kanji_gen.py's owned deck data supplies WHICH word a kanji item
# tests without supplying any sentence.
#
# 文章の文法 doesn't draw from the catalog at all: each blank in a
# cloze passage tests whichever connector/form fits that specific spot
# in the LLM's own passage, one call generating the whole passage +
# all its blanks together (the blanks are coupled — they have to form
# one coherent text — unlike every other generator's per-item calls).
#
# 文の文法2's piece-splitting: the plan called for CODE (not the LLM)
# to determine phrase boundaries and the answer, specifically because
# trusting an LLM's own claim about which piece is "the star slot"
# would make grading unreliable. This module still asks the LLM to
# mark boundaries (a full-width ／ between phrases) — real bunsetsu
# segmentation from raw morphology.tokenize() output would need phrase-
# grouping logic well beyond what that module's word-level morphemes
# give for free — but the actual GRADING claim (which piece contains
# the grammar point) is independently VERIFIED in code by checking the
# claimed piece's text for a real substring of the pattern, and
# rejected outright if the check fails. The LLM proposes; the code
# decides.
import json
import logging
import random
import re

from content.grammar_points_data import get_grammar_points
from study.exam_blueprint import LEVEL_BLUEPRINT
from study.exam_validation import validate_content, repair_answer_balance, validate_passage_length, validate_kanji_gate
from study.exam_gen_utils import GenerationFailed, kanji_instruction
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
    """Same contract as _call_llm_json, but for a prompt that asks for N
    items back in one array -- used by the *_BATCH_SIZE builders below.
    Batching amortizes the fixed cost every single-item call pays
    unconditionally (the full kanji-gate list/instruction block, which
    at N5-N3 alone is ~100-650 characters -- see exam_gen_utils.py) over
    several items instead of paying it once per item.

    reasoning=False: live-diagnosed 2026-08 on exactly this shape (~8
    grammar points asked for in one call, per study/llm_shared.py's own
    chat() docstring) -- with reasoning on, the model spends its whole
    completion budget on the reasoning trace and returns nothing usable
    for a multi-item array; off, the same prompt reliably returns real
    content at a fraction of the tokens. Single-item prompts elsewhere
    in this module are unaffected and keep the default (reasoning on)."""
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


def _points_block(points: list[dict]) -> str:
    return "\n".join(
        f"{i + 1}. {p['pattern']} ({p['structure']}) -- meaning: {p['meaning']}"
        for i, p in enumerate(points)
    )


def _pattern_core(pattern: str) -> str:
    # Reduces a catalog pattern to one checkable substring: the text
    # after the last 〜 (some entries carry a leading Japanese label
    # like "使役形 〜させる"), then just the first alternative if the
    # entry records several ("〜てあげる／てくれる／てもらう" -> "てあげる").
    # Known-weak on 2-part patterns like "から〜まで" (reduces to just
    # "まで") -- accepted, documented limitation rather than a deeper
    # parse for a handful of entries.
    if "〜" in pattern:
        pattern = pattern.rsplit("〜", 1)[1]
    return pattern.split("／")[0].split("(")[0].strip()


# ── 文の文法1: grammar-fill ──────────────────────────────────
# Batched N points per call (was 1 call per point): every call pays the
# same fixed overhead regardless of batch size (the full kanji-gate
# list/instruction plus the style instructions), so asking for
# _FILL_BATCH_SIZE items at once divides that fixed cost by the batch
# size instead of paying it once per grammar point.
_FILL_BATCH_SIZE = 8

_FILL_PROMPT_BATCH = """You are writing {n} separate JLPT {level} grammar \
questions (文の文法1 style: fill in the blank with the correct \
grammatical form) -- one question per grammar point below, each \
independent of the others.

Grammar points to test, in order:
{points_block}

For EACH point, write ONE natural Japanese sentence that uses that \
point's grammar, with the grammar point itself replaced by a blank \
marker "＿＿＿＿". Any kanji you use elsewhere in a sentence MUST come \
from this list:
{allowed_kanji}
(use hiragana instead for anything else).

Then give exactly 4 answer choices for that blank: one is the point's own \
form as it fits the blank; the other three are DIFFERENT grammar forms or \
particles a JLPT {level} learner might plausibly confuse it with -- \
near-miss by grammatical category, not random words.

Respond with ONLY JSON (no markdown fences, no commentary): a JSON array \
of exactly {n} objects, ONE PER POINT IN THE SAME ORDER, each matching:
{{"sentenceJp": "...＿＿＿＿...", "choices": ["...", "...", "...", "..."], "correctIndex": 0}}
"""

_FILL_INSTRUCTIONS_JP = "＿＿＿＿に　なにを　いれますか。1・2・3・4から　いちばん　いい　ものを　一つ　えらんで　ください。"


def _validate_fill_item(item, level: str, q_id: str, number: int) -> dict:
    """Same validation _build_one_fill_question used to do inline,
    split out so it can be applied to each element of a batch response
    without re-issuing the LLM call."""
    if not isinstance(item, dict):
        raise GenerationFailed(f"{q_id}: item is not an object")

    sentence = item.get("sentenceJp")
    choices_text = item.get("choices")
    correct_index = item.get("correctIndex")

    if not isinstance(sentence, str) or sentence.count("＿＿＿＿") != 1:
        raise GenerationFailed(f"{q_id}: sentence missing exactly one blank marker")
    if not sentence_kanji_ok(sentence.replace("＿＿＿＿", ""), level):
        raise GenerationFailed(f"{q_id}: sentence has kanji outside {level}'s allowed set")
    if not isinstance(choices_text, list) or len(choices_text) != 4:
        raise GenerationFailed(f"{q_id}: expected 4 choices")
    if not all(isinstance(c, str) and c.strip() for c in choices_text) or len(set(choices_text)) != 4:
        raise GenerationFailed(f"{q_id}: invalid or duplicate choices")
    if not isinstance(correct_index, int) or not (0 <= correct_index < 4):
        raise GenerationFailed(f"{q_id}: invalid correctIndex")

    ids = ["c1", "c2", "c3", "c4"]
    choices = [{"id": ids[i], "textJp": t} for i, t in enumerate(choices_text)]
    return {
        "id": q_id,
        "number": number,
        "promptJp": sentence,
        "choices": choices,
        "answer": ids[correct_index],
    }


def _build_grammar_fill_mondai(spec: dict, level: str, points: list[dict], used_patterns: set, rng: random.Random) -> dict:
    candidates = [p for p in points if p["pattern"] not in used_patterns]
    rng.shuffle(candidates)

    questions = []
    pos = 0
    while len(questions) < spec["count"] and pos < len(candidates):
        batch = candidates[pos:pos + _FILL_BATCH_SIZE]
        pos += len(batch)
        prompt = _FILL_PROMPT_BATCH.format(
            n=len(batch), level=level, points_block=_points_block(batch),
            allowed_kanji=kanji_instruction(level),
        )
        try:
            items = _call_llm_json_batch(prompt)
        except (RuntimeError, GenerationFailed) as e:
            logger.warning("Grammar-fill batch of %d failed: %s", len(batch), e)
            continue

        # zip stops at the shorter list if the model returned fewer
        # items than asked for -- those trailing points are simply not
        # marked used and stay candidates for a later batch, same as a
        # per-item failure used to just move on to the next point.
        for point, item in zip(batch, items):
            if len(questions) >= spec["count"]:
                break
            q_id = f"{spec['id']}_q{len(questions) + 1}"
            try:
                q = _validate_fill_item(item, level, q_id, len(questions) + 1)
            except GenerationFailed as e:
                logger.warning("Grammar-fill item for %s failed: %s", point["pattern"], e)
                continue
            used_patterns.add(point["pattern"])
            questions.append(q)

    if len(questions) < spec["count"]:
        raise GenerationFailed(f"{spec['id']}: only found {len(questions)}/{spec['count']} valid grammar-fill items")

    return {
        "id": spec["id"], "number": spec["official_number"], "type": "mcq-text",
        "instructionsJp": _FILL_INSTRUCTIONS_JP,
        "instructions": "Choose the word/form that best fits the blank.",
        "questions": questions,
    }


# ── 文の文法2: star / sentence-order ─────────────────────────
# Same batching rationale as grammar-fill above: N grammar points asked
# for in one call instead of N separate calls, each of which used to
# resend the full kanji-gate list/instructions on its own.
_STAR_BATCH_SIZE = 8

_STAR_PROMPT_BATCH = """You are writing {n} separate JLPT {level} grammar \
questions (文の文法2 style: put the scrambled pieces of a sentence in the \
correct order) -- one question per grammar point below, each independent \
of the others.

Grammar points to use, in order:
{points_block}

For EACH point, write ONE natural, complete Japanese sentence that uses \
that point's grammar, ending in a natural sentence-final form (。or か). \
Any kanji you use MUST come from this list:
{allowed_kanji}
(use hiragana instead for anything else).

Then split that ENTIRE sentence into exactly 4 consecutive pieces at \
natural phrase boundaries (each piece a short phrase of a few words, not \
a single character and not a whole clause), by inserting a full-width \
slash ／ between each piece -- the 4 pieces joined back together must \
reproduce the sentence exactly, with nothing before the first piece or \
after the last one. Separately, give any short scene-setting text that \
comes BEFORE that sentence, if any (contextJp; empty string is fine). \
Exactly one of the 4 pieces must contain the grammar point it was \
written for -- tell me which one (0-indexed).

Respond with ONLY JSON (no markdown fences, no commentary): a JSON array \
of exactly {n} objects, ONE PER POINT IN THE SAME ORDER, each matching:
{{"contextJp": "...", "sentenceWithSlashes": "piece1／piece2／piece3／piece4", "grammarPieceIndex": 0}}
"""


def _validate_star_item(point: dict, item, level: str, q_id: str, number: int, rng: random.Random) -> dict:
    """Same validation _build_one_star_question used to do inline,
    split out so it can be applied to each element of a batch response
    without re-issuing the LLM call."""
    if not isinstance(item, dict):
        raise GenerationFailed(f"{q_id}: item is not an object")

    context = item.get("contextJp", "")
    raw = item.get("sentenceWithSlashes")
    claimed_index = item.get("grammarPieceIndex")

    if not isinstance(context, str):
        raise GenerationFailed(f"{q_id}: contextJp missing")
    if not isinstance(raw, str):
        raise GenerationFailed(f"{q_id}: sentenceWithSlashes missing")

    pieces_text = [p.strip() for p in raw.split("／")]
    if len(pieces_text) != 4:
        raise GenerationFailed(f"{q_id}: expected 4 slash-separated pieces, got {len(pieces_text)}")
    if any(not p for p in pieces_text):
        raise GenerationFailed(f"{q_id}: an empty piece")
    if len(set(pieces_text)) != 4:
        raise GenerationFailed(f"{q_id}: duplicate piece text")

    full_sentence = context + "".join(pieces_text)
    if not sentence_kanji_ok(full_sentence, level):
        raise GenerationFailed(f"{q_id}: sentence has kanji outside {level}'s allowed set")

    if not isinstance(claimed_index, int) or not (0 <= claimed_index < 4):
        raise GenerationFailed(f"{q_id}: invalid grammarPieceIndex")

    # Verify, don't trust: the piece the model names must actually
    # contain a real substring of the target pattern.
    core = _pattern_core(point["pattern"])
    if core not in pieces_text[claimed_index]:
        raise GenerationFailed(
            f"{q_id}: claimed grammar piece {pieces_text[claimed_index]!r} doesn't contain {core!r}"
        )

    ids = ["p1", "p2", "p3", "p4"]
    order = list(ids)  # pieces_text is already in correct grammatical (reading) order
    star_index = claimed_index
    answer_id = order[star_index]

    display_pieces = [{"id": ids[i], "textJp": t} for i, t in enumerate(pieces_text)]
    rng.shuffle(display_pieces)  # the order learners see the 4 answer buttons in, independent of the correct sequence

    return {
        "id": q_id,
        "number": number,
        "contextJp": context,
        "pieces": display_pieces,
        "order": order,
        "starIndex": star_index,
        "answer": answer_id,
    }


def _build_sentence_order_mondai(spec: dict, level: str, points: list[dict], used_patterns: set, rng: random.Random) -> dict:
    candidates = [p for p in points if p["pattern"] not in used_patterns]
    rng.shuffle(candidates)

    questions = []
    pos = 0
    while len(questions) < spec["count"] and pos < len(candidates):
        batch = candidates[pos:pos + _STAR_BATCH_SIZE]
        pos += len(batch)
        prompt = _STAR_PROMPT_BATCH.format(
            n=len(batch), level=level, points_block=_points_block(batch),
            allowed_kanji=kanji_instruction(level),
        )
        try:
            items = _call_llm_json_batch(prompt)
        except (RuntimeError, GenerationFailed) as e:
            logger.warning("Sentence-order batch of %d failed: %s", len(batch), e)
            continue

        for point, item in zip(batch, items):
            if len(questions) >= spec["count"]:
                break
            q_id = f"{spec['id']}_q{len(questions) + 1}"
            try:
                q = _validate_star_item(point, item, level, q_id, len(questions) + 1, rng)
            except GenerationFailed as e:
                logger.warning("Sentence-order item for %s failed: %s", point["pattern"], e)
                continue
            used_patterns.add(point["pattern"])
            questions.append(q)

    if len(questions) < spec["count"]:
        raise GenerationFailed(f"{spec['id']}: only found {len(questions)}/{spec['count']} valid sentence-order items")

    return {
        "id": spec["id"], "number": spec["official_number"], "type": "sentence-order",
        "instructionsJp": "つぎの　ぶんを　ただしい　じゅんばんに　ならべて　ください。★に　はいる　ものを　えらんで　ください。",
        "instructions": "Put the sentence pieces in the correct order and choose what belongs in the ★ position.",
        "questions": questions,
    }


# ── 文章の文法: cloze passage ─────────────────────────────────
_CLOZE_PROMPT = """You are writing one JLPT {level} grammar cloze passage \
(文章の文法 style: a short passage with several numbered blanks, each \
testing a grammar form, particle, or connecting word).

Write a short, coherent Japanese passage (approximately {chars} \
characters, stay within 20% of this) on any everyday topic, appropriate \
for JLPT {level}. Any kanji you use MUST come from this list:
{allowed_kanji}
(use hiragana instead for anything else). Include exactly {blank_count} \
blanks in the passage, marked 【1】【2】...【{blank_count}】 in that order, \
each at a spot where a grammar form, particle, or connecting word \
(however/therefore/that is to say/etc.) is the natural choice -- not \
vocabulary or kanji-reading blanks.

For each blank, give exactly 4 short answer choices (grammar forms, \
particles, or connectors -- not full sentences), one correct and three \
plausible-but-wrong for that specific spot.

Respond with ONLY JSON (no markdown fences, no commentary), matching \
exactly this schema:
{{"titleJp": "...", "textTemplateJp": "...【1】...【2】...", "blanks": [{{"choices": ["...", "...", "...", "..."], "correctIndex": 0}}, ...]}}
"""


def _build_cloze_mondai(spec: dict, level: str) -> dict:
    blank_count = spec["count"]
    chars = spec.get("passage_chars", 150)
    prompt = _CLOZE_PROMPT.format(level=level, chars=chars, blank_count=blank_count, allowed_kanji=kanji_instruction(level))
    data = _call_llm_json(prompt)

    title = data.get("titleJp")
    template = data.get("textTemplateJp")
    blanks_raw = data.get("blanks")

    if not isinstance(title, str) or not title.strip():
        raise GenerationFailed(f"{spec['id']}: missing titleJp")
    if not isinstance(template, str):
        raise GenerationFailed(f"{spec['id']}: missing textTemplateJp")

    markers = re.findall(r"【(\d+)】", template)
    expected_markers = [str(i) for i in range(1, blank_count + 1)]
    if markers != expected_markers:
        raise GenerationFailed(f"{spec['id']}: expected markers {expected_markers}, got {markers}")

    plain_text = re.sub(r"【\d+】", "", template)
    errors = validate_passage_length(plain_text, chars)
    errors += validate_kanji_gate(plain_text, level)
    errors += validate_kanji_gate(title, level)
    if errors:
        raise GenerationFailed(f"{spec['id']}: " + "; ".join(errors))

    if not isinstance(blanks_raw, list) or len(blanks_raw) != blank_count:
        got = len(blanks_raw) if isinstance(blanks_raw, list) else "n/a"
        raise GenerationFailed(f"{spec['id']}: expected {blank_count} blanks, got {got}")

    blanks = []
    for i, b in enumerate(blanks_raw):
        choices_text = b.get("choices")
        correct_index = b.get("correctIndex")
        if not isinstance(choices_text, list) or len(choices_text) != 4:
            raise GenerationFailed(f"{spec['id']} blank {i + 1}: expected 4 choices")
        if not all(isinstance(c, str) and c.strip() for c in choices_text) or len(set(choices_text)) != 4:
            raise GenerationFailed(f"{spec['id']} blank {i + 1}: invalid or duplicate choices")
        if not isinstance(correct_index, int) or not (0 <= correct_index < 4):
            raise GenerationFailed(f"{spec['id']} blank {i + 1}: invalid correctIndex")

        ids = ["c1", "c2", "c3", "c4"]
        choices = [{"id": ids[j], "textJp": t} for j, t in enumerate(choices_text)]
        blanks.append({
            "id": f"{spec['id']}_b{i + 1}",
            "number": i + 1,
            "choices": choices,
            "answer": ids[correct_index],
        })

    return {
        "id": spec["id"], "number": spec["official_number"], "type": "cloze-passage",
        "instructionsJp": "つぎの　ぶんしょうを　よんで、【1】から【{}】の　なかに　いれる　ものを　1・2・3・4から　えらんで　ください。".format(blank_count),
        "instructions": "Read the passage and choose the best word for each numbered blank.",
        "passages": [{
            "id": f"{spec['id']}_p1",
            "titleJp": title,
            "textTemplateJp": template,
            "blanks": blanks,
        }],
    }


# ── Section orchestrator ─────────────────────────────────────────
_MAX_GENERATION_ATTEMPTS = 3


def _grammar_specs_for_level(level: str) -> list[dict]:
    specs = []
    for section in LEVEL_BLUEPRINT[level]["sections"]:
        for m in section["mondai"]:
            if m["type"] in ("grammar-fill", "sentence-order", "cloze-passage"):
                specs.append(m)
    specs.sort(key=lambda m: m["official_number"])
    return specs


def _flatten_grammar_questions(mondai_list: list[dict]) -> list[dict]:
    out = []
    for m in mondai_list:
        if m["type"] == "cloze-passage":
            for p in m["passages"]:
                out.extend(p["blanks"])
        else:
            out.extend(m["questions"])
    return out


def _generate_grammar_paper_once(level: str) -> dict:
    rng = random.Random()  # unseeded: candidate-order only, no reproducibility claim -- same reasoning as exam_reading_gen.py
    specs = _grammar_specs_for_level(level)
    points = get_grammar_points(level)

    used_patterns: set = set()
    mondai = []
    included_items = 0

    for spec in specs:
        if not OPENROUTER_API_KEY:
            logger.warning("Skipping %s (%s): OPENROUTER_API_KEY not configured", spec["id"], spec["type"])
            continue
        try:
            if spec["type"] == "grammar-fill":
                built = _build_grammar_fill_mondai(spec, level, points, used_patterns, rng)
            elif spec["type"] == "sentence-order":
                built = _build_sentence_order_mondai(spec, level, points, used_patterns, rng)
            elif spec["type"] == "cloze-passage":
                built = _build_cloze_mondai(spec, level)
            else:
                continue
        except (RuntimeError, GenerationFailed) as e:
            # RuntimeError: _build_cloze_mondai has no per-item retry loop
            # of its own (unlike the other two builders, which already
            # catch RuntimeError internally per-item) -- a raw chat()
            # failure (e.g. every model rate-limited/out of credit)
            # otherwise propagated uncaught past this function AND past
            # generate_grammar_paper's own except GenerationFailed below,
            # surfacing as a raw 500 instead of routes/exams.py's intended
            # 503 -- live-diagnosed 2026-08 when OpenRouter's free-tier
            # quota and paid credit ran out mid-testing.
            logger.warning("Skipping %s: %s", spec["id"], e)
            continue
        mondai.append(built)
        included_items += spec["count"]

    if not mondai:
        raise GenerationFailed(f"{level}: no grammar mondai could be generated at all")

    return {
        "level": level,
        "title": f"{level} Grammar Practice",
        "titleJp": f"{level} 文法",
        "sections": [{
            "id": "grammar",
            "label": "Grammar",
            "labelJp": "文法",
            "timeLimitMin": max(10, round(1.5 * included_items)),
            "mondai": mondai,
        }],
    }


def generate_grammar_paper(level: str, seed: int) -> dict:
    # `seed` unused, same as exam_reading_gen.py: nothing here is
    # locally sampled in a way that needs reproducibility, and an LLM
    # call is non-deterministic regardless of any local seed. Kept for
    # interface symmetry with the deterministic generators.
    last_errors: list[str] = []
    for _attempt in range(_MAX_GENERATION_ATTEMPTS):
        try:
            paper = _generate_grammar_paper_once(level)
        except GenerationFailed as e:
            last_errors = [str(e)]
            continue

        flat = _flatten_grammar_questions(paper["sections"][0]["mondai"])
        content_errors = validate_content(flat, check_duplicates=False)
        # Same reasoning as exam_vocab_gen.py's generate_vocabulary_paper:
        # an answer-position skew is a shuffle problem, not a content
        # problem — fix it by reshuffling in place rather than paying
        # for a full LLM regeneration of every grammar-fill/star/cloze
        # item just to fix a shuffle.
        if not content_errors and repair_answer_balance(flat, random.Random()):
            return paper
        last_errors = content_errors or ["answer position skewed across the paper (could not repair by reshuffling)"]

    raise GenerationFailed(
        f"Could not generate a valid {level} grammar paper after {_MAX_GENERATION_ATTEMPTS} attempts: {last_errors}"
    )
