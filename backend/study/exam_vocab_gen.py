# ── 文脈規定 / 言い換え類義 / 用法 + section orchestrator ────────
# This module is also the vocabulary SECTION's orchestrator now — the
# top-level entry point registered in routes/exams.py — not just the
# three new mondai types in its name. exam_kanji_gen.py's 漢字読み/
# 表記 builders are called from here too, so a level's paper is one
# coherent "vocabulary" section built from every mondai type this
# project can currently generate for it.
#
# 文脈規定 is deterministic: it blanks the target word out of a REAL,
# kanji-gated example sentence (the same real-sentence-mining approach
# routes/reading.py uses), so the "correct answer" is simply the word
# that was actually there — no inference, nothing to get wrong.
#
# 言い換え類義 and 用法 are LLM-generated (study/llm_shared.py),
# because a reliable *synonym* relationship isn't something the data
# this project owns actually encodes (JMdict's own cross-reference/
# synonym pointers aren't part of what this project's build pipeline
# extracts), and 用法 fundamentally needs four freshly-written sentence
# *contexts*, three of them wrong on purpose — that's authorship, not
# a lookup. Both follow reading.py's exact discipline: kanji-gated
# prompt, strict schema validation, multi-model fallback via
# study/llm_shared.chat().
#
# Degrades gracefully rather than failing the whole paper: if
# OPENROUTER_API_KEY isn't configured, or a specific mondai's
# generation doesn't clear enough valid items, that ONE mondai is
# skipped (loudly logged) and every other mondai still ships — a
# partial vocabulary section is honest; an empty one because one
# LLM-dependent piece is unavailable is not. 語形成 (N2 only, 5 items)
# has no generator at all yet — it needs a curated affix list
# (不-, -さ, -がる, ...) that doesn't exist in any owned data; skipped
# the same way, logged, tracked as backlog rather than blocking.
import json
import logging
import random
import re

from content.vocab_data import VOCAB_BY_LEVEL
from content.vocab_extras import get_vocab_extras, word_category
from study.exam_blueprint import LEVEL_BLUEPRINT
from study.exam_gen_utils import GenerationFailed, make_choices, kanji_instruction, call_llm_json_batch
from study.exam_pipeline import generate_paper
from study.llm_shared import chat, sentence_kanji_ok, OPENROUTER_API_KEY
import study.exam_kanji_gen as exam_kanji_gen

logger = logging.getLogger(__name__)

_WORD_RE = re.compile(r"[a-zA-Z']+")
_STOPWORDS = {
    "a", "an", "the", "to", "of", "in", "on", "at", "by", "for", "with",
    "and", "or", "e", "g", "eg", "etc", "someone", "something", "one",
    "ones", "is", "be", "as", "it", "that", "this",
}


def _content_words(text: str) -> set:
    return {w for w in (m.lower() for m in _WORD_RE.findall(text or "")) if w not in _STOPWORDS and len(w) > 1}


def _first_reading(word: dict) -> str:
    return (word.get("kana") or "").split("/")[0].strip()


def _display(word: dict) -> str:
    # word["kana"] can itself be "/"-separated for a kana-only entry
    # (e.g. "いい/よい", "じゃ/じゃあ" — 11 across the deck) the same
    # way word["kanji"] sometimes is — falling back to the raw kana
    # field here would show "いい/よい" as a single, garbled choice.
    # _first_reading picks one real, complete, unambiguous reading.
    return word.get("kanji") or _first_reading(word)


# ── 文脈規定 (deterministic) ──────────────────────────────────
_CONTEXT_INSTRUCTIONS_JP = "（　＿＿＿＿　）に　なにを　いれますか。1・2・3・4から　いちばん　いい　ものを　一つ　えらんで　ください。"


def _blank_sentence(example: dict) -> str:
    # example["segments"] already marks which chunk(s) are the
    # headword (see vocab_extras.get_vocab_extras) — collapsing a
    # CONSECUTIVE run of highlighted segments into one blank matters
    # for a conjugated word, whose kanji-run and okurigana tail are
    # two separate highlighted segments; naively blanking each one
    # would produce two adjacent blank markers for one word.
    out = []
    prev_highlight = False
    for seg in example["segments"]:
        if seg["highlight"]:
            if not prev_highlight:
                out.append("＿＿＿＿")
            prev_highlight = True
        else:
            out.append(seg["text"])
            prev_highlight = False
    return "".join(out)


def _pick_context_example(word: dict, level: str, rng: random.Random) -> dict | None:
    extras = get_vocab_extras(word.get("kanji") or "", word["kana"], "", "en")
    examples = list(extras["examples"])
    rng.shuffle(examples)
    for ex in examples:
        if sentence_kanji_ok(ex["jp"], level):
            return ex
    return None


def build_vocab_context_distractors(word: dict, pool: list[dict], rng: random.Random) -> list[str]:
    # Near-miss by construction: same coarse part of speech (so a
    # distractor is at least grammatically the right SHAPE for the
    # blank), genuinely different meaning (no shared gloss words with
    # the target) — not a random word from the level.
    #
    # Known limitation, honestly: unlike the phonetic/radical
    # techniques in exam_kanji_gen.py, this can't guarantee a
    # distractor doesn't ALSO grammatically fit the specific sentence
    # — that needs either deep semantic understanding of the exact
    # context or human/LLM review, neither of which this deterministic
    # pass has. A same-POS, different-meaning word is still a real,
    # useful near-miss; it just isn't airtight the way the kanji-gen
    # techniques are.
    target_category = word_category(word.get("kanji") or "", word["kana"])
    target_gloss = _content_words(word.get("meaning", ""))
    candidates = []
    for other in pool:
        if other["kanji"] == word["kanji"] and other["kana"] == word["kana"]:
            continue
        text = _display(other)
        if not text:
            continue
        if word_category(other.get("kanji") or "", other["kana"]) != target_category:
            continue
        if target_gloss & _content_words(other.get("meaning", "")):
            continue
        candidates.append(text)
    rng.shuffle(candidates)
    return candidates


def _build_vocab_context_mondai(spec: dict, pool: list[dict], used_words: set, used_prompts: set,
                                 rng: random.Random, level: str) -> dict:
    questions = []
    for word in pool:
        if len(questions) >= spec["count"]:
            break
        key = (word["kanji"], word["kana"])
        display = _display(word)
        if key in used_words or not display or display in used_prompts:
            continue
        example = _pick_context_example(word, level, rng)
        if example is None:
            continue
        blanked = _blank_sentence(example)
        if "＿＿＿＿" not in blanked:
            continue
        distractors = build_vocab_context_distractors(word, pool, rng)
        made = make_choices(rng, display, distractors)
        if made is None:
            continue
        choices, answer_id = made
        used_words.add(key)
        used_prompts.add(display)
        questions.append({
            "id": f"{spec['id']}_q{len(questions) + 1}",
            "number": len(questions) + 1,
            "promptJp": blanked,
            "choices": choices,
            "answer": answer_id,
        })

    if len(questions) < spec["count"]:
        raise GenerationFailed(f"{spec['id']}: only found {len(questions)}/{spec['count']} valid context items")

    return {
        "id": spec["id"],
        "number": spec["official_number"],
        "type": "mcq-text",
        "instructionsJp": _CONTEXT_INSTRUCTIONS_JP,
        "instructions": "Choose the word that best fits the blank.",
        "questions": questions,
    }


# ── 言い換え類義 / 用法 (LLM-generated) ──────────────────────────
_BRACKET_RE = re.compile(r"【(.+?)】")


def _extract_bracket(sentence: str) -> tuple[str, str] | tuple[None, None]:
    m = _BRACKET_RE.search(sentence)
    if not m:
        return None, None
    word = m.group(1)
    clean = sentence[:m.start()] + word + sentence[m.end():]
    return clean, word


# call_llm_json/call_llm_json_batch (study/exam_gen_utils.py) replace
# this module's former private copies -- the single-item variant was
# defined here but never actually called; only the batch form was.


def _words_block(words: list[dict]) -> str:
    return "\n".join(
        f"{i + 1}. {_display(w)} ({_first_reading(w)}) -- meaning: \"{w.get('meaning', '')}\""
        for i, w in enumerate(words)
    )


_PARAPHRASE_BATCH_SIZE = 6

_PARAPHRASE_PROMPT_BATCH = """You are writing {n} separate JLPT {level} \
vocabulary questions (言い換え類義 style: choose the word or phrase \
closest in meaning to the underlined one) -- one question per target word \
below, each independent of the others.

Target words, in order:
{words_block}

For EACH target word, write ONE short, natural Japanese sentence that \
uses it (inflected form is fine, e.g. 食べた for 食べる). Mark the target \
word by wrapping it in 【 】 brackets, exactly once. Any kanji you use, \
other than kanji already in the target word itself, MUST come from this \
list:
{allowed_kanji}
(use hiragana instead for anything else).

Then give exactly 4 short answer choices in Japanese (each a word or short \
phrase). Exactly ONE choice could naturally replace the bracketed word in \
that sentence with (nearly) the same meaning. The other THREE must be \
different enough in meaning to be clearly wrong, but still plausible words \
a learner could confuse it with.

Respond with ONLY JSON (no markdown fences, no commentary): a JSON array \
of exactly {n} objects, ONE PER WORD IN THE SAME ORDER, each matching:
{{"sentenceJp": "...【...】...", "choices": ["...", "...", "...", "..."], "correctIndex": 0}}
"""

# Live-diagnosed 2026-08: asking a model to generate BOTH a paraphrase
# item and grade its own correctness produces a real, reproducible
# error rate that survived a model upgrade — メートル (meters) "paraphrased"
# as センチ (centimeters), おいしい (tasty) as あまい (sweet) — thematically
# related, not actually interchangeable in meaning. Exactly the failure
# mode the original plan called a second-model self-consistency check
# for; this is that check, applied specifically here since this is
# where live testing actually caught a wrong-answer problem (as
# opposed to exam_grammar_gen.py's star-question claim, which is
# checked by a direct substring match in code, no second call needed).
#
# Batched the same way as generation: one call verifies every claim
# from a whole paraphrase batch, instead of one verify call per claim
# — this was previously 2 LLM calls per word (1 generate + 1 verify);
# now it's 2 calls per _PARAPHRASE_BATCH_SIZE words.
_VERIFY_PARAPHRASE_PROMPT_BATCH = """For each of the following {n} \
Japanese paraphrase claims, decide whether the claimed replacement \
genuinely keeps (nearly) the same meaning as the bracketed word in its \
sentence -- a real near-synonym or paraphrase, not just a related or \
associated word. Judge each claim independently of the others.

Be skeptical by default: a claimed paraphrase is often wrong even when it \
sounds plausible -- e.g. claiming センチ (centimeters) paraphrases メートル \
(meters) is wrong (different units, not synonyms), and claiming あまい \
(sweet) paraphrases おいしい (tasty) is wrong (a taste, not a general \
judgment of quality) -- both are merely related, not substitutable.

Claims, in order:
{claims_block}

Respond with ONLY JSON (no markdown fences, no commentary): a JSON array \
of exactly {n} booleans, ONE PER CLAIM IN THE SAME ORDER, \
e.g. [true, false, ...].
"""


def _verify_paraphrase_answers_batch(claims: list[tuple[str, str, str]]) -> list[bool]:
    """claims: [(sentence, target, claimed), ...]. Returns one bool per
    claim, same order. On any failure (network, bad JSON, wrong-length
    array) every claim in the batch is treated as unverified -> False,
    the same fail-closed behavior the old per-item version had."""
    claims_block = "\n".join(
        f'{i + 1}. Sentence: {sentence} | bracketed word: "{target}" | claimed replacement: "{claimed}"'
        for i, (sentence, target, claimed) in enumerate(claims)
    )
    prompt = _VERIFY_PARAPHRASE_PROMPT_BATCH.format(n=len(claims), claims_block=claims_block)
    try:
        content = chat([
            {"role": "system", "content": prompt},
            {"role": "user", "content": "Verify the claims."},
        ], reasoning=False)
        cleaned = re.sub(r"^```(?:json)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
        data = json.loads(cleaned)
    except (RuntimeError, json.JSONDecodeError):
        return [False] * len(claims)  # can't verify -> don't trust any claim in the batch
    if not isinstance(data, list) or len(data) != len(claims):
        return [False] * len(claims)
    return [d is True for d in data]


_USAGE_BATCH_SIZE = 4

_USAGE_PROMPT_BATCH = """You are writing {n} separate JLPT {level} \
vocabulary questions (用法 style: choose the sentence that uses the \
target word correctly) -- one question per target word below, each \
independent of the others.

Target words, in order:
{words_block}

For EACH target word, write exactly 4 short, natural Japanese sentences, \
each using that exact word once (inflected form is fine). In each \
sentence, mark the target word by wrapping it in 【 】 brackets, exactly \
once per sentence. Any kanji you use, other than kanji already in the \
target word itself, MUST come from this list:
{allowed_kanji}
(use hiragana instead for anything else).

For each word, exactly ONE of its 4 sentences must use the word correctly \
and naturally. The other THREE must each be subtly wrong for that word — \
either the wrong meaning/nuance for that context, or grammatically wrong \
for its part of speech — while still looking plausible to a learner who \
doesn't know the word well.

Respond with ONLY JSON (no markdown fences, no commentary): a JSON array \
of exactly {n} objects, ONE PER WORD IN THE SAME ORDER, each matching:
{{"sentences": ["...【...】...", "...", "...", "..."], "correctIndex": 0}}
"""


def _pick_batch(candidates: list[dict], pos: int, batch_size: int,
                 used_words: set, used_prompts: set) -> tuple[list[dict], int]:
    """Walks `candidates` from `pos`, skipping words already used
    elsewhere in the paper, collecting up to `batch_size` fresh ones.
    Returns (batch, new_pos)."""
    batch = []
    while pos < len(candidates) and len(batch) < batch_size:
        word = candidates[pos]
        pos += 1
        key = (word["kanji"], word["kana"])
        display = _display(word)
        if key in used_words or not display or display in used_prompts:
            continue
        batch.append(word)
    return batch, pos


def _build_vocab_paraphrase_mondai(spec: dict, pool: list[dict], used_words: set, used_prompts: set,
                                    rng: random.Random, level: str) -> dict:
    questions = []
    candidates = list(pool)
    rng.shuffle(candidates)
    allowed_kanji = kanji_instruction(level)

    pos = 0
    while len(questions) < spec["count"] and pos < len(candidates):
        batch, pos = _pick_batch(candidates, pos, _PARAPHRASE_BATCH_SIZE, used_words, used_prompts)
        if not batch:
            continue

        prompt = _PARAPHRASE_PROMPT_BATCH.format(
            n=len(batch), level=level, words_block=_words_block(batch), allowed_kanji=allowed_kanji,
        )
        try:
            items = call_llm_json_batch(prompt)
        except (RuntimeError, GenerationFailed) as e:
            logger.warning("paraphrase batch of %d failed: %s", len(batch), e)
            continue

        # Pass 1: shape-validate each item (no LLM call yet) and collect
        # the ones worth verifying.
        pending = []  # (word, display, clean, bracketed, choices, answer_id)
        for word, item in zip(batch, items):
            display = _display(word)
            if not isinstance(item, dict):
                continue
            sentence = item.get("sentenceJp")
            choices_text = item.get("choices")
            correct_index = item.get("correctIndex")
            if not isinstance(sentence, str) or sentence.count("【") != 1 or sentence.count("】") != 1:
                continue
            clean, bracketed = _extract_bracket(sentence)
            if clean is None or not sentence_kanji_ok(clean, level):
                continue
            if not isinstance(choices_text, list) or len(choices_text) != 4:
                continue
            if not all(isinstance(c, str) and c.strip() for c in choices_text) or len(set(choices_text)) != 4:
                continue
            if not isinstance(correct_index, int) or not (0 <= correct_index < 4):
                continue
            pending.append((word, display, clean, bracketed, choices_text, correct_index))

        if not pending:
            continue

        # Pass 2: ONE verification call for every claim in this batch,
        # instead of one call per word (see _verify_paraphrase_answers_batch).
        claims = [(clean, bracketed, choices_text[correct_index])
                  for _w, _d, clean, bracketed, choices_text, correct_index in pending]
        verified = _verify_paraphrase_answers_batch(claims)

        for (word, display, clean, bracketed, choices_text, correct_index), ok in zip(pending, verified):
            if len(questions) >= spec["count"]:
                break
            if not ok:
                logger.warning("paraphrase self-check rejected %r -> %r for %s", bracketed, choices_text[correct_index], display)
                continue

            ids = ["c1", "c2", "c3", "c4"]
            choices = [{"id": ids[i], "textJp": t} for i, t in enumerate(choices_text)]
            answer_id = ids[correct_index]

            used_words.add((word["kanji"], word["kana"]))
            used_prompts.add(display)
            questions.append({
                "id": f"{spec['id']}_q{len(questions) + 1}",
                "number": len(questions) + 1,
                "promptJp": clean,
                "underlineJp": bracketed,
                "choices": choices,
                "answer": answer_id,
            })

    if len(questions) < spec["count"]:
        raise GenerationFailed(f"{spec['id']}: only found {len(questions)}/{spec['count']} valid paraphrase items")

    return {
        "id": spec["id"],
        "number": spec["official_number"],
        "type": "mcq-text",
        "instructionsJp": "＿＿＿＿の　ことばに　いちばん　ちかい　いみの　ものを　1・2・3・4から　一つ　えらんで　ください。",
        "instructions": "Choose the word or phrase closest in meaning to the underlined one.",
        "questions": questions,
    }


def _build_vocab_usage_mondai(spec: dict, pool: list[dict], used_words: set, used_prompts: set,
                               rng: random.Random, level: str) -> dict:
    questions = []
    candidates = list(pool)
    rng.shuffle(candidates)
    allowed_kanji = kanji_instruction(level)

    pos = 0
    while len(questions) < spec["count"] and pos < len(candidates):
        batch, pos = _pick_batch(candidates, pos, _USAGE_BATCH_SIZE, used_words, used_prompts)
        if not batch:
            continue

        prompt = _USAGE_PROMPT_BATCH.format(
            n=len(batch), level=level, words_block=_words_block(batch), allowed_kanji=allowed_kanji,
        )
        try:
            items = call_llm_json_batch(prompt)
        except (RuntimeError, GenerationFailed) as e:
            logger.warning("usage batch of %d failed: %s", len(batch), e)
            continue

        for word, item in zip(batch, items):
            if len(questions) >= spec["count"]:
                break
            display = _display(word)
            if not isinstance(item, dict):
                continue
            sentences = item.get("sentences")
            correct_index = item.get("correctIndex")
            if not isinstance(sentences, list) or len(sentences) != 4:
                continue
            if not isinstance(correct_index, int) or not (0 <= correct_index < 4):
                continue

            cleaned = []
            valid = True
            for s in sentences:
                if not isinstance(s, str) or s.count("【") != 1 or s.count("】") != 1:
                    valid = False
                    break
                clean, _bracketed = _extract_bracket(s)
                if clean is None or not sentence_kanji_ok(clean, level):
                    valid = False
                    break
                cleaned.append(clean)
            if not valid or len(set(cleaned)) != 4:
                continue

            ids = ["c1", "c2", "c3", "c4"]
            choices = [{"id": ids[i], "textJp": t} for i, t in enumerate(cleaned)]
            answer_id = ids[correct_index]

            used_words.add((word["kanji"], word["kana"]))
            used_prompts.add(display)
            questions.append({
                "id": f"{spec['id']}_q{len(questions) + 1}",
                "number": len(questions) + 1,
                "promptJp": display,
                "choices": choices,
                "answer": answer_id,
            })

    if len(questions) < spec["count"]:
        raise GenerationFailed(f"{spec['id']}: only found {len(questions)}/{spec['count']} valid usage items")

    return {
        "id": spec["id"],
        "number": spec["official_number"],
        "type": "mcq-text",
        "instructionsJp": "つぎの　ことばの　つかいかたで　もっとも　よい　ものを　1・2・3・4から　一つ　えらんで　ください。",
        "instructions": "Choose the sentence that uses the word correctly.",
        "questions": questions,
    }


# ── Section orchestrator ─────────────────────────────────────────
_MAX_GENERATION_ATTEMPTS = 5


def _generate_vocabulary_paper_once(level: str, seed: int) -> dict:
    rng = random.Random(seed)
    blueprint = LEVEL_BLUEPRINT[level]
    vocab_section = next(s for s in blueprint["sections"] if s["id"] in ("vocabulary", "vocabulary_grammar_reading"))

    # A handful of deck entries (8 across the whole deck, e.g. 丸い/円い)
    # record more than one accepted kanji spelling in the same "kanji"
    # field — see exam_kanji_gen.py's identical note. Excluded from
    # both pools.
    kanji_pool = [w for w in VOCAB_BY_LEVEL.get(level, []) if w.get("kanji") and "/" not in w["kanji"]]
    vocab_pool = [w for w in VOCAB_BY_LEVEL.get(level, []) if "/" not in (w.get("kanji") or "")]
    rng.shuffle(kanji_pool)
    rng.shuffle(vocab_pool)

    used_words: set = set()
    used_prompts: set = set()
    mondai = []
    included_items = 0

    for spec in vocab_section["mondai"]:
        mtype = spec["type"]

        if mtype == "kanji-reading":
            mondai.append(exam_kanji_gen.build_reading_mondai(spec, kanji_pool, used_words, used_prompts, rng))
            included_items += spec["count"]

        elif mtype == "kanji-orthography":
            mondai.append(exam_kanji_gen.build_orthography_mondai(spec, kanji_pool, used_words, used_prompts, rng))
            included_items += spec["count"]

        elif mtype == "vocab-context":
            try:
                mondai.append(_build_vocab_context_mondai(spec, vocab_pool, used_words, used_prompts, rng, level))
                included_items += spec["count"]
            except GenerationFailed as e:
                logger.warning("Skipping %s (%s): %s", spec["id"], mtype, e)

        elif mtype == "vocab-paraphrase":
            if not OPENROUTER_API_KEY:
                logger.warning("Skipping %s (%s): OPENROUTER_API_KEY not configured", spec["id"], mtype)
                continue
            try:
                mondai.append(_build_vocab_paraphrase_mondai(spec, vocab_pool, used_words, used_prompts, rng, level))
                included_items += spec["count"]
            except GenerationFailed as e:
                logger.warning("Skipping %s (%s): %s", spec["id"], mtype, e)

        elif mtype == "vocab-usage":
            if not OPENROUTER_API_KEY:
                logger.warning("Skipping %s (%s): OPENROUTER_API_KEY not configured", spec["id"], mtype)
                continue
            try:
                mondai.append(_build_vocab_usage_mondai(spec, vocab_pool, used_words, used_prompts, rng, level))
                included_items += spec["count"]
            except GenerationFailed as e:
                logger.warning("Skipping %s (%s): %s", spec["id"], mtype, e)

        elif mtype == "word-formation":
            logger.info("Skipping %s (%s): no generator yet (needs a curated affix list)", spec["id"], mtype)

        else:
            # Grammar/reading/listening mondai sharing this blueprint
            # entry at N1/N2 (whose official "vocabulary_grammar_reading"
            # section is combined) — later generator phases, not this one.
            logger.info("Skipping %s (%s): not this generator's scope", spec["id"], mtype)

    if not mondai:
        raise GenerationFailed(f"{level}: no vocabulary mondai could be generated at all")

    total_section_items = sum(m["count"] for m in vocab_section["mondai"])
    scaled_time_limit = max(5, round(vocab_section["timeLimitMin"] * included_items / max(1, total_section_items)))

    return {
        "level": level,
        "title": f"{level} Vocabulary Practice",
        "titleJp": f"{level} 語彙",
        "sections": [{
            "id": "vocabulary",
            "label": "Vocabulary",
            "labelJp": "語彙",
            "timeLimitMin": scaled_time_limit,
            "mondai": mondai,
        }],
    }


def _flatten_vocab_questions(mondai_list: list[dict]) -> list[dict]:
    return [q for m in mondai_list for q in m["questions"]]


def generate_vocabulary_paper(level: str, seed: int) -> dict:
    return generate_paper(
        generate_once=_generate_vocabulary_paper_once,
        flatten=_flatten_vocab_questions,
        level=level, seed=seed,
        max_attempts=_MAX_GENERATION_ATTEMPTS,
        check_duplicates=True,
        paper_label="vocabulary",
    )
