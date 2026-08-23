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
from study.morphology import tokenize

logger = logging.getLogger(__name__)


class LLMUnavailable(RuntimeError):
    """No model could be reached at all — an account/provider problem
    (no API key, every model dead, auth rejected, total outage), NOT a
    problem with the content a generator asked for.

    Subclasses RuntimeError so existing `except RuntimeError` call sites
    keep working, but exists as its own type so a caller's retry loop
    can tell the two apart: retrying a GenerationFailed is how a
    generator gets past a model's bad answer, while retrying an
    LLMUnavailable just re-pays the whole cascade for a failure no
    amount of retrying will fix. Live-diagnosed 2026-08: a dead primary
    model plus a swallowed provider failure turned one exam click into
    hundreds of doomed OpenRouter requests."""

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
# 2026-08: switched primary off the paid anthropic/claude-haiku-4.5 —
# confirmed live against GET /api/v1/models that nvidia/nemotron-3.5-
# lightning:free still exists on OpenRouter's catalog before adopting
# it, same discipline as the earlier stale-model fix below.
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "nvidia/nemotron-3.5-lightning:free")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# 2026-08: mirrors the same fix in routes/reading.py's own MODELS list
# — the original primary and two of four fallbacks had been removed
# from OpenRouter's catalog (confirmed live against GET /api/v1/models,
# 404 "No endpoints found" on both), wasting 2 requests' latency on the
# dead primary alone before ever reaching a model that still exists.
MODELS = [
    OPENROUTER_MODEL,
    "nvidia/nemotron-3-super-120b-a12b:free",
    "openai/gpt-oss-20b:free",
    "google/gemma-4-31b-it:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
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


def soften_kanji(text: str, level: str) -> str | None:
    """Rewrite out-of-level kanji to their hiragana reading, or None if
    that can't be done reliably.

    For text that is SPOKEN rather than printed — a listening dialogue,
    its narration, the comprehension question read aloud — kanji vs kana
    is completely invisible to the learner: the synthesized audio is the
    same either way. Rejecting a whole generated item because one
    character fell outside the level's deck throws away a perfectly good
    question over a distinction the learner never perceives, and at N5
    (a ~80-kanji allowed set) that is essentially every item: a natural
    dialogue about arranging a meeting reaches for 待/合/約 immediately.
    Live-diagnosed 2026-08 as the reason N5 listening generation
    returned "only found 0/7 valid listening-mcq items" every time.

    Uses study/morphology.py's per-morpheme `reading` rather than a
    per-character kanji-reading table, for the reason that module's own
    header spells out: no per-character table can get both 上 (うえ) and
    上る (のぼる) right, because both readings are correct in different
    contexts, and only part-of-speech-aware tokenization can tell which
    context this is.

    Returns None (caller rejects the item, exactly as before) when the
    analyzer is unavailable, when a morpheme has no reading to
    substitute, or when the rewritten text somehow still fails the gate
    — never a partially-softened string, so a caller can trust that a
    non-None result passes sentence_kanji_ok()."""
    if sentence_kanji_ok(text, level):
        return text

    morphemes = tokenize(text)
    if morphemes is None:
        return None

    out = []
    for m in morphemes:
        if sentence_kanji_ok(m.surface, level):
            out.append(m.surface)
            continue
        if not m.reading:
            return None
        out.append(m.reading)

    softened = "".join(out)
    # A reading can itself contain kanji when UniDic has nothing better
    # to offer (rare, but it falls back to the surface form) — re-check
    # rather than assume the substitution worked.
    return softened if sentence_kanji_ok(softened, level) else None


# Models that answered with a PERMANENT error this process — a model
# that has been retired from the catalog (404), that this account can't
# use on the plan it's on (402, and OpenRouter's "unavailable for free,
# use the paid slug" 404), or that rejects the request shape outright
# (400). None of those change between one call and the next, so re-
# trying them is pure waste: before this, a dead MODELS[0] cost one
# doomed round trip on EVERY call, and a single exam generation makes
# dozens. Deliberately process-lifetime and in-memory: a model coming
# back is rare enough that a restart is a fine way to re-test it, and
# anything persistent would need invalidation logic for no real gain.
_DEAD_MODELS: set[str] = set()

# Nothing about the account changes by asking a different model, so an
# auth rejection aborts the whole cascade instead of walking the list.
_ACCOUNT_ERROR_STATUSES = (401, 403)
_PERMANENT_MODEL_STATUSES = (400, 402, 404)
_RETRYABLE_STATUSES = (429, 500, 502, 503, 504)


def chat(messages: list[dict], timeout: int = 60, max_tokens: int = 3000, reasoning: bool = True) -> str:
    """Multi-model fallback chat completion, identical discipline to
    reading.py's _chat: try each model in MODELS, retry once per model
    on a network error, move to the next model on a 429/500/502/503/504
    (temporary failure), stop immediately on anything else (e.g. an
    auth error — retrying that across every model wastes calls on a
    failure no model will fix). Raises LLMUnavailable (a RuntimeError
    subclass, not HTTPException) on total failure, including when no API
    key is configured at all — callers decide how that becomes a
    user-facing error.

    A model that fails permanently is remembered in _DEAD_MODELS and
    skipped for the rest of the process (see that constant's own note),
    so the cost of a retired primary is one wasted request in total
    rather than one per call.

    max_tokens defaults to 3000 rather than being left unset: every
    caller in this codebase generates one bounded JSON blob (a passage,
    a handful of MCQ choices), never an open-ended completion, and
    OpenRouter's own unset-max_tokens default turned out to be 64000 —
    live-diagnosed 2026-08 when the primary model 402'd on every single
    call ("requested up to 64000 tokens, but can only afford 8000")
    despite the account having real credit, forcing every request onto
    the free-tier fallbacks and burning through their daily quota in
    one testing session. An explicit, generous-but-bounded cap avoids
    asking for far more than any of these tasks could ever need."""
    if not OPENROUTER_API_KEY:
        raise LLMUnavailable("OPENROUTER_API_KEY is not configured")

    live_models = [m for m in MODELS if m not in _DEAD_MODELS]
    if not live_models:
        # Not a request that happens to fail — a request not worth
        # sending at all. Every model on the list has already told us it
        # can't serve this account.
        raise LLMUnavailable(
            f"Every configured model failed permanently earlier this run: {sorted(_DEAD_MODELS)}"
        )

    last_status = None
    session = requests.Session()

    for model in live_models:
        for _ in range(2):
            try:
                response = session.post(
                    OPENROUTER_URL,
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model, "messages": messages, "max_tokens": max_tokens,
                        # nemotron-3.5-lightning (the new primary) is a
                        # reasoning model; letting it think before
                        # answering matters more here than for a plain
                        # chat model, since every call in this codebase
                        # is one constrained JSON blob (kanji-gated
                        # sentence, exactly-4-choices schema) that has to
                        # get several constraints right at once. content
                        # still carries the final answer with this on —
                        # reasoning output is a separate field we don't
                        # read, not a replacement for it.
                        # Default True: the exam generators each ask for
                        # one constrained JSON blob and benefit from the
                        # model thinking first.
                        #
                        # Pass False for BATCHED output. Measured on the
                        # grammar sentence generator, 8 points per call:
                        # with reasoning on, this model spent 1,588-1,781
                        # tokens reasoning, hit the max_tokens cap, and
                        # returned the prompt's own placeholders or nothing
                        # -- 0 usable sentences across repeated runs. With
                        # it off, the same prompt cost ~500 completion
                        # tokens and produced real sentences. The reasoning
                        # budget crowds out the answer when the answer is
                        # long.
                        "reasoning": {"enabled": reasoning},
                    },
                    timeout=timeout,
                )
            except requests.RequestException as e:
                logger.warning("%s network error: %s", model, e)
                continue

            if response.ok:
                logger.info("Using model %s", model)
                try:
                    return response.json()["choices"][0]["message"]["content"]
                except (KeyError, IndexError):
                    # A 2xx whose body isn't the shape we expect is still
                    # a failure — record it, or the final error below
                    # reports "no response" for a call that got several.
                    last_status = response.status_code
                    logger.error("%s returned an unexpected body: %s", model, response.text[:300])
                continue

            status = response.status_code
            last_status = status
            logger.warning("%s failed (%s): %s", model, status, response.text[:300])

            if status in _ACCOUNT_ERROR_STATUSES:
                raise LLMUnavailable(
                    f"OpenRouter rejected the credentials ({status}) — no model will fix this"
                )
            if status in _PERMANENT_MODEL_STATUSES:
                _DEAD_MODELS.add(model)
                logger.error(
                    "Dropping model %s for the rest of this process: permanent error %s. %s",
                    model, status, response.text[:300],
                )
                break
            if status not in _RETRYABLE_STATUSES:
                break

    raise LLMUnavailable(f"All LLM providers failed. Last error: {last_status or 'no response'}")
