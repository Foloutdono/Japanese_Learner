import json
import logging
import os
import re
import unicodedata

import requests
import pykakasi
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db import db_conn
from auth import get_user_id
from srs_instance import srs
from card_lookup import find_segments_in_text, attach_stats_to_segments
from kanji_data import get_kanji_string

router = APIRouter()
logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-3.5-haiku")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

_kakasi = pykakasi.kakasi()

PHASES = {
    "hiragana": "Use ONLY hiragana characters. No kanji, no katakana.",
    "katakana": "Use ONLY katakana characters (e.g. common loanwords). No kanji, no hiragana.",
    "mixed":    "Use natural Japanese with a normal mix of kanji and kana, as you would write it in everyday text.",
}

# Display time scales with phrase length, clamped to a sane range. Tune freely.
MIN_DISPLAY_SECONDS = 5
MAX_DISPLAY_SECONDS = 25
SECONDS_PER_CHAR = 0.6
BASE_SECONDS = 3.0

# We deliberately do NOT ask the LLM to spell out romaji directly — models
# are unreliable at inventing Hepburn spelling on the fly and can garble it
# (e.g. misreading 降ります and producing "borimasu" instead of "furimasu").
# Instead we ask for the phrase's reading in hiragana (a much more
# constrained, reliable task — it's transcription, not free spelling) and
# convert hiragana -> romaji ourselves with pykakasi, which is a mechanical,
# unambiguous conversion once the kanji has already been resolved to kana.
SYSTEM_PROMPT_TEMPLATE = """You are generating short Japanese reading-practice phrases for a learner at JLPT level {level}.

{phase_instruction}

When writing phrases:

- You MAY use hiragana, katakana and punctuation freely.
- If you use any kanji, every kanji MUST belong to this list:
{allowed_kanji}
- Never use a kanji outside this list.
- If a word normally contains a disallowed kanji, replace that kanji with its hiragana reading instead.

Generate {count} DIFFERENT phrases. Vary their topic, vocabulary, and grammar pattern — none should be a close variant of another.

Respond with ONLY a JSON object (no markdown fences, no commentary) matching exactly this schema:
{{"phrases": [{{"phrase": "...", "reading": "...", "translation": "..."}}]}}
- The "phrases" array must contain exactly {count} entries.
- Each "phrase" must be natural, grammatically correct, short (roughly 3-8 words), appropriate for JLPT {level}.
- Each "reading" is the COMPLETE reading of "phrase" written ENTIRELY in hiragana — convert any katakana to hiragana too, and resolve every kanji to its correct reading IN THIS CONTEXT. No kanji, no spaces, no punctuation should remain in "reading". Double-check each kanji's reading before answering — many kanji have multiple possible readings and only one is correct here.
- Each "translation" is a natural translation of the phrase into {lang_name} (language code: {lang}).
"""

# Best-effort code -> name mapping so the LLM gets an unambiguous instruction
# even if it only recognizes ISO codes loosely. Add more as your app supports
# more languages.
LANG_NAMES = {
    "en": "English",
    "fr": "French",
    "es": "Spanish",
    "de": "German",
    "ja": "Japanese",
    "it": "Italian",
    "pt": "Portuguese",
}

# A level's allowed kanji pool includes every level at or below it, since
# JLPT levels are cumulative (someone studying N3 already knows N5/N4 kanji).
LEVEL_HIERARCHY = {
    "N5": ("N5",),
    "N4": ("N5", "N4"),
    "N3": ("N5", "N4", "N3"),
    "N2": ("N5", "N4", "N3", "N2"),
    "N1": ("N5", "N4", "N3", "N2", "N1"),
}

MIN_BATCH = 1
MAX_BATCH = 10
DEFAULT_BATCH = 5


class ResultPayload(BaseModel):
    level: str
    phase: str
    phrase: str
    romaji: str
    answer: str
    correct: bool


def _allowed_kanji_for_level(level: str) -> str:
    allowed_levels = LEVEL_HIERARCHY.get(level)
    if not allowed_levels:
        raise HTTPException(status_code=400, detail="Unknown JLPT level")
    return get_kanji_string(allowed_levels)


def _call_llm_batch(level: str, phase: str, count: int, lang: str) -> list[dict]:
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured")

    phase_instruction = PHASES.get(phase)
    if not phase_instruction:
        raise HTTPException(status_code=400, detail="Unknown phase")

    lang_name = LANG_NAMES.get(lang, lang)
    allowed_kanji = _allowed_kanji_for_level(level)

    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        level=level,
        phase_instruction=phase_instruction,
        allowed_kanji=allowed_kanji,
        count=count,
        lang=lang,
        lang_name=lang_name,
    )

    response = requests.post(
        OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": OPENROUTER_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Generate {count} phrases."},
            ],
        },
        timeout=45,
    )

    if not response.ok:
        logger.error("OpenRouter call failed: status=%s body=%s", response.status_code, response.text)
        raise HTTPException(status_code=502, detail="LLM request failed")

    content = response.json()["choices"][0]["message"]["content"]
    data = _parse_llm_json(content)

    phrases = data.get("phrases")
    if not isinstance(phrases, list) or not phrases:
        raise HTTPException(status_code=502, detail="LLM response missing phrases")

    valid = [p for p in phrases if isinstance(p, dict) and "phrase" in p and "reading" in p]
    if not valid:
        raise HTTPException(status_code=502, detail="LLM response missing required fields")

    return valid


def _parse_llm_json(content: str) -> dict:
    cleaned = re.sub(r"^```(?:json)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        logger.error("Failed to parse LLM response as JSON: %r", content)
        raise HTTPException(status_code=502, detail="LLM returned an unparseable response")


def _display_seconds(phrase: str) -> float:
    seconds = BASE_SECONDS + SECONDS_PER_CHAR * len(phrase)
    return max(MIN_DISPLAY_SECONDS, min(MAX_DISPLAY_SECONDS, round(seconds, 1)))


def hiragana_to_romaji(reading: str) -> str:
    """Deterministic kana -> Hepburn romaji conversion (no kanji ambiguity
    left to resolve at this point, so this is purely mechanical)."""
    converted = _kakasi.convert(reading)
    return " ".join(item["hepburn"] for item in converted if item["hepburn"])


def normalize_romaji(text: str) -> str:
    """
    Loose normalization so reasonable romanization variants still count as
    correct: lowercase, strip accents/macrons (ā -> a), drop punctuation and
    all whitespace, collapse repeated letters from long-vowel spelling
    differences is NOT done (おう vs ō is ambiguous) — only exact spelling
    variants survive this normalization.
    """
    text = unicodedata.normalize("NFKD", text.lower())
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^a-z]", "", text)
    return text


@router.get("/api/reading/batch")
def get_reading_batch(
    level: str, phase: str, count: int = DEFAULT_BATCH, lang: str = "en",
    user_id: str = Depends(get_user_id),
):
    count = max(MIN_BATCH, min(MAX_BATCH, count))
    items = _call_llm_batch(level, phase, count, lang)
    states = srs.get_user_states(user_id)

    phrases = []
    for item in items:
        phrase = item["phrase"]
        segments = attach_stats_to_segments(find_segments_in_text(phrase), states, user_id)
        phrases.append({
            "phrase": phrase,
            "romaji": hiragana_to_romaji(item["reading"]),
            "translation": item.get("translation", ""),
            "display_seconds": _display_seconds(phrase),
            "segments": segments,
        })

    return {"level": level, "phase": phase, "phrases": phrases}


@router.post("/api/reading/result")
def post_reading_result(payload: ResultPayload, user_id: str = Depends(get_user_id)):
    # Correctness is now self-assessed by the user after seeing the reveal
    # (romaji auto-matching was too brittle — see normalize_romaji's
    # docstring; it's kept above only as an optional sanity-check helper).
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO reading_log(user_id, level, phase, phrase, romaji, answer, correct)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (user_id, payload.level, payload.phase, payload.phrase, payload.romaji, payload.answer, payload.correct),
            )
        conn.commit()
    finally:
        conn.close()

    return {"correct": payload.correct, "romaji": payload.romaji}


@router.get("/api/reading/history")
def get_reading_history(user_id: str = Depends(get_user_id), limit: int = 50):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT level, phase, phrase, romaji, answer, correct, created_at
                FROM reading_log
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (user_id, limit),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    return [
        {
            "level": level, "phase": phase, "phrase": phrase, "romaji": romaji,
            "answer": answer, "correct": correct, "created_at": created_at.isoformat(),
        }
        for level, phase, phrase, romaji, answer, correct, created_at in rows
    ]


# ── Reading Comprehension ─────────────────────────────────────────────────────

# Text length and question count scale with JLPT level difficulty.
COMPREHENSION_SPECS = {
    "N5": {"chars": "50-80",   "questions": 3},
    "N4": {"chars": "80-130",  "questions": 3},
    "N3": {"chars": "130-200", "questions": 4},
    "N2": {"chars": "200-280", "questions": 5},
    "N1": {"chars": "280-380", "questions": 5},
}
DEFAULT_COMPREHENSION_SPEC = {"chars": "100-160", "questions": 4}

# Default reading window in seconds; users can stop early.
DEFAULT_READ_SECONDS = 420  # 7 minutes

# Same allowed-kanji restriction as the phrase-reading mode (see
# SYSTEM_PROMPT_TEMPLATE above) — a comprehension text full of kanji the
# user has never studied defeats the point of leveling it by JLPT level.
COMPREHENSION_PROMPT_TEMPLATE = """You are creating a Japanese reading-comprehension exercise for a learner at JLPT level {level}.

Write a short, self-contained Japanese text ({chars} characters) using vocabulary and grammar appropriate for JLPT {level}. Then write {questions} multiple-choice questions about the text to test comprehension.

When writing the text:

- You MAY use hiragana, katakana and punctuation freely.
- If you use any kanji, every kanji MUST belong to this list:
{allowed_kanji}
- Never use a kanji outside this list.
- If a word normally contains a disallowed kanji, replace that kanji with its hiragana reading instead.

Respond with ONLY a JSON object (no markdown fences, no commentary) matching exactly this schema:
{{
  "text": "...",
  "translation": "...",
  "questions": [
    {{
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correct": 0
    }}
  ]
}}

Rules:
- "text" must be natural, coherent Japanese with a clear topic (a short story, announcement, letter, description, etc).
- "translation" is a faithful {lang_name} translation of "text".
- Each "question" is written in {lang_name} and tests genuine comprehension (not just vocabulary lookup).
- "options" must contain exactly 4 choices in {lang_name}. All options must be plausible — avoid obviously wrong distractors.
- "correct" is the 0-based index of the only correct option.
- Generate exactly {questions} questions.
"""


class ComprehensionAnswersPayload(BaseModel):
    level: str
    text: str
    translation: str
    questions: list[dict]
    answers: list[int]  # user's chosen option index per question, in order


def _call_llm_comprehension(level: str, lang: str) -> dict:
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured")

    spec = COMPREHENSION_SPECS.get(level, DEFAULT_COMPREHENSION_SPEC)
    lang_name = LANG_NAMES.get(lang, lang)
    allowed_kanji = _allowed_kanji_for_level(level)

    prompt = COMPREHENSION_PROMPT_TEMPLATE.format(
        level=level,
        chars=spec["chars"],
        questions=spec["questions"],
        allowed_kanji=allowed_kanji,
        lang=lang,
        lang_name=lang_name,
    )

    response = requests.post(
        OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": OPENROUTER_MODEL,
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": "Generate the reading comprehension exercise."},
            ],
        },
        timeout=60,
    )

    if not response.ok:
        logger.error("OpenRouter comprehension call failed: status=%s body=%s", response.status_code, response.text)
        raise HTTPException(status_code=502, detail="LLM request failed")

    content = response.json()["choices"][0]["message"]["content"]
    cleaned = re.sub(r"^```(?:json)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.error("Failed to parse comprehension LLM response: %r", content)
        raise HTTPException(status_code=502, detail="LLM returned an unparseable response")

    for field in ("text", "translation", "questions"):
        if field not in data:
            raise HTTPException(status_code=502, detail=f"LLM response missing field: {field}")

    for i, q in enumerate(data["questions"]):
        if not all(k in q for k in ("question", "options", "correct")):
            raise HTTPException(status_code=502, detail=f"Question {i} missing required fields")
        if len(q["options"]) != 4:
            raise HTTPException(status_code=502, detail=f"Question {i} must have exactly 4 options")

    return data


@router.get("/api/reading/comprehension")
def get_comprehension_text(level: str, lang: str = "en", user_id: str = Depends(get_user_id)):
    data = _call_llm_comprehension(level, lang)
    spec = COMPREHENSION_SPECS.get(level, DEFAULT_COMPREHENSION_SPEC)
    return {
        "level": level,
        "text": data["text"],
        "translation": data["translation"],
        "questions": data["questions"],
        "read_seconds": DEFAULT_READ_SECONDS,
        "question_count": spec["questions"],
    }


@router.post("/api/reading/comprehension/result")
def post_comprehension_result(payload: ComprehensionAnswersPayload, user_id: str = Depends(get_user_id)):
    questions = payload.questions
    answers = payload.answers

    if len(answers) != len(questions):
        raise HTTPException(status_code=400, detail="Answer count does not match question count")

    score = sum(
        1 for i, q in enumerate(questions)
        if i < len(answers) and answers[i] == q.get("correct")
    )
    total = len(questions)

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO comprehension_log
                    (user_id, level, text, translation, questions, answers, score, total)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, created_at
                """,
                (
                    user_id, payload.level, payload.text, payload.translation,
                    json.dumps(questions), json.dumps(answers), score, total,
                ),
            )
            row_id, created_at = cur.fetchone()
        conn.commit()
    finally:
        conn.close()

    return {
        "id": row_id,
        "score": score,
        "total": total,
        "created_at": created_at.isoformat(),
        "results": [
            {
                "question": q["question"],
                "options": q["options"],
                "correct": q["correct"],
                "user_answer": answers[i] if i < len(answers) else None,
                "is_correct": i < len(answers) and answers[i] == q["correct"],
            }
            for i, q in enumerate(questions)
        ],
    }