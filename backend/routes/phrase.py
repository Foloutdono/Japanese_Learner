import json
import logging
import os
import re

import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db import db_conn
from auth import get_user_id
from srs_instance import srs
from card_lookup import (
    find_vocab_match, find_kanji_matches, serializable_entry, card_stats,
    VOCAB_STATUS_MODE, KANJI_STATUS_MODE,
)

router = APIRouter()
logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-3.5-haiku")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

SYSTEM_PROMPT = """You are a Japanese language tutor. Given a Japanese phrase, segment it into words and respond with ONLY a single JSON object (no markdown fences, no commentary) matching exactly this schema:

{
  "words": [
    {"surface": "...", "base": "...", "reading": "...", "meaning": "...", "pos": "..."}
  ],
  "explanation": "..."
}

- "surface" is the word exactly as it appears in the phrase.
- "base" is its dictionary/base form (same as surface if already in base form).
- "reading" is the reading in hiragana.
- "meaning" is what the word means IN THE CONTEXT of this specific phrase, not just a generic dictionary gloss.
- "pos" is a short part-of-speech label (noun, verb, particle, adjective, etc).
- "explanation" is 2-4 sentences explaining the grammar and nuance of the whole phrase.
"""


class PhraseRequest(BaseModel):
    phrase: str


def _call_llm(phrase: str) -> dict:
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured")

    response = requests.post(
        OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": OPENROUTER_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": phrase},
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
    # Models sometimes wrap JSON in ```json fences despite instructions — strip those.
    cleaned = re.sub(r"^```(?:json)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        logger.error("Failed to parse LLM response as JSON: %r", content)
        raise HTTPException(status_code=502, detail="LLM returned an unparseable response")


@router.post("/api/phrase/analyze")
def analyze_phrase(payload: PhraseRequest, user_id: str = Depends(get_user_id)):
    phrase = payload.phrase.strip()
    if not phrase:
        raise HTTPException(status_code=400, detail="Phrase is required")

    llm_result = _call_llm(phrase)
    states = srs.get_user_states(user_id)

    enriched_words = []
    for word in llm_result.get("words", []):
        surface = word.get("surface", "")
        base = word.get("base", surface)
        reading = word.get("reading", "")

        vocab_match = find_vocab_match(surface, base, reading)
        kanji_matches = find_kanji_matches(surface)

        word_entry = {
            **word,
            "vocab_match": None,
            "kanji_matches": [],
        }

        if vocab_match:
            level, entry, raw_id = vocab_match
            word_entry["vocab_match"] = {
                "level": level,
                "raw_id": raw_id,
                "entry": serializable_entry(entry),
                "stats": card_stats(states, user_id, raw_id, VOCAB_STATUS_MODE),
            }

        for char, level, entry, raw_id in kanji_matches:
            word_entry["kanji_matches"].append({
                "kanji": char,
                "level": level,
                "raw_id": raw_id,
                "entry": serializable_entry(entry),
                "stats": card_stats(states, user_id, raw_id, KANJI_STATUS_MODE),
            })

        enriched_words.append(word_entry)

    result = {
        "phrase": phrase,
        "explanation": llm_result.get("explanation", ""),
        "words": enriched_words,
    }

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO phrase_history(user_id, phrase, result) VALUES (%s, %s, %s) RETURNING id, created_at",
                (user_id, phrase, json.dumps(result)),
            )
            row_id, created_at = cur.fetchone()
        conn.commit()
    finally:
        conn.close()

    return {**result, "id": row_id, "created_at": created_at.isoformat()}


@router.get("/api/phrase/history")
def get_phrase_history(user_id: str = Depends(get_user_id), limit: int = 50):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, phrase, created_at FROM phrase_history "
                "WHERE user_id = %s ORDER BY created_at DESC LIMIT %s",
                (user_id, limit),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    return [
        {"id": row_id, "phrase": phrase, "created_at": created_at.isoformat()}
        for row_id, phrase, created_at in rows
    ]


@router.get("/api/phrase/history/{entry_id}")
def get_phrase_history_entry(entry_id: int, user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT result, created_at FROM phrase_history WHERE id = %s AND user_id = %s",
                (entry_id, user_id),
            )
            row = cur.fetchone()
    finally:
        conn.close()

    if row is None:
        raise HTTPException(status_code=404, detail="Not found")

    result, created_at = row
    if isinstance(result, str):
        result = json.loads(result)
    return {**result, "id": entry_id, "created_at": created_at.isoformat()}


@router.delete("/api/phrase/history/{entry_id}")
def delete_phrase_history_entry(entry_id: int, user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM phrase_history WHERE id = %s AND user_id = %s",
                (entry_id, user_id),
            )
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}