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
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "openrouter/owl-alpha")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

PHASES = {
    "hiragana": "Use ONLY hiragana characters. No kanji, no katakana.",
    "katakana": "Use ONLY katakana characters (e.g. common loanwords). No kanji, no hiragana.",
    "mixed":    "Use natural Japanese with a normal mix of kanji and kana, as you would write it in everyday text.",
}

# Display time scales with phrase length, clamped to a sane range. Tune freely.
MIN_DISPLAY_SECONDS = 3
MAX_DISPLAY_SECONDS = 12
SECONDS_PER_CHAR = 0.35
BASE_SECONDS = 1.5

SYSTEM_PROMPT_TEMPLATE = """You are generating a short Japanese reading-practice phrase for a learner at JLPT level {level}.

{phase_instruction}

Respond with ONLY a JSON object (no markdown fences, no commentary) matching exactly this schema:
{{"phrase": "...", "romaji": "..."}}

- "phrase" must be a natural, grammatically correct, short phrase or sentence (roughly 3-8 words) appropriate for JLPT {level}.
- "romaji" is the exact, standard Hepburn romanization of "phrase": lowercase, words separated by single spaces, no punctuation.
"""


class ResultPayload(BaseModel):
    level: str
    phase: str
    phrase: str
    romaji: str
    answer: str


def _call_llm(level: str, phase: str) -> dict:
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured")

    phase_instruction = PHASES.get(phase)
    if not phase_instruction:
        raise HTTPException(status_code=400, detail="Unknown phase")

    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(level=level, phase_instruction=phase_instruction)

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
                {"role": "user", "content": "Generate one phrase."},
            ],
        },
        timeout=30,
    )

    if not response.ok:
        logger.error("OpenRouter call failed: status=%s body=%s", response.status_code, response.text)
        raise HTTPException(status_code=502, detail="LLM request failed")

    content = response.json()["choices"][0]["message"]["content"]
    return _parse_llm_json(content)


def _parse_llm_json(content: str) -> dict:
    cleaned = re.sub(r"^```(?:json)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.error("Failed to parse LLM response as JSON: %r", content)
        raise HTTPException(status_code=502, detail="LLM returned an unparseable response")

    if "phrase" not in data or "romaji" not in data:
        raise HTTPException(status_code=502, detail="LLM response missing required fields")

    return data


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


@router.get("/api/reading/phrase")
def get_reading_phrase(level: str, phase: str, user_id: str = Depends(get_user_id)):
    data = _call_llm(level, phase)
    phrase = data["phrase"]
    romaji = data["romaji"]

    return {
        "level": level,
        "phase": phase,
        "phrase": phrase,
        "romaji": romaji,
        "display_seconds": _display_seconds(phrase),
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