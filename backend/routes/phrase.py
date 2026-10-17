import hashlib
import json
import logging
import os
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from core.credits import require_pass
from typing import Literal

from pydantic import BaseModel, Field

from core.db import db_conn
from core.auth import get_user_id
from core.srs_instance import srs
from core.history import trim_history
from study.llm_shared import chat, LLMUnavailable
from content.grammar_points_data import localise
from study import line_translate
from study.analysis import analyze_local, attach_user_state, merge_deep
from study.cue_sentences import is_japanese
from study.line_cut import cut_line
from study.sentences import split_sentences, MAX_SENTENCES
from routes.reading import LANG_NAMES, known_lang
from core import daily_limit
from core.credits import resets_at

# A pass feature (plan 069): every route here refuses a free learner
# with 402 pass_required once CREDITS_ENFORCE=1; a no-op until then.
router = APIRouter(dependencies=[Depends(require_pass)])
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
  "grammar": [
    {{"pattern": "...", "note": "..."}}
  ],
  "translation": "...",
  "explanation": "..."
}}

- "surface" is the word exactly as it appears in the phrase.
- "base" is its dictionary/base form (same as surface if already in base form).
- "reading" is the reading in hiragana.
- "meaning" is what the word means IN THE CONTEXT of this specific phrase, not just a generic dictionary gloss. Write it in {lang_name}.
- "pos" is a short part-of-speech label (noun, verb, particle, adjective, etc), in {lang_name}.
- "grammar" has one entry per grammar point listed under the phrase, in the order listed, with "pattern" copied EXACTLY as listed. "note" is ONE sentence, in {lang_name}, saying what that pattern does in THIS phrase -- what it attaches to here and what it adds to the meaning -- not a general definition. An empty list when no points are listed.
- "translation" is the whole phrase translated into {lang_name}: one natural sentence, as a subtitle would give it, with no notes or alternatives.
- "explanation" is 2-4 sentences, in {lang_name}, saying how the phrase is BUILT: what its predicate is and what it is said of, what modifies or completes what, and how each conjugated or combined form is put together and what each of its parts adds. Quote the Japanese pieces you name. Never restate, summarise or translate what the phrase says, and make no general remark on its mood or tone: "translation" carries the meaning, the explanation is the construction, and a nuance is named only where a form carries it.

The JSON key names ("words", "surface", "base", "reading", "meaning", "pos",
"grammar", "pattern", "note", "translation", "explanation") must stay exactly
as shown, in English, no matter what {lang_name} is -- only the VALUES you
write for "meaning", "pos", "note", "translation" and "explanation" go in
{lang_name}.
"""


# ── The points the model is told about (plan 095) ──────────────
# The local tier finds the grammar; the model is asked what each point
# does in this sentence, one line per point, and nothing else about
# which points there are. Told nothing, it explained whichever rules it
# noticed, in prose the chips could not be tied to -- and the two
# disagreed often enough that a learner could not tell which to trust.
# Constructions only: a note on は ("marks the topic 私") is the gloss
# the row already prints, and the markers keep it.
def _deep_points(analysis: dict, lang: str) -> list[dict]:
    seen: set[str] = set()
    out = []
    for point in analysis.get("grammar", []):
        pattern = point.get("pattern")
        if not pattern or point.get("kind") == "marker" or pattern in seen:
            continue
        seen.add(pattern)
        out.append({
            "pattern": pattern,
            "structure": point.get("structure") or "",
            "meaning": localise(point.get("meaning"), lang),
        })
    return out


def _user_message(phrase: str, points: list[dict], context: str = "") -> str:
    lines = [phrase]
    if points:
        lines += ["", "Grammar points found in this phrase:"]
        for point in points:
            detail = " -- ".join(part for part in (point.get("structure"), point.get("meaning")) if part)
            lines.append(f"- {point['pattern']}" + (f" ({detail})" if detail else ""))
    if context:
        lines += ["", context]
    return "\n".join(lines)


# ── Where the phrase stands (plan 235) ─────────────────────────
# A video's line explained alone was explained as a sentence of its own:
# みなさんがいてくれるので、 with nobody to be there and nothing it
# was the reason for (the owner: "give a bit of context to it, not just
# the sentence ... a snippet of the text and some metadata"). A caller
# that knows where the phrase stands passes it here -- what the video
# is, where in it the line comes, the lines around it -- and it rides
# in the user block under the phrase, the schema and the system block
# unchanged. The phrase alone is still what is broken down.
CONTEXT_INSTRUCTION = (
    "This phrase is one line of a longer text. Break down and translate the phrase alone, "
    "but use what follows to get its meaning right. Where its construction runs across lines "
    "(a clause the line before leaves open, a subject or object carried over, a sentence the "
    "next line completes), let the explanation say so in a sentence."
)


def deep_context(about: list[str], before: list[str], after: list[str]) -> str:
    """The block a phrase's context is written as: `about` the lines
    saying what the text is, `before` and `after` its neighbours."""
    lines = [CONTEXT_INSTRUCTION]
    lines += [f"- {line}" for line in about if line]
    if before:
        lines.append("- Before it: " + " / ".join(before))
    if after:
        lines.append("- After it: " + " / ".join(after))
    return "\n".join(lines)


# ── A typed Passage's sentences (plan 235) ─────────────────────
# The analyser holds a typed or photographed Passage's sentences to a
# video's line width too (study/line_cut.py): a sentence from a novel
# drew nine rows of a phone at display size. Only the analyser's: the
# practice runs, reading practice and the dictionary ask for one
# sentence's breakdown and take it whole, and nothing of theirs is cut.
# A grammar point that would span a cut is lost to both halves, which
# is why the cut goes at a mark or a clause's end first.
_TEXT_SOURCES = {
    "typed": "a Japanese text the learner is reading",
    "image": "a photographed page of Japanese",
    "video": "a line kept from a video's subtitles",
}


def passage_sentences(passage: str, whole: bool = False, lines: bool = False) -> list[dict]:
    """The Sentences a Passage is analysed as, each {"text", ...}: one
    when `whole`, split on its punctuation otherwise, and with `lines`
    every Japanese one wider than the line cut into the lines it reads
    in."""
    if whole:
        return [{"text": passage}]
    sentences = split_sentences(passage)
    if not lines:
        return sentences
    out = []
    for s in sentences:
        if not is_japanese(s["text"]):
            out.append(s)
            continue
        out += [{"text": piece["text"]} for piece in cut_line(s["text"], None, None)]
    return out


def passage_context(texts: list[str], index: int, source: str = "typed") -> str:
    """Where sentence `index` of a typed Passage stands (deep_context):
    what the text is, the sentence's place, two sentences either side.
    Empty for a Passage of one sentence, which is explained as it always
    was -- and under the key the reading bank and every other caller
    share."""
    if len(texts) < 2:
        return ""
    about = [f"From {_TEXT_SOURCES.get(source, _TEXT_SOURCES['typed'])}.",
             f"Sentence {index + 1} of {len(texts)}."]
    before = [t for t in texts[max(0, index - 2):index] if t]
    after = [t for t in texts[index + 1:index + 3] if t]
    return deep_context(about, before, after)


# ── The breakdown cache ───────────────────────────────────────
# Reading practice fires this endpoint for EVERY phrase it shows, in the
# background, so the breakdown is ready the moment the reader asks (see
# ReadingScreen.jsx's fetchAnalysis). That was one LLM call per phrase
# read, per reader, forever -- and the analysis of a given sentence is a
# property of the sentence, not of who is reading it or when.
#
# It matters far more now than it did: reading practice draws from a
# curated bank of ~1,050 hand-written sentences (content/reading_sentences,
# plan 192), so the SAME sentences come round constantly. Cached, the
# whole bank costs at most one call a sentence once, shared across every
# user, instead of one
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
#
# v4 (plan 095): the prompt lists the grammar points the local tier
# found and asks for a note on each; an entry bought under v3 has no
# notes and would never gain them, since the cache never expires.
#
# v5 (plan 161): the prompt asks for the phrase's translation, which the
# desk analyser prints under a typed or photographed sentence; an entry
# bought under v4 has none and would never gain one.
#
# v6 (plan 242): the explanation says how the phrase is built and
# nothing else (the owner: "the explain button is only for the
# explanation of how the sentence is built"). Under v5 it opened on a
# paraphrase of the meaning and closed on its tone -- the translation's
# job, which every line of a video now has under it -- and an entry
# bought then would go on saying so.
CACHE_VERSION = 6


def _phrase_key(phrase: str, lang: str, context: str = "") -> str:
    # A phrase explained where it stands (plan 235) is its own entry:
    # the same line in another video, or with other lines around it, is
    # another explanation. The phrase alone keeps the key it always had,
    # so nothing cached under it moves.
    material = f"v{CACHE_VERSION}:{lang}:{phrase}"
    if context:
        digest = hashlib.sha256(context.encode("utf-8")).hexdigest()
        material = f"v{CACHE_VERSION}:{lang}:ctx:{digest}:{phrase}"
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


# ── phrase_history becomes the Sentence bank ─────────────────────
# Was: one INSERT per analysis, storing the WHOLE enriched result
# (including per-user SRS `stats`, frozen at analysis time) as a JSONB
# blob. Reopen an entry from last month and a word mastered since still
# reads "New" -- the stored stats are a snapshot of a value that changes
# every review. See docs/adr/0002-sentence-bank-stores-text-not-results.md.
#
# Now: only `phrase` (the Passage text) and provenance (`source`,
# `source_ref`) are stored. GET /api/phrase/history/{id} re-derives the
# analysis through the same local (+cached deep) pipeline every time, so
# badges always reflect CURRENT SRS state.
#
# Additive and idempotent -- same pattern decks.py's _ensure_deck_schema
# uses -- not a destructive migration: `result` is made nullable rather
# than dropped, and existing rows keep whatever they already have. They
# are simply never read again; see the module's own note on this.
def _migrate_history_schema() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("ALTER TABLE phrase_history ALTER COLUMN result DROP NOT NULL")
            cur.execute(
                "ALTER TABLE phrase_history ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'typed'"
            )
            cur.execute(
                "ALTER TABLE phrase_history ADD COLUMN IF NOT EXISTS source_ref TEXT NOT NULL DEFAULT ''"
            )
            # 保存 -- a Sentence the learner chose to keep, as opposed to
            # a Passage that merely passed through. Both live in this
            # table because they are the same thing to ADR-0002 (text
            # plus provenance, never results); `kept` is what tells them
            # apart in the UI. Additive, idempotent, defaulted -- every
            # existing row is history, not a pin, which is correct.
            cur.execute(
                "ALTER TABLE phrase_history ADD COLUMN IF NOT EXISTS kept BOOLEAN NOT NULL DEFAULT FALSE"
            )
            # A pin is idempotent: pinning the same Sentence twice must
            # not make two rows. Partial index, so the constraint applies
            # ONLY to kept rows -- ordinary history legitimately repeats
            # (analyse the same sentence twice on two different days and
            # both visits are real).
            cur.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_phrase_history_kept_unique
                ON phrase_history(user_id, phrase) WHERE kept
            """)
            # Each sentence's translation (plan 235), as a video session
            # keeps its lines': {lang: {sentence: translation}}. A
            # translation is a translation of text, not an analysis, so
            # ADR-0002 still holds: nothing here goes stale with the SRS.
            cur.execute(
                "ALTER TABLE phrase_history ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb"
            )
        conn.commit()
    finally:
        conn.close()


try:
    _migrate_history_schema()
except Exception:  # pragma: no cover - a missing DB must not stop import
    logger.exception("phrase_history schema migration failed")


def _cached_analysis(phrase: str, lang: str, context: str = "") -> dict | None:
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
                (_phrase_key(phrase, lang, context),),
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


def _store_analysis(phrase: str, lang: str, result: dict, context: str = "") -> None:
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
                (_phrase_key(phrase, lang, context), phrase, json.dumps(result, ensure_ascii=False)),
            )
        conn.commit()
    except Exception:
        logger.exception("phrase cache write failed")
    finally:
        conn.close()


class PhraseRequest(BaseModel):
    # Bounded (plan 211): split into at most MAX_SENTENCES, but read and
    # tokenized whole first. A long chapter pasted is ~20k characters.
    phrase: str = Field(max_length=20_000)
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
    # Provenance for the Sentence bank (docs/adr/0002) -- 'typed' is the
    # default and matches phrase_history.source's own column default, so
    # a caller that never mentions this (ReadingScreen.jsx, most direct
    # analyzer use) writes exactly what it always wrote. Plan 018 (photo
    # input) sends 'image'; plan 019 (video) will send 'video'. Anything
    # else is a 422, not a row the history shelf cannot classify.
    source: Literal["typed", "image", "video"] = "typed"
    # True for the practice runs, which hand over one exercise and draw
    # one breakdown of it: the text is analysed as ONE Sentence, never
    # split. Split, a bank item written as two (「雨がふりました。しかし、
    # 学校へ行きました。」, nine of the reading bank's) came back as a
    # Passage of two with no top-level tokens, and the run drew the bare
    # sentence where its breakdown should have been.
    whole: bool = False
    # True for the analyser's own Passage (plan 235): each sentence
    # held to the line width a video's lines are (passage_sentences).
    # Every other caller takes its sentences as they are.
    lines: bool = False


def _call_llm(phrase: str, lang: str, points: list[dict] | None = None, context: str = "") -> dict:
    """One word-by-word breakdown, via the shared multi-provider client,
    with a note on each of `points` (_deep_points) and, where the caller
    knows it, where the phrase stands (`context`, deep_context).

    max_tokens=1500: a segmentation of one sentence, a line per grammar
    point, its translation and a 2-4 sentence note. Generous for the longest phrase the
    app serves (an N1 reading sentence caps at 80 characters) and stops
    a model that decides to write an essay from billing for it.

    reasoning=False: this is a structured-extraction task over text the
    caller already has, not one that benefits from a thinking pass --
    and llm_shared documents the reasoning budget crowding out the
    answer when the answer is long."""
    lang_name = LANG_NAMES.get(lang, lang)
    try:
        content = chat(
            [
                {"role": "system", "content": SYSTEM_PROMPT_TEMPLATE.format(lang_name=lang_name)},
                {"role": "user", "content": _user_message(phrase, points or [], context)},
            ],
            timeout=30, max_tokens=1500, reasoning=False, task="phrase",
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
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.error("Failed to parse LLM response as JSON: %r", content)
        raise HTTPException(status_code=502, detail="LLM returned an unparseable response")
    # Valid JSON that is not an object (a bare list of words, say) must be
    # refused here, before _store_analysis: the cache is permanent, and a
    # cached list would fail every later deep read of the phrase on .get.
    if not isinstance(parsed, dict):
        logger.error("LLM response was JSON but not an object: %r", content)
        raise HTTPException(status_code=502, detail="LLM returned an unparseable response")
    return parsed


# Some models translate the JSON KEY itself into the target language
# (e.g. "explication" for a French request) despite SYSTEM_PROMPT_TEMPLATE
# pinning the key names to English -- verified live against
# nvidia/nemotron-3-super-120b-a12b, which does this consistently even
# with that instruction present. The schema's other top-level keys
# ("words", "grammar") hold lists; since plan 161 a second string sits
# beside "explanation", the translation, so "translation" under its own
# name in each language LANG_NAMES offers is taken first, and any other
# additional string-valued key is the mistranslated "explanation".
#
# Applied where llm_result is consumed (_analyze_sentence), not where
# it's parsed -- a bad key can already be sitting in phrase_analysis_cache
# from before this fix existed (no expiry, see that table's own comment),
# and normalizing only on the fresh-call path would leave every such row
# permanently broken. Doing it here self-heals cache hits too, with no
# CACHE_VERSION bump needed.
_TRANSLATION_KEYS = frozenset({
    "translation", "traduction", "traducción", "übersetzung", "翻訳", "traduzione", "tradução",
})


def _normalize_explanation_key(parsed: dict) -> dict:
    if not isinstance(parsed, dict) or "words" not in parsed:
        return parsed
    if not parsed.get("translation"):
        for key, value in parsed.items():
            if key.lower() in _TRANSLATION_KEYS and isinstance(value, str) and value:
                parsed["translation"] = value
                break
    if not parsed.get("explanation"):
        for key, value in parsed.items():
            if (key not in ("words", "explanation") and key.lower() not in _TRANSLATION_KEYS
                    and isinstance(value, str) and value):
                parsed["explanation"] = value
                break
    return parsed


# The deep tier's model calls a learner may make in a day (plan 211):
# a cache miss, never a hit -- the curated sentences are paid for once
# for everyone. Every caller of the deep tier (the analyzer, the runs'
# explain, a video line) counts here; before, none counted at all, and
# a request could buy fifty.
DEEP_FEATURE = "deep_analysis"
DEEP_DAILY_LIMIT = int(os.environ.get("DEEP_DAILY_LIMIT", "150"))


def _analyze_sentence(text: str, deep: bool, lang: str, states: dict, user_id: str,
                       allow_llm_call: bool = True, context: str = "") -> dict:
    """One Sentence through the full local (+ optional deep) pipeline,
    with per-user SRS state attached. Shared by the live analyze path
    and the history re-derive path (Step 3) so the two can never drift.

    `allow_llm_call=False` is the history re-derive path's whole point:
    opening a saved entry is a local-tier operation and must never call
    a model. When the deep tier was bought earlier, `phrase_analysis_cache`
    is permanent and keyed by (phrase, lang), so a cache HIT still merges
    in -- only a cache MISS is treated differently: skipped instead of
    escalated to _call_llm.

    `context` (deep_context) is where the phrase stands, for a caller
    that knows it (a video's line, plan 235): asked with the phrase and
    cached under a key of its own.
    """
    analysis = analyze_local(text)
    lang = known_lang(lang)

    if deep:
        # The deep tier is bought explicitly, per call, per Sentence --
        # never for a whole Passage at once (see PhraseRequest.deep and
        # docs/adr/0001). The cached half (llm_result) is the expensive,
        # user-independent half; everything from attach_user_state
        # onward is per-user and recomputed every time.
        llm_result = _cached_analysis(text, lang, context)
        if llm_result is None and context and not allow_llm_call:
            # Reopened, a sentence explained before it was explained
            # where it stands still finds what was bought for it.
            llm_result = _cached_analysis(text, lang)
        if llm_result is None and allow_llm_call:
            if daily_limit.claim(user_id, DEEP_FEATURE, DEEP_DAILY_LIMIT) > DEEP_DAILY_LIMIT:
                raise HTTPException(
                    status_code=429,
                    detail=(
                        f"Daily limit of {DEEP_DAILY_LIMIT} explanations reached; "
                        f"resets {resets_at(user_id):%Y-%m-%dT%H:%MZ}"
                    ),
                )
            llm_result = _call_llm(text, lang, _deep_points(analysis, lang), context)
            _store_analysis(text, lang, llm_result, context)
        if llm_result is not None:
            llm_result = _normalize_explanation_key(llm_result)
            analysis = merge_deep(
                analysis, llm_result.get("words", []), llm_result.get("explanation", ""),
                llm_result.get("grammar"), llm_result.get("translation", ""),
            )

    return attach_user_state(analysis, states, user_id)


# The most model calls one `deep` request can buy: the first this many
# Sentences of its Passage; the rest come back local, with any deep tier
# already cached merged in. Every caller asks for one Sentence at a time
# (docs/adr/0001), so this binds nothing the app does -- it keeps a
# Passage's cost where it was when MAX_SENTENCES was 50, now that it is
# far longer.
MAX_DEEP_SENTENCES = 50


def _analyze_passage(passage: str, deep: bool, lang: str, user_id: str,
                      allow_llm_call: bool = True, whole: bool = False,
                      lines: bool = False, source: str = "typed") -> dict:
    """A Passage split into Sentences and each analyzed independently --
    or, `whole`, taken as one Sentence (see PhraseRequest.whole), or,
    `lines`, held to the line width (passage_sentences), its deep tier
    read where each sentence stands (passage_context). No LLM call
    happens here unless `deep` is set -- see _analyze_sentence."""
    all_sentences = passage_sentences(passage, whole=whole, lines=lines)
    truncated = max(0, len(all_sentences) - MAX_SENTENCES)
    kept = all_sentences[:MAX_SENTENCES]
    texts = [s["text"] for s in kept]

    states = srs.get_user_states(user_id)
    sentences = [
        _analyze_sentence(s["text"], deep, lang, states, user_id,
                          allow_llm_call and i < MAX_DEEP_SENTENCES,
                          context=passage_context(texts, i, source) if deep and lines else "")
        for i, s in enumerate(kept)
    ]

    result = {"passage": passage, "sentences": sentences, "truncated": truncated}

    # Backward compatibility: a single-Sentence Passage (every call
    # ReadingScreen.jsx makes, and most analyzer calls) mirrors its one
    # Sentence's fields at the top level, exactly as the endpoint's
    # pre-multi-sentence shape did.
    if len(sentences) == 1:
        only = sentences[0]
        result.update({
            "explanation": only.get("explanation", ""),
            "translation": only.get("translation", ""),
            # Deprecated alias for the pre-2026-08 "words" shape both
            # PhraseAnalyzerScreen.jsx and ReadingScreen.jsx still read.
            # Points at the SAME list as "tokens" rather than a copy.
            "words": only["tokens"],
            "tokens": only["tokens"],
            "grammar": only["grammar"],
            "level": only["level"],
            "grade": only["grade"],
            "available": only["available"],
            "unknown_count": only.get("unknown_count"),
            "off_deck_count": only.get("off_deck_count"),
        })
        if "deep_dropped" in only:
            result["deep_dropped"] = only["deep_dropped"]

    return result


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
    result = _analyze_passage(phrase, payload.deep, payload.lang, user_id, whole=payload.whole,
                              lines=payload.lines, source=payload.source)

    if not payload.save:
        return {**result, "id": None, "created_at": None}

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            # source_ref still takes its column default ('') -- no
            # caller has a reference to attach yet. A video timestamp
            # (plan 019) is what will actually populate it.
            cur.execute(
                "INSERT INTO phrase_history(user_id, phrase, source) VALUES (%s, %s, %s) RETURNING id, created_at",
                (user_id, phrase, payload.source),
            )
            row_id, created_at = cur.fetchone()
            # The oldest past the history's limit leaves the shelf.
            trim_history(cur, user_id)
        conn.commit()
    finally:
        conn.close()

    return {**result, "id": row_id, "created_at": created_at.isoformat()}


@router.get("/api/phrase/history")
def get_phrase_history(user_id: str = Depends(get_user_id), limit: int = Query(50, ge=1, le=200)):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            # A video line explained before 2026-09-27 was written here
            # too (source 'video', never kept), and drew a text card of
            # its own: not listed, and erased on the learner's next
            # write (core/history.py).
            cur.execute(
                "SELECT id, phrase, source, kept, created_at FROM phrase_history "
                "WHERE user_id = %s AND (kept OR source <> 'video') "
                "ORDER BY kept DESC, created_at DESC LIMIT %s",
                (user_id, limit),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    return [
        {
            "id": row_id,
            "phrase": phrase,
            "source": source,
            "kept": kept,
            "created_at": created_at.isoformat(),
        }
        for row_id, phrase, source, kept, created_at in rows
    ]


@router.get("/api/phrase/history/{entry_id}")
def get_phrase_history_entry(entry_id: int, lang: str = "en", user_id: str = Depends(get_user_id)):
    # Re-derives the analysis from the stored `phrase` text every time --
    # see the _migrate_history_schema note above (docs/adr/0002). This is
    # a local-tier operation: allow_llm_call=False means a Sentence whose
    # deep tier was never bought (or was bought in a different `lang`)
    # simply comes back local-only, rather than triggering a fresh model
    # call just because the learner reopened an old entry.
    #
    # The shelf is the analyser's, so the Passage comes back in the lines
    # the analyser reads it in (plan 235), each sentence's explanation
    # looked up where it stands -- the indices its translations and its
    # Explain are asked by.
    entry = _load_entry(entry_id, user_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Not found")

    result = _analyze_passage(entry["phrase"], deep=True, lang=lang, user_id=user_id, allow_llm_call=False,
                              lines=True, source=entry["source"])
    return {**result, "id": entry_id, "source": entry["source"], "created_at": entry["created_at"].isoformat()}


def _load_entry(entry_id: int, user_id: str) -> dict | None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT phrase, source, translations, created_at FROM phrase_history "
                "WHERE id = %s AND user_id = %s",
                (entry_id, user_id),
            )
            row = cur.fetchone()
    finally:
        conn.close()
    if row is None:
        return None
    phrase, source, translations, created_at = row
    return {"phrase": phrase, "source": source, "translations": translations or {}, "created_at": created_at}


def _entry_sentences(entry: dict) -> list[str]:
    """A history Passage's sentences as the analyser holds them, the
    first MAX_SENTENCES as _analyze_passage keeps them."""
    return [s["text"] for s in passage_sentences(entry["phrase"], lines=True)[:MAX_SENTENCES]]


class HistoryExplainPayload(BaseModel):
    lang: str = "en"


@router.post("/api/phrase/history/{entry_id}/sentence/{index}/explain")
def explain_history_sentence(entry_id: int, index: int, payload: HistoryExplainPayload,
                             user_id: str = Depends(get_user_id)):
    """The deep tier of ONE sentence of a typed or photographed Passage,
    asked where it stands (plan 235): the two sentences either side of
    it, its place, what kind of text it is. A Passage of one sentence is
    asked as the sentence alone. The answer is the sentence's analysis,
    as /api/phrase/analyze gives one; reopening the Passage
    (get_phrase_history_entry) finds it under the same context."""
    entry = _load_entry(entry_id, user_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Not found")
    texts = _entry_sentences(entry)
    if index < 0 or index >= len(texts):
        raise HTTPException(status_code=404, detail="No such sentence in this Passage")
    states = srs.get_user_states(user_id)
    return _analyze_sentence(texts[index], deep=True, lang=payload.lang, states=states, user_id=user_id,
                             context=passage_context(texts, index, entry["source"]))


# ── 訳 — a translation under every sentence (plan 235) ──────────
# A video session's lines and a typed Passage's sentences are translated
# alike (study/line_translate.py): a block of lines at a time, kept on
# the row the Passage is kept on, rationed by the same daily ceiling.
class TranslationsPayload(BaseModel):
    lang: str = "en"
    # A line of the block wanted: the block is the BLOCK lines it falls in.
    index: int = Field(0, ge=0)
    title: str = Field("", max_length=200)
    channel: str = Field("", max_length=120)


def _translation_refusal(status: int, code: str, message: str) -> HTTPException:
    """Shaped as routes/video.py's refusals (plan 210): a code the client
    words, the English for the logs."""
    return HTTPException(status_code=status, detail={"code": code, "message": message})


def translated_block(user_id: str, table: str, row_id: int, lines: list[dict], stored: dict,
                     payload: TranslationsPayload, kind: str) -> dict:
    """The /translations answer for a Passage's `lines` (each {"text",
    "foreign"?}), `stored` being what its row already holds --
    {"start", "lines"}, one translation or None per line of the block --
    and what had to be asked kept on that row."""
    lang = known_lang(payload.lang)
    try:
        start, out, found = line_translate.translate_block(
            user_id, lines, payload.index, LANG_NAMES.get(lang, lang),
            dict((stored or {}).get(lang) or {}), payload.title, payload.channel, kind,
        )
    except line_translate.OverLimit:
        raise _translation_refusal(
            429, "translation_limit",
            f"Daily limit of {line_translate.LINE_TRANSLATION_DAILY_LIMIT} translated blocks reached; "
            f"resets {resets_at(user_id):%Y-%m-%dT%H:%MZ}",
        )
    except LLMUnavailable as e:
        logger.error("Line translation has no usable LLM provider: %s", e)
        raise _translation_refusal(503, "ai_unavailable", "The AI service is temporarily unavailable.")
    if found:
        # Best effort: a failed save costs the next opening a call,
        # never this answer.
        try:
            line_translate.keep(table, row_id, lang, found)
        except Exception:
            logger.exception("Could not store the translations of %s %s", table, row_id)
    return {"start": start, "lines": out}


@router.post("/api/phrase/history/{entry_id}/translations")
def translate_history_sentences(entry_id: int, payload: TranslationsPayload,
                                user_id: str = Depends(get_user_id)):
    """The translations of the block of a typed or photographed
    Passage's sentences that `index` falls in -- as a video session's
    lines are translated (routes/video.py) -- None for a sentence with
    no Japanese in it."""
    entry = _load_entry(entry_id, user_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Not found")
    lines = [{"text": text, "foreign": not is_japanese(text)} for text in _entry_sentences(entry)]
    return translated_block(user_id, "phrase_history", entry_id, lines, entry["translations"], payload, "text")


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


class KeepRequest(BaseModel):
    sentence: str
    source: str = "typed"
    source_ref: str = ""


@router.post("/api/phrase/keep")
def keep_sentence(payload: KeepRequest, user_id: str = Depends(get_user_id)):
    """保存 -- keep ONE Sentence, with its provenance.

    Text and provenance only, never the analysis: see
    docs/adr/0002-sentence-bank-stores-text-not-results.md. Reopening a
    kept Sentence re-derives it through the same local (+cached deep)
    pipeline every other read uses, so its badges always reflect CURRENT
    SRS state rather than a snapshot.

    Idempotent by construction -- the partial unique index on
    (user_id, phrase) WHERE kept means pinning twice updates rather than
    duplicates. An ordinary history row for the same text is left alone:
    the two are different facts (you passed through this / you chose to
    keep this) and collapsing them would lose the visit.
    """
    sentence = payload.sentence.strip()
    if not sentence:
        raise HTTPException(status_code=400, detail="Sentence is required")

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO phrase_history(user_id, phrase, source, source_ref, kept) "
                "VALUES (%s, %s, %s, %s, TRUE) "
                "ON CONFLICT (user_id, phrase) WHERE kept "
                "DO UPDATE SET source = EXCLUDED.source, source_ref = EXCLUDED.source_ref "
                "RETURNING id, created_at",
                (user_id, sentence, payload.source, payload.source_ref),
            )
            row_id, created_at = cur.fetchone()
        conn.commit()
    finally:
        conn.close()

    return {"id": row_id, "created_at": created_at.isoformat(), "kept": True}


@router.delete("/api/phrase/keep/{entry_id}")
def unkeep_sentence(entry_id: int, user_id: str = Depends(get_user_id)):
    """Un-pin. Clears `kept` rather than deleting the row: the learner
    kept this Sentence and then changed their mind about keeping it,
    which is not the same as never having seen it. DELETE
    /api/phrase/history/{id} is still how you remove it entirely."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE phrase_history SET kept = FALSE WHERE id = %s AND user_id = %s",
                (entry_id, user_id),
            )
            rowcount = cur.rowcount
        conn.commit()
    finally:
        conn.close()

    if rowcount == 0:
        raise HTTPException(status_code=404, detail="Not found")

    return {"ok": True}