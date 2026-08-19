import json
import logging
import os
import random
import re
import unicodedata
from functools import lru_cache

import requests
import pykakasi
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.db import db_conn
from core.auth import get_user_id, unprefixed
from core.srs_instance import srs
from study.card_lookup import find_segments_in_text, attach_stats_to_segments, VOCAB_STATUS_MODE
from content.kanji_data import get_kanji_string
from content.vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from content import vocab_extras
from content import reading_sentences
from study import difficulty
import content.vocab_jmdict_data as jmdict_db
import content.frequency_data as freq

router = APIRouter()
logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
# 2026-08: switched primary off the paid anthropic/claude-haiku-4.5 —
# mirrors the same change and live catalog check in study/llm_shared.py.
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "nvidia/nemotron-3.5-lightning:free")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Still used by Reading Comprehension below (LLM-generated) — untouched
# by the 2026-08 phrase-mode rewrite.
#
# 2026-08 fix: the primary model and two of the four fallbacks
# (meta-llama/llama-3.3-70b-instruct:free, openrouter/owl-alpha) had
# been quietly removed from OpenRouter's catalog — confirmed live
# against GET /api/v1/models, which returns 404 "No endpoints found"
# for both. Every single call to this endpoint was wasting 2 requests'
# worth of latency on the dead primary alone before falling through to
# a model that actually still exists. Replaced with IDs verified
# present in the live catalog at fix time; OpenRouter's catalog is a
# moving target, so this will drift again eventually.
MODELS = [
    OPENROUTER_MODEL,                     # Primary
    "nvidia/nemotron-3-super-120b-a12b:free",
    "openai/gpt-oss-20b:free",
    "google/gemma-4-31b-it:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
]

_kakasi = pykakasi.kakasi()

# Display time scales with phrase length, clamped to a sane range. Tune freely.
MIN_DISPLAY_SECONDS = 5
MAX_DISPLAY_SECONDS = 25
SECONDS_PER_CHAR = 0.6
BASE_SECONDS = 3.0

# Best-effort code -> name mapping so the LLM gets an unambiguous instruction
# even if it only recognizes ISO codes loosely. Still used by Reading
# Comprehension below.
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
# JLPT levels are cumulative. Still used by Reading Comprehension below
# (constrains the LLM's kanji choice) — the phrase mode below doesn't
# need this anymore: real example sentences aren't generated against an
# allow-list, they just come from whatever level/tier/mastery pool the
# learner picked.
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
    source: str            # compact log label — see _source_label()
    level: str | None = None
    phrase: str
    romaji: str
    answer: str
    correct: bool


def _allowed_kanji_for_level(level: str) -> str:
    allowed_levels = LEVEL_HIERARCHY.get(level)
    if not allowed_levels:
        raise HTTPException(status_code=400, detail="Unknown JLPT level")
    return get_kanji_string(allowed_levels)


def _chat(messages, timeout=60, max_tokens=3000):
    # max_tokens explicit rather than left to OpenRouter's own default
    # (64000, live-diagnosed 2026-08): this endpoint generates one
    # bounded passage + a handful of questions, never an open-ended
    # completion, and the unset default was large enough to 402 on the
    # account's available credit on every single call, forcing every
    # request onto the free-tier fallbacks instead of the primary model
    # — see study/llm_shared.chat's matching fix and comment.
    last_error = None
    SESSION = requests.Session()

    for model in MODELS:
        for attempt in range(2):
            try:
                response = SESSION.post(
                    OPENROUTER_URL,
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": messages,
                        "max_tokens": max_tokens,
                        # nemotron-3.5-lightning (the new primary) is a
                        # reasoning model -- see study/llm_shared.chat's
                        # matching comment for why this stays on.
                        "reasoning": {"enabled": True},
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
                    logger.error(response.text)
                continue

            logger.warning(
                "%s failed (%s): %s",
                model,
                response.status_code,
                response.text[:300],
            )

            last_error = response

            # only try another model for temporary failures
            if response.status_code not in (429, 500, 502, 503, 504):
                break

    raise HTTPException(
        503,
        detail=f"All LLM providers failed. Last error: {response.status_code}"
    )


def _display_seconds(phrase: str) -> float:
    seconds = BASE_SECONDS + SECONDS_PER_CHAR * len(phrase)
    return max(MIN_DISPLAY_SECONDS, min(MAX_DISPLAY_SECONDS, round(seconds, 1)))


def phrase_to_romaji(text: str) -> str:
    """Deterministic JP -> Hepburn romaji conversion via pykakasi.

    Previously (see git history) only ever called on an LLM-provided
    all-hiragana "reading" — the app deliberately never asked the LLM
    to spell romaji directly, because models are unreliable at
    inventing Hepburn spelling on the fly. Real example sentences carry
    no such pre-resolved reading, so this now runs directly on the
    sentence's own mixed kanji/kana text: pykakasi has its own
    dictionary-based kanji reading, which is NOT context-aware and can
    occasionally pick the wrong reading for an ambiguous kanji. Accepted
    trade-off, not an oversight — correctness here was already soft
    before this change (post_reading_result: "Correctness is now
    self-assessed by the user after seeing the reveal"), so an
    occasional wrong reading in the *reference* romaji is a minor
    annoyance, not a grading bug, since nothing auto-compares against it.
    """
    converted = _kakasi.convert(text)
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


# ── Sentence source: real example sentences instead of LLM generation ──
#
# 2026-08 rewrite. Previously this endpoint asked an LLM to invent
# phrases constrained to a kanji allow-list (see git history for the
# removed SYSTEM_PROMPT_TEMPLATE / _call_llm_batch / PHASES if you need
# to compare) — replaced with real JMdict/Tatoeba example sentences
# already sitting in the vocab data (get_vocab_extras()["examples"],
# see vocab_extras.py). Three ways to pick WHICH word's example
# sentence gets served:
#
#   "level"     — JLPT level (existing LevelSelector UI), from the
#                 app's own curated deck.
#   "frequency" — a frequency tier (see frequency_data.py), either over
#                 the deck ("vocab" domain) or the full JMdict pool
#                 ("vocab_jmdict" domain) — the same tiers used
#                 elsewhere in the app for frequency-based study.
#   "mastery"   — words the learner already has in "learning" or
#                 "mastered" SRS state. Deliberately stronger than "an
#                 example sentence FOR one of your cards": a sentence is
#                 only accepted if EVERY recognizable word in it (not
#                 just the target) is also one of the learner's own
#                 learning/mastered cards — otherwise "sentences made of
#                 the cards you're learning" could still serve a
#                 sentence stuffed with unfamiliar vocabulary around the
#                 one word it was picked for. See _pick_words_mastery.

# Mastery mode: how many of the learner's own learning/mastered words to
# pull example sentences from before giving up on finding `count`
# sentences that are ENTIRELY made of learning/mastered vocabulary.
# Capped rather than unbounded — a learner with thousands of mastered
# words doesn't need this scanning all of them every request, and one
# with only a handful will simply come back with fewer than `count`.
_MASTERY_WORD_SAMPLE_CAP = 60
_MASTERY_SENTENCE_SCAN_CAP = 250
_MASTERY_MIN_KNOWN_WORDS = 3

# How many candidate words to try (across level/frequency-vocab sources)
# before giving up on finding `count` sentences whose kanji all fit the
# target level — see _sentence_fits_level. Needs to be generous: a word's
# OWN kanji being N5 says nothing about the kanji in ITS example
# sentences (JMdict/Tatoeba examples aren't difficulty-graded — see the
# 2026-08 "sentences too hard for the level" fix below), so several
# candidates in a row can fail before one works, especially for less
# common N5/N4 words with few examples.
_LEVEL_CANDIDATE_SCAN_CAP = 80


# ── Difficulty gate: real example sentences aren't graded by level ──
#
# ── Is a sentence actually at the level it is being served for? ──
# This used to be a kanji-character check and nothing else, and its own
# comment said why: a word-level check "would need to resolve each
# recognized segment back to a specific vocab entry's level ... worth
# revisiting with a word-level check later if that turns out to matter
# in practice". It mattered. A kanji gate passes any sentence spelled in
# easy characters however hard its grammar is, so N5 was being served
# 〜ようとする and 〜んです constructions all day.
#
# study/difficulty grades kanji, GRAMMAR and vocabulary together now;
# see that module for the measurement that motivated it. fits_loosely is
# the Tatoeba-facing gate — kanji + grammar + length, no vocabulary, for
# the reason given there. The curated bank (content/reading_sentences)
# does not pass through here at all: every sentence in it is graded by
# the full report at test time, so re-checking per request would be work
# already done.
def _sentence_fits_level(jp: str, level: str) -> bool:
    return difficulty.fits_loosely(jp, level)


def _is_kanji(c: str) -> bool:
    return "\u4e00" <= c <= "\u9fff"


def _pick_example_within_level(kanji: str, kana: str, level: str) -> dict | None:
    """Like vocab_extras.pick_random_example, but only considers
    examples whose sentence fits entirely within the target level's
    kanji set — shuffled so which valid example gets served still
    varies across requests, not always the "easiest" one first."""
    extras = vocab_extras.get_vocab_extras(kanji, kana, "", "en")
    examples = extras["examples"]
    random.shuffle(examples)
    for example in examples:
        if _sentence_fits_level(example["jp"], level):
            return example
    return None


def _pick_curated_phrases(level: str, count: int, exclude: set[str]) -> list[dict]:
    """`count` sentences from the hand-written bank for `level`.

    Drawn without replacement from a shuffled copy, so a single batch
    never repeats itself, and `exclude` (what the session has already
    shown) is honoured so a long sitting works through the bank rather
    than circling the same handful.
    """
    pool = [row for row in reading_sentences.BY_LEVEL.get(level, []) if row["jp"] not in exclude]
    random.shuffle(pool)
    return pool[:count]


def _pick_level_appropriate_phrases(word_pool: list[tuple[str, str, str]], level: str, count: int, scan_cap: int = _LEVEL_CANDIDATE_SCAN_CAP) -> list[tuple[str, str, str, dict]]:
    """Scans `word_pool` (already shuffled by the caller) for up to
    `count` (kanji, kana, level, example) tuples whose example sentence
    passes _sentence_fits_level. May return fewer than `count` if the pool
    or scan cap runs out first — callers already tolerate a shorter
    batch than requested."""
    picked = []
    for kanji, kana, lvl in word_pool[:scan_cap]:
        example = _pick_example_within_level(kanji, kana, level)
        if example is None:
            continue
        picked.append((kanji, kana, lvl, example))
        if len(picked) >= count:
            break
    return picked


def _pick_words_level(level: str, sample_size: int) -> list[tuple[str, str, str]]:
    pool = VOCAB_BY_LEVEL.get(level)
    if not pool:
        raise HTTPException(status_code=400, detail="Unknown JLPT level")
    candidates = [w for w in pool if vocab_extras.has_examples(w.get("kanji", ""), w.get("kana", ""))]
    random.shuffle(candidates)
    return [(w.get("kanji", ""), w.get("kana", ""), level) for w in candidates[:sample_size]]


def _pick_words_frequency(domain: str, tier: int, tier_size: int, sample_size: int) -> list[tuple[str, str, str | None]]:
    if domain not in ("vocab", "vocab_jmdict"):
        raise HTTPException(status_code=400, detail="domain must be 'vocab' or 'vocab_jmdict'")

    start, end = freq.tier_bounds(tier, tier_size)

    if domain == "vocab_jmdict":
        # DB does the has_examples filter + random sampling in one
        # indexed query — no need to fetch the whole tier first. No
        # difficulty gate here (see get_reading_batch's docstring): pool
        # words carry no JLPT level to gate kanji against.
        rows = jmdict_db.sample_rank_range_with_examples(start - 1, end - 1, sample_size)
        return [(r["kanji"], r["kana"], None) for r in rows]

    # domain == "vocab": small in-memory deck, same pattern as _pick_words_level.
    # Oversampled (sample_size, not the final `count`) — the difficulty
    # gate downstream will reject a chunk of these.
    keys = freq.tier_keys("vocab", tier, tier_size=tier_size)
    random.shuffle(keys)
    picked = []
    for key in keys:
        resolved = freq.resolve("vocab", key)
        if resolved is None:
            continue
        level, entry = resolved
        kanji, kana = entry.get("kanji", ""), entry.get("kana", "")
        if vocab_extras.has_examples(kanji, kana):
            picked.append((kanji, kana, level))
            if len(picked) >= sample_size:
                break
    return picked


def _deck_id_to_word():
    # Built once at import, reused across requests — vocab_to_id(entry,
    # level) for every deck entry, so mastery mode can resolve a
    # "vocab_{level}_..." SRS card id back to (kanji, kana) without
    # string-parsing an id whose kanji/kana fields could themselves
    # contain characters that make naive splitting fragile. Small
    # (~8.4k entries), cheap to build once.
    table = {}
    for level, entries in VOCAB_BY_LEVEL.items():
        for entry in entries:
            table[vocab_to_id(entry, level)] = (entry.get("kanji", ""), entry.get("kana", ""), level)
    return table


_DECK_ID_TO_WORD = _deck_id_to_word()


def _known_words_for_mastery(user_id: str) -> list[tuple[str, str, str | None]]:
    """The learner's own vocab cards (deck + JMdict pool) currently in
    "learning" or "mastered" SRS stage, per the real srs.py contract
    (checked against the actual file, not guessed):

      srs.get_user_states(user_id) -> {(prefixed_card_id, mode): {"state": ..., ...}}

    i.e. the key is a (card_id, mode) TUPLE, card_id is prefixed with
    "{user_id}:" (needs auth.unprefixed), and the status field is named
    "state", not "status". card_modes also tracks progress separately
    PER QUIZ MODE (flashcard/qcm/write/...), not per word — so "is this
    word learning/mastered" isn't single-valued in general. This uses
    VOCAB_STATUS_MODE (the same mode dictionary.py already reads for its
    own "is this word known" badge) as the canonical mode for that
    question, for consistency with the rest of the app rather than
    inventing a separate "any mode counts" rule here.
    """
    states = srs.get_user_states(user_id)
    known = []

    for (card_id, mode), state in states.items():
        if mode != VOCAB_STATUS_MODE:
            continue
        if state["state"] not in ("learning", "mastered"):
            continue
        raw_id = unprefixed(card_id, user_id)
        if raw_id.startswith("vocab_jmdict_"):
            # get_by_id() queries entries.id. vocab_jmdict_to_id() now
            # builds this suffix from that same `id`, so this resolves
            # correctly — until the migration in
            # scripts/migrate_jmdict_card_ids.py has run, though, a
            # returning user's card_ids here are still the OLD
            # seq-based suffix (out of get_by_id's id range), so this
            # silently matches nothing for them. That's the same
            # pre-migration gap the module docstring describes, not a
            # new issue introduced here.
            try:
                entry_id = int(raw_id[len("vocab_jmdict_"):])
            except ValueError:
                continue
            entry = jmdict_db.get_by_id(entry_id)
            if entry is not None:
                known.append((entry["kanji"], entry["kana"], None))
        elif raw_id.startswith("vocab_"):
            word = _DECK_ID_TO_WORD.get(raw_id)
            if word is not None:
                known.append(word)

    return known


def _pick_words_mastery(user_id: str, count: int) -> list[tuple[str, str, str | None, str, str, list]]:
    """Returns up to `count` (kanji, kana, level, jp_sentence, en,
    segments) tuples — segments (with SRS stats already attached) are
    computed here rather than in the caller, since building them is
    exactly how a sentence gets verified as entirely learning/mastered
    vocabulary; recomputing them again downstream would be wasted work.
    """
    known_words = _known_words_for_mastery(user_id)
    seen_words = set()
    unique_known = []
    for w in known_words:
        key = (w[0], w[1])
        if key not in seen_words:
            seen_words.add(key)
            unique_known.append(w)

    if len(unique_known) < _MASTERY_MIN_KNOWN_WORDS:
        raise HTTPException(
            status_code=400,
            detail="Not enough learning/mastered vocabulary yet for sentence mode — keep studying and check back.",
        )

    random.shuffle(unique_known)
    sample_words = unique_known[:_MASTERY_WORD_SAMPLE_CAP]

    states = srs.get_user_states(user_id)

    candidates = []  # (jp, en, kanji, kana, level)
    seen_jp = set()
    for kanji, kana, level in sample_words:
        extras = vocab_extras.get_vocab_extras(kanji, kana, "", "en")
        for ex in extras["examples"]:
            jp = ex["jp"]
            if jp in seen_jp:
                continue
            seen_jp.add(jp)
            candidates.append((jp, ex.get("en", ""), kanji, kana, level))

    random.shuffle(candidates)

    picked = []
    for jp, en, kanji, kana, level in candidates[:_MASTERY_SENTENCE_SCAN_CAP]:
        segments = attach_stats_to_segments(find_segments_in_text(jp), states, user_id)
        # The actual "made of the cards you're learning/mastered"
        # guarantee: every recognized (non-plain) segment's own status
        # must be learning/mastered — not just the target word.
        fully_known = all(
            seg["type"] == "plain" or seg["stats"]["status"] in ("learning", "mastered")
            for seg in segments
        )
        if not fully_known:
            continue
        picked.append((kanji, kana, level, jp, en, segments))
        if len(picked) >= count:
            break

    return picked


def _finish_phrase(jp: str, en: str, kanji: str, kana: str, level: str | None,
                   grammar: str | None = None) -> dict:
    """
    NOTE (2026-08): this used to also attach a `segments` field, built
    per-request via find_segments_in_text/attach_stats_to_segments (the
    morphology-based scanner in card_lookup.py). That's gone now —
    reading practice's word/kanji breakdown is served by the same
    AI-driven analyzer the phrase-analyzer screen uses (POST
    /api/phrase/analyze, save=false — see ReadingScreen.jsx), fired in
    the background as soon as a phrase is shown so it's ready by the
    time the reader wants it. That gives one consistent, LLM-quality
    segmentation everywhere in the app instead of two different
    scanners with different quirks, and drops a synchronous
    morphology pass from every batch fetch. The morphology scanner
    itself isn't gone — _pick_words_mastery below still uses it
    server-side to verify a candidate sentence is entirely made of the
    learner's own learning/mastered vocabulary before ever offering it
    — that's a cheap bulk filter, not something worth an LLM call per
    candidate sentence.
    """
    phrase = {
        "phrase": jp,
        "romaji": phrase_to_romaji(jp),
        "translation": en,
        "translation_lang": "en",  # see get_reading_batch's docstring
        "display_seconds": _display_seconds(jp),
        "source_word": {"kanji": kanji, "kana": kana, "level": level},
    }
    # Only a curated sentence carries this: it was written to demonstrate
    # exactly this point (and a test proves it contains it), so the
    # screen can name the grammar the reader is looking at. A corpus
    # sentence uses whatever it uses and gets no label rather than a
    # guessed one.
    if grammar:
        phrase["grammar"] = grammar
    return phrase


def _source_label(source: str, level: str | None, domain: str | None, tier: int | None) -> str:
    """Compact string stored in reading_log.phase (column kept as-is —
    see get_reading_batch's docstring — only what it *means* changed)."""
    if source == "level":
        return f"level:{level}"
    if source == "frequency":
        return f"freq:{domain}:{tier}"
    return "mastery"


@router.get("/api/reading/batch")
def get_reading_batch(
    source: str,                         # "level" | "frequency" | "mastery"
    level: str | None = None,            # required if source == "level"
    domain: str | None = None,           # required if source == "frequency": "vocab" | "vocab_jmdict"
    tier: int | None = None,             # required if source == "frequency"
    tier_size: int = freq.DEFAULT_TIER_SIZE,
    count: int = DEFAULT_BATCH,
    lang: str = "en",
    # Sentences this session has already shown, comma-separated. Only the
    # curated bank uses it (see _pick_curated_phrases) -- the Tatoeba path
    # varies by shuffling a pool of thousands and does not need it.
    exclude: str = "",
    user_id: str = Depends(get_user_id),
):
    """
    NOTE on `lang`: real example sentences (JMdict/Tatoeba-sourced) only
    carry an English translation in this app's data — there's no
    French/Spanish/etc. translation layer for them (unlike the old
    LLM-generated phrases, which were translated into whatever `lang`
    was requested). Every phrase in the response therefore comes back
    with "translation_lang": "en" regardless of `lang` — the frontend
    should label the translation as English rather than silently
    implying it's in the UI language. `lang` is accepted but currently
    unused; kept in the signature so the frontend doesn't need a
    conditional query-param builder, and in case a translated-examples
    layer gets added later.

    NOTE on reading_log.phase: not renamed at the DB column level (no
    migration tooling available here) — it now stores a compact label
    from _source_label() ("level:N3" / "freq:vocab:1" / "mastery")
    instead of the old "hiragana"/"katakana"/"mixed". Rename the column
    yourself with `ALTER TABLE reading_log RENAME COLUMN phase TO source;`
    if you'd rather it matched the new field name everywhere.

    NOTE on difficulty: for source="level" and source="frequency" with
    domain="vocab", every returned sentence is checked against
    _sentence_fits_level — no kanji outside the target level's allowed
    set. source="frequency" with domain="vocab_jmdict" has no such gate:
    JMdict-pool words carry no JLPT level to check kanji against, so a
    sentence there can still contain arbitrarily advanced kanji even
    for a "common" (low tier) word. mastery mode has its own, stronger
    per-word gate (see _pick_words_mastery) and needs nothing extra.
    """
    count = max(MIN_BATCH, min(MAX_BATCH, count))
    exclude_seen = {p for p in exclude.split("|") if p}

    if source == "level":
        if not level:
            raise HTTPException(status_code=400, detail="level is required for source=level")
        # The hand-written bank first, the Tatoeba pool for whatever is
        # left. Not a fallback in the "if the good path fails" sense --
        # the bank is finite (30-55 sentences a level) and a long sitting
        # will exhaust it, at which point real corpus sentences that pass
        # the gate are exactly what should come next. Ordering it this
        # way means the first thing a beginner ever reads is a sentence
        # written for them.
        curated = _pick_curated_phrases(level, count, exclude_seen)
        phrases = [
            _finish_phrase(row["jp"], row["en"], row["focus"], "", level, grammar=row["grammar"])
            for row in curated
        ]
        if len(phrases) < count:
            word_pool = _pick_words_level(level, _LEVEL_CANDIDATE_SCAN_CAP)
            picked = _pick_level_appropriate_phrases(word_pool, level, count - len(phrases))
            phrases.extend(
                _finish_phrase(example["jp"], example.get("en", ""), kanji, kana, lvl)
                for kanji, kana, lvl, example in picked
            )
    elif source == "frequency":
        if domain is None or tier is None:
            raise HTTPException(status_code=400, detail="domain and tier are required for source=frequency")
        if domain == "vocab":
            word_pool = _pick_words_frequency(domain, tier, tier_size, _LEVEL_CANDIDATE_SCAN_CAP)
            # Every word here resolved to a real deck level (see
            # _pick_words_frequency) — group by that level since a tier
            # can straddle more than one JLPT level, and the kanji gate
            # needs to check against each word's OWN level, not one
            # fixed level for the whole tier.
            phrases = []
            by_level: dict[str, list[tuple[str, str, str]]] = {}
            for kanji, kana, lvl in word_pool:
                by_level.setdefault(lvl, []).append((kanji, kana, lvl))
            remaining = count
            for lvl, words in by_level.items():
                if remaining <= 0:
                    break
                picked = _pick_level_appropriate_phrases(words, lvl, remaining, scan_cap=len(words))
                phrases.extend(
                    _finish_phrase(example["jp"], example.get("en", ""), kanji, kana, lvl2)
                    for kanji, kana, lvl2, example in picked
                )
                remaining = count - len(phrases)
        else:  # vocab_jmdict — no JLPT level, no gate (see docstring above)
            word_pool = _pick_words_frequency(domain, tier, tier_size, count)
            phrases = []
            for kanji, kana, lvl in word_pool:
                example = vocab_extras.pick_random_example(kanji, kana, "", "en")
                if example is None:
                    continue
                phrases.append(_finish_phrase(example["jp"], example.get("en", ""), kanji, kana, lvl))
    elif source == "mastery":
        picked = _pick_words_mastery(user_id, count)
        phrases = [
            _finish_phrase(jp, en, kanji, kana, lvl)
            # `segments` here is only the internal gating result used to
            # verify the sentence is fully learning/mastered vocabulary
            # (see _pick_words_mastery) — not sent to the client anymore.
            for kanji, kana, lvl, jp, en, segments in picked
        ]
    else:
        raise HTTPException(status_code=400, detail="source must be 'level', 'frequency', or 'mastery'")

    return {
        "source": source, "level": level, "domain": domain, "tier": tier,
        "phrases": phrases,
    }


@router.post("/api/reading/result")
def post_reading_result(payload: ResultPayload, user_id: str = Depends(get_user_id)):
    # Correctness is self-assessed by the user after seeing the reveal
    # (romaji auto-matching was too brittle — see normalize_romaji's
    # docstring; it's kept above only as an optional sanity-check helper).
    #
    # reading_log.level is NOT NULL (see data_structure.sql) but
    # payload.level is only ever set for source="level" — frequency and
    # mastery sessions have no single JLPT level. Falls back to '' rather
    # than crashing the insert; the compact `phase` label already carries
    # the real source info ("freq:vocab:1" / "mastery") for anything that
    # needs it. Consider `ALTER TABLE reading_log ALTER COLUMN level DROP
    # NOT NULL;` if you'd rather this be a real NULL.
    level_for_log = payload.level or ""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO reading_log(user_id, level, phase, phrase, romaji, answer, correct)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (user_id, level_for_log, payload.source, payload.phrase, payload.romaji, payload.answer, payload.correct),
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
            "source": phase, "phrase": phrase, "romaji": romaji,
            "answer": answer, "correct": correct, "created_at": created_at.isoformat(),
        }
        for level, phase, phrase, romaji, answer, correct, created_at in rows
    ]


# ── Reading Comprehension ─────────────────────────────────────────────────────

# Text length and question count scale with JLPT level difficulty.
COMPREHENSION_SPECS = {
    "N5": {"chars": "150-220",  "questions": 6},
    "N4": {"chars": "220-320",  "questions": 7},
    "N3": {"chars": "320-450",  "questions": 8},
    "N2": {"chars": "450-600",  "questions": 9},
    "N1": {"chars": "600-800",  "questions": 10},
}
DEFAULT_COMPREHENSION_SPEC = {"chars": "300-400", "questions": 8}

# Reading window in seconds, scaled per level alongside text length; users
# can stop early regardless.
READ_SECONDS_BY_LEVEL = {
    "N5": 240,   # 4 min
    "N4": 300,   # 5 min
    "N3": 420,   # 7 min
    "N2": 540,   # 9 min
    "N1": 600,   # 10 min
}
DEFAULT_READ_SECONDS = 420

# Same allowed-kanji restriction as the phrase-reading mode (see
# SYSTEM_PROMPT_TEMPLATE above) — a comprehension text full of kanji the
# user has never studied defeats the point of leveling it by JLPT level.
COMPREHENSION_PROMPT_TEMPLATE = """You are creating a Japanese reading-comprehension exercise for a learner at JLPT level {level}.

Write a self-contained Japanese text ({chars} characters) using vocabulary and grammar appropriate for JLPT {level}. Then write {questions} multiple-choice questions ABOUT THE TEXT, mixing different question types so the exercise tests more than just plot recall.

When writing the text:

- You MAY use hiragana, katakana and punctuation freely.
- If you use any kanji, you may use only the following kanji::
{allowed_kanji}
- Any other kanji outside this list is forbidden.
- If a word normally contains a disallowed kanji, replace that kanji with its hiragana reading instead.

Question types to mix across the {questions} questions (use a good variety — don't make them all "comprehension"):
- "comprehension": tests understanding of what happened, who/what/when/where, or the main idea of a specific passage in the text.
- "vocabulary": asks what a specific word or kanji FROM THE TEXT means (quote the exact word/kanji from the text in the question).
- "grammar": asks about a grammar point, particle, or verb form used in a specific sentence from the text (quote the relevant sentence fragment).
- "inference": asks the learner to infer something not stated directly (the author's intent, a character's feeling, what likely happens next).

Respond with ONLY a JSON object (no markdown fences, no commentary) matching exactly this schema:
{{
  "text": "...",
  "translation": "...",
  "questions": [
    {{
      "type": "comprehension",
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correct": 0
    }}
  ]
}}

Rules:
- "text" must be natural, coherent Japanese with a clear topic (a short story, announcement, letter, description, etc), long enough to support questions of every type above.
- "translation" is a faithful {lang_name} translation of "text".
- "type" must be exactly one of: "comprehension", "vocabulary", "grammar", "inference".
- Each "question" is written in {lang_name} (quoting the relevant Japanese word/phrase from the text in italics-style quotes where relevant) and must be answerable using only the text provided.
- "options" must contain exactly 4 choices in {lang_name}. All options must be plausible — avoid obviously wrong distractors.
- "correct" is the 0-based index of the only correct option.
- Generate exactly {questions} questions, with at least one of each type if {questions} >= 4, and a roughly even mix overall.
"""


VALID_QUESTION_TYPES = {"comprehension", "vocabulary", "grammar", "inference"}

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

    content = _chat([
        {"role": "system", "content": prompt},
        {"role": "user", "content": "Generate the reading comprehension exercise."},
    ])
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
        # Be lenient on "type" — default rather than reject, since it's
        # metadata for display, not something correctness depends on.
        if q.get("type") not in VALID_QUESTION_TYPES:
            q["type"] = "comprehension"

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
        "read_seconds": READ_SECONDS_BY_LEVEL.get(level, DEFAULT_READ_SECONDS),
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
                "type": q.get("type", "comprehension"),
                "question": q["question"],
                "options": q["options"],
                "correct": q["correct"],
                "user_answer": answers[i] if i < len(answers) else None,
                "is_correct": i < len(answers) and answers[i] == q["correct"],
            }
            for i, q in enumerate(questions)
        ],
    }