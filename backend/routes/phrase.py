import hashlib
import json
import logging
import os
import re
import time

import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.db import db_conn
from core.auth import get_user_id
from core.srs_instance import srs
from study.card_lookup import (
    find_vocab_match, find_kanji_matches, serializable_entry, card_stats,
    VOCAB_STATUS_MODES, KANJI_STATUS_MODES,
)

router = APIRouter()
logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "openrouter/owl-alpha")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# dict.fromkeys, not a plain list: OPENROUTER_MODEL defaults to
# openrouter/owl-alpha, which was ALSO spelled out as the last fallback
# -- so on the default configuration every call tried the same model
# twice, and when that model was unavailable it paid the full retry
# backoff below for it both times. Order-preserving dedupe keeps an
# explicit override from silently colliding with a fallback too.
MODELS = list(dict.fromkeys([
    OPENROUTER_MODEL,                     # Primary
    "nvidia/nemotron-3-super-120b-a12b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-4-31b-it:free",
    "openrouter/owl-alpha",
]))

RETRY_STATUS = {429, 500, 502, 503, 504}

# Mirrors study/llm_shared.py's _DEAD_MODELS (see that module for the
# full reasoning): a model that answers with a PERMANENT error is
# remembered and skipped for the rest of the process rather than costing
# a doomed round trip -- and here, up to 7 seconds of retry backoff --
# on every subsequent call. This module reads the same OPENROUTER_MODEL
# env var into the same MODELS[0] slot and so had the same bug.
_DEAD_MODELS: set[str] = set()
_ACCOUNT_ERROR_STATUSES = {401, 403}
_PERMANENT_MODEL_STATUSES = {400, 402, 404}

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


# ── The breakdown cache ───────────────────────────────────────
# Reading practice fires this endpoint for EVERY phrase it shows, in the
# background, so the breakdown is ready the moment the reader asks (see
# ReadingScreen.jsx's fetchAnalysis). That was one LLM call per phrase
# read, per reader, forever -- and the analysis of a given sentence is a
# property of the sentence, not of who is reading it or when.
#
# It matters far more now than it did: reading practice draws from a
# curated bank of ~220 hand-written sentences (content/reading_sentences),
# so the SAME sentences come round constantly. Cached, the whole bank
# costs at most 220 calls once, shared across every user, instead of one
# per phrase per session. The phrase-analyzer screen's own free-text
# lookups hit the same cache and get the same benefit whenever two people
# (or the same person twice) ask about the same phrase.
#
# Keyed by SHA-256 of the phrase rather than the phrase itself: the raw
# text is stored alongside for debuggability, but the hash is what gets
# the unique index -- Postgres btree entries are capped at ~2704 bytes
# and a pasted paragraph in UTF-8 Japanese can exceed that, which would
# make the insert fail rather than merely miss.
#
# No expiry. The analysis of a fixed string does not go stale; if the
# prompt or the model changes enough to matter, bump CACHE_VERSION and
# every entry becomes a miss without a migration.
CACHE_VERSION = 1


def _phrase_key(phrase: str) -> str:
    material = f"v{CACHE_VERSION}:{phrase}"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def _init_cache() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS phrase_analysis_cache (
                    phrase_key TEXT PRIMARY KEY,
                    phrase TEXT NOT NULL,
                    result JSONB NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
        conn.commit()
    finally:
        conn.close()


try:
    _init_cache()
except Exception:  # pragma: no cover - a missing DB must not stop import
    logger.exception("phrase_analysis_cache could not be initialised")


def _cached_analysis(phrase: str) -> dict | None:
    """The stored LLM result for `phrase`, or None.

    A cache miss must never be an error: a failed lookup falls through to
    the model, which is the behaviour this whole layer is an optimisation
    over.
    """
    try:
        conn = db_conn()
    except Exception:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT result FROM phrase_analysis_cache WHERE phrase_key = %s",
                (_phrase_key(phrase),),
            )
            row = cur.fetchone()
    except Exception:
        logger.exception("phrase cache read failed")
        return None
    finally:
        conn.close()

    if not row:
        return None
    result = row[0]
    return json.loads(result) if isinstance(result, str) else result


def _store_analysis(phrase: str, result: dict) -> None:
    """Best-effort write. ON CONFLICT DO NOTHING rather than an upsert:
    two readers reaching the same uncached phrase at once both call the
    model and both try to store it; either answer is equally good and
    neither should raise."""
    try:
        conn = db_conn()
    except Exception:
        return
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO phrase_analysis_cache (phrase_key, phrase, result)
                VALUES (%s, %s, %s)
                ON CONFLICT (phrase_key) DO NOTHING
                """,
                (_phrase_key(phrase), phrase, json.dumps(result, ensure_ascii=False)),
            )
        conn.commit()
    except Exception:
        logger.exception("phrase cache write failed")
    finally:
        conn.close()


class PhraseRequest(BaseModel):
    phrase: str
    # False for callers that just want the AI breakdown without adding
    # an entry to the user's phrase-analyzer history — added for reading
    # practice (see reading.py / ReadingScreen.jsx, 2026-08), which
    # fires this same endpoint automatically for every phrase served so
    # the breakdown is ready the moment the reader wants it, and
    # shouldn't flood /api/phrase/history with one row per phrase read.
    save: bool = True


def _call_llm(phrase: str) -> dict:
    if not OPENROUTER_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="OPENROUTER_API_KEY is not configured",
        )

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    live_models = [m for m in MODELS if m not in _DEAD_MODELS]
    if not live_models:
        raise HTTPException(
            status_code=503,
            detail="The AI service is temporarily unavailable. Please try again in a few moments.",
        )

    for model in live_models:
        for attempt in range(3):
            try:
                response = requests.post(
                    OPENROUTER_URL,
                    headers=headers,
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": phrase},
                        ],
                        # A word-by-word breakdown of one sentence plus a
                        # 2-4 sentence note. 1200 is generous for the
                        # longest phrase the app serves (an N1 reading
                        # sentence caps at 80 characters) and stops a
                        # model that decides to write an essay from
                        # billing for it -- the request was previously
                        # uncapped. Matches the cap study/llm_shared.py
                        # already puts on its own calls.
                        "max_tokens": 1200,
                    },
                    timeout=30,
                )

                if response.ok:
                    logger.info("OpenRouter succeeded with %s", model)
                    content = response.json()["choices"][0]["message"]["content"]
                    return _parse_llm_json(content)

                logger.warning(
                    "OpenRouter failed (%s) model=%s attempt=%d body=%s",
                    response.status_code,
                    model,
                    attempt + 1,
                    response.text,
                )

                # Retry only temporary failures
                if response.status_code in RETRY_STATUS:
                    time.sleep(2 ** attempt)   # 1s, 2s, 4s
                    continue

                if response.status_code in _ACCOUNT_ERROR_STATUSES:
                    # Account-level, not model-level: walking the rest of
                    # the list just repeats the same rejection.
                    raise HTTPException(
                        status_code=503,
                        detail="The AI service is temporarily unavailable. Please try again in a few moments.",
                    )

                if response.status_code in _PERMANENT_MODEL_STATUSES:
                    _DEAD_MODELS.add(model)
                    logger.error(
                        "Dropping model %s for the rest of this process: permanent error %s. %s",
                        model, response.status_code, response.text[:300],
                    )

                # Permanent error -> next model
                break

            except requests.RequestException:
                logger.exception("Network error with model %s", model)
                time.sleep(2 ** attempt)

        logger.info("Falling back to next model...")

    logger.error("All OpenRouter models failed.")

    raise HTTPException(
        status_code=503,
        detail="The AI service is temporarily unavailable. Please try again in a few moments.",
    )


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

    # The model's own words/explanation only. Everything below this line
    # is per-user (SRS state) and is recomputed on a cache hit -- the
    # cached half is the expensive, user-independent half.
    llm_result = _cached_analysis(phrase)
    if llm_result is None:
        llm_result = _call_llm(phrase)
        _store_analysis(phrase, llm_result)

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
                "stats": card_stats(states, user_id, raw_id, VOCAB_STATUS_MODES),
            }

        for char, level, entry, raw_id in kanji_matches:
            word_entry["kanji_matches"].append({
                "kanji": char,
                "level": level,
                "raw_id": raw_id,
                "entry": serializable_entry(entry),
                "stats": card_stats(states, user_id, raw_id, KANJI_STATUS_MODES),
            })

        enriched_words.append(word_entry)

    result = {
        "phrase": phrase,
        "explanation": llm_result.get("explanation", ""),
        "words": enriched_words,
    }

    if not payload.save:
        return {**result, "id": None, "created_at": None}

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