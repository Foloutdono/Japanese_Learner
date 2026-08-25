# ── Shared LLM + kanji-gate machinery ────────────────────────────
# The single LLM client for the whole backend: provider selection and
# fallback, per-model retry, the memory of what is already dead, and the
# kanji gate every generated Japanese sentence is checked against.
#
# This started as a copy of routes/reading.py's own _chat /
# _allowed_kanji_for_level / _kanji_set_for_level / _sentence_kanji_ok,
# deliberately NOT shared — the header here used to say so, and named
# the condition for changing that: "If reading.py is ever revisited, its
# equivalent functions could point here instead." Adding a SECOND
# provider in 2026-08 was that condition. OpenRouter began answering 402
# for every model, and with the loop copied into three places
# (llm_shared, routes/reading.py, routes/phrase.py) a fallback would
# have had to be written three times and would have drifted. Both routes
# now call chat() here; what stays local to them is their own prompts
# and response parsing, which is real variation rather than duplication.
#
# Route-agnostic on purpose: raises ValueError/RuntimeError (see
# LLMUnavailable) instead of FastAPI's HTTPException, since exam
# generators aren't route handlers — routes/exams.py's
# GenerationFailed/503 handling, and each route's own thin adapter, is
# where a failure actually becomes an HTTP response.
import logging
import os
from dataclasses import dataclass, field
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

# ── Providers ────────────────────────────────────────────────────
# More than one, since 2026-08: OpenRouter started answering 402
# (credit/quota exhausted) for every model, which took down exam
# generation, reading comprehension and phrase analysis simultaneously
# — there was no second account to fall back to. Any OpenAI-compatible
# endpoint is a Provider entry here; adding a third is config, not code.
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
# 2026-08: switched primary off the paid anthropic/claude-haiku-4.5 —
# confirmed live against GET /api/v1/models that nvidia/nemotron-3.5-
# lightning:free still exists on OpenRouter's catalog before adopting
# it, same discipline as the earlier stale-model fix below.
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "nvidia/nemotron-3.5-lightning:free")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Both spellings are read on purpose: the key was first added to
# backend/.env under NVDIA_API_KEY (missing the I), and reading only the
# correct spelling would silently ignore a key that is right there.
# Reading both means neither a corrected name nor the original breaks.
NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY") or os.environ.get("NVDIA_API_KEY")
NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions"


@dataclass(frozen=True)
class Provider:
    """One OpenAI-compatible chat-completions endpoint and the models to
    try on it, in order.

    `reasoning_body` exists because "let the model think first" is the
    one place these endpoints genuinely disagree, and getting it wrong is
    not a subtle failure — see each provider's own entry below."""
    name: str
    url: str
    api_key: str | None
    models: tuple[str, ...]
    # reasoning-flag -> extra top-level request-body keys.
    reasoning_body: object = field(default=None)

    def body_for(self, reasoning: bool) -> dict:
        return self.reasoning_body(reasoning) if self.reasoning_body else {}


_PROVIDER_CATALOG = {
    "nvidia": Provider(
        name="nvidia",
        url=NVIDIA_URL,
        api_key=NVIDIA_API_KEY,
        # Confirmed live 2026-08 against GET /v1/models (102 models) AND
        # smoke-tested with this project's own N5 listening prompt, the
        # same discipline as the OpenRouter list below. Kept to what
        # actually returned parseable JSON containing usable Japanese:
        # moonshotai/kimi-k2.6 is in the catalog but 404s for this
        # account, minimaxai/minimax-m3 returns null content,
        # deepseek-ai/deepseek-v4-flash-0731 timed out, and
        # meta/llama-3.3-70b-instruct answered the N5 prompt in English
        # rather than Japanese -- which a catalog check alone would never
        # have caught. All four are deliberately absent rather than left
        # in to fail on first use.
        models=(
            "nvidia/nemotron-3-super-120b-a12b",      # ~5s, cleanest JSON
            "nvidia/nemotron-3-ultra-550b-a55b",      # ~5s
            "nvidia/nemotron-3.5-lightning-30b-a3b",  # ~8s
        ),
        # NVIDIA has no equivalent of OpenRouter's `reasoning` field. Its
        # Nemotron models take chat_template_kwargs.thinking instead --
        # and, critically, thinking is ALWAYS turned off here regardless
        # of what the caller asked for. On OpenRouter a reasoning trace
        # goes to a separate field that we don't read, so leaving it on
        # is free; on NVIDIA the trace is prepended to `content` itself,
        # so a thinking model returns "Here's a thinking process: ..."
        # where the JSON should be and every call fails to parse
        # (live-diagnosed: 36s and unparseable with thinking on, 8s and
        # clean with it off, same prompt and model).
        reasoning_body=lambda _reasoning: {"chat_template_kwargs": {"thinking": False}},
    ),
    "openrouter": Provider(
        name="openrouter",
        url=OPENROUTER_URL,
        api_key=OPENROUTER_API_KEY,
        # 2026-08: mirrors the same fix in routes/reading.py's own MODELS
        # list — the original primary and two of four fallbacks had been
        # removed from OpenRouter's catalog (confirmed live against GET
        # /api/v1/models, 404 "No endpoints found" on both), wasting 2
        # requests' latency on the dead primary alone before ever
        # reaching a model that still exists. openai/gpt-oss-20b:free
        # dropped 2026-08 for the same reason, caught by
        # scripts/check_llm_models.py -- run that after touching this.
        models=(
            OPENROUTER_MODEL,
            "nvidia/nemotron-3-super-120b-a12b:free",
            "google/gemma-4-31b-it:free",
            "nvidia/nemotron-3-ultra-550b-a55b:free",
        ),
        # nemotron-3.5-lightning (the OpenRouter primary) is a reasoning
        # model; letting it think before answering matters more here than
        # for a plain chat model, since every call in this codebase is one
        # constrained JSON blob (kanji-gated sentence, exactly-4-choices
        # schema) that has to get several constraints right at once.
        # content still carries the final answer with this on -- reasoning
        # output is a separate field we don't read, not a replacement for
        # it. That is what makes leaving it enabled safe HERE and unsafe
        # on NVIDIA (see above).
        #
        # Callers pass False for BATCHED output. Measured on the grammar
        # sentence generator, 8 points per call: with reasoning on, this
        # model spent 1,588-1,781 tokens reasoning, hit the max_tokens
        # cap, and returned the prompt's own placeholders or nothing -- 0
        # usable sentences across repeated runs. With it off, the same
        # prompt cost ~500 completion tokens and produced real sentences.
        # The reasoning budget crowds out the answer when the answer is
        # long.
        reasoning_body=lambda reasoning: {"reasoning": {"enabled": reasoning}},
    ),
}

# ── Vision capability: checked, not present ────────────────────
# Plan 018 (photo/OCR input) needed to know whether ANY of the models
# above could read an image before building a vision-escalation tier on
# top of one. Checked live 2026-08 via
# `python -m scripts.check_llm_models --vision` (sends one request per
# model with a locally-rendered PNG of real Japanese text as an
# image_url content part):
#
#   nvidia/nemotron-3-super-120b-a12b       400 "multimodal processing
#                                            is not enabled"
#   nvidia/nemotron-3-ultra-550b-a55b       400/404 (inconsistent
#                                            status, same underlying
#                                            "not multimodal" cause)
#   nvidia/nemotron-3.5-lightning-30b-a3b   400, same as above
#   nvidia/nemotron-3.5-lightning:free      404 "No endpoints found
#                                            that support image input"
#   nvidia/nemotron-3-super-120b-a12b:free  404, same message
#   nvidia/nemotron-3-ultra-550b-a55b:free  404, same message
#   google/gemma-4-31b-it:free              429, persistently
#                                            rate-limited upstream
#                                            (Google AI Studio's free
#                                            tier) across three retries
#                                            with backoff -- INCONCLUSIVE,
#                                            not a confirmed "no", but
#                                            also not usable in
#                                            production on this tier
#                                            even if it turned out to
#                                            work
#
# Verdict: no model on either configured provider is confirmed
# vision-capable. Plan 018's OCR feature ships local-only (tesseract.js
# in the browser); its vision-escalation tier is BLOCKED on this, not
# implemented. Do not add a `vision` flag or a vision model entry here
# without re-running the probe first -- see plans/018-image-and-
# camera-input.md and docs/adr/0004-ocr-runs-client-first.md.

# NVIDIA first by default: OpenRouter is the account that ran out of
# credit, and this ordering is what the fallback is for. Overridable
# without a code change -- LLM_PROVIDER_ORDER=openrouter,nvidia in
# backend/.env puts it back.
_DEFAULT_PROVIDER_ORDER = "nvidia,openrouter"


def _build_providers() -> list[Provider]:
    """Configured providers, in preference order, minus any with no API
    key — so the list is always "what can actually be called", and every
    caller can treat an empty list as "no LLM configured at all"."""
    order = os.environ.get("LLM_PROVIDER_ORDER", _DEFAULT_PROVIDER_ORDER)
    out = []
    for name in (n.strip().lower() for n in order.split(",")):
        if not name:
            continue
        provider = _PROVIDER_CATALOG.get(name)
        if provider is None:
            logger.warning("Unknown provider %r in LLM_PROVIDER_ORDER; ignoring", name)
            continue
        if not provider.api_key:
            continue
        out.append(provider)
    return out


PROVIDERS = _build_providers()


def llm_configured() -> bool:
    """Whether any LLM provider can be called at all.

    Replaces the `if not OPENROUTER_API_KEY` checks that used to stand in
    for this across the exam generators, routes and scripts. With more
    than one provider that test became actively wrong: it would skip
    generation for a missing OpenRouter key while NVIDIA was configured
    and working."""
    return bool(PROVIDERS)

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


def offending_kanji(text: str, level: str) -> str:
    """The characters that make sentence_kanji_ok() false, in order of
    first appearance and without repeats — "" when the text passes.

    Exists so a rejection can tell the model WHICH characters it must
    replace. The allowed list is already in every prompt (see
    exam_gen_utils.kanji_instruction), so restating it on a retry adds
    tokens and no information; the handful of characters it actually got
    wrong is the part it doesn't have."""
    allowed = kanji_set_for_level(level)
    seen = dict.fromkeys(c for c in text if is_kanji(c) and c not in allowed)
    return "".join(seen)


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


# (provider, model) pairs that answered with a PERMANENT error this
# process — a model retired from the catalog (404), or one that rejects
# the request shape outright (400). Neither changes between one call and
# the next, so re-trying them is pure waste: before this, a dead first
# model cost one doomed round trip on EVERY call, and a single exam
# generation makes dozens. Keyed by provider too, because the same model
# id can be live on one endpoint and absent from another.
#
# Deliberately process-lifetime and in-memory: a model coming back is
# rare enough that a restart is a fine way to re-test it, and anything
# persistent would need invalidation logic for no real gain.
_DEAD_MODELS: set[tuple[str, str]] = set()

# Providers whose ACCOUNT is out, not whose model is wrong: credentials
# rejected (401/403) or credit/quota exhausted (402). Asking the same
# provider for a different model cannot fix any of those -- the 2026-08
# OpenRouter outage that prompted all this answered 402 for every model
# in the list, one wasted request each, when the first already proved
# the account was done. Marking the PROVIDER dead abandons its remaining
# models immediately and moves to the next provider.
_DEAD_PROVIDERS: set[str] = set()

_PROVIDER_ERROR_STATUSES = (401, 402, 403)
_PERMANENT_MODEL_STATUSES = (400, 404)
_RETRYABLE_STATUSES = (429, 500, 502, 503, 504)


def chat(messages: list[dict], timeout: int = 60, max_tokens: int = 3000, reasoning: bool = True) -> str:
    """Multi-provider, multi-model fallback chat completion.

    Walks PROVIDERS in order and, within each, its models in order:
    retry once per model on a network error, move to the next model on a
    429/5xx (temporary), and stop on anything else. Two kinds of "stop"
    are distinguished, and the difference is the whole point of this
    function:

      - a MODEL problem (400/404: gone from the catalog, request shape
        rejected) drops just that model, and the provider's other models
        are still tried;
      - a PROVIDER problem (401/402/403: credentials rejected, credit or
        quota exhausted) abandons that provider entirely and jumps to the
        next one, because no other model on the same account will fare
        any better.

    Both are remembered for the rest of the process (_DEAD_MODELS /
    _DEAD_PROVIDERS), so a dead primary or an exhausted account costs one
    wasted request in total rather than one per call.

    Raises LLMUnavailable (a RuntimeError subclass, not HTTPException)
    only once EVERY provider is exhausted -- callers decide how that
    becomes a user-facing error.

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
    if not PROVIDERS:
        raise LLMUnavailable(
            "No LLM provider is configured (set NVIDIA_API_KEY or OPENROUTER_API_KEY)"
        )

    attempts = [
        (provider, model)
        for provider in PROVIDERS
        if provider.name not in _DEAD_PROVIDERS
        for model in provider.models
        if (provider.name, model) not in _DEAD_MODELS
    ]
    if not attempts:
        # Not a request that happens to fail — a request not worth
        # sending at all. Everything configured has already told us it
        # cannot serve this account.
        raise LLMUnavailable(
            f"Every configured provider/model failed permanently earlier this run "
            f"(providers: {sorted(_DEAD_PROVIDERS)}, models: {sorted(m for _, m in _DEAD_MODELS)})"
        )

    last_status = None
    session = requests.Session()

    for provider, model in attempts:
        # Re-checked inside the loop, not just when `attempts` was built:
        # an earlier model in this same call may have just killed the
        # provider, and its remaining models must not be tried.
        if provider.name in _DEAD_PROVIDERS:
            continue

        # "provider:model", not "provider/model": every model id already
        # contains a vendor slash (nvidia/nemotron-...), so a slash here
        # produced "nvidia/nvidia/nemotron-..." in the logs.
        label = f"{provider.name}:{model}"
        for _ in range(2):
            try:
                response = session.post(
                    provider.url,
                    headers={
                        "Authorization": f"Bearer {provider.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model, "messages": messages, "max_tokens": max_tokens,
                        # How to ask for (or suppress) a reasoning pass is
                        # the one thing these endpoints genuinely disagree
                        # on -- see each Provider's reasoning_body above.
                        **provider.body_for(reasoning),
                    },
                    timeout=timeout,
                )
            except requests.RequestException as e:
                logger.warning("%s network error: %s", label, e)
                continue

            if response.ok:
                try:
                    content = response.json()["choices"][0]["message"]["content"]
                except (KeyError, IndexError, ValueError):
                    content = None
                # `content` can be present but null -- observed live from
                # minimaxai/minimax-m3, which answers 200 with a null
                # content field. Treated as a failed attempt rather than
                # returned, or it becomes an AttributeError deep in a
                # caller's .strip().
                if content:
                    logger.info("Using model %s", label)
                    return content
                last_status = response.status_code
                logger.error("%s returned an unusable body: %s", label, response.text[:300])
                continue

            status = response.status_code
            last_status = status
            logger.warning("%s failed (%s): %s", label, status, response.text[:300])

            if status in _PROVIDER_ERROR_STATUSES:
                _DEAD_PROVIDERS.add(provider.name)
                logger.error(
                    "Dropping provider %s for the rest of this process: account error %s "
                    "(credentials rejected, or credit/quota exhausted). %s",
                    provider.name, status, response.text[:300],
                )
                break
            if status in _PERMANENT_MODEL_STATUSES:
                _DEAD_MODELS.add((provider.name, model))
                logger.error(
                    "Dropping model %s for the rest of this process: permanent error %s. %s",
                    label, status, response.text[:300],
                )
                break
            if status not in _RETRYABLE_STATUSES:
                break

    raise LLMUnavailable(f"All LLM providers failed. Last error: {last_status or 'no response'}")
