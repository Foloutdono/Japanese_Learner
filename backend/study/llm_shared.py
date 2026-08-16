# ── Shared LLM + kanji-gate machinery ────────────────────────────
# Mirrors routes/reading.py's own _chat / _allowed_kanji_for_level /
# _kanji_set_for_level / _sentence_kanji_ok — the proven pattern behind
# its LLM-generated reading comprehension (kanji-set-constrained
# prompt, multi-model fallback with retry, validate-or-reject on the
# response). Deliberately a SEPARATE copy rather than reading.py
# importing from here: reading.py is a live, already-verified route
# module, and refactoring its internals to share this code is exactly
# the kind of touch-a-working-file-for-a-DRY-win change this project
# avoids without a concrete need. If reading.py is ever revisited, its
# equivalent functions could point here instead — not done now.
#
# Route-agnostic on purpose: raises ValueError/RuntimeError instead of
# FastAPI's HTTPException, since exam generators aren't route handlers
# — routes/exams.py's GenerationFailed/503 handling is where an exam
# generator's failure actually becomes an HTTP response.
import logging
import os
from functools import lru_cache

import requests

from content.kanji_data import get_kanji_string

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-3.5-haiku")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

MODELS = [
    OPENROUTER_MODEL,
    "nvidia/nemotron-3-super-120b-a12b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-4-31b-it:free",
    "openrouter/owl-alpha",
]

LEVEL_HIERARCHY = {
    "N5": ("N5",),
    "N4": ("N5", "N4"),
    "N3": ("N5", "N4", "N3"),
    "N2": ("N5", "N4", "N3", "N2"),
    "N1": ("N5", "N4", "N3", "N2", "N1"),
}


def allowed_kanji_for_level(level: str) -> str:
    allowed_levels = LEVEL_HIERARCHY.get(level)
    if not allowed_levels:
        raise ValueError(f"Unknown JLPT level: {level!r}")
    return get_kanji_string(allowed_levels)


@lru_cache(maxsize=None)
def kanji_set_for_level(level: str) -> frozenset:
    return frozenset(allowed_kanji_for_level(level))


def is_kanji(c: str) -> bool:
    return "一" <= c <= "鿿"


def sentence_kanji_ok(text: str, level: str) -> bool:
    allowed = kanji_set_for_level(level)
    return all(not is_kanji(c) or c in allowed for c in text)


def chat(messages: list[dict], timeout: int = 60) -> str:
    """Multi-model fallback chat completion, identical discipline to
    reading.py's _chat: try each model in MODELS, retry once per model
    on a network error, move to the next model on a 429/500/502/503/504
    (temporary failure), stop immediately on anything else (e.g. an
    auth error — retrying that across every model wastes calls on a
    failure no model will fix). Raises RuntimeError (not HTTPException)
    on total failure, including when no API key is configured at all
    — callers decide how that becomes a user-facing error."""
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    last_response = None
    session = requests.Session()

    for model in MODELS:
        for _ in range(2):
            try:
                response = session.post(
                    OPENROUTER_URL,
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={"model": model, "messages": messages},
                    timeout=timeout,
                )
            except requests.RequestException as e:
                logger.warning("%s network error: %s", model, e)
                continue

            if response.ok:
                try:
                    return response.json()["choices"][0]["message"]["content"]
                except (KeyError, IndexError):
                    logger.error(response.text)
                continue

            logger.warning("%s failed (%s): %s", model, response.status_code, response.text[:300])
            last_response = response
            if response.status_code not in (429, 500, 502, 503, 504):
                break

    status = last_response.status_code if last_response is not None else "no response"
    raise RuntimeError(f"All LLM providers failed. Last error: {status}")
