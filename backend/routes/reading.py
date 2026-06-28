import json
import logging
import os
import re
import unicodedata

import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db import db_conn
from auth import get_user_id

router = APIRouter()
logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-3.5-haiku")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

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

SYSTEM_PROMPT_TEMPLATE = """You are generating short Japanese reading-practice phrases for a learner at JLPT level {level}.

{phase_instruction}

Generate {count} DIFFERENT phrases. Vary their topic, vocabulary, and grammar pattern — none should be a close variant of another.

Respond with ONLY a JSON object (no markdown fences, no commentary) matching exactly this schema:
{{"phrases": [{{"phrase": "...", "romaji": "...", "translation": "..."}}]}}
- The "phrases" array must contain exactly {count} entries.
- Each "phrase" must be natural, grammatically correct, short (roughly 3-8 words), appropriate for JLPT {level}.
- Each "romaji" is the exact, standard Hepburn romanization of its phrase: lowercase, words separated by single spaces, no punctuation.
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

MIN_BATCH = 1
MAX_BATCH = 10
DEFAULT_BATCH = 5


class ResultPayload(BaseModel):
    level: str
    phase: str
    phrase: str
    romaji: str
    answer: str


def _call_llm_batch(level: str, phase: str, count: int, lang: str) -> list[dict]:
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured")

    phase_instruction = PHASES.get(phase)
    if not phase_instruction:
        raise HTTPException(status_code=400, detail="Unknown phase")

    lang_name = LANG_NAMES.get(lang, lang)
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        level=level, phase_instruction=phase_instruction, count=count, lang=lang, lang_name=lang_name,
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

    valid = [p for p in phrases if isinstance(p, dict) and "phrase" in p and "romaji" in p]
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

    return {
        "level": level,
        "phase": phase,
        "phrases": [
            {
                "phrase": item["phrase"],
                "romaji": item["romaji"],
                "translation": item.get("translation", ""),
                "display_seconds": _display_seconds(item["phrase"]),
            }
            for item in items
        ],
    }


@router.post("/api/reading/result")
def post_reading_result(payload: ResultPayload, user_id: str = Depends(get_user_id)):
    correct = normalize_romaji(payload.answer) == normalize_romaji(payload.romaji)

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO reading_log(user_id, level, phase, phrase, romaji, answer, correct)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (user_id, payload.level, payload.phase, payload.phrase, payload.romaji, payload.answer, correct),
            )
        conn.commit()
    finally:
        conn.close()

    return {"correct": correct, "romaji": payload.romaji}


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