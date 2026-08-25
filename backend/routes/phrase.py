import hashlib
import json
import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from core.db import db_conn
from core.auth import get_user_id
from core.srs_instance import srs
from study.llm_shared import chat, LLMUnavailable
from study.analysis import analyze_local, attach_user_state, merge_deep
from routes.reading import LANG_NAMES

router = APIRouter()
logger = logging.getLogger(__name__)

# Model selection, provider fallback, per-model retry and the
# dead-model/dead-provider bookkeeping all live in study/llm_shared.py
# now -- this module used to carry its own copy, including a 3-attempt
# time.sleep(2 ** attempt) backoff and a MODELS list whose default
# primary (openrouter/owl-alpha) was ALSO its own last fallback, so
# every call tried the same model twice and paid that backoff for it
# both times. Consolidated 2026-08 when a SECOND provider (NVIDIA) was
# added; the shared retry policy replaces the local backoff.

# {lang_name} is the one substitution point: everything else about the
# schema is fixed. Added 2026-08 -- before this, the prompt never named
# a language at all, so "explanation" (and every word's "meaning") came
# back in whatever language the model defaulted to, in practice English,
# regardless of what language the learner's UI was in.
SYSTEM_PROMPT_TEMPLATE = """You are a Japanese language tutor. Given a Japanese phrase, segment it into words and respond with ONLY a single JSON object (no markdown fences, no commentary) matching exactly this schema:

{{
  "words": [
    {{"surface": "...", "base": "...", "reading": "...", "meaning": "...", "pos": "..."}}
  ],
  "explanation": "..."
}}

- "surface" is the word exactly as it appears in the phrase.
- "base" is its dictionary/base form (same as surface if already in base form).
- "reading" is the reading in hiragana.
- "meaning" is what the word means IN THE CONTEXT of this specific phrase, not just a generic dictionary gloss. Write it in {lang_name}.
- "pos" is a short part-of-speech label (noun, verb, particle, adjective, etc), in {lang_name}.
- "explanation" is 2-4 sentences, in {lang_name}, explaining the grammar and nuance of the whole phrase.
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
#
# v2 (2026-08): the prompt now names a language (see SYSTEM_PROMPT_TEMPLATE
# above), so `lang` joined CACHE_VERSION in the key material -- without
# it, whichever learner asked first would permanently poison the cache
# for every other language, since the SAME phrase in French and in
# English would otherwise hash to the SAME row.
CACHE_VERSION = 2


def _phrase_key(phrase: str, lang: str) -> str:
    material = f"v{CACHE_VERSION}:{lang}:{phrase}"
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


def _cached_analysis(phrase: str, lang: str) -> dict | None:
    """The stored LLM result for `phrase` in `lang`, or None.

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
                (_phrase_key(phrase, lang),),
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


def _store_analysis(phrase: str, lang: str, result: dict) -> None:
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
                (_phrase_key(phrase, lang), phrase, json.dumps(result, ensure_ascii=False)),
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
    # The deep tier (contextual gloss + prose explanation) is bought
    # explicitly, per call. Default False so the common path makes no
    # model call at all -- see docs/adr/0001-two-tier-sentence-analysis.md.
    deep: bool = False
    # The deep tier's language. Absent before 2026-08, which meant every
    # learner got whatever language the model defaulted to (in practice
    # English) regardless of their UI language.
    lang: str = "en"


def _call_llm(phrase: str, lang: str) -> dict:
    """One word-by-word breakdown, via the shared multi-provider client.

    max_tokens=1200: a segmentation of one sentence plus a 2-4 sentence
    note. Generous for the longest phrase the app serves (an N1 reading
    sentence caps at 80 characters) and stops a model that decides to
    write an essay from billing for it.

    reasoning=False: this is a structured-extraction task over text the
    caller already has, not one that benefits from a thinking pass --
    and llm_shared documents the reasoning budget crowding out the
    answer when the answer is long."""
    lang_name = LANG_NAMES.get(lang, lang)
    try:
        content = chat(
            [
                {"role": "system", "content": SYSTEM_PROMPT_TEMPLATE.format(lang_name=lang_name)},
                {"role": "user", "content": phrase},
            ],
            timeout=30, max_tokens=1200, reasoning=False,
        )
    except LLMUnavailable as e:
        logger.error("Phrase analysis has no usable LLM provider: %s", e)
        raise HTTPException(
            status_code=503,
            detail="The AI service is temporarily unavailable. Please try again in a few moments.",
        )
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

    # The default path: local tier only. No database read beyond the
    # user's own SRS state, no LLM call, no 503 when no provider is
    # configured at all -- this is the whole point of the two-tier split,
    # see docs/adr/0001-two-tier-sentence-analysis.md. llm_configured()
    # is deliberately never checked here.
    analysis = analyze_local(phrase)

    if payload.deep:
        # The deep tier is bought explicitly, per call. The cached half
        # (llm_result) is the expensive, user-independent half -- see
        # the cache header comment above -- everything from
        # attach_user_state onward is per-user and recomputed every time.
        llm_result = _cached_analysis(phrase, payload.lang)
        if llm_result is None:
            llm_result = _call_llm(phrase, payload.lang)
            _store_analysis(phrase, payload.lang, llm_result)
        analysis = merge_deep(analysis, llm_result.get("words", []), llm_result.get("explanation", ""))

    states = srs.get_user_states(user_id)
    analysis = attach_user_state(analysis, states, user_id)

    result = {
        "phrase": phrase,
        "explanation": analysis.get("explanation", ""),
        # Deprecated alias for the pre-2026-08 "words" shape both
        # PhraseAnalyzerScreen.jsx and ReadingScreen.jsx still read.
        # Points at the SAME list as "tokens" rather than a copy.
        # Removed once plan 016 moves both screens onto "tokens".
        "words": analysis["tokens"],
        "tokens": analysis["tokens"],
        "grammar": analysis["grammar"],
        "level": analysis["level"],
        "grade": analysis["grade"],
        "available": analysis["available"],
        "unknown_count": analysis.get("unknown_count"),
        "off_deck_count": analysis.get("off_deck_count"),
    }
    if "deep_dropped" in analysis:
        result["deep_dropped"] = analysis["deep_dropped"]

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
def get_phrase_history(user_id: str = Depends(get_user_id), limit: int = Query(50, ge=1, le=200)):
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